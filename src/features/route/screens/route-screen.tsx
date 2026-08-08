import {
  activeRouteState,
  currentUser,
  leaderboard,
  type RouteItem,
  routes
} from "@/lib/demo-data";
import { Image } from "expo-image";
import { LinearGradient } from "expo-linear-gradient";
import { type Href, useFocusEffect, useRouter } from "expo-router";
import { SymbolView } from "expo-symbols";
import {
  type ComponentProps,
  useCallback,
  useEffect,
  useMemo,
  useState
} from "react";
import {
  Modal,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

import { routeSystemAlert } from "@/features/route/components/route-system-alert";

import {
  getValidAccessToken,
  useAuthSession,
} from "@/features/auth/hooks/use-auth-session";
import {
  getMyRecordJourneys,
  type RecordRouteDto,
} from "@/features/route/api/record-route-api";
import {
  abandonRouteProgress,
  getRouteById,
  getRoutes,
  getSavedRoutes,
  getUserRouteProgressList,
  mapRouteToRouteItem,
  type RouteDto,
  unSaveRoute,
  type UserRouteProgressDto,
} from "@/features/route/api/route-api";
import { getMyUserPlans, type UserPlan } from "@/features/route/api/user-plan-api";
import {
  myRouteGroupsDemo,
  type RouteGroupDemo,
} from "@/features/route/data/route-group-demo";
import { usePremiumStatus } from "@/features/profile/hooks/use-premium-status";

type Tab =
  | "official"
  | "active"
  | "groups"
  | "completed"
  | "bookmarked"
  | "plans"
  | "journeys"
  | "community";
type RouteVariant =
  "official" | "active" | "completed" | "bookmarked" | "community";

type SymbolName = ComponentProps<typeof SymbolView>["name"];

type SavedRouteItem = RouteItem & { savedRouteId: number };

type SavedRouteApiRecord = {
  savedRouteId?: number | string | null;
  id?: number | string | null;
  routeId?: number | string | null;
  route?: RouteDto | null;
  routeResponse?: RouteDto | null;
  savedRoute?: RouteDto | null;
  savedAt?: string | null;
};

function getSavedRouteId(record: SavedRouteApiRecord) {
  const value = record.savedRouteId ?? record.id;
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : null;
}

function getSavedRouteDto(
  record: SavedRouteApiRecord,
  routeLookup: Record<string, RouteDto>,
) {
  const nestedRoute = record.route ?? record.routeResponse ?? record.savedRoute;
  if (nestedRoute?.routeId) return nestedRoute;

  const routeId = Number(record.routeId);
  if (!Number.isFinite(routeId)) return null;

  return routeLookup[String(routeId)] ?? null;
}

function mapSavedRoutesToItems(
  records: unknown,
  routeLookup: Record<string, RouteDto>,
): SavedRouteItem[] {
  if (!Array.isArray(records)) return [];

  return records.flatMap((rawRecord) => {
    if (!rawRecord || typeof rawRecord !== "object") return [];

    const record = rawRecord as SavedRouteApiRecord;
    const savedRouteId = getSavedRouteId(record);
    const route = getSavedRouteDto(record, routeLookup);

    if (savedRouteId === null || !route) return [];

    return [
      {
        ...mapRouteToRouteItem(route),
        savedRouteId,
      },
    ];
  });
}

const sunsetColors = ["#EB489B", "#F58752", "#FFC93C"] as const;

const cardShadowStyle = {
  shadowColor: "rgba(28, 45, 80, 0.12)",
  shadowOpacity: 1,
  shadowRadius: 14,
  shadowOffset: { width: 0, height: 8 },
  elevation: 6,
} as const;

const TAB_ITEMS: { key: Tab; label: string }[] = [
  { key: "official", label: "Chính thức" },
  { key: "active", label: "Đang đi" },
  { key: "groups", label: "Nhóm của tôi" },
  { key: "completed", label: "Đã xong" },
  { key: "bookmarked", label: "Đã lưu" },
  { key: "plans", label: "Kế hoạch" },
  { key: "journeys", label: "Hành trình của tôi" },
  { key: "community", label: "Cộng đồng" },
];

function XPBar({
  value,
  max,
  trackColor = "rgba(255,255,255,0.2)",
  height = 8,
}: {
  value: number;
  max: number;
  trackColor?: string;
  height?: number;
}) {
  const percent = Math.min(Math.max((value / max) * 100, 0), 100);

  return (
    <View
      style={{
        backgroundColor: trackColor,
        borderRadius: 999,
        height,
        overflow: "hidden",
      }}
    >
      <LinearGradient
        colors={["#FFE566", "#FFB400"]}
        start={{ x: 0, y: 0.5 }}
        end={{ x: 1, y: 0.5 }}
        style={{ borderRadius: 999, height: "100%", width: `${percent}%` }}
      />
    </View>
  );
}

function normalizeProgressStatus(status?: string | null) {
  return (status ?? "").trim().toUpperCase();
}

function isRouteProgressActive(progress: UserRouteProgressDto) {
  return normalizeProgressStatus(progress.status) === "IN_PROGRESS";
}

function isRouteProgressCompleted(progress: UserRouteProgressDto) {
  return normalizeProgressStatus(progress.status) === "COMPLETED";
}

function makeFallbackRouteItemFromProgress(
  progress: UserRouteProgressDto,
): RouteItem {
  return {
    connection:
      "Bạn đang thực hiện tuyến này. Nhấn tiếp tục để mở chi tiết hành trình.",
    cover:
      "https://i.pinimg.com/1200x/80/69/f9/8069f9581583a196f9f39bda000b9312.jpg",
    difficulty: "Đang đi",
    distance: `${progress.completedStops}/${progress.totalStops || "?"} điểm`,
    duration: progress.startedAt
      ? `Bắt đầu ${new Date(progress.startedAt).toLocaleDateString("vi-VN")}`
      : "Đang thực hiện",
    era: "Đang đi",
    hotspotIds: progress.hotspotProgressList.map((item) =>
      String(item.hotspotId),
    ),
    id: String(progress.routeId),
    meaning: "Tiến độ được lấy từ /api/v1/user-route-progress.",
    rating: 4.8,
    story: "Tiếp tục check-in các địa điểm còn lại để hoàn thành tuyến.",
    subtitle: `${Math.round(progress.progressPercentage || 0)}% hoàn thành`,
    theme: "User Route Progress",
    title: progress.route?.routeName || `Tuyến #${progress.routeId}`,
    xp: progress.route?.xp || progress.route?.point || 0,
  };
}

function mapProgressToRouteItem(
  progress: UserRouteProgressDto,
  routeLookup: Record<string, RouteDto>,
) {
  const route = progress.route ?? routeLookup[String(progress.routeId)];
  return route
    ? mapRouteToRouteItem(route)
    : makeFallbackRouteItemFromProgress(progress);
}

export default function RouteScreen() {
  const [tab, setTab] = useState<Tab>("official");
  const [showLeaderboard, setShowLeaderboard] = useState(false);
  const session = useAuthSession();
  const [officialRoutes, setOfficialRoutes] = useState<RouteItem[]>([]);
  const [isLoadingRoutes, setIsLoadingRoutes] = useState(true);
  const [routeError, setRouteError] = useState<string | null>(null);
  const [activeRoutesFromApi, setActiveRoutesFromApi] = useState<RouteItem[]>(
    [],
  );
  const [activeRouteProgresses, setActiveRouteProgresses] = useState<
    UserRouteProgressDto[]
  >([]);
  const [completedRoutesFromApi, setCompletedRoutesFromApi] = useState<
    RouteItem[]
  >([]);
  const [savedRoutesFromApi, setSavedRoutesFromApi] = useState<SavedRouteItem[]>([]);
  const [removingSavedRouteId, setRemovingSavedRouteId] = useState<number | null>(null);
  const [abandoningProgressId, setAbandoningProgressId] = useState<
    number | null
  >(null);
  const [myPlans, setMyPlans] = useState<UserPlan[]>([]);
  const [planError, setPlanError] = useState<string | null>(null);
  const [myRecordJourneys, setMyRecordJourneys] = useState<RecordRouteDto[]>([]);
  const [communityRoutesFromApi, setCommunityRoutesFromApi] = useState<RouteItem[]>([]);
  const { ensureLoaded: ensurePremiumLoaded } = usePremiumStatus();

  // Màn này có nhiều nút gọi `requirePremium()`. Nếu store isPremium chưa được
  // nạp (VD user mở thẳng tab Tuyến sau khi khởi động, chưa qua Home/Explore)
  // thì mặc định là false -> user Premium thật sẽ bị chặn oan. Nạp sẵn ở đây.
  useEffect(() => {
    void ensurePremiumLoaded();
  }, [ensurePremiumLoaded]);

  useFocusEffect(
    useCallback(() => {
      let cancelled = false;

      async function loadRoutes() {
        setIsLoadingRoutes(true);
        setRouteError(null);

        try {
          const accessToken = await getValidAccessToken();

          const [officialResult, progressResult, savedResult, plansResult, journeysResult, communityResult] =
            await Promise.allSettled([
              getRoutes({
                accessToken,
                page: 0,
                size: 50,
                status: "PUBLISHED",
                type: "OFFICIAL",
                tokenType: session.tokenType,
              }),
              accessToken
                ? getUserRouteProgressList({
                    accessToken,
                    page: 0,
                    size: 50,
                    sortBy: "startedAt",
                    sortDirection: "DESC",
                    tokenType: session.tokenType,
                  })
                : Promise.resolve({
                    content: [],
                    number: 0,
                    size: 0,
                    totalElements: 0,
                    totalPages: 0,
                  }),
              accessToken
                ? getSavedRoutes({ accessToken, tokenType: session.tokenType })
                : Promise.resolve([]),
              accessToken
                ? getMyUserPlans({ accessToken, tokenType: session.tokenType })
                : Promise.resolve([]),
              accessToken
                ? getMyRecordJourneys({ accessToken, tokenType: session.tokenType })
                : Promise.resolve([]),
              getRoutes({
                accessToken,
                page: 0,
                size: 30,
                status: "PUBLISHED",
                type: "CUSTOM",
                tokenType: session.tokenType,
              }),
            ]);

          if (cancelled) return;

          const routeDtos =
            officialResult.status === "fulfilled"
              ? officialResult.value.content
              : [];
          const routeLookup = routeDtos.reduce<Record<string, RouteDto>>(
            (accumulator, route) => {
              accumulator[String(route.routeId)] = route;
              return accumulator;
            },
            {},
          );
          const progresses =
            progressResult.status === "fulfilled"
              ? progressResult.value.content
              : [];
          const activeProgresses = progresses.filter(isRouteProgressActive);
          const completedProgresses = progresses.filter(isRouteProgressCompleted);

          setOfficialRoutes(routeDtos.map(mapRouteToRouteItem));
          setActiveRouteProgresses(activeProgresses);
          setActiveRoutesFromApi(
            activeProgresses.map((progress) =>
              mapProgressToRouteItem(progress, routeLookup),
            ),
          );
          setCompletedRoutesFromApi(
            completedProgresses.map((progress) =>
              mapProgressToRouteItem(progress, routeLookup),
            ),
          );
          if (savedResult.status === "fulfilled") {
            const savedRecords = Array.isArray(savedResult.value)
              ? (savedResult.value as SavedRouteApiRecord[])
              : [];

            // GET saved routes chỉ trả savedRouteId + routeId, nên lấy chi tiết
            // route theo routeId nếu route đó không có trong danh sách chính thức.
            const missingRouteIds = Array.from(
              new Set(
                savedRecords
                  .map((record) => Number(record.routeId))
                  .filter(
                    (routeId) =>
                      Number.isFinite(routeId) &&
                      !routeLookup[String(routeId)],
                  ),
              ),
            );

            const missingRouteResults = await Promise.allSettled(
              missingRouteIds.map((savedRouteId) =>
                getRouteById({
                  accessToken,
                  routeId: savedRouteId,
                  tokenType: session.tokenType,
                }),
              ),
            );

            missingRouteResults.forEach((result) => {
              if (result.status === "fulfilled") {
                routeLookup[String(result.value.routeId)] = result.value;
              } else {
                console.warn(
                  "[route-screen] load saved route detail failed",
                  result.reason,
                );
              }
            });

            const savedItems = mapSavedRoutesToItems(
              savedRecords,
              routeLookup,
            );

            console.log("[route-screen] saved routes loaded", {
              rawCount: savedRecords.length,
              mappedCount: savedItems.length,
              raw: savedRecords,
            });

            setSavedRoutesFromApi(savedItems);
          } else {
            console.warn(
              "[route-screen] get saved routes failed",
              savedResult.reason,
            );
            setSavedRoutesFromApi([]);
          }

          if (plansResult.status === "fulfilled") {
            setMyPlans(Array.isArray(plansResult.value) ? plansResult.value : []);
            setPlanError(null);
          } else {
            setMyPlans([]);
            setPlanError(
              plansResult.reason instanceof Error
                ? plansResult.reason.message
                : "Không thể tải kế hoạch cá nhân.",
            );
          }

          if (journeysResult.status === "fulfilled") {
            setMyRecordJourneys(
              Array.isArray(journeysResult.value) ? journeysResult.value : [],
            );
          } else {
            console.warn(
              "[route-screen] get record journeys failed",
              journeysResult.reason,
            );
            setMyRecordJourneys([]);
          }

          if (communityResult.status === "fulfilled") {
            setCommunityRoutesFromApi(
              communityResult.value.content.map(mapRouteToRouteItem),
            );
          } else {
            console.warn(
              "[route-screen] get community routes failed",
              communityResult.reason,
            );
            setCommunityRoutesFromApi([]);
          }

          if (officialResult.status === "rejected") {
            setRouteError(
              officialResult.reason instanceof Error
                ? officialResult.reason.message
                : "Không thể tải tuyến chính thức từ API.",
            );
          }
        } catch (error) {
          console.warn("[route-screen] load routes failed", error);

          if (!cancelled) {
            setOfficialRoutes(routes);
            setActiveRouteProgresses([]);
            setActiveRoutesFromApi([]);
            setSavedRoutesFromApi([]);
            setMyPlans([]);
            setMyRecordJourneys([]);
            setCommunityRoutesFromApi([]);
            setRouteError(
              error instanceof Error
                ? error.message
                : "Không thể tải tuyến từ API.",
            );
          }
        } finally {
          if (!cancelled) {
            setIsLoadingRoutes(false);
          }
        }
      }

      void loadRoutes();

      return () => {
        cancelled = true;
      };
    }, [session.tokenType]),
  );

  const activeList = useMemo(() => activeRoutesFromApi, [activeRoutesFromApi]);

  const activeProgressMap = useMemo(() => {
    return activeRouteProgresses.reduce<Record<string, number>>(
      (accumulator, progress) => {
        if (progress.routeId) {
          accumulator[String(progress.routeId)] = progress.progressPercentage;
        }
        return accumulator;
      },
      {},
    );
  }, [activeRouteProgresses]);

  const activeProgressByRouteId = useMemo(() => {
    return activeRouteProgresses.reduce<Record<string, UserRouteProgressDto>>(
      (accumulator, progress) => {
        if (progress.routeId) {
          accumulator[String(progress.routeId)] = progress;
        }
        return accumulator;
      },
      {},
    );
  }, [activeRouteProgresses]);

  async function handleAbandonRoute(progressId: number) {
    const targetProgress = activeRouteProgresses.find(
      (progress) => progress.userRouteProgressId === progressId,
    );
    const routeName = targetProgress?.route?.routeName || "tuyến này";

    routeSystemAlert.alert(
      "Xác nhận bỏ tuyến",
      `Bạn có chắc chắn muốn bỏ ${routeName}? Tiến độ hiện tại sẽ bị dừng lại.`,
      [
        { text: "Hủy", style: "cancel" },
        {
          text: "Bỏ tuyến",
          style: "destructive",
          onPress: async () => {
            setAbandoningProgressId(progressId);
            try {
              const accessToken = await getValidAccessToken();
              await abandonRouteProgress({
                accessToken,
                routeId: targetProgress?.routeId ?? progressId,
                tokenType: session.tokenType,
              });
              setActiveRouteProgresses((current) =>
                current.filter(
                  (progress) => progress.userRouteProgressId !== progressId,
                ),
              );
              setActiveRoutesFromApi((current) =>
                current.filter(
                  (route) =>
                    route.id !== String(targetProgress?.routeId ?? progressId),
                ),
              );
              routeSystemAlert.alert("Đã bỏ tuyến", "Tiến độ tuyến này đã được dừng.");
            } catch (error) {
              routeSystemAlert.alert(
                "Không thể bỏ tuyến",
                error instanceof Error
                  ? error.message
                  : "Vui lòng thử lại sau.",
              );
            } finally {
              setAbandoningProgressId(null);
            }
          },
        },
      ],
    );
  }
  async function handleUnsaveRoute(savedRouteId: number, routeName: string) {
    if (removingSavedRouteId !== null) return;

    routeSystemAlert.alert(
      "Bỏ lưu tuyến",
      `Bạn có chắc chắn muốn bỏ lưu ${routeName}?`,
      [
        { text: "Hủy", style: "cancel" },
        {
          text: "Bỏ lưu",
          style: "destructive",
          onPress: async () => {
            setRemovingSavedRouteId(savedRouteId);

            try {
              const accessToken = await getValidAccessToken();
              await unSaveRoute({
                accessToken,
                savedRouteId,
                tokenType: session.tokenType,
              });

              setSavedRoutesFromApi((current) =>
                current.filter(
                  (savedRoute) => savedRoute.savedRouteId !== savedRouteId,
                ),
              );
            } catch (error) {
              routeSystemAlert.alert(
                "Không thể bỏ lưu tuyến",
                error instanceof Error
                  ? error.message
                  : "Vui lòng thử lại sau.",
              );
            } finally {
              setRemovingSavedRouteId(null);
            }
          },
        },
      ],
    );
  }

  const completedList = useMemo(
    () => completedRoutesFromApi,
    [completedRoutesFromApi],
  );
  const savedList = useMemo(() => savedRoutesFromApi, [savedRoutesFromApi]);

  return (
    <SafeAreaView
      className="flex-1 bg-[#F7F8FC]"
      edges={["top", "left", "right"]}
    >
      <ScrollView
        className="flex-1"
        contentContainerStyle={{ paddingBottom: 24 }}
        nestedScrollEnabled
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator={false}
      >
        <LinearGradient
          colors={sunsetColors}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 1 }}
          className="rounded-b-[40px] px-4 pb-4 pt-3"
          style={cardShadowStyle}
        >
          <View className="flex-row items-center justify-between">
            <View>
              <Text className="text-[11px] font-bold uppercase tracking-wider text-white/80">
                Hành trình
              </Text>
              <Text className="text-[24px] font-extrabold text-white">
                Khám phá kế tiếp
              </Text>
            </View>

            <Pressable
              onPress={() => setShowLeaderboard(true)}
              className="flex-row items-center gap-2 rounded-2xl bg-black/20 px-3 py-2"
            >
              <SymbolView
                name={{
                  ios: "trophy.fill",
                  android: "emoji_events",
                  web: "emoji_events",
                }}
                size={14}
                tintColor="#FFE566"
              />
              <Text className="text-[14px] font-bold text-white">BXH</Text>
            </Pressable>
          </View>

          <View className="mt-3 rounded-2xl bg-black/20 p-3">
            <View className="mb-1.5 flex-row items-center justify-between">
              <Text className="text-[12px] font-bold text-white">
                Cấp {currentUser.level} · {currentUser.title}
              </Text>
              <Text className="text-[12px] text-white/80">
                {currentUser.xp} / {currentUser.xpToNext}
              </Text>
            </View>
            <XPBar value={currentUser.xp} max={currentUser.xpToNext} />
            <Text className="mt-1.5 text-[10px] text-white/75">
              Còn {currentUser.xpToNext - currentUser.xp} XP để lên cấp{" "}
              {currentUser.level + 1}
            </Text>
          </View>
        </LinearGradient>

        {activeRouteProgresses.length > 0 ? (
          <View className="px-4 pt-4">
            <ActiveProgressSummary
              progress={activeRouteProgresses[0]}
              onAbandonRoute={handleAbandonRoute}
              abandoningProgressId={abandoningProgressId}
            />
          </View>
        ) : null}

        <View className="px-4 pt-4">
          <ScrollView
            horizontal
            nestedScrollEnabled
            showsHorizontalScrollIndicator={false}
            contentContainerStyle={styles.tabRow}
          >
            {TAB_ITEMS.map((item) => {
              const selected = tab === item.key;
              return (
                <Pressable
                  key={item.key}
                  onPress={() => setTab(item.key)}
                  style={[
                    styles.tabButton,
                    selected && styles.tabButtonSelected,
                  ]}
                >
                  <Text
                    style={[
                      styles.tabLabel,
                      selected && styles.tabLabelSelected,
                    ]}
                  >
                    {item.label}
                  </Text>
                </Pressable>
              );
            })}
          </ScrollView>
        </View>

        <View key={tab} className="gap-3 px-4 pt-4">
          {tab === "official" &&
            (isLoadingRoutes ? (
              <EmptyState text="Đang tải tuyến từ API..." />
            ) : (
              <>
                {routeError ? (
                  <View className="rounded-2xl border border-[#FFE1E8] bg-[#FFF5F8] px-3 py-2">
                    <Text className="text-[11px] font-semibold text-[#B42345]">
                      {routeError} Đang hiển thị dữ liệu demo tạm thời.
                    </Text>
                  </View>
                ) : null}
                <RouteList
                  list={officialRoutes.length ? officialRoutes : routes}
                  variant="official"
                />
              </>
            ))}
          {tab === "active" &&
            (activeList.length ? (
              <RouteList
                list={activeList}
                variant="active"
                progress={activeRouteState.progress}
                progressMap={activeProgressMap}
                progressByRouteId={activeProgressByRouteId}
                onAbandonRoute={handleAbandonRoute}
                abandoningProgressId={abandoningProgressId}
              />
            ) : (
              <EmptyState text="Bạn chưa tham gia tuyến nào" />
            ))}
          {tab === "groups" && <MyGroupsTab groups={myRouteGroupsDemo} />}
          {tab === "completed" &&
            (completedList.length ? (
              <RouteList list={completedList} variant="completed" />
            ) : (
              <EmptyState text="Chưa hoàn thành tuyến nào" />
            ))}
          {tab === "bookmarked" &&
            (savedList.length ? (
              <RouteList
                list={savedList}
                variant="bookmarked"
                onUnsaveRoute={handleUnsaveRoute}
                removingSavedRouteId={removingSavedRouteId}
              />
            ) : (
              <EmptyState text="Bạn chưa lưu tuyến nào" />
            ))}
          {tab === "plans" && (
            <UserPlanTab plans={myPlans} error={planError} />
          )}
          {tab === "journeys" && (
            <MyJourneyTab journeys={myRecordJourneys} />
          )}
          {tab === "community" && (
            <CommunityTab
              routes={communityRoutesFromApi}
              isLoading={isLoadingRoutes}
            />
          )}
        </View>
      </ScrollView>

      {showLeaderboard && (
        <LeaderboardSheet onClose={() => setShowLeaderboard(false)} />
      )}
    </SafeAreaView>
  );
}

function ActiveProgressSummary({
  progress,
  onAbandonRoute,
  abandoningProgressId,
}: {
  progress: UserRouteProgressDto;
  onAbandonRoute: (progressId: number) => void;
  abandoningProgressId: number | null;
}) {
  const router = useRouter();
  const routeName = progress.route?.routeName || `Tuyến #${progress.routeId}`;
  const progressValue = Math.round(progress.progressPercentage || 0);
  const isAbandoning = abandoningProgressId === progress.userRouteProgressId;

  return (
    <View
      className="overflow-hidden rounded-3xl border border-[#F7C7D1] bg-white"
      style={cardShadowStyle}
    >
      <LinearGradient
        colors={["#FFF5F8", "#FFFFFF"]}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 1 }}
        className="p-4"
      >
        <View className="flex-row items-start justify-between gap-3">
          <View className="flex-1">
            <Text className="text-[11px] font-extrabold uppercase tracking-wider text-[#EB489B]">
              Đang thực hiện
            </Text>
            <Text
              className="mt-1 text-[18px] font-extrabold text-[#2B2233]"
              numberOfLines={2}
            >
              {routeName}
            </Text>
            <Text className="mt-1 text-[12px] text-[#8E869A]">
              {progress.completedStops}/{progress.totalStops} điểm ·{" "}
              {progressValue}% hoàn thành
            </Text>
          </View>

          <View className="rounded-2xl bg-[#FFF4EF] px-3 py-2">
            <Text className="text-[12px] font-extrabold text-[#F58752]">
              {progressValue}%
            </Text>
          </View>
        </View>

        <View className="mt-3">
          <XPBar
            value={progressValue}
            max={100}
            trackColor="#ECEEF4"
            height={8}
          />
        </View>

        <View className="mt-3 flex-row gap-2">
          <Pressable
            className="flex-1 rounded-2xl bg-[#F58752] py-3"
            onPress={() => router.push(`/route/${progress.routeId}` as Href)}
          >
            <Text className="text-center text-[13px] font-extrabold text-white">
              Tiếp tục hành trình
            </Text>
          </Pressable>

          <Pressable
            className={`rounded-2xl border border-[#F7C7D1] bg-white px-4 py-3 ${isAbandoning ? "opacity-70" : ""}`}
            onPress={() => onAbandonRoute(progress.userRouteProgressId)}
            disabled={isAbandoning}
          >
            <Text className="text-center text-[13px] font-extrabold text-[#B42345]">
              {isAbandoning ? "Đang bỏ..." : "Bỏ tuyến"}
            </Text>
          </Pressable>
        </View>
      </LinearGradient>
    </View>
  );
}

function UserPlanTab({ plans, error }: { plans: UserPlan[]; error: string | null }) {
  const router = useRouter();
  const { requirePremium } = usePremiumStatus();

  return (
    <View className="gap-3">
      <Pressable
        className="overflow-hidden rounded-3xl"
        onPress={() => {
          if (!requirePremium("Tạo kế hoạch hành trình (User Plan)")) return;
          router.push("/route/custom/plan" as Href);
        }}
      >
        <LinearGradient
          colors={["#7C5CFC", "#EB489B", "#F58752"]}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 1 }}
          className="p-4"
        >
          <Text className="text-[11px] font-bold uppercase tracking-wider text-white/80">
            Custom User Plan
          </Text>
          <Text className="mt-1 text-[18px] font-black text-white">
            Tạo kế hoạch hành trình mới
          </Text>
          <Text className="mt-1 text-[12px] text-white/90">
            Chọn địa điểm, tối ưu thứ tự và bắt đầu khi bạn sẵn sàng.
          </Text>
        </LinearGradient>
      </Pressable>

      {error ? (
        <View className="rounded-2xl border border-[#FFE1E8] bg-[#FFF5F8] px-4 py-3">
          <Text className="text-[12px] font-semibold text-[#B42345]">{error}</Text>
        </View>
      ) : null}

      {plans.length ? plans.map((plan) => {
        const progress = Math.round(plan.progressPercentage || 0);
        return (
          <View key={plan.userPlanId} className="rounded-3xl border border-[#ECE7F4] bg-white p-4" style={cardShadowStyle}>
            <View className="flex-row items-start justify-between gap-3">
              <View className="flex-1">
                <Text className="text-[16px] font-black text-[#2B2233]">{plan.name}</Text>
                <Text className="mt-1 text-[12px] text-[#8E869A]" numberOfLines={2}>
                  {plan.description || "Kế hoạch hành trình cá nhân"}
                </Text>
              </View>
              <View className="rounded-full bg-[#F4EFFF] px-3 py-1.5">
                <Text className="text-[10px] font-extrabold text-[#7658CF]">{plan.status}</Text>
              </View>
            </View>
            <View className="mt-3 flex-row justify-between">
              <Text className="text-[12px] font-semibold text-[#6E6177]">{plan.completedStops}/{plan.totalStops} điểm</Text>
              <Text className="text-[12px] font-extrabold text-[#EB489B]">{progress}%</Text>
            </View>
            <View className="mt-2"><XPBar value={progress} max={100} trackColor="#ECEEF4" height={7} /></View>
            <Pressable className="mt-3 rounded-2xl bg-[#EB489B] py-3" onPress={() => router.push(`/route/custom/plan/${plan.userPlanId}` as Href)}>
              <Text className="text-center text-[13px] font-extrabold text-white">
                {plan.status === "STARTED" ? "Tiếp tục kế hoạch" : "Xem chi tiết"}
              </Text>
            </Pressable>
          </View>
        );
      }) : (
        <EmptyState text="Bạn chưa có Custom User Plan nào" />
      )}
    </View>
  );
}


function MyJourneyTab({
  journeys,
}: {
  journeys: RecordRouteDto[];
}) {
  const router = useRouter();
  const { requirePremium } = usePremiumStatus();

  const grouped = useMemo(() => {
    const result: Record<string, RecordRouteDto[]> = {
      RECORDING: [],
      DRAFT: [],
      TRIAL: [],
      PUBLISHED: [],
      OTHER: [],
    };

    journeys.forEach((journey) => {
      const status = String(journey.status || "").trim().toUpperCase();
      if (status in result) result[status].push(journey);
      else result.OTHER.push(journey);
    });

    return result;
  }, [journeys]);

  const sections = [
    {
      key: "RECORDING",
      title: "Đang ghi",
      subtitle: "Hành trình đang được ghi nhận theo các lần check-in.",
      icon: { ios: "record.circle.fill", android: "fiber_manual_record", web: "fiber_manual_record" } as const,
      iconColor: "#F15B45",
      badgeClass: "bg-[#FFF0EC]",
      badgeTextClass: "text-[#C94733]",
    },
    {
      key: "DRAFT",
      title: "Bản nháp",
      subtitle: "Kiểm tra route và story trước khi gửi lên hệ thống.",
      icon: { ios: "doc.text.fill", android: "description", web: "description" } as const,
      iconColor: "#7C5CFC",
      badgeClass: "bg-[#F3F0FF]",
      badgeTextClass: "text-[#684BC7]",
    },
    {
      key: "TRIAL",
      title: "Đang chờ duyệt",
      subtitle: "Route đã submit và đang ở trạng thái TRIAL.",
      icon: { ios: "clock.fill", android: "schedule", web: "schedule" } as const,
      iconColor: "#F58752",
      badgeClass: "bg-[#FFF4EA]",
      badgeTextClass: "text-[#C85D27]",
    },
    {
      key: "PUBLISHED",
      title: "Đã xuất bản",
      subtitle: "Các hành trình đã được chia sẻ với cộng đồng.",
      icon: { ios: "globe.asia.australia.fill", android: "public", web: "public" } as const,
      iconColor: "#27A56B",
      badgeClass: "bg-[#EAF8F1]",
      badgeTextClass: "text-[#208657]",
    },
  ] as const;

  return (
    <View className="gap-4">
      <Pressable
        className="overflow-hidden rounded-3xl"
        onPress={() => {
          if (!requirePremium("Ghi hành trình cá nhân (Record Journey)")) return;
          router.push("/route/custom/record" as Href);
        }}
      >
        <LinearGradient
          colors={["#E84D6A", "#EB489B", "#F58752"]}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 1 }}
          className="p-4"
        >
          <View className="flex-row items-center gap-3">
            <View className="h-14 w-14 items-center justify-center rounded-2xl bg-black/20">
              <SymbolView
                name={{ ios: "record.circle", android: "fiber_manual_record", web: "fiber_manual_record" }}
                size={22}
                tintColor="#FFFFFF"
              />
            </View>
            <View className="flex-1">
              <Text className="text-[11px] font-bold uppercase tracking-wider text-white/85">
                Record Journey
              </Text>
              <Text className="mt-0.5 text-[18px] font-black text-white">
                Ghi hành trình mới
              </Text>
              <Text className="mt-1 text-[12px] leading-5 text-white/90">
                Lưu các địa điểm đã check-in và hoàn thiện hành trình của riêng bạn.
              </Text>
            </View>
            <View className="h-9 w-9 items-center justify-center rounded-full bg-white/20">
              <SymbolView
                name={{ ios: "chevron.right", android: "chevron_right", web: "chevron_right" }}
                size={16}
                tintColor="#FFFFFF"
              />
            </View>
          </View>
        </LinearGradient>
      </Pressable>

      {journeys.length === 0 ? (
        <EmptyState text="Bạn chưa ghi hành trình nào" />
      ) : null}

      {sections.map((section) => {
        const items = grouped[section.key];
        if (!items.length) return null;

        return (
          <View key={section.key} className="gap-2.5">
            <View className="flex-row items-center justify-between px-1">
              <View className="flex-1 flex-row items-center gap-2">
                <SymbolView name={section.icon} size={15} tintColor={section.iconColor} />
                <View className="flex-1">
                  <Text className="text-[15px] font-extrabold text-[#2B2233]">{section.title}</Text>
                  <Text className="mt-0.5 text-[10px] text-[#8E869A]">{section.subtitle}</Text>
                </View>
              </View>
              <View className={`rounded-full px-2.5 py-1 ${section.badgeClass}`}>
                <Text className={`text-[10px] font-extrabold ${section.badgeTextClass}`}>{items.length}</Text>
              </View>
            </View>

            {items.map((journey) => (
              <View
                key={journey.routeId}
                className="rounded-3xl border border-[#ECE7F4] bg-white p-4"
                style={cardShadowStyle}
              >
                <View className="flex-row items-start justify-between gap-3">
                  <View className="min-w-0 flex-1">
                    <Text className="text-[16px] font-black text-[#2B2233]" numberOfLines={2}>
                      {journey.routeName || `Hành trình #${journey.routeId}`}
                    </Text>
                    <Text className="mt-1 text-[12px] leading-5 text-[#8E869A]" numberOfLines={2}>
                      {journey.description || "Hành trình cá nhân được tạo từ các lần check-in của bạn."}
                    </Text>
                  </View>
                  <View className={`rounded-full px-3 py-1.5 ${section.badgeClass}`}>
                    <Text className={`text-[9px] font-extrabold ${section.badgeTextClass}`}>
                      {String(journey.status).toUpperCase()}
                    </Text>
                  </View>
                </View>

                <View className="mt-3 flex-row items-center gap-2">
                  <View className="flex-row items-center gap-1.5 rounded-full bg-[#F7F8FC] px-3 py-2">
                    <SymbolView
                      name={{ ios: "mappin.and.ellipse", android: "location_on", web: "location_on" }}
                      size={12}
                      tintColor="#EB489B"
                    />
                    <Text className="text-[11px] font-bold text-[#625A68]">
                      {(journey.hotspots ?? []).length} địa điểm
                    </Text>
                  </View>
                  <View className="rounded-full bg-[#F7F8FC] px-3 py-2">
                    <Text className="text-[11px] font-bold text-[#625A68]">Route #{journey.routeId}</Text>
                  </View>
                </View>

                <Pressable
                  className="mt-3 rounded-2xl bg-[#EB489B] py-3"
                  onPress={() => {
                    if (
                      section.key === "RECORDING" ||
                      section.key === "DRAFT"
                    ) {
                      if (!requirePremium("Ghi hành trình cá nhân (Record Journey)")) return;
                      router.push("/route/custom/record" as Href);
                      return;
                    }

                    router.push(`/route/${journey.routeId}` as Href);
                  }}
                >
                  <Text className="text-center text-[13px] font-extrabold text-white">
                    {section.key === "RECORDING"
                      ? "Tiếp tục ghi"
                      : section.key === "DRAFT"
                        ? "Xem và hoàn thiện"
                        : section.key === "TRIAL"
                          ? "Xem trạng thái"
                          : "Xem hành trình"}
                  </Text>
                </Pressable>
              </View>
            ))}
          </View>
        );
      })}

      {grouped.OTHER.length > 0 ? (
        <View className="gap-2.5">
          <Text className="px-1 text-[15px] font-extrabold text-[#2B2233]">Trạng thái khác</Text>
          {grouped.OTHER.map((journey) => (
            <View key={journey.routeId} className="rounded-3xl border border-[#ECE7F4] bg-white p-4" style={cardShadowStyle}>
              <Text className="text-[15px] font-black text-[#2B2233]">{journey.routeName || `Hành trình #${journey.routeId}`}</Text>
              <Text className="mt-1 text-[11px] text-[#8E869A]">{journey.status} · {(journey.hotspots ?? []).length} địa điểm</Text>
            </View>
          ))}
        </View>
      ) : null}
    </View>
  );
}

function getGroupStatusMeta(status: RouteGroupDemo["status"]) {
  switch (status) {
    case "LIVE":
      return {
        badgeClass: "bg-[#E9F8EF]",
        badgeTextClass: "text-[#1E8A55]",
        ctaLabel: "Xem nhóm",
        helper: "Nhóm đang đi thực tế trên tuyến này.",
        label: "Đang diễn ra",
      };
    case "SCHEDULED":
      return {
        badgeClass: "bg-[#EEF5FF]",
        badgeTextClass: "text-[#2563EB]",
        ctaLabel: "Mời thêm bạn",
        helper: "Đã chốt lịch, có thể mời thêm người đang follow.",
        label: "Đã lên lịch",
      };
    default:
      return {
        badgeClass: "bg-[#FFF4EF]",
        badgeTextClass: "text-[#C65A25]",
        ctaLabel: "Xác nhận lời mời",
        helper: "Có lời mời mới từ mạng lưới bạn đang theo dõi.",
        label: "Chờ phản hồi",
      };
  }
}

function GroupMemberAvatars({
  members,
}: {
  members: RouteGroupDemo["members"];
}) {
  const visibleMembers = members.slice(0, 4);
  const remainingCount = Math.max(members.length - visibleMembers.length, 0);

  return (
    <View className="flex-row items-center">
      {visibleMembers.map((member, index) => (
        <View
          key={member.id}
          className="rounded-full border-2 border-white bg-white"
          style={{ marginLeft: index === 0 ? 0 : -10 }}
        >
          <Image
            source={member.avatarUri}
            contentFit="cover"
            style={{ height: 30, width: 30, borderRadius: 999 }}
          />
        </View>
      ))}
      {remainingCount > 0 ? (
        <View
          className="ml-2 h-7 min-w-7 items-center justify-center rounded-full bg-[#F4EFF8] px-2"
        >
          <Text className="text-[10px] font-extrabold text-[#6B5A76]">
            +{remainingCount}
          </Text>
        </View>
      ) : null}
    </View>
  );
}

function MyGroupsTab({
  groups,
}: {
  groups: RouteGroupDemo[];
}) {
  if (groups.length === 0) {
    return <EmptyState text="Bạn chưa có group route nào" />;
  }

  return (
    <View className="gap-3">
      <LinearGradient
        colors={["#1F3B5D", "#35648F", "#F58752"]}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 1 }}
        className="overflow-hidden rounded-3xl p-4"
      >
        <Text className="text-[11px] font-bold uppercase tracking-wider text-white/80">
          Route Group
        </Text>
        <Text className="mt-1 text-[18px] font-black text-white">
          Đi tuyến cùng những người bạn đang follow
        </Text>
        <Text className="mt-1 text-[12px] leading-5 text-white/90">
          Gom lời mời, lịch hẹn và trạng thái nhóm vào một chỗ để bạn quản lý
          trước khi bắt đầu route.
        </Text>
        <View className="mt-4 flex-row gap-2">
          <View className="rounded-2xl bg-white/15 px-3 py-2">
            <Text className="text-[10px] font-bold uppercase tracking-wider text-white/75">
              Nhóm đang có
            </Text>
            <Text className="mt-1 text-[18px] font-black text-white">
              {groups.length}
            </Text>
          </View>
          <View className="rounded-2xl bg-white/15 px-3 py-2">
            <Text className="text-[10px] font-bold uppercase tracking-wider text-white/75">
              Mời chờ phản hồi
            </Text>
            <Text className="mt-1 text-[18px] font-black text-white">
              {
                groups.filter((group) => group.status === "INVITED").length
              }
            </Text>
          </View>
        </View>
      </LinearGradient>

      {groups.map((group) => {
        const meta = getGroupStatusMeta(group.status);
        const availableSeats = Math.max(group.capacity - group.members.length, 0);

        return (
          <View
            key={group.id}
            className="overflow-hidden rounded-3xl border border-[#E8EDF4] bg-white"
            style={cardShadowStyle}
          >
            <View className="flex-row items-stretch">
              <Image
                source={group.coverUri}
                contentFit="cover"
                style={{ height: 168, width: 118 }}
              />
              <View className="flex-1 p-4">
                <View className="flex-row items-start justify-between gap-3">
                  <View className="flex-1">
                    <Text className="text-[16px] font-black text-[#2B2233]" numberOfLines={2}>
                      {group.routeName}
                    </Text>
                    <Text className="mt-1 text-[12px] text-[#7A7283]" numberOfLines={2}>
                      Host: {group.host.name} · {group.host.role}
                    </Text>
                  </View>
                  <View className={`rounded-full px-3 py-1.5 ${meta.badgeClass}`}>
                    <Text className={`text-[10px] font-extrabold ${meta.badgeTextClass}`}>
                      {meta.label}
                    </Text>
                  </View>
                </View>

                <View className="mt-3 flex-row flex-wrap gap-2">
                  <View className="rounded-full bg-[#F7F8FC] px-3 py-1.5">
                    <Text className="text-[11px] font-semibold text-[#4B4452]">
                      {group.meetupAtLabel}
                    </Text>
                  </View>
                  <View className="rounded-full bg-[#F7F8FC] px-3 py-1.5">
                    <Text className="text-[11px] font-semibold text-[#4B4452]">
                      {group.durationLabel}
                    </Text>
                  </View>
                  <View className="rounded-full bg-[#F7F8FC] px-3 py-1.5">
                    <Text className="text-[11px] font-semibold text-[#4B4452]">
                      {group.members.length}/{group.capacity} thành viên
                    </Text>
                  </View>
                </View>

                <Text className="mt-3 text-[12px] font-semibold text-[#2B2233]">
                  {group.meetingPoint}
                </Text>
                <Text className="mt-1 text-[11px] leading-5 text-[#7A7283]">
                  {group.note}
                </Text>

                <View className="mt-3 flex-row items-center justify-between gap-3">
                  <GroupMemberAvatars members={group.members} />
                  <View className="items-end">
                    <Text className="text-[11px] font-extrabold text-[#EB489B]">
                      {group.vibeLabel}
                    </Text>
                    <Text className="mt-0.5 text-[10px] text-[#8E869A]">
                      {availableSeats > 0
                        ? `Còn ${availableSeats} chỗ để mời thêm`
                        : "Nhóm hiện đã đủ người"}
                    </Text>
                  </View>
                </View>

                <View className="mt-3 flex-row gap-2">
                  <Pressable
                    className="flex-1 rounded-2xl bg-[#EB489B] py-3"
                    onPress={() =>
                      routeSystemAlert.alert(
                        meta.label,
                        `${meta.helper}\n\nĐây là UI demo dùng dữ liệu giả để bạn duyệt flow group route.`,
                      )
                    }
                  >
                    <Text className="text-center text-[12px] font-extrabold text-white">
                      {meta.ctaLabel}
                    </Text>
                  </Pressable>
                  <Pressable
                    className="rounded-2xl border border-[#E6DFF1] bg-[#FBF9FE] px-4 py-3"
                    onPress={() =>
                      routeSystemAlert.alert(
                        "Chia sẻ nhóm",
                        `UI demo: chia sẻ lời mời ${group.visibility === "LINK" ? "bằng link" : "cho bạn đang follow"}.`,
                      )
                    }
                  >
                    <Text className="text-[12px] font-extrabold text-[#6B5A76]">
                      {group.visibility === "LINK" ? "Copy link" : "Mời bạn"}
                    </Text>
                  </Pressable>
                </View>
              </View>
            </View>
          </View>
        );
      })}
    </View>
  );
}

function CommunityTab({
  routes: communityRoutes,
  isLoading,
}: {
  routes: RouteItem[];
  isLoading: boolean;
}) {
  const top3 = communityRoutes.slice(0, 3);
  const rest = communityRoutes.slice(3);

  return (
    <View className="gap-5">
      <View className="rounded-3xl border border-[#F2DDE9] bg-[#FFF8FC] p-4">
        <Text className="text-[11px] font-bold uppercase tracking-wider text-[#EB489B]">Cộng đồng</Text>
        <Text className="mt-1 text-[17px] font-extrabold text-[#2B2233]">Khám phá hành trình đã xuất bản</Text>
        <Text className="mt-1 text-[12px] leading-5 text-[#777181]">
          Những route được cộng đồng chia sẻ sau khi hoàn tất quá trình xét duyệt.
        </Text>
      </View>

      {isLoading ? (
        <EmptyState text="Đang tải hành trình cộng đồng..." />
      ) : communityRoutes.length === 0 ? (
        <EmptyState text="Chưa có hành trình cộng đồng nào" />
      ) : (
        <>
          {top3.length > 0 && (
            <View>
              <View className="mb-2 flex-row items-center justify-between">
                <View className="flex-row items-center gap-1.5">
                  <SymbolView
                    name={{ ios: "trophy.fill", android: "emoji_events", web: "emoji_events" }}
                    size={14}
                    tintColor="#EB489B"
                  />
                  <Text className="text-[15px] font-extrabold text-[#2B2233]">
                    Tuyến được quan tâm nhiều nhất
                  </Text>
                </View>
              </View>
              <View className="gap-2">
                {top3.map((route, index) => (
                  <CommunityRankCard key={route.id} route={route} rank={index + 1} />
                ))}
              </View>
            </View>
          )}

          {rest.length > 0 && (
            <View>
              <View className="mb-2 flex-row items-center gap-1.5">
                <SymbolView
                  name={{ ios: "globe", android: "public", web: "public" }}
                  size={14}
                  tintColor="#F58752"
                />
                <Text className="text-[15px] font-extrabold text-[#2B2233]">
                  Tuyến từ cộng đồng
                </Text>
              </View>
              <View className="gap-2.5">
                {rest.map((route) => (
                  <CommunityJourneyCard key={route.id} route={route} />
                ))}
              </View>
            </View>
          )}
        </>
      )}
    </View>
  );
}

function GuideSection({
  step,
  title,
  description,
  bullets,
}: {
  step: string;
  title: string;
  description: string;
  bullets: string[];
}) {
  return (
    <View className="mb-3 rounded-3xl border border-[#E8EDF4] bg-[#FAFBFD] p-4">
      <View className="flex-row items-start gap-3">
        <View className="h-8 w-8 items-center justify-center rounded-xl bg-[#2B2233]">
          <Text className="text-[12px] font-extrabold text-white">{step}</Text>
        </View>
        <View className="flex-1">
          <Text className="text-[15px] font-extrabold text-[#2B2233]">{title}</Text>
          <Text className="mt-1 text-[11px] leading-5 text-[#777181]">{description}</Text>
          <View className="mt-2 gap-1.5">
            {bullets.map((bullet) => (
              <View key={bullet} className="flex-row items-start gap-2">
                <View className="mt-1.5 h-1.5 w-1.5 rounded-full bg-[#EB489B]" />
                <Text className="flex-1 text-[11px] leading-4 text-[#5F5965]">{bullet}</Text>
              </View>
            ))}
          </View>
        </View>
      </View>
    </View>
  );
}

function CommunityRankCard({
  route,
  rank,
}: {
  route: RouteItem;
  rank: number;
}) {
  const router = useRouter();
  const rankStyle =
    rank === 1
      ? "bg-[#F58752] text-white"
      : rank === 2
        ? "bg-[#E9F5FF] text-[#1F8FFF]"
        : "bg-[#FFF4EF] text-[#F58752]";

  return (
    <Pressable
      className="flex-row items-center gap-3 rounded-2xl border border-[#E8EDF4] bg-white p-2.5"
      style={cardShadowStyle}
      onPress={() => router.push(`/route/${route.id}` as Href)}
    >
      <View
        className={`h-8 w-8 items-center justify-center rounded-xl ${rankStyle}`}
      >
        <Text className="text-[12px] font-extrabold">#{rank}</Text>
      </View>
      <Image
        source={route.cover}
        contentFit="cover"
        style={{ height: 56, width: 56, borderRadius: 12 }}
      />
      <View className="min-w-0 flex-1">
        <Text
          className="text-[13px] font-extrabold leading-tight text-[#2B2233]"
          numberOfLines={1}
        >
          {route.title}
        </Text>
        <View className="mt-0.5 flex-row items-center gap-1.5">
          <SymbolView
            name={{ ios: "mappin.and.ellipse", android: "location_on", web: "location_on" }}
            size={10}
            tintColor="#8E869A"
          />
          <Text className="text-[11px] text-[#8E869A]">
            {route.hotspotIds.length} điểm · {route.distance}
          </Text>
        </View>
        <View className="mt-0.5 flex-row items-center gap-1">
          <SymbolView
            name={{ ios: "star.fill", android: "star", web: "star" }}
            size={9}
            tintColor="#FFB400"
          />
          <Text className="text-[10px] text-[#8E869A]">{route.rating}</Text>
          <Text className="text-[10px] text-[#8E869A]">· +{route.xp} XP</Text>
        </View>
      </View>
    </Pressable>
  );
}

function CommunityJourneyCard({ route }: { route: RouteItem }) {
  const router = useRouter();
  return (
    <Pressable
      className="overflow-hidden rounded-3xl border border-[#E8EDF4] bg-white"
      style={cardShadowStyle}
      onPress={() => router.push(`/route/${route.id}` as Href)}
    >
      <View style={styles.cardImageWrap}>
        <Image
          source={route.cover}
          contentFit="cover"
          style={styles.cardImage}
        />
        <LinearGradient
          colors={["transparent", "rgba(0,0,0,0.8)"]}
          pointerEvents="none"
          style={StyleSheet.absoluteFill}
        />
        <View className="absolute bottom-2 left-2 right-2">
          <Text
            className="text-[14px] font-extrabold leading-tight text-white"
            numberOfLines={1}
          >
            {route.title}
          </Text>
          <Text className="text-[10px] text-white/90">
            {route.distance} · {route.duration} ·{" "}
            {route.hotspotIds.length} điểm
          </Text>
        </View>
      </View>

      <View className="flex-row items-center gap-2 p-2.5">
        <Text
          className="flex-1 text-[11px] font-semibold text-[#2B2233]"
          numberOfLines={1}
        >
          {route.era}
        </Text>
        <View className="flex-row items-center gap-1">
          <SymbolView
            name={{ ios: "star.fill", android: "star", web: "star" }}
            size={10}
            tintColor="#FFB400"
          />
          <Text className="text-[11px] text-[#8E869A]">
            {route.rating}
          </Text>
        </View>
        <View className="rounded-full bg-[#FFF4EF] px-2 py-0.5">
          <Text className="text-[11px] font-bold text-[#F58752]">+{route.xp} XP</Text>
        </View>
      </View>
    </Pressable>
  );
}

function RouteList({
  list,
  variant,
  progress,
  progressMap,
  progressByRouteId,
  onAbandonRoute,
  abandoningProgressId,
  onUnsaveRoute,
  removingSavedRouteId,
}: {
  list: RouteItem[] | SavedRouteItem[];
  variant: RouteVariant;
  progress?: number;
  progressMap?: Record<string, number>;
  progressByRouteId?: Record<string, UserRouteProgressDto>;
  onAbandonRoute?: (progressId: number) => void;
  abandoningProgressId?: number | null;
  onUnsaveRoute?: (savedRouteId: number, routeName: string) => void;
  removingSavedRouteId?: number | null;
}) {
  return (
    <View className="gap-3">
      {list.map((route) => (
        <RouteCard
          key={route.id}
          route={route}
          variant={variant}
          progress={progressMap?.[route.id] ?? progress}
          progressInfo={progressByRouteId?.[route.id]}
          progressId={progressByRouteId?.[route.id]?.userRouteProgressId}
          onAbandonRoute={onAbandonRoute}
          abandoningProgressId={abandoningProgressId}
          savedRouteId={
            "savedRouteId" in route ? route.savedRouteId : undefined
          }
          onUnsaveRoute={onUnsaveRoute}
          removingSavedRouteId={removingSavedRouteId}
        />
      ))}
    </View>
  );
}

function RouteCard({
  route,
  variant,
  progress,
  progressId,
  progressInfo,
  onAbandonRoute,
  abandoningProgressId,
  savedRouteId,
  onUnsaveRoute,
  removingSavedRouteId,
}: {
  route: RouteItem;
  variant: RouteVariant;
  progress?: number;
  progressId?: number;
  progressInfo?: UserRouteProgressDto;
  onAbandonRoute?: (progressId: number) => void;
  abandoningProgressId?: number | null;
  savedRouteId?: number;
  onUnsaveRoute?: (savedRouteId: number, routeName: string) => void;
  removingSavedRouteId?: number | null;
}) {
  const router = useRouter();
  const isRemovingSavedRoute =
    savedRouteId !== undefined && removingSavedRouteId === savedRouteId;

  return (
    <View
      className="overflow-hidden rounded-3xl border border-[#E8EDF4] bg-white"
      style={cardShadowStyle}
    >
      <Pressable onPress={() => router.push(`/route/${route.id}` as Href)}>
        <View style={styles.cardImageWrapLarge}>
          <Image
            source={route.cover}
            contentFit="cover"
            style={styles.cardImage}
          />
          <LinearGradient
            colors={["transparent", "rgba(0,0,0,0.8)"]}
            pointerEvents="none"
            style={StyleSheet.absoluteFill}
          />

          <View style={styles.cardBadgeRow}>
            <Badge text={route.era} />
            <Badge text={route.difficulty} />
            {variant === "completed" && (
              <View style={styles.completedBadge}>
                <SymbolView
                  name={{ ios: "checkmark", android: "check", web: "check" }}
                  size={10}
                  tintColor="#FFFFFF"
                />
                <Text style={styles.completedBadgeText}>Hoàn thành</Text>
              </View>
            )}
          </View>

          <View style={styles.cardTitleWrap}>
            <Text className="text-[16px] font-extrabold leading-tight text-white">
              {route.title}
            </Text>
            <View className="mt-0.5 flex-row items-center gap-1">
              <SymbolView
                name={{ ios: "star.fill", android: "star", web: "star" }}
                size={10}
                tintColor="#FFE566"
              />
              <Text className="text-[11px] text-white">{route.rating}</Text>
            </View>
          </View>
        </View>

        <View className="p-3">
          <View className="flex-row items-center gap-2">
            <Text className="text-[12px] text-[#8E869A]">{route.distance}</Text>
            <Text className="text-[12px] text-[#8E869A]">·</Text>
            <Text className="text-[12px] text-[#8E869A]">{route.duration}</Text>
            <Text className="text-[12px] text-[#8E869A]">·</Text>
            <Text className="text-[12px] text-[#8E869A]">
              {route.hotspotIds.length} điểm
            </Text>
            <View className="ml-auto rounded-full bg-[#FFF4EF] px-2 py-0.5">
              <Text className="text-[11px] font-bold text-[#F58752]">
                +{route.xp} XP
              </Text>
            </View>
          </View>
        </View>
      </Pressable>

      {variant === "active" && progress !== undefined && (
        <View className="px-3 pb-3">
          <View className="mb-1 flex-row items-center justify-between">
            <Text className="text-[11px] font-bold text-[#2B2233]">
              Tiến độ {Math.round(progress)}%
            </Text>
            {progressInfo ? (
              <Text className="text-[11px] font-semibold text-[#8E869A]">
                {progressInfo.completedStops}/{progressInfo.totalStops} điểm
              </Text>
            ) : null}
          </View>
          <XPBar value={progress} max={100} trackColor="#ECEEF4" height={6} />

          <View className="mt-2 flex-row gap-2">
            <Pressable
              className="flex-1 rounded-xl bg-[#F58752] py-2"
              onPress={() => router.push(`/route/${route.id}` as Href)}
            >
              <Text className="text-center text-[12px] font-bold text-white">
                Tiếp tục
              </Text>
            </Pressable>
            {progressId !== undefined && onAbandonRoute ? (
              <Pressable
                className={`flex-1 rounded-xl border border-[#F7C7D1] bg-[#FFF5F8] py-2 ${abandoningProgressId === progressId ? "opacity-70" : ""}`}
                onPress={() => onAbandonRoute(progressId)}
                disabled={abandoningProgressId === progressId}
              >
                <Text className="text-center text-[12px] font-bold text-[#B42345]">
                  {abandoningProgressId === progressId
                    ? "Đang bỏ..."
                    : "Bỏ tuyến"}
                </Text>
              </Pressable>
            ) : null}
          </View>
        </View>
      )}

      {variant === "bookmarked" &&
      savedRouteId !== undefined &&
      onUnsaveRoute ? (
        <View className="border-t border-[#ECEEF4] px-3 pb-3 pt-3">
          <Pressable
            disabled={isRemovingSavedRoute}
            onPress={() => onUnsaveRoute(savedRouteId, route.title)}
            className={`flex-row items-center justify-center gap-2 rounded-xl border border-[#F7C7D1] bg-[#FFF5F8] py-2.5 ${
              isRemovingSavedRoute ? "opacity-60" : ""
            }`}
          >
            <SymbolView
              name={{
                ios: "bookmark.slash",
                android: "bookmark_remove",
                web: "bookmark_remove",
              }}
              size={14}
              tintColor="#B42345"
            />
            <Text className="text-[12px] font-extrabold text-[#B42345]">
              {isRemovingSavedRoute ? "Đang bỏ lưu..." : "Bỏ lưu"}
            </Text>
          </Pressable>
        </View>
      ) : null}
    </View>
  );
}

function Badge({ text }: { text: string }) {
  return (
    <View className="rounded-full bg-black/35 px-2 py-0.5">
      <Text className="text-[11px] font-bold text-white">{text}</Text>
    </View>
  );
}

function EmptyState({ text }: { text: string }) {
  return (
    <View className="items-center py-16">
      <SymbolView
        name={{ ios: "sparkles", android: "auto_awesome", web: "auto_awesome" }}
        size={32}
        tintColor="#C9C3CF"
      />
      <Text className="mt-2 text-[13px] text-[#8E869A]">{text}</Text>
    </View>
  );
}

function LeaderboardSheet({ onClose }: { onClose: () => void }) {
  const [scope, setScope] = useState<"city" | "national">("city");
  const podium = [
    { user: leaderboard[1], rank: 2 },
    { user: leaderboard[0], rank: 1 },
    { user: leaderboard[2], rank: 3 },
  ];

  return (
    <Modal visible animationType="slide" transparent onRequestClose={onClose}>
      <View className="flex-1 justify-end bg-black/60">
        <Pressable style={StyleSheet.absoluteFill} onPress={onClose} />
        <View className="max-h-[85%] rounded-t-[32px] bg-[#F7F8FC]">
          <View className="rounded-t-[32px] bg-[#1E2433] p-4">
            <View className="mb-3 flex-row items-center justify-between">
              <View className="flex-row items-center gap-1.5">
                <SymbolView
                  name={{
                    ios: "trophy.fill",
                    android: "emoji_events",
                    web: "emoji_events",
                  }}
                  size={15}
                  tintColor="#FFE566"
                />
                <Text className="text-[16px] font-extrabold text-white">
                  Bảng xếp hạng
                </Text>
              </View>
              <Pressable
                onPress={onClose}
                className="h-8 w-8 items-center justify-center rounded-full bg-white/10"
              >
                <SymbolView
                  name={{ ios: "xmark", android: "close", web: "close" }}
                  size={14}
                  tintColor="#FFFFFF"
                />
              </Pressable>
            </View>

            <View className="flex-row rounded-xl bg-white/10 p-1">
              {[
                { key: "city" as const, label: "TP.HCM" },
                { key: "national" as const, label: "Toàn quốc" },
              ].map((item) => (
                <Pressable
                  key={item.key}
                  onPress={() => setScope(item.key)}
                  className={`flex-1 rounded-lg py-1.5 ${
                    scope === item.key ? "bg-white" : ""
                  }`}
                >
                  <Text
                    className={`text-center text-[11px] font-bold ${
                      scope === item.key ? "text-[#1E2433]" : "text-white/80"
                    }`}
                  >
                    {item.label}
                  </Text>
                </Pressable>
              ))}
            </View>

            <View className="mt-3 flex-row items-end justify-center gap-2">
              {podium.map(({ user, rank }) => {
                const isFirst = rank === 1;

                return (
                  <View key={user.name} className="flex-1 items-center">
                    {isFirst && (
                      <SymbolView
                        name={{
                          ios: "crown.fill",
                          android: "workspace_premium",
                          web: "workspace_premium",
                        }}
                        size={18}
                        tintColor="#FFE566"
                      />
                    )}
                    <Image
                      source={user.avatar}
                      contentFit="cover"
                      style={{
                        height: isFirst ? 64 : 48,
                        width: isFirst ? 64 : 48,
                        borderRadius: 999,
                        borderWidth: 2,
                        borderColor: isFirst
                          ? "#FFE566"
                          : "rgba(255,255,255,0.3)",
                        marginTop: isFirst ? 4 : 8,
                      }}
                    />
                    <Text
                      className="mt-1 text-[10px] font-bold text-white"
                      numberOfLines={1}
                    >
                      {user.name.split(" ").slice(-1)}
                    </Text>
                    <View
                      className={`mt-1 w-full items-center justify-center rounded-t-xl ${
                        rank === 1
                          ? "h-16 bg-[#F58752]"
                          : rank === 2
                            ? "h-12 bg-[#1F8FFF]"
                            : "h-10 bg-[#EB489B]"
                      }`}
                    >
                      <Text className="text-[10px] font-bold text-white">
                        #{rank}
                      </Text>
                      <Text className="text-[10px] text-white/90">
                        {user.xp.toLocaleString()}
                      </Text>
                    </View>
                  </View>
                );
              })}
            </View>
          </View>

          <ScrollView
            className="mx-4 my-4 max-h-80 rounded-3xl bg-white"
            style={cardShadowStyle}
          >
            {leaderboard.map((user) => (
              <View
                key={user.rank}
                className={`flex-row items-center gap-3 border-b border-[#ECEEF4] p-3 ${
                  user.name === currentUser.name ? "bg-[#FFF4EF]" : ""
                }`}
              >
                <Text className="w-6 text-center text-[14px] font-bold text-[#8E869A]">
                  {user.rank}
                </Text>
                <Image
                  source={user.avatar}
                  contentFit="cover"
                  style={{ height: 40, width: 40, borderRadius: 999 }}
                />
                <View className="min-w-0 flex-1">
                  <Text
                    className="text-[13px] font-semibold text-[#2B2233]"
                    numberOfLines={1}
                  >
                    {user.name}
                  </Text>
                  <Text className="text-[10px] text-[#8E869A]">
                    Cấp {user.level}
                  </Text>
                </View>
                <View className="items-end">
                  <Text className="text-[14px] font-bold text-[#2B2233]">
                    {user.xp.toLocaleString()}
                  </Text>
                  <TrendChange value={user.change} />
                </View>
              </View>
            ))}
          </ScrollView>
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  tabRow: {
    backgroundColor: "#ECEEF4",
    borderRadius: 16,
    flexDirection: "row",
    gap: 4,
    padding: 4,
  },
  tabButton: {
    borderRadius: 12,
    paddingHorizontal: 12,
    paddingVertical: 8,
  },
  tabButtonSelected: {
    backgroundColor: "#FFFFFF",
  },
  tabLabel: {
    color: "#8E869A",
    fontSize: 12,
    fontWeight: "700",
  },
  tabLabelSelected: {
    color: "#2B2233",
  },
  cardImageWrap: {
    height: 112,
    overflow: "hidden",
    position: "relative",
  },
  cardImageWrapLarge: {
    height: 128,
    overflow: "hidden",
    position: "relative",
  },
  cardImage: {
    height: "100%",
    width: "100%",
  },
  cardBadgeRow: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 4,
    left: 8,
    position: "absolute",
    top: 8,
  },
  cardTitleWrap: {
    bottom: 8,
    left: 8,
    position: "absolute",
    right: 8,
  },
  completedBadge: {
    alignItems: "center",
    backgroundColor: "#34C759",
    borderRadius: 999,
    flexDirection: "row",
    gap: 2,
    paddingHorizontal: 8,
    paddingVertical: 2,
  },
  completedBadgeText: {
    color: "#FFFFFF",
    fontSize: 10,
    fontWeight: "700",
  },
});

function TrendChange({ value }: { value: number }) {
  const color =
    value > 0
      ? "text-[#34C759]"
      : value < 0
        ? "text-[#E84D6A]"
        : "text-[#8E869A]";
  const icon: SymbolName =
    value > 0
      ? { ios: "arrow.up.right", android: "trending_up", web: "trending_up" }
      : value < 0
        ? {
            ios: "arrow.down.right",
            android: "trending_down",
            web: "trending_down",
          }
        : { ios: "minus", android: "remove", web: "remove" };

  return (
    <View className="flex-row items-center gap-0.5">
      <SymbolView
        name={icon}
        size={9}
        tintColor={value > 0 ? "#34C759" : value < 0 ? "#E84D6A" : "#8E869A"}
      />
      <Text className={`text-[10px] ${color}`}>{Math.abs(value) || "-"}</Text>
    </View>
  );
}