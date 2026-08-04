import { SymbolView } from "@/components/ui/symbol-view";
import { Image } from "expo-image";
import { LinearGradient } from "expo-linear-gradient";
import * as Linking from "expo-linking";
import {
  useFocusEffect,
  useLocalSearchParams,
  useRouter,
  type Href,
} from "expo-router";
import { StatusBar } from "expo-status-bar";
import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ComponentProps,
} from "react";
import {
  ActivityIndicator,
  Alert,
  Modal,
  Platform,
  Pressable,
  Text as RNText,
  ScrollView,
  Share,
  View,
  useWindowDimensions,
  type GestureResponderEvent,
} from "react-native";
import MapView, {
  Marker,
  PROVIDER_GOOGLE,
  type Region,
} from "react-native-maps";
import Animated, {
  Extrapolation,
  interpolate,
  runOnJS,
  useAnimatedReaction,
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
import {
  getRoutesByHotspot,
  mapRouteToRouteItem,
} from "@/features/route/api/route-api";
import {
  addApiCheckin,
  addCheckin,
  mergeApiCheckins,
  useCheckedInApiHotspots,
  useCheckins,
} from "@/lib/checkin-store";
import { type RouteItem } from "@/lib/demo-data";
import { getCheckedInHotspotIds } from "../api/get-checked-in-hotspots";
import { getHotspotById as getHotspotByIdApi } from "../api/get-hotspot-by-id";
import { getHotspotPosts, type HotspotPost } from "../api/get-hotspot-posts";
import {
  getHotspotReviews,
  getReviewCreatedAtTime,
  type HotspotReview,
} from "../api/get-hotspot-reviews";
import type { NearbyHotspotDto } from "../api/get-nearby-hotspots";
import { likePost } from "../api/like-post";
import { likeReview } from "../api/like-review";
import { deleteReview } from "../api/review-mutations";
import {
  HiddenStoryUnlockedContent,
  hiddenStoryActionForegroundColor,
  hiddenStoryActionGradientColors,
} from "../components/hidden-story-unlocked-content";
import { HotspotGpsCheckinOverlay } from "../components/hotspot-gps-checkin-overlay";
import { ReviewDeleteDialog } from "../components/review-delete-dialog";
import { ReviewMediaViewer } from "../components/review-media-viewer";
import { avatarImageUri } from "../data/home-screen.mock";
import { cacheHotspotDetail } from "../data/hotspot-detail-cache";
import { cacheHotspotReviewForEdit } from "../data/hotspot-review-edit-cache";
import { getCachedHotspotStories } from "../data/hotspot-story-cache";
import { type HotspotDetail } from "../data/hotspots";
import {
  addLikedPostId,
  removeLikedPostId,
  useLikedPostIds,
} from "../data/liked-post-store";
import {
  resolveRouteIdParam,
  resolveSelectedHotspotId,
} from "../utils/resolve-selected-hotspot-id";

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
  createdAtTime: number;
  date: string;
  id: string;
  isLiked: boolean;
  isLikePending: boolean;
  likeCount: number;
  media: PersonalExperienceMediaItem[];
  postId: number | null;
  rating: number;
  review: HotspotReview | null;
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
type RelatedRoutesSectionStatus = "idle" | "loading" | "ready" | "empty";

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
const hotspotReviewsPageSize = 20;
const hiddenStoryStatusImage = require("../../../../assets/images/review_post.png");

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
const reviewMediaGridGap = 6;
const reviewCardBorderRadius = 14;
const reviewMediaBorderRadius = 10;
const reviewTextLineHeight = 16;
// Tỉ lệ khung ảnh lấy theo mẫu Google review: 1 ảnh ngang, 2 ảnh gần vuông,
// lưới 4 ảnh thì dẹt lại cho card gọn.
const singleMediaAspectRatio = 16 / 9;
const twoMediaAspectRatio = 6 / 5;
const gridMediaAspectRatio = 16 / 9;
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

function resolveRemoteMediaUris(apiHotspot: NearbyHotspotDto) {
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

  if (resolvedMinimumDuration !== null && resolvedMaximumDuration !== null) {
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
  const averageRating =
    typeof apiHotspot.averageRating === "number" &&
    Number.isFinite(apiHotspot.averageRating)
      ? clampNumber(apiHotspot.averageRating, 0, 5)
      : 0;
  const reviewCount =
    typeof apiHotspot.totalReviews === "number" &&
    Number.isFinite(apiHotspot.totalReviews)
      ? Math.max(0, Math.round(apiHotspot.totalReviews))
      : 0;
  const reviewCountLabel = new Intl.NumberFormat("vi-VN").format(reviewCount);

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
      rating: averageRating,
      reviews: reviewCountLabel,
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

function dedupeRouteItemsById(items: RouteItem[]) {
  return Array.from(
    new Map(items.map((item) => [item.id, item] as const)).values(),
  );
}

function parsePersonalExperienceTime(isoTimestamp?: string | null) {
  const parsedTime = new Date(isoTimestamp ?? "").getTime();

  return Number.isNaN(parsedTime) ? 0 : parsedTime;
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

  return `${parsedDate.getDate().toString().padStart(2, "0")}/${(
    parsedDate.getMonth() + 1
  )
    .toString()
    .padStart(2, "0")}/${parsedDate.getFullYear()}`;
}

function buildApiPersonalExperienceItems(
  posts: HotspotPost[],
  likedPostIds: number[],
  likingPostIds: number[],
): PersonalExperienceItem[] {
  return posts.map((post) => {
    const resolvedMedia = (
      post.medias.length > 0
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
      createdAtTime: parsePersonalExperienceTime(post.createdAt),
      date: formatPersonalExperienceDate(post.createdAt ?? ""),
      id: `post-${post.postId}`,
      isLiked: post.isLiked === true || likedPostIds.includes(post.postId),
      isLikePending: likingPostIds.includes(post.postId),
      likeCount: Math.max(0, Math.round(post.likeCount ?? 0)),
      media: resolvedMedia,
      postId: post.postId,
      rating: 0,
      review: null,
      text: post.text,
      user:
        readMeaningfulApiText(post.displayName) ??
        readMeaningfulApiText(post.username) ??
        "Người dùng",
    };
  });
}

function buildApiReviewPersonalExperienceItems(
  reviews: HotspotReview[],
  likingReviewIds: number[],
): PersonalExperienceItem[] {
  return reviews.map((review) => ({
    avatarUri: readMeaningfulApiText(review.avatarUrl) ?? avatarImageUri,
    createdAtTime: getReviewCreatedAtTime(review),
    date: formatPersonalExperienceDate(review.createdAt),
    id: `review-${review.reviewId}`,
    isLiked: review.isLiked,
    isLikePending: likingReviewIds.includes(review.reviewId),
    likeCount: Math.max(0, Math.round(review.likeCount)),
    media: review.medias.map((media) => ({
      duration:
        media.mediaType.trim().toUpperCase() === "VIDEO" ? "Video" : undefined,
      type:
        media.mediaType.trim().toUpperCase() === "VIDEO"
          ? ("video" as const)
          : ("image" as const),
      uri: media.url,
    })),
    postId: null,
    rating: clampReviewRatingValue(review.rating),
    review,
    text: readMeaningfulApiText(review.comment) ?? "",
    user:
      readMeaningfulApiText(review.displayName) ??
      readMeaningfulApiText(review.username) ??
      "Người dùng",
  }));
}

function dedupePersonalExperienceItems(items: PersonalExperienceItem[]) {
  return Array.from(
    new Map(items.map((item) => [item.id, item] as const)).values(),
  );
}

/** Bài mới nhất luôn nằm trên cùng, không phụ thuộc thứ tự API trả về. */
function sortPersonalExperienceItemsByNewest(items: PersonalExperienceItem[]) {
  return [...items].sort((left, right) => {
    const createdAtDelta = right.createdAtTime - left.createdAtTime;

    if (createdAtDelta !== 0) {
      return createdAtDelta;
    }

    return right.id.localeCompare(left.id, "en", { numeric: true });
  });
}

function isApprovedPostStatus(value?: string | null) {
  return value?.trim().toUpperCase() === "APPROVED";
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
    <Pressable
      accessibilityLabel={isActive ? "Ảnh đang hiển thị" : "Hiển thị ảnh này"}
      accessibilityRole="button"
      accessibilityState={{ selected: isActive }}
      hitSlop={4}
      onPress={onPress}
    >
      <View
        className="overflow-hidden"
        style={{
          backgroundColor: "rgba(255,255,255,0.16)",
          borderColor: isActive ? "#FFFFFF" : "rgba(255,255,255,0.55)",
          borderRadius: 12,
          borderWidth: isActive ? 2 : 1,
          height: isActive ? 92 : 82,
          width: isActive ? 72 : 64,
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
              backgroundColor: "rgba(3, 18, 28, 0.18)",
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

        {items.map((item, index) =>
          index < items.length - 1 ? (
            <SummaryStatDivider
              key={`summary-stat-divider-${item.label}-${index}`}
              leftPercent={((index + 1) / items.length) * 100}
            />
          ) : null,
        )}
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
          <Text
            className="text-[12px] font-bold text-white"
            style={{ lineHeight: 16 }}
          >
            Google Maps error:
          </Text>
          <Text
            className="mt-1 text-[12px] text-white"
            style={{ lineHeight: 16 }}
          >
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
            colors={hiddenStoryActionGradientColors}
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
              tintColor={hiddenStoryActionForegroundColor}
            />
            <Text
              className="ml-1.5 text-[15px] font-semibold"
              style={{ color: hiddenStoryActionForegroundColor }}
            >
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

      <View
        className="rounded-[16px] bg-[#FFF9F3] px-4 py-4"
        style={cardShadowStyle}
      >
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
      <View className="items-center">
        <ActivityIndicator color="#EB489B" size="small" />
      </View>
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
          className="text-[13px] font-black uppercase tracking-[1.4px]"
          style={sectionEyebrowTextStyle}
        >
          Câu chuyện ẩn
        </Text>

        <View
          className="flex-row items-center rounded-full px-3 py-2"
          style={{
            backgroundColor: isCheckedIn ? "#EAF8F1" : "#F6EEE8",
          }}
        >
          {isCheckedIn ? (
            <Image
              source={hiddenStoryStatusImage}
              contentFit="cover"
              contentPosition="center"
              style={{ height: 20, width: 20 }}
            />
          ) : (
            <SymbolView
              name={{
                ios: isCheckinStatusLoading ? "clock.fill" : "lock.fill",
                android: isCheckinStatusLoading ? "schedule" : "lock",
                web: isCheckinStatusLoading ? "schedule" : "lock",
              }}
              size={12}
              tintColor={isCheckinStatusLoading ? "#7C7C93" : "#8A736A"}
            />
          )}
          <Text
            className="ml-1.5 text-[11px] font-black uppercase tracking-[0.8px]"
            style={{
              color: isCheckedIn
                ? "#168A64"
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
            className="mt-4 text-center text-[18px] font-semibold text-[#2B2233]"
            style={{ lineHeight: 20 }}
          >
            Câu chuyện đang chờ bạn
          </Text>

          <Text
            className="mt-1 max-w-[320px] text-center text-[15px]"
            style={[sectionBodyTextStyle, { lineHeight: 18 }]}
          >
            {isCheckinStatusLoading
              ? "Đang kiểm tra trạng thái check-in từ hệ thống trước khi mở khóa nội dung."
              : isStoryAvailable
                ? "Check-in tại đây để mở khóa story hotspot và bản kể chuyện độc quyền."
                : "Check-in tại đây để ghi nhận điểm đến. Story chuyên đề cho hotspot này đang được cập nhật."}
          </Text>

          <Pressable
            className="mt-4 overflow-hidden rounded-full"
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

        <View className="px-3 pb-3 pt-2" style={{ gap: 1 }}>
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
            style={{ lineHeight: 16 }}
          >
            {route.title}
          </Text>

          <Text
            className="text-[12px] text-[#7A6F67]"
            numberOfLines={2}
            ellipsizeMode="tail"
            style={{ lineHeight: 13 }}
          >
            {routeDescription}
          </Text>

          <View className="flex-row flex-wrap items-center justify-end gap-1.5 pt-0.5">
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

function PersonalExperienceSectionHeader({
  totalReviewLabel,
}: {
  totalReviewLabel?: string | null;
}) {
  return (
    <Text
      className="text-[14px] font-black uppercase tracking-[1.4px]"
      style={sectionEyebrowTextStyle}
    >
      Xếp hạng và đánh giá
      {totalReviewLabel ? (
        <Text className="text-[14px] font-black text-[#A39AAB]">
          {" "}
          ({totalReviewLabel})
        </Text>
      ) : null}
    </Text>
  );
}

function PersonalExperienceMediaThumb({
  borderRadius = 0,
  height = 104,
  item,
  onPress,
  overlayLabel,
  width,
}: {
  borderRadius?: number;
  height?: number;
  item: PersonalExperienceMediaItem;
  onPress: () => void;
  overlayLabel?: string;
  width: number | `${number}%`;
}) {
  const shouldShowOverlayLabel =
    typeof overlayLabel === "string" && overlayLabel.trim().length > 0;

  return (
    <Pressable
      accessibilityLabel="Xem ảnh đánh giá toàn màn hình"
      accessibilityRole="imagebutton"
      className="overflow-hidden"
      onPress={onPress}
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
    </Pressable>
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
          <LinearGradient
            colors={hiddenStoryActionGradientColors}
            end={{ x: 1, y: 0.5 }}
            locations={[0, 0.58, 1]}
            start={{ x: 0, y: 0.5 }}
            className="flex-row items-center justify-center px-5 py-3.5"
          >
            <SymbolView
              name={{
                ios: "camera",
                android: "photo_camera",
                web: "photo_camera",
              }}
              size={16}
              tintColor={hiddenStoryActionForegroundColor}
            />
            <Text
              className="ml-2 text-[15px] font-semibold"
              style={{ color: hiddenStoryActionForegroundColor }}
            >
              Thêm ảnh và video
            </Text>
          </LinearGradient>
        </Pressable>
      </View>
    </View>
  );
}

function PersonalExperienceLikeButton({
  isLiked,
  isPending = false,
  onPress,
  value,
}: {
  isLiked: boolean;
  isPending?: boolean;
  onPress: () => void;
  value: number;
}) {
  return (
    <Pressable
      accessibilityLabel={isLiked ? "Gỡ tim bài viết" : "Thả tim bài viết"}
      accessibilityRole="button"
      accessibilityState={{ disabled: isPending, selected: isLiked }}
      className="flex-row items-center gap-1.5 self-start py-0.5"
      disabled={isPending}
      hitSlop={8}
      onPress={onPress}
      style={{ opacity: isPending ? 0.6 : 1 }}
    >
      <SymbolView
        name={
          isLiked
            ? { ios: "heart.fill", android: "favorite", web: "favorite" }
            : {
                ios: "heart",
                android: "favorite_border",
                web: "favorite_border",
              }
        }
        size={20}
        tintColor={isLiked ? "#F43F5E" : "#2B2233"}
      />
      <Text
        className="text-[14px] font-semibold"
        style={{ color: isLiked ? "#F43F5E" : "#2B2233", lineHeight: 16 }}
      >
        {value}
      </Text>
    </Pressable>
  );
}

function PersonalExperienceCard({
  isReviewActionPending,
  item,
  onDeleteReview,
  onEditReview,
  onPressLike,
  onPressLikeReview,
}: {
  isReviewActionPending: boolean;
  item: PersonalExperienceItem;
  onDeleteReview: (review: HotspotReview) => void;
  onEditReview: (review: HotspotReview) => void;
  onPressLike: (postId: number) => void;
  onPressLikeReview: (reviewId: number) => void;
}) {
  const insets = useSafeAreaInsets();
  const { height: screenHeight, width: screenWidth } = useWindowDimensions();
  const [measuredMediaWidth, setMeasuredMediaWidth] = useState(0);
  const [reviewMenuAnchor, setReviewMenuAnchor] = useState<{
    left: number;
    top: number;
  } | null>(null);
  const [viewerMediaIndex, setViewerMediaIndex] = useState<number | null>(null);
  const hasSingleMedia = item.media.length === 1;
  const hasTwoMedia = item.media.length === 2;
  const hasThreeMedia = item.media.length === 3;
  // Card không còn padding ngang riêng: ảnh và cụm avatar thẳng hàng với tiêu đề mục.
  const fallbackMediaContentWidth = Math.max(
    screenWidth - detailSheetHorizontalPadding * 2,
    0,
  );
  const reviewMediaContentWidth =
    measuredMediaWidth > 0 ? measuredMediaWidth : fallbackMediaContentWidth;
  // Làm tròn xuống để 2 ô + gap luôn vừa đúng một hàng, không bị rớt dòng.
  const halfWidthMediaItemWidth = Math.max(
    Math.floor((reviewMediaContentWidth - reviewMediaGridGap) / 2),
    0,
  );
  const multiMediaPreviewItems = hasSingleMedia
    ? item.media
    : item.media.slice(0, 4);
  const hiddenMediaCount = Math.max(
    item.media.length - multiMediaPreviewItems.length,
    0,
  );
  const singleMediaHeight = Math.round(
    reviewMediaContentWidth / singleMediaAspectRatio,
  );
  const twoMediaHeight = Math.round(
    halfWidthMediaItemWidth / twoMediaAspectRatio,
  );
  const gridMediaHeight = Math.round(
    halfWidthMediaItemWidth / gridMediaAspectRatio,
  );
  const threeMediaLeadWidth = Math.max(
    Math.round(reviewMediaContentWidth * 0.56),
    0,
  );
  const threeMediaSideWidth = Math.max(
    reviewMediaContentWidth - threeMediaLeadWidth - reviewMediaGridGap,
    0,
  );
  const threeMediaHeight = Math.round(
    threeMediaLeadWidth / twoMediaAspectRatio,
  );
  const threeMediaStackHeight = Math.max(
    (threeMediaHeight - reviewMediaGridGap) / 2,
    0,
  );
  const hasText = item.text.trim().length > 0;
  const hasRating = item.rating > 0;
  // Post và review dùng hai endpoint like khác nhau nhưng chung một nút tim.
  const likeablePostId = item.postId;
  const likeableReviewId = item.review?.reviewId ?? null;
  const canLike = likeablePostId !== null || likeableReviewId !== null;
  const manageableReview = item.review?.isOwner ? item.review : null;

  const handleOpenReviewMenu = (event: GestureResponderEvent) => {
    if (isReviewActionPending) {
      return;
    }

    const menuWidth = 216;
    const menuHeight = manageableReview ? 156 : 52;
    const viewportInset = 12;
    const pressX = event.nativeEvent.pageX;
    const pressY = event.nativeEvent.pageY;
    const maximumLeft = Math.max(
      viewportInset,
      screenWidth - menuWidth - viewportInset,
    );
    const left = Math.min(
      Math.max(pressX - menuWidth + 18, viewportInset),
      maximumLeft,
    );
    const preferredTop = pressY + 20;
    const maximumTop = screenHeight - insets.bottom - menuHeight - 8;
    const top =
      preferredTop <= maximumTop
        ? preferredTop
        : Math.max(insets.top + 8, pressY - menuHeight - 20);

    setReviewMenuAnchor({ left, top });
  };

  const handleSharePersonalExperience = async () => {
    setReviewMenuAnchor(null);

    try {
      await Share.share({
        message:
          [item.user, item.text.trim()].filter(Boolean).join("\n\n") ||
          "Bài viết trên Culture Quest Lite",
        title: `Bài viết của ${item.user}`,
      });
    } catch (error) {
      console.warn("[hotspot-detail] share review failed", {
        error: error instanceof Error ? error.message : error,
        itemId: item.id,
      });
      Alert.alert("Không thể chia sẻ", "Vui lòng thử lại sau.");
    }
  };

  return (
    <View
      className="bg-white py-3"
      style={[cardShadowStyle, { borderRadius: reviewCardBorderRadius }]}
    >
      <View className="flex-row items-center">
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
        <Pressable
          accessibilityLabel="Mở tùy chọn bài viết"
          accessibilityRole="button"
          accessibilityState={{ disabled: isReviewActionPending }}
          className="ml-1 h-9 w-9 items-center justify-center rounded-full"
          disabled={isReviewActionPending}
          hitSlop={8}
          onPress={handleOpenReviewMenu}
          style={{ opacity: isReviewActionPending ? 0.5 : 1 }}
        >
          {isReviewActionPending ? (
            <ActivityIndicator color="#8A7B83" size="small" />
          ) : (
            <SymbolView
              name={{
                ios: "ellipsis",
                android: "more_horiz",
                web: "more_horiz",
              }}
              size={19}
              tintColor="#5F5662"
            />
          )}
        </Pressable>
      </View>

      <Modal
        animationType="fade"
        onRequestClose={() => setReviewMenuAnchor(null)}
        statusBarTranslucent
        transparent
        visible={reviewMenuAnchor !== null}
      >
        <View className="flex-1">
          <Pressable
            accessibilityLabel="Đóng tùy chọn bài đánh giá"
            className="absolute inset-0"
            onPress={() => setReviewMenuAnchor(null)}
          />

          {reviewMenuAnchor ? (
            <View
              className="overflow-hidden border border-[#E7E3E8] bg-white"
              style={[
                cardShadowStyle,
                {
                  borderRadius: 8,
                  left: reviewMenuAnchor.left,
                  position: "absolute",
                  top: reviewMenuAnchor.top,
                  width: 216,
                },
              ]}
            >
              {manageableReview ? (
                <>
                  <Pressable
                    accessibilityRole="button"
                    className="flex-row items-center px-4"
                    onPress={() => {
                      setReviewMenuAnchor(null);
                      onEditReview(manageableReview);
                    }}
                    style={{ height: 52 }}
                  >
                    <SymbolView
                      name={{ ios: "pencil", android: "edit", web: "edit" }}
                      size={19}
                      tintColor="#2B2233"
                    />
                    <Text className="ml-3 flex-1 text-[15px] font-semibold text-[#2B2233]">
                      Chỉnh sửa bài viết
                    </Text>
                  </Pressable>

                  <View className="h-px bg-[#ECE8ED]" />

                  <Pressable
                    accessibilityRole="button"
                    className="flex-row items-center px-4"
                    onPress={() => {
                      setReviewMenuAnchor(null);
                      onDeleteReview(manageableReview);
                    }}
                    style={{ height: 52 }}
                  >
                    <SymbolView
                      name={{
                        ios: "trash",
                        android: "delete_outline",
                        web: "delete_outline",
                      }}
                      size={19}
                      tintColor="#C24157"
                    />
                    <Text className="ml-3 flex-1 text-[15px] font-semibold text-[#C24157]">
                      Xóa bài viết
                    </Text>
                  </Pressable>

                  <View className="h-px bg-[#ECE8ED]" />
                </>
              ) : null}

              <Pressable
                accessibilityRole="button"
                className="flex-row items-center px-4"
                onPress={() => {
                  void handleSharePersonalExperience();
                }}
                style={{ height: 52 }}
              >
                <SymbolView
                  name={{
                    ios: "square.and.arrow.up",
                    android: "share",
                    web: "share",
                  }}
                  size={19}
                  tintColor="#2B2233"
                />
                <Text className="ml-3 flex-1 text-[15px] font-semibold text-[#2B2233]">
                  Chia sẻ bài viết
                </Text>
              </Pressable>
            </View>
          ) : null}
        </View>
      </Modal>

      {hasRating ? (
        <View className="mt-1 flex-row items-center">
          <RatingStars rating={item.rating} size={13} />
        </View>
      ) : null}

      {hasText ? (
        <Text
          className="mt-1 text-[14px] text-[#554751]"
          style={[
            sectionBodyEmphasisTextStyle,
            { lineHeight: reviewTextLineHeight },
          ]}
        >
          {item.text}
        </Text>
      ) : null}

      {item.media.length > 0 ? (
        <View
          className="mt-2"
          onLayout={(event) => {
            const nextWidth = Math.round(event.nativeEvent.layout.width);

            setMeasuredMediaWidth((currentWidth) =>
              currentWidth === nextWidth ? currentWidth : nextWidth,
            );
          }}
        >
          {hasSingleMedia ? (
            <PersonalExperienceMediaThumb
              borderRadius={reviewMediaBorderRadius}
              height={singleMediaHeight}
              item={item.media[0]}
              onPress={() => setViewerMediaIndex(0)}
              width="100%"
            />
          ) : hasTwoMedia ? (
            <View
              className="flex-row"
              style={{ columnGap: reviewMediaGridGap }}
            >
              {item.media.map((media, index) => (
                <PersonalExperienceMediaThumb
                  borderRadius={reviewMediaBorderRadius}
                  height={twoMediaHeight}
                  key={`${item.id}-media-${index}`}
                  item={media}
                  onPress={() => setViewerMediaIndex(index)}
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
                borderRadius={reviewMediaBorderRadius}
                height={threeMediaHeight}
                item={item.media[0]}
                onPress={() => setViewerMediaIndex(0)}
                width={threeMediaLeadWidth}
              />
              <View
                style={{
                  rowGap: reviewMediaGridGap,
                  width: threeMediaSideWidth,
                }}
              >
                {item.media.slice(1).map((media, index) => (
                  <PersonalExperienceMediaThumb
                    borderRadius={reviewMediaBorderRadius}
                    height={threeMediaStackHeight}
                    key={`${item.id}-media-stack-${index}`}
                    item={media}
                    onPress={() => setViewerMediaIndex(index + 1)}
                    width={threeMediaSideWidth}
                  />
                ))}
              </View>
            </View>
          ) : (
            <View
              style={{
                columnGap: reviewMediaGridGap,
                flexDirection: "row",
                flexWrap: "wrap",
                rowGap: reviewMediaGridGap,
              }}
            >
              {multiMediaPreviewItems.map((media, index) => (
                <PersonalExperienceMediaThumb
                  borderRadius={reviewMediaBorderRadius}
                  height={gridMediaHeight}
                  key={`${item.id}-media-${index}`}
                  item={media}
                  onPress={() => setViewerMediaIndex(index)}
                  overlayLabel={
                    index === multiMediaPreviewItems.length - 1 &&
                    hiddenMediaCount > 0
                      ? `+${hiddenMediaCount}`
                      : undefined
                  }
                  width={halfWidthMediaItemWidth}
                />
              ))}
            </View>
          )}
        </View>
      ) : null}

      {viewerMediaIndex !== null ? (
        <ReviewMediaViewer
          initialIndex={viewerMediaIndex}
          items={item.media}
          onClose={() => setViewerMediaIndex(null)}
        />
      ) : null}

      {canLike ? (
        <View className="mt-2 flex-row items-center">
          <PersonalExperienceLikeButton
            isLiked={item.isLiked}
            isPending={item.isLikePending}
            onPress={() => {
              if (likeablePostId !== null) {
                onPressLike(likeablePostId);
                return;
              }

              if (likeableReviewId !== null) {
                onPressLikeReview(likeableReviewId);
              }
            }}
            value={item.likeCount}
          />
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
      <Text
        className="text-[16px] font-semibold text-[#2B2233]"
        style={{ lineHeight: 20 }}
      >
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
      <Text
        className="text-[14px] font-bold text-[#C2416C]"
        style={{ lineHeight: 18 }}
      >
        {message}
      </Text>
    </View>
  );
}

function PersonalExperienceSection({
  composer,
  deletingReviewId,
  isCheckedIn,
  isLoadingReviews = false,
  items,
  onDeleteReview,
  onEditReview,
  onPressLike,
  onPressLikeReview,
  reviewsErrorMessage,
  totalReviewLabel,
}: {
  composer?: PersonalExperienceComposerProps | null;
  deletingReviewId: number | null;
  isCheckedIn: boolean;
  isLoadingReviews?: boolean;
  items: PersonalExperienceItem[];
  onDeleteReview: (review: HotspotReview) => void;
  onEditReview: (review: HotspotReview) => void;
  onPressLike: (postId: number) => void;
  onPressLikeReview: (reviewId: number) => void;
  reviewsErrorMessage?: string | null;
  totalReviewLabel?: string | null;
}) {
  const [isShowingAllReviews, setIsShowingAllReviews] = useState(false);
  const canToggleAllReviews = items.length > recentReviewPreviewCount;
  const visibleItems =
    canToggleAllReviews && !isShowingAllReviews
      ? items.slice(0, recentReviewPreviewCount)
      : items;

  return (
    <View className="mt-5 gap-3">
      <PersonalExperienceSectionHeader totalReviewLabel={totalReviewLabel} />

      {reviewsErrorMessage ? (
        <PersonalExperienceErrorCard message={reviewsErrorMessage} />
      ) : null}

      <View className="gap-3">
        {isLoadingReviews && items.length === 0 ? (
          <PersonalExperienceLoadingCard />
        ) : items.length > 0 ? (
          visibleItems.map((item) => (
            <PersonalExperienceCard
              key={item.id}
              isReviewActionPending={item.review?.reviewId === deletingReviewId}
              item={item}
              onDeleteReview={onDeleteReview}
              onEditReview={onEditReview}
              onPressLike={onPressLike}
              onPressLikeReview={onPressLikeReview}
            />
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
          <Text
            className="text-[15px] font-semibold text-[#2B2233]"
            style={{ lineHeight: 16 }}
          >
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
      <SafeAreaView
        className="flex-1"
        edges={["top", "left", "right", "bottom"]}
      >
        <View className="flex-1 items-center justify-center px-6">
          <View className="items-center">
            <ActivityIndicator color="#F58752" size="large" />
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
  const { hotspotId, routeId, slug } = useLocalSearchParams<{
    hotspotId?: string;
    routeId?: string;
    slug: string;
  }>();
  const resolvedSlug = Array.isArray(slug) ? (slug[0] ?? "") : (slug ?? "");
  const resolvedHotspotId = resolveSelectedHotspotId({
    hotspotId,
    slug: resolvedSlug,
  });
  const resolvedRouteId = resolveRouteIdParam(routeId);
  const likedPostsAccountKey =
    authSession.username?.trim() || authSession.displayName.trim() || null;
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
  const [likingPostIds, setLikingPostIds] = useState<number[]>([]);
  const [likingReviewIds, setLikingReviewIds] = useState<number[]>([]);
  const [hotspotPostsError, setHotspotPostsError] = useState<string | null>(
    null,
  );
  const persistedLikedPostIds = useLikedPostIds(likedPostsAccountKey);
  const [isHotspotPostsLoading, setIsHotspotPostsLoading] = useState(
    () => resolvedHotspotId !== null,
  );
  const [apiHotspotReviews, setApiHotspotReviews] = useState<HotspotReview[]>(
    [],
  );
  const [hotspotReviewsError, setHotspotReviewsError] = useState<string | null>(
    null,
  );
  const [isHotspotReviewsLoading, setIsHotspotReviewsLoading] = useState(
    () => resolvedHotspotId !== null,
  );
  const [deletingReviewId, setDeletingReviewId] = useState<number | null>(null);
  const [reviewPendingDeletion, setReviewPendingDeletion] =
    useState<HotspotReview | null>(null);
  const cachedStoriesEntry = getCachedHotspotStories({
    hotspotId: resolvedHotspotId,
    routeId: resolvedRouteId,
    slug: resolvedSlug,
  });
  const [isMapInteracting, setIsMapInteracting] = useState(false);
  const [gallerySelection, setGallerySelection] = useState(() => ({
    index: 0,
    slugKey: resolvedSlug,
  }));
  const [isHeroGalleryVisible, setIsHeroGalleryVisible] = useState(true);
  const heroTouchStartRef = useRef<{ pageX: number; pageY: number } | null>(
    null,
  );
  const heroHeight = clampNumber(screenHeight * 0.4, 280, 360);
  const stickyCheckinRevealOffset = Math.max(heroHeight * 0.72, 220);

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
        setLikingPostIds([]);
        setHotspotPostsError(null);
        setIsHotspotPostsLoading(false);
        return;
      }

      setIsHotspotPostsLoading(true);
      setApiHotspotPosts([]);
      setLikingPostIds([]);
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

        setApiHotspotPosts(
          response.content.filter((post) => isApprovedPostStatus(post.status)),
        );
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
  }, [
    authSession.isAuthenticated,
    authSession.tokenType,
    resolvedHotspotId,
    resolvedSlug,
  ]);

  // Chạy theo focus để bài đánh giá vừa gửi ở màn review-compose hiện ngay khi quay lại.
  useFocusEffect(
    useCallback(() => {
      let isActive = true;

      const loadHotspotReviews = async () => {
        if (resolvedHotspotId === null) {
          setApiHotspotReviews([]);
          setHotspotReviewsError(null);
          setIsHotspotReviewsLoading(false);
          return;
        }

        setIsHotspotReviewsLoading(true);
        setHotspotReviewsError(null);

        try {
          const accessToken = authSession.isAuthenticated
            ? await getValidAccessToken()
            : null;
          const response = await getHotspotReviews({
            accessToken,
            page: 0,
            size: hotspotReviewsPageSize,
            targetId: resolvedHotspotId,
            targetType: "HOTSPOT",
            tokenType: authSession.tokenType,
          });

          if (!isActive) {
            return;
          }

          setApiHotspotReviews(response.content);
        } catch (error) {
          console.warn("[hotspot-detail] load hotspot reviews failed", {
            error: error instanceof Error ? error.message : error,
            hotspotId: resolvedHotspotId,
            slug: resolvedSlug,
          });

          if (!isActive) {
            return;
          }

          setApiHotspotReviews([]);
          setHotspotReviewsError(
            error instanceof Error
              ? error.message
              : "Không tải được đánh giá theo hotspotId.",
          );
        } finally {
          if (isActive) {
            setIsHotspotReviewsLoading(false);
          }
        }
      };

      void loadHotspotReviews();

      return () => {
        isActive = false;
      };
    }, [
      authSession.isAuthenticated,
      authSession.tokenType,
      resolvedHotspotId,
      resolvedSlug,
      setApiHotspotReviews,
      setHotspotReviewsError,
      setIsHotspotReviewsLoading,
    ]),
  );

  async function handlePressLikeHotspotPost(postId: number) {
    const targetPost = apiHotspotPosts.find((post) => post.postId === postId);

    if (likingPostIds.includes(postId)) {
      return;
    }

    if (!authSession.isAuthenticated) {
      Alert.alert(
        "Cần đăng nhập",
        "Bạn cần đăng nhập để thả tim bài đánh giá này.",
      );
      return;
    }

    const accessToken = await getValidAccessToken();

    if (!accessToken) {
      Alert.alert(
        "Phiên đăng nhập hết hạn",
        "Vui lòng đăng nhập lại trước khi thả tim bài đánh giá.",
      );
      return;
    }

    const currentIsLiked =
      targetPost?.isLiked === true || persistedLikedPostIds.includes(postId);
    const currentLikeCount = Math.max(
      0,
      Math.round(targetPost?.likeCount ?? 0),
    );
    const optimisticIsLiked = !currentIsLiked;
    const optimisticLikeCount = optimisticIsLiked
      ? currentLikeCount + 1
      : Math.max(0, currentLikeCount - 1);

    setLikingPostIds((current) =>
      current.includes(postId) ? current : [...current, postId],
    );
    setApiHotspotPosts((current) =>
      current.map((post) =>
        post.postId === postId
          ? {
              ...post,
              isLiked: optimisticIsLiked,
              likeCount: optimisticLikeCount,
            }
          : post,
      ),
    );

    try {
      const result = await likePost({
        accessToken,
        postId,
        tokenType: authSession.tokenType,
      });

      const resolvedIsLiked = result.isLiked ?? optimisticIsLiked;
      const resolvedLikeCount = result.likeCount ?? optimisticLikeCount;

      setApiHotspotPosts((current) =>
        current.map((post) =>
          post.postId === postId
            ? {
                ...post,
                isLiked: resolvedIsLiked,
                likeCount: resolvedLikeCount,
              }
            : post,
        ),
      );

      if (likedPostsAccountKey) {
        if (resolvedIsLiked) {
          addLikedPostId(likedPostsAccountKey, postId);
        } else {
          removeLikedPostId(likedPostsAccountKey, postId);
        }
      }
    } catch (error) {
      setApiHotspotPosts((current) =>
        current.map((post) =>
          post.postId === postId
            ? {
                ...post,
                isLiked: currentIsLiked,
                likeCount: currentLikeCount,
              }
            : post,
        ),
      );

      if (likedPostsAccountKey) {
        if (currentIsLiked) {
          addLikedPostId(likedPostsAccountKey, postId);
        } else {
          removeLikedPostId(likedPostsAccountKey, postId);
        }
      }
      Alert.alert(
        "Không thể thả tim",
        error instanceof Error
          ? error.message
          : "Đã có lỗi xảy ra khi thả tim bài đánh giá.",
      );
    } finally {
      setLikingPostIds((current) => current.filter((id) => id !== postId));
    }
  }

  async function handlePressLikeHotspotReview(reviewId: number) {
    if (likingReviewIds.includes(reviewId)) {
      return;
    }

    const targetReview = apiHotspotReviews.find(
      (review) => review.reviewId === reviewId,
    );

    if (!targetReview) {
      return;
    }

    if (!authSession.isAuthenticated) {
      Alert.alert(
        "Cần đăng nhập",
        "Bạn cần đăng nhập để thả tim bài đánh giá này.",
      );
      return;
    }

    const accessToken = await getValidAccessToken();

    if (!accessToken) {
      Alert.alert(
        "Phiên đăng nhập hết hạn",
        "Vui lòng đăng nhập lại trước khi thả tim bài đánh giá.",
      );
      return;
    }

    const currentIsLiked = targetReview.isLiked;
    const currentLikeCount = Math.max(0, Math.round(targetReview.likeCount));
    // Bấm lại lần nữa là gỡ tim: đảo trạng thái và giảm số đếm.
    const optimisticIsLiked = !currentIsLiked;
    const optimisticLikeCount = optimisticIsLiked
      ? currentLikeCount + 1
      : Math.max(0, currentLikeCount - 1);

    const applyReviewLikeState = (isLiked: boolean, likeCount: number) => {
      setApiHotspotReviews((current) =>
        current.map((review) =>
          review.reviewId === reviewId
            ? { ...review, isLiked, likeCount }
            : review,
        ),
      );
    };

    setLikingReviewIds((current) =>
      current.includes(reviewId) ? current : [...current, reviewId],
    );
    applyReviewLikeState(optimisticIsLiked, optimisticLikeCount);

    try {
      const result = await likeReview({
        accessToken,
        reviewId,
        tokenType: authSession.tokenType,
      });

      // API trả về nguyên review sau khi like nên merge thẳng cho khớp BE.
      if (result.review) {
        const likedReview = result.review;

        setApiHotspotReviews((current) =>
          current.map((review) =>
            review.reviewId === reviewId
              ? { ...review, ...likedReview }
              : review,
          ),
        );
      } else {
        applyReviewLikeState(
          result.isLiked ?? optimisticIsLiked,
          result.likeCount ?? optimisticLikeCount,
        );
      }
    } catch (error) {
      applyReviewLikeState(currentIsLiked, currentLikeCount);
      Alert.alert(
        "Không thể thả tim",
        error instanceof Error
          ? error.message
          : "Đã có lỗi xảy ra khi thả tim bài đánh giá.",
      );
    } finally {
      setLikingReviewIds((current) => current.filter((id) => id !== reviewId));
    }
  }

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
  const activeGalleryIndex = Math.min(
    gallerySelection.slugKey === resolvedSlug ? gallerySelection.index : 0,
    Math.max(galleryPreviewImages.length - 1, 0),
  );
  const activeHeroImageUri =
    galleryPreviewImages[activeGalleryIndex] ?? hotspot.imageUri;
  const handleSelectHeroImage = (index: number) => {
    const selectedIndex = Math.min(
      Math.max(index, 0),
      Math.max(galleryPreviewImages.length - 1, 0),
    );

    setGallerySelection({
      index: selectedIndex,
      slugKey: resolvedSlug,
    });
    setIsHeroGalleryVisible(true);
  };
  const handleHeroTouchStart = (event: GestureResponderEvent) => {
    heroTouchStartRef.current = {
      pageX: event.nativeEvent.pageX,
      pageY: event.nativeEvent.pageY,
    };
  };
  const handleHeroTouchEnd = (event: GestureResponderEvent) => {
    const touchStart = heroTouchStartRef.current;
    heroTouchStartRef.current = null;

    if (!touchStart) {
      return;
    }

    const deltaX = event.nativeEvent.pageX - touchStart.pageX;
    const deltaY = event.nativeEvent.pageY - touchStart.pageY;
    const isHorizontalSwipe =
      Math.abs(deltaX) >= 28 && Math.abs(deltaX) > Math.abs(deltaY) * 1.2;

    if (isHorizontalSwipe) {
      const nextIndex =
        deltaX < 0
          ? Math.min(activeGalleryIndex + 1, galleryPreviewImages.length - 1)
          : Math.max(activeGalleryIndex - 1, 0);

      handleSelectHeroImage(nextIndex);
      return;
    }

    if (Math.abs(deltaX) <= 8 && Math.abs(deltaY) <= 8) {
      setIsHeroGalleryVisible(false);
    }
  };
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
    resolvedHotspotId !== null &&
    checkedInApiHotspots.includes(resolvedHotspotId);
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
    ? Math.max(insets.bottom, 8)
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
    resolvedHotspotId !== null || resolvedRouteId !== null
      ? ({
          params: {
            ...(resolvedHotspotId !== null
              ? { hotspotId: `${resolvedHotspotId}` }
              : {}),
            ...(resolvedRouteId !== null
              ? { routeId: `${resolvedRouteId}` }
              : {}),
            slug: hotspot.slug,
          },
          pathname: "/hotspot/[slug]/stories",
        } as Href)
      : (`/hotspot/${hotspot.slug}/stories` as Href);
  const reviewComposeHref = {
    params: {
      ...(resolvedHotspotId !== null
        ? { hotspotId: `${resolvedHotspotId}` }
        : {}),
      slug: hotspot.slug,
      title: hotspot.title,
    },
    pathname: "/hotspot/[slug]/review-compose",
  } as Href;

  const handleEditHotspotReview = (review: HotspotReview) => {
    if (!review.isOwner || deletingReviewId !== null) {
      return;
    }

    cacheHotspotReviewForEdit(review);

    const editHotspotId =
      resolvedHotspotId ?? (review.targetId > 0 ? review.targetId : null);

    router.push({
      params: {
        ...(editHotspotId !== null ? { hotspotId: `${editHotspotId}` } : {}),
        reviewId: `${review.reviewId}`,
        slug: hotspot.slug,
        title: hotspot.title,
      },
      pathname: "/hotspot/[slug]/review-compose",
    } as Href);
  };

  const confirmDeleteHotspotReview = async (review: HotspotReview) => {
    if (!review.isOwner || deletingReviewId !== null) {
      return;
    }

    if (!authSession.isAuthenticated) {
      setReviewPendingDeletion(null);
      Alert.alert("Cần đăng nhập", "Bạn cần đăng nhập để xóa bài đánh giá.");
      return;
    }

    setDeletingReviewId(review.reviewId);

    try {
      const accessToken = await getValidAccessToken();

      if (!accessToken) {
        setReviewPendingDeletion(null);
        Alert.alert(
          "Phiên đăng nhập hết hạn",
          "Vui lòng đăng nhập lại trước khi xóa bài đánh giá.",
        );
        return;
      }

      await deleteReview({
        accessToken,
        reviewId: review.reviewId,
        tokenType: authSession.tokenType,
      });

      setApiHotspotReviews((currentReviews) =>
        currentReviews.filter(
          (currentReview) => currentReview.reviewId !== review.reviewId,
        ),
      );
      setReviewPendingDeletion(null);
      Alert.alert("Đã xóa", "Bài đánh giá đã được xóa.");
    } catch (error) {
      Alert.alert(
        "Không thể xóa bài",
        error instanceof Error
          ? error.message
          : "Đã có lỗi xảy ra khi xóa bài đánh giá.",
      );
    } finally {
      setDeletingReviewId(null);
    }
  };

  const handleDeleteHotspotReview = (review: HotspotReview) => {
    setReviewPendingDeletion(review);
  };
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
  const apiPersonalExperienceItems = buildApiPersonalExperienceItems(
    apiHotspotPosts,
    persistedLikedPostIds,
    likingPostIds,
  );
  const apiReviewPersonalExperienceItems =
    buildApiReviewPersonalExperienceItems(apiHotspotReviews, likingReviewIds);
  const personalExperienceItems = sortPersonalExperienceItemsByNewest(
    dedupePersonalExperienceItems([
      ...apiReviewPersonalExperienceItems,
      ...apiPersonalExperienceItems,
    ]),
  );
  const personalExperienceErrorMessage =
    hotspotReviewsError ?? hotspotPostsError;
  const summaryStats = buildSummaryStats({
    apiHotspot: remoteHotspot,
    hotspot,
    rewardXp,
  });

  return (
    <View className="flex-1" style={{ backgroundColor: screenBackground }}>
      <StatusBar style="light" />

      <SafeAreaView className="flex-1" edges={["left", "right"]}>
        <Animated.ScrollView
          bounces={false}
          overScrollMode="never"
          style={{
            flex: 1,
          }}
          onScroll={handleScroll}
          scrollEnabled={!isMapInteracting}
          scrollEventThrottle={16}
          showsVerticalScrollIndicator={false}
        >
          <View
            className="overflow-hidden bg-[#EEE8EC]"
            style={[heroShadowStyle, { height: heroHeight }]}
          >
            <View
              onTouchEnd={handleHeroTouchEnd}
              onTouchStart={handleHeroTouchStart}
              style={{ height: heroHeight, width: "100%" }}
            >
              <Image
                key={`${hotspot.slug}-hero-image-${activeGalleryIndex}`}
                source={activeHeroImageUri}
                contentFit="cover"
                transition={180}
                cachePolicy="memory-disk"
                style={{ height: "100%", width: "100%" }}
              />
            </View>

            <LinearGradient
              pointerEvents="none"
              colors={[
                "rgba(5, 16, 28, 0.34)",
                "rgba(5, 16, 28, 0)",
                "rgba(5, 16, 28, 0.24)",
              ]}
              locations={[0, 0.35, 1]}
              start={{ x: 0.5, y: 0 }}
              end={{ x: 0.5, y: 1 }}
              style={{
                bottom: 0,
                left: 0,
                position: "absolute",
                right: 0,
                top: 0,
              }}
            />

            <View
              pointerEvents="box-none"
              style={{
                left: 0,
                position: "absolute",
                right: 0,
                top: 0,
                zIndex: 3,
              }}
            >
              <View className="px-4" style={{ paddingTop: insets.top + 8 }}>
                <View
                  style={{ alignSelf: "center", maxWidth: 520, width: "100%" }}
                >
                  <View className="flex-row items-center justify-between">
                    <Pressable
                      className="h-11 w-11 items-center justify-center rounded-full bg-black/30"
                      hitSlop={8}
                      onPress={() => router.back()}
                    >
                      <SymbolView
                        name={{
                          ios: "chevron.left",
                          android: "arrow_back",
                          web: "arrow_back",
                        }}
                        size={19}
                        tintColor="#FFFFFF"
                      />
                    </Pressable>

                    <View className="flex-1" />

                    <Pressable
                      className="h-11 w-11 items-center justify-center rounded-full bg-black/30"
                      hitSlop={8}
                      onPress={() => router.replace("/hotspots")}
                    >
                      <SymbolView
                        name={{
                          ios: "list.bullet",
                          android: "view_list",
                          web: "view_list",
                        }}
                        size={19}
                        tintColor="#FFFFFF"
                      />
                    </Pressable>
                  </View>
                </View>
              </View>
            </View>

            {galleryPreviewImages.length > 1 && isHeroGalleryVisible ? (
              <View
                pointerEvents="box-none"
                className="absolute inset-x-0"
                style={{ bottom: 34, zIndex: 4 }}
              >
                <ScrollView
                  horizontal
                  nestedScrollEnabled
                  contentContainerStyle={{
                    alignItems: "flex-end",
                    paddingHorizontal: 18,
                    paddingVertical: 4,
                  }}
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
                        onPress={() => handleSelectHeroImage(index)}
                      />
                    </View>
                  ))}
                </ScrollView>
              </View>
            ) : null}
          </View>

          <View
            className="rounded-t-[30px] pt-4"
            style={[
              sheetShadowStyle,
              {
                backgroundColor: panelBackground,
                marginTop: -24,
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
                  style={[sectionTitleTextStyle, { lineHeight: 20 }]}
                >
                  {hotspot.title}
                </Text>

                <View className="mt-1 flex-row items-center gap-1.5">
                  <Text
                    className="text-[13px] font-semibold text-[#3B4454]"
                    style={{ includeFontPadding: false, lineHeight: 15 }}
                  >
                    {hotspot.rating.toFixed(1).replace(".", ",")}
                  </Text>

                  <RatingStars
                    activeTintColor="#FFC93C"
                    inactiveTintColor="#DFD7E2"
                    rating={hotspot.rating}
                    size={13}
                  />

                  <Text
                    className="text-[13px] text-[#6F657A]"
                    style={{ includeFontPadding: false, lineHeight: 15 }}
                  >
                    ({hotspot.reviews})
                  </Text>
                </View>
              </View>

              {overviewText ? (
                <HotspotOverviewSection text={overviewText} />
              ) : null}

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
                  <View className="items-center">
                    <ActivityIndicator color="#EB489B" size="small" />
                  </View>
                </View>
              ) : null}

              {relatedRoutesError ? (
                <View className="rounded-[16px] border border-[#F9E2EA] bg-[#FFF8FC] px-4 py-4">
                  <Text
                    className="text-[14px] font-bold text-[#C2416C]"
                    style={{ lineHeight: 18 }}
                  >
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
                  <Text
                    className="text-[16px] font-semibold text-[#2B2233]"
                    style={{ lineHeight: 20 }}
                  >
                    Chưa có route published
                  </Text>
                  <Text
                    className="mt-2 text-[15px]"
                    style={sectionBodyTextStyle}
                  >
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
              deletingReviewId={deletingReviewId}
              isCheckedIn={isCheckedIn}
              isLoadingReviews={
                isHotspotReviewsLoading || isHotspotPostsLoading
              }
              items={personalExperienceItems}
              onDeleteReview={handleDeleteHotspotReview}
              onEditReview={handleEditHotspotReview}
              onPressLike={handlePressLikeHotspotPost}
              onPressLikeReview={handlePressLikeHotspotReview}
              reviewsErrorMessage={personalExperienceErrorMessage}
              totalReviewLabel={hotspot.reviews}
            />
          </View>
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
            routeId={resolvedRouteId}
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

        <ReviewDeleteDialog
          isDeleting={
            reviewPendingDeletion !== null &&
            deletingReviewId === reviewPendingDeletion.reviewId
          }
          onCancel={() => setReviewPendingDeletion(null)}
          onConfirm={() => {
            if (reviewPendingDeletion) {
              void confirmDeleteHotspotReview(reviewPendingDeletion);
            }
          }}
          visible={reviewPendingDeletion !== null}
        />
      </SafeAreaView>
    </View>
  );
}
