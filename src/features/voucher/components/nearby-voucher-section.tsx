import { ActivityIndicator, Pressable, ScrollView, Text, View } from "react-native";
import { useRouter } from "expo-router";
import type { Href } from "expo-router";

import { SymbolView } from "@/components/ui/symbol-view";
import { formatDistance } from "@/lib/location";
import { bodyTextStyle, lineHeightFor, textStyle } from "@/lib/text-scale";
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
  eyebrowColor?: string;
  showRadiusDescription?: boolean;
  titleFontWeight?: "font-semibold" | "font-bold" | "font-black";
  cardContentTextWeight?: "regular" | "emphasized";
  headerTextSizes?: {
    eyebrow?: number;
    title?: number;
    description?: number;
    action?: number;
  };
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
  eyebrowColor = "#EB489B",
  showRadiusDescription = true,
  titleFontWeight = "font-black",
  cardContentTextWeight = "emphasized",
  headerTextSizes,
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
  const eyebrowFontSize = headerTextSizes?.eyebrow ?? 12;
  const titleFontSize = headerTextSizes?.title ?? 19;
  const descriptionFontSize = headerTextSizes?.description ?? 13;
  const actionFontSize = headerTextSizes?.action ?? 13;

  return (
    <View className="mt-6 gap-3.5">
      <View className="flex-row items-end justify-between gap-3">
        <View className="min-w-0 flex-1 pr-3">
          <Text
            className="font-black uppercase tracking-wider"
            style={[
              textStyle(eyebrowFontSize),
              { color: eyebrowColor, fontSize: eyebrowFontSize },
            ]}
          >
            {eyebrow}
          </Text>
          <Text
            className={`mt-0.5 ${titleFontWeight} text-[#2B2233]`}
            style={[
              textStyle(titleFontSize),
              {
                fontSize: titleFontSize,
                lineHeight: lineHeightFor(titleFontSize),
              },
            ]}
          >
            {title}
          </Text>
          {showRadiusDescription ? (
            <Text
              className="mt-0.5 text-[#8E869A]"
              style={[
                bodyTextStyle(descriptionFontSize),
                { fontSize: descriptionFontSize },
              ]}
            >
              Bán kính {formatDistance(radiusMeters)} quanh điểm đến
            </Text>
          ) : null}
        </View>
        {seeAllHref ? (
          <Pressable hitSlop={8} onPress={() => router.push(seeAllHref)}>
            <Text
              className="font-black text-[#EB489B]"
              numberOfLines={1}
              style={[textStyle(actionFontSize), { fontSize: actionFontSize }]}
            >
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
          <Text
            className="text-[14px] font-bold text-[#C2416C]"
            style={textStyle(14)}
          >
            {error}
          </Text>
          <Text
            className="mt-1 text-[12px] text-[#8E5960]"
            style={textStyle(12)}
          >
            Chạm để thử lại
          </Text>
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
          <Text
            className="flex-1 text-[13px] text-[#6F657A]"
            style={bodyTextStyle(13)}
          >
            {locationNotice}
          </Text>
        </Pressable>
      ) : null}

      {!isLoading && !error && !locationNotice && vouchers.length === 0 ? (
        <View className="rounded-[18px] border border-[#F0DEE7] bg-[#FFF8FB] px-4 py-5">
          <Text
            className="text-[14px] font-black text-[#2B2233]"
            style={textStyle(14)}
          >
            Chưa có ưu đãi nào
          </Text>
          <Text
            className="mt-1 text-[13px] text-[#8E869A]"
            style={bodyTextStyle(13)}
          >
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
            paddingHorizontal: horizontalInset,
            paddingVertical: 6,
          }}
          style={{ marginHorizontal: -horizontalInset, marginVertical: -6 }}
        >
          {vouchers.map((voucher, index) => (
            <View
              key={voucher.voucherId}
              style={{
                marginRight: index === vouchers.length - 1 ? 0 : 14,
              }}
            >
              <VoucherMiniCard
                voucher={voucher}
                width={cardWidth}
                contentTextWeight={cardContentTextWeight}
                contextLabel={resolvedContextLabel}
              />
            </View>
          ))}
        </ScrollView>
      ) : null}
    </View>
  );
}
