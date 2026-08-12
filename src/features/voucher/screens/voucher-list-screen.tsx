import {
  useCallback,
  useEffect,
  useMemo,
  useState,
  type ComponentProps,
} from "react";
import { StatusBar } from "expo-status-bar";
import { LinearGradient } from "expo-linear-gradient";
import {
  Platform,
  Pressable,
  RefreshControl,
  ScrollView,
  Text as RNText,
  TextInput,
  View,
} from "react-native";
import { SafeAreaView, useSafeAreaInsets } from "react-native-safe-area-context";
import { useRouter } from "expo-router";
import { Image } from "expo-image";

import { AppLoadingScreen } from "@/components/ui/app-loading-screen";
import { SymbolView } from "@/components/ui/symbol-view";
import { ScreenHorizontalPadding } from "@/constants/theme";
import {
  getValidAccessToken,
  useAuthSession,
} from "@/features/auth/hooks/use-auth-session";
import { lineHeightFor, textStyle } from "@/lib/text-scale";
import {
  filterVouchersByKeyword,
  getAvailableVouchers,
  getVoucherImage,
  groupVouchersByPartner,
  type Voucher,
} from "../api/voucher-api";
import { NearbyVoucherSection } from "../components/nearby-voucher-section";
import type { NearbyVoucherAnchor } from "../hooks/use-nearby-vouchers";

/** Hằng ngoài component để `useNearbyVouchers` không phải chạy lại mỗi render. */
const currentLocationAnchor: NearbyVoucherAnchor = { kind: "current-location" };
const detailTextMaxFontSizeMultiplier = 1.05;
const screenBackground = "#FFFFFF";
const headerBackdrop = "#E8D9CF";
const panelBackground = "#FFFFFF";
const heroGiftImage = require("../../../../assets/images/gift.png");

const sheetShadowStyle = {
  shadowColor: "rgba(235, 72, 155, 0.10)",
  shadowOpacity: 1,
  shadowRadius: 18,
  shadowOffset: {
    width: 0,
    height: -6,
  },
  elevation: Platform.OS === "android" ? 12 : 6,
} as const;

const cardShadowStyle = {
  shadowColor: "rgba(235, 72, 155, 0.08)",
  shadowOpacity: 1,
  shadowRadius: 14,
  shadowOffset: {
    width: 0,
    height: 10,
  },
  elevation: 4,
} as const;

const sectionEyebrowTextStyle = (fontSize: number) => ({
  color: "#7A6F67",
  lineHeight: lineHeightFor(fontSize),
});

const sectionTitleTextStyle = (fontSize: number) => ({
  color: "#2B2233",
  lineHeight: lineHeightFor(fontSize),
});

const sectionTightBodyTextStyle = (fontSize: number) => ({
  color: "#6F657A",
  lineHeight: lineHeightFor(fontSize),
});

const sectionCaptionTextStyle = (fontSize: number) => ({
  color: "#7A6F67",
  lineHeight: lineHeightFor(fontSize),
});

type TextProps = ComponentProps<typeof RNText>;

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

function discountLabel(voucher: Voucher) {
  return voucher.discountType === "PERCENTAGE"
    ? `Giảm ${voucher.discountValue}%`
    : `Giảm ${Number(voucher.discountValue).toLocaleString("vi-VN")}đ`;
}

export default function VoucherListScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const authSession = useAuthSession();
  const [items, setItems] = useState<Voucher[]>([]);
  const [search, setSearch] = useState("");
  const [partnerId, setPartnerId] = useState<number | null>(null);
  const [loading, setLoading] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const goToLogin = () => {
    router.push("/login?entry=home");
  };

  const partnerGroups = useMemo(() => groupVouchersByPartner(items), [items]);
  const selectedPartnerName = useMemo(
    () =>
      partnerId === null
        ? null
        : partnerGroups.find((group) => group.partnerId === partnerId)
            ?.partnerName ?? null,
    [partnerGroups, partnerId],
  );

  const visibleItems = useMemo(
    () =>
      partnerId === null
        ? items
        : items.filter((voucher) => voucher.partnerId === partnerId),
    [items, partnerId],
  );

  const load = useCallback(
    async (keyword: string, refresh = false) => {
      if (refresh) {
        setRefreshing(true);
      } else {
        setLoading(true);
      }
      setError(null);

      try {
        // `GET /api/vouchers/**` là public nên khách chưa đăng nhập vẫn xem
        // được danh sách; token chỉ đính kèm khi đã đăng nhập.
        const token = authSession.isAuthenticated
          ? await getValidAccessToken()
          : null;

        const page = await getAvailableVouchers(
          { search: keyword, size: 50 },
          token,
        );
        // Backend `/available` chưa lọc theo từ khoá nên phải lọc lại ở client.
        const nextItems = filterVouchersByKeyword(page.content ?? [], keyword);
        setItems(nextItems);
        // Giữ nguyên quán đang chọn nếu quán đó vẫn còn voucher.
        setPartnerId((current) =>
          current !== null &&
          nextItems.some((voucher) => voucher.partnerId === current)
            ? current
            : null,
        );
      } catch (e) {
        setError(e instanceof Error ? e.message : "Không thể tải voucher.");
      } finally {
        setLoading(false);
        setRefreshing(false);
      }
    },
    [authSession.isAuthenticated],
  );

  useEffect(() => {
    const timeoutId = setTimeout(() => {
      void load("");
    }, 0);

    return () => clearTimeout(timeoutId);
  }, [load]);

  if (loading) {
    return <AppLoadingScreen spinnerColor="#D93682" />;
  }

  return (
    <View className="flex-1" style={{ backgroundColor: screenBackground }}>
      <StatusBar style="dark" />
      <SafeAreaView className="flex-1" edges={["left", "right", "bottom"]}>
        <View
          style={{
            backgroundColor: headerBackdrop,
            overflow: "hidden",
            paddingBottom: 56,
            paddingTop: insets.top + 8,
          }}
        >
          <LinearGradient
            colors={["#F6EFEA", "#E8D9CF", "#D8C1B1"]}
            end={{ x: 1, y: 1 }}
            start={{ x: 0, y: 0 }}
            style={{
              bottom: 0,
              left: 0,
              position: "absolute",
              right: 0,
              top: 0,
            }}
          />
          <View
            pointerEvents="none"
            style={{
              bottom: -18,
              opacity: 0.24,
              position: "absolute",
              right: -28,
            }}
          >
            <Image
              source={heroGiftImage}
              style={{ height: 204, width: 204 }}
              contentFit="contain"
            />
          </View>
          <View
            pointerEvents="none"
            style={{
              backgroundColor: "rgba(255, 255, 255, 0.32)",
              borderRadius: 999,
              height: 132,
              left: -34,
              position: "absolute",
              top: 92,
              width: 132,
            }}
          />
          <View
            pointerEvents="none"
            style={{
              backgroundColor: "rgba(255, 255, 255, 0.18)",
              borderRadius: 999,
              height: 88,
              position: "absolute",
              right: 118,
              top: 34,
              width: 88,
            }}
          />
          <View style={{ paddingHorizontal: ScreenHorizontalPadding }}>
            <View className="flex-row items-center justify-between">
              <Pressable
                className="h-11 w-11 items-center justify-center rounded-full bg-white"
                onPress={() => router.back()}
                style={cardShadowStyle}
              >
                <SymbolView
                  name={{
                    ios: "chevron.left",
                    android: "arrow_back",
                    web: "arrow_back",
                  }}
                  size={19}
                  tintColor="#2B2233"
                />
              </Pressable>

              <View className="flex-row items-center gap-2">
                <Pressable
                  className="h-11 w-11 items-center justify-center rounded-full bg-white"
                  onPress={() => router.push("/vouchers/nearby")}
                  style={cardShadowStyle}
                >
                  <SymbolView
                    name={{
                      ios: "location.fill",
                      android: "location_on",
                      web: "location_on",
                    }}
                    size={19}
                    tintColor="#D93682"
                  />
                </Pressable>
                {authSession.isAuthenticated ? (
                  <Pressable
                    className="h-11 w-11 items-center justify-center rounded-full bg-white"
                    onPress={() => router.push("/vouchers/my")}
                    style={cardShadowStyle}
                  >
                    <SymbolView
                      name={{
                        ios: "ticket.fill",
                        android: "confirmation_number",
                        web: "confirmation_number",
                      }}
                      size={19}
                      tintColor="#D93682"
                    />
                  </Pressable>
                ) : null}
              </View>
            </View>

            <View className="mt-5 gap-1">
              <Text
                className="text-[14px] font-black uppercase tracking-[1.4px]"
                style={[sectionEyebrowTextStyle(14), { color: "#8C5742" }]}
              >
                Ưu đãi từ đối tác
              </Text>
              <Text
                className="text-[22px] font-semibold text-[#2B2233]"
                style={[sectionTitleTextStyle(22), { color: "#2F221E" }]}
              >
                Voucher ưu đãi
              </Text>
              <Text
                className="text-[13px]"
                style={[sectionTightBodyTextStyle(13), { color: "#68574E" }]}
              >
                Đổi điểm khám phá lấy ưu đãi từ đối tác.
              </Text>
            </View>
          </View>
        </View>

        <View
          className="flex-1 rounded-t-[30px] pt-5"
          style={[
            sheetShadowStyle,
            {
              backgroundColor: panelBackground,
              marginTop: -24,
            },
          ]}
        >
          <View style={{ paddingHorizontal: ScreenHorizontalPadding }}>
            <View className="rounded-[18px] border border-[#F0E6EB] bg-[#FFFCFA] px-4 py-2.5">
              <View className="flex-row items-center">
                <View className="h-8 w-8 items-center justify-center rounded-full bg-[#FFF0F6]">
                  <SymbolView
                    name={{
                      ios: "magnifyingglass",
                      android: "search",
                      web: "search",
                    }}
                    size={18}
                    tintColor="#8E869A"
                  />
                </View>
                <TextInput
                  className="ml-3 flex-1 py-0 text-[14px] text-[#2B2233]"
                  style={textStyle(14)}
                  placeholder="Tìm voucher hoặc đối tác"
                  placeholderTextColor="#AAA2B3"
                  value={search}
                  onChangeText={setSearch}
                  onSubmitEditing={() => void load(search)}
                  returnKeyType="search"
                  maxFontSizeMultiplier={detailTextMaxFontSizeMultiplier}
                />
                <Pressable
                  className="rounded-full bg-[#EB489B] px-4 py-2"
                  onPress={() => void load(search)}
                >
                  <Text
                    className="text-[12px] font-black uppercase tracking-[0.8px] text-white"
                    style={textStyle(12)}
                  >
                    Tìm
                  </Text>
                </Pressable>
              </View>
            </View>

            {partnerGroups.length > 1 ? (
              <ScrollView
                horizontal
                showsHorizontalScrollIndicator={false}
                className="mt-4"
                contentContainerStyle={{ gap: 8, paddingRight: 2 }}
              >
                <Pressable
                  className={`rounded-full border px-4 py-2.5 ${
                    partnerId === null
                      ? "border-[#EB489B] bg-[#EB489B]"
                      : "border-[#F0E6EB] bg-[#FFFCFA]"
                  }`}
                  onPress={() => setPartnerId(null)}
                >
                  <Text
                    className={`text-[12px] font-semibold ${
                      partnerId === null ? "text-white" : "text-[#6F657A]"
                    }`}
                    style={textStyle(12)}
                  >
                    Tất cả đối tác ({items.length})
                  </Text>
                </Pressable>
                {partnerGroups.map((group) => {
                  const active = group.partnerId === partnerId;
                  return (
                    <Pressable
                      key={group.partnerId}
                      className={`rounded-full border px-4 py-2.5 ${
                        active
                          ? "border-[#EB489B] bg-[#EB489B]"
                          : "border-[#F0E6EB] bg-[#FFFCFA]"
                      }`}
                      onPress={() => setPartnerId(active ? null : group.partnerId)}
                    >
                      <Text
                        className={`text-[12px] font-semibold ${
                          active ? "text-white" : "text-[#6F657A]"
                        }`}
                        style={textStyle(12)}
                        numberOfLines={1}
                      >
                        {group.partnerName} ({group.count})
                      </Text>
                    </Pressable>
                  );
                })}
              </ScrollView>
            ) : null}
          </View>

          <ScrollView
            className="mt-5 flex-1"
            contentContainerStyle={{
              paddingBottom: 30,
              paddingHorizontal: ScreenHorizontalPadding,
            }}
            refreshControl={
              <RefreshControl
                refreshing={refreshing}
                onRefresh={() => void load(search, true)}
              />
            }
          >
              {error ? (
                <Pressable
                  className="rounded-[18px] border border-[#F7D9E3] bg-[#FFF8FC] px-4 py-4"
                  onPress={() => void load(search)}
                >
                  <Text
                    className="text-[14px] font-bold text-[#C2416C]"
                    style={textStyle(14)}
                  >
                    {error}
                  </Text>
                  <Text
                    className="mt-1 text-[12px] text-[#8E5960]"
                    style={sectionCaptionTextStyle(12)}
                  >
                    Chạm để thử lại
                  </Text>
                </Pressable>
              ) : null}

              {!authSession.isAuthenticated ? (
                <Pressable
                  className="mt-4 rounded-[18px] border border-[#F2DCE6] bg-[#FFF8FC] px-4 py-4"
                  onPress={goToLogin}
                  style={cardShadowStyle}
                >
                  <View className="flex-row items-center gap-3">
                    <View className="h-10 w-10 items-center justify-center rounded-full bg-[#FFF0F6]">
                      <SymbolView
                        name={{
                          ios: "person.crop.circle.badge.plus",
                          android: "login",
                          web: "login",
                        }}
                        size={18}
                        tintColor="#EB489B"
                      />
                    </View>
                    <View className="flex-1">
                      <Text
                        className="text-[14px] font-semibold text-[#2B2233]"
                        style={textStyle(14)}
                      >
                        Đăng nhập để đổi voucher
                      </Text>
                      <Text
                        className="mt-1 text-[13px]"
                        style={sectionTightBodyTextStyle(13)}
                      >
                        Bạn đang xem ở chế độ khách, đăng nhập để dùng điểm khám
                        phá.
                      </Text>
                    </View>
                    <Text
                      className="text-[12px] font-black uppercase tracking-[0.8px] text-[#EB489B]"
                      style={textStyle(12)}
                    >
                      Đăng nhập
                    </Text>
                  </View>
                </Pressable>
              ) : null}

              {/* Neo theo vị trí hiện tại - xem `use-nearby-vouchers.ts` để biết vì
                  sao "gần tôi" phải đi vòng qua danh sách hotspot gần đó. */}
              <NearbyVoucherSection
                anchor={currentLocationAnchor}
                radiusMeters={1000}
                title="Ưu đãi quanh bạn"
                eyebrow="GẦN VỊ TRÍ HIỆN TẠI"
                emptyDescription="Chưa có đối tác nào có ưu đãi trong bán kính 1km quanh bạn."
                seeAllHref="/vouchers/nearby"
                horizontalInset={ScreenHorizontalPadding}
              />

              <View className="mt-6 gap-3">
                <View className="flex-row items-end justify-between gap-3">
                  <View className="flex-1">
                    <Text
                      className="text-[14px] font-black uppercase tracking-[1.4px]"
                      style={sectionEyebrowTextStyle(14)}
                    >
                      Danh sách voucher
                    </Text>
                    <Text
                      className="mt-1 text-[15px]"
                      style={sectionTightBodyTextStyle(15)}
                    >
                      {selectedPartnerName
                        ? `Ưu đãi hiện có từ ${selectedPartnerName}.`
                        : "Tất cả ưu đãi hiện có từ các đối tác."}
                    </Text>
                  </View>
                  <Text
                    className="text-[12px] font-semibold text-[#A39AAB]"
                    style={textStyle(12)}
                  >
                    {visibleItems.length} mục
                  </Text>
                </View>

                {!error && visibleItems.length === 0 ? (
                  <View
                    className="items-center rounded-[20px] bg-[#FFFCFA] px-6 py-10"
                    style={cardShadowStyle}
                  >
                    <View className="h-14 w-14 items-center justify-center rounded-full bg-[#FFF0F6]">
                      <SymbolView
                        name={{
                          ios: "ticket.fill",
                          android: "confirmation_number",
                          web: "confirmation_number",
                        }}
                        size={24}
                        tintColor="#EB489B"
                      />
                    </View>
                    <Text
                      className="mt-4 text-center text-[18px] font-semibold text-[#2B2233]"
                      style={{ color: "#2B2233", lineHeight: lineHeightFor(18) }}
                    >
                      Chưa có voucher phù hợp
                    </Text>
                    <Text
                      className="mt-2 text-center text-[14px]"
                      style={sectionTightBodyTextStyle(14)}
                    >
                      Thử từ khóa khác hoặc quay lại sau.
                    </Text>
                  </View>
                ) : null}

                <View className="gap-3">
                  {visibleItems.map((voucher) => {
                    const image = getVoucherImage(voucher);
                    return (
                      <Pressable
                        key={voucher.voucherId}
                        className="rounded-[20px] border border-[#F2E8EC] bg-[#FFFCFA] px-3 py-2.5"
                        style={cardShadowStyle}
                        onPress={() => router.push(`/vouchers/${voucher.voucherId}`)}
                      >
                        <View className="flex-row gap-2.5">
                          <View className="h-20 w-20 overflow-hidden rounded-[16px] bg-[#FFF0F7]">
                            {image ? (
                              <Image
                                source={{ uri: image }}
                                style={{ width: "100%", height: "100%" }}
                                contentFit="cover"
                              />
                            ) : (
                              <View className="flex-1 items-center justify-center">
                                <SymbolView
                                  name={{
                                    ios: "ticket.fill",
                                    android: "confirmation_number",
                                    web: "confirmation_number",
                                  }}
                                  size={30}
                                  tintColor="#EB489B"
                                />
                              </View>
                            )}
                          </View>

                          <View className="flex-1">
                            <Text
                              className="text-[12px] font-black uppercase tracking-[1px] text-[#8FA6BA]"
                              style={{ lineHeight: lineHeightFor(12) }}
                              numberOfLines={1}
                            >
                              {voucher.partnerName}
                            </Text>
                            <Text
                              className="mt-1 text-[16px] font-semibold text-[#2B2233]"
                              style={{ color: "#2B2233", lineHeight: lineHeightFor(16) }}
                              numberOfLines={2}
                            >
                              {voucher.voucherName}
                            </Text>

                            <View className="mt-2 flex-row flex-wrap gap-1.5">
                              <View className="rounded-full bg-[#F2EFF3] px-3 py-1">
                                <Text
                                  className="text-[12px] font-semibold text-[#5F5568]"
                                  style={textStyle(12)}
                                >
                                  {discountLabel(voucher)}
                                </Text>
                              </View>
                              <View className="rounded-full bg-[#F2EFF3] px-3 py-1">
                                <Text
                                  className="text-[12px] font-semibold text-[#5F5568]"
                                  style={textStyle(12)}
                                >
                                  {voucher.pointsRequired.toLocaleString("vi-VN")} điểm
                                </Text>
                              </View>
                            </View>

                            <View className="mt-2 flex-row items-center justify-between">
                              <Text
                                className="text-[12px] text-[#7A6F67]"
                                style={sectionCaptionTextStyle(12)}
                              >
                                Còn {voucher.quantityRemaining}
                              </Text>
                              <View className="flex-row items-center gap-1">
                                <Text
                                  className="text-[12px] font-semibold text-[#EB489B]"
                                  style={textStyle(12)}
                                >
                                  Xem chi tiết
                                </Text>
                                <SymbolView
                                  name={{
                                    ios: "chevron.right",
                                    android: "chevron_right",
                                    web: "chevron_right",
                                  }}
                                  size={15}
                                  tintColor="#EB489B"
                                />
                              </View>
                            </View>
                          </View>
                        </View>
                      </Pressable>
                    );
                  })}
                </View>
              </View>
          </ScrollView>
        </View>
      </SafeAreaView>
    </View>
  );
}
