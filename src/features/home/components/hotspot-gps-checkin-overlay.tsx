import { SymbolView } from "@/components/ui/symbol-view";
import { Image } from "expo-image";
import { LinearGradient } from "expo-linear-gradient";
import * as Location from "expo-location";
import { useRouter, type Href } from "expo-router";
import { StatusBar } from "expo-status-bar";
import {
  useCallback,
  useEffect,
  useRef,
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
import MapView, {
  Circle,
  Marker,
  Polyline,
  PROVIDER_GOOGLE,
  type Region,
} from "react-native-maps";
import {
  SafeAreaView,
  useSafeAreaInsets,
} from "react-native-safe-area-context";

import {
  getValidAccessToken,
  useAuthSession,
} from "@/features/auth/hooks/use-auth-session";
import {
  getDevelopmentLocationOverride,
  getDeviceCoordinate,
} from "@/lib/location";

import { getHotspotStories } from "../api/get-hotspot-stories";
import {
  createCheckIn,
  isDuplicateCheckInError,
  type CheckInResponse,
} from "../api/post-checkin";
import { cacheHotspotStories } from "../data/hotspot-story-cache";
import { buildHotspotThemeStoriesFromApi } from "../data/hotspot-theme-stories";
import {
  getHotspotCoordinateBySlug,
  type HotspotDetail,
} from "../data/hotspots";

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
const VERIFY_BUTTON_DISABLED_COLORS = [
  "#F8CADC",
  "#F8D0BA",
  "#FCE9B3",
] as const;
const DEFAULT_MAP_COORDINATE = {
  latitude: 10.77712,
  longitude: 106.69531,
} as const;
const MIN_MAP_DELTA = 0.0032;
const DEFAULT_MAP_DELTA = 0.0065;
const MAX_MAP_DELTA = 0.045;
const MAP_LOAD_TIMEOUT_MS = 6000;
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
  return hotspot.coordinate ?? getHotspotCoordinateBySlug(hotspot.slug);
}

function toRadians(value: number) {
  return (value * Math.PI) / 180;
}

function clampNumber(value: number, minimum: number, maximum: number) {
  return Math.min(Math.max(value, minimum), maximum);
}

function isValidCoordinate(
  coordinate: Coordinate | null | undefined,
): coordinate is Coordinate {
  return Boolean(
    coordinate &&
    Number.isFinite(coordinate.latitude) &&
    Number.isFinite(coordinate.longitude),
  );
}

function buildVerificationMapRegion(
  currentCoordinate: Coordinate | null,
  hotspotCoordinate: Coordinate | null,
): Region {
  if (
    isValidCoordinate(currentCoordinate) &&
    isValidCoordinate(hotspotCoordinate)
  ) {
    return {
      latitude: (currentCoordinate.latitude + hotspotCoordinate.latitude) / 2,
      longitude:
        (currentCoordinate.longitude + hotspotCoordinate.longitude) / 2,
      latitudeDelta: clampNumber(
        Math.abs(currentCoordinate.latitude - hotspotCoordinate.latitude) * 2.6,
        MIN_MAP_DELTA,
        MAX_MAP_DELTA,
      ),
      longitudeDelta: clampNumber(
        Math.abs(currentCoordinate.longitude - hotspotCoordinate.longitude) *
          2.6,
        MIN_MAP_DELTA,
        MAX_MAP_DELTA,
      ),
    };
  }

  const fallbackCoordinate =
    hotspotCoordinate ?? currentCoordinate ?? DEFAULT_MAP_COORDINATE;

  return {
    ...fallbackCoordinate,
    latitudeDelta: DEFAULT_MAP_DELTA,
    longitudeDelta: DEFAULT_MAP_DELTA,
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

function formatCheckInTimestamp(value: string) {
  const date = new Date(value);

  if (Number.isNaN(date.getTime())) {
    return null;
  }

  const pad = (part: number) => part.toString().padStart(2, "0");

  return `${pad(date.getHours())}:${pad(date.getMinutes())} ${pad(date.getDate())}/${pad(date.getMonth() + 1)}/${date.getFullYear()}`;
}

function formatNumericValue(value: number) {
  return value.toLocaleString("vi-VN");
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
  const mapRef = useRef<MapView | null>(null);
  const [pulse] = useState(() => new Animated.Value(0));
  const {
    latitude: mapLatitude,
    latitudeDelta: mapLatitudeDelta,
    longitude: mapLongitude,
    longitudeDelta: mapLongitudeDelta,
  } = buildVerificationMapRegion(currentCoordinate, hotspotCoordinate);
  const mapRegion = {
    latitude: mapLatitude,
    latitudeDelta: mapLatitudeDelta,
    longitude: mapLongitude,
    longitudeDelta: mapLongitudeDelta,
  };
  const resolvedCurrentCoordinate = isValidCoordinate(currentCoordinate)
    ? currentCoordinate
    : null;
  const resolvedHotspotCoordinate = isValidCoordinate(hotspotCoordinate)
    ? hotspotCoordinate
    : null;
  const mapStateKey = [
    mapLatitude,
    mapLongitude,
    resolvedCurrentCoordinate?.latitude ?? "current-lat-na",
    resolvedCurrentCoordinate?.longitude ?? "current-lng-na",
    resolvedHotspotCoordinate?.latitude ?? "hotspot-lat-na",
    resolvedHotspotCoordinate?.longitude ?? "hotspot-lng-na",
  ].join(":");
  const [loadedMapKey, setLoadedMapKey] = useState<string | null>(
    Platform.OS === "web" ? "web" : null,
  );
  const [mapError, setMapError] = useState<{
    key: string;
    message: string;
  } | null>(null);
  const hasMapLoaded = Platform.OS === "web" || loadedMapKey === mapStateKey;
  const activeMapError =
    mapError?.key === mapStateKey ? mapError.message : null;
  const showMapFallback = Boolean(activeMapError);

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

  useEffect(() => {
    if (Platform.OS === "web") {
      return;
    }

    mapRef.current?.animateToRegion(
      {
        latitude: mapLatitude,
        latitudeDelta: mapLatitudeDelta,
        longitude: mapLongitude,
        longitudeDelta: mapLongitudeDelta,
      },
      280,
    );
  }, [mapLatitude, mapLatitudeDelta, mapLongitude, mapLongitudeDelta]);

  useEffect(() => {
    if (Platform.OS === "web" || hasMapLoaded) {
      return;
    }

    const timeoutId = setTimeout(() => {
      setMapError({
        key: mapStateKey,
        message:
          "MapView da mount nhung tile Google Maps khong tai. Thuong do API key chua hop le, key dang bi restrict sai package/SHA-1, Maps SDK for Android chua bat, hoac ban chua rebuild app sau khi sua app.config.js/.env.",
      });
    }, MAP_LOAD_TIMEOUT_MS);

    return () => clearTimeout(timeoutId);
  }, [hasMapLoaded, mapStateKey]);

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
      {activeMapError ? (
        <View
          style={{
            position: "absolute",
            top: 16,
            left: 16,
            right: 16,
            zIndex: 20,
            borderRadius: 16,
            backgroundColor: "rgba(255, 69, 58, 0.92)",
            padding: 12,
          }}
        >
          <Text className="text-[12px] font-bold text-white">
            Google Maps error:
          </Text>
          <Text className="mt-1 text-[12px] text-white">{activeMapError}</Text>
        </View>
      ) : null}

      {Platform.OS === "web" ? (
        <LinearGradient
          colors={["#FFF4F8", "#FFF5E6", "#FFFCEF"]}
          end={{ x: 1, y: 1 }}
          start={{ x: 0, y: 0 }}
          style={{ bottom: 0, left: 0, position: "absolute", right: 0, top: 0 }}
        />
      ) : (
        <MapView
          key={mapStateKey}
          ref={mapRef}
          initialRegion={mapRegion}
          loadingEnabled
          moveOnMarkerPress={false}
          provider={PROVIDER_GOOGLE}
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
          {resolvedHotspotCoordinate ? (
            <Circle
              center={resolvedHotspotCoordinate}
              fillColor="rgba(235, 72, 155, 0.12)"
              radius={CHECKIN_RADIUS_METERS}
              strokeColor="rgba(235, 72, 155, 0.45)"
              strokeWidth={2}
            />
          ) : null}

          {resolvedCurrentCoordinate && resolvedHotspotCoordinate ? (
            <Polyline
              coordinates={[
                resolvedCurrentCoordinate,
                resolvedHotspotCoordinate,
              ]}
              lineCap="round"
              lineJoin="round"
              strokeColor="#10B981"
              strokeWidth={4}
            />
          ) : null}

          {resolvedHotspotCoordinate ? (
            <Marker
              coordinate={resolvedHotspotCoordinate}
              description="Điểm check-in của hotspot"
              title="Hotspot"
            >
              <View className="items-center">
                <View
                  className="mb-2 rounded-full px-3 py-1.5"
                  style={{ backgroundColor: SOFT_SURFACE_OVERLAY_SOFT }}
                >
                  <Text className="text-[11px] font-black uppercase tracking-[0.8px] text-[#EB489B]">
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
            </Marker>
          ) : null}

          {resolvedCurrentCoordinate ? (
            <Marker
              coordinate={resolvedCurrentCoordinate}
              description="Vị trí hiện tại của bạn"
              title="Vị trí của bạn"
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
                  <Text className="text-[11px] font-black uppercase tracking-[0.8px] text-[#10B981]">
                    Vị trí của bạn
                  </Text>
                </View>
              </View>
            </Marker>
          ) : null}
        </MapView>
      )}

      <LinearGradient
        pointerEvents="none"
        colors={["rgba(255,241,246,0.14)", "rgba(255,201,60,0.10)"]}
        end={{ x: 1, y: 1 }}
        start={{ x: 0, y: 0 }}
        style={{ bottom: 0, left: 0, position: "absolute", right: 0, top: 0 }}
      />
      <View
        pointerEvents="none"
        style={{
          backgroundColor: "rgba(255,255,255,0.08)",
          bottom: 0,
          left: 0,
          position: "absolute",
          right: 0,
          top: 0,
        }}
      />

      {showMapFallback ? (
        <LinearGradient
          pointerEvents="none"
          colors={[
            "rgba(255, 244, 248, 0.92)",
            "rgba(255, 245, 230, 0.90)",
            "rgba(255, 252, 239, 0.94)",
          ]}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 1 }}
          style={{ bottom: 0, left: 0, position: "absolute", right: 0, top: 0 }}
        >
          <View className="flex-1 items-center justify-center px-6">
            <View
              className="rounded-[28px] px-5 py-5"
              style={{ backgroundColor: "rgba(255,255,255,0.84)" }}
            >
              <View className="items-center">
                <View
                  className="h-16 w-16 items-center justify-center rounded-full"
                  style={{ backgroundColor: "rgba(255,255,255,0.92)" }}
                >
                  <LinearGradient
                    colors={LOGIN_GRADIENT_COLORS}
                    locations={[0, 0.58, 1]}
                    start={{ x: 0, y: 0.5 }}
                    end={{ x: 1, y: 0.5 }}
                    style={{
                      alignItems: "center",
                      borderRadius: 999,
                      height: 48,
                      justifyContent: "center",
                      width: 48,
                    }}
                  >
                    <SymbolView
                      name={
                        {
                          ios: "map.fill",
                          android: "map",
                          web: "map",
                        } as SymbolName
                      }
                      size={22}
                      tintColor="#FFFFFF"
                    />
                  </LinearGradient>
                </View>
                <Text className="mt-4 text-center text-[17px] font-black text-[#2B2233]">
                  Không tải được preview bản đồ check-in
                </Text>
                <Text className="mt-2 text-center text-[13px] leading-5 text-[#6F657A]">
                  GPS vẫn hoạt động, nhưng tile Google Maps của build này chưa
                  tải được. Kiểm tra API key, package Android và SHA-1 rồi
                  rebuild app.
                </Text>
              </View>
            </View>
          </View>
        </LinearGradient>
      ) : null}

      <View
        pointerEvents="none"
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
            <Text className="ml-2 text-[12px] font-black uppercase tracking-[0.8px] text-[#2B2233]">
              {distanceBadgeState}
            </Text>
          </View>
          <Text className="mt-1 text-center text-[13px] font-medium text-[#6F657A]">
            {distanceBadgeLabel}
          </Text>
        </View>
      </View>

      <View
        pointerEvents="none"
        className="absolute left-4 rounded-full px-3 py-2"
        style={{
          backgroundColor: SOFT_SURFACE_OVERLAY_SOFT,
          bottom: 10,
          position: "absolute",
        }}
      >
        <Text className="text-[11px] font-bold text-[#8E869A]">
          {showMapFallback
            ? "Sửa Google Maps config rồi rebuild để hiện preview bản đồ"
            : Platform.OS === "android"
              ? "Pinch hoặc dùng nút +/- để zoom"
              : "Pinch để zoom, kéo để di chuyển"}
        </Text>
      </View>

      {Platform.OS === "web" ? (
        <View
          pointerEvents="none"
          className="rounded-full px-3 py-2"
          style={{
            backgroundColor: SOFT_SURFACE_OVERLAY_SOFT,
            bottom: 10,
            position: "absolute",
            right: 10,
          }}
        >
          <Text className="text-[10px] font-bold text-[#8E869A]">
            Map tương tác khả dụng trên iOS/Android
          </Text>
        </View>
      ) : null}
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
  hotspotId,
  isStoryAvailable = true,
  onClose,
  onSuccess,
  rewardXp,
  totalRouteStopsCount,
  visitedRouteStopsCount,
}: {
  audioStoryDurationLabel: string;
  hotspot: HotspotDetail;
  hotspotId?: number | null;
  isStoryAvailable?: boolean;
  onClose: () => void;
  onSuccess: () => void;
  rewardXp: string;
  totalRouteStopsCount?: number;
  visitedRouteStopsCount?: number;
}) {
  const router = useRouter();
  const authSession = useAuthSession();
  const insets = useSafeAreaInsets();
  const [checkinStage, setCheckinStage] = useState<CheckinFlowStage>("verify");
  const [verificationStatus, setVerificationStatus] =
    useState<CheckinVerifyStatus>("loading");
  const [distanceMeters, setDistanceMeters] = useState<number | null>(null);
  const [currentCoordinate, setCurrentCoordinate] = useState<Coordinate | null>(
    null,
  );
  const [isStoryPrefetching, setIsStoryPrefetching] = useState(false);
  const [storyPrefetchError, setStoryPrefetchError] = useState<string | null>(
    null,
  );
  const [isSubmittingCheckIn, setIsSubmittingCheckIn] = useState(false);
  const [checkInError, setCheckInError] = useState<string | null>(null);
  const [checkInResult, setCheckInResult] = useState<CheckInResponse | null>(
    null,
  );
  const storiesHref =
    typeof hotspotId === "number" && hotspotId > 0
      ? (`/hotspot/${hotspot.slug}/stories?hotspotId=${hotspotId}` as Href)
      : (`/hotspot/${hotspot.slug}/stories` as Href);

  const prefetchUnlockedStories = useCallback(async () => {
    if (
      !(typeof hotspotId === "number" && hotspotId > 0) ||
      !isStoryAvailable
    ) {
      return;
    }

    setIsStoryPrefetching(true);
    setStoryPrefetchError(null);

    try {
      const accessToken = authSession.isAuthenticated
        ? await getValidAccessToken()
        : null;
      const stories = await getHotspotStories({
        accessToken,
        hotspotId,
        status: "DRAFT",
        tokenType: authSession.tokenType,
      });
      const mappedStories = buildHotspotThemeStoriesFromApi(hotspot, stories);

      cacheHotspotStories({
        hotspotId,
        slug: hotspot.slug,
        stories: mappedStories,
      });
    } catch (error) {
      console.warn("[checkin] prefetch hotspot stories failed", {
        error: error instanceof Error ? error.message : error,
        hotspotId,
        slug: hotspot.slug,
      });
      setStoryPrefetchError(
        error instanceof Error
          ? error.message
          : "Không tải được story từ hệ thống.",
      );
    } finally {
      setIsStoryPrefetching(false);
    }
  }, [
    authSession.isAuthenticated,
    authSession.tokenType,
    hotspot,
    hotspotId,
    isStoryAvailable,
  ]);

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

      const developmentLocation = getDevelopmentLocationOverride();

      if (developmentLocation) {
        const nextDistanceMeters = getDistanceMeters(
          developmentLocation,
          hotspotCoordinate,
        );

        setCurrentCoordinate(developmentLocation);
        setDistanceMeters(nextDistanceMeters);
        setVerificationStatus(
          nextDistanceMeters <= CHECKIN_RADIUS_METERS ? "ready" : "too-far",
        );
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

      const nextCoordinate = await getDeviceCoordinate({
        accuracy: Location.Accuracy.High,
        maxAge: 15_000,
        requiredAccuracy: 80,
      });

      if (!nextCoordinate) {
        setVerificationStatus("error");
        setDistanceMeters(null);
        setCurrentCoordinate(null);
        return;
      }

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

  const hotspotCoordinate = getHotspotCoordinate(hotspot);

  const submitCheckIn = useCallback(async () => {
    if (!authSession.isAuthenticated) {
      onClose();
      router.push("/login?entry=home" as Href);
      return;
    }

    if (!(typeof hotspotId === "number" && hotspotId > 0)) {
      setCheckInError("Hotspot này chưa có mã API để gửi check-in.");
      return;
    }

    const accessToken = await getValidAccessToken();

    if (!accessToken) {
      setCheckInError("Phiên đăng nhập không hợp lệ. Vui lòng đăng nhập lại.");
      return;
    }

    const requestCoordinate = currentCoordinate ?? hotspotCoordinate;

    if (!requestCoordinate) {
      setCheckInError("Không xác định được vị trí để gửi check-in.");
      return;
    }

    setIsSubmittingCheckIn(true);
    setCheckInError(null);

    try {
      const nextCheckInResult = await createCheckIn({
        accessToken,
        hotspotId,
        latitude: requestCoordinate.latitude,
        longitude: requestCoordinate.longitude,
        tokenType: authSession.tokenType,
      });

      setCheckInResult(nextCheckInResult);
      onSuccess();
      setCheckinStage("success");
      void prefetchUnlockedStories();
    } catch (error) {
      if (isDuplicateCheckInError(error)) {
        onSuccess();
        onClose();
        return;
      }

      setCheckInError(
        error instanceof Error ? error.message : "Không thể hoàn tất check-in.",
      );
    } finally {
      setIsSubmittingCheckIn(false);
    }
  }, [
    authSession.isAuthenticated,
    authSession.tokenType,
    currentCoordinate,
    hotspotCoordinate,
    hotspotId,
    onClose,
    onSuccess,
    prefetchUnlockedStories,
    router,
  ]);

  useEffect(() => {
    const timeoutId = setTimeout(() => {
      void verifyCurrentLocation();
    }, 0);

    return () => clearTimeout(timeoutId);
  }, [verifyCurrentLocation]);

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
  const parsedRewardXp = Number(rewardXp.replace(/\D/g, ""));
  const xpEarned =
    checkInResult?.xpEarned ??
    (Number.isFinite(parsedRewardXp) ? parsedRewardXp : 0);
  const pointEarned = checkInResult?.pointEarned ?? null;
  const checkInMetaLabel = checkInResult
    ? [
        `Check-in #${checkInResult.checkInId}`,
        `Hotspot #${checkInResult.hotspotId}`,
        formatCheckInTimestamp(checkInResult.checkInAt),
      ]
        .filter(Boolean)
        .join(" · ")
    : null;
  const isSuccessStage = checkinStage === "success";
  const verifyButtonColors = verificationCopy.primaryDisabled
    ? VERIFY_BUTTON_DISABLED_COLORS
    : LOGIN_GRADIENT_COLORS;
  const isPrimaryActionDisabled =
    verificationCopy.primaryDisabled || isSubmittingCheckIn;
  const primaryButtonLabel =
    verificationStatus === "ready" && isSubmittingCheckIn
      ? "Đang check-in..."
      : verificationCopy.primaryLabel;
  const successRows = [
    {
      icon: {
        ios: "sparkles",
        android: "auto_awesome",
        web: "auto_awesome",
      } as SymbolName,
      iconBackground: "#FFC93C",
      label: "Phần thưởng",
      trailing: `+${formatNumericValue(xpEarned)}`,
      value: `+${formatNumericValue(xpEarned)} XP`,
    },
    ...(pointEarned !== null
      ? [
          {
            icon: {
              ios: "dollarsign.circle.fill",
              android: "monetization_on",
              web: "monetization_on",
            } as SymbolName,
            iconBackground: "#F58752",
            label: "Điểm nhận",
            trailing: `+${formatNumericValue(pointEarned)}`,
            value: `+${formatNumericValue(pointEarned)} điểm`,
          },
        ]
      : []),
    {
      icon: {
        ios: "speaker.wave.2.fill",
        android: "volume_up",
        web: "volume_up",
      } as SymbolName,
      iconBackground: SUCCESS_CHECK_ICON_COLOR,
      label: "Mở khóa",
      trailing: "✓",
      value: `Story hotspot ${audioStoryDurationLabel}`,
    },
    {
      icon: {
        ios: "map.fill",
        android: "map",
        web: "map",
      } as SymbolName,
      iconBackground: SUCCESS_CHECK_ICON_COLOR,
      label: "Tiến độ tuyến",
      trailing:
        checkInResult?.userRouteProgressId != null
          ? `#${checkInResult.userRouteProgressId}`
          : "✓",
      value: routeProgressLabel,
    },
  ];

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
          backgroundColor: isSuccessStage
            ? SUCCESS_SCREEN_BACKGROUND
            : "#FFF7FB",
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
              colors={[
                "rgba(255, 250, 253, 0.72)",
                "rgba(255, 244, 249, 0.96)",
              ]}
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
                  className="mt-2 text-[16px] font-semibold"
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
                {successRows.map((item, index) => (
                  <View
                    key={item.label}
                    className={
                      index === successRows.length - 1
                        ? "flex-row items-center"
                        : "mb-3 flex-row items-center"
                    }
                  >
                    <View
                      className="h-11 w-11 items-center justify-center rounded-full"
                      style={{ backgroundColor: item.iconBackground }}
                    >
                      <SymbolView
                        name={item.icon}
                        size={18}
                        tintColor="#FFFFFF"
                      />
                    </View>

                    <View className="ml-3 flex-1">
                      <Text
                        className="text-[12px] font-black uppercase tracking-[0.9px]"
                        style={{ color: SUCCESS_CARD_LABEL }}
                      >
                        {item.label}
                      </Text>
                      <Text
                        className="mt-0.5 text-[17px] font-black"
                        style={{ color: SUCCESS_CARD_VALUE }}
                      >
                        {item.value}
                      </Text>
                    </View>

                    <Text
                      className="text-[17px] font-black"
                      style={{
                        color:
                          item.label === "Phần thưởng" ||
                          item.label === "Điểm nhận"
                            ? "#F58752"
                            : SUCCESS_CHECK_ICON_COLOR,
                      }}
                    >
                      {item.trailing}
                    </Text>
                  </View>
                ))}
              </View>

              {isStoryAvailable ? (
                <Pressable
                  className="mt-8 overflow-hidden rounded-full"
                  onPress={() => router.push(storiesHref)}
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
                    <Text className="ml-2 text-[16px] font-black text-white">
                      Xem story hotspot
                    </Text>
                  </LinearGradient>
                </Pressable>
              ) : null}

              {isStoryAvailable && isStoryPrefetching ? (
                <Text className="mt-4 text-center text-[13px] font-medium text-[#A897B2]">
                  Đang tải story từ API cho hotspot này...
                </Text>
              ) : null}

              {isStoryAvailable && storyPrefetchError ? (
                <Text className="mt-4 text-center text-[13px] font-medium text-[#D97706]">
                  {storyPrefetchError}
                </Text>
              ) : null}

              {checkInMetaLabel ? (
                <Text className="mt-4 text-center text-[13px] font-medium text-[#8E869A]">
                  {checkInMetaLabel}
                </Text>
              ) : null}

              <Text className="mt-6 text-center text-[13px] leading-5 text-[#8E869A]">
                {isStoryAvailable
                  ? `Mở khóa +${formatNumericValue(xpEarned)} XP, story hotspot và đánh giá địa điểm.`
                  : `Mở khóa +${formatNumericValue(xpEarned)} XP và hoàn tất check-in cho địa điểm này.`}
              </Text>

              <Pressable
                className="mt-5 items-center rounded-full border px-5 py-4"
                onPress={onClose}
                style={{
                  backgroundColor: SUCCESS_SECONDARY_BUTTON_BACKGROUND,
                  borderColor: SUCCESS_SECONDARY_BUTTON_BORDER,
                }}
              >
                <Text className="text-[16px] font-black text-[#6F657A]">
                  Tiếp tục khám phá
                </Text>
              </Pressable>
            </ScrollView>
          ) : (
            <ScrollView
              className="flex-1"
              contentContainerStyle={{ flexGrow: 1, minHeight: "100%" }}
              nestedScrollEnabled
              showsVerticalScrollIndicator={false}
            >
              <View
                className="relative"
                style={{ height: "52%", minHeight: 372 }}
              >
                <VerificationMapPreview
                  currentCoordinate={currentCoordinate}
                  distanceMeters={distanceMeters}
                  hotspotCoordinate={hotspotCoordinate}
                  verificationStatus={verificationStatus}
                />

                <View
                  className="absolute left-0 right-0"
                  style={{
                    paddingHorizontal: 20,
                    paddingTop: insets.top + 12,
                    top: 0,
                    zIndex: 10,
                  }}
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
                      <Text className="ml-1.5 text-[13px] font-bold text-white">
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
                  <Text className="text-[11px] font-black uppercase tracking-[0.8px] text-[#EB489B]">
                    {hotspot.category}
                  </Text>
                </View>

                <Text className="mt-4 text-[34px] font-black leading-[38px] text-[#2B2233]">
                  {hotspot.title}
                </Text>
                <Text className="mt-2 text-[15px] leading-6 text-[#8E869A]">
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
                    <Text className="ml-2 text-[11px] font-black uppercase tracking-[0.9px] text-[#EB489B]">
                      {verificationCopy.badgeLabel}
                    </Text>
                  </View>
                  <Text className="mt-2 text-[15px] font-medium leading-5 text-[#6F657A]">
                    {verificationCopy.helperText}
                  </Text>
                </View>

                <Pressable
                  className="mt-6 overflow-hidden rounded-full"
                  disabled={isPrimaryActionDisabled}
                  onPress={() => {
                    if (verificationStatus === "ready") {
                      void submitCheckIn();
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
                      opacity: isPrimaryActionDisabled ? 0.84 : 1,
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
                    <Text className="ml-2 text-[18px] font-black text-white">
                      {primaryButtonLabel}
                    </Text>
                  </LinearGradient>
                </Pressable>

                {checkInError ? (
                  <Text className="mt-4 text-center text-[13px] font-medium text-[#D97706]">
                    {checkInError}
                  </Text>
                ) : null}

                <Text className="mt-4 text-center text-[13px] leading-5 text-[#8E869A]">
                  {`Mở khóa +${rewardXp} XP, story hotspot và đánh giá địa điểm.`}
                </Text>
              </View>
            </ScrollView>
          )}
        </SafeAreaView>
      </View>
    </Modal>
  );
}
