import { useCallback, useEffect, useMemo, useState } from "react";
import { Pressable, RefreshControl, ScrollView, Text, View } from "react-native";
import { SafeAreaView, useSafeAreaInsets } from "react-native-safe-area-context";
import { useRouter } from "expo-router";

import { AppLoadingScreen } from "@/components/ui/app-loading-screen";
import { SymbolView } from "@/components/ui/symbol-view";
import {
  getValidAccessToken,
  useAuthSession,
} from "@/features/auth/hooks/use-auth-session";
import {
  getMyRedeemedVouchers,
  getVoucherRedeemCode,
  isVoucherUsageExpired,
  type VoucherUsage,
} from "../api/voucher-api";

type MyVoucherTab = "available" | "used" | "expired";

const tabs: { key: MyVoucherTab; label: string }[] = [
  { key: "available", label: "Có sẵn" },
  { key: "used", label: "Đã dùng" },
  { key: "expired", label: "Hết hạn" },
];

function tabOf(usage: VoucherUsage): MyVoucherTab {
  if (usage.isUsed) return "used";
  return isVoucherUsageExpired(usage) ? "expired" : "available";
}

function formatDate(value?: string | null) {
  if (!value) return "—";
  return new Date(value).toLocaleDateString("vi-VN");
}

export default function MyVoucherScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const authSession = useAuthSession();
  const [items, setItems] = useState<VoucherUsage[]>([]);
  const [tab, setTab] = useState<MyVoucherTab>("available");
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(
    async (refresh = false) => {
      if (!authSession.isAuthenticated) {
        setItems([]);
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

        const page = await getMyRedeemedVouchers({ size: 100 }, token);
        setItems(page.content ?? []);
      } catch (e) {
        setError(e instanceof Error ? e.message : "Không tải được voucher.");
      } finally {
        setLoading(false);
        setRefreshing(false);
      }
    },
    [authSession.isAuthenticated],
  );

  useEffect(() => {
    void load();
  }, [load]);

  const counts = useMemo(() => {
    return items.reduce(
      (acc, usage) => {
        acc[tabOf(usage)] += 1;
        return acc;
      },
      { available: 0, used: 0, expired: 0 } as Record<MyVoucherTab, number>,
    );
  }, [items]);

  const visible = useMemo(
    () => items.filter((usage) => tabOf(usage) === tab),
    [items, tab],
  );

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
              Voucher của tôi
            </Text>
            <Text className="text-[12px] text-[#8E869A]">
              Mã đã đổi bằng điểm khám phá
            </Text>
          </View>
        </View>

        <View className="mt-4 flex-row rounded-2xl bg-[#F5F1F6] p-1">
          {tabs.map((item) => {
            const active = item.key === tab;
            return (
              <Pressable
                key={item.key}
                className={`flex-1 items-center rounded-xl py-2 ${
                  active ? "bg-white" : ""
                }`}
                onPress={() => setTab(item.key)}
              >
                <Text
                  className={`text-[13px] font-bold ${
                    active ? "text-[#EB489B]" : "text-[#8E869A]"
                  }`}
                >
                  {item.label} ({counts[item.key]})
                </Text>
              </Pressable>
            );
          })}
        </View>
      </View>

      {!authSession.isAuthenticated ? (
        <View className="flex-1 items-center justify-center px-6">
          <View
            className="w-full items-center rounded-[28px] bg-white px-6 py-8"
            style={{ elevation: 2 }}
          >
            <View className="h-20 w-20 items-center justify-center rounded-full bg-[#FFF0F7]">
              <SymbolView
                name={{ ios: "lock.fill", android: "lock", web: "lock" }}
                size={38}
                tintColor="#EB489B"
              />
            </View>
            <Text className="mt-5 text-center text-[21px] font-black text-[#2B2233]">
              Bạn cần đăng nhập
            </Text>
            <Text className="mt-2 text-center text-[14px] leading-6 text-[#8E869A]">
              Đăng nhập để xem lại các voucher bạn đã đổi.
            </Text>
            <Pressable
              className="mt-6 w-full items-center rounded-full bg-[#EB489B] py-4"
              onPress={() => router.push("/login?entry=home")}
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
              onRefresh={() => void load(true)}
            />
          }
        >
          {error ? (
            <Pressable
              className="rounded-2xl bg-[#FFF0F0] p-4"
              onPress={() => void load()}
            >
              <Text className="font-bold text-[#C0392B]">{error}</Text>
              <Text className="mt-1 text-[#8E5960]">Chạm để thử lại</Text>
            </Pressable>
          ) : null}

          {!error && visible.length === 0 ? (
            <View className="items-center py-20">
              <Text className="text-[18px] font-black text-[#2B2233]">
                Chưa có voucher nào
              </Text>
              <Text className="mt-2 text-center text-[#8E869A]">
                Đổi điểm khám phá để nhận ưu đãi từ đối tác.
              </Text>
              <Pressable
                className="mt-5 rounded-full bg-[#EB489B] px-6 py-3"
                onPress={() => router.push("/vouchers")}
              >
                <Text className="font-black text-white">Khám phá voucher</Text>
              </Pressable>
            </View>
          ) : null}

          <View className="gap-3">
            {visible.map((usage) => {
              const state = tabOf(usage);
              return (
                <Pressable
                  key={usage.voucherUsageId}
                  className="rounded-[24px] bg-white p-4"
                  style={{ elevation: 2 }}
                  onPress={() => router.push(`/vouchers/${usage.voucherId}`)}
                >
                  <Text
                    className="text-[16px] font-black text-[#2B2233]"
                    numberOfLines={2}
                  >
                    {usage.voucherName}
                  </Text>

                  <View className="mt-3 rounded-2xl bg-[#F7F4F8] p-3">
                    <Text className="text-[11px] text-[#8E869A]">
                      Mã sử dụng
                    </Text>
                    <Text
                      selectable
                      className={`mt-1 text-[22px] font-black tracking-[3px] ${
                        state === "available" ? "text-[#176C3B]" : "text-[#A39BA8]"
                      }`}
                    >
                      {getVoucherRedeemCode(usage)}
                    </Text>
                  </View>

                  <View className="mt-3 flex-row items-center justify-between">
                    <Text className="text-[12px] text-[#8E869A]">
                      Đổi ngày {formatDate(usage.redeemedAt)}
                    </Text>
                    <Text
                      className={`text-[12px] font-bold ${
                        state === "available"
                          ? "text-[#238A4D]"
                          : state === "used"
                            ? "text-[#8E869A]"
                            : "text-[#C0392B]"
                      }`}
                    >
                      {state === "available"
                        ? `HSD ${formatDate(usage.expiredAt)}`
                        : state === "used"
                          ? `Đã dùng ${formatDate(usage.usedAt)}`
                          : `Hết hạn ${formatDate(usage.expiredAt)}`}
                    </Text>
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
