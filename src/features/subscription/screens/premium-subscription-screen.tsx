import * as ExpoLinking from "expo-linking";
import { useFocusEffect, useRouter } from "expo-router";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  AppState,
  Image,
  Linking,
  Pressable,
  RefreshControl,
  ScrollView,
  Text,
  View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

import { ScreenHorizontalPadding } from "@/constants/theme";
import { SymbolView } from "@/components/ui/symbol-view";
import { getValidAccessToken } from "@/features/auth/hooks/use-auth-session";
import { refreshPremiumStatus } from "@/features/profile/hooks/use-premium-status";
import {
  type BillingCycle,
  type PremiumPaymentInitResponse,
  type PremiumPlan,
  type PremiumSubscriptionRecord,
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
const PAYOS_REDIRECT_URL = ExpoLinking.createURL("/subscription/premium");

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
    label: "Voucher ưu đãi đặc quyền từ Partner",
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

      for (let attempt = 0; attempt < totalChecks; attempt += 1) {
        if (!isMountedRef.current) return;

        /**
         * Nguồn sự thật: BE hỏi thẳng PayOS rồi tự kích hoạt/huỷ invoice và
         * trả về invoice sau đối soát. Nếu confirm lỗi (mất mạng, PayOS timeout,
         * invoice chưa có payosOrderCode...) thì lùi về đọc `/my` — vẫn bắt được
         * trường hợp webhook PayOS đã tự cập nhật invoice trước đó.
         */
        let record = await confirmPremiumPayment(accessToken, invoiceId).catch(
          () => null,
        );
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
          Alert.alert(
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
          Alert.alert(
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
          "PayOS vẫn chưa ghi nhận giao dịch này. Nếu bạn đã thanh toán, hãy bấm Kiểm tra lại sau ít phút.",
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
      Alert.alert(
        "Không mở được trang thanh toán",
        "Bạn có thể quét mã QR bên dưới để thanh toán.",
      );
      return;
    }
    Alert.alert(
      "Không mở được trang thanh toán",
      "Hệ thống chưa trả liên kết thanh toán hợp lệ. Vui lòng thử đăng ký lại.",
    );
  }

  async function handleSubscribe() {
    if (!selectedPlan) {
      Alert.alert("Chưa chọn gói", "Vui lòng chọn một gói Premium.");
      return;
    }
    const accessToken = await getValidAccessToken();
    if (!accessToken) {
      Alert.alert("Cần đăng nhập", "Vui lòng đăng nhập để đăng ký gói Premium.");
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
    <SafeAreaView className="flex-1 bg-white" edges={["top", "bottom"]}>
      <ScrollView
        contentContainerStyle={{ paddingBottom: 40 }}
        refreshControl={
          <RefreshControl refreshing={isRefreshing} onRefresh={handleRefresh} />
        }
      >
        {/* Header */}
        <View
          className="bg-[#7C3AED] pb-8 pt-5"
          style={{ paddingHorizontal: ScreenHorizontalPadding }}
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
              <Text className="text-[12px] font-extrabold text-white">
                PREMIUM EXPLORER
              </Text>
            </View>
            <View className="w-10" />
          </View>

          <Text className="text-[28px] font-extrabold text-white">
            Explorer Premium
          </Text>
          <Text className="mt-1 text-[14px] leading-5 text-white/80">
            Mở khoá toàn bộ trải nghiệm khám phá di sản văn hoá thông minh
          </Text>

          {/* Pricing Hero */}
          <View className="mt-5 rounded-2xl bg-white/15 p-4">
            <Text className="text-[12px] font-bold text-white/70">
              Biểu phí ưu đãi
            </Text>
            <View className="mt-1 flex-row items-baseline gap-2">
              <Text className="text-[32px] font-extrabold text-white">
                {selectedPlan
                  ? formatCurrency(getPlanPrice(selectedPlan, billingCycle))
                  : billingCycle === "MONTHLY"
                    ? "59.000 ₫"
                    : "499.000 ₫"}
              </Text>
              <Text className="text-[14px] text-white/70">
                /{billingCycle === "MONTHLY" ? "tháng" : "năm"}
              </Text>
            </View>
            {billingCycle === "YEARLY" && (
              <View className="mt-2 self-start rounded-full bg-yellow-400 px-3 py-1">
                <Text className="text-[11px] font-extrabold text-[#7C3AED]">
                  Giá được áp dụng theo từng gói
                </Text>
              </View>
            )}
          </View>
        </View>

        <View
          className="pt-5"
          style={{ paddingHorizontal: ScreenHorizontalPadding }}
        >
          {/* Error */}
          {errorMessage ? (
            <View className="mb-4 rounded-2xl border border-red-100 bg-red-50 p-4">
              <Text className="text-[13px] font-bold text-red-600">
                {errorMessage}
              </Text>
            </View>
          ) : null}

          {/* Đang chờ webhook PayOS xác nhận invoice vừa thanh toán.
              Render ở ngoài khối `payment` để vẫn hiện sau khi app bị kill và
              mở lại (lúc đó `payment` đã mất, chỉ còn invoice lưu trên đĩa). */}
          {pendingInvoiceId !== null ? (
            <View className="mb-4 rounded-2xl border border-[#E5D9FF] bg-[#F5F0FF] p-4">
              <View className="flex-row items-center gap-3">
                {isConfirmingPayment ? (
                  <ActivityIndicator color="#7C3AED" />
                ) : (
                  <SymbolView
                    name={{ ios: "clock.fill", android: "schedule", web: "schedule" }}
                    size={18}
                    tintColor="#7C3AED"
                  />
                )}
                <Text className="flex-1 text-[13px] font-bold text-[#7C3AED]">
                  {isConfirmingPayment
                    ? "Đang đối soát giao dịch với PayOS..."
                    : "Đơn hàng chưa được PayOS xác nhận."}
                </Text>
              </View>
              <Text className="mt-2 text-[12px] leading-4 text-[#8E869A]">
                Premium sẽ tự bật ngay khi PayOS ghi nhận thanh toán. Bạn có thể
                để màn hình này mở hoặc bấm kiểm tra lại.
              </Text>

              {/* Trạng thái thô của invoice sau đối soát. Đứng yên "Chờ kích
                  hoạt / Chờ thanh toán" sau nhiều lần kiểm tra nghĩa là PayOS
                  vẫn chưa thấy tiền về cho đơn này. */}
              {pendingProbe ? (
                <View className="mt-3 rounded-xl bg-white/70 p-3">
                  <Text className="text-[11px] font-bold text-[#5B5266]">
                    Hoá đơn #{pendingInvoiceId} · đã kiểm tra{" "}
                    {pendingProbe.checkedTimes} lần
                  </Text>
                  <Text className="mt-1 text-[11px] text-[#8E869A]">
                    Kích hoạt: {getInvoiceStatusLabel(pendingProbe.status ?? undefined)}
                    {"  ·  "}
                    Thanh toán:{" "}
                    {getPaymentStatusLabel(pendingProbe.paymentStatus ?? undefined)}
                  </Text>
                </View>
              ) : null}
              {!isConfirmingPayment ? (
                <Pressable
                  onPress={() => void syncPremiumStatus()}
                  className="mt-3 self-start rounded-xl bg-[#7C3AED] px-4 py-2"
                >
                  <Text className="text-[12px] font-extrabold text-white">
                    Kiểm tra lại
                  </Text>
                </Pressable>
              ) : null}
            </View>
          ) : null}

          {/* Loading */}
          {isLoading ? (
            <View className="mb-4 items-center rounded-2xl bg-[#F5F0FF] p-6">
              <ActivityIndicator color="#7C3AED" />
              <Text className="mt-3 text-[13px] text-[#8E869A]">
                Đang tải gói Premium...
              </Text>
            </View>
          ) : null}

          {/* Plan Selector */}
          {!isLoading && plans.length > 0 ? (
            <View className="mb-5">
              <Text className="mb-3 text-[15px] font-extrabold text-[#2B2233]">
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
                      className={`rounded-2xl border p-4 ${isSelected
                          ? "border-[#7C3AED] bg-[#F5F0FF] shadow-sm"
                          : "border-[#EDE8F5] bg-[#FAFAFA]"
                        }`}
                    >
                      <View className="flex-row items-start justify-between gap-3">
                        <View className="flex-1">
                          <View className="self-start rounded-full bg-[#EDE8F5] px-3 py-1">
                            <Text className="text-[10px] font-extrabold uppercase text-[#7C3AED]">
                              Gói Premium
                            </Text>
                          </View>
                          <Text className="mt-2 text-[16px] font-extrabold text-[#2B2233]">
                            {plan.subscriptionPlanName}
                          </Text>
                          {plan.subscriptionPlanDescription ? (
                            <Text className="mt-1 text-[13px] leading-5 text-[#8E869A]">
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
                            tintColor="#7C3AED"
                          />
                        ) : null}
                      </View>
                      <View className="mt-3 flex-row items-baseline gap-1">
                        <Text className="text-[20px] font-extrabold text-[#7C3AED]">
                          {formatCurrency(getPlanPrice(plan, billingCycle))}
                        </Text>
                        <Text className="text-[13px] text-[#8E869A]">
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
          {/* Billing Cycle */}
          <View className="mb-5">
            <Text className="mb-3 text-[15px] font-extrabold text-[#2B2233]">
              Chu kỳ thanh toán
            </Text>

            <View className="flex-row gap-2 rounded-2xl bg-[#F4EFF8] p-1.5">
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
                        fontWeight: "800",
                        color: isActive ? "#7C3AED" : "#8E869A",
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
                          fontWeight: "700",
                          color: "#16A34A",
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
          <View className="mb-5 rounded-2xl border border-[#EDE8F5] bg-[#F5F0FF] p-5">
            <Text className="mb-4 text-[15px] font-extrabold text-[#2B2233]">
              👑 Đặc quyền gói Premium
            </Text>
            <View className="gap-3">
              {PREMIUM_FEATURES.map((feature, index) => (
                <View key={index} className="flex-row items-center gap-3">
                  <View className="h-8 w-8 items-center justify-center rounded-full bg-[#7C3AED]">
                    <SymbolView
                      name={feature.icon}
                      size={15}
                      tintColor="white"
                    />
                  </View>
                  <Text className="flex-1 text-[13px] font-bold text-[#374151]">
                    {feature.label}
                  </Text>
                </View>
              ))}
            </View>
          </View>

          {/* Summary */}
          <View className="mb-5 rounded-2xl bg-[#F4EFF8] p-4">
            <Text className="text-[14px] font-extrabold text-[#2B2233]">
              Tóm tắt thanh toán
            </Text>
            <View className="mt-2 gap-1">
              <Text className="text-[13px] text-[#3D3446]">
                Gói: {selectedPlan?.subscriptionPlanName ?? "Chưa chọn"}
              </Text>
              <Text className="text-[13px] text-[#3D3446]">
                Chu kỳ: {billingCycle === "MONTHLY" ? "Theo tháng" : "Theo năm"}
              </Text>
              <Text className="text-[13px] font-extrabold text-[#7C3AED]">
                Số tiền: {formatCurrency(selectedAmount)}
              </Text>
            </View>
          </View>

          {/* CTA Button */}
          <Pressable
            disabled={isSubmitting || plans.length === 0}
            onPress={handleSubscribe}
            className={`rounded-2xl px-4 py-4 ${isSubmitting || plans.length === 0
                ? "bg-[#C4B5D9]"
                : "bg-[#7C3AED]"
              }`}
          >
            {isSubmitting ? (
              <ActivityIndicator color="white" />
            ) : (
              <Text className="text-center text-[16px] font-extrabold text-white">
                👑 Đăng ký Premium & Thanh toán
              </Text>
            )}
          </Pressable>

          {/* Payment result */}
          {payment ? (
            <View className="mt-5 rounded-2xl border border-[#EDE8F5] bg-white p-4">
              <Text className="text-[15px] font-extrabold text-[#2B2233]">
                Hoàn tất thanh toán
              </Text>
              <Text className="mt-1 text-[13px] text-[#8E869A]">
                Mở trang thanh toán an toàn để hoàn tất. Nếu trình duyệt không mở
                được, hãy quét mã QR bên dưới.
              </Text>
              {isConfirmingPayment ? (
                <View className="mt-3 flex-row items-center gap-3 rounded-xl bg-[#F5F0FF] p-3">
                  <ActivityIndicator color="#7C3AED" />
                  <Text className="flex-1 text-[12px] font-bold text-[#7C3AED]">
                    Đang đối soát giao dịch với PayOS...
                  </Text>
                </View>
              ) : null}
              <Pressable
                onPress={() => openPayOs()}
                className="mt-4 rounded-xl bg-[#7C3AED] px-4 py-3"
              >
                <Text className="text-center text-[13px] font-extrabold text-white">
                  Mở trang thanh toán
                </Text>
              </Pressable>
              {qrImageUri ? (
                <View className="mt-4 items-center rounded-2xl bg-[#F5F0FF] p-4">
                  <Image
                    source={{ uri: qrImageUri }}
                    className="h-56 w-56 rounded-xl"
                    resizeMode="contain"
                  />
                  <Text className="mt-3 text-center text-[12px] text-[#8E869A]">
                    Quét mã bằng ứng dụng ngân hàng hoặc ví hỗ trợ VietQR.
                  </Text>
                </View>
              ) : null}
            </View>
          ) : null}

          {/* Subscription History */}
          {history.length > 0 ? (
            <View className="mt-6">
              <Text className="mb-3 text-[15px] font-extrabold text-[#2B2233]">
                Lịch sử đăng ký Premium
              </Text>
              <View className="gap-3">
                {history.map((record) => (
                  <View
                    key={record.invoiceId}
                    className="rounded-2xl border border-[#EDE8F5] bg-[#FAFAFA] p-4"
                  >
                    <View className="flex-row items-center justify-between">
                      <Text className="text-[14px] font-extrabold text-[#2B2233]">
                        {record.planName}
                      </Text>
                      <View
                        className={`rounded-full px-3 py-1 ${record.status === "ACTIVE"
                            ? "bg-green-100"
                            : "bg-[#F4EFF8]"
                          }`}
                      >
                        <Text
                          className={`text-[10px] font-extrabold ${record.status === "ACTIVE"
                              ? "text-green-700"
                              : "text-[#8E869A]"
                            }`}
                        >
                          {getInvoiceStatusLabel(record.status)}
                        </Text>
                      </View>
                    </View>
                    <View className="mt-2 gap-1">
                      <Text className="text-[12px] text-[#8E869A]">
                        Thanh toán: {getPaymentStatusLabel(record.paymentStatus)}
                      </Text>
                      <Text className="text-[12px] text-[#8E869A]">
                        Số tiền: {formatCurrency(record.paidAmount)}
                      </Text>
                      <Text className="text-[12px] text-[#8E869A]">
                        Từ {formatDate(record.startDate)} đến{" "}
                        {formatDate(record.endDate)}
                      </Text>
                    </View>
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
