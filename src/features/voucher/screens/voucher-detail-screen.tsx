import { useEffect, useState, type ComponentProps } from "react";
import { LinearGradient } from "expo-linear-gradient";
import { Image } from "expo-image";
import { useLocalSearchParams, useRouter } from "expo-router";
import {
  ActivityIndicator,
  Pressable,
  ScrollView,
  Share,
  Text as RNText,
  View,
} from "react-native";
import { SafeAreaView, useSafeAreaInsets } from "react-native-safe-area-context";

import { appAlert } from "@/components/ui/app-dialog";
import { AppLoadingScreen } from "@/components/ui/app-loading-screen";
import { SymbolView } from "@/components/ui/symbol-view";
import { ScreenHorizontalPadding } from "@/constants/theme";
import {
  getValidAccessToken,
  useAuthSession,
} from "@/features/auth/hooks/use-auth-session";
import { bodyLineHeightFor, lineHeightFor, textStyle } from "@/lib/text-scale";
import {
  getVoucherById,
  getVoucherRedeemCode,
  redeemVoucher,
  type Voucher,
  type VoucherUsage,
} from "../api/voucher-api";

const detailVoucherHero = require("../../../../assets/images/detailvoucher.png");
const voucherConditionDecoration = require("../../../../assets/images/apdung.png");
const voucherDescriptionDecoration = require("../../../../assets/images/mota.png");

const detailTextMaxFontSizeMultiplier = 1.05;
const screenBackground = "#FFF7FA";
const cardBackground = "#FFFFFF";
const heroShadow = {
  shadowColor: "#F28DB5",
  shadowOffset: { width: 0, height: 18 },
  shadowOpacity: 0.18,
  shadowRadius: 30,
  elevation: 12,
} as const;

const sectionEyebrowTextStyle = (fontSize: number) => ({
  color: "#FF5A8D",
  lineHeight: lineHeightFor(fontSize),
});
const sectionTitleTextStyle = (fontSize: number) => ({
  color: "#351A2C",
  lineHeight: lineHeightFor(fontSize),
});
const sectionBodyTextStyle = (fontSize: number) => ({
  color: "#6E5264",
  lineHeight: bodyLineHeightFor(fontSize),
});

type TextProps = ComponentProps<typeof RNText>;

type DetailInfoItem = {
  icon: ComponentProps<typeof SymbolView>["name"];
  label: string;
  value: string;
  accent?: string;
};

function Text({
  maxFontSizeMultiplier = detailTextMaxFontSizeMultiplier,
  style,
  ...props
}: TextProps) {
  return (
    <RNText
      maxFontSizeMultiplier={maxFontSizeMultiplier}
      style={[{ includeFontPadding: false }, style]}
      {...props}
    />
  );
}

function formatCurrency(value?: number | null) {
  if (!value) {
    return null;
  }

  return `${Number(value).toLocaleString("vi-VN")}đ`;
}

function formatDate(value?: string | null) {
  if (!value) {
    return "Đang cập nhật";
  }

  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) {
    return "Đang cập nhật";
  }

  return parsed.toLocaleDateString("vi-VN");
}

function getDiscountBadge(voucher: Voucher) {
  if (voucher.discountType === "PERCENTAGE") {
    return `-${voucher.discountValue}%`;
  }

  return `-${Number(voucher.discountValue).toLocaleString("vi-VN")}đ`;
}

function getDiscountSummary(voucher: Voucher) {
  if (voucher.discountType === "PERCENTAGE") {
    return `Giảm ${voucher.discountValue}%`;
  }

  return `Giảm ${Number(voucher.discountValue).toLocaleString("vi-VN")}đ`;
}

function getVoucherStatusLabel(status: Voucher["status"]) {
  switch (status) {
    case "ACTIVE":
      return "Đang hoạt động";
    case "PENDING":
      return "Sắp mở";
    case "INACTIVE":
      return "Tạm ngưng";
    case "EXPIRED":
      return "Đã hết hạn";
    case "DELETED":
      return "Đã gỡ";
    default:
      return status || "Đang cập nhật";
  }
}

function buildConditionItems(voucher: Voucher) {
  const items: string[] = [];

  items.push(`Trạng thái voucher: ${getVoucherStatusLabel(voucher.status)}.`);

  if (voucher.startDate || voucher.endDate) {
    items.push(
      `Hiệu lực từ ${formatDate(voucher.startDate)} đến ${formatDate(voucher.endDate)}.`,
    );
  }

  if (voucher.minOrderAmount && voucher.minOrderAmount > 0) {
    items.push(
      `Áp dụng cho đơn từ ${formatCurrency(voucher.minOrderAmount)} trở lên.`,
    );
  }

  if (voucher.maxDiscountAmount && voucher.maxDiscountAmount > 0) {
    items.push(`Mức ưu đãi tối đa ${formatCurrency(voucher.maxDiscountAmount)}.`);
  }

  if (voucher.quantityTotal > 0) {
    items.push(
      `Số lượng phát hành: ${voucher.quantityTotal.toLocaleString("vi-VN")} voucher.`,
    );
  }

  return items;
}

function buildInfoItems(voucher: Voucher): DetailInfoItem[] {
  const quantityRemaining =
    voucher.quantityRemaining > 0
      ? `Còn ${voucher.quantityRemaining}`
      : "Đã hết";

  return [
    {
      icon: {
        ios: "gift.fill",
        android: "card_giftcard",
        web: "card_giftcard",
      },
      label: "Giá trị ưu đãi",
      value: getDiscountSummary(voucher),
      accent: "#FF4F8E",
    },
    {
      icon: {
        ios: "calendar",
        android: "calendar_today",
        web: "calendar_today",
      },
      label: "Hạn sử dụng",
      value: formatDate(voucher.endDate),
    },
    {
      icon: {
        ios: "location.fill",
        android: "location_on",
        web: "location_on",
      },
      label: "Đối tác áp dụng",
      value: voucher.partnerName,
    },
    {
      icon: {
        ios: "ticket.fill",
        android: "confirmation_number",
        web: "confirmation_number",
      },
      label: "Số lượng còn lại",
      value: quantityRemaining,
      accent: voucher.quantityRemaining > 0 ? "#FF4F8E" : "#B596A7",
    },
  ];
}

export default function VoucherDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const voucherId = Number(id);
  const hasValidVoucherId = Number.isFinite(voucherId);
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const authSession = useAuthSession();
  const [voucher, setVoucher] = useState<Voucher | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [redeeming, setRedeeming] = useState(false);
  const [usage, setUsage] = useState<VoucherUsage | null>(null);

  const goToLogin = () => {
    router.push("/login?entry=home");
  };

  useEffect(() => {
    if (!hasValidVoucherId) {
      return;
    }

    let cancelled = false;

    void (async () => {
      if (!cancelled) {
        setLoading(true);
        setError(null);
      }

      try {
        const token = authSession.isAuthenticated
          ? await getValidAccessToken()
          : null;
        const result = await getVoucherById(voucherId, token);

        if (!cancelled) {
          setVoucher(result);
        }
      } catch (e) {
        if (!cancelled) {
          setError(
            e instanceof Error ? e.message : "Không tải được thông tin voucher.",
          );
        }
      } finally {
        if (!cancelled) {
          setLoading(false);
        }
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [authSession.isAuthenticated, hasValidVoucherId, voucherId]);

  const handleRedeem = () => {
    if (!voucher) {
      return;
    }

    if (!authSession.isAuthenticated) {
      goToLogin();
      return;
    }

    appAlert.alert(
      "Xác nhận đổi voucher",
      `Bạn sẽ dùng ${voucher.pointsRequired.toLocaleString("vi-VN")} điểm để đổi voucher này.`,
      [
        { text: "Hủy", style: "cancel" },
        {
          text: "Đổi ngay",
          onPress: async () => {
            setRedeeming(true);

            try {
              const token = await getValidAccessToken();
              if (!token) {
                return;
              }

              const result = await redeemVoucher(voucher.voucherId, token);
              setUsage(result);
              setVoucher((current) =>
                current
                  ? {
                      ...current,
                      quantityRemaining: Math.max(
                        0,
                        current.quantityRemaining - 1,
                      ),
                    }
                  : current,
              );
            } catch (e) {
              appAlert.alert(
                "Không thể đổi voucher",
                e instanceof Error ? e.message : "Vui lòng thử lại.",
              );
            } finally {
              setRedeeming(false);
            }
          },
        },
      ],
    );
  };

  const handleSaveVoucher = () => {
    if (usage) {
      router.push("/vouchers/my");
      return;
    }

    appAlert.alert(
      "Chưa thể lưu riêng",
      "Hiện tại bạn có thể đổi voucher ngay để lưu trong mục “Voucher của tôi”.",
    );
  };

  const handleShareVoucher = async () => {
    if (!voucher) {
      return;
    }

    try {
      await Share.share({
        message: `${voucher.voucherName}\n${getDiscountSummary(voucher)} từ ${voucher.partnerName}\nĐổi với ${voucher.pointsRequired.toLocaleString("vi-VN")} điểm.`,
      });
    } catch (e) {
      appAlert.alert(
        "Không thể chia sẻ",
        e instanceof Error ? e.message : "Vui lòng thử lại sau.",
      );
    }
  };

  if (hasValidVoucherId && loading) {
    return <AppLoadingScreen />;
  }

  if (!hasValidVoucherId || error || !voucher) {
    return (
      <SafeAreaView
        className="flex-1"
        edges={["left", "right", "bottom"]}
        style={{
          backgroundColor: screenBackground,
          paddingHorizontal: ScreenHorizontalPadding,
        }}
      >
        <View style={{ paddingTop: insets.top + 10 }}>
          <Pressable
            className="h-11 w-11 items-center justify-center rounded-full border border-[#FFD7E6] bg-white"
            onPress={() => router.back()}
            style={heroShadow}
          >
            <SymbolView
              name={{
                ios: "chevron.left",
                android: "arrow_back",
                web: "arrow_back",
              }}
              size={19}
              tintColor="#A83E6C"
            />
          </Pressable>
        </View>
        <View className="flex-1 items-center justify-center">
          <Text
            className="text-center text-[18px] font-semibold text-[#351A2C]"
            style={sectionTitleTextStyle(18)}
          >
            Không tải được voucher
          </Text>
          <Text
            className="mt-2 text-center text-[14px] font-normal text-[#6E5264]"
            style={sectionBodyTextStyle(14)}
          >
            {error ?? "Voucher không tồn tại hoặc đã ngừng hoạt động."}
          </Text>
        </View>
      </SafeAreaView>
    );
  }

  const infoItems = buildInfoItems(voucher);
  const conditionItems = buildConditionItems(voucher);
  const description = voucher.description?.replace(/\s+/g, " ").trim() ?? "";
  const hasDescription = description.length > 0;
  const heroDescription =
    description.length > 78 ? `${description.slice(0, 75).trim()}...` : description;
  const descriptionPreview =
    description.length > 160 ? `${description.slice(0, 157).trim()}...` : description;

  const primaryButtonLabel = usage
    ? "Đã đổi voucher"
    : voucher.quantityRemaining <= 0
      ? "Voucher đã hết"
      : !authSession.isAuthenticated
        ? "Đăng nhập để đổi"
        : "Đổi ngay";

  return (
    <SafeAreaView
      className="flex-1"
      edges={["left", "right", "bottom"]}
      style={{ backgroundColor: screenBackground }}
    >
      <LinearGradient
        colors={["#FFFFFF", "#FFF5F8", "#FFF6FA"]}
        start={{ x: 0.5, y: 0 }}
        end={{ x: 0.5, y: 1 }}
        className="absolute inset-0"
      />

      <ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={{
          paddingBottom: 154,
          paddingHorizontal: ScreenHorizontalPadding,
          paddingTop: insets.top + 10,
        }}
      >
        <View className="flex-row items-center justify-between">
          <View className="flex-row items-center gap-3">
            <Pressable
              className="h-11 w-11 items-center justify-center rounded-full border border-[#FFD7E6] bg-white"
              onPress={() => router.back()}
              style={heroShadow}
            >
              <SymbolView
                name={{
                  ios: "chevron.left",
                  android: "arrow_back",
                  web: "arrow_back",
                }}
                size={19}
                tintColor="#A83E6C"
              />
            </Pressable>
            <Text
              className="text-[14px] font-medium uppercase tracking-[0.8px] text-[#FF5A8D]"
              style={sectionEyebrowTextStyle(14)}
            >
              Ưu đãi từ đối tác
            </Text>
          </View>

          <View className="flex-row gap-3">
            <Pressable
              className="h-11 w-11 items-center justify-center rounded-full border border-[#FFD7E6] bg-white"
              onPress={handleShareVoucher}
              style={heroShadow}
            >
              <SymbolView
                name={{
                  ios: "square.and.arrow.up",
                  android: "share",
                  web: "share",
                }}
                size={18}
                tintColor="#A83E6C"
              />
            </Pressable>
            <Pressable
              className="h-11 w-11 items-center justify-center rounded-full border border-[#FFD7E6] bg-white"
              onPress={handleSaveVoucher}
              style={heroShadow}
            >
              <SymbolView
                name={{
                  ios: "heart",
                  android: "favorite_border",
                  web: "favorite_border",
                }}
                size={18}
                tintColor="#A83E6C"
              />
            </Pressable>
          </View>
        </View>

        <View className="mt-4">
          <View
            className="overflow-hidden rounded-[28px] border border-[#FFE2EC]"
            style={[heroShadow, { backgroundColor: cardBackground }]}
          >
            <LinearGradient
              colors={["#FFF8FB", "#FFEAF1", "#FFE3EC"]}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 1 }}
              className="relative px-4 pb-16 pt-3"
            >
              <View className="flex-row items-start justify-between">
                <View className="rounded-full border border-[#FFBDD3] bg-[#FF6A9D] px-4 py-2">
                  <Text
                    className="text-[16px] font-semibold text-white"
                    style={{ color: "#FFFFFF", ...textStyle(16) }}
                  >
                    {getDiscountBadge(voucher)}
                  </Text>
                </View>
                <View className="rounded-full border border-[#FFE6EF] bg-white/95 px-3 py-2">
                  <View className="flex-row items-center gap-1.5">
                    <SymbolView
                      name={{
                        ios: "star.fill",
                        android: "stars",
                        web: "stars",
                      }}
                      size={12}
                      tintColor="#FFB43A"
                    />
                    <Text
                      className="text-[13px] font-medium text-[#B56A86]"
                      style={{ color: "#B56A86", ...textStyle(13) }}
                    >
                      {voucher.pointsRequired.toLocaleString("vi-VN")} điểm
                    </Text>
                  </View>
                </View>
              </View>

              <View className="relative mt-2 h-48 overflow-hidden rounded-[24px]">
                <LinearGradient
                  colors={["#FFF5F9", "#FFE7F0"]}
                  start={{ x: 0, y: 0 }}
                  end={{ x: 1, y: 1 }}
                  className="absolute inset-0"
                />
                <Image
                  source={detailVoucherHero}
                  style={{
                    position: "absolute",
                    left: -18,
                    right: -18,
                    top: -2,
                    bottom: 14,
                    opacity: 0.16,
                  }}
                  contentFit="cover"
                />
                <Image
                  source={detailVoucherHero}
                  style={{
                    position: "absolute",
                    left: 18,
                    right: 18,
                    top: -6,
                    height: 198,
                  }}
                  contentFit="contain"
                />
              </View>
            </LinearGradient>

            <View
              className="mx-4 -mt-12 mb-4 rounded-[22px] border border-[#FFE7EF] bg-white px-4 py-3"
              style={{
                shadowColor: "#F2A4BE",
                shadowOffset: { width: 0, height: 10 },
                shadowOpacity: 0.16,
                shadowRadius: 24,
                elevation: 6,
              }}
            >
              <Text
                numberOfLines={1}
                className="text-[16px] font-semibold text-[#351A2C]"
                style={sectionTitleTextStyle(16)}
              >
                {voucher.voucherName}
              </Text>
              <View className="mt-2 self-start rounded-full bg-[#FFF3F7] px-2.5 py-1">
                <View className="flex-row items-center gap-1.5">
                  <SymbolView
                    name={{
                      ios: "building.2.fill",
                      android: "storefront",
                      web: "storefront",
                    }}
                    size={12}
                    tintColor="#D85B88"
                  />
                  <Text
                    className="text-[11px] font-semibold uppercase text-[#B56A86]"
                    style={{ color: "#B56A86", ...textStyle(11) }}
                  >
                    {voucher.partnerName}
                  </Text>
                </View>
              </View>
              {hasDescription ? (
                <Text
                  className="mt-2 text-[13px] font-normal text-[#7B6171]"
                  style={sectionBodyTextStyle(13)}
                >
                  {heroDescription}
                </Text>
              ) : null}
            </View>
          </View>

          <View className="-mt-1 rounded-t-[30px] bg-[#FFF8FB] pt-3">
            <View
              className="rounded-[24px] border border-[#FFE3EC] bg-white px-3 py-2"
              style={heroShadow}
            >
              {infoItems.map((item, index) => (
                <View key={item.label}>
                  <View className="flex-row items-center gap-3 px-2 py-3">
                    <View className="h-9 w-9 items-center justify-center rounded-full bg-[#FFF1F6]">
                      <SymbolView name={item.icon} size={16} tintColor="#FF5A8D" />
                    </View>
                    <Text
                      className="flex-1 text-[14px] font-normal text-[#6E5264]"
                      style={sectionBodyTextStyle(14)}
                    >
                      {item.label}
                    </Text>
                    <Text
                      className="text-right text-[15px] font-semibold text-[#351A2C]"
                      style={{
                        color: item.accent ?? "#351A2C",
                        ...textStyle(15),
                      }}
                    >
                      {item.value}
                    </Text>
                  </View>
                  {index < infoItems.length - 1 ? (
                    <View className="mx-2 h-px bg-[#F6E7EE]" />
                  ) : null}
                </View>
              ))}
            </View>

            <View
              className="relative mt-4 overflow-hidden rounded-[24px] border border-[#FFE3EC] bg-white px-4 py-4"
              style={heroShadow}
            >
              <Image
                source={voucherConditionDecoration}
                style={{
                  position: "absolute",
                  right: 8,
                  bottom: 6,
                  width: 132,
                  height: 132,
                  opacity: 0.18,
                }}
                contentFit="contain"
              />
              <View className="flex-row items-start justify-between gap-4">
                <View className="flex-1">
                  <Text
                    className="text-[17px] font-semibold text-[#351A2C]"
                    style={sectionTitleTextStyle(17)}
                  >
                    Điều kiện áp dụng
                  </Text>
                  <View className="mt-3 gap-2.5">
                    {conditionItems.map((item) => (
                      <View key={item} className="flex-row items-start gap-2.5">
                        <View className="mt-1.5 h-4 w-4 items-center justify-center rounded-full bg-[#FFF1F6]">
                          <SymbolView
                            name={{
                              ios: "checkmark",
                              android: "check",
                              web: "check",
                            }}
                            size={11}
                            tintColor="#FF5A8D"
                          />
                        </View>
                        <Text
                          className="flex-1 text-[13px] font-normal text-[#6E5264]"
                          style={sectionBodyTextStyle(13)}
                        >
                          {item}
                        </Text>
                      </View>
                    ))}
                  </View>
                </View>
              </View>
            </View>

            {hasDescription ? (
              <View
                className="relative mt-4 overflow-hidden rounded-[24px] border border-[#FFE3EC] bg-white px-4 py-4"
                style={heroShadow}
              >
                <Image
                  source={voucherDescriptionDecoration}
                  style={{
                    position: "absolute",
                    right: 6,
                    bottom: 4,
                    width: 184,
                    height: 184,
                    opacity: 0.16,
                  }}
                  contentFit="contain"
                />
                <View className="flex-row items-start justify-between gap-4">
                  <View className="flex-1">
                    <Text
                      className="text-[17px] font-semibold text-[#351A2C]"
                      style={sectionTitleTextStyle(17)}
                    >
                      Mô tả
                    </Text>
                    <Text
                      className="mt-3 text-[13px] font-normal text-[#6E5264]"
                      style={sectionBodyTextStyle(13)}
                    >
                      {descriptionPreview}
                    </Text>
                  </View>
                </View>
              </View>
            ) : null}

            {usage ? (
              <View
                className="mt-4 rounded-[24px] border border-[#D7EEDB] bg-[#F5FFF6] px-4 py-4"
                style={{
                  shadowColor: "#72C283",
                  shadowOffset: { width: 0, height: 10 },
                  shadowOpacity: 0.12,
                  shadowRadius: 24,
                  elevation: 6,
                }}
              >
                <Text
                  className="text-[16px] font-semibold text-[#238A4D]"
                  style={{ color: "#238A4D", lineHeight: lineHeightFor(16) }}
                >
                  Đổi voucher thành công
                </Text>
                <Text
                  className="mt-2 text-[12px] font-medium text-[#4F7B5D]"
                  style={{ color: "#4F7B5D", lineHeight: lineHeightFor(12) }}
                >
                  Mã sử dụng của bạn
                </Text>
                <Text
                  selectable
                  className="mt-1 text-[22px] font-semibold tracking-[2.4px] text-[#176C3B]"
                  style={{ color: "#176C3B", lineHeight: lineHeightFor(22) }}
                >
                  {getVoucherRedeemCode(usage)}
                </Text>
                <Text
                  className="mt-2 text-[13px] font-normal text-[#4F7B5D]"
                  style={{ color: "#4F7B5D", lineHeight: bodyLineHeightFor(13) }}
                >
                  Xuất trình mã này cho đối tác khi sử dụng voucher.
                </Text>
              </View>
            ) : null}
          </View>
        </View>
      </ScrollView>

      <View
        className="absolute bottom-0 left-0 right-0 border-t border-[#F3DDE6] bg-white/95 pt-3"
        style={{
          paddingBottom: Math.max(insets.bottom, 14),
          paddingHorizontal: ScreenHorizontalPadding,
        }}
      >
        <View className="flex-row gap-3">
          <Pressable
            className="h-14 flex-1 flex-row items-center justify-center gap-2 rounded-[18px] border border-[#FFBDD3] bg-white"
            onPress={handleSaveVoucher}
          >
            <SymbolView
              name={{
                ios: "bookmark",
                android: "bookmark-border",
                web: "bookmark-border",
              }}
              size={18}
              tintColor="#FF4F8E"
            />
            <Text
              className="text-[14px] font-medium text-[#FF4F8E]"
              style={{ color: "#FF4F8E", ...textStyle(14) }}
            >
              {usage ? "Voucher của tôi" : "Lưu voucher"}
            </Text>
          </Pressable>

          <Pressable
            disabled={redeeming || !!usage || voucher.quantityRemaining <= 0}
            className={`h-14 flex-[1.25] overflow-hidden rounded-[18px] ${
              redeeming || usage || voucher.quantityRemaining <= 0 ? "opacity-70" : ""
            }`}
            onPress={handleRedeem}
          >
            <LinearGradient
              colors={
                usage || voucher.quantityRemaining <= 0
                  ? ["#D9CDD4", "#CFC2CA"]
                  : ["#FF79AB", "#FF4F8E"]
              }
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 1 }}
              className="h-full flex-row items-center justify-center gap-2"
            >
              {redeeming ? (
                <ActivityIndicator color="white" />
              ) : (
                <>
                  <SymbolView
                    name={{
                      ios: "gift.fill",
                      android: "redeem",
                      web: "redeem",
                    }}
                    size={18}
                    tintColor="#FFFFFF"
                  />
                  <Text
                    className="text-[15px] font-semibold text-white"
                    style={{ color: "#FFFFFF", ...textStyle(15) }}
                  >
                    {primaryButtonLabel}
                  </Text>
                </>
              )}
            </LinearGradient>
          </Pressable>
        </View>
      </View>
    </SafeAreaView>
  );
}
