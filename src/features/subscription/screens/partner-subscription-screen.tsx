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
  getSubscriptionPlans,
  getSubscriptionPlanDetail,
  initiatePayOsPayment,
  registerPartnerSubscription,
} from "../api/partner-subscription-api";

const PAYOS_REDIRECT_URL = "culturequest://partner-subscription/payment-result";

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
    if (!visible) return;
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
              Chạm vào bản đồ để đánh dấu vị trí shop.
            </Text>
          </View>
          <Pressable
            onPress={onClose}
            style={{
              alignItems: "center",
              backgroundColor: "#F4EFF8",
              borderRadius: 999,
              height: 40,
              justifyContent: "center",
              width: 40,
            }}
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
            <Text className="text-[12px] text-[#2B2233]">
              Lat: {pickedCoordinate.latitude.toFixed(6)} — Lon:{" "}
              {pickedCoordinate.longitude.toFixed(6)}
            </Text>
          </View>

          <Pressable
            onPress={() => onApply(pickedCoordinate)}
            style={{
              backgroundColor: "#EB489B",
              borderRadius: 12,
              paddingHorizontal: 16,
              paddingVertical: 16,
            }}
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

const formatCurrency = (value?: number | null) => {
  if (!value) return "Liên hệ";
  return value.toLocaleString("vi-VN", {
    currency: "VND",
    maximumFractionDigits: 0,
    style: "currency",
  });
};

const getPlanPrice = (plan: SubscriptionPlan, billingCycle: BillingCycle) =>
  billingCycle === "MONTHLY" ? plan.priceMonthly : plan.priceYearly;

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

function normalizePickedAsset(
  asset: ImagePicker.ImagePickerAsset,
  fallbackName: string,
): UploadFile {
  const extension = asset.uri.split(".").pop()?.split("?")[0] || "jpg";
  const name = asset.fileName || `${fallbackName}.${extension}`;
  const type =
    asset.mimeType ||
    (extension.toLowerCase() === "png" ? "image/png" : "image/jpeg");
  return { name, type, uri: asset.uri };
}

type RegistrationStep = 1 | 2;

const STEP_LABELS: Record<RegistrationStep, string> = {
  1: "Thông tin đăng ký",
  2: "Thanh toán ngân hàng",
};

export default function PartnerSubscriptionScreen() {
  const router = useRouter();
  const [currentStep, setCurrentStep] = useState<RegistrationStep>(1);
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
  const [isCoordinateMapVisible, setIsCoordinateMapVisible] = useState(false);
  const [addressSuggestions, setAddressSuggestions] = useState<GoongPlacePrediction[]>([]);
  const [isSearchingAddress, setIsSearchingAddress] = useState(false);
  const [addressSearchError, setAddressSearchError] = useState<string | null>(null);
  const [isAddressFocused, setIsAddressFocused] = useState(false);
  const [isSelectingSuggestion, setIsSelectingSuggestion] = useState(false);
  const addressSessionTokenRef = useRef(
    `shop-${Date.now()}-${Math.random().toString(36).slice(2)}`,
  );

  const savedLatitude = parseCoordinate(latitude, "latitude");
  const savedLongitude = parseCoordinate(longitude, "longitude");
  const hasSavedShopCoordinate = savedLatitude !== null && savedLongitude !== null;

  const selectedAmount = useMemo(
    () => (selectedPlan ? getPlanPrice(selectedPlan, billingCycle) : null),
    [billingCycle, selectedPlan],
  );

  const qrImageUri = useMemo(() => {
    const candidate = payment?.qrCodeUrl || payment?.qrCode;
    if (!candidate) return null;
    return candidate.startsWith("http://") ||
      candidate.startsWith("https://") ||
      candidate.startsWith("data:image/")
      ? candidate
      : null;
  }, [payment]);

  useEffect(() => {
    if (!isAddressFocused || isSelectingSuggestion || address.trim().length < 2) {
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
        if (controller.signal.aborted) return;
        setAddressSuggestions(suggestions);

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
            // Keep suggestions
          }
        }
      } catch (error) {
        if (!controller.signal.aborted) {
          setAddressSuggestions([]);
          setAddressSearchError(
            error instanceof Error ? error.message : "Không tải được gợi ý địa chỉ.",
          );
        }
      } finally {
        if (!controller.signal.aborted) setIsSearchingAddress(false);
      }
    }, 450);

    return () => {
      clearTimeout(timeoutId);
      controller.abort();
    };
  }, [address, isAddressFocused, isSelectingSuggestion]);

  async function handleSelectAddressSuggestion(suggestion: GoongPlacePrediction) {
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
        error instanceof Error ? error.message : "Không lấy được tọa độ địa chỉ.",
      );
    } finally {
      setIsSearchingAddress(false);
      setIsSelectingSuggestion(false);
    }
  }

  const loadPlans = useCallback(async () => {
    const accessToken = await getValidAccessToken();
    if (!accessToken) {
      setErrorMessage("Bạn cần đăng nhập trước khi đăng ký gói Partner.");
      setPlans([]);
      return;
    }

    const response = await getSubscriptionPlans(accessToken);
    const activePlans = response.content.filter((plan) => {
      const planType =
        typeof plan.planType === "string"
          ? plan.planType.toUpperCase()
          : typeof plan.configLimit?.planType === "string"
            ? plan.configLimit.planType.toUpperCase()
            : "";

      return (
        plan.status !== "DELETED" &&
        plan.status !== "INACTIVE" &&
        (planType === "" || planType === "PARTNER")
      );
    });
    setPlans(activePlans);
    setSelectedPlan((currentPlan) => {
      if (currentPlan && activePlans.some((p) => p.subscriptionPlanId === currentPlan.subscriptionPlanId)) {
        return currentPlan;
      }
      return activePlans[0] ?? null;
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
        if (isMounted) setIsLoading(false);
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
      if (!accessToken) return;
      const detail = await getSubscriptionPlanDetail(plan.subscriptionPlanId, accessToken);
      setSelectedPlan(detail);
    } catch {
      // Dùng dữ liệu từ danh sách gói
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

  function handleApplyMapCoordinate(coordinate: { latitude: number; longitude: number }) {
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
      setShopFiles(result.assets.map((asset, index) => normalizePickedAsset(asset, `shop-media-${index + 1}`)));
    }
  }

  function validateStep1() {
    if (!selectedPlan) return "Vui lòng chọn gói đăng ký.";
    if (!shopName.trim()) return "Vui lòng nhập tên shop.";
    if (!/^\S+@\S+\.\S+$/.test(shopEmail.trim())) return "Email shop không đúng định dạng.";
    if (!address.trim()) return "Vui lòng nhập địa chỉ shop.";
    if (parseCoordinate(longitude, "longitude") === null || parseCoordinate(latitude, "latitude") === null) {
      return "Vui lòng chọn vị trí shop trên bản đồ.";
    }
    if (!documentFile) return "Vui lòng upload giấy tờ xác minh.";
    return null;
  }

  function handleContinueToPayment() {
    const validationMessage = validateStep1();
    if (validationMessage) {
      Alert.alert("Thiếu thông tin", validationMessage);
      return;
    }
    setCurrentStep(2);
  }


  useEffect(() => {
    const subscription = Linking.addEventListener("url", ({ url }) => {
      if (url.startsWith(PAYOS_REDIRECT_URL)) {
        setPayment(null);
        setRegisteredStatus("PENDING");
      }
    });

    return () => subscription.remove();
  }, []);

  async function handleRegisterAndPay() {
    const validationMessage = validateStep1();
    if (validationMessage) {
      Alert.alert("Thiếu thông tin", validationMessage);
      setCurrentStep(1);
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
        latitude: parseCoordinate(latitude, "latitude")!,
        longitude: parseCoordinate(longitude, "longitude")!,
        shopEmail,
        shopName,
        subscriptionPlanId: selectedPlan.subscriptionPlanId,
      });
      setRegisteredStatus("PAYMENT_PENDING");

      const paymentResponse = await initiatePayOsPayment({
        accessToken,
        redirectUrl: PAYOS_REDIRECT_URL,
        subscriptionId: subscription.id,
      });
      setPayment(paymentResponse);
      await openBankPayment(paymentResponse);
    } catch (error) {
      setErrorMessage(
        error instanceof Error ? error.message : "Đăng ký Partner hoặc khởi tạo thanh toán ngân hàng thất bại.",
      );
    } finally {
      setIsSubmitting(false);
    }
  }

  async function openBankPayment(paymentResponse = payment) {
    if (!paymentResponse) return;
    const targetUrl =
      paymentResponse.checkoutUrl ||
      paymentResponse.paymentUrl ||
      paymentResponse.payUrl ||
      paymentResponse.deeplink;
    if (targetUrl) {
      try {
        const canOpen = await Linking.canOpenURL(targetUrl);
        if (canOpen) {
          await Linking.openURL(targetUrl);
          return;
        }
      } catch {
        // fallback QR
      }
    }
    if (paymentResponse.qrCodeUrl || paymentResponse.qrCode) {
      Alert.alert(
        "Không mở được trang thanh toán",
        "Bạn có thể quét mã QR bên dưới để chuyển khoản qua ngân hàng.",
      );
      return;
    }
    Alert.alert(
      "Không mở được trang thanh toán",
      "Hệ thống chưa trả liên kết hoặc mã QR để thanh toán bằng ngân hàng.",
    );
  }

  return (
    <SafeAreaView className="flex-1 bg-white" edges={["top", "bottom"]}>
      <ScrollView
        contentContainerStyle={{ paddingBottom: 40 }}
        refreshControl={<RefreshControl refreshing={isRefreshing} onRefresh={handleRefresh} />}
      >
        {/* Header */}
        <View className="bg-[#EB489B] px-5 pb-8 pt-5">
          <View className="mb-4 flex-row items-center justify-between">
            <Pressable
              onPress={() => {
                if (router.canGoBack()) {
                  router.back();
                } else {
                  router.replace("/subscription");
                }
              }}
              style={{
                alignItems: "center",
                backgroundColor: "rgba(255,255,255,0.2)",
                borderRadius: 999,
                height: 40,
                justifyContent: "center",
                width: 40,
              }}
            >
              <SymbolView
                name={{ ios: "chevron.left", android: "arrow_back", web: "arrow_back" }}
                size={18}
                tintColor="white"
              />
            </Pressable>
            <View className="flex-row items-center gap-2 rounded-full bg-white/20 px-4 py-1.5">
              <SymbolView
                name={{ ios: "storefront.fill", android: "store", web: "store" }}
                size={14}
                tintColor="white"
              />
              <Text className="text-[12px] font-extrabold text-white">
                GÓI PARTNER SHOP
              </Text>
            </View>
            <View className="w-10" />
          </View>

          <Text className="text-[28px] font-extrabold text-white">
            Đăng ký Partner
          </Text>
          <Text className="mt-1 text-[14px] leading-5 text-white/80">
            Hiển thị shop lên bản đồ CultureQuest, phát hành voucher & thu hút khách du lịch
          </Text>

          {/* Step indicator */}
          <View className="mt-5 flex-row items-center gap-2">
            {([1, 2] as RegistrationStep[]).map((step) => {
              const isActive = currentStep === step;
              const isCompleted = currentStep > step;
              return (
                <View key={step} className="flex-1 flex-row items-center gap-2">
                  <View
                    style={{
                      alignItems: "center",
                      backgroundColor: isActive || isCompleted ? "rgba(255,255,255,0.95)" : "rgba(255,255,255,0.25)",
                      borderRadius: 999,
                      height: 28,
                      justifyContent: "center",
                      width: 28,
                    }}
                  >
                    {isCompleted ? (
                      <SymbolView
                        name={{ ios: "checkmark", android: "check", web: "check" }}
                        size={14}
                        tintColor="#EB489B"
                      />
                    ) : (
                      <Text
                        style={{
                          color: isActive ? "#EB489B" : "rgba(255,255,255,0.85)",
                          fontSize: 13,
                          fontWeight: "800",
                        }}
                      >
                        {step}
                      </Text>
                    )}
                  </View>
                  <View className="flex-1">
                    <Text
                      style={{
                        color: isActive ? "white" : "rgba(255,255,255,0.7)",
                        fontSize: 11,
                        fontWeight: isActive ? "800" : "600",
                      }}
                    >
                      Bước {step}
                    </Text>
                    <Text
                      style={{
                        color: isActive ? "rgba(255,255,255,0.95)" : "rgba(255,255,255,0.65)",
                        fontSize: 11,
                        fontWeight: "700",
                      }}
                      numberOfLines={1}
                    >
                      {STEP_LABELS[step]}
                    </Text>
                  </View>
                  {step === 1 ? (
                    <View
                      style={{
                        backgroundColor: currentStep > 1 ? "rgba(255,255,255,0.95)" : "rgba(255,255,255,0.35)",
                        height: 2,
                        width: 16,
                      }}
                    />
                  ) : null}
                </View>
              );
            })}
          </View>
        </View>

        <View className="px-5 pt-5">
          {/* Loading / Error */}
          {isLoading ? (
            <View className="mb-4 items-center rounded-2xl bg-[#FFF8FC] p-6">
              <ActivityIndicator color="#EB489B" />
              <Text className="mt-3 text-center text-[13px] text-[#8E869A]">
                Đang tải gói đăng ký...
              </Text>
            </View>
          ) : null}

          {errorMessage ? (
            <View className="mb-4 rounded-2xl border border-red-100 bg-red-50 p-4">
              <Text className="text-[13px] font-bold text-red-600">{errorMessage}</Text>
            </View>
          ) : null}

          {/* Partner Benefits Banner */}
          {currentStep === 1 ? (
          <View className="mb-5 rounded-2xl border border-[#F8D7E3] bg-[#FFF8FC] p-4">
            <View className="flex-row items-center gap-2 mb-2">
              <SymbolView
                name={{ ios: "checkmark.seal.fill", android: "verified", web: "verified" }}
                size={16}
                tintColor="#EB489B"
              />
              <Text className="text-[14px] font-extrabold text-[#2B2233]">
                Quyền lợi Partner chính thức
              </Text>
            </View>
            <View className="gap-2 border-t border-[#F8D7E3] pt-3">
              {[
                { icon: { ios: "mappin.and.ellipse", android: "place", web: "place" }, text: "Đưa địa điểm/shop lên bản đồ du lịch" },
                { icon: { ios: "ticket.fill", android: "confirmation_number", web: "confirmation_number" }, text: "Tạo & quản lý voucher ưu đãi cho du khách" },
                { icon: { ios: "checkmark.seal.fill", android: "verified", web: "verified" }, text: "Tích xanh Xác minh Partner chính thức" },
              ].map((item, i) => (
                <View key={i} className="flex-row items-center gap-2">
                  <SymbolView name={item.icon} size={14} tintColor="#EB489B" />
                  <Text className="text-[12px] font-bold text-[#374151]">{item.text}</Text>
                </View>
              ))}
            </View>
          </View>
          ) : null}

          {currentStep === 1 ? (
            <>
          {/* Plan Selection */}
          {!isLoading && plans.length > 0 ? (
            <View className="mb-5">
              <Text className="mb-3 text-[15px] font-extrabold text-[#2B2233]">
                Chọn gói Partner
              </Text>
              <View className="gap-3">
                {plans.map((plan) => {
                  const isSelected = selectedPlan?.subscriptionPlanId === plan.subscriptionPlanId;
                  const price = getPlanPrice(plan, billingCycle);
                  return (
                    <Pressable
                      key={plan.subscriptionPlanId}
                      onPress={() => handleSelectPlan(plan)}
                      style={{
                        backgroundColor: isSelected ? "#FFF0F8" : "#FFF8FC",
                        borderColor: isSelected ? "#EB489B" : "#F4EFF8",
                        borderRadius: 16,
                        borderWidth: 1,
                        elevation: isSelected ? 2 : 0,
                        padding: 16,
                      }}
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
                            {plan.subscriptionPlanDescription || "Gói dành cho đối tác đăng voucher và quản lý shop."}
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
            </View>
          ) : null}

          {/* Billing Cycle */}
          <View className="mb-5">
            <Text className="mb-3 text-[15px] font-extrabold text-[#2B2233]">
              Chu kỳ thanh toán
            </Text>
            <View className="flex-row rounded-2xl bg-[#F4EFF8] p-1.5 gap-2">
              {(["MONTHLY", "YEARLY"] as BillingCycle[]).map((cycle) => (
                <Pressable
                  key={cycle}
                  onPress={() => setBillingCycle(cycle)}
                  style={{
                    backgroundColor:
                      billingCycle === cycle ? "#FFFFFF" : "transparent",
                    borderRadius: 12,
                    elevation: billingCycle === cycle ? 2 : 0,
                    flex: 1,
                    paddingHorizontal: 16,
                    paddingVertical: 12,
                  }}
                >
                  <Text className={`text-center text-[13px] font-extrabold ${billingCycle === cycle ? "text-[#EB489B]" : "text-[#8E869A]"}`}>
                    {cycle === "MONTHLY" ? "Theo tháng" : "Theo năm"}
                  </Text>
                  {cycle === "YEARLY" ? (
                    <Text className="mt-0.5 text-center text-[10px] font-bold text-green-600">
                      Giá theo từng gói
                    </Text>
                  ) : null}
                </Pressable>
              ))}
            </View>
          </View>

          {/* Shop Info Form */}
          <Text className="mb-3 text-[15px] font-extrabold text-[#2B2233]">
            Thông tin shop
          </Text>
          <View className="mb-5 gap-4 rounded-2xl bg-[#FFF8FC] p-4">
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
                  onBlur={() => { setTimeout(() => setIsAddressFocused(false), 180); }}
                  placeholder="Nhập tên đường, địa điểm hoặc tên shop"
                  placeholderTextColor="#B8AFBE"
                  autoCorrect={false}
                  className="flex-1 px-4 py-3 text-[#2B2233]"
                />
                {isSearchingAddress ? <ActivityIndicator color="#EB489B" size="small" /> : null}
                <Pressable
                  accessibilityLabel="Chọn vị trí shop trên bản đồ"
                  onPress={() => setIsCoordinateMapVisible(true)}
                  style={{
                    alignItems: "center",
                    backgroundColor: "#FFF0F8",
                    borderRadius: 999,
                    height: 40,
                    justifyContent: "center",
                    marginHorizontal: 8,
                    width: 40,
                  }}
                >
                  <SymbolView
                    name={{ ios: "mappin.and.ellipse", android: "location_on", web: "location_on" }}
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
                      onPress={() => handleSelectAddressSuggestion(suggestion)}
                      style={{
                        alignItems: "flex-start",
                        borderBottomColor: "#F4EFF8",
                        borderBottomWidth:
                          index < addressSuggestions.length - 1 ? 1 : 0,
                        flexDirection: "row",
                        gap: 12,
                        paddingHorizontal: 12,
                        paddingVertical: 12,
                      }}
                    >
                      <View className="mt-0.5 h-8 w-8 items-center justify-center rounded-full bg-[#FFF0F8]">
                        <SymbolView
                          name={{ ios: "mappin", android: "location_on", web: "location_on" }}
                          size={16}
                          tintColor="#EB489B"
                        />
                      </View>
                      <View className="flex-1">
                        <Text className="text-[13px] font-extrabold text-[#2B2233]">{suggestion.mainText}</Text>
                        {suggestion.secondaryText ? (
                          <Text className="mt-0.5 text-[11px] leading-4 text-[#8E869A]">{suggestion.secondaryText}</Text>
                        ) : null}
                      </View>
                    </Pressable>
                  ))}
                </View>
              ) : null}

              {addressSearchError ? (
                <Text className="mt-1 text-[11px] leading-4 text-red-500">{addressSearchError}</Text>
              ) : null}
            </View>

            {/* Map Preview */}
            <View className="overflow-hidden rounded-2xl border border-[#F4DDEB] bg-white">
              <Pressable
                onPress={() => setIsCoordinateMapVisible(true)}
                style={{}}
              >
                <View pointerEvents="none" style={{ height: 190 }}>
                  <MapView
                    provider={Platform.OS === "android" ? PROVIDER_GOOGLE : undefined}
                    mapType="standard"
                    region={{
                      latitude: hasSavedShopCoordinate ? savedLatitude! : DEFAULT_SHOP_REGION.latitude,
                      longitude: hasSavedShopCoordinate ? savedLongitude! : DEFAULT_SHOP_REGION.longitude,
                      latitudeDelta: 0.015,
                      longitudeDelta: 0.015,
                    }}
                    style={{ flex: 1 }}
                  >
                    {hasSavedShopCoordinate ? (
                      <Marker coordinate={{ latitude: savedLatitude!, longitude: savedLongitude! }} />
                    ) : null}
                  </MapView>
                </View>
              </Pressable>

              <View className="p-3">
                <Text className={`text-[13px] font-extrabold ${hasSavedShopCoordinate ? "text-[#15803D]" : "text-[#8E869A]"}`}>
                  {hasSavedShopCoordinate ? "✅ Đã chọn vị trí shop" : "Chạm vào bản đồ để chọn vị trí shop"}
                </Text>
                <Pressable
                  onPress={() => setIsCoordinateMapVisible(true)}
                  style={{
                    backgroundColor: "#EB489B",
                    borderRadius: 12,
                    marginTop: 12,
                    paddingHorizontal: 12,
                    paddingVertical: 12,
                  }}
                >
                  <Text className="text-center text-[12px] font-extrabold text-white">
                    {hasSavedShopCoordinate ? "Chọn lại vị trí" : "Chọn vị trí trên bản đồ"}
                  </Text>
                </Pressable>
              </View>
            </View>
          </View>

          {/* Verification Docs */}
          <Text className="mb-3 text-[15px] font-extrabold text-[#2B2233]">
            Hồ sơ xác minh
          </Text>
          <View className="mb-5 gap-3 rounded-2xl bg-[#FFF8FC] p-4">
            <Pressable
              onPress={pickDocumentFile}
              style={{
                backgroundColor: "#FFFFFF",
                borderColor: "#EB489B",
                borderRadius: 12,
                borderStyle: "dashed",
                borderWidth: 1,
                paddingHorizontal: 16,
                paddingVertical: 16,
              }}
            >
              <Text className="text-center text-[13px] font-extrabold text-[#EB489B]">
                {documentFile ? `✅ Đã chọn: ${documentFile.name}` : "📄 Chọn ảnh giấy tờ xác minh *"}
              </Text>
            </Pressable>

            <Pressable
              onPress={pickShopImages}
              style={{
                backgroundColor: "#FFFFFF",
                borderColor: "#F0B7D6",
                borderRadius: 12,
                borderStyle: "dashed",
                borderWidth: 1,
                paddingHorizontal: 16,
                paddingVertical: 16,
              }}
            >
              <Text className="text-center text-[13px] font-extrabold text-[#EB489B]">
                {shopFiles.length > 0
                  ? `🖼️ Đã chọn ${shopFiles.length} ảnh shop`
                  : "🖼️ Chọn thêm ảnh shop (tuỳ chọn)"}
              </Text>
            </Pressable>
          </View>

          {/* Continue to payment step */}
          <Pressable
            onPress={handleContinueToPayment}
            style={{
              backgroundColor: "#EB489B",
              borderRadius: 16,
              flexDirection: "row",
              alignItems: "center",
              justifyContent: "center",
              gap: 8,
              paddingHorizontal: 16,
              paddingVertical: 16,
            }}
          >
            <Text className="text-center text-[15px] font-extrabold text-white">
              Tiếp tục đến bước thanh toán
            </Text>
            <SymbolView
              name={{ ios: "arrow.right", android: "arrow_forward", web: "arrow_forward" }}
              size={16}
              tintColor="white"
            />
          </Pressable>
            </>
          ) : null}

          {currentStep === 2 ? (
            <>
          {/* Back to step 1 */}
          <Pressable
            onPress={() => setCurrentStep(1)}
            style={{
              flexDirection: "row",
              alignItems: "center",
              gap: 6,
              marginBottom: 16,
            }}
          >
            <SymbolView
              name={{ ios: "chevron.left", android: "arrow_back", web: "arrow_back" }}
              size={14}
              tintColor="#EB489B"
            />
            <Text className="text-[13px] font-extrabold text-[#EB489B]">
              Quay lại thông tin đăng ký
            </Text>
          </Pressable>

          {/* Payment method */}
          <Text className="mb-3 text-[15px] font-extrabold text-[#2B2233]">
            Phương thức thanh toán
          </Text>
          <View className="mb-5 rounded-2xl border border-[#EB489B] bg-[#FFF0F8] p-4">
            <View className="flex-row items-center gap-3">
              <View
                style={{
                  alignItems: "center",
                  backgroundColor: "#EB489B",
                  borderRadius: 999,
                  height: 36,
                  justifyContent: "center",
                  width: 36,
                }}
              >
                <SymbolView
                  name={{ ios: "qrcode", android: "qr_code", web: "qr_code" }}
                  size={18}
                  tintColor="white"
                />
              </View>
              <View className="flex-1">
                <Text className="text-[14px] font-extrabold text-[#2B2233]">
                  Chuyển khoản ngân hàng / QR
                </Text>
                <Text className="mt-0.5 text-[12px] leading-4 text-[#8E869A]">
                  Quét mã VietQR hoặc chuyển khoản qua ứng dụng ngân hàng bất kỳ.
                </Text>
              </View>
              <SymbolView
                name={{ ios: "checkmark.circle.fill", android: "check_circle", web: "check_circle" }}
                size={20}
                tintColor="#EB489B"
              />
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
              <Text className="text-[13px] font-extrabold text-[#EB489B]">
                Số tiền: {formatCurrency(selectedAmount)}
              </Text>
              <Text className="text-[13px] text-[#3D3446]">
                Trạng thái: {getStatusLabel(registeredStatus)}
              </Text>
            </View>
          </View>

          {/* Submit Button */}
          <Pressable
            disabled={isSubmitting || plans.length === 0}
            onPress={handleRegisterAndPay}
            style={{
              backgroundColor:
                isSubmitting || plans.length === 0 ? "#D8CADF" : "#EB489B",
              borderRadius: 16,
              paddingHorizontal: 16,
              paddingVertical: 16,
            }}
          >
            {isSubmitting ? (
              <ActivityIndicator color="white" />
            ) : (
              <Text className="text-center text-[15px] font-extrabold text-white">
                🏪 Đăng ký và thanh toán
              </Text>
            )}
          </Pressable>

          {/* Payment Result */}
          {payment ? (
            <View className="mt-5 rounded-2xl border border-[#F4EFF8] bg-white p-4">
              <Text className="text-[15px] font-extrabold text-[#2B2233]">
                Hoàn tất thanh toán
              </Text>
              <Text className="mt-2 text-[13px] text-[#8E869A]">
                Mở trang thanh toán an toàn để hoàn tất. Nếu trình duyệt không mở được, hãy quét mã QR bên dưới.
              </Text>
              <Pressable
                onPress={() => openBankPayment()}
                style={{
                  backgroundColor: "#A50064",
                  borderRadius: 12,
                  marginTop: 16,
                  paddingHorizontal: 16,
                  paddingVertical: 12,
                }}
              >
                <Text className="text-center text-[13px] font-extrabold text-white">
                  Mở trang thanh toán
                </Text>
              </Pressable>
              {qrImageUri ? (
                <View className="mt-4 items-center rounded-2xl bg-[#F8F2FA] p-4">
                  <Image source={{ uri: qrImageUri }} className="h-56 w-56 rounded-xl" resizeMode="contain" />
                  <Text className="mt-3 text-center text-[12px] text-[#8E869A]">
                    Quét mã bằng ứng dụng ngân hàng hoặc ví hỗ trợ VietQR.
                  </Text>
                </View>
              ) : null}
            </View>
          ) : null}
            </>
          ) : null}
        </View>

        <CoordinateMapPickerModal
          latitude={latitude}
          longitude={longitude}
          onApply={handleApplyMapCoordinate}
          onClose={() => setIsCoordinateMapVisible(false)}
          visible={isCoordinateMapVisible}
        />
      </ScrollView>
    </SafeAreaView>
  );
}