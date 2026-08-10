import { AppLoadingScreen } from "@/components/ui/app-loading-screen";
import { SymbolView } from "@/components/ui/symbol-view";
import { UserAvatar } from "@/components/ui/user-avatar";
import { Image } from "expo-image";
import { LinearGradient } from "expo-linear-gradient";
import * as Location from "expo-location";
import { type Href, useFocusEffect, useRouter } from "expo-router";
import { useCallback, useEffect, useRef, useState } from "react";
import {
  Platform,
  Pressable,
  StatusBar as RNStatusBar,
  RefreshControl,
  ScrollView,
  Text,
  View,
} from "react-native";
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
import { type RouteItem } from "@/lib/demo-data";
import {
  type AppCoordinate,
  ensureForegroundLocationPermission,
  formatCoordinateLabel,
  getDevelopmentLocationOverride,
  getDeviceCoordinate,
} from "@/lib/location";

import {
  type NearbyHotspotDto,
  getNearbyHotspots,
} from "../api/get-nearby-hotspots";
import { getActiveTags } from "../api/get-tags";
import {
  type UserLeaderboardEntryDto,
  getUserLeaderboard,
} from "../api/get-user-leaderboard";
import { LeaderRankingCard } from "../components/leader-ranking-card";
import {
  type NearbyCategoryCard,
  activeJourney,
  featuredRoutes,
  voucherMerchants,
} from "../data/home-screen.mock";
import { getApiHotspotRouteSlug, getHotspotHref } from "../data/hotspots";
import { mapActiveTagsToThemeCategories } from "../lib/theme-categories";
import { getThemeDetailHref } from "../lib/theme-detail";
import { bodyLineHeightFor, lineHeightFor } from "@/lib/text-scale";

const gradientColors = ["#EB489B", "#F58752", "#FFC93C"] as const;
const guestPreviewLogo = require("../../../../assets/images/logo3.png");
const nearbyShowcaseMascot = require("../../../../assets/images/hotspot_nearby.png");
const continueJourneyEmptyIllustration = require("../../../../assets/images/continnueroute.png");

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
    readStopCoordinate(nextStopProgress) ??
    readStopCoordinate(nextRouteHotspot);
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
      remainingMinutes > 0
        ? `${formatRouteDurationLabel(remainingMinutes)} nữa`
        : null,
    routeId: progress.routeId,
    title:
      readMeaningfulNearbyText(route?.routeName) ??
      `Tuyến #${progress.routeId}`,
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

      <View className="h-[60px] w-[60px] items-center justify-center rounded-full bg-white px-1">
        <Text className="text-[16px] font-black leading-4 text-[#2B2233]">
          {boundedProgress}%
        </Text>
        <Text className="text-[8px] font-semibold leading-3 text-[#6F657A]">
          Hoàn thành
        </Text>
      </View>
    </View>
  );
}

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

const homeSectionTitleClassName =
  "text-[17px] font-extrabold leading-[22px] text-[#2B2233]";
const homeSectionActionTextClassName = "text-[12px] font-bold text-[#D85B86]";

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
type InitialHomeLoadPart =
  | "activeJourney"
  | "communityLeaderboard"
  | "explorerSummary"
  | "featuredRoutes"
  | "nearbyPlaces"
  | "suggestedRoutes"
  | "themeCategories";
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

const defaultNearbySearchDistanceMeters = 10000;
const suggestedRouteCardImageHeight = 136;
const suggestedRouteCardHeight = 248;
const nearbyPlaceTitleHeight = 22;
const nearbyPlaceCategoryHeight = 16;
const nearbyPlaceDetailRowHeight = 18;
const nearbyPlaceContentHeight = 132;
const communityLeaderboardLoadingHeight = 420;
const nearbyPlaceFallbackImageUri =
  "https://images.unsplash.com/photo-1500530855697-b586d89ba3ee";
const nearbyPlaceFallbackRating = "4.9";

function clamp(value: number, min: number, max: number) {
  return Math.min(Math.max(value, min), max);
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

function isNearbyPlaceCheckedIn(place: NearbyPlaceListItem) {
  return place.isCheckedIn;
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
  if (isLoading) {
    return (
      <AppLoadingScreen mode="embedded" style={{ minHeight: 92 }} />
    );
  }

  return (
    <View className="rounded-[22px] border border-[#EEF1F4] bg-[#FAF7FC] px-4 py-4">
      <>
        <Text className="text-[15px] font-bold text-[#3B4454]">{title}</Text>
        <Text className="mt-1 text-[13px] leading-5 text-[#8E869A]">
          {description}
        </Text>
      </>
    </View>
  );
}

function ActiveJourneyEmptyStateCard({
  illustrationWidth,
  onPress,
}: {
  illustrationWidth: number;
  onPress: () => void;
}) {
  return (
    <View
      className="overflow-hidden rounded-[22px] bg-white px-4 py-4"
      style={cardShadowStyle}
    >
      <View className="flex-row items-center gap-3">
        <View
          className="shrink-0"
          style={{
            height: illustrationWidth,
            width: illustrationWidth,
          }}
        >
          <Image
            source={continueJourneyEmptyIllustration}
            contentFit="contain"
            transition={220}
            cachePolicy="memory-disk"
            style={{ height: "100%", width: "100%" }}
          />
        </View>

        <View className="min-w-0 flex-1 items-center">
          <Text
            className="text-center text-[12px] text-[#7C7281]"
            style={{ lineHeight: bodyLineHeightFor(12) }}
          >
            Bạn chưa tham gia tuyến nào. Hãy khám phá và bắt đầu hành trình đầu
            tiên của bạn nhé!
          </Text>

          <Pressable
            className="mt-3 overflow-hidden rounded-[12px]"
            onPress={onPress}
          >
            <LinearGradient
              colors={["#F07AA8", "#EB489B"]}
              start={{ x: 0, y: 0.5 }}
              end={{ x: 1, y: 0.5 }}
              className="px-4 py-2.5"
            >
              <Text className="text-[12px] font-extrabold text-white">
                Khám phá tuyến
              </Text>
            </LinearGradient>
          </Pressable>
        </View>
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
  onSearchPress,
}: {
  onGreetingPress: () => void;
  onSearchPress: () => void;
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
  onSearchPress,
  onNotificationPress,
}: {
  onSearchPress: () => void;
  onNotificationPress: () => void;
}) {
  return (
    <View className="flex-row items-center gap-2.5">
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

export default function HomeScreen() {
  const router = useRouter();
  const authSession = useAuthSession();
  const { contentWidth, gutter, insets, safeWidth } = useScreenLayout({
    maxContentWidth: 640,
  });
  const homeContentBottomPadding = Math.max(insets.bottom + 72, 96);
  const activeRouteIndexRef = useRef(0);
  const [activeRouteIndex, setActiveRouteIndex] = useState(0);
  const [explorerSummary, setExplorerSummary] =
    useState<ExplorerSummary | null>(null);
  const [nearbyPlacesNote, setNearbyPlacesNote] = useState<string | null>(null);
  const [nearbyPlacesStatus, setNearbyPlacesStatus] =
    useState<NearbyPlacesSectionStatus>("loading");
  const nearbySearchDistanceMeters = defaultNearbySearchDistanceMeters;
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
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [hasCompletedInitialHomeLoad, setHasCompletedInitialHomeLoad] =
    useState(false);
  const nearbyPlacesRequestRef = useRef(0);
  const themeCategoriesRequestRef = useRef(0);
  const communityLeaderboardRequestRef = useRef(0);
  const explorerSummaryRequestRef = useRef(0);
  const initialHomeLoadPendingRef = useRef<
    Record<InitialHomeLoadPart, boolean>
  >({
    activeJourney: authSession.isAuthenticated,
    communityLeaderboard: true,
    explorerSummary: authSession.isAuthenticated,
    featuredRoutes: true,
    nearbyPlaces: true,
    suggestedRoutes: true,
    themeCategories: true,
  });

  const markInitialHomeLoadPartResolved = useCallback(
    (part: InitialHomeLoadPart) => {
      const pending = initialHomeLoadPendingRef.current;

      if (!pending[part]) {
        return;
      }

      pending[part] = false;

      if (
        !hasCompletedInitialHomeLoad &&
        !Object.values(pending).some(Boolean)
      ) {
        setHasCompletedInitialHomeLoad(true);
      }
    },
    [hasCompletedInitialHomeLoad],
  );

  const isGuest = authSession.role === "guest";
  const shouldShowInitialHomeLoading = !hasCompletedInitialHomeLoad;
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
  const activeJourneyEmptyIllustrationWidth = Math.min(
    Math.max(contentWidth * 0.38, 134),
    152,
  );
  const currentJourney = !isGuest ? activeJourneyView : null;
  const activeJourneyProgress = currentJourney
    ? Math.min(Math.max(currentJourney.progress, 0), 100)
    : 0;
  const isActiveJourneyLoading =
    !isGuest && activeJourneyStatus === "loading" && !activeJourneyView;
  const isCommunityLeaderboardLoading =
    communityLeaderboardStatus === "loading";
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
  const handleOpenAllThemes = () => {
    router.push("/theme" as Href);
  };
  const handleOpenNearbyHotspots = () => {
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
        markInitialHomeLoadPartResolved("featuredRoutes");
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
        markInitialHomeLoadPartResolved("featuredRoutes");
      }
    }

    void loadFeaturedRoutes();

    return () => {
      isActive = false;
    };
  }, [
    authSession.isAuthenticated,
    authSession.tokenType,
    markInitialHomeLoadPartResolved,
  ]);

  useFocusEffect(
    useCallback(() => {
      let isActive = true;

      async function loadActiveJourney() {
        if (!authSession.isAuthenticated) {
          setActiveJourneyView(null);
          setActiveJourneyStatus("empty");
          markInitialHomeLoadPartResolved("activeJourney");
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
            markInitialHomeLoadPartResolved("activeJourney");
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
            markInitialHomeLoadPartResolved("activeJourney");
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
          markInitialHomeLoadPartResolved("activeJourney");
        } catch (error) {
          console.warn("[home] load active journey failed", {
            error: error instanceof Error ? error.message : error,
          });

          if (!isActive) {
            return;
          }

          setActiveJourneyView(null);
          setActiveJourneyStatus("empty");
          markInitialHomeLoadPartResolved("activeJourney");
        }
      }

      void loadActiveJourney();

      return () => {
        isActive = false;
      };
    }, [
      authSession.isAuthenticated,
      authSession.tokenType,
      markInitialHomeLoadPartResolved,
    ]),
  );

  const loadNearbyPlaces = useCallback(async () => {
    const requestId = nearbyPlacesRequestRef.current + 1;
    nearbyPlacesRequestRef.current = requestId;
    const isActive = () => nearbyPlacesRequestRef.current === requestId;

    setNearbyPlacesStatus("loading");
    setNearbyPlacesNote(null);
    setSuggestedRoutesStatus("loading");
    setSuggestedRoutesNote(null);

    try {
      const { coordinate, fallbackMessage } =
        await resolveNearbyRequestCoordinate();

      if (!isActive()) {
        return;
      }

      if (!coordinate) {
        setResolvedNearbyPlaces([]);
        setNearbyPlacesNote(fallbackMessage);
        setNearbyPlacesStatus("empty");
        markInitialHomeLoadPartResolved("nearbyPlaces");
        setSuggestedRoutes([]);
        setSuggestedRoutesNote(
          "Không xác định được vị trí hiện tại nên chưa thể gợi ý tuyến đường phù hợp.",
        );
        setSuggestedRoutesStatus("empty");
        markInitialHomeLoadPartResolved("suggestedRoutes");
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

      if (!isActive()) {
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
        markInitialHomeLoadPartResolved("nearbyPlaces");
        setSuggestedRoutes([]);
        setSuggestedRoutesNote("Không có dữ liệu tuyến đường phù hợp gần bạn.");
        setSuggestedRoutesStatus("empty");
        markInitialHomeLoadPartResolved("suggestedRoutes");
        return;
      }

      setResolvedNearbyPlaces(
        buildApiNearbyPlaceItems(apiNearbyHotspots, coordinate),
      );
      setNearbyPlacesNote(
        coordinate.source === "dev-override"
          ? `Đang hiển thị địa điểm trong bán kính ${formatDistanceMeters(nearbySearchDistanceMeters)} quanh tọa độ test ${formatCoordinateLabel(coordinate)}.`
          : null,
      );
      setNearbyPlacesStatus("ready");
      markInitialHomeLoadPartResolved("nearbyPlaces");

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

        if (!isActive()) {
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
          markInitialHomeLoadPartResolved("suggestedRoutes");
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
        markInitialHomeLoadPartResolved("suggestedRoutes");
      } catch (routeError) {
        console.warn("[home] load suggested routes failed", {
          error: routeError instanceof Error ? routeError.message : routeError,
          hotspotIds: nearbyHotspotsByDistance.map(
            (hotspot) => hotspot.hotspotId,
          ),
        });

        if (!isActive()) {
          return;
        }

        setSuggestedRoutes([]);
        setSuggestedRoutesNote(
          routeError instanceof Error
            ? routeError.message
            : "Không có dữ liệu tuyến đường phù hợp.",
        );
        setSuggestedRoutesStatus("empty");
        markInitialHomeLoadPartResolved("suggestedRoutes");
      }
    } catch (error) {
      console.warn("[home] load nearby places failed", {
        error: error instanceof Error ? error.message : error,
      });

      if (!isActive()) {
        return;
      }

      setResolvedNearbyPlaces([]);
      setNearbyPlacesNote(
        error instanceof Error
          ? error.message
          : "Không có dữ liệu địa điểm phù hợp.",
      );
      setNearbyPlacesStatus("empty");
      markInitialHomeLoadPartResolved("nearbyPlaces");
      setSuggestedRoutes([]);
      setSuggestedRoutesNote("Không có dữ liệu tuyến đường phù hợp.");
      setSuggestedRoutesStatus("empty");
      markInitialHomeLoadPartResolved("suggestedRoutes");
    }
  }, [
    authSession.isAuthenticated,
    markInitialHomeLoadPartResolved,
    authSession.tokenType,
    nearbySearchDistanceMeters,
  ]);

  useEffect(() => {
    async function runNearbyPlacesLoad() {
      await loadNearbyPlaces();
    }

    void runNearbyPlacesLoad();
  }, [loadNearbyPlaces]);

  const loadThemeCategories = useCallback(async () => {
    const requestId = themeCategoriesRequestRef.current + 1;
    themeCategoriesRequestRef.current = requestId;
    const isActive = () => themeCategoriesRequestRef.current === requestId;

    try {
      const accessToken = authSession.isAuthenticated
        ? await getValidAccessToken()
        : null;

      if (!isActive()) {
        return;
      }

      const tags = await getActiveTags({
        accessToken,
        tokenType: authSession.tokenType,
      });

      if (!isActive()) {
        return;
      }

      setThemeCategories(mapActiveTagsToThemeCategories(tags));
      markInitialHomeLoadPartResolved("themeCategories");
    } catch (error) {
      console.warn("[home] load theme categories failed", {
        error: error instanceof Error ? error.message : error,
      });

      if (!isActive()) {
        return;
      }

      setThemeCategories([]);
      markInitialHomeLoadPartResolved("themeCategories");
    }
  }, [
    authSession.isAuthenticated,
    authSession.tokenType,
    markInitialHomeLoadPartResolved,
  ]);

  useEffect(() => {
    async function runThemeCategoriesLoad() {
      await loadThemeCategories();
    }

    void runThemeCategoriesLoad();
  }, [loadThemeCategories]);

  const loadCommunityLeaderboard = useCallback(async () => {
    const requestId = communityLeaderboardRequestRef.current + 1;
    communityLeaderboardRequestRef.current = requestId;
    const isActive = () => communityLeaderboardRequestRef.current === requestId;

    setCommunityLeaderboardStatus("loading");
    setCommunityLeaderboardErrorMessage(null);

    try {
      const accessToken = authSession.isAuthenticated
        ? await getValidAccessToken()
        : null;

      if (!isActive()) {
        return;
      }

      const leaderboardResponse = await getUserLeaderboard({
        accessToken,
        tokenType: authSession.tokenType,
      });

      if (!isActive()) {
        return;
      }

      setCommunityLeaderboardEntries(leaderboardResponse.content);
      setCommunityLeaderboardStatus(
        leaderboardResponse.content.length > 0 ? "ready" : "empty",
      );
      markInitialHomeLoadPartResolved("communityLeaderboard");
    } catch (error) {
      console.warn("[home] load community leaderboard failed", {
        error: error instanceof Error ? error.message : error,
      });

      if (!isActive()) {
        return;
      }

      setCommunityLeaderboardEntries([]);
      setCommunityLeaderboardErrorMessage(
        error instanceof Error
          ? error.message
          : "Không tải được bảng xếp hạng cộng đồng.",
      );
      setCommunityLeaderboardStatus("error");
      markInitialHomeLoadPartResolved("communityLeaderboard");
    }
  }, [
    authSession.isAuthenticated,
    authSession.tokenType,
    markInitialHomeLoadPartResolved,
  ]);

  useEffect(() => {
    async function runCommunityLeaderboardLoad() {
      await loadCommunityLeaderboard();
    }

    void runCommunityLeaderboardLoad();
  }, [loadCommunityLeaderboard]);

  const loadExplorerSummary = useCallback(async () => {
    const requestId = explorerSummaryRequestRef.current + 1;
    explorerSummaryRequestRef.current = requestId;
    const isActive = () => explorerSummaryRequestRef.current === requestId;

    if (!authSession.isAuthenticated) {
      setExplorerSummary(null);
      markInitialHomeLoadPartResolved("explorerSummary");
      return;
    }

    try {
      const accessToken = await getValidAccessToken();

      if (!isActive()) {
        return;
      }

      if (!accessToken) {
        setExplorerSummary(null);
        markInitialHomeLoadPartResolved("explorerSummary");
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
          ? applyLevelProgressToProfile(profileResult.value, levelsResult.value)
          : profileResult.value;

      if (!isActive()) {
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

      const resolvedName =
        profile.name.trim() ||
        authSession.displayName.trim() ||
        profile.username.trim() ||
        authSession.username?.trim() ||
        "Ngọc";

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
      markInitialHomeLoadPartResolved("explorerSummary");
    } catch (error) {
      if (!isActive()) {
        return;
      }

      setExplorerSummary(null);
      markInitialHomeLoadPartResolved("explorerSummary");
      console.warn("[home] load explorer summary failed", {
        error: error instanceof Error ? error.message : error,
      });
    }
  }, [
    authSession.displayName,
    authSession.isAuthenticated,
    authSession.tokenType,
    authSession.username,
    markInitialHomeLoadPartResolved,
  ]);

  useFocusEffect(
    useCallback(() => {
      void loadExplorerSummary();
    }, [loadExplorerSummary]),
  );

  const handleRefreshHome = useCallback(async () => {
    setIsRefreshing(true);

    try {
      await Promise.allSettled([
        loadExplorerSummary(),
        loadNearbyPlaces(),
        loadThemeCategories(),
        loadCommunityLeaderboard(),
      ]);
    } finally {
      setIsRefreshing(false);
    }
  }, [
    loadCommunityLeaderboard,
    loadExplorerSummary,
    loadNearbyPlaces,
    loadThemeCategories,
  ]);

  if (shouldShowInitialHomeLoading) {
    return <AppLoadingScreen />;
  }

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
        contentContainerStyle={{ paddingBottom: homeContentBottomPadding }}
        refreshControl={
          <RefreshControl
            colors={["#EB489B", "#F58752", "#FFC93C"]}
            onRefresh={() => {
              void handleRefreshHome();
            }}
            progressBackgroundColor="#FFFFFF"
            refreshing={isRefreshing}
            tintColor="#EB489B"
            title="Đang cập nhật..."
            titleColor="#8E869A"
          />
        }
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
              onSearchPress={handleOpenNearbyHotspots}
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
                  <View className="gap-0 pt-1">
                    <Text
                      className="text-[15px] font-semibold tracking-[-0.3px] text-[#2B2233]"
                      style={{ lineHeight: lineHeightFor(15) }}
                    >
                      {`Chào ${explorerName}`}
                    </Text>
                    <Text
                      className="text-[11px] text-[#8E869A]"
                      style={{ lineHeight: lineHeightFor(11), marginTop: -1 }}
                    >
                      Sẵn sàng khám phá
                    </Text>
                  </View>
                </View>
              </View>

              <ExplorerHeaderActions
                onSearchPress={handleOpenNearbyHotspots}
                onNotificationPress={handleOpenNotifications}
              />
            </View>
          )}

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
                    AI Lập kế hoạch, Ghi hành trình Live & Audio Guide đã sẵn
                    sàng ở trang Khám phá
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
                    Trải nghiệm bộ tính năng Premium (User Plan & Record) tại
                    trang Khám phá
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
              <SectionEmptyState isLoading />
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
                    className="overflow-hidden rounded-[28px] bg-[#20182B]"
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
                      style={{ height: 224, width: "100%" }}
                    />

                    <View className="absolute inset-0 px-3.5 py-3.5">
                      <View className="mt-auto max-w-[84%]">
                        <Text
                          className="text-[18px] font-semibold text-white"
                          numberOfLines={1}
                          ellipsizeMode="tail"
                          style={{
                            lineHeight: lineHeightFor(18),
                            textShadowColor: "rgba(0, 0, 0, 0.35)",
                            textShadowOffset: { width: 0, height: 1 },
                            textShadowRadius: 4,
                          }}
                        >
                          {activeFeaturedRoute.title}
                        </Text>

                        <View className="mt-1.5 flex-row flex-wrap items-center gap-x-3 gap-y-1">
                          <View className="flex-row items-center">
                            <SymbolView
                              name={{
                                ios: "star.fill",
                                android: "star",
                                web: "star",
                              }}
                              size={12}
                              tintColor="#FFC93C"
                            />
                            <Text
                              className="ml-1 text-[12px] font-semibold text-white"
                              numberOfLines={1}
                              style={{
                                lineHeight: lineHeightFor(12),
                                textShadowColor: "rgba(0, 0, 0, 0.35)",
                                textShadowOffset: { width: 0, height: 1 },
                                textShadowRadius: 4,
                              }}
                            >
                              {activeFeaturedRoute.xpLabel ??
                                "Đang cập nhật XP"}
                            </Text>
                          </View>

                          <View className="flex-row items-center">
                            <SymbolView
                              name={{
                                ios: "mappin.and.ellipse",
                                android: "place",
                                web: "place",
                              }}
                              size={12}
                              tintColor="#7DD3FC"
                            />
                            <Text
                              className="ml-1 text-[12px] font-semibold text-white"
                              numberOfLines={1}
                              style={{
                                lineHeight: lineHeightFor(12),
                                textShadowColor: "rgba(0, 0, 0, 0.35)",
                                textShadowOffset: { width: 0, height: 1 },
                                textShadowRadius: 4,
                              }}
                            >
                              {activeFeaturedRoute.stopsLabel}
                            </Text>
                          </View>
                        </View>
                      </View>
                    </View>
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

              <SectionEmptyState isLoading />
            </View>
          ) : activeJourneyStatus === "empty" ? (
            <View className="gap-3">
              <Text className={homeSectionTitleClassName}>
                Tiếp tục hành trình
              </Text>

              <ActiveJourneyEmptyStateCard
                illustrationWidth={activeJourneyEmptyIllustrationWidth}
                onPress={handleOpenRoutes}
              />
            </View>
          ) : currentJourney ? (
            <View className="gap-3">
              <Text className={homeSectionTitleClassName}>
                Tiếp tục hành trình
              </Text>

              <View
                className="overflow-hidden rounded-[22px] border"
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

                  <View className="absolute inset-x-3 top-3 flex-row items-center justify-end">
                    <View
                      className="flex-row items-center rounded-full px-2.5 py-1.5"
                      style={{ backgroundColor: activeJourneyAccentSoft }}
                    >
                      <View
                        className="mr-1.5 h-2 w-2 rounded-full"
                        style={{ backgroundColor: activeJourneyAccentWarm }}
                      />
                      <Text className="text-[10px] font-extrabold uppercase tracking-[0.4px] text-[#7A5167]">
                        Đang thực hiện
                      </Text>
                    </View>
                  </View>
                </View>

                <View className="-mt-9 gap-2.5 px-4 pb-4">
                  <View className="flex-row items-center gap-3">
                    <View className="shrink-0 rounded-full bg-white p-1.5">
                      <JourneyProgressRing progress={activeJourneyProgress} />
                    </View>

                    <View className="flex-1 gap-0.5 pt-4">
                      <Text
                        className="text-[15px] font-extrabold text-[#2B2233]"
                        numberOfLines={2}
                        style={{ lineHeight: lineHeightFor(15) }}
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
                          className="flex-1 text-[12px] text-[#6F657A]"
                          numberOfLines={1}
                          style={{ lineHeight: lineHeightFor(12) }}
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

                      <View className="mt-0.5 flex-row items-center">
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

                      <Text
                        className="text-[11px] font-medium text-[#8E869A]"
                        style={{ lineHeight: lineHeightFor(11) }}
                      >
                        {currentJourney.remainingTimeLabel
                          ? `${currentJourney.remainingStopsLabel} · ${currentJourney.remainingTimeLabel}`
                          : currentJourney.remainingStopsLabel}
                      </Text>
                    </View>
                  </View>

                  <Pressable
                    className="overflow-hidden rounded-[15px]"
                    onPress={() => {
                      handleOpenRouteDetail(currentJourney.routeId);
                    }}
                  >
                    <LinearGradient
                      colors={gradientColors}
                      start={{ x: 0, y: 0.5 }}
                      end={{ x: 1, y: 0.5 }}
                      locations={[0, 0.58, 1]}
                      className="flex-row items-center justify-center px-4 py-3"
                    >
                      <SymbolView
                        name={{
                          ios: "play.fill",
                          android: "play_arrow",
                          web: "play_arrow",
                        }}
                        size={13}
                        tintColor="#FFFFFF"
                      />
                      <Text
                        className="ml-1.5 text-[13px] font-extrabold text-white"
                        style={{ lineHeight: bodyLineHeightFor(13) }}
                      >
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
                onPress={handleOpenNearbyHotspots}
              >
                <Text className={homeSectionTitleClassName}>
                  Địa điểm gần bạn
                </Text>
              </Pressable>
              <Pressable
                className="flex-row items-center"
                hitSlop={8}
                onPress={handleOpenNearbyHotspots}
              >
                <Text className={homeSectionActionTextClassName}>
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

            {nearbyPlacesStatus !== "empty" && nearbyPlacesNote ? (
              <Text className="text-[13px] leading-5 text-[#8E869A]">
                {nearbyPlacesNote}
              </Text>
            ) : null}

            {nearbyPlacesStatus === "loading" ? (
              <SectionEmptyState isLoading />
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
                      const isPlaceCheckedIn = isNearbyPlaceCheckedIn(place);

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
              <Text className={homeSectionTitleClassName}>Chủ đề</Text>

              <Pressable
                className="flex-row items-center"
                hitSlop={8}
                onPress={handleOpenAllThemes}
              >
                <Text className={homeSectionActionTextClassName}>
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
              <Text className={homeSectionTitleClassName}>
                Đề xuất tuyến đường
              </Text>
              {suggestedRoutes.length > 1 ? (
                <Pressable
                  className="flex-row items-center"
                  hitSlop={8}
                  onPress={handleOpenRoutes}
                >
                  <Text className={homeSectionActionTextClassName}>
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
              ) : null}
            </View>

            {suggestedRoutesStatus !== "empty" && suggestedRoutesNote ? (
              <Text className="text-[13px] leading-5 text-[#8E869A]">
                {suggestedRoutesNote}
              </Text>
            ) : null}

            {suggestedRoutesStatus === "loading" ? (
              <SectionEmptyState isLoading />
            ) : suggestedRoutesStatus === "empty" ? (
              <SectionEmptyState
                description={suggestedRoutesNote ?? "Không có dữ liệu phù hợp."}
                title="Chưa có tuyến phù hợp"
              />
            ) : (
              <ScrollView
                horizontal
                contentContainerStyle={{
                  alignItems: "stretch",
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
                      className="flex-1 overflow-hidden border border-[#EEF1F4] bg-white"
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

                      <View className="flex-1 justify-between px-3 pb-3 pt-2">
                        <View style={{ gap: 1 }}>
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
                            style={{ lineHeight: lineHeightFor(14) }}
                          >
                            {route.title}
                          </Text>

                          <Text
                            className="text-[12px] text-[#7A6F67]"
                            numberOfLines={2}
                            ellipsizeMode="tail"
                            style={{ lineHeight: lineHeightFor(12) }}
                          >
                            {getSuggestedRouteDescription(route)}
                          </Text>
                        </View>

                        <View className="flex-row flex-wrap items-center justify-end gap-1.5 pt-2">
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
                  <Text className={homeSectionTitleClassName}>
                    Voucher ưu đãi
                  </Text>
                </View>

                <Pressable
                  className="rounded-full bg-[#FFF4EF] px-3.5 py-2"
                  onPress={() => router.push("/vouchers" as Href)}
                >
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
                    <Text className={homeSectionTitleClassName}>
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

              {isCommunityLeaderboardLoading ? (
                <View className="mt-4 overflow-hidden rounded-[24px]">
                  <AppLoadingScreen
                    mode="embedded"
                    style={{ minHeight: communityLeaderboardLoadingHeight }}
                  />
                </View>
              ) : (
                <>
                  <View className="mt-4 gap-3">
                    {activeCommunityBoard.entries.length > 0 ? (
                      <View style={{ marginHorizontal: -16 }}>
                        <LeaderRankingCard
                          topEntries={activeCommunityBoard.entries.filter(
                            (entry) => entry.rank >= 1 && entry.rank <= 3,
                          )}
                          xp={activeCommunityBoard.summaryXp}
                        />
                      </View>
                    ) : (
                      <View className="items-center rounded-[24px] border border-[#F3E7ED] bg-[#FFF8FB] px-4 py-5">
                        <>
                          <Text className="text-center text-[13px] font-semibold text-[#1F2940]">
                            {activeCommunityBoard.summaryLabel}
                          </Text>
                          <Text className="mt-1 text-center text-[12px] leading-[16px] text-[#8F8290]">
                            {activeCommunityBoard.summaryNote}
                          </Text>
                        </>
                      </View>
                    )}

                    <View className="gap-2.5">
                      {activeCommunityBoard.entries.length > 0
                        ? activeCommunityBoard.entries.map((entry) => {
                            const isChampion = entry.rank === 1;
                            const badgeColor =
                              entry.rank === 1
                                ? "#F7B500"
                                : entry.rank === 2
                                  ? "#9AACBF"
                                  : entry.rank === 3
                                    ? "#FF8A00"
                                    : "#C7D1DE";

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
                                      backgroundColor:
                                        entry.rank >= 1 && entry.rank <= 3
                                          ? badgeColor
                                          : "#EEF2F7",
                                      borderColor: "#FFFFFF",
                                      borderWidth: 2,
                                    }}
                                  >
                                    <Text
                                      className="text-[11px] font-medium leading-[13px]"
                                      style={{
                                        color:
                                          entry.rank >= 1 && entry.rank <= 3
                                            ? "#FFFFFF"
                                            : "#667085",
                                      }}
                                    >
                                      {entry.rank}
                                    </Text>
                                  </View>
                                </View>

                                <View className="mr-2.5 h-10 w-10 items-center justify-center">
                                  <UserAvatar
                                    borderColor={
                                      entry.rank === 1
                                        ? "#F7B500"
                                        : entry.rank === 2
                                          ? "#C9D4E5"
                                          : entry.rank === 3
                                            ? "#FF8A00"
                                            : "#D7DCE4"
                                    }
                                    borderWidth={
                                      entry.rank >= 1 && entry.rank <= 3
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
                        : null}
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
                      <Text className="ml-1.5 text-[12px] font-semibold text-[#FF5F87]">
                        Xem bảng xếp hạng đầy đủ
                      </Text>
                    </View>
                  </Pressable>
                </>
              )}
            </View>
          </View>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}
