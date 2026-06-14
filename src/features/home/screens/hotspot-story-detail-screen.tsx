import { Image } from "expo-image";
import { LinearGradient } from "expo-linear-gradient";
import { useLocalSearchParams, useRouter } from "expo-router";
import { StatusBar } from "expo-status-bar";
import { SymbolView } from "expo-symbols";
import { useCallback, useState, type ComponentProps } from "react";
import { Pressable, Text, View, useWindowDimensions } from "react-native";
import Animated, {
  Extrapolation,
  interpolate,
  useAnimatedScrollHandler,
  useAnimatedStyle,
  useSharedValue,
} from "react-native-reanimated";
import {
  SafeAreaView,
  useSafeAreaInsets,
} from "react-native-safe-area-context";

import {
  getHotspotThemeStory,
  type HotspotThemeStory,
  type StoryThemeTag,
} from "../data/hotspot-theme-stories";
import { getHotspotBySlug } from "../data/hotspots";

type SymbolName = ComponentProps<typeof SymbolView>["name"];

const screenShadowStyle = {
  shadowColor: "rgba(15, 23, 42, 0.12)",
  shadowOpacity: 1,
  shadowRadius: 28,
  shadowOffset: {
    width: 0,
    height: 18,
  },
  elevation: 10,
} as const;

const heroShadowStyle = {
  shadowColor: "rgba(15, 23, 42, 0.20)",
  shadowOpacity: 1,
  shadowRadius: 22,
  shadowOffset: {
    width: 0,
    height: 14,
  },
  elevation: 8,
} as const;

const sheetShadowStyle = {
  shadowColor: "rgba(15, 23, 42, 0.12)",
  shadowOpacity: 1,
  shadowRadius: 18,
  shadowOffset: {
    width: 0,
    height: -6,
  },
  elevation: 6,
} as const;

function getStoryPalette(tag: StoryThemeTag) {
  switch (tag) {
    case "history":
      return {
        accent: "#EB489B",
        accentSoft: "#FFF0F6",
        buttonColors: ["#EB489B", "#F58752"] as const,
        chipText: "#C73A86",
      };
    case "culture":
      return {
        accent: "#10B981",
        accentSoft: "#ECFDF5",
        buttonColors: ["#34D399", "#10B981"] as const,
        chipText: "#059669",
      };
    case "food":
      return {
        accent: "#F97316",
        accentSoft: "#FFF7ED",
        buttonColors: ["#F59E0B", "#F97316"] as const,
        chipText: "#EA580C",
      };
    case "education":
      return {
        accent: "#8B5CF6",
        accentSoft: "#F5F3FF",
        buttonColors: ["#A78BFA", "#8B5CF6"] as const,
        chipText: "#7C3AED",
      };
  }
}

function NotFoundState() {
  const router = useRouter();

  return (
    <View className="flex-1 bg-[#FFF9FD]">
      <SafeAreaView
        className="flex-1"
        edges={["top", "left", "right", "bottom"]}
      >
        <View className="flex-1 items-center justify-center px-6">
          <View
            className="w-full rounded-[32px] border border-[#F4DCE6] bg-white px-6 py-8"
            style={[screenShadowStyle, { maxWidth: 360 }]}
          >
            <Text className="text-center text-[24px] font-black text-[#2B2233]">
              Không tìm thấy detail story
            </Text>
            <Text className="mt-3 text-center text-[14px] leading-6 text-[#6F657A]">
              Story này không còn trong dữ liệu hiện tại hoặc đường dẫn chưa
              đúng.
            </Text>
            <Pressable
              className="mt-6 items-center rounded-full bg-[#FFF0F6] px-5 py-3.5"
              onPress={() => router.back()}
            >
              <Text className="text-[14px] font-black text-[#EB489B]">
                Quay lại danh sách
              </Text>
            </Pressable>
          </View>
        </View>
      </SafeAreaView>
    </View>
  );
}

function StoryTagPill({
  dark = false,
  story,
}: {
  dark?: boolean;
  story: HotspotThemeStory;
}) {
  const palette = getStoryPalette(story.tag);

  return (
    <View
      className="flex-row items-center self-start rounded-full px-3 py-2"
      style={{
        backgroundColor: dark
          ? "rgba(255, 255, 255, 0.16)"
          : palette.accentSoft,
      }}
    >
      <Image
        source={story.tagImageSource}
        contentFit="cover"
        style={{ borderRadius: 999, height: 24, width: 24 }}
      />
      <Text
        className="ml-2 text-[12px] font-black uppercase tracking-[0.7px]"
        style={{ color: dark ? "#FFFFFF" : palette.chipText }}
      >
        {story.tagLabel}
      </Text>
    </View>
  );
}

function SectionHeading({
  description,
  title,
}: {
  description: string;
  title: string;
}) {
  return (
    <View>
      <Text className="text-[18px] font-black text-[#2B2233]">{title}</Text>
      <Text className="mt-1.5 text-[14px] leading-6 text-[#7C7286]">
        {description}
      </Text>
    </View>
  );
}

function WaveformPreview({ accent }: { accent: string }) {
  const bars = [12, 26, 16, 32, 18, 24, 30, 14, 28, 20, 24, 12];

  return (
    <View className="mt-4 flex-row items-end justify-between rounded-[18px] bg-white/55 px-4 py-3">
      {bars.map((height, index) => (
        <View
          key={`wave-${index}`}
          className="rounded-full"
          style={{
            backgroundColor: accent,
            height,
            opacity: index < 8 ? 1 : 0.35,
            width: 6,
          }}
        />
      ))}
    </View>
  );
}

function StoryHeroSection({
  heroHeight,
  insetsTop,
  onBack,
  onNext,
  onPrevious,
  totalImages,
}: {
  heroHeight: number;
  insetsTop: number;
  onBack: () => void;
  onNext: () => void;
  onPrevious: () => void;
  totalImages: number;
}) {
  return (
    <View
      pointerEvents="box-none"
      style={{
        flex: 1,
      }}
    >
      <View className="px-5" style={{ paddingTop: insetsTop + 12 }}>
        <Pressable
          className="h-11 w-11 items-center justify-center rounded-full"
          hitSlop={8}
          onPress={onBack}
        >
          <SymbolView
            name={
              {
                ios: "chevron.left",
                android: "arrow_back",
                web: "arrow_back",
              } as SymbolName
            }
            size={18}
            tintColor="#FFFFFF"
          />
        </Pressable>
      </View>

      {totalImages > 1 ? (
        <>
          <Pressable
            className="absolute left-4 h-12 w-12 items-center justify-center rounded-full"
            hitSlop={8}
            onPress={onPrevious}
            style={{ top: heroHeight * 0.48 }}
          >
            <SymbolView
              name={
                {
                  ios: "chevron.left",
                  android: "arrow_back",
                  web: "arrow_back",
                } as SymbolName
              }
              size={18}
              tintColor="#FFFFFF"
            />
          </Pressable>

          <Pressable
            className="absolute right-4 h-12 w-12 items-center justify-center rounded-full"
            hitSlop={8}
            onPress={onNext}
            style={{ top: heroHeight * 0.48 }}
          >
            <SymbolView
              name={
                {
                  ios: "chevron.right",
                  android: "arrow_forward",
                  web: "arrow_forward",
                } as SymbolName
              }
              size={18}
              tintColor="#FFFFFF"
            />
          </Pressable>
        </>
      ) : null}
    </View>
  );
}

function StoryHeroHeader({
  activeIndex,
  insetsTop,
  onBack,
  subtitle,
  title,
  totalImages,
}: {
  activeIndex: number;
  insetsTop: number;
  onBack: () => void;
  subtitle: string;
  title: string;
  totalImages: number;
}) {
  return (
    <View
      pointerEvents="box-none"
      style={{
        elevation: 24,
        left: 0,
        position: "absolute",
        right: 0,
        top: 0,
        zIndex: 24,
      }}
    >
      <View className="px-5" style={{ paddingTop: insetsTop + 12 }}>
        <View className="flex-row items-center justify-between">
          <View className="h-11 w-11" />

          <View className="mx-4 flex-1">
            <Text
              className="text-center text-[16px] font-black text-white"
              numberOfLines={1}
            >
              {title}
            </Text>
            <Text
              className="mt-0.5 text-center text-[11px] font-semibold uppercase tracking-[1px] text-[#D9F0FF]"
              numberOfLines={1}
            >
              {subtitle}
            </Text>
          </View>

          <View className="min-w-[44px] items-end">
            {totalImages > 1 ? (
              <Text className="text-[13px] font-black text-white">
                {activeIndex + 1}/{totalImages}
              </Text>
            ) : (
              <View className="h-11 w-11" />
            )}
          </View>
        </View>
      </View>
    </View>
  );
}

export default function HotspotStoryDetailScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { height: screenHeight } = useWindowDimensions();
  const { slug, storyId } = useLocalSearchParams<{
    slug: string;
    storyId: string;
  }>();
  const resolvedSlug = Array.isArray(slug) ? (slug[0] ?? "") : (slug ?? "");
  const resolvedStoryId = Array.isArray(storyId)
    ? (storyId[0] ?? "")
    : (storyId ?? "");
  const hotspot = getHotspotBySlug(resolvedSlug);
  const story = hotspot ? getHotspotThemeStory(hotspot, resolvedStoryId) : null;
  const gallery =
    story?.heroGallery && story.heroGallery.length > 0
      ? story.heroGallery
      : story?.gallery && story.gallery.length > 0
        ? story.gallery
      : story?.videoPoster
        ? [story.videoPoster]
        : [];
  const [activeIndex, setActiveIndex] = useState(0);
  const safeTotalImages = Math.max(gallery.length, 1);
  const activeHeroImage = gallery[activeIndex] ?? gallery[0];
  const heroHeightExpanded = screenHeight;
  const heroHeightCollapsed = Math.max(Math.min(screenHeight * 0.42, 360), 300);
  const collapseDistance = Math.max(
    heroHeightExpanded - heroHeightCollapsed,
    1,
  );
  const contentOverlap = 0;
  const scrollY = useSharedValue(0);

  const cycleSlide = useCallback(
    (direction: -1 | 1) => {
      setActiveIndex(
        (current) => (current + direction + safeTotalImages) % safeTotalImages,
      );
    },
    [safeTotalImages],
  );
  const heroContainerStyle = useAnimatedStyle(() => ({
    height: interpolate(
      scrollY.value,
      [0, collapseDistance],
      [heroHeightExpanded, heroHeightCollapsed],
      Extrapolation.CLAMP,
    ),
  }));
  const heroMediaStyle = useAnimatedStyle(() => ({
    transform: [
      {
        translateY: interpolate(
          scrollY.value,
          [-heroHeightExpanded, 0, collapseDistance],
          [heroHeightExpanded * 0.06, 0, -22],
          Extrapolation.CLAMP,
        ),
      },
    ],
  }));
  const sheetLiftStyle = useAnimatedStyle(() => ({
    transform: [
      {
        translateY: interpolate(
          scrollY.value,
          [0, collapseDistance],
          [0, -44],
          Extrapolation.CLAMP,
        ),
      },
    ],
  }));
  const handleScroll = useAnimatedScrollHandler({
    onScroll: (event) => {
      // eslint-disable-next-line react-hooks/immutability
      scrollY.value = event.contentOffset.y;
    },
  });

  if (!hotspot || !story || !activeHeroImage) {
    return <NotFoundState />;
  }

  const palette = getStoryPalette(story.tag);

  return (
    <View className="flex-1 bg-white">
      <StatusBar style="light" />

      <Animated.View
        pointerEvents="none"
        style={[
          heroShadowStyle,
          heroContainerStyle,
          {
            left: 0,
            overflow: "hidden",
            position: "absolute",
            right: 0,
            top: 0,
            zIndex: 0,
          },
        ]}
      >
        <Animated.View
          style={[
            heroMediaStyle,
            {
              bottom: 0,
              left: 0,
              position: "absolute",
              right: 0,
              top: 0,
            },
          ]}
        >
          <Image
            source={activeHeroImage}
            contentFit="cover"
            transition={220}
            cachePolicy="memory-disk"
            style={{ height: "100%", width: "100%" }}
          />
        </Animated.View>
      </Animated.View>

      <SafeAreaView className="flex-1" edges={["left", "right", "bottom"]}>
        <Animated.View
          pointerEvents="box-none"
          style={[
            heroContainerStyle,
            {
              elevation: 12,
              left: 0,
              overflow: "hidden",
              position: "absolute",
              right: 0,
              top: 0,
              zIndex: 12,
            },
          ]}
        >
          <StoryHeroSection
            heroHeight={heroHeightExpanded}
            insetsTop={insets.top}
            onBack={() => router.back()}
            onNext={() => cycleSlide(1)}
            onPrevious={() => cycleSlide(-1)}
            totalImages={gallery.length}
          />
        </Animated.View>

        <Animated.ScrollView
          className="flex-1"
          contentContainerStyle={{
            paddingBottom: Math.max(insets.bottom + 8, 12),
            paddingTop: heroHeightExpanded - contentOverlap,
          }}
          onScroll={handleScroll}
          scrollEventThrottle={16}
          showsVerticalScrollIndicator={false}
        >
          <Animated.View
            className="rounded-t-[36px] bg-[#FFF9FD] px-5 pb-3 pt-7"
            style={[
              sheetShadowStyle,
              sheetLiftStyle,
            ]}
          >
            <View className="bg-[#FFF9FD]" style={{ minHeight: 0 }}>
              <View className="flex-row items-start justify-between">
                <View className="flex-1 pr-4">
                  <StoryTagPill story={story} />
                  <Text className="mt-5 text-[28px] font-black leading-9 text-[#2B2233]">
                    {story.title}
                  </Text>
                  <Text className="mt-3 text-[15px] leading-7 text-[#6F657A]">
                    {story.summary}
                  </Text>
                </View>

                <View
                  className="rounded-full px-3 py-2"
                  style={{ backgroundColor: palette.accentSoft }}
                >
                  <Text className="text-[11px] font-black text-[#6F657A]">
                    {story.audioDurationLabel}
                  </Text>
                </View>
              </View>
            </View>

            <View
              className="mt-7 rounded-[32px] border border-[#F4DCE6] bg-white px-5 py-5"
              style={screenShadowStyle}
            >
              <SectionHeading
                title="Thông tin câu chuyện"
                description="Nội dung chi tiết của story nằm ngay dưới phần ảnh lớn, sau đó mới tới phần audio và video."
              />

              <View className="mt-4">
                {story.scriptParagraphs.map((paragraph, index) => (
                  <Text
                    key={`${story.id}-script-${index}`}
                    className={
                      index === story.scriptParagraphs.length - 1
                        ? "text-[15px] leading-7 text-[#51435B]"
                        : "mb-4 text-[15px] leading-7 text-[#51435B]"
                    }
                  >
                    {paragraph}
                  </Text>
                ))}
              </View>
            </View>

            <View
              className="mt-7 overflow-hidden rounded-[32px]"
              style={screenShadowStyle}
            >
              <LinearGradient
                colors={[palette.accentSoft, "#FFFFFF"]}
                end={{ x: 1, y: 1 }}
                start={{ x: 0, y: 0 }}
                className="px-5 py-5"
              >
                <View className="flex-row items-start justify-between">
                  <View className="flex-1 pr-4">
                    <Text className="text-[18px] font-black text-[#2B2233]">
                      Đoạn audio
                    </Text>
                  </View>
                </View>

                <View className="mt-4 flex-row items-center rounded-[24px] bg-white/78 px-4 py-4">
                  <View
                    className="h-14 w-14 items-center justify-center rounded-full"
                    style={{ backgroundColor: palette.accent }}
                  >
                    <SymbolView
                      name={
                        {
                          ios: "play.fill",
                          android: "play_arrow",
                          web: "play_arrow",
                        } as SymbolName
                      }
                      size={24}
                      tintColor="#FFFFFF"
                    />
                  </View>

                  <View className="ml-4 flex-1">
                    <Text className="text-[15px] font-black text-[#2B2233]">
                      {story.audioTitle}
                    </Text>
                    <Text className="mt-1 text-[13px] leading-5 text-[#7C7286]">
                      Transcript và player có thể đặt ở đây.
                    </Text>
                  </View>
                </View>

                <WaveformPreview accent={palette.accent} />

                <Pressable className="mt-4 overflow-hidden rounded-full">
                  <LinearGradient
                    colors={palette.buttonColors}
                    end={{ x: 1, y: 0.5 }}
                    start={{ x: 0, y: 0.5 }}
                    className="flex-row items-center justify-center px-5 py-4"
                  >
                    <SymbolView
                      name={
                        {
                          ios: "headphones",
                          android: "headset",
                          web: "headset",
                        } as SymbolName
                      }
                      size={16}
                      tintColor="#FFFFFF"
                    />
                    <Text className="ml-2 text-[15px] font-black text-white">
                      Phát audio
                    </Text>
                  </LinearGradient>
                </Pressable>
              </LinearGradient>
            </View>

            <View
              className="mt-7 overflow-hidden rounded-[32px] border border-[#F4DCE6] bg-white"
              style={screenShadowStyle}
            >
              <View className="px-5 pb-5 pt-5">
                <SectionHeading
                  title="Đoạn video"
                  description={story.videoDescription}
                />
              </View>

              <View className="px-5 pb-5">
                <View className="overflow-hidden rounded-[26px] bg-[#F7EFF6]">
                  <Image
                    source={story.videoPoster}
                    contentFit="cover"
                    transition={120}
                    cachePolicy="memory-disk"
                    style={{ height: 204, width: "100%" }}
                  />
                  <LinearGradient
                    colors={[
                      "rgba(31, 24, 37, 0.04)",
                      "rgba(31, 24, 37, 0.62)",
                    ]}
                    end={{ x: 0.5, y: 1 }}
                    start={{ x: 0.5, y: 0 }}
                    style={{
                      bottom: 0,
                      left: 0,
                      position: "absolute",
                      right: 0,
                      top: 0,
                    }}
                  />
                  <View className="absolute left-0 right-0 top-0 items-end px-4 pt-4">
                    <View className="rounded-full bg-white/90 px-3 py-2">
                      <Text className="text-[11px] font-black text-[#5F5367]">
                        {story.videoDurationLabel}
                      </Text>
                    </View>
                  </View>
                  <View className="absolute bottom-0 left-0 right-0 flex-row items-end justify-between px-4 pb-4">
                    <View className="flex-1 pr-4">
                      <Text className="text-[18px] font-black text-white">
                        {story.videoTitle}
                      </Text>
                    </View>
                    <View className="h-14 w-14 items-center justify-center rounded-full bg-white/92">
                      <SymbolView
                        name={
                          {
                            ios: "play.fill",
                            android: "play_arrow",
                            web: "play_arrow",
                          } as SymbolName
                        }
                        size={24}
                        tintColor={palette.accent}
                      />
                    </View>
                  </View>
                </View>

                <Pressable
                  className="mt-4 items-center rounded-full border px-5 py-4"
                  style={{
                    backgroundColor: palette.accentSoft,
                    borderColor: `${palette.accent}22`,
                  }}
                >
                  <Text
                    className="text-[15px] font-black"
                    style={{ color: palette.accent }}
                  >
                    Xem video
                  </Text>
                </Pressable>
              </View>
            </View>
          </Animated.View>
        </Animated.ScrollView>
      </SafeAreaView>

      <StoryHeroHeader
        activeIndex={activeIndex}
        insetsTop={insets.top}
        onBack={() => router.back()}
        subtitle={story.tagLabel}
        title={hotspot.title}
        totalImages={gallery.length}
      />
    </View>
  );
}
