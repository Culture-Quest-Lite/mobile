import { Image } from "expo-image";
import { LinearGradient } from "expo-linear-gradient";
import * as Location from "expo-location";
import { type Href, useRouter } from "expo-router";
import { SymbolView } from "expo-symbols";
import { StatusBar } from "expo-status-bar";
import {
  useCallback,
  useEffect,
  useState,
  type ComponentProps,
} from "react";
import {
  Animated,
  Easing,
  Modal,
  Platform,
  Pressable,
  ScrollView,
  Text,
  View,
} from "react-native";
import { SafeAreaView, useSafeAreaInsets } from "react-native-safe-area-context";

import type { HotspotDetail } from "../data/hotspots";

type SymbolName = ComponentProps<typeof SymbolView>["name"];

type Coordinate = {
  latitude: number;
  longitude: number;
};

type CheckinVerifyStatus =
  | "loading"
  | "ready"
  | "too-far"
  | "permission-denied"
  | "error";

type CheckinFlowStage = "verify" | "success";

const CHECKIN_RADIUS_METERS = 50;
const LOGIN_GRADIENT_COLORS = ["#EB489B", "#F58752", "#FFC93C"] as const;
const VERIFY_BUTTON_DISABLED_COLORS = ["#F8CADC", "#F8D0BA", "#FCE9B3"] as const;
const DEFAULT_MAP_COORDINATE = { latitude: 10.77712, longitude: 106.69531 } as const;
const MAP_TILE_SIZE = 256;
const MAP_TILE_GRID_RADIUS = 1;
const MAP_CANVAS_SIZE = MAP_TILE_SIZE * (MAP_TILE_GRID_RADIUS * 2 + 1);
const MAP_ZOOM_LEVEL = 15;
const MAX_MAP_MARKER_OFFSET = 118;
const MAP_PREVIEW_MIN_MARKER_DISTANCE = 94;
const MAP_PREVIEW_MAX_MARKER_DISTANCE = 188;
const SUCCESS_RING_COLORS = ["#4ADE80", "#22C55E", "#16A34A"] as const;
const SUCCESS_PRIMARY_BUTTON_COLORS = LOGIN_GRADIENT_COLORS;
const SOFT_SURFACE = "#FFF9FD";
const SOFT_SURFACE_ELEVATED = "#FFF5FA";
const SOFT_SURFACE_OVERLAY = "rgba(255, 247, 251, 0.94)";
const SOFT_SURFACE_OVERLAY_SOFT = "rgba(255, 247, 251, 0.90)";
const SUCCESS_SCREEN_BACKGROUND = "#FFF7FB";
const SUCCESS_CARD_BACKGROUND = "rgba(255, 249, 253, 0.96)";
const SUCCESS_CARD_BORDER = "#F4DCE6";
const SUCCESS_CARD_LABEL = "#B888A1";
const SUCCESS_CARD_VALUE = "#2B2233";
const SUCCESS_TITLE_COLOR = "#EB489B";
const SUCCESS_SUBTITLE_COLOR = "#6F657A";
const SUCCESS_SECONDARY_BUTTON_BACKGROUND = "rgba(255, 245, 250, 0.92)";
const SUCCESS_SECONDARY_BUTTON_BORDER = "rgba(235, 72, 155, 0.16)";
const SUCCESS_CHECK_ICON_COLOR = "#22C55E";
const SUCCESS_CHECK_ICON_BORDER = "rgba(255, 255, 255, 0.92)";

const hotspotCoordinatesBySlug: Record<string, Coordinate> = {
  "bao-tang-my-thuat": { latitude: 10.7694, longitude: 106.6981 },
  "buu-dien-sai-gon": { latitude: 10.78012, longitude: 106.69901 },
  "cho-dam": { latitude: 12.25136, longitude: 109.19063 },
  "demo-checkin-story": { latitude: 10.77712, longitude: 106.69531 },
  "dinh-doc-lap": { latitude: 10.77712, longitude: 106.69531 },
  "duong-sach-nguyen-van-binh": { latitude: 10.78039, longitude: 106.69957 },
  "nha-hat-thanh-pho": { latitude: 10.77656, longitude: 106.70335 },
  "nha-tho-duc-ba": { latitude: 10.77972, longitude: 106.69903 },
  "pho-di-bo-nguyen-hue": { latitude: 10.77274, longitude: 106.70322 },
};

function isAlwaysReadyHotspot(hotspot: HotspotDetail) {
  return hotspot.checkinMode === "always-ready";
}

const panelShadowStyle = {
  shadowColor: "rgba(15, 23, 42, 0.35)",
  shadowOpacity: 1,
  shadowRadius: 28,
  shadowOffset: {
    width: 0,
    height: 18,
  },
  elevation: 14,
} as const;

const buttonShadowStyle = {
  shadowColor: "rgba(235, 72, 155, 0.26)",
  shadowOpacity: 1,
  shadowRadius: 18,
  shadowOffset: {
    width: 0,
    height: 10,
  },
  elevation: 8,
} as const;

function getHotspotCoordinate(hotspot: HotspotDetail) {
  return hotspotCoordinatesBySlug[hotspot.slug] ?? null;
}

function toRadians(value: number) {
  return (value * Math.PI) / 180;
}

function clampLatitude(value: number) {
  return Math.max(-85.05112878, Math.min(85.05112878, value));
}

function getWorldPixelCoordinate(coordinate: Coordinate, zoom: number) {
  const boundedLatitude = clampLatitude(coordinate.latitude);
  const scale = MAP_TILE_SIZE * 2 ** zoom;
  const x = ((coordinate.longitude + 180) / 360) * scale;
  const latitudeRadians = toRadians(boundedLatitude);
  const y =
    ((1 -
      Math.log(
        Math.tan(latitudeRadians) + 1 / Math.cos(latitudeRadians),
      ) /
        Math.PI) /
      2) *
    scale;

  return { x, y };
}

function normalizeTileX(tileX: number, zoom: number) {
  const tileCount = 2 ** zoom;

  return ((tileX % tileCount) + tileCount) % tileCount;
}

function clampTileY(tileY: number, zoom: number) {
  const tileCount = 2 ** zoom;

  return Math.max(0, Math.min(tileCount - 1, tileY));
}

function getTileImageUri(tileX: number, tileY: number, zoom: number) {
  return `https://tile.openstreetmap.org/${zoom}/${normalizeTileX(tileX, zoom)}/${clampTileY(tileY, zoom)}.png`;
}

function getTileImageSource(uri: string) {
  if (Platform.OS === "web") {
    return uri;
  }

  return {
    headers: {
      "User-Agent": "CultureQuestLite/1.0 (tile-preview)",
    },
    uri,
  };
}

function getMapCenterCoordinate(
  currentCoordinate: Coordinate | null,
  hotspotCoordinate: Coordinate | null,
) {
  if (currentCoordinate && hotspotCoordinate) {
    return {
      latitude: (currentCoordinate.latitude + hotspotCoordinate.latitude) / 2,
      longitude: (currentCoordinate.longitude + hotspotCoordinate.longitude) / 2,
    };
  }

  return hotspotCoordinate ?? currentCoordinate ?? DEFAULT_MAP_COORDINATE;
}

function buildMapTileDescriptors(centerCoordinate: Coordinate, zoom = MAP_ZOOM_LEVEL) {
  const centerWorld = getWorldPixelCoordinate(centerCoordinate, zoom);
  const centerCanvasOffsetX = MAP_CANVAS_SIZE / 2 - centerWorld.x;
  const centerCanvasOffsetY = MAP_CANVAS_SIZE / 2 - centerWorld.y;
  const centerTileX = Math.floor(centerWorld.x / MAP_TILE_SIZE);
  const centerTileY = Math.floor(centerWorld.y / MAP_TILE_SIZE);
  const tileDescriptors: {
    key: string;
    left: number;
    top: number;
    uri: string;
  }[] = [];

  for (let tileYDelta = -MAP_TILE_GRID_RADIUS; tileYDelta <= MAP_TILE_GRID_RADIUS; tileYDelta += 1) {
    for (
      let tileXDelta = -MAP_TILE_GRID_RADIUS;
      tileXDelta <= MAP_TILE_GRID_RADIUS;
      tileXDelta += 1
    ) {
      const tileX = centerTileX + tileXDelta;
      const tileY = centerTileY + tileYDelta;

      tileDescriptors.push({
        key: `${zoom}-${tileX}-${tileY}`,
        left: tileX * MAP_TILE_SIZE + centerCanvasOffsetX,
        top: tileY * MAP_TILE_SIZE + centerCanvasOffsetY,
        uri: getTileImageUri(tileX, tileY, zoom),
      });
    }
  }

  return tileDescriptors;
}

function getMapPixelOffset(
  coordinate: Coordinate,
  centerCoordinate: Coordinate,
  zoom = MAP_ZOOM_LEVEL,
) {
  const currentWorld = getWorldPixelCoordinate(coordinate, zoom);
  const centerWorld = getWorldPixelCoordinate(centerCoordinate, zoom);
  
  return {
    x: currentWorld.x - centerWorld.x,
    y: currentWorld.y - centerWorld.y,
  };
}

function clampVectorLength(
  offset: { x: number; y: number },
  maxLength = MAX_MAP_MARKER_OFFSET,
) {
  const distance = Math.hypot(offset.x, offset.y);

  if (distance <= maxLength || distance === 0) {
    return offset;
  }

  const ratio = maxLength / distance;

  return {
    x: offset.x * ratio,
    y: offset.y * ratio,
  };
}

function getResolvedMapMarkerOffsets(
  currentCoordinate: Coordinate | null,
  hotspotCoordinate: Coordinate | null,
  centerCoordinate: Coordinate,
) {
  const hotspotBaseOffset = hotspotCoordinate
    ? getMapPixelOffset(hotspotCoordinate, centerCoordinate)
    : { x: 0, y: 0 };

  if (!currentCoordinate || !hotspotCoordinate) {
    return {
      currentMarkerOffset: currentCoordinate
        ? clampVectorLength(getMapPixelOffset(currentCoordinate, centerCoordinate))
        : null,
      hotspotMarkerOffset: clampVectorLength(hotspotBaseOffset),
    };
  }

  const currentBaseOffset = getMapPixelOffset(currentCoordinate, centerCoordinate);
  const routeVector = {
    x: currentBaseOffset.x - hotspotBaseOffset.x,
    y: currentBaseOffset.y - hotspotBaseOffset.y,
  };
  const distance = Math.hypot(routeVector.x, routeVector.y);

  if (distance < 1) {
    return {
      currentMarkerOffset: { x: 0, y: 44 },
      hotspotMarkerOffset: { x: 0, y: -44 },
    };
  }

  const targetDistance = Math.min(
    Math.max(distance, MAP_PREVIEW_MIN_MARKER_DISTANCE),
    MAP_PREVIEW_MAX_MARKER_DISTANCE,
  );
  const scale = targetDistance / distance;

  return {
    currentMarkerOffset: clampVectorLength({
      x: currentBaseOffset.x * scale,
      y: currentBaseOffset.y * scale,
    }),
    hotspotMarkerOffset: clampVectorLength({
      x: hotspotBaseOffset.x * scale,
      y: hotspotBaseOffset.y * scale,
    }),
  };
}

function getDistanceMeters(from: Coordinate, to: Coordinate) {
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

function formatDistance(distanceMeters: number | null) {
  if (distanceMeters === null) {
    return "--";
  }

  if (distanceMeters < 1000) {
    return `${Math.max(1, Math.round(distanceMeters))}m`;
  }

  return `${(distanceMeters / 1000).toFixed(1)}km`;
}

function buildStatusCopy(
  status: CheckinVerifyStatus,
  distanceMeters: number | null,
  isAlwaysReady = false,
) {
  if (status === "loading") {
    return {
      accentColor: "#EB489B",
      badgeLabel: "GPS đang xác minh",
      helperText: "Đang xác định vị trí hiện tại của bạn...",
      primaryLabel: "Đang xác minh...",
      primaryDisabled: true,
      primaryGradient: VERIFY_BUTTON_DISABLED_COLORS,
    };
  }

  if (status === "ready") {
    return {
      accentColor: "#F58752",
      badgeLabel: isAlwaysReady ? "Hotspot test sẵn sàng" : "GPS xác minh",
      helperText: isAlwaysReady
        ? "Điểm demo này luôn xác minh thành công để bạn test story và UI sau check-in."
        : `Bạn cách ${formatDistance(distanceMeters)} · trong bán kính 50m`,
      primaryLabel: "Check-in ngay",
      primaryDisabled: false,
      primaryGradient: LOGIN_GRADIENT_COLORS,
    };
  }

  if (status === "too-far") {
    return {
      accentColor: "#FFC93C",
      badgeLabel: "Chưa đủ gần",
      helperText: `Bạn cách ${formatDistance(distanceMeters)} · cần vào gần hơn 50m`,
      primaryLabel: "Làm mới vị trí",
      primaryDisabled: false,
      primaryGradient: LOGIN_GRADIENT_COLORS,
    };
  }

  if (status === "permission-denied") {
    return {
      accentColor: "#EB489B",
      badgeLabel: "Cần quyền vị trí",
      helperText: "Cho phép truy cập vị trí để xác minh check-in GPS.",
      primaryLabel: "Thử lại",
      primaryDisabled: false,
      primaryGradient: LOGIN_GRADIENT_COLORS,
    };
  }

  return {
    accentColor: "#F58752",
    badgeLabel: "Không lấy được GPS",
    helperText: "Không thể xác định vị trí hiện tại. Hãy thử lại sau.",
    primaryLabel: "Thử lại",
    primaryDisabled: false,
    primaryGradient: LOGIN_GRADIENT_COLORS,
  };
}

function VerificationMapPreview({
  currentCoordinate,
  distanceMeters,
  hotspotCoordinate,
  verificationStatus,
}: {
  currentCoordinate: Coordinate | null;
  distanceMeters: number | null;
  hotspotCoordinate: Coordinate | null;
  verificationStatus: CheckinVerifyStatus;
}) {
  const [pulse] = useState(() => new Animated.Value(0));
  const centerCoordinate = getMapCenterCoordinate(currentCoordinate, hotspotCoordinate);
  const mapTiles = buildMapTileDescriptors(centerCoordinate);

  useEffect(() => {
    const animation = Animated.loop(
      Animated.sequence([
        Animated.timing(pulse, {
          duration: 1050,
          easing: Easing.out(Easing.ease),
          toValue: 1,
          useNativeDriver: true,
        }),
        Animated.timing(pulse, {
          duration: 1050,
          easing: Easing.inOut(Easing.ease),
          toValue: 0,
          useNativeDriver: true,
        }),
      ]),
    );

    animation.start();

    return () => {
      animation.stop();
      pulse.stopAnimation();
    };
  }, [pulse]);

  const { currentMarkerOffset, hotspotMarkerOffset } = getResolvedMapMarkerOffsets(
    currentCoordinate,
    hotspotCoordinate,
    centerCoordinate,
  );
  const routeVector = currentMarkerOffset
    ? {
        x: currentMarkerOffset.x - hotspotMarkerOffset.x,
        y: currentMarkerOffset.y - hotspotMarkerOffset.y,
      }
    : null;
  const routeLength = routeVector
    ? Math.max(Math.hypot(routeVector.x, routeVector.y) - 48, 0)
    : 0;
  const routeAngle = routeVector
    ? (Math.atan2(routeVector.y, routeVector.x) * 180) / Math.PI
    : 0;
  const routeMidpoint = currentMarkerOffset && routeVector
    ? {
        x: (currentMarkerOffset.x + hotspotMarkerOffset.x) / 2,
        y: (currentMarkerOffset.y + hotspotMarkerOffset.y) / 2,
      }
    : null;
  const markerPulseScale = pulse.interpolate({
    inputRange: [0, 1],
    outputRange: [0.8, 1.65],
  });
  const markerPulseOpacity = pulse.interpolate({
    inputRange: [0, 1],
    outputRange: [0.18, 0.52],
  });
  const distanceBadgeColor =
    verificationStatus === "ready"
      ? "#10B981"
      : verificationStatus === "too-far"
        ? "#F59E0B"
        : "#EB489B";
  const distanceBadgeLabel =
    distanceMeters === null
      ? "Đang xác định khoảng cách..."
      : `Cách hotspot ${formatDistance(distanceMeters)}`;
  const distanceBadgeState =
    distanceMeters === null
      ? "Đang xác minh GPS"
      : distanceMeters <= CHECKIN_RADIUS_METERS
        ? "Trong vùng 50m"
        : "Ngoài vùng 50m";

  return (
    <View className="overflow-hidden" style={{ flex: 1 }}>
      <View
        style={{
          height: MAP_CANVAS_SIZE,
          left: "50%",
          position: "absolute",
          top: "50%",
          transform: [
            { translateX: -(MAP_CANVAS_SIZE / 2) },
            { translateY: -(MAP_CANVAS_SIZE / 2) },
          ],
          width: MAP_CANVAS_SIZE,
        }}
      >
        {mapTiles.map((tile) => (
          <Image
            key={tile.key}
            source={getTileImageSource(tile.uri)}
            contentFit="cover"
            transition={120}
            cachePolicy="memory-disk"
            style={{
              height: MAP_TILE_SIZE,
              left: tile.left,
              position: "absolute",
              top: tile.top,
              width: MAP_TILE_SIZE,
            }}
          />
        ))}
      </View>
      <LinearGradient
        colors={["rgba(255,241,246,0.14)", "rgba(255,201,60,0.10)"]}
        end={{ x: 1, y: 1 }}
        start={{ x: 0, y: 0 }}
        style={{ bottom: 0, left: 0, position: "absolute", right: 0, top: 0 }}
      />
      <View
        style={{
          backgroundColor: "rgba(255,255,255,0.08)",
          bottom: 0,
          left: 0,
          position: "absolute",
          right: 0,
          top: 0,
        }}
      />

      {routeMidpoint && routeLength > 0 ? (
        <View
          style={{
            left: "50%",
            position: "absolute",
            top: "50%",
            transform: [
              { translateX: routeMidpoint.x - routeLength / 2 },
              { translateY: routeMidpoint.y - 2.5 },
              { rotate: `${routeAngle}deg` },
            ],
          }}
        >
          <LinearGradient
            colors={["#22C55E", "#10B981", "#34D399"]}
            locations={[0, 0.58, 1]}
            start={{ x: 0, y: 0.5 }}
            end={{ x: 1, y: 0.5 }}
            style={{
              borderRadius: 999,
              height: 5,
              width: routeLength,
            }}
          />
        </View>
      ) : null}

      <View
        className="absolute left-4 right-4"
        style={{ top: 86 }}
      >
        <View
          className="self-center rounded-full px-4 py-2.5"
          style={{ backgroundColor: SOFT_SURFACE_OVERLAY }}
        >
          <View className="flex-row items-center">
            <View
              className="h-2.5 w-2.5 rounded-full"
              style={{ backgroundColor: distanceBadgeColor }}
            />
            <Text className="ml-2 text-[11px] font-black uppercase tracking-[0.8px] text-[#2B2233]">
              {distanceBadgeState}
            </Text>
          </View>
          <Text className="mt-1 text-center text-[12px] font-medium text-[#6F657A]">
            {distanceBadgeLabel}
          </Text>
        </View>
      </View>

      <View
        style={{
          left: "50%",
          position: "absolute",
          top: "50%",
          transform: [
            { translateX: hotspotMarkerOffset.x - 34 },
            { translateY: hotspotMarkerOffset.y - 48 },
          ],
        }}
      >
        <View className="items-center">
          <View
            className="mb-2 rounded-full px-3 py-1.5"
            style={{ backgroundColor: SOFT_SURFACE_OVERLAY_SOFT }}
          >
            <Text className="text-[10px] font-black uppercase tracking-[0.8px] text-[#EB489B]">
              Hotspot
            </Text>
          </View>
          <View
            style={{
              alignItems: "center",
              backgroundColor: SOFT_SURFACE_OVERLAY,
              borderRadius: 999,
              height: 68,
              justifyContent: "center",
              width: 68,
            }}
          >
            <LinearGradient
              colors={LOGIN_GRADIENT_COLORS}
              locations={[0, 0.58, 1]}
              start={{ x: 0, y: 0.5 }}
              end={{ x: 1, y: 0.5 }}
              style={{
                alignItems: "center",
                borderRadius: 999,
                height: 52,
                justifyContent: "center",
                width: 52,
              }}
            >
              <SymbolView
                name={
                  {
                    ios: "location.fill",
                    android: "place",
                    web: "place",
                  } as SymbolName
                }
                size={24}
                tintColor="#FFFFFF"
              />
            </LinearGradient>
          </View>
        </View>
      </View>

      {currentMarkerOffset ? (
        <View
          style={{
            left: "50%",
            position: "absolute",
            top: "50%",
            transform: [
              { translateX: currentMarkerOffset.x - 28 },
              { translateY: currentMarkerOffset.y - 28 },
            ],
          }}
        >
          <View className="items-center">
            <Animated.View
              style={{
                backgroundColor: "rgba(34, 197, 94, 0.22)",
                borderRadius: 999,
                height: 70,
                opacity: markerPulseOpacity,
                position: "absolute",
                top: -7,
                transform: [{ scale: markerPulseScale }],
                width: 70,
              }}
            />
            <View
              style={{
                alignItems: "center",
                backgroundColor: "#10B981",
                borderColor: "#FFFFFF",
                borderRadius: 999,
                borderWidth: 4,
                height: 56,
                justifyContent: "center",
                width: 56,
              }}
            >
              <View
                style={{
                  alignItems: "center",
                  backgroundColor: SOFT_SURFACE,
                  borderRadius: 999,
                  height: 24,
                  justifyContent: "center",
                  width: 24,
                }}
              >
                <SymbolView
                  name={
                    {
                      ios: "person.fill",
                      android: "person",
                      web: "person",
                    } as SymbolName
                  }
                  size={14}
                  tintColor="#10B981"
                />
              </View>
            </View>
            <View
              className="mt-2 rounded-full px-3 py-1.5"
              style={{ backgroundColor: SOFT_SURFACE_OVERLAY_SOFT }}
            >
              <Text className="text-[10px] font-black uppercase tracking-[0.8px] text-[#10B981]">
                Vị trí của bạn
              </Text>
            </View>
          </View>
        </View>
      ) : null}

      <View
        className="rounded-full px-2.5 py-1.5"
        style={{
          backgroundColor: SOFT_SURFACE_OVERLAY_SOFT,
          bottom: 10,
          position: "absolute",
          right: 10,
        }}
      >
        <Text className="text-[9px] font-bold text-[#8E869A]">
          © OpenStreetMap
        </Text>
      </View>
    </View>
  );
}

function SuccessRing() {
  return (
    <View className="items-center justify-center" style={{ height: 156 }}>
      <LinearGradient
        colors={SUCCESS_RING_COLORS}
        end={{ x: 1, y: 1 }}
        start={{ x: 0, y: 0 }}
        className="h-[112px] w-[112px] items-center justify-center rounded-full"
      >
        <View
          className="h-[72px] w-[72px] items-center justify-center rounded-full border-[5px]"
          style={{ borderColor: SUCCESS_CHECK_ICON_BORDER }}
        >
          <SymbolView
            name={
              {
                ios: "checkmark",
                android: "check",
                web: "check",
              } as SymbolName
            }
            size={36}
            tintColor="#FFFFFF"
          />
        </View>
      </LinearGradient>
    </View>
  );
}

export function HotspotGpsCheckinOverlay({
  audioStoryDurationLabel,
  hotspot,
  onClose,
  onSuccess,
  rewardXp,
  totalRouteStopsCount,
  visitedRouteStopsCount,
}: {
  audioStoryDurationLabel: string;
  hotspot: HotspotDetail;
  onClose: () => void;
  onSuccess: () => void;
  rewardXp: string;
  totalRouteStopsCount?: number;
  visitedRouteStopsCount?: number;
}) {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const [checkinStage, setCheckinStage] = useState<CheckinFlowStage>("verify");
  const [verificationStatus, setVerificationStatus] =
    useState<CheckinVerifyStatus>("loading");
  const [distanceMeters, setDistanceMeters] = useState<number | null>(null);
  const [currentCoordinate, setCurrentCoordinate] = useState<Coordinate | null>(
    null,
  );

  const verifyCurrentLocation = useCallback(async () => {
    const hotspotCoordinate = getHotspotCoordinate(hotspot);

    if (!hotspotCoordinate) {
      setVerificationStatus("error");
      setDistanceMeters(null);
      setCurrentCoordinate(null);
      return;
    }

    try {
      setVerificationStatus("loading");
      setDistanceMeters(null);

      if (isAlwaysReadyHotspot(hotspot)) {
        setCurrentCoordinate(hotspotCoordinate);
        setDistanceMeters(0);
        setVerificationStatus("ready");
        return;
      }

      const permissionResponse =
        await Location.requestForegroundPermissionsAsync();

      if (permissionResponse.status !== "granted") {
        setVerificationStatus("permission-denied");
        return;
      }

      if (Platform.OS === "android") {
        try {
          await Location.enableNetworkProviderAsync();
        } catch {
          // Ignore when the device already has an active location provider.
        }
      }

      const location =
        (await Location.getLastKnownPositionAsync({
          maxAge: 15_000,
          requiredAccuracy: 80,
        })) ??
        (await Location.getCurrentPositionAsync({
          accuracy: Location.Accuracy.High,
        }));

      const nextCoordinate = {
        latitude: location.coords.latitude,
        longitude: location.coords.longitude,
      };
      const nextDistanceMeters = getDistanceMeters(
        nextCoordinate,
        hotspotCoordinate,
      );

      setCurrentCoordinate(nextCoordinate);
      setDistanceMeters(nextDistanceMeters);
      setVerificationStatus(
        nextDistanceMeters <= CHECKIN_RADIUS_METERS ? "ready" : "too-far",
      );
    } catch {
      setVerificationStatus("error");
      setDistanceMeters(null);
      setCurrentCoordinate(null);
    }
  }, [hotspot]);

  useEffect(() => {
    const timeoutId = setTimeout(() => {
      void verifyCurrentLocation();
    }, 0);

    return () => clearTimeout(timeoutId);
  }, [verifyCurrentLocation]);

  const hotspotCoordinate = getHotspotCoordinate(hotspot);
  const verificationCopy = buildStatusCopy(
    verificationStatus,
    distanceMeters,
    isAlwaysReadyHotspot(hotspot),
  );
  const routeProgressLabel =
    typeof totalRouteStopsCount === "number" &&
    typeof visitedRouteStopsCount === "number"
      ? `${visitedRouteStopsCount}/${totalRouteStopsCount} chặng đã ghé`
      : "Đã xác minh tại hotspot này";
  const isSuccessStage = checkinStage === "success";
  const verifyButtonColors = verificationCopy.primaryDisabled
    ? VERIFY_BUTTON_DISABLED_COLORS
    : LOGIN_GRADIENT_COLORS;

  return (
    <Modal
      animationType="fade"
      navigationBarTranslucent={Platform.OS === "android"}
      onRequestClose={onClose}
      presentationStyle="fullScreen"
      statusBarTranslucent={Platform.OS === "android"}
      visible
    >
      <StatusBar style="dark" />

      <View
        className="flex-1"
        style={{
          backgroundColor: isSuccessStage ? SUCCESS_SCREEN_BACKGROUND : "#FFF7FB",
        }}
      >
        {isSuccessStage ? (
          <>
            <Image
              source={hotspot.imageUri}
              contentFit="cover"
              transition={180}
              cachePolicy="memory-disk"
              style={{
                bottom: 0,
                left: 0,
                opacity: 0.12,
                position: "absolute",
                right: 0,
                top: 0,
              }}
            />

            <LinearGradient
              colors={["rgba(255, 250, 253, 0.72)", "rgba(255, 244, 249, 0.96)"]}
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
          </>
        ) : null}

          <SafeAreaView
            className="flex-1"
            edges={isSuccessStage ? ["top", "bottom"] : ["bottom"]}
          >
            {isSuccessStage ? (
              <ScrollView
                className="flex-1"
                contentContainerStyle={{
                  paddingBottom: insets.bottom + 20,
                  paddingHorizontal: 20,
                  paddingTop: 8,
                }}
                showsVerticalScrollIndicator={false}
              >
                <Pressable
                  className="h-10 w-10 items-center justify-center rounded-full"
                  hitSlop={8}
                  onPress={onClose}
                  style={{ backgroundColor: SOFT_SURFACE_OVERLAY_SOFT }}
                >
                  <SymbolView
                    name={
                      {
                        ios: "xmark",
                        android: "close",
                        web: "close",
                      } as SymbolName
                    }
                    size={18}
                    tintColor="#EB489B"
                  />
                </Pressable>

                <View className="mt-4 items-center">
                  <SuccessRing />

                  <Text
                    className="mt-3 text-center text-[22px] font-black leading-8"
                    style={{ color: SUCCESS_TITLE_COLOR }}
                  >
                    Check-in thành{"\n"}công!
                  </Text>
                  <Text
                    className="mt-2 text-[15px] font-semibold"
                    style={{ color: SUCCESS_SUBTITLE_COLOR }}
                  >
                    {hotspot.title}
                  </Text>
                </View>

                <View
                  className="mt-8 rounded-[28px] border px-4 py-4"
                  style={[
                    panelShadowStyle,
                    {
                      backgroundColor: SUCCESS_CARD_BACKGROUND,
                      borderColor: SUCCESS_CARD_BORDER,
                      shadowColor: "rgba(235, 72, 155, 0.12)",
                      shadowRadius: 20,
                    },
                  ]}
                >
                  {[
                    {
                      icon: {
                        ios: "sparkles",
                        android: "auto_awesome",
                        web: "auto_awesome",
                      } as SymbolName,
                      iconBackground: "#FFC93C",
                      label: "Phần thưởng",
                      trailing: `+${rewardXp}`,
                      value: `+${rewardXp} XP`,
                    },
                    {
                      icon: {
                        ios: "speaker.wave.2.fill",
                        android: "volume_up",
                        web: "volume_up",
                      } as SymbolName,
                      iconBackground: SUCCESS_CHECK_ICON_COLOR,
                      label: "Mở khóa",
                      trailing: "✓",
                      value: `Audio story ${audioStoryDurationLabel}`,
                    },
                    {
                      icon: {
                        ios: "map.fill",
                        android: "map",
                        web: "map",
                      } as SymbolName,
                      iconBackground: SUCCESS_CHECK_ICON_COLOR,
                      label: "Tiến độ tuyến",
                      trailing: "✓",
                      value: routeProgressLabel,
                    },
                  ].map((item, index) => (
                    <View
                      key={item.label}
                      className={
                        index === 2 ? "flex-row items-center" : "mb-3 flex-row items-center"
                      }
                    >
                      <View
                        className="h-11 w-11 items-center justify-center rounded-full"
                        style={{ backgroundColor: item.iconBackground }}
                      >
                        <SymbolView name={item.icon} size={18} tintColor="#FFFFFF" />
                      </View>

                      <View className="ml-3 flex-1">
                        <Text
                          className="text-[11px] font-black uppercase tracking-[0.9px]"
                          style={{ color: SUCCESS_CARD_LABEL }}
                        >
                          {item.label}
                        </Text>
                        <Text
                          className="mt-0.5 text-[16px] font-black"
                          style={{ color: SUCCESS_CARD_VALUE }}
                        >
                          {item.value}
                        </Text>
                      </View>

                      <Text
                        className="text-[16px] font-black"
                        style={{
                          color:
                            item.label === "Phần thưởng"
                              ? "#F58752"
                              : SUCCESS_CHECK_ICON_COLOR,
                        }}
                      >
                        {item.trailing}
                      </Text>
                    </View>
                  ))}
                </View>

                <Pressable
                  className="mt-8 overflow-hidden rounded-full"
                  onPress={() => router.push(`/hotspot/${hotspot.slug}/stories` as Href)}
                  style={buttonShadowStyle}
                >
                  <LinearGradient
                    colors={SUCCESS_PRIMARY_BUTTON_COLORS}
                    end={{ x: 1, y: 0.5 }}
                    locations={[0, 0.58, 1]}
                    start={{ x: 0, y: 0.5 }}
                    className="flex-row items-center justify-center px-5 py-4"
                  >
                    <SymbolView
                      name={
                        {
                          ios: "speaker.wave.2.fill",
                          android: "volume_up",
                          web: "volume_up",
                        } as SymbolName
                      }
                      size={16}
                      tintColor="#FFFFFF"
                    />
                    <Text className="ml-2 text-[15px] font-black text-white">
                      Xem audio story
                    </Text>
                  </LinearGradient>
                </Pressable>

                <Text className="mt-6 text-center text-[12px] leading-5 text-[#8E869A]">
                  {`Mở khóa +${rewardXp} XP, audio story và đánh giá địa điểm.`}
                </Text>

                <Pressable
                  className="mt-5 items-center rounded-full border px-5 py-4"
                  onPress={onClose}
                  style={{
                    backgroundColor: SUCCESS_SECONDARY_BUTTON_BACKGROUND,
                    borderColor: SUCCESS_SECONDARY_BUTTON_BORDER,
                  }}
                >
                  <Text className="text-[15px] font-black text-[#6F657A]">
                    Tiếp tục khám phá
                  </Text>
                </Pressable>
              </ScrollView>
            ) : (
            <View className="flex-1">
              <View className="relative" style={{ height: "52%", minHeight: 372 }}>
                <VerificationMapPreview
                  currentCoordinate={currentCoordinate}
                  distanceMeters={distanceMeters}
                  hotspotCoordinate={hotspotCoordinate}
                  verificationStatus={verificationStatus}
                />

                <View
                  className="absolute left-0 right-0"
                  style={{ paddingHorizontal: 20, paddingTop: insets.top + 12, top: 0 }}
                >
                  <View className="flex-row items-center justify-between">
                    <Pressable
                      className="h-11 w-11 items-center justify-center rounded-full"
                      hitSlop={8}
                      onPress={onClose}
                      style={{ backgroundColor: SOFT_SURFACE_OVERLAY_SOFT }}
                    >
                      <SymbolView
                        name={
                          {
                            ios: "xmark",
                            android: "close",
                            web: "close",
                          } as SymbolName
                        }
                        size={18}
                        tintColor="#EB489B"
                      />
                    </Pressable>

                    <LinearGradient
                      colors={LOGIN_GRADIENT_COLORS}
                      end={{ x: 1, y: 0.5 }}
                      locations={[0, 0.58, 1]}
                      start={{ x: 0, y: 0.5 }}
                      className="flex-row items-center rounded-full px-4 py-2"
                    >
                      <SymbolView
                        name={
                          {
                            ios: "safari.fill",
                            android: "explore",
                            web: "explore",
                          } as SymbolName
                        }
                        size={13}
                        tintColor="#FFFFFF"
                      />
                      <Text className="ml-1.5 text-[12px] font-bold text-white">
                        Đang khám phá
                      </Text>
                    </LinearGradient>

                    <View className="h-11 w-11" />
                  </View>
                </View>
              </View>

              <View
                className="-mt-8 flex-1 rounded-t-[34px] px-6 pt-5"
                style={{
                  backgroundColor: SOFT_SURFACE,
                  paddingBottom: Math.max(insets.bottom + 14, 24),
                }}
              >
                <View
                  className="self-center rounded-full bg-[#F5D6E4]"
                  style={{ height: 5, width: 54 }}
                />

                <View
                  className="mt-5 self-start rounded-full px-3 py-1.5"
                  style={{ backgroundColor: SOFT_SURFACE_ELEVATED }}
                >
                  <Text className="text-[10px] font-black uppercase tracking-[0.8px] text-[#EB489B]">
                    {hotspot.category}
                  </Text>
                </View>

                <Text className="mt-4 text-[34px] font-black leading-[38px] text-[#2B2233]">
                  {hotspot.title}
                </Text>
                <Text className="mt-2 text-[14px] leading-6 text-[#8E869A]">
                  {hotspot.address}
                </Text>

                <View
                  className="mt-6 rounded-[24px] border border-[#F4DCE6] px-4 py-4"
                  style={[
                    panelShadowStyle,
                    {
                      backgroundColor: SOFT_SURFACE,
                      shadowColor: "rgba(235, 72, 155, 0.12)",
                      shadowRadius: 20,
                    },
                  ]}
                >
                  <View className="flex-row items-center">
                    <View
                      className="h-2.5 w-2.5 rounded-full"
                      style={{ backgroundColor: verificationCopy.accentColor }}
                    />
                    <Text className="ml-2 text-[10px] font-black uppercase tracking-[0.9px] text-[#EB489B]">
                      {verificationCopy.badgeLabel}
                    </Text>
                  </View>
                  <Text className="mt-2 text-[14px] font-medium leading-5 text-[#6F657A]">
                    {verificationCopy.helperText}
                  </Text>
                </View>

                <Pressable
                  className="mt-6 overflow-hidden rounded-full"
                  disabled={verificationCopy.primaryDisabled}
                  onPress={() => {
                    if (verificationStatus === "ready") {
                      onSuccess();
                      setCheckinStage("success");
                      return;
                    }

                    void verifyCurrentLocation();
                  }}
                  style={buttonShadowStyle}
                >
                  <LinearGradient
                    colors={verifyButtonColors}
                    end={{ x: 1, y: 0.5 }}
                    locations={[0, 0.58, 1]}
                    start={{ x: 0, y: 0.5 }}
                    className="flex-row items-center justify-center px-5 py-4"
                    style={{
                      opacity: verificationCopy.primaryDisabled ? 0.84 : 1,
                    }}
                  >
                    <SymbolView
                      name={
                        {
                          ios:
                            verificationStatus === "ready"
                              ? "sparkles"
                              : "location.fill",
                          android:
                            verificationStatus === "ready"
                              ? "auto_awesome"
                              : "place",
                          web:
                            verificationStatus === "ready"
                              ? "auto_awesome"
                              : "place",
                        } as SymbolName
                      }
                      size={16}
                      tintColor="#FFFFFF"
                    />
                    <Text className="ml-2 text-[17px] font-black text-white">
                      {verificationCopy.primaryLabel}
                    </Text>
                  </LinearGradient>
                </Pressable>

                <Text className="mt-4 text-center text-[12px] leading-5 text-[#8E869A]">
                  {`Mở khóa +${rewardXp} XP, audio story và đánh giá địa điểm.`}
                </Text>
              </View>
            </View>
          )}
        </SafeAreaView>
      </View>
    </Modal>
  );
}
