import * as Location from "expo-location";
import { LinearGradient } from "expo-linear-gradient";
import { useRouter } from "expo-router";
import { SymbolView } from "expo-symbols";
import { useCallback, useEffect, useMemo, useState } from "react";
import {
  ActivityIndicator,
  Pressable,
  RefreshControl,
  ScrollView,
  Text,
  TextInput,
  View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

import { routeSystemAlert } from "@/features/route/components/route-system-alert";

import { getValidAccessToken, useAuthSession } from "@/features/auth/hooks/use-auth-session";
import { createCheckIn } from "@/features/home/api/post-checkin";
import {
  getNearbyHotspots,
  type NearbyHotspotDto,
} from "@/features/home/api/get-nearby-hotspots";
import { searchHotspots } from "@/features/home/api/search-hotspots";
import { AppMap, type AppMapPoint } from "@/features/map/components/app-map";
import { getMyProfile } from "@/features/profile/api/get-me";
import { usePremiumStatus, setPremiumStatusFromProfile } from "@/features/profile/hooks/use-premium-status";
import {
  finalizeRecordRoute,
  finishRecordRoute,
  getMyRecordJourneys,
  startRecordRoute,
  type RecordRouteDto,
} from "@/features/route/api/record-route-api";
import { openGoogleMapsMultiStopRoute } from "@/lib/google-maps-navigation";
import {
  ensureForegroundLocationPermission,
  getDevelopmentLocationOverride,
  getDeviceCoordinate,
} from "@/lib/location";

type RecordStatus = "READY" | "RECORDING" | "DRAFT" | "PUBLISHED";
type Coordinate = { latitude: number; longitude: number };

const DEFAULT_COORDINATE: Coordinate = { latitude: 10.7769, longitude: 106.7009 };
const NEARBY_DISTANCE_METERS = 5000;

function hotspotToMapPoint(hotspot: NearbyHotspotDto): AppMapPoint {
  return {
    id: `hotspot-${hotspot.hotspotId}`,
    title: hotspot.hotspotName,
    description: hotspot.address,
    latitude: hotspot.latitude,
    longitude: hotspot.longitude,
  };
}

function formatDistanceMeters(distance: number) {
  return distance >= 1000 ? `${Math.round(distance / 100) / 10} km` : `${Math.round(distance)} m`;
}

function distanceMeters(a: Coordinate, b: Coordinate) {
  const radius = 6371000;
  const lat1 = (a.latitude * Math.PI) / 180;
  const lat2 = (b.latitude * Math.PI) / 180;
  const deltaLat = ((b.latitude - a.latitude) * Math.PI) / 180;
  const deltaLng = ((b.longitude - a.longitude) * Math.PI) / 180;
  const value =
    Math.sin(deltaLat / 2) ** 2 +
    Math.cos(lat1) * Math.cos(lat2) * Math.sin(deltaLng / 2) ** 2;
  return radius * 2 * Math.atan2(Math.sqrt(value), Math.sqrt(1 - value));
}

export default function RecordJourneyScreen() {
  const router = useRouter();
  const session = useAuthSession();
  const [status, setStatus] = useState<RecordStatus>("READY");
  const [routeRecord, setRouteRecord] = useState<RecordRouteDto | null>(null);
  const [myJourneys, setMyJourneys] = useState<RecordRouteDto[]>([]);
  const [isLoadingJourneys, setIsLoadingJourneys] = useState(false);
  const [currentCoordinate, setCurrentCoordinate] = useState<Coordinate>(DEFAULT_COORDINATE);
  const [userAvatarUri, setUserAvatarUri] = useState<string | null>(null);
  const [finalizeDescription, setFinalizeDescription] = useState("");
  const { isPremium, isLoaded: isPremiumLoaded, requirePremium: requirePremiumStatus } = usePremiumStatus();
  const [nearbyHotspots, setNearbyHotspots] = useState<NearbyHotspotDto[]>([]);
  const [searchResults, setSearchResults] = useState<NearbyHotspotDto[]>([]);
  const [checkedInHotspots, setCheckedInHotspots] = useState<NearbyHotspotDto[]>([]);
  const [query, setQuery] = useState("");
  const [isStarting, setIsStarting] = useState(false);
  const [isFinishing, setIsFinishing] = useState(false);
  const [isFinalizing, setIsFinalizing] = useState(false);
  const [isLoadingNearby, setIsLoadingNearby] = useState(false);
  const [isSearching, setIsSearching] = useState(false);
  const [checkingInId, setCheckingInId] = useState<number | null>(null);
  const [nearbyError, setNearbyError] = useState<string | null>(null);

  const getAuth = useCallback(async () => {
    if (!session.isAuthenticated) throw new Error("Vui lòng đăng nhập để ghi hành trình.");
    const accessToken = await getValidAccessToken();
    if (!accessToken) throw new Error("Phiên đăng nhập đã hết hạn. Vui lòng đăng nhập lại.");
    return { accessToken, tokenType: session.tokenType };
  }, [session.isAuthenticated, session.tokenType]);


  const applyRouteRecord = useCallback((route: RecordRouteDto | null) => {
    setRouteRecord(route);
    if (!route) {
      setStatus("READY");
      setCheckedInHotspots([]);
      return;
    }

    const normalizedStatus: RecordStatus =
      route.status === "RECORDING" || route.status === "DRAFT" || route.status === "PUBLISHED"
        ? route.status
        : "READY";
    setStatus(normalizedStatus);
    setCheckedInHotspots(
      (route.hotspots ?? []).map((hotspot) => ({
        hotspotId: hotspot.hotspotId,
        hotspotName: hotspot.hotspotName ?? `Hotspot #${hotspot.hotspotId}`,
        address: hotspot.address ?? "",
        latitude: hotspot.latitude ?? DEFAULT_COORDINATE.latitude,
        longitude: hotspot.longitude ?? DEFAULT_COORDINATE.longitude,
        closingTime: "", createByUserId: null, createdAt: "", description: "", endTime: "",
        estimatedDurationMax: null, estimatedDurationMin: null, historyInformation: "",
        isCheckedIn: true, medias: [], openingTime: "", point: null, startTime: "",
        status: "", stories: [], tags: [], updatedAt: "", xp: null,
      })),
    );
  }, []);

  const loadMyJourneys = useCallback(async () => {
    if (!session.isAuthenticated) {
      setMyJourneys([]);
      applyRouteRecord(null);
      return [];
    }

    setIsLoadingJourneys(true);
    try {
      const auth = await getAuth();
      const journeys = await getMyRecordJourneys(auth);
      setMyJourneys(journeys);
      const recording = journeys.find((item) => item.status === "RECORDING") ?? null;
      applyRouteRecord(recording);
      return journeys;
    } catch (error) {
      routeSystemAlert.alert("Không thể tải hành trình", error instanceof Error ? error.message : "Vui lòng thử lại.");
      return [];
    } finally {
      setIsLoadingJourneys(false);
    }
  }, [applyRouteRecord, getAuth, session.isAuthenticated]);

  const resolveCurrentCoordinate = useCallback(async () => {
    const development = getDevelopmentLocationOverride();
    if (development) {
      setCurrentCoordinate(development);
      return development;
    }

    const permission = await ensureForegroundLocationPermission();
    if (!permission.granted) throw new Error("");

    const coordinate = await getDeviceCoordinate({
      accuracy: Location.Accuracy.High,
      maxAge: 30_000,
      mayShowUserSettingsDialog: true,
    });
    if (!coordinate) throw new Error("Không lấy được vị trí hiện tại.");
    setCurrentCoordinate(coordinate);
    return coordinate;
  }, []);

  const loadNearby = useCallback(async () => {
    setIsLoadingNearby(true);
    setNearbyError(null);
    try {
      const coordinate = await resolveCurrentCoordinate();
      const auth = session.isAuthenticated ? await getAuth() : null;
      const hotspots = await getNearbyHotspots({
        accessToken: auth?.accessToken,
        tokenType: auth?.tokenType,
        latitude: coordinate.latitude,
        longitude: coordinate.longitude,
        distance: NEARBY_DISTANCE_METERS,
      });
      setNearbyHotspots(hotspots);
    } catch (error) {
      setNearbyError(error instanceof Error ? error.message : "Không thể tải hotspot gần bạn.");
    } finally {
      setIsLoadingNearby(false);
    }
  }, [getAuth, resolveCurrentCoordinate, session.isAuthenticated]);


  useEffect(() => {
    let cancelled = false;

    async function loadCurrentUserProfile() {
      if (!session.isAuthenticated) {
        setUserAvatarUri(null);
        return;
      }

      try {
        const accessToken = await getValidAccessToken();
        if (!accessToken) return;
        const profile = await getMyProfile({
          accessToken,
          tokenType: session.tokenType,
        });
        if (!cancelled) {
          setUserAvatarUri(profile.avatar);
          // Đẩy isPremium vào store dùng chung để mọi màn hình/hành động
          // Premium khác trong app (không riêng màn record này) đọc được
          // giá trị mới nhất mà không phải gọi lại getMyProfile().
          setPremiumStatusFromProfile(profile.isPremium);
        }
      } catch (error) {
        console.warn("[record-journey] load current user profile failed", error);
      }
    }

    void loadCurrentUserProfile();
    return () => {
      cancelled = true;
    };
  }, [session.isAuthenticated, session.tokenType]);

  /**
   * Chức năng "Ghi hành trình" (record) là tính năng Premium. Nếu user chưa
   * nâng cấp, chặn hành động và đưa họ sang trang gói đăng ký thay vì gọi
   * thẳng API (BE cũng cần tự chặn ở phía server, đây chỉ là lớp UX ở FE).
   */
  const requirePremium = useCallback(
    () => requirePremiumStatus("Ghi hành trình cá nhân (Record Journey)"),
    [requirePremiumStatus],
  );

  useEffect(() => {
    void loadNearby();
  }, [loadNearby]);

  useEffect(() => {
    void loadMyJourneys();
  }, [loadMyJourneys]);

  useEffect(() => {
    const keyword = query.trim();
    if (keyword.length < 2) {
      setSearchResults([]);
      setIsSearching(false);
      return;
    }

    const controller = new AbortController();
    const timer = setTimeout(async () => {
      setIsSearching(true);
      try {
        const auth = session.isAuthenticated ? await getAuth() : null;
        const result = await searchHotspots({
          accessToken: auth?.accessToken,
          tokenType: auth?.tokenType,
          signal: controller.signal,
          payload: {
            filters: [{ field: "hotspotName", operator: "LIKE", value: keyword }],
            page: 0,
            size: 30,
            sortBy: "hotspotName",
            sortDirection: "ASC",
          },
        });
        setSearchResults(result.content);
      } catch (error) {
        if (!controller.signal.aborted) {
          routeSystemAlert.alert("Không thể tìm hotspot", error instanceof Error ? error.message : "Vui lòng thử lại.");
        }
      } finally {
        if (!controller.signal.aborted) setIsSearching(false);
      }
    }, 350);

    return () => {
      clearTimeout(timer);
      controller.abort();
    };
  }, [getAuth, query, session.isAuthenticated]);

  const displayedHotspots = query.trim().length >= 2 ? searchResults : nearbyHotspots;
  const mapPoints = useMemo<AppMapPoint[]>(() => {
    const userPoint: AppMapPoint = {
      id: "current-location",
      title: "Vị trí hiện tại",
      latitude: currentCoordinate.latitude,
      longitude: currentCoordinate.longitude,
      isCurrentUser: true,
      avatarUri: userAvatarUri,
    };
    const candidatePoints = displayedHotspots.slice(0, 12).map(hotspotToMapPoint);
    return [userPoint, ...checkedInHotspots.map(hotspotToMapPoint), ...candidatePoints];
  }, [checkedInHotspots, currentCoordinate, displayedHotspots, userAvatarUri]);

  const routeCoordinates = useMemo(
    () => checkedInHotspots.map(({ latitude, longitude }) => ({ latitude, longitude })),
    [checkedInHotspots],
  );

  async function handleStart() {
    if (!requirePremium()) return;
    setIsStarting(true);
    try {
      const auth = await getAuth();
      const route = await startRecordRoute(auth);
      applyRouteRecord(route);
      setMyJourneys((current) => [route, ...current.filter((item) => item.routeId !== route.routeId)]);
      routeSystemAlert.alert("Đã bắt đầu ghi", `Route #${route.routeId} đang ở trạng thái RECORDING.`);
    } catch (error) {
      routeSystemAlert.alert("Không thể bắt đầu", error instanceof Error ? error.message : "Vui lòng thử lại.");
    } finally {
      setIsStarting(false);
    }
  }

  async function handleCheckIn(hotspot: NearbyHotspotDto) {
    if (!requirePremium()) return;
    if (status !== "RECORDING") {
      routeSystemAlert.alert("Chưa ghi hành trình", "Hãy bấm Bắt đầu ghi hành trình trước khi check-in.");
      return;
    }
    if (checkedInHotspots.some((item) => item.hotspotId === hotspot.hotspotId)) {
      routeSystemAlert.alert("Đã check-in", "Hotspot này đã nằm trong hành trình đang ghi.");
      return;
    }

    setCheckingInId(hotspot.hotspotId);
    try {
      const auth = await getAuth();
      const coordinate = await resolveCurrentCoordinate();
      await createCheckIn({
        ...auth,
        hotspotId: hotspot.hotspotId,
        latitude: coordinate.latitude,
        longitude: coordinate.longitude,
      });
      setCheckedInHotspots((current) => [...current, hotspot]);
      await loadMyJourneys();
      routeSystemAlert.alert(
        "Check-in thành công",
        `${hotspot.hotspotName} đã được thêm vào route record.`,
      );
      void loadNearby();
    } catch (error) {
      routeSystemAlert.alert("Check-in thất bại", error instanceof Error ? error.message : "Vui lòng thử lại.");
    } finally {
      setCheckingInId(null);
    }
  }

  async function handleNavigate(hotspot: NearbyHotspotDto) {
    try {
      await openGoogleMapsMultiStopRoute({
        points: [hotspotToMapPoint(hotspot)],
        travelMode: "driving",
        useCurrentLocationAsOrigin: true,
      });
    } catch (error) {
      routeSystemAlert.alert("Không thể mở bản đồ", error instanceof Error ? error.message : "Vui lòng thử lại.");
    }
  }

  async function handleFinish() {
    if (!requirePremium()) return;
    if (!checkedInHotspots.length) {
      routeSystemAlert.alert("Chưa có check-in", "Hãy check-in ít nhất một hotspot trước khi kết thúc.");
      return;
    }
    setIsFinishing(true);
    try {
      const auth = await getAuth();
      const route = await finishRecordRoute(auth);
      setRouteRecord(route);
      setStatus("DRAFT");
      setMyJourneys((current) => [route, ...current.filter((item) => item.routeId !== route.routeId)]);
      routeSystemAlert.alert("Đã tạo bản nháp", "Route đã chuyển từ RECORDING sang DRAFT. Bạn có thể chỉnh sửa route và các story trước khi submit.");
    } catch (error) {
      routeSystemAlert.alert("Không thể kết thúc", error instanceof Error ? error.message : "Vui lòng thử lại.");
    } finally {
      setIsFinishing(false);
    }
  }

  async function handleFinalize() {
    if (!requirePremium()) return;
    if (!routeRecord?.routeId) return;
    setIsFinalizing(true);
    try {
      const auth = await getAuth();
      const route = await finalizeRecordRoute({
        ...auth,
        routeId: routeRecord.routeId,
        description: finalizeDescription.trim() || routeRecord.description || "",
      });
      setRouteRecord(route);
      setStatus(route.status === "PUBLISHED" ? "PUBLISHED" : "DRAFT");
      setMyJourneys((current) => [route, ...current.filter((item) => item.routeId !== route.routeId)]);
      routeSystemAlert.alert("Đã submit hành trình", "Custom Route đã chuyển sang trạng thái PUBLISHED.");
    } catch (error) {
      routeSystemAlert.alert("Không thể submit", error instanceof Error ? error.message : "Vui lòng thử lại.");
    } finally {
      setIsFinalizing(false);
    }
  }

  return (
    <SafeAreaView className="flex-1 bg-[#F7F8FC]" edges={["top", "left", "right"]}>
      <View className="flex-row items-center gap-3 px-4 py-3">
        <Pressable onPress={() => router.back()} className="h-10 w-10 items-center justify-center rounded-full bg-white">
          <SymbolView name={{ ios: "chevron.left", android: "arrow_back", web: "arrow_back" }} size={19} tintColor="#2B2233" />
        </Pressable>
        <View className="flex-1">
          <Text className="text-[20px] font-extrabold text-[#2B2233]">Ghi hành trình</Text>
          <Text className="text-[11px] text-[#777181]">Khám phá, check-in và lưu lại tuyến đường thực tế</Text>
        </View>
        <Pressable
          className="h-10 w-10 items-center justify-center rounded-full bg-[#FFF4EF]"
          onPress={() => routeSystemAlert.alert("Luồng sử dụng", "B1 bắt đầu record (yêu cầu Premium) → B2 tìm hotspot gần bạn hoặc search toàn hệ thống và check-in → B3 finish thành DRAFT → chỉnh sửa route/story → B4 finalize routeId thành PUBLISHED.")}
        >
          <Text className="text-[16px] font-extrabold text-[#F15B45]">?</Text>
        </Pressable>
      </View>

      <ScrollView
        contentContainerStyle={{ paddingBottom: 40 }}
        keyboardShouldPersistTaps="handled"
        refreshControl={<RefreshControl refreshing={isLoadingNearby || isLoadingJourneys} onRefresh={() => { void loadNearby(); void loadMyJourneys(); }} />}
        showsVerticalScrollIndicator={false}
      >
        <View className="px-4">
          <View className="overflow-hidden rounded-[30px] bg-white">
            <AppMap
              points={mapPoints}
              routeCoordinates={routeCoordinates}
              height={330}
              showsUserLocation={false}
            />
            <View className="absolute left-4 top-4 flex-row items-center gap-2 rounded-full bg-white/95 px-3 py-2">
              <View className={`h-2.5 w-2.5 rounded-full ${status === "RECORDING" ? "bg-[#F15B45]" : status === "DRAFT" ? "bg-[#F5A623]" : status === "PUBLISHED" ? "bg-[#36A269]" : "bg-[#9AA0AA]"}`} />
              <Text className="text-[10px] font-extrabold text-[#2B2233]">{status === "READY" ? "CHƯA BẮT ĐẦU" : status}</Text>
            </View>
            <Pressable onPress={() => void loadNearby()} className="absolute bottom-4 right-4 rounded-full bg-white px-4 py-3">
              <Text className="text-[10px] font-extrabold text-[#F15B45]">⌖ Cập nhật vị trí</Text>
            </Pressable>
          </View>
        </View>

        <View className="mt-4 px-4">
          <LinearGradient colors={["#E84D6A", "#F58752"]} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} className="rounded-3xl p-4">
            <Text className="text-[11px] font-bold uppercase tracking-wider text-white/80">Route Record</Text>
            <Text className="mt-1 text-[18px] font-extrabold text-white">
              {routeRecord?.routeName ?? (status === "READY" ? "Sẵn sàng ghi chuyến đi mới" : "Hành trình cá nhân")}
            </Text>
            <Text className="mt-1 text-[11px] leading-5 text-white/85">
              {status === "READY"
                ? "Mỗi Explorer chỉ có thể ghi một hành trình tại một thời điểm."
                : status === "RECORDING"
                  ? `${checkedInHotspots.length} địa điểm đã check-in · Route ID ${routeRecord?.routeId ?? "-"}`
                  : status === "DRAFT"
                    ? "Bản nháp đã sẵn sàng để cập nhật route và các story mặc định."
                    : "Route đã được gửi lên hệ thống với trạng thái PUBLISHED."}
            </Text>
          </LinearGradient>
        </View>

        {isPremiumLoaded && !isPremium ? (
          <View className="mt-4 px-4">
            <Pressable
              onPress={() => router.push("/subscription/premium" as any)}
              className="flex-row items-center gap-3 rounded-3xl bg-[#2B2233] p-4"
            >
              <View className="h-9 w-9 items-center justify-center rounded-full bg-[#EB489B]">
                <SymbolView name={{ ios: "crown.fill", android: "workspace_premium", web: "workspace_premium" }} size={16} tintColor="#fff" />
              </View>
              <View className="flex-1">
                <Text className="text-[12px] font-extrabold text-white">Ghi hành trình là tính năng Premium</Text>
                <Text className="mt-0.5 text-[10px] text-white/70">Nâng cấp để tự tạo hành trình cá nhân từ các hotspot bạn ghé qua</Text>
              </View>
              <Text className="text-[11px] font-extrabold text-[#EB489B]">Nâng cấp</Text>
            </Pressable>
          </View>
        ) : null}

        {status === "READY" ? (
          <View className="mt-4 px-4">
            <Pressable
              disabled={isStarting || !isPremium}
              onPress={() => void handleStart()}
              className={`flex-row items-center justify-center gap-2 rounded-2xl py-4 ${isPremium ? "bg-[#F15B45]" : "bg-[#D9DDE7]"}`}
            >
              {isStarting ? (
                <ActivityIndicator color="#fff" />
              ) : (
                <>
                  {!isPremium ? <SymbolView name={{ ios: "lock.fill", android: "lock", web: "lock" }} size={13} tintColor="#8E869A" /> : null}
                  <Text className={`text-center text-[13px] font-extrabold ${isPremium ? "text-white" : "text-[#8E869A]"}`}>Bắt đầu ghi hành trình</Text>
                </>
              )}
            </Pressable>
          </View>
        ) : null}

        <View className="mt-4 px-4">
          <View className="rounded-3xl bg-white p-4">
            <View className="flex-row items-center justify-between">
              <View className="flex-1 pr-3">
                <Text className="text-[14px] font-extrabold text-[#2B2233]">Hành trình của tôi</Text>
              </View>
              <Pressable onPress={() => void loadMyJourneys()} className="rounded-full bg-[#F1F3F7] px-3 py-2">
                {isLoadingJourneys ? <ActivityIndicator size="small" color="#EB489B" /> : <Text className="text-[10px] font-extrabold text-[#2B2233]">Làm mới</Text>}
              </Pressable>
            </View>
            <View className="mt-3 gap-2">
              {myJourneys.map((journey) => (
                <Pressable
                  key={journey.routeId}
                  onPress={() => { if (journey.status === "DRAFT" || journey.status === "PUBLISHED") applyRouteRecord(journey); }}
                  className={`rounded-2xl border p-3 ${journey.routeId === routeRecord?.routeId ? "border-[#EB489B] bg-[#FFF5FA]" : "border-[#E8EDF4] bg-white"}`}
                >
                  <View className="flex-row items-center justify-between gap-3">
                    <View className="flex-1">
                      <Text className="text-[12px] font-extrabold text-[#2B2233]">{journey.routeName ?? `Hành trình #${journey.routeId}`}</Text>
                      <Text className="mt-1 text-[10px] text-[#8E869A]">Route ID {journey.routeId} · {(journey.hotspots ?? []).length} hotspot</Text>
                    </View>
                    <View className="rounded-full bg-[#F1F3F7] px-3 py-1.5">
                      <Text className="text-[9px] font-extrabold text-[#5C5663]">{journey.status}</Text>
                    </View>
                  </View>
                </Pressable>
              ))}
              {!myJourneys.length && !isLoadingJourneys ? (
                <View className="items-center rounded-2xl border border-dashed border-[#D9DDE7] px-4 py-6">
                  <Text className="text-[11px] font-bold text-[#8E869A]">Bạn chưa có hành trình record nào</Text>
                </View>
              ) : null}
            </View>
          </View>
        </View>

        <View className="mt-4 px-4">
          <View className="rounded-3xl bg-white p-4">
            <Text className="text-[14px] font-extrabold text-[#2B2233]">Tìm hotspot để đi tiếp</Text>
            <Text className="mt-1 text-[10px] leading-4 text-[#8E869A]">
              Để trống để xem hotspot trong bán kính {formatDistanceMeters(NEARBY_DISTANCE_METERS)}. Nhập từ khóa để search toàn bộ content hotspot.
            </Text>
            <View className="mt-3 flex-row items-center rounded-2xl bg-[#F1F3F7] px-3">
              <SymbolView name={{ ios: "magnifyingglass", android: "search", web: "search" }} size={17} tintColor="#8E869A" />
              <TextInput
                value={query}
                onChangeText={setQuery}
                placeholder="Tìm tên hotspot..."
                placeholderTextColor="#A09AA8"
                className="flex-1 px-3 py-3.5 text-[13px] text-[#2B2233]"
              />
              {isSearching || isLoadingNearby ? <ActivityIndicator size="small" color="#EB489B" /> : null}
            </View>

            {nearbyError && query.trim().length < 2 ? (
              <Pressable onPress={() => void loadNearby()} className="mt-3 rounded-2xl bg-[#FFF3F3] p-3">
                <Text className="text-[10px] font-bold text-[#C74655]">{nearbyError} · Bấm để thử lại</Text>
              </Pressable>
            ) : null}

            <View className="mt-3 gap-2">
              {displayedHotspots.slice(0, 15).map((hotspot) => {
                const checked = checkedInHotspots.some((item) => item.hotspotId === hotspot.hotspotId);
                const distance = distanceMeters(currentCoordinate, hotspot);
                return (
                  <View key={hotspot.hotspotId} className="rounded-2xl border border-[#E8EDF4] p-3">
                    <View className="flex-row items-start gap-3">
                      <View className="h-10 w-10 items-center justify-center rounded-xl bg-[#FFF1F6]"><Text>📍</Text></View>
                      <View className="flex-1">
                        <Text className="text-[12px] font-extrabold text-[#2B2233]">{hotspot.hotspotName}</Text>
                        <Text className="mt-1 text-[10px] text-[#8E869A]" numberOfLines={2}>{hotspot.address}</Text>
                        <Text className="mt-1 text-[9px] font-bold text-[#F58752]">Cách khoảng {formatDistanceMeters(distance)}{hotspot.openingTime ? ` · Mở ${hotspot.openingTime}${hotspot.closingTime ? `–${hotspot.closingTime}` : ""}` : ""}</Text>
                      </View>
                      {checked ? <Text className="text-[10px] font-extrabold text-[#36A269]">ĐÃ CHECK-IN</Text> : null}
                    </View>
                    <View className="mt-3 flex-row gap-2">
                      <Pressable onPress={() => void handleNavigate(hotspot)} className="flex-1 rounded-xl bg-[#EEF6FF] py-3">
                        <Text className="text-center text-[10px] font-extrabold text-[#1677C8]">Chỉ đường</Text>
                      </Pressable>
                      <Pressable
                        disabled={status !== "RECORDING" || checked || checkingInId === hotspot.hotspotId}
                        onPress={() => void handleCheckIn(hotspot)}
                        className={`flex-1 rounded-xl py-3 ${status === "RECORDING" && !checked ? "bg-[#EB489B]" : "bg-[#D9DDE7]"}`}
                      >
                        {checkingInId === hotspot.hotspotId ? <ActivityIndicator size="small" color="#fff" /> : <Text className="text-center text-[10px] font-extrabold text-white">Check-in</Text>}
                      </Pressable>
                    </View>
                  </View>
                );
              })}
              {!displayedHotspots.length && !isSearching && !isLoadingNearby ? (
                <View className="items-center rounded-2xl border border-dashed border-[#D9DDE7] px-4 py-7">
                  <Text className="text-[11px] font-bold text-[#8E869A]">Không tìm thấy hotspot phù hợp</Text>
                </View>
              ) : null}
            </View>
          </View>
        </View>

        <View className="mt-4 px-4">
          <View className="rounded-3xl bg-white p-4">
            <View className="flex-row items-center justify-between">
              <View>
                <Text className="text-[14px] font-extrabold text-[#2B2233]">Hotspot đã đi qua</Text>
                <Text className="mt-0.5 text-[10px] text-[#8E869A]">Mỗi check-in tạo một story mặc định trong route record</Text>
              </View>
              <View className="rounded-full bg-[#FFF4EF] px-3 py-1.5"><Text className="text-[10px] font-extrabold text-[#F15B45]">{checkedInHotspots.length} CHECK-IN</Text></View>
            </View>
            <View className="mt-3 gap-2">
              {checkedInHotspots.map((item, index) => (
                <View key={item.hotspotId} className="flex-row items-center gap-3 rounded-2xl border border-[#E8EDF4] p-3">
                  <View className="h-10 w-10 items-center justify-center rounded-full bg-[#F15B45]"><Text className="text-[12px] font-extrabold text-white">{index + 1}</Text></View>
                  <View className="flex-1"><Text className="text-[12px] font-extrabold text-[#2B2233]">{item.hotspotName}</Text><Text className="mt-0.5 text-[10px] text-[#8E869A]">Story mặc định · chờ cập nhật title/content</Text></View>
                  <View className="rounded-lg bg-[#FFF8F4] px-2 py-1"><Text className="text-[9px] font-extrabold text-[#A44A35]">DRAFT</Text></View>
                </View>
              ))}
              {!checkedInHotspots.length ? <View className="items-center rounded-2xl border border-dashed border-[#D9DDE7] px-4 py-8"><Text className="text-[12px] font-bold text-[#8E869A]">Chưa có hotspot nào được check-in</Text></View> : null}
            </View>
          </View>
        </View>

        <View className="mt-4 gap-2 px-4">
          {status === "RECORDING" ? (
            <Pressable disabled={isFinishing} onPress={() => void handleFinish()} className="rounded-2xl bg-[#2B2233] py-4">
              {isFinishing ? <ActivityIndicator color="#fff" /> : <Text className="text-center text-[13px] font-extrabold text-white">Kết thúc và tạo bản nháp</Text>}
            </Pressable>
          ) : null}

          {status === "DRAFT" ? (
            <>
              <Pressable onPress={() => routeSystemAlert.alert("Chỉnh sửa bản nháp", "Kết nối tiếp API update route và update story tại đây. Route ID hiện tại: " + routeRecord?.routeId)} className="rounded-2xl border border-[#E8EDF4] bg-white py-4"><Text className="text-center text-[13px] font-extrabold text-[#2B2233]">Xem và chỉnh sửa route/story</Text></Pressable>
              <View className="rounded-2xl border border-[#E8EDF4] bg-white p-3">
                <Text className="text-[10px] font-extrabold text-[#8E869A]">Mô tả hành trình (gửi kèm khi submit)</Text>
                <TextInput
                  value={finalizeDescription}
                  onChangeText={setFinalizeDescription}
                  placeholder="Mô tả ngắn về hành trình của bạn..."
                  placeholderTextColor="#A09AA8"
                  multiline
                  className="mt-1 min-h-[44px] text-[12px] text-[#2B2233]"
                />
              </View>
              <Pressable disabled={isFinalizing} onPress={() => void handleFinalize()} className="rounded-2xl bg-[#EB489B] py-4">
                {isFinalizing ? <ActivityIndicator color="#fff" /> : <Text className="text-center text-[13px] font-extrabold text-white">Submit route lên hệ thống</Text>}
              </Pressable>
            </>
          ) : null}
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}
