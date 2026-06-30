import { Image } from "expo-image";
import { LinearGradient } from "expo-linear-gradient";
import { useLocalSearchParams, useRouter, type Href } from "expo-router";
import { StatusBar } from "expo-status-bar";
import { SymbolView } from "@/components/ui/symbol-view";
import { useEffect, useState, type ComponentProps } from "react";
import {
  Platform,
  Pressable,
  ScrollView,
  Text,
  View,
  useWindowDimensions,
} from "react-native";
import Animated, {
  Extrapolation,
  cancelAnimation,
  interpolate,
  runOnJS,
  useAnimatedReaction,
  useAnimatedScrollHandler,
  useAnimatedStyle,
  useSharedValue,
  withRepeat,
  withSequence,
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
import {
  addApiCheckin,
  addCheckin,
  mergeApiCheckins,
  useCheckedInApiHotspots,
  useCheckins,
} from "@/lib/checkin-store";
import { getRoutesForHotspot, routes, type RouteItem } from "@/lib/demo-data";
import { getCheckedInHotspotIds } from "../api/get-checked-in-hotspots";
import { getHotspotById as getHotspotByIdApi } from "../api/get-hotspot-by-id";
import { getHotspotStories } from "../api/get-hotspot-stories";
import type { NearbyHotspotDto } from "../api/get-nearby-hotspots";
import { HotspotGpsCheckinOverlay } from "../components/hotspot-gps-checkin-overlay";
import { HiddenStoryUnlockedContent } from "../components/hidden-story-unlocked-content";
import {
  avatarImageUri,
  communityBoards,
  type CommunityBoardEntry,
} from "../data/home-screen.mock";
import { cacheHotspotDetail } from "../data/hotspot-detail-cache";
import {
  cacheHotspotStories,
  getCachedHotspotStories,
} from "../data/hotspot-story-cache";
import { buildHotspotThemeStoriesFromApi } from "../data/hotspot-theme-stories";
import {
  findMatchingHotspotByNameOrCoordinate,
  getHotspotBySlug,
  type HotspotDetail,
} from "../data/hotspots";

type SymbolName = ComponentProps<typeof SymbolView>["name"];
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

const loginGradientColors = ["#EB489B", "#F58752", "#FFC93C"] as const;
const screenBackground = "#FFFFFF";
const panelBackground = "#FFFFFF";
const defaultRemoteHotspotImageUri =
  "https://images.unsplash.com/photo-1500530855697-b586d89ba3ee";
const meaninglessApiTextValues = new Set(["", "string", "null", "undefined"]);

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

const routeCarouselShadowStyle = {
  shadowColor: "rgba(31, 41, 55, 0.26)",
  shadowOpacity: 1,
  shadowRadius: 28,
  shadowOffset: {
    width: 0,
    height: 18,
  },
  elevation: 12,
} as const;

function resolveHotspotIdParam(value?: string | string[]) {
  const rawValue = Array.isArray(value) ? value[0] : value;
  const parsedValue = Number(rawValue);

  return Number.isInteger(parsedValue) && parsedValue > 0 ? parsedValue : null;
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

function resolveRemoteDistrictLabel(address: string, fallbackDistrict?: string) {
  const segments = address
    .split(",")
    .map((segment) => segment.trim())
    .filter(Boolean);

  if (segments.length >= 2) {
    return segments[segments.length - 2] ?? segments[segments.length - 1]!;
  }

  if (segments.length === 1) {
    return segments[0]!;
  }

  return fallbackDistrict?.trim() || "Đang cập nhật";
}

function resolveRemoteMediaUris(
  apiHotspot: NearbyHotspotDto,
  fallbackHotspot?: HotspotDetail | null,
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

  const fallbackMediaUris = [
    fallbackHotspot?.imageUri,
    ...(fallbackHotspot?.gallery ?? []),
  ].filter((uri): uri is string => Boolean(readMeaningfulApiText(uri)));

  return fallbackMediaUris.length > 0
    ? fallbackMediaUris
    : [defaultRemoteHotspotImageUri];
}

function buildFallbackTips(
  overview: string,
  fallbackHotspot?: HotspotDetail | null,
) {
  if (fallbackHotspot?.tips.length) {
    return fallbackHotspot.tips;
  }

  return [
    "Kiểm tra giờ mở cửa trước khi ghé thăm.",
    "Bật định vị để có thể check-in tại hotspot.",
    overview,
  ];
}

function buildHotspotFromApi({
  apiHotspot,
  fallbackHotspot,
  routeSlug,
}: {
  apiHotspot: NearbyHotspotDto;
  fallbackHotspot?: HotspotDetail | null;
  routeSlug: string;
}) {
  const matchedLocalHotspot =
    fallbackHotspot ??
    findMatchingHotspotByNameOrCoordinate({
      hotspotName: apiHotspot.hotspotName,
      latitude: apiHotspot.latitude,
      longitude: apiHotspot.longitude,
    }) ??
    null;
  const tagNames = apiHotspot.tags
    .map((tag) => readMeaningfulApiText(tag.tagName))
    .filter((tagName): tagName is string => Boolean(tagName));
  const category =
    tagNames[0] ??
    matchedLocalHotspot?.category ??
    "Hotspot";
  const address =
    readMeaningfulApiText(apiHotspot.address) ??
    matchedLocalHotspot?.address ??
    "Địa chỉ đang cập nhật";
  const imageUris = resolveRemoteMediaUris(apiHotspot, matchedLocalHotspot);
  const imageUri = imageUris[0] ?? defaultRemoteHotspotImageUri;
  const gallery = imageUris.slice(1);
  const overview =
    readMeaningfulApiText(apiHotspot.description) ??
    matchedLocalHotspot?.overview ??
    `Hotspot ${readMeaningfulApiText(apiHotspot.hotspotName) ?? apiHotspot.hotspotId} đang được cập nhật mô tả từ hệ thống.`;
  const story =
    readMeaningfulApiText(apiHotspot.historyInformation) ??
    readMeaningfulApiText(apiHotspot.description) ??
    matchedLocalHotspot?.story ??
    overview;
  const scheduleLabel =
    formatApiTimeWindow(apiHotspot.openingTime, apiHotspot.closingTime) ??
    formatApiTimeWindow(apiHotspot.startTime, apiHotspot.endTime) ??
    matchedLocalHotspot?.scheduleLabel ??
    "Giờ mở cửa đang cập nhật";
  const bestTimeLabel =
    formatApiTimeWindow(apiHotspot.startTime, apiHotspot.endTime) ??
    matchedLocalHotspot?.bestTimeLabel ??
    scheduleLabel;

  return {
    hotspot: {
      address,
      bestTimeLabel,
      category,
      checkinMode: matchedLocalHotspot?.checkinMode,
      coordinate: {
        latitude: apiHotspot.latitude,
        longitude: apiHotspot.longitude,
      },
      distance: matchedLocalHotspot?.distance ?? "Từ API",
      district: resolveRemoteDistrictLabel(address, matchedLocalHotspot?.district),
      gallery,
      highlights: matchedLocalHotspot?.highlights ?? [
        overview,
        story,
        `XP thưởng: +${apiHotspot.xp ?? 0}`,
      ],
      imageUri,
      overview,
      rating: matchedLocalHotspot?.rating ?? 0,
      reviews:
        matchedLocalHotspot?.reviews ?? `${Math.max(0, Math.round(apiHotspot.point ?? 0))}`,
      reward:
        matchedLocalHotspot?.reward ??
        `+${Math.max(0, Math.round(apiHotspot.xp ?? 0))}`,
      routePairing:
        matchedLocalHotspot?.routePairing ??
        "Thông tin gợi ý tuyến đường cho hotspot này đang được cập nhật.",
      scheduleLabel,
      slug: matchedLocalHotspot?.slug ?? routeSlug,
      story,
      ticketLabel:
        matchedLocalHotspot?.ticketLabel ?? "Thông tin vé đang được cập nhật.",
      tips: buildFallbackTips(overview, matchedLocalHotspot),
      title:
        readMeaningfulApiText(apiHotspot.hotspotName) ??
        matchedLocalHotspot?.title ??
        `Hotspot #${apiHotspot.hotspotId}`,
      vibeTags: tagNames.length > 0 ? tagNames : (matchedLocalHotspot?.vibeTags ?? [category]),
    } satisfies HotspotDetail,
    matchedLocalHotspot,
  };
}

function clampNumber(value: number, minimum: number, maximum: number) {
  return Math.min(Math.max(value, minimum), maximum);
}

function formatCompactCount(value: number | string) {
  const resolvedValue =
    typeof value === "number" ? value : Number(value.replace(/\D/g, ""));

  if (!Number.isFinite(resolvedValue) || resolvedValue <= 0) {
    return `${value}`;
  }

  if (resolvedValue >= 1000) {
    return `${(resolvedValue / 1000).toFixed(1)}K`;
  }

  return `${resolvedValue}`;
}

function buildReviewSummaryLabel({
  apiHotspot,
  matchedLocalHotspot,
}: {
  apiHotspot: NearbyHotspotDto | null;
  matchedLocalHotspot?: HotspotDetail | null;
}) {
  if (matchedLocalHotspot?.reviews?.trim()) {
    return `${formatCompactCount(matchedLocalHotspot.reviews)} reviews`;
  }

  if (apiHotspot?.point !== null && apiHotspot?.point !== undefined) {
    return `${formatCompactCount(apiHotspot.point)} điểm`;
  }

  return "Chi tiết từ API";
}

function getRewardValue(reward: string) {
  const resolvedValue = Number(reward.replace(/\D/g, ""));

  if (!Number.isFinite(resolvedValue) || resolvedValue <= 0) {
    return reward;
  }

  return `${resolvedValue}`;
}

function buildSummaryStats({
  apiHotspot,
  hotspot,
  matchedLocalHotspot,
  rewardXp,
}: {
  apiHotspot: NearbyHotspotDto | null;
  hotspot: HotspotDetail;
  matchedLocalHotspot?: HotspotDetail | null;
  rewardXp: string;
}): SummaryStatItem[] {
  const remoteScheduleValue = formatApiTimeWindow(
    apiHotspot?.openingTime,
    apiHotspot?.closingTime,
  );
  const secondaryValue =
    matchedLocalHotspot?.distance ?? remoteScheduleValue ?? hotspot.district;
  const secondaryLabel = matchedLocalHotspot?.distance
    ? "Distance"
    : remoteScheduleValue
      ? "Giờ mở"
      : "Khu vực";

  return [
    {
      icon: {
        ios: matchedLocalHotspot ? "star.fill" : "chart.bar.fill",
        android: matchedLocalHotspot ? "star" : "bar_chart",
        web: matchedLocalHotspot ? "star" : "bar_chart",
      } as SymbolName,
      label: matchedLocalHotspot ? "Rating" : "Điểm",
      value: matchedLocalHotspot
        ? hotspot.rating.toFixed(1)
        : `${Math.max(0, Math.round(apiHotspot?.point ?? 0))}`,
    },
    {
      icon: {
        ios: matchedLocalHotspot ? "location.fill" : "clock.fill",
        android: matchedLocalHotspot ? "place" : "schedule",
        web: matchedLocalHotspot ? "place" : "schedule",
      } as SymbolName,
      isCompactValue: !matchedLocalHotspot,
      label: secondaryLabel,
      value: secondaryValue,
    },
    {
      icon: {
        ios: "gift.fill",
        android: "redeem",
        web: "redeem",
      } as SymbolName,
      label: "XP",
      value: `+${rewardXp}`,
    },
  ];
}

function getBestTimeWindow(bestTimeLabel: string) {
  const [timeRange] = bestTimeLabel.split(" de ");

  return timeRange?.trim() || bestTimeLabel;
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

function getStoryPreview(story: string, maxLength = 168) {
  const trimmed = story.trim();

  if (trimmed.length <= maxLength) {
    return trimmed;
  }

  const sliced = trimmed.slice(0, maxLength);
  const lastSpace = sliced.lastIndexOf(" ");

  return `${sliced.slice(0, lastSpace > 0 ? lastSpace : maxLength)}...`;
}

function getHistoricalPreview(story: string) {
  return getStoryPreview(story, 220);
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

function getRelatedRoutesForHotspot(hotspot: HotspotDetail, limit = 4) {
  const directLookupIds = getRouteLookupIds(hotspot);
  const directRoutes = directLookupIds.flatMap((id) => getRoutesForHotspot(id));
  const uniqueDirectRoutes = Array.from(
    new Map(directRoutes.map((route) => [route.id, route])).values(),
  );

  if (uniqueDirectRoutes.length > 0) {
    return uniqueDirectRoutes.slice(0, limit);
  }

  const normalizedDistrict = normalizeLookupText(hotspot.district);
  const normalizedCategory = normalizeLookupText(hotspot.category);

  return routes
    .map((route) => {
      let score = 0;

      if (
        normalizedDistrict.includes("quan 1") &&
        route.hotspotIds.some((id) =>
          [
            "bao-tang",
            "buu-dien",
            "dinh-doc-lap",
            "nha-tho-duc-ba",
            "pho-di-bo",
          ].includes(id),
        )
      ) {
        score += 3;
      }

      if (
        normalizedCategory.includes("kien truc") &&
        ["vinh-ha-long", "mui-ne", "pho-co-dem"].includes(route.id)
      ) {
        score += 2;
      }

      if (
        normalizedCategory.includes("lich su") &&
        ["vinh-ha-long", "mui-ne", "cho-lon"].includes(route.id)
      ) {
        score += 2;
      }

      if (
        normalizedCategory.includes("nghe thuat") &&
        ["vinh-ha-long", "mui-ne"].includes(route.id)
      ) {
        score += 2;
      }

      if (
        normalizedCategory.includes("am thuc") &&
        ["cho-lon", "mui-ne"].includes(route.id)
      ) {
        score += 2;
      }

      if (
        normalizedCategory.includes("check-in") &&
        ["pho-co-dem", "vinh-ha-long"].includes(route.id)
      ) {
        score += 2;
      }

      return { route, score };
    })
    .sort((left, right) => right.score - left.score)
    .filter((item) => item.score > 0)
    .slice(0, limit)
    .map((item) => item.route);
}

function buildPersonalExperienceItems(
  hotspot: HotspotDetail,
  galleryImages: string[],
): PersonalExperienceItem[] {
  const authors = [
    ...communityBoards.community.entries,
    ...communityBoards.friends.entries,
  ];
  const safeGallery =
    galleryImages.length > 0 ? galleryImages : [hotspot.imageUri];

  return [
    {
      avatarUri: authors[0]?.avatarUri ?? avatarImageUri,
      date: "3 ngày trước",
      id: `${hotspot.slug}-experience-0`,
      media: [
        { type: "image", uri: safeGallery[0] ?? hotspot.imageUri },
        {
          type: "image",
          uri: safeGallery[1] ?? safeGallery[0] ?? hotspot.imageUri,
        },
        {
          duration: "0:38",
          type: "video",
          uri: safeGallery[2] ?? safeGallery[0] ?? hotspot.imageUri,
        },
      ],
      rating: 5,
      text: `Câu chuyện lịch sử rất xúc động, kiến trúc đẹp vượt thời gian. ${hotspot.tips[0] ?? hotspot.overview}`,
      user: authors[0]?.name ?? "Minh Anh",
    },
    {
      avatarUri: authors[1]?.avatarUri ?? avatarImageUri,
      date: "1 tuần trước",
      id: `${hotspot.slug}-experience-1`,
      media: [
        {
          type: "image",
          uri: safeGallery[1] ?? safeGallery[0] ?? hotspot.imageUri,
        },
      ],
      rating: 4,
      text: `Phần audio guide nghe rất tình cảm. ${hotspot.tips[1] ?? hotspot.overview}`,
      user: authors[1]?.name ?? "Khánh Linh",
    },
    {
      avatarUri: authors[2]?.avatarUri ?? avatarImageUri,
      date: "2 tuần trước",
      id: `${hotspot.slug}-experience-2`,
      media: [
        {
          type: "image",
          uri: safeGallery[3] ?? safeGallery[0] ?? hotspot.imageUri,
        },
        {
          type: "image",
          uri: safeGallery[2] ?? safeGallery[1] ?? hotspot.imageUri,
        },
      ],
      rating: 5,
      text: `Đi cùng nhóm bạn, mở khóa story xong cả bọn ngồi lại đọc, cảm giác rất hợp với vibe ${hotspot.category.toLowerCase()} ở đây.`,
      user: authors[2]?.name ?? "Đức Huy",
    },
  ];
}

function getAudioStoryDurationLabel(story: string) {
  const wordCount = story.trim().split(/\s+/).filter(Boolean).length;
  const minutes = Math.max(1, Math.ceil(wordCount / 110));

  return `${minutes} min nghe`;
}

function HeroChip({ icon, label }: { icon: SymbolName; label: string }) {
  return (
    <View className="flex-row items-center rounded-full bg-black/24 px-3 py-2">
      <SymbolView name={icon} size={13} tintColor="#FFFFFF" />
      <Text className="ml-1.5 text-[14px] font-semibold text-white">
        {label}
      </Text>
    </View>
  );
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

function ScrollDownHint({ scrollY }: { scrollY: { value: number } }) {
  const floatOffset = useSharedValue(0);

  useEffect(() => {
    floatOffset.value = withRepeat(
      withSequence(
        withTiming(-6, { duration: 720 }),
        withTiming(0, { duration: 720 }),
      ),
      -1,
      false,
    );

    return () => {
      cancelAnimation(floatOffset);
    };
  }, [floatOffset]);

  const animatedStyle = useAnimatedStyle(() => ({
    opacity: interpolate(
      scrollY.value,
      [0, 40, 88],
      [1, 0.74, 0],
      Extrapolation.CLAMP,
    ),
    transform: [
      {
        translateY:
          floatOffset.value +
          interpolate(scrollY.value, [0, 88], [0, -10], Extrapolation.CLAMP),
      },
    ],
  }));

  return (
    <Animated.View pointerEvents="none" style={[animatedStyle, { alignItems: "center" }]}>
      <View className="rounded-full border border-white/18 bg-black/30 px-4 py-2.5">
        <View className="flex-row items-center">
          <SymbolView name="keyboard_arrow_up" size={15} tintColor="#FFFFFF" />
          <Text className="ml-1.5 text-[13px] font-bold text-white">
            Vuốt lên để xem thêm thông tin
          </Text>
        </View>
      </View>
    </Animated.View>
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
    <View className="flex-row items-center">
      <View className="h-7 w-7 items-center justify-center rounded-full bg-[#FFF0F6]">
        <SymbolView name={icon} size={13} tintColor="#EB489B" />
      </View>
      <View className="ml-2 flex-1">
        <Text
          className={
            isCompactValue
              ? "text-[12px] font-black leading-4 text-[#1E3142]"
              : "text-[15px] font-black text-[#1E3142]"
          }
          numberOfLines={1}
        >
          {value}
        </Text>
        <Text className="text-[12px] font-semibold uppercase tracking-[0.8px] text-[#9B91A0]">
          {label}
        </Text>
      </View>
    </View>
  );
}

function AvatarPreview({
  imageUri,
  index,
}: {
  imageUri: string;
  index: number;
}) {
  return (
    <View
      className="overflow-hidden rounded-full border-2 border-white"
      style={{ height: 34, marginLeft: index === 0 ? 0 : -8, width: 34 }}
    >
      <Image
        source={imageUri}
        contentFit="cover"
        transition={140}
        cachePolicy="memory-disk"
        style={{ height: "100%", width: "100%" }}
      />
    </View>
  );
}

function TagChip({
  backgroundColor = "#FFF0F6",
  label,
  textColor = "#EB489B",
}: {
  backgroundColor?: string;
  label: string;
  textColor?: string;
}) {
  return (
    <View className="rounded-full px-3 py-2" style={{ backgroundColor }}>
      <Text
        className="text-[13px] font-semibold uppercase tracking-[0.8px]"
        style={{ color: textColor }}
      >
        {label}
      </Text>
    </View>
  );
}

function DirectionMapCard({
  address,
  districtLabel,
}: {
  address: string;
  districtLabel: string;
}) {
  return (
    <View
      className="overflow-hidden rounded-[30px]"
      style={[cardShadowStyle, { height: 188 }]}
    >
      <LinearGradient
        colors={["#FAEFE7", "#D9F0E7", "#D2ECE8"]}
        locations={[0, 0.58, 1]}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 1 }}
        style={{ bottom: 0, left: 0, position: "absolute", right: 0, top: 0 }}
      />

      <View
        className="absolute rounded-full bg-white/35"
        style={{ height: 170, left: -10, top: -34, width: 170 }}
      />
      <View
        className="absolute rounded-full bg-[#F3CFCF]/25"
        style={{ height: 146, right: -24, top: -12, width: 146 }}
      />
      <View
        className="absolute rounded-full bg-white/55"
        style={{
          height: 260,
          left: 82,
          top: -58,
          transform: [{ rotate: "18deg" }],
          width: 18,
        }}
      />
      <View
        className="absolute rounded-full bg-[#D7C7B7]/28"
        style={{
          height: 300,
          left: 170,
          top: -76,
          transform: [{ rotate: "-82deg" }],
          width: 14,
        }}
      />
      <View
        className="absolute rounded-full bg-[#F1B8A5]/30"
        style={{
          height: 260,
          right: 56,
          top: -42,
          transform: [{ rotate: "8deg" }],
          width: 14,
        }}
      />

      {[
        { left: 34, top: 22 },
        { left: 118, top: 34 },
        { left: 220, top: 16 },
      ].map((pin, index) => (
        <View
          key={`map-pin-${index}`}
          style={{ left: pin.left, position: "absolute", top: pin.top }}
        >
          <View className="h-14 w-14 items-center justify-center rounded-full bg-white/92">
            <SymbolView
              name={{
                ios: "location.fill",
                android: "place",
                web: "place",
              }}
              size={24}
              tintColor="#F36A3D"
            />
          </View>
          <View
            className="self-center rounded-full bg-[#F36A3D]/18"
            style={{ height: 10, marginTop: 6, width: 10 }}
          />
        </View>
      ))}

      <View
        className="absolute items-center justify-center rounded-full bg-[#6C61C9]/78"
        style={{ height: 46, right: 58, top: 32, width: 46 }}
      >
        <View className="h-5 w-5 rounded-full bg-white/72" />
      </View>
      <View
        className="absolute items-center justify-center rounded-full border-4 border-white bg-[#4A44A8]"
        style={{ height: 32, right: 38, top: 56, width: 32 }}
      />

      <View className="absolute left-5 right-5 top-5 flex-row items-center justify-between">
        <View className="rounded-full bg-white/76 px-3 py-2">
          <Text className="text-[12px] font-bold uppercase tracking-[1px] text-[#3A6C63]">
            Tuyến đường gần đây
          </Text>
        </View>
        <View className="max-w-[140px] rounded-full bg-white/78 px-3 py-2">
          <Text
            className="text-[12px] font-semibold text-[#4E6473]"
            numberOfLines={1}
          >
            {address}
          </Text>
        </View>
      </View>

      <View className="absolute bottom-5 left-5 right-5 flex-row items-end justify-between gap-4">
        <View className="flex-1">
          <Text className="text-[22px] font-black uppercase tracking-[1px] text-[#7E8874]/95">
            {districtLabel}
          </Text>
        </View>

        <Pressable
          className="overflow-hidden rounded-full"
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
            <Text className="ml-1.5 text-[16px] font-black text-white">
              Chỉ đường
            </Text>
          </LinearGradient>
        </Pressable>
      </View>
    </View>
  );
}

function LocationInformationSection({
  access,
  address,
  atmosphere,
  bestTime,
}: {
  access: string;
  address: string;
  atmosphere: string;
  bestTime: string;
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
    {
      icon: {
        ios: "sun.max.fill",
        android: "wb_sunny",
        web: "wb_sunny",
      } as SymbolName,
      label: "Giờ đẹp",
      value: bestTime,
    },
    {
      icon: {
        ios: "hourglass",
        android: "hourglass_empty",
        web: "hourglass_empty",
      } as SymbolName,
      label: "Mở cửa",
      value: access,
    },
    {
      icon: {
        ios: "sparkles",
        android: "auto_awesome",
        web: "auto_awesome",
      } as SymbolName,
      label: "Không gian",
      value: atmosphere,
    },
  ];

  return (
    <View className="mt-7 gap-5">
      <View>
        <Text className="mt-2 text-[20px] font-black text-[#3C2D34]">
          Thông tin địa điểm
        </Text>
      </View>

      <View
        className="rounded-[28px] bg-[#FFFCFA] px-5 py-5"
        style={cardShadowStyle}
      >
        <View className="gap-6">
          {items.map((item) => (
            <View key={item.label} className="flex-row items-start gap-4">
              <View className="mt-0.5 h-11 w-11 items-center justify-center rounded-full bg-[#FFF0F6]">
                <SymbolView name={item.icon} size={18} tintColor="#EB489B" />
              </View>

              <View className="flex-1">
                <Text className="text-[12px] font-medium uppercase tracking-[1px] text-[#8FA6BA]">
                  {item.label}
                </Text>
                <Text className="mt-1 text-[16px] leading-6 text-[#526879]">
                  {item.value}
                </Text>
              </View>
            </View>
          ))}
        </View>
      </View>
    </View>
  );
}

function HistoricalInfoSection({ text }: { text: string }) {
  return (
    <View className="gap-3">
      <View className="flex-row items-center gap-2">
        <View className="h-8 w-8 items-center justify-center rounded-full bg-[#F5EEF6]">
          <SymbolView
            name={{
              ios: "building.columns.fill",
              android: "account_balance",
              web: "account_balance",
            }}
            size={15}
            tintColor="#7E6F82"
          />
        </View>
        <Text className="text-[20px] font-black text-[#3C2D34]">
          Thông tin lịch sử
        </Text>
      </View>

      <View className="rounded-[28px] bg-[#FFF9F3] px-5 py-5">
        <Text className="text-[16px] leading-7 text-[#554751]">{text}</Text>
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
    <View className="rounded-[30px] bg-[#F8FBFF] px-5 py-5" style={cardShadowStyle}>
      <Text className="text-[18px] font-black text-[#2F242C]">
        Đang tải story hotspot
      </Text>
      <Text className="mt-2 text-[16px] leading-6 text-[#5E7486]">
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
    <View className="rounded-[30px] bg-[#F8FBFF] px-5 py-5" style={cardShadowStyle}>
      <Text className="text-[18px] font-black text-[#2F242C]">
        Story chuyên đề đang cập nhật
      </Text>
      <Text className="mt-2 text-[16px] leading-6 text-[#5E7486]">
        Hotspot này đã check-in thành công. Nội dung story riêng cho điểm đến
        này sẽ được bổ sung sau.
      </Text>
    </View>
  );

  return (
    <View className="gap-3">
      <View className="flex-row items-center justify-between gap-3">
        <View className="flex-row items-center gap-2">
          <View className="h-8 w-8 items-center justify-center rounded-full bg-[#F8EEF6]">
            <SymbolView
              name={{
                ios: "book.closed.fill",
                android: "menu_book",
                web: "menu_book",
              }}
              size={15}
              tintColor="#8B6B82"
            />
          </View>
          <Text className="text-[20px] font-black text-[#3C2D34]">
            Câu chuyện ẩn
          </Text>
        </View>

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
              isCheckedIn ? "#1F9D7A" : isCheckinStatusLoading ? "#7C7C93" : "#8A736A"
            }
          />
          <Text
            className="ml-1.5 text-[13px] font-black uppercase tracking-[0.8px]"
            style={{
              color: isCheckedIn ? "#1F9D7A" : isCheckinStatusLoading ? "#7C7C93" : "#8A736A",
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
      ) : (
        <LinearGradient
          colors={["#F3E3D9", "#E8E0E5"]}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 1 }}
          className="items-center rounded-[30px] px-5 py-8"
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

          <Text className="mt-5 text-center text-[22px] font-black text-[#3B2A32]">
            Câu chuyện đang chờ bạn
          </Text>

          <Text className="mt-3 max-w-[320px] text-center text-[16px] leading-6 text-[#6A5964]">
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
              <Text className="ml-2 text-[17px] font-black text-white">
                {isCheckinStatusLoading ? "Đang đồng bộ..." : "Check-in tại đây"}
              </Text>
            </LinearGradient>
          </Pressable>
        </LinearGradient>
      )}
    </View>
  );
}

function HotspotRouteCarouselCard({ route }: { route: RouteItem }) {
  const router = useRouter();
  const eraBadgeColors = getRouteBadgeColors(route.era);
  const difficultyBadgeColors = getRouteBadgeColors(route.difficulty);

  return (
    <Pressable
      className="overflow-hidden rounded-[30px] bg-white"
      onPress={() => router.push(`/route/${route.id}` as Href)}
      style={[routeCarouselShadowStyle, { width: 274 }]}
    >
      <View style={{ height: 174 }}>
        <Image
          source={route.cover}
          contentFit="cover"
          transition={180}
          cachePolicy="memory-disk"
          style={{ height: "100%", width: "100%" }}
        />
        <LinearGradient
          colors={["rgba(0,0,0,0.06)", "rgba(0,0,0,0.72)"]}
          locations={[0.15, 1]}
          start={{ x: 0.5, y: 0 }}
          end={{ x: 0.5, y: 1 }}
          style={{ bottom: 0, left: 0, position: "absolute", right: 0, top: 0 }}
        />

        <View className="absolute inset-x-4 top-4 flex-row gap-2">
          <TagChip
            backgroundColor={eraBadgeColors.backgroundColor}
            label={route.era}
            textColor={eraBadgeColors.textColor}
          />
          <TagChip
            backgroundColor={difficultyBadgeColors.backgroundColor}
            label={route.difficulty}
            textColor={difficultyBadgeColors.textColor}
          />
        </View>

        <View className="absolute inset-x-4 bottom-4">
          <Text className="text-[20px] font-black leading-6 text-white">
            {route.title}
          </Text>
          <Text
            className="mt-1 text-[14px] leading-5 text-[#F5E8EE]"
            numberOfLines={2}
          >
            {route.subtitle}
          </Text>
        </View>
      </View>

      <View className="px-4 py-4">
        <View className="flex-row flex-wrap items-center gap-x-3 gap-y-2">
          <View className="flex-row items-center">
            <SymbolView
              name={{
                ios: "location.fill",
                android: "place",
                web: "place",
              }}
              size={11}
              tintColor="#EB489B"
            />
            <Text className="ml-1.5 text-[13px] font-semibold text-[#6D8194]">
              {route.distance}
            </Text>
          </View>

          <View className="flex-row items-center">
            <SymbolView
              name={{
                ios: "clock.fill",
                android: "schedule",
                web: "schedule",
              }}
              size={11}
              tintColor="#F58752"
            />
            <Text className="ml-1.5 text-[13px] font-semibold text-[#6D8194]">
              {route.duration}
            </Text>
          </View>

          <View className="flex-row items-center">
            <SymbolView
              name={{
                ios: "star.fill",
                android: "star",
                web: "star",
              }}
              size={11}
              tintColor="#FFC93C"
            />
            <Text className="ml-1.5 text-[13px] font-semibold text-[#6D8194]">
              {route.rating.toFixed(1)}
            </Text>
          </View>
        </View>

        <View className="mt-4 flex-row items-center justify-between">
          <Text className="text-[14px] font-semibold text-[#44596B]">
            {route.hotspotIds.length} diem dung
          </Text>
          <View className="rounded-full bg-[#FFF0F6] px-3 py-2">
            <Text className="text-[13px] font-black uppercase tracking-[0.8px] text-[#EB489B]">
              +{route.xp} XP
            </Text>
          </View>
        </View>
      </View>
    </Pressable>
  );
}

function RouteMatchesSectionHeader() {
  return (
    <View className="flex-row items-center gap-2">
      <View className="h-8 w-8 items-center justify-center rounded-full bg-[#F8EEF6]">
        <SymbolView
          name={{
            ios: "map.fill",
            android: "map",
            web: "map",
          }}
          size={15}
          tintColor="#8B6B82"
        />
      </View>
      <Text className="text-[20px] font-black text-[#3C2D34]">
        Các tuyến đường phù hợp
      </Text>
    </View>
  );
}

function PersonalExperienceSectionHeader({
  isCheckedIn,
}: {
  isCheckedIn: boolean;
}) {
  return (
    <View className="flex-row items-center justify-between gap-3">
      <Text className="text-[20px] font-black text-[#3C2D34]">
        Trải nghiệm cá nhân
      </Text>
      <Text className="text-[14px] font-semibold text-[#8A736A]">
        {isCheckedIn ? "Bạn có thể chia sẻ" : "Check-in để chia sẻ"}
      </Text>
    </View>
  );
}

function PersonalExperienceStars({ rating }: { rating: number }) {
  return (
    <View className="flex-row gap-0.5">
      {Array.from({ length: 5 }).map((_, index) => (
        <Text
          key={index}
          style={{
            color: index < rating ? "#F97356" : "#E2D6D0",
            fontSize: 13,
          }}
        >
          ★
        </Text>
      ))}
    </View>
  );
}

function PersonalExperienceMediaThumb({
  height = 104,
  item,
  width,
}: {
  height?: number;
  item: PersonalExperienceMediaItem;
  width: number | `${number}%`;
}) {
  return (
    <View className="overflow-hidden rounded-[22px]" style={{ height, width }}>
      <Image
        source={item.uri}
        contentFit="cover"
        transition={140}
        cachePolicy="memory-disk"
        style={{ height: "100%", width: "100%" }}
      />

      {item.type === "video" ? (
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
              {item.duration ?? "0:30"}
            </Text>
          </View>
        </>
      ) : null}
    </View>
  );
}

function PersonalExperienceCard({ item }: { item: PersonalExperienceItem }) {
  const mediaWidth =
    item.media.length === 1
      ? "100%"
      : item.media.length === 2
        ? "48%"
        : "31.5%";
  const mediaHeight =
    item.media.length === 1 ? 180 : item.media.length === 2 ? 132 : 104;

  return (
    <View className="rounded-[30px] bg-white px-4 py-4" style={cardShadowStyle}>
      <View className="flex-row items-start justify-between gap-3">
        <View className="flex-row flex-1 items-center">
          <Image
            source={item.avatarUri}
            contentFit="cover"
            transition={120}
            cachePolicy="memory-disk"
            style={{ height: 44, width: 44, borderRadius: 22 }}
          />
          <View className="ml-3 flex-1">
            <Text className="text-[17px] font-black text-[#2F242C]">
              {item.user}
            </Text>
            <Text className="mt-0.5 text-[14px] text-[#8A7B83]">
              {item.date}
            </Text>
          </View>
        </View>
        <PersonalExperienceStars rating={item.rating} />
      </View>

      <Text className="mt-4 text-[17px] leading-7 text-[#554751]">
        {item.text}
      </Text>

      {item.media.length > 0 ? (
        <View className="mt-4 flex-row flex-wrap gap-3">
          {item.media.map((media, index) => (
            <PersonalExperienceMediaThumb
              height={mediaHeight}
              key={`${item.id}-media-${index}`}
              item={media}
              width={mediaWidth}
            />
          ))}
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
    <View className="rounded-[30px] bg-white px-5 py-5" style={cardShadowStyle}>
      <Text className="text-[17px] font-black text-[#2F242C]">
        Chưa có trải nghiệm cá nhân
      </Text>
      <Text className="mt-2 text-[16px] leading-6 text-[#6A5964]">
        {isCheckedIn
          ? "Bạn là người đầu tiên có thể để lại cảm nhận cho hotspot này."
          : "Check-in tại hotspot để mở quyền chia sẻ trải nghiệm cá nhân."}
      </Text>
    </View>
  );
}

function PersonalExperienceSection({
  isCheckedIn,
  items,
}: {
  isCheckedIn: boolean;
  items: PersonalExperienceItem[];
}) {
  return (
    <View className="mt-8 gap-5">
      <PersonalExperienceSectionHeader isCheckedIn={isCheckedIn} />

      <View className="gap-4">
        {items.length > 0 ? (
          items.map((item) => (
            <PersonalExperienceCard key={item.id} item={item} />
          ))
        ) : (
          <EmptyPersonalExperienceCard isCheckedIn={isCheckedIn} />
        )}
      </View>

      {items.length > 0 ? (
        <Pressable
          className="self-center rounded-full bg-[#FFF0F6] px-5 py-3"
          style={cardShadowStyle}
        >
          <Text className="text-[16px] font-black text-[#EB489B]">
            Xem thêm
          </Text>
        </Pressable>
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
            locations={isCheckedIn || isCheckinStatusLoading ? [0, 1] : [0, 0.58, 1]}
            start={{ x: 0, y: 0.5 }}
            className="px-5 py-4"
            style={{ opacity: isCheckedIn || isCheckinStatusLoading ? 0.92 : 1 }}
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
              <Text className="ml-3 text-[18px] font-black tracking-[0.3px] text-white">
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
              Đang tải hotspot
            </Text>
            <Text className="mt-3 text-center text-[15px] leading-6 text-[#5E7486]">
              App đang gọi API chi tiết hotspot theo id để hiển thị dữ liệu mới
              nhất.
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
  const { height: screenHeight } = useWindowDimensions();
  const checkins = useCheckins();
  const checkedInApiHotspots = useCheckedInApiHotspots();
  const { hotspotId, slug } = useLocalSearchParams<{
    hotspotId?: string;
    slug: string;
  }>();
  const scrollY = useSharedValue(0);
  const [isCheckinOverlayVisible, setIsCheckinOverlayVisible] = useState(false);
  const [isStickyCheckinVisible, setIsStickyCheckinVisible] = useState(false);
  const [remoteHotspot, setRemoteHotspot] = useState<NearbyHotspotDto | null>(null);
  const [remoteHotspotError, setRemoteHotspotError] = useState<string | null>(null);
  const [isRemoteCheckinStatusLoading, setIsRemoteCheckinStatusLoading] =
    useState(false);
  const [isRemoteHotspotLoading, setIsRemoteHotspotLoading] = useState(false);
  const resolvedSlug = Array.isArray(slug) ? (slug[0] ?? "") : (slug ?? "");
  const resolvedHotspotId = resolveHotspotIdParam(hotspotId);
  const cachedStoriesEntry = getCachedHotspotStories({
    hotspotId: resolvedHotspotId,
    slug: resolvedSlug,
  });
  const [hasApiStories, setHasApiStories] = useState(
    () => Boolean(cachedStoriesEntry?.stories.length),
  );
  const [isStoryAvailabilityLoading, setIsStoryAvailabilityLoading] = useState(
    () => cachedStoriesEntry === null && resolvedHotspotId !== null,
  );
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
  const stickyCheckinRevealOffset = Math.max(heroHeightCollapsed * 0.34, 96);

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

  const heroContentStyle = useAnimatedStyle(() => ({
    opacity: interpolate(
      scrollY.value,
      [0, collapseDistance * 0.48, collapseDistance],
      [1, 0.58, 0],
      Extrapolation.CLAMP,
    ),
    transform: [
      {
        translateY: interpolate(
          scrollY.value,
          [0, collapseDistance],
          [0, -28],
          Extrapolation.CLAMP,
        ),
      },
    ],
  }));

  const compactHeaderStyle = useAnimatedStyle(() => ({
    opacity: interpolate(
      scrollY.value,
      [collapseDistance * 0.58, collapseDistance],
      [0, 1],
      Extrapolation.CLAMP,
    ),
    transform: [
      {
        translateY: interpolate(
          scrollY.value,
          [collapseDistance * 0.58, collapseDistance],
          [10, 0],
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

  useEffect(() => {
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
  }, [authSession.isAuthenticated, authSession.tokenType, resolvedHotspotId]);

  const localHotspot = getHotspotBySlug(slug);
  const remoteHotspotResult = remoteHotspot
    ? buildHotspotFromApi({
        apiHotspot: remoteHotspot,
        fallbackHotspot: localHotspot,
        routeSlug: resolvedSlug,
      })
    : null;
  const hotspot = remoteHotspotResult?.hotspot ?? localHotspot ?? null;
  const matchedLocalHotspot =
    remoteHotspotResult?.matchedLocalHotspot ?? localHotspot ?? null;

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
    if (!hotspot || resolvedHotspotId === null) {
      return;
    }

    let isActive = true;
    const nextCachedStoriesEntry = getCachedHotspotStories({
      hotspotId: resolvedHotspotId,
      slug: hotspot.slug,
    });

    const loadHotspotStoriesAvailability = async () => {
      setHasApiStories(Boolean(nextCachedStoriesEntry?.stories.length));

      if (nextCachedStoriesEntry === null) {
        setIsStoryAvailabilityLoading(true);
      }

      try {
        const accessToken = authSession.isAuthenticated
          ? await getValidAccessToken()
          : null;
        const stories = await getHotspotStories({
          accessToken,
          hotspotId: resolvedHotspotId,
          status: "DRAFT",
          tokenType: authSession.tokenType,
        });
        const mappedStories = buildHotspotThemeStoriesFromApi(hotspot, stories);

        cacheHotspotStories({
          hotspotId: resolvedHotspotId,
          slug: hotspot.slug,
          stories: mappedStories,
        });

        if (!isActive) {
          return;
        }

        setHasApiStories(mappedStories.length > 0);
      } catch (error) {
        console.warn("[hotspot-detail] load hotspot stories failed", {
          error: error instanceof Error ? error.message : error,
          hotspotId: resolvedHotspotId,
          slug: hotspot.slug,
        });

        if (!isActive) {
          return;
        }

        setHasApiStories(Boolean(nextCachedStoriesEntry?.stories.length));
      } finally {
        if (isActive) {
          setIsStoryAvailabilityLoading(false);
        }
      }
    };

    void loadHotspotStoriesAvailability();

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
  const rewardXp = getRewardValue(hotspot.reward);
  const canOpenStories =
    resolvedHotspotId !== null ? hasApiStories : Boolean(matchedLocalHotspot);
  const hotspotCheckinId = hotspot.slug;
  const isCheckedIn =
    checkins.includes(hotspotCheckinId) ||
    (resolvedHotspotId !== null && checkedInApiHotspots.includes(resolvedHotspotId));
  const historicalPreview = getHistoricalPreview(hotspot.story);
  const audioStoryDurationLabel = getAudioStoryDurationLabel(hotspot.story);
  const hotspotStoriesHref =
    resolvedHotspotId !== null
      ? (`/hotspot/${hotspot.slug}/stories?hotspotId=${resolvedHotspotId}` as Href)
      : (`/hotspot/${hotspot.slug}/stories` as Href);
  const relatedRoutes = getRelatedRoutesForHotspot(hotspot);
  const currentHotspotRouteIds = getRouteLookupIds(hotspot);
  const routeProgressRoute = relatedRoutes.find((route) =>
    route.hotspotIds.some((routeHotspotId) =>
      currentHotspotRouteIds.includes(routeHotspotId),
    ),
  );
  const visitedRouteProgressIds = new Set(
    [...checkins, hotspotCheckinId].flatMap((checkedInHotspotId) => {
      const checkedInHotspot = getHotspotBySlug(checkedInHotspotId);

      return checkedInHotspot ? getRouteLookupIds(checkedInHotspot) : [];
    }),
  );
  const visitedRouteStopsCount = routeProgressRoute
    ? routeProgressRoute.hotspotIds.filter((routeHotspotId) =>
        visitedRouteProgressIds.has(routeHotspotId),
      ).length
    : undefined;
  const personalExperienceItems = buildPersonalExperienceItems(
    hotspot,
    galleryPreviewImages,
  );
  const reviewSummaryLabel = buildReviewSummaryLabel({
    apiHotspot: remoteHotspot,
    matchedLocalHotspot,
  });
  const reviewerPreviewEntries: CommunityBoardEntry[] = [
    ...communityBoards.community.entries,
    ...communityBoards.friends.entries,
  ].slice(0, 3);
  const summaryStats = buildSummaryStats({
    apiHotspot: remoteHotspot,
    hotspot,
    matchedLocalHotspot,
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
            "rgba(0, 0, 0, 0.06)",
            "rgba(0, 0, 0, 0.16)",
            "rgba(5, 16, 28, 0.72)",
          ]}
          locations={[0, 0.45, 1]}
          start={{ x: 0.5, y: 0 }}
          end={{ x: 0.5, y: 1 }}
          style={{ bottom: 0, left: 0, position: "absolute", right: 0, top: 0 }}
        />
      </Animated.View>

      <View
        style={{
          left: 0,
          position: "absolute",
          right: 0,
          top: 0,
          zIndex: 3,
        }}
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

              <Animated.View
                pointerEvents="none"
                style={[compactHeaderStyle, { flex: 1, marginHorizontal: 18 }]}
              >
                <Text
                  className="text-center text-[18px] font-black text-white"
                  numberOfLines={1}
                >
                  {hotspot.title}
                </Text>
                <Text className="mt-0.5 text-center text-[13px] font-semibold uppercase tracking-[1px] text-[#C3EAF5]">
                  {hotspot.category}
                </Text>
              </Animated.View>

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
      </View>

      <SafeAreaView className="flex-1" edges={["left", "right", "bottom"]}>
        <Animated.ScrollView
          style={{
            elevation: Platform.OS === "android" ? 2 : undefined,
            flex: 1,
            zIndex: 1,
          }}
          contentContainerStyle={{
            paddingBottom: Math.max(insets.bottom + 98, 114),
            paddingTop: heroHeightExpanded - contentOverlap,
          }}
          onScroll={handleScroll}
          scrollEventThrottle={16}
          showsVerticalScrollIndicator={false}
        >
          <Animated.View
            pointerEvents="box-none"
            style={[
              heroContentStyle,
              {
                left: 0,
                position: "absolute",
                right: 0,
                top: 0,
              },
            ]}
          >
            <View
              className="px-5"
              style={{
                justifyContent: "center",
                minHeight: heroHeightExpanded,
                paddingBottom: Math.max(insets.bottom + 126, 144),
                paddingTop: insets.top + 84,
                width: "100%",
              }}
            >
              <View style={{ maxWidth: 340 }}>
                <View className="flex-row flex-wrap gap-2">
                  <HeroChip
                    icon={{
                      ios: "clock.fill",
                      android: "schedule",
                      web: "schedule",
                    }}
                    label={getBestTimeWindow(hotspot.bestTimeLabel)}
                  />
                  <HeroChip
                    icon={{
                      ios: "location.fill",
                      android: "place",
                      web: "place",
                    }}
                    label={`${hotspot.distance} • ${hotspot.district}`}
                  />
                </View>

                <Text className="mt-4 text-[34px] font-black leading-[38px] text-white">
                  {hotspot.title}
                </Text>

                <Text
                  className="mt-3 text-[16px] leading-6 text-[#D3EEF6]"
                  numberOfLines={4}
                >
                  {hotspot.story}
                </Text>
              </View>
            </View>

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

            <View
              className="absolute inset-x-0 items-center"
              style={{
                bottom: Math.max(contentOverlap + insets.bottom + 164, 190),
              }}
            >
              <ScrollDownHint scrollY={scrollY} />
            </View>
          </Animated.View>

          <Animated.View
            className="rounded-t-[34px] rounded-b-[34px] px-5 pb-6 pt-4"
            style={[
              sheetShadowStyle,
              sheetLiftStyle,
              {
                backgroundColor: panelBackground,
                minHeight: screenHeight,
                position: "relative",
                zIndex: 2,
              },
            ]}
          >
            <Pressable
              className="absolute right-5 z-10 h-12 w-12 items-center justify-center rounded-full"
              onPress={() => router.replace("/hotspots")}
              style={[buttonShadowStyle, { top: -22 }]}
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

            <View className="mt-5">
              <View className="flex-row items-center justify-between gap-3">
                <View className="flex-1">
                  <Text className="text-[13px] font-extrabold uppercase tracking-[1.2px] text-[#EB489B]">
                    Hotspot detail
                  </Text>
                  <Text className="mt-2 text-[31px] font-black leading-[35px] text-[#1E3142]">
                    {hotspot.title}
                  </Text>
                </View>
                <View className="rounded-full bg-[#FFF0F6] px-3 py-2">
                  <Text className="text-[14px] font-semibold uppercase tracking-[0.8px] text-[#EB489B]">
                    {hotspot.category}
                  </Text>
                </View>
              </View>

              <Text className="mt-4 text-[16px] leading-6 text-[#677C8E]">
                {hotspot.overview}
              </Text>

              {remoteHotspotError && localHotspot ? (
                <View className="mt-4 rounded-[22px] bg-[#FFF4E8] px-4 py-3">
                  <Text className="text-[15px] font-bold text-[#B45309]">
                    {`${remoteHotspotError} Đang hiển thị dữ liệu cục bộ.`}
                  </Text>
                </View>
              ) : null}

              <View className="mt-5 flex-row flex-wrap justify-between gap-y-3">
                {summaryStats.map((item, index) => (
                  <View
                    key={`${hotspot.slug}-summary-${index}`}
                    style={{ width: "31.5%" }}
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

              <View className="mt-5 flex-row items-center justify-between">
                <View className="flex-row items-center">
                  {reviewerPreviewEntries.map((entry, index) => (
                    <AvatarPreview
                      key={`${hotspot.slug}-avatar-${index}`}
                      imageUri={entry.avatarUri}
                      index={index}
                    />
                  ))}
                </View>

                <View className="rounded-full bg-[#F7EFF6] px-3 py-2">
                  <Text className="text-[13px] font-bold text-[#7E6F82]">
                    {reviewSummaryLabel}
                  </Text>
                </View>
              </View>

              <View className="mt-5">
                <DirectionMapCard
                  address={hotspot.address}
                  districtLabel={hotspot.district}
                />
              </View>

              <LocationInformationSection
                access={`${hotspot.scheduleLabel} · ${hotspot.ticketLabel}`}
                address={hotspot.address}
                atmosphere={hotspot.vibeTags.join(" • ")}
                bestTime={hotspot.bestTimeLabel}
              />
            </View>

            <View className="mt-7 gap-5">
              <HistoricalInfoSection text={historicalPreview} />

                <HiddenStoryCheckinSection
                  audioStoryDurationLabel={audioStoryDurationLabel}
                  isCheckedIn={isCheckedIn}
                  isCheckinStatusLoading={isRemoteCheckinStatusLoading}
                  isStoryAvailabilityLoading={isStoryAvailabilityLoading}
                  isStoryAvailable={canOpenStories}
                  onCheckinPress={() => setIsCheckinOverlayVisible(true)}
                  onListenStories={() => router.push(hotspotStoriesHref)}
                />
            </View>

            <View className="mt-8 gap-5">
              <RouteMatchesSectionHeader />

              {relatedRoutes.length > 0 ? (
                <ScrollView
                  horizontal
                  contentContainerStyle={{ paddingRight: 4 }}
                  showsHorizontalScrollIndicator={false}
                >
                  {relatedRoutes.map((route, index) => (
                    <View
                      key={`${hotspot.slug}-related-route-${route.id}`}
                      className={
                        index === relatedRoutes.length - 1 ? "" : "mr-3"
                      }
                    >
                      <HotspotRouteCarouselCard route={route} />
                    </View>
                  ))}
                </ScrollView>
              ) : (
                <View
                  className="rounded-[28px] bg-white px-5 py-5"
                  style={cardShadowStyle}
                >
                  <Text className="text-[17px] font-black text-[#1E3142]">
                    Chua co route truc tiep
                  </Text>
                  <Text className="mt-2 text-[16px] leading-6 text-[#5E7486]">
                    Hotspot nay hien chua duoc gan vao mot tuyen route cu the
                    trong du lieu mau.
                  </Text>
                </View>
              )}
            </View>

            <PersonalExperienceSection
              isCheckedIn={isCheckedIn}
              items={personalExperienceItems}
            />

            <View className="mt-5 gap-3">
              <Pressable
                className="items-center rounded-[22px] bg-white px-5 py-4"
                onPress={() => router.back()}
                style={cardShadowStyle}
              >
                <Text className="text-[16px] font-bold text-[#254055]">
                  Quay lai hero list
                </Text>
              </Pressable>
            </View>
          </Animated.View>
        </Animated.ScrollView>

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
            isCheckinStatusLoading={isRemoteCheckinStatusLoading}
            onPress={() => setIsCheckinOverlayVisible(true)}
          />
        </Animated.View>

        {isCheckinOverlayVisible ? (
          <HotspotGpsCheckinOverlay
            audioStoryDurationLabel={audioStoryDurationLabel}
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
            rewardXp={rewardXp}
            totalRouteStopsCount={routeProgressRoute?.hotspotIds.length}
            visitedRouteStopsCount={visitedRouteStopsCount}
          />
        ) : null}
      </SafeAreaView>
    </View>
  );
}
