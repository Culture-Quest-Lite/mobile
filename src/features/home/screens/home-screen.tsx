import { SymbolView } from "@/components/ui/symbol-view";
import { Image } from "expo-image";
import { LinearGradient } from "expo-linear-gradient";
import * as Linking from "expo-linking";
import * as Location from "expo-location";
import { Href, useFocusEffect, useRouter } from "expo-router";
import { useCallback, useEffect, useRef, useState } from "react";
import {
    ActivityIndicator,
    Modal,
    Platform,
    Pressable,
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
import { applyLevelProgressToProfile } from "@/features/profile/lib/level-progress";
import { useScreenLayout } from "@/hooks/use-screen-layout";
import {
    type AppCoordinate,
    formatCoordinateLabel,
    getDevelopmentLocationOverride,
    getDeviceCoordinate,
} from "@/lib/location";

import {
    type NearbyHotspotDto,
    getNearbyHotspots,
} from "../api/get-nearby-hotspots";
import { getActiveTagNames } from "../api/get-tags";
import {
    type CommunityBoardTab,
    type NearbyCategoryCard,
    type NearbyPlaceCard,
    type RouteDifficulty,
    activeJourney,
    communityBoards,
    communityTabs,
    featuredRoutes,
    nearbyCategories,
    nearbyPlaces,
    nearbyRoutes,
    voucherMerchants,
} from "../data/home-screen.mock";
import {
    findMatchingHotspotByNameOrCoordinate,
    getApiHotspotRouteSlug,
    getHotspotHref,
    getNearbyHotspotsFromCoordinate,
} from "../data/hotspots";

const gradientColors = ["#EB489B", "#F58752", "#FFC93C"] as const;
const guestPreviewLogo = require("../../../../assets/images/logo3.png");

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

function mapTagNamesToNearbyCategories(tagNames: string[]) {
  return tagNames.map((tagName, index) => ({
    ...resolveThemeCategoryPreset(tagName, index),
    label: tagName,
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

const routeDifficultyStyles: Record<
  RouteDifficulty,
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
  level: number | null;
  name: string;
  username: string;
};

type NearbyPlaceListItem = {
  category: string;
  detailIcon: "location" | "star";
  detailPrimaryText: string;
  detailSecondaryText?: string;
  distance: string;
  hotspotId: number | null;
  imageUri: string;
  key: string;
  reward: string;
  slug: string | null;
  title: string;
};

type NearbyPlacesSectionStatus = "empty" | "fallback" | "loading" | "ready";

const defaultNearbySearchDistanceMeters = 20;
const nearbyDistanceSliderMinimumMeters = 20;
const nearbyDistanceSliderMaximumMeters = 1000;
const nearbyDistanceSliderStepMeters = 20;
const nearbyPlaceFallbackImageUri =
  nearbyPlaces[0]?.imageUri ??
  "https://images.unsplash.com/photo-1500530855697-b586d89ba3ee";
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

function formatCompactCount(value: number | null | undefined) {
  if (typeof value !== "number" || !Number.isFinite(value) || value < 0) {
    return null;
  }

  if (value >= 1000) {
    return `${(value / 1000).toFixed(value >= 10_000 ? 0 : 1)}k`;
  }

  return `${Math.round(value)}`;
}

function getProfileInitials(name: string, username: string) {
  const source = name.trim() || username.replace(/^@+/, "").trim();

  if (!source) {
    return "ME";
  }

  const parts = source.split(/\s+/).filter(Boolean);

  if (parts.length === 1) {
    return parts[0].slice(0, 2).toUpperCase();
  }

  const firstInitial = parts[0][0] ?? "";
  const lastInitial = parts[parts.length - 1][0] ?? "";
  return `${firstInitial}${lastInitial}`.toUpperCase();
}

function getPrimaryNearbyCategory(
  hotspot: NearbyHotspotDto,
  fallbackCategory?: string,
) {
  const tagName = hotspot.tags
    .find((tag) => tag.tagName.trim())
    ?.tagName.trim();

  return tagName || fallbackCategory || "Hotspot";
}

function getPrimaryNearbyImageUri(
  hotspot: NearbyHotspotDto,
  fallbackImageUri?: string,
) {
  const medias = [...hotspot.medias]
    .filter((media) => media.fileUrl.trim())
    .sort((left, right) => {
      const leftOrder = left.displayOrder ?? Number.MAX_SAFE_INTEGER;
      const rightOrder = right.displayOrder ?? Number.MAX_SAFE_INTEGER;

      return leftOrder - rightOrder;
    });

  return (
    medias[0]?.fileUrl.trim() || fallbackImageUri || nearbyPlaceFallbackImageUri
  );
}

function mapLocalNearbyPlaceItem(place: NearbyPlaceCard): NearbyPlaceListItem {
  return {
    category: place.category,
    detailIcon: "star",
    detailPrimaryText: place.rating.toFixed(1),
    detailSecondaryText: `(${place.reviews})`,
    distance: place.distance,
    hotspotId: null,
    imageUri: place.imageUri,
    key: place.slug,
    reward: place.reward,
    slug: place.slug,
    title: place.title,
  };
}

function buildLocalNearbyPlaceItems(
  coordinate?: Pick<AppCoordinate, "latitude" | "longitude"> | null,
) {
  const localPlaces = coordinate
    ? getNearbyHotspotsFromCoordinate(coordinate, nearbyPlaces.length)
    : nearbyPlaces;

  return localPlaces.map(mapLocalNearbyPlaceItem);
}

function buildApiNearbyPlaceItems(
  hotspots: NearbyHotspotDto[],
  currentCoordinate: Pick<AppCoordinate, "latitude" | "longitude">,
): NearbyPlaceListItem[] {
  return hotspots
    .map((hotspot, index) => {
      const matchedLocalHotspot = findMatchingHotspotByNameOrCoordinate({
        hotspotName: hotspot.hotspotName,
        latitude: hotspot.latitude,
        longitude: hotspot.longitude,
      });
      const distanceMeters = getDistanceMeters(currentCoordinate, {
        latitude: hotspot.latitude,
        longitude: hotspot.longitude,
      });
      const remoteAddress = hotspot.address.trim();
      const matchedLocalRating =
        matchedLocalHotspot?.rating !== undefined
          ? matchedLocalHotspot.rating.toFixed(1)
          : null;
      const matchedLocalReviews =
        matchedLocalHotspot?.reviews?.trim() ||
        formatCompactCount(hotspot.point);
      const detailIcon: NearbyPlaceListItem["detailIcon"] = matchedLocalRating
        ? "star"
        : "location";

      return {
        category: getPrimaryNearbyCategory(
          hotspot,
          matchedLocalHotspot?.category,
        ),
        detailIcon,
        detailPrimaryText:
          matchedLocalRating || remoteAddress || "Hotspot từ API",
        detailSecondaryText: matchedLocalRating
          ? `(${matchedLocalReviews ?? "0"})`
          : undefined,
        distance: formatDistanceMeters(distanceMeters),
        hotspotId: hotspot.hotspotId,
        imageUri: getPrimaryNearbyImageUri(
          hotspot,
          matchedLocalHotspot?.imageUri,
        ),
        key: `${hotspot.hotspotId}-${index}`,
        reward: formatRewardLabel(hotspot.xp, matchedLocalHotspot?.reward),
        slug: matchedLocalHotspot?.slug ?? null,
        sortDistanceMeters: distanceMeters,
        title:
          hotspot.hotspotName.trim() || matchedLocalHotspot?.title || "Hotspot",
      };
    })
    .sort((left, right) => left.sortDistanceMeters - right.sortDistanceMeters)
    .map(({ sortDistanceMeters: _sortDistanceMeters, ...item }) => item);
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
      fallbackMessage:
        "Bật GPS để tải hotspot gần bạn. Đang hiển thị dữ liệu demo.",
    };
  }

  const permission = await Location.getForegroundPermissionsAsync();
  const permissionResponse =
    permission.granted || !permission.canAskAgain
      ? permission
      : await Location.requestForegroundPermissionsAsync();

  if (permissionResponse.status !== "granted") {
    return {
      coordinate: null,
      fallbackMessage:
        "Cho phép truy cập vị trí để tải hotspot gần bạn. Đang hiển thị dữ liệu demo.",
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
      fallbackMessage:
        "Không xác định được vị trí hiện tại. Đang hiển thị dữ liệu demo.",
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
                  Guest mode
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
                Mở khóa story
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
    <View className="gap-1.5">
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
        <Text className="text-[11px] font-semibold text-[#A29AA8]">
          {formatDistanceMeters(min)}
        </Text>
        <Text className="text-[11px] font-semibold text-[#A29AA8]">
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
      className="overflow-hidden rounded-[28px] border border-[#F6DDD0] bg-white px-4 py-3"
      style={cardShadowStyle}
    >
      <LinearGradient
        colors={["#FFFFFF", "#FFF7FB", "#FFF7F1"]}
        end={{ x: 1, y: 1 }}
        start={{ x: 0, y: 0 }}
        className="absolute inset-0"
      />

      <View className="flex-row items-start gap-2.5">
        <LinearGradient
          colors={["#FF8A50", "#FF5F87"]}
          end={{ x: 1, y: 1 }}
          start={{ x: 0, y: 0 }}
          className="h-10 w-10 items-center justify-center rounded-full"
        >
          <SymbolView
            name={{
              ios: "flame.fill",
              android: "local_fire_department",
              web: "local_fire_department",
            }}
            size={16}
            tintColor="#FFFFFF"
          />
        </LinearGradient>

        <View className="flex-1">
          <Text className="text-[18px] font-extrabold tracking-[-0.2px] text-[#2B2233]">
            Hotspot gần bạn
          </Text>
          <Text className="mt-0.5 text-[12px] font-medium text-[#9C94A5]">
            Bán kính tìm kiếm
          </Text>
        </View>

        <LinearGradient
          colors={gradientColors}
          end={{ x: 1, y: 0.5 }}
          locations={[0, 0.58, 1]}
          start={{ x: 0, y: 0.5 }}
          className="rounded-full px-3 py-1.5"
        >
          <Text className="text-[13px] font-extrabold text-white">
            {formatDistanceMeters(draftDistanceMeters)}
          </Text>
        </LinearGradient>
      </View>

      <View className="mt-4">
        <NearbyDistanceSlider
          max={nearbyDistanceSliderMaximumMeters}
          min={nearbyDistanceSliderMinimumMeters}
          onChange={onChangeDistance}
          value={draftDistanceMeters}
        />
      </View>

      <View className="mt-4 flex-row gap-2.5">
        <Pressable
          className="flex-1 flex-row items-center justify-center rounded-[16px] border border-[#E3E7EF] bg-white px-3.5 py-3"
          onPress={onOpenMap}
        >
          <SymbolView
            name={{ ios: "map.fill", android: "map", web: "map" }}
            size={14}
            tintColor="#374151"
          />
          <Text className="ml-1.5 text-[14px] font-bold text-[#2F3947]">
            Xem bản đồ
          </Text>
        </Pressable>

        <Pressable
          className={`flex-1 overflow-hidden rounded-[16px] ${
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
            className="flex-row items-center justify-center rounded-[16px] px-3.5 py-3"
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
                  size={14}
                  tintColor="#FFFFFF"
                />
                <Text className="ml-1.5 text-[14px] font-extrabold text-white">
                  Áp dụng
                </Text>
              </>
            )}
          </LinearGradient>
        </Pressable>
      </View>

      <View className="mt-2.5 flex-row items-center justify-end">
        <Text className="text-[11px] font-medium text-[#B3A6AF]">
          Đang áp dụng:{" "}
        </Text>
        <Text className="text-[11px] font-bold text-[#8E869A]">
          {formatDistanceMeters(currentDistanceMeters)}
        </Text>
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
            <Text className="text-[19px] font-extrabold tracking-[-0.3px] text-[#2B2233]">
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
          <Text className="text-[14px] font-bold text-[#8E869A]">
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
}: ExplorerSummary) {
  const [failedAvatar, setFailedAvatar] = useState<string | null>(null);
  const initials = getProfileInitials(name, username);
  const shouldShowFallback = !avatar || failedAvatar === avatar;

  return (
    <View className="relative">
      <LinearGradient
        colors={gradientColors}
        end={{ x: 1, y: 0.9 }}
        start={{ x: 0, y: 0.1 }}
        className="h-16 w-16 rounded-full p-[2px]"
      >
        <View className="flex-1 rounded-full bg-white p-[3px]">
          {shouldShowFallback ? (
            <View className="flex-1 items-center justify-center rounded-full bg-[#FFF1F6]">
              <Text className="text-[18px] font-black text-[#D9587F]">
                {initials}
              </Text>
            </View>
          ) : (
            <Image
              source={avatar}
              contentFit="cover"
              transition={180}
              cachePolicy="memory-disk"
              onError={() => setFailedAvatar(avatar)}
              style={{ flex: 1, borderRadius: 999 }}
            />
          )}
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
}: {
  isDistanceDropdownVisible: boolean;
  isLocationLoading: boolean;
  onLocationPress: () => void;
  onSearchPress: () => void;
}) {
  const router = useRouter();
  return (
    <View className="flex-row items-center gap-2.5">
      <Pressable
        accessibilityLabel="Mở bộ lọc nearby"
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

      <Pressable className="h-10 w-10 items-center justify-center rounded-full bg-[#FFF4EF]">
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

      <Pressable
        accessibilityLabel="Mở trang Subscription"
        className="h-10 w-10 items-center justify-center rounded-full bg-[#F3F8FF]"
        onPress={() => router.push('/subscription' as Href)}
      >
        <SymbolView
          name={{ ios: 'card', android: 'credit_card', web: 'credit_card' }}
          size={16}
          tintColor="#3B82F6"
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
                Bản đồ chỉ hỗ trợ trên Android/iOS
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
  const [themeCategories, setThemeCategories] = useState<NearbyCategoryCard[]>(
    [],
  );
  const [activeCommunityTab, setActiveCommunityTab] =
    useState<CommunityBoardTab>("community");
  const isGuest = authSession.role === "guest";
  const routeCardLeftInset = gutter;
  const routeCardWidth = Math.max(contentWidth, 264);
  const nearbyRouteCardWidth = Math.min(
    Math.max(contentWidth * 0.72, 220),
    252,
  );
  const nearbyPlaceCardWidth = Math.min(
    Math.max(contentWidth * 0.46, 156),
    170,
  );
  const nearbyPlaceImageHeight = Math.round(nearbyPlaceCardWidth * 0.8);
  const voucherMerchantCircleSize = Math.min(
    Math.max(contentWidth * 0.22, 76),
    86,
  );
  const voucherMerchantLogoSize = Math.round(voucherMerchantCircleSize * 0.88);
  const voucherMerchantItemWidth = voucherMerchantCircleSize + 14;
  const currentJourney =
    !isGuest && activeJourney && !activeJourney.completed
      ? activeJourney
      : null;
  const activeJourneyProgress = currentJourney
    ? Math.min(Math.max(currentJourney.progress, 0), 100)
    : 0;
  const activeCommunityBoard = communityBoards[activeCommunityTab];
  const activeFeaturedRoute = featuredRoutes[activeRouteIndex];
  const explorerName =
    explorerSummary?.name.trim() ||
    authSession.displayName.trim() ||
    authSession.username?.trim() ||
    "Ngọc";
  const explorerAvatar = explorerSummary?.avatar ?? null;
  const explorerLevel = explorerSummary?.level ?? null;
  const explorerUsername =
    explorerSummary?.username.trim() ||
    authSession.username?.trim() ||
    explorerName;
  const handleOpenHotspots = () => {
    router.push("/hotspots");
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
    const intervalId = setInterval(() => {
      const nextIndex =
        (activeRouteIndexRef.current + 1) % featuredRoutes.length;

      activeRouteIndexRef.current = nextIndex;
      setActiveRouteIndex(nextIndex);
    }, 3600);

    return () => {
      clearInterval(intervalId);
    };
  }, []);

  useEffect(() => {
    let isActive = true;

    async function loadNearbyPlaces() {
      setNearbyPlacesStatus("loading");
      setNearbyPlacesNote(null);

      try {
        const { coordinate, fallbackMessage } =
          await resolveNearbyRequestCoordinate();
        const fallbackNearbyPlaces = buildLocalNearbyPlaceItems(coordinate);

        if (!isActive) {
          return;
        }

        if (!coordinate) {
          setResolvedNearbyPlaces(fallbackNearbyPlaces);
          setNearbyPlacesNote(fallbackMessage);
          setNearbyPlacesStatus("fallback");
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
              ? `API nearby trả rỗng trong bán kính ${formatDistanceMeters(nearbySearchDistanceMeters)} quanh tọa độ test ${formatCoordinateLabel(coordinate)}.`
              : `Không có hotspot trong bán kính ${formatDistanceMeters(nearbySearchDistanceMeters)} quanh vị trí hiện tại.`,
          );
          setNearbyPlacesStatus("empty");
          return;
        }

        setResolvedNearbyPlaces(
          buildApiNearbyPlaceItems(apiNearbyHotspots, coordinate),
        );
        setNearbyPlacesNote(
          coordinate.source === "dev-override"
            ? `Đang hiển thị hotspot API trong bán kính ${formatDistanceMeters(nearbySearchDistanceMeters)} quanh tọa độ test ${formatCoordinateLabel(coordinate)}.`
            : null,
        );
        setNearbyPlacesStatus("ready");
      } catch (error) {
        console.warn("[home] load nearby places failed", {
          error: error instanceof Error ? error.message : error,
        });

        if (!isActive) {
          return;
        }

        setResolvedNearbyPlaces(buildLocalNearbyPlaceItems());
        setNearbyPlacesNote(
          `${
            error instanceof Error
              ? error.message
              : "Không tải được nearby API."
          } Đang hiển thị dữ liệu demo.`,
        );
        setNearbyPlacesStatus("fallback");
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

        const tagNames = await getActiveTagNames({
          accessToken,
          tokenType: authSession.tokenType,
        });

        if (!isActive) {
          return;
        }

        setThemeCategories(mapTagNamesToNearbyCategories(tagNames));
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

          setExplorerSummary({
            avatar: profile.avatar?.trim() || null,
            level: profile.level,
            name: resolvedName || "Ngọc",
            username: profile.username.trim(),
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
    }, [authSession.isAuthenticated, authSession.tokenType]),
  );

  return (
    <SafeAreaView
      className="flex-1 bg-white"
      edges={["top", "left", "right", "bottom"]}
    >
      <ScrollView
        className="flex-1"
        contentContainerStyle={{ paddingBottom: 0 }}
        showsVerticalScrollIndicator={false}
      >
        <View className="gap-6 pt-1" style={{ paddingHorizontal: gutter }}>
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

          <View className="gap-4">
            <Text className="text-[17px] font-extrabold text-[#2B2233]">
              Tuyến nổi bật
            </Text>

            <View
              className="items-start"
              style={{
                marginHorizontal: -gutter,
                width: safeWidth,
                paddingLeft: routeCardLeftInset,
              }}
            >
              <View
                key={activeFeaturedRoute.title}
                className="overflow-hidden rounded-[30px] bg-[#2B2233]"
                style={[
                  heroShadowStyle,
                  {
                    width: routeCardWidth,
                  },
                ]}
              >
                <Image
                  source={activeFeaturedRoute.imageUri}
                  contentFit="cover"
                  transition={220}
                  cachePolicy="memory-disk"
                  style={{ height: 210, width: "100%" }}
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
                  <View className="flex-1 justify-end gap-3">
                    <View className="flex-row items-start justify-between gap-3">
                      <View className="max-w-[78%] gap-2">
                        <View className="gap-1">
                          <Text className="text-[21px] font-extrabold leading-6 text-white">
                            {activeFeaturedRoute.title}
                          </Text>
                        </View>
                        <View className="gap-3">
                          <View className="flex-row flex-wrap gap-2">
                            <View className="rounded-full bg-white/18 px-3 py-1.5">
                              <Text className="text-[11px] font-bold text-white">
                                {activeFeaturedRoute.stops}
                              </Text>
                            </View>
                            <View className="rounded-full bg-white/18 px-3 py-1.5">
                              <Text className="text-[11px] font-bold text-white">
                                {activeFeaturedRoute.distance}
                              </Text>
                            </View>
                            <View className="rounded-full bg-white/18 px-3 py-1.5">
                              <Text className="text-[11px] font-bold text-white">
                                {activeFeaturedRoute.duration}
                              </Text>
                            </View>
                          </View>

                          <View className="flex-row items-end">
                            <Pressable className="rounded-full bg-white/92 px-4 py-2.5">
                              <Text className="text-[14px] font-extrabold text-[#D9587F]">
                                Xem route
                              </Text>
                            </Pressable>
                          </View>
                        </View>
                      </View>

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
              </View>
            </View>

            <View
              className="flex-row items-center justify-center gap-2"
              style={{ paddingHorizontal: gutter }}
            >
              {featuredRoutes.map((route, index) => (
                <Pressable
                  key={route.title}
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
          </View>

          {isGuest ? (
            <GuestAccessCard onPress={handleOpenRegister} />
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
                    source={currentJourney.imageUri}
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
                  </View>
                </View>

                <View className="-mt-9 gap-4 px-4 pb-4">
                  <View className="flex-row items-center gap-3">
                    <View className="shrink-0 rounded-full bg-white p-1.5">
                      <JourneyProgressRing progress={activeJourneyProgress} />
                    </View>

                    <View className="flex-1 gap-1.5 pt-4">
                      <Text className="text-[16px] font-extrabold text-[#2B2233]">
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
                        <Text className="text-[13px] text-[#6F657A]">
                          Tiếp theo: {currentJourney.nextStop} ·{" "}
                          {currentJourney.distanceToNext}
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
                        {currentJourney.remainingStopsLabel} ·{" "}
                        {currentJourney.remainingTimeLabel}
                      </Text>
                    </View>
                  </View>

                  <Pressable className="overflow-hidden rounded-[18px]">
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
            <View className="flex-row items-center justify-between">
              <Pressable hitSlop={8} onPress={handleOpenHotspots}>
                <Text className="text-[18px] font-extrabold text-[#2B2233]">
                  Địa điểm gần bạn
                </Text>
              </Pressable>
              <Pressable
                className="rounded-full bg-[#FFF4EF] px-3.5 py-2"
                onPress={handleOpenHotspots}
              >
                <Text className="text-[12px] font-bold text-[#F58752]">
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
              <View className="rounded-[22px] border border-[#EEF1F4] bg-[#FAF7FC] px-4 py-4">
                <Text className="text-[15px] font-bold text-[#3B4454]">
                  Đang tải hotspot gần bạn...
                </Text>
                <Text className="mt-1 text-[13px] leading-5 text-[#8E869A]">
                  {`App đang lấy vị trí hiện tại và gọi nearby API trong bán kính ${formatDistanceMeters(nearbySearchDistanceMeters)}.`}
                </Text>
              </View>
            ) : nearbyPlacesStatus === "empty" ? (
              <View className="rounded-[22px] border border-[#EEF1F4] bg-[#FAF7FC] px-4 py-4">
                <Text className="text-[15px] font-bold text-[#3B4454]">
                  Chưa có hotspot gần vị trí này
                </Text>
                <Text className="mt-1 text-[13px] leading-5 text-[#8E869A]">
                  {nearbyPlacesNote ??
                    "Nearby API đang trả mảng rỗng cho tọa độ hiện tại."}
                </Text>
              </View>
            ) : (
              <ScrollView
                horizontal
                contentContainerStyle={{ paddingRight: 8 }}
                showsHorizontalScrollIndicator={false}
              >
                {resolvedNearbyPlaces.map((place, index) => (
                  <Pressable
                    key={place.key}
                    className={
                      index === resolvedNearbyPlaces.length - 1 ? "" : "mr-3.5"
                    }
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
                    style={{ width: nearbyPlaceCardWidth }}
                  >
                    <View
                      className="overflow-hidden rounded-[22px] border border-[#EEF1F4] bg-white"
                      style={nearbyPlaceShadowStyle}
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

                          <View className="rounded-full bg-[#f0af16] px-2.5 py-1">
                            <Text className="text-[11px] font-extrabold text-[#2B2233]">
                              {place.reward} XP
                            </Text>
                          </View>
                        </View>
                      </View>

                      <View className="gap-2 px-3.5 pb-3.5 pt-3">
                        <Text
                          className="text-[14px] font-extrabold leading-[18px] text-[#3B4454]"
                          numberOfLines={2}
                        >
                          {place.title}
                        </Text>

                        <Text className="text-[13px] text-[#A39AAB]">
                          {place.category}
                        </Text>

                        <View className="flex-row items-center gap-1">
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
                            <Text className="text-[12px] text-[#8E869A]">
                              {place.detailSecondaryText}
                            </Text>
                          ) : null}
                        </View>
                      </View>
                    </View>
                  </Pressable>
                ))}
              </ScrollView>
            )}

            <Text className="text-[18px] font-extrabold text-[#2B2233]">
              Chủ đề
            </Text>

            <ScrollView
              horizontal
              contentContainerStyle={{ paddingRight: 12 }}
              showsHorizontalScrollIndicator={false}
            >
              {themeCategories.map((item, index) => (
                <Pressable
                  key={`${item.label}-${index}`}
                  className={
                    index === themeCategories.length - 1 ? "" : "mr-3.5"
                  }
                >
                  <View
                    className="h-[104px] w-[104px] items-center justify-center rounded-[22px] p-4"
                    style={{ backgroundColor: item.background }}
                  >
                    <View className="items-center justify-center">
                      <SymbolView
                        name={item.icon}
                        size={16}
                        tintColor={item.accent}
                      />
                    </View>

                    <Text
                      className="mt-3 text-center text-[13px] font-extrabold leading-4 text-[#2F2A35]"
                      numberOfLines={2}
                    >
                      {item.label}
                    </Text>
                  </View>
                </Pressable>
              ))}
            </ScrollView>

            <Text className="text-[18px] font-extrabold text-[#2B2233]">
              Đề xuất tuyến đường
            </Text>

            <ScrollView
              horizontal
              contentContainerStyle={{ paddingRight: 8 }}
              showsHorizontalScrollIndicator={false}
            >
              {nearbyRoutes.map((route, index) => (
                <Pressable
                  key={route.title}
                  className={index === nearbyRoutes.length - 1 ? "" : "mr-4"}
                  style={{ width: nearbyRouteCardWidth }}
                >
                  <View
                    className="overflow-hidden rounded-[24px] border border-[#EEF1F4] bg-white"
                    style={cardShadowStyle}
                  >
                    <View className="relative">
                      <Image
                        source={route.imageUri}
                        contentFit="cover"
                        transition={220}
                        cachePolicy="memory-disk"
                        style={{ height: 128, width: "100%" }}
                      />

                      <View className="absolute right-3 top-3 rounded-full bg-[#FFF1F6] px-2.5 py-1">
                        <Text className="text-[11px] font-extrabold text-[#EB489B]">
                          {route.xp}
                        </Text>
                      </View>
                    </View>

                    <View className="gap-2.5 px-4 pb-4 pt-3.5">
                      <View className="flex-row flex-wrap items-center gap-2">
                        <View className="rounded-full bg-[#FFF1F6] px-2.5 py-1">
                          <Text className="text-[11px] font-extrabold text-[#EB489B]">
                            {route.distance}
                          </Text>
                        </View>
                        <View className="rounded-full bg-[#FFF4EF] px-2.5 py-1">
                          <Text className="text-[11px] font-extrabold text-[#F58752]">
                            {route.duration}
                          </Text>
                        </View>

                        <View
                          className="rounded-full px-2.5 py-1"
                          style={{
                            backgroundColor:
                              routeDifficultyStyles[route.difficulty]
                                .background,
                          }}
                        >
                          <Text
                            className="text-[11px] font-extrabold"
                            style={{
                              color:
                                routeDifficultyStyles[route.difficulty].color,
                            }}
                          >
                            {route.difficulty}
                          </Text>
                        </View>
                      </View>

                      <Text
                        className="text-[16px] font-extrabold leading-4 text-[#2B2233]"
                        numberOfLines={1}
                      >
                        {route.title}
                      </Text>

                      <Text
                        className="text-[13px] leading-[18px] text-[#8E869A]"
                        numberOfLines={2}
                      >
                        {route.subtitle}
                      </Text>
                    </View>
                  </View>
                </Pressable>
              ))}
            </ScrollView>

            <View className="gap-4">
              <View className="flex-row items-start justify-between gap-3">
                <View className="flex-1">
                  <Text className="text-[18px] font-extrabold text-[#2B2233]">
                    Voucher ưu đãi
                  </Text>
                </View>

                <Pressable className="rounded-full bg-[#FFF4EF] px-3.5 py-2">
                  <Text className="text-[12px] font-bold text-[#F58752]">
                    Xem tất cả
                  </Text>
                </Pressable>
              </View>

              <View
                className="gap-5 rounded-[28px]  bg-white p-4"
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

          <View
            className="overflow-hidden rounded-[28px] bg-white"
            style={cardShadowStyle}
          >
            <View className="px-4 pb-4 pt-4">
              <View className="flex-row items-center justify-between">
                <View className="flex-row items-center gap-2.5">
                  <View className="h-7 w-7 items-center justify-center rounded-full bg-[#FFF1D6]">
                    <SymbolView
                      name={{
                        ios: "trophy.fill",
                        android: "emoji_events",
                        web: "emoji_events",
                      }}
                      size={15}
                      tintColor="#C98A10"
                    />
                  </View>
                  <Text className="text-[18px] font-extrabold text-[#1F2940]">
                    Cộng đồng hôm nay
                  </Text>
                </View>

                <Text className="text-[12px] font-bold uppercase tracking-[0.3px] text-[#FF6F95]">
                  BXH
                </Text>
              </View>

              <View className="mt-4 flex-row items-end justify-between border-b border-[#F3E7ED]">
                <View className="flex-row">
                  {communityTabs.map((tab) => {
                    const isActive = activeCommunityTab === tab.key;

                    return (
                      <Pressable
                        key={tab.key}
                        className="mr-6 pb-3"
                        onPress={() => {
                          setActiveCommunityTab(tab.key);
                        }}
                      >
                        <Text
                          className={`text-[13px] font-bold ${
                            isActive ? "text-[#FF5F87]" : "text-[#7D7281]"
                          }`}
                        >
                          {tab.label}
                        </Text>
                        <View
                          className={`mt-2 h-[2.5px] rounded-full ${
                            isActive ? "bg-[#FF5F87]" : "bg-transparent"
                          }`}
                        />
                      </Pressable>
                    );
                  })}
                </View>

                <View className="mb-3 flex-row items-center">
                  <SymbolView
                    name={{
                      ios: "chart.line.uptrend.xyaxis",
                      android: "show_chart",
                      web: "show_chart",
                    }}
                    size={12}
                    tintColor="#7D7281"
                  />
                  <Text className="ml-1 text-[11px] font-semibold text-[#7D7281]">
                    Live
                  </Text>
                </View>
              </View>

              <View className="mt-4 gap-3">
                <LinearGradient
                  colors={["#FFF6F9", "#FFF1F5"]}
                  start={{ x: 0, y: 0.5 }}
                  end={{ x: 1, y: 0.5 }}
                  className="flex-row items-center rounded-[22px] border border-[#F9E2EA] px-3.5 py-3.5"
                >
                  <View className="mr-3 h-10 w-10 items-center justify-center rounded-full bg-[#FFE8F0]">
                    <Text className="text-[12px] font-black text-[#FF5F87]">
                      #{activeCommunityTab === "community" ? "24" : "01"}
                    </Text>
                  </View>

                  <View className="flex-1 pr-3">
                    <Text className="text-[14px] font-extrabold text-[#1F2940]">
                      {activeCommunityBoard.summaryLabel}
                    </Text>
                    <Text className="mt-0.5 text-[11px] leading-4 text-[#9B8D9A]">
                      {activeCommunityBoard.summaryNote}
                    </Text>
                  </View>

                  <View className="flex-row items-center rounded-full border border-[#F8D8E3] bg-white px-3 py-1.5">
                    <SymbolView
                      name={{
                        ios: "star.fill",
                        android: "star",
                        web: "star",
                      }}
                      size={12}
                      tintColor="#FF5F87"
                    />
                    <Text className="ml-1 text-[12px] font-extrabold text-[#1F2940]">
                      {activeCommunityBoard.totalPoints}
                    </Text>
                  </View>
                </LinearGradient>

                <View className="gap-3">
                  {activeCommunityBoard.entries.map((entry, index) => (
                    <View
                      key={`${activeCommunityTab}-${entry.name}`}
                      className="flex-row items-center rounded-[24px] border border-[#EEF1F4] bg-white px-3.5 py-3"
                      style={communityRowShadowStyle}
                    >
                      <View className="relative mr-3.5 h-12 w-12 items-center justify-center">
                        <View
                          className="items-center justify-center rounded-full bg-white"
                          style={{
                            borderColor:
                              communityRankRingColors[
                                Math.min(
                                  index,
                                  communityRankRingColors.length - 1,
                                )
                              ],
                            borderWidth: 2.5,
                            height: 46,
                            width: 46,
                          }}
                        >
                          <View className="h-[38px] w-[38px] overflow-hidden rounded-full bg-[#F3F4F6]">
                            <Image
                              source={entry.avatarUri}
                              contentFit="cover"
                              transition={180}
                              cachePolicy="memory-disk"
                              style={{ height: "100%", width: "100%" }}
                            />
                          </View>
                        </View>

                        <View
                          className="absolute bottom-0 right-0 h-6 w-6 items-center justify-center rounded-full border-[2px] border-white"
                          style={{
                            backgroundColor:
                              communityRankBadgeColors[
                                Math.min(
                                  index,
                                  communityRankBadgeColors.length - 1,
                                )
                              ],
                          }}
                        >
                          <Text className="text-[13px] font-black text-white">
                            {index + 1}
                          </Text>
                        </View>
                      </View>

                      <View className="flex-1 pr-3">
                        <Text className="text-[15px] font-extrabold text-[#1F2940]">
                          {entry.name}
                        </Text>
                        <Text className="mt-0.5 text-[12px] leading-4 text-[#8F8290]">
                          {entry.subtitle}
                        </Text>
                      </View>

                      <View className="flex-row items-center rounded-full border border-[#F4DCE5] bg-white px-3 py-1.5">
                        <SymbolView
                          name={{
                            ios: "star.fill",
                            android: "star",
                            web: "star",
                          }}
                          size={11}
                          tintColor="#FF5F87"
                        />
                        <Text className="ml-1 text-[12px] font-extrabold text-[#1F2940]">
                          {entry.points}
                        </Text>
                      </View>
                    </View>
                  ))}
                </View>
              </View>
            </View>

            <Pressable className="border-t border-[#F3E7ED] px-4 py-3">
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
                <Text className="ml-1.5 text-[13px] font-bold text-[#FF5F87]">
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
