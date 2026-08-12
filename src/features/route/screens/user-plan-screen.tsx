import * as Location from "expo-location";
import { useRouter } from "expo-router";
import { useCallback, useEffect, useMemo, useState } from "react";
import {
  ActivityIndicator,
  Pressable,
  ScrollView,
  Text,
  TextInput,
  View,
} from "react-native";
import { GestureHandlerRootView } from "react-native-gesture-handler";
import { SafeAreaView, useSafeAreaInsets } from "react-native-safe-area-context";


import {
  getValidAccessToken,
  useAuthSession,
} from "@/features/auth/hooks/use-auth-session";
import {
  getNearbyHotspots,
  type NearbyHotspotDto,
} from "@/features/home/api/get-nearby-hotspots";
import { searchHotspots } from "@/features/home/api/search-hotspots";
import { AppMap, type AppMapPoint } from "@/features/map/components/app-map";
import { getMyProfile } from "@/features/profile/api/get-me";
import { setPremiumStatusFromProfile, usePremiumStatus } from "@/features/profile/hooks/use-premium-status";
import {
  createUserPlan,
  optimizeUserPlan,
  startUserPlan,
  suggestPlansByDescription,
  type PlannerHotspot,
  type UserPlan,
} from "@/features/route/api/user-plan-api";
import { openGoogleMapsMultiStopRoute } from "@/lib/google-maps-navigation";
import {
  ensureForegroundLocationPermission,
  getDevelopmentLocationOverride,
  getDeviceCoordinate,
} from "@/lib/location";
import { appAlert } from "@/components/ui/app-dialog";
import { appToast } from "@/components/ui/app-toast";
import { DraggableList } from "@/components/ui/draggable-list";
import { SymbolView } from "@/components/ui/symbol-view";

type PlannedStop = AppMapPoint & {
  hotspotId?: number;
  address: string;
  source: "SYSTEM" | "SEARCH" | "AI";
  scheduleLabel?: string;
  reason?: string;
};

type OptimizeMode = "OPENING_HOURS" | "DISTANCE";
type HotspotBrowseMode = "NEARBY" | "SEARCH";

const defaultUserPoint: AppMapPoint = {
  id: "user",
  title: "Vị trí của bạn",
  description: "Điểm xuất phát dự kiến",
  latitude: 10.7769,
  longitude: 106.7009,
};

/** Giờ khởi hành gợi sẵn - thay cho time picker để không thêm phụ thuộc mới. */
const START_TIME_OPTIONS = ["07:00", "08:00", "09:00", "13:00"] as const;

/**
 * Kéo-thả tính vị trí bằng phép chia cho chiều cao ô, nên mọi ô phải cao bằng
 * nhau. Địa chỉ và giờ mở cửa vì thế gộp chung một dòng `numberOfLines={1}`.
 */
const STOP_ROW_GAP = 8;
const STOP_ROW_HEIGHT = 80 + STOP_ROW_GAP;

/** Trạng thái kế hoạch chỉ hiển thị bằng tiếng Việt, không lộ enum của backend. */
const PLAN_STATUS_LABEL: Record<string, string> = {
  COMPLETED: "Đã hoàn thành",
  DRAFT: "Bản nháp",
  READY: "Sẵn sàng khởi hành",
  STARTED: "Đang đi",
};

function normalizeText(value: string) {
  return value
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .trim();
}

function distanceMeters(
  a: { latitude: number; longitude: number },
  b: { latitude: number; longitude: number },
) {
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

function formatDistance(meters: number) {
  return meters >= 1000
    ? `${(Math.round(meters / 100) / 10).toLocaleString("vi-VN")} km`
    : `${Math.round(meters)} m`;
}

function defaultPlanName() {
  return `Hành trình ngày ${new Date().toLocaleDateString("vi-VN")}`;
}

function toApiStop(hotspot: PlannerHotspot, reason?: string): PlannedStop {
  return {
    id: `api-${hotspot.hotspotId}`,
    hotspotId: hotspot.hotspotId,
    title: hotspot.hotspotName,
    description: hotspot.address,
    address: hotspot.address,
    latitude: hotspot.latitude,
    longitude: hotspot.longitude,
    source: "AI",
    scheduleLabel:
      hotspot.openingTime || hotspot.closingTime
        ? `${hotspot.openingTime ?? "--:--"} - ${hotspot.closingTime ?? "--:--"}`
        : undefined,
    reason,
  };
}

function toBrowseStop(
  hotspot: NearbyHotspotDto,
  source: "SYSTEM" | "SEARCH",
): PlannedStop {
  return {
    id: `hotspot-${hotspot.hotspotId}`,
    hotspotId: hotspot.hotspotId,
    title: hotspot.hotspotName,
    description: hotspot.address,
    address: hotspot.address,
    latitude: hotspot.latitude,
    longitude: hotspot.longitude,
    source,
    scheduleLabel:
      hotspot.openingTime || hotspot.closingTime
        ? `${hotspot.openingTime || "--:--"} - ${hotspot.closingTime || "--:--"}`
        : undefined,
  };
}

function StepProgress({ current }: { current: number }) {
  const steps = ["Chọn địa điểm", "Sắp xếp", "Tạo hành trình"];

  return (
    <View className="flex-row items-center gap-2 px-4 pb-3">
      {steps.map((label, index) => {
        const isDone = index < current;
        const isActive = index === current;
        return (
          <View className="flex-1 gap-1.5" key={label}>
            <View
              className={`h-1 rounded-full ${
                isDone || isActive ? "bg-[#EB489B]" : "bg-[#E4E0EA]"
              }`}
            />
            <Text
              className={`text-[12px] ${
                isActive
                  ? "font-extrabold text-[#EB489B]"
                  : isDone
                    ? "font-bold text-[#8E869A]"
                    : "font-medium text-[#A9A2B2]"
              }`}
              numberOfLines={1}
            >
              {label}
            </Text>
          </View>
        );
      })}
    </View>
  );
}

export default function UserPlanScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const session = useAuthSession();
  const { canUsePremiumFeatures, isLoaded: isPremiumLoaded, requirePremium } = usePremiumStatus();
  const [systemQuery, setSystemQuery] = useState("");
  const [browseMode, setBrowseMode] = useState<HotspotBrowseMode>("NEARBY");
  const [browseHotspots, setBrowseHotspots] = useState<PlannedStop[]>([]);
  const [isBrowseLoading, setIsBrowseLoading] = useState(false);
  const [browseError, setBrowseError] = useState<string | null>(null);
  const [nearFirstSearchHotspots, setNearFirstSearchHotspots] = useState<
    PlannedStop[]
  >([]);
  const [isNearFirstSearchLoading, setIsNearFirstSearchLoading] =
    useState(false);
  const [nearFirstSearchError, setNearFirstSearchError] = useState<
    string | null
  >(null);
  const [firstSearchHotspot, setFirstSearchHotspot] =
    useState<PlannedStop | null>(null);
  const [aiPrompt, setAiPrompt] = useState("");
  const [aiText, setAiText] = useState("");
  const [aiCandidates, setAiCandidates] = useState<PlannedStop[]>([]);
  const [isLocating, setIsLocating] = useState(false);
  const [isAiLoading, setIsAiLoading] = useState(false);
  const [isOptimizing, setIsOptimizing] = useState(false);
  const [isAiConfirmed, setIsAiConfirmed] = useState(false);
  const [userAvatarUri, setUserAvatarUri] = useState<string | null>(null);
  const [userPoint, setUserPoint] = useState<AppMapPoint>({
    ...defaultUserPoint,
    isCurrentUser: true,
    avatarUri: null,
  });
  const [stops, setStops] = useState<PlannedStop[]>([]);
  const [planName, setPlanName] = useState(defaultPlanName);
  const [optimizeMode, setOptimizeMode] = useState<OptimizeMode>("DISTANCE");
  const [startTime, setStartTime] = useState<string>("08:00");
  const [aiOptimizeExplanation, setAiOptimizeExplanation] = useState("");
  const [isReviewed, setIsReviewed] = useState(false);
  const [currentPlan, setCurrentPlan] = useState<UserPlan | null>(null);
  const [isSaving, setIsSaving] = useState(false);
  const [isStarting, setIsStarting] = useState(false);

  const mapPoints = useMemo(() => {
    const selectedIds = new Set(stops.map((item) => item.hotspotId));
    const discoverable = [...browseHotspots, ...nearFirstSearchHotspots]
      .filter((item) => !selectedIds.has(item.hotspotId))
      .filter(
        (item, index, items) =>
          items.findIndex(
            (candidate) => candidate.hotspotId === item.hotspotId,
          ) === index,
      )
      .slice(0, 30);
    return [userPoint, ...stops, ...discoverable];
  }, [browseHotspots, nearFirstSearchHotspots, stops, userPoint]);
  const routeCoordinates = useMemo(
    () =>
      [userPoint, ...stops].map(({ latitude, longitude }) => ({
        latitude,
        longitude,
      })),
    [stops, userPoint],
  );
  const filteredBrowseHotspots = useMemo(() => {
    const keyword = normalizeText(systemQuery);
    if (!keyword || browseMode === "SEARCH") return browseHotspots;
    return browseHotspots.filter((hotspot) =>
      normalizeText(`${hotspot.title} ${hotspot.address}`).includes(keyword),
    );
  }, [browseHotspots, browseMode, systemQuery]);

  /** Tổng quãng đường ước tính theo đường chim bay, đủ để user áng chừng độ dài. */
  const totalDistance = useMemo(() => {
    const path = [userPoint, ...stops];
    return path.reduce(
      (sum, point, index) =>
        index === 0 ? sum : sum + distanceMeters(path[index - 1], point),
      0,
    );
  }, [stops, userPoint]);

  const currentStep = currentPlan ? 2 : stops.length >= 2 ? 1 : 0;
  const canBuildPlan = stops.length >= 2;
  const isBusy = isSaving || isStarting;

  async function getAuth() {
    const accessToken = await getValidAccessToken();
    if (!accessToken)
      throw new Error("Bạn cần đăng nhập để tạo hành trình riêng.");
    return { accessToken, tokenType: session.tokenType };
  }

  function resetPlanDraft() {
    setIsReviewed(false);
    setCurrentPlan(null);
  }

  /**
   * Bấm vào một địa điểm là bật/tắt lựa chọn. Bản trước bắn popup "Địa điểm đã
   * có" khi bấm lại, trong khi thẻ đã hiện sẵn "Đã chọn #2" - user không có
   * cách nào bỏ chọn ngay tại danh sách mà phải cuộn xuống mục sắp xếp để xóa.
   */
  function toggleStop(stop: PlannedStop) {
    setStops((current) => {
      const exists = current.some((item) => String(item.id) === String(stop.id));
      if (exists) {
        return current.filter((item) => String(item.id) !== String(stop.id));
      }
      return [...current, stop];
    });
    resetPlanDraft();
    setAiOptimizeExplanation("");
  }

  const loadNearbyHotspots = useCallback(
    async (latitude: number, longitude: number) => {
      setIsBrowseLoading(true);
      setBrowseError(null);
      setFirstSearchHotspot(null);
      setNearFirstSearchHotspots([]);
      setNearFirstSearchError(null);
      try {
        const accessToken = session.isAuthenticated
          ? await getValidAccessToken()
          : null;
        const hotspots = await getNearbyHotspots({
          accessToken,
          tokenType: session.tokenType,
          latitude,
          longitude,
          distance: 10_000,
        });
        setBrowseHotspots(hotspots.map((item) => toBrowseStop(item, "SYSTEM")));
        setBrowseMode("NEARBY");
      } catch (error) {
        setBrowseHotspots([]);
        setBrowseError(
          error instanceof Error
            ? error.message
            : "Không thể tải địa điểm gần bạn.",
        );
      } finally {
        setIsBrowseLoading(false);
      }
    },
    [session.isAuthenticated, session.tokenType],
  );

  const locateUser = useCallback(
    async (showError = true) => {
      setIsLocating(true);
      try {
        const permission = await ensureForegroundLocationPermission();
        if (!permission.granted) {
          throw new Error(
            permission.canAskAgain
              ? "Hãy cấp quyền vị trí để xác định điểm xuất phát."
              : "Quyền vị trí đã bị tắt. Hãy mở Cài đặt ứng dụng và cấp quyền Vị trí.",
          );
        }

        let coordinate = await getDeviceCoordinate({
          accuracy: Location.Accuracy.Balanced,
          maxAge: 30_000,
          mayShowUserSettingsDialog: true,
        });
        coordinate ??= getDevelopmentLocationOverride();
        if (!coordinate) throw new Error("Không lấy được vị trí hiện tại.");

        const nextPoint: AppMapPoint = {
          ...defaultUserPoint,
          latitude: coordinate.latitude,
          longitude: coordinate.longitude,
          isCurrentUser: true,
          avatarUri: userAvatarUri,
        };
        setUserPoint(nextPoint);
        await loadNearbyHotspots(coordinate.latitude, coordinate.longitude);
      } catch (error) {
        if (showError) {
          appAlert.alert(
            "Không thể lấy vị trí",
            error instanceof Error ? error.message : "Vui lòng thử lại.",
          );
        }
      } finally {
        setIsLocating(false);
      }
    },
    [loadNearbyHotspots, userAvatarUri],
  );

  const loadNearbyAroundSearchHotspot = useCallback(
    async (hotspot: PlannedStop) => {
      setFirstSearchHotspot(hotspot);
      setIsNearFirstSearchLoading(true);
      setNearFirstSearchError(null);
      try {
        const accessToken = session.isAuthenticated
          ? await getValidAccessToken()
          : null;
        const nearby = await getNearbyHotspots({
          accessToken,
          tokenType: session.tokenType,
          latitude: hotspot.latitude,
          longitude: hotspot.longitude,
          distance: 5_000,
        });
        setNearFirstSearchHotspots(
          nearby
            .filter((item) => item.hotspotId !== hotspot.hotspotId)
            .map((item) => toBrowseStop(item, "SYSTEM")),
        );
      } catch (error) {
        setNearFirstSearchHotspots([]);
        setNearFirstSearchError(
          error instanceof Error
            ? error.message
            : "Không thể tải địa điểm lân cận.",
        );
      } finally {
        setIsNearFirstSearchLoading(false);
      }
    },
    [session.isAuthenticated, session.tokenType],
  );

  const runHotspotSearch = useCallback(
    async (query: string) => {
      const keyword = query.trim();
      if (!keyword) {
        await loadNearbyHotspots(userPoint.latitude, userPoint.longitude);
        return;
      }

      setIsBrowseLoading(true);
      setBrowseError(null);
      setBrowseMode("SEARCH");
      try {
        const accessToken = session.isAuthenticated
          ? await getValidAccessToken()
          : null;
        const result = await searchHotspots({
          accessToken,
          tokenType: session.tokenType,
          payload: {
            filters: [
              { field: "hotspotName", operator: "LIKE", value: keyword },
            ],
            page: 0,
            size: 20,
            sortBy: "hotspotName",
            sortDirection: "ASC",
          },
        });
        const searchResults = result.content.map((item) =>
          toBrowseStop(item, "SEARCH"),
        );
        setBrowseHotspots(searchResults);

        const firstResult = searchResults[0];
        if (firstResult) {
          await loadNearbyAroundSearchHotspot(firstResult);
        } else {
          setFirstSearchHotspot(null);
          setNearFirstSearchHotspots([]);
          setNearFirstSearchError(null);
        }
      } catch (error) {
        setBrowseHotspots([]);
        setFirstSearchHotspot(null);
        setNearFirstSearchHotspots([]);
        setNearFirstSearchError(null);
        setBrowseError(
          error instanceof Error
            ? error.message
            : "Không thể tìm kiếm địa điểm.",
        );
      } finally {
        setIsBrowseLoading(false);
      }
    },
    [
      loadNearbyHotspots,
      loadNearbyAroundSearchHotspot,
      session.isAuthenticated,
      session.tokenType,
      userPoint.latitude,
      userPoint.longitude,
    ],
  );


  useEffect(() => {
    let cancelled = false;

    async function loadCurrentUserAvatar() {
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
        if (cancelled) return;
        setUserAvatarUri(profile.avatar);
        setPremiumStatusFromProfile(profile.isPremium);
        setUserPoint((current) => ({
          ...current,
          isCurrentUser: true,
          avatarUri: profile.avatar,
        }));
      } catch (error) {
        console.warn("[user-plan] load current user avatar failed", error);
      }
    }

    void loadCurrentUserAvatar();
    return () => {
      cancelled = true;
    };
  }, [session.isAuthenticated, session.tokenType]);

  /**
   * Defense-in-depth: tạo hành trình riêng (có AI gợi ý/tối ưu lộ trình) là
   * tính năng Premium. Các entry point (route-screen, explore-screen) đã chặn
   * trước khi điều hướng vào đây, nhưng nếu user vào thẳng màn này bằng deep
   * link/back thì vẫn cần chặn lại ở chính màn này.
   */
  useEffect(() => {
    if (!isPremiumLoaded || canUsePremiumFeatures) return;
    requirePremium("Tạo hành trình riêng");
  }, [canUsePremiumFeatures, isPremiumLoaded, requirePremium]);

  useEffect(() => {
    void locateUser(false);
  }, [locateUser]);

  useEffect(() => {
    const timeout = setTimeout(() => {
      if (systemQuery.trim().length >= 2) {
        void runHotspotSearch(systemQuery);
      } else if (!systemQuery.trim() && browseMode === "SEARCH") {
        void loadNearbyHotspots(userPoint.latitude, userPoint.longitude);
      }
    }, 400);

    return () => clearTimeout(timeout);
  }, [
    browseMode,
    loadNearbyHotspots,
    runHotspotSearch,
    systemQuery,
    userPoint.latitude,
    userPoint.longitude,
  ]);

  async function generateAiTextSuggestion() {
    const prompt = aiPrompt.trim();
    if (!prompt) {
      appAlert.alert(
        "Hãy mô tả chuyến đi",
        "Ví dụ: Tôi muốn tham quan các địa điểm lịch sử trong một buổi sáng.",
      );
      return;
    }
    setIsAiLoading(true);
    setIsAiConfirmed(false);
    setAiCandidates([]);
    try {
      const suggestions = await suggestPlansByDescription(await getAuth(), {
        description: prompt,
        latitude: userPoint.latitude,
        longitude: userPoint.longitude,
        anchorHotspotIds: stops.flatMap((item) =>
          item.hotspotId ? [item.hotspotId] : [],
        ),
        radiusInMeters: 10_000,
        limit: 8,
      });
      const candidates = suggestions.map((item) =>
        toApiStop(item.hotspot, item.reason),
      );
      setAiCandidates(candidates);
      setAiText(
        candidates.length
          ? `Tìm được ${candidates.length} địa điểm phù hợp với mô tả của bạn. Xem danh sách để chọn những nơi bạn muốn ghé.`
          : "Chưa tìm được địa điểm nào khớp với mô tả này. Hãy thử mô tả rộng hơn.",
      );
    } catch (error) {
      appAlert.alert(
        "Không thể lấy gợi ý",
        error instanceof Error ? error.message : "Vui lòng thử lại.",
      );
    } finally {
      setIsAiLoading(false);
    }
  }

  function confirmAiSuggestion() {
    if (aiCandidates.length) setIsAiConfirmed(true);
  }

  const reorderStops = useCallback((next: PlannedStop[]) => {
    setStops(next);
    setIsReviewed(false);
    setCurrentPlan(null);
  }, []);

  function removeStop(index: number) {
    setStops((current) =>
      current.filter((_, currentIndex) => currentIndex !== index),
    );
    resetPlanDraft();
  }

  async function optimizeRoute() {
    const hotspotIds = stops.flatMap((item) =>
      item.hotspotId ? [item.hotspotId] : [],
    );
    if (stops.length < 2) return;
    if (hotspotIds.length !== stops.length) {
      appAlert.alert(
        "Chưa thể sắp xếp tự động",
        "Một vài địa điểm trong hành trình chưa có dữ liệu đầy đủ. Hãy xóa và chọn lại từ danh sách gợi ý.",
      );
      return;
    }
    setIsOptimizing(true);
    try {
      const result = await optimizeUserPlan(await getAuth(), {
        hotspotIds,
        startLatitude: userPoint.latitude,
        startLongitude: userPoint.longitude,
        criterion: optimizeMode === "DISTANCE" ? "DISTANCE" : "TIME",
        startTime: `${startTime}:00`,
      });
      const byId = new Map(stops.map((stop) => [stop.hotspotId, stop]));
      setStops(
        result.stops
          .map((stop) => byId.get(stop.hotspotId))
          .filter(Boolean) as PlannedStop[],
      );
      setAiOptimizeExplanation(
        optimizeMode === "DISTANCE"
          ? `Đã sắp xếp để đường đi ngắn nhất: khoảng ${formatDistance(result.totalDistance || 0)}${result.totalEstimatedTimeText ? `, đi hết ${result.totalEstimatedTimeText}` : ""}.`
          : `Đã sắp xếp theo giờ mở cửa, khởi hành lúc ${startTime}${result.totalEstimatedTimeText ? `, đi hết ${result.totalEstimatedTimeText}` : ""}.`,
      );
      resetPlanDraft();
    } catch (error) {
      appAlert.alert(
        "Không thể sắp xếp",
        error instanceof Error ? error.message : "Vui lòng thử lại.",
      );
    } finally {
      setIsOptimizing(false);
    }
  }

  async function openInGoogleMaps() {
    try {
      await openGoogleMapsMultiStopRoute({
        points: stops,
        travelMode: "driving",
        useCurrentLocationAsOrigin: true,
      });
    } catch (error) {
      appAlert.alert(
        "Không thể mở Google Maps",
        error instanceof Error ? error.message : "Vui lòng thử lại.",
      );
    }
  }

  async function reviewPlan() {
    const hotspotIds = stops.flatMap((item) =>
      item.hotspotId ? [item.hotspotId] : [],
    );
    if (hotspotIds.length !== stops.length) {
      appAlert.alert(
        "Không thể tạo hành trình",
        "Một vài địa điểm trong danh sách chưa có dữ liệu đầy đủ. Hãy xóa và chọn lại từ danh sách gợi ý.",
      );
      return;
    }
    setIsSaving(true);
    try {
      const name = planName.trim() || defaultPlanName();
      const plan = await createUserPlan(await getAuth(), {
        name,
        description: aiPrompt.trim() || "Hành trình do bạn tự tạo",
        stops: hotspotIds.map((hotspotId) => ({ hotspotId })),
        startLatitude: userPoint.latitude,
        startLongitude: userPoint.longitude,
        isOptimized: Boolean(aiOptimizeExplanation),
      });
      setCurrentPlan(plan);
      setIsReviewed(true);
      appAlert.alert(
        "Đã tạo hành trình",
        `"${name}" đã được lưu với ${stops.length} điểm dừng.`,
        [
          { style: "cancel", text: "Ở lại đây" },
          {
            onPress: () => router.push(`/route/custom/plan/${plan.userPlanId}`),
            text: "Xem hành trình",
          },
        ],
      );
    } catch (error) {
      appAlert.alert(
        "Không thể tạo hành trình",
        error instanceof Error ? error.message : "Vui lòng thử lại.",
      );
    } finally {
      setIsSaving(false);
    }
  }

  async function beginPlan() {
    if (!currentPlan) return;
    setIsStarting(true);
    try {
      const started = await startUserPlan(
        await getAuth(),
        currentPlan.userPlanId,
      );
      setCurrentPlan(started);
      appToast.success("Đã bắt đầu hành trình. Chúc bạn đi vui!");
    } catch (error) {
      appAlert.alert(
        "Không thể bắt đầu",
        error instanceof Error ? error.message : "Vui lòng thử lại.",
      );
    } finally {
      setIsStarting(false);
    }
  }

  function renderStopCard(hotspot: PlannedStop, options: { accent: "pink" | "blue" }) {
    const selectedIndex = stops.findIndex(
      (item) => String(item.id) === String(hotspot.id),
    );
    const isSelected = selectedIndex >= 0;
    const accentColor = options.accent === "pink" ? "#EB489B" : "#1677C8";

    return (
      <Pressable
        accessibilityLabel={
          isSelected
            ? `Bỏ ${hotspot.title} khỏi hành trình`
            : `Thêm ${hotspot.title} vào hành trình`
        }
        accessibilityRole="button"
        key={String(hotspot.id)}
        onPress={() => toggleStop(hotspot)}
        className={`flex-row items-center gap-3 rounded-2xl border p-3.5 ${
          isSelected ? "border-[#EB489B] bg-[#FFF6FA]" : "border-[#E8EDF4] bg-white"
        }`}
      >
        <View
          className="h-11 w-11 items-center justify-center rounded-2xl"
          style={{ backgroundColor: isSelected ? "#EB489B" : "#FFF1F6" }}
        >
          {isSelected ? (
            <Text className="text-[15px] font-extrabold text-white">
              {selectedIndex + 1}
            </Text>
          ) : (
            <SymbolView
              name={{ ios: "mappin.circle.fill", android: "place", web: "place" }}
              size={20}
              tintColor={accentColor}
            />
          )}
        </View>

        <View className="min-w-0 flex-1">
          <Text
            className="text-[14px] font-extrabold text-[#2B2233]"
            numberOfLines={1}
          >
            {hotspot.title}
          </Text>
          <Text className="mt-0.5 text-[12px] text-[#8E869A]" numberOfLines={1}>
            {hotspot.address}
          </Text>
          {hotspot.scheduleLabel ? (
            <Text className="mt-1 text-[12px] font-bold text-[#C4703A]">
              Mở cửa {hotspot.scheduleLabel}
            </Text>
          ) : null}
        </View>

        <View
          className="h-9 w-9 items-center justify-center rounded-full"
          style={{ backgroundColor: isSelected ? "#FFE3EF" : "#F1F3F7" }}
        >
          <SymbolView
            name={
              isSelected
                ? { ios: "checkmark", android: "check", web: "check" }
                : { ios: "plus", android: "add", web: "add" }
            }
            size={17}
            tintColor={isSelected ? "#D93679" : "#5F5866"}
          />
        </View>
      </Pressable>
    );
  }

  return (
    <GestureHandlerRootView style={{ flex: 1 }}>
    <SafeAreaView
      className="flex-1 bg-[#F7F8FC]"
      edges={["top", "left", "right"]}
    >
      <View className="flex-row items-center gap-3 px-4 py-3">
        <Pressable
          accessibilityLabel="Quay lại"
          accessibilityRole="button"
          onPress={() => router.back()}
          className="h-10 w-10 items-center justify-center rounded-full bg-white"
        >
          <SymbolView
            name={{
              ios: "chevron.left",
              android: "arrow_back",
              web: "arrow_back",
            }}
            size={19}
            tintColor="#2B2233"
          />
        </Pressable>
        <View className="flex-1">
          <Text className="text-[20px] font-extrabold text-[#2B2233]">
            Tạo hành trình riêng
          </Text>
          <Text className="text-[13px] text-[#777181]">
            Chọn những nơi bạn muốn ghé, rồi sắp xếp theo thứ tự
          </Text>
        </View>
      </View>

      <StepProgress current={currentStep} />

      <ScrollView
        contentContainerStyle={{
          padding: 16,
          paddingBottom: 132 + insets.bottom,
        }}
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator={false}
      >
        <View className="overflow-hidden rounded-[30px] bg-white">
          <AppMap
            points={mapPoints}
            routeCoordinates={routeCoordinates}
            height={320}
            showsUserLocation={false}
          />
          <Pressable
            accessibilityLabel="Cập nhật vị trí của tôi"
            accessibilityRole="button"
            onPress={() => locateUser()}
            className="absolute bottom-4 right-4 flex-row items-center gap-2 rounded-full bg-white px-4 py-3"
          >
            {isLocating ? (
              <ActivityIndicator size="small" color="#EB489B" />
            ) : (
              <SymbolView
                name={{
                  ios: "location.fill",
                  android: "my_location",
                  web: "my_location",
                }}
                size={16}
                tintColor="#EB489B"
              />
            )}
            <Text className="text-[13px] font-extrabold text-[#2B2233]">
              Vị trí của tôi
            </Text>
          </Pressable>
        </View>

        <View className="mt-4 rounded-3xl bg-white p-4">
          <Text className="text-[16px] font-extrabold text-[#2B2233]">
            Chọn địa điểm
          </Text>
          <Text className="mt-1 text-[13px] leading-5 text-[#8E869A]">
            Mặc định hiển thị những nơi trong bán kính 10 km quanh bạn. Nhập tên
            để tìm trên toàn hệ thống.
          </Text>

          <View className="mt-3 flex-row items-center rounded-2xl bg-[#F1F3F7] px-3">
            <SymbolView
              name={{
                ios: "magnifyingglass",
                android: "search",
                web: "search",
              }}
              size={18}
              tintColor="#8E869A"
            />
            <TextInput
              value={systemQuery}
              onChangeText={setSystemQuery}
              placeholder="Tìm theo tên hoặc địa chỉ..."
              placeholderTextColor="#A09AA8"
              className="flex-1 px-3 py-3.5 text-[15px] text-[#2B2233]"
            />
            {systemQuery ? (
              <Pressable
                accessibilityLabel="Xóa từ khóa"
                accessibilityRole="button"
                hitSlop={10}
                onPress={() => setSystemQuery("")}
              >
                <SymbolView
                  name={{ ios: "xmark", android: "close", web: "close" }}
                  size={17}
                  tintColor="#8E869A"
                />
              </Pressable>
            ) : null}
          </View>

          <View className="mt-3 flex-row gap-2">
            <Pressable
              accessibilityRole="button"
              onPress={() => {
                setSystemQuery("");
                setFirstSearchHotspot(null);
                setNearFirstSearchHotspots([]);
                setNearFirstSearchError(null);
                void loadNearbyHotspots(
                  userPoint.latitude,
                  userPoint.longitude,
                );
              }}
              className={`flex-1 rounded-xl py-3 ${browseMode === "NEARBY" ? "bg-[#2B2233]" : "bg-[#F1F3F7]"}`}
            >
              <Text
                className={`text-center text-[13px] font-extrabold ${browseMode === "NEARBY" ? "text-white" : "text-[#777181]"}`}
              >
                Gần tôi
              </Text>
            </Pressable>
            <Pressable
              accessibilityRole="button"
              onPress={() =>
                systemQuery.trim() && void runHotspotSearch(systemQuery)
              }
              className={`flex-1 rounded-xl py-3 ${browseMode === "SEARCH" ? "bg-[#2B2233]" : "bg-[#F1F3F7]"}`}
            >
              <Text
                className={`text-center text-[13px] font-extrabold ${browseMode === "SEARCH" ? "text-white" : "text-[#777181]"}`}
              >
                Kết quả tìm kiếm
              </Text>
            </Pressable>
          </View>

          {isBrowseLoading ? (
            <View className="items-center py-5">
              <ActivityIndicator color="#EB489B" />
              <Text className="mt-2 text-[13px] font-bold text-[#8E869A]">
                Đang tải địa điểm...
              </Text>
            </View>
          ) : null}

          {browseError ? (
            <View className="mt-3 rounded-2xl bg-[#FFF0F2] p-3.5">
              <Text className="text-[13px] font-bold leading-5 text-[#C43D52]">
                {browseError}
              </Text>
            </View>
          ) : null}

          <View className="mt-3 gap-2">
            {!isBrowseLoading &&
              filteredBrowseHotspots
                .slice(0, 12)
                .map((hotspot) => renderStopCard(hotspot, { accent: "pink" }))}
            {!isBrowseLoading && !filteredBrowseHotspots.length ? (
              <View className="items-center rounded-2xl border border-dashed border-[#D9DDE7] px-4 py-6">
                <Text className="text-[13px] font-bold text-[#8E869A]">
                  Không tìm thấy địa điểm phù hợp
                </Text>
              </View>
            ) : null}
          </View>

          {browseMode === "SEARCH" && firstSearchHotspot ? (
            <View className="mt-5 border-t border-[#EEF0F5] pt-4">
              <Text className="text-[14px] font-extrabold text-[#2B2233]">
                Gần {firstSearchHotspot.title}
              </Text>
              <Text className="mt-1 text-[13px] leading-5 text-[#8E869A]">
                Những nơi khác trong bán kính 5 km, có thể ghé cùng chuyến.
              </Text>

              {isNearFirstSearchLoading ? (
                <View className="items-center py-5">
                  <ActivityIndicator color="#EB489B" />
                  <Text className="mt-2 text-[13px] font-bold text-[#8E869A]">
                    Đang tìm địa điểm lân cận...
                  </Text>
                </View>
              ) : null}

              {nearFirstSearchError ? (
                <View className="mt-3 rounded-2xl bg-[#FFF0F2] p-3.5">
                  <Text className="text-[13px] font-bold leading-5 text-[#C43D52]">
                    {nearFirstSearchError}
                  </Text>
                </View>
              ) : null}

              {!isNearFirstSearchLoading ? (
                <View className="mt-3 gap-2">
                  {nearFirstSearchHotspots
                    .slice(0, 10)
                    .map((hotspot) => renderStopCard(hotspot, { accent: "blue" }))}
                  {!nearFirstSearchHotspots.length && !nearFirstSearchError ? (
                    <View className="items-center rounded-2xl border border-dashed border-[#D9DDE7] px-4 py-5">
                      <Text className="text-[13px] font-bold text-[#8E869A]">
                        Không có địa điểm nào ở gần
                      </Text>
                    </View>
                  ) : null}
                </View>
              ) : null}
            </View>
          ) : null}
        </View>

        <View className="mt-4 rounded-3xl bg-white p-4">
          <View className="flex-row items-center gap-2">
            <Text className="flex-1 text-[16px] font-extrabold text-[#2B2233]">
              Mô tả chuyến đi để được gợi ý
            </Text>
            <View className="rounded-full bg-[#F1F3F7] px-2.5 py-1">
              <Text className="text-[12px] font-bold text-[#777181]">
                Tùy chọn
              </Text>
            </View>
          </View>
          <Text className="mt-1 text-[13px] leading-5 text-[#8E869A]">
            Kể về chuyến đi bạn muốn, hệ thống sẽ đề xuất những nơi phù hợp để
            bạn chọn thêm.
          </Text>
          <TextInput
            value={aiPrompt}
            onChangeText={setAiPrompt}
            multiline
            placeholder="Ví dụ: Tôi muốn đi các nơi lịch sử, kiến trúc đẹp, gần nhau và xong trong một buổi sáng..."
            placeholderTextColor="#A09AA8"
            className="mt-3 min-h-24 rounded-2xl bg-[#F1F3F7] px-4 py-3 text-[15px] leading-6 text-[#2B2233]"
            textAlignVertical="top"
          />
          <Pressable
            accessibilityRole="button"
            disabled={isAiLoading}
            onPress={generateAiTextSuggestion}
            className={`mt-3 flex-row items-center justify-center gap-2 rounded-2xl py-4 ${isAiLoading ? "bg-[#8F8797]" : "bg-[#2B2233]"}`}
          >
            {isAiLoading ? (
              <ActivityIndicator size="small" color="#fff" />
            ) : (
              <SymbolView
                name={{ ios: "sparkles", android: "auto_awesome", web: "auto_awesome" }}
                size={17}
                tintColor="#fff"
              />
            )}
            <Text className="text-[14px] font-extrabold text-white">
              {isAiLoading ? "Đang tìm gợi ý..." : "Gợi ý địa điểm cho tôi"}
            </Text>
          </Pressable>

          {aiText ? (
            <View className="mt-3 rounded-2xl bg-[#F7F3FA] p-4">
              <View className="flex-row items-center gap-2">
                <SymbolView
                  name={{ ios: "sparkles", android: "auto_awesome", web: "auto_awesome" }}
                  size={16}
                  tintColor="#7A5AA8"
                />
                <Text className="text-[14px] font-extrabold text-[#2B2233]">
                  Gợi ý cho bạn
                </Text>
              </View>
              <Text className="mt-2 text-[13px] leading-6 text-[#5E5868]">
                {aiText}
              </Text>
              {!isAiConfirmed && aiCandidates.length ? (
                <Pressable
                  accessibilityRole="button"
                  onPress={confirmAiSuggestion}
                  className="mt-3 rounded-xl bg-[#EB489B] py-3.5"
                >
                  <Text className="text-center text-[14px] font-extrabold text-white">
                    Xem {aiCandidates.length} địa điểm được gợi ý
                  </Text>
                </Pressable>
              ) : null}
            </View>
          ) : null}

          {isAiConfirmed ? (
            <View className="mt-3 gap-2">
              {aiCandidates.map((stop) => {
                const isSelected = stops.some(
                  (item) => String(item.id) === String(stop.id),
                );
                return (
                  <Pressable
                    accessibilityRole="button"
                    key={String(stop.id)}
                    onPress={() => toggleStop(stop)}
                    className={`gap-2 rounded-2xl border p-3.5 ${
                      isSelected
                        ? "border-[#EB489B] bg-[#FFF6FA]"
                        : "border-[#E8EDF4] bg-white"
                    }`}
                  >
                    <View className="flex-row items-center gap-3">
                      <View className="min-w-0 flex-1">
                        <Text
                          className="text-[14px] font-extrabold text-[#2B2233]"
                          numberOfLines={1}
                        >
                          {stop.title}
                        </Text>
                        <Text
                          className="mt-0.5 text-[12px] text-[#8E869A]"
                          numberOfLines={1}
                        >
                          {stop.address}
                        </Text>
                      </View>
                      <View
                        className="h-9 w-9 items-center justify-center rounded-full"
                        style={{ backgroundColor: isSelected ? "#FFE3EF" : "#F1F3F7" }}
                      >
                        <SymbolView
                          name={
                            isSelected
                              ? { ios: "checkmark", android: "check", web: "check" }
                              : { ios: "plus", android: "add", web: "add" }
                          }
                          size={17}
                          tintColor={isSelected ? "#D93679" : "#5F5866"}
                        />
                      </View>
                    </View>
                    {stop.reason ? (
                      <Text className="text-[12px] leading-5 text-[#7A5AA8]">
                        {stop.reason}
                      </Text>
                    ) : null}
                  </Pressable>
                );
              })}
            </View>
          ) : null}
        </View>

        <View className="mt-4 rounded-3xl bg-white p-4">
          <Text className="text-[16px] font-extrabold text-[#2B2233]">
            Sắp xếp thứ tự
          </Text>
          <Text className="mt-1 text-[13px] text-[#8E869A]">
            {stops.length
              ? `${stops.length} địa điểm · khoảng ${formatDistance(totalDistance)}`
              : "Chọn ít nhất 2 địa điểm ở phần trên"}
          </Text>
          {stops.length > 1 ? (
            <Text className="mt-1 text-[13px] text-[#A9A2B2]">
              Nhấn giữ một địa điểm rồi kéo để đổi thứ tự.
            </Text>
          ) : null}

          <View className="mt-3">
            <DraggableList
              data={stops}
              keyExtractor={(stop) => String(stop.id)}
              onReorder={reorderStops}
              rowHeight={STOP_ROW_HEIGHT}
              renderItem={({ index, isDragging, isReordering, item: stop }) => (
                <View
                  className={`flex-row items-center gap-3 rounded-2xl border bg-white p-3.5 ${
                    isDragging ? "border-[#EB489B]" : "border-[#E8EDF4]"
                  }`}
                  style={{
                    elevation: isDragging ? 6 : 0,
                    height: STOP_ROW_HEIGHT - STOP_ROW_GAP,
                    shadowColor: "#2B2233",
                    shadowOffset: { height: 6, width: 0 },
                    shadowOpacity: isDragging ? 0.16 : 0,
                    shadowRadius: 12,
                  }}
                >
                  <View className="h-10 w-10 items-center justify-center rounded-full bg-[#EB489B]">
                    {isReordering ? (
                      <SymbolView
                        name={{ ios: "line.3.horizontal", android: "drag_handle", web: "drag_handle" }}
                        size={18}
                        tintColor="#fff"
                      />
                    ) : (
                      <Text className="text-[15px] font-extrabold text-white">
                        {index + 1}
                      </Text>
                    )}
                  </View>
                  <View className="min-w-0 flex-1">
                    <Text
                      className="text-[14px] font-extrabold text-[#2B2233]"
                      numberOfLines={1}
                    >
                      {stop.title}
                    </Text>
                    <Text
                      className="mt-0.5 text-[12px] text-[#8E869A]"
                      numberOfLines={1}
                    >
                      {stop.address}
                      {stop.scheduleLabel ? ` · mở ${stop.scheduleLabel}` : ""}
                    </Text>
                  </View>

                  <Pressable
                    accessibilityLabel={`Xóa ${stop.title} khỏi hành trình`}
                    accessibilityRole="button"
                    hitSlop={8}
                    onPress={() => removeStop(index)}
                    className="h-9 w-9 items-center justify-center rounded-lg bg-[#FFF0F2]"
                  >
                    <SymbolView
                      name={{ ios: "trash", android: "delete_outline", web: "delete_outline" }}
                      size={17}
                      tintColor="#D13C54"
                    />
                  </Pressable>
                  <SymbolView
                    name={{ ios: "line.3.horizontal", android: "drag_handle", web: "drag_handle" }}
                    size={20}
                    tintColor="#C4BFCB"
                  />
                </View>
              )}
            />

            {!stops.length ? (
              <View className="items-center rounded-2xl border border-dashed border-[#D9DDE7] px-4 py-7">
                <Text className="text-[14px] font-bold text-[#8E869A]">
                  Chưa có địa điểm nào
                </Text>
                <Text className="mt-1 text-center text-[13px] leading-5 text-[#A9A2B2]">
                  Bấm dấu cộng ở danh sách phía trên để thêm
                </Text>
              </View>
            ) : null}
          </View>

          {stops.length >= 2 ? (
            <View className="mt-4 rounded-2xl bg-[#FBF9FD] p-3.5">
              <Text className="text-[14px] font-extrabold text-[#2B2233]">
                Để hệ thống sắp xếp giúp
              </Text>
              <View className="mt-2.5 flex-row gap-2">
                {(["DISTANCE", "OPENING_HOURS"] as const).map((mode) => (
                  <Pressable
                    accessibilityRole="button"
                    key={mode}
                    onPress={() => setOptimizeMode(mode)}
                    className={`flex-1 rounded-xl py-3 ${
                      optimizeMode === mode ? "bg-[#2B2233]" : "bg-white"
                    }`}
                  >
                    <Text
                      className={`text-center text-[13px] font-bold ${
                        optimizeMode === mode ? "text-white" : "text-[#777181]"
                      }`}
                    >
                      {mode === "DISTANCE" ? "Đường ngắn nhất" : "Theo giờ mở cửa"}
                    </Text>
                  </Pressable>
                ))}
              </View>

              {optimizeMode === "OPENING_HOURS" ? (
                <View className="mt-3">
                  <Text className="text-[13px] font-bold text-[#5E5868]">
                    Bạn khởi hành lúc mấy giờ?
                  </Text>
                  <View className="mt-2 flex-row gap-2">
                    {START_TIME_OPTIONS.map((time) => (
                      <Pressable
                        accessibilityRole="button"
                        key={time}
                        onPress={() => setStartTime(time)}
                        className={`flex-1 rounded-xl py-2.5 ${
                          startTime === time ? "bg-[#EB489B]" : "bg-white"
                        }`}
                      >
                        <Text
                          className={`text-center text-[13px] font-bold ${
                            startTime === time ? "text-white" : "text-[#777181]"
                          }`}
                        >
                          {time}
                        </Text>
                      </Pressable>
                    ))}
                  </View>
                </View>
              ) : null}

              <Pressable
                accessibilityRole="button"
                onPress={optimizeRoute}
                disabled={isOptimizing}
                className="mt-3 flex-row items-center justify-center gap-2 rounded-xl bg-[#FFF1F6] py-3.5"
              >
                {isOptimizing ? (
                  <ActivityIndicator size="small" color="#D93679" />
                ) : (
                  <SymbolView
                    name={{ ios: "sparkles", android: "auto_awesome", web: "auto_awesome" }}
                    size={16}
                    tintColor="#D93679"
                  />
                )}
                <Text className="text-[14px] font-extrabold text-[#D93679]">
                  {isOptimizing ? "Đang sắp xếp..." : "Sắp xếp tự động"}
                </Text>
              </Pressable>

              {aiOptimizeExplanation ? (
                <View className="mt-3 rounded-xl bg-[#FFF8EC] p-3.5">
                  <Text className="text-[13px] leading-6 text-[#735A3D]">
                    {aiOptimizeExplanation}
                  </Text>
                </View>
              ) : null}
            </View>
          ) : null}
        </View>

        <View className="mt-4 rounded-3xl bg-white p-4">
          <Text className="text-[16px] font-extrabold text-[#2B2233]">
            Đặt tên hành trình
          </Text>
          <Text className="mt-1 text-[13px] leading-5 text-[#8E869A]">
            Tên này giúp bạn nhận ra hành trình trong danh sách của mình.
          </Text>
          <TextInput
            value={planName}
            onChangeText={setPlanName}
            maxLength={60}
            placeholder="Ví dụ: Sài Gòn xưa một buổi sáng"
            placeholderTextColor="#A09AA8"
            className="mt-3 rounded-2xl bg-[#F1F3F7] px-4 py-3.5 text-[15px] text-[#2B2233]"
          />
          <Text className="mt-1.5 text-right text-[12px] text-[#A9A2B2]">
            {planName.length}/60
          </Text>

          <Pressable
            accessibilityRole="button"
            disabled={!canBuildPlan}
            onPress={() => void openInGoogleMaps()}
            className={`mt-2 flex-row items-center justify-center gap-2 rounded-2xl py-4 ${canBuildPlan ? "bg-[#EEF6FF]" : "bg-[#F4F5F8]"}`}
          >
            <SymbolView
              name={{ ios: "map.fill", android: "map", web: "map" }}
              size={17}
              tintColor={canBuildPlan ? "#1677C8" : "#B4B0BB"}
            />
            <Text
              className={`text-[14px] font-extrabold ${canBuildPlan ? "text-[#1677C8]" : "text-[#B4B0BB]"}`}
            >
              Xem trước trên Google Maps
            </Text>
          </Pressable>

          {currentPlan ? (
            <View className="mt-3 rounded-2xl bg-[#EEF9F1] p-3.5">
              <Text className="text-[14px] font-extrabold text-[#28844A]">
                {currentPlan.name}
              </Text>
              <Text className="mt-1 text-[13px] leading-5 text-[#3C7A55]">
                {PLAN_STATUS_LABEL[currentPlan.status] ?? "Đã lưu"} ·{" "}
                {currentPlan.completedStops}/{currentPlan.totalStops} điểm đã đi
              </Text>
              <View className="mt-3 flex-row gap-2">
                <Pressable
                  accessibilityRole="button"
                  onPress={() =>
                    router.push(`/route/custom/plan/${currentPlan.userPlanId}`)
                  }
                  className="flex-1 rounded-xl bg-white py-3"
                >
                  <Text className="text-center text-[13px] font-extrabold text-[#28844A]">
                    Xem chi tiết
                  </Text>
                </Pressable>
                {currentPlan.status !== "STARTED" ? (
                  <Pressable
                    accessibilityRole="button"
                    disabled={isBusy}
                    onPress={() => void beginPlan()}
                    className={`flex-1 rounded-xl py-3 ${isBusy ? "bg-[#9BB8A7]" : "bg-[#28844A]"}`}
                  >
                    {isStarting ? (
                      <ActivityIndicator size="small" color="#fff" />
                    ) : (
                      <Text className="text-center text-[13px] font-extrabold text-white">
                        Bắt đầu đi
                      </Text>
                    )}
                  </Pressable>
                ) : null}
              </View>
            </View>
          ) : null}
        </View>
      </ScrollView>

      <View
        className="absolute inset-x-0 bottom-0 border-t border-[#ECE8F2] bg-white px-4 pt-3"
        style={{ paddingBottom: Math.max(insets.bottom, 12) }}
      >
        <View className="flex-row items-center gap-3">
          <View className="min-w-0 flex-1">
            <Text className="text-[15px] font-extrabold text-[#2B2233]">
              {stops.length} địa điểm
              {stops.length ? ` · khoảng ${formatDistance(totalDistance)}` : ""}
            </Text>
            <Text className="text-[13px] text-[#8E869A]" numberOfLines={1}>
              {canBuildPlan
                ? planName.trim() || defaultPlanName()
                : `Cần thêm ${Math.max(2 - stops.length, 0)} địa điểm nữa`}
            </Text>
          </View>
          <Pressable
            accessibilityRole="button"
            disabled={!canBuildPlan || isBusy}
            onPress={() => void reviewPlan()}
            className={`min-w-[140px] items-center justify-center rounded-2xl px-5 py-4 ${
              canBuildPlan && !isBusy ? "bg-[#EB489B]" : "bg-[#D9DDE7]"
            }`}
          >
            {isSaving ? (
              <ActivityIndicator size="small" color="#fff" />
            ) : (
              <Text
                className={`text-[15px] font-extrabold ${canBuildPlan && !isBusy ? "text-white" : "text-[#8E869A]"}`}
              >
                {isReviewed ? "Tạo lại" : "Tạo hành trình"}
              </Text>
            )}
          </Pressable>
        </View>
      </View>
    </SafeAreaView>
    </GestureHandlerRootView>
  );
}
