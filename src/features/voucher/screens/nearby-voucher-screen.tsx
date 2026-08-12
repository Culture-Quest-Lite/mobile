import { useMemo, useState } from "react";
import {
  Pressable,
  RefreshControl,
  ScrollView,
  Text,
  View,
} from "react-native";
import { SafeAreaView, useSafeAreaInsets } from "react-native-safe-area-context";
import { Image } from "expo-image";
import { useLocalSearchParams, useRouter } from "expo-router";

import { AppLoadingScreen } from "@/components/ui/app-loading-screen";
import { ScreenHorizontalPadding } from "@/constants/theme";
import { SymbolView } from "@/components/ui/symbol-view";
import { formatDistance } from "@/lib/location";
import { getVoucherImage, type Voucher } from "../api/voucher-api";
import { formatVoucherDiscount } from "../components/voucher-mini-card";
import {
  useNearbyVouchers,
  type NearbyVoucherAnchor,
} from "../hooks/use-nearby-vouchers";

const radiusOptions = [500, 1000, 3000, 5000];

function parseId(value: string | undefined) {
  const parsed = Number(value);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : null;
}

export default function NearbyVoucherScreen() {
  const params = useLocalSearchParams<{
    hotspotId?: string;
    hotspotName?: string;
    routeId?: string;
    routeName?: string;
  }>();
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const [radiusMeters, setRadiusMeters] = useState(1000);

  const hotspotId = parseId(params.hotspotId);
  const routeId = parseId(params.routeId);

  const anchor = useMemo<NearbyVoucherAnchor>(() => {
    if (routeId !== null) return { kind: "route", routeId };
    if (hotspotId !== null) return { kind: "hotspots", hotspotIds: [hotspotId] };
    return { kind: "current-location" };
  }, [hotspotId, routeId]);

  const anchorName =
    routeId !== null
      ? params.routeName?.trim() || "tuyến này"
      : hotspotId !== null
        ? params.hotspotName?.trim() || "địa điểm này"
        : "vị trí của bạn";

  const {
    vouchers,
    anchorHotspots,
    isLoading,
    isRefreshing,
    error,
    locationNotice,
    reload,
  } = useNearbyVouchers({ anchor, radiusMeters, size: 50 });

  const nearestHotspot = anchorHotspots[0] ?? null;

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
              Ưu đãi quanh đây
            </Text>
            <Text className="text-[12px] text-[#8E869A]" numberOfLines={1}>
              Quán đối tác gần {anchorName}
            </Text>
          </View>
        </View>

        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          className="mt-4 -mx-4"
          contentContainerStyle={{ paddingHorizontal: 16, gap: 8 }}
        >
          {radiusOptions.map((option) => {
            const active = option === radiusMeters;
            return (
              <Pressable
                key={option}
                className={`rounded-full px-4 py-2 ${
                  active ? "bg-[#EB489B]" : "bg-[#F5F1F6]"
                }`}
                onPress={() => setRadiusMeters(option)}
              >
                <Text
                  className={`text-[13px] font-bold ${
                    active ? "text-white" : "text-[#6F6877]"
                  }`}
                >
                  {formatDistance(option)}
                </Text>
              </Pressable>
            );
          })}
        </ScrollView>

        {nearestHotspot ? (
          <View className="mt-3 flex-row items-center gap-2 rounded-2xl bg-[#F2F8FF] px-3 py-2.5">
            <SymbolView
              name={{
                ios: "location.fill",
                android: "location_on",
                web: "location_on",
              }}
              size={14}
              tintColor="#1677C8"
            />
            <Text className="flex-1 text-[12px] text-[#1677C8]" numberOfLines={1}>
              Gần nhất: {nearestHotspot.hotspotName}
              {nearestHotspot.distanceMeters === null
                ? ""
                : ` · ${formatDistance(nearestHotspot.distanceMeters)}`}
            </Text>
          </View>
        ) : null}
      </View>

      {isLoading ? (
        <AppLoadingScreen mode="embedded" />
      ) : (
        <ScrollView
          className="flex-1"
          contentContainerStyle={{
            padding: ScreenHorizontalPadding,
            paddingBottom: 30,
          }}
          refreshControl={
            <RefreshControl
              refreshing={isRefreshing}
              onRefresh={() => void reload(true)}
            />
          }
        >
          {error ? (
            <Pressable
              className="rounded-2xl bg-[#FFF0F0] p-4"
              onPress={() => void reload()}
            >
              <Text className="font-bold text-[#C0392B]">{error}</Text>
              <Text className="mt-1 text-[#8E5960]">Chạm để thử lại</Text>
            </Pressable>
          ) : null}

          {!error && locationNotice ? (
            <Pressable
              className="rounded-2xl bg-[#FFF8FB] p-4"
              onPress={() => void reload()}
            >
              <Text className="font-bold text-[#C2416C]">{locationNotice}</Text>
              <Text className="mt-1 text-[#8E5960]">Chạm để thử lại</Text>
            </Pressable>
          ) : null}

          {!error && !locationNotice && vouchers.length === 0 ? (
            <View className="items-center py-20">
              <Text className="text-[18px] font-black text-[#2B2233]">
                Chưa có ưu đãi trong bán kính này
              </Text>
              <Text className="mt-2 text-center text-[#8E869A]">
                Thử nới bán kính lên {formatDistance(radiusOptions.at(-1) ?? 5000)}.
              </Text>
            </View>
          ) : null}

          <View className="gap-3">
            {vouchers.map((voucher: Voucher) => {
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
                        {formatVoucherDiscount(voucher)}
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
