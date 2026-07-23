import * as Location from "expo-location";
import { useRouter } from "expo-router";
import { SymbolView } from "expo-symbols";
import { useCallback, useEffect, useMemo, useState } from "react";
import {
  ActivityIndicator,
  Pressable,
  ScrollView,
  Text,
  TextInput,
  View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

import { routeSystemAlert } from "@/features/route/components/route-system-alert";

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

function normalizeText(value: string) {
  return value
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .trim();
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

export default function UserPlanScreen() {
  const router = useRouter();
  const session = useAuthSession();
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
  const [isAiConfirmed, setIsAiConfirmed] = useState(false);
  const [userAvatarUri, setUserAvatarUri] = useState<string | null>(null);
  const [userPoint, setUserPoint] = useState<AppMapPoint>({
    ...defaultUserPoint,
    isCurrentUser: true,
    avatarUri: null,
  });
  const [stops, setStops] = useState<PlannedStop[]>([]);
  const [optimizeMode, setOptimizeMode] = useState<OptimizeMode>("DISTANCE");
  const [aiOptimizeExplanation, setAiOptimizeExplanation] = useState("");
  const [isReviewed, setIsReviewed] = useState(false);
  const [currentPlan, setCurrentPlan] = useState<UserPlan | null>(null);
  const [isSaving, setIsSaving] = useState(false);

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

  async function getAuth() {
    const accessToken = await getValidAccessToken();
    if (!accessToken)
      throw new Error("Bạn cần đăng nhập để sử dụng kế hoạch cá nhân.");
    return { accessToken, tokenType: session.tokenType };
  }

  function addStop(stop: PlannedStop) {
    if (stops.some((item) => String(item.id) === String(stop.id))) {
      routeSystemAlert.alert("Địa điểm đã có", "Điểm này đã nằm trong kế hoạch.");
      return;
    }
    setStops((current) => [...current, stop]);
    setIsReviewed(false);
    setCurrentPlan(null);
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
            : "Không thể tải hotspot gần bạn.",
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
          routeSystemAlert.alert(
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
            : "Không thể tải hotspot gần kết quả tìm kiếm.",
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
            : "Không thể tìm kiếm hotspot.",
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

  useEffect(() => {
    const timeout = setTimeout(() => {
      void locateUser(false);
    }, 0);

    return () => clearTimeout(timeout);
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
      routeSystemAlert.alert(
        "Nhập mô tả chuyến đi",
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
          ? `Hệ thống đã tìm thấy ${candidates.length} hotspot phù hợp. Hãy xác nhận để xem và chọn các địa điểm được đề xuất.`
          : "Không tìm thấy hotspot phù hợp với mô tả hiện tại. Hãy thử mô tả rộng hơn.",
      );
    } catch (error) {
      routeSystemAlert.alert(
        "Không thể nhận gợi ý",
        error instanceof Error ? error.message : "Vui lòng thử lại.",
      );
    } finally {
      setIsAiLoading(false);
    }
  }

  function confirmAiSuggestion() {
    if (aiCandidates.length) setIsAiConfirmed(true);
  }

  function moveStop(index: number, direction: -1 | 1) {
    const targetIndex = index + direction;
    if (targetIndex < 0 || targetIndex >= stops.length) return;
    setStops((current) => {
      const next = [...current];
      [next[index], next[targetIndex]] = [next[targetIndex], next[index]];
      return next;
    });
    setIsReviewed(false);
    setCurrentPlan(null);
  }

  async function optimizeRoute() {
    const hotspotIds = stops.flatMap((item) =>
      item.hotspotId ? [item.hotspotId] : [],
    );
    if (stops.length < 2) return;
    if (hotspotIds.length !== stops.length) {
      routeSystemAlert.alert(
        "Chưa thể tối ưu",
      );
      return;
    }
    setIsAiLoading(true);
    try {
      const result = await optimizeUserPlan(await getAuth(), {
        hotspotIds,
        startLatitude: userPoint.latitude,
        startLongitude: userPoint.longitude,
        criterion: optimizeMode === "DISTANCE" ? "DISTANCE" : "TIME",
        startTime: "08:00:00",
      });
      const byId = new Map(stops.map((stop) => [stop.hotspotId, stop]));
      setStops(
        result.stops
          .map((stop) => byId.get(stop.hotspotId))
          .filter(Boolean) as PlannedStop[],
      );
      setAiOptimizeExplanation(
        `${result.totalEstimatedTimeText || "Đã tối ưu"} • ${Math.round(result.totalDistance || 0)} m${result.usedFallback ? " " : ""}`,
      );
      setIsReviewed(false);
      setCurrentPlan(null);
    } catch (error) {
      routeSystemAlert.alert(
        "Không thể tối ưu",
        error instanceof Error ? error.message : "Vui lòng thử lại.",
      );
    } finally {
      setIsAiLoading(false);
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
      routeSystemAlert.alert(
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
      routeSystemAlert.alert(
        "Không thể lưu kế hoạch",
        
      );
      return;
    }
    setIsSaving(true);
    try {
      const plan = await createUserPlan(await getAuth(), {
        name: `Hành trình cá nhân ${new Date().toLocaleDateString("vi-VN")}`,
        description: aiPrompt.trim() || "Hành trình được tạo từ User Plan",
        stops: hotspotIds.map((hotspotId) => ({ hotspotId })),
        startLatitude: userPoint.latitude,
        startLongitude: userPoint.longitude,
        isOptimized: Boolean(aiOptimizeExplanation),
      });
      setCurrentPlan(plan);
      setIsReviewed(true);
      routeSystemAlert.alert(
        "Đã tạo kế hoạch",
        `Kế hoạch #${plan.userPlanId} đã được lưu ở trạng thái ${plan.status}.`,
      );
    } catch (error) {
      routeSystemAlert.alert(
        "Không thể tạo kế hoạch",
        error instanceof Error ? error.message : "Vui lòng thử lại.",
      );
    } finally {
      setIsSaving(false);
    }
  }

  async function beginPlan() {
    if (!currentPlan) return;
    setIsSaving(true);
    try {
      const started = await startUserPlan(
        await getAuth(),
        currentPlan.userPlanId,
      );
      setCurrentPlan(started);
      routeSystemAlert.alert(
        "Đã bắt đầu hành trình",
        "Kế hoạch đã chuyển sang trạng thái STARTED.",
      );
    } catch (error) {
      routeSystemAlert.alert(
        "Không thể bắt đầu",
        error instanceof Error ? error.message : "Vui lòng thử lại.",
      );
    } finally {
      setIsSaving(false);
    }
  }
  return (
    <SafeAreaView
      className="flex-1 bg-[#F7F8FC]"
      edges={["top", "left", "right"]}
    >
      <View className="flex-row items-center gap-3 px-4 py-3">
        <Pressable
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
            Tạo tuyến đường cá nhân
          </Text>
          <Text className="text-[11px] text-[#777181]">
            Chọn hotspot theo thứ tự, nhờ AI hỗ trợ và duyệt hành trình
          </Text>
        </View>
      </View>

      <ScrollView
        contentContainerStyle={{ padding: 16, paddingBottom: 40 }}
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator={false}
      >
        <View className="mt-4 overflow-hidden rounded-[30px] bg-white">
          <AppMap
            points={mapPoints}
            routeCoordinates={routeCoordinates}
            height={320}
            showsUserLocation={false}
          />
          <Pressable
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
            <Text className="text-[11px] font-extrabold text-[#2B2233]">
              Vị trí của tôi
            </Text>
          </Pressable>
        </View>

        <View className="rounded-3xl bg-white p-4">
          <Text className="text-[14px] font-extrabold text-[#2B2233]">
            1. Hotspot gần bạn hoặc tìm kiếm
          </Text>
          <Text className="mt-1 text-[10px] leading-4 text-[#8E869A]">
            Ứng dụng ưu tiên quét hotspot trong bán kính 10 km từ vị trí hiện
            tại. Nhập ít nhất 2 ký tự để tìm bằng API search.
          </Text>

          <View className="mt-3 flex-row items-center rounded-2xl bg-[#F1F3F7] px-3">
            <SymbolView
              name={{
                ios: "magnifyingglass",
                android: "search",
                web: "search",
              }}
              size={17}
              tintColor="#8E869A"
            />
            <TextInput
              value={systemQuery}
              onChangeText={setSystemQuery}
              placeholder="Tìm theo tên hotspot hoặc địa chỉ..."
              placeholderTextColor="#A09AA8"
              className="flex-1 px-3 py-3.5 text-[13px] text-[#2B2233]"
            />
          </View>

          <View className="mt-3 flex-row gap-2">
            <Pressable
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
              className={`flex-1 rounded-xl py-2.5 ${browseMode === "NEARBY" ? "bg-[#2B2233]" : "bg-[#F1F3F7]"}`}
            >
              <Text
                className={`text-center text-[10px] font-extrabold ${browseMode === "NEARBY" ? "text-white" : "text-[#777181]"}`}
              >
                Gần tôi
              </Text>
            </Pressable>
            <Pressable
              onPress={() =>
                systemQuery.trim() && void runHotspotSearch(systemQuery)
              }
              className={`flex-1 rounded-xl py-2.5 ${browseMode === "SEARCH" ? "bg-[#2B2233]" : "bg-[#F1F3F7]"}`}
            >
              <Text
                className={`text-center text-[10px] font-extrabold ${browseMode === "SEARCH" ? "text-white" : "text-[#777181]"}`}
              >
                Kết quả tìm kiếm
              </Text>
            </Pressable>
          </View>

          {isBrowseLoading ? (
            <View className="items-center py-5">
              <ActivityIndicator color="#EB489B" />
            </View>
          ) : null}

          {browseError ? (
            <View className="mt-3 rounded-2xl bg-[#FFF0F2] p-3">
              <Text className="text-[10px] font-bold text-[#C43D52]">
                {browseError}
              </Text>
            </View>
          ) : null}

          <View className="mt-3 gap-2">
            {!isBrowseLoading &&
              filteredBrowseHotspots.slice(0, 12).map((hotspot) => {
                const selectedIndex = stops.findIndex(
                  (item) => item.id === hotspot.id,
                );
                const isSelected = selectedIndex >= 0;
                return (
                  <Pressable
                    key={String(hotspot.id)}
                    onPress={() => addStop(hotspot)}
                    className={`flex-row items-center gap-3 rounded-2xl border p-3 ${
                      isSelected
                        ? "border-[#EB489B] bg-[#FFF6FA]"
                        : "border-[#E8EDF4]"
                    }`}
                  >
                    <View className="h-10 w-10 items-center justify-center rounded-xl bg-[#FFF1F6]">
                      <Text>{isSelected ? selectedIndex + 1 : "📍"}</Text>
                    </View>
                    <View className="flex-1">
                      <Text
                        className="text-[12px] font-extrabold text-[#2B2233]"
                        numberOfLines={1}
                      >
                        {hotspot.title}
                      </Text>
                      <Text
                        className="mt-1 text-[10px] text-[#8E869A]"
                        numberOfLines={1}
                      >
                        {hotspot.address}
                      </Text>
                      {hotspot.scheduleLabel ? (
                        <Text className="mt-1 text-[9px] font-bold text-[#F58752]">
                          🕒 {hotspot.scheduleLabel}
                        </Text>
                      ) : null}
                    </View>
                    <Text
                      className={`text-[11px] font-extrabold ${isSelected ? "text-[#EB489B]" : "text-[#777181]"}`}
                    >
                      {isSelected ? `Đã chọn #${selectedIndex + 1}` : "+ Thêm"}
                    </Text>
                  </Pressable>
                );
              })}
            {!isBrowseLoading && !filteredBrowseHotspots.length ? (
              <View className="items-center rounded-2xl border border-dashed border-[#D9DDE7] px-4 py-6">
                <Text className="text-[11px] font-bold text-[#8E869A]">
                  Không tìm thấy hotspot phù hợp
                </Text>
              </View>
            ) : null}
          </View>

          {browseMode === "SEARCH" && firstSearchHotspot ? (
            <View className="mt-5 border-t border-[#EEF0F5] pt-4">
              <View className="flex-row items-start justify-between gap-3">
                <View className="flex-1">
                  <Text className="text-[12px] font-extrabold text-[#2B2233]">
                    Hotspot gần kết quả đầu tiên
                  </Text>
                  <Text className="mt-1 text-[10px] leading-4 text-[#8E869A]">
                    Các địa điểm trong bán kính 5 km quanh{" "}
                    {firstSearchHotspot.title}. Bạn có thể thêm trực tiếp vào
                    User Plan.
                  </Text>
                </View>
                <View className="rounded-full bg-[#FFF1F6] px-3 py-1.5">
                  <Text className="text-[9px] font-extrabold text-[#D93679]">
                    NEARBY
                  </Text>
                </View>
              </View>

              {isNearFirstSearchLoading ? (
                <View className="items-center py-5">
                  <ActivityIndicator color="#EB489B" />
                </View>
              ) : null}

              {nearFirstSearchError ? (
                <View className="mt-3 rounded-2xl bg-[#FFF0F2] p-3">
                  <Text className="text-[10px] font-bold text-[#C43D52]">
                    {nearFirstSearchError}
                  </Text>
                </View>
              ) : null}

              {!isNearFirstSearchLoading ? (
                <View className="mt-3 gap-2">
                  {nearFirstSearchHotspots.slice(0, 10).map((hotspot) => {
                    const selectedIndex = stops.findIndex(
                      (item) => item.hotspotId === hotspot.hotspotId,
                    );
                    const isSelected = selectedIndex >= 0;
                    return (
                      <Pressable
                        key={`near-search-${hotspot.hotspotId}`}
                        onPress={() => addStop(hotspot)}
                        className={`flex-row items-center gap-3 rounded-2xl border p-3 ${
                          isSelected
                            ? "border-[#EB489B] bg-[#FFF6FA]"
                            : "border-[#E8EDF4] bg-[#FBFCFE]"
                        }`}
                      >
                        <View className="h-10 w-10 items-center justify-center rounded-xl bg-[#EEF7FF]">
                          <Text>{isSelected ? selectedIndex + 1 : "🧭"}</Text>
                        </View>
                        <View className="flex-1">
                          <Text
                            className="text-[12px] font-extrabold text-[#2B2233]"
                            numberOfLines={1}
                          >
                            {hotspot.title}
                          </Text>
                          <Text
                            className="mt-1 text-[10px] text-[#8E869A]"
                            numberOfLines={1}
                          >
                            {hotspot.address}
                          </Text>
                        </View>
                        <Text
                          className={`text-[11px] font-extrabold ${
                            isSelected ? "text-[#EB489B]" : "text-[#1677C8]"
                          }`}
                        >
                          {isSelected
                            ? `Đã chọn #${selectedIndex + 1}`
                            : "+ Thêm"}
                        </Text>
                      </Pressable>
                    );
                  })}
                  {!nearFirstSearchHotspots.length && !nearFirstSearchError ? (
                    <View className="items-center rounded-2xl border border-dashed border-[#D9DDE7] px-4 py-5">
                      <Text className="text-[10px] font-bold text-[#8E869A]">
                        Không có hotspot nào gần kết quả đầu tiên
                      </Text>
                    </View>
                  ) : null}
                </View>
              ) : null}
            </View>
          ) : null}
        </View>

        <View className="mt-4 rounded-3xl bg-white p-4">
          <Text className="text-[14px] font-extrabold text-[#2B2233]">
            2. Mô tả chuyến đi để AI gợi ý
          </Text>
          <Text className="mt-1 text-[10px] leading-4 text-[#8E869A]">
            AI trả lời bằng nội dung mô tả trước. Sau khi Explorer xác nhận, đề
            xuất mới được chuyển thành hotspot để lựa chọn.
          </Text>
          <TextInput
            value={aiPrompt}
            onChangeText={setAiPrompt}
            multiline
            placeholder="Ví dụ: Tôi muốn đi các địa điểm lịch sử, kiến trúc đẹp, gần nhau và hoàn thành trong một buổi sáng..."
            placeholderTextColor="#A09AA8"
            className="mt-3 min-h-24 rounded-2xl bg-[#F1F3F7] px-4 py-3 text-[13px] leading-5 text-[#2B2233]"
            textAlignVertical="top"
          />
          <Pressable
            onPress={generateAiTextSuggestion}
            className="mt-3 flex-row items-center justify-center gap-2 rounded-2xl bg-[#2B2233] py-3.5"
          >
            {isAiLoading ? (
              <ActivityIndicator size="small" color="#fff" />
            ) : (
              <Text>✨</Text>
            )}
            <Text className="text-[12px] font-extrabold text-white">
              Nhận gợi ý dạng text
            </Text>
          </Pressable>

          {aiText ? (
            <View className="mt-3 rounded-2xl bg-[#F7F3FA] p-4">
              <View className="flex-row items-center gap-2">
                <Text>✨</Text>
                <Text className="text-[12px] font-extrabold text-[#2B2233]">
                  Đề xuất của AI
                </Text>
              </View>
              <Text className="mt-2 text-[11px] leading-5 text-[#5E5868]">
                {aiText}
              </Text>
              {!isAiConfirmed ? (
                <Pressable
                  onPress={confirmAiSuggestion}
                  className="mt-3 rounded-xl bg-[#EB489B] py-3"
                >
                  <Text className="text-center text-[11px] font-extrabold text-white">
                    Xác nhận và chuyển thành hotspot
                  </Text>
                </Pressable>
              ) : null}
            </View>
          ) : null}

          {isAiConfirmed ? (
            <View className="mt-3 gap-2">
              <Text className="text-[11px] font-extrabold text-[#2B2233]">
                Chọn các địa điểm AI đã gợi ý
              </Text>
              {aiCandidates.map((stop) => {
                const isSelected = stops.some((item) => item.id === stop.id);
                return (
                  <Pressable
                    key={String(stop.id)}
                    onPress={() => addStop(stop)}
                    className={`flex-row items-center gap-3 rounded-2xl border p-3 ${
                      isSelected
                        ? "border-[#EB489B] bg-[#FFF6FA]"
                        : "border-[#E8EDF4]"
                    }`}
                  >
                    <View className="h-9 w-9 items-center justify-center rounded-xl bg-[#F4EFF8]">
                      <Text>AI</Text>
                    </View>
                    <View className="flex-1">
                      <Text className="text-[12px] font-extrabold text-[#2B2233]">
                        {stop.title}
                      </Text>
                      <Text
                        className="text-[10px] text-[#8E869A]"
                        numberOfLines={1}
                      >
                        {stop.address}
                      </Text>
                    </View>
                    <Text className="text-[11px] font-extrabold text-[#EB489B]">
                      {isSelected ? "Đã chọn" : "+ Chọn"}
                    </Text>
                  </Pressable>
                );
              })}
            </View>
          ) : null}

          {currentPlan?.status === "STARTED" ? (
            <View className="mt-3 rounded-2xl bg-[#EEF9F1] p-3">
              <Text className="text-center text-[11px] font-extrabold text-[#28844A]">
                Kế hoạch đang được thực hiện • {currentPlan.completedStops}/
                {currentPlan.totalStops} điểm
              </Text>
            </View>
          ) : null}
        </View>

        <View className="mt-4 rounded-3xl bg-white p-4">
          <View className="flex-row items-center justify-between gap-3">
            <View className="flex-1">
              <Text className="text-[14px] font-extrabold text-[#2B2233]">
                3. Thứ tự và tối ưu lộ trình
              </Text>
              <Text className="text-[10px] text-[#8E869A]">
                {stops.length} địa điểm đã chọn theo đúng thứ tự Explorer bấm
              </Text>
            </View>
          </View>

          <View className="mt-3 flex-row gap-2">
            {(["OPENING_HOURS", "DISTANCE"] as const).map((mode) => (
              <Pressable
                key={mode}
                onPress={() => setOptimizeMode(mode)}
                className={`flex-1 rounded-xl py-3 ${
                  optimizeMode === mode ? "bg-[#2B2233]" : "bg-[#F1F3F7]"
                }`}
              >
                <Text
                  className={`text-center text-[10px] font-bold ${
                    optimizeMode === mode ? "text-white" : "text-[#777181]"
                  }`}
                >
                  {mode === "OPENING_HOURS"
                    ? "Thời gian mở cửa"
                    : "Tổng quãng đường"}
                </Text>
              </Pressable>
            ))}
          </View>

          <Pressable
            onPress={optimizeRoute}
            disabled={stops.length < 2}
            className={`mt-3 rounded-xl py-3 ${stops.length >= 2 ? "bg-[#FFF1F6]" : "bg-[#F1F3F7]"}`}
          >
            <Text
              className={`text-center text-[11px] font-extrabold ${
                stops.length >= 2 ? "text-[#D93679]" : "text-[#A3A7B0]"
              }`}
            >
              ✨ AI sắp xếp và giải thích
            </Text>
          </Pressable>

          {aiOptimizeExplanation ? (
            <View className="mt-3 rounded-2xl bg-[#FFF8EC] p-3">
              <Text className="text-[10px] font-extrabold text-[#9B641F]">
                AI giải thích
              </Text>
              <Text className="mt-1 text-[10px] leading-4 text-[#735A3D]">
                {aiOptimizeExplanation}
              </Text>
            </View>
          ) : null}

          <View className="mt-3 gap-2">
            {stops.map((stop, index) => (
              <View
                key={String(stop.id)}
                className="flex-row items-center gap-3 rounded-2xl border border-[#E8EDF4] p-3"
              >
                <View className="h-9 w-9 items-center justify-center rounded-full bg-[#EB489B]">
                  <Text className="text-[12px] font-extrabold text-white">
                    {index + 1}
                  </Text>
                </View>
                <View className="flex-1">
                  <Text
                    className="text-[12px] font-extrabold text-[#2B2233]"
                    numberOfLines={1}
                  >
                    {stop.title}
                  </Text>
                  <Text
                    className="text-[10px] text-[#8E869A]"
                    numberOfLines={1}
                  >
                    {stop.address}
                  </Text>
                  {stop.scheduleLabel ? (
                    <Text className="mt-1 text-[9px] font-bold text-[#F58752]">
                      🕒 {stop.scheduleLabel}
                    </Text>
                  ) : null}
                </View>
                <View className="gap-1">
                  <View className="flex-row gap-1">
                    <Pressable
                      onPress={() => moveStop(index, -1)}
                      disabled={index === 0}
                      className="h-7 w-7 items-center justify-center rounded-lg bg-[#F1F3F7]"
                    >
                      <Text>↑</Text>
                    </Pressable>
                    <Pressable
                      onPress={() => moveStop(index, 1)}
                      disabled={index === stops.length - 1}
                      className="h-7 w-7 items-center justify-center rounded-lg bg-[#F1F3F7]"
                    >
                      <Text>↓</Text>
                    </Pressable>
                  </View>
                  <Pressable
                    onPress={() => {
                      setStops((current) =>
                        current.filter(
                          (_, currentIndex) => currentIndex !== index,
                        ),
                      );
                      setIsReviewed(false);
                    }}
                    className="h-7 items-center justify-center rounded-lg bg-[#FFF0F2]"
                  >
                    <Text className="text-[9px] font-bold text-[#D13C54]">
                      Xóa
                    </Text>
                  </Pressable>
                </View>
              </View>
            ))}
            {!stops.length ? (
              <View className="items-center rounded-2xl border border-dashed border-[#D9DDE7] px-4 py-7">
                <Text className="text-[12px] font-bold text-[#8E869A]">
                  Chưa có địa điểm nào trong hành trình
                </Text>
              </View>
            ) : null}
          </View>
        </View>

        <View className="mt-4 rounded-3xl bg-white p-4">
          <Text className="text-[14px] font-extrabold text-[#2B2233]">
            4. Explorer duyệt và bắt đầu hành trình
          </Text>
          <Text className="mt-1 text-[10px] leading-4 text-[#8E869A]">
            Sau khi duyệt, Custom Route sẽ hoạt động giống một hành trình bình
            thường: hiển thị Route Detail, thứ tự hotspot, đường đi, check-in và
            tiến độ hoàn thành.
          </Text>

          <Pressable
            disabled={stops.length < 2}
            onPress={() => void openInGoogleMaps()}
            className={`mt-3 rounded-2xl py-4 ${stops.length >= 2 ? "bg-[#1677C8]" : "bg-[#D9DDE7]"}`}
          >
            <Text className="text-center text-[13px] font-extrabold text-white">
              Xem trước {stops.length} điểm trên Google Maps
            </Text>
          </Pressable>

          <Pressable
            disabled={stops.length < 2}
            onPress={() => void reviewPlan()}
            className={`mt-3 rounded-2xl py-4 ${stops.length >= 2 ? "bg-[#EB489B]" : "bg-[#D9DDE7]"}`}
          >
            <Text className="text-center text-[13px] font-extrabold text-white">
              {isSaving ? "Đang tạo kế hoạch..." : "Duyệt và tạo kế hoạch"}
            </Text>
          </Pressable>

          {isReviewed && currentPlan?.status !== "STARTED" ? (
            <Pressable
              onPress={() => void beginPlan()}
              className="mt-3 rounded-2xl bg-[#2B2233] py-4"
            >
              <Text className="text-center text-[13px] font-extrabold text-white">
                {isSaving
                  ? "Đang bắt đầu..."
                  : `Bắt đầu kế hoạch #${currentPlan?.userPlanId ?? ""}`}
              </Text>
            </Pressable>
          ) : null}
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}
