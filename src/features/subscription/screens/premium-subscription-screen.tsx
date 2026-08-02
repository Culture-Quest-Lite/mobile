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
  View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

import { SymbolView } from "@/components/ui/symbol-view";
import { getValidAccessToken } from "@/features/auth/hooks/use-auth-session";
import {
  type BillingCycle,
  type PremiumPaymentInitResponse,
  type PremiumPlan,
  type PremiumSubscriptionRecord,
  getMyPremiumSubscriptions,
  getPremiumPlans,
  subscribePremium,
} from "../api/premium-subscription-api";

const PAYOS_REDIRECT_URL = "culturequest://premium-subscription/payment-result";

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
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const selectedAmount = useMemo(
    () => (selectedPlan ? getPlanPrice(selectedPlan, billingCycle) : null),
    [selectedPlan, billingCycle],
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

  async function handleRefresh() {
    setIsRefreshing(true);
    try {
      await loadData();
    } catch (err) {
      setErrorMessage(
        err instanceof Error ? err.message : "Không tải được dữ liệu.",
      );
    } finally {
      setIsRefreshing(false);
    }
  }


  useEffect(() => {
    const subscription = Linking.addEventListener("url", ({ url }) => {
      if (url.startsWith(PAYOS_REDIRECT_URL)) {
        void handleRefresh();
      }
    });

    return () => subscription.remove();
  }, [loadData]);

  async function openPayOs(paymentResponse = payment) {
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
        // fallback sang QR
      }
    }
    if (paymentResponse.qrCodeUrl || paymentResponse.qrCode) {
      Alert.alert(
        "Không mở được trang thanh toán",
        "Bạn có thể quét mã QR bên dưới để thanh toán.",
      );
      return;
    }
    Alert.alert(
      "Không mở được trang thanh toán",
      "Hệ thống chưa trả liên kết hoặc mã QR để thanh toán.",
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

    try {
      const result = await subscribePremium({
        accessToken,
        subscriptionPlanId: selectedPlan.subscriptionPlanId,
        billingCycle,
        redirectUrl: PAYOS_REDIRECT_URL,
      });
      setPayment(result);
      await openPayOs(result);
    } catch (err) {
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
        <View className="bg-[#7C3AED] px-5 pb-8 pt-5">
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

        <View className="px-5 pt-5">
          {/* Error */}
          {errorMessage ? (
            <View className="mb-4 rounded-2xl border border-red-100 bg-red-50 p-4">
              <Text className="text-[13px] font-bold text-red-600">
                {errorMessage}
              </Text>
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
