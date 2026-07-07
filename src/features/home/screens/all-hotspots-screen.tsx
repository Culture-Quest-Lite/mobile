import { SymbolView } from "@/components/ui/symbol-view";
import { Image } from "expo-image";
import { LinearGradient } from "expo-linear-gradient";
import * as Location from "expo-location";
import { useRouter, type Href } from "expo-router";
import { useEffect, useMemo, useState } from "react";
import {
  ActivityIndicator,
  Platform,
  Pressable,
  ScrollView,
  Text,
  View,
} from "react-native";
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
import { getActiveTagNames } from "../api/get-tags";
import { type SymbolName } from "../data/home-screen.mock";
import { getApiHotspotRouteSlug, getHotspotHref } from "../data/hotspots";

const hotspotTagAccentStyles = [
  {
    backgroundColor: "#FFF1F7",
    borderColor: "#FFD4E6",
    textColor: "#C73A7A",
  },
  {
    backgroundColor: "#FFF5E8",
    borderColor: "#FFDAB7",
    textColor: "#C96C1E",
  },
  {
    backgroundColor: "#FFF9DD",
    borderColor: "#F1E08D",
    textColor: "#9E7A00",
  },
] as const;

const cardShadowStyle = {
  shadowColor: "rgba(245, 135, 82, 0.16)",
  shadowOpacity: 1,
  shadowRadius: 16,
  shadowOffset: {
    width: 0,
    height: 10,
  },
  elevation: 7,
} as const;

const gpsChipShadowStyle = {
  shadowColor: "rgba(201, 108, 30, 0.22)",
  shadowOpacity: 1,
  shadowRadius: 10,
  shadowOffset: {
    width: 0,
    height: 6,
  },
  elevation: 4,
} as const;

type HotspotTagFilter = {
  icon?: SymbolName;
  label: string;
};

type HotspotCollectionListItem = {
  category: string;
  distance: string;
  hotspotId: number | null;
  imageUri: string;
  key: string;
  openingHours: string;
  overview: string;
  reward: string;
  scoreIcon: SymbolName;
  scoreLabel: string;
  slug: string;
  tags: string[];
  title: string;
};

type NearbyCollectionStatus = "empty" | "loading" | "ready";

const defaultHotspotTag: HotspotTagFilter = {
  label: "__all__",
};
const defaultNearbySearchDistanceMeters = 1000;
const nearbyPlaceFallbackImageUri =
  "https://images.unsplash.com/photo-1500530855697-b586d89ba3ee";

function toRadians(value: number) {
  return (value * Math.PI) / 180;
}

function normalizeFilterLabel(value: string) {
  return value
    .trim()
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9]+/g, " ")
    .trim();
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

function getHotspotTagAccentStyle(index: number) {
  return hotspotTagAccentStyles[index % hotspotTagAccentStyles.length]!;
}

function buildHotspotOverviewPreview(value: string, maxLength = 92) {
  const trimmedValue = value.trim();

  if (trimmedValue.length <= maxLength) {
    return {
      text: trimmedValue,
      truncated: false,
    };
  }

  const shortenedValue = trimmedValue
    .slice(0, maxLength)
    .replace(/\s+\S*$/, "")
    .trim();

  return {
    text: shortenedValue || trimmedValue.slice(0, maxLength).trim(),
    truncated: true,
  };
}

function resolveOpeningHoursLabel(hotspot: NearbyHotspotDto) {
  return (
    formatApiTimeWindow(hotspot.openingTime, hotspot.closingTime) ??
    formatApiTimeWindow(hotspot.startTime, hotspot.endTime) ??
    "Giờ mở cửa đang cập nhật"
  );
}

function buildTagFilters(tagLabels: string[]): HotspotTagFilter[] {
  const filtersByKey = new Map<string, HotspotTagFilter>();

  tagLabels.forEach((label) => {
    const trimmedLabel = label.trim();
    const normalizedLabel = normalizeFilterLabel(trimmedLabel);

    if (
      !trimmedLabel ||
      !normalizedLabel ||
      filtersByKey.has(normalizedLabel)
    ) {
      return;
    }

    filtersByKey.set(normalizedLabel, {
      label: trimmedLabel,
    });
  });

  return Array.from(filtersByKey.values());
}

function isHeritageTagLabel(value: string) {
  return normalizeFilterLabel(value).includes("di san");
}

function sortHotspotTagFilters(filters: HotspotTagFilter[]) {
  return [...filters].sort((left, right) => {
    const leftPriority = isHeritageTagLabel(left.label) ? 0 : 1;
    const rightPriority = isHeritageTagLabel(right.label) ? 0 : 1;

    if (leftPriority !== rightPriority) {
      return leftPriority - rightPriority;
    }

    return left.label.localeCompare(right.label, "vi");
  });
}

function getPrimaryNearbyCategory(hotspot: NearbyHotspotDto) {
  const tagName = hotspot.tags
    .find((tag) => tag.tagName.trim())
    ?.tagName.trim();

  return tagName || "Không có dữ liệu";
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
      const compactPointLabel = formatCompactCount(hotspot.point);
      const pointLabel = compactPointLabel ?? "0";
      const category = getPrimaryNearbyCategory(hotspot);
      const tags = Array.from(
        new Set(
          [category, ...hotspot.tags.map((tag) => tag.tagName)]
            .map((tag) => tag?.trim() ?? "")
            .filter(Boolean),
        ),
      );

      return {
        category,
        distance: formatDistanceMeters(distanceMeters),
        hotspotId: hotspot.hotspotId,
        imageUri: getPrimaryNearbyImageUri(hotspot),
        key: `${hotspot.hotspotId}-${index}`,
        openingHours: resolveOpeningHoursLabel(hotspot),
        overview:
          hotspot.description.trim() ||
          hotspot.historyInformation.trim() ||
          "Không có dữ liệu",
        reward: formatRewardLabel(hotspot.xp),
        scoreIcon: compactPointLabel
          ? ({
              ios: "chart.bar.fill",
              android: "bar_chart",
              web: "bar_chart",
            } as SymbolName)
          : ({
              ios: "star.fill",
              android: "star",
              web: "star",
            } as SymbolName),
        scoreLabel: pointLabel,
        slug: getApiHotspotRouteSlug(hotspot.hotspotId),
        tags,
        title: hotspot.hotspotName.trim() || "Không có dữ liệu",
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
      : await Location.requestForegroundPermissionsAsync();

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

function HotspotStatChip({
  icon,
  iconColor = "#F58752",
  label,
  numberOfLines = 1,
  textColor = "#2B2233",
}: {
  icon: SymbolName;
  iconColor?: string;
  label: string;
  numberOfLines?: number;
  textColor?: string;
}) {
  return (
    <View className="flex-row items-center">
      <SymbolView name={icon} size={12} tintColor={iconColor} />
      <Text
        className="ml-1 flex-1 text-[11px] font-bold"
        numberOfLines={numberOfLines}
        style={{ color: textColor }}
      >
        {label}
      </Text>
    </View>
  );
}

function HotspotTagPill({
  active,
  item,
  onPress,
}: {
  active: boolean;
  item: HotspotTagFilter;
  onPress: () => void;
}) {
  return (
    <Pressable className="rounded-full" hitSlop={6} onPress={onPress}>
      <View
        className={`flex-row items-center rounded-full px-2.5 py-1 ${active ? "bg-[#FFF1F6]" : "bg-[#FAF7FC]"}`}
      >
        {item.icon ? (
          <SymbolView
            name={item.icon}
            size={12}
            tintColor={active ? "#EB489B" : "#7D7281"}
          />
        ) : null}
        <Text
          className={`${item.icon ? "ml-1 " : ""}text-[12px] font-extrabold`}
          numberOfLines={1}
          style={{ color: active ? "#EB489B" : "#7D7281" }}
        >
          {item.label}
        </Text>
      </View>
    </Pressable>
  );
}

function HotspotCollectionCard({
  onPress,
  place,
}: {
  onPress: () => void;
  place: HotspotCollectionListItem;
}) {
  const overviewPreview = buildHotspotOverviewPreview(place.overview);
  const visibleTags = Array.from(
    new Set(
      [place.category, ...place.tags].map((tag) => tag.trim()).filter(Boolean),
    ),
  ).slice(0, 3);

  return (
    <Pressable className="pb-1" hitSlop={6} onPress={onPress}>
      <View className="relative overflow-hidden rounded-[12px]">
        <Image
          source={place.imageUri}
          cachePolicy="memory-disk"
          contentFit="cover"
          style={{ height: 230, width: "100%" }}
          transition={220}
        />
        <LinearGradient
          colors={["rgba(0,0,0,0.02)", "rgba(0,0,0,0.55)"]}
          locations={[0.2, 1]}
          style={{
            bottom: 0,
            left: 0,
            position: "absolute",
            right: 0,
            top: 0,
          }}
        />

        <View
          className="absolute right-4 top-4 rounded-full bg-[#FFF7F2] px-3 py-1.5"
          style={gpsChipShadowStyle}
        >
          <HotspotStatChip
            icon={{
              ios: "location.fill",
              android: "place",
              web: "place",
            }}
            iconColor="#C96C1E"
            label={`Cách bạn ${place.distance}`}
            textColor="#A95A18"
          />
        </View>
      </View>

      <View className="px-1 pt-2.5">
        <Text className="text-[17px] font-black leading-[22px] text-[#2B2233]">
          {place.title}
        </Text>

        <Text className="mt-1 text-[12px] leading-[18px] text-[#7B7287]">
          {overviewPreview.text}
          {overviewPreview.truncated ? "..." : ""}
          <Text className="text-[11px] font-bold text-[#7E6F82]">
            {" "}
            Xem thêm
          </Text>
        </Text>

        {visibleTags.length > 0 ? (
          <View className="mt-2 flex-row flex-wrap gap-1.5">
            {visibleTags.map((tag, index) => {
              const accentStyle = getHotspotTagAccentStyle(index);

              return (
                <View
                  key={`${place.key}-${tag}`}
                  className="rounded-full border px-2.5 py-[3px]"
                  style={{
                    backgroundColor: accentStyle.backgroundColor,
                    borderColor: accentStyle.borderColor,
                  }}
                >
                  <Text
                    className="text-[10px] font-extrabold"
                    style={{ color: accentStyle.textColor }}
                  >
                    {tag}
                  </Text>
                </View>
              );
            })}
          </View>
        ) : null}

        <View className="mt-2 flex-row items-center rounded-[16px] bg-[#FFF7F2] px-2.5 py-2">
          <View className="min-w-0 flex-1 px-1.5">
            <HotspotStatChip
              icon={{
                ios: "sparkles",
                android: "auto_awesome",
                web: "auto_awesome",
              }}
              iconColor="#A95A18"
              label={`${place.reward} XP`}
              textColor="#A95A18"
            />
          </View>

          <View className="h-5 w-px bg-[#F2DDCF]" />

          <View className="min-w-0 flex-1 px-1.5">
            <HotspotStatChip
              icon={place.scoreIcon}
              iconColor="#A95A18"
              label={`Điểm ${place.scoreLabel}`}
              textColor="#A95A18"
            />
          </View>

          <View className="h-5 w-px bg-[#F2DDCF]" />

          <View className="min-w-0 flex-[1.2] px-1.5">
            <HotspotStatChip
              icon={{
                ios: "clock.fill",
                android: "schedule",
                web: "schedule",
              }}
              iconColor="#A95A18"
              label={place.openingHours}
              numberOfLines={1}
              textColor="#A95A18"
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
  const [activeTag, setActiveTag] = useState(defaultHotspotTag.label);
  const [allHotspots, setAllHotspots] = useState<HotspotCollectionListItem[]>(
    [],
  );
  const [apiTagFilters, setApiTagFilters] = useState<HotspotTagFilter[]>([]);
  const [isTagPanelVisible, setIsTagPanelVisible] = useState(false);
  const [nearbyHotspotsStatus, setNearbyHotspotsStatus] =
    useState<NearbyCollectionStatus>("loading");

  const fallbackTagFilters = useMemo(
    () =>
      sortHotspotTagFilters(
        buildTagFilters(allHotspots.flatMap((place) => place.tags)),
      ),
    [allHotspots],
  );
  const hotspotTagFilters = useMemo(
    () =>
      apiTagFilters.length > 0
        ? sortHotspotTagFilters(apiTagFilters)
        : fallbackTagFilters,
    [apiTagFilters, fallbackTagFilters],
  );
  const preferredDefaultTagLabel = useMemo(
    () =>
      hotspotTagFilters.find((item) => isHeritageTagLabel(item.label))?.label ??
      defaultHotspotTag.label,
    [hotspotTagFilters],
  );
  const resolvedActiveTag = hotspotTagFilters.some(
    (item) => item.label === activeTag,
  )
    ? activeTag
    : preferredDefaultTagLabel;

  const filteredPlaces = useMemo(() => {
    if (resolvedActiveTag === defaultHotspotTag.label) {
      return allHotspots;
    }

    const normalizedActiveTag = normalizeFilterLabel(resolvedActiveTag);

    return allHotspots.filter((place) =>
      place.tags.some(
        (tag) => normalizeFilterLabel(tag) === normalizedActiveTag,
      ),
    );
  }, [allHotspots, resolvedActiveTag]);

  useEffect(() => {
    let isActive = true;

    async function loadHotspotTags() {
      setApiTagFilters([]);

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

        setApiTagFilters(buildTagFilters(tagNames));
      } catch (error) {
        console.warn("[hotspots] load tags failed", {
          error: error instanceof Error ? error.message : error,
        });

        if (!isActive) {
          return;
        }

        setApiTagFilters([]);
      }
    }

    void loadHotspotTags();

    return () => {
      isActive = false;
    };
  }, [authSession.isAuthenticated, authSession.tokenType]);

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
          setAllHotspots([]);
          setNearbyHotspotsStatus("empty");
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

        setAllHotspots([]);
        setNearbyHotspotsStatus("empty");
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
        <LinearGradient
          colors={["#FFFFFF", "#FFFFFF", "#FFFFFF"]}
          locations={[0, 0.55, 1]}
          style={{ paddingBottom: 22 }}
        >
          <View className="px-5 pb-1 pt-2">
            <View className="flex-row items-center justify-between">
              <Pressable
                className="h-11 w-11 items-center justify-center rounded-full border border-[#F0E8F4] bg-white"
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
                  tintColor="#2B2233"
                />
              </Pressable>

              <View className="mx-4 flex-1">
                <Text className="text-[16px] font-medium text-[#2B2233]">
                  Khám phá địa điểm
                </Text>
              </View>

              <View className="flex-row items-center gap-2">
                <Pressable
                  accessibilityLabel="Mở tìm kiếm hotspot"
                  className="h-11 w-11 items-center justify-center rounded-full border border-[#F0E8F4] bg-[#FAF7FC]"
                  hitSlop={8}
                  onPress={() => router.push("/hotspots/search" as Href)}
                >
                  <SymbolView
                    name={{
                      ios: "magnifyingglass",
                      android: "search",
                      web: "search",
                    }}
                    size={17}
                    tintColor="#8E869A"
                  />
                </Pressable>

                <Pressable
                  accessibilityLabel="Mở toàn bộ tag địa điểm"
                  className="h-11 w-11 items-center justify-center rounded-full border border-[#F0E8F4] bg-[#FAF7FC]"
                  hitSlop={8}
                  onPress={() =>
                    setIsTagPanelVisible((currentValue) => !currentValue)
                  }
                >
                  <SymbolView
                    name={{
                      ios: "ellipsis",
                      android: "more_horiz",
                      web: "more_horiz",
                    }}
                    size={18}
                    tintColor="#8E869A"
                  />
                </Pressable>
              </View>
            </View>

            <ScrollView
              className="mt-4"
              contentContainerStyle={{ paddingRight: 30 }}
              horizontal
              nestedScrollEnabled
              showsHorizontalScrollIndicator={false}
            >
              {hotspotTagFilters.map((item, index) => (
                <View
                  key={item.label}
                  className={
                    index === hotspotTagFilters.length - 1 ? "" : "mr-3"
                  }
                >
                  <HotspotTagPill
                    active={item.label === resolvedActiveTag}
                    item={item}
                    onPress={() => {
                      setActiveTag(item.label);
                      setIsTagPanelVisible(false);
                    }}
                  />
                </View>
              ))}
            </ScrollView>

            {isTagPanelVisible ? (
              <View
                className="mt-4 rounded-[26px] border border-[#F0E8F4] bg-white p-4"
                style={cardShadowStyle}
              >
                <View className="flex-row items-center justify-between">
                  <Text className="text-[14px] font-extrabold text-[#2B2233]">
                    Tag từ dữ liệu
                  </Text>
                  {resolvedActiveTag !== defaultHotspotTag.label ? (
                    <Pressable
                      hitSlop={8}
                      onPress={() => {
                        setActiveTag(defaultHotspotTag.label);
                        setIsTagPanelVisible(false);
                      }}
                    >
                      <Text className="text-[12px] font-bold text-[#F58752]">
                        Xóa lọc
                      </Text>
                    </Pressable>
                  ) : null}
                </View>

                <View className="mt-4 flex-row flex-wrap gap-3">
                  {hotspotTagFilters.map((item) => (
                    <HotspotTagPill
                      key={`panel-${item.label}`}
                      active={item.label === resolvedActiveTag}
                      item={item}
                      onPress={() => {
                        setActiveTag(item.label);
                        setIsTagPanelVisible(false);
                      }}
                    />
                  ))}
                </View>
              </View>
            ) : null}
          </View>
        </LinearGradient>

        <View className="px-5 pt-5">
          {nearbyHotspotsStatus === "loading" ? (
            <View className="min-h-[520px] items-center justify-center bg-white px-6 py-10">
              <ActivityIndicator color="#E56A2C" size="large" />
              <Text className="mt-4 text-[15px] font-medium text-[#6F657A]">
                Đang tải dữ liệu...
              </Text>
            </View>
          ) : (
            <View className="gap-4">
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
                <View className="items-center rounded-[28px] border border-dashed border-[#F0E8F4] bg-[#FAF7FC] px-6 py-10">
                  <Text className="text-[15px] font-extrabold text-[#2B2233]">
                    {resolvedActiveTag === defaultHotspotTag.label
                      ? "Chưa có địa điểm gần bạn"
                      : "Chưa có địa điểm cho thẻ này"}
                  </Text>
                  <Text className="mt-2 max-w-[260px] text-center text-[12px] leading-[18px] text-[#8E869A]">
                    {resolvedActiveTag === defaultHotspotTag.label
                      ? "Hãy thử lại khi vị trí và dữ liệu sẵn sàng."
                      : "Hãy chọn tag khác để xem thêm các địa điểm phù hợp."}
                  </Text>
                </View>
              ) : null}
            </View>
          )}
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}
