import { Image } from "expo-image";
import { LinearGradient } from "expo-linear-gradient";
import { useRouter } from "expo-router";
import { SymbolView } from "expo-symbols";
import { useMemo, useState } from "react";
import { Pressable, ScrollView, Text, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

import {
  nearbyCategories,
  type SymbolName,
} from "../data/home-screen.mock";
import {
  getHotspotHref,
  hotspotCollection,
  type HotspotDetail,
} from "../data/hotspots";

const gradientColors = ["#EB489B", "#F58752", "#FFC93C"] as const;

const cardShadowStyle = {
  shadowColor: "rgba(235, 72, 155, 0.22)",
  shadowOpacity: 1,
  shadowRadius: 22,
  shadowOffset: {
    width: 0,
    height: 16,
  },
  elevation: 10,
} as const;

type HotspotCategoryFilter = {
  accent: string;
  background: string;
  icon: SymbolName;
  label: string;
};

const defaultHotspotCategory: HotspotCategoryFilter = {
  accent: "#EB489B",
  background: "#FFF0F7",
  icon: {
    ios: "square.grid.2x2.fill",
    android: "apps",
    web: "apps",
  },
  label: "Tất cả",
};

function HotspotStatChip({
  icon,
  label,
  textColor = "#FFFFFF",
}: {
  icon: SymbolName;
  label: string;
  textColor?: string;
}) {
  return (
    <View className="flex-row items-center">
      <SymbolView name={icon} size={13} tintColor="#FFC93C" />
      <Text
        className="ml-1.5 text-[12px] font-extrabold"
        style={{ color: textColor }}
      >
        {label}
      </Text>
    </View>
  );
}

function HotspotCollectionCard({
  onPress,
  place,
}: {
  onPress: () => void;
  place: HotspotDetail;
}) {
  return (
    <Pressable
      className="overflow-hidden rounded-[28px] bg-[#1E1720]"
      hitSlop={6}
      onPress={onPress}
      style={cardShadowStyle}
    >
      <View className="relative">
        <Image
          source={place.imageUri}
          contentFit="cover"
          transition={220}
          cachePolicy="memory-disk"
          style={{ height: 248, width: "100%" }}
        />
        <LinearGradient
          colors={["rgba(0,0,0,0.04)", "rgba(0,0,0,0.82)"]}
          locations={[0.18, 1]}
          style={{
            bottom: 0,
            left: 0,
            position: "absolute",
            right: 0,
            top: 0,
          }}
        />

        <View className="absolute inset-x-4 top-4 flex-row items-center justify-between">
          <LinearGradient
            colors={["#FFFFFF", "#FFF1F7"]}
            end={{ x: 1, y: 0.5 }}
            start={{ x: 0, y: 0.5 }}
            className="rounded-full px-3 py-1.5"
          >
            <Text className="text-[11px] font-extrabold text-[#EB489B]">
              {place.category}
            </Text>
          </LinearGradient>
          <LinearGradient
            colors={gradientColors}
            end={{ x: 1, y: 0.5 }}
            locations={[0, 0.58, 1]}
            start={{ x: 0, y: 0.5 }}
            className="rounded-full px-3 py-1.5"
          >
            <Text className="text-[11px] font-bold text-white">
              {place.reward} XP
            </Text>
          </LinearGradient>
        </View>

        <View className="absolute inset-x-4 bottom-4">
          <Text className="text-[29px] font-black leading-[34px] text-white">
            {place.title}
          </Text>
          <Text
            className="mt-1 text-[13px] text-[#F6DFE8]"
            numberOfLines={2}
          >
            {place.overview}
          </Text>

          <View className="mt-4 flex-row flex-wrap items-center gap-x-4 gap-y-2">
            <HotspotStatChip
              icon={{
                ios: "location.fill",
                android: "place",
                web: "place",
              }}
              label={place.distance}
              textColor="#FFE6F0"
            />
            <HotspotStatChip
              icon={{
                ios: "star.fill",
                android: "star",
                web: "star",
              }}
              label={place.rating.toFixed(1)}
              textColor="#FFE6F0"
            />
            <HotspotStatChip
              icon={{
                ios: "gift.fill",
                android: "redeem",
                web: "redeem",
              }}
              label={`${place.reward} XP`}
              textColor="#FFC93C"
            />
          </View>
        </View>
      </View>
    </Pressable>
  );
}

export default function AllHotspotsScreen() {
  const router = useRouter();
  const [activeCategory, setActiveCategory] = useState("Tất cả");
  const allHotspots = hotspotCollection;

  const hotspotCategories = useMemo<HotspotCategoryFilter[]>(() => {
    const categoriesWithPlaces = nearbyCategories.filter((item) =>
      allHotspots.some((place) => place.category === item.label),
    );

    return [defaultHotspotCategory, ...categoriesWithPlaces];
  }, [allHotspots]);

  const filteredPlaces = useMemo(() => {
    if (activeCategory === "Tất cả") {
      return allHotspots;
    }

    return allHotspots.filter((place) => place.category === activeCategory);
  }, [activeCategory, allHotspots]);

  const topReward = useMemo(() => {
    return Math.max(
      ...allHotspots.map((place) => Number(place.reward.replace(/\D/g, ""))),
    );
  }, [allHotspots]);

  return (
    <SafeAreaView
      className="flex-1 bg-white"
      edges={["top", "left", "right", "bottom"]}
    >
      <ScrollView
        className="flex-1"
        contentContainerStyle={{ paddingBottom: 36 }}
        showsVerticalScrollIndicator={false}
      >
        <View className="px-5 pb-2 pt-2">
          <View className="flex-row items-center justify-between">
            <Pressable
              className="h-11 w-11 items-center justify-center rounded-full bg-[#FFF4EF]"
              hitSlop={8}
              onPress={() => router.back()}
            >
              <SymbolView
                name={{
                  ios: "chevron.left",
                  android: "arrow_back",
                  web: "arrow_back",
                }}
                size={18}
                tintColor="#EB489B"
              />
            </Pressable>

            <LinearGradient
              colors={gradientColors}
              end={{ x: 1, y: 0.5 }}
              locations={[0, 0.58, 1]}
              start={{ x: 0, y: 0.5 }}
              className="flex-row items-center rounded-full px-4 py-2.5"
            >
              <SymbolView
                name={{
                  ios: "location.fill",
                  android: "place",
                  web: "place",
                }}
                size={13}
                tintColor="#FFFFFF"
              />
              <Text className="ml-2 text-[12px] font-bold text-white">
                {filteredPlaces.length} địa điểm
              </Text>
            </LinearGradient>
          </View>

          <View className="mt-5">
            <Text className="text-[25px] font-black leading-[34px] text-[#2B2233]">
              Tất cả địa điểm
            </Text>
          </View>

          <View className="mt-4 flex-row flex-wrap gap-2">
            <View className="rounded-full bg-[#FFF4EF] px-3.5 py-2">
              <Text className="text-[12px] font-semibold text-[#EB489B]">
                Gần bạn ngay lúc này
              </Text>
            </View>
            <View className="rounded-full bg-[#FFF7E8] px-3.5 py-2">
              <Text className="text-[12px] font-semibold text-[#F58752]">
                Phần thưởng lớn nhất +{topReward} XP
              </Text>
            </View>
          </View>

          <View className="mt-5 flex-row items-center rounded-[18px] border border-[#F0E8F4] bg-[#FAF7FC] px-4 py-4">
            <SymbolView
              name={{
                ios: "magnifyingglass",
                android: "search",
                web: "search",
              }}
              size={15}
              tintColor="#8E869A"
            />
            <Text className="ml-3 flex-1 text-[13px] text-[#8E869A]">
              Tìm kiếm địa điểm, lộ trình, văn hóa...
            </Text>
          </View>

          <ScrollView
            horizontal
            className="mt-4"
            contentContainerStyle={{ paddingRight: 8 }}
            showsHorizontalScrollIndicator={false}
          >
            {hotspotCategories.map((item, index) => {
              const isActive = item.label === activeCategory;

              return (
                <Pressable
                  key={item.label}
                  className={
                    index === hotspotCategories.length - 1 ? "" : "mr-3"
                  }
                  onPress={() => setActiveCategory(item.label)}
                >
                  {isActive ? (
                    <LinearGradient
                      colors={gradientColors}
                      end={{ x: 1, y: 0.5 }}
                      locations={[0, 0.58, 1]}
                      start={{ x: 0, y: 0.5 }}
                      className="rounded-full px-4 py-3"
                    >
                      <Text className="text-[13px] font-semibold text-white">
                        {item.label}
                      </Text>
                    </LinearGradient>
                  ) : (
                    <View className="rounded-full bg-[#FAF7FC] px-4 py-3">
                      <Text className="text-[13px] font-semibold text-[#2B2233]">
                        {item.label}
                      </Text>
                    </View>
                  )}
                </Pressable>
              );
            })}
          </ScrollView>

            <View className="mt-4 gap-4">
              {filteredPlaces.map((place) => (
                <HotspotCollectionCard
                  key={place.slug}
                  onPress={() => router.push(getHotspotHref(place.slug))}
                  place={place}
                />
              ))}

            {filteredPlaces.length === 0 ? (
              <View className="items-center rounded-[28px] border border-dashed border-[#3A2740] bg-[#1E1720] px-6 py-10">
                <Text className="text-[16px] font-extrabold text-white">
                  Chưa có hotspot cho chủ đề này
                </Text>
                <Text className="mt-2 max-w-[260px] text-center text-[13px] leading-5 text-[#B2A4B8]">
                  Hãy chọn chủ đề khác để xem thêm các địa điểm gần bạn.
                </Text>
              </View>
            ) : null}
          </View>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}
