import { Image } from "expo-image";
import { LinearGradient } from "expo-linear-gradient";
import * as Location from "expo-location";
import { useRouter } from "expo-router";
import { SymbolView } from "expo-symbols";
import { useEffect, useMemo, useState } from "react";
import { Platform, Pressable, ScrollView, Text, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

import {
  getValidAccessToken,
  useAuthSession,
} from "@/features/auth/hooks/use-auth-session";
import {
  type AppCoordinate,
  getDevelopmentLocationOverride,
  getDeviceCoordinate,
} from "@/lib/location";

import {
  getNearbyHotspots,
  type NearbyHotspotDto,
} from "../api/get-nearby-hotspots";
import { nearbyCategories, type SymbolName } from "../data/home-screen.mock";
import {
  findMatchingHotspotByNameOrCoordinate,
  getApiHotspotRouteSlug,
  getHotspotHref,
  hotspotCollection,
  type HotspotDetail,
} from "../data/hotspots";

const gradientColors = ["#EB489B", "#F58752", "#FFC93C"] as const;

const cardShadowStyle = {
  shadowColor: "rgba(235, 72, 155, 0.22)",
  shadowOpacity: 1,
  shadowRadius: 22,
  shadowOffset: {
    width: 0,
    height: 16,
  },
  elevation: 10,
} as const;

type HotspotCategoryFilter = {
  accent: string;
  background: string;
  icon: SymbolName;
  label: string;
};

type HotspotCollectionListItem = {
  category: string;
  distance: string;
  hotspotId: number | null;
  imageUri: string;
  key: string;
  overview: string;
  reward: string;
  scoreIcon: SymbolName;
  scoreLabel: string;
  slug: string;
  title: string;
};

type NearbyCollectionStatus = "empty" | "fallback" | "loading" | "ready";

const defaultHotspotCategory: HotspotCategoryFilter = {
  accent: "#EB489B",
  background: "#FFF0F7",
  icon: {
    ios: "square.grid.2x2.fill",
    android: "apps",
    web: "apps",
  },
  label: "Tất cả",
};
const defaultNearbySearchDistanceMeters = 1000;
const nearbyPlaceFallbackImageUri =
  hotspotCollection[0]?.imageUri ??
  "https://images.unsplash.com/photo-1500530855697-b586d89ba3ee";

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

function mapLocalHotspotItem(place: HotspotDetail): HotspotCollectionListItem {
  return {
    category: place.category,
    distance: place.distance,
    hotspotId: null,
    imageUri: place.imageUri,
    key: place.slug,
    overview: place.overview,
    reward: place.reward,
    scoreIcon: {
      ios: "star.fill",
      android: "star",
      web: "star",
    } as SymbolName,
    scoreLabel: place.rating.toFixed(1),
    slug: place.slug,
    title: place.title,
  };
}

function buildLocalHotspotItems() {
  return hotspotCollection.map(mapLocalHotspotItem);
}

function buildApiHotspotItems(
  hotspots: NearbyHotspotDto[],
  currentCoordinate: Pick<AppCoordinate, "latitude" | "longitude">,
): HotspotCollectionListItem[] {
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
      const compactPointLabel = formatCompactCount(hotspot.point);

      return {
        category: getPrimaryNearbyCategory(
          hotspot,
          matchedLocalHotspot?.category,
        ),
        distance: formatDistanceMeters(distanceMeters),
        hotspotId: hotspot.hotspotId,
        imageUri: getPrimaryNearbyImageUri(
          hotspot,
          matchedLocalHotspot?.imageUri,
        ),
        key: `${hotspot.hotspotId}-${index}`,
        overview:
          hotspot.description.trim() ||
          hotspot.historyInformation.trim() ||
          matchedLocalHotspot?.overview ||
          "Hotspot từ API",
        reward: formatRewardLabel(hotspot.xp, matchedLocalHotspot?.reward),
        scoreIcon: matchedLocalHotspot
          ? ({
              ios: "star.fill",
              android: "star",
              web: "star",
            } as SymbolName)
          : ({
              ios: "chart.bar.fill",
              android: "bar_chart",
              web: "bar_chart",
            } as SymbolName),
        scoreLabel:
          matchedLocalHotspot?.rating !== undefined
            ? matchedLocalHotspot.rating.toFixed(1)
            : (compactPointLabel ?? "0"),
        slug:
          matchedLocalHotspot?.slug ??
          getApiHotspotRouteSlug(hotspot.hotspotId),
        sortDistanceMeters: distanceMeters,
        title:
          hotspot.hotspotName.trim() || matchedLocalHotspot?.title || "Hotspot",
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
      fallbackMessage:
        "Bật GPS để tải danh sách hotspot gần bạn. Đang hiển thị dữ liệu cục bộ.",
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
        "Cho phép truy cập vị trí để tải hotspot gần bạn. Đang hiển thị dữ liệu cục bộ.",
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
        "Không xác định được vị trí hiện tại. Đang hiển thị dữ liệu cục bộ.",
    };
  }

  return {
    coordinate: currentLocation,
    fallbackMessage: null,
  };
}

function HotspotStatChip({
  icon,
  label,
  textColor = "#FFFFFF",
}: {
  icon: SymbolName;
  label: string;
  textColor?: string;
}) {
  return (
    <View className="flex-row items-center">
      <SymbolView name={icon} size={13} tintColor="#FFC93C" />
      <Text
        className="ml-1.5 text-[12px] font-extrabold"
        style={{ color: textColor }}
      >
        {label}
      </Text>
    </View>
  );
}

function HotspotCollectionCard({
  onPress,
  place,
}: {
  onPress: () => void;
  place: HotspotCollectionListItem;
}) {
  return (
    <Pressable
      className="overflow-hidden rounded-[28px] bg-[#1E1720]"
      hitSlop={6}
      onPress={onPress}
      style={cardShadowStyle}
    >
      <View className="relative">
        <Image
          source={place.imageUri}
          contentFit="cover"
          transition={220}
          cachePolicy="memory-disk"
          style={{ height: 248, width: "100%" }}
        />
        <LinearGradient
          colors={["rgba(0,0,0,0.04)", "rgba(0,0,0,0.82)"]}
          locations={[0.18, 1]}
          style={{
            bottom: 0,
            left: 0,
            position: "absolute",
            right: 0,
            top: 0,
          }}
        />

        <View className="absolute inset-x-4 top-4 flex-row items-center justify-between">
          <LinearGradient
            colors={["#FFFFFF", "#FFF1F7"]}
            end={{ x: 1, y: 0.5 }}
            start={{ x: 0, y: 0.5 }}
            className="rounded-full px-3 py-1.5"
          >
            <Text className="text-[11px] font-extrabold text-[#EB489B]">
              {place.category}
            </Text>
          </LinearGradient>
          <LinearGradient
            colors={gradientColors}
            end={{ x: 1, y: 0.5 }}
            locations={[0, 0.58, 1]}
            start={{ x: 0, y: 0.5 }}
            className="rounded-full px-3 py-1.5"
          >
            <Text className="text-[11px] font-bold text-white">
              {place.reward} XP
            </Text>
          </LinearGradient>
        </View>

        <View className="absolute inset-x-4 bottom-4">
          <Text className="text-[29px] font-black leading-[34px] text-white">
            {place.title}
          </Text>
          <Text className="mt-1 text-[13px] text-[#F6DFE8]" numberOfLines={2}>
            {place.overview}
          </Text>

          <View className="mt-4 flex-row flex-wrap items-center gap-x-4 gap-y-2">
            <HotspotStatChip
              icon={{
                ios: "location.fill",
                android: "place",
                web: "place",
              }}
              label={place.distance}
              textColor="#FFE6F0"
            />
            <HotspotStatChip
              icon={place.scoreIcon}
              label={place.scoreLabel}
              textColor="#FFE6F0"
            />
            <HotspotStatChip
              icon={{
                ios: "gift.fill",
                android: "redeem",
                web: "redeem",
              }}
              label={`${place.reward} XP`}
              textColor="#FFC93C"
            />
          </View>
        </View>
      </View>
    </Pressable>
  );
}

export default function AllHotspotsScreen() {
  const router = useRouter();
  const authSession = useAuthSession();
  const [activeCategory, setActiveCategory] = useState("Tất cả");
  const [isFilterPanelVisible, setIsFilterPanelVisible] = useState(false);
  const [allHotspots, setAllHotspots] = useState<HotspotCollectionListItem[]>(
    () => buildLocalHotspotItems(),
  );
  const [nearbyHotspotsStatus, setNearbyHotspotsStatus] =
    useState<NearbyCollectionStatus>("loading");

  const hotspotCategories = useMemo<HotspotCategoryFilter[]>(() => {
    const uniqueLabels = Array.from(
      new Set(
        allHotspots.map((place) => place.category.trim()).filter(Boolean),
      ),
    );
    const categoriesWithPlaces = uniqueLabels.map(
      (label) =>
        nearbyCategories.find((item) => item.label === label) ?? {
          ...defaultHotspotCategory,
          label,
        },
    );

    return [defaultHotspotCategory, ...categoriesWithPlaces];
  }, [allHotspots]);
  const resolvedActiveCategory = hotspotCategories.some(
    (item) => item.label === activeCategory,
  )
    ? activeCategory
    : "Tất cả";

  const filteredPlaces = useMemo(() => {
    if (resolvedActiveCategory === "Tất cả") {
      return allHotspots;
    }

    return allHotspots.filter(
      (place) => place.category === resolvedActiveCategory,
    );
  }, [allHotspots, resolvedActiveCategory]);

  useEffect(() => {
    let isActive = true;

    async function loadNearbyHotspots() {
      setNearbyHotspotsStatus("loading");

      try {
        const { coordinate } = await resolveNearbyRequestCoordinate();

        if (!isActive) {
          return;
        }

        if (!coordinate) {
          setAllHotspots(buildLocalHotspotItems());
          setNearbyHotspotsStatus("fallback");
          return;
        }

        const accessToken = authSession.isAuthenticated
          ? await getValidAccessToken()
          : null;
        const apiNearbyHotspots = await getNearbyHotspots({
          accessToken,
          distance: defaultNearbySearchDistanceMeters,
          latitude: coordinate.latitude,
          longitude: coordinate.longitude,
          tokenType: authSession.tokenType,
        });

        if (!isActive) {
          return;
        }

        if (apiNearbyHotspots.length === 0) {
          setAllHotspots([]);
          setNearbyHotspotsStatus("empty");
          return;
        }

        setAllHotspots(buildApiHotspotItems(apiNearbyHotspots, coordinate));
        setNearbyHotspotsStatus("ready");
      } catch {
        if (!isActive) {
          return;
        }

        setAllHotspots(buildLocalHotspotItems());
        setNearbyHotspotsStatus("fallback");
      }
    }

    void loadNearbyHotspots();

    return () => {
      isActive = false;
    };
  }, [authSession.isAuthenticated, authSession.tokenType]);

  return (
    <SafeAreaView
      className="flex-1 bg-white"
      edges={["top", "left", "right", "bottom"]}
    >
      <ScrollView
        className="flex-1"
        contentContainerStyle={{ paddingBottom: 36 }}
        showsVerticalScrollIndicator={false}
      >
        <View className="px-5 pb-2 pt-2">
          <View className="flex-row items-center justify-between">
            <Pressable
              className="h-11 w-11 items-center justify-center rounded-full bg-[#FFF4EF]"
              hitSlop={8}
              onPress={() => router.back()}
            >
              <SymbolView
                name={{
                  ios: "chevron.left",
                  android: "arrow_back",
                  web: "arrow_back",
                }}
                size={18}
                tintColor="#EB489B"
              />
            </Pressable>

            <LinearGradient
              colors={gradientColors}
              end={{ x: 1, y: 0.5 }}
              locations={[0, 0.58, 1]}
              start={{ x: 0, y: 0.5 }}
              className="flex-row items-center rounded-full px-4 py-2.5"
            >
              <SymbolView
                name={{
                  ios: "location.fill",
                  android: "place",
                  web: "place",
                }}
                size={13}
                tintColor="#FFFFFF"
              />
              <Text className="ml-2 text-[12px] font-bold text-white">
                {filteredPlaces.length} địa điểm
              </Text>
            </LinearGradient>
          </View>

          <View className="mt-5">
            <Text className="text-[25px] font-black leading-[34px] text-[#2B2233]">
              Tất cả địa điểm
            </Text>
          </View>

          {nearbyHotspotsStatus === "loading" ? (
            <View className="mt-4 rounded-[18px] border border-[#F0E8F4] bg-[#FAF7FC] px-4 py-4">
              <Text className="text-[14px] font-bold text-[#3B4454]">
                Đang tải hotspot gần bạn...
              </Text>
            </View>
          ) : null}

          <View className="mt-5 flex-row items-center gap-3">
            <View className="flex-1 flex-row items-center rounded-[18px] border border-[#F0E8F4] bg-[#FAF7FC] px-4 py-4">
              <SymbolView
                name={{
                  ios: "magnifyingglass",
                  android: "search",
                  web: "search",
                }}
                size={15}
                tintColor="#8E869A"
              />
              <Text className="ml-3 flex-1 text-[13px] text-[#8E869A]">
                Tìm kiếm địa điểm, lộ trình, văn hóa...
              </Text>
            </View>

            <Pressable
              accessibilityLabel="Bộ lọc hotspot"
              className="overflow-hidden rounded-[18px]"
              hitSlop={8}
              onPress={() => setIsFilterPanelVisible((currentValue) => !currentValue)}
            >
              <LinearGradient
                colors={gradientColors}
                end={{ x: 1, y: 0.5 }}
                locations={[0, 0.58, 1]}
                start={{ x: 0, y: 0.5 }}
                className="h-[52px] w-[52px] items-center justify-center"
              >
                <SymbolView
                  name={{
                    ios: "slider.horizontal.3",
                    android: "tune",
                    web: "tune",
                  }}
                  size={18}
                  tintColor="#FFFFFF"
                />
              </LinearGradient>
            </Pressable>
          </View>

          {isFilterPanelVisible ? (
            <View
              className="mt-4 rounded-[24px] border border-[#F0E8F4] bg-white p-4"
              style={cardShadowStyle}
            >
              <View className="flex-row items-center justify-between">
                <Text className="text-[14px] font-extrabold text-[#2B2233]">
                  Lọc theo chủ đề
                </Text>
                <Pressable
                  hitSlop={8}
                  onPress={() => {
                    setActiveCategory("Tất cả");
                    setIsFilterPanelVisible(false);
                  }}
                >
                  <Text className="text-[12px] font-bold text-[#F58752]">
                    Xóa lọc
                  </Text>
                </Pressable>
              </View>

              <View className="mt-4 flex-row flex-wrap gap-3">
                {hotspotCategories.map((item) => {
                  const isActive = item.label === resolvedActiveCategory;

                  return (
                    <Pressable
                      key={item.label}
                      onPress={() => {
                        setActiveCategory(item.label);
                        setIsFilterPanelVisible(false);
                      }}
                    >
                      {isActive ? (
                        <LinearGradient
                          colors={gradientColors}
                          end={{ x: 1, y: 0.5 }}
                          locations={[0, 0.58, 1]}
                          start={{ x: 0, y: 0.5 }}
                          className="rounded-full px-4 py-3"
                        >
                          <Text className="text-[13px] font-semibold text-white">
                            {item.label}
                          </Text>
                        </LinearGradient>
                      ) : (
                        <View className="rounded-full bg-[#FAF7FC] px-4 py-3">
                          <Text className="text-[13px] font-semibold text-[#2B2233]">
                            {item.label}
                          </Text>
                        </View>
                      )}
                    </Pressable>
                  );
                })}
              </View>
            </View>
          ) : null}

          <View className="mt-4 gap-4">
            {filteredPlaces.map((place) => (
              <HotspotCollectionCard
                key={place.key}
                onPress={() =>
                  router.push(getHotspotHref(place.slug, place.hotspotId))
                }
                place={place}
              />
            ))}

            {filteredPlaces.length === 0 ? (
              <View className="items-center rounded-[28px] border border-dashed border-[#3A2740] bg-[#1E1720] px-6 py-10">
                <Text className="text-[16px] font-extrabold text-white">
                  Chưa có hotspot cho chủ đề này
                </Text>
                <Text className="mt-2 max-w-[260px] text-center text-[13px] leading-5 text-[#B2A4B8]">
                  Hãy chọn chủ đề khác để xem thêm các địa điểm gần bạn.
                </Text>
              </View>
            ) : null}
          </View>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}
