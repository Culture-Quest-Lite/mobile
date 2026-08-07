import { AppLoadingScreen } from "@/components/ui/app-loading-screen";
import { SymbolView } from "@/components/ui/symbol-view";
import { ScreenHorizontalPadding } from "@/constants/theme";
import { useEvent, useEventListener } from "expo";
import {
  setAudioModeAsync,
  useAudioPlayer,
  useAudioPlayerStatus,
} from "expo-audio";
import { Image } from "expo-image";
import { useLocalSearchParams, useRouter } from "expo-router";
import { StatusBar } from "expo-status-bar";
import { VideoView, useVideoPlayer } from "expo-video";
import { useEffect, useState, type ComponentProps } from "react";
import {
  ActivityIndicator,
  Pressable,
  Text as RNText,
  ScrollView,
  View,
  useWindowDimensions,
  type TextProps,
} from "react-native";
import Animated, {
  Easing,
  cancelAnimation,
  useAnimatedStyle,
  useSharedValue,
  withRepeat,
  withTiming,
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
import { ReviewMediaViewer } from "../components/review-media-viewer";
import { getCachedHotspotDetail } from "../data/hotspot-detail-cache";
import {
  cacheHotspotStories,
  getCachedHotspotStories,
} from "../data/hotspot-story-cache";
import {
  buildHotspotThemeStoriesFromApi,
  getHotspotThemeStory,
  type HotspotThemeStory,
} from "../data/hotspot-theme-stories";
import { getHotspotBySlug } from "../data/hotspots";
import {
  resolveRouteIdParam,
  resolveSelectedHotspotId,
} from "../utils/resolve-selected-hotspot-id";

type SymbolName = ComponentProps<typeof SymbolView>["name"];
type StoryImageSource = ComponentProps<typeof Image>["source"];

const detailTextMaxFontSizeMultiplier = 1.05;
const pageBackground = "#FFF9FD";
const detailPalette = {
  accent: "#181412",
  accentSoft: "#F4EBE4",
  audioSurface: "#FFF0F6",
  audioSurfaceStrong: "#FFE3F0",
  mutedText: "#7A6F67",
  surfaceStrong: "#FAF3ED",
  vinylCenter: "#F3E0CF",
};

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

function Text({
  maxFontSizeMultiplier = detailTextMaxFontSizeMultiplier,
  style,
  ...props
}: TextProps) {
  return (
    <RNText
      maxFontSizeMultiplier={maxFontSizeMultiplier}
      style={[{ includeFontPadding: false }, style]}
      {...props}
    />
  );
}

function isHttpUrl(value?: string | null): value is string {
  return typeof value === "string" && /^https?:\/\//i.test(value.trim());
}

function clampNumber(value: number, minimum: number, maximum: number) {
  return Math.min(Math.max(value, minimum), maximum);
}

function getStoryGalleryImages(story: HotspotThemeStory) {
  return [...story.heroGallery, ...story.gallery, story.videoPoster]
    .map((imageUri) => imageUri.trim())
    .filter(
      (imageUri, index, collection) =>
        isHttpUrl(imageUri) && collection.indexOf(imageUri) === index,
    );
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

function formatAudioDurationFallback(label?: string | null) {
  const normalizedLabel = label?.trim();

  if (!normalizedLabel) {
    return "0:00";
  }

  if (/^\d+:\d{2}(?::\d{2})?$/.test(normalizedLabel)) {
    return normalizedLabel;
  }

  const minutesMatch = normalizedLabel.match(/(\d+)\s*(?:min|phut|phút)/i);

  if (minutesMatch) {
    const minutes = Number(minutesMatch[1]);
    return Number.isFinite(minutes) ? `${minutes}:00` : "0:00";
  }

  const secondsMatch = normalizedLabel.match(
    /(\d+)\s*(?:s(?:\b|[^a-z])|sec|giay|giây)/i,
  );

  if (secondsMatch) {
    const seconds = Number(secondsMatch[1]);

    if (Number.isFinite(seconds)) {
      return `0:${`${seconds}`.padStart(2, "0")}`;
    }
  }

  return "0:00";
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
              Không tìm thấy câu chuyện
            </Text>
            <Text
              className="mt-2 text-center text-[15px] text-[#6F657A]"
              style={{ lineHeight: 18 }}
            >
              Câu chuyện này không còn trong dữ liệu hiện tại hoặc đường dẫn
              chưa đúng.
            </Text>
            <Pressable
              className="mt-6 items-center rounded-full bg-[#FFF0F6] px-6 py-4"
              onPress={() => router.back()}
            >
              <Text className="text-[16px] font-black text-[#EB489B]">
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
  return <AppLoadingScreen />;
}

function resolveStoryImageSource(story: HotspotThemeStory): StoryImageSource {
  const heroImage = story.heroGallery.find((imageUri) => imageUri.trim());
  const galleryImage = story.gallery.find((imageUri) => imageUri.trim());
  const posterImage = story.videoPoster.trim();

  return heroImage ?? galleryImage ?? (posterImage || story.imageSource);
}

function VinylRecord({
  imageSource,
  isPlaying,
}: {
  imageSource: StoryImageSource;
  isPlaying: boolean;
}) {
  const rotation = useSharedValue(0);

  useEffect(() => {
    if (isPlaying) {
      rotation.value = 0;
      rotation.value = withRepeat(
        withTiming(1, {
          duration: 4200,
          easing: Easing.linear,
        }),
        -1,
        false,
      );
    } else {
      cancelAnimation(rotation);
    }

    return () => {
      cancelAnimation(rotation);
    };
  }, [isPlaying, rotation]);

  const rotatingDiscStyle = useAnimatedStyle(() => ({
    transform: [{ rotate: `${rotation.value * 360}deg` }],
  }));

  return (
    <View
      style={{
        alignItems: "center",
        height: 260,
        justifyContent: "center",
        shadowColor: "rgba(24, 20, 18, 0.3)",
        shadowOffset: { width: 0, height: 18 },
        shadowOpacity: 1,
        shadowRadius: 30,
        width: 260,
      }}
    >
      <Animated.View
        style={[
          {
            alignItems: "center",
            backgroundColor: detailPalette.accent,
            borderRadius: 128,
            height: 260,
            justifyContent: "center",
            width: 260,
          },
          rotatingDiscStyle,
        ]}
      >
        {[220, 180, 140].map((size) => (
          <View
            key={`vinyl-ring-${size}`}
            pointerEvents="none"
            style={{
              borderColor: "rgba(255,255,255,0.08)",
              borderRadius: size / 2,
              borderWidth: 1,
              height: size,
              position: "absolute",
              width: size,
            }}
          />
        ))}

        <View
          className="overflow-hidden"
          style={{
            borderRadius: 60,
            height: 120,
            width: 120,
          }}
        >
          <Image
            source={imageSource}
            contentFit="cover"
            contentPosition="center"
            transition={180}
            cachePolicy="memory-disk"
            style={{ height: "100%", width: "100%" }}
          />
        </View>

        <View
          style={{
            backgroundColor: "#FCFAF7",
            borderColor: detailPalette.accent,
            borderRadius: 9,
            borderWidth: 3,
            height: 18,
            position: "absolute",
            width: 18,
          }}
        />
      </Animated.View>
    </View>
  );
}

function StoryAlbumTile({
  imageUri,
  onPress,
  overlayLabel,
  style,
}: {
  imageUri: string;
  onPress: () => void;
  overlayLabel?: string | null;
  style?: ComponentProps<typeof View>["style"];
}) {
  return (
    <Pressable
      accessibilityLabel="Mở ảnh chi tiết"
      accessibilityRole="button"
      hitSlop={6}
      onPress={onPress}
      style={style}
    >
      <View
        className="h-full w-full overflow-hidden rounded-[16px]"
        style={{
          borderColor: "rgba(249,115,174,0.12)",
          borderWidth: 1,
        }}
      >
        <Image
          source={imageUri}
          contentFit="cover"
          contentPosition="center"
          transition={180}
          cachePolicy="memory-disk"
          style={{ height: "100%", width: "100%" }}
        />

        {overlayLabel ? (
          <View className="absolute inset-0 items-center justify-center bg-black/40">
            <Text className="text-[24px] font-black text-white">
              {overlayLabel}
            </Text>
          </View>
        ) : null}
      </View>
    </Pressable>
  );
}

function StoryPhotoAlbum({
  images,
  onSelectImage,
}: {
  images: string[];
  onSelectImage: (index: number) => void;
}) {
  if (images.length === 0) {
    return null;
  }

  const firstImage = images[0] ?? null;
  const secondImage = images[1] ?? null;
  const thirdImage = images[2] ?? null;
  const extraImageCount = Math.max(images.length - 3, 0);

  return (
    <View className="mt-3">
      {firstImage && !secondImage ? (
        <StoryAlbumTile
          imageUri={firstImage}
          onPress={() => onSelectImage(0)}
          style={{ height: 224 }}
        />
      ) : null}

      {firstImage && secondImage ? (
        <View className="flex-row" style={{ columnGap: 8 }}>
          <StoryAlbumTile
            imageUri={firstImage}
            onPress={() => onSelectImage(0)}
            style={{ flex: 1, height: 192 }}
          />

          <View style={{ flex: 1, rowGap: 8 }}>
            <StoryAlbumTile
              imageUri={secondImage}
              onPress={() => onSelectImage(1)}
              style={{
                flex: thirdImage ? undefined : 1,
                height: thirdImage ? 92 : 192,
              }}
            />

            {thirdImage ? (
              <StoryAlbumTile
                imageUri={thirdImage}
                onPress={() => onSelectImage(2)}
                overlayLabel={
                  extraImageCount > 0 ? `+${extraImageCount}` : null
                }
                style={{ height: 92 }}
              />
            ) : null}
          </View>
        </View>
      ) : null}
    </View>
  );
}

function AudioMetadataChip({
  icon,
  label,
}: {
  icon: SymbolName;
  label: string;
}) {
  return (
    <View
      className="flex-row items-center rounded-full px-2.5 py-1"
      style={{ backgroundColor: "#F8EFE8" }}
    >
      <SymbolView name={icon} size={12} tintColor="#9C6B3D" />
      <Text
        className="ml-1 text-[12px] font-semibold"
        style={{ color: "#6D563D", lineHeight: 12 }}
      >
        {label}
      </Text>
    </View>
  );
}

function StoryAudioOverviewCard({
  durationLabel,
  hotspotName,
  tagLabel,
}: {
  durationLabel: string;
  hotspotName: string;
  tagLabel?: string | null;
}) {
  const normalizedTagLabel = tagLabel?.trim();
  const normalizedHotspotName = hotspotName.trim() || "Hotspot";

  return (
    <View className="px-1 py-1">
      <View className="flex-row items-start">
        <View
          className="h-10 w-10 items-center justify-center rounded-full"
          style={{ backgroundColor: "#FFF3E9" }}
        >
          <SymbolView
            name={
              {
                ios: "headphones",
                android: "headset",
                web: "headset",
              } as SymbolName
            }
            size={18}
            tintColor="#C77B30"
          />
        </View>

        <View className="ml-3 flex-1">
          <Text
            className="text-[18px] font-semibold text-[#2D241D]"
            style={{ lineHeight: 16 }}
          >
            Nghe câu chuyện
          </Text>
          <Text
            className="mt-[-1px] text-[13px]"
            style={{ color: "#7A6F67", lineHeight: 14 }}
          >
            Nghe thuyết minh để hiểu hơn về câu chuyện.
          </Text>
        </View>
      </View>

      <View className="mt-2 flex-row flex-wrap justify-center gap-2">
        {normalizedTagLabel ? (
          <AudioMetadataChip
            icon={
              {
                ios: "book.closed",
                android: "history_edu",
                web: "history_edu",
              } as SymbolName
            }
            label={normalizedTagLabel}
          />
        ) : null}
        <AudioMetadataChip
          icon={
            {
              ios: "clock",
              android: "schedule",
              web: "schedule",
            } as SymbolName
          }
          label={durationLabel}
        />
        <AudioMetadataChip
          icon={
            {
              ios: "mappin.and.ellipse",
              android: "place",
              web: "place",
            } as SymbolName
          }
          label={normalizedHotspotName}
        />
      </View>
    </View>
  );
}

export default function HotspotStoryDetailScreen() {
  const router = useRouter();
  const authSession = useAuthSession();
  const insets = useSafeAreaInsets();
  const { height: screenHeight } = useWindowDimensions();
  const { hotspotId, routeId, slug, storyId } = useLocalSearchParams<{
    hotspotId?: string;
    routeId?: string;
    slug: string;
    storyId: string;
  }>();
  const resolvedSlug = Array.isArray(slug) ? (slug[0] ?? "") : (slug ?? "");
  const resolvedHotspotId = resolveSelectedHotspotId({
    hotspotId,
    slug: resolvedSlug,
  });
  const resolvedRouteId = resolveRouteIdParam(routeId);
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
    routeId: resolvedRouteId,
    slug: resolvedSlug,
  });
  const [apiStoryCards, setApiStoryCards] = useState<
    HotspotThemeStory[] | null
  >(() => cachedStoriesEntry?.stories ?? null);
  const [isStoriesLoading, setIsStoriesLoading] = useState(
    () => cachedStoriesEntry === null && resolvedHotspotId !== null,
  );
  const [audioTrackWidth, setAudioTrackWidth] = useState(0);
  const [descriptionExpandedStoryId, setDescriptionExpandedStoryId] = useState<
    string | null
  >(null);
  const [audioScriptExpandedStoryId, setAudioScriptExpandedStoryId] = useState<
    string | null
  >(null);
  const [gallerySelection, setGallerySelection] = useState<{
    index: number;
    storyId: string;
  }>({
    index: 0,
    storyId: resolvedStoryId,
  });
  const [imageViewerState, setImageViewerState] = useState<{
    initialIndex: number;
    isVisible: boolean;
    storyId: string;
  }>({
    initialIndex: 0,
    isVisible: false,
    storyId: resolvedStoryId,
  });

  useEffect(() => {
    if (!hotspot) {
      return;
    }

    const resolvedHotspot = hotspot;
    let isActive = true;

    async function loadHotspotStories() {
      const nextCachedStoriesEntry = getCachedHotspotStories({
        hotspotId: resolvedHotspotId,
        routeId: resolvedRouteId,
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
          routeId: resolvedRouteId,
          tokenType: authSession.tokenType,
        });
        const mappedStories = buildHotspotThemeStoriesFromApi(
          resolvedHotspot,
          stories,
        );

        cacheHotspotStories({
          hotspotId: resolvedHotspotId,
          routeId: resolvedRouteId,
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
          routeId: resolvedRouteId,
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
    resolvedRouteId,
    resolvedSlug,
    resolvedStoryId,
  ]);

  const fallbackStory =
    resolvedHotspotId === null && hotspot
      ? getHotspotThemeStory(hotspot, resolvedStoryId)
      : null;
  const story =
    apiStoryCards?.find((item) => item.id === resolvedStoryId) ?? fallbackStory;
  const heroHeight = clampNumber(screenHeight * 0.3, 240, 300);
  const palette = detailPalette;
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
      : formatAudioDurationFallback(story?.audioDurationLabel);
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

  const handleToggleAudioPlayback = async () => {
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
  };

  const handleSeekAudio = async (offsetSeconds: number) => {
    if (!hasAudioUrl) {
      return;
    }

    const rawNextTime = audioStatus.currentTime + offsetSeconds;
    const nextTime =
      audioStatus.duration > 0
        ? clampNumber(rawNextTime, 0, audioStatus.duration)
        : Math.max(0, rawNextTime);

    await audioPlayer.seekTo(nextTime);
  };

  const handleSeekAudioToProgress = async (locationX: number) => {
    if (!hasAudioUrl || audioStatus.duration <= 0 || audioTrackWidth <= 0) {
      return;
    }

    const nextProgress = clampNumber(locationX / audioTrackWidth, 0, 1);
    await audioPlayer.seekTo(nextProgress * audioStatus.duration);
  };

  const gallery = story ? getStoryGalleryImages(story) : [];
  const safeTotalImages = Math.max(gallery.length, 1);
  const audioStatusLabel = !hasAudioUrl
    ? "Câu chuyện này chưa có bản ghi âm."
    : audioStatus.isBuffering
      ? null
      : audioStatus.playing
        ? "Đang phát bản ghi âm"
        : audioStatus.didJustFinish
          ? "Bản ghi âm đã phát xong"
          : "Nhấn để nghe";
  const videoStatusLabel = !hasVideoUrl
    ? "Câu chuyện này chưa có video."
    : undefined;

  useEffect(() => {
    if (safeTotalImages <= 1) {
      return;
    }

    const intervalId = setInterval(() => {
      setGallerySelection((current) => {
        const currentIndex =
          current.storyId === resolvedStoryId ? current.index : 0;

        return {
          index: (currentIndex + 1) % safeTotalImages,
          storyId: resolvedStoryId,
        };
      });
    }, 5500);

    return () => clearInterval(intervalId);
  }, [resolvedStoryId, safeTotalImages]);

  if (!hotspot) {
    return <NotFoundState />;
  }

  if (!story) {
    if (isStoriesLoading) {
      return <LoadingState />;
    }

    return <NotFoundState />;
  }

  const activeIndex =
    gallerySelection.storyId === resolvedStoryId
      ? clampNumber(gallerySelection.index, 0, safeTotalImages - 1)
      : 0;
  const heroImageSource =
    gallery[activeIndex] ?? resolveStoryImageSource(story);
  const imageViewerItems = gallery.map((imageUri) => ({
    type: "image" as const,
    uri: imageUri,
  }));
  const storyContentText = story.scriptParagraphs
    .map((paragraph) => paragraph.trim())
    .filter(Boolean)
    .join("\n");
  const storyDescription =
    storyContentText || story.summary.trim() || "Câu chuyện này chưa có mô tả.";
  const shouldShowDescriptionToggle =
    story.scriptParagraphs.length > 1 || storyDescription.length > 220;
  const isDescriptionExpanded = descriptionExpandedStoryId === resolvedStoryId;
  const audioScript = story.audioScript.trim();
  const shouldShowAudioScriptToggle =
    audioScript.length > 220 || audioScript.includes("\n");
  const isAudioScriptExpanded = audioScriptExpandedStoryId === resolvedStoryId;
  const vinylImageSource = resolveStoryImageSource(story);
  const isAudioDiscSpinning = audioStatus.playing || audioStatus.isBuffering;
  const rawAudioDurationChipLabel = story.audioDurationLabel.trim();
  const audioMetaDurationLabel =
    audioStatus.duration > 0
      ? formatPlaybackTime(audioStatus.duration)
      : rawAudioDurationChipLabel && rawAudioDurationChipLabel !== "Audio API"
        ? rawAudioDurationChipLabel
        : hasAudioUrl
          ? "Đang tải"
          : "Chưa có audio";
  const handleOpenImageViewer = (index: number) => {
    const nextIndex = clampNumber(index, 0, Math.max(gallery.length - 1, 0));

    setGallerySelection({
      index: nextIndex,
      storyId: resolvedStoryId,
    });
    setImageViewerState({
      initialIndex: nextIndex,
      isVisible: gallery.length > 0,
      storyId: resolvedStoryId,
    });
  };

  return (
    <View className="flex-1" style={{ backgroundColor: pageBackground }}>
      <StatusBar style="light" />

      <SafeAreaView
        className="flex-1"
        style={{ backgroundColor: pageBackground }}
        edges={["left", "right", "bottom"]}
      >
        <ScrollView
          className="flex-1"
          bounces={false}
          contentContainerStyle={{
            paddingBottom: Math.max(insets.bottom + 8, 12),
          }}
          overScrollMode="never"
          showsVerticalScrollIndicator={false}
        >
          <View
            className="overflow-hidden bg-[#EFDDE8]"
            style={{ height: heroHeight }}
          >
            <Pressable
              accessibilityLabel="Mở ảnh toàn màn hình"
              accessibilityRole="button"
              disabled={gallery.length === 0}
              onPress={() => handleOpenImageViewer(activeIndex)}
              style={{ height: "100%", width: "100%" }}
            >
              <Image
                source={heroImageSource}
                contentFit="cover"
                contentPosition="center"
                transition={520}
                cachePolicy="memory-disk"
                style={{ height: "100%", width: "100%" }}
              />
            </Pressable>

            <Pressable
              className="absolute left-3 h-11 w-11 items-center justify-center"
              hitSlop={8}
              onPress={() => router.back()}
              style={{ top: insets.top + 12 }}
            >
              <View
                className="h-11 w-11 items-center justify-center rounded-full"
                style={{ backgroundColor: "rgba(255,255,255,0.14)" }}
              >
                <SymbolView
                  name={
                    {
                      ios: "xmark",
                      android: "close",
                      web: "close",
                    } as SymbolName
                  }
                  size={20}
                  tintColor="#FFFFFF"
                />
              </View>
            </Pressable>
          </View>

          <View
            style={{
              paddingHorizontal: ScreenHorizontalPadding,
              paddingTop: 6,
            }}
          >
            <View>
              <View className="mt-2 flex-row flex-wrap items-center gap-1">
                {story.tagLabel ? (
                  <View className="rounded-full bg-[#FFF0F6] px-3 py-1.5">
                    <Text
                      className="text-[13px] font-semibold"
                      style={{ color: "#D9468B", lineHeight: 14 }}
                    >
                      {story.tagLabel}
                    </Text>
                  </View>
                ) : null}
              </View>

              <Text
                className="mt-0 text-[22px] font-semibold text-[#2B2233]"
                style={{ lineHeight: 22 }}
              >
                {story.title}
              </Text>

              <View className="mt-1">
                <Text
                  className="text-[15px] text-[#6F657A]"
                  numberOfLines={isDescriptionExpanded ? undefined : 8}
                  style={{
                    lineHeight: 17,
                    textAlign: "left",
                    paddingBottom: 4,
                  }}
                >
                  {storyDescription}
                </Text>

                {shouldShowDescriptionToggle ? (
                  <Pressable
                    className="mt-2 self-end"
                    hitSlop={8}
                    onPress={() =>
                      setDescriptionExpandedStoryId((current) =>
                        current === resolvedStoryId ? null : resolvedStoryId,
                      )
                    }
                  >
                    <Text
                      className="text-[12px]"
                      style={{ color: palette.mutedText, lineHeight: 13 }}
                    >
                      {isDescriptionExpanded ? "Rút gọn" : "Xem thêm"}
                    </Text>
                  </Pressable>
                ) : null}
              </View>
            </View>

            <View className="mt-4">
              <StoryPhotoAlbum
                images={gallery}
                onSelectImage={handleOpenImageViewer}
              />
            </View>

            <View className="mt-8">
              <StoryAudioOverviewCard
                durationLabel={audioMetaDurationLabel}
                hotspotName={hotspot.title}
                tagLabel={story.tagLabel}
              />
            </View>

            <View className="mt-8">
              <View
                className="rounded-[16px] px-4 py-3"
                style={{ backgroundColor: pageBackground }}
              >
                <View className="items-center">
                  <Pressable
                    onPress={() => void handleToggleAudioPlayback()}
                    hitSlop={8}
                    style={{ alignItems: "center" }}
                  >
                    <VinylRecord
                      imageSource={vinylImageSource}
                      isPlaying={isAudioDiscSpinning}
                    />
                  </Pressable>
                  <Text
                    className="mt-1 text-center text-[18px] font-semibold text-[#201B18]"
                    style={{ lineHeight: 20 }}
                  >
                    {story.title}
                  </Text>
                  {audioStatusLabel ? (
                    <Text
                      className="mt-1 text-center text-[13px]"
                      style={{ color: palette.mutedText, lineHeight: 16 }}
                    >
                      {audioStatusLabel}
                    </Text>
                  ) : null}
                </View>

                <View className="mt-2">
                  <View className="flex-row items-center justify-between">
                    <Text className="text-[13px] font-bold text-[#6D635B]">
                      {audioCurrentTimeLabel}
                    </Text>
                    <Text className="text-[13px] font-bold text-[#6D635B]">
                      {audioDurationTimeLabel}
                    </Text>
                  </View>

                  <View
                    className="relative mt-1 h-8 justify-center"
                    onLayout={(event) => {
                      setAudioTrackWidth(event.nativeEvent.layout.width);
                    }}
                    onMoveShouldSetResponder={() => hasAudioUrl}
                    onStartShouldSetResponder={() => hasAudioUrl}
                    onResponderGrant={(event) => {
                      void handleSeekAudioToProgress(
                        event.nativeEvent.locationX,
                      );
                    }}
                    onResponderMove={(event) => {
                      void handleSeekAudioToProgress(
                        event.nativeEvent.locationX,
                      );
                    }}
                  >
                    <View className="h-[3px] rounded-full bg-[#E9C8D7]" />
                    <View
                      className="absolute left-0 top-1/2 h-[3px] rounded-full"
                      style={{
                        backgroundColor: "#EB489B",
                        transform: [{ translateY: -1.5 }],
                        width: audioTrackWidth * audioProgress,
                      }}
                    />
                    <View
                      className="absolute top-1/2 h-4 w-4 rounded-full border-2 border-white"
                      style={{
                        backgroundColor: "#EB489B",
                        left: clampNumber(
                          audioTrackWidth * audioProgress - 8,
                          0,
                          Math.max(audioTrackWidth - 16, 0),
                        ),
                        transform: [{ translateY: -8 }],
                      }}
                    />
                  </View>
                </View>

                <View className="mt-2 flex-row items-center justify-center gap-4">
                  <Pressable
                    className="h-14 w-14 items-center justify-center rounded-full"
                    disabled={!hasAudioUrl}
                    hitSlop={8}
                    onPress={() => void handleSeekAudio(-10)}
                    style={{
                      backgroundColor: palette.audioSurfaceStrong,
                      opacity: hasAudioUrl ? 1 : 0.45,
                    }}
                  >
                    <SymbolView
                      name={
                        {
                          ios: "gobackward.10",
                          android: "fast_rewind",
                          web: "fast_rewind",
                        } as SymbolName
                      }
                      size={22}
                      tintColor="#EB489B"
                    />
                  </Pressable>

                  <Pressable
                    className="h-[72px] w-[72px] items-center justify-center rounded-full"
                    disabled={!hasAudioUrl}
                    hitSlop={10}
                    onPress={() => void handleToggleAudioPlayback()}
                    style={{
                      backgroundColor: palette.accent,
                      opacity: hasAudioUrl ? 1 : 0.45,
                      shadowColor: "rgba(24, 20, 18, 0.22)",
                      shadowOffset: { width: 0, height: 10 },
                      shadowOpacity: 1,
                      shadowRadius: 18,
                      elevation: 8,
                    }}
                  >
                    {audioStatus.isBuffering ? (
                      <ActivityIndicator color="#FFFFFF" size="small" />
                    ) : (
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
                        size={28}
                        tintColor="#FFFFFF"
                      />
                    )}
                  </Pressable>

                  <Pressable
                    className="h-14 w-14 items-center justify-center rounded-full"
                    disabled={!hasAudioUrl}
                    hitSlop={8}
                    onPress={() => void handleSeekAudio(10)}
                    style={{
                      backgroundColor: palette.audioSurfaceStrong,
                      opacity: hasAudioUrl ? 1 : 0.45,
                    }}
                  >
                    <SymbolView
                      name={
                        {
                          ios: "goforward.10",
                          android: "fast_forward",
                          web: "fast_forward",
                        } as SymbolName
                      }
                      size={22}
                      tintColor="#EB489B"
                    />
                  </Pressable>
                </View>

                {audioStatus.error ? (
                  <Text
                    className="mt-3 text-center text-[14px] text-[#C2410C]"
                    style={{ lineHeight: 16 }}
                  >
                    {audioStatus.error}
                  </Text>
                ) : null}
              </View>
            </View>

            {audioScript ? (
              <View className="mt-3">
                <Text
                  className="text-[18px] font-semibold text-[#201B18]"
                  style={{ lineHeight: 20 }}
                >
                  Nội dung audio
                </Text>

                <View
                  className="mt-1 rounded-[16px] px-4 py-3"
                  style={{ backgroundColor: pageBackground }}
                >
                  <Text
                    className="text-[15px] text-[#6F657A]"
                    numberOfLines={isAudioScriptExpanded ? undefined : 10}
                    style={{
                      lineHeight: 17,
                      paddingBottom: 2,
                      textAlign: "left",
                    }}
                  >
                    {audioScript}
                  </Text>

                  {shouldShowAudioScriptToggle ? (
                    <Pressable
                      className="mt-1 self-end"
                      hitSlop={8}
                      onPress={() =>
                        setAudioScriptExpandedStoryId((current) =>
                          current === resolvedStoryId ? null : resolvedStoryId,
                        )
                      }
                    >
                      <Text
                        className="text-[12px]"
                        style={{ color: palette.mutedText, lineHeight: 13 }}
                      >
                        {isAudioScriptExpanded ? "Rút gọn" : "Xem thêm"}
                      </Text>
                    </Pressable>
                  ) : null}
                </View>
              </View>
            ) : null}

            <View className="mt-6">
              <View
                className="overflow-hidden rounded-[8px]"
                style={{ backgroundColor: palette.surfaceStrong }}
              >
                {hasVideoUrl ? (
                  <VideoView
                    player={videoPlayer}
                    contentFit="cover"
                    nativeControls
                    style={{ height: 200, width: "100%" }}
                  />
                ) : (
                  <Pressable
                    accessibilityLabel="Mở ảnh toàn màn hình"
                    accessibilityRole="button"
                    disabled={gallery.length === 0}
                    onPress={() => handleOpenImageViewer(activeIndex)}
                  >
                    <View>
                      <Image
                        source={heroImageSource}
                        contentFit="cover"
                        contentPosition="center"
                        transition={150}
                        cachePolicy="memory-disk"
                        style={{ height: 190, width: "100%" }}
                      />
                      <View className="absolute inset-0 items-center justify-center bg-black/28">
                        <View className="h-14 w-14 items-center justify-center rounded-full bg-white/90">
                          <SymbolView
                            name={
                              {
                                ios: "arrow.up.left.and.arrow.down.right",
                                android: "zoom_out_map",
                                web: "zoom_out_map",
                              } as SymbolName
                            }
                            size={22}
                            tintColor={palette.accent}
                          />
                        </View>
                      </View>
                    </View>
                  </Pressable>
                )}
              </View>

              {videoStatusLabel ? (
                <Text
                  className="mt-2 text-[15px]"
                  style={{ color: palette.mutedText, lineHeight: 18 }}
                >
                  {videoStatusLabel}
                </Text>
              ) : null}

              {videoErrorMessage ? (
                <Text
                  className="mt-1 text-[14px] text-[#C2410C]"
                  style={{ lineHeight: 16 }}
                >
                  {videoErrorMessage}
                </Text>
              ) : null}
            </View>
          </View>
        </ScrollView>
      </SafeAreaView>

      {imageViewerState.isVisible &&
      imageViewerState.storyId === resolvedStoryId &&
      imageViewerItems.length > 0 ? (
        <ReviewMediaViewer
          initialIndex={imageViewerState.initialIndex}
          items={imageViewerItems}
          onClose={() =>
            setImageViewerState((current) => ({
              ...current,
              isVisible: false,
            }))
          }
        />
      ) : null}
    </View>
  );
}
