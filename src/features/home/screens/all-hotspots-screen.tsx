import { SymbolView } from "@/components/ui/symbol-view";
import { ScreenHorizontalPadding } from "@/constants/theme";
import { Image as ExpoImage } from "expo-image";
import * as Location from "expo-location";
import { useRouter } from "expo-router";
import { memo, useCallback, useEffect, useRef, useState } from "react";
import {
  ActivityIndicator,
  FlatList,
  Image as RNImage,
  type ListRenderItemInfo,
  NativeScrollEvent,
  NativeSyntheticEvent,
  Platform,
  Pressable,
  ScrollView,
  Text,
  TextInput,
  View,
  useWindowDimensions,
} from "react-native";
import {
  Gesture,
  GestureDetector,
  GestureHandlerRootView,
} from "react-native-gesture-handler";
import MapView, { Marker, PROVIDER_GOOGLE, type Region } from "react-native-maps";
import Animated, {
  interpolate,
  runOnJS,
  useAnimatedStyle,
  useSharedValue,
  withSpring,
} from "react-native-reanimated";
import {
  SafeAreaView,
  useSafeAreaInsets,
} from "react-native-safe-area-context";

import { AppLoadingScreen } from "@/components/ui/app-loading-screen";
import {
  getValidAccessToken,
  useAuthSession,
} from "@/features/auth/hooks/use-auth-session";
import {
  type AppCoordinate,
  ensureForegroundLocationPermission,
  formatCoordinateLabel,
  getDevelopmentLocationOverride,
  getDeviceCoordinate,
} from "@/lib/location";

import {
  getNearbyHotspots,
  type NearbyHotspotDto,
} from "../api/get-nearby-hotspots";
import { searchHotspots } from "../api/search-hotspots";
import { getApiHotspotRouteSlug, getHotspotHref } from "../data/hotspots";

const fixedNearbyDistanceMeters = 10_000;
const nearbyPlaceFallbackImageUri =
  "https://images.unsplash.com/photo-1500530855697-b586d89ba3ee";
const defaultNearbyRegion: Region = {
  latitude: 10.8414,
  longitude: 106.8288,
  latitudeDelta: 0.18,
  longitudeDelta: 0.18,
};
const mapMarkerLogo = require("../../../../assets/images/logo3.png");
const mapMarkerSize = 44;

type HotspotCollectionListItem = {
  address: string | null;
  category: string | null;
  distanceLabel: string;
  distanceMeters: number;
  hotspotId: number | null;
  imageUri: string;
  isCheckedIn: boolean;
  key: string;
  latitude: number;
  longitude: number;
  openingHours: string | null;
  rating: string | null;
  reward: string;
  reviewCount: string | null;
  slug: string;
  tags: string[];
  title: string;
};

type NearbyCollectionStatus = "empty" | "loading" | "ready";
type SearchCollectionStatus = "error" | "idle" | "loading" | "ready";

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

function formatReviewCount(value: number | null | undefined) {
  const compactCount = formatCompactCount(value);

  return compactCount ? `${compactCount} đánh giá` : null;
}

function formatRating(value: number | null | undefined) {
  if (typeof value !== "number" || !Number.isFinite(value)) {
    return null;
  }

  return Math.max(0, Math.min(5, value)).toFixed(1);
}

function readMeaningfulText(value?: string | null) {
  const trimmedValue = value?.trim();

  return trimmedValue ? trimmedValue : null;
}

function formatApiTimeValue(value?: string | null) {
  const meaningfulValue = readMeaningfulText(value);

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

function resolveOpeningHoursLabel(hotspot: NearbyHotspotDto) {
  return (
    formatApiTimeWindow(hotspot.openingTime, hotspot.closingTime) ??
    formatApiTimeWindow(hotspot.startTime, hotspot.endTime)
  );
}

function getPrimaryNearbyCategory(hotspot: NearbyHotspotDto) {
  const tagName = hotspot.tags
    .find((tag) => tag.tagName.trim())
    ?.tagName.trim();

  return tagName || null;
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

function getHotspotTags(hotspot: NearbyHotspotDto) {
  return Array.from(
    new Set(
      hotspot.tags
        .map((tag) => tag.tagName.trim())
        .filter(Boolean)
        .slice(0, 4),
    ),
  );
}

function buildApiHotspotItems(
  hotspots: NearbyHotspotDto[],
  currentCoordinate: Pick<AppCoordinate, "latitude" | "longitude">,
): HotspotCollectionListItem[] {
  return hotspots
    .map((hotspot, index) => {
      const distanceMeters = getDistanceMeters(currentCoordinate, {
        latitude: hotspot.latitude,
        longitude: hotspot.longitude,
      });
      const category = getPrimaryNearbyCategory(hotspot);

      return {
        address: readMeaningfulText(hotspot.address),
        category,
        distanceLabel: formatDistanceMeters(distanceMeters),
        distanceMeters,
        hotspotId: hotspot.hotspotId,
        imageUri: getPrimaryNearbyImageUri(hotspot),
        isCheckedIn: hotspot.isCheckedIn === true,
        key: `${hotspot.hotspotId}-${index}`,
        latitude: hotspot.latitude,
        longitude: hotspot.longitude,
        openingHours: resolveOpeningHoursLabel(hotspot),
        rating: formatRating(hotspot.averageRating),
        reward: formatRewardLabel(hotspot.xp),
        reviewCount: formatReviewCount(hotspot.totalReviews),
        slug: getApiHotspotRouteSlug(hotspot.hotspotId),
        tags: getHotspotTags(hotspot),
        title: hotspot.hotspotName.trim() || "Địa điểm",
        sortDistanceMeters: distanceMeters,
      };
    })
    .sort((left, right) => left.sortDistanceMeters - right.sortDistanceMeters)
    .map(({ sortDistanceMeters: _sortDistanceMeters, ...item }) => item);
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
      fallbackMessage: "Bật GPS để tải danh sách địa điểm gần bạn.",
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

function getRegionFromCoordinate(
  coordinate: Pick<AppCoordinate, "latitude" | "longitude"> | null,
): Region {
  if (!coordinate) {
    return defaultNearbyRegion;
  }

  const delta = Math.max(0.12, (fixedNearbyDistanceMeters * 1.9) / 111_000);

  return {
    latitude: coordinate.latitude,
    longitude: coordinate.longitude,
    latitudeDelta: delta,
    longitudeDelta: delta,
  };
}

const NearbyListRow = memo(function NearbyListRow({
  isLast,
  onNavigate,
  place,
}: {
  isLast: boolean;
  onNavigate: () => void;
  place: HotspotCollectionListItem;
}) {
  const visibleTags = place.tags.length > 0 ? place.tags.slice(0, 2) : [];
  const ratingLabel =
    place.rating && place.reviewCount
      ? `${place.rating} (${place.reviewCount})`
      : place.rating ?? place.reviewCount;
  const statusLabel = place.isCheckedIn ? "Đã check-in" : `${place.reward} XP`;

  return (
    <Pressable onPress={onNavigate}>
      <View
        className={isLast ? "bg-white py-2.5" : "border-b border-[#ECE7EE] bg-white py-2.5"}
      >
        <View className="flex-row">
          <View className="relative">
            <ExpoImage
              source={place.imageUri}
              cachePolicy="memory-disk"
              contentFit="cover"
              style={{ borderRadius: 12, height: 128, width: 128 }}
              transition={220}
            />

          </View>

          <View className="ml-3 flex-1 justify-between py-[2px]">
            <View className="gap-px">
              <View className="flex-row items-start gap-2">
                <Text
                  className="flex-1 text-[14px] font-semibold text-[#3B4454]"
                  numberOfLines={2}
                  style={{ lineHeight: 15 }}
                >
                  {place.title}
                </Text>

                <View
                  className={`rounded-full px-3 py-[5px] ${
                    place.isCheckedIn ? "bg-[#DCFCE7]" : "bg-[#F0AF16]"
                  }`}
                >
                  <Text
                    className={`text-[10px] font-normal ${
                      place.isCheckedIn ? "text-[#15803D]" : "text-[#2B2233]"
                    }`}
                  >
                    {statusLabel}
                  </Text>
                </View>
              </View>

              {place.openingHours ? (
                <View className="flex-row items-center gap-1">
                  <SymbolView
                    name={{
                      ios: "clock.fill",
                      android: "schedule",
                      web: "schedule",
                    }}
                    size={10}
                    tintColor="#A39AAB"
                  />
                  <Text
                    className="flex-1 text-[12px] text-[#A39AAB]"
                    numberOfLines={1}
                    style={{ lineHeight: 12 }}
                  >
                    {place.openingHours}
                  </Text>
                </View>
              ) : null}

              {ratingLabel ? (
                <View className="flex-row items-center gap-1">
                  <SymbolView
                    name={{ ios: "star.fill", android: "star", web: "star" }}
                    size={10}
                    tintColor="#F58752"
                  />
                  <Text
                    className="text-[12px] font-normal text-[#F58752]"
                    style={{ lineHeight: 12 }}
                  >
                    {ratingLabel}
                  </Text>
                </View>
              ) : null}

              <View className="flex-row items-center gap-1">
                <SymbolView
                  name={{
                    ios: "figure.walk",
                    android: "near_me",
                    web: "near_me",
                  }}
                  size={10}
                  tintColor="#8E869A"
                />
                <Text
                  className="text-[12px] text-[#8E869A]"
                  numberOfLines={1}
                  style={{ lineHeight: 12 }}
                >
                  Cách bạn {place.distanceLabel}
                </Text>
              </View>

              {place.address ? (
                <View className="flex-row items-center gap-1">
                  <SymbolView
                    name={{
                      ios: "location.fill",
                      android: "place",
                      web: "place",
                    }}
                    size={10}
                    tintColor="#8E869A"
                  />
                  <Text
                    className="flex-1 text-[12px] text-[#8E869A]"
                    numberOfLines={1}
                    style={{ lineHeight: 12 }}
                  >
                    {place.address}
                  </Text>
                </View>
              ) : null}
            </View>

            <View className="mt-1 flex-row items-center gap-2">
              <View className="min-w-0 flex-1 flex-row flex-wrap gap-1.5">
                {visibleTags.map((tag) => (
                  <View
                    key={`${place.key}-${tag}`}
                    className="rounded-full bg-[#F7F4F8] px-2 py-[3px]"
                  >
                    <Text className="text-[8px] font-normal text-[#6F657A]">
                      {tag}
                    </Text>
                  </View>
                ))}
              </View>
            </View>
          </View>
        </View>
      </View>
    </Pressable>
  );
});

const AppLogoMarker = memo(function AppLogoMarker() {
  return (
    <View className="items-center justify-center">
      <RNImage
        source={mapMarkerLogo}
        resizeMode="contain"
        style={{
          height: mapMarkerSize,
          width: mapMarkerSize,
        }}
      />
    </View>
  );
});

export default function AllHotspotsScreen() {
  const router = useRouter();
  const authSession = useAuthSession();
  const insets = useSafeAreaInsets();
  const { height: windowHeight } = useWindowDimensions();
  const mapRef = useRef<MapView | null>(null);
  const [allHotspots, setAllHotspots] = useState<HotspotCollectionListItem[]>([]);
  const [nearbyHotspotsStatus, setNearbyHotspotsStatus] =
    useState<NearbyCollectionStatus>("loading");
  const [searchKeyword, setSearchKeyword] = useState("");
  const [searchResults, setSearchResults] = useState<HotspotCollectionListItem[]>([]);
  const [searchStatus, setSearchStatus] = useState<SearchCollectionStatus>("idle");
  const [searchErrorMessage, setSearchErrorMessage] = useState<string | null>(null);
  const [currentCoordinate, setCurrentCoordinate] = useState<AppCoordinate | null>(
    null,
  );
  const [isListAtTop, setIsListAtTop] = useState(true);
  const [nearbyNote, setNearbyNote] = useState<string | null>(null);
  const [isSheetDragging, setIsSheetDragging] = useState(false);
  const [isSheetExpanded, setIsSheetExpanded] = useState(false);
  const [selectedHotspotKey, setSelectedHotspotKey] = useState<string | null>(null);
  const searchAbortControllerRef = useRef<AbortController | null>(null);
  const trimmedSearchKeyword = searchKeyword.trim();
  const expandedTop = Math.max(insets.top + 62, 82);
  const collapsedTop = Math.max(expandedTop + 288, windowHeight - 248);
  const sheetTravelDistance = Math.max(1, collapsedTop - expandedTop);
  const sheetProgress = useSharedValue(0);
  const sheetDragStart = useSharedValue(0);
  const sheetTravelDistanceValue = useSharedValue(sheetTravelDistance);

  useEffect(() => {
    let isActive = true;

    async function loadNearbyHotspots() {
      setNearbyHotspotsStatus("loading");
      setNearbyNote(null);

      try {
        const { coordinate, fallbackMessage } = await resolveNearbyRequestCoordinate();

        if (!isActive) {
          return;
        }

        setCurrentCoordinate(coordinate);

        if (!coordinate) {
          setAllHotspots([]);
          setNearbyNote(fallbackMessage);
          setNearbyHotspotsStatus("empty");
          return;
        }

        const accessToken = authSession.isAuthenticated
          ? await getValidAccessToken()
          : null;
        const apiNearbyHotspots = await getNearbyHotspots({
          accessToken,
          distance: fixedNearbyDistanceMeters,
          latitude: coordinate.latitude,
          longitude: coordinate.longitude,
          tokenType: authSession.tokenType,
        });

        if (!isActive) {
          return;
        }

        if (apiNearbyHotspots.length === 0) {
          setAllHotspots([]);
          setSelectedHotspotKey(null);
          setNearbyNote(
            coordinate.source === "dev-override"
              ? `Không có địa điểm nào trong bán kính 10km quanh tọa độ test ${formatCoordinateLabel(coordinate)}.`
              : "Không có địa điểm nào trong bán kính 10km quanh vị trí hiện tại.",
          );
          setNearbyHotspotsStatus("empty");
          return;
        }

        const mappedHotspots = buildApiHotspotItems(apiNearbyHotspots, coordinate);
        setAllHotspots(mappedHotspots);
        setSelectedHotspotKey(mappedHotspots[0]?.key ?? null);
        setNearbyNote(
          coordinate.source === "dev-override"
            ? `Đang dùng tọa độ test ${formatCoordinateLabel(coordinate)} với API địa điểm gần bạn cố định 10km.`
            : null,
        );
        setNearbyHotspotsStatus("ready");
      } catch (error) {
        if (!isActive) {
          return;
        }

        setAllHotspots([]);
        setSelectedHotspotKey(null);
        setNearbyHotspotsStatus("empty");
        setNearbyNote(
          error instanceof Error
            ? error.message
            : "Không thể tải địa điểm gần bạn lúc này.",
        );
      }
    }

    void loadNearbyHotspots();

    return () => {
      isActive = false;
    };
  }, [authSession.isAuthenticated, authSession.tokenType]);

  useEffect(() => {
    if (!trimmedSearchKeyword) {
      searchAbortControllerRef.current?.abort();
      searchAbortControllerRef.current = null;
      return;
    }

    const controller = new AbortController();
    searchAbortControllerRef.current?.abort();
    searchAbortControllerRef.current = controller;

    const timeoutId = setTimeout(() => {
      void (async () => {
        if (!currentCoordinate) {
          setSearchResults([]);
          setSearchErrorMessage("Chưa xác định được vị trí hiện tại.");
          setSearchStatus("error");
          return;
        }

        setSearchStatus("loading");
        setSearchErrorMessage(null);

        try {
          const accessToken = authSession.isAuthenticated
            ? await getValidAccessToken()
            : null;
          const response = await searchHotspots({
            accessToken,
            payload: {
              filters: [
                {
                  field: "hotspotName",
                  operator: "LIKE",
                  value: trimmedSearchKeyword,
                },
              ],
              page: 0,
              size: 50,
              sortBy: "hotspotName",
              sortDirection: "ASC",
            },
            signal: controller.signal,
            tokenType: authSession.tokenType,
          });

          if (controller.signal.aborted) {
            return;
          }

          const mappedResults = buildApiHotspotItems(
            response.content,
            currentCoordinate,
          );
          setSearchResults(mappedResults);
          setSearchStatus("ready");
        } catch (error) {
          if (controller.signal.aborted) {
            return;
          }

          setSearchResults([]);
          setSearchStatus("error");
          setSearchErrorMessage(
            error instanceof Error
              ? error.message
              : "Không thể tìm kiếm địa điểm lúc này.",
          );
        }
      })();
    }, 320);

    return () => {
      clearTimeout(timeoutId);
      controller.abort();
    };
  }, [
    authSession.isAuthenticated,
    authSession.tokenType,
    currentCoordinate,
    trimmedSearchKeyword,
  ]);

  const isSearchActive = trimmedSearchKeyword.length > 0;
  const displayedHotspots = isSearchActive ? searchResults : allHotspots;
  const currentListTitle = isSearchActive
    ? `Kết quả tìm kiếm "${trimmedSearchKeyword}"`
    : "Địa điểm gần bạn";
  const currentEmptyMessage = isSearchActive
    ? searchErrorMessage ?? "Không tìm thấy địa điểm phù hợp."
    : nearbyNote ?? "Hãy thử lại khi vị trí và dữ liệu địa điểm sẵn sàng.";
  const activeSelectedHotspotKey = displayedHotspots.some(
    (place) => place.key === selectedHotspotKey,
  )
    ? selectedHotspotKey
    : displayedHotspots[0]?.key ?? null;

  const handleSearchKeywordChange = useCallback((value: string) => {
    setSearchKeyword(value);

    if (value.trim()) {
      return;
    }

    searchAbortControllerRef.current?.abort();
    searchAbortControllerRef.current = null;
    setSearchResults([]);
    setSearchErrorMessage(null);
    setSearchStatus("idle");
  }, []);

  const mapRegion = getRegionFromCoordinate(currentCoordinate);
  useEffect(() => {
    if (Platform.OS === "web" || !currentCoordinate) {
      return;
    }

    const timerId = setTimeout(() => {
      mapRef.current?.animateToRegion(
        getRegionFromCoordinate(currentCoordinate),
        280,
      );
    }, 80);

    return () => {
      clearTimeout(timerId);
    };
  }, [currentCoordinate]);

  const animateSheetTo = useCallback(
    (nextValue: number) => {
      if (nextValue < 0.96) {
        setIsSheetExpanded(false);
      }

      setIsSheetDragging(false);
      sheetProgress.set(withSpring(nextValue, {
        damping: 22,
        mass: 0.95,
        overshootClamping: false,
        stiffness: 210,
      }, (finished) => {
        if (finished) {
          runOnJS(setIsSheetDragging)(false);
          runOnJS(setIsSheetExpanded)(nextValue > 0.96);
        }
      }));
    },
    [sheetProgress],
  );

  useEffect(() => {
    sheetTravelDistanceValue.set(sheetTravelDistance);
  }, [sheetTravelDistance, sheetTravelDistanceValue]);

  const handleRecenterMap = () => {
    if (Platform.OS === "web") {
      return;
    }

    mapRef.current?.animateToRegion(mapRegion, 280);
    animateSheetTo(0);
  };

  const handleSelectHotspot = (place: HotspotCollectionListItem) => {
    setSelectedHotspotKey(place.key);

    if (Platform.OS !== "web") {
      mapRef.current?.animateToRegion(
        getRegionFromCoordinate({
          latitude: place.latitude,
          longitude: place.longitude,
        }),
        260,
      );
    }
  };

  const handleSheetScroll = (
    event: NativeSyntheticEvent<NativeScrollEvent>,
  ) => {
    const nextIsListAtTop = event.nativeEvent.contentOffset.y <= 2;
    setIsListAtTop((currentValue) =>
      currentValue === nextIsListAtTop ? currentValue : nextIsListAtTop,
    );
  };

  const renderHotspotRow = ({
    index,
    item,
  }: ListRenderItemInfo<HotspotCollectionListItem>) => {
    return (
      <NearbyListRow
        isLast={index === displayedHotspots.length - 1}
        onNavigate={() => router.push(getHotspotHref(item.slug, item.hotspotId))}
        place={item}
      />
    );
  };

  const sheetBottomPadding = 8;
  const searchHeaderHeight = expandedTop + 8;
  const sheetAnimatedStyle = useAnimatedStyle(() => ({
    borderTopLeftRadius: interpolate(sheetProgress.get(), [0, 1], [30, 0]),
    borderTopRightRadius: interpolate(sheetProgress.get(), [0, 1], [30, 0]),
    transform: [
      {
        translateY: interpolate(
          sheetProgress.get(),
          [0, 1],
          [0, -sheetTravelDistanceValue.get()],
        ),
      },
    ],
  }));
  const mapButtonAnimatedStyle = useAnimatedStyle(() => ({
    opacity: interpolate(sheetProgress.get(), [0, 0.82, 1], [1, 0.18, 0]),
    transform: [
      {
        translateY: interpolate(sheetProgress.get(), [0, 1], [0, 24]),
      },
    ],
  }));
  const headerBackgroundAnimatedStyle = useAnimatedStyle(() => ({
    opacity: interpolate(sheetProgress.get(), [0.7, 1], [0, 1]),
  }));
  const headerDividerAnimatedStyle = useAnimatedStyle(() => ({
    opacity: interpolate(sheetProgress.get(), [0.82, 1], [0, 1]),
  }));
  const sheetPanGesture = Gesture.Pan()
    .enabled(nearbyHotspotsStatus === "ready" && (!isSheetExpanded || isListAtTop))
    .activeOffsetY(isSheetExpanded ? 6 : [-6, 6])
    .failOffsetX([-16, 16])
    .onBegin(() => {
      sheetDragStart.set(sheetProgress.get());
      runOnJS(setIsSheetDragging)(true);

      if (sheetProgress.get() < 0.96) {
        runOnJS(setIsSheetExpanded)(false);
      }
    })
    .onUpdate((event) => {
      const nextProgress = Math.min(
        Math.max(
          sheetDragStart.get() -
            event.translationY / Math.max(sheetTravelDistanceValue.get(), 1),
          0,
        ),
        1,
      );

      sheetProgress.set(nextProgress);
    })
    .onEnd((event) => {
      const shouldExpand =
        event.velocityY < -120 ||
        (Math.abs(event.velocityY) < 120 && sheetProgress.get() > 0.42);
      const targetValue = shouldExpand ? 1 : 0;

      if (!shouldExpand) {
        runOnJS(setIsListAtTop)(true);
      }

      if (targetValue < 0.96) {
        runOnJS(setIsSheetExpanded)(false);
      }

      sheetProgress.set(withSpring(targetValue, {
        damping: 22,
        mass: 0.95,
        overshootClamping: false,
        stiffness: 210,
      }, (finished) => {
        if (finished) {
          runOnJS(setIsSheetDragging)(false);
          runOnJS(setIsSheetExpanded)(targetValue > 0.96);
        }
      }));
    })
    .onFinalize(() => {
      runOnJS(setIsSheetDragging)(false);
    });

  if (nearbyHotspotsStatus === "loading") {
    return (
      <GestureHandlerRootView style={{ flex: 1 }}>
        <AppLoadingScreen />
      </GestureHandlerRootView>
    );
  }

  return (
    <GestureHandlerRootView style={{ flex: 1 }}>
      <SafeAreaView
        className="flex-1 bg-[#F6F1E8]"
        edges={["left", "right", "bottom"]}
      >
        <View className="flex-1 bg-[#F6F1E8]">
        {Platform.OS === "web" ? (
          <View className="flex-1 items-center justify-center bg-[#F3E8DB] px-8">
            <View className="rounded-[28px] bg-white px-6 py-5">
              <Text className="text-center text-[16px] font-extrabold text-[#2B2233]">
                Map preview chỉ hỗ trợ tốt trên Android/iOS
              </Text>
              <Text className="mt-2 text-center text-[13px] leading-5 text-[#8E869A]">
                Màn địa điểm gần bạn vẫn hiển thị danh sách bên dưới theo đúng dữ liệu API.
              </Text>
            </View>
          </View>
        ) : (
          <MapView
            ref={mapRef}
            provider={PROVIDER_GOOGLE}
            initialRegion={mapRegion}
            loadingBackgroundColor="#F6F1E8"
            loadingEnabled
            loadingIndicatorColor="#EB489B"
            mapType="standard"
            showsCompass={false}
            showsMyLocationButton={false}
            showsUserLocation={Boolean(currentCoordinate)}
            style={{ flex: 1 }}
          >
            {displayedHotspots.map((place) => (
              <Marker
                key={`map-${place.key}`}
                anchor={{ x: 0.5, y: 0.5 }}
                coordinate={{
                  latitude: place.latitude,
                  longitude: place.longitude,
                }}
                onPress={() => {
                  handleSelectHotspot(place);
                }}
                tracksViewChanges
                title={place.title}
                zIndex={activeSelectedHotspotKey === place.key ? 2 : 1}
              >
                <AppLogoMarker />
              </Marker>
            ))}
          </MapView>
        )}

        <Animated.View
          pointerEvents="none"
          style={[
            headerBackgroundAnimatedStyle,
            {
              left: 0,
              position: "absolute",
              right: 0,
              top: 0,
            },
          ]}
        >
          <View
            style={{
              backgroundColor: "#FFFFFF",
              height: searchHeaderHeight,
            }}
          />
        </Animated.View>

        <SafeAreaView
          pointerEvents="box-none"
          className="absolute inset-x-0 top-0"
          edges={["top", "left", "right"]}
        >
          <View className="px-4 pt-2">
            <View className="flex-row items-center gap-3">
              <Pressable
                className="h-11 w-11 items-center justify-center rounded-full bg-white"
                onPress={() => router.back()}
                style={{
                  elevation: 4,
                  shadowColor: "rgba(15,23,42,0.14)",
                  shadowOffset: { height: 4, width: 0 },
                  shadowOpacity: 1,
                  shadowRadius: 10,
                }}
              >
                <SymbolView
                  name={{ ios: "chevron.left", android: "arrow_back", web: "arrow_back" }}
                  size={18}
                  tintColor="#2B2233"
                />
              </Pressable>

              <View
                className="flex-1 flex-row items-center rounded-2xl border border-[#E2E8F0] bg-[#ECEFF3] px-4 py-3"
                style={{
                  elevation: 4,
                  shadowColor: "rgba(15,23,42,0.14)",
                  shadowOffset: { height: 4, width: 0 },
                  shadowOpacity: 1,
                  shadowRadius: 10,
                }}
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
                  <TextInput
                    autoCapitalize="none"
                    autoCorrect={false}
                    className="ml-2 flex-1 p-0 text-[14px] text-[#3B4454]"
                    onChangeText={handleSearchKeywordChange}
                    placeholder="Tìm địa điểm theo tên"
                    placeholderTextColor="#8E869A"
                    returnKeyType="search"
                    value={searchKeyword}
                  />
                </View>
              </View>

            <Animated.View
              pointerEvents="none"
              style={headerDividerAnimatedStyle}
            >
              <View
                style={{
                  backgroundColor: "#ECE7EE",
                  height: 1,
                  marginTop: 10,
                }}
              />
            </Animated.View>
          </View>
        </SafeAreaView>

        <Animated.View
          style={[
            mapButtonAnimatedStyle,
            {
              position: "absolute",
              right: 16,
              top: collapsedTop - 60,
            },
          ]}
        >
          <View
            className="rounded-full bg-white"
            style={{
              elevation: 5,
              shadowColor: "rgba(15,23,42,0.18)",
              shadowOffset: { height: 6, width: 0 },
              shadowOpacity: 1,
              shadowRadius: 12,
            }}
          >
            <Pressable
              className="h-12 w-12 items-center justify-center rounded-full"
              onPress={handleRecenterMap}
            >
              <SymbolView
                name={{ ios: "location.fill", android: "my_location", web: "my_location" }}
                size={18}
                tintColor="#0F8A83"
              />
            </Pressable>
          </View>
        </Animated.View>

        <GestureDetector gesture={sheetPanGesture}>
          <Animated.View
            className="absolute inset-x-0 bottom-0 overflow-hidden bg-white"
            style={[
              sheetAnimatedStyle,
              {
                minHeight: windowHeight - expandedTop,
                shadowColor: "rgba(15,23,42,0.18)",
                shadowOffset: { height: -10, width: 0 },
                shadowOpacity: 1,
                shadowRadius: 24,
                top: collapsedTop,
              },
            ]}
          >
            <View className="px-4 pb-2 pt-3">
              {!isSheetExpanded ? (
                <View className="items-center pb-2">
                  <View className="h-1.5 w-12 rounded-full bg-[#DDD6DF]" />
                </View>
              ) : null}
            </View>

            <View
              className="flex-1"
              style={{
                paddingBottom: 0,
                paddingHorizontal: ScreenHorizontalPadding,
                paddingTop: 4,
              }}
            >
              {displayedHotspots.length === 0 ? (
                <ScrollView
                  bounces={false}
                  scrollEnabled={false}
                  showsVerticalScrollIndicator={false}
                  contentContainerStyle={{ paddingBottom: sheetBottomPadding }}
                >
                  <View className="pb-3">
                    <Text className="text-[16px] font-medium text-[#2B2233]">
                      {currentListTitle}
                    </Text>
                  </View>
                  {isSearchActive && searchStatus === "loading" ? (
                    <View className="items-center px-6 py-10">
                      <ActivityIndicator color="#EB489B" size="small" />
                      <Text className="mt-3 text-[13px] text-[#8E869A]">
                        Đang tìm địa điểm...
                      </Text>
                    </View>
                  ) : (
                    <View className="items-center px-6 py-10">
                      <Text className="text-[15px] font-extrabold text-[#2B2233]">
                        Chưa có địa điểm phù hợp
                      </Text>
                      <Text className="mt-2 max-w-[280px] text-center text-[12px] leading-[18px] text-[#8E869A]">
                        {currentEmptyMessage}
                      </Text>
                    </View>
                  )}
                </ScrollView>
              ) : (
                <FlatList
                  bounces={isSheetExpanded}
                  contentContainerStyle={{ paddingBottom: sheetBottomPadding }}
                  data={displayedHotspots}
                  initialNumToRender={6}
                  keyExtractor={(item) => item.key}
                  ListHeaderComponent={
                    <View className="pb-3">
                      <Text className="text-[16px] font-medium text-[#2B2233]">
                        {currentListTitle}
                      </Text>
                    </View>
                  }
                  maxToRenderPerBatch={6}
                  onScroll={handleSheetScroll}
                  removeClippedSubviews
                  renderItem={renderHotspotRow}
                  scrollEnabled={isSheetExpanded && !isSheetDragging}
                  scrollEventThrottle={16}
                  showsVerticalScrollIndicator={false}
                  updateCellsBatchingPeriod={16}
                  windowSize={7}
                />
              )}
            </View>
          </Animated.View>
        </GestureDetector>
        </View>
      </SafeAreaView>
    </GestureHandlerRootView>
  );
}
