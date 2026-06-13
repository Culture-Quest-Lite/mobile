import { Image } from "expo-image";
import { LinearGradient } from "expo-linear-gradient";
import { useLocalSearchParams, useRouter } from "expo-router";
import { StatusBar } from "expo-status-bar";
import { SymbolView } from "expo-symbols";
import { useState } from "react";
import { Pressable, ScrollView, Text, View } from "react-native";
import { SafeAreaView, useSafeAreaInsets } from "react-native-safe-area-context";

import { getHotspotBySlug } from "../data/hotspots";

const storyHistoryImage = require("../../../../assets/images/tachnenl.png");
const storyCultureImage = require("../../../../assets/images/tachnen2.png");
const storyFoodImage = require("../../../../assets/images/tachnen3.png");
const historyTagImage = require("../../../../assets/images/Jun 13, 2026, 07_55_06 PM.png");
const cultureTagImage = require("../../../../assets/images/vanhoa.png");
const foodTagImage = require("../../../../assets/images/amthuc.png");
const educationTagImage = require("../../../../assets/images/giaoduc.png");

type StoryThemeTag = "history" | "culture" | "food" | "education";
type StoryThemeCardItem = {
  cardColors: readonly [string, string];
  cardHeight: number;
  id: string;
  imageBottom: number;
  imageHeight: number;
  imageRight: number;
  imageSource: number;
  imageWidth: number;
  tag: StoryThemeTag;
  textWidth: number;
  title: string;
};

const storyThemeTabs: {
  id: StoryThemeTag;
  label: string;
}[] = [
  { id: "history", label: "Lịch sử" },
  { id: "culture", label: "Văn hóa" },
  { id: "food", label: "Ẩm thực" },
  { id: "education", label: "Giáo dục" },
];

const cardShadowStyle = {
  shadowColor: "rgba(235, 72, 155, 0.16)",
  shadowOpacity: 1,
  shadowRadius: 22,
  shadowOffset: {
    width: 0,
    height: 14,
  },
  elevation: 8,
} as const;

const storyCardBaseLayout = {
  cardHeight: 138,
  imageBottom: -50,
  imageHeight: 246,
  imageRight: -18,
  imageWidth: 182,
  textWidth: 43,
} as const;

const storyImageByTag: Record<StoryThemeTag, number> = {
  culture: storyCultureImage,
  education: storyHistoryImage,
  food: storyFoodImage,
  history: storyHistoryImage,
};

const tagImageByTag: Record<StoryThemeTag, number> = {
  culture: cultureTagImage,
  education: educationTagImage,
  food: foodTagImage,
  history: historyTagImage,
};

function buildThemeStoryCards(hotspot: NonNullable<ReturnType<typeof getHotspotBySlug>>): StoryThemeCardItem[] {
  return [
    {
      cardColors: ["#D8E8FF", "#C8DCFF"],
      ...storyCardBaseLayout,
      id: `${hotspot.slug}-history-main`,
      imageSource: storyImageByTag.history,
      tag: "history",
      title: `Lịch sử của ${hotspot.title}`,
    },
    {
      cardColors: ["#F8D1DE", "#F2C2D3"],
      ...storyCardBaseLayout,
      id: `${hotspot.slug}-culture-main`,
      imageSource: storyImageByTag.culture,
      tag: "culture",
      title: `Văn hóa quanh ${hotspot.title}`,
    },
    {
      cardColors: ["#F8D5C0", "#F3C2A4"],
      ...storyCardBaseLayout,
      id: `${hotspot.slug}-food-main`,
      imageSource: storyImageByTag.food,
      tag: "food",
      title: "Ẩm thực nên thử sau khi ghé",
    },
    {
      cardColors: ["#DDD6FF", "#CEC6FF"],
      ...storyCardBaseLayout,
      id: `${hotspot.slug}-education-main`,
      imageSource: storyImageByTag.education,
      tag: "education",
      title: "Ghi chú nhanh trước khi đi tiếp",
    },
  ];
}

function ThemeTagChip({
  imageSource,
  isActive,
  label,
  onPress,
}: {
  imageSource: number;
  isActive: boolean;
  label: string;
  onPress: () => void;
}) {
  return (
    <Pressable className="items-center" onPress={onPress}>
      <View
        className="rounded-full p-1.5"
        style={{
          backgroundColor: isActive ? "#FFF1F7" : "transparent",
          borderColor: isActive ? "#F8CADC" : "transparent",
          borderWidth: 1,
        }}
      >
        <Image
          source={imageSource}
          contentFit="cover"
          transition={120}
          cachePolicy="memory-disk"
          style={{ borderRadius: 999, height: 58, width: 58 }}
        />
      </View>
      <Text
        className="mt-2 text-[14px] font-black"
        style={{ color: isActive ? "#EB489B" : "#A897B2" }}
      >
        {label}
      </Text>
      <View
        className="mt-2 rounded-full"
        style={{
          backgroundColor: isActive ? "#F58752" : "transparent",
          height: 3,
          width: 42,
        }}
      />
    </Pressable>
  );
}

function StoryCard({ item }: { item: StoryThemeCardItem }) {
  return (
    <View className="pb-5 pr-9 pt-6">
      <LinearGradient
        colors={[item.cardColors[0], item.cardColors[1]]}
        end={{ x: 1, y: 0.5 }}
        start={{ x: 0, y: 0.5 }}
        className="overflow-hidden rounded-[30px] px-5 py-4"
        style={[cardShadowStyle, { minHeight: item.cardHeight }]}
      >
        <View
          className="absolute rounded-full"
          style={{
            backgroundColor: "rgba(255,255,255,0.18)",
            height: 136,
            right: -24,
            top: -18,
            width: 136,
          }}
        />
        <View
          className="absolute rounded-full"
          style={{
            backgroundColor: "rgba(255,255,255,0.10)",
            bottom: -44,
            height: 110,
            right: 36,
            width: 110,
          }}
        />

        <View style={{ maxWidth: `${item.textWidth}%` }}>
          <Text
            className="text-[19px] font-black leading-6 text-white"
            style={{
              textShadowColor: "rgba(76, 53, 76, 0.12)",
              textShadowOffset: { width: 0, height: 1 },
              textShadowRadius: 8,
            }}
          >
            {item.title}
          </Text>
        </View>
      </LinearGradient>

      <Image
        source={item.imageSource}
        contentFit="contain"
        transition={120}
        cachePolicy="memory-disk"
        style={{
          borderRadius: 26,
          bottom: item.imageBottom,
          height: item.imageHeight,
          position: "absolute",
          right: item.imageRight,
          width: item.imageWidth,
        }}
      />
    </View>
  );
}

function NotFoundState() {
  const router = useRouter();

  return (
    <View className="flex-1 bg-white">
      <SafeAreaView className="flex-1" edges={["top", "left", "right", "bottom"]}>
        <View className="flex-1 items-center justify-center px-6">
          <View
            className="w-full rounded-[32px] border bg-[#FFF9FD] px-6 py-8"
            style={[cardShadowStyle, { borderColor: "#F4DCE6", maxWidth: 360 }]}
          >
            <Text className="text-center text-[24px] font-black text-[#2B2233]">
              Không tìm thấy story
            </Text>
            <Text className="mt-3 text-center text-[14px] leading-6 text-[#6F657A]">
              Hotspot này không còn trong dữ liệu hiện tại hoặc slug chưa hợp lệ.
            </Text>
            <Pressable
              className="mt-6 items-center rounded-full bg-[#FFF0F6] px-5 py-3.5"
              onPress={() => router.back()}
            >
              <Text className="text-[14px] font-black text-[#EB489B]">
                Quay lại hotspot
              </Text>
            </Pressable>
          </View>
        </View>
      </SafeAreaView>
    </View>
  );
}

export default function HotspotStoriesScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { slug } = useLocalSearchParams<{ slug: string }>();
  const resolvedSlug = Array.isArray(slug) ? (slug[0] ?? "") : (slug ?? "");
  const hotspot = getHotspotBySlug(resolvedSlug);
  const [activeTag, setActiveTag] = useState<StoryThemeTag>("history");

  if (!hotspot) {
    return <NotFoundState />;
  }

  const storyCards = buildThemeStoryCards(hotspot);
  const activeStory = storyCards.find((item) => item.tag === activeTag);
  return (
    <View className="flex-1 bg-white">
      <StatusBar style="dark" />

      <SafeAreaView className="flex-1 bg-white" edges={["left", "right", "bottom"]}>
        <View
          className="border-b border-[#F2E8F7] bg-white px-5"
          style={{ paddingTop: insets.top + 6 }}
        >
          <View className="flex-row items-center justify-between pb-3">
            <Pressable
              className="h-11 w-11 items-center justify-center rounded-full bg-[#FFF5FA]"
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

            <Text className="text-[15px] font-black text-[#EB489B]">
              Story hotspot
            </Text>

            <View className="h-11 w-11" />
          </View>

          <ScrollView
            horizontal
            contentContainerStyle={{ columnGap: 18, paddingBottom: 4, paddingTop: 4 }}
            showsHorizontalScrollIndicator={false}
          >
            {storyThemeTabs.map((tab) => (
              <ThemeTagChip
                key={tab.id}
                imageSource={tagImageByTag[tab.id]}
                isActive={tab.id === activeTag}
                label={tab.label}
                onPress={() => setActiveTag(tab.id)}
              />
            ))}
          </ScrollView>
        </View>

        <ScrollView
          className="flex-1"
          contentContainerStyle={{
            paddingBottom: Math.max(insets.bottom + 30, 34),
            paddingHorizontal: 20,
            paddingTop: 18,
            rowGap: 18,
          }}
          showsVerticalScrollIndicator={false}
        >
          {activeStory ? <StoryCard item={activeStory} /> : null}
        </ScrollView>
      </SafeAreaView>
    </View>
  );
}
