import * as ImagePicker from "expo-image-picker";
import { useRouter } from "expo-router";
import { useCallback, useEffect, useMemo, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  Image,
  Linking,
  Pressable,
  RefreshControl,
  ScrollView,
  Text,
  TextInput,
  View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

import { SymbolView } from "@/components/ui/symbol-view";
import { getValidAccessToken } from "@/features/auth/hooks/use-auth-session";

import {
  BillingCycle,
  PaymentInitResponse,
  SubscriptionPlan,
  UploadFile,
  getSubscriptionPlanDetail,
  getSubscriptionPlans,
  initiateMomoPayment,
  registerPartnerSubscription,
} from "../api/partner-subscription-api";

const MOMO_REDIRECT_URL = "culturequest://partner-subscription/payment-result";

type SubscriptionAudience = "EXPLORER" | "PARTNER";

type ExplorerPlaceholderPlan = {
  description: string;
  id: string;
  name: string;
  priceLabel: string;
  statusLabel: string;
};

const explorerPlaceholderPlans: ExplorerPlaceholderPlan[] = [
  {
    description:
      "Gói dành cho Explorer để mở khóa trải nghiệm premium, lưu hành trình và nhận ưu đãi trong tương lai.",
    id: "explorer-premium",
    name: "Explorer Premium",
    priceLabel: "Tạm để sau",
    statusLabel: "Chưa mở đăng ký",
  },
];


const formatCurrency = (value?: number | null) => {
  if (!value) {
    return "Liên hệ";
  }

  return value.toLocaleString("vi-VN", {
    currency: "VND",
    maximumFractionDigits: 0,
    style: "currency",
  });
};

const getPlanPrice = (plan: SubscriptionPlan, billingCycle: BillingCycle) => {
  return billingCycle === "MONTHLY" ? plan.priceMonthly : plan.priceYearly;
};

const getStatusLabel = (status?: string | null) => {
  switch (status) {
    case "PAYMENT_PENDING":
      return "Chờ thanh toán";
    case "PAYMENT_FAILED":
      return "Thanh toán thất bại";
    case "PENDING":
      return "Đã thanh toán, chờ Admin duyệt";
    case "ACTIVE":
      return "Đang hoạt động";
    case "REJECTED":
      return "Bị từ chối";
    case "EXPIRED":
      return "Đã hết hạn";
    default:
      return status ?? "Chưa đăng ký";
  }
};

const normalizePlanText = (plan: SubscriptionPlan) => {
  return `${plan.subscriptionPlanName ?? ""} ${plan.subscriptionPlanDescription ?? ""} ${JSON.stringify(plan.configLimit ?? {})}`
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "");
};

const getPlanAudience = (plan: SubscriptionPlan): SubscriptionAudience => {
  const text = normalizePlanText(plan);

  if (
    text.includes("partner") ||
    text.includes("doi tac") ||
    text.includes("shop") ||
    text.includes("voucher") ||
    text.includes("merchant")
  ) {
    return "PARTNER";
  }

  if (
    text.includes("explorer") ||
    text.includes("premium") ||
    text.includes("nguoi dung") ||
    text.includes("hanh trinh")
  ) {
    return "EXPLORER";
  }

  // Luồng hiện tại dùng API này để đăng ký Partner nên gói không có nhãn rõ ràng
  // sẽ được đưa vào Partner để vẫn test được register + MoMo.
  return "PARTNER";
};

const getAudienceLabel = (audience: SubscriptionAudience) => {
  return audience === "PARTNER" ? "Gói Partner" : "Gói Explorer";
};

function normalizePickedAsset(asset: ImagePicker.ImagePickerAsset, fallbackName: string): UploadFile {
  const extension = asset.uri.split(".").pop()?.split("?")[0] || "jpg";
  const name = asset.fileName || `${fallbackName}.${extension}`;
  const type = asset.mimeType || (extension.toLowerCase() === "png" ? "image/png" : "image/jpeg");

  return {
    name,
    type,
    uri: asset.uri,
  };
}

export default function SubscriptionScreen() {
  const router = useRouter();
  const [plans, setPlans] = useState<SubscriptionPlan[]>([]);
  const [selectedPlan, setSelectedPlan] = useState<SubscriptionPlan | null>(null);
  const [billingCycle, setBillingCycle] = useState<BillingCycle>("MONTHLY");
  const [shopName, setShopName] = useState("");
  const [shopEmail, setShopEmail] = useState("");
  const [address, setAddress] = useState("");
  const [longitude, setLongitude] = useState("");
  const [latitude, setLatitude] = useState("");
  const [documentFile, setDocumentFile] = useState<UploadFile | null>(null);
  const [shopFiles, setShopFiles] = useState<UploadFile[]>([]);
  const [payment, setPayment] = useState<PaymentInitResponse | null>(null);
  const [registeredStatus, setRegisteredStatus] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [activeAudience, setActiveAudience] = useState<SubscriptionAudience>("PARTNER");

  const selectedAmount = useMemo(() => {
    return selectedPlan ? getPlanPrice(selectedPlan, billingCycle) : null;
  }, [billingCycle, selectedPlan]);

  const partnerPlans = useMemo(
    () => plans.filter((plan) => getPlanAudience(plan) === "PARTNER"),
    [plans],
  );
  const explorerPlans = useMemo(
    () => plans.filter((plan) => getPlanAudience(plan) === "EXPLORER"),
    [plans],
  );
  const visiblePartnerPlans = partnerPlans.length > 0 ? partnerPlans : plans;

  const loadPlans = useCallback(async () => {
    const accessToken = await getValidAccessToken();

    if (!accessToken) {
      setErrorMessage("Bạn cần đăng nhập trước khi đăng ký gói Partner.");
      setPlans([]);
      return;
    }

    const response = await getSubscriptionPlans(accessToken);
    const activePlans = response.content.filter((plan) => plan.status !== "DELETED" && plan.status !== "INACTIVE");

    const activePartnerPlans = activePlans.filter(
      (plan) => getPlanAudience(plan) === "PARTNER",
    );

    setPlans(activePlans);
    setSelectedPlan((currentPlan) => {
      if (
        currentPlan &&
        activePartnerPlans.some(
          (plan) => plan.subscriptionPlanId === currentPlan.subscriptionPlanId,
        )
      ) {
        return currentPlan;
      }

      return activePartnerPlans[0] ?? activePlans[0] ?? null;
    });
    setErrorMessage(null);
  }, []);

  useEffect(() => {
    let isMounted = true;

    async function bootstrap() {
      try {
        await loadPlans();
      } catch (error) {
        if (isMounted) {
          setErrorMessage(error instanceof Error ? error.message : "Không tải được danh sách gói.");
        }
      } finally {
        if (isMounted) {
          setIsLoading(false);
        }
      }
    }

    bootstrap();

    return () => {
      isMounted = false;
    };
  }, [loadPlans]);

  async function handleRefresh() {
    setIsRefreshing(true);
    try {
      await loadPlans();
    } catch (error) {
      setErrorMessage(error instanceof Error ? error.message : "Không tải được danh sách gói.");
    } finally {
      setIsRefreshing(false);
    }
  }

  async function handleSelectPlan(plan: SubscriptionPlan) {
    setSelectedPlan(plan);
    setPayment(null);
    setRegisteredStatus(null);

    try {
      const accessToken = await getValidAccessToken();

      if (!accessToken) {
        return;
      }

      const detail = await getSubscriptionPlanDetail(plan.subscriptionPlanId, accessToken);
      setSelectedPlan(detail);
    } catch {
      // Nếu API chi tiết chưa sẵn sàng, vẫn dùng dữ liệu từ danh sách gói.
    }
  }

  async function pickDocumentFile() {
    const permission = await ImagePicker.requestMediaLibraryPermissionsAsync();

    if (!permission.granted) {
      Alert.alert("Thiếu quyền truy cập", "Vui lòng cấp quyền chọn ảnh giấy tờ xác minh.");
      return;
    }

    const result = await ImagePicker.launchImageLibraryAsync({
      allowsEditing: false,
      mediaTypes: ImagePicker.MediaTypeOptions.Images,
      quality: 0.85,
    });

    if (!result.canceled && result.assets[0]) {
      setDocumentFile(normalizePickedAsset(result.assets[0], "partner-document"));
    }
  }

  async function pickShopImages() {
    const permission = await ImagePicker.requestMediaLibraryPermissionsAsync();

    if (!permission.granted) {
      Alert.alert("Thiếu quyền truy cập", "Vui lòng cấp quyền chọn ảnh shop.");
      return;
    }

    const result = await ImagePicker.launchImageLibraryAsync({
      allowsMultipleSelection: true,
      mediaTypes: ImagePicker.MediaTypeOptions.Images,
      quality: 0.85,
    });

    if (!result.canceled) {
      setShopFiles(result.assets.map((asset, index) => normalizePickedAsset(asset, `shop-media-${index + 1}`)));
    }
  }

  function validateForm() {
    if (!selectedPlan) {
      return "Vui lòng chọn gói đăng ký.";
    }

    if (!shopName.trim()) {
      return "Vui lòng nhập tên shop.";
    }

    if (!/^\S+@\S+\.\S+$/.test(shopEmail.trim())) {
      return "Email shop không đúng định dạng.";
    }

    if (!address.trim()) {
      return "Vui lòng nhập địa chỉ shop.";
    }

    const parsedLongitude = Number(longitude);
    const parsedLatitude = Number(latitude);

    if (!Number.isFinite(parsedLongitude) || !Number.isFinite(parsedLatitude)) {
      return "Vui lòng nhập đúng kinh độ và vĩ độ.";
    }

    if (!documentFile) {
      return "Vui lòng upload giấy tờ xác minh.";
    }

    return null;
  }

  async function handleRegisterAndPay() {
    const validationMessage = validateForm();

    if (validationMessage) {
      Alert.alert("Thiếu thông tin", validationMessage);
      return;
    }

    const accessToken = await getValidAccessToken();

    if (!accessToken || !selectedPlan || !documentFile) {
      Alert.alert("Cần đăng nhập", "Vui lòng đăng nhập trước khi đăng ký gói Partner.");
      return;
    }

    setIsSubmitting(true);
    setErrorMessage(null);
    setPayment(null);

    try {
      const subscription = await registerPartnerSubscription({
        accessToken,
        address,
        billingCycle,
        documentFile,
        files: shopFiles,
        latitude: Number(latitude),
        longitude: Number(longitude),
        shopEmail,
        shopName,
        subscriptionPlanId: selectedPlan.subscriptionPlanId,
      });

      setRegisteredStatus(subscription.status);

      const paymentResponse = await initiateMomoPayment({
        accessToken,
        redirectUrl: MOMO_REDIRECT_URL,
        subscriptionId: subscription.id,
      });

      setPayment(paymentResponse);
      await openMomo(paymentResponse);
    } catch (error) {
      setErrorMessage(error instanceof Error ? error.message : "Đăng ký hoặc thanh toán thất bại.");
    } finally {
      setIsSubmitting(false);
    }
  }

  async function openMomo(paymentResponse = payment) {
    if (!paymentResponse) {
      return;
    }

    const targetUrl = paymentResponse.deeplink || paymentResponse.payUrl;

    if (targetUrl) {
      try {
        const canOpen = await Linking.canOpenURL(targetUrl);

        if (canOpen) {
          await Linking.openURL(targetUrl);
          return;
        }
      } catch {
        // fallback sang QR bên dưới
      }
    }

    if (paymentResponse.qrCodeUrl || paymentResponse.qrCode) {
      Alert.alert("Mở MoMo không thành công", "Bạn có thể quét QR MoMo bên dưới để thanh toán.");
      return;
    }

    Alert.alert("Không mở được MoMo", "BE chưa trả deeplink/payUrl/QR code để thanh toán.");
  }

  const qrImageUri = payment?.qrCodeUrl || (payment?.qrCode ? `data:image/png;base64,${payment.qrCode}` : null);

  return (
    <SafeAreaView className="flex-1 bg-white" edges={["top", "bottom"]}>
      <ScrollView
        contentContainerStyle={{ padding: 16, paddingBottom: 32 }}
        refreshControl={<RefreshControl refreshing={isRefreshing} onRefresh={handleRefresh} />}
      >
        <View className="mb-4 flex-row items-center justify-between">
          <View>
            <Text className="text-[20px] font-extrabold text-[#2B2233]">Đăng ký Partner</Text>
            <Text className="mt-1 text-[13px] text-[#8E869A]">Chọn gói, gửi hồ sơ và thanh toán MoMo UAT.</Text>
          </View>
          <Pressable onPress={() => router.back()} className="h-10 w-10 items-center justify-center rounded-full bg-[#F4EFF8]">
            <SymbolView name={{ ios: "xmark", android: "close", web: "close" }} size={16} tintColor="#8E869A" />
          </Pressable>
        </View>

        {isLoading ? (
          <View className="rounded-2xl bg-[#FFF8FC] p-6">
            <ActivityIndicator color="#EB489B" />
            <Text className="mt-3 text-center text-[13px] text-[#8E869A]">Đang tải gói đăng ký...</Text>
          </View>
        ) : null}

        {errorMessage ? (
          <View className="mb-4 rounded-2xl border border-red-100 bg-red-50 p-4">
            <Text className="text-[13px] font-bold text-red-600">{errorMessage}</Text>
          </View>
        ) : null}

        <Text className="mb-3 text-[16px] font-extrabold text-[#2B2233]">1. Chọn loại gói</Text>

        <View className="mb-4 flex-row rounded-2xl bg-[#F4EFF8] p-1">
          {(["EXPLORER", "PARTNER"] as SubscriptionAudience[]).map((audience) => {
            const isActive = activeAudience === audience;

            return (
              <Pressable
                key={audience}
                onPress={() => setActiveAudience(audience)}
                className={`flex-1 rounded-xl px-3 py-3 ${isActive ? "bg-white" : ""}`}
              >
                <Text
                  className={`text-center text-[13px] font-extrabold ${
                    isActive ? "text-[#EB489B]" : "text-[#8E869A]"
                  }`}
                >
                  {audience === "PARTNER" ? "Partner" : "Explorer"}
                </Text>
              </Pressable>
            );
          })}
        </View>

        {activeAudience === "EXPLORER" ? (
          <View className="gap-3">
            {(explorerPlans.length > 0 ? explorerPlans : explorerPlaceholderPlans).map((plan) => {
              const isApiPlan = "subscriptionPlanId" in plan;

              return (
                <View
                  key={isApiPlan ? plan.subscriptionPlanId : plan.id}
                  className="rounded-2xl border border-[#E7DDF0] bg-[#FAF7FC] p-4"
                >
                  <View className="flex-row items-start justify-between gap-3">
                    <View className="flex-1">
                      <View className="self-start rounded-full bg-[#EFE7F6] px-3 py-1">
                        <Text className="text-[10px] font-extrabold uppercase text-[#7C3AED]">
                          Gói Explorer
                        </Text>
                      </View>
                      <Text className="mt-3 text-[16px] font-extrabold text-[#2B2233]">
                        {isApiPlan ? plan.subscriptionPlanName : plan.name}
                      </Text>
                      <Text className="mt-1 text-[13px] leading-5 text-[#8E869A]">
                        {isApiPlan
                          ? plan.subscriptionPlanDescription || "Gói dành cho người khám phá. Phần đăng ký Explorer sẽ làm sau."
                          : plan.description}
                      </Text>
                    </View>
                  </View>

                  <Text className="mt-3 text-[18px] font-extrabold text-[#2B2233]">
                    {isApiPlan
                      ? `${formatCurrency(getPlanPrice(plan, billingCycle))} / ${
                          billingCycle === "MONTHLY" ? "tháng" : "năm"
                        }`
                      : plan.priceLabel}
                  </Text>

                  <View className="mt-4 rounded-xl bg-white px-4 py-3">
                    <Text className="text-center text-[13px] font-extrabold text-[#8E869A]">
                      {isApiPlan ? "Explorer tạm để sau, chưa mở form đăng ký" : plan.statusLabel}
                    </Text>
                  </View>
                </View>
              );
            })}
          </View>
        ) : (
          <View className="gap-3">
            <View className="rounded-2xl border border-[#F8D7E3] bg-[#FFF8FC] p-4">
              <Text className="text-[15px] font-extrabold text-[#2B2233]">
                Đăng ký dành cho Partner
              </Text>
              <Text className="mt-1 text-[13px] leading-5 text-[#8E869A]">
                Chọn gói Partner bên dưới để mở form nhập thông tin shop, upload giấy tờ và thanh toán MoMo UAT.
              </Text>
            </View>

            {visiblePartnerPlans.map((plan) => {
              const isSelected = selectedPlan?.subscriptionPlanId === plan.subscriptionPlanId;
              const price = getPlanPrice(plan, billingCycle);

              return (
                <Pressable
                  key={plan.subscriptionPlanId}
                  onPress={() => handleSelectPlan(plan)}
                  className={`rounded-2xl border p-4 ${
                    isSelected ? "border-[#EB489B] bg-[#FFF0F8]" : "border-[#F4EFF8] bg-[#FFF8FC]"
                  }`}
                >
                  <View className="flex-row items-start justify-between gap-3">
                    <View className="flex-1">
                      <View className="self-start rounded-full bg-[#FFE5F1] px-3 py-1">
                        <Text className="text-[10px] font-extrabold uppercase text-[#EB489B]">
                          {getAudienceLabel(getPlanAudience(plan))}
                        </Text>
                      </View>
                      <Text className="mt-3 text-[16px] font-extrabold text-[#2B2233]">
                        {plan.subscriptionPlanName}
                      </Text>
                      <Text className="mt-1 text-[13px] leading-5 text-[#8E869A]">
                        {plan.subscriptionPlanDescription ||
                          "Gói dành cho đối tác đăng voucher và quản lý shop."}
                      </Text>
                    </View>
                    {isSelected ? (
                      <SymbolView
                        name={{ ios: "checkmark.circle.fill", android: "check_circle", web: "check_circle" }}
                        size={22}
                        tintColor="#EB489B"
                      />
                    ) : null}
                  </View>

                  <Text className="mt-3 text-[18px] font-extrabold text-[#2B2233]">
                    {formatCurrency(price)} / {billingCycle === "MONTHLY" ? "tháng" : "năm"}
                  </Text>
                </Pressable>
              );
            })}
          </View>
        )}

        <View className="mt-4 flex-row gap-3">
          {(["MONTHLY", "YEARLY"] as BillingCycle[]).map((cycle) => (
            <Pressable
              key={cycle}
              onPress={() => setBillingCycle(cycle)}
              className={`flex-1 rounded-xl px-4 py-3 ${billingCycle === cycle ? "bg-[#EB489B]" : "bg-[#F4EFF8]"}`}
            >
              <Text className={`text-center text-[13px] font-extrabold ${billingCycle === cycle ? "text-white" : "text-[#3D3446]"}`}>
                {cycle === "MONTHLY" ? "Thanh toán tháng" : "Thanh toán năm"}
              </Text>
            </Pressable>
          ))}
        </View>

        {activeAudience === "PARTNER" ? (
          <>
        <Text className="mb-3 mt-6 text-[16px] font-extrabold text-[#2B2233]">2. Thông tin shop</Text>
        <View className="gap-3 rounded-2xl bg-[#FFF8FC] p-4">
          <TextInput value={shopName} onChangeText={setShopName} placeholder="Tên shop" className="rounded-xl bg-white px-4 py-3 text-[#2B2233]" />
          <TextInput value={shopEmail} onChangeText={setShopEmail} placeholder="Email quản lý shop" keyboardType="email-address" autoCapitalize="none" className="rounded-xl bg-white px-4 py-3 text-[#2B2233]" />
          <TextInput value={address} onChangeText={setAddress} placeholder="Địa chỉ shop" className="rounded-xl bg-white px-4 py-3 text-[#2B2233]" />
          <View className="flex-row gap-3">
            <TextInput value={longitude} onChangeText={setLongitude} placeholder="Kinh độ" keyboardType="decimal-pad" className="flex-1 rounded-xl bg-white px-4 py-3 text-[#2B2233]" />
            <TextInput value={latitude} onChangeText={setLatitude} placeholder="Vĩ độ" keyboardType="decimal-pad" className="flex-1 rounded-xl bg-white px-4 py-3 text-[#2B2233]" />
          </View>
        </View>

        <Text className="mb-3 mt-6 text-[16px] font-extrabold text-[#2B2233]">3. Hồ sơ xác minh</Text>
        <View className="gap-3 rounded-2xl bg-[#FFF8FC] p-4">
          <Pressable onPress={pickDocumentFile} className="rounded-xl border border-dashed border-[#EB489B] bg-white px-4 py-4">
            <Text className="text-center text-[13px] font-extrabold text-[#EB489B]">
              {documentFile ? `Đã chọn: ${documentFile.name}` : "Chọn ảnh giấy tờ xác minh *"}
            </Text>
          </Pressable>

          <Pressable onPress={pickShopImages} className="rounded-xl border border-dashed border-[#F0B7D6] bg-white px-4 py-4">
            <Text className="text-center text-[13px] font-extrabold text-[#EB489B]">
              {shopFiles.length > 0 ? `Đã chọn ${shopFiles.length} ảnh shop` : "Chọn thêm ảnh shop (tuỳ chọn)"}
            </Text>
          </Pressable>
        </View>

        <View className="mt-6 rounded-2xl bg-[#F4EFF8] p-4">
          <Text className="text-[14px] font-extrabold text-[#2B2233]">Tóm tắt thanh toán</Text>
          <Text className="mt-2 text-[13px] text-[#3D3446]">Gói: {selectedPlan?.subscriptionPlanName ?? "Chưa chọn"}</Text>
          <Text className="mt-1 text-[13px] text-[#3D3446]">Chu kỳ: {billingCycle === "MONTHLY" ? "Theo tháng" : "Theo năm"}</Text>
          <Text className="mt-1 text-[13px] text-[#3D3446]">Số tiền: {formatCurrency(selectedAmount)}</Text>
          <Text className="mt-1 text-[13px] text-[#3D3446]">Trạng thái: {getStatusLabel(registeredStatus)}</Text>
        </View>

        <Pressable
          disabled={isSubmitting || visiblePartnerPlans.length === 0}
          onPress={handleRegisterAndPay}
          className={`mt-5 rounded-xl px-4 py-4 ${isSubmitting || visiblePartnerPlans.length === 0 ? "bg-[#D8CADF]" : "bg-[#EB489B]"}`}
        >
          {isSubmitting ? <ActivityIndicator color="white" /> : <Text className="text-center text-[15px] font-extrabold text-white">Đăng ký và thanh toán MoMo</Text>}
        </Pressable>

          </>
        ) : (
          <View className="mt-6 rounded-2xl border border-[#E7DDF0] bg-[#FAF7FC] p-4">
            <Text className="text-[15px] font-extrabold text-[#2B2233]">
              Luồng Explorer đang tạm để sau
            </Text>
            <Text className="mt-2 text-[13px] leading-5 text-[#8E869A]">
              Màn hình hiện chỉ mở form đăng ký cho Partner để test upload hồ sơ và thanh toán MoMo. Khi cần làm gói Explorer, có thể dùng tab này để gắn luồng riêng.
            </Text>
            <Pressable
              onPress={() => setActiveAudience("PARTNER")}
              className="mt-4 rounded-xl bg-[#EB489B] px-4 py-3"
            >
              <Text className="text-center text-[13px] font-extrabold text-white">
                Xem đăng ký Partner
              </Text>
            </Pressable>
          </View>
        )}

        {payment ? (
          <View className="mt-5 rounded-2xl border border-[#F4EFF8] bg-white p-4">
            <Text className="text-[15px] font-extrabold text-[#2B2233]">Thanh toán MoMo UAT</Text>
            <Text className="mt-2 text-[13px] text-[#8E869A]">Ưu tiên mở deeplink MoMo. Nếu máy không mở được app, hãy quét QR bên dưới.</Text>

            <Pressable onPress={() => openMomo()} className="mt-4 rounded-xl bg-[#A50064] px-4 py-3">
              <Text className="text-center text-[13px] font-extrabold text-white">Mở app MoMo UAT</Text>
            </Pressable>

            {qrImageUri ? (
              <View className="mt-4 items-center rounded-2xl bg-[#F8F2FA] p-4">
                <Image source={{ uri: qrImageUri }} className="h-56 w-56 rounded-xl" resizeMode="contain" />
                <Text className="mt-3 text-center text-[12px] text-[#8E869A]">Quét QR bằng MoMo UAT để hoàn tất thanh toán.</Text>
              </View>
            ) : null}
          </View>
        ) : null}
      </ScrollView>
    </SafeAreaView>
  );
}
