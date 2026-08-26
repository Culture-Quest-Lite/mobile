import * as Location from "expo-location";
import { LinearGradient } from "expo-linear-gradient";
import { useRouter } from "expo-router";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
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
  MIN_RECORD_HOTSPOTS,
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
import { appAlert } from "@/components/ui/app-dialog";
import { appToast } from "@/components/ui/app-toast";
import { SymbolView } from "@/components/ui/symbol-view";

type RecordStatus = "READY" | "RECORDING" | "DRAFT" | "PUBLISHED";
type Coordinate = { latitude: number; longitude: number };

const DEFAULT_COORDINATE: Coordinate = { latitude: 10.7769, longitude: 106.7009 };
const NEARBY_DISTANCE_METERS = 5000;
const DESCRIPTION_MAX_LENGTH = 300;

/**
 * Người dùng không cần biết tên trạng thái trong hệ thống (RECORDING, DRAFT...).
 * Mọi chỗ hiển thị đều đi qua bảng này.
 */
const STATUS_LABEL: Record<string, string> = {
  DRAFT: "Bản nháp",
  PUBLISHED: "Đã đăng",
  READY: "Chưa bắt đầu",
  RECORDING: "Đang ghi",
  TRIAL: "Đang thử",
};

const STATUS_DOT_COLOR: Record<string, string> = {
  DRAFT: "#F5A623",
  PUBLISHED: "#36A269",
  READY: "#9AA0AA",
  RECORDING: "#F15B45",
  TRIAL: "#9AA0AA",
};

function statusLabel(value: string | undefined) {
  return (value && STATUS_LABEL[value]) || "Chưa bắt đầu";
}

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
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [currentCoordinate, setCurrentCoordinate] = useState<Coordinate>(DEFAULT_COORDINATE);
  const [userAvatarUri, setUserAvatarUri] = useState<string | null>(null);
  const [finalizeDescription, setFinalizeDescription] = useState("");
  const {
    canUsePremiumFeatures,
    isLoaded: isPremiumLoaded,
    requirePremium: requirePremiumStatus,
  } = usePremiumStatus();
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
  const [journeysError, setJourneysError] = useState<string | null>(null);
  /** Hành trình đang được hiển thị, dùng để biết lần apply sau có cùng hành trình không. */
  const appliedRouteIdRef = useRef<number | null>(null);

  const getAuth = useCallback(async () => {
    if (!session.isAuthenticated) throw new Error("Vui lòng đăng nhập để ghi hành trình.");
    const accessToken = await getValidAccessToken();
    if (!accessToken) throw new Error("Phiên đăng nhập đã hết hạn. Vui lòng đăng nhập lại.");
    return { accessToken, tokenType: session.tokenType };
  }, [session.isAuthenticated, session.tokenType]);


  const applyRouteRecord = useCallback((route: RecordRouteDto | null) => {
    setRouteRecord(route);
    if (!route) {
      appliedRouteIdRef.current = null;
      setStatus("READY");
      setCheckedInHotspots([]);
      return;
    }

    const normalizedStatus: RecordStatus =
      route.status === "RECORDING" || route.status === "DRAFT" || route.status === "PUBLISHED"
        ? route.status
        : "READY";
    setStatus(normalizedStatus);

    const serverHotspots: NearbyHotspotDto[] = (route.hotspots ?? []).map((hotspot) => ({
      hotspotId: hotspot.hotspotId,
      hotspotName: hotspot.hotspotName ?? "Địa điểm chưa có tên",
      address: hotspot.address ?? "",
      latitude: hotspot.latitude ?? DEFAULT_COORDINATE.latitude,
      longitude: hotspot.longitude ?? DEFAULT_COORDINATE.longitude,
      openingTime: hotspot.openingTime ?? "",
      closingTime: hotspot.closingTime ?? "",
      averageRating: null,
      totalReviews: null,
      checkInRadius: null, boundaryGeoJson: "",
      createByUserId: null, createdAt: "", description: "", endTime: "",
      estimatedDurationMax: null, estimatedDurationMin: null, historyInformation: "",
      isCheckedIn: true, medias: [], point: null, startTime: "",
      status: "", stories: [], tags: [], updatedAt: "", xp: null,
    }));

    /**
     * Backend thêm địa điểm vào hành trình qua `CustomRouteEventListener` —
     * `@Async` + `AFTER_COMMIT`, tức là chạy SAU khi API check-in đã trả 201.
     * Refetch ngay sau check-in vì thế rất hay đọc trúng lúc hành trình chưa kịp
     * có địa điểm vừa thêm; nếu ghi đè thẳng thì nơi user vừa check-in sẽ biến
     * mất khỏi UI rồi vài giây sau mới hiện lại. Giữ lại các mục local chưa
     * thấy trên server (chỉ trong cùng một hành trình) để danh sách không nhấp nháy.
     */
    const isSameRoute = appliedRouteIdRef.current === route.routeId;
    appliedRouteIdRef.current = route.routeId;

    setCheckedInHotspots((current) => {
      if (!isSameRoute) return serverHotspots;
      const serverIds = new Set(serverHotspots.map((item) => item.hotspotId));
      const pending = current.filter((item) => !serverIds.has(item.hotspotId));
      return [...serverHotspots, ...pending];
    });
  }, []);

  const loadMyJourneys = useCallback(async () => {
    if (!session.isAuthenticated) {
      setMyJourneys([]);
      setJourneysError(null);
      applyRouteRecord(null);
      return [];
    }

    setIsLoadingJourneys(true);
    setJourneysError(null);
    try {
      const auth = await getAuth();
      const journeys = await getMyRecordJourneys(auth);
      setMyJourneys(journeys);
      const recording = journeys.find((item) => item.status === "RECORDING") ?? null;
      applyRouteRecord(recording);
      return journeys;
    } catch (error) {
      // Đây là lần load lúc mở màn hình, không phải hành động user chủ động bấm.
      // Bắn modal ở đây khiến mỗi lần vào màn record đều bị chặn bởi popup lỗi,
      // nên hiển thị inline kèm nút thử lại giống khối địa điểm gần bạn.
      console.warn("[record-journey] load my journeys failed", error);
      setJourneysError(error instanceof Error ? error.message : "Không thể tải hành trình của bạn.");
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
    if (!permission.granted) {
      throw new Error(
        permission.canAskAgain
          ? "Hãy cấp quyền vị trí để tìm địa điểm quanh bạn."
          : "Quyền vị trí đang tắt. Hãy mở Cài đặt ứng dụng và bật lại Vị trí.",
      );
    }

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
      setNearbyError(error instanceof Error ? error.message : "Không thể tải địa điểm gần bạn.");
    } finally {
      setIsLoadingNearby(false);
    }
  }, [getAuth, resolveCurrentCoordinate, session.isAuthenticated]);

  /**
   * Kéo-để-làm-mới có state riêng, không dùng chung với cờ loading lúc mở màn.
   * Dùng chung khiến vòng xoay refresh hiện ngay khi vừa vào màn dù user chưa kéo.
   */
  const handleRefresh = useCallback(async () => {
    setIsRefreshing(true);
    try {
      await Promise.all([loadNearby(), loadMyJourneys()]);
    } finally {
      setIsRefreshing(false);
    }
  }, [loadMyJourneys, loadNearby]);


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
   * Ghi hành trình là tính năng Premium. Nếu user chưa nâng cấp, chặn hành động
   * và đưa họ sang trang gói đăng ký thay vì gọi thẳng API (BE cũng cần tự chặn
   * ở phía server, đây chỉ là lớp UX ở FE).
   */
  const requirePremium = useCallback(
    () => requirePremiumStatus("Ghi hành trình riêng"),
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
          appToast.error(error instanceof Error ? error.message : "Không tìm được địa điểm.");
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

  const checkedInCount = checkedInHotspots.length;
  const remainingStops = Math.max(MIN_RECORD_HOTSPOTS - checkedInCount, 0);
  const progressRatio = Math.min(checkedInCount / MIN_RECORD_HOTSPOTS, 1);

  async function handleStart() {
    if (!requirePremium()) return;
    setIsStarting(true);
    try {
      const auth = await getAuth();
      const route = await startRecordRoute(auth);
      applyRouteRecord(route);
      setMyJourneys((current) => [route, ...current.filter((item) => item.routeId !== route.routeId)]);
      appToast.success("Đã bắt đầu ghi. Hãy check-in nơi đầu tiên bạn ghé!");
    } catch (error) {
      appAlert.alert("Không thể bắt đầu", error instanceof Error ? error.message : "Vui lòng thử lại.");
    } finally {
      setIsStarting(false);
    }
  }

  async function handleCheckIn(hotspot: NearbyHotspotDto) {
    if (!requirePremium()) return;
    // Nút này KHÔNG được để `disabled` khi chưa ghi: bản trước làm vậy nên
    // `onPress` không chạy, user bấm hoài mà màn hình im lặng hoàn toàn.
    if (status !== "RECORDING") {
      appAlert.alert(
        "Chưa bắt đầu ghi",
        "Bấm \"Bắt đầu ghi hành trình\" ở đầu màn hình, sau đó bạn mới check-in được các nơi mình ghé qua.",
      );
      return;
    }
    if (checkedInHotspots.some((item) => item.hotspotId === hotspot.hotspotId)) {
      appToast.info("Bạn đã check-in nơi này rồi.");
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
      appToast.success(`Đã check-in ${hotspot.hotspotName}`);
      void loadNearby();
    } catch (error) {
      appAlert.alert("Check-in không thành công", error instanceof Error ? error.message : "Vui lòng thử lại.");
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
      appAlert.alert("Không thể mở bản đồ", error instanceof Error ? error.message : "Vui lòng thử lại.");
    }
  }

  async function handleFinish() {
    if (!requirePremium()) return;
    // Backend từ chối hành trình có dưới 4 điểm dừng, nên chặn trước ở client
    // với thông báo rõ số điểm còn thiếu thay vì để user bấm xong mới ăn lỗi 400.
    if (checkedInCount < MIN_RECORD_HOTSPOTS) {
      appAlert.alert(
        "Chưa đủ điểm dừng",
        `Hành trình cần ít nhất ${MIN_RECORD_HOTSPOTS} nơi. Bạn đã check-in ${checkedInCount}, còn thiếu ${remainingStops}.`,
      );
      return;
    }
    setIsFinishing(true);
    try {
      const auth = await getAuth();
      const route = await finishRecordRoute(auth);
      setRouteRecord(route);
      setStatus("DRAFT");
      setMyJourneys((current) => [route, ...current.filter((item) => item.routeId !== route.routeId)]);
      appToast.success("Đã lưu thành bản nháp. Thêm mô tả rồi đăng nhé!");
    } catch (error) {
      appAlert.alert("Không thể kết thúc", error instanceof Error ? error.message : "Vui lòng thử lại.");
    } finally {
      setIsFinishing(false);
    }
  }

  async function handleFinalize() {
    if (!requirePremium()) return;
    if (!routeRecord?.routeId) return;

    // Đăng là hành động không hoàn tác được: hành trình sẽ hiển thị công khai.
    const confirmed = await appAlert.confirm({
      cancelLabel: "Để sau",
      confirmLabel: "Đăng ngay",
      message: `Hành trình với ${checkedInCount} điểm dừng sẽ hiển thị công khai cho mọi người. Bạn không thể chuyển ngược về bản nháp.`,
      title: "Đăng hành trình này?",
      tone: "warning",
    });
    if (!confirmed) return;

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
      appToast.success("Hành trình của bạn đã được đăng.");
    } catch (error) {
      appAlert.alert("Không thể đăng", error instanceof Error ? error.message : "Vui lòng thử lại.");
    } finally {
      setIsFinalizing(false);
    }
  }

  return (
    <SafeAreaView className="flex-1 bg-[#F7F8FC]" edges={["top", "left", "right"]}>
      <View className="flex-row items-center gap-3 px-4 py-3">
        <Pressable
          accessibilityLabel="Quay lại"
          accessibilityRole="button"
          onPress={() => router.back()}
          className="h-10 w-10 items-center justify-center rounded-full bg-white"
        >
          <SymbolView name={{ ios: "chevron.left", android: "arrow_back", web: "arrow_back" }} size={19} tintColor="#2B2233" />
        </Pressable>
        <View className="flex-1">
          <Text className="text-[20px] font-extrabold text-[#2B2233]">Ghi hành trình</Text>
          <Text className="text-[13px] text-[#777181]">Đi tới đâu check-in tới đó, xong thì lưu lại</Text>
        </View>
        <Pressable
          accessibilityLabel="Hướng dẫn"
          accessibilityRole="button"
          className="h-10 w-10 items-center justify-center rounded-full bg-[#FFF4EF]"
          onPress={() =>
            appAlert.alert(
              "Cách ghi một hành trình",
              `1. Bấm Bắt đầu ghi.\n2. Đi và check-in ít nhất ${MIN_RECORD_HOTSPOTS} nơi.\n3. Bấm Kết thúc để lưu thành bản nháp.\n4. Thêm mô tả rồi đăng để mọi người cùng xem.`,
            )
          }
        >
          <SymbolView
            name={{ ios: "questionmark.circle", android: "help_outline", web: "help_outline" }}
            size={20}
            tintColor="#F15B45"
          />
        </Pressable>
      </View>

      <ScrollView
        contentContainerStyle={{ paddingBottom: 40 }}
        keyboardShouldPersistTaps="handled"
        refreshControl={<RefreshControl refreshing={isRefreshing} onRefresh={() => void handleRefresh()} />}
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
            <View className="absolute left-4 top-4 flex-row items-center gap-2 rounded-full bg-white/95 px-3.5 py-2">
              <View className="h-2.5 w-2.5 rounded-full" style={{ backgroundColor: STATUS_DOT_COLOR[status] ?? "#9AA0AA" }} />
              <Text className="text-[13px] font-extrabold text-[#2B2233]">{statusLabel(status)}</Text>
            </View>
            <Pressable
              accessibilityLabel="Cập nhật vị trí"
              accessibilityRole="button"
              onPress={() => void loadNearby()}
              className="absolute bottom-4 right-4 flex-row items-center gap-2 rounded-full bg-white px-4 py-3"
            >
              {isLoadingNearby ? (
                <ActivityIndicator size="small" color="#F15B45" />
              ) : (
                <SymbolView name={{ ios: "location.fill", android: "my_location", web: "my_location" }} size={16} tintColor="#F15B45" />
              )}
              <Text className="text-[13px] font-extrabold text-[#2B2233]">Cập nhật vị trí</Text>
            </Pressable>
          </View>
        </View>

        <View className="mt-4 px-4">
          <LinearGradient colors={["#E84D6A", "#F58752"]} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} className="rounded-3xl p-4">
            <Text className="text-[12px] font-bold uppercase tracking-wider text-white/80">Hành trình của bạn</Text>
            <Text className="mt-1 text-[19px] font-extrabold text-white">
              {routeRecord?.routeName ?? (status === "READY" ? "Sẵn sàng cho chuyến mới" : "Hành trình chưa đặt tên")}
            </Text>
            <Text className="mt-1.5 text-[13px] leading-6 text-white/90">
              {status === "READY"
                ? "Mỗi lúc bạn chỉ ghi được một hành trình. Bấm bắt đầu khi đã sẵn sàng."
                : status === "RECORDING"
                  ? remainingStops
                    ? `Đã check-in ${checkedInCount} nơi, còn ${remainingStops} nơi nữa là kết thúc được.`
                    : `Đã check-in ${checkedInCount} nơi. Bạn có thể kết thúc bất cứ lúc nào.`
                  : status === "DRAFT"
                    ? "Bản nháp đã lưu. Thêm mô tả rồi đăng để mọi người cùng xem."
                    : "Hành trình đã được đăng công khai."}
            </Text>

            {status === "RECORDING" ? (
              <View className="mt-3">
                <View className="h-2 overflow-hidden rounded-full bg-white/30">
                  <View className="h-full rounded-full bg-white" style={{ width: `${Math.round(progressRatio * 100)}%` }} />
                </View>
                <Text className="mt-1.5 text-[12px] font-bold text-white/90">
                  {checkedInCount}/{MIN_RECORD_HOTSPOTS} điểm dừng tối thiểu
                </Text>
              </View>
            ) : null}
          </LinearGradient>
        </View>

        {isPremiumLoaded && !canUsePremiumFeatures ? (
          <View className="mt-4 px-4">
            <Pressable
              accessibilityRole="button"
              onPress={() => router.push("/subscription/premium" as any)}
              className="flex-row items-center gap-3 rounded-3xl bg-[#2B2233] p-4"
            >
              <View className="h-10 w-10 items-center justify-center rounded-full bg-[#EB489B]">
                <SymbolView name={{ ios: "crown.fill", android: "workspace_premium", web: "workspace_premium" }} size={17} tintColor="#fff" />
              </View>
              <View className="flex-1">
                <Text className="text-[14px] font-extrabold text-white">Ghi hành trình là tính năng Premium</Text>
                <Text className="mt-0.5 text-[12px] leading-5 text-white/70">Nâng cấp để tự tạo hành trình từ những nơi bạn ghé qua</Text>
              </View>
              <Text className="text-[13px] font-extrabold text-[#EB489B]">Nâng cấp</Text>
            </Pressable>
          </View>
        ) : null}

        {status === "READY" ? (
          <View className="mt-4 px-4">
            <Pressable
              accessibilityRole="button"
              disabled={isStarting || !canUsePremiumFeatures}
              onPress={() => void handleStart()}
              className={`flex-row items-center justify-center gap-2 rounded-2xl py-4 ${canUsePremiumFeatures ? "bg-[#F15B45]" : "bg-[#D9DDE7]"}`}
            >
              {isStarting ? (
                <ActivityIndicator color="#fff" />
              ) : (
                <>
                  <SymbolView
                    name={
                      canUsePremiumFeatures
                        ? { ios: "record.circle", android: "fiber_manual_record", web: "fiber_manual_record" }
                        : { ios: "lock.fill", android: "lock", web: "lock" }
                    }
                    size={17}
                    tintColor={canUsePremiumFeatures ? "#fff" : "#8E869A"}
                  />
                  <Text className={`text-center text-[15px] font-extrabold ${canUsePremiumFeatures ? "text-white" : "text-[#8E869A]"}`}>
                    Bắt đầu ghi hành trình
                  </Text>
                </>
              )}
            </Pressable>
          </View>
        ) : null}

        <View className="mt-4 px-4">
          <View className="rounded-3xl bg-white p-4">
            <View className="flex-row items-center justify-between">
              <Text className="flex-1 pr-3 text-[16px] font-extrabold text-[#2B2233]">Hành trình của tôi</Text>
              <Pressable
                accessibilityLabel="Làm mới danh sách"
                accessibilityRole="button"
                onPress={() => void loadMyJourneys()}
                className="rounded-full bg-[#F1F3F7] px-3.5 py-2.5"
              >
                {isLoadingJourneys ? <ActivityIndicator size="small" color="#EB489B" /> : <Text className="text-[13px] font-extrabold text-[#2B2233]">Làm mới</Text>}
              </Pressable>
            </View>
            {journeysError ? (
              <Pressable accessibilityRole="button" onPress={() => void loadMyJourneys()} className="mt-3 rounded-2xl bg-[#FFF3F3] p-3.5">
                <Text className="text-[13px] font-bold leading-5 text-[#C74655]">{journeysError} · Bấm để thử lại</Text>
              </Pressable>
            ) : null}
            <View className="mt-3 gap-2">
              {myJourneys.map((journey, index) => {
                const isActive = journey.routeId === routeRecord?.routeId;
                const canOpen = journey.status === "DRAFT" || journey.status === "PUBLISHED";
                return (
                  <Pressable
                    accessibilityRole="button"
                    key={journey.routeId}
                    onPress={() => { if (canOpen) applyRouteRecord(journey); }}
                    className={`rounded-2xl border p-3.5 ${isActive ? "border-[#EB489B] bg-[#FFF5FA]" : "border-[#E8EDF4] bg-white"}`}
                  >
                    <View className="flex-row items-center justify-between gap-3">
                      <View className="min-w-0 flex-1">
                        <Text className="text-[14px] font-extrabold text-[#2B2233]" numberOfLines={1}>
                          {journey.routeName ?? `Hành trình ${myJourneys.length - index}`}
                        </Text>
                        <Text className="mt-1 text-[12px] text-[#8E869A]">
                          {(journey.hotspots ?? []).length} điểm dừng
                        </Text>
                      </View>
                      <View className="flex-row items-center gap-1.5 rounded-full bg-[#F1F3F7] px-3 py-1.5">
                        <View className="h-2 w-2 rounded-full" style={{ backgroundColor: STATUS_DOT_COLOR[journey.status] ?? "#9AA0AA" }} />
                        <Text className="text-[12px] font-extrabold text-[#5C5663]">{statusLabel(journey.status)}</Text>
                      </View>
                    </View>
                  </Pressable>
                );
              })}
              {!myJourneys.length && !isLoadingJourneys && !journeysError ? (
                <View className="items-center rounded-2xl border border-dashed border-[#D9DDE7] px-4 py-6">
                  <Text className="text-[14px] font-bold text-[#8E869A]">Bạn chưa ghi hành trình nào</Text>
                  <Text className="mt-1 text-center text-[13px] leading-5 text-[#A9A2B2]">Bắt đầu ghi để lưu lại chuyến đi đầu tiên</Text>
                </View>
              ) : null}
            </View>
          </View>
        </View>

        <View className="mt-4 px-4">
          <View className="rounded-3xl bg-white p-4">
            <Text className="text-[16px] font-extrabold text-[#2B2233]">Tìm nơi để ghé tiếp</Text>
            <Text className="mt-1 text-[13px] leading-5 text-[#8E869A]">
              Để trống để xem những nơi trong bán kính {formatDistanceMeters(NEARBY_DISTANCE_METERS)}. Nhập từ khóa để tìm trên toàn hệ thống.
            </Text>
            <View className="mt-3 flex-row items-center rounded-2xl bg-[#F1F3F7] px-3">
              <SymbolView name={{ ios: "magnifyingglass", android: "search", web: "search" }} size={18} tintColor="#8E869A" />
              <TextInput
                value={query}
                onChangeText={setQuery}
                placeholder="Tìm theo tên địa điểm..."
                placeholderTextColor="#A09AA8"
                className="flex-1 px-3 py-3.5 text-[15px] text-[#2B2233]"
              />
              {isSearching || isLoadingNearby ? <ActivityIndicator size="small" color="#EB489B" /> : null}
            </View>

            {status !== "RECORDING" ? (
              <View className="mt-3 flex-row items-center gap-2.5 rounded-2xl bg-[#FFF8EC] p-3.5">
                <SymbolView name={{ ios: "info.circle", android: "info", web: "info" }} size={17} tintColor="#B9791C" />
                <Text className="flex-1 text-[13px] leading-5 text-[#8A5F16]">
                  Bắt đầu ghi hành trình trước, sau đó bạn mới check-in được.
                </Text>
              </View>
            ) : null}

            {nearbyError && query.trim().length < 2 ? (
              <Pressable accessibilityRole="button" onPress={() => void loadNearby()} className="mt-3 rounded-2xl bg-[#FFF3F3] p-3.5">
                <Text className="text-[13px] font-bold leading-5 text-[#C74655]">{nearbyError} · Bấm để thử lại</Text>
              </Pressable>
            ) : null}

            <View className="mt-3 gap-2">
              {displayedHotspots.slice(0, 15).map((hotspot) => {
                const checked = checkedInHotspots.some((item) => item.hotspotId === hotspot.hotspotId);
                const distance = distanceMeters(currentCoordinate, hotspot);
                const isRecording = status === "RECORDING";
                return (
                  <View key={hotspot.hotspotId} className="rounded-2xl border border-[#E8EDF4] p-3.5">
                    <View className="flex-row items-start gap-3">
                      <View className="h-11 w-11 items-center justify-center rounded-2xl bg-[#FFF1F6]">
                        <SymbolView name={{ ios: "mappin.circle.fill", android: "place", web: "place" }} size={20} tintColor="#EB489B" />
                      </View>
                      <View className="min-w-0 flex-1">
                        <Text className="text-[14px] font-extrabold text-[#2B2233]">{hotspot.hotspotName}</Text>
                        <Text className="mt-0.5 text-[12px] leading-5 text-[#8E869A]" numberOfLines={2}>{hotspot.address}</Text>
                        <Text className="mt-1 text-[12px] font-bold text-[#C4703A]">
                          Cách {formatDistanceMeters(distance)}{hotspot.openingTime ? ` · mở ${hotspot.openingTime}${hotspot.closingTime ? `–${hotspot.closingTime}` : ""}` : ""}
                        </Text>
                      </View>
                      {checked ? (
                        <View className="flex-row items-center gap-1 rounded-full bg-[#EAF7EF] px-2.5 py-1.5">
                          <SymbolView name={{ ios: "checkmark", android: "check", web: "check" }} size={13} tintColor="#2A8A52" />
                          <Text className="text-[12px] font-extrabold text-[#2A8A52]">Đã ghé</Text>
                        </View>
                      ) : null}
                    </View>
                    <View className="mt-3 flex-row gap-2">
                      <Pressable accessibilityRole="button" onPress={() => void handleNavigate(hotspot)} className="flex-1 rounded-xl bg-[#EEF6FF] py-3.5">
                        <Text className="text-center text-[13px] font-extrabold text-[#1677C8]">Chỉ đường</Text>
                      </Pressable>
                      <Pressable
                        accessibilityRole="button"
                        disabled={checked || checkingInId === hotspot.hotspotId}
                        onPress={() => void handleCheckIn(hotspot)}
                        className={`flex-1 rounded-xl py-3.5 ${checked ? "bg-[#EDEFF3]" : isRecording ? "bg-[#EB489B]" : "bg-[#F3D9E5]"}`}
                      >
                        {checkingInId === hotspot.hotspotId ? (
                          <ActivityIndicator size="small" color="#fff" />
                        ) : (
                          <Text className={`text-center text-[13px] font-extrabold ${checked ? "text-[#9C97A3]" : isRecording ? "text-white" : "text-[#A8557B]"}`}>
                            {checked ? "Đã check-in" : "Check-in"}
                          </Text>
                        )}
                      </Pressable>
                    </View>
                  </View>
                );
              })}
              {!displayedHotspots.length && !isSearching && !isLoadingNearby ? (
                <View className="items-center rounded-2xl border border-dashed border-[#D9DDE7] px-4 py-7">
                  <Text className="text-[14px] font-bold text-[#8E869A]">Không tìm thấy địa điểm phù hợp</Text>
                </View>
              ) : null}
            </View>
          </View>
        </View>

        <View className="mt-4 px-4">
          <View className="rounded-3xl bg-white p-4">
            <View className="flex-row items-center justify-between gap-3">
              <View className="min-w-0 flex-1">
                <Text className="text-[16px] font-extrabold text-[#2B2233]">Những nơi đã ghé</Text>
                <Text className="mt-0.5 text-[13px] leading-5 text-[#8E869A]">Theo đúng thứ tự bạn check-in</Text>
              </View>
              <View className="rounded-full bg-[#FFF4EF] px-3 py-1.5">
                <Text className="text-[13px] font-extrabold text-[#F15B45]">{checkedInCount} nơi</Text>
              </View>
            </View>
            <View className="mt-3 gap-2">
              {checkedInHotspots.map((item, index) => (
                <View key={item.hotspotId} className="flex-row items-center gap-3 rounded-2xl border border-[#E8EDF4] p-3.5">
                  <View className="h-10 w-10 items-center justify-center rounded-full bg-[#F15B45]">
                    <Text className="text-[15px] font-extrabold text-white">{index + 1}</Text>
                  </View>
                  <View className="min-w-0 flex-1">
                    <Text className="text-[14px] font-extrabold text-[#2B2233]" numberOfLines={1}>{item.hotspotName}</Text>
                    {item.address ? (
                      <Text className="mt-0.5 text-[12px] text-[#8E869A]" numberOfLines={1}>{item.address}</Text>
                    ) : null}
                  </View>
                </View>
              ))}
              {!checkedInCount ? (
                <View className="items-center rounded-2xl border border-dashed border-[#D9DDE7] px-4 py-8">
                  <Text className="text-[14px] font-bold text-[#8E869A]">Chưa check-in nơi nào</Text>
                  <Text className="mt-1 text-center text-[13px] leading-5 text-[#A9A2B2]">Những nơi bạn ghé sẽ lần lượt hiện ở đây</Text>
                </View>
              ) : null}
            </View>
          </View>
        </View>

        <View className="mt-4 gap-2 px-4">
          {status === "RECORDING" ? (
            <>
              <Pressable
                accessibilityRole="button"
                disabled={isFinishing}
                onPress={() => void handleFinish()}
                className={`rounded-2xl py-4 ${checkedInCount >= MIN_RECORD_HOTSPOTS && !isFinishing ? "bg-[#2B2233]" : "bg-[#D9DDE7]"}`}
              >
                {isFinishing ? (
                  <ActivityIndicator color="#fff" />
                ) : (
                  <Text className={`text-center text-[15px] font-extrabold ${checkedInCount >= MIN_RECORD_HOTSPOTS ? "text-white" : "text-[#8E869A]"}`}>
                    Kết thúc và lưu bản nháp
                  </Text>
                )}
              </Pressable>
              {remainingStops ? (
                <Text className="text-center text-[13px] font-bold text-[#8E869A]">
                  Còn {remainingStops} nơi nữa là kết thúc được
                </Text>
              ) : null}
            </>
          ) : null}

          {status === "DRAFT" ? (
            <>
              <View className="rounded-2xl border border-[#E8EDF4] bg-white p-4">
                <Text className="text-[14px] font-extrabold text-[#2B2233]">Mô tả hành trình</Text>
                <Text className="mt-0.5 text-[13px] leading-5 text-[#8E869A]">Mô tả này hiển thị công khai cùng hành trình của bạn.</Text>
                <TextInput
                  value={finalizeDescription}
                  onChangeText={setFinalizeDescription}
                  maxLength={DESCRIPTION_MAX_LENGTH}
                  placeholder="Kể ngắn gọn về chuyến đi này..."
                  placeholderTextColor="#A09AA8"
                  multiline
                  className="mt-3 min-h-[72px] rounded-2xl bg-[#F1F3F7] px-4 py-3 text-[15px] leading-6 text-[#2B2233]"
                  textAlignVertical="top"
                />
                <Text className="mt-1.5 text-right text-[12px] text-[#A9A2B2]">
                  {finalizeDescription.length}/{DESCRIPTION_MAX_LENGTH}
                </Text>
              </View>
              <Pressable
                accessibilityRole="button"
                disabled={isFinalizing}
                onPress={() => void handleFinalize()}
                className={`rounded-2xl py-4 ${isFinalizing ? "bg-[#EFA8C8]" : "bg-[#EB489B]"}`}
              >
                {isFinalizing ? <ActivityIndicator color="#fff" /> : <Text className="text-center text-[15px] font-extrabold text-white">Đăng hành trình</Text>}
              </Pressable>
            </>
          ) : null}
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}
