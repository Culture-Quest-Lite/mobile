import { SymbolView } from "@/components/ui/symbol-view";
import { UserAvatar } from "@/components/ui/user-avatar";
import { Image } from "expo-image";
import { LinearGradient } from "expo-linear-gradient";
import * as Linking from "expo-linking";
import * as Location from "expo-location";
import { type Href, useFocusEffect, useRouter } from "expo-router";
import { useCallback, useEffect, useRef, useState } from "react";
import {
  ActivityIndicator,
  Modal,
  Platform,
  Pressable,
  StatusBar as RNStatusBar,
  ScrollView,
  Text,
  View,
} from "react-native";
import MapView, {
  Marker,
  PROVIDER_GOOGLE,
  type Region,
} from "react-native-maps";
import Animated, {
  Easing,
  ReduceMotion,
  cancelAnimation,
  useAnimatedStyle,
  useSharedValue,
  withRepeat,
  withTiming,
} from "react-native-reanimated";
import { SafeAreaView } from "react-native-safe-area-context";

import {
  getValidAccessToken,
  useAuthSession,
} from "@/features/auth/hooks/use-auth-session";
import { getGamificationLevels } from "@/features/profile/api/get-levels";
import { getMyProfile } from "@/features/profile/api/get-me";
import { setPremiumStatusFromProfile } from "@/features/profile/hooks/use-premium-status";
import { applyLevelProgressToProfile } from "@/features/profile/lib/level-progress";
import {
  type HotspotProgressDto,
  type RouteDto,
  type RouteHotspotDto,
  type UserRouteProgressDto,
  getRouteById,
  getRouteCoverUrl,
  getRoutesByHotspot,
  getUserRouteProgressList,
  mapRouteToRouteItem,
  searchRoutes,
} from "@/features/route/api/route-api";
import { useScreenLayout } from "@/hooks/use-screen-layout";
import {
  mergeApiCheckins,
  useCheckedInApiHotspots,
  useCheckins,
} from "@/lib/checkin-store";
import { type RouteItem } from "@/lib/demo-data";
import {
  type AppCoordinate,
  ensureForegroundLocationPermission,
  formatCoordinateLabel,
  getDevelopmentLocationOverride,
  getDeviceCoordinate,
} from "@/lib/location";

import { getCheckedInHotspotIds } from "../api/get-checked-in-hotspots";
import {
  type NearbyHotspotDto,
  getNearbyHotspots,
} from "../api/get-nearby-hotspots";
import { type ActiveTagDto, getActiveTags } from "../api/get-tags";
import {
  type UserLeaderboardEntryDto,
  getUserLeaderboard,
} from "../api/get-user-leaderboard";
import { LeaderRankingCard } from "../components/leader-ranking-card";
import {
  type NearbyCategoryCard,
  activeJourney,
  featuredRoutes,
  nearbyCategories,
  voucherMerchants,
} from "../data/home-screen.mock";
import { getApiHotspotRouteSlug, getHotspotHref } from "../data/hotspots";
import { getThemeDetailHref } from "../lib/theme-detail";

const gradientColors = ["#EB489B", "#F58752", "#FFC93C"] as const;
const guestPreviewLogo = require("../../../../assets/images/logo3.png");
const nearbyShowcaseMascot = require("../../../../assets/images/hotspot_nearby.png");

const themeCategoryPresets: Record<
  string,
  Omit<NearbyCategoryCard, "label">
> = {
  am_thuc: {
    accent: "#C96A00",
    background: "#FFE7CC",
    icon: { ios: "fork.knife", android: "restaurant", web: "restaurant" },
  },
  check_in: {
    accent: "#2563EB",
    background: "#DCEBFF",
    icon: { ios: "camera.fill", android: "photo_camera", web: "photo_camera" },
  },
  di_san: {
    accent: "#7C3AED",
    background: "#EEE4FF",
    icon: {
      ios: "building.columns.fill",
      android: "account_balance",
      web: "account_balance",
    },
  },
  giao_duc: {
    accent: "#2563EB",
    background: "#DCEBFF",
    icon: { ios: "book.closed.fill", android: "menu_book", web: "menu_book" },
  },
  kien_truc: {
    accent: "#B83280",
    background: "#FFD7EA",
    icon: {
      ios: "building.2.fill",
      android: "architecture",
      web: "architecture",
    },
  },
  lich_su: {
    accent: "#D95C22",
    background: "#FFE4D3",
    icon: { ios: "clock.arrow.circlepath", android: "history", web: "history" },
  },
  nghe_thuat: {
    accent: "#0D8C7D",
    background: "#D9F7F1",
    icon: { ios: "paintpalette.fill", android: "palette", web: "palette" },
  },
  thien_nhien: {
    accent: "#2F855A",
    background: "#DCFCE7",
    icon: { ios: "leaf.fill", android: "park", web: "park" },
  },
  van_hoa: {
    accent: "#B45309",
    background: "#FFF1D6",
    icon: {
      ios: "theatermasks.fill",
      android: "theater_comedy",
      web: "theater_comedy",
    },
  },
};

function normalizeTagName(tagName: string) {
  return tagName
    .trim()
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "");
}

function resolveThemeCategoryPreset(
  tagName: string,
  index: number,
): Omit<NearbyCategoryCard, "label"> {
  const normalizedTagName = normalizeTagName(tagName);

  if (normalizedTagName.includes("di san")) {
    return themeCategoryPresets.di_san;
  }

  if (normalizedTagName.includes("van hoa")) {
    return themeCategoryPresets.van_hoa;
  }

  if (normalizedTagName.includes("lich su")) {
    return themeCategoryPresets.lich_su;
  }

  if (normalizedTagName.includes("kien truc")) {
    return themeCategoryPresets.kien_truc;
  }

  if (normalizedTagName.includes("thien nhien")) {
    return themeCategoryPresets.thien_nhien;
  }

  if (normalizedTagName.includes("nghe thuat")) {
    return themeCategoryPresets.nghe_thuat;
  }

  if (normalizedTagName.includes("am thuc")) {
    return themeCategoryPresets.am_thuc;
  }

  if (normalizedTagName.includes("giao duc")) {
    return themeCategoryPresets.giao_duc;
  }

  if (normalizedTagName.includes("check in")) {
    return themeCategoryPresets.check_in;
  }

  return nearbyCategories[index % nearbyCategories.length];
}

function readMeaningfulThemeImageUrl(value?: string | null) {
  const trimmedValue = value?.trim();
  return trimmedValue ? trimmedValue : null;
}

function mapActiveTagsToNearbyCategories(tags: ActiveTagDto[]) {
  return tags.map((tag, index) => ({
    ...resolveThemeCategoryPreset(tag.tagName, index),
    imageUrl: readMeaningfulThemeImageUrl(tag.imageUrl),
    label: tag.tagName,
    tagId: tag.tagId,
  }));
}

const heroShadowStyle = {
  shadowColor: "rgba(235, 72, 155, 0.26)",
  shadowOpacity: 1,
  shadowRadius: 24,
  shadowOffset: {
    width: 0,
    height: 18,
  },
  elevation: 12,
} as const;

const cardShadowStyle = {
  shadowColor: "rgba(245, 135, 82, 0.14)",
  shadowOpacity: 1,
  shadowRadius: 16,
  shadowOffset: {
    width: 0,
    height: 10,
  },
  elevation: 7,
} as const;

const nearbyPlaceShadowStyle = {
  shadowColor: "rgba(15, 23, 42, 0.12)",
  shadowOpacity: 1,
  shadowRadius: 14,
  shadowOffset: {
    width: 0,
    height: 8,
  },
  elevation: 5,
} as const;

const themeCategoryShadowStyle = {
  shadowColor: "rgba(31, 41, 64, 0.08)",
  shadowOpacity: 1,
  shadowRadius: 14,
  shadowOffset: {
    width: 0,
    height: 6,
  },
  elevation: 3,
} as const;

const routeDifficultyStyles: Record<
  string,
  { background: string; color: string }
> = {
  Dễ: {
    background: "#DCFCE7",
    color: "#15803D",
  },
  Khó: {
    background: "#FEE2E2",
    color: "#DC2626",
  },
  "Trung bình": {
    background: "#FEF3C7",
    color: "#B45309",
  },
  Vừa: {
    background: "#FEF3C7",
    color: "#B45309",
  },
};

const journeyProgressSegmentCount = 72;
const journeyProgressRingSize = 76;
const journeyProgressRingStrokeWidth = 6;
const journeyProgressSegmentLength = 8;
const journeyProgressSegmentThickness = 6;
const journeyProgressStartAngle = -128;
const activeJourneyAccent = "#EB489B";
const activeJourneyAccentSoft = "#FDE1EC";
const activeJourneyAccentWarm = "#F58752";
const activeJourneyCardBackground = "#FFF8FC";
const journeyProgressSegmentRadius =
  journeyProgressRingSize / 2 - journeyProgressRingStrokeWidth / 2 - 1;

const featuredRouteHighlightLimit = 5;

// Ảnh minh hoạ cũ chỉ còn dùng làm fallback khi route/tiến độ từ API không
// đính kèm media nào, để phần hình không bị vỡ layout.
const activeJourneyFallbackImageUri =
  activeJourney?.imageUri ?? featuredRoutes[0].imageUri;

type FeaturedRouteCard = {
  coverUri: string;
  difficultyLabel: string;
  distanceLabel: string;
  durationLabel: string;
  routeId: number;
  stopsLabel: string;
  tagLabel: string;
  title: string;
  xpLabel: string | null;
};

type ActiveJourneyView = {
  coverUri: string;
  currentCheckpoint: number;
  distanceToNextLabel: string | null;
  nextStopName: string | null;
  progress: number;
  remainingStopsLabel: string;
  remainingTimeLabel: string | null;
  rewardLabel: string | null;
  routeId: number;
  title: string;
  totalCheckpoints: number;
};

function getFeaturedRouteFallbackImageUri(index: number) {
  return featuredRoutes[index % featuredRoutes.length].imageUri;
}

function getRouteDifficultyLabel(difficulty?: string | null) {
  switch (difficulty?.trim().toUpperCase()) {
    case "EASY":
      return "Dễ";
    case "MEDIUM":
      return "Vừa";
    case "HARD":
      return "Khó";
    default:
      return difficulty?.trim() || "Dễ";
  }
}

function formatRouteDistanceLabel(totalDistanceKm: number) {
  if (!Number.isFinite(totalDistanceKm) || totalDistanceKm <= 0) {
    return "Đang cập nhật";
  }

  if (totalDistanceKm < 1) {
    return `${Math.round(totalDistanceKm * 1000)} m`;
  }

  return `${Number.isInteger(totalDistanceKm) ? totalDistanceKm : totalDistanceKm.toFixed(1)} km`;
}

function formatRouteDurationLabel(estimateMinutes: number) {
  if (!Number.isFinite(estimateMinutes) || estimateMinutes <= 0) {
    return "Đang cập nhật";
  }

  const roundedMinutes = Math.round(estimateMinutes);

  if (roundedMinutes < 60) {
    return `${roundedMinutes} phút`;
  }

  const hours = Math.floor(roundedMinutes / 60);
  const minutes = roundedMinutes % 60;

  return minutes > 0 ? `${hours} giờ ${minutes} phút` : `${hours} giờ`;
}

function formatRouteStopsLabel(stopCount: number) {
  if (stopCount <= 0) {
    return "Đang cập nhật";
  }

  return `${String(stopCount).padStart(2, "0")} điểm dừng`;
}

function isPublishedRoute(route: RouteDto) {
  return route.status.trim().toUpperCase() === "PUBLISHED";
}

function getHighlightRoutes(routes: RouteDto[]) {
  return [...routes]
    .sort((left, right) => {
      const xpGap = (right.xp || 0) - (left.xp || 0);

      if (xpGap !== 0) {
        return xpGap;
      }

      const stopGap = right.hotspots.length - left.hotspots.length;

      return stopGap !== 0 ? stopGap : right.routeId - left.routeId;
    })
    .slice(0, featuredRouteHighlightLimit);
}

function mapRouteToFeaturedRouteCard(
  route: RouteDto,
  index: number,
): FeaturedRouteCard {
  // Ưu tiên media của chính route (hoặc media hotspot đầu tiên trong route).
  // Chỉ khi API không có hình nào mới quay lại ảnh mặc định của màn hình.
  const apiCoverUri = getRouteCoverUrl(route)?.trim();

  return {
    coverUri: apiCoverUri || getFeaturedRouteFallbackImageUri(index),
    difficultyLabel: getRouteDifficultyLabel(route.difficulty),
    distanceLabel: formatRouteDistanceLabel(route.totalDistance),
    durationLabel: formatRouteDurationLabel(route.estimateTime),
    routeId: route.routeId,
    stopsLabel: formatRouteStopsLabel(route.hotspots.length),
    tagLabel: route.tags[0]?.tagName.trim() || "Khám phá",
    title: route.routeName.trim() || `Tuyến #${route.routeId}`,
    xpLabel: route.xp > 0 ? `+${route.xp} XP` : null,
  };
}

function normalizeProgressStatus(status?: string | null) {
  return (status ?? "").trim().toUpperCase();
}

function isActiveRouteProgress(progress: UserRouteProgressDto) {
  return normalizeProgressStatus(progress.status) === "IN_PROGRESS";
}

function getRouteHotspotOrder(hotspot: RouteHotspotDto) {
  return (
    hotspot.orderIndex ??
    hotspot.sequenceNumber ??
    hotspot.index ??
    Number.MAX_SAFE_INTEGER
  );
}

function getOrderedRouteHotspots(route: RouteDto | null) {
  if (!route) {
    return [];
  }

  return [...route.hotspots].sort(
    (left, right) => getRouteHotspotOrder(left) - getRouteHotspotOrder(right),
  );
}

function getOrderedHotspotProgressList(progress: UserRouteProgressDto) {
  return [...progress.hotspotProgressList].sort(
    (left, right) =>
      (left.index ?? Number.MAX_SAFE_INTEGER) -
      (right.index ?? Number.MAX_SAFE_INTEGER),
  );
}

function readStopCoordinate(
  stop?: HotspotProgressDto | RouteHotspotDto | null,
): Pick<AppCoordinate, "latitude" | "longitude"> | null {
  if (
    typeof stop?.latitude !== "number" ||
    typeof stop?.longitude !== "number"
  ) {
    return null;
  }

  return { latitude: stop.latitude, longitude: stop.longitude };
}

function buildActiveJourneyView(
  progress: UserRouteProgressDto,
  route: RouteDto | null,
): ActiveJourneyView {
  const orderedProgressStops = getOrderedHotspotProgressList(progress);
  const orderedRouteHotspots = getOrderedRouteHotspots(route);
  const totalCheckpoints = Math.max(
    progress.totalStops,
    orderedProgressStops.length,
    orderedRouteHotspots.length,
    1,
  );
  const checkedInStops = orderedProgressStops.filter(
    (stop) => stop.isCheckedIn,
  );
  const currentCheckpoint = clamp(
    Math.max(progress.completedStops, checkedInStops.length),
    0,
    totalCheckpoints,
  );
  const progressPercentage = Math.round(
    clamp(
      progress.progressPercentage > 0
        ? progress.progressPercentage
        : (currentCheckpoint / totalCheckpoints) * 100,
      0,
      100,
    ),
  );
  const nextStopProgress =
    orderedProgressStops.find((stop) => !stop.isCheckedIn) ?? null;
  const nextRouteHotspot = nextStopProgress
    ? (orderedRouteHotspots.find(
        (hotspot) => hotspot.hotspotId === nextStopProgress.hotspotId,
      ) ?? null)
    : (orderedRouteHotspots[currentCheckpoint] ?? null);
  const previousStop = checkedInStops[checkedInStops.length - 1] ?? null;
  const previousCoordinate =
    readStopCoordinate(previousStop) ??
    readStopCoordinate(
      previousStop
        ? (orderedRouteHotspots.find(
            (hotspot) => hotspot.hotspotId === previousStop.hotspotId,
          ) ?? null)
        : null,
    );
  const nextCoordinate =
    readStopCoordinate(nextStopProgress) ?? readStopCoordinate(nextRouteHotspot);
  const remainingStops = Math.max(totalCheckpoints - currentCheckpoint, 0);
  const remainingMinutes =
    route && route.estimateTime > 0 && totalCheckpoints > 0
      ? Math.round((route.estimateTime * remainingStops) / totalCheckpoints)
      : 0;
  const routeCoverUri = route ? getRouteCoverUrl(route)?.trim() : null;

  return {
    // Hình lấy từ media của route/hotspot; không có mới dùng ảnh mặc định cũ.
    coverUri: routeCoverUri || activeJourneyFallbackImageUri,
    currentCheckpoint,
    distanceToNextLabel:
      previousCoordinate && nextCoordinate
        ? formatDistanceMeters(
            getDistanceMeters(previousCoordinate, nextCoordinate),
          )
        : null,
    nextStopName:
      readMeaningfulNearbyText(nextStopProgress?.hotspotName) ??
      readMeaningfulNearbyText(nextRouteHotspot?.hotspotName),
    progress: progressPercentage,
    remainingStopsLabel:
      remainingStops > 0
        ? `Còn ${remainingStops} điểm dừng`
        : "Đã đi hết điểm dừng",
    remainingTimeLabel:
      remainingMinutes > 0 ? `${formatRouteDurationLabel(remainingMinutes)} nữa` : null,
    rewardLabel: route && route.xp > 0 ? `+${route.xp} XP` : null,
    routeId: progress.routeId,
    title:
      readMeaningfulNearbyText(route?.routeName) ?? `Tuyến #${progress.routeId}`,
    totalCheckpoints,
  };
}

function JourneyProgressRing({ progress }: { progress: number }) {
  const boundedProgress = Math.min(Math.max(progress, 0), 100);
  const activeSegments = Math.round(
    (boundedProgress / 100) * journeyProgressSegmentCount,
  );

  return (
    <View
      className="items-center justify-center"
      style={{
        height: journeyProgressRingSize,
        width: journeyProgressRingSize,
      }}
    >
      <View
        className="absolute rounded-full bg-white"
        style={{
          borderColor: activeJourneyAccentSoft,
          borderWidth: journeyProgressRingStrokeWidth,
          height: journeyProgressRingSize,
          width: journeyProgressRingSize,
        }}
      />

      <View
        pointerEvents="none"
        style={{
          height: journeyProgressRingSize,
          position: "absolute",
          width: journeyProgressRingSize,
        }}
      >
        {Array.from({ length: activeSegments }).map((_, index) => {
          const angle =
            journeyProgressStartAngle +
            (index / journeyProgressSegmentCount) * 360;
          const radians = (angle * Math.PI) / 180;
          const left =
            journeyProgressRingSize / 2 +
            Math.cos(radians) * journeyProgressSegmentRadius -
            journeyProgressSegmentLength / 2;
          const top =
            journeyProgressRingSize / 2 +
            Math.sin(radians) * journeyProgressSegmentRadius -
            journeyProgressSegmentThickness / 2;

          return (
            <View
              key={index}
              className="absolute rounded-full"
              style={{
                backgroundColor: activeJourneyAccent,
                height: journeyProgressSegmentThickness,
                left,
                top,
                transform: [{ rotate: `${angle}deg` }],
                width: journeyProgressSegmentLength,
              }}
            />
          );
        })}
      </View>

      <View className="h-[58px] w-[58px] items-center justify-center rounded-full bg-white">
        <Text className="text-[20px] font-black leading-5 text-[#2B2233]">
          {boundedProgress}%
        </Text>
        <Text className="text-[9px] font-semibold text-[#6F657A]">
          Hoàn thành
        </Text>
      </View>
    </View>
  );
}

const communityRankRingColors = ["#F7B500", "#C9D4E5", "#FF8A00"] as const;
const communityRankBadgeColors = ["#F7B500", "#9AACBF", "#FF8A00"] as const;

const communityRowShadowStyle = {
  shadowColor: "rgba(15, 23, 42, 0.08)",
  shadowOpacity: 1,
  shadowRadius: 10,
  shadowOffset: {
    width: 0,
    height: 4,
  },
  elevation: 2,
} as const;

type ExplorerSummary = {
  avatar: string | null;
  isPremium: boolean;
  level: number | null;
  name: string;
  username: string;
};

type NearbyPlaceListItem = {
  detailIcon: "location" | "star";
  detailPrimaryText: string;
  detailSecondaryText?: string;
  distance: string;
  hotspotId: number | null;
  imageUri: string;
  isCheckedIn: boolean;
  key: string;
  openingHours: string;
  rating: string;
  reviewCountText: string;
  reward: string;
  slug: string | null;
  title: string;
};

type CommunityLeaderboardStatus = "empty" | "error" | "loading" | "ready";
type FeaturedRoutesSectionStatus = "empty" | "loading" | "ready";
type ActiveJourneySectionStatus = "empty" | "loading" | "ready";
type NearbyPlacesSectionStatus = "empty" | "loading" | "ready";
type SuggestedRoutesSectionStatus = "empty" | "loading" | "ready";
type SuggestedRouteCard = RouteItem;
type CommunityBoardViewEntry = {
  avatarUri: string | null;
  isCurrentUser: boolean;
  name: string;
  points: string;
  rank: number;
  subtitle: string;
  userId: string | null;
};
type CommunityBoardViewModel = {
  entries: CommunityBoardViewEntry[];
  headlineRankLabel: string;
  summaryLabel: string;
  summaryNote: string;
  summaryXp: number;
  totalPoints: string;
};

const defaultNearbySearchDistanceMeters = 1000;
const nearbyDistanceSliderMinimumMeters = 1000;
const nearbyDistanceSliderMaximumMeters = 15000;
const nearbyDistanceSliderStepMeters = 20;
const suggestedRouteCardImageHeight = 136;
const suggestedRouteCardHeight = 248;
const nearbyPlaceTitleHeight = 22;
const nearbyPlaceCategoryHeight = 16;
const nearbyPlaceDetailRowHeight = 18;
const nearbyPlaceContentHeight = 132;
const nearbyPlaceFallbackImageUri =
  "https://images.unsplash.com/photo-1500530855697-b586d89ba3ee";
const nearbyPlaceFallbackRating = "4.9";
const defaultLocationPreviewRegion: Region = {
  latitude: 10.8414,
  longitude: 106.8288,
  latitudeDelta: 0.015,
  longitudeDelta: 0.015,
};

function clamp(value: number, min: number, max: number) {
  return Math.min(Math.max(value, min), max);
}

function clampDistanceMeters(value: number) {
  return clamp(
    Math.round(value),
    nearbyDistanceSliderMinimumMeters,
    nearbyDistanceSliderMaximumMeters,
  );
}

function snapDistanceMeters(value: number) {
  const snappedValue =
    Math.round(value / nearbyDistanceSliderStepMeters) *
    nearbyDistanceSliderStepMeters;

  return clampDistanceMeters(snappedValue);
}

function toRadians(value: number) {
  return (value * Math.PI) / 180;
}

function getDistanceMeters(
  from: Pick<AppCoordinate, "latitude" | "longitude">,
  to: Pick<AppCoordinate, "latitude" | "longitude">,
) {
  const earthRadius = 6_371_000;
  const latitudeDelta = toRadians(to.latitude - from.latitude);
  const longitudeDelta = toRadians(to.longitude - from.longitude);
  const fromLatitude = toRadians(from.latitude);
  const toLatitude = toRadians(to.latitude);

  const a =
    Math.sin(latitudeDelta / 2) * Math.sin(latitudeDelta / 2) +
    Math.cos(fromLatitude) *
      Math.cos(toLatitude) *
      Math.sin(longitudeDelta / 2) *
      Math.sin(longitudeDelta / 2);

  return earthRadius * (2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a)));
}

function formatDistanceMeters(distanceMeters: number) {
  if (distanceMeters < 1000) {
    return `${Math.max(1, Math.round(distanceMeters))}m`;
  }

  return `${(distanceMeters / 1000).toFixed(1)}km`;
}

function formatRewardLabel(value: number | null | undefined, fallback = "+0") {
  if (typeof value !== "number" || !Number.isFinite(value)) {
    return fallback;
  }

  return `+${Math.max(0, Math.round(value))}`;
}

function formatNearbyRating(
  value: number | null | undefined,
  fallback = nearbyPlaceFallbackRating,
) {
  if (typeof value !== "number" || !Number.isFinite(value)) {
    return fallback;
  }

  return clamp(value, 0, 5).toFixed(1);
}

function formatNearbyReviewCount(
  value: number | null | undefined,
  fallback = "0 đánh giá",
) {
  if (typeof value !== "number" || !Number.isFinite(value)) {
    return fallback;
  }

  const roundedValue = Math.max(0, Math.round(value));
  return `${new Intl.NumberFormat("vi-VN").format(roundedValue)} đánh giá`;
}

function readMeaningfulCommunityText(value?: string | null) {
  const trimmedValue = value?.trim();
  return trimmedValue ? trimmedValue : null;
}

function formatCommunityXp(value: number) {
  return new Intl.NumberFormat("vi-VN").format(Math.max(0, Math.round(value)));
}

function getCommunityLeaderboardDisplayName(entry: UserLeaderboardEntryDto) {
  return (
    readMeaningfulCommunityText(entry.displayName) ??
    readMeaningfulCommunityText(entry.username) ??
    `Explorer #${entry.userId}`
  );
}

function getCommunityLeaderboardSubtitle(entry: UserLeaderboardEntryDto) {
  return `@${entry.username}`;
}

function isTopCommunityLeaderboardRank(rank: number) {
  return rank >= 1 && rank <= 3;
}

function getCommunityLeaderboardRingColor(rank: number) {
  return isTopCommunityLeaderboardRank(rank)
    ? communityRankRingColors[rank - 1]
    : "#D7DCE4";
}

function getCommunityLeaderboardBadgeColor(rank: number) {
  return isTopCommunityLeaderboardRank(rank)
    ? communityRankBadgeColors[rank - 1]
    : "#C7D1DE";
}

function getCommunityLeaderboardBadgeTextColor(rank: number) {
  return isTopCommunityLeaderboardRank(rank) ? "#FFFFFF" : "#667085";
}

function getVisibleCommunityLeaderboardEntries(
  entries: UserLeaderboardEntryDto[],
) {
  const topEntries = entries.slice(0, 5);
  const currentUserEntry = entries.find((entry) => entry.isCurrentUser);

  if (!currentUserEntry || currentUserEntry.rank <= topEntries.length) {
    return topEntries;
  }

  return [...topEntries, currentUserEntry];
}

function buildCommunityBoardViewModelFromLeaderboard({
  entries,
  errorMessage,
  status,
}: {
  entries: UserLeaderboardEntryDto[];
  errorMessage: string | null;
  status: CommunityLeaderboardStatus;
}): CommunityBoardViewModel {
  if (status === "loading") {
    return {
      entries: [],
      headlineRankLabel: "#--",
      summaryLabel: "Đang tải bảng xếp hạng",
      summaryNote: "Hệ thống đang cập nhật cộng đồng hôm nay.",
      summaryXp: 0,
      totalPoints: "--",
    };
  }

  if (status === "error") {
    return {
      entries: [],
      headlineRankLabel: "#--",
      summaryLabel: "Không tải được bảng xếp hạng",
      summaryNote: errorMessage ?? "Vui lòng thử lại sau.",
      summaryXp: 0,
      totalPoints: "--",
    };
  }

  if (status === "empty" || entries.length === 0) {
    return {
      entries: [],
      headlineRankLabel: "#--",
      summaryLabel: "Chưa có dữ liệu bảng xếp hạng",
      summaryNote: "Bảng xếp hạng sẽ hiển thị khi có hoạt động cộng đồng.",
      summaryXp: 0,
      totalPoints: "0 XP",
    };
  }

  const sortedEntries = [...entries].sort(
    (left, right) => left.rank - right.rank,
  );
  const currentUserEntry =
    sortedEntries.find((entry) => entry.isCurrentUser) ?? null;
  const summaryEntry = currentUserEntry ?? sortedEntries[0];
  const summaryXpLabel = `${formatCommunityXp(summaryEntry.totalXp)} XP`;
  let summaryLabel = `#${summaryEntry.rank} ${getCommunityLeaderboardDisplayName(summaryEntry)} đang dẫn đầu`;
  let summaryNote = `Tổng ${summaryXpLabel} trên bảng xếp hạng.`;

  if (currentUserEntry) {
    if (currentUserEntry.rank === 1) {
      summaryLabel = "Bạn đang dẫn đầu bảng xếp hạng";
      summaryNote = `Tiếp tục giữ phong độ hôm nay!`;
    } else {
      summaryLabel = `Bạn đang xếp hạng #${currentUserEntry.rank}`;
      const previousRankEntry = sortedEntries.find(
        (entry) => entry.rank === currentUserEntry.rank - 1,
      );

      if (previousRankEntry) {
        const xpGap = Math.max(
          previousRankEntry.totalXp - currentUserEntry.totalXp,
          0,
        );
        summaryNote =
          xpGap > 0
            ? `Còn ${formatCommunityXp(xpGap)} XP để vượt hạng #${previousRankEntry.rank}.`
            : `Tổng ${summaryXpLabel} hiện tại.`;
      } else {
        summaryNote = `Tổng ${summaryXpLabel} hiện tại.`;
      }
    }
  }

  return {
    entries: getVisibleCommunityLeaderboardEntries(sortedEntries).map(
      (entry) => ({
        avatarUri: readMeaningfulCommunityText(entry.avatarUrl) ?? null,
        isCurrentUser: entry.isCurrentUser,
        name: getCommunityLeaderboardDisplayName(entry),
        points: `${formatCommunityXp(entry.totalXp)} XP`,
        rank: entry.rank,
        subtitle: getCommunityLeaderboardSubtitle(entry),
        userId: `${entry.userId}`,
      }),
    ),
    headlineRankLabel: currentUserEntry
      ? `#${currentUserEntry.rank}`
      : `#${sortedEntries[0].rank}`,
    summaryLabel,
    summaryNote,
    summaryXp: summaryEntry.totalXp,
    totalPoints: summaryXpLabel,
  };
}

function readMeaningfulNearbyText(value?: string | null) {
  const trimmedValue = value?.trim();

  return trimmedValue ? trimmedValue : null;
}

function formatNearbyTimeValue(value?: string | null) {
  const meaningfulValue = readMeaningfulNearbyText(value);

  if (!meaningfulValue) {
    return null;
  }

  const matchedValue = meaningfulValue.match(/^\d{2}:\d{2}/);

  return matchedValue?.[0] ?? meaningfulValue;
}

function formatNearbyTimeWindow(start?: string | null, end?: string | null) {
  const formattedStart = formatNearbyTimeValue(start);
  const formattedEnd = formatNearbyTimeValue(end);

  if (formattedStart && formattedEnd) {
    return formattedStart === formattedEnd
      ? formattedStart
      : `${formattedStart} - ${formattedEnd}`;
  }

  return formattedStart ?? formattedEnd;
}

function sortNearbyHotspotsByDistance(
  hotspots: NearbyHotspotDto[],
  currentCoordinate: Pick<AppCoordinate, "latitude" | "longitude">,
) {
  return [...hotspots].sort(
    (left, right) =>
      getDistanceMeters(currentCoordinate, {
        latitude: left.latitude,
        longitude: left.longitude,
      }) -
      getDistanceMeters(currentCoordinate, {
        latitude: right.latitude,
        longitude: right.longitude,
      }),
  );
}

function dedupeRoutesById(routes: RouteDto[]) {
  const routeById = new Map<number, RouteDto>();

  routes.forEach((route) => {
    if (!routeById.has(route.routeId)) {
      routeById.set(route.routeId, route);
    }
  });

  return [...routeById.values()];
}

function mapRouteToSuggestedRouteCard(route: RouteDto): SuggestedRouteCard {
  return mapRouteToRouteItem(route);
}

function getSuggestedRouteDescription(route: SuggestedRouteCard) {
  return (
    route.description?.trim() || route.subtitle.trim() || route.theme.trim()
  );
}

function getSuggestedRouteTagLabel(route: SuggestedRouteCard) {
  return route.era.trim() || route.theme.trim();
}

function getNearbyOpeningHoursLabel(hotspot: NearbyHotspotDto) {
  return (
    formatNearbyTimeWindow(hotspot.openingTime, hotspot.closingTime) ??
    formatNearbyTimeWindow(hotspot.startTime, hotspot.endTime) ??
    "Giờ cập nhật sau"
  );
}

function getPrimaryNearbyImageUri(hotspot: NearbyHotspotDto) {
  const medias = [...hotspot.medias]
    .filter((media) => media.fileUrl.trim())
    .sort((left, right) => {
      const leftOrder = left.displayOrder ?? Number.MAX_SAFE_INTEGER;
      const rightOrder = right.displayOrder ?? Number.MAX_SAFE_INTEGER;

      return leftOrder - rightOrder;
    });

  return medias[0]?.fileUrl.trim() || nearbyPlaceFallbackImageUri;
}

function buildApiNearbyPlaceItems(
  hotspots: NearbyHotspotDto[],
  currentCoordinate: Pick<AppCoordinate, "latitude" | "longitude">,
): NearbyPlaceListItem[] {
  return hotspots
    .map((hotspot, index) => {
      const distanceMeters = getDistanceMeters(currentCoordinate, {
        latitude: hotspot.latitude,
        longitude: hotspot.longitude,
      });
      const detailIcon: NearbyPlaceListItem["detailIcon"] = "location";

      return {
        detailIcon,
        detailPrimaryText: hotspot.address.trim() || "Không có dữ liệu",
        distance: formatDistanceMeters(distanceMeters),
        hotspotId: hotspot.hotspotId,
        imageUri: getPrimaryNearbyImageUri(hotspot),
        isCheckedIn: hotspot.isCheckedIn === true,
        key: `${hotspot.hotspotId}-${index}`,
        openingHours: getNearbyOpeningHoursLabel(hotspot),
        rating: formatNearbyRating(hotspot.averageRating),
        reviewCountText: formatNearbyReviewCount(hotspot.totalReviews),
        reward: formatRewardLabel(hotspot.xp),
        slug: null,
        sortDistanceMeters: distanceMeters,
        title: hotspot.hotspotName.trim() || "Không có dữ liệu",
      };
    })
    .sort((left, right) => left.sortDistanceMeters - right.sortDistanceMeters)
    .map(({ sortDistanceMeters: _sortDistanceMeters, ...item }) => item);
}

function isNearbyPlaceCheckedIn(
  place: NearbyPlaceListItem,
  checkedInApiHotspotIds: readonly number[],
  checkedInHotspotSlugs: readonly string[],
) {
  if (place.isCheckedIn) {
    return true;
  }

  if (
    place.hotspotId !== null &&
    checkedInApiHotspotIds.includes(place.hotspotId)
  ) {
    return true;
  }

  if (place.slug && checkedInHotspotSlugs.includes(place.slug)) {
    return true;
  }

  return false;
}

function getLocationPreviewRegion(
  coordinate: Pick<AppCoordinate, "latitude" | "longitude"> | null,
): Region {
  if (!coordinate) {
    return defaultLocationPreviewRegion;
  }

  return {
    latitude: coordinate.latitude,
    longitude: coordinate.longitude,
    latitudeDelta: 0.01,
    longitudeDelta: 0.01,
  };
}

async function resolveNearbyRequestCoordinate(): Promise<{
  coordinate: AppCoordinate | null;
  fallbackMessage: string | null;
}> {
  const developmentLocation = getDevelopmentLocationOverride();

  if (developmentLocation) {
    return {
      coordinate: developmentLocation,
      fallbackMessage: null,
    };
  }

  const servicesEnabled = await Location.hasServicesEnabledAsync();

  if (!servicesEnabled) {
    return {
      coordinate: null,
      fallbackMessage: "Bật GPS để tải địa điểm gần bạn.",
    };
  }

  const permission = await Location.getForegroundPermissionsAsync();
  const permissionResponse =
    permission.granted || !permission.canAskAgain
      ? permission
      : await ensureForegroundLocationPermission();

  if (permissionResponse.status !== "granted") {
    return {
      coordinate: null,
      fallbackMessage: "Cho phép truy cập vị trí để tải địa điểm gần bạn.",
    };
  }

  if (Platform.OS === "android") {
    try {
      await Location.enableNetworkProviderAsync();
    } catch {
      // Ignore when the device already has an active location provider.
    }
  }

  const currentLocation = await getDeviceCoordinate({
    accuracy: Location.Accuracy.Balanced,
    maxAge: 60_000,
    mayShowUserSettingsDialog: Platform.OS === "android",
    requiredAccuracy: 150,
  });

  if (!currentLocation) {
    return {
      coordinate: null,
      fallbackMessage: "Không xác định được vị trí hiện tại.",
    };
  }

  return {
    coordinate: currentLocation,
    fallbackMessage: null,
  };
}

function GuestAccessCard({ onPress }: { onPress: () => void }) {
  const arrowOffset = useSharedValue(0);

  useEffect(() => {
    arrowOffset.set(
      withRepeat(
        withTiming(10, {
          duration: 850,
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

  const animatedArrowStyle = useAnimatedStyle(() => {
    return {
      transform: [{ translateX: arrowOffset.get() }],
    };
  });

  return (
    <View className="gap-3">
      <Text className="text-[18px] font-extrabold text-[#2B2233]">
        Mở khóa hành trình của bạn
      </Text>

      <View
        className="overflow-hidden rounded-[28px] border border-[#F8D7E3] bg-white"
        style={cardShadowStyle}
      >
        <LinearGradient
          colors={["#FFF7FB", "#FFF3EC"]}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 1 }}
          className="absolute inset-0"
        />

        <View className="gap-5 px-4 py-4">
          <View className="flex-row items-start gap-4">
            <View className="flex-1 gap-2">
              <View className="self-start rounded-full bg-white/90 px-3 py-1">
                <Text className="text-[11px] font-extrabold uppercase tracking-[0.6px] text-[#EB489B]">
                  Chưa đăng nhập
                </Text>
              </View>

              <View className="items-center py-1.5">
                <LinearGradient
                  colors={gradientColors}
                  start={{ x: 0, y: 0.2 }}
                  end={{ x: 1, y: 0.8 }}
                  className="h-24 w-24 rounded-full p-[2px]"
                  style={{
                    shadowColor: "rgba(235, 72, 155, 0.16)",
                    shadowOpacity: 1,
                    shadowRadius: 14,
                    shadowOffset: {
                      width: 0,
                      height: 8,
                    },
                    elevation: 5,
                  }}
                >
                  <View className="h-full w-full items-center justify-center rounded-full bg-[#FFF1F6]">
                    <SymbolView
                      name={{
                        ios: "lock.fill",
                        android: "lock",
                        web: "lock",
                      }}
                      size={30}
                      tintColor="#EB489B"
                    />
                  </View>
                </LinearGradient>
              </View>
            </View>
          </View>

          <View className="flex-row flex-wrap gap-2">
            <View className="rounded-full bg-white/90 px-3 py-2">
              <Text className="text-[12px] font-bold text-[#D9587F]">
                Lưu tiến trình
              </Text>
            </View>
            <View className="rounded-full bg-white/90 px-3 py-2">
              <Text className="text-[12px] font-bold text-[#D9587F]">
                Mở khóa câu chuyện
              </Text>
            </View>
            <View className="rounded-full bg-white/90 px-3 py-2">
              <Text className="text-[12px] font-bold text-[#D9587F]">
                Nhận voucher
              </Text>
            </View>
          </View>

          <Pressable
            onPress={onPress}
            className="self-center overflow-hidden rounded-[18px]"
            style={{ minWidth: 282 }}
          >
            <LinearGradient
              colors={gradientColors}
              start={{ x: 0, y: 0.5 }}
              end={{ x: 1, y: 0.5 }}
              locations={[0, 0.58, 1]}
              className="relative items-center justify-center px-5 py-3.5"
            >
              <Text className="text-[15px] font-extrabold text-white">
                Trải nghiệm ngay
              </Text>

              <View className="absolute right-3 h-9 w-9 items-center justify-center rounded-full bg-white/18">
                <Animated.View style={animatedArrowStyle}>
                  <SymbolView
                    name={{
                      ios: "arrow.right",
                      android: "arrow_forward",
                      web: "arrow_forward",
                    }}
                    size={15}
                    tintColor="#FFFFFF"
                  />
                </Animated.View>
              </View>
            </LinearGradient>
          </Pressable>
        </View>
      </View>
    </View>
  );
}

function SectionEmptyState({
  description = "Không có dữ liệu phù hợp.",
  isLoading = false,
  title = "Không có dữ liệu phù hợp",
}: {
  description?: string;
  isLoading?: boolean;
  title?: string;
}) {
  return (
    <View className="rounded-[22px] border border-[#EEF1F4] bg-[#FAF7FC] px-4 py-4">
      {isLoading ? (
        <View className="items-center py-1">
          <ActivityIndicator color="#EB489B" size="small" />
        </View>
      ) : (
        <>
          <Text className="text-[15px] font-bold text-[#3B4454]">{title}</Text>
          <Text className="mt-1 text-[13px] leading-5 text-[#8E869A]">
            {description}
          </Text>
        </>
      )}
    </View>
  );
}

type NearbyDistanceSliderProps = {
  max: number;
  min: number;
  onChange: (nextValue: number) => void;
  value: number;
};

function NearbyDistanceSlider({
  max,
  min,
  onChange,
  value,
}: NearbyDistanceSliderProps) {
  const [trackWidth, setTrackWidth] = useState(0);
  const progress = (value - min) / Math.max(1, max - min);
  const thumbSize = 24;
  const fillWidth = trackWidth * progress;
  const thumbLeft = clamp(
    fillWidth - thumbSize / 2,
    0,
    Math.max(0, trackWidth - thumbSize),
  );

  const updateValueFromTrackPosition = (locationX: number) => {
    if (trackWidth <= 0) {
      return;
    }

    const nextProgress = clamp(locationX / trackWidth, 0, 1);
    const nextValue = min + nextProgress * (max - min);
    onChange(snapDistanceMeters(nextValue));
  };

  return (
    <View className="gap-1">
      <View
        className="relative h-7 justify-center"
        onLayout={(event) => {
          setTrackWidth(event.nativeEvent.layout.width);
        }}
        onMoveShouldSetResponder={() => true}
        onStartShouldSetResponder={() => true}
        onResponderGrant={(event) => {
          updateValueFromTrackPosition(event.nativeEvent.locationX);
        }}
        onResponderMove={(event) => {
          updateValueFromTrackPosition(event.nativeEvent.locationX);
        }}
      >
        <View className="h-1.5 rounded-full bg-[#E6ECF2]" />
        <View
          className="absolute left-0 top-1/2 h-1.5 rounded-full bg-[#FF6F7D]"
          style={{
            transform: [{ translateY: -3 }],
            width: fillWidth,
          }}
        />
        <View
          className="absolute top-1/2 rounded-full border-[3px] border-white bg-[#EB489B]"
          style={{
            height: thumbSize,
            left: thumbLeft,
            shadowColor: "rgba(235, 72, 155, 0.28)",
            shadowOpacity: 1,
            shadowRadius: 12,
            shadowOffset: {
              width: 0,
              height: 4,
            },
            elevation: 6,
            transform: [{ translateY: -(thumbSize / 2) }],
            width: thumbSize,
          }}
        />
      </View>

      <View className="flex-row items-center justify-between">
        <Text className="text-[10px] font-medium text-[#A29AA8]">
          {formatDistanceMeters(min)}
        </Text>
        <Text className="text-[10px] font-medium text-[#A29AA8]">
          {formatDistanceMeters(max)}
        </Text>
      </View>
    </View>
  );
}

function NearbyDistanceDropdown({
  currentDistanceMeters,
  draftDistanceMeters,
  isLoading,
  onApply,
  onChangeDistance,
  onOpenMap,
}: {
  currentDistanceMeters: number;
  draftDistanceMeters: number;
  isLoading: boolean;
  onApply: () => void;
  onChangeDistance: (nextDistanceMeters: number) => void;
  onOpenMap: () => void;
}) {
  return (
    <View
      className="overflow-hidden rounded-[24px] border border-[#F6DDD0] bg-white px-3.5 py-2.5"
      style={cardShadowStyle}
    >
      <LinearGradient
        colors={["#FFFFFF", "#FFF7FB", "#FFF7F1"]}
        end={{ x: 1, y: 1 }}
        start={{ x: 0, y: 0 }}
        className="absolute inset-0"
      />

      <View className="flex-row items-start gap-2">
        <LinearGradient
          colors={["#FF8A50", "#FF5F87"]}
          end={{ x: 1, y: 1 }}
          start={{ x: 0, y: 0 }}
          className="h-8 w-8 items-center justify-center rounded-full"
        >
          <SymbolView
            name={{
              ios: "flame.fill",
              android: "local_fire_department",
              web: "local_fire_department",
            }}
            size={14}
            tintColor="#FFFFFF"
          />
        </LinearGradient>

        <View className="flex-1">
          <Text className="text-[15px] font-medium tracking-[-0.1px] text-[#2B2233]">
            Địa điểm gần bạn
          </Text>
          <Text className="mt-0.5 text-[11px] font-medium text-[#9C94A5]">
            Bán kính tìm kiếm
          </Text>
        </View>

        <LinearGradient
          colors={gradientColors}
          end={{ x: 1, y: 0.5 }}
          locations={[0, 0.58, 1]}
          start={{ x: 0, y: 0.5 }}
          className="rounded-full px-2 py-[5px]"
        >
          <Text className="text-[11px] font-semibold text-white">
            {formatDistanceMeters(draftDistanceMeters)}
          </Text>
        </LinearGradient>
      </View>

      <View className="mt-3">
        <NearbyDistanceSlider
          max={nearbyDistanceSliderMaximumMeters}
          min={nearbyDistanceSliderMinimumMeters}
          onChange={onChangeDistance}
          value={draftDistanceMeters}
        />
      </View>

      <View className="mt-3 flex-row gap-2">
        <Pressable
          className="flex-1 flex-row items-center justify-center rounded-[14px] border border-[#E3E7EF] bg-white px-3 py-2.5"
          onPress={onOpenMap}
        >
          <SymbolView
            name={{ ios: "map.fill", android: "map", web: "map" }}
            size={13}
            tintColor="#374151"
          />
          <Text className="ml-1.5 text-[12px] font-semibold text-[#2F3947]">
            Xem bản đồ
          </Text>
        </Pressable>

        <Pressable
          className={`flex-1 overflow-hidden rounded-[12px] ${
            isLoading ? "opacity-70" : ""
          }`}
          disabled={isLoading}
          onPress={onApply}
        >
          <LinearGradient
            colors={gradientColors}
            end={{ x: 1, y: 0.5 }}
            start={{ x: 0, y: 0.5 }}
            locations={[0, 0.58, 1]}
            className="flex-row items-center justify-center rounded-[14px] px-3 py-2.5"
          >
            {isLoading ? (
              <ActivityIndicator color="#FFFFFF" size="small" />
            ) : (
              <>
                <SymbolView
                  name={{
                    ios: "checkmark",
                    android: "check",
                    web: "check",
                  }}
                  size={13}
                  tintColor="#FFFFFF"
                />
                <Text className="ml-1.5 text-[12px] font-semibold text-white">
                  Áp dụng
                </Text>
              </>
            )}
          </LinearGradient>
        </Pressable>
      </View>

      <View className="mt-2 flex-row items-center justify-end">
        <Text className="text-[10px] font-medium text-[#B3A6AF]">
          Đang áp dụng:{" "}
        </Text>
        <Text className="text-[10px] font-bold text-[#8E869A]">
          {formatDistanceMeters(currentDistanceMeters)}
        </Text>
      </View>
    </View>
  );
}

function NearbyPlacesShowcaseCard({
  cardHeight,
  cardWidth,
  imageHeight,
}: {
  cardHeight: number;
  cardWidth: number;
  imageHeight: number;
}) {
  return (
    <View
      className="overflow-hidden"
      style={{
        height: cardHeight,
        width: cardWidth,
      }}
    >
      <View className="absolute -right-6 top-5 h-24 w-24 rounded-full bg-[#FFD6E4]/55" />
      <View className="absolute -bottom-8 -left-7 h-24 w-24 rounded-full bg-[#FFF8FB]" />

      <View className="flex-1 items-start justify-end px-1 pb-1 pt-1">
        <View className="mt-auto items-start">
          <Image
            source={nearbyShowcaseMascot}
            contentFit="contain"
            transition={220}
            cachePolicy="memory-disk"
            style={{
              height: imageHeight,
              marginBottom: -18,
              marginLeft: -48,
              width: cardWidth + 92,
            }}
          />
        </View>
      </View>
    </View>
  );
}

function GuestWelcomeHeader({
  onGreetingPress,
  isDistanceDropdownVisible,
  onLocationPress,
  onSearchPress,
  isLocationLoading,
}: {
  onGreetingPress: () => void;
  isDistanceDropdownVisible: boolean;
  onLocationPress: () => void;
  onSearchPress: () => void;
  isLocationLoading: boolean;
}) {
  const logoOffset = useSharedValue(0);

  useEffect(() => {
    logoOffset.set(
      withRepeat(
        withTiming(-8, {
          duration: 1100,
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
      cancelAnimation(logoOffset);
      logoOffset.set(0);
    };
  }, [logoOffset]);

  const animatedLogoStyle = useAnimatedStyle(() => {
    return {
      transform: [{ translateY: logoOffset.get() }],
    };
  });

  return (
    <View className="flex-row items-center gap-4 px-1 py-2">
      <Animated.View style={animatedLogoStyle}>
        <View className="h-16 w-16 items-center justify-center rounded-full bg-white/95">
          <Image
            source={guestPreviewLogo}
            contentFit="contain"
            transition={380}
            style={{ height: 90, width: 90 }}
          />
        </View>
      </Animated.View>

      <View className="flex-1 gap-1">
        <View className="flex-row items-center justify-between gap-3">
          <Pressable className="flex-1" hitSlop={8} onPress={onGreetingPress}>
            <Text className="text-[18px] font-extrabold tracking-[-0.3px] text-[#2B2233]">
              Xin chào bạn
            </Text>
          </Pressable>

          <View className="flex-row items-center gap-2.5">
            <Pressable
              accessibilityLabel="Mở bộ lọc nearby"
              className={`h-10 w-10 items-center justify-center rounded-full border ${
                isDistanceDropdownVisible
                  ? "border-[#EB489B] bg-[#FFF1F6]"
                  : "border-[#F5D7C7] bg-white"
              } ${isLocationLoading ? "opacity-70" : ""}`}
              disabled={isLocationLoading}
              hitSlop={8}
              onPress={onLocationPress}
            >
              <SymbolView
                name={{
                  ios: "location",
                  android: "my_location",
                  web: "my_location",
                }}
                size={16}
                tintColor={isDistanceDropdownVisible ? "#EB489B" : "#F58752"}
              />
            </Pressable>

            <Pressable
              accessibilityLabel="Mở danh sách địa danh"
              className="h-10 w-10 items-center justify-center rounded-full border border-[#ECE1E9] bg-[#FAF7FC]"
              hitSlop={8}
              onPress={onSearchPress}
            >
              <SymbolView
                name={{
                  ios: "magnifyingglass",
                  android: "search",
                  web: "search",
                }}
                size={16}
                tintColor="#8E869A"
              />
            </Pressable>
          </View>
        </View>

        <View className="flex-row items-center gap-1.5">
          <SymbolView
            name={{
              ios: "star.fill",
              android: "star",
              web: "star",
            }}
            size={14}
            tintColor="#F7B500"
          />
          <Text className="text-[13px] font-bold text-[#8E869A]">
            Đăng nhập để lưu hành trình
          </Text>
        </View>
      </View>
    </View>
  );
}

function ExplorerHeaderAvatar({
  avatar,
  level,
  name,
  username,
}: Omit<ExplorerSummary, "isPremium">) {
  return (
    <View className="relative">
      <LinearGradient
        colors={gradientColors}
        end={{ x: 1, y: 0.9 }}
        start={{ x: 0, y: 0.1 }}
        className="h-16 w-16 rounded-full p-[2px]"
      >
        <View className="flex-1 items-center justify-center rounded-full bg-white p-[3px]">
          <UserAvatar
            displayName={name}
            size={54}
            uri={avatar}
            username={username}
          />
        </View>
      </LinearGradient>

      {typeof level === "number" ? (
        <View className="absolute -bottom-1 -right-2 rounded-full border-2 border-white bg-[#b1741e] px-2.5 py-1">
          <Text className="text-[11px] font-extrabold text-white">
            {`Lv.${level}`}
          </Text>
        </View>
      ) : null}
    </View>
  );
}

function ExplorerHeaderActions({
  isDistanceDropdownVisible,
  isLocationLoading,
  onLocationPress,
  onSearchPress,
  onNotificationPress,
}: {
  isDistanceDropdownVisible: boolean;
  isLocationLoading: boolean;
  onLocationPress: () => void;
  onSearchPress: () => void;
  onNotificationPress: () => void;
}) {
  return (
    <View className="flex-row items-center gap-2.5">
      <Pressable
        accessibilityLabel="Mở bộ lọc gần đây"
        className={`h-10 w-10 items-center justify-center rounded-full ${
          isDistanceDropdownVisible ? "bg-[#FFF1F6]" : "bg-[#FFF4EF]"
        } ${isLocationLoading ? "opacity-70" : ""}`}
        disabled={isLocationLoading}
        hitSlop={8}
        onPress={onLocationPress}
      >
        <SymbolView
          name={{
            ios: "location",
            android: "my_location",
            web: "my_location",
          }}
          size={16}
          tintColor={isDistanceDropdownVisible ? "#EB489B" : "#F58752"}
        />
      </Pressable>

      <Pressable
        accessibilityLabel="Mở danh sách địa danh"
        className="h-10 w-10 items-center justify-center rounded-full bg-[#FAF7FC]"
        hitSlop={8}
        onPress={onSearchPress}
      >
        <SymbolView
          name={{
            ios: "magnifyingglass",
            android: "search",
            web: "search",
          }}
          size={16}
          tintColor="#8E869A"
        />
      </Pressable>

      <Pressable
        accessibilityLabel="Mở thông báo"
        className="h-10 w-10 items-center justify-center rounded-full bg-[#FFF4EF]"
        hitSlop={8}
        onPress={onNotificationPress}
      >
        <SymbolView
          name={{
            ios: "bell",
            android: "notifications",
            web: "notifications",
          }}
          size={16}
          tintColor="#EB489B"
        />
      </Pressable>
    </View>
  );
}

function LocationMapModal({
  coordinate,
  errorMessage,
  isLocationLoading,
  onClose,
  onOpenSettings,
  onRetry,
  visible,
}: {
  coordinate: AppCoordinate | null;
  errorMessage: string | null;
  isLocationLoading: boolean;
  onClose: () => void;
  onOpenSettings: () => void;
  onRetry: () => void;
  visible: boolean;
}) {
  const mapRef = useRef<MapView | null>(null);
  const previewRegion = getLocationPreviewRegion(coordinate);

  useEffect(() => {
    if (!visible || !coordinate || Platform.OS === "web") {
      return;
    }

    const timerId = setTimeout(() => {
      mapRef.current?.animateToRegion(
        getLocationPreviewRegion(coordinate),
        260,
      );
    }, 60);

    return () => {
      clearTimeout(timerId);
    };
  }, [coordinate, visible]);

  return (
    <Modal animationType="slide" onRequestClose={onClose} visible={visible}>
      <View className="flex-1 bg-[#F7F6F2]">
        {Platform.OS === "web" ? (
          <View className="flex-1 items-center justify-center bg-[#E8F0FE] px-8">
            <View className="w-full max-w-[320px] rounded-[28px] bg-white px-5 py-6">
              <Text className="text-center text-[17px] font-extrabold text-[#2B2233]">
                Bản đồ chỉ hỗ trợ trên Android
              </Text>
              <Text className="mt-2 text-center text-[13px] leading-5 text-[#8E869A]">
                Hãy mở app trên điện thoại để xem bản đồ vị trí hiện tại full
                màn hình.
              </Text>
            </View>
          </View>
        ) : (
          <MapView
            key={
              coordinate
                ? `${coordinate.latitude.toFixed(5)}-${coordinate.longitude.toFixed(5)}`
                : "home-location-preview"
            }
            ref={mapRef}
            provider={PROVIDER_GOOGLE}
            initialRegion={previewRegion}
            loadingEnabled
            loadingBackgroundColor="#E8F0FE"
            loadingIndicatorColor="#EB489B"
            mapType="standard"
            showsBuildings
            showsCompass
            showsMyLocationButton={false}
            showsUserLocation={Boolean(coordinate)}
            style={{ flex: 1 }}
          >
            {coordinate ? (
              <Marker
                anchor={{ x: 0.5, y: 0.5 }}
                coordinate={{
                  latitude: coordinate.latitude,
                  longitude: coordinate.longitude,
                }}
              >
                <View className="h-5 w-5 rounded-full border-4 border-white bg-[#2563EB]" />
              </Marker>
            ) : null}
          </MapView>
        )}

        <SafeAreaView
          pointerEvents="box-none"
          className="absolute inset-0"
          edges={["top", "left", "right", "bottom"]}
        >
          <View
            className="flex-1 justify-between px-4 pb-6 pt-2"
            pointerEvents="box-none"
          >
            <View
              className="flex-row items-center justify-between"
              pointerEvents="box-none"
            >
              <Pressable
                className="h-11 w-11 items-center justify-center rounded-full bg-white"
                onPress={onClose}
                style={cardShadowStyle}
              >
                <SymbolView
                  name={{
                    ios: "chevron.left",
                    android: "arrow_back",
                    web: "arrow_back",
                  }}
                  size={18}
                  tintColor="#2B2233"
                />
              </Pressable>

              <View
                className="rounded-full bg-white px-4 py-2"
                style={cardShadowStyle}
              >
                <Text className="text-[13px] font-bold text-[#2B2233]">
                  Vị trí hiện tại
                </Text>
              </View>

              <View className="w-11" />
            </View>

            <View className="items-end" pointerEvents="box-none">
              {coordinate ? (
                <Pressable
                  className="h-12 w-12 items-center justify-center rounded-full bg-white"
                  onPress={() => {
                    mapRef.current?.animateToRegion(
                      getLocationPreviewRegion(coordinate),
                      260,
                    );
                  }}
                  style={cardShadowStyle}
                >
                  <SymbolView
                    name={{
                      ios: "location.fill",
                      android: "my_location",
                      web: "my_location",
                    }}
                    size={18}
                    tintColor="#0F8A83"
                  />
                </Pressable>
              ) : null}
            </View>
          </View>
        </SafeAreaView>

        {isLocationLoading ? (
          <View className="absolute inset-0 items-center justify-center bg-[#F7F6F2]/92 px-7">
            <View className="w-full max-w-[300px] rounded-[28px] bg-white px-5 py-6">
              <View className="items-center">
                <ActivityIndicator color="#EB489B" size="small" />
              </View>
              <Text className="mt-4 text-center text-[18px] font-extrabold text-[#2B2233]">
                Đang lấy vị trí GPS
              </Text>
              <Text className="mt-2 text-center text-[13px] leading-5 text-[#8E869A]">
                Bản đồ sẽ tự mở đúng vị trí bạn đang đứng ngay khi định vị xong.
              </Text>
            </View>
          </View>
        ) : errorMessage ? (
          <View className="absolute inset-0 items-center justify-center bg-[#F7F6F2]/94 px-7">
            <View className="w-full max-w-[320px] rounded-[28px] bg-white px-5 py-6">
              <View className="items-center">
                <View className="h-12 w-12 items-center justify-center rounded-full bg-[#FFF4EF]">
                  <SymbolView
                    name={{
                      ios: "location.slash.fill",
                      android: "location_off",
                      web: "location_off",
                    }}
                    size={18}
                    tintColor="#F58752"
                  />
                </View>
              </View>

              <Text className="mt-4 text-center text-[18px] font-extrabold text-[#2B2233]">
                Chưa mở được bản đồ vị trí
              </Text>
              <Text className="mt-2 text-center text-[13px] leading-5 text-[#8E869A]">
                {errorMessage}
              </Text>

              <View className="mt-5 flex-row gap-3">
                <Pressable
                  className="flex-1 rounded-[18px] border border-[#F4DCCF] bg-white px-4 py-3.5"
                  onPress={onOpenSettings}
                >
                  <Text className="text-center text-[14px] font-bold text-[#8E869A]">
                    Mở cài đặt
                  </Text>
                </Pressable>

                <Pressable
                  className="flex-1 overflow-hidden rounded-[18px]"
                  onPress={onRetry}
                >
                  <LinearGradient
                    colors={gradientColors}
                    end={{ x: 1, y: 0.5 }}
                    start={{ x: 0, y: 0.5 }}
                    locations={[0, 0.58, 1]}
                    className="items-center justify-center px-4 py-3.5"
                  >
                    <Text className="text-[14px] font-extrabold text-white">
                      Thử lại
                    </Text>
                  </LinearGradient>
                </Pressable>
              </View>
            </View>
          </View>
        ) : null}
      </View>
    </Modal>
  );
}

export default function HomeScreen() {
  const router = useRouter();
  const authSession = useAuthSession();
  const checkedInHotspotSlugs = useCheckins();
  const checkedInApiHotspotIds = useCheckedInApiHotspots();
  const { contentWidth, gutter, safeWidth } = useScreenLayout({
    maxContentWidth: 640,
  });
  const activeRouteIndexRef = useRef(0);
  const [activeRouteIndex, setActiveRouteIndex] = useState(0);
  const [explorerSummary, setExplorerSummary] =
    useState<ExplorerSummary | null>(null);
  const [nearbyPlacesNote, setNearbyPlacesNote] = useState<string | null>(null);
  const [nearbyPlacesStatus, setNearbyPlacesStatus] =
    useState<NearbyPlacesSectionStatus>("loading");
  const [isNearbyDistanceDropdownVisible, setIsNearbyDistanceDropdownVisible] =
    useState(false);
  const [isLocationMapVisible, setIsLocationMapVisible] = useState(false);
  const [isLocationMapLoading, setIsLocationMapLoading] = useState(false);
  const [locationMapCoordinate, setLocationMapCoordinate] =
    useState<AppCoordinate | null>(null);
  const [locationMapErrorMessage, setLocationMapErrorMessage] = useState<
    string | null
  >(null);
  const [nearbySearchDistanceMeters, setNearbySearchDistanceMeters] = useState(
    defaultNearbySearchDistanceMeters,
  );
  const [
    pendingNearbySearchDistanceMeters,
    setPendingNearbySearchDistanceMeters,
  ] = useState(defaultNearbySearchDistanceMeters);
  const [resolvedNearbyPlaces, setResolvedNearbyPlaces] = useState<
    NearbyPlaceListItem[]
  >([]);
  const [suggestedRoutes, setSuggestedRoutes] = useState<SuggestedRouteCard[]>(
    [],
  );
  const [suggestedRoutesNote, setSuggestedRoutesNote] = useState<string | null>(
    null,
  );
  const [suggestedRoutesStatus, setSuggestedRoutesStatus] =
    useState<SuggestedRoutesSectionStatus>("loading");
  const [communityLeaderboardEntries, setCommunityLeaderboardEntries] =
    useState<UserLeaderboardEntryDto[]>([]);
  const [
    communityLeaderboardErrorMessage,
    setCommunityLeaderboardErrorMessage,
  ] = useState<string | null>(null);
  const [communityLeaderboardStatus, setCommunityLeaderboardStatus] =
    useState<CommunityLeaderboardStatus>("loading");
  const [themeCategories, setThemeCategories] = useState<NearbyCategoryCard[]>(
    [],
  );
  const [featuredRouteCards, setFeaturedRouteCards] = useState<
    FeaturedRouteCard[]
  >([]);
  const [featuredRoutesStatus, setFeaturedRoutesStatus] =
    useState<FeaturedRoutesSectionStatus>("loading");
  const [featuredRoutesNote, setFeaturedRoutesNote] = useState<string | null>(
    null,
  );
  const [activeJourneyView, setActiveJourneyView] =
    useState<ActiveJourneyView | null>(null);
  const [activeJourneyStatus, setActiveJourneyStatus] =
    useState<ActiveJourneySectionStatus>("loading");

  useFocusEffect(
    useCallback(() => {
      let isActive = true;

      async function syncRemoteCheckinState() {
        if (!authSession.isAuthenticated) {
          return;
        }

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
          console.info("[home] check-in sync skipped", {
            error: error instanceof Error ? error.message : error,
          });
        }
      }

      void syncRemoteCheckinState();

      return () => {
        isActive = false;
      };
    }, [authSession.isAuthenticated, authSession.tokenType]),
  );
  const isGuest = authSession.role === "guest";
  const homeHeaderTopPadding = 12;
  const routeCardLeftInset = gutter;
  const routeCardWidth = Math.max(contentWidth, 264);
  const nearbyRouteCardWidth = Math.min(Math.max(safeWidth * 0.68, 228), 260);
  const nearbyPlaceCardWidth = Math.min(Math.max(safeWidth * 0.45, 168), 196);
  const nearbyPlaceImageHeight = Math.round(nearbyPlaceCardWidth * 0.8);
  const nearbyPlaceCardHeight =
    nearbyPlaceImageHeight + nearbyPlaceContentHeight;
  const nearbyPlacesShowcaseWidth = Math.min(
    Math.max(safeWidth * 0.31, 130),
    158,
  );
  const nearbyPlacesShowcaseHeight = nearbyPlaceCardHeight + 6;
  const nearbyPlacesShowcaseImageHeight = Math.max(
    nearbyPlacesShowcaseHeight - 18,
    232,
  );
  const nearbyPlacesSectionTopInset = 10;
  const nearbyPlacesSectionHeight = nearbyPlacesShowcaseHeight + 24;
  const nearbyPlacesScrollStartInset = Math.round(
    gutter + nearbyPlacesShowcaseWidth + 10,
  );
  const voucherMerchantCircleSize = Math.min(
    Math.max(contentWidth * 0.22, 76),
    86,
  );
  const themeCategoryCircleSize = Math.min(Math.max(safeWidth * 0.2, 74), 84);
  const themeCategoryItemWidth = themeCategoryCircleSize + 14;
  const themeCategoryImageSize = Math.round(themeCategoryCircleSize * 0.74);
  const voucherMerchantLogoSize = Math.round(voucherMerchantCircleSize * 0.88);
  const voucherMerchantItemWidth = voucherMerchantCircleSize + 14;
  const currentJourney = !isGuest ? activeJourneyView : null;
  const activeJourneyProgress = currentJourney
    ? Math.min(Math.max(currentJourney.progress, 0), 100)
    : 0;
  const isActiveJourneyLoading =
    !isGuest && activeJourneyStatus === "loading" && !activeJourneyView;
  const activeCommunityBoard = buildCommunityBoardViewModelFromLeaderboard({
    entries: communityLeaderboardEntries,
    errorMessage: communityLeaderboardErrorMessage,
    status: communityLeaderboardStatus,
  });
  const activeFeaturedRoute =
    featuredRouteCards[
      Math.min(activeRouteIndex, Math.max(featuredRouteCards.length - 1, 0))
    ] ?? null;
  const explorerName =
    explorerSummary?.name.trim() ||
    authSession.displayName.trim() ||
    authSession.username?.trim() ||
    "Ngọc";
  const explorerAvatar = explorerSummary?.avatar ?? null;
  const explorerLevel = explorerSummary?.level ?? null;
  const isPremiumExplorer = explorerSummary?.isPremium ?? false;
  const explorerUsername =
    explorerSummary?.username.trim() ||
    authSession.username?.trim() ||
    explorerName;
  const handleOpenHotspots = () => {
    router.push("/hotspots");
  };
  const handleOpenThemeCategory = (item: NearbyCategoryCard) => {
    router.push(
      getThemeDetailHref({
        accent: item.accent,
        background: item.background,
        imageUrl: item.imageUrl,
        tagId: item.tagId,
        title: item.label,
      }),
    );
  };
  const handleOpenRoutes = () => {
    router.push("/route");
  };
  const handleOpenRouteDetail = (routeId: number) => {
    router.push(`/route/${routeId}` as Href);
  };
  const handleOpenCommunityLeaderboard = () => {
    router.push("/community/leaderboard" as Href);
  };
  const handleOpenNotifications = () => {
    router.push("/notifications" as Href);
  };
  const handleOpenRegister = () => {
    router.push("/login?entry=home");
  };
  const handleToggleNearbyDistanceDropdown = useCallback(() => {
    setIsNearbyDistanceDropdownVisible((currentValue) => {
      if (!currentValue) {
        setPendingNearbySearchDistanceMeters(nearbySearchDistanceMeters);
      }

      return !currentValue;
    });
  }, [nearbySearchDistanceMeters]);
  const handleApplyNearbyDistance = useCallback(
    (nextDistanceMeters: number) => {
      setNearbySearchDistanceMeters(nextDistanceMeters);
      setPendingNearbySearchDistanceMeters(nextDistanceMeters);
      setIsNearbyDistanceDropdownVisible(false);
    },
    [],
  );
  const handleCloseLocationMap = useCallback(() => {
    setIsLocationMapVisible(false);
  }, []);
  const handleOpenLocationSettings = useCallback(() => {
    void Linking.openSettings();
  }, []);
  const handleOpenLocationMap = useCallback(async () => {
    setIsLocationMapVisible(true);
    setIsLocationMapLoading(true);
    setLocationMapErrorMessage(null);

    try {
      const { coordinate, fallbackMessage } =
        await resolveNearbyRequestCoordinate();

      setLocationMapCoordinate(coordinate);
      setLocationMapErrorMessage(
        coordinate
          ? null
          : (fallbackMessage ?? "Không xác định được vị trí hiện tại."),
      );
    } catch (error) {
      setLocationMapCoordinate(null);
      setLocationMapErrorMessage(
        error instanceof Error
          ? error.message
          : "Không thể mở bản đồ vị trí hiện tại.",
      );
    } finally {
      setIsLocationMapLoading(false);
    }
  }, []);
  const handleOpenLocationMapFromDropdown = useCallback(() => {
    setNearbySearchDistanceMeters(pendingNearbySearchDistanceMeters);
    setPendingNearbySearchDistanceMeters(pendingNearbySearchDistanceMeters);
    setIsNearbyDistanceDropdownVisible(false);
    void handleOpenLocationMap();
  }, [handleOpenLocationMap, pendingNearbySearchDistanceMeters]);

  useEffect(() => {
    if (featuredRouteCards.length <= 1) {
      activeRouteIndexRef.current = 0;
      return;
    }

    const intervalId = setInterval(() => {
      const nextIndex =
        (activeRouteIndexRef.current + 1) % featuredRouteCards.length;

      activeRouteIndexRef.current = nextIndex;
      setActiveRouteIndex(nextIndex);
    }, 3600);

    return () => {
      clearInterval(intervalId);
    };
  }, [featuredRouteCards.length]);

  useEffect(() => {
    let isActive = true;

    async function loadFeaturedRoutes() {
      setFeaturedRoutesStatus("loading");
      setFeaturedRoutesNote(null);

      try {
        const accessToken = authSession.isAuthenticated
          ? await getValidAccessToken()
          : null;

        if (!isActive) {
          return;
        }

        const routePage = await searchRoutes({
          accessToken,
          page: 0,
          size: 20,
          sortDirection: "DESC",
          status: "PUBLISHED",
          tokenType: authSession.tokenType,
        });

        if (!isActive) {
          return;
        }

        // Backend có thể chưa lọc status theo filter động nên lọc thêm ở client.
        const publishedRoutes = routePage.content.filter(isPublishedRoute);
        const highlightRoutes = getHighlightRoutes(
          publishedRoutes.length > 0 ? publishedRoutes : routePage.content,
        );

        activeRouteIndexRef.current = 0;
        setActiveRouteIndex(0);
        setFeaturedRouteCards(highlightRoutes.map(mapRouteToFeaturedRouteCard));
        setFeaturedRoutesStatus(highlightRoutes.length > 0 ? "ready" : "empty");
        setFeaturedRoutesNote(
          highlightRoutes.length > 0
            ? null
            : "Chưa có tuyến nào được xuất bản trên hệ thống.",
        );
      } catch (error) {
        console.warn("[home] load featured routes failed", {
          error: error instanceof Error ? error.message : error,
        });

        if (!isActive) {
          return;
        }

        setFeaturedRouteCards([]);
        setFeaturedRoutesNote(
          error instanceof Error
            ? error.message
            : "Không tải được tuyến nổi bật.",
        );
        setFeaturedRoutesStatus("empty");
      }
    }

    void loadFeaturedRoutes();

    return () => {
      isActive = false;
    };
  }, [authSession.isAuthenticated, authSession.tokenType]);

  useFocusEffect(
    useCallback(() => {
      let isActive = true;

      async function loadActiveJourney() {
        if (!authSession.isAuthenticated) {
          setActiveJourneyView(null);
          setActiveJourneyStatus("empty");
          return;
        }

        setActiveJourneyStatus("loading");

        try {
          const accessToken = await getValidAccessToken();

          if (!isActive) {
            return;
          }

          if (!accessToken) {
            setActiveJourneyView(null);
            setActiveJourneyStatus("empty");
            return;
          }

          const progressPage = await getUserRouteProgressList({
            accessToken,
            page: 0,
            size: 20,
            sortBy: "startedAt",
            sortDirection: "DESC",
            tokenType: authSession.tokenType,
          });

          if (!isActive) {
            return;
          }

          const activeProgress =
            progressPage.content.find(isActiveRouteProgress) ?? null;

          if (!activeProgress) {
            setActiveJourneyView(null);
            setActiveJourneyStatus("empty");
            return;
          }

          // API danh sách tiến độ có thể không kèm route đầy đủ (thiếu media,
          // hotspot). Khi đó gọi thêm route detail để lấy hình và điểm dừng.
          let journeyRoute = activeProgress.route ?? null;

          if (!journeyRoute || journeyRoute.hotspots.length === 0) {
            try {
              journeyRoute = await getRouteById({
                accessToken,
                routeId: activeProgress.routeId,
                tokenType: authSession.tokenType,
              });
            } catch (routeError) {
              console.info("[home] load active journey route skipped", {
                error:
                  routeError instanceof Error ? routeError.message : routeError,
                routeId: activeProgress.routeId,
              });
            }
          }

          if (!isActive) {
            return;
          }

          setActiveJourneyView(
            buildActiveJourneyView(activeProgress, journeyRoute),
          );
          setActiveJourneyStatus("ready");
        } catch (error) {
          console.warn("[home] load active journey failed", {
            error: error instanceof Error ? error.message : error,
          });

          if (!isActive) {
            return;
          }

          setActiveJourneyView(null);
          setActiveJourneyStatus("empty");
        }
      }

      void loadActiveJourney();

      return () => {
        isActive = false;
      };
    }, [authSession.isAuthenticated, authSession.tokenType]),
  );

  useEffect(() => {
    let isActive = true;

    async function loadNearbyPlaces() {
      setNearbyPlacesStatus("loading");
      setNearbyPlacesNote(null);
      setSuggestedRoutesStatus("loading");
      setSuggestedRoutesNote(null);

      try {
        const { coordinate, fallbackMessage } =
          await resolveNearbyRequestCoordinate();

        if (!isActive) {
          return;
        }

        if (!coordinate) {
          setResolvedNearbyPlaces([]);
          setNearbyPlacesNote(fallbackMessage);
          setNearbyPlacesStatus("empty");
          setSuggestedRoutes([]);
          setSuggestedRoutesNote(
            "Không xác định được vị trí hiện tại nên chưa thể gợi ý tuyến đường phù hợp.",
          );
          setSuggestedRoutesStatus("empty");
          return;
        }

        const accessToken = authSession.isAuthenticated
          ? await getValidAccessToken()
          : null;
        const apiNearbyHotspots = await getNearbyHotspots({
          accessToken,
          distance: nearbySearchDistanceMeters,
          latitude: coordinate.latitude,
          longitude: coordinate.longitude,
          tokenType: authSession.tokenType,
        });

        if (!isActive) {
          return;
        }

        if (apiNearbyHotspots.length === 0) {
          setResolvedNearbyPlaces([]);
          setNearbyPlacesNote(
            coordinate.source === "dev-override"
              ? `Không có dữ liệu phù hợp trong bán kính ${formatDistanceMeters(nearbySearchDistanceMeters)} quanh tọa độ test ${formatCoordinateLabel(coordinate)}.`
              : `Không có dữ liệu phù hợp trong bán kính ${formatDistanceMeters(nearbySearchDistanceMeters)} quanh vị trí hiện tại.`,
          );
          setNearbyPlacesStatus("empty");
          setSuggestedRoutes([]);
          setSuggestedRoutesNote(
            "Không có dữ liệu tuyến đường phù hợp gần bạn.",
          );
          setSuggestedRoutesStatus("empty");
          return;
        }

        mergeApiCheckins(
          apiNearbyHotspots
            .filter((hotspot) => hotspot.isCheckedIn === true)
            .map((hotspot) => hotspot.hotspotId),
        );
        setResolvedNearbyPlaces(
          buildApiNearbyPlaceItems(apiNearbyHotspots, coordinate),
        );
        setNearbyPlacesNote(
          coordinate.source === "dev-override"
            ? `Đang hiển thị địa điểm trong bán kính ${formatDistanceMeters(nearbySearchDistanceMeters)} quanh tọa độ test ${formatCoordinateLabel(coordinate)}.`
            : null,
        );
        setNearbyPlacesStatus("ready");

        const nearbyHotspotsByDistance = sortNearbyHotspotsByDistance(
          apiNearbyHotspots,
          coordinate,
        );

        try {
          const hotspotRouteResults = await Promise.allSettled(
            nearbyHotspotsByDistance.map((hotspot) =>
              getRoutesByHotspot({
                accessToken,
                hotspotId: hotspot.hotspotId,
                routeStatus: "PUBLISHED",
                tokenType: authSession.tokenType,
              }),
            ),
          );

          if (!isActive) {
            return;
          }

          const failedRouteLookups = hotspotRouteResults.filter(
            (result) => result.status === "rejected",
          );
          const mergedRoutes = dedupeRoutesById(
            hotspotRouteResults.flatMap((result) =>
              result.status === "fulfilled" ? result.value : [],
            ),
          );

          if (mergedRoutes.length === 0) {
            if (failedRouteLookups.length === hotspotRouteResults.length) {
              throw new Error(
                "Không tải được tuyến gợi ý cho các địa điểm gần bạn.",
              );
            }

            setSuggestedRoutes([]);
            setSuggestedRoutesNote(
              "Không có dữ liệu tuyến đường phù hợp gần bạn.",
            );
            setSuggestedRoutesStatus("empty");
            return;
          }

          setSuggestedRoutes(mergedRoutes.map(mapRouteToSuggestedRouteCard));
          setSuggestedRoutesNote(
            failedRouteLookups.length > 0
              ? `Đang hiển thị ${mergedRoutes.length} tuyến từ các địa điểm gần bạn. ${failedRouteLookups.length} địa điểm chưa tải được route.`
              : coordinate.source === "dev-override"
                ? `Đang hiển thị ${mergedRoutes.length} tuyến gợi ý tổng hợp từ ${nearbyHotspotsByDistance.length} hotspot gần tọa độ test ${formatCoordinateLabel(coordinate)}.`
                : null,
          );
          setSuggestedRoutesStatus("ready");
        } catch (routeError) {
          console.warn("[home] load suggested routes failed", {
            error:
              routeError instanceof Error ? routeError.message : routeError,
            hotspotIds: nearbyHotspotsByDistance.map(
              (hotspot) => hotspot.hotspotId,
            ),
          });

          if (!isActive) {
            return;
          }

          setSuggestedRoutes([]);
          setSuggestedRoutesNote(
            routeError instanceof Error
              ? routeError.message
              : "Không có dữ liệu tuyến đường phù hợp.",
          );
          setSuggestedRoutesStatus("empty");
        }
      } catch (error) {
        console.warn("[home] load nearby places failed", {
          error: error instanceof Error ? error.message : error,
        });

        if (!isActive) {
          return;
        }

        setResolvedNearbyPlaces([]);
        setNearbyPlacesNote(
          error instanceof Error
            ? error.message
            : "Không có dữ liệu địa điểm phù hợp.",
        );
        setNearbyPlacesStatus("empty");
        setSuggestedRoutes([]);
        setSuggestedRoutesNote("Không có dữ liệu tuyến đường phù hợp.");
        setSuggestedRoutesStatus("empty");
      }
    }

    void loadNearbyPlaces();

    return () => {
      isActive = false;
    };
  }, [
    authSession.isAuthenticated,
    authSession.tokenType,
    nearbySearchDistanceMeters,
  ]);

  useEffect(() => {
    let isActive = true;

    async function loadThemeCategories() {
      setThemeCategories([]);

      try {
        const accessToken = authSession.isAuthenticated
          ? await getValidAccessToken()
          : null;

        if (!isActive) {
          return;
        }

        const tags = await getActiveTags({
          accessToken,
          tokenType: authSession.tokenType,
        });

        if (!isActive) {
          return;
        }

        setThemeCategories(mapActiveTagsToNearbyCategories(tags));
      } catch (error) {
        console.warn("[home] load theme categories failed", {
          error: error instanceof Error ? error.message : error,
        });

        if (!isActive) {
          return;
        }

        setThemeCategories([]);
      }
    }

    void loadThemeCategories();

    return () => {
      isActive = false;
    };
  }, [authSession.isAuthenticated, authSession.tokenType]);
  useEffect(() => {
    let isActive = true;

    async function loadCommunityLeaderboard() {
      setCommunityLeaderboardStatus("loading");
      setCommunityLeaderboardErrorMessage(null);

      try {
        const accessToken = authSession.isAuthenticated
          ? await getValidAccessToken()
          : null;

        if (!isActive) {
          return;
        }

        const leaderboardResponse = await getUserLeaderboard({
          accessToken,
          tokenType: authSession.tokenType,
        });

        if (!isActive) {
          return;
        }

        setCommunityLeaderboardEntries(leaderboardResponse.content);
        setCommunityLeaderboardStatus(
          leaderboardResponse.content.length > 0 ? "ready" : "empty",
        );
      } catch (error) {
        console.warn("[home] load community leaderboard failed", {
          error: error instanceof Error ? error.message : error,
        });

        if (!isActive) {
          return;
        }

        setCommunityLeaderboardEntries([]);
        setCommunityLeaderboardErrorMessage(
          error instanceof Error
            ? error.message
            : "Không tải được bảng xếp hạng cộng đồng.",
        );
        setCommunityLeaderboardStatus("error");
      }
    }

    void loadCommunityLeaderboard();

    return () => {
      isActive = false;
    };
  }, [authSession.isAuthenticated, authSession.tokenType]);

  useFocusEffect(
    useCallback(() => {
      let isActive = true;

      async function loadExplorerSummary() {
        if (!authSession.isAuthenticated) {
          if (isActive) {
            setExplorerSummary(null);
          }
          return;
        }

        try {
          const accessToken = await getValidAccessToken();

          if (!isActive) {
            return;
          }

          if (!accessToken) {
            setExplorerSummary(null);
            return;
          }

          const [profileResult, levelsResult] = await Promise.allSettled([
            getMyProfile({
              accessToken,
              tokenType: authSession.tokenType,
            }),
            getGamificationLevels({
              accessToken,
              tokenType: authSession.tokenType,
            }),
          ]);

          if (profileResult.status !== "fulfilled") {
            throw profileResult.reason;
          }

          const profile =
            levelsResult.status === "fulfilled"
              ? applyLevelProgressToProfile(
                  profileResult.value,
                  levelsResult.value,
                )
              : profileResult.value;

          if (!isActive) {
            return;
          }

          if (levelsResult.status !== "fulfilled") {
            console.warn("[home] load explorer levels failed", {
              error:
                levelsResult.reason instanceof Error
                  ? levelsResult.reason.message
                  : levelsResult.reason,
            });
          }

          const resolvedName = profile.name.trim() || profile.username.trim();

          // Đẩy isPremium vào store dùng chung để mọi màn hình/hành động
          // Premium khác trong app (record journey, user plan...) đọc được
          // giá trị mới nhất mà không phải tự gọi lại getMyProfile().
          setPremiumStatusFromProfile(profile.isPremium);

          setExplorerSummary({
            avatar: profile.avatar?.trim() || null,
            isPremium: profile.isPremium,
            level: profile.level,
            name: resolvedName,
            username:
              profile.username.trim() ||
              authSession.username?.trim() ||
              authSession.displayName.trim() ||
              resolvedName,
          });
        } catch (error) {
          if (!isActive) {
            return;
          }

          setExplorerSummary(null);
          console.warn("[home] load explorer summary failed", {
            error: error instanceof Error ? error.message : error,
          });
        }
      }

      void loadExplorerSummary();

      return () => {
        isActive = false;
      };
    }, [
      authSession.displayName,
      authSession.isAuthenticated,
      authSession.tokenType,
      authSession.username,
    ]),
  );

  return (
    <SafeAreaView className="flex-1 bg-white" edges={["top", "left", "right"]}>
      <RNStatusBar
        animated
        backgroundColor="transparent"
        barStyle="dark-content"
        translucent={Platform.OS === "android"}
      />
      <ScrollView
        className="flex-1"
        contentContainerStyle={{ paddingBottom: 0 }}
        showsVerticalScrollIndicator={false}
      >
        <View
          className="gap-6"
          style={{
            paddingHorizontal: gutter,
            paddingTop: homeHeaderTopPadding,
          }}
        >
          {isGuest ? (
            <GuestWelcomeHeader
              onGreetingPress={handleOpenRegister}
              isDistanceDropdownVisible={isNearbyDistanceDropdownVisible}
              isLocationLoading={isLocationMapLoading}
              onLocationPress={handleToggleNearbyDistanceDropdown}
              onSearchPress={handleOpenHotspots}
            />
          ) : (
            <View className="flex-row items-center justify-between">
              <View className="flex-1 flex-row items-center gap-3.5 pr-3">
                <ExplorerHeaderAvatar
                  avatar={explorerAvatar}
                  level={explorerLevel}
                  name={explorerName}
                  username={explorerUsername}
                />

                <View className="flex-1 gap-1">
                  <View className="gap-0.5">
                    <Text className="text-[15px] font-extrabold tracking-[-0.3px] text-[#2B2233]">
                      {`Chào ${explorerName}`}
                    </Text>
                    <Text className="text-[11px] leading-4 text-[#8E869A]">
                      Sẵn sàng khám phá
                    </Text>
                  </View>
                </View>
              </View>

              <ExplorerHeaderActions
                isDistanceDropdownVisible={isNearbyDistanceDropdownVisible}
                isLocationLoading={isLocationMapLoading}
                onLocationPress={handleToggleNearbyDistanceDropdown}
                onSearchPress={handleOpenHotspots}
                onNotificationPress={handleOpenNotifications}
              />
            </View>
          )}

          {isNearbyDistanceDropdownVisible ? (
            <NearbyDistanceDropdown
              currentDistanceMeters={nearbySearchDistanceMeters}
              draftDistanceMeters={pendingNearbySearchDistanceMeters}
              isLoading={nearbyPlacesStatus === "loading"}
              onApply={() => {
                handleApplyNearbyDistance(pendingNearbySearchDistanceMeters);
              }}
              onChangeDistance={setPendingNearbySearchDistanceMeters}
              onOpenMap={handleOpenLocationMapFromDropdown}
            />
          ) : null}

          {/* Premium status / upsell banner (driven by real subscription data) */}
          {isPremiumExplorer ? (
            <View className="overflow-hidden rounded-2xl border border-[#EADFFF] bg-[#F5F0FF] p-3.5 shadow-sm">
              <View className="flex-row items-center justify-between">
                <View className="flex-1 pr-3">
                  <View className="mb-1 flex-row items-center gap-1.5 self-start rounded-full bg-[#7C3AED] px-2.5 py-0.5">
                    <SymbolView
                      name={{
                        ios: "crown.fill",
                        android: "workspace_premium",
                        web: "workspace_premium",
                      }}
                      size={10}
                      tintColor="#FFFFFF"
                    />
                    <Text className="text-[9px] font-extrabold uppercase tracking-wider text-white">
                      PREMIUM EXPLORER
                    </Text>
                  </View>
                  <Text className="text-[14px] font-extrabold text-[#2B2233]">
                    Bạn đã mở khoá đầy đủ tính năng Premium
                  </Text>
                  <Text className="mt-0.5 text-[11px] text-[#8E869A]">
                    AI Lập kế hoạch, Ghi hành trình Live & Audio Guide đã sẵn sàng ở trang Khám phá
                  </Text>
                </View>
              </View>
            </View>
          ) : (
            <Pressable
              onPress={() => router.push("/subscription/premium")}
              className="overflow-hidden rounded-2xl border border-[#FCDDEC] bg-[#FFF0F7] p-3.5 shadow-sm"
            >
              <View className="flex-row items-center justify-between">
                <View className="flex-1 pr-3">
                  <View className="mb-1 flex-row items-center gap-1.5 self-start rounded-full bg-[#EB489B] px-2.5 py-0.5">
                    <SymbolView
                      name={{
                        ios: "crown.fill",
                        android: "workspace_premium",
                        web: "workspace_premium",
                      }}
                      size={10}
                      tintColor="#FFFFFF"
                    />
                    <Text className="text-[9px] font-extrabold uppercase tracking-wider text-white">
                      CULTUREQUEST PREMIUM
                    </Text>
                  </View>
                  <Text className="text-[14px] font-extrabold text-[#2B2233]">
                    Mở khóa AI Lập kế hoạch & Ghi hành trình Live
                  </Text>
                  <Text className="mt-0.5 text-[11px] text-[#8E869A]">
                    Trải nghiệm bộ tính năng Premium (User Plan & Record) tại trang Khám phá
                  </Text>
                </View>
                <View className="flex-row items-center rounded-full bg-[#EB489B] px-3 py-1.5">
                  <Text className="text-[11px] font-extrabold text-white">
                    Khám phá ngay →
                  </Text>
                </View>
              </View>
            </Pressable>
          )}

          <View className="gap-4">
            <View className="flex-row items-center justify-between gap-3">
              <View className="flex-1">
                <Text className="text-[17px] font-extrabold text-[#2B2233]">
                  Tuyến nổi bật
                </Text>
                <Text className="mt-0.5 text-[11px] font-medium text-[#9C94A5]">
                  Những hành trình được cộng đồng khám phá nhiều nhất
                </Text>
              </View>

              {featuredRouteCards.length > 0 ? (
                <Pressable
                  className="rounded-full bg-[#FFF1F6] px-3.5 py-2"
                  hitSlop={6}
                  onPress={handleOpenRoutes}
                >
                  <Text className="text-[12px] font-bold text-[#EB489B]">
                    Xem tất cả
                  </Text>
                </Pressable>
              ) : null}
            </View>

            {featuredRoutesStatus === "loading" ? (
              <SectionEmptyState
                description="Đang tải danh sách tuyến đã xuất bản từ hệ thống."
                title="Đang tải tuyến nổi bật..."
              />
            ) : !activeFeaturedRoute ? (
              <SectionEmptyState
                description={
                  featuredRoutesNote ?? "Không có dữ liệu tuyến phù hợp."
                }
                title="Chưa có tuyến nổi bật"
              />
            ) : (
              <>
                <View
                  className="items-start"
                  style={{
                    marginHorizontal: -gutter,
                    width: safeWidth,
                    paddingLeft: routeCardLeftInset,
                  }}
                >
                  <Pressable
                    key={activeFeaturedRoute.routeId}
                    className="overflow-hidden rounded-[30px] bg-[#2B2233]"
                    onPress={() => {
                      handleOpenRouteDetail(activeFeaturedRoute.routeId);
                    }}
                    style={[
                      heroShadowStyle,
                      {
                        width: routeCardWidth,
                      },
                    ]}
                  >
                    <Image
                      source={activeFeaturedRoute.coverUri}
                      contentFit="cover"
                      transition={220}
                      cachePolicy="memory-disk"
                      style={{ height: 230, width: "100%" }}
                    />

                    <LinearGradient
                      colors={[
                        "rgba(36, 28, 44, 0.10)",
                        "rgba(36, 28, 44, 0.38)",
                        "rgba(36, 28, 44, 0.92)",
                      ]}
                      locations={[0, 0.46, 1]}
                      start={{ x: 0.5, y: 0 }}
                      end={{ x: 0.5, y: 1 }}
                      className="absolute inset-0 px-4 py-4"
                    >
                      <View className="flex-row items-start justify-between gap-3">
                        <View className="flex-row flex-wrap items-center gap-2">
                          <View className="rounded-full bg-white/92 px-3 py-1.5">
                            <Text className="text-[10px] font-extrabold uppercase tracking-[0.5px] text-[#D9587F]">
                              {activeFeaturedRoute.tagLabel}
                            </Text>
                          </View>

                          <View className="flex-row items-center rounded-full bg-black/32 px-2.5 py-1.5">
                            <SymbolView
                              name={{
                                ios: "figure.walk",
                                android: "directions_walk",
                                web: "directions_walk",
                              }}
                              size={11}
                              tintColor="#FFFFFF"
                            />
                            <Text className="ml-1 text-[10px] font-extrabold text-white">
                              {activeFeaturedRoute.difficultyLabel}
                            </Text>
                          </View>
                        </View>

                        {activeFeaturedRoute.xpLabel ? (
                          <LinearGradient
                            colors={gradientColors}
                            end={{ x: 1, y: 0.5 }}
                            locations={[0, 0.58, 1]}
                            start={{ x: 0, y: 0.5 }}
                            className="flex-row items-center rounded-full px-2.5 py-1.5"
                          >
                            <SymbolView
                              name={{
                                ios: "sparkles",
                                android: "auto_awesome",
                                web: "auto_awesome",
                              }}
                              size={11}
                              tintColor="#FFFFFF"
                            />
                            <Text className="ml-1 text-[10px] font-extrabold text-white">
                              {activeFeaturedRoute.xpLabel}
                            </Text>
                          </LinearGradient>
                        ) : null}
                      </View>

                      <View className="mt-auto gap-3">
                        <Text
                          className="text-[21px] font-extrabold leading-6 text-white"
                          numberOfLines={2}
                        >
                          {activeFeaturedRoute.title}
                        </Text>

                        <View className="flex-row flex-wrap gap-2">
                          <View className="flex-row items-center rounded-full bg-white/18 px-3 py-1.5">
                            <SymbolView
                              name={{
                                ios: "mappin.and.ellipse",
                                android: "place",
                                web: "place",
                              }}
                              size={11}
                              tintColor="#FFFFFF"
                            />
                            <Text className="ml-1.5 text-[11px] font-bold text-white">
                              {activeFeaturedRoute.stopsLabel}
                            </Text>
                          </View>

                          <View className="flex-row items-center rounded-full bg-white/18 px-3 py-1.5">
                            <SymbolView
                              name={{
                                ios: "point.topleft.down.curvedto.point.bottomright.up",
                                android: "route",
                                web: "route",
                              }}
                              size={11}
                              tintColor="#FFFFFF"
                            />
                            <Text className="ml-1.5 text-[11px] font-bold text-white">
                              {activeFeaturedRoute.distanceLabel}
                            </Text>
                          </View>

                          <View className="flex-row items-center rounded-full bg-white/18 px-3 py-1.5">
                            <SymbolView
                              name={{
                                ios: "clock.fill",
                                android: "schedule",
                                web: "schedule",
                              }}
                              size={11}
                              tintColor="#FFFFFF"
                            />
                            <Text className="ml-1.5 text-[11px] font-bold text-white">
                              {activeFeaturedRoute.durationLabel}
                            </Text>
                          </View>
                        </View>

                        <View className="flex-row items-center justify-between gap-3">
                          <Pressable
                            className="flex-row items-center rounded-full bg-white/92 px-4 py-2.5"
                            onPress={() => {
                              handleOpenRouteDetail(
                                activeFeaturedRoute.routeId,
                              );
                            }}
                          >
                            <Text className="text-[14px] font-extrabold text-[#D9587F]">
                              Xem tuyến đường
                            </Text>
                            <SymbolView
                              name={{
                                ios: "arrow.right",
                                android: "arrow_forward",
                                web: "arrow_forward",
                              }}
                              size={13}
                              tintColor="#D9587F"
                            />
                          </Pressable>

                          <View className="h-9 w-9 items-center justify-center rounded-2xl bg-white/16">
                            <SymbolView
                              name={{ ios: "map", android: "map", web: "map" }}
                              size={15}
                              tintColor="#FFFFFF"
                            />
                          </View>
                        </View>
                      </View>
                    </LinearGradient>
                  </Pressable>
                </View>

                {featuredRouteCards.length > 1 ? (
                  <View
                    className="flex-row items-center justify-center gap-2"
                    style={{ paddingHorizontal: gutter }}
                  >
                    {featuredRouteCards.map((route, index) => (
                      <Pressable
                        key={route.routeId}
                        onPress={() => {
                          activeRouteIndexRef.current = index;
                          setActiveRouteIndex(index);
                        }}
                        className={`rounded-full ${
                          index === activeRouteIndex
                            ? "h-2.5 w-8 bg-[#EB489B]"
                            : "h-2.5 w-2.5 bg-[#F3C9D9]"
                        }`}
                      />
                    ))}
                  </View>
                ) : null}
              </>
            )}
          </View>

          {isGuest ? (
            <GuestAccessCard onPress={handleOpenRegister} />
          ) : isActiveJourneyLoading ? (
            <View className="gap-3">
              <Text className="text-[18px] font-extrabold text-[#2B2233]">
                Tiếp tục hành trình
              </Text>

              <SectionEmptyState
                description="Đang kiểm tra hành trình đang dang dở của bạn."
                title="Đang tải hành trình..."
              />
            </View>
          ) : currentJourney ? (
            <View className="gap-3">
              <Text className="text-[18px] font-extrabold text-[#2B2233]">
                Tiếp tục hành trình
              </Text>

              <View
                className="overflow-hidden rounded-[28px] border"
                style={[
                  cardShadowStyle,
                  {
                    backgroundColor: activeJourneyCardBackground,
                    borderColor: activeJourneyAccentSoft,
                  },
                ]}
              >
                <View className="relative h-[118px]">
                  <Image
                    source={currentJourney.coverUri}
                    contentFit="cover"
                    transition={220}
                    cachePolicy="memory-disk"
                    style={{ height: "100%", width: "100%" }}
                  />

                  <LinearGradient
                    colors={[
                      "rgba(36, 28, 44, 0.14)",
                      "rgba(255, 255, 255, 0.38)",
                      "rgba(255, 255, 255, 0.98)",
                    ]}
                    locations={[0, 0.56, 1]}
                    start={{ x: 0.5, y: 0 }}
                    end={{ x: 0.5, y: 1 }}
                    className="absolute inset-0"
                  />

                  <View className="absolute inset-x-3 top-3 flex-row items-center justify-between gap-2">
                    <View className="flex-row items-center rounded-full bg-white/96 px-2.5 py-1.5">
                      <View
                        className="mr-1.5 h-2 w-2 rounded-full"
                        style={{ backgroundColor: activeJourneyAccentWarm }}
                      />
                      <Text className="text-[11px] font-extrabold uppercase tracking-[0.5px] text-[#453D4A]">
                        Đang thực hiện
                      </Text>
                    </View>

                    {currentJourney.rewardLabel ? (
                      <View className="flex-row items-center rounded-full bg-[#F58752] px-2.5 py-1.5">
                        <SymbolView
                          name={{
                            ios: "sparkles",
                            android: "auto_awesome",
                            web: "auto_awesome",
                          }}
                          size={12}
                          tintColor="#FFFFFF"
                        />
                        <Text className="ml-1 text-[11px] font-extrabold text-white">
                          {currentJourney.rewardLabel}
                        </Text>
                      </View>
                    ) : null}
                  </View>
                </View>

                <View className="-mt-9 gap-4 px-4 pb-4">
                  <View className="flex-row items-center gap-3">
                    <View className="shrink-0 rounded-full bg-white p-1.5">
                      <JourneyProgressRing progress={activeJourneyProgress} />
                    </View>

                    <View className="flex-1 gap-1.5 pt-4">
                      <Text
                        className="text-[16px] font-extrabold text-[#2B2233]"
                        numberOfLines={2}
                      >
                        {currentJourney.title}
                      </Text>

                      <View className="flex-row items-center gap-1">
                        <SymbolView
                          name={{
                            ios: "mappin.and.ellipse",
                            android: "place",
                            web: "place",
                          }}
                          size={13}
                          tintColor="#8E869A"
                        />
                        <Text
                          className="flex-1 text-[13px] text-[#6F657A]"
                          numberOfLines={1}
                        >
                          {currentJourney.nextStopName
                            ? `Tiếp theo: ${currentJourney.nextStopName}${
                                currentJourney.distanceToNextLabel
                                  ? ` · ${currentJourney.distanceToNextLabel}`
                                  : ""
                              }`
                            : `${currentJourney.currentCheckpoint}/${currentJourney.totalCheckpoints} điểm dừng đã check-in`}
                        </Text>
                      </View>

                      <View className="mt-1 flex-row items-center">
                        {Array.from({
                          length: currentJourney.totalCheckpoints,
                        }).map((_, index) => {
                          const isPast =
                            index < currentJourney.currentCheckpoint;
                          const isCurrent =
                            index === currentJourney.currentCheckpoint;

                          return (
                            <View
                              key={index}
                              className="flex-1 flex-row items-center"
                            >
                              <View
                                className={`h-3.5 w-3.5 rounded-full border-2 ${
                                  isPast
                                    ? "bg-white"
                                    : isCurrent
                                      ? "bg-white"
                                      : "border-[#E5DCE2] bg-white"
                                }`}
                                style={
                                  isPast || isCurrent
                                    ? { borderColor: activeJourneyAccent }
                                    : undefined
                                }
                              />
                              {index < currentJourney.totalCheckpoints - 1 ? (
                                <View
                                  className={`h-[3px] flex-1 rounded-full ${
                                    index < currentJourney.currentCheckpoint
                                      ? ""
                                      : "bg-[#E5DCE2]"
                                  }`}
                                  style={
                                    index < currentJourney.currentCheckpoint
                                      ? { backgroundColor: activeJourneyAccent }
                                      : undefined
                                  }
                                />
                              ) : null}
                            </View>
                          );
                        })}
                      </View>

                      <Text className="text-[12px] font-medium text-[#8E869A]">
                        {currentJourney.remainingTimeLabel
                          ? `${currentJourney.remainingStopsLabel} · ${currentJourney.remainingTimeLabel}`
                          : currentJourney.remainingStopsLabel}
                      </Text>
                    </View>
                  </View>

                  <Pressable
                    className="overflow-hidden rounded-[18px]"
                    onPress={() => {
                      handleOpenRouteDetail(currentJourney.routeId);
                    }}
                  >
                    <LinearGradient
                      colors={gradientColors}
                      start={{ x: 0, y: 0.5 }}
                      end={{ x: 1, y: 0.5 }}
                      locations={[0, 0.58, 1]}
                      className="flex-row items-center justify-center px-5 py-4"
                    >
                      <SymbolView
                        name={{
                          ios: "play.fill",
                          android: "play_arrow",
                          web: "play_arrow",
                        }}
                        size={14}
                        tintColor="#FFFFFF"
                      />
                      <Text className="ml-2 text-[15px] font-extrabold text-white">
                        Tiếp tục khám phá
                      </Text>
                    </LinearGradient>
                  </Pressable>
                </View>
              </View>
            </View>
          ) : null}

          <View className="gap-4">
            <View className="flex-row items-center justify-between gap-3">
              <Pressable
                className="flex-1"
                hitSlop={8}
                onPress={handleOpenHotspots}
              >
                <Text className="text-[18px] font-extrabold text-[#2B2233]">
                  Địa điểm gần bạn
                </Text>
              </Pressable>
              <Pressable
                className="rounded-full border border-[#F3D9E5] bg-white px-3 py-1.5"
                onPress={handleOpenHotspots}
              >
                <Text className="text-[12px] font-bold text-[#D85B86]">
                  Xem tất cả
                </Text>
              </Pressable>
            </View>

            {nearbyPlacesStatus !== "empty" && nearbyPlacesNote ? (
              <Text className="text-[13px] leading-5 text-[#8E869A]">
                {nearbyPlacesNote}
              </Text>
            ) : null}

            {nearbyPlacesStatus === "loading" ? (
              <SectionEmptyState
                description={`Đang lấy vị trí hiện tại trong bán kính ${formatDistanceMeters(nearbySearchDistanceMeters)}.`}
                title="Đang tải địa điểm gần bạn..."
              />
            ) : nearbyPlacesStatus === "empty" ? (
              <SectionEmptyState
                description={nearbyPlacesNote ?? "Không có dữ liệu phù hợp."}
                title="Chưa có địa điểm phù hợp"
              />
            ) : (
              <View
                style={{
                  marginHorizontal: -gutter,
                  width: safeWidth,
                }}
              >
                <View
                  className="bg-[#FFF0F6]"
                  style={{
                    minHeight: nearbyPlacesSectionHeight,
                    paddingVertical: nearbyPlacesSectionTopInset,
                  }}
                >
                  <View
                    pointerEvents="none"
                    style={{
                      left: gutter,
                      position: "absolute",
                      top: nearbyPlacesSectionTopInset,
                    }}
                  >
                    <NearbyPlacesShowcaseCard
                      cardHeight={nearbyPlacesShowcaseHeight}
                      cardWidth={nearbyPlacesShowcaseWidth}
                      imageHeight={nearbyPlacesShowcaseImageHeight}
                    />
                  </View>

                  <ScrollView
                    horizontal
                    contentContainerStyle={{
                      paddingBottom: 6,
                      paddingLeft: nearbyPlacesScrollStartInset,
                      paddingRight: gutter,
                      paddingTop: 6,
                    }}
                    showsHorizontalScrollIndicator={false}
                    style={{
                      width: safeWidth,
                    }}
                  >
                    {resolvedNearbyPlaces.map((place, index) => {
                      const isPlaceCheckedIn = isNearbyPlaceCheckedIn(
                        place,
                        checkedInApiHotspotIds,
                        checkedInHotspotSlugs,
                      );

                      return (
                        <Pressable
                          key={place.key}
                          disabled={!place.slug && place.hotspotId === null}
                          onPress={() => {
                            const hotspotId = place.hotspotId;
                            const routeSlug =
                              place.slug ??
                              (hotspotId !== null
                                ? getApiHotspotRouteSlug(hotspotId)
                                : null);

                            if (routeSlug) {
                              router.push(getHotspotHref(routeSlug, hotspotId));
                            }
                          }}
                          style={{
                            marginRight:
                              index === resolvedNearbyPlaces.length - 1
                                ? 0
                                : 12,
                            width: nearbyPlaceCardWidth,
                          }}
                        >
                          <View
                            className="overflow-hidden rounded-[10px] border border-[#EEF1F4] bg-white"
                            style={[
                              nearbyPlaceShadowStyle,
                              { height: nearbyPlaceCardHeight },
                            ]}
                          >
                            <View className="relative">
                              <Image
                                source={place.imageUri}
                                contentFit="cover"
                                transition={220}
                                cachePolicy="memory-disk"
                                style={{
                                  height: nearbyPlaceImageHeight,
                                  width: "100%",
                                }}
                              />

                              <View className="absolute inset-x-2.5 top-2.5 flex-row items-center justify-between">
                                <View className="rounded-full bg-[#45414D]/92 px-2.5 py-1">
                                  <Text className="text-[11px] font-extrabold text-white">
                                    {place.distance}
                                  </Text>
                                </View>

                                <View
                                  className={`rounded-full px-2.5 py-1 ${
                                    isPlaceCheckedIn
                                      ? "bg-[#DCFCE7]"
                                      : "bg-[#f0af16]"
                                  }`}
                                >
                                  <Text
                                    className={`text-[11px] font-extrabold ${
                                      isPlaceCheckedIn
                                        ? "text-[#15803D]"
                                        : "text-[#2B2233]"
                                    }`}
                                  >
                                    {isPlaceCheckedIn
                                      ? "Đã check-in"
                                      : `${place.reward} XP`}
                                  </Text>
                                </View>
                              </View>
                            </View>

                            <View
                              className="flex-1 gap-0.5 px-3.5 pb-3.5 pt-3"
                              style={{ minHeight: nearbyPlaceContentHeight }}
                            >
                              <Text
                                className="text-[13px] font-extrabold leading-[16px] text-[#3B4454]"
                                numberOfLines={2}
                                style={{ minHeight: nearbyPlaceTitleHeight }}
                              >
                                {place.title}
                              </Text>

                              <View
                                className="flex-row items-center gap-1"
                                style={{ minHeight: nearbyPlaceCategoryHeight }}
                              >
                                <SymbolView
                                  name={{
                                    ios: "clock.fill",
                                    android: "schedule",
                                    web: "schedule",
                                  }}
                                  size={11}
                                  tintColor="#A39AAB"
                                />
                                <Text
                                  className="flex-1 text-[12px] text-[#A39AAB]"
                                  numberOfLines={1}
                                >
                                  {place.openingHours}
                                </Text>
                              </View>

                              <View
                                className="flex-row items-center gap-1"
                                style={{
                                  minHeight: nearbyPlaceDetailRowHeight,
                                }}
                              >
                                <SymbolView
                                  name={{
                                    ios: "star.fill",
                                    android: "star",
                                    web: "star",
                                  }}
                                  size={11}
                                  tintColor="#F58752"
                                />
                                <Text className="text-[12px] font-bold text-[#F58752]">
                                  {place.rating} ({place.reviewCountText})
                                </Text>
                              </View>

                              {isPlaceCheckedIn ? (
                                <View
                                  className="flex-row items-center gap-1.5"
                                  style={{
                                    minHeight: nearbyPlaceDetailRowHeight,
                                  }}
                                >
                                  <View className="h-5 w-5 items-center justify-center rounded-full bg-[#DCFCE7]">
                                    <SymbolView
                                      name={{
                                        ios: "checkmark",
                                        android: "check",
                                        web: "check",
                                      }}
                                      size={11}
                                      tintColor="#15803D"
                                    />
                                  </View>
                                  <Text
                                    className="flex-1 text-[12px] font-bold text-[#15803D]"
                                    numberOfLines={1}
                                  >
                                    Xem câu chuyện
                                  </Text>
                                </View>
                              ) : (
                                <View
                                  className="flex-row items-center gap-1"
                                  style={{
                                    minHeight: nearbyPlaceDetailRowHeight,
                                  }}
                                >
                                  {place.detailIcon === "star" ? (
                                    <Text className="text-[12px] text-[#F58752]">
                                      ★
                                    </Text>
                                  ) : (
                                    <SymbolView
                                      name={{
                                        ios: "location.fill",
                                        android: "place",
                                        web: "place",
                                      }}
                                      size={11}
                                      tintColor="#8E869A"
                                    />
                                  )}
                                  <Text
                                    className={
                                      place.detailIcon === "star"
                                        ? "text-[12px] font-bold text-[#F58752]"
                                        : "flex-1 text-[12px] text-[#8E869A]"
                                    }
                                    numberOfLines={1}
                                  >
                                    {place.detailPrimaryText}
                                  </Text>
                                  {place.detailSecondaryText ? (
                                    <Text
                                      className="text-[12px] text-[#8E869A]"
                                      numberOfLines={1}
                                    >
                                      {place.detailSecondaryText}
                                    </Text>
                                  ) : null}
                                </View>
                              )}
                            </View>
                          </View>
                        </Pressable>
                      );
                    })}
                  </ScrollView>
                </View>
              </View>
            )}

            <View className="flex-row items-center justify-between gap-3">
              <Text className="text-[18px] font-extrabold text-[#2B2233]">
                Chủ đề
              </Text>

              <Pressable
                className="flex-row items-center"
                hitSlop={8}
                onPress={handleOpenHotspots}
              >
                <Text className="text-[12px] font-bold text-[#D85B86]">
                  Xem tất cả
                </Text>
                <SymbolView
                  name={{
                    ios: "chevron.right",
                    android: "chevron_right",
                    web: "chevron_right",
                  }}
                  size={14}
                  tintColor="#D85B86"
                />
              </Pressable>
            </View>

            {themeCategories.length === 0 ? (
              <SectionEmptyState description="Chưa có dữ liệu chủ đề phù hợp từ API." />
            ) : (
              <ScrollView
                horizontal
                contentContainerStyle={{
                  paddingLeft: gutter,
                  paddingRight: gutter,
                }}
                showsHorizontalScrollIndicator={false}
                style={{
                  marginHorizontal: -gutter,
                  width: safeWidth,
                }}
              >
                {themeCategories.map((item, index) => (
                  <Pressable
                    key={`${item.label}-${index}`}
                    className={`items-center ${index === themeCategories.length - 1 ? "" : "mr-4"}`}
                    onPress={() => handleOpenThemeCategory(item)}
                    style={{ width: themeCategoryItemWidth }}
                  >
                    <View
                      className="items-center"
                      style={{ width: themeCategoryItemWidth }}
                    >
                      <View
                        className="items-center justify-center rounded-full border border-[#F2EDF2] bg-white"
                        style={[
                          themeCategoryShadowStyle,
                          {
                            height: themeCategoryCircleSize,
                            width: themeCategoryCircleSize,
                          },
                        ]}
                      >
                        {item.imageUrl ? (
                          <Image
                            source={item.imageUrl}
                            contentFit="contain"
                            transition={180}
                            cachePolicy="memory-disk"
                            style={{
                              height: themeCategoryImageSize,
                              width: themeCategoryImageSize,
                            }}
                          />
                        ) : (
                          <View
                            className="items-center justify-center rounded-full"
                            style={{
                              backgroundColor: item.background,
                              height: themeCategoryImageSize,
                              width: themeCategoryImageSize,
                            }}
                          >
                            <SymbolView
                              name={item.icon}
                              size={20}
                              tintColor={item.accent}
                            />
                          </View>
                        )}
                      </View>

                      <Text
                        className="mt-3 text-center text-[13px] font-semibold leading-4 text-[#2F2A35]"
                        numberOfLines={2}
                      >
                        {item.label}
                      </Text>
                    </View>
                  </Pressable>
                ))}
              </ScrollView>
            )}

            <View className="flex-row items-center justify-between">
              <Text className="text-[18px] font-extrabold text-[#2B2233]">
                Đề xuất tuyến đường
              </Text>
              {suggestedRoutes.length > 1 ? (
                <Pressable
                  className="rounded-full bg-[#FFF4EF] px-3.5 py-2"
                  onPress={handleOpenRoutes}
                >
                  <Text className="text-[12px] font-bold text-[#F58752]">
                    Xem tất cả
                  </Text>
                </Pressable>
              ) : null}
            </View>

            {suggestedRoutesStatus !== "empty" && suggestedRoutesNote ? (
              <Text className="text-[13px] leading-5 text-[#8E869A]">
                {suggestedRoutesNote}
              </Text>
            ) : null}

            {suggestedRoutesStatus === "loading" ? (
              <SectionEmptyState
                description="Đang tải dữ liệu tuyến đường theo địa điểm phù hợp."
                title="Đang tải tuyến gợi ý..."
              />
            ) : suggestedRoutesStatus === "empty" ? (
              <SectionEmptyState
                description={suggestedRoutesNote ?? "Không có dữ liệu phù hợp."}
                title="Chưa có tuyến phù hợp"
              />
            ) : (
              <ScrollView
                horizontal
                contentContainerStyle={{
                  paddingLeft: gutter,
                  paddingRight: gutter,
                }}
                showsHorizontalScrollIndicator={false}
                style={{
                  marginHorizontal: -gutter,
                  width: safeWidth,
                }}
              >
                {suggestedRoutes.map((route, index) => (
                  <Pressable
                    key={route.id || `${route.title}-${index}`}
                    className={
                      index === suggestedRoutes.length - 1 ? "" : "mr-4"
                    }
                    onPress={() => {
                      router.push(`/route/${route.id}` as Href);
                    }}
                    style={{ width: nearbyRouteCardWidth }}
                  >
                    <View
                      className="overflow-hidden border border-[#EEF1F4] bg-white"
                      style={[
                        cardShadowStyle,
                        {
                          borderRadius: 16,
                          minHeight: suggestedRouteCardHeight,
                        },
                      ]}
                    >
                      <View className="relative">
                        <Image
                          source={route.cover}
                          contentFit="cover"
                          transition={220}
                          cachePolicy="memory-disk"
                          style={{
                            height: suggestedRouteCardImageHeight,
                            width: "100%",
                          }}
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
                            style={{
                              backgroundColor: (
                                routeDifficultyStyles[route.difficulty] ??
                                routeDifficultyStyles["Trung bình"]
                              ).background,
                            }}
                          >
                            <Text
                              className="text-[10px] font-extrabold"
                              style={{
                                color: (
                                  routeDifficultyStyles[route.difficulty] ??
                                  routeDifficultyStyles["Trung bình"]
                                ).color,
                              }}
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
                          {getSuggestedRouteDescription(route)}
                        </Text>

                        <View className="flex-row flex-wrap items-center justify-end gap-1.5 pt-0.5">
                          {getSuggestedRouteTagLabel(route) ? (
                            <View className="rounded-full bg-[#F4EFF8] px-2 py-[5px]">
                              <Text className="text-[10px] font-extrabold text-[#6F657A]">
                                {getSuggestedRouteTagLabel(route)}
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
                ))}
              </ScrollView>
            )}

            <View className="gap-4">
              <View className="flex-row items-start justify-between gap-3">
                <View className="flex-1">
                  <Text className="text-[18px] font-extrabold text-[#2B2233]">
                    Voucher ưu đãi
                  </Text>
                </View>

                <Pressable className="rounded-full bg-[#FFF4EF] px-3.5 py-2" onPress={() => router.push("/vouchers")}>
                  <Text className="text-[12px] font-bold text-[#F58752]">
                    Xem tất cả
                  </Text>
                </Pressable>
              </View>

              <View
                className="gap-5 rounded-[28px] bg-white p-4"
                style={cardShadowStyle}
              >
                <View className="gap-3">
                  <ScrollView
                    horizontal
                    contentContainerStyle={{ paddingRight: 10 }}
                    showsHorizontalScrollIndicator={false}
                  >
                    {voucherMerchants.map((merchant, index) => (
                      <Pressable
                        key={merchant.label}
                        className={
                          index === voucherMerchants.length - 1 ? "" : "mr-3.5"
                        }
                        style={{ width: voucherMerchantItemWidth }}
                      >
                        <View className="items-center">
                          <View
                            className="items-center justify-center"
                            style={{
                              height: voucherMerchantCircleSize,
                              width: voucherMerchantCircleSize,
                            }}
                          >
                            <Image
                              source={merchant.logoUri}
                              contentFit="contain"
                              transition={180}
                              cachePolicy="memory-disk"
                              style={{
                                height:
                                  voucherMerchantLogoSize * merchant.logoScale,
                                width:
                                  voucherMerchantLogoSize * merchant.logoScale,
                              }}
                            />
                          </View>

                          <Text
                            className="mt-2 text-center text-[13px] font-extrabold leading-4 text-[#2B2233]"
                            numberOfLines={2}
                          >
                            {merchant.label}
                          </Text>
                        </View>
                      </Pressable>
                    ))}
                  </ScrollView>
                </View>
              </View>
            </View>
          </View>
          <View className="gap-4">
            <View>
              <View className="flex-row items-start justify-between">
                <View className="min-w-0 flex-1 flex-row items-center gap-3">
                  <View className="h-11 w-11 items-center justify-center rounded-[16px] bg-[#FFF1D6]">
                    <SymbolView
                      name={{
                        ios: "trophy.fill",
                        android: "emoji_events",
                        web: "emoji_events",
                      }}
                      size={22}
                      tintColor="#E8A317"
                    />
                  </View>
                  <View className="min-w-0 flex-1">
                    <Text className="text-[17px] font-extrabold leading-[23px] text-[#2B2233]">
                      Cộng đồng hôm nay
                    </Text>
                  </View>
                </View>

                <Pressable
                  className="ml-2 flex-row items-center pt-1"
                  hitSlop={8}
                  onPress={handleOpenCommunityLeaderboard}
                >
                  <Text className="text-[13px] font-bold uppercase tracking-[0.3px] text-[#FF5F87]">
                    BXH
                  </Text>
                  <SymbolView
                    name={{
                      ios: "chevron.right",
                      android: "chevron_right",
                      web: "chevron_right",
                    }}
                    size={14}
                    tintColor="#FF5F87"
                  />
                </Pressable>
              </View>

              <View className="mt-4 gap-3">
                {/* LeaderRankingCard tự chứa padding 16px hai bên nên bù lại
                    bằng margin âm để thẳng hàng với các mục khác của trang */}
                <View style={{ marginHorizontal: -16 }}>
                  <LeaderRankingCard
                    description={activeCommunityBoard.summaryNote}
                    title={activeCommunityBoard.summaryLabel}
                    xp={activeCommunityBoard.summaryXp}
                  />
                </View>

                <View className="gap-2.5">
                  {activeCommunityBoard.entries.length > 0 ? (
                    activeCommunityBoard.entries.map((entry) => {
                      const isChampion = entry.rank === 1;
                      const badgeColor = getCommunityLeaderboardBadgeColor(
                        entry.rank,
                      );

                      return (
                        <View
                          key={`community-${entry.userId ?? entry.name}-${entry.rank}`}
                          className="flex-row items-center rounded-[18px] px-3 py-2.5"
                          style={[
                            communityRowShadowStyle,
                            {
                              backgroundColor: isChampion
                                ? "#FFF9EC"
                                : entry.isCurrentUser
                                  ? "#FFF7FA"
                                  : "#FFFFFF",
                              borderColor: isChampion
                                ? "#F4D493"
                                : entry.isCurrentUser
                                  ? "#F8D8E3"
                                  : "#EEF1F4",
                              borderWidth: 1,
                            },
                          ]}
                        >
                          <View className="mr-2.5 w-7 items-center justify-center">
                            {isChampion ? (
                              <View className="absolute -top-3">
                                <SymbolView
                                  name={{
                                    ios: "crown.fill",
                                    android: "workspace_premium",
                                    web: "workspace_premium",
                                  }}
                                  size={14}
                                  tintColor="#F7B500"
                                />
                              </View>
                            ) : null}

                            {entry.rank === 2 || entry.rank === 3 ? (
                              <View className="absolute -bottom-1 flex-row gap-[3px]">
                                <View
                                  style={{
                                    backgroundColor: badgeColor,
                                    borderBottomLeftRadius: 2,
                                    borderBottomRightRadius: 2,
                                    height: 10,
                                    transform: [{ rotate: "10deg" }],
                                    width: 5,
                                  }}
                                />
                                <View
                                  style={{
                                    backgroundColor: badgeColor,
                                    borderBottomLeftRadius: 2,
                                    borderBottomRightRadius: 2,
                                    height: 10,
                                    transform: [{ rotate: "-10deg" }],
                                    width: 5,
                                  }}
                                />
                              </View>
                            ) : null}

                            <View
                              className="h-6 w-6 items-center justify-center rounded-full"
                              style={{
                                backgroundColor: isTopCommunityLeaderboardRank(
                                  entry.rank,
                                )
                                  ? badgeColor
                                  : "#EEF2F7",
                                borderColor: "#FFFFFF",
                                borderWidth: 2,
                              }}
                            >
                              <Text
                                className="text-[11px] font-medium leading-[13px]"
                                style={{
                                  color: getCommunityLeaderboardBadgeTextColor(
                                    entry.rank,
                                  ),
                                }}
                              >
                                {entry.rank}
                              </Text>
                            </View>
                          </View>

                          <View className="mr-2.5 h-10 w-10 items-center justify-center">
                            <UserAvatar
                              borderColor={getCommunityLeaderboardRingColor(
                                entry.rank,
                              )}
                              borderWidth={
                                isTopCommunityLeaderboardRank(entry.rank)
                                  ? 2
                                  : 1.5
                              }
                              containerStyle={{
                                backgroundColor: "#FFFFFF",
                              }}
                              displayName={entry.name}
                              size={38}
                              textSize={12}
                              uri={entry.avatarUri}
                            />
                          </View>

                          <View className="flex-1 pr-2">
                            <Text
                              className="text-[12px] font-medium leading-[14px] text-[#2B2233]"
                              numberOfLines={1}
                            >
                              {entry.name}
                            </Text>
                            <Text
                              className="text-[10px] font-normal leading-[12px] text-[#9A93A5]"
                              numberOfLines={1}
                            >
                              {entry.subtitle}
                            </Text>
                          </View>

                          <View className="flex-row items-center rounded-full bg-[#FFF0F5] px-2.5 py-1.5">
                            <SymbolView
                              name={{
                                ios: "star.fill",
                                android: "star",
                                web: "star",
                              }}
                              size={10}
                              tintColor="#FF5F87"
                            />
                            <Text className="ml-1 text-[10px] font-medium leading-[13px] text-[#2B2233]">
                              {entry.points}
                            </Text>
                          </View>
                        </View>
                      );
                    })
                  ) : (
                    <View className="items-center rounded-[24px] border border-[#F3E7ED] bg-[#FFF8FB] px-4 py-5">
                      {communityLeaderboardStatus === "loading" ? (
                        <ActivityIndicator color="#FF5F87" />
                      ) : null}
                      <Text className="mt-3 text-center text-[12px] font-semibold text-[#1F2940]">
                        {activeCommunityBoard.summaryLabel}
                      </Text>
                      <Text className="mt-1 text-center text-[10px] leading-[15px] text-[#8F8290]">
                        {activeCommunityBoard.summaryNote}
                      </Text>
                    </View>
                  )}
                </View>
              </View>
            </View>

            <Pressable
              className="rounded-[20px] border border-[#F3E7ED] bg-white px-4 py-3"
              onPress={handleOpenCommunityLeaderboard}
              style={communityRowShadowStyle}
            >
              <View className="flex-row items-center justify-center">
                <SymbolView
                  name={{
                    ios: "list.number",
                    android: "leaderboard",
                    web: "leaderboard",
                  }}
                  size={13}
                  tintColor="#FF5F87"
                />
                <Text className="ml-1.5 text-[11px] font-semibold text-[#FF5F87]">
                  Xem bảng xếp hạng đầy đủ
                </Text>
              </View>
            </Pressable>
          </View>
        </View>
      </ScrollView>

      <LocationMapModal
        key={`location-map-${isLocationMapVisible ? "open" : "closed"}`}
        coordinate={locationMapCoordinate}
        errorMessage={locationMapErrorMessage}
        isLocationLoading={isLocationMapLoading}
        onClose={handleCloseLocationMap}
        onOpenSettings={handleOpenLocationSettings}
        onRetry={() => {
          void handleOpenLocationMap();
        }}
        visible={isLocationMapVisible}
      />
    </SafeAreaView>
  );
}
