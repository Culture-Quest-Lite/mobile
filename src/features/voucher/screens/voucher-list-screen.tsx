import { useCallback, useEffect, useMemo, useState } from "react";
import {
  Pressable,
  RefreshControl,
  ScrollView,
  Text,
  TextInput,
  View,
} from "react-native";
import { SafeAreaView, useSafeAreaInsets } from "react-native-safe-area-context";
import { useRouter } from "expo-router";
import { Image } from "expo-image";

import { AppLoadingScreen } from "@/components/ui/app-loading-screen";
import { SymbolView } from "@/components/ui/symbol-view";
import {
  getValidAccessToken,
  useAuthSession,
} from "@/features/auth/hooks/use-auth-session";
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

  const visibleItems = useMemo(
    () =>
      partnerId === null
        ? items
        : items.filter((voucher) => voucher.partnerId === partnerId),
    [items, partnerId],
  );

  const load = useCallback(
    async (keyword = search, refresh = false) => {
      refresh ? setRefreshing(true) : setLoading(true);
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
    [authSession.isAuthenticated, search],
  );

  useEffect(() => {
    void load("");
  }, [authSession.isAuthenticated]);

  return (
    <SafeAreaView
      className="flex-1 bg-[#FFF9F6]"
      edges={["left", "right", "bottom"]}
    >
      <View
        className="bg-white px-4 pb-4"
        style={{ paddingTop: insets.top + 10 }}
      >
        <View className="flex-row items-center gap-3">
          <Pressable
            className="h-10 w-10 items-center justify-center rounded-full bg-[#FFF0F7]"
            onPress={() => router.back()}
          >
            <SymbolView
              name={{
                ios: "chevron.left",
                android: "arrow_back",
                web: "arrow_back",
              }}
              size={19}
              tintColor="#D93682"
            />
          </Pressable>
          <View className="flex-1">
            <Text className="text-[22px] font-black text-[#2B2233]">
              Voucher ưu đãi
            </Text>
            <Text className="text-[12px] text-[#8E869A]">
              Đổi điểm khám phá lấy ưu đãi từ đối tác
            </Text>
          </View>
          <Pressable
            className="h-10 w-10 items-center justify-center rounded-full bg-[#F2F8FF]"
            onPress={() => router.push("/vouchers/nearby")}
          >
            <SymbolView
              name={{
                ios: "location.fill",
                android: "location_on",
                web: "location_on",
              }}
              size={19}
              tintColor="#1677C8"
            />
          </Pressable>
          {authSession.isAuthenticated ? (
            <Pressable
              className="h-10 w-10 items-center justify-center rounded-full bg-[#FFF0F7]"
              onPress={() => router.push("/vouchers/my")}
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

        <View className="mt-4 flex-row items-center rounded-2xl bg-[#F5F1F6] px-3">
          <SymbolView
            name={{ ios: "magnifyingglass", android: "search", web: "search" }}
            size={18}
            tintColor="#8E869A"
          />
          <TextInput
            className="flex-1 px-3 py-3 text-[14px] text-[#2B2233]"
            placeholder="Tìm voucher hoặc đối tác"
            placeholderTextColor="#AAA2B3"
            value={search}
            onChangeText={setSearch}
            onSubmitEditing={() => void load(search)}
            returnKeyType="search"
          />
          <Pressable onPress={() => void load(search)}>
            <Text className="font-bold text-[#EB489B]">Tìm</Text>
          </Pressable>
        </View>

        {partnerGroups.length > 1 ? (
          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            className="mt-3 -mx-4"
            contentContainerStyle={{ paddingHorizontal: 16, gap: 8 }}
          >
            <Pressable
              className={`rounded-full px-4 py-2 ${
                partnerId === null ? "bg-[#EB489B]" : "bg-[#F5F1F6]"
              }`}
              onPress={() => setPartnerId(null)}
            >
              <Text
                className={`text-[13px] font-bold ${
                  partnerId === null ? "text-white" : "text-[#6F6877]"
                }`}
              >
                Tất cả quán ({items.length})
              </Text>
            </Pressable>
            {partnerGroups.map((group) => {
              const active = group.partnerId === partnerId;
              return (
                <Pressable
                  key={group.partnerId}
                  className={`rounded-full px-4 py-2 ${
                    active ? "bg-[#EB489B]" : "bg-[#F5F1F6]"
                  }`}
                  onPress={() => setPartnerId(active ? null : group.partnerId)}
                >
                  <Text
                    className={`text-[13px] font-bold ${
                      active ? "text-white" : "text-[#6F6877]"
                    }`}
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

      {loading ? (
        <AppLoadingScreen mode="embedded" />
      ) : (
        <ScrollView
          className="flex-1"
          contentContainerStyle={{ padding: 16, paddingBottom: 30 }}
          refreshControl={
            <RefreshControl
              refreshing={refreshing}
              onRefresh={() => void load(search, true)}
            />
          }
        >
          {error ? (
            <Pressable
              className="rounded-2xl bg-[#FFF0F0] p-4"
              onPress={() => void load(search)}
            >
              <Text className="font-bold text-[#C0392B]">{error}</Text>
              <Text className="mt-1 text-[#8E5960]">Chạm để thử lại</Text>
            </Pressable>
          ) : null}

          {!authSession.isAuthenticated ? (
            <Pressable
              className="mb-3 flex-row items-center rounded-2xl bg-[#FFF0F7] p-4"
              onPress={goToLogin}
            >
              <View className="flex-1 pr-3">
                <Text className="text-[14px] font-black text-[#2B2233]">
                  Đăng nhập để đổi voucher
                </Text>
                <Text className="mt-1 text-[12px] text-[#8E869A]">
                  Bạn đang xem ở chế độ khách — đăng nhập để dùng điểm khám phá.
                </Text>
              </View>
              <Text className="font-bold text-[#EB489B]">Đăng nhập</Text>
            </Pressable>
          ) : null}

          {/* Neo theo vị trí hiện tại — xem `use-nearby-vouchers.ts` để biết vì
              sao "gần tôi" phải đi vòng qua danh sách hotspot gần đó. */}
          <NearbyVoucherSection
            anchor={currentLocationAnchor}
            radiusMeters={1000}
            title="Ưu đãi quanh bạn"
            eyebrow="GẦN VỊ TRÍ HIỆN TẠI"
            emptyDescription="Chưa có đối tác nào có ưu đãi trong bán kính 1km quanh bạn."
            seeAllHref="/vouchers/nearby"
            horizontalInset={16}
          />

          <View className="mt-6" />

          {!error && visibleItems.length === 0 ? (
            <View className="items-center py-20">
              <Text className="text-[18px] font-black text-[#2B2233]">
                Chưa có voucher phù hợp
              </Text>
              <Text className="mt-2 text-center text-[#8E869A]">
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
                  className="overflow-hidden rounded-[24px] bg-white"
                  style={{ elevation: 2 }}
                  onPress={() => router.push(`/vouchers/${voucher.voucherId}`)}
                >
                  <View className="flex-row p-3">
                    <View className="h-24 w-24 overflow-hidden rounded-2xl bg-[#FFF0F7]">
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
                            size={34}
                            tintColor="#EB489B"
                          />
                        </View>
                      )}
                    </View>
                    <View className="ml-3 flex-1">
                      <Text
                        className="text-[16px] font-black text-[#2B2233]"
                        numberOfLines={2}
                      >
                        {voucher.voucherName}
                      </Text>
                      <Text
                        className="mt-1 text-[12px] font-semibold text-[#8E869A]"
                        numberOfLines={1}
                      >
                        {voucher.partnerName}
                      </Text>
                      <Text className="mt-2 text-[15px] font-black text-[#F15B64]">
                        {discountLabel(voucher)}
                      </Text>
                      <View className="mt-2 flex-row items-center justify-between">
                        <Text className="text-[12px] font-bold text-[#C98A10]">
                          {voucher.pointsRequired.toLocaleString("vi-VN")} điểm
                        </Text>
                        <Text className="text-[11px] text-[#8E869A]">
                          Còn {voucher.quantityRemaining}
                        </Text>
                      </View>
                    </View>
                  </View>
                </Pressable>
              );
            })}
          </View>
        </ScrollView>
      )}
    </SafeAreaView>
  );
}
