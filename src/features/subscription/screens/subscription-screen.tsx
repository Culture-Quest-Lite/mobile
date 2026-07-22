import * as ImagePicker from "expo-image-picker";
import { useRouter } from "expo-router";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  Image,
  Linking,
  Modal,
  Platform,
  Pressable,
  RefreshControl,
  ScrollView,
  Text,
  TextInput,
  View,
} from "react-native";
import MapView, { Marker, PROVIDER_GOOGLE, type Region } from "react-native-maps";
import { SafeAreaView } from "react-native-safe-area-context";

import { SymbolView } from "@/components/ui/symbol-view";
import { getValidAccessToken } from "@/features/auth/hooks/use-auth-session";
import {
  autocompleteGoongPlaces,
  getGoongPlaceDetail,
  type GoongPlacePrediction,
} from "@/features/map/api/goong-places";

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

const DEFAULT_SHOP_REGION: Region = {
  latitude: 10.762622,
  longitude: 106.682212,
  latitudeDelta: 0.015,
  longitudeDelta: 0.015,
};

const formatCoordinateInput = (value: number) => value.toFixed(6);

function parseCoordinate(value: string, type: "latitude" | "longitude") {
  if (!value.trim()) return null;

  const parsed = Number(value);
  const limit = type === "latitude" ? 90 : 180;

  return Number.isFinite(parsed) && Math.abs(parsed) <= limit ? parsed : null;
}

function CoordinateMapPickerModal({
  latitude,
  longitude,
  onApply,
  onClose,
  visible,
}: {
  latitude: string;
  longitude: string;
  onApply: (coordinate: { latitude: number; longitude: number }) => void;
  onClose: () => void;
  visible: boolean;
}) {
  const initialLatitude = parseCoordinate(latitude, "latitude");
  const initialLongitude = parseCoordinate(longitude, "longitude");
  const [pickedCoordinate, setPickedCoordinate] = useState({
    latitude: initialLatitude ?? DEFAULT_SHOP_REGION.latitude,
    longitude: initialLongitude ?? DEFAULT_SHOP_REGION.longitude,
  });

  useEffect(() => {
    if (!visible) {
      return;
    }

    const nextLatitude = parseCoordinate(latitude, "latitude");
    const nextLongitude = parseCoordinate(longitude, "longitude");

    setPickedCoordinate({
      latitude: nextLatitude ?? DEFAULT_SHOP_REGION.latitude,
      longitude: nextLongitude ?? DEFAULT_SHOP_REGION.longitude,
    });
  }, [latitude, longitude, visible]);

  const region: Region = {
    latitude: pickedCoordinate.latitude,
    longitude: pickedCoordinate.longitude,
    latitudeDelta: 0.015,
    longitudeDelta: 0.015,
  };

  return (
    <Modal animationType="slide" onRequestClose={onClose} visible={visible}>
      <SafeAreaView className="flex-1 bg-white" edges={["top", "bottom"]}>
        <View className="flex-row items-center justify-between border-b border-[#F4EFF8] px-4 py-3">
          <View className="flex-1 pr-3">
            <Text className="text-[17px] font-extrabold text-[#2B2233]">
              Chọn vị trí shop
            </Text>
            <Text className="mt-1 text-[12px] text-[#8E869A]">
              Chạm vào bản đồ để đánh dấu vị trí shop. Tọa độ sẽ được lưu ẩn
              trong hồ sơ.
            </Text>
          </View>
          <Pressable
            onPress={onClose}
            className="h-10 w-10 items-center justify-center rounded-full bg-[#F4EFF8]"
          >
            <SymbolView
              name={{ ios: "xmark", android: "close", web: "close" }}
              size={16}
              tintColor="#8E869A"
            />
          </Pressable>
        </View>

        <MapView
          provider={Platform.OS === "android" ? PROVIDER_GOOGLE : undefined}
          mapType="standard"
          initialRegion={region}
          onPress={(event) => setPickedCoordinate(event.nativeEvent.coordinate)}
          style={{ flex: 1 }}
        >
          <Marker coordinate={pickedCoordinate} />
        </MapView>

        <View className="gap-3 border-t border-[#F4EFF8] bg-white px-4 py-4">
          <View className="rounded-2xl bg-[#FFF8FC] p-3">
            <Text className="text-[12px] font-bold text-[#8E869A]">
              Vị trí đã chọn
            </Text>
          </View>

          <Pressable
            onPress={() => onApply(pickedCoordinate)}
            className="rounded-xl bg-[#EB489B] px-4 py-4"
          >
            <Text className="text-center text-[15px] font-extrabold text-white">
              Lưu vị trí này
            </Text>
          </Pressable>
        </View>
      </SafeAreaView>
    </Modal>
  );
}

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

function normalizePickedAsset(
  asset: ImagePicker.ImagePickerAsset,
  fallbackName: string,
): UploadFile {
  const extension = asset.uri.split(".").pop()?.split("?")[0] || "jpg";
  const name = asset.fileName || `${fallbackName}.${extension}`;
  const type =
    asset.mimeType ||
    (extension.toLowerCase() === "png" ? "image/png" : "image/jpeg");

  return {
    name,
    type,
    uri: asset.uri,
  };
}

export default function SubscriptionScreen() {
  const router = useRouter();
  const [plans, setPlans] = useState<SubscriptionPlan[]>([]);
  const [selectedPlan, setSelectedPlan] = useState<SubscriptionPlan | null>(
    null,
  );
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
  const [activeAudience, setActiveAudience] =
    useState<SubscriptionAudience>("PARTNER");
  const [isCoordinateMapVisible, setIsCoordinateMapVisible] = useState(false);
  const [addressSuggestions, setAddressSuggestions] = useState<
    GoongPlacePrediction[]
  >([]);
  const [isSearchingAddress, setIsSearchingAddress] = useState(false);
  const [addressSearchError, setAddressSearchError] = useState<string | null>(
    null,
  );
  const [isAddressFocused, setIsAddressFocused] = useState(false);
  const [isSelectingSuggestion, setIsSelectingSuggestion] = useState(false);
  const addressSessionTokenRef = useRef(
    `shop-${Date.now()}-${Math.random().toString(36).slice(2)}`,
  );

  const savedLatitude = parseCoordinate(latitude, "latitude");
  const savedLongitude = parseCoordinate(longitude, "longitude");
  const hasSavedShopCoordinate =
    savedLatitude !== null && savedLongitude !== null;

  useEffect(() => {
    if (
      !isAddressFocused ||
      isSelectingSuggestion ||
      address.trim().length < 2
    ) {
      setAddressSuggestions([]);
      setAddressSearchError(null);
      return;
    }

    const controller = new AbortController();
    const timeoutId = setTimeout(async () => {
      setIsSearchingAddress(true);
      setAddressSearchError(null);

      try {
        const suggestions = await autocompleteGoongPlaces(
          address,
          addressSessionTokenRef.current,
          controller.signal,
        );

        if (controller.signal.aborted) {
          return;
        }

        setAddressSuggestions(suggestions);

        // Tự động lấy tọa độ của gợi ý phù hợp nhất để marker và bản đồ
        // di chuyển ngay sau khi người dùng ngừng nhập địa chỉ.
        const firstSuggestion = suggestions[0];

        if (firstSuggestion) {
          try {
            const detail = await getGoongPlaceDetail(
              firstSuggestion.placeId,
              addressSessionTokenRef.current,
            );

            if (!controller.signal.aborted) {
              setLatitude(formatCoordinateInput(detail.latitude));
              setLongitude(formatCoordinateInput(detail.longitude));
            }
          } catch {
            // Vẫn giữ danh sách gợi ý để người dùng có thể chọn thủ công.
          }
        }
      } catch (error) {
        if (!controller.signal.aborted) {
          setAddressSuggestions([]);
          setAddressSearchError(
            error instanceof Error
              ? error.message
              : "Không tải được gợi ý địa chỉ.",
          );
        }
      } finally {
        if (!controller.signal.aborted) {
          setIsSearchingAddress(false);
        }
      }
    }, 450);

    return () => {
      clearTimeout(timeoutId);
      controller.abort();
    };
  }, [address, isAddressFocused, isSelectingSuggestion]);

  async function handleSelectAddressSuggestion(
    suggestion: GoongPlacePrediction,
  ) {
    setIsSelectingSuggestion(true);
    setIsSearchingAddress(true);
    setAddressSearchError(null);

    try {
      const detail = await getGoongPlaceDetail(
        suggestion.placeId,
        addressSessionTokenRef.current,
      );
      setAddress(detail.address || suggestion.description);
      setLatitude(formatCoordinateInput(detail.latitude));
      setLongitude(formatCoordinateInput(detail.longitude));
      setAddressSuggestions([]);
      setIsAddressFocused(false);
      addressSessionTokenRef.current = `shop-${Date.now()}-${Math.random().toString(36).slice(2)}`;
    } catch (error) {
      setAddressSearchError(
        error instanceof Error
          ? error.message
          : "Không lấy được tọa độ địa chỉ.",
      );
    } finally {
      setIsSearchingAddress(false);
      setIsSelectingSuggestion(false);
    }
  }

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
    const activePlans = response.content.filter(
      (plan) => plan.status !== "DELETED" && plan.status !== "INACTIVE",
    );

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
          setErrorMessage(
            error instanceof Error
              ? error.message
              : "Không tải được danh sách gói.",
          );
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
      setErrorMessage(
        error instanceof Error
          ? error.message
          : "Không tải được danh sách gói.",
      );
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

      const detail = await getSubscriptionPlanDetail(
        plan.subscriptionPlanId,
        accessToken,
      );
      setSelectedPlan(detail);
    } catch {
      // Nếu API chi tiết chưa sẵn sàng, vẫn dùng dữ liệu từ danh sách gói.
    }
  }

  async function pickDocumentFile() {
    const permission = await ImagePicker.requestMediaLibraryPermissionsAsync();

    if (!permission.granted) {
      Alert.alert(
        "Thiếu quyền truy cập",
        "Vui lòng cấp quyền chọn ảnh giấy tờ xác minh.",
      );
      return;
    }

    const result = await ImagePicker.launchImageLibraryAsync({
      allowsEditing: false,
      mediaTypes: ImagePicker.MediaTypeOptions.Images,
      quality: 0.85,
    });

    if (!result.canceled && result.assets[0]) {
      setDocumentFile(
        normalizePickedAsset(result.assets[0], "partner-document"),
      );
    }
  }

  function handleApplyMapCoordinate(coordinate: {
    latitude: number;
    longitude: number;
  }) {
    setLongitude(formatCoordinateInput(coordinate.longitude));
    setLatitude(formatCoordinateInput(coordinate.latitude));
    setIsCoordinateMapVisible(false);
    Alert.alert("Đã lưu vị trí", "App đã lưu tọa độ shop từ bản đồ.");
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
      setShopFiles(
        result.assets.map((asset, index) =>
          normalizePickedAsset(asset, `shop-media-${index + 1}`),
        ),
      );
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

    const parsedLongitude = parseCoordinate(longitude, "longitude");
    const parsedLatitude = parseCoordinate(latitude, "latitude");

    if (parsedLongitude === null || parsedLatitude === null) {
      return "Vui lòng chọn vị trí shop trên bản đồ.";
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
      Alert.alert(
        "Cần đăng nhập",
        "Vui lòng đăng nhập trước khi đăng ký gói Partner.",
      );
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
        latitude: parseCoordinate(latitude, "latitude")!,
        longitude: parseCoordinate(longitude, "longitude")!,
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
      setErrorMessage(
        error instanceof Error
          ? error.message
          : "Đăng ký hoặc thanh toán thất bại.",
      );
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
      Alert.alert(
        "Mở MoMo không thành công",
        "Bạn có thể quét QR MoMo bên dưới để thanh toán.",
      );
      return;
    }

    Alert.alert(
      "Không mở được MoMo",
      "BE chưa trả deeplink/payUrl/QR code để thanh toán.",
    );
  }

  const qrImageUri =
    payment?.qrCodeUrl ||
    (payment?.qrCode ? `data:image/png;base64,${payment.qrCode}` : null);

  return (
    <SafeAreaView className="flex-1 bg-white" edges={["top", "bottom"]}>
      <ScrollView
        contentContainerStyle={{ padding: 16, paddingBottom: 32 }}
        refreshControl={
          <RefreshControl refreshing={isRefreshing} onRefresh={handleRefresh} />
        }
      >
        <View className="mb-4 flex-row items-center justify-between">
          <View className="flex-1 pr-3">
            <Text className="text-[22px] font-extrabold text-[#2B2233]">
              Gói Đăng ký & Nâng cấp
            </Text>
            <Text className="mt-1 text-[13px] text-[#8E869A]">
              Phân loại rõ giữa Gói Premium (Cho Người Dùng) & Gói Partner (Cho Cửa Hàng)
            </Text>
          </View>
          <Pressable
            onPress={() => router.back()}
            className="h-10 w-10 items-center justify-center rounded-full bg-[#F4EFF8]"
          >
            <SymbolView
              name={{ ios: "xmark", android: "close", web: "close" }}
              size={16}
              tintColor="#8E869A"
            />
          </Pressable>
        </View>

        {isLoading ? (
          <View className="rounded-2xl bg-[#FFF8FC] p-6">
            <ActivityIndicator color="#EB489B" />
            <Text className="mt-3 text-center text-[13px] text-[#8E869A]">
              Đang tải gói đăng ký...
            </Text>
          </View>
        ) : null}

        {errorMessage ? (
          <View className="mb-4 rounded-2xl border border-red-100 bg-red-50 p-4">
            <Text className="text-[13px] font-bold text-red-600">
              {errorMessage}
            </Text>
          </View>
        ) : null}

        <Text className="mb-2 text-[15px] font-extrabold text-[#2B2233]">
          1. Chọn loại đối tượng đăng ký
        </Text>

        <View className="mb-5 flex-row rounded-2xl bg-[#F4EFF8] p-1.5">
          {(["EXPLORER", "PARTNER"] as SubscriptionAudience[]).map(
            (audience) => {
              const isActive = activeAudience === audience;

              return (
                <Pressable
                  key={audience}
                  onPress={() => setActiveAudience(audience)}
                  className={`flex-1 flex-row items-center justify-center gap-2 rounded-xl px-3 py-3.5 ${
                    isActive ? "bg-white shadow-sm" : ""
                  }`}
                >
                  <SymbolView
                    name={{
                      ios: audience === "EXPLORER" ? "crown.fill" : "storefront.fill",
                      android: audience === "EXPLORER" ? "workspace_premium" : "store",
                      web: audience === "EXPLORER" ? "workspace_premium" : "store",
                    }}
                    size={16}
                    tintColor={
                      isActive
                        ? audience === "EXPLORER"
                          ? "#7C3AED"
                          : "#EB489B"
                        : "#8E869A"
                    }
                  />
                  <Text
                    className={`text-[13px] font-extrabold ${
                      isActive
                        ? audience === "EXPLORER"
                          ? "text-[#7C3AED]"
                          : "text-[#EB489B]"
                        : "text-[#8E869A]"
                    }`}
                  >
                    {audience === "EXPLORER" ? "👑 Gói Premium (User)" : "🏪 Gói Partner (Shop)"}
                  </Text>
                </Pressable>
              );
            },
          )}
        </View>

        {activeAudience === "EXPLORER" ? (
          <View className="gap-4">
            {/* Main Explorer Premium Hero Card */}
            <View className="overflow-hidden rounded-[24px] border border-[#E9D5FF] bg-[#FAF5FF] p-5 shadow-sm">
              <View className="flex-row items-start justify-between">
                <View className="flex-1 pr-3">
                  <View className="mb-2 self-start rounded-full bg-[#7C3AED] px-3 py-1">
                    <Text className="text-[10px] font-extrabold uppercase text-white">
                      👑 Gói Đăng Ký Người Dùng (Explorer)
                    </Text>
                  </View>
                  <Text className="text-[20px] font-extrabold text-[#2B2233]">
                    CultureQuest Explorer Premium
                  </Text>
                  <Text className="mt-1 text-[13px] leading-5 text-[#6B7280]">
                    Trọn bộ quyền lợi du lịch di sản thông minh dành cho du khách & người khám phá cá nhân.
                  </Text>
                </View>
              </View>

              {/* Pricing Display */}
              <View className="mt-4 rounded-2xl bg-white p-4 border border-[#E9D5FF]/80">
                <Text className="text-[12px] font-bold text-[#8E869A]">Biểu phí ưu đãi</Text>
                <View className="mt-1 flex-row items-baseline gap-2">
                  <Text className="text-[24px] font-extrabold text-[#7C3AED]">
                    {billingCycle === "MONTHLY" ? "59.000 VNĐ" : "499.000 VNĐ"}
                  </Text>
                  <Text className="text-[13px] text-[#6B7280]">
                    / {billingCycle === "MONTHLY" ? "tháng" : "năm (tiết kiệm 30%)"}
                  </Text>
                </View>
              </View>

              {/* Core Features List */}
              <View className="mt-4 gap-2.5">
                <Text className="text-[14px] font-extrabold text-[#2B2233]">
                  Đặc quyền bao gồm trong Gói Premium:
                </Text>
                <View className="flex-row items-center gap-2.5">
                  <SymbolView name={{ ios: "sparkles", android: "auto_awesome", web: "auto_awesome" }} size={16} tintColor="#7C3AED" />
                  <Text className="text-[13px] font-bold text-[#374151]">
                    🌟 User Plan: Lập kế hoạch & tối ưu lịch trình AI
                  </Text>
                </View>
                <View className="flex-row items-center gap-2.5">
                  <SymbolView name={{ ios: "record.circle.fill", android: "radio_button_checked", web: "radio_button_checked" }} size={16} tintColor="#7C3AED" />
                  <Text className="text-[13px] font-bold text-[#374151]">
                    📍 Record Journey: Định vị real-time & ghi nhật ký
                  </Text>
                </View>
                <View className="flex-row items-center gap-2.5">
                  <SymbolView name={{ ios: "headphones", android: "headphones", web: "headphones" }} size={16} tintColor="#7C3AED" />
                  <Text className="text-[13px] font-bold text-[#374151]">
                    🎧 Thuyết minh âm thanh Audio Guide di sản
                  </Text>
                </View>
                <View className="flex-row items-center gap-2.5">
                  <SymbolView name={{ ios: "ticket.fill", android: "confirmation_number", web: "confirmation_number" }} size={16} tintColor="#7C3AED" />
                  <Text className="text-[13px] font-bold text-[#374151]">
                    🎟️ Voucher ưu đãi đặc quyền từ Partner
                  </Text>
                </View>
              </View>

              <Pressable
                onPress={() => {
                  Alert.alert(
                    "Đăng ký Explorer Premium",
                    "Tính năng đăng ký Explorer Premium trực tuyến qua ví MoMo đang được cập nhật mở cổng chính thức.",
                  );
                }}
                className="mt-5 rounded-xl bg-[#7C3AED] px-4 py-4"
              >
                <Text className="text-center text-[15px] font-extrabold text-white">
                  Đăng ký Explorer Premium ngay
                </Text>
              </Pressable>
            </View>

            {/* Render any API Explorer Plans if present */}
            {explorerPlans.map((plan) => {
              const price = getPlanPrice(plan, billingCycle);

              return (
                <View
                  key={plan.subscriptionPlanId}
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
                        {plan.subscriptionPlanName}
                      </Text>
                      <Text className="mt-1 text-[13px] leading-5 text-[#8E869A]">
                        {plan.subscriptionPlanDescription || "Gói nâng cấp tài khoản Explorer."}
                      </Text>
                    </View>
                  </View>

                  <Text className="mt-3 text-[18px] font-extrabold text-[#2B2233]">
                    {formatCurrency(price)} / {billingCycle === "MONTHLY" ? "tháng" : "năm"}
                  </Text>
                </View>
              );
            })}
          </View>
        ) : (
          <View className="gap-4">
            {/* Main Partner Hero Banner */}
            <View className="rounded-2xl border border-[#F8D7E3] bg-[#FFF8FC] p-4 shadow-sm">
              <View className="mb-2 self-start rounded-full bg-[#EB489B] px-3 py-1">
                <Text className="text-[10px] font-extrabold uppercase text-white">
                  🏪 Gói Đăng Ký Đối Tác (Partner Merchant)
                </Text>
              </View>
              <Text className="text-[17px] font-extrabold text-[#2B2233]">
                Dành cho Chủ Shop & Cửa Hàng Kinh Doanh
              </Text>
              <Text className="mt-1 text-[13px] leading-5 text-[#8E869A]">
                Đăng ký gói Partner bên dưới để hiển thị địa điểm lên bản đồ CultureQuest, phát hành voucher ưu đãi và thu hút hàng ngàn khách du lịch ghé thăm.
              </Text>

              {/* Partner Benefits Grid */}
              <View className="mt-3 gap-2 border-t border-[#F8D7E3] pt-3">
                <View className="flex-row items-center gap-2">
                  <SymbolView name={{ ios: "mappin.and.ellipse", android: "place", web: "place" }} size={14} tintColor="#EB489B" />
                  <Text className="text-[12px] font-bold text-[#374151]">Đưa địa điểm/shop lên bản đồ du lịch</Text>
                </View>
                <View className="flex-row items-center gap-2">
                  <SymbolView name={{ ios: "ticket.fill", android: "confirmation_number", web: "confirmation_number" }} size={14} tintColor="#EB489B" />
                  <Text className="text-[12px] font-bold text-[#374151]">Tạo & quản lý voucher ưu đãi cho du khách</Text>
                </View>
                <View className="flex-row items-center gap-2">
                  <SymbolView name={{ ios: "checkmark.seal.fill", android: "verified", web: "verified" }} size={14} tintColor="#EB489B" />
                  <Text className="text-[12px] font-bold text-[#374151]">Tích xanh Xác minh Partner chính thức</Text>
                </View>
              </View>
            </View>

            {/* List of Available Partner Plans */}
            {visiblePartnerPlans.map((plan) => {
              const isSelected =
                selectedPlan?.subscriptionPlanId === plan.subscriptionPlanId;
              const price = getPlanPrice(plan, billingCycle);

              return (
                <Pressable
                  key={plan.subscriptionPlanId}
                  onPress={() => handleSelectPlan(plan)}
                  className={`rounded-2xl border p-4 ${
                    isSelected
                      ? "border-[#EB489B] bg-[#FFF0F8] shadow-sm"
                      : "border-[#F4EFF8] bg-[#FFF8FC]"
                  }`}
                >
                  <View className="flex-row items-start justify-between gap-3">
                    <View className="flex-1">
                      <View className="self-start rounded-full bg-[#FFE5F1] px-3 py-1">
                        <Text className="text-[10px] font-extrabold uppercase text-[#EB489B]">
                          Gói Partner
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
                        name={{
                          ios: "checkmark.circle.fill",
                          android: "check_circle",
                          web: "check_circle",
                        }}
                        size={22}
                        tintColor="#EB489B"
                      />
                    ) : null}
                  </View>

                  <Text className="mt-3 text-[18px] font-extrabold text-[#2B2233]">
                    {formatCurrency(price)} /{" "}
                    {billingCycle === "MONTHLY" ? "tháng" : "năm"}
                  </Text>
                </Pressable>
              );
            })}
          </View>
        )}

        {/* Billing Cycle Switcher */}
        <View className="mt-4 flex-row gap-3">
          {(["MONTHLY", "YEARLY"] as BillingCycle[]).map((cycle) => (
            <Pressable
              key={cycle}
              onPress={() => setBillingCycle(cycle)}
              className={`flex-1 rounded-xl px-4 py-3 ${billingCycle === cycle ? "bg-[#EB489B]" : "bg-[#F4EFF8]"}`}
            >
              <Text
                className={`text-center text-[13px] font-extrabold ${billingCycle === cycle ? "text-white" : "text-[#3D3446]"}`}
              >
                {cycle === "MONTHLY" ? "Thanh toán tháng" : "Thanh toán năm (Ưu đãi)"}
              </Text>
            </Pressable>
          ))}
        </View>

        {/* Comparison & Guidance Card */}
        <View className="mt-5 rounded-2xl bg-[#FAF9FC] p-4 border border-[#EBE6F0]">
          <Text className="text-[14px] font-extrabold text-[#2B2233]">
            💡 Hướng dẫn chọn gói phù hợp:
          </Text>
          <View className="mt-2 gap-2">
            <Text className="text-[12px] leading-5 text-[#6F657A]">
              • <Text className="font-extrabold text-[#7C3AED]">Gói Premium (User)</Text>: Dành cho Khách du lịch muốn lập kế hoạch tự động (User Plan), ghi hành trình (Record) & nghe thuyết minh di sản.
            </Text>
            <Text className="text-[12px] leading-5 text-[#6F657A]">
              • <Text className="font-extrabold text-[#EB489B]">Gói Partner (Shop)</Text>: Dành cho Chủ cửa hàng/địa điểm kinh doanh muốn đăng thông tin shop lên ứng dụng & tạo mã giảm giá thu hút khách.
            </Text>
          </View>
        </View>

        {activeAudience === "PARTNER" ? (
          <>
            <Text className="mb-3 mt-6 text-[16px] font-extrabold text-[#2B2233]">
              2. Thông tin shop
            </Text>
            <View className="gap-4 rounded-2xl bg-[#FFF8FC] p-4">
              <View>
                <Text className="mb-1.5 text-[12px] font-extrabold text-[#6F657A]">
                  Tên shop / địa điểm *
                </Text>
                <TextInput
                  value={shopName}
                  onChangeText={setShopName}
                  placeholder="Ví dụ: Cửa hàng Cà phê Heritage Quận 1"
                  placeholderTextColor="#B8AFBE"
                  className="rounded-xl bg-white px-4 py-3 text-[#2B2233]"
                />
              </View>

              <View>
                <Text className="mb-1.5 text-[12px] font-extrabold text-[#6F657A]">
                  Email quản lý shop *
                </Text>
                <TextInput
                  value={shopEmail}
                  onChangeText={setShopEmail}
                  placeholder="Ví dụ: shop.partner@gmail.com"
                  placeholderTextColor="#B8AFBE"
                  keyboardType="email-address"
                  autoCapitalize="none"
                  className="rounded-xl bg-white px-4 py-3 text-[#2B2233]"
                />
                <Text className="mt-1 text-[11px] leading-4 text-[#A49BAA]"></Text>
              </View>

              <View>
                <Text className="mb-1.5 text-[12px] font-extrabold text-[#6F657A]">
                  Địa chỉ shop *
                </Text>
                <View className="flex-row items-center rounded-xl bg-white">
                  <TextInput
                    value={address}
                    onChangeText={(value) => {
                      setAddress(value);
                      setLatitude("");
                      setLongitude("");
                      setIsSelectingSuggestion(false);
                    }}
                    onFocus={() => setIsAddressFocused(true)}
                    onBlur={() => {
                      setTimeout(() => setIsAddressFocused(false), 180);
                    }}
                    placeholder="Nhập tên đường, địa điểm hoặc tên shop"
                    placeholderTextColor="#B8AFBE"
                    autoCorrect={false}
                    className="flex-1 px-4 py-3 text-[#2B2233]"
                  />
                  {isSearchingAddress ? (
                    <ActivityIndicator color="#EB489B" size="small" />
                  ) : null}
                  <Pressable
                    accessibilityLabel="Chọn vị trí shop trên bản đồ"
                    onPress={() => setIsCoordinateMapVisible(true)}
                    className="mx-2 h-10 w-10 items-center justify-center rounded-full bg-[#FFF0F8]"
                  >
                    <SymbolView
                      name={{
                        ios: "mappin.and.ellipse",
                        android: "location_on",
                        web: "location_on",
                      }}
                      size={20}
                      tintColor="#EB489B"
                    />
                  </Pressable>
                </View>

                {isAddressFocused && addressSuggestions.length > 0 ? (
                  <View className="mt-2 overflow-hidden rounded-xl border border-[#F1E5ED] bg-white">
                    {addressSuggestions.map((suggestion, index) => (
                      <Pressable
                        key={suggestion.placeId}
                        onPress={() =>
                          handleSelectAddressSuggestion(suggestion)
                        }
                        className={`flex-row items-start gap-3 px-3 py-3 ${
                          index < addressSuggestions.length - 1
                            ? "border-b border-[#F4EFF8]"
                            : ""
                        }`}
                      >
                        <View className="mt-0.5 h-8 w-8 items-center justify-center rounded-full bg-[#FFF0F8]">
                          <SymbolView
                            name={{
                              ios: "mappin",
                              android: "location_on",
                              web: "location_on",
                            }}
                            size={16}
                            tintColor="#EB489B"
                          />
                        </View>
                        <View className="flex-1">
                          <Text className="text-[13px] font-extrabold text-[#2B2233]">
                            {suggestion.mainText}
                          </Text>
                          {suggestion.secondaryText ? (
                            <Text className="mt-0.5 text-[11px] leading-4 text-[#8E869A]">
                              {suggestion.secondaryText}
                            </Text>
                          ) : null}
                        </View>
                      </Pressable>
                    ))}
                  </View>
                ) : null}

                {addressSearchError ? (
                  <Text className="mt-1 text-[11px] leading-4 text-red-500">
                    {addressSearchError}
                  </Text>
                ) : (
                  <Text className="mt-1 text-[11px] leading-4 text-[#A49BAA]">
                  </Text>
                )}
              </View>

              <View className="overflow-hidden rounded-2xl border border-[#F4DDEB] bg-white">
                <Pressable onPress={() => setIsCoordinateMapVisible(true)}>
                  <View pointerEvents="none" style={{ height: 190 }}>
                    <MapView
                      provider={Platform.OS === "android" ? PROVIDER_GOOGLE : undefined}
                      mapType="standard"
                      region={{
                        latitude: hasSavedShopCoordinate
                          ? savedLatitude!
                          : DEFAULT_SHOP_REGION.latitude,
                        longitude: hasSavedShopCoordinate
                          ? savedLongitude!
                          : DEFAULT_SHOP_REGION.longitude,
                        latitudeDelta: 0.015,
                        longitudeDelta: 0.015,
                      }}
                      style={{ flex: 1 }}
                    >
                      {hasSavedShopCoordinate ? (
                        <Marker
                          coordinate={{
                            latitude: savedLatitude!,
                            longitude: savedLongitude!,
                          }}
                        />
                      ) : null}
                    </MapView>
                  </View>
                </Pressable>

                <View className="p-3">
                  <Text
                    className={`text-[13px] font-extrabold ${hasSavedShopCoordinate ? "text-[#15803D]" : "text-[#8E869A]"}`}
                  >
                    {hasSavedShopCoordinate
                      ? "Đã chọn vị trí shop"
                      : "Chạm vào bản đồ để chọn vị trí shop"}
                  </Text>

                  <Pressable
                    onPress={() => setIsCoordinateMapVisible(true)}
                    className="mt-3 rounded-xl bg-[#EB489B] px-3 py-3"
                  >
                    <Text className="text-center text-[12px] font-extrabold text-white">
                      {hasSavedShopCoordinate
                        ? "Chọn lại vị trí"
                        : "Chọn vị trí trên bản đồ"}
                    </Text>
                  </Pressable>
                </View>
              </View>
            </View>

            <Text className="mb-3 mt-6 text-[16px] font-extrabold text-[#2B2233]">
              3. Hồ sơ xác minh
            </Text>
            <View className="gap-3 rounded-2xl bg-[#FFF8FC] p-4">
              <Pressable
                onPress={pickDocumentFile}
                className="rounded-xl border border-dashed border-[#EB489B] bg-white px-4 py-4"
              >
                <Text className="text-center text-[13px] font-extrabold text-[#EB489B]">
                  {documentFile
                    ? `Đã chọn: ${documentFile.name}`
                    : "Chọn ảnh giấy tờ xác minh *"}
                </Text>
              </Pressable>

              <Pressable
                onPress={pickShopImages}
                className="rounded-xl border border-dashed border-[#F0B7D6] bg-white px-4 py-4"
              >
                <Text className="text-center text-[13px] font-extrabold text-[#EB489B]">
                  {shopFiles.length > 0
                    ? `Đã chọn ${shopFiles.length} ảnh shop`
                    : "Chọn thêm ảnh shop (tuỳ chọn)"}
                </Text>
              </Pressable>
            </View>

            <View className="mt-6 rounded-2xl bg-[#F4EFF8] p-4">
              <Text className="text-[14px] font-extrabold text-[#2B2233]">
                Tóm tắt thanh toán
              </Text>
              <Text className="mt-2 text-[13px] text-[#3D3446]">
                Gói: {selectedPlan?.subscriptionPlanName ?? "Chưa chọn"}
              </Text>
              <Text className="mt-1 text-[13px] text-[#3D3446]">
                Chu kỳ: {billingCycle === "MONTHLY" ? "Theo tháng" : "Theo năm"}
              </Text>
              <Text className="mt-1 text-[13px] text-[#3D3446]">
                Số tiền: {formatCurrency(selectedAmount)}
              </Text>
              <Text className="mt-1 text-[13px] text-[#3D3446]">
                Trạng thái: {getStatusLabel(registeredStatus)}
              </Text>
            </View>

            <Pressable
              disabled={isSubmitting || visiblePartnerPlans.length === 0}
              onPress={handleRegisterAndPay}
              className={`mt-5 rounded-xl px-4 py-4 ${isSubmitting || visiblePartnerPlans.length === 0 ? "bg-[#D8CADF]" : "bg-[#EB489B]"}`}
            >
              {isSubmitting ? (
                <ActivityIndicator color="white" />
              ) : (
                <Text className="text-center text-[15px] font-extrabold text-white">
                  Đăng ký
                </Text>
              )}
            </Pressable>
          </>
        ) : (
          <View className="mt-6 rounded-2xl border border-[#E7DDF0] bg-[#FAF7FC] p-4">
            <Text className="text-[15px] font-extrabold text-[#2B2233]">
              {/* Luồng Explorer đang tạm để sau */}
            </Text>
            <Text className="mt-2 text-[13px] leading-5 text-[#8E869A]">
              {/* Màn hình hiện chỉ mở form đăng ký cho Partner để test upload hồ sơ và thanh toán MoMo. Khi cần làm gói Explorer, có thể dùng tab này để gắn luồng riêng. */}
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

        <CoordinateMapPickerModal
          latitude={latitude}
          longitude={longitude}
          onApply={handleApplyMapCoordinate}
          onClose={() => setIsCoordinateMapVisible(false)}
          visible={isCoordinateMapVisible}
        />

        {payment ? (
          <View className="mt-5 rounded-2xl border border-[#F4EFF8] bg-white p-4">
            <Text className="text-[15px] font-extrabold text-[#2B2233]">
              Thanh toán MoMo UAT
            </Text>
            <Text className="mt-2 text-[13px] text-[#8E869A]">
              Ưu tiên mở deeplink MoMo. Nếu máy không mở được app, hãy quét QR
              bên dưới.
            </Text>

            <Pressable
              onPress={() => openMomo()}
              className="mt-4 rounded-xl bg-[#A50064] px-4 py-3"
            >
              <Text className="text-center text-[13px] font-extrabold text-white">
                Mở app MoMo UAT
              </Text>
            </Pressable>

            {qrImageUri ? (
              <View className="mt-4 items-center rounded-2xl bg-[#F8F2FA] p-4">
                <Image
                  source={{ uri: qrImageUri }}
                  className="h-56 w-56 rounded-xl"
                  resizeMode="contain"
                />
                <Text className="mt-3 text-center text-[12px] text-[#8E869A]">
                  Hoàn Tất.
                </Text>
              </View>
            ) : null}
          </View>
        ) : null}
      </ScrollView>
    </SafeAreaView>
  );
}