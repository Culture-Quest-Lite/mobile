import { Image } from "expo-image";
import { SymbolView } from "expo-symbols";
import { Pressable, ScrollView, Text, View } from "react-native";

import {
  buildHotspotStoryItems,
  getHotspotStoryAccent,
  getHotspotStoryPreview,
  type HotspotStoryFilterId,
  type HotspotStoryItem,
  hotspotStoryFilters,
} from "../data/hotspot-stories";
import type { HotspotDetail } from "../data/hotspots";

const cardShadowStyle = {
  shadowColor: "rgba(235, 72, 155, 0.10)",
  shadowOpacity: 1,
  shadowRadius: 18,
  shadowOffset: {
    width: 0,
    height: 10,
  },
  elevation: 6,
} as const;

function HotspotStoryFilterChip({
  isActive,
  label,
  onPress,
}: {
  isActive: boolean;
  label: string;
  onPress: () => void;
}) {
  return (
    <Pressable
      className="rounded-full border px-4 py-2.5"
      onPress={onPress}
      style={{
        backgroundColor: isActive ? "#ECFDF3" : "#FFF5FA",
        borderColor: isActive ? "rgba(34, 197, 94, 0.24)" : "rgba(235, 72, 155, 0.14)",
      }}
    >
      <Text
        className="text-[13px] font-black"
        style={{ color: isActive ? "#15803D" : "#8E869A" }}
      >
        {label}
      </Text>
    </Pressable>
  );
}

function HotspotStoryCard({ item }: { item: HotspotStoryItem }) {
  const accent = getHotspotStoryAccent(item.filterId);

  return (
    <View
      className="overflow-hidden rounded-[28px] border p-3"
      style={[
        cardShadowStyle,
        {
          backgroundColor: "rgba(255, 252, 254, 0.98)",
          borderColor: "#F4DCE6",
        },
      ]}
    >
      <View className="flex-row">
        <Image
          source={item.imageUri}
          contentFit="cover"
          transition={120}
          cachePolicy="memory-disk"
          style={{ borderRadius: 22, height: 108, width: 92 }}
        />

        <View className="ml-3 flex-1">
          <View className="flex-row items-start justify-between gap-3">
            <View
              className="self-start rounded-full px-3 py-1.5"
              style={{ backgroundColor: accent.badgeBackground }}
            >
              <Text
                className="text-[10px] font-black uppercase tracking-[0.8px]"
                style={{ color: accent.badgeText }}
              >
                {item.pillLabel}
              </Text>
            </View>

            <View
              className="h-9 w-9 items-center justify-center rounded-full"
              style={{ backgroundColor: accent.iconBackground }}
            >
              <SymbolView name={item.icon} size={16} tintColor={accent.iconTint} />
            </View>
          </View>

          <Text className="mt-3 text-[16px] font-black leading-5 text-[#2B2233]">
            {item.title}
          </Text>
          <Text className="mt-2 text-[13px] leading-5 text-[#6F657A]" numberOfLines={4}>
            {getHotspotStoryPreview(item.body)}
          </Text>
          <Text className="mt-3 text-[11px] font-semibold text-[#AA9FB0]">
            {item.metaLabel}
          </Text>
        </View>
      </View>
    </View>
  );
}

export function HotspotStoryBrowser({
  activeFilter,
  audioStoryDurationLabel,
  description,
  emptyDescription = "Chọn bộ lọc khác để xem các story đã mở khóa từ hotspot.",
  emptyTitle = "Chưa có story cho bộ lọc này",
  hotspot,
  onChangeFilter,
  title,
}: {
  activeFilter: HotspotStoryFilterId;
  audioStoryDurationLabel: string;
  description: string;
  emptyDescription?: string;
  emptyTitle?: string;
  hotspot: HotspotDetail;
  onChangeFilter: (filterId: HotspotStoryFilterId) => void;
  title: string;
}) {
  const storyItems = buildHotspotStoryItems(hotspot, audioStoryDurationLabel);
  const filteredStoryItems =
    activeFilter === "all"
      ? storyItems
      : storyItems.filter((item) => item.filterId === activeFilter);

  return (
    <View>
      <View className="flex-row items-center justify-between gap-3">
        <View className="flex-1">
          <Text className="text-[22px] font-black text-[#2B2233]">{title}</Text>
          <Text className="mt-1 text-[13px] leading-5 text-[#8E869A]">{description}</Text>
        </View>

        <View className="rounded-full bg-[#ECFDF3] px-3 py-2">
          <Text className="text-[11px] font-black text-[#15803D]">{storyItems.length} story</Text>
        </View>
      </View>

      <ScrollView
        horizontal
        className="mt-4"
        contentContainerStyle={{ paddingRight: 8 }}
        showsHorizontalScrollIndicator={false}
      >
        {hotspotStoryFilters.map((filter, index) => (
          <View
            key={filter.id}
            className={index === hotspotStoryFilters.length - 1 ? "" : "mr-3"}
          >
            <HotspotStoryFilterChip
              isActive={filter.id === activeFilter}
              label={filter.label}
              onPress={() => onChangeFilter(filter.id)}
            />
          </View>
        ))}
      </ScrollView>

      <View className="mt-4 gap-4">
        {filteredStoryItems.length > 0 ? (
          filteredStoryItems.map((item) => <HotspotStoryCard key={item.id} item={item} />)
        ) : (
          <View
            className="rounded-[26px] border px-4 py-5"
            style={{
              backgroundColor: "rgba(255, 252, 254, 0.98)",
              borderColor: "#F4DCE6",
            }}
          >
            <Text className="text-[15px] font-black text-[#2B2233]">{emptyTitle}</Text>
            <Text className="mt-2 text-[13px] leading-5 text-[#8E869A]">
              {emptyDescription}
            </Text>
          </View>
        )}
      </View>
    </View>
  );
}
