import { Image } from "expo-image";
import { LinearGradient } from "expo-linear-gradient";
import { type Href, useFocusEffect, useLocalSearchParams, useRouter } from "expo-router";
import { useCallback, useEffect, useMemo, useState } from "react";
import {
  ActivityIndicator,
  Pressable,
  ScrollView,
  Text,
  View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

import { routeSystemAlert } from "@/features/route/components/route-system-alert";

import { SymbolView } from "@/components/ui/symbol-view";
import {
  getValidAccessToken,
  useAuthSession,
} from "@/features/auth/hooks/use-auth-session";
import {
  findMatchingHotspotByNameOrCoordinate,
  getApiHotspotRouteSlug,
  getHotspotHref,
} from "@/features/home/data/hotspots";
import { getMultiStopRouteCoordinates } from "@/features/map/api/goong-directions";
import { AppMap, type AppMapPoint } from "@/features/map/components/app-map";
import {
  getUserPlan,
  startUserPlan,
  type PlannerHotspot,
  type UserPlan,
} from "@/features/route/api/user-plan-api";
import { getHotspotDetailHref } from "@/lib/hotspot-navigation";
import { openGoogleMapsMultiStopRoute } from "@/lib/google-maps-navigation";

const fallbackImage =
  "https://i.pinimg.com/736x/f3/0f/e8/f30fe84218790e6ffd25f987d434eb13.jpg";

const cardShadow = {
  shadowColor: "rgba(28, 45, 80, 0.10)",
  shadowOpacity: 1,
  shadowRadius: 16,
  shadowOffset: { width: 0, height: 8 },
  elevation: 5,
} as const;

function formatDate(value?: string | null) {
  if (!value) return "Chưa bắt đầu";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return new Intl.DateTimeFormat("vi-VN", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  }).format(date);
}

function statusLabel(status: UserPlan["status"]) {
  if (status === "STARTED") return "Đang thực hiện";
  if (status === "READY") return "Sẵn sàng";
  if (status === "COMPLETED") return "Hoàn thành";
  return "Bản nháp";
}

function statusStyle(status: UserPlan["status"]) {
  if (status === "STARTED") return { backgroundColor: "#FFF0F7", color: "#D93682" };
  if (status === "READY" || status === "COMPLETED") return { backgroundColor: "#ECFDF3", color: "#027A48" };
  return { backgroundColor: "#F4EFFF", color: "#7658CF" };
}

function getHotspotImage(hotspot: PlannerHotspot) {
  const media = hotspot.medias?.find((item) => {
    const kind = `${item.mediaType ?? ""} ${item.mimeType ?? ""}`.toLowerCase();
    return kind.includes("image");
  }) ?? hotspot.medias?.[0];
  return media?.fileUrl || fallbackImage;
}

function resolvePlanHotspotHref(hotspot: PlannerHotspot): Href {
  const matchedHotspot = findMatchingHotspotByNameOrCoordinate({
    hotspotName: hotspot.hotspotName ?? "",
    latitude: Number(hotspot.latitude ?? 0),
    longitude: Number(hotspot.longitude ?? 0),
  });

  if (matchedHotspot) {
    return getHotspotHref(matchedHotspot.slug, hotspot.hotspotId);
  }

  return (
    getHotspotDetailHref(String(hotspot.hotspotId)) ??
    getHotspotHref(
      getApiHotspotRouteSlug(hotspot.hotspotId),
      hotspot.hotspotId,
    )
  );
}

export default function UserPlanDetailScreen() {
  const router = useRouter();
  const params = useLocalSearchParams<{ id?: string | string[] }>();
  const session = useAuthSession();
  const planId = Number(Array.isArray(params.id) ? params.id[0] : params.id);

  const [plan, setPlan] = useState<UserPlan | null>(null);
  const [loading, setLoading] = useState(true);
  const [starting, setStarting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [routeCoordinates, setRouteCoordinates] = useState<
    { latitude: number; longitude: number }[]
  >([]);

  const orderedStops = useMemo(
    () => [...(plan?.stops ?? [])].sort((a, b) => a.stopIndex - b.stopIndex),
    [plan?.stops],
  );

  const mapPoints = useMemo<AppMapPoint[]>(() => {
    if (!plan) return [];
    const points: AppMapPoint[] = [];
    if (
      typeof plan.startLatitude === "number" &&
      typeof plan.startLongitude === "number"
    ) {
      points.push({
        id: "start",
        title: "Điểm xuất phát",
        description: "Vị trí bắt đầu kế hoạch",
        latitude: plan.startLatitude,
        longitude: plan.startLongitude,
      });
    }
    orderedStops.forEach((item) => {
      points.push({
        id: item.hotspot.hotspotId,
        title: `${item.stopIndex}. ${item.hotspot.hotspotName}`,
        description: item.isCheckedIn ? "Đã check-in" : item.hotspot.address,
        latitude: item.hotspot.latitude,
        longitude: item.hotspot.longitude,
      });
    });
    return points;
  }, [orderedStops, plan]);

  const loadPlan = useCallback(async () => {
    if (!Number.isFinite(planId) || planId <= 0) {
      setError("Mã kế hoạch không hợp lệ.");
      setLoading(false);
      return;
    }

    try {
      setLoading(true);
      setError(null);
      const accessToken = await getValidAccessToken();
      if (!accessToken) throw new Error("Bạn cần đăng nhập để xem kế hoạch.");
      const result = await getUserPlan(
        { accessToken, tokenType: session.tokenType },
        planId,
      );
      setPlan(result);
    } catch (caught) {
      setPlan(null);
      setError(
        caught instanceof Error
          ? caught.message
          : "Không thể tải chi tiết kế hoạch.",
      );
    } finally {
      setLoading(false);
    }
  }, [planId, session.tokenType]);

  useFocusEffect(
    useCallback(() => {
      void loadPlan();
    }, [loadPlan]),
  );

  useEffect(() => {
    let cancelled = false;
    async function loadDirections() {
      if (mapPoints.length < 2) {
        setRouteCoordinates(
          mapPoints.map(({ latitude, longitude }) => ({ latitude, longitude })),
        );
        return;
      }
      try {
        const coordinates = await getMultiStopRouteCoordinates(
          mapPoints.map(({ latitude, longitude }) => ({ latitude, longitude })),
        );
        if (!cancelled) setRouteCoordinates(coordinates);
      } catch {
        if (!cancelled) {
          setRouteCoordinates(
            mapPoints.map(({ latitude, longitude }) => ({ latitude, longitude })),
          );
        }
      }
    }
    void loadDirections();
    return () => {
      cancelled = true;
    };
  }, [mapPoints]);

  const nextUncheckedStop = useMemo(
    () => orderedStops.find((item) => !item.isCheckedIn),
    [orderedStops],
  );

  const continueHref = nextUncheckedStop
    ? resolvePlanHotspotHref(nextUncheckedStop.hotspot)
    : undefined;

  async function handleContinuePlan() {
    if (!plan || !continueHref || starting) return;

    try {
      setStarting(true);

      if (plan.status !== "STARTED") {
        const accessToken = await getValidAccessToken();
        if (!accessToken) {
          throw new Error("Bạn cần đăng nhập để bắt đầu kế hoạch.");
        }

        const updated = await startUserPlan(
          { accessToken, tokenType: session.tokenType },
          plan.userPlanId,
        );
        setPlan(updated);
      }

      router.push(continueHref);
    } catch (caught) {
      routeSystemAlert.alert(
        "Không thể tiếp tục hành trình",
        caught instanceof Error ? caught.message : "Vui lòng thử lại.",
      );
    } finally {
      setStarting(false);
    }
  }

  function openNavigation() {
    if (!plan || orderedStops.length === 0) return;
    const coordinates = [
      ...(typeof plan.startLatitude === "number" &&
        typeof plan.startLongitude === "number"
        ? [{ latitude: plan.startLatitude, longitude: plan.startLongitude }]
        : []),
      ...orderedStops.map((item) => ({
        latitude: item.hotspot.latitude,
        longitude: item.hotspot.longitude,
      })),
    ];
    void openGoogleMapsMultiStopRoute({ points: coordinates, travelMode: "driving" });
  }

  if (loading) {
    return (
      <SafeAreaView className="flex-1 items-center justify-center bg-[#FAF8FC]">
        <ActivityIndicator size="large" color="#EB489B" />
      </SafeAreaView>
    );
  }

  if (!plan || error) {
    return (
      <SafeAreaView className="flex-1 bg-[#FAF8FC] px-5">
        <Pressable className="mt-3 h-11 w-11 items-center justify-center rounded-full bg-white" onPress={() => router.back()} style={cardShadow}>
          <SymbolView name="chevron.left" size={22} tintColor="#2B2233" />
        </Pressable>
        <View className="flex-1 items-center justify-center px-6">
          <SymbolView name="info.circle" size={48} tintColor="#EB489B" />
          <Text className="mt-4 text-center text-[18px] font-black text-[#2B2233]">
            Không thể mở kế hoạch
          </Text>
          <Text className="mt-2 text-center text-[13px] leading-5 text-[#7A7182]">
            {error || "Không tìm thấy dữ liệu kế hoạch."}
          </Text>
          <Pressable className="mt-5 rounded-2xl bg-[#EB489B] px-6 py-3" onPress={() => void loadPlan()}>
            <Text className="font-extrabold text-white">Thử lại</Text>
          </Pressable>
        </View>
      </SafeAreaView>
    );
  }

  const progress = Math.min(Math.max(plan.progressPercentage || 0, 0), 100);
  const badge = statusStyle(plan.status);

  return (
    <SafeAreaView className="flex-1 bg-[#FAF8FC]" edges={["top"]}>
      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={{ paddingBottom: 130 }}>
        <View className="px-4 pt-2">
          <View className="mb-3 flex-row items-center justify-between">
            <Pressable className="h-11 w-11 items-center justify-center rounded-full bg-white" onPress={() => router.back()} style={cardShadow}>
              <SymbolView name="chevron.left" size={22} tintColor="#2B2233" />
            </Pressable>
            <Text className="text-[17px] font-black text-[#2B2233]">Chi tiết kế hoạch</Text>
            <Pressable className="h-11 w-11 items-center justify-center rounded-full bg-white" onPress={() => void loadPlan()} style={cardShadow}>
              <SymbolView name="clock.arrow.circlepath" size={20} tintColor="#7658CF" />
            </Pressable>
          </View>

          <View className="overflow-hidden rounded-[30px] bg-white" style={cardShadow}>
            <AppMap
              points={mapPoints}
              routeCoordinates={routeCoordinates}
              height={300}
              showsUserLocation
            />
            <LinearGradient
              colors={["#FFFFFF", "#FFF8FC"]}
              className="p-5"
            >
              <View className="flex-row items-start justify-between gap-3">
                <View className="flex-1">
                  <Text className="text-[24px] font-black leading-8 text-[#2B2233]">
                    {plan.name}
                  </Text>
                  <Text className="mt-2 text-[13px] leading-5 text-[#756D7D]">
                    {plan.description || "Kế hoạch hành trình cá nhân"}
                  </Text>
                </View>
                <View className="rounded-full px-3 py-2" style={{ backgroundColor: badge.backgroundColor }}>
                  <Text className="text-[11px] font-extrabold" style={{ color: badge.color }}>
                    {statusLabel(plan.status)}
                  </Text>
                </View>
              </View>

              <View className="mt-5 flex-row gap-3">
                <View className="flex-1 rounded-2xl bg-[#F7F3FA] p-3">
                  <Text className="text-[11px] font-bold text-[#8E869A]">Tiến độ</Text>
                  <Text className="mt-1 text-[18px] font-black text-[#EB489B]">{Math.round(progress)}%</Text>
                </View>
                <View className="flex-1 rounded-2xl bg-[#F7F3FA] p-3">
                  <Text className="text-[11px] font-bold text-[#8E869A]">Điểm đã đi</Text>
                  <Text className="mt-1 text-[18px] font-black text-[#2B2233]">{plan.completedStops}/{plan.totalStops}</Text>
                </View>
                <View className="flex-1 rounded-2xl bg-[#F7F3FA] p-3">
                  <Text className="text-[11px] font-bold text-[#8E869A]">Tối ưu</Text>
                  <Text className="mt-1 text-[18px] font-black text-[#7658CF]">{plan.isOptimized ? "Có" : "Không"}</Text>
                </View>
              </View>

              <View className="mt-4 h-2 overflow-hidden rounded-full bg-[#ECE7F0]">
                <LinearGradient
                  colors={["#7C5CFC", "#EB489B", "#F58752"]}
                  start={{ x: 0, y: 0.5 }}
                  end={{ x: 1, y: 0.5 }}
                  style={{ height: "100%", width: `${progress}%`, borderRadius: 999 }}
                />
              </View>

              <View className="mt-4 flex-row flex-wrap gap-2">
                <View className="flex-row items-center gap-2 rounded-full bg-[#F7F3FA] px-3 py-2">
                  <SymbolView name="clock" size={15} tintColor="#7658CF" />
                  <Text className="text-[11px] font-bold text-[#675E70]">Bắt đầu: {formatDate(plan.startedAt)}</Text>
                </View>
                <View className="flex-row items-center gap-2 rounded-full bg-[#F7F3FA] px-3 py-2">
                  <SymbolView name="location.fill" size={15} tintColor="#EB489B" />
                  <Text className="text-[11px] font-bold text-[#675E70]">{plan.totalStops} hotspot</Text>
                </View>
              </View>
            </LinearGradient>
          </View>

          <View className="mt-5 rounded-[28px] bg-white p-4" style={cardShadow}>
            <View className="flex-row items-center justify-between">
              <View className="flex-1 pr-3">
                <Text className="text-[18px] font-black text-[#2B2233]">
                  Lộ trình của bạn
                </Text>

                <Text
                  numberOfLines={2}
                  className="mt-1 text-[12px] text-[#8E869A]"
                >
                  Các điểm được sắp xếp theo thứ tự kế hoạch
                </Text>
              </View>

              <Pressable
                onPress={openNavigation}
                className="flex-row items-center rounded-full bg-[#FFF0F7] px-3 py-2"
              >
                <SymbolView
                  name="map.fill"
                  size={14}
                  tintColor="#EB489B"
                />

                <Text className="ml-1 text-[11px] font-bold text-[#D93682]">
                  Chỉ đường
                </Text>
              </Pressable>
            </View>

            <View className="mt-4 gap-3">
              {orderedStops.map((item, index) => {
                const hotspot = item.hotspot;
                const href = resolvePlanHotspotHref(hotspot);
                return (
                  <Pressable
                    key={item.planHotspotId}
                    className="overflow-hidden rounded-3xl border border-[#EEE8F2] bg-white"
                    onPress={() => router.push(href)}
                  >
                    <View className="flex-row p-3">
                      <View className="relative">
                        <Image
                          source={{ uri: getHotspotImage(hotspot) }}
                          style={{ width: 94, height: 94, borderRadius: 20 }}
                          contentFit="cover"
                        />
                        <View className={`absolute -left-1 -top-1 h-8 w-8 items-center justify-center rounded-full border-2 border-white ${item.isCheckedIn ? "bg-[#12B76A]" : "bg-[#EB489B]"}`}>
                          <Text className="text-[12px] font-black text-white">{item.isCheckedIn ? "✓" : item.stopIndex}</Text>
                        </View>
                      </View>
                      <View className="ml-3 flex-1">
                        <View className="flex-row items-start justify-between gap-2">
                          <Text className="flex-1 text-[15px] font-black text-[#2B2233]" numberOfLines={2}>
                            {hotspot.hotspotName}
                          </Text>
                          <SymbolView name="chevron.right" size={17} tintColor="#A69EAD" />
                        </View>
                        <Text className="mt-1 text-[11px] leading-4 text-[#817887]" numberOfLines={2}>
                          {hotspot.address}
                        </Text>
                        <View className="mt-2 flex-row flex-wrap gap-2">
                          <View className={`rounded-full px-2.5 py-1 ${item.isCheckedIn ? "bg-[#ECFDF3]" : "bg-[#F4EFFF]"}`}>
                            <Text className={`text-[10px] font-extrabold ${item.isCheckedIn ? "text-[#027A48]" : "text-[#7658CF]"}`}>
                              {item.isCheckedIn ? "Đã check-in" : `Điểm ${index + 1}`}
                            </Text>
                          </View>
                          {typeof hotspot.estimatedDurationMin === "number" ? (
                            <View className="rounded-full bg-[#FFF7ED] px-2.5 py-1">
                              <Text className="text-[10px] font-extrabold text-[#C45A16]">
                                {hotspot.estimatedDurationMin}-{hotspot.estimatedDurationMax ?? hotspot.estimatedDurationMin} phút
                              </Text>
                            </View>
                          ) : null}
                        </View>
                      </View>
                    </View>
                  </Pressable>
                );
              })}
            </View>
          </View>
        </View>
      </ScrollView>

      <View className="absolute inset-x-0 bottom-0 border-t border-[#EEE7F0] bg-white px-4 pb-7 pt-3">
        <View className="flex-row gap-3">
          <Pressable className="h-14 w-14 items-center justify-center rounded-2xl border border-[#E9E1ED] bg-white" onPress={openNavigation}>
            <SymbolView name="map.fill" size={23} tintColor="#7658CF" />
          </Pressable>
          <Pressable
            className={`flex-1 overflow-hidden rounded-2xl ${starting || !continueHref ? "opacity-70" : ""}`}
            disabled={starting || !continueHref}
            onPress={handleContinuePlan}
          >
            <LinearGradient
              colors={["#7C5CFC", "#EB489B", "#F58752"]}
              start={{ x: 0, y: 0.5 }}
              end={{ x: 1, y: 0.5 }}
              className="h-14 flex-row items-center justify-center gap-2"
            >
              {starting ? (
                <ActivityIndicator color="#FFFFFF" />
              ) : (
                <SymbolView
                  name={plan.status === "STARTED" ? "location.fill" : "play.fill"}
                  size={20}
                  tintColor="#FFFFFF"
                />
              )}
              <Text className="text-[14px] font-black text-white">
                {starting
                  ? "Đang bắt đầu..."
                  : !continueHref
                    ? "Đã hoàn thành hành trình"
                    : plan.status === "STARTED"
                      ? "Tiếp tục hành trình"
                      : "Bắt đầu kế hoạch"}
              </Text>
            </LinearGradient>
          </Pressable>
        </View>
      </View>
    </SafeAreaView>
  );
}
