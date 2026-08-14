import { LinearGradient } from "expo-linear-gradient";
import * as ExpoLinking from "expo-linking";
import { useFocusEffect, useRouter } from "expo-router";
import { StatusBar } from "expo-status-bar";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  ActivityIndicator,
  AppState,
  Image,
  Linking,
  Pressable,
  RefreshControl,
  ScrollView,
  Text,
  View,
} from "react-native";
import { SafeAreaView, useSafeAreaInsets } from "react-native-safe-area-context";

import { ScreenHorizontalPadding } from "@/constants/theme";
import { appAlert } from "@/components/ui/app-dialog";
import { SymbolView } from "@/components/ui/symbol-view";
import { getValidAccessToken } from "@/features/auth/hooks/use-auth-session";
import { getPreferredExpoScheme } from "@/lib/expo-scheme";
import { refreshPremiumStatus } from "@/features/profile/hooks/use-premium-status";
import {
  type BillingCycle,
  type PremiumPaymentInitResponse,
  type PremiumPlan,
  type PremiumSubscriptionRecord,
  cancelPremiumSubscription,
  confirmPremiumPayment,
  getMyPremiumSubscriptions,
  getPremiumPlans,
  subscribePremium,
} from "../api/premium-subscription-api";
import {
  clearPendingPremiumInvoice,
  readPendingPremiumInvoiceId,
  savePendingPremiumInvoice,
} from "../lib/pending-premium-invoice";

/**
 * Deep link PayOS gọi lại sau khi thanh toán xong.
 *
 * PHẢI dựng bằng `ExpoLinking.createURL` chứ không hardcode: scheme thật của app
 * là `culturequestlitemobile` (app.json), trước đây hardcode "culturequest://..."
 * nên OS không resolve được -> app không bao giờ nhận callback -> không refetch
 * -> isPremium kẹt ở false dù đã thanh toán thành công.
 *
 * Path trỏ về đúng route đang tồn tại (`src/app/subscription/premium.tsx`).
 */
const PAYOS_REDIRECT_URL = ExpoLinking.createURL("/subscription/premium", {
  scheme: getPreferredExpoScheme(),
});

/**
 * Trong Expo Go, `createURL` trả về `exp://<ip>:8081/--/...` — gửi URL đó lên
 * PayOS có thể làm bước tạo link thanh toán fail. Khi đó bỏ hẳn redirectUrl để
 * backend dùng `payos.return-url` mặc định; user vẫn quay về app bằng nút Back
 * và fallback focus/AppState bên dưới vẫn bắt được.
 */
const PAYOS_SAFE_REDIRECT_URL = PAYOS_REDIRECT_URL.startsWith("exp://")
  ? undefined
  : PAYOS_REDIRECT_URL;

/**
 * Sau khi user quay lại app, app gọi `POST /api/user/premium/{invoiceId}/confirm`
 * để backend đối soát trực tiếp với PayOS (không chờ webhook). Nhưng "quay lại
 * app" không có nghĩa là "đã trả tiền xong": rất nhiều user bấm Back khi đang
 * chờ app ngân hàng xử lý, lúc đó PayOS vẫn báo PENDING. Vì vậy vẫn cần gọi
 * lại vài lần thay vì kết luận ngay sau lần đầu.
 *
 * Lịch chờ: dày lúc đầu rồi thưa dần để không spam PayOS. Tổng ~74s mỗi lượt
 * sync; hết lượt mà vẫn PENDING thì invoice vẫn được giữ lại trên đĩa nên lần
 * focus / mở lại app sau đó sẽ tự đối soát tiếp.
 */
const PAYMENT_POLL_BACKOFF_MS = [
  2000, 3000, 3000, 5000, 5000, 8000, 8000, 10000, 15000, 15000,
];

const delay = (ms: number) =>
  new Promise<void>((resolve) => {
    setTimeout(resolve, ms);
  });

/** PayOS báo PAID -> backend set invoice ACTIVE + paymentStatus PAID + isPremium. */
const isActivatedRecord = (record: PremiumSubscriptionRecord) =>
  record.status === "ACTIVE" && record.paymentStatus === "PAID";

/**
 * PayOS báo CANCELLED/EXPIRED/FAILED -> backend set paymentStatus FAILED. Đây
 * là trạng thái kết thúc, phải dừng đối soát ngay thay vì chờ hết 74s rồi báo
 * "chưa nhận được xác nhận" — user sẽ tưởng mạng chậm và ngồi đợi vô ích.
 */
const isRejectedRecord = (record: PremiumSubscriptionRecord) =>
  record.paymentStatus === "FAILED" || record.status === "CANCELLED";

/**
 * Hóa đơn còn hiệu lực và chưa đăng ký hủy -> mới cho bấm "Hủy gia hạn".
 * Backend cũng chặn đúng hai điều kiện này, để lộ nút ra sẽ chỉ nhận 400.
 */
const canCancelRecord = (record: PremiumSubscriptionRecord) =>
  record.status === "ACTIVE" && !record.willCancelAtEnd;

/**
 * Lý do mặc định gửi kèm khi hủy. App chưa có ô nhập text trong popup
 * (`appAlert` chỉ hỗ trợ alert/confirm), mà `Invoice.cancelReason` bên BE là
 * tùy chọn, nên gửi chuỗi cố định để admin vẫn biết yêu cầu đến từ mobile.
 */
const CANCEL_REASON = "Người dùng hủy gia hạn từ ứng dụng di động";

const formatCurrency = (value?: number | null) => {
  if (!value) return "Liên hệ";
  return value.toLocaleString("vi-VN", {
    currency: "VND",
    maximumFractionDigits: 0,
    style: "currency",
  });
};

const formatDate = (dateStr?: string | null) => {
  if (!dateStr) return "—";
  try {
    return new Date(dateStr).toLocaleDateString("vi-VN");
  } catch {
    return dateStr;
  }
};

const getInvoiceStatusLabel = (status?: string) => {
  switch (status) {
    case "PENDING":
      return "Chờ kích hoạt";
    case "ACTIVE":
      return "Đang hoạt động";
    case "EXPIRED":
      return "Đã hết hạn";
    case "CANCELLED":
      return "Đã huỷ";
    default:
      return status ?? "—";
  }
};

const getPaymentStatusLabel = (status?: string) => {
  switch (status) {
    case "PENDING":
      return "Chờ thanh toán";
    case "PAID":
      return "Đã thanh toán";
    case "FAILED":
      return "Thanh toán thất bại";
    default:
      return status ?? "—";
  }
};

/**
 * `qrCode` PayOS trả về là chuỗi VietQR thô (dạng "00020101021238..."), KHÔNG
 * phải URL ảnh, nên chỉ render bằng <Image> được khi backend đổi sang trả
 * URL / data-URI. Guard này để không nhồi chuỗi thô vào <Image> (ra ô trắng) và
 * để không hứa với user là "có QR bên dưới" khi thực tế chẳng có gì hiện ra.
 */
const resolveQrImageUri = (qrCode?: string | null) => {
  if (!qrCode) return null;
  return qrCode.startsWith("http://") ||
    qrCode.startsWith("https://") ||
    qrCode.startsWith("data:image/")
    ? qrCode
    : null;
};

const getPlanPrice = (plan: PremiumPlan, cycle: BillingCycle) =>
  cycle === "MONTHLY" ? plan.priceMonthly : plan.priceYearly;

/**
 * Bảng màu của màn Premium lấy thẳng từ hệ màu chung của app (hồng #EB489B +
 * cam #F58752 như trang hotspot detail), thay cho tông tím #7C3AED cũ vốn không
 * xuất hiện ở bất kỳ màn nào khác.
 */
const premiumBrandPink = "#EB489B";
const premiumBrandOrange = "#F58752";
const premiumSoftPink = "#FFF0F6";
const premiumSoftPinkBorder = "#F7E5EB";
const premiumDisabledPink = "#F3C6D8";
const premiumHeaderGradient = ["#FF6A8E", "#EB489B", "#F58752"] as const;
/** Cùng thang chữ với hotspot detail: tiêu đề #2B2233, nội dung #6F657A. */
const premiumTitleColor = "#2B2233";
const premiumBodyColor = "#6F657A";

const PREMIUM_FEATURES = [
  {
    icon: { ios: "sparkles", android: "auto_awesome", web: "auto_awesome" },
    label: "Lập kế hoạch & tối ưu lịch trình bằng AI",
  },
  {
    icon: {
      ios: "record.circle.fill",
      android: "radio_button_checked",
      web: "radio_button_checked",
    },
    label: "Ghi hành trình real-time (Record Journey)",
  },
  {
    icon: { ios: "headphones", android: "headphones", web: "headphones" },
    label: "Thuyết minh âm thanh Audio Guide di sản",
  },
  {
    icon: {
      ios: "ticket.fill",
      android: "confirmation_number",
      web: "confirmation_number",
    },
    label: "Voucher ưu đãi đặc quyền từ đối tác",
  },
  {
    icon: {
      ios: "bookmark.fill",
      android: "bookmark",
      web: "bookmark",
    },
    label: "Lưu không giới hạn địa điểm yêu thích",
  },
];

export default function PremiumSubscriptionScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const [plans, setPlans] = useState<PremiumPlan[]>([]);
  const [selectedPlan, setSelectedPlan] = useState<PremiumPlan | null>(null);
  const [billingCycle, setBillingCycle] = useState<BillingCycle>("MONTHLY");
  const [payment, setPayment] = useState<PremiumPaymentInitResponse | null>(
    null,
  );
  const [history, setHistory] = useState<PremiumSubscriptionRecord[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [isConfirmingPayment, setIsConfirmingPayment] = useState(false);
  const [cancelingInvoiceId, setCancelingInvoiceId] = useState<number | null>(
    null,
  );
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  /**
   * Invoice đang chờ webhook PayOS xác nhận. null = không có gì để poll.
   *
   * Khởi tạo từ ổ đĩa để hồi phục được trường hợp app bị OS kill trong lúc user
   * đang ở app ngân hàng: quay lại là cold start, nhưng vẫn biết phải chờ
   * invoice nào. State dùng để render banner, ref dùng để đọc trong vòng poll
   * async (tránh đọc giá trị cũ qua closure).
   */
  const [pendingInvoiceId, setPendingInvoiceId] = useState<number | null>(() =>
    readPendingPremiumInvoiceId(),
  );
  const pendingInvoiceIdRef = useRef<number | null>(pendingInvoiceId);

  /**
   * Trạng thái thô của invoice đang chờ, lấy từ lần poll gần nhất. Dùng để
   * chẩn đoán webhook ngay trên máy: PENDING/PENDING đứng yên = PayOS chưa gọi
   * `POST /api/payment/payos/webhook` về backend.
   */
  const [pendingProbe, setPendingProbe] = useState<{
    checkedTimes: number;
    status: string | null;
    paymentStatus: string | null;
    /**
     * Lỗi của lần gọi `/confirm` gần nhất. Phải hiển thị ra màn hình: nếu
     * backend không nói chuyện được với PayOS (sai key, hết hạn link, hóa đơn
     * chưa có payosOrderCode...) thì trước đây lỗi bị nuốt hết, user chỉ thấy
     * vòng quay 74 giây rồi một câu chung chung "PayOS chưa ghi nhận".
     */
    errorMessage: string | null;
  } | null>(null);
  /** Chặn 2 nguồn trigger (focus + AppState + deep link) chạy chồng nhau. */
  const isSyncingRef = useRef(false);
  const isMountedRef = useRef(true);

  useEffect(() => {
    isMountedRef.current = true;
    return () => {
      isMountedRef.current = false;
    };
  }, []);

  /** Cập nhật đồng thời ref + state + ổ đĩa để 3 nguồn không bao giờ lệch nhau. */
  const updatePendingInvoice = useCallback((invoiceId: number | null) => {
    pendingInvoiceIdRef.current = invoiceId;
    if (invoiceId === null) {
      clearPendingPremiumInvoice();
    } else {
      savePendingPremiumInvoice(invoiceId);
    }
    setPendingInvoiceId(invoiceId);
    setPendingProbe(null);
  }, []);

  const selectedAmount = useMemo(
    () => (selectedPlan ? getPlanPrice(selectedPlan, billingCycle) : null),
    [selectedPlan, billingCycle],
  );

  const qrImageUri = useMemo(
    () => resolveQrImageUri(payment?.qrCode),
    [payment],
  );

  const loadData = useCallback(async () => {
    const accessToken = await getValidAccessToken();
    if (!accessToken) {
      setErrorMessage("Bạn cần đăng nhập để xem gói Premium.");
      return;
    }
    const [fetchedPlans, fetchedHistory] = await Promise.all([
      getPremiumPlans(accessToken),
      getMyPremiumSubscriptions(accessToken).catch(() => [] as PremiumSubscriptionRecord[]),
    ]);

    setPlans(fetchedPlans);
    setSelectedPlan((cur) => {
      if (cur && fetchedPlans.some((p) => p.subscriptionPlanId === cur.subscriptionPlanId)) {
        return cur;
      }
      return fetchedPlans[0] ?? null;
    });
    setHistory(fetchedHistory);
    setErrorMessage(null);
  }, []);

  useEffect(() => {
    let mounted = true;
    setIsLoading(true);
    loadData()
      .catch((err) => {
        if (mounted) {
          setErrorMessage(
            err instanceof Error ? err.message : "Không tải được dữ liệu.",
          );
        }
      })
      .finally(() => {
        if (mounted) setIsLoading(false);
      });
    return () => {
      mounted = false;
    };
  }, [loadData]);

  /**
   * Đồng bộ trạng thái Premium sau khi user quay lại app.
   *
   * - Luôn gọi `refreshPremiumStatus()` để đẩy isPremium mới nhất vào store
   *   dùng chung (`use-premium-status`). Trước đây màn này KHÔNG hề đụng tới
   *   store đó, mà `ensureLoaded()` lại return sớm khi cache đã `isLoaded`,
   *   nên các màn home/explore/record-journey/user-plan vẫn thấy isPremium=false
   *   cho tới khi kill app.
   * - Nếu vừa tạo invoice (`pendingInvoiceIdRef`), gọi API confirm để backend
   *   đối soát với PayOS cho tới khi ĐÚNG invoice đó chuyển ACTIVE/PAID. Bám
   *   theo invoiceId thay vì "có invoice ACTIVE nào đó" để trường hợp gia hạn
   *   (user đang còn hạn) không báo thành công nhầm.
   */
  const syncPremiumStatus = useCallback(async () => {
    if (isSyncingRef.current) return;
    isSyncingRef.current = true;

    // Invoice quá hạn chờ (TTL trong pending-premium-invoice) sẽ được
    // read... trả về null, đồng bộ lại state để banner "đang chờ" biến mất.
    if (
      pendingInvoiceIdRef.current !== null &&
      readPendingPremiumInvoiceId() === null
    ) {
      updatePendingInvoice(null);
    }

    const invoiceId = pendingInvoiceIdRef.current;
    if (invoiceId !== null && isMountedRef.current) {
      setIsConfirmingPayment(true);
    }

    const refreshHistory = async (accessToken: string) => {
      const records = await getMyPremiumSubscriptions(accessToken).catch(
        () => null,
      );
      if (records && isMountedRef.current) setHistory(records);
      return records;
    };

    try {
      const accessToken = await getValidAccessToken();
      if (!accessToken) return;

      // Không có invoice đang chờ -> chỉ cần làm tươi lịch sử + store rồi thoát.
      if (invoiceId === null) {
        await refreshHistory(accessToken);
        await refreshPremiumStatus().catch(() => false);
        return;
      }

      const totalChecks = PAYMENT_POLL_BACKOFF_MS.length + 1;
      let lastConfirmError: string | null = null;

      for (let attempt = 0; attempt < totalChecks; attempt += 1) {
        if (!isMountedRef.current) return;

        /**
         * Nguồn sự thật: BE hỏi thẳng PayOS rồi tự kích hoạt/huỷ invoice và
         * trả về invoice sau đối soát. Nếu confirm lỗi (mất mạng, PayOS timeout,
         * invoice chưa có payosOrderCode...) thì lùi về đọc `/my` — vẫn bắt được
         * trường hợp webhook PayOS đã tự cập nhật invoice trước đó.
         *
         * Lỗi confirm được GIỮ LẠI để hiển thị: đây là chỗ duy nhất phân biệt
         * được "user chưa trả tiền" với "backend không gọi được PayOS" — hai
         * tình huống nhìn y hệt nhau trên UI (vòng quay 74 giây) nhưng cách xử
         * lý hoàn toàn khác.
         */
        let record: PremiumSubscriptionRecord | null = null;

        try {
          record = await confirmPremiumPayment(accessToken, invoiceId);
          lastConfirmError = null;
        } catch (confirmError) {
          lastConfirmError =
            confirmError instanceof Error
              ? confirmError.message
              : "Không gọi được API đối soát PayOS.";
        }

        if (!record) {
          const records = await refreshHistory(accessToken);
          record = records?.find((item) => item.invoiceId === invoiceId) ?? null;
        }

        // Ghi lại trạng thái thô của invoice để hiển thị trên banner — cách duy
        // nhất chẩn đoán được trên máy thật / bản release (không có console).
        // Đứng yên PENDING/PENDING nghĩa là PayOS vẫn chưa thấy tiền về.
        if (isMountedRef.current) {
          setPendingProbe({
            checkedTimes: attempt + 1,
            errorMessage: lastConfirmError,
            paymentStatus: record?.paymentStatus ?? null,
            status: record?.status ?? null,
          });
        }

        if (record && isActivatedRecord(record)) {
          updatePendingInvoice(null);
          await refreshHistory(accessToken);
          await refreshPremiumStatus().catch(() => false);
          if (!isMountedRef.current) return;
          setPayment(null);
          setErrorMessage(null);
          appAlert.alert(
            "Kích hoạt Premium thành công",
            "Tài khoản của bạn đã được nâng cấp. Toàn bộ tính năng Premium đã sẵn sàng.",
          );
          return;
        }

        // PayOS chốt là thất bại -> dừng hẳn, không đối soát tiếp.
        if (record && isRejectedRecord(record)) {
          updatePendingInvoice(null);
          await refreshHistory(accessToken);
          if (!isMountedRef.current) return;
          setPayment(null);
          setErrorMessage(
            "PayOS báo giao dịch không thành công. Vui lòng đăng ký lại nếu bạn vẫn muốn nâng cấp Premium.",
          );
          appAlert.alert(
            "Thanh toán không thành công",
            "Giao dịch đã bị huỷ hoặc thất bại. Tài khoản của bạn chưa bị trừ tiền cho gói này.",
          );
          return;
        }

        if (attempt < totalChecks - 1) {
          await delay(PAYMENT_POLL_BACKOFF_MS[attempt]);
        }
      }

      // Hết lượt mà PayOS vẫn báo chưa thanh toán. Giữ nguyên invoice đang chờ
      // để lần focus / mở lại app sau đó tự đối soát tiếp.
      if (isMountedRef.current && pendingInvoiceIdRef.current !== null) {
        await refreshHistory(accessToken);
        await refreshPremiumStatus().catch(() => false);
        setErrorMessage(
          lastConfirmError
            ? `Không đối soát được với PayOS: ${lastConfirmError}`
            : "PayOS vẫn chưa ghi nhận giao dịch này. Nếu bạn đã thanh toán, hãy bấm Kiểm tra lại sau ít phút.",
        );
      }
    } finally {
      isSyncingRef.current = false;
      if (isMountedRef.current) setIsConfirmingPayment(false);
    }
  }, [updatePendingInvoice]);

  async function handleRefresh() {
    setIsRefreshing(true);
    try {
      await loadData();
      await syncPremiumStatus();
    } catch (err) {
      setErrorMessage(
        err instanceof Error ? err.message : "Không tải được dữ liệu.",
      );
    } finally {
      setIsRefreshing(false);
    }
  }

  /**
   * Đường về phổ biến nhất KHÔNG phải deep link mà là user tự bấm Back từ trình
   * duyệt PayOS — lúc đó không có event `url` nào cả. `useFocusEffect` +
   * `AppState` bắt được cả hai trường hợp này.
   */
  useFocusEffect(
    useCallback(() => {
      void syncPremiumStatus();
    }, [syncPremiumStatus]),
  );

  useEffect(() => {
    const subscription = AppState.addEventListener("change", (nextState) => {
      if (nextState === "active") void syncPremiumStatus();
    });

    return () => subscription.remove();
  }, [syncPremiumStatus]);

  /**
   * `useURL()` trả về cả URL khởi chạy app (cold start sau khi bị OS kill) lẫn
   * các URL đến sau, nên thay được cho `addEventListener` + `getInitialURL`.
   */
  const incomingUrl = ExpoLinking.useURL();

  useEffect(() => {
    if (!incomingUrl) return;
    if (!incomingUrl.includes("subscription/premium")) return;
    void syncPremiumStatus();
  }, [incomingUrl, syncPremiumStatus]);

  async function openPayOs(paymentResponse = payment) {
    if (!paymentResponse) return;
    // Backend chỉ trả duy nhất `checkoutUrl` cho PayOS.
    const targetUrl = paymentResponse.checkoutUrl;
    if (targetUrl) {
      try {
        const canOpen = await Linking.canOpenURL(targetUrl);
        if (canOpen) {
          await Linking.openURL(targetUrl);
          return;
        }
      } catch {
        // fallback sang QR
      }
    }
    if (resolveQrImageUri(paymentResponse.qrCode)) {
      appAlert.alert(
        "Không mở được trang thanh toán",
        "Bạn có thể quét mã QR bên dưới để thanh toán.",
      );
      return;
    }
    appAlert.alert(
      "Không mở được trang thanh toán",
      "Hệ thống chưa trả liên kết thanh toán hợp lệ. Vui lòng thử đăng ký lại.",
    );
  }

  /**
   * Hủy gia hạn gói đang chạy. Sau khi BE trả invoice đã cập nhật, patch thẳng
   * record đó trong `history` để UI đổi ngay, rồi vẫn refetch `/my` để chắc
   * chắn khớp server.
   */
  async function handleCancelSubscription(record: PremiumSubscriptionRecord) {
    const confirmed = await appAlert.confirm({
      cancelLabel: "Giữ gói",
      confirmLabel: "Hủy gia hạn",
      destructive: true,
      message: `Bạn vẫn dùng được toàn bộ quyền lợi Premium đến hết ngày ${formatDate(
        record.endDate,
      )}. Sau ngày đó gói sẽ không tự gia hạn nữa.`,
      title: "Hủy gia hạn Premium?",
      tone: "warning",
    });

    if (!confirmed) return;

    const accessToken = await getValidAccessToken();
    if (!accessToken) {
      appAlert.alert("Cần đăng nhập", "Vui lòng đăng nhập lại để thao tác.");
      return;
    }

    setCancelingInvoiceId(record.invoiceId);
    setErrorMessage(null);

    try {
      const updated = await cancelPremiumSubscription(
        accessToken,
        record.invoiceId,
        CANCEL_REASON,
      );

      if (isMountedRef.current) {
        setHistory((current) =>
          current.map((item) =>
            item.invoiceId === updated.invoiceId ? updated : item,
          ),
        );
      }

      appAlert.alert(
        "Đã hủy gia hạn",
        `Gói Premium vẫn hoạt động đến hết ngày ${formatDate(
          updated.endDate ?? record.endDate,
        )} và sẽ không tự gia hạn sau đó.`,
      );

      const records = await getMyPremiumSubscriptions(accessToken).catch(
        () => null,
      );
      if (records && isMountedRef.current) setHistory(records);
    } catch (err) {
      setErrorMessage(
        err instanceof Error ? err.message : "Không hủy được gia hạn Premium.",
      );
    } finally {
      if (isMountedRef.current) setCancelingInvoiceId(null);
    }
  }

  async function handleSubscribe() {
    if (!selectedPlan) {
      appAlert.alert("Chưa chọn gói", "Vui lòng chọn một gói Premium.");
      return;
    }
    const accessToken = await getValidAccessToken();
    if (!accessToken) {
      appAlert.alert("Cần đăng nhập", "Vui lòng đăng nhập để đăng ký gói Premium.");
      return;
    }

    setIsSubmitting(true);
    setErrorMessage(null);
    setPayment(null);
    updatePendingInvoice(null);

    try {
      const result = await subscribePremium({
        accessToken,
        subscriptionPlanId: selectedPlan.subscriptionPlanId,
        billingCycle,
        redirectUrl: PAYOS_SAFE_REDIRECT_URL,
      });
      setPayment(result);
      // Backend trả invoiceId qua field `subscriptionId` (PaymentInitResponse).
      // Ghi lại để biết phải đối soát ĐÚNG invoice nào qua API confirm.
      updatePendingInvoice(result.subscriptionId ?? null);
      await openPayOs(result);
    } catch (err) {
      updatePendingInvoice(null);
      setErrorMessage(
        err instanceof Error ? err.message : "Đăng ký gói Premium thất bại.",
      );
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    // `edges` bỏ "top" để nền header chạy hết lên mép trên máy (dưới thanh
    // trạng thái), giống hero của trang hotspot detail. Khoảng an toàn được bù
    // lại bằng `insets.top` ngay trong header.
    <SafeAreaView className="flex-1 bg-white" edges={["left", "right"]}>
      <StatusBar style="light" />

      <ScrollView
        contentContainerStyle={{ paddingBottom: 40 + insets.bottom }}
        refreshControl={
          <RefreshControl refreshing={isRefreshing} onRefresh={handleRefresh} />
        }
      >
        {/* Header */}
        <LinearGradient
          colors={premiumHeaderGradient}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 1 }}
          style={{
            paddingBottom: 32,
            paddingHorizontal: ScreenHorizontalPadding,
            paddingTop: insets.top + 12,
          }}
        >
          <View className="mb-4 flex-row items-center justify-between">
            <Pressable
              onPress={() => {
                if (router.canGoBack()) {
                  router.back();
                } else {
                  router.replace("/subscription");
                }
              }}
              className="h-10 w-10 items-center justify-center rounded-full bg-white/20"
            >
              <SymbolView
                name={{ ios: "chevron.left", android: "arrow_back", web: "arrow_back" }}
                size={18}
                tintColor="white"
              />
            </Pressable>
            <View className="flex-row items-center gap-2 rounded-full bg-white/20 px-4 py-1.5">
              <SymbolView
                name={{ ios: "crown.fill", android: "workspace_premium", web: "workspace_premium" }}
                size={14}
                tintColor="#FFD700"
              />
              <Text className="text-[12px] font-semibold text-white">
                Premium Explorer
              </Text>
            </View>
            <View className="w-10" />
          </View>

          <Text className="text-[26px] font-semibold text-white">
            Explorer Premium
          </Text>
          <Text className="mt-1 text-[14px] leading-5 text-white/85">
            Mở khoá toàn bộ trải nghiệm khám phá di sản văn hoá thông minh
          </Text>

          {/* Pricing Hero */}
          <View className="mt-5 rounded-2xl bg-white/15 p-4">
            <Text className="text-[12px] text-white/80">Biểu phí ưu đãi</Text>
            <View className="mt-1 flex-row items-baseline gap-2">
              <Text className="text-[30px] font-semibold text-white">
                {selectedPlan
                  ? formatCurrency(getPlanPrice(selectedPlan, billingCycle))
                  : billingCycle === "MONTHLY"
                    ? "59.000 ₫"
                    : "499.000 ₫"}
              </Text>
              <Text className="text-[14px] text-white/80">
                /{billingCycle === "MONTHLY" ? "tháng" : "năm"}
              </Text>
            </View>
            {billingCycle === "YEARLY" && (
              <View className="mt-2 self-start rounded-full bg-white/85 px-3 py-1">
                <Text
                  className="text-[11px]"
                  style={{ color: premiumBrandPink }}
                >
                  Giá được áp dụng theo từng gói
                </Text>
              </View>
            )}
          </View>
        </LinearGradient>

        <View
          className="pt-5"
          style={{ paddingHorizontal: ScreenHorizontalPadding }}
        >
          {/* Error */}
          {errorMessage ? (
            <View className="mb-4 rounded-2xl border border-[#FFE1E8] bg-[#FFF5F8] p-4">
              <Text className="text-[13px] leading-5 text-[#B42345]">
                {errorMessage}
              </Text>
            </View>
          ) : null}

          {/* Đang chờ webhook PayOS xác nhận invoice vừa thanh toán.
              Render ở ngoài khối `payment` để vẫn hiện sau khi app bị kill và
              mở lại (lúc đó `payment` đã mất, chỉ còn invoice lưu trên đĩa). */}
          {pendingInvoiceId !== null ? (
            <View
              className="mb-4 rounded-2xl border p-4"
              style={{
                backgroundColor: premiumSoftPink,
                borderColor: premiumSoftPinkBorder,
              }}
            >
              <View className="flex-row items-center gap-3">
                {isConfirmingPayment ? (
                  <ActivityIndicator color={premiumBrandPink} />
                ) : (
                  <SymbolView
                    name={{ ios: "clock.fill", android: "schedule", web: "schedule" }}
                    size={18}
                    tintColor={premiumBrandPink}
                  />
                )}
                <Text
                  className="flex-1 text-[13px] leading-5"
                  style={{ color: premiumBrandPink }}
                >
                  {isConfirmingPayment
                    ? "Đang đối soát giao dịch với PayOS..."
                    : "Đơn hàng chưa được PayOS xác nhận."}
                </Text>
              </View>
              <Text
                className="mt-2 text-[12px] leading-5"
                style={{ color: premiumBodyColor }}
              >
                Premium sẽ tự bật ngay khi PayOS ghi nhận thanh toán. Bạn có thể
                để màn hình này mở hoặc bấm kiểm tra lại.
              </Text>

              {/* Trạng thái thô của invoice sau đối soát. Đứng yên "Chờ kích
                  hoạt / Chờ thanh toán" sau nhiều lần kiểm tra nghĩa là PayOS
                  vẫn chưa thấy tiền về cho đơn này. */}
              {pendingProbe ? (
                <View className="mt-3 rounded-xl bg-white/70 p-3">
                  <Text className="text-[11px] text-[#5B5266]">
                    Hoá đơn #{pendingInvoiceId} · đã kiểm tra{" "}
                    {pendingProbe.checkedTimes} lần
                  </Text>
                  <Text
                    className="mt-1 text-[11px]"
                    style={{ color: premiumBodyColor }}
                  >
                    Kích hoạt: {getInvoiceStatusLabel(pendingProbe.status ?? undefined)}
                    {"  ·  "}
                    Thanh toán:{" "}
                    {getPaymentStatusLabel(pendingProbe.paymentStatus ?? undefined)}
                  </Text>

                  {/* Backend trả lỗi khi đối soát -> vấn đề nằm ở kết nối
                      PayOS/hoá đơn, KHÔNG phải user chưa trả tiền. */}
                  {pendingProbe.errorMessage ? (
                    <Text
                      className="mt-1 text-[11px] leading-4"
                      style={{ color: "#B42345" }}
                    >
                      Lỗi đối soát: {pendingProbe.errorMessage}
                    </Text>
                  ) : null}
                </View>
              ) : null}
              {!isConfirmingPayment ? (
                <Pressable
                  onPress={() => void syncPremiumStatus()}
                  className="mt-3 self-start rounded-xl px-4 py-2"
                  style={{ backgroundColor: premiumBrandPink }}
                >
                  <Text className="text-[12px] font-semibold text-white">
                    Kiểm tra lại
                  </Text>
                </Pressable>
              ) : null}
            </View>
          ) : null}

          {/* Loading */}
          {isLoading ? (
            <View
              className="mb-4 items-center rounded-2xl p-6"
              style={{ backgroundColor: premiumSoftPink }}
            >
              <ActivityIndicator color={premiumBrandPink} />
              <Text
                className="mt-3 text-[13px]"
                style={{ color: premiumBodyColor }}
              >
                Đang tải gói Premium...
              </Text>
            </View>
          ) : null}

          {/* Plan Selector */}
          {!isLoading && plans.length > 0 ? (
            <View className="mb-5">
              <Text
                className="mb-3 text-[15px] font-semibold"
                style={{ color: premiumTitleColor }}
              >
                Chọn gói đăng ký
              </Text>
              <View className="gap-3">
                {plans.map((plan) => {
                  const isSelected =
                    selectedPlan?.subscriptionPlanId === plan.subscriptionPlanId;
                  return (
                    <Pressable
                      key={plan.subscriptionPlanId}
                      onPress={() => setSelectedPlan(plan)}
                      className="rounded-2xl border p-4"
                      style={{
                        backgroundColor: isSelected ? premiumSoftPink : "#FAFAFA",
                        borderColor: isSelected
                          ? premiumBrandPink
                          : premiumSoftPinkBorder,
                      }}
                    >
                      <View className="flex-row items-start justify-between gap-3">
                        <View className="flex-1">
                          <View
                            className="self-start rounded-full px-3 py-1"
                            style={{ backgroundColor: "#FFE1EA" }}
                          >
                            <Text
                              className="text-[10px]"
                              style={{ color: premiumBrandPink }}
                            >
                              Gói Premium
                            </Text>
                          </View>
                          <Text
                            className="mt-2 text-[16px] font-semibold"
                            style={{ color: premiumTitleColor }}
                          >
                            {plan.subscriptionPlanName}
                          </Text>
                          {plan.subscriptionPlanDescription ? (
                            <Text
                              className="mt-1 text-[13px] leading-5"
                              style={{ color: premiumBodyColor }}
                            >
                              {plan.subscriptionPlanDescription}
                            </Text>
                          ) : null}
                        </View>
                        {isSelected ? (
                          <SymbolView
                            name={{
                              ios: "checkmark.circle.fill",
                              android: "check_circle",
                              web: "check_circle",
                            }}
                            size={22}
                            tintColor={premiumBrandPink}
                          />
                        ) : null}
                      </View>
                      <View className="mt-3 flex-row items-baseline gap-1">
                        <Text
                          className="text-[20px] font-semibold"
                          style={{ color: premiumBrandPink }}
                        >
                          {formatCurrency(getPlanPrice(plan, billingCycle))}
                        </Text>
                        <Text
                          className="text-[13px]"
                          style={{ color: premiumBodyColor }}
                        >
                          /{billingCycle === "MONTHLY" ? "tháng" : "năm"}
                        </Text>
                      </View>
                    </Pressable>
                  );
                })}
              </View>
            </View>
          ) : null}

          {/* Billing Cycle */}
          <View className="mb-5">
            <Text
              className="mb-3 text-[15px] font-semibold"
              style={{ color: premiumTitleColor }}
            >
              Chu kỳ thanh toán
            </Text>

            <View
              className="flex-row gap-2 rounded-2xl p-1.5"
              style={{ backgroundColor: premiumSoftPink }}
            >
              {(["MONTHLY", "YEARLY"] as BillingCycle[]).map((cycle) => {
                const isActive = billingCycle === cycle;

                return (
                  <Pressable
                    key={cycle}
                    onPress={() => setBillingCycle(cycle)}
                    style={{
                      flex: 1,
                      borderRadius: 12,
                      paddingHorizontal: 16,
                      paddingVertical: 12,
                      backgroundColor: isActive ? "#FFFFFF" : "transparent",
                      elevation: isActive ? 2 : 0,
                    }}
                  >
                    <Text
                      style={{
                        textAlign: "center",
                        fontSize: 13,
                        fontWeight: isActive ? "600" : "400",
                        color: isActive ? premiumBrandPink : premiumBodyColor,
                      }}
                    >
                      {cycle === "MONTHLY" ? "Theo tháng" : "Theo năm"}
                    </Text>

                    {cycle === "YEARLY" ? (
                      <Text
                        style={{
                          marginTop: 2,
                          textAlign: "center",
                          fontSize: 10,
                          color: premiumBrandOrange,
                        }}
                      >
                        Giá theo từng gói
                      </Text>
                    ) : null}
                  </Pressable>
                );
              })}
            </View>
          </View>

          {/* Features */}
          <View
            className="mb-5 rounded-2xl border p-5"
            style={{
              backgroundColor: premiumSoftPink,
              borderColor: premiumSoftPinkBorder,
            }}
          >
            <Text
              className="mb-4 text-[15px] font-semibold"
              style={{ color: premiumTitleColor }}
            >
              Đặc quyền gói Premium
            </Text>
            <View className="gap-3">
              {PREMIUM_FEATURES.map((feature, index) => (
                <View key={index} className="flex-row items-center gap-3">
                  <View
                    className="h-8 w-8 items-center justify-center rounded-full"
                    style={{ backgroundColor: premiumBrandPink }}
                  >
                    <SymbolView
                      name={feature.icon}
                      size={15}
                      tintColor="white"
                    />
                  </View>
                  <Text
                    className="flex-1 text-[13px] leading-5"
                    style={{ color: premiumBodyColor }}
                  >
                    {feature.label}
                  </Text>
                </View>
              ))}
            </View>
          </View>

          {/* Summary */}
          <View
            className="mb-5 rounded-2xl p-4"
            style={{ backgroundColor: premiumSoftPink }}
          >
            <Text
              className="text-[14px] font-semibold"
              style={{ color: premiumTitleColor }}
            >
              Tóm tắt thanh toán
            </Text>
            <View className="mt-2 gap-1">
              <Text
                className="text-[13px]"
                style={{ color: premiumBodyColor }}
              >
                Gói: {selectedPlan?.subscriptionPlanName ?? "Chưa chọn"}
              </Text>
              <Text
                className="text-[13px]"
                style={{ color: premiumBodyColor }}
              >
                Chu kỳ: {billingCycle === "MONTHLY" ? "Theo tháng" : "Theo năm"}
              </Text>
              <Text
                className="text-[13px] font-semibold"
                style={{ color: premiumBrandPink }}
              >
                Số tiền: {formatCurrency(selectedAmount)}
              </Text>
            </View>
          </View>

          {/* CTA Button */}
          <Pressable
            disabled={isSubmitting || plans.length === 0}
            onPress={handleSubscribe}
            className="rounded-2xl px-4 py-4"
            style={{
              backgroundColor:
                isSubmitting || plans.length === 0
                  ? premiumDisabledPink
                  : premiumBrandPink,
            }}
          >
            {isSubmitting ? (
              <ActivityIndicator color="white" />
            ) : (
              <Text className="text-center text-[16px] font-semibold text-white">
                Đăng ký Premium & Thanh toán
              </Text>
            )}
          </Pressable>

          {/* Payment result */}
          {payment ? (
            <View
              className="mt-5 rounded-2xl border bg-white p-4"
              style={{ borderColor: premiumSoftPinkBorder }}
            >
              <Text
                className="text-[15px] font-semibold"
                style={{ color: premiumTitleColor }}
              >
                Hoàn tất thanh toán
              </Text>
              <Text
                className="mt-1 text-[13px] leading-5"
                style={{ color: premiumBodyColor }}
              >
                Mở trang thanh toán an toàn để hoàn tất. Nếu trình duyệt không mở
                được, hãy quét mã QR bên dưới.
              </Text>
              {isConfirmingPayment ? (
                <View
                  className="mt-3 flex-row items-center gap-3 rounded-xl p-3"
                  style={{ backgroundColor: premiumSoftPink }}
                >
                  <ActivityIndicator color={premiumBrandPink} />
                  <Text
                    className="flex-1 text-[12px]"
                    style={{ color: premiumBrandPink }}
                  >
                    Đang đối soát giao dịch với PayOS...
                  </Text>
                </View>
              ) : null}
              <Pressable
                onPress={() => openPayOs()}
                className="mt-4 rounded-xl px-4 py-3"
                style={{ backgroundColor: premiumBrandPink }}
              >
                <Text className="text-center text-[13px] font-semibold text-white">
                  Mở trang thanh toán
                </Text>
              </Pressable>
              {qrImageUri ? (
                <View
                  className="mt-4 items-center rounded-2xl p-4"
                  style={{ backgroundColor: premiumSoftPink }}
                >
                  <Image
                    source={{ uri: qrImageUri }}
                    className="h-56 w-56 rounded-xl"
                    resizeMode="contain"
                  />
                  <Text
                    className="mt-3 text-center text-[12px]"
                    style={{ color: premiumBodyColor }}
                  >
                    Quét mã bằng ứng dụng ngân hàng hoặc ví hỗ trợ VietQR.
                  </Text>
                </View>
              ) : null}
            </View>
          ) : null}

          {/* Subscription History */}
          {history.length > 0 ? (
            <View className="mt-6">
              <Text
                className="mb-3 text-[15px] font-semibold"
                style={{ color: premiumTitleColor }}
              >
                Lịch sử đăng ký Premium
              </Text>
              <View className="gap-3">
                {history.map((record) => (
                  <View
                    key={record.invoiceId}
                    className="rounded-2xl border bg-[#FAFAFA] p-4"
                    style={{ borderColor: premiumSoftPinkBorder }}
                  >
                    <View className="flex-row items-center justify-between">
                      <Text
                        className="text-[14px] font-semibold"
                        style={{ color: premiumTitleColor }}
                      >
                        {record.planName}
                      </Text>
                      <View
                        className="rounded-full px-3 py-1"
                        style={{
                          backgroundColor:
                            record.status === "ACTIVE"
                              ? "#EAF8F1"
                              : premiumSoftPink,
                        }}
                      >
                        <Text
                          className="text-[10px]"
                          style={{
                            color:
                              record.status === "ACTIVE"
                                ? "#168A64"
                                : premiumBodyColor,
                          }}
                        >
                          {getInvoiceStatusLabel(record.status)}
                        </Text>
                      </View>
                    </View>
                    <View className="mt-2 gap-1">
                      <Text
                        className="text-[12px]"
                        style={{ color: premiumBodyColor }}
                      >
                        Thanh toán: {getPaymentStatusLabel(record.paymentStatus)}
                      </Text>
                      <Text
                        className="text-[12px]"
                        style={{ color: premiumBodyColor }}
                      >
                        Số tiền: {formatCurrency(record.paidAmount)}
                      </Text>
                      <Text
                        className="text-[12px]"
                        style={{ color: premiumBodyColor }}
                      >
                        Từ {formatDate(record.startDate)} đến{" "}
                        {formatDate(record.endDate)}
                      </Text>
                    </View>

                    {/* Đã hủy gia hạn: gói vẫn chạy tới endDate nên không thể
                        hiện "Đã huỷ" ở badge trạng thái (BE vẫn để ACTIVE). */}
                    {record.willCancelAtEnd ? (
                      <View
                        className="mt-3 rounded-xl p-3"
                        style={{ backgroundColor: premiumSoftPink }}
                      >
                        <Text
                          className="text-[12px] leading-5"
                          style={{ color: premiumBrandPink }}
                        >
                          Đã hủy gia hạn
                          {record.canceledAt
                            ? ` ngày ${formatDate(record.canceledAt)}`
                            : ""}
                          . Quyền lợi Premium giữ đến hết{" "}
                          {formatDate(record.endDate)}.
                        </Text>
                      </View>
                    ) : null}

                    {canCancelRecord(record) ? (
                      <Pressable
                        disabled={cancelingInvoiceId === record.invoiceId}
                        onPress={() => void handleCancelSubscription(record)}
                        className="mt-3 self-start rounded-xl border px-4 py-2"
                        style={{
                          borderColor: premiumBrandPink,
                          opacity:
                            cancelingInvoiceId === record.invoiceId ? 0.6 : 1,
                        }}
                      >
                        {cancelingInvoiceId === record.invoiceId ? (
                          <ActivityIndicator color={premiumBrandPink} />
                        ) : (
                          <Text
                            className="text-[12px] font-semibold"
                            style={{ color: premiumBrandPink }}
                          >
                            Hủy gia hạn
                          </Text>
                        )}
                      </Pressable>
                    ) : null}
                  </View>
                ))}
              </View>
            </View>
          ) : null}

          <View className="h-8" />
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}
