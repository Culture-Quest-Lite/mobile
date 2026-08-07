import { useCallback, useEffect, useState } from "react";
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
  getAvailableVouchers,
  getVoucherImage,
  type Voucher,
} from "../api/voucher-api";

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
  const [loading, setLoading] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const goToLogin = () => {
    router.push("/login?entry=home");
  };

  const load = useCallback(
    async (keyword = search, refresh = false) => {
      if (!authSession.isAuthenticated) {
        setItems([]);
        setError(null);
        setLoading(false);
        setRefreshing(false);
        return;
      }

      refresh ? setRefreshing(true) : setLoading(true);
      setError(null);

      try {
        const token = await getValidAccessToken();
        if (!token) {
          setItems([]);
          return;
        }

        const page = await getAvailableVouchers(
          { search: keyword, size: 50 },
          token,
        );
        setItems(page.content ?? []);
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
    if (authSession.isAuthenticated) {
      void load("");
    } else {
      setLoading(false);
      setItems([]);
      setError(null);
    }
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
        </View>

        {authSession.isAuthenticated ? (
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
        ) : null}
      </View>

      {!authSession.isAuthenticated ? (
        <View className="flex-1 items-center justify-center px-6">
          <View
            className="w-full items-center rounded-[28px] bg-white px-6 py-8"
            style={{ elevation: 2 }}
          >
            <View className="h-20 w-20 items-center justify-center rounded-full bg-[#FFF0F7]">
              <SymbolView
                name={{
                  ios: "person.crop.circle.badge.exclamationmark",
                  android: "person",
                  web: "person",
                }}
                size={42}
                tintColor="#EB489B"
              />
            </View>
            <Text className="mt-5 text-center text-[21px] font-black text-[#2B2233]">
              Bạn cần đăng nhập
            </Text>
            <Text className="mt-2 text-center text-[14px] leading-6 text-[#8E869A]">
              Đăng nhập để xem voucher đang có và sử dụng điểm khám phá để đổi ưu đãi.
            </Text>
            <Pressable
              className="mt-6 w-full items-center rounded-full bg-[#EB489B] py-4"
              onPress={goToLogin}
            >
              <Text className="text-[16px] font-black text-white">
                Đăng nhập ngay
              </Text>
            </Pressable>
          </View>
        </View>
      ) : loading ? (
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

          {!error && items.length === 0 ? (
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
            {items.map((voucher) => {
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
