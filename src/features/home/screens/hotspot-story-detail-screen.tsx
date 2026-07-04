import { useEvent, useEventListener } from "expo";
import { setAudioModeAsync, useAudioPlayer, useAudioPlayerStatus } from "expo-audio";
import { Image } from "expo-image";
import { LinearGradient } from "expo-linear-gradient";
import { useLocalSearchParams, useRouter } from "expo-router";
import { StatusBar } from "expo-status-bar";
import { SymbolView } from "@/components/ui/symbol-view";
import { VideoView, useVideoPlayer } from "expo-video";
import { useCallback, useEffect, useState, type ComponentProps } from "react";
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
  getValidAccessToken,
  useAuthSession,
} from "@/features/auth/hooks/use-auth-session";

import { getUnlockedHotspotStories } from "../api/get-hotspot-stories";
import { getCachedHotspotDetail } from "../data/hotspot-detail-cache";
import {
  cacheHotspotStories,
  getCachedHotspotStories,
} from "../data/hotspot-story-cache";
import {
  buildHotspotThemeStoriesFromApi,
  getHotspotThemeStory,
  type HotspotThemeStory,
  type StoryThemeTag,
} from "../data/hotspot-theme-stories";
import { getHotspotBySlug } from "../data/hotspots";
import { resolveSelectedHotspotId } from "../utils/resolve-selected-hotspot-id";

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

function isHttpUrl(value?: string | null): value is string {
  return typeof value === "string" && /^https?:\/\//i.test(value.trim());
}

function clampNumber(value: number, minimum: number, maximum: number) {
  return Math.min(Math.max(value, minimum), maximum);
}

function formatPlaybackTime(totalSeconds: number) {
  if (!Number.isFinite(totalSeconds) || totalSeconds <= 0) {
    return "0:00";
  }

  const roundedSeconds = Math.floor(totalSeconds);
  const seconds = roundedSeconds % 60;
  const minutes = Math.floor(roundedSeconds / 60) % 60;
  const hours = Math.floor(roundedSeconds / 3600);
  const paddedSeconds = `${seconds}`.padStart(2, "0");

  if (hours > 0) {
    return `${hours}:${`${minutes}`.padStart(2, "0")}:${paddedSeconds}`;
  }

  return `${minutes}:${paddedSeconds}`;
}

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
            <Text className="mt-3 text-center text-[15px] leading-6 text-[#6F657A]">
              Story này không còn trong dữ liệu hiện tại hoặc đường dẫn chưa
              đúng.
            </Text>
            <Pressable
              className="mt-6 items-center rounded-full bg-[#FFF0F6] px-5 py-3.5"
              onPress={() => router.back()}
            >
              <Text className="text-[15px] font-black text-[#EB489B]">
                Quay lại danh sách
              </Text>
            </Pressable>
          </View>
        </View>
      </SafeAreaView>
    </View>
  );
}

function LoadingState() {
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
              Đang tải story
            </Text>
            <Text className="mt-3 text-center text-[15px] leading-6 text-[#6F657A]">
              Hệ thống đang lấy nội dung story thật của hotspot này.
            </Text>
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
        className="ml-2 text-[13px] font-black uppercase tracking-[0.7px]"
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
      <Text className="text-[19px] font-black text-[#2B2233]">{title}</Text>
      <Text className="mt-1.5 text-[15px] leading-6 text-[#7C7286]">
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
  insetsTop,
  onBack,
  onNext,
  onPrevious,
  totalImages,
}: {
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
          className="h-11 w-11 items-center justify-center rounded-full border border-white/20 bg-black/24"
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
            className="absolute left-4 h-12 w-12 items-center justify-center rounded-full border border-white/20 bg-black/24"
            hitSlop={8}
            onPress={onPrevious}
            style={{
              top: "50%",
              transform: [{ translateY: -24 }],
            }}
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
            className="absolute right-4 h-12 w-12 items-center justify-center rounded-full border border-white/20 bg-black/24"
            hitSlop={8}
            onPress={onNext}
            style={{
              top: "50%",
              transform: [{ translateY: -24 }],
            }}
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
              className="text-center text-[17px] font-black text-white"
              numberOfLines={1}
            >
              {title}
            </Text>
            <Text
              className="mt-0.5 text-center text-[12px] font-semibold uppercase tracking-[1px] text-[#D9F0FF]"
              numberOfLines={1}
            >
              {subtitle}
            </Text>
          </View>

          <View className="min-w-[44px] items-end">
            {totalImages > 1 ? (
              <Text className="text-[14px] font-black text-white">
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
  const authSession = useAuthSession();
  const insets = useSafeAreaInsets();
  const { height: screenHeight } = useWindowDimensions();
  const { hotspotId, slug, storyId } = useLocalSearchParams<{
    hotspotId?: string;
    slug: string;
    storyId: string;
  }>();
  const resolvedSlug = Array.isArray(slug) ? (slug[0] ?? "") : (slug ?? "");
  const resolvedHotspotId = resolveSelectedHotspotId({
    hotspotId,
    slug: resolvedSlug,
  });
  const resolvedStoryId = Array.isArray(storyId)
    ? (storyId[0] ?? "")
    : (storyId ?? "");
  const cachedHotspotEntry = getCachedHotspotDetail({
    hotspotId: resolvedHotspotId,
    slug: resolvedSlug,
  });
  const hotspot = cachedHotspotEntry?.hotspot ?? getHotspotBySlug(resolvedSlug);
  const cachedStoriesEntry = getCachedHotspotStories({
    hotspotId: resolvedHotspotId,
    slug: resolvedSlug,
  });
  const [apiStoryCards, setApiStoryCards] = useState<HotspotThemeStory[] | null>(
    () => cachedStoriesEntry?.stories ?? null,
  );
  const [isStoriesLoading, setIsStoriesLoading] = useState(
    () => cachedStoriesEntry === null && resolvedHotspotId !== null,
  );

  useEffect(() => {
    if (!hotspot) {
      return;
    }

    const resolvedHotspot = hotspot;
    let isActive = true;

    async function loadHotspotStories() {
      const nextCachedStoriesEntry = getCachedHotspotStories({
        hotspotId: resolvedHotspotId,
        slug: resolvedSlug,
      });

      if (nextCachedStoriesEntry) {
        setApiStoryCards(nextCachedStoriesEntry.stories);
        setIsStoriesLoading(false);
        return;
      }

      if (resolvedHotspotId === null) {
        setApiStoryCards(null);
        setIsStoriesLoading(false);
        return;
      }

      setApiStoryCards(null);
      setIsStoriesLoading(true);

      try {
        const accessToken = authSession.isAuthenticated
          ? await getValidAccessToken()
          : null;
        const stories = await getUnlockedHotspotStories({
          accessToken,
          hotspotId: resolvedHotspotId,
          tokenType: authSession.tokenType,
        });
        const mappedStories = buildHotspotThemeStoriesFromApi(
          resolvedHotspot,
          stories,
        );

        cacheHotspotStories({
          hotspotId: resolvedHotspotId,
          slug: resolvedSlug,
          stories: mappedStories,
        });

        if (!isActive) {
          return;
        }

        setApiStoryCards(mappedStories);
      } catch (error) {
        console.warn("[hotspot-story-detail] load hotspot stories failed", {
          error: error instanceof Error ? error.message : error,
          hotspotId: resolvedHotspotId,
          slug: resolvedSlug,
          storyId: resolvedStoryId,
        });

        if (!isActive) {
          return;
        }

        setApiStoryCards(null);
      } finally {
        if (isActive) {
          setIsStoriesLoading(false);
        }
      }
    }

    void loadHotspotStories();

    return () => {
      isActive = false;
    };
  }, [
    authSession.isAuthenticated,
    authSession.tokenType,
    hotspot,
    resolvedHotspotId,
    resolvedSlug,
    resolvedStoryId,
  ]);

  const story =
    apiStoryCards?.find((item) => item.id === resolvedStoryId) ??
    (hotspot ? getHotspotThemeStory(hotspot, resolvedStoryId) : null);
  const gallery =
    story?.heroGallery && story.heroGallery.length > 0
      ? story.heroGallery
      : story?.gallery && story.gallery.length > 0
        ? story.gallery
      : story?.videoPoster
        ? [story.videoPoster]
        : [];
  const safeTotalImages = Math.max(gallery.length, 1);
  const [gallerySelection, setGallerySelection] = useState<{
    index: number;
    storyId: string;
  }>({
    index: 0,
    storyId: resolvedStoryId,
  });
  const activeIndex =
    gallerySelection.storyId === resolvedStoryId
      ? clampNumber(gallerySelection.index, 0, safeTotalImages - 1)
      : 0;
  const activeHeroImage = gallery[activeIndex] ?? gallery[0];
  const heroHeightExpanded = screenHeight + insets.bottom;
  const heroHeightCollapsed = clampNumber(screenHeight * 0.34, 250, 320);
  const collapseDistance = Math.max(
    heroHeightExpanded - heroHeightCollapsed,
    1,
  );
  const detailTopSpacing = 0;
  const scrollY = useSharedValue(0);

  const cycleSlide = (direction: -1 | 1) => {
    setGallerySelection((current) => {
      const currentIndex =
        current.storyId === resolvedStoryId ? current.index : 0;

      return {
        index: (currentIndex + direction + safeTotalImages) % safeTotalImages,
        storyId: resolvedStoryId,
      };
    });
  };
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
  const handleScroll = useAnimatedScrollHandler({
    onScroll: (event) => {
      // eslint-disable-next-line react-hooks/immutability
      scrollY.value = event.contentOffset.y;
    },
  });
  const palette = getStoryPalette(story?.tag ?? "history");
  const hasAudioUrl = isHttpUrl(story?.audioUrl);
  const hasVideoUrl = isHttpUrl(story?.videoUrl);
  const audioSource = hasAudioUrl ? story.audioUrl!.trim() : null;
  const videoSource = hasVideoUrl ? story.videoUrl!.trim() : null;
  const audioPlayer = useAudioPlayer(audioSource, {
    updateInterval: 250,
  });
  const audioStatus = useAudioPlayerStatus(audioPlayer);
  const videoPlayer = useVideoPlayer(videoSource, (player) => {
    player.loop = false;
    player.muted = false;
    player.showNowPlayingNotification = false;
    player.timeUpdateEventInterval = 0.25;
  });
  const videoStatusEvent = useEvent(videoPlayer, "statusChange", {
    error: undefined,
    status: videoPlayer.status,
  });
  const audioProgress =
    audioStatus.duration > 0
      ? clampNumber(audioStatus.currentTime / audioStatus.duration, 0, 1)
      : 0;
  const audioCurrentTimeLabel = formatPlaybackTime(audioStatus.currentTime);
  const audioDurationTimeLabel =
    audioStatus.duration > 0
      ? formatPlaybackTime(audioStatus.duration)
      : story?.audioDurationLabel ?? "0:00";
  const audioPrimaryActionLabel = !hasAudioUrl
    ? "Chưa có audio API"
    : audioStatus.isBuffering
      ? "Đang tải audio..."
      : audioStatus.playing
        ? "Tạm dừng"
        : audioStatus.didJustFinish
          ? "Phát lại"
          : "Phát audio";
  const videoErrorMessage = videoStatusEvent.error?.message ?? null;

  useEffect(() => {
    void setAudioModeAsync({
      interruptionMode: "duckOthers",
      playsInSilentMode: true,
      shouldPlayInBackground: false,
    });
  }, []);

  useEventListener(videoPlayer, "playingChange", ({ isPlaying }) => {
    if (isPlaying) {
      audioPlayer.pause();
    }
  });

  const handleToggleAudioPlayback = useCallback(async () => {
    if (!hasAudioUrl) {
      return;
    }

    videoPlayer.pause();

    if (audioStatus.playing) {
      audioPlayer.pause();
      return;
    }

    if (audioStatus.didJustFinish) {
      await audioPlayer.seekTo(0);
    }

    audioPlayer.play();
  }, [
    audioPlayer,
    audioStatus.didJustFinish,
    audioStatus.playing,
    hasAudioUrl,
    videoPlayer,
  ]);

  const handleSeekAudio = useCallback(
    async (offsetSeconds: number) => {
      if (!hasAudioUrl) {
        return;
      }

      const rawNextTime = audioStatus.currentTime + offsetSeconds;
      const nextTime =
        audioStatus.duration > 0
          ? clampNumber(rawNextTime, 0, audioStatus.duration)
          : Math.max(0, rawNextTime);

      await audioPlayer.seekTo(nextTime);
    },
    [audioPlayer, audioStatus.currentTime, audioStatus.duration, hasAudioUrl],
  );

  const handleResetAudio = useCallback(async () => {
    if (!hasAudioUrl) {
      return;
    }

    audioPlayer.pause();
    await audioPlayer.seekTo(0);
  }, [audioPlayer, hasAudioUrl]);

  if (!hotspot) {
    return <NotFoundState />;
  }

  if (!story || !activeHeroImage) {
    if (isStoriesLoading) {
      return <LoadingState />;
    }

    return <NotFoundState />;
  }

  return (
    <View className="flex-1 bg-white">
      <StatusBar style="light" />

      <Animated.View
        pointerEvents="none"
        style={[
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
            insetsTop={insets.top}
            onBack={() => router.back()}
            onNext={() => cycleSlide(1)}
            onPrevious={() => cycleSlide(-1)}
            totalImages={gallery.length}
          />
        </Animated.View>

        <Animated.ScrollView
          className="flex-1"
          bounces={false}
          contentContainerStyle={{
            paddingBottom: Math.max(insets.bottom + 8, 12),
            paddingTop: heroHeightExpanded + detailTopSpacing,
          }}
          onScroll={handleScroll}
          overScrollMode="never"
          scrollEventThrottle={16}
          showsVerticalScrollIndicator={false}
        >
          <Animated.View
            className="bg-[#FFF9FD] px-5 pb-4 pt-5"
            style={{
              minHeight: screenHeight + 120,
              overflow: "hidden",
            }}
          >
            <View className="bg-[#FFF9FD]" style={{ minHeight: 0 }}>
              <View className="flex-row items-center justify-between gap-3">
                <StoryTagPill story={story} />
                <View
                  className="rounded-full px-3 py-2"
                  style={{ backgroundColor: palette.accentSoft }}
                >
                  <Text className="text-[12px] font-black text-[#6F657A]">
                    {story.audioDurationLabel}
                  </Text>
                </View>
              </View>

              <Text className="mt-5 text-[28px] font-black leading-9 text-[#2B2233]">
                {story.title}
              </Text>
              <Text
                className="mt-3 text-[16px] leading-7 text-[#6F657A]"
                style={{ textAlign: "justify" }}
              >
                {story.summary}
              </Text>
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
                    <Text className="text-[19px] font-black text-[#2B2233]">
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
                    <Text className="text-[16px] font-black text-[#2B2233]">
                      {story.audioTitle}
                    </Text>
                    <Text className="mt-1 text-[14px] leading-5 text-[#7C7286]">
                      {story.audioDescription}
                    </Text>
                  </View>
                </View>

                <WaveformPreview accent={palette.accent} />

                <View className="mt-4 rounded-[24px] bg-white/85 px-4 py-4">
                  <View className="flex-row items-center justify-between">
                    <Text className="text-[14px] font-bold text-[#5C4D67]">
                      {audioCurrentTimeLabel}
                    </Text>
                    <Text className="text-[14px] font-bold text-[#5C4D67]">
                      {audioDurationTimeLabel}
                    </Text>
                  </View>

                  <View className="mt-3 h-2 overflow-hidden rounded-full bg-[#F3D6E3]">
                    <View
                      className="h-full rounded-full"
                      style={{
                        backgroundColor: palette.accent,
                        width: `${audioProgress * 100}%`,
                      }}
                    />
                  </View>

                  <View className="mt-4 flex-row items-center justify-between gap-3">
                    <Pressable
                      className="min-w-[84px] items-center rounded-full bg-white px-4 py-3"
                      disabled={!hasAudioUrl}
                      onPress={() => void handleSeekAudio(-10)}
                      style={{ opacity: hasAudioUrl ? 1 : 0.52 }}
                    >
                      <Text className="text-[14px] font-black text-[#6F657A]">-10s</Text>
                    </Pressable>

                    <Pressable
                      className="min-w-[132px] overflow-hidden rounded-full"
                      disabled={!hasAudioUrl}
                      onPress={() => void handleToggleAudioPlayback()}
                      style={{ opacity: hasAudioUrl ? 1 : 0.56 }}
                    >
                      <LinearGradient
                        colors={palette.buttonColors}
                        end={{ x: 1, y: 0.5 }}
                        start={{ x: 0, y: 0.5 }}
                        className="flex-row items-center justify-center px-5 py-4"
                      >
                        <SymbolView
                          name={
                            audioStatus.playing
                              ? ({
                                  ios: "pause.fill",
                                  android: "pause",
                                  web: "pause",
                                } as SymbolName)
                              : ({
                                  ios: "play.fill",
                                  android: "play_arrow",
                                  web: "play_arrow",
                                } as SymbolName)
                          }
                          size={18}
                          tintColor="#FFFFFF"
                        />
                        <Text className="ml-2 text-[16px] font-black text-white">
                          {audioPrimaryActionLabel}
                        </Text>
                      </LinearGradient>
                    </Pressable>

                    <Pressable
                      className="min-w-[84px] items-center rounded-full bg-white px-4 py-3"
                      disabled={!hasAudioUrl}
                      onPress={() => void handleSeekAudio(10)}
                      style={{ opacity: hasAudioUrl ? 1 : 0.52 }}
                    >
                      <Text className="text-[14px] font-black text-[#6F657A]">+10s</Text>
                    </Pressable>
                  </View>

                  <View className="mt-3 flex-row items-center justify-center">
                    <Pressable
                      className="rounded-full px-4 py-2"
                      disabled={!hasAudioUrl}
                      onPress={() => void handleResetAudio()}
                      style={{ opacity: hasAudioUrl ? 1 : 0.52 }}
                    >
                      <Text className="text-[14px] font-bold text-[#7C7286]">
                        Về đầu
                      </Text>
                    </Pressable>
                  </View>
                </View>

                {!hasAudioUrl ? (
                  <Text className="mt-4 text-[14px] leading-5 text-[#A16207]">
                    Story này chưa có file audio từ API, nên phần player chỉ hiển thị khung chờ.
                  </Text>
                ) : null}

                {audioStatus.error ? (
                  <Text className="mt-4 text-[14px] leading-5 text-[#C2410C]">
                    {audioStatus.error}
                  </Text>
                ) : null}
              </LinearGradient>
            </View>

            <View
              className="mt-7 rounded-[32px] border border-[#F4DCE6] bg-white px-5 py-5"
              style={screenShadowStyle}
            >
              <SectionHeading
                title="Thông tin câu chuyện"
                description="Nội dung chi tiết của story nằm dưới phần audio, sau đó mới tới video."
              />

              <View className="mt-4">
                {story.scriptParagraphs.map((paragraph, index) => (
                  <Text
                    key={`${story.id}-script-${index}`}
                    className={
                      index === story.scriptParagraphs.length - 1
                        ? "text-[16px] leading-7 text-[#51435B]"
                        : "mb-4 text-[16px] leading-7 text-[#51435B]"
                    }
                    style={{ textAlign: "justify" }}
                  >
                    {paragraph}
                  </Text>
                ))}
              </View>
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
                  {hasVideoUrl ? (
                    <VideoView
                      player={videoPlayer}
                      contentFit="cover"
                      nativeControls
                      style={{ height: 204, width: "100%" }}
                    />
                  ) : (
                    <>
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
                      <View className="absolute bottom-0 left-0 right-0 flex-row items-end justify-between px-4 pb-4">
                        <View className="flex-1 pr-4">
                          <Text className="text-[19px] font-black text-white">
                            {story.videoTitle}
                          </Text>
                        </View>
                        <View className="h-14 w-14 items-center justify-center rounded-full bg-white/92">
                          <SymbolView
                            name={
                              {
                                ios: "play.slash.fill",
                                android: "block",
                                web: "block",
                              } as SymbolName
                            }
                            size={22}
                            tintColor={palette.accent}
                          />
                        </View>
                      </View>
                    </>
                  )}
                </View>

                <View className="mt-4 rounded-[22px] bg-[#FAF5F8] px-4 py-4">
                  <View className="flex-row items-center justify-between gap-3">
                    <View className="flex-1">
                      <Text className="text-[16px] font-black text-[#2B2233]">
                        {story.videoTitle}
                      </Text>
                      <Text className="mt-1 text-[14px] leading-5 text-[#7C7286]">
                        {hasVideoUrl
                          ? "Dùng điều khiển ngay trên khung video để phát, tua hoặc phóng to."
                          : "Story này chưa có file video từ API."}
                      </Text>
                    </View>
                    <View
                      className="rounded-full px-3 py-2"
                      style={{ backgroundColor: palette.accentSoft }}
                    >
                      <Text
                        className="text-[12px] font-black"
                        style={{ color: palette.accent }}
                      >
                        {story.videoDurationLabel}
                      </Text>
                    </View>
                  </View>

                  {videoStatusEvent.status === "loading" ? (
                    <Text className="mt-3 text-[14px] leading-5 text-[#7C7286]">
                      Đang tải dữ liệu video...
                    </Text>
                  ) : null}

                  {videoErrorMessage ? (
                    <Text className="mt-3 text-[14px] leading-5 text-[#C2410C]">
                      {videoErrorMessage}
                    </Text>
                  ) : null}
                </View>
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
