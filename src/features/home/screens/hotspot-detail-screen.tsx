import { SymbolView } from "@/components/ui/symbol-view";
import { Image } from "expo-image";
import { LinearGradient } from "expo-linear-gradient";
import * as Linking from "expo-linking";
import { useFocusEffect, useLocalSearchParams, useRouter, type Href } from "expo-router";
import { StatusBar } from "expo-status-bar";
import {
  useCallback,
  useEffect,
  useMemo,
  useState,
  type ComponentProps,
} from "react";
import {
  ActivityIndicator,
  Platform,
  Pressable,
  Text as RNText,
  ScrollView,
  View,
  useWindowDimensions,
} from "react-native";
import MapView, {
  Marker,
  PROVIDER_GOOGLE,
  type Region,
} from "react-native-maps";
import Animated, {
  Easing,
  Extrapolation,
  ReduceMotion,
  cancelAnimation,
  interpolate,
  runOnJS,
  useAnimatedReaction,
  useAnimatedScrollHandler,
  useAnimatedStyle,
  useSharedValue,
  withRepeat,
  withTiming,
  type SharedValue,
} from "react-native-reanimated";
import {
  SafeAreaView,
  useSafeAreaInsets,
} from "react-native-safe-area-context";

import {
  getValidAccessToken,
  useAuthSession,
} from "@/features/auth/hooks/use-auth-session";
import {
  addApiCheckin,
  addCheckin,
  mergeApiCheckins,
  useCheckedInApiHotspots,
  useCheckins,
} from "@/lib/checkin-store";
import { type RouteItem } from "@/lib/demo-data";
import {
  getRoutesByHotspot,
  mapRouteToRouteItem,
} from "@/features/route/api/route-api";
import { getCheckedInHotspotIds } from "../api/get-checked-in-hotspots";
import { getHotspotById as getHotspotByIdApi } from "../api/get-hotspot-by-id";
import {
  getHotspotPosts,
  type HotspotPost,
} from "../api/get-hotspot-posts";
import type { NearbyHotspotDto } from "../api/get-nearby-hotspots";
import { HiddenStoryUnlockedContent } from "../components/hidden-story-unlocked-content";
import { HotspotGpsCheckinOverlay } from "../components/hotspot-gps-checkin-overlay";
import { avatarImageUri } from "../data/home-screen.mock";
import { cacheHotspotDetail } from "../data/hotspot-detail-cache";
import {
  useHotspotPersonalPosts,
  type HotspotPersonalPost,
} from "../data/hotspot-post-store";
import {
  getCachedHotspotStories,
} from "../data/hotspot-story-cache";
import {
  getHotspotBySlug,
  type HotspotDetail,
} from "../data/hotspots";
import { resolveSelectedHotspotId } from "../utils/resolve-selected-hotspot-id";

type SymbolName = ComponentProps<typeof SymbolView>["name"];
type HotspotCoordinate = NonNullable<HotspotDetail["coordinate"]>;
type TextProps = ComponentProps<typeof RNText>;
type PersonalExperienceMediaItem = {
  duration?: string;
  type: "image" | "video";
  uri: string;
};
type PersonalExperienceItem = {
  avatarUri: string;
  date: string;
  id: string;
  media: PersonalExperienceMediaItem[];
  rating: number;
  text: string;
  user: string;
};
type SummaryStatItem = {
  icon: SymbolName;
  isCompactValue?: boolean;
  label: string;
  value: string;
};
type PersonalExperienceComposerProps = {
  avatarUri: string;
  onPressCompose: () => void;
};
type RelatedRoutesSectionStatus =
  | "idle"
  | "loading"
  | "ready"
  | "empty";

const loginGradientColors = ["#EB489B", "#F58752", "#FFC93C"] as const;
const screenBackground = "#FFFFFF";
const panelBackground = "#FFFFFF";
const detailTextMaxFontSizeMultiplier = 1.05;
const defaultMapCoordinate = {
  latitude: 10.77712,
  longitude: 106.69531,
} as const;
const defaultRemoteHotspotImageUri =
  "https://images.unsplash.com/photo-1500530855697-b586d89ba3ee";
const meaninglessApiTextValues = new Set(["", "string", "null", "undefined"]);
const mapLoadTimeoutMs = 6000;
const recentReviewPreviewCount = 2;
const hotspotPostsPageSize = 10;
const hotspotPostsSort = ["createdAt,DESC"] as const;

const heroShadowStyle = {
  shadowColor: "rgba(15, 23, 42, 0.20)",
  shadowOpacity: 1,
  shadowRadius: 22,
  shadowOffset: {
    width: 0,
    height: 14,
  },
  elevation: Platform.OS === "android" ? 0 : 8,
} as const;

const sheetShadowStyle = {
  shadowColor: "rgba(235, 72, 155, 0.10)",
  shadowOpacity: 1,
  shadowRadius: 18,
  shadowOffset: {
    width: 0,
    height: -6,
  },
  elevation: Platform.OS === "android" ? 12 : 6,
} as const;

const cardShadowStyle = {
  shadowColor: "rgba(235, 72, 155, 0.08)",
  shadowOpacity: 1,
  shadowRadius: 14,
  shadowOffset: {
    width: 0,
    height: 10,
  },
  elevation: 4,
} as const;

const buttonShadowStyle = {
  shadowColor: "rgba(235, 72, 155, 0.22)",
  shadowOpacity: 1,
  shadowRadius: 18,
  shadowOffset: {
    width: 0,
    height: 10,
  },
  elevation: 6,
} as const;

const relatedRouteCardImageHeight = 136;
const relatedRouteCardMinHeight = 172;
const detailSheetHorizontalPadding = 23;
const relatedRouteScrollInset = detailSheetHorizontalPadding;
const reviewCardHorizontalPadding = 16;
const reviewAuthorRowHorizontalOffset = -6;
const reviewMediaGridGap = 6;
const reviewCardBorderRadius = 14;
const reviewMediaBorderRadius = 16;
const sectionEyebrowTextStyle = {
  color: "#7A6F67",
  lineHeight: 18,
} as const;
const sectionTitleTextStyle = {
  color: "#2B2233",
  lineHeight: 24,
} as const;
const sectionBodyTextStyle = {
  color: "#6F657A",
  lineHeight: 19,
} as const;
const sectionBodyEmphasisTextStyle = {
  color: "#554751",
  lineHeight: 19,
} as const;
const sectionCaptionTextStyle = {
  color: "#7A6F67",
  lineHeight: 14,
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

function readMeaningfulApiText(value?: string | null) {
  if (typeof value !== "string") {
    return null;
  }

  const trimmedValue = value.trim();

  if (!trimmedValue) {
    return null;
  }

  return meaninglessApiTextValues.has(trimmedValue.toLowerCase())
    ? null
    : trimmedValue;
}

function formatApiTimeValue(value?: string | null) {
  const meaningfulValue = readMeaningfulApiText(value);

  if (!meaningfulValue) {
    return null;
  }

  const matchedValue = meaningfulValue.match(/^\d{2}:\d{2}/);

  return matchedValue?.[0] ?? meaningfulValue;
}

function formatApiTimeWindow(start?: string | null, end?: string | null) {
  const formattedStart = formatApiTimeValue(start);
  const formattedEnd = formatApiTimeValue(end);

  if (formattedStart && formattedEnd) {
    return formattedStart === formattedEnd
      ? formattedStart
      : `${formattedStart} - ${formattedEnd}`;
  }

  return formattedStart ?? formattedEnd;
}

function resolveRemoteMediaUris(
  apiHotspot: NearbyHotspotDto,
) {
  const remoteMediaUris = [...apiHotspot.medias]
    .filter((media) => readMeaningfulApiText(media.fileUrl))
    .sort((left, right) => {
      const leftOrder = left.displayOrder ?? Number.MAX_SAFE_INTEGER;
      const rightOrder = right.displayOrder ?? Number.MAX_SAFE_INTEGER;

      return leftOrder - rightOrder;
    })
    .map((media) => media.fileUrl.trim());

  if (remoteMediaUris.length > 0) {
    return remoteMediaUris;
  }

  return [defaultRemoteHotspotImageUri];
}

function formatEstimatedDurationLabel(
  minimumDuration?: number | null,
  maximumDuration?: number | null,
) {
  const resolvedMinimumDuration =
    typeof minimumDuration === "number" && Number.isFinite(minimumDuration)
      ? Math.max(0, Math.round(minimumDuration))
      : null;
  const resolvedMaximumDuration =
    typeof maximumDuration === "number" && Number.isFinite(maximumDuration)
      ? Math.max(0, Math.round(maximumDuration))
      : null;

  if (
    resolvedMinimumDuration !== null &&
    resolvedMaximumDuration !== null
  ) {
    return resolvedMinimumDuration === resolvedMaximumDuration
      ? `${resolvedMinimumDuration} phút`
      : `${resolvedMinimumDuration} - ${resolvedMaximumDuration} phút`;
  }

  if (resolvedMinimumDuration !== null) {
    return `${resolvedMinimumDuration} phút`;
  }

  if (resolvedMaximumDuration !== null) {
    return `${resolvedMaximumDuration} phút`;
  }

  return null;
}

function getRemoteHotspotTagNames(apiHotspot: NearbyHotspotDto | null) {
  if (!apiHotspot) {
    return [];
  }

  return apiHotspot.tags
    .map((tag) => readMeaningfulApiText(tag.tagName))
    .filter((tagName): tagName is string => Boolean(tagName));
}

function hasRemoteHotspotStories(apiHotspot: NearbyHotspotDto | null) {
  if (!apiHotspot) {
    return false;
  }

  return apiHotspot.stories.some((story) => {
    const storyTitle = readMeaningfulApiText(story.title);
    const storyContent = readMeaningfulApiText(story.content);

    return Boolean(storyTitle || storyContent);
  });
}

function getStoryNarrationSourceText({
  apiHotspot,
  fallbackText,
}: {
  apiHotspot: NearbyHotspotDto | null;
  fallbackText: string;
}) {
  const storyContent = apiHotspot?.stories
    .map((story) => readMeaningfulApiText(story.content))
    .filter((value): value is string => Boolean(value))
    .join(" ");

  return (
    storyContent ||
    readMeaningfulApiText(apiHotspot?.historyInformation) ||
    fallbackText
  );
}

function buildHotspotFromApi({
  apiHotspot,
  routeSlug,
}: {
  apiHotspot: NearbyHotspotDto;
  routeSlug: string;
}) {
  const tagNames = getRemoteHotspotTagNames(apiHotspot);
  const address =
    readMeaningfulApiText(apiHotspot.address) ?? "Địa chỉ đang cập nhật";
  const imageUris = resolveRemoteMediaUris(apiHotspot);
  const imageUri = imageUris[0] ?? defaultRemoteHotspotImageUri;
  const gallery = imageUris.slice(1);
  const overview =
    readMeaningfulApiText(apiHotspot.description) ??
    readMeaningfulApiText(apiHotspot.historyInformation) ??
    "";
  const story = readMeaningfulApiText(apiHotspot.historyInformation) ?? "";
  const scheduleLabel =
    formatApiTimeWindow(apiHotspot.openingTime, apiHotspot.closingTime) ??
    formatApiTimeWindow(apiHotspot.startTime, apiHotspot.endTime) ??
    "";

  return {
    hotspot: {
      address,
      bestTimeLabel: "",
      category: tagNames[0] ?? "",
      coordinate: {
        latitude: apiHotspot.latitude,
        longitude: apiHotspot.longitude,
      },
      distance: "",
      district: "",
      gallery,
      highlights: [],
      imageUri,
      overview,
      rating: 0,
      reviews: `${Math.max(0, Math.round(apiHotspot.point ?? 0))}`,
      reward: `+${Math.max(0, Math.round(apiHotspot.xp ?? 0))}`,
      routePairing: "",
      scheduleLabel,
      slug: routeSlug,
      story,
      ticketLabel: "",
      tips: [],
      title:
        readMeaningfulApiText(apiHotspot.hotspotName) ??
        `Hotspot #${apiHotspot.hotspotId}`,
      vibeTags: tagNames,
    } satisfies HotspotDetail,
  };
}

function clampNumber(value: number, minimum: number, maximum: number) {
  return Math.min(Math.max(value, minimum), maximum);
}

function isValidHotspotCoordinate(
  coordinate?: HotspotDetail["coordinate"] | null,
): coordinate is HotspotCoordinate {
  return Boolean(
    coordinate &&
    Number.isFinite(coordinate.latitude) &&
    Number.isFinite(coordinate.longitude),
  );
}

function buildDirectionMapRegion(
  coordinate?: HotspotDetail["coordinate"] | null,
): Region {
  const resolvedCoordinate = isValidHotspotCoordinate(coordinate)
    ? coordinate
    : defaultMapCoordinate;

  return {
    ...resolvedCoordinate,
    latitudeDelta: 0.0068,
    longitudeDelta: 0.0068,
  };
}

function buildHotspotDirectionsUrls({
  address,
  coordinate,
  title,
}: {
  address: string;
  coordinate?: HotspotDetail["coordinate"] | null;
  title: string;
}) {
  const hasCoordinate = isValidHotspotCoordinate(coordinate);
  const searchTerm = address.trim() || title.trim() || "Hotspot";
  const encodedSearchTerm = encodeURIComponent(searchTerm);
  const coordinateQuery = hasCoordinate
    ? `${coordinate.latitude},${coordinate.longitude}`
    : null;
  const encodedCoordinateQuery = coordinateQuery
    ? encodeURIComponent(coordinateQuery)
    : null;
  const encodedTitle = encodeURIComponent(title.trim() || searchTerm);
  const fallbackUrl = `https://www.google.com/maps/search/?api=1&query=${
    encodedCoordinateQuery ?? encodedSearchTerm
  }`;

  const nativeUrl =
    Platform.select({
      ios: coordinateQuery
        ? `http://maps.apple.com/?ll=${coordinateQuery}&q=${encodedTitle}`
        : `http://maps.apple.com/?q=${encodedSearchTerm}`,
      android: coordinateQuery
        ? `geo:${coordinateQuery}?q=${coordinateQuery}(${encodedTitle})`
        : `geo:0,0?q=${encodedSearchTerm}`,
      default: fallbackUrl,
    }) ?? fallbackUrl;

  return { fallbackUrl, nativeUrl };
}

async function openHotspotDirections(params: {
  address: string;
  coordinate?: HotspotDetail["coordinate"] | null;
  title: string;
}) {
  const { fallbackUrl, nativeUrl } = buildHotspotDirectionsUrls(params);

  try {
    await Linking.openURL(nativeUrl);
  } catch {
    if (fallbackUrl !== nativeUrl) {
      await Linking.openURL(fallbackUrl);
    }
  }
}

function clampReviewRatingValue(value: number) {
  return Number.isFinite(value) ? clampNumber(value, 0, 5) : 0;
}

function formatReviewRatingValue(value: number) {
  return clampReviewRatingValue(value).toFixed(1);
}

function getRewardValue(reward: string) {
  const resolvedValue = Number(reward.replace(/\D/g, ""));

  if (!Number.isFinite(resolvedValue) || resolvedValue <= 0) {
    return reward;
  }

  return `${resolvedValue}`;
}

function getSummaryOpenTimeValue({
  apiHotspot,
  hotspot,
}: {
  apiHotspot: NearbyHotspotDto | null;
  hotspot: HotspotDetail;
}) {
  const remoteScheduleValue =
    formatApiTimeWindow(apiHotspot?.openingTime, apiHotspot?.closingTime) ??
    formatApiTimeWindow(apiHotspot?.startTime, apiHotspot?.endTime);

  if (remoteScheduleValue) {
    return remoteScheduleValue;
  }

  const scheduleValue = readMeaningfulApiText(hotspot.scheduleLabel);

  if (!scheduleValue) {
    return null;
  }
  const timeRangeMatch = scheduleValue.match(
    /\d{1,2}:\d{2}\s*-\s*\d{1,2}:\d{2}/,
  );

  if (timeRangeMatch?.[0]) {
    return timeRangeMatch[0].replace(/\s+/g, " ");
  }

  if (normalizeLookupText(scheduleValue).includes("ca ngay")) {
    return "Cả ngày";
  }

  return scheduleValue;
}

function buildSummaryStats({
  apiHotspot,
  hotspot,
  rewardXp,
}: {
  apiHotspot: NearbyHotspotDto | null;
  hotspot: HotspotDetail;
  rewardXp: string;
}): SummaryStatItem[] {
  const scoreValue =
    apiHotspot?.point !== null && apiHotspot?.point !== undefined
      ? `${Math.max(0, Math.round(apiHotspot.point))}`
      : "0";
  const openTimeValue = getSummaryOpenTimeValue({
    apiHotspot,
    hotspot,
  });
  const items: SummaryStatItem[] = [
    {
      icon: {
        ios: "star.fill",
        android: "star",
        web: "star",
      } as SymbolName,
      label: "Điểm",
      value: scoreValue,
    },
  ];

  if (openTimeValue) {
    items.push({
      icon: {
        ios: "clock.fill",
        android: "schedule",
        web: "schedule",
      } as SymbolName,
      isCompactValue: true,
      label: "Giờ mở cửa",
      value: openTimeValue,
    });
  }

  items.push({
    icon: {
      ios: "gift.fill",
      android: "redeem",
      web: "redeem",
    } as SymbolName,
    label: "Điểm XP",
    value: `+${rewardXp}`,
  });

  return items;
}

function getGalleryPreviewImages(hotspot: HotspotDetail) {
  return [hotspot.imageUri, ...hotspot.gallery].slice(0, 4);
}

function normalizeLookupText(value: string) {
  return value
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase();
}

function sortAtmosphereTags(tags: string[]) {
  return [...tags].sort((left, right) => {
    const leftPriority = normalizeLookupText(left).includes("di san") ? 0 : 1;
    const rightPriority = normalizeLookupText(right).includes("di san") ? 0 : 1;

    if (leftPriority !== rightPriority) {
      return leftPriority - rightPriority;
    }

    return left.localeCompare(right, "vi");
  });
}

function getRouteBadgeColors(label: string) {
  const normalizedLabel = normalizeLookupText(label);

  if (normalizedLabel.includes("di san")) {
    return { backgroundColor: "#FFF2C7", textColor: "#A16207" };
  }

  if (normalizedLabel.includes("van hoa")) {
    return { backgroundColor: "#DDF8EE", textColor: "#0F8A5F" };
  }

  if (normalizedLabel.includes("do thi")) {
    return { backgroundColor: "#E5EDFF", textColor: "#3557C8" };
  }

  if (normalizedLabel.includes("lich su")) {
    return { backgroundColor: "#FFE8D9", textColor: "#C66A1B" };
  }

  if (normalizedLabel.includes("de")) {
    return { backgroundColor: "#E5FAEF", textColor: "#14845E" };
  }

  if (normalizedLabel.includes("trung binh")) {
    return { backgroundColor: "#FFF0D9", textColor: "#C86B1D" };
  }

  if (normalizedLabel.includes("kho")) {
    return { backgroundColor: "#FFE1EA", textColor: "#D23C6A" };
  }

  return { backgroundColor: "rgba(255,255,255,0.9)", textColor: "#5E7486" };
}

function getRouteLookupIds(hotspot: HotspotDetail) {
  const explicitLookup: Record<string, string[]> = {
    "bao-tang-my-thuat": ["bao-tang"],
    "buu-dien-sai-gon": ["buu-dien"],
    "dinh-doc-lap": ["dinh-doc-lap"],
    "nha-tho-duc-ba": ["nha-tho-duc-ba"],
    "pho-di-bo-nguyen-hue": ["pho-di-bo"],
  };

  return explicitLookup[hotspot.slug] ?? [];
}


function dedupeRouteItemsById(items: RouteItem[]) {
  return Array.from(
    new Map(items.map((item) => [item.id, item] as const)).values(),
  );
}

function formatPersonalExperienceDate(isoTimestamp: string) {
  const parsedDate = new Date(isoTimestamp);

  if (Number.isNaN(parsedDate.getTime())) {
    return "Vừa xong";
  }

  const elapsedMilliseconds = Date.now() - parsedDate.getTime();

  if (elapsedMilliseconds < 60 * 1000) {
    return "Vừa xong";
  }

  const elapsedMinutes = Math.floor(elapsedMilliseconds / (60 * 1000));

  if (elapsedMinutes < 60) {
    return `${elapsedMinutes} phút trước`;
  }

  const elapsedHours = Math.floor(elapsedMinutes / 60);

  if (elapsedHours < 24) {
    return `${elapsedHours} giờ trước`;
  }

  const elapsedDays = Math.floor(elapsedHours / 24);

  if (elapsedDays < 7) {
    return `${elapsedDays} ngày trước`;
  }

  return `${parsedDate.getDate().toString().padStart(2, "0")}/${(parsedDate.getMonth() + 1)
    .toString()
    .padStart(2, "0")}/${parsedDate.getFullYear()}`;
}

function buildSavedPersonalExperienceItems(
  posts: HotspotPersonalPost[],
): PersonalExperienceItem[] {
  return posts.map((post) => ({
    avatarUri: post.authorAvatarUri || avatarImageUri,
    date: formatPersonalExperienceDate(post.createdAt),
    id: post.id,
    media: post.media.map((media) => ({
      duration: media.durationLabel,
      type: media.type,
      uri: media.uri,
    })),
    rating: post.rating,
    text: post.text,
    user: post.authorName,
  }));
}

function buildApiPersonalExperienceItems(
  posts: HotspotPost[],
): PersonalExperienceItem[] {
  return posts.map((post) => {
    const resolvedMedia = (post.medias.length > 0
      ? post.medias.map((media) => ({
          duration:
            media.type.trim().toUpperCase() === "VIDEO" ? "Video" : undefined,
          type:
            media.type.trim().toUpperCase() === "VIDEO"
              ? ("video" as const)
              : ("image" as const),
          uri: media.url,
        }))
      : post.image
        ? [
            {
              type: "image" as const,
              uri: post.image,
            },
          ]
        : []
    ).filter((media) => Boolean(readMeaningfulApiText(media.uri)));

    return {
      avatarUri: avatarImageUri,
      date: formatPersonalExperienceDate(post.createdAt ?? ""),
      id: post.id,
      media: resolvedMedia,
      rating: 0,
      text: post.text,
      user:
        readMeaningfulApiText(post.displayName) ??
        readMeaningfulApiText(post.username) ??
        "Người dùng",
    };
  });
}

function dedupePersonalExperienceItems(items: PersonalExperienceItem[]) {
  return Array.from(
    new Map(items.map((item) => [item.id, item] as const)).values(),
  );
}

function getAudioStoryDurationLabel(story: string) {
  const wordCount = story.trim().split(/\s+/).filter(Boolean).length;
  const minutes = Math.max(1, Math.ceil(wordCount / 110));

  return `${minutes} min nghe`;
}

function HeroGalleryThumb({
  imageUri,
  isActive = false,
  onPress,
}: {
  imageUri: string;
  isActive?: boolean;
  onPress: () => void;
}) {
  return (
    <Pressable onPress={onPress}>
      <View
        className="overflow-hidden rounded-[24px]"
        style={{
          backgroundColor: "rgba(255,255,255,0.12)",
          height: isActive ? 132 : 118,
          width: isActive ? 104 : 92,
        }}
      >
        <Image
          source={imageUri}
          contentFit="cover"
          transition={160}
          cachePolicy="memory-disk"
          style={{ height: "100%", width: "100%" }}
        />
        {!isActive ? (
          <View
            pointerEvents="none"
            style={{
              backgroundColor: "rgba(3, 18, 28, 0.26)",
              bottom: 0,
              left: 0,
              position: "absolute",
              right: 0,
              top: 0,
            }}
          />
        ) : null}
      </View>
    </Pressable>
  );
}

function SummaryStat({
  icon,
  isCompactValue = false,
  label,
  value,
}: {
  icon: SymbolName;
  isCompactValue?: boolean;
  label: string;
  value: string;
}) {
  return (
    <View className="w-full items-center px-1 py-1">
      <View className="flex-row items-center justify-center gap-1.5">
        <SymbolView name={icon} size={12} tintColor="#EB489B" />
        <Text
          className="text-[11px] font-black uppercase tracking-[0.8px]"
          style={sectionEyebrowTextStyle}
        >
          {label}
        </Text>
      </View>

      <Text
        adjustsFontSizeToFit={isCompactValue}
        className="mt-1 text-center text-[15px] font-semibold"
        minimumFontScale={0.84}
        numberOfLines={1}
        style={{ color: "#201B18", lineHeight: 18, textAlign: "center" }}
      >
        {value}
      </Text>
    </View>
  );
}

function SummaryStatDivider({ leftPercent }: { leftPercent: number }) {
  return (
    <View
      pointerEvents="none"
      style={{
        backgroundColor: "#F4DCE6",
        bottom: 4,
        left: `${leftPercent}%`,
        marginLeft: -0.5,
        position: "absolute",
        top: 4,
        width: 1,
      }}
    />
  );
}

function SummaryStatsRow({ items }: { items: SummaryStatItem[] }) {
  return (
    <View
      className="mt-4 bg-white py-3"
      style={[
        cardShadowStyle,
        {
          borderRadius: reviewCardBorderRadius,
          marginHorizontal: -10,
          paddingHorizontal: 6,
        },
      ]}
    >
      <View className="relative">
        <View className="flex-row items-stretch justify-between">
          {items.map((item, index) => (
            <View
              key={`summary-stat-${item.label}-${index}`}
              className="flex-1 items-center justify-center"
              style={{ minWidth: 0 }}
            >
              <SummaryStat
                icon={item.icon}
                isCompactValue={item.isCompactValue}
                label={item.label}
                value={item.value}
              />
            </View>
          ))}
        </View>

        {items.map((item, index) => (
          index < items.length - 1 ? (
            <SummaryStatDivider
              key={`summary-stat-divider-${item.label}-${index}`}
              leftPercent={((index + 1) / items.length) * 100}
            />
          ) : null
        ))}
      </View>
    </View>
  );
}

function RatingStars({
  activeTintColor = "#FFC93C",
  inactiveTintColor = "#E8D8E1",
  rating,
  size = 14,
}: {
  activeTintColor?: string;
  inactiveTintColor?: string;
  rating: number;
  size?: number;
}) {
  const roundedRating = Math.round(clampReviewRatingValue(rating));

  return (
    <View className="flex-row items-center gap-1">
      {Array.from({ length: 5 }).map((_, index) => {
        const isFilled = index < roundedRating;

        return (
          <SymbolView
            key={`rating-star-${size}-${index}`}
            name={
              isFilled
                ? {
                    ios: "star.fill",
                    android: "star",
                    web: "star",
                  }
                : "star-border"
            }
            size={size}
            tintColor={isFilled ? activeTintColor : inactiveTintColor}
          />
        );
      })}
    </View>
  );
}

function TagChip({
  backgroundColor = "#FFF0F6",
  isUppercase = true,
  label,
  textColor = "#EB489B",
}: {
  backgroundColor?: string;
  isUppercase?: boolean;
  label: string;
  textColor?: string;
}) {
  return (
    <View className="rounded-full px-3 py-1.5" style={{ backgroundColor }}>
      <Text
        className={`text-[12px] font-semibold ${
          isUppercase ? "uppercase tracking-[0.8px]" : ""
        }`}
        style={{ color: textColor, lineHeight: 16 }}
      >
        {label}
      </Text>
    </View>
  );
}

const atmosphereTagPalettes = [
  { backgroundColor: "#FFF0F6", textColor: "#EB489B" },
  { backgroundColor: "#FFF4E8", textColor: "#D97706" },
  { backgroundColor: "#E8F4FF", textColor: "#2563EB" },
  { backgroundColor: "#E8FBF3", textColor: "#0F8A5F" },
] as const;

function getAtmosphereTagColors(label: string, index: number) {
  const normalizedLabel = normalizeLookupText(label);

  if (normalizedLabel.includes("lich su")) {
    return { backgroundColor: "#FFE8D9", textColor: "#C66A1B" };
  }

  if (normalizedLabel.includes("kien truc")) {
    return { backgroundColor: "#E8F4FF", textColor: "#3557C8" };
  }

  if (normalizedLabel.includes("nghe thuat")) {
    return { backgroundColor: "#E8FBF3", textColor: "#0F8A5F" };
  }

  if (normalizedLabel.includes("am thuc")) {
    return { backgroundColor: "#FFF4E8", textColor: "#D97706" };
  }

  if (normalizedLabel.includes("check in")) {
    return { backgroundColor: "#FFF0F6", textColor: "#EB489B" };
  }

  if (normalizedLabel.includes("van hoa")) {
    return { backgroundColor: "#FFF7D7", textColor: "#A16207" };
  }

  if (normalizedLabel.includes("thien nhien")) {
    return { backgroundColor: "#ECFDF3", textColor: "#15803D" };
  }

  return atmosphereTagPalettes[index % atmosphereTagPalettes.length];
}

function HeroScrollHint({
  bottomOffset,
  scrollY,
}: {
  bottomOffset: number;
  scrollY: SharedValue<number>;
}) {
  const arrowOffset = useSharedValue(0);

  useEffect(() => {
    arrowOffset.set(
      withRepeat(
        withTiming(10, {
          duration: 900,
          easing: Easing.inOut(Easing.quad),
          reduceMotion: ReduceMotion.System,
        }),
        -1,
        true,
        undefined,
        ReduceMotion.System,
      ),
    );

    return () => {
      cancelAnimation(arrowOffset);
      arrowOffset.set(0);
    };
  }, [arrowOffset]);

  const hintContainerStyle = useAnimatedStyle(() => ({
    opacity: interpolate(
      scrollY.value,
      [0, 48, 110],
      [1, 0.72, 0],
      Extrapolation.CLAMP,
    ),
    transform: [
      {
        translateY: interpolate(
          scrollY.value,
          [0, 110],
          [0, -18],
          Extrapolation.CLAMP,
        ),
      },
    ],
  }));

  const arrowAnimatedStyle = useAnimatedStyle(() => ({
    transform: [{ translateY: arrowOffset.get() }],
  }));

  return (
    <Animated.View
      pointerEvents="none"
      style={[
        hintContainerStyle,
        {
          alignItems: "center",
          bottom: bottomOffset,
          left: 20,
          position: "absolute",
          right: 20,
          zIndex: 2,
        },
      ]}
    >
      <Animated.View style={arrowAnimatedStyle}>
        <LinearGradient
          colors={["rgba(255,255,255,0.28)", "rgba(255,255,255,0.12)"]}
          end={{ x: 0.5, y: 1 }}
          start={{ x: 0.5, y: 0 }}
          className="h-12 w-12 items-center justify-center rounded-full border border-white/35"
        >
          <SymbolView
            name={{
              ios: "chevron.down",
              android: "keyboard_arrow_down",
              web: "keyboard_arrow_down",
            }}
            size={24}
            tintColor="#FFFFFF"
          />
        </LinearGradient>
      </Animated.View>
    </Animated.View>
  );
}

function DirectionMapCard({
  address,
  coordinate,
  headline,
  onInteractionChange,
  title,
}: {
  address: string;
  coordinate?: HotspotDetail["coordinate"] | null;
  headline: string;
  onInteractionChange?: (isInteracting: boolean) => void;
  title: string;
}) {
  const hasCoordinate = isValidHotspotCoordinate(coordinate);
  const mapRegion = buildDirectionMapRegion(coordinate);
  const mapStateKey = hasCoordinate
    ? `${coordinate.latitude}:${coordinate.longitude}`
    : "missing-coordinate";
  const [loadedMapKey, setLoadedMapKey] = useState<string | null>(null);
  const [mapError, setMapError] = useState<{
    key: string;
    message: string;
  } | null>(null);
  const hasMapLoaded =
    !hasCoordinate || Platform.OS === "web" || loadedMapKey === mapStateKey;
  const activeMapError =
    mapError?.key === mapStateKey ? mapError.message : null;
  const showMapFallback = Boolean(activeMapError);
  const mapStatusLabel = !hasCoordinate
    ? "Tọa độ đang cập nhật"
    : showMapFallback
      ? "Preview bản đồ tạm ẩn"
      : "Bản đồ tương tác";
  const mapGestureHint = !hasCoordinate
    ? "Địa chỉ hotspot"
    : showMapFallback
      ? "Vẫn có thể mở chỉ đường"
      : "Pinch để zoom";

  useEffect(() => {
    if (!hasCoordinate || Platform.OS === "web" || hasMapLoaded) {
      return;
    }

    const timeoutId = setTimeout(() => {
      setMapError({
        key: mapStateKey,
        message:
          "MapView da mount nhung tile Google Maps khong tai. Thuong do API key chua hop le, key dang bi restrict sai package/SHA-1, Maps SDK for Android chua bat, hoac ban chua rebuild app sau khi sua app.config.js/.env.",
      });
    }, mapLoadTimeoutMs);

    return () => clearTimeout(timeoutId);
  }, [hasCoordinate, hasMapLoaded, mapStateKey]);

  return (
    <View
      className="overflow-hidden rounded-[18px]"
      style={[cardShadowStyle, { height: 208 }]}
    >
      {activeMapError ? (
        <View
          style={{
            left: 16,
            padding: 12,
            position: "absolute",
            right: 16,
            top: 16,
            zIndex: 20,
            borderRadius: 16,
            backgroundColor: "rgba(255, 69, 58, 0.92)",
          }}
        >
          <Text className="text-[12px] font-bold text-white" style={{ lineHeight: 16 }}>
            Google Maps error:
          </Text>
          <Text className="mt-1 text-[12px] text-white" style={{ lineHeight: 16 }}>
            {activeMapError}
          </Text>
        </View>
      ) : null}

      {hasCoordinate ? (
        <MapView
          key={mapStateKey}
          initialRegion={mapRegion}
          loadingEnabled
          moveOnMarkerPress={false}
          provider={PROVIDER_GOOGLE}
          onPanDrag={() => onInteractionChange?.(true)}
          onRegionChange={() => onInteractionChange?.(true)}
          onRegionChangeComplete={() => onInteractionChange?.(false)}
          onTouchCancel={() => onInteractionChange?.(false)}
          onTouchEnd={() => onInteractionChange?.(false)}
          onTouchStart={() => onInteractionChange?.(true)}
          pitchEnabled={false}
          rotateEnabled={false}
          scrollEnabled
          showsBuildings
          showsCompass={Platform.OS === "ios"}
          style={{ flex: 1 }}
          toolbarEnabled={false}
          zoomControlEnabled={Platform.OS === "android"}
          zoomEnabled
          onMapReady={() =>
            setMapError((current) =>
              current?.key === mapStateKey ? null : current,
            )
          }
          onMapLoaded={() => {
            setLoadedMapKey(mapStateKey);
            setMapError((current) =>
              current?.key === mapStateKey ? null : current,
            );
          }}
        >
          <Marker
            coordinate={coordinate}
            description={address}
            pinColor="#EB489B"
            title={title}
          />
        </MapView>
      ) : (
        <LinearGradient
          colors={["#FAEFE7", "#D9F0E7", "#D2ECE8"]}
          locations={[0, 0.58, 1]}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 1 }}
          style={{ bottom: 0, left: 0, position: "absolute", right: 0, top: 0 }}
        />
      )}

      <LinearGradient
        pointerEvents="none"
        colors={["rgba(15, 23, 42, 0)", "rgba(15, 23, 42, 0.72)"]}
        locations={[0.42, 1]}
        start={{ x: 0.5, y: 0 }}
        end={{ x: 0.5, y: 1 }}
        style={{ bottom: 0, left: 0, position: "absolute", right: 0, top: 0 }}
      />

      {showMapFallback ? (
        <LinearGradient
          pointerEvents="none"
          colors={[
            "rgba(250, 239, 231, 0.94)",
            "rgba(245, 247, 238, 0.94)",
            "rgba(210, 236, 232, 0.96)",
          ]}
          locations={[0, 0.52, 1]}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 1 }}
          style={{ bottom: 0, left: 0, position: "absolute", right: 0, top: 0 }}
        >
          <View className="flex-1 items-center justify-center px-6">
            <View className="rounded-[18px] bg-white/85 px-5 py-5">
              <View className="items-center">
                <View className="h-16 w-16 items-center justify-center rounded-full bg-white/92">
                  <LinearGradient
                    colors={loginGradientColors}
                    end={{ x: 1, y: 0.5 }}
                    locations={[0, 0.58, 1]}
                    start={{ x: 0, y: 0.5 }}
                    style={{
                      alignItems: "center",
                      borderRadius: 999,
                      height: 48,
                      justifyContent: "center",
                      width: 48,
                    }}
                  >
                    <SymbolView
                      name={{
                        ios: "map.fill",
                        android: "map",
                        web: "map",
                      }}
                      size={22}
                      tintColor="#FFFFFF"
                    />
                  </LinearGradient>
                </View>
                <Text
                  className="mt-4 text-center text-[16px] font-semibold text-[#2B2233]"
                  style={{ lineHeight: 20 }}
                >
                  Không tải được preview bản đồ
                </Text>
                <Text
                  className="mt-2 text-center text-[15px]"
                  style={sectionBodyTextStyle}
                >
                  Kiểm tra Google Maps API key, package Android và SHA-1 của
                  build rồi rebuild app.
                </Text>
              </View>
            </View>
          </View>
        </LinearGradient>
      ) : null}

      <View
        pointerEvents="none"
        className="absolute left-4 right-4 top-4 flex-row items-center justify-between gap-3"
      >
        <View className="rounded-full bg-white/90 px-3 py-2">
          <Text
            className="text-[12px] font-black uppercase tracking-[0.8px]"
            style={{ color: "#335A70", lineHeight: 16 }}
          >
            {mapStatusLabel}
          </Text>
        </View>
        <View className="max-w-[160px] rounded-full bg-white/88 px-3 py-2">
          <Text
            className="text-[12px] font-medium text-[#4E6473]"
            numberOfLines={1}
            style={{ lineHeight: 16 }}
          >
            {address}
          </Text>
        </View>
      </View>

      <View className="absolute bottom-4 left-4 right-4 flex-row items-end justify-between gap-4">
        <View pointerEvents="none" className="flex-1">
          <Text
            className="text-[12px] font-black uppercase tracking-[0.8px] text-white/72"
            style={{ lineHeight: 16 }}
          >
            {mapGestureHint}
          </Text>
          <Text
            className="mt-1 text-[16px] font-semibold text-white"
            numberOfLines={1}
            style={{ lineHeight: 20 }}
          >
            {headline}
          </Text>
        </View>

        <Pressable
          className="overflow-hidden rounded-full"
          onPress={() => {
            onInteractionChange?.(false);
            void openHotspotDirections({ address, coordinate, title });
          }}
          style={buttonShadowStyle}
        >
          <LinearGradient
            colors={loginGradientColors}
            end={{ x: 1, y: 0.5 }}
            locations={[0, 0.58, 1]}
            start={{ x: 0, y: 0.5 }}
            className="flex-row items-center px-4 py-3"
          >
            <SymbolView
              name={{
                ios: "arrow.turn.up.right",
                android: "near_me",
                web: "near_me",
              }}
              size={14}
              tintColor="#FFFFFF"
            />
            <Text className="ml-1.5 text-[15px] font-semibold text-white">
              Chỉ đường
            </Text>
          </LinearGradient>
        </Pressable>
      </View>
    </View>
  );
}

function LocationInformationSection({
  address,
  openingHours,
  tagLabels,
  visitDuration,
}: {
  address: string;
  openingHours?: string | null;
  tagLabels: string[];
  visitDuration?: string | null;
}) {
  const items = [
    {
      icon: {
        ios: "location.fill",
        android: "place",
        web: "place",
      } as SymbolName,
      label: "Địa điểm",
      value: address,
    },
    visitDuration
      ? {
          icon: {
            ios: "hourglass",
            android: "hourglass_empty",
            web: "hourglass_empty",
          } as SymbolName,
          label: "Thời gian tham quan",
          value: visitDuration,
        }
      : null,
    openingHours
      ? {
          icon: {
            ios: "clock.fill",
            android: "schedule",
            web: "schedule",
          } as SymbolName,
          label: "Giờ hoạt động",
          value: openingHours,
        }
      : null,
    tagLabels.length > 0
      ? {
          icon: {
            ios: "sparkles",
            android: "auto_awesome",
            web: "auto_awesome",
          } as SymbolName,
          label: "Chủ đề",
          tags: sortAtmosphereTags(tagLabels.filter((tag) => tag.trim())),
        }
      : null,
  ].filter(Boolean) as (
    | {
        icon: SymbolName;
        label: string;
        value: string;
      }
    | {
        icon: SymbolName;
        label: string;
        tags: string[];
      }
  )[];

  return (
    <View className="mt-6 gap-3">
      <Text
        className="text-[14px] font-black uppercase tracking-[1.4px]"
        style={sectionEyebrowTextStyle}
      >
        Thông tin về địa điểm
      </Text>

      <View
        className="rounded-[16px] bg-[#FFFCFA] px-4 py-4"
        style={cardShadowStyle}
      >
        <View className="gap-5">
          {items.map((item) => (
            <View key={item.label} className="flex-row items-start gap-4">
              <View className="mt-0.5 h-10 w-10 items-center justify-center rounded-full bg-[#FFF0F6]">
                <SymbolView name={item.icon} size={18} tintColor="#EB489B" />
              </View>

              <View className="flex-1">
                <Text
                  className="text-[12px] font-black uppercase tracking-[1px] text-[#8FA6BA]"
                  style={{ lineHeight: 16 }}
                >
                  {item.label}
                </Text>
                {"tags" in item ? (
                  <View className="mt-2 flex-row flex-wrap gap-2">
                    {((item.tags ?? []).length > 0
                      ? (item.tags ?? [])
                      : ["Đang cập nhật"]
                    ).map((tag, index) => {
                      const chipColors = getAtmosphereTagColors(tag, index);

                      return (
                        <TagChip
                          key={`${item.label}-${tag}-${index}`}
                          backgroundColor={chipColors.backgroundColor}
                          isUppercase={false}
                          label={tag}
                          textColor={chipColors.textColor}
                        />
                      );
                    })}
                  </View>
                ) : (
                  <Text
                    className="mt-1 text-[15px]"
                    style={{ color: "#526879", lineHeight: 19 }}
                  >
                    {item.value}
                  </Text>
                )}
              </View>
            </View>
          ))}
        </View>
      </View>
    </View>
  );
}

function HotspotOverviewSection({ text }: { text: string }) {
  const [isExpanded, setIsExpanded] = useState(false);
  const shouldShowToggle = text.trim().length > 150;

  return (
    <View className="mt-3">
      <Text
        className="text-[15px]"
        numberOfLines={isExpanded ? undefined : 4}
        style={sectionBodyTextStyle}
      >
        {text}
      </Text>

      {shouldShowToggle ? (
        <Pressable
          className="mt-2 self-end"
          onPress={() => setIsExpanded((value) => !value)}
        >
          <Text className="text-[12px]" style={sectionCaptionTextStyle}>
            {isExpanded ? "Thu gọn" : "Xem thêm"}
          </Text>
        </Pressable>
      ) : null}
    </View>
  );
}

function HistoricalInfoSection({ text }: { text: string }) {
  const [isExpanded, setIsExpanded] = useState(false);
  const shouldShowToggle = text.trim().length > 180;

  return (
    <View className="gap-3">
      <Text
        className="text-[14px] font-black uppercase tracking-[1.4px]"
        style={sectionEyebrowTextStyle}
      >
        Thông tin lịch sử
      </Text>

      <View className="rounded-[16px] bg-[#FFF9F3] px-4 py-4" style={cardShadowStyle}>
        <Text
          className="text-[15px]"
          numberOfLines={isExpanded ? undefined : 4}
          style={sectionBodyEmphasisTextStyle}
        >
          {text}
        </Text>

        {shouldShowToggle ? (
          <Pressable
            className="mt-2 self-end"
            onPress={() => setIsExpanded((value) => !value)}
          >
            <Text className="text-[12px]" style={sectionCaptionTextStyle}>
              {isExpanded ? "Thu gọn" : "Xem thêm"}
            </Text>
          </Pressable>
        ) : null}
      </View>
    </View>
  );
}

function HiddenStoryCheckinSection({
  audioStoryDurationLabel,
  isCheckedIn,
  isCheckinStatusLoading = false,
  isStoryAvailabilityLoading = false,
  isStoryAvailable = true,
  onCheckinPress,
  onListenStories,
}: {
  audioStoryDurationLabel: string;
  isCheckedIn: boolean;
  isCheckinStatusLoading?: boolean;
  isStoryAvailabilityLoading?: boolean;
  isStoryAvailable?: boolean;
  onCheckinPress: () => void;
  onListenStories: () => void;
}) {
  const checkedInContent = isStoryAvailabilityLoading ? (
    <View
      className="rounded-[30px] bg-[#F8FBFF] px-5 py-5"
      style={cardShadowStyle}
    >
      <Text className="text-[16px] font-black text-[#2F242C]">
        Đang tải story hotspot
      </Text>
      <Text className="mt-2 text-[14px] leading-5 text-[#5E7486]">
        App đang gọi API story cho hotspot này để hiển thị đúng nội dung theo
        từng tag.
      </Text>
    </View>
  ) : isStoryAvailable ? (
    <HiddenStoryUnlockedContent
      audioStoryDurationLabel={audioStoryDurationLabel}
      onListenStories={onListenStories}
    />
  ) : (
    <View
      className="rounded-[30px] bg-[#F8FBFF] px-5 py-5"
      style={cardShadowStyle}
    >
      <Text className="text-[16px] font-black text-[#2F242C]">
        Story chuyên đề đang cập nhật
      </Text>
      <Text className="mt-2 text-[14px] leading-5 text-[#5E7486]">
        Hotspot này đã check-in thành công. Nội dung story riêng cho điểm đến
        này sẽ được bổ sung sau.
      </Text>
    </View>
  );

  return (
    <View className="gap-3">
      <View className="flex-row items-center justify-between gap-3">
        <Text
          className="text-[14px] font-black uppercase tracking-[1.4px]"
          style={sectionEyebrowTextStyle}
        >
          Câu chuyện ẩn
        </Text>

        <View className="flex-row items-center rounded-full bg-[#F6EEE8] px-3 py-2">
          <SymbolView
            name={{
              ios: isCheckedIn
                ? "checkmark.seal.fill"
                : isCheckinStatusLoading
                  ? "clock.fill"
                  : "lock.fill",
              android: isCheckedIn
                ? "verified"
                : isCheckinStatusLoading
                  ? "schedule"
                  : "lock",
              web: isCheckedIn
                ? "verified"
                : isCheckinStatusLoading
                  ? "schedule"
                  : "lock",
            }}
            size={12}
            tintColor={
              isCheckedIn
                ? "#1F9D7A"
                : isCheckinStatusLoading
                  ? "#7C7C93"
                  : "#8A736A"
            }
          />
          <Text
            className="ml-1.5 text-[12px] font-black uppercase tracking-[0.8px]"
            style={{
              color: isCheckedIn
                ? "#1F9D7A"
                : isCheckinStatusLoading
                  ? "#7C7C93"
                  : "#8A736A",
            }}
          >
            {isCheckedIn
              ? "Đã check-in"
              : isCheckinStatusLoading
                ? "Đang đồng bộ"
                : "Cần check-in"}
          </Text>
        </View>
      </View>

      {isCheckedIn ? (
        checkedInContent
      ) : isCheckinStatusLoading ? (
        <View
          className="rounded-[30px] bg-[#F8FBFF] px-5 py-5"
          style={cardShadowStyle}
        >
          <Text className="text-[16px] font-black text-[#2F242C]">
            Đang kiểm tra trạng thái check-in
          </Text>
          <Text className="mt-2 text-[14px] leading-5 text-[#5E7486]">
            Hệ thống đang xác nhận từ backend xem bạn đã check-in hotspot này
            trước đó hay chưa.
          </Text>
        </View>
      ) : (
        <LinearGradient
          colors={["#F3E3D9", "#E8E0E5"]}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 1 }}
          className="items-center rounded-[18px] px-5 py-7"
          style={cardShadowStyle}
        >
          <LinearGradient
            colors={["#FF6A63", "#D946EF"]}
            end={{ x: 1, y: 1 }}
            start={{ x: 0, y: 0 }}
            className="h-16 w-16 items-center justify-center rounded-full"
          >
            <SymbolView
              name={{
                ios: "lock.fill",
                android: "lock",
                web: "lock",
              }}
              size={22}
              tintColor="#FFFFFF"
            />
          </LinearGradient>

          <Text
            className="mt-5 text-center text-[18px] font-semibold text-[#2B2233]"
            style={{ lineHeight: 22 }}
          >
            Câu chuyện đang chờ bạn
          </Text>

          <Text
            className="mt-2 max-w-[320px] text-center text-[15px]"
            style={sectionBodyTextStyle}
          >
            {isCheckinStatusLoading
              ? "Đang kiểm tra trạng thái check-in từ hệ thống trước khi mở khóa nội dung."
              : isStoryAvailable
                ? "Check-in tại đây để mở khóa story hotspot và bản kể chuyện độc quyền."
                : "Check-in tại đây để ghi nhận điểm đến. Story chuyên đề cho hotspot này đang được cập nhật."}
          </Text>

          <Pressable
            className="mt-6 overflow-hidden rounded-full"
            disabled={isCheckinStatusLoading}
            onPress={onCheckinPress}
            style={buttonShadowStyle}
          >
            <LinearGradient
              colors={
                isCheckinStatusLoading
                  ? ["#D7D3E1", "#C8C1D6", "#BBB3CB"]
                  : loginGradientColors
              }
              end={{ x: 1, y: 0.5 }}
              locations={[0, 0.58, 1]}
              start={{ x: 0, y: 0.5 }}
              className="flex-row items-center px-5 py-3.5"
              style={{ opacity: isCheckinStatusLoading ? 0.88 : 1 }}
            >
              <SymbolView
                name={{
                  ios: isCheckinStatusLoading ? "clock.fill" : "location.fill",
                  android: isCheckinStatusLoading ? "schedule" : "place",
                  web: isCheckinStatusLoading ? "schedule" : "place",
                }}
                size={15}
                tintColor="#FFFFFF"
              />
              <Text className="ml-2 text-[15px] font-black text-white">
                {isCheckinStatusLoading
                  ? "Đang đồng bộ..."
                  : "Check-in tại đây"}
              </Text>
            </LinearGradient>
          </Pressable>
        </LinearGradient>
      )}
    </View>
  );
}

function HotspotRouteCarouselCard({
  route,
  width,
}: {
  route: RouteItem;
  width: number;
}) {
  const router = useRouter();
  const difficultyBadgeColors = getRouteBadgeColors(route.difficulty);
  const routeDescription =
    route.description?.trim() || route.subtitle.trim() || route.theme.trim();
  const routeTagLabel = route.era.trim() || route.theme.trim();

  return (
    <Pressable
      onPress={() => router.push(`/route/${route.id}` as Href)}
      style={{ width }}
    >
      <View
        className="overflow-hidden border border-[#EEF1F4] bg-white"
        style={[
          cardShadowStyle,
          {
            borderRadius: 16,
            minHeight: relatedRouteCardMinHeight,
          },
        ]}
      >
        <View className="relative">
          <Image
            source={route.cover}
            contentFit="cover"
            transition={180}
            cachePolicy="memory-disk"
           style={{ height: relatedRouteCardImageHeight, width: "100%" }}
          />

          <View className="absolute right-2 top-2 rounded-full bg-[#FFF1F6] px-2 py-[5px]">
            <Text className="text-[10px] font-extrabold text-[#EB489B]">
              +{route.xp} XP
            </Text>
          </View>
        </View>

        <View className="gap-1.5 px-3 pb-3 pt-2">
          <View className="flex-row flex-wrap items-center gap-1.5">
            <View className="rounded-full bg-[#FFF1F6] px-2 py-[5px]">
              <Text className="text-[10px] font-extrabold text-[#EB489B]">
                {route.distance}
              </Text>
            </View>
            <View className="rounded-full bg-[#FFF4EF] px-2 py-[5px]">
              <Text className="text-[10px] font-extrabold text-[#F58752]">
                {route.duration}
              </Text>
            </View>
            <View
              className="rounded-full px-2 py-[5px]"
              style={{ backgroundColor: difficultyBadgeColors.backgroundColor }}
            >
              <Text
                className="text-[10px] font-extrabold"
                style={{ color: difficultyBadgeColors.textColor }}
              >
                {route.difficulty}
              </Text>
            </View>
          </View>

          <Text
            className="text-[14px] font-semibold text-[#2B2233]"
            numberOfLines={2}
            ellipsizeMode="tail"
            style={{ lineHeight: 18 }}
          >
            {route.title}
          </Text>

          <Text
            className="text-[12px] text-[#7A6F67]"
            numberOfLines={2}
            ellipsizeMode="tail"
            style={{ lineHeight: 17 }}
          >
            {routeDescription}
          </Text>

          <View className="flex-row flex-wrap items-center justify-end gap-1.5 pt-1">
            {routeTagLabel ? (
              <View className="rounded-full bg-[#F4EFF8] px-2 py-[5px]">
                <Text className="text-[10px] font-extrabold text-[#6F657A]">
                  {routeTagLabel}
                </Text>
              </View>
            ) : null}

            <View className="rounded-full bg-[#FFF7E8] px-2 py-[5px]">
              <Text className="text-[10px] font-extrabold text-[#D97706]">
                {route.hotspotIds.length} điểm dừng
              </Text>
            </View>
          </View>
        </View>
      </View>
    </Pressable>
  );
}

function RouteMatchesSectionHeader() {
  return (
    <Text
      className="text-[14px] font-black uppercase tracking-[1.4px]"
      style={sectionEyebrowTextStyle}
    >
      Các tuyến đường phù hợp
    </Text>
  );
}

function PersonalExperienceSectionHeader() {
  return (
    <Text
      className="text-[14px] font-black uppercase tracking-[1.4px]"
      style={sectionEyebrowTextStyle}
    >
      Xếp hạng và đánh giá
    </Text>
  );
}

function PersonalExperienceMediaThumb({
  borderRadius = reviewMediaBorderRadius,
  height = 104,
  item,
  overlayLabel,
  width,
}: {
  borderRadius?: number;
  height?: number;
  item: PersonalExperienceMediaItem;
  overlayLabel?: string;
  width: number | `${number}%`;
}) {
  const shouldShowOverlayLabel =
    typeof overlayLabel === "string" && overlayLabel.trim().length > 0;

  return (
      <View
        className="overflow-hidden"
        style={{
          borderRadius,
        height,
        width,
      }}
    >
      <Image
        source={item.uri}
        contentFit="cover"
        transition={140}
        cachePolicy="memory-disk"
        style={{ height: "100%", width: "100%" }}
      />

      {shouldShowOverlayLabel ? (
        <>
          <View
            className="absolute inset-0"
            style={{ backgroundColor: "rgba(18, 24, 38, 0.42)" }}
          />
          <View className="absolute inset-0 items-center justify-center">
            <Text className="text-[28px] font-black text-white">
              {overlayLabel}
            </Text>
          </View>
        </>
      ) : item.type === "video" ? (
        <>
          <View
            className="absolute inset-0"
            style={{ backgroundColor: "rgba(18, 24, 38, 0.28)" }}
          />
          <View className="absolute inset-0 items-center justify-center">
            <View className="h-10 w-10 items-center justify-center rounded-full bg-black/35">
              <SymbolView
                name={{
                  ios: "play.fill",
                  android: "play_arrow",
                  web: "play_arrow",
                }}
                size={18}
                tintColor="#FFFFFF"
              />
            </View>
          </View>
          <View className="absolute bottom-2 right-2 rounded-full bg-black/60 px-2 py-1">
            <Text className="text-[12px] font-black text-white">
              {item.duration ?? "Video"}
            </Text>
          </View>
        </>
      ) : null}
    </View>
  );
}

function PersonalExperienceComposer({
  avatarUri,
  onPressCompose,
}: PersonalExperienceComposerProps) {
  return (
    <View
      className="bg-white px-4 py-4"
      style={[cardShadowStyle, { borderRadius: reviewCardBorderRadius }]}
    >
      <View className="flex-row items-center gap-3">
        <Image
          source={avatarUri}
          contentFit="cover"
          transition={120}
          cachePolicy="memory-disk"
          style={{ height: 44, width: 44, borderRadius: 22 }}
        />
        <Pressable
          className="flex-1 overflow-hidden rounded-full"
          onPress={onPressCompose}
          style={buttonShadowStyle}
        >
          <View
            className="flex-row items-center justify-center px-5 py-3.5"
            style={{ backgroundColor: "#D8F2F9" }}
          >
            <SymbolView
              name={{
                ios: "camera",
                android: "photo_camera",
                web: "photo_camera",
              }}
              size={16}
              tintColor="#2A6B80"
            />
            <Text className="ml-2 text-[15px] font-semibold text-[#2A6B80]">
              Thêm ảnh và video
            </Text>
          </View>
        </Pressable>
      </View>
    </View>
  );
}

function PersonalExperienceCard({ item }: { item: PersonalExperienceItem }) {
  const { width: screenWidth } = useWindowDimensions();
  const hasSingleMedia = item.media.length === 1;
  const hasTwoMedia = item.media.length === 2;
  const hasThreeMedia = item.media.length === 3;
  const reviewCardContentWidth = Math.max(
    screenWidth - detailSheetHorizontalPadding * 2 - reviewCardHorizontalPadding * 2,
    0,
  );
  const singleMediaHeight = Math.min(Math.max(screenWidth * 0.64, 220), 280);
  const multiMediaPreviewItems = hasSingleMedia ? item.media : item.media.slice(0, 4);
  const hiddenMediaCount = Math.max(item.media.length - multiMediaPreviewItems.length, 0);
  const twoMediaHeight = Math.min(Math.max(screenWidth * 0.44, 156), 182);
  const threeMediaHeight = Math.min(Math.max(screenWidth * 0.50, 188), 214);
  const threeMediaLeadWidth = Math.max(reviewCardContentWidth * 0.56, 0);
  const threeMediaSideWidth = Math.max(
    reviewCardContentWidth - threeMediaLeadWidth - reviewMediaGridGap,
    0,
  );
  const threeMediaStackHeight = Math.max(
    (threeMediaHeight - reviewMediaGridGap) / 2,
    0,
  );
  const multiMediaHeight = 98;
  const halfWidthMediaItemWidth = Math.max(
    (reviewCardContentWidth - reviewMediaGridGap) / 2,
    0,
  );
  const hasText = item.text.trim().length > 0;
  const hasRating = item.rating > 0;

  return (
    <View
      className="bg-white px-3.5 py-3"
      style={[cardShadowStyle, { borderRadius: reviewCardBorderRadius }]}
    >
      <View
        className="flex-row items-center"
        style={{ marginHorizontal: reviewAuthorRowHorizontalOffset }}
      >
        <Image
          source={item.avatarUri}
          contentFit="cover"
          transition={120}
          cachePolicy="memory-disk"
          style={{ height: 40, width: 40, borderRadius: 20 }}
        />
        <View className="ml-2.5 flex-1 justify-center">
          <Text
            className="text-[14px] font-semibold text-[#2B2233]"
            numberOfLines={1}
            style={{ lineHeight: 15 }}
          >
            {item.user}
          </Text>
          <Text
            className="text-[12px] text-[#8A7B83]"
            numberOfLines={1}
            style={{ lineHeight: 12, marginTop: -1 }}
          >
            {item.date}
          </Text>
        </View>
        <View className="ml-1 h-8 w-8 items-center justify-center rounded-full">
          <SymbolView
            name={{
              ios: "ellipsis",
              android: "more_horiz",
              web: "more_horiz",
            }}
            size={16}
            tintColor="#8A7B83"
          />
        </View>
      </View>

      {hasRating ? (
        <View className="mt-1.5 flex-row items-center justify-between gap-2">
          <RatingStars rating={item.rating} size={13} />
          <View className="rounded-full bg-[#FFF3DE] px-2.5 py-1">
            <Text className="text-[11px] font-black text-[#B86D2A]">
              {formatReviewRatingValue(item.rating)}/5
            </Text>
          </View>
        </View>
      ) : null}

      {hasText ? (
        <Text
          className="mt-1.5 text-[14px] text-[#554751]"
          style={[
            sectionBodyEmphasisTextStyle,
            {
              lineHeight: 15,
              marginHorizontal: reviewAuthorRowHorizontalOffset,
            },
          ]}
        >
          {item.text}
        </Text>
      ) : null}

      {item.media.length > 0 ? (
        <View
          className="mt-2"
          style={
            hasSingleMedia
              ? {
                  alignSelf: "center",
                  marginHorizontal: -reviewCardHorizontalPadding,
                  width: screenWidth - detailSheetHorizontalPadding * 2,
                }
              : { width: "100%" }
          }
        >
          {hasSingleMedia ? (
            <PersonalExperienceMediaThumb
              height={singleMediaHeight}
              item={item.media[0]}
              width="100%"
            />
          ) : hasTwoMedia ? (
            <View
              className="flex-row"
              style={{ columnGap: reviewMediaGridGap }}
            >
              {item.media.map((media, index) => (
                <PersonalExperienceMediaThumb
                  height={twoMediaHeight}
                  key={`${item.id}-media-${index}`}
                  item={media}
                  width={halfWidthMediaItemWidth}
                />
              ))}
            </View>
          ) : hasThreeMedia ? (
            <View
              className="flex-row"
              style={{ columnGap: reviewMediaGridGap }}
            >
              <PersonalExperienceMediaThumb
                height={threeMediaHeight}
                item={item.media[0]}
                width={threeMediaLeadWidth}
              />
              <View style={{ rowGap: reviewMediaGridGap, width: threeMediaSideWidth }}>
                {item.media.slice(1).map((media, index) => (
                  <PersonalExperienceMediaThumb
                    height={threeMediaStackHeight}
                    key={`${item.id}-media-stack-${index}`}
                    item={media}
                    width={threeMediaSideWidth}
                  />
                ))}
              </View>
            </View>
          ) : (
            <View
              className="overflow-hidden"
              style={{
                backgroundColor: panelBackground,
                borderRadius: reviewMediaBorderRadius,
              }}
            >
              <View
                style={{
                  columnGap: reviewMediaGridGap,
                  flexDirection: "row",
                  flexWrap: "wrap",
                  rowGap: reviewMediaGridGap,
                }}
              >
                {multiMediaPreviewItems.map((media, index) => {
                  const shouldStretchLastItem =
                    multiMediaPreviewItems.length === 3 && index === 2;
                  const overlayLabel =
                    index === multiMediaPreviewItems.length - 1 && hiddenMediaCount > 0
                      ? `+${hiddenMediaCount}`
                      : undefined;

                  return (
                    <PersonalExperienceMediaThumb
                      height={multiMediaHeight}
                      key={`${item.id}-media-${index}`}
                      item={media}
                      overlayLabel={overlayLabel}
                      width={
                        shouldStretchLastItem
                          ? reviewCardContentWidth
                          : halfWidthMediaItemWidth
                      }
                    />
                  );
                })}
              </View>
            </View>
          )}
        </View>
      ) : null}
    </View>
  );
}

function EmptyPersonalExperienceCard({
  isCheckedIn,
}: {
  isCheckedIn: boolean;
}) {
  return (
    <View
      className="bg-white px-5 py-5"
      style={[cardShadowStyle, { borderRadius: reviewCardBorderRadius }]}
    >
      <Text className="text-[16px] font-semibold text-[#2B2233]" style={{ lineHeight: 20 }}>
        Chưa có bài đánh giá
      </Text>
      <Text className="mt-2 text-[15px]" style={sectionBodyTextStyle}>
        {isCheckedIn
          ? "Bạn là người đầu tiên có thể để lại cảm nhận cho hotspot này."
          : "Check-in tại hotspot để mở quyền chia sẻ bài đánh giá của bạn."}
      </Text>
    </View>
  );
}

function PersonalExperienceLoadingCard() {
  return (
    <View
      className="bg-white px-5 py-5"
      style={[cardShadowStyle, { borderRadius: reviewCardBorderRadius }]}
    >
      <View className="flex-row items-center">
        <ActivityIndicator color="#EB489B" />
        <Text className="ml-3 text-[15px] font-semibold text-[#2B2233]">
          Đang tải bài đánh giá từ hotspot
        </Text>
      </View>
    </View>
  );
}

function PersonalExperienceErrorCard({ message }: { message: string }) {
  return (
    <View
      className="border border-[#F9E2EA] bg-[#FFF8FC] px-5 py-5"
      style={[cardShadowStyle, { borderRadius: reviewCardBorderRadius }]}
    >
      <Text className="text-[14px] font-bold text-[#C2416C]" style={{ lineHeight: 18 }}>
        {message}
      </Text>
    </View>
  );
}

function PersonalExperienceSection({
  composer,
  isCheckedIn,
  isLoadingReviews = false,
  items,
  reviewsErrorMessage,
}: {
  composer?: PersonalExperienceComposerProps | null;
  isCheckedIn: boolean;
  isLoadingReviews?: boolean;
  items: PersonalExperienceItem[];
  reviewsErrorMessage?: string | null;
}) {
  const [isShowingAllReviews, setIsShowingAllReviews] = useState(false);
  const canToggleAllReviews = items.length > recentReviewPreviewCount;
  const visibleItems =
    canToggleAllReviews && !isShowingAllReviews
      ? items.slice(0, recentReviewPreviewCount)
      : items;

  return (
    <View className="mt-5 gap-3">
      <PersonalExperienceSectionHeader />

      {reviewsErrorMessage ? (
        <PersonalExperienceErrorCard message={reviewsErrorMessage} />
      ) : null}

      <View className="gap-3">
        {isLoadingReviews && items.length === 0 ? (
          <PersonalExperienceLoadingCard />
        ) : items.length > 0 ? (
          visibleItems.map((item) => (
            <PersonalExperienceCard key={item.id} item={item} />
          ))
        ) : (
          <EmptyPersonalExperienceCard isCheckedIn={isCheckedIn} />
        )}
      </View>

      {canToggleAllReviews ? (
        <Pressable
          className="self-center rounded-full bg-[#EFF7FB] px-5 py-3.5"
          onPress={() => setIsShowingAllReviews((current) => !current)}
          style={cardShadowStyle}
        >
          <Text className="text-[14px] font-semibold text-[#2A6B80]">
            {isShowingAllReviews
              ? "Ẩn bớt bài đánh giá"
              : "Xem tất cả bài đánh giá"}
          </Text>
        </Pressable>
      ) : null}

      {isCheckedIn && composer ? (
        <View className="gap-2">
          <Text className="text-[15px] font-semibold text-[#2B2233]" style={{ lineHeight: 16 }}>
            Chia sẻ bài đánh giá của bạn
          </Text>
          <PersonalExperienceComposer
            avatarUri={composer.avatarUri}
            onPressCompose={composer.onPressCompose}
          />
        </View>
      ) : null}
    </View>
  );
}

function StickyCheckinBar({
  bottomInset,
  isCheckedIn,
  isCheckinStatusLoading = false,
  onPress,
}: {
  bottomInset: number;
  isCheckedIn: boolean;
  isCheckinStatusLoading?: boolean;
  onPress: () => void;
}) {
  return (
    <View
      className="px-5"
      style={{ paddingBottom: Math.max(bottomInset + 10, 18) }}
    >
      <View
        className="rounded-[30px] bg-white/96 p-3"
        style={[
          cardShadowStyle,
          {
            elevation: 10,
            shadowColor: "rgba(31, 41, 55, 0.16)",
            shadowOffset: { width: 0, height: 14 },
            shadowRadius: 24,
          },
        ]}
      >
        <Pressable
          className="overflow-hidden rounded-[22px]"
          disabled={isCheckedIn || isCheckinStatusLoading}
          onPress={onPress}
          style={buttonShadowStyle}
        >
          <LinearGradient
            colors={
              isCheckedIn
                ? ["#34D399", "#16A34A"]
                : isCheckinStatusLoading
                  ? ["#D7D3E1", "#BBB3CB"]
                  : loginGradientColors
            }
            end={{ x: 1, y: 0.5 }}
            locations={
              isCheckedIn || isCheckinStatusLoading ? [0, 1] : [0, 0.58, 1]
            }
            start={{ x: 0, y: 0.5 }}
            className="px-5 py-4"
            style={{
              opacity: isCheckedIn || isCheckinStatusLoading ? 0.92 : 1,
            }}
          >
            <View className="flex-row items-center justify-center">
              <View className="h-8 w-8 items-center justify-center rounded-full bg-white/22">
                <SymbolView
                  name={{
                    ios: isCheckedIn
                      ? "checkmark.circle.fill"
                      : isCheckinStatusLoading
                        ? "clock.fill"
                        : "location.fill",
                    android: isCheckedIn
                      ? "check_circle"
                      : isCheckinStatusLoading
                        ? "schedule"
                        : "place",
                    web: isCheckedIn
                      ? "check_circle"
                      : isCheckinStatusLoading
                        ? "schedule"
                        : "place",
                  }}
                  size={16}
                  tintColor="#FFFFFF"
                />
              </View>
              <Text className="ml-3 text-[16px] font-black tracking-[0.3px] text-white">
                {isCheckedIn
                  ? "Đã check-in"
                  : isCheckinStatusLoading
                    ? "Đang đồng bộ..."
                    : "Sẵn sàng checkin"}
              </Text>
            </View>
          </LinearGradient>
        </Pressable>
      </View>
    </View>
  );
}

function NotFoundState() {
  const router = useRouter();

  return (
    <View className="flex-1" style={{ backgroundColor: screenBackground }}>
      <SafeAreaView
        className="flex-1"
        edges={["top", "left", "right", "bottom"]}
      >
        <View className="flex-1 items-center justify-center px-6">
          <View
            className="w-full rounded-[32px] bg-[#F4F7FB] px-6 py-8"
            style={[cardShadowStyle, { maxWidth: 360 }]}
          >
            <Text className="text-center text-[24px] font-black text-[#1E3245]">
              Hotspot khong ton tai
            </Text>
            <Text className="mt-3 text-center text-[15px] leading-6 text-[#5E7486]">
              Dia diem nay khong con trong danh sach hien tai. Ban co the quay
              lai hoac mo danh sach hotspot de chon diem khac.
            </Text>
            <View className="mt-6 flex-row gap-3">
              <Pressable
                className="flex-1 items-center rounded-full bg-[#E7EFF5] px-4 py-3.5"
                onPress={() => router.back()}
              >
                <Text className="text-[14px] font-bold text-[#28475D]">
                  Quay lai
                </Text>
              </Pressable>
              <Pressable
                className="flex-1 items-center rounded-full bg-[#13384D] px-4 py-3.5"
                onPress={() => router.replace("/hotspots")}
              >
                <Text className="text-[14px] font-bold text-white">
                  Xem danh sach
                </Text>
              </Pressable>
            </View>
          </View>
        </View>
      </SafeAreaView>
    </View>
  );
}

function LoadingState() {
  return (
    <View style={{ backgroundColor: screenBackground, flex: 1 }}>
      <SafeAreaView className="flex-1" edges={["top", "left", "right", "bottom"]}>
        <View className="flex-1 items-center justify-center px-6">
          <View className="items-center">
            <ActivityIndicator color="#F58752" size="large" />
            <Text className="mt-4 text-center text-[22px] font-bold text-[#6D6278]">
              Đang tải dữ liệu...
            </Text>
          </View>
        </View>
      </SafeAreaView>
    </View>
  );
}

function LoadFailedState({ message }: { message: string }) {
  const router = useRouter();

  return (
    <View className="flex-1" style={{ backgroundColor: screenBackground }}>
      <SafeAreaView
        className="flex-1"
        edges={["top", "left", "right", "bottom"]}
      >
        <View className="flex-1 items-center justify-center px-6">
          <View
            className="w-full rounded-[32px] bg-[#FDF4F4] px-6 py-8"
            style={[cardShadowStyle, { maxWidth: 360 }]}
          >
            <Text className="text-center text-[24px] font-black text-[#7F1D1D]">
              Không tải được hotspot
            </Text>
            <Text className="mt-3 text-center text-[15px] leading-6 text-[#7F1D1D]">
              {message}
            </Text>
            <View className="mt-6 flex-row gap-3">
              <Pressable
                className="flex-1 items-center rounded-full bg-[#FDE2E2] px-4 py-3.5"
                onPress={() => router.back()}
              >
                <Text className="text-[14px] font-bold text-[#7F1D1D]">
                  Quay lại
                </Text>
              </Pressable>
              <Pressable
                className="flex-1 items-center rounded-full bg-[#7F1D1D] px-4 py-3.5"
                onPress={() => router.replace("/hotspots")}
              >
                <Text className="text-[14px] font-bold text-white">
                  Danh sách
                </Text>
              </Pressable>
            </View>
          </View>
        </View>
      </SafeAreaView>
    </View>
  );
}

export default function HotspotDetailScreen() {
  const router = useRouter();
  const authSession = useAuthSession();
  const insets = useSafeAreaInsets();
  const { height: screenHeight, width: screenWidth } = useWindowDimensions();
  const checkins = useCheckins();
  const checkedInApiHotspots = useCheckedInApiHotspots();
  const { hotspotId, slug } = useLocalSearchParams<{
    hotspotId?: string;
    slug: string;
  }>();
  const resolvedSlug = Array.isArray(slug) ? (slug[0] ?? "") : (slug ?? "");
  const resolvedHotspotId = resolveSelectedHotspotId({
    hotspotId,
    slug: resolvedSlug,
  });
  const scrollY = useSharedValue(0);
  const [isCheckinOverlayVisible, setIsCheckinOverlayVisible] = useState(false);
  const [isStickyCheckinVisible, setIsStickyCheckinVisible] = useState(false);
  const [remoteHotspot, setRemoteHotspot] = useState<NearbyHotspotDto | null>(
    null,
  );
  const [remoteHotspotError, setRemoteHotspotError] = useState<string | null>(
    null,
  );
  const [apiRelatedRoutes, setApiRelatedRoutes] = useState<RouteItem[] | null>(
    null,
  );
  const [relatedRoutesError, setRelatedRoutesError] = useState<string | null>(
    null,
  );
  const [relatedRoutesStatus, setRelatedRoutesStatus] =
    useState<RelatedRoutesSectionStatus>("idle");
  const [isRemoteCheckinStatusLoading, setIsRemoteCheckinStatusLoading] =
    useState(false);
  const [isRemoteHotspotLoading, setIsRemoteHotspotLoading] = useState(false);
  const [apiHotspotPosts, setApiHotspotPosts] = useState<HotspotPost[]>([]);
  const [hotspotPostsError, setHotspotPostsError] = useState<string | null>(
    null,
  );
  const [isHotspotPostsLoading, setIsHotspotPostsLoading] = useState(
    () => resolvedHotspotId !== null,
  );
  const cachedStoriesEntry = getCachedHotspotStories({
    hotspotId: resolvedHotspotId,
    slug: resolvedSlug,
  });
  const [isMapInteracting, setIsMapInteracting] = useState(false);
  const [gallerySelection, setGallerySelection] = useState(() => ({
    index: 0,
    slugKey: resolvedSlug,
  }));
  const heroHeightExpanded = clampNumber(
    screenHeight + insets.bottom + 12,
    640,
    960,
  );
  const heroHeightCollapsed = clampNumber(screenHeight * 0.42, 290, 360);
  const collapseDistance = Math.max(
    heroHeightExpanded - heroHeightCollapsed,
    1,
  );
  const contentOverlap = 28;
  const stickyCheckinRevealOffset = Math.max(
    heroHeightExpanded - screenHeight + 220,
    collapseDistance * 0.42,
    220,
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
          [heroHeightExpanded * 0.08, 0, -24],
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
          [0, -52],
          Extrapolation.CLAMP,
        ),
      },
    ],
  }));

  const stickyCheckinBarStyle = useAnimatedStyle(() => ({
    opacity: interpolate(
      scrollY.value,
      [stickyCheckinRevealOffset, stickyCheckinRevealOffset + 42],
      [0, 1],
      Extrapolation.CLAMP,
    ),
    transform: [
      {
        translateY: interpolate(
          scrollY.value,
          [stickyCheckinRevealOffset, stickyCheckinRevealOffset + 42],
          [28, 0],
          Extrapolation.CLAMP,
        ),
      },
    ],
  }));
  const heroOverlayDismissDistance = Math.min(collapseDistance, 144);
  const heroHeaderOverlayStyle = useAnimatedStyle(() => ({
    opacity: interpolate(
      scrollY.value,
      [0, heroOverlayDismissDistance * 0.45, heroOverlayDismissDistance],
      [1, 0.55, 0],
      Extrapolation.CLAMP,
    ),
    transform: [
      {
        translateY: interpolate(
          scrollY.value,
          [0, heroOverlayDismissDistance],
          [0, -24],
          Extrapolation.CLAMP,
        ),
      },
    ],
  }));
  const heroFloatingActionStyle = useAnimatedStyle(() => ({
    opacity: interpolate(
      scrollY.value,
      [0, heroOverlayDismissDistance * 0.4, heroOverlayDismissDistance],
      [1, 0.6, 0],
      Extrapolation.CLAMP,
    ),
    transform: [
      {
        translateY: interpolate(
          scrollY.value,
          [0, heroOverlayDismissDistance],
          [0, -36],
          Extrapolation.CLAMP,
        ),
      },
    ],
  }));

  useAnimatedReaction(
    () => scrollY.value >= stickyCheckinRevealOffset,
    (isVisible, previousValue) => {
      if (isVisible !== previousValue) {
        runOnJS(setIsStickyCheckinVisible)(isVisible);
      }
    },
    [stickyCheckinRevealOffset],
  );

  const handleScroll = useAnimatedScrollHandler({
    onScroll: (event) => {
      // eslint-disable-next-line react-hooks/immutability
      scrollY.value = event.contentOffset.y;
    },
  });

  useEffect(() => {
    let isActive = true;

    const loadHotspotPosts = async () => {
      if (resolvedHotspotId === null) {
        setApiHotspotPosts([]);
        setHotspotPostsError(null);
        setIsHotspotPostsLoading(false);
        return;
      }

      setIsHotspotPostsLoading(true);
      setApiHotspotPosts([]);
      setHotspotPostsError(null);

      try {
        const accessToken = authSession.isAuthenticated
          ? await getValidAccessToken()
          : null;
        const response = await getHotspotPosts({
          accessToken,
          hotspotId: resolvedHotspotId,
          page: 0,
          size: hotspotPostsPageSize,
          sort: [...hotspotPostsSort],
          tokenType: authSession.tokenType,
        });

        if (!isActive) {
          return;
        }

        setApiHotspotPosts(response.content);
      } catch (error) {
        console.warn("[hotspot-detail] load hotspot posts failed", {
          error: error instanceof Error ? error.message : error,
          hotspotId: resolvedHotspotId,
          slug: resolvedSlug,
        });

        if (!isActive) {
          return;
        }

        setApiHotspotPosts([]);
        setHotspotPostsError(
          error instanceof Error
            ? error.message
            : "Không tải được bài đánh giá theo hotspotId.",
        );
      } finally {
        if (isActive) {
          setIsHotspotPostsLoading(false);
        }
      }
    };

    void loadHotspotPosts();

    return () => {
      isActive = false;
    };
  }, [authSession.isAuthenticated, authSession.tokenType, resolvedHotspotId, resolvedSlug]);

  useEffect(() => {
    let isActive = true;

    async function loadRemoteHotspot() {
      if (resolvedHotspotId === null) {
        setRemoteHotspot(null);
        setRemoteHotspotError(null);
        setIsRemoteHotspotLoading(false);
        return;
      }

      setIsRemoteHotspotLoading(true);
      setRemoteHotspotError(null);
      setRemoteHotspot(null);

      try {
        const accessToken = authSession.isAuthenticated
          ? await getValidAccessToken()
          : null;
        const nextRemoteHotspot = await getHotspotByIdApi({
          accessToken,
          hotspotId: resolvedHotspotId,
          tokenType: authSession.tokenType,
        });

        if (!isActive) {
          return;
        }

        setRemoteHotspot(nextRemoteHotspot);
      } catch (error) {
        if (!isActive) {
          return;
        }

        setRemoteHotspot(null);
        setRemoteHotspotError(
          error instanceof Error
            ? error.message
            : "Không tải được chi tiết hotspot từ API.",
        );
      } finally {
        if (isActive) {
          setIsRemoteHotspotLoading(false);
        }
      }
    }

    void loadRemoteHotspot();

    return () => {
      isActive = false;
    };
  }, [authSession.isAuthenticated, authSession.tokenType, resolvedHotspotId]);

  useEffect(() => {
    if (resolvedHotspotId === null || remoteHotspot?.isCheckedIn !== true) {
      return;
    }

    mergeApiCheckins([resolvedHotspotId]);
  }, [remoteHotspot?.isCheckedIn, resolvedHotspotId]);

  useFocusEffect(
    useCallback(() => {
      let isActive = true;

      async function syncRemoteCheckinStatus() {
        if (!authSession.isAuthenticated || resolvedHotspotId === null) {
          setIsRemoteCheckinStatusLoading(false);
          return;
        }

        setIsRemoteCheckinStatusLoading(true);

        try {
          const accessToken = await getValidAccessToken();

          if (!accessToken || !isActive) {
            return;
          }

          const checkedInHotspotIds = await getCheckedInHotspotIds({
            accessToken,
            tokenType: authSession.tokenType,
          });

          if (!isActive) {
            return;
          }

          mergeApiCheckins(checkedInHotspotIds);
        } catch (error) {
          console.info("[hotspot-detail] check-in status sync skipped", {
            error: error instanceof Error ? error.message : error,
            hotspotId: resolvedHotspotId,
          });
        } finally {
          if (isActive) {
            setIsRemoteCheckinStatusLoading(false);
          }
        }
      }

      void syncRemoteCheckinStatus();

      return () => {
        isActive = false;
      };
    }, [
      authSession.isAuthenticated,
      authSession.tokenType,
      resolvedHotspotId,
      setIsRemoteCheckinStatusLoading,
    ]),
  );

  const remoteHotspotResult = useMemo(
    () =>
      remoteHotspot
        ? buildHotspotFromApi({
            apiHotspot: remoteHotspot,
            routeSlug: resolvedSlug,
          })
        : null,
    [remoteHotspot, resolvedSlug],
  );
  const hotspot = remoteHotspotResult?.hotspot ?? null;
  const savedPersonalPosts = useHotspotPersonalPosts(hotspot?.slug ?? resolvedSlug);

  useEffect(() => {
    if (!hotspot) {
      return;
    }

    cacheHotspotDetail({
      hotspot,
      hotspotId: resolvedHotspotId,
      slug: hotspot.slug,
    });
  }, [hotspot, resolvedHotspotId]);

  useEffect(() => {
    if (!hotspot) {
      return;
    }

    let isActive = true;

    const loadRelatedRoutes = async () => {
      if (resolvedHotspotId === null) {
        setApiRelatedRoutes(null);
        setRelatedRoutesError(null);
        setRelatedRoutesStatus("idle");
        return;
      }

      setRelatedRoutesStatus("loading");
      setRelatedRoutesError(null);

      try {
        const accessToken = authSession.isAuthenticated
          ? await getValidAccessToken()
          : null;
        const remoteRoutes = await getRoutesByHotspot({
          accessToken,
          hotspotId: resolvedHotspotId,
          routeStatus: "PUBLISHED",
          tokenType: authSession.tokenType,
        });
        const mappedRoutes = dedupeRouteItemsById(
          remoteRoutes.map(mapRouteToRouteItem),
        );

        if (!isActive) {
          return;
        }

        setApiRelatedRoutes(mappedRoutes);
        setRelatedRoutesStatus(mappedRoutes.length > 0 ? "ready" : "empty");
      } catch (error) {
        console.warn("[hotspot-detail] load related routes failed", {
          error: error instanceof Error ? error.message : error,
          hotspotId: resolvedHotspotId,
          slug: hotspot.slug,
        });

        if (!isActive) {
          return;
        }

        setApiRelatedRoutes([]);
        setRelatedRoutesError(
          error instanceof Error
            ? error.message
            : "Không tải được tuyến theo hotspotId.",
        );
        setRelatedRoutesStatus("empty");
      }
    };

    void loadRelatedRoutes();

    return () => {
      isActive = false;
    };
  }, [
    authSession.isAuthenticated,
    authSession.tokenType,
    hotspot,
    resolvedHotspotId,
  ]);

  if (!hotspot) {
    if (isRemoteHotspotLoading) {
      return <LoadingState />;
    }

    if (remoteHotspotError) {
      return <LoadFailedState message={remoteHotspotError} />;
    }

    return <NotFoundState />;
  }

  const galleryPreviewImages = getGalleryPreviewImages(hotspot);
  const activeGalleryIndex =
    gallerySelection.slugKey === resolvedSlug ? gallerySelection.index : 0;
  const activeHeroImageUri =
    galleryPreviewImages[activeGalleryIndex] ?? hotspot.imageUri;
  const heroGalleryBottomOffset = Math.max(
    contentOverlap + insets.bottom + 12,
    42,
  );
  const heroScrollHintBottom =
    galleryPreviewImages.length > 1 ? heroGalleryBottomOffset + 152 : 108;
  const overviewText =
    readMeaningfulApiText(hotspot.overview) ??
    readMeaningfulApiText(remoteHotspot?.description) ??
    readMeaningfulApiText(remoteHotspot?.historyInformation) ??
    "";
  const historicalInfoText =
    readMeaningfulApiText(remoteHotspot?.historyInformation) ??
    readMeaningfulApiText(hotspot.story) ??
    null;
  const openingHoursLabel = getSummaryOpenTimeValue({
    apiHotspot: remoteHotspot,
    hotspot,
  });
  const visitDurationLabel =
    formatEstimatedDurationLabel(
      remoteHotspot?.estimatedDurationMin,
      remoteHotspot?.estimatedDurationMax,
    ) ?? readMeaningfulApiText(hotspot.bestTimeLabel);
  const hotspotTagLabels =
    remoteHotspot !== null
      ? getRemoteHotspotTagNames(remoteHotspot)
      : hotspot.vibeTags.filter((tag) => tag.trim());
  const rewardXp = getRewardValue(hotspot.reward);
  const canOpenStories =
    resolvedHotspotId === null
      ? true
      : Boolean(cachedStoriesEntry?.stories.length) ||
        hasRemoteHotspotStories(remoteHotspot);
  const hotspotCheckinId = hotspot.slug;
  const isCheckedInFromRemoteHotspot = remoteHotspot?.isCheckedIn === true;
  const isCheckedInFromApiStore =
    resolvedHotspotId !== null && checkedInApiHotspots.includes(resolvedHotspotId);
  const isCheckedIn =
    isCheckedInFromRemoteHotspot ||
    isCheckedInFromApiStore ||
    checkins.includes(hotspotCheckinId);
  const isCheckinUiPending =
    authSession.isAuthenticated &&
    resolvedHotspotId !== null &&
    !isCheckedIn &&
    (isRemoteHotspotLoading || isRemoteCheckinStatusLoading);
  const detailSheetBottomPadding = isCheckedIn
    ? Math.max(insets.bottom + 10, 16)
    : Math.max(insets.bottom + 100, 120);
  const isStoryAvailabilityLoading =
    resolvedHotspotId !== null &&
    isRemoteHotspotLoading &&
    !cachedStoriesEntry?.stories.length;
  const audioStoryDurationLabel = getAudioStoryDurationLabel(
    getStoryNarrationSourceText({
      apiHotspot: remoteHotspot,
      fallbackText: historicalInfoText ?? overviewText,
    }),
  );
  const hotspotStoriesHref =
    resolvedHotspotId !== null
      ? (`/hotspot/${hotspot.slug}/stories?hotspotId=${resolvedHotspotId}` as Href)
      : (`/hotspot/${hotspot.slug}/stories` as Href);
  const reviewComposeHref = {
    params: {
      ...(resolvedHotspotId !== null ? { hotspotId: `${resolvedHotspotId}` } : {}),
      slug: hotspot.slug,
      title: hotspot.title,
    },
    pathname: "/hotspot/[slug]/review-compose",
  } as Href;
  const hasPersistedRelatedRoutes =
    Array.isArray(apiRelatedRoutes) && apiRelatedRoutes.length > 0;
  const isRelatedRoutesLoading =
    resolvedHotspotId !== null &&
    relatedRoutesStatus === "loading" &&
    !hasPersistedRelatedRoutes;
  const relatedRoutes =
    relatedRoutesStatus === "ready" ||
    (relatedRoutesStatus === "loading" && hasPersistedRelatedRoutes)
      ? (apiRelatedRoutes ?? [])
      : [];
  const relatedRouteCardWidth = Math.min(
    Math.max((screenWidth - relatedRouteScrollInset * 2) * 0.62, 208),
    232,
  );
  const savedPersonalExperienceItems = buildSavedPersonalExperienceItems(
    savedPersonalPosts,
  );
  const apiPersonalExperienceItems = buildApiPersonalExperienceItems(
    apiHotspotPosts,
  );
  const personalExperienceItems = dedupePersonalExperienceItems([
    ...savedPersonalExperienceItems,
    ...apiPersonalExperienceItems,
  ]);
  const summaryStats = buildSummaryStats({
    apiHotspot: remoteHotspot,
    hotspot,
    rewardXp,
  });

  return (
    <View className="flex-1" style={{ backgroundColor: screenBackground }}>
      <StatusBar style="light" />

      <Animated.View
        pointerEvents="none"
        style={[
          heroShadowStyle,
          heroContainerStyle,
          {
            borderBottomLeftRadius: 36,
            borderBottomRightRadius: 36,
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
            source={activeHeroImageUri}
            contentFit="cover"
            transition={220}
            cachePolicy="memory-disk"
            style={{ height: "100%", width: "100%" }}
          />
        </Animated.View>

        <LinearGradient
          colors={[
            "rgba(0, 0, 0, 0)",
            "rgba(0, 0, 0, 0.04)",
            "rgba(5, 16, 28, 0.32)",
          ]}
          locations={[0, 0.58, 1]}
          start={{ x: 0.5, y: 0 }}
          end={{ x: 0.5, y: 1 }}
          style={{ bottom: 0, left: 0, position: "absolute", right: 0, top: 0 }}
        />
      </Animated.View>

      <Animated.View
        pointerEvents="box-none"
        style={[
          heroHeaderOverlayStyle,
          {
            left: 0,
            position: "absolute",
            right: 0,
            top: 0,
            zIndex: 3,
          },
        ]}
      >
        <View className="px-4" style={{ paddingTop: insets.top + 8 }}>
          <View style={{ alignSelf: "center", maxWidth: 520, width: "100%" }}>
            <View className="flex-row items-center justify-between">
              <Pressable
                className="h-[52px] w-[52px] items-center justify-center rounded-full bg-black/22"
                hitSlop={8}
                onPress={() => router.back()}
              >
                <SymbolView
                  name={{
                    ios: "chevron.left",
                    android: "arrow_back",
                    web: "arrow_back",
                  }}
                  size={20}
                  tintColor="#FFFFFF"
                />
              </Pressable>

              <View className="flex-1 px-4">
                <Text
                  className="text-center text-[14px] font-bold text-white"
                  numberOfLines={1}
                >
                  {hotspot.title}
                </Text>
              </View>

              <Pressable
                className="h-[52px] w-[52px] items-center justify-center rounded-full bg-black/22"
                hitSlop={8}
                onPress={() => router.replace("/hotspots")}
              >
                <SymbolView
                  name={{
                    ios: "list.bullet",
                    android: "view_list",
                    web: "view_list",
                  }}
                  size={20}
                  tintColor="#FFFFFF"
                />
              </Pressable>
            </View>
          </View>
        </View>
      </Animated.View>

      <Animated.View
        pointerEvents="box-none"
        style={[
          heroFloatingActionStyle,
          {
            position: "absolute",
            right: 20,
            top: heroHeightExpanded - contentOverlap - 22,
            zIndex: 3,
          },
        ]}
      >
        <Pressable
          className="h-12 w-12 items-center justify-center rounded-full"
          onPress={() => router.replace("/hotspots")}
          style={buttonShadowStyle}
        >
          <LinearGradient
            colors={loginGradientColors}
            end={{ x: 1, y: 0.5 }}
            locations={[0, 0.58, 1]}
            start={{ x: 0, y: 0.5 }}
            className="h-12 w-12 items-center justify-center rounded-full"
          >
            <SymbolView
              name={{
                ios: "paperplane.fill",
                android: "near_me",
                web: "near_me",
              }}
              size={17}
              tintColor="#FFFFFF"
            />
          </LinearGradient>
        </Pressable>
      </Animated.View>

      <HeroScrollHint bottomOffset={heroScrollHintBottom} scrollY={scrollY} />

      <SafeAreaView className="flex-1" edges={["left", "right", "bottom"]}>
        <Animated.ScrollView
          bounces={false}
          overScrollMode="never"
          style={{
            elevation: Platform.OS === "android" ? 2 : undefined,
            flex: 1,
            zIndex: 1,
          }}
          contentContainerStyle={{
            paddingTop: heroHeightExpanded - contentOverlap,
          }}
          onScroll={handleScroll}
          scrollEnabled={!isMapInteracting}
          scrollEventThrottle={16}
          showsVerticalScrollIndicator={false}
        >
          {galleryPreviewImages.length > 1 ? (
            <View
              pointerEvents="box-none"
              style={{
                left: 0,
                minHeight: heroHeightExpanded,
                position: "absolute",
                right: 0,
                top: 0,
              }}
            >
              <View
                className="absolute inset-x-0"
                style={{
                  bottom: Math.max(contentOverlap + insets.bottom + 12, 42),
                }}
              >
                <ScrollView
                  horizontal
                  nestedScrollEnabled
                  contentContainerStyle={{ paddingLeft: 20, paddingRight: 30 }}
                  showsHorizontalScrollIndicator={false}
                >
                  {galleryPreviewImages.map((imageUri, index) => (
                    <View
                      key={`${hotspot.slug}-hero-gallery-${index}`}
                      className={
                        index === galleryPreviewImages.length - 1 ? "" : "mr-3"
                      }
                    >
                      <HeroGalleryThumb
                        imageUri={imageUri}
                        isActive={index === activeGalleryIndex}
                        onPress={() =>
                          setGallerySelection({
                            index,
                            slugKey: resolvedSlug,
                          })
                        }
                      />
                    </View>
                  ))}
                </ScrollView>
              </View>
            </View>
          ) : null}

          <Animated.View
            className="rounded-t-[34px] rounded-b-[34px] pt-4"
            style={[
              sheetShadowStyle,
              sheetLiftStyle,
              {
                backgroundColor: panelBackground,
                minHeight: screenHeight,
                paddingBottom: detailSheetBottomPadding,
                paddingHorizontal: detailSheetHorizontalPadding,
                position: "relative",
                zIndex: 2,
              },
            ]}
          >
            <View className="mt-3">
              <View className="gap-1">
                <Text
                  className="text-[14px] font-black uppercase tracking-[1.4px]"
                  style={sectionEyebrowTextStyle}
                >
                  Thông tin địa điểm
                </Text>
                <Text
                  className="text-[22px] font-semibold text-[#2B2233]"
                  style={sectionTitleTextStyle}
                >
                  {hotspot.title}
                </Text>
              </View>

              {overviewText ? <HotspotOverviewSection text={overviewText} /> : null}

              <SummaryStatsRow items={summaryStats} />

              <View className="mt-4">
                <DirectionMapCard
                  address={hotspot.address}
                  coordinate={hotspot.coordinate}
                  headline={hotspot.title}
                  onInteractionChange={setIsMapInteracting}
                  title={hotspot.title}
                />
              </View>

              <LocationInformationSection
                address={hotspot.address}
                openingHours={openingHoursLabel}
                tagLabels={hotspotTagLabels}
                visitDuration={visitDurationLabel}
              />
            </View>

            <View className="mt-6 gap-4">
              {historicalInfoText ? (
                <HistoricalInfoSection text={historicalInfoText} />
              ) : null}

              <HiddenStoryCheckinSection
                audioStoryDurationLabel={audioStoryDurationLabel}
                isCheckedIn={isCheckedIn}
                isCheckinStatusLoading={isCheckinUiPending}
                isStoryAvailabilityLoading={isStoryAvailabilityLoading}
                isStoryAvailable={canOpenStories}
                onCheckinPress={() => setIsCheckinOverlayVisible(true)}
                onListenStories={() => router.push(hotspotStoriesHref)}
              />
            </View>

            <View className="mt-6 gap-4">
              <RouteMatchesSectionHeader />

              {isRelatedRoutesLoading ? (
                <View className="rounded-[16px] border border-[#EEF1F4] bg-[#FAF7FC] px-4 py-4">
                  <Text className="text-[15px] font-semibold text-[#2B2233]" style={{ lineHeight: 19 }}>
                    Đang tải tuyến phù hợp
                  </Text>
                  <Text className="mt-1 text-[15px]" style={sectionBodyTextStyle}>
                    App đang gọi API route theo hotspotId hiện tại để hiển thị
                    danh sách published.
                  </Text>
                </View>
              ) : null}

              {relatedRoutesError ? (
                <View className="rounded-[16px] border border-[#F9E2EA] bg-[#FFF8FC] px-4 py-4">
                  <Text className="text-[14px] font-bold text-[#C2416C]" style={{ lineHeight: 18 }}>
                    {relatedRoutesError}
                  </Text>
                </View>
              ) : null}

              {!isRelatedRoutesLoading && relatedRoutes.length > 0 ? (
                <ScrollView
                  horizontal
                  contentContainerStyle={{
                    paddingLeft: relatedRouteScrollInset,
                    paddingRight: relatedRouteScrollInset,
                  }}
                  nestedScrollEnabled
                  showsHorizontalScrollIndicator={false}
                  style={{
                    marginHorizontal: -relatedRouteScrollInset,
                    width: screenWidth,
                  }}
                >
                  {relatedRoutes.map((route, index) => (
                    <View
                      key={`${hotspot.slug}-related-route-${route.id}`}
                      className={
                        index === relatedRoutes.length - 1 ? "" : "mr-4"
                      }
                      style={{ width: relatedRouteCardWidth }}
                    >
                      <HotspotRouteCarouselCard
                        route={route}
                        width={relatedRouteCardWidth}
                      />
                    </View>
                  ))}
                </ScrollView>
              ) : !isRelatedRoutesLoading ? (
                <View
                  className="rounded-[16px] bg-white px-5 py-5"
                  style={cardShadowStyle}
                >
                  <Text className="text-[16px] font-semibold text-[#2B2233]" style={{ lineHeight: 20 }}>
                    Chưa có route published
                  </Text>
                  <Text className="mt-2 text-[15px]" style={sectionBodyTextStyle}>
                    {`API route theo hotspot/${resolvedHotspotId} hiện chưa trả về tuyến published nào cho điểm đến này.`}
                  </Text>
                </View>
              ) : null}
            </View>

            <PersonalExperienceSection
              composer={
                isCheckedIn
                  ? {
                      avatarUri: avatarImageUri,
                      onPressCompose: () => router.push(reviewComposeHref),
                    }
                  : null
              }
              isCheckedIn={isCheckedIn}
              isLoadingReviews={isHotspotPostsLoading}
              items={personalExperienceItems}
              reviewsErrorMessage={hotspotPostsError}
            />
          </Animated.View>
        </Animated.ScrollView>

        {!isCheckedIn && !isCheckinUiPending ? (
          <Animated.View
            pointerEvents={isStickyCheckinVisible ? "box-none" : "none"}
            style={[
              stickyCheckinBarStyle,
              { bottom: 0, left: 0, position: "absolute", right: 0, zIndex: 6 },
            ]}
          >
            <StickyCheckinBar
              bottomInset={insets.bottom}
              isCheckedIn={isCheckedIn}
              isCheckinStatusLoading={isCheckinUiPending}
              onPress={() => setIsCheckinOverlayVisible(true)}
            />
          </Animated.View>
        ) : null}

        {isCheckinOverlayVisible ? (
          <HotspotGpsCheckinOverlay
            hotspot={hotspot}
            hotspotId={resolvedHotspotId}
            isStoryAvailable={canOpenStories}
            onClose={() => setIsCheckinOverlayVisible(false)}
            onSuccess={() => {
              addCheckin(hotspotCheckinId);

              if (resolvedHotspotId !== null) {
                addApiCheckin(resolvedHotspotId);
              }
            }}
          />
        ) : null}
      </SafeAreaView>
    </View>
  );
}
