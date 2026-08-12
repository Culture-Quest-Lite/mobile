import { ActivityIndicator, Pressable, ScrollView, Text, View } from "react-native";
import { useRouter } from "expo-router";
import type { Href } from "expo-router";

import { SymbolView } from "@/components/ui/symbol-view";
import { formatDistance } from "@/lib/location";
import {
  useNearbyVouchers,
  type NearbyVoucherAnchor,
} from "../hooks/use-nearby-vouchers";
import { VoucherMiniCard } from "./voucher-mini-card";

type NearbyVoucherSectionProps = {
  anchor: NearbyVoucherAnchor;
  radiusMeters?: number;
  title?: string;
  eyebrow?: string;
  /** Nhãn phụ trên mỗi thẻ, ví dụ "Quanh Chợ Bến Thành". */
  contextLabel?: string | null;
  emptyDescription?: string;
  seeAllHref?: Href;
  /** Lề ngang của màn cha, để dải ngang tràn hết chiều rộng. */
  horizontalInset?: number;
  cardWidth?: number;
  size?: number;
};

/**
 * Dải ngang "Ưu đãi quanh đây" dùng lại được ở màn hotspot, màn tuyến và
 * màn voucher. Toàn bộ logic gọi API nằm trong `useNearbyVouchers`.
 */
export function NearbyVoucherSection({
  anchor,
  radiusMeters = 1000,
  title = "Ưu đãi quanh đây",
  eyebrow = "ĐỔI ĐIỂM LẤY ƯU ĐÃI",
  contextLabel,
  emptyDescription = "Chưa có đối tác nào có ưu đãi trong bán kính này.",
  seeAllHref,
  horizontalInset = 0,
  cardWidth = 220,
  size = 12,
}: NearbyVoucherSectionProps) {
  const router = useRouter();
  const { vouchers, anchorHotspots, isLoading, error, locationNotice, reload } =
    useNearbyVouchers({ anchor, radiusMeters, size });

  const nearestHotspot = anchorHotspots[0] ?? null;
  const resolvedContextLabel =
    contextLabel ??
    (nearestHotspot
      ? `Quanh ${nearestHotspot.hotspotName}${
          nearestHotspot.distanceMeters === null
            ? ""
            : ` · ${formatDistance(nearestHotspot.distanceMeters)}`
        }`
      : null);

  return (
    <View className="mt-6 gap-3">
      <View className="flex-row items-end justify-between">
        <View className="flex-1 pr-3">
          <Text className="text-[12px] font-black uppercase tracking-wider text-[#EB489B]">
            {eyebrow}
          </Text>
          <Text className="mt-0.5 text-[19px] font-black text-[#2B2233]">
            {title}
          </Text>
          <Text className="mt-0.5 text-[13px] text-[#8E869A]">
            Bán kính {formatDistance(radiusMeters)} quanh điểm đến
          </Text>
        </View>
        {seeAllHref ? (
          <Pressable onPress={() => router.push(seeAllHref)}>
            <Text className="text-[13px] font-black text-[#EB489B]">
              Xem tất cả
            </Text>
          </Pressable>
        ) : null}
      </View>

      {isLoading ? (
        <View className="items-center py-4">
          <ActivityIndicator color="#EB489B" size="small" />
        </View>
      ) : null}

      {!isLoading && error ? (
        <Pressable
          className="rounded-[18px] border border-[#F9E2EA] bg-[#FFF8FC] px-4 py-4"
          onPress={() => void reload()}
        >
          <Text className="text-[14px] font-bold text-[#C2416C]">{error}</Text>
          <Text className="mt-1 text-[12px] text-[#8E5960]">Chạm để thử lại</Text>
        </Pressable>
      ) : null}

      {!isLoading && !error && locationNotice ? (
        <Pressable
          className="flex-row items-center gap-3 rounded-[18px] border border-[#F0DEE7] bg-[#FFF8FB] px-4 py-4"
          onPress={() => void reload()}
        >
          <SymbolView
            name={{
              ios: "location.slash",
              android: "location_off",
              web: "location_off",
            }}
            size={20}
            tintColor="#C2416C"
          />
          <Text className="flex-1 text-[13px] text-[#6F657A]">
            {locationNotice}
          </Text>
        </Pressable>
      ) : null}

      {!isLoading && !error && !locationNotice && vouchers.length === 0 ? (
        <View className="rounded-[18px] border border-[#F0DEE7] bg-[#FFF8FB] px-4 py-5">
          <Text className="text-[14px] font-black text-[#2B2233]">
            Chưa có ưu đãi nào
          </Text>
          <Text className="mt-1 text-[13px] text-[#8E869A]">
            {emptyDescription}
          </Text>
        </View>
      ) : null}

      {!isLoading && vouchers.length > 0 ? (
        <ScrollView
          horizontal
          nestedScrollEnabled
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={{
            gap: 12,
            paddingHorizontal: horizontalInset,
          }}
          style={{ marginHorizontal: -horizontalInset }}
        >
          {vouchers.map((voucher) => (
            <VoucherMiniCard
              key={voucher.voucherId}
              voucher={voucher}
              width={cardWidth}
              contextLabel={resolvedContextLabel}
            />
          ))}
        </ScrollView>
      ) : null}
    </View>
  );
}
