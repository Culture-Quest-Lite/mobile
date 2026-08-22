import { type RouteItem } from "@/lib/demo-data";
import { ScreenHorizontalPadding } from "@/constants/theme";
import { lineHeightFor } from "@/lib/text-scale";
import { Image } from "expo-image";
import { LinearGradient } from "expo-linear-gradient";
import { type Href, useFocusEffect, useRouter } from "expo-router";
import { StatusBar } from "expo-status-bar";
import { SymbolView } from "expo-symbols";
import {
  type ComponentProps,
  useCallback,
  useEffect,
  useMemo,
  useState
} from "react";
import {
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
  useWindowDimensions,
} from "react-native";
import { SafeAreaView, useSafeAreaInsets } from "react-native-safe-area-context";


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
import type { CommunityGroupPayload } from "@/features/community/api/group-api";
import {
  getCachedCommunityGroupJourneySession,
  type CommunityGroupJourneySession,
} from "@/features/community/data/community-group-journey-store";
import { cacheCommunityGroupSession } from "@/features/community/data/community-group-session-store";
import {
  useCommunityGroups,
  type CommunityGroupsStatus,
} from "@/features/community/hooks/use-community-groups";
import { LevelProgressCard } from "@/features/profile/components/level-progress-card";
import { useMyLevelProgress } from "@/features/profile/hooks/use-my-level-progress";
import type { Profile } from "@/features/profile/types";
import { UserAvatar } from "@/components/ui/user-avatar";
import { usePremiumStatus } from "@/features/profile/hooks/use-premium-status";
import { appAlert } from "@/components/ui/app-dialog";

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

const heroBannerImage = require("../../../../assets/images/hero-v2.png");
// Cùng marker với thanh cấp độ ở trang Hồ sơ.
const levelBadgeLogo = require("../../../../assets/images/logo3.png");
const routeScreenBackground = "#FDF7F8";

const cardShadowStyle = {
  shadowColor: "rgba(235, 72, 155, 0.10)",
  shadowOpacity: 1,
  shadowRadius: 18,
  shadowOffset: { width: 0, height: 10 },
  elevation: Platform.OS === "android" ? 6 : 5,
} as const;

const TAB_ITEMS: { key: Tab; label: string; icon: SymbolName }[] = [
  {
    key: "official",
    label: "Chính thức",
    icon: { ios: "map.fill", android: "map", web: "map" },
  },
  {
    key: "active",
    label: "Đang đi",
    icon: {
      ios: "figure.walk",
      android: "directions_walk",
      web: "directions_walk",
    },
  },
  {
    key: "groups",
    label: "Nhóm của tôi",
    icon: { ios: "person.3.fill", android: "groups", web: "groups" },
  },
  {
    key: "completed",
    label: "Đã xong",
    icon: {
      ios: "checkmark.circle.fill",
      android: "task_alt",
      web: "task_alt",
    },
  },
  {
    key: "bookmarked",
    label: "Đã lưu",
    icon: { ios: "bookmark.fill", android: "bookmark", web: "bookmark" },
  },
  {
    key: "plans",
    label: "Kế hoạch",
    icon: {
      ios: "calendar.badge.clock",
      android: "event_note",
      web: "event_note",
    },
  },
  {
    key: "journeys",
    label: "Hành trình của tôi",
    icon: {
      ios: "record.circle.fill",
      android: "radio_button_checked",
      web: "radio_button_checked",
    },
  },
  {
    key: "community",
    label: "Cộng đồng",
    icon: {
      ios: "globe.asia.australia.fill",
      android: "public",
      web: "public",
    },
  },
];

const TAB_SECTION_META: Record<
  Tab,
  {
    eyebrow: string;
    title: string;
  }
> = {
  official: {
    eyebrow: "KHÁM PHÁ",
    title: "Tuyến đường đề xuất",
  },
  active: {
    eyebrow: "TIẾN ĐỘ",
    title: "Hành trình bạn đang theo đuổi",
  },
  groups: {
    eyebrow: "KẾT NỐI",
    title: "Nhóm đồng hành của bạn",
  },
  completed: {
    eyebrow: "THÀNH TỰU",
    title: "Các tuyến đã hoàn thành",
  },
  bookmarked: {
    eyebrow: "LƯU LẠI",
    title: "Danh sách bạn muốn quay lại",
  },
  plans: {
    eyebrow: "CÁ NHÂN HÓA",
    title: "Kế hoạch riêng cho chuyến đi",
  },
  journeys: {
    eyebrow: "TỰ GHI",
    title: "Những hành trình của riêng bạn",
  },
  community: {
    eyebrow: "CỘNG ĐỒNG",
    title: "Hành trình được chia sẻ nhiều",
  },
};

function XPBar({
  value,
  max,
  trackColor = "rgba(255,255,255,0.2)",
  height = 8,
  fillColors = ["#FFE566", "#FFB400"] as const,
}: {
  value: number;
  max: number;
  trackColor?: string;
  height?: number;
  fillColors?: readonly [string, string, ...string[]];
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
        colors={fillColors}
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

/**
 * Gom dữ liệu cấp độ thật (GET /me + GET /gamification/levels) về đúng các
 * tham số mà `LevelProgressCard` (dùng chung với trang Hồ sơ) cần. Trả về
 * `null` khi chưa có dữ liệu để màn hình ẩn hẳn phần cấp thay vì hiện số liệu
 * demo.
 */
function getLevelSummary(profile: Profile | null) {
  if (!profile) return null;

  const level = typeof profile.level === "number" ? profile.level : null;
  const levelName = profile.levelName?.trim() ?? "";
  const totalXp = Math.max(profile.totalXp, 0);

  if (level === null && !levelName && totalXp <= 0) return null;

  const nextLevelRequiredXp =
    typeof profile.nextLevelRequiredXp === "number"
      ? profile.nextLevelRequiredXp
      : null;
  const hasExactProgress =
    profile.hasExactLevelProgress === true &&
    nextLevelRequiredXp !== null &&
    typeof profile.levelProgressPercent === "number";

  // levelName của backend thường đã chứa số cấp ("Level 3"), tránh lặp "Cấp 3 · Level 3".
  const title =
    levelName && level !== null && !levelName.includes(String(level))
      ? `Cấp ${level} · ${levelName}`
      : levelName || (level !== null ? `Cấp ${level}` : "Cấp của bạn");

  return {
    currentXp: totalXp,
    hasExactProgress,
    level,
    nextLevelRequiredXp,
    progressPercent: profile.levelProgressPercent,
    title,
  };
}

/**
 * Avatar + huy hiệu cấp, dùng lại đúng cách trang Hồ sơ và Trang chủ đang thể
 * hiện cấp độ của user.
 */
function ExplorerLevelAvatar({
  avatar,
  level,
  name,
  username,
}: {
  avatar: string | null;
  level: number | null;
  name: string | null;
  username: string | null;
}) {
  return (
    <View className="relative">
      <UserAvatar
        borderColor="#FFFFFF"
        borderWidth={3}
        displayName={name}
        size={52}
        uri={avatar}
        username={username}
      />

      {level !== null ? (
        <LinearGradient
          colors={["#F58752", "#EB489B"]}
          end={{ x: 1, y: 1 }}
          start={{ x: 0, y: 0 }}
          style={styles.levelBadge}
        >
          <Text style={styles.levelBadgeText}>{level}</Text>
        </LinearGradient>
      ) : null}
    </View>
  );
}

export default function RouteScreen() {
  const [tab, setTab] = useState<Tab>("official");
  const router = useRouter();
  const session = useAuthSession();
  const insets = useSafeAreaInsets();
  const { width: screenWidth } = useWindowDimensions();
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
  const { profile: levelProfile } = useMyLevelProgress();
  const {
    errorMessage: communityGroupsError,
    groups: myCommunityGroups,
    reload: reloadCommunityGroups,
    status: communityGroupsStatus,
  } = useCommunityGroups();

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
            setOfficialRoutes([]);
            setActiveRouteProgresses([]);
            setActiveRoutesFromApi([]);
            setSavedRoutesFromApi([]);
            setMyPlans([]);
            setMyRecordJourneys([]);
            setCommunityRoutesFromApi([]);
            setRouteError(
              error instanceof Error
                ? error.message
                : "Không thể tải tuyến.",
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

    appAlert.alert(
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
              appAlert.alert("Đã bỏ tuyến", "Tiến độ tuyến này đã được dừng.");
            } catch (error) {
              appAlert.alert(
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

    appAlert.alert(
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
              appAlert.alert(
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
  // Tab "Chính thức" chỉ hiển thị đúng dữ liệu từ API. Trước đây khi API rỗng
  // hoặc lỗi thì màn này rơi về `routes` trong demo-data, khiến user thấy các
  // tuyến không có thật và bấm vào là vỡ điều hướng.
  const displayedOfficialRoutes = officialRoutes;
  const activeTabMeta = TAB_SECTION_META[tab];
  const contentWidth = Math.min(screenWidth - ScreenHorizontalPadding * 2, 520);
  const tabButtonWidth = Math.max(Math.floor((contentWidth - 18) / 4), 76);
  const heroImageHeight = Math.min(Math.max(screenWidth * 0.5, 172), 198);
  const heroHeight = heroImageHeight;
  const levelSummary = getLevelSummary(levelProfile);
  // `session.displayName` mặc định là "bạn" cho khách, nên chỉ đọc tên khi đã
  // đăng nhập.
  const explorerName = session.isAuthenticated
    ? levelProfile?.name.trim() ||
      session.displayName.trim() ||
      levelProfile?.username.trim() ||
      session.username?.trim() ||
      null
    : null;
  // Chưa đăng nhập / API lỗi thì bỏ hẳn thẻ tài khoản thay vì hiển thị số
  // liệu giả.
  const showAccountCard = Boolean(explorerName) || Boolean(levelSummary);
  const levelCardHeroOverlap = showAccountCard ? 34 : 0;
  const featuredActiveProgress = activeRouteProgresses[0] ?? null;
  const featuredActiveRouteId = featuredActiveProgress
    ? String(featuredActiveProgress.routeId)
    : null;
  const remainingActiveRoutes = useMemo(
    () =>
      featuredActiveRouteId
        ? activeList.filter((route) => route.id !== featuredActiveRouteId)
        : activeList,
    [activeList, featuredActiveRouteId],
  );
  const currentTabCount = (() => {
    switch (tab) {
      case "official":
        return displayedOfficialRoutes.length;
      case "active":
        return activeList.length;
      case "groups":
        return myCommunityGroups.length;
      case "completed":
        return completedList.length;
      case "bookmarked":
        return savedList.length;
      case "plans":
        return myPlans.length;
      case "journeys":
        return myRecordJourneys.length;
      case "community":
        return communityRoutesFromApi.length;
      default:
        return 0;
    }
  })();
  const isCurrentTabLoading =
    tab === "groups"
      ? communityGroupsStatus === "idle" || communityGroupsStatus === "loading"
      : isLoadingRoutes;
  const sectionActionLabel =
    tab === "official"
      ? "Xem tất cả"
      : currentTabCount
        ? `${currentTabCount} mục`
        : isCurrentTabLoading && (tab === "community" || tab === "groups")
          ? ""
          : "Trống";

  return (
    <View className="flex-1" style={{ backgroundColor: routeScreenBackground }}>
      <StatusBar style="dark" />

      <SafeAreaView className="flex-1" edges={["left", "right"]}>
        <ScrollView
          className="flex-1"
          contentContainerStyle={{ paddingBottom: 28 }}
          keyboardShouldPersistTaps="handled"
          nestedScrollEnabled
          showsVerticalScrollIndicator={false}
        >
          <View
            style={[styles.heroShell, { height: heroHeight + levelCardHeroOverlap + 8 }]}
          >
            <Image
              source={heroBannerImage}
              contentFit="cover"
              contentPosition="center"
              style={styles.heroBannerImage}
            />

            <View className="px-4" style={{ paddingTop: insets.top + 8 }}>
              <View style={styles.contentFrame}>
                <View className="flex-row items-start justify-between gap-4">
                  <View className="flex-1">
                    <Text style={styles.heroEyebrow}>HÀNH TRÌNH</Text>
                    <Text style={styles.heroTitle}>Khám phá kế tiếp</Text>
                  </View>

                  <Pressable
                    accessibilityLabel="Mở bảng xếp hạng"
                    className="h-10 w-10 items-center justify-center rounded-full border border-white/70 bg-white/72"
                    onPress={() => router.push("/community/leaderboard" as Href)}
                    style={cardShadowStyle}
                  >
                    <SymbolView
                      name={{
                        ios: "trophy.fill",
                        android: "emoji_events",
                        web: "emoji_events",
                      }}
                      size={15}
                      tintColor="#FF4F86"
                    />
                  </Pressable>
                </View>
              </View>
            </View>
          </View>

          {showAccountCard ? (
            <View
              className="px-4"
              style={{ marginTop: -levelCardHeroOverlap, zIndex: 4 }}
            >
              <View style={styles.contentFrame}>
                <View
                  className="overflow-hidden rounded-[24px] border border-[#F9E1E8] bg-white px-4 py-4"
                  style={cardShadowStyle}
                >
                  <View className="flex-row items-start gap-3">
                    <ExplorerLevelAvatar
                      avatar={levelProfile?.avatar ?? null}
                      level={levelSummary?.level ?? null}
                      name={explorerName}
                      username={levelProfile?.username ?? session.username}
                    />
                    <View className="min-w-0 flex-1">
                      <Text
                        className="font-extrabold text-[#2B2233]"
                        style={styles.levelTitleText}
                        numberOfLines={1}
                      >
                        {explorerName ?? levelSummary?.title}
                      </Text>
                      {levelSummary ? (
                        <LevelProgressCard
                          currentXp={levelSummary.currentXp}
                          hasExactProgress={levelSummary.hasExactProgress}
                          markerSource={levelBadgeLogo}
                          nextLevelRequiredXp={levelSummary.nextLevelRequiredXp}
                          progressPercent={levelSummary.progressPercent}
                        />
                      ) : null}
                    </View>
                  </View>
                </View>
              </View>
            </View>
          ) : null}

          <View
            className="px-4"
            style={{ paddingBottom: 28, paddingTop: 14 }}
          >
            <View style={styles.contentFrame}>
              <View
                className="overflow-hidden rounded-[24px] border border-[#F7E6EC] bg-white p-1.5"
                style={cardShadowStyle}
              >
                <ScrollView
                  horizontal
                  contentContainerStyle={styles.tabRow}
                  nestedScrollEnabled
                  showsHorizontalScrollIndicator={false}
                >
                  {TAB_ITEMS.map((item) => {
                    const selected = tab === item.key;

                    return (
                      <Pressable
                        key={item.key}
                        onPress={() => setTab(item.key)}
                        style={[
                          styles.tabButton,
                          { width: tabButtonWidth },
                          selected && styles.tabButtonSelected,
                        ]}
                      >
                        {selected ? (
                          <LinearGradient
                            colors={["#FFF5F9", "#FFFDFE"]}
                            end={{ x: 1, y: 1 }}
                            pointerEvents="none"
                            start={{ x: 0, y: 0 }}
                            style={StyleSheet.absoluteFill}
                          />
                        ) : null}
                        <View
                          style={[
                            styles.tabIconWrap,
                            selected && styles.tabIconWrapSelected,
                          ]}
                        >
                          <SymbolView
                            name={item.icon}
                            size={13}
                            tintColor={selected ? "#FF4F86" : "#857A86"}
                          />
                        </View>
                        <Text
                          style={[
                            styles.tabLabel,
                            selected && styles.tabLabelSelected,
                          ]}
                          numberOfLines={1}
                        >
                          {item.label}
                        </Text>
                      </Pressable>
                    );
                  })}
                </ScrollView>
              </View>

              <View className="mt-5 flex-row items-center justify-between gap-3">
                <View className="min-w-0 flex-1 flex-row items-center gap-2">
                  <SymbolView
                    name={{
                      ios: "sparkles",
                      android: "auto_awesome",
                      web: "auto_awesome",
                    }}
                    size={14}
                    tintColor="#FF4F86"
                  />
                  <Text style={styles.sectionTitle}>{activeTabMeta.title}</Text>
                </View>
                <Text style={styles.sectionActionLabel}>
                  {sectionActionLabel}
                </Text>
              </View>

              <View key={tab} className="mt-3 gap-3">
                {tab === "official" &&
                  (isLoadingRoutes ? (
                    <EmptyState />
                  ) : (
                    <>
                      {routeError ? (
                        <View className="rounded-[20px] border border-[#FFE1E8] bg-[#FFF5F8] px-4 py-3">
                          <Text className="text-[12px] font-semibold text-[#B42345]">
                            {routeError}
                          </Text>
                        </View>
                      ) : null}
                      {displayedOfficialRoutes.length ? (
                        <RouteList
                          list={displayedOfficialRoutes}
                          variant="official"
                        />
                      ) : (
                        <EmptyState text="Chưa có tuyến chính thức nào" />
                      )}
                    </>
                  ))}
                {tab === "active" &&
                  (featuredActiveProgress ? (
                    <View className="gap-3">
                      <ActiveProgressSummary
                        progress={featuredActiveProgress}
                        onAbandonRoute={handleAbandonRoute}
                        abandoningProgressId={abandoningProgressId}
                      />
                      {remainingActiveRoutes.length ? (
                        <RouteList
                          list={remainingActiveRoutes}
                          variant="active"
                          progressMap={activeProgressMap}
                          progressByRouteId={activeProgressByRouteId}
                          onAbandonRoute={handleAbandonRoute}
                          abandoningProgressId={abandoningProgressId}
                        />
                      ) : null}
                    </View>
                  ) : (
                    <EmptyState text="Bạn chưa tham gia tuyến nào" />
                  ))}
                {tab === "groups" && (
                  <MyGroupsTab
                    currentProfileId={levelProfile?.id ?? null}
                    errorMessage={communityGroupsError}
                    groups={myCommunityGroups}
                    isAuthenticated={session.isAuthenticated}
                    onRetry={reloadCommunityGroups}
                    status={communityGroupsStatus}
                  />
                )}
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
            </View>
          </View>
        </ScrollView>
      </SafeAreaView>
    </View>
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
      className="overflow-hidden rounded-[26px] border border-[#F9E1E8] bg-white"
      style={cardShadowStyle}
    >
      <LinearGradient
        colors={["#FFF6F9", "#FFFDFC"]}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 1 }}
        className="p-4"
      >
        <View className="flex-row items-start gap-3">
          <View className="h-11 w-11 items-center justify-center rounded-[16px] bg-[#FFF0F4]">
            <SymbolView
              name={{
                ios: "figure.walk.circle.fill",
                android: "directions_walk",
                web: "directions_walk",
              }}
              size={20}
              tintColor="#FF4F86"
            />
          </View>

          <View className="flex-1">
            <Text className="text-[11px] font-extrabold uppercase tracking-[1.2px] text-[#EB489B]">
              Đang thực hiện
            </Text>
            <Text
              className="mt-1 text-[17px] font-extrabold text-[#2B2233]"
              numberOfLines={2}
            >
              {routeName}
            </Text>
            <Text className="mt-1 text-[12px] leading-5 text-[#7A6F67]">
              {progress.completedStops}/{progress.totalStops} điểm ·{" "}
              {progressValue}% hoàn thành
            </Text>
          </View>

          <View className="rounded-full bg-[#FFF1F5] px-3 py-2">
            <Text className="text-[12px] font-extrabold text-[#FF4F86]">
              {progressValue}%
            </Text>
          </View>
        </View>

        <View className="mt-3">
          <XPBar
            value={progressValue}
            max={100}
            trackColor="#F6E5EB"
            height={8}
            fillColors={["#FF7AA8", "#FF4F86"]}
          />
        </View>

        <View className="mt-3 flex-row gap-2">
          <Pressable
            className="flex-1 rounded-[18px] bg-[#FF4F86] py-3"
            onPress={() => router.push(`/route/${progress.routeId}` as Href)}
          >
            <Text className="text-center text-[13px] font-extrabold text-white">
              Tiếp tục hành trình
            </Text>
          </Pressable>

          <Pressable
            className={`rounded-[18px] border border-[#F7C7D1] bg-white px-4 py-3 ${isAbandoning ? "opacity-70" : ""}`}
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
          colors={["#FF6A8E", "#EB489B", "#F58752"]}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 1 }}
          className="p-4"
        >
          <Text className="text-[11px] uppercase tracking-wider text-white/80">
            Custom User Plan
          </Text>
          <Text className="mt-1 text-[18px] font-bold text-white">
            Tạo kế hoạch hành trình mới
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
                <Text className="text-[16px] font-bold text-[#2B2233]" numberOfLines={2}>
                  {plan.name}
                </Text>
              </View>
              <View className="rounded-full bg-[#FFF0F4] px-3 py-1.5">
                <Text className="text-[10px] text-[#EB489B]">{plan.status}</Text>
              </View>
            </View>
            <View className="mt-3 flex-row justify-between">
              <Text className="text-[12px] text-[#6E6177]">{plan.completedStops}/{plan.totalStops} điểm</Text>
              <Text className="text-[12px] text-[#EB489B]">{progress}%</Text>
            </View>
            <View className="mt-2"><XPBar value={progress} max={100} trackColor="#ECEEF4" height={7} /></View>
            <Pressable className="mt-3 rounded-2xl bg-[#EB489B] py-3" onPress={() => router.push(`/route/custom/plan/${plan.userPlanId}` as Href)}>
              <Text className="text-center text-[13px] font-semibold text-white">
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
      icon: { ios: "record.circle.fill", android: "fiber_manual_record", web: "fiber_manual_record" } as const,
      iconColor: "#F15B45",
      badgeClass: "bg-[#FFF0EC]",
      badgeTextClass: "text-[#C94733]",
    },
    {
      key: "DRAFT",
      title: "Bản nháp",
      icon: { ios: "doc.text.fill", android: "description", web: "description" } as const,
      iconColor: "#EB489B",
      badgeClass: "bg-[#FFF0F4]",
      badgeTextClass: "text-[#EB489B]",
    },
    {
      key: "TRIAL",
      title: "Đang chờ duyệt",
      icon: { ios: "clock.fill", android: "schedule", web: "schedule" } as const,
      iconColor: "#F58752",
      badgeClass: "bg-[#FFF4EA]",
      badgeTextClass: "text-[#C85D27]",
    },
    {
      key: "PUBLISHED",
      title: "Đã xuất bản",
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
              <Text className="text-[11px] uppercase tracking-wider text-white/85">
                Record Journey
              </Text>
              <Text className="mt-0.5 text-[18px] font-bold text-white">
                Ghi hành trình mới
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
                  <Text className="text-[15px] font-bold text-[#2B2233]">{section.title}</Text>
                </View>
              </View>
              <View className={`rounded-full px-2.5 py-1 ${section.badgeClass}`}>
                <Text className={`text-[10px] ${section.badgeTextClass}`}>{items.length}</Text>
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
                    <Text className="text-[16px] font-bold text-[#2B2233]" numberOfLines={2}>
                      {journey.routeName || `Hành trình #${journey.routeId}`}
                    </Text>
                  </View>
                  <View className={`rounded-full px-3 py-1.5 ${section.badgeClass}`}>
                    <Text className={`text-[9px] ${section.badgeTextClass}`}>
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
                    <Text className="text-[11px] text-[#625A68]">
                      {(journey.hotspots ?? []).length} địa điểm
                    </Text>
                  </View>
                  <View className="rounded-full bg-[#F7F8FC] px-3 py-2">
                    <Text className="text-[11px] text-[#625A68]">Route #{journey.routeId}</Text>
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
                  <Text className="text-center text-[13px] font-semibold text-white">
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
          <Text className="px-1 text-[15px] font-bold text-[#2B2233]">Trạng thái khác</Text>
          {grouped.OTHER.map((journey) => (
            <View key={journey.routeId} className="rounded-3xl border border-[#ECE7F4] bg-white p-4" style={cardShadowStyle}>
              <Text className="text-[15px] font-bold text-[#2B2233]">{journey.routeName || `Hành trình #${journey.routeId}`}</Text>
            </View>
          ))}
        </View>
      ) : null}
    </View>
  );
}

const GROUP_UNNAMED_LABEL = "Nhóm chưa đặt tên";

function readGroupText(value?: string | null) {
  if (typeof value !== "string") return null;

  const trimmedValue = value.trim();
  return trimmedValue ? trimmedValue : null;
}

function formatGroupMemberCount(value?: number | null) {
  const resolvedValue =
    typeof value === "number" && Number.isFinite(value)
      ? Math.max(0, Math.round(value))
      : 0;

  if (resolvedValue < 1000) return `${resolvedValue}`;

  const compactValue = resolvedValue / 1000;
  return `${compactValue >= 10 ? compactValue.toFixed(0) : compactValue.toFixed(1)}k`;
}

// Dùng lại đúng nhãn/màu của màn "Tất cả nhóm" để hai nơi nói cùng một ngôn ngữ.
function getGroupAccessMeta(requiredApproval?: boolean | null) {
  if (requiredApproval === true) {
    return {
      backgroundColor: "#FFF4DE",
      color: "#E39B1A",
      icon: { ios: "lock.fill", android: "lock", web: "lock" } as SymbolName,
      label: "Duyệt khi tham gia",
    };
  }

  return {
    backgroundColor: "#EAF8ED",
    color: "#4CAF6A",
    icon: { ios: "link", android: "link", web: "link" } as SymbolName,
    label: "Tham gia tự do",
  };
}

function GroupMetaPill({
  backgroundColor,
  color,
  icon,
  label,
}: {
  backgroundColor: string;
  color: string;
  icon: SymbolName;
  label: string;
}) {
  return (
    <View
      className="flex-row items-center gap-1.5 rounded-full px-2.5 py-1.5"
      style={{ backgroundColor }}
    >
      <SymbolView name={icon} size={11} tintColor={color} />
      <Text className="text-[11px] font-bold" style={{ color }}>
        {label}
      </Text>
    </View>
  );
}

function GroupAvatar({ imageUrl }: { imageUrl?: string | null }) {
  const resolvedImageUrl = readGroupText(imageUrl);

  return (
    <View className="h-[52px] w-[52px] items-center justify-center overflow-hidden rounded-full border border-[#FCE0EB] bg-[#FFF0F4]">
      {resolvedImageUrl ? (
        <Image
          source={resolvedImageUrl}
          contentFit="cover"
          style={{ height: 52, width: 52 }}
        />
      ) : (
        <SymbolView
          name={{ ios: "person.3.fill", android: "groups", web: "groups" }}
          size={22}
          tintColor="#FF4F86"
        />
      )}
    </View>
  );
}

function MyGroupsTab({
  currentProfileId,
  errorMessage,
  groups,
  isAuthenticated,
  onRetry,
  status,
}: {
  currentProfileId: string | null;
  errorMessage: string | null;
  groups: CommunityGroupPayload[];
  isAuthenticated: boolean;
  onRetry: () => void;
  status: CommunityGroupsStatus;
}) {
  const router = useRouter();
  const { requirePremium } = usePremiumStatus();
  const isLoading = status === "idle" || status === "loading";

  // Nhóm đồng hành là tính năng Premium, chặn ở mọi lối vào của tab giống
  // cách tab Kế hoạch (User Plan) và Hành trình của tôi (Record) đang làm.
  const GROUP_PREMIUM_LABEL = "Nhóm đồng hành (Community Group)";

  function openGroupDetail(group: CommunityGroupPayload) {
    if (!requirePremium(GROUP_PREMIUM_LABEL)) return;

    const cachedGroup = cacheCommunityGroupSession({
      ...group,
      source: "listed",
    });

    if (!cachedGroup) {
      appAlert.alert("Không mở được nhóm", "Dữ liệu nhóm này chưa hợp lệ.");
      return;
    }

    const detailRouteKey = cachedGroup.groupId ?? cachedGroup.shareToken;
    router.push(`/community/group/${encodeURIComponent(detailRouteKey)}` as Href);
  }

  function openGroupJourney(
    group: CommunityGroupPayload,
    session: CommunityGroupJourneySession,
  ) {
    if (!requirePremium(GROUP_PREMIUM_LABEL)) return;

    const shareToken = readGroupText(group.shareToken);

    if (!shareToken) {
      openGroupDetail(group);
      return;
    }

    const routeId = readGroupText(session.routeId);
    const routeName = readGroupText(session.routeName) ?? "Hành trình nhóm";
    const query = routeId
      ? `?routeId=${encodeURIComponent(routeId)}&routeName=${encodeURIComponent(routeName)}`
      : `?routeName=${encodeURIComponent(routeName)}`;

    router.push(
      `/community/group/${encodeURIComponent(shareToken)}/journey${query}` as Href,
    );
  }

  if (!isAuthenticated) {
    return (
      <View className="gap-3">
        <View
          className="items-center rounded-[24px] border border-[#F4E2E8] bg-[#FFF9FB] px-6 py-8"
          style={cardShadowStyle}
        >
          <View className="h-14 w-14 items-center justify-center rounded-full bg-[#FFF0F4]">
            <SymbolView
              name={{ ios: "person.3.fill", android: "groups", web: "groups" }}
              size={26}
              tintColor="#FF4F86"
            />
          </View>
          <Text className="mt-3 text-center text-[15px] font-extrabold text-[#2B2233]">
            Đăng nhập để xem nhóm của bạn
          </Text>
          <Text className="mt-1 text-center text-[12px] leading-5 text-[#8E869A]">
            Nhóm giúp bạn rủ bạn bè cùng đi một tuyến và theo dõi nhau trên bản đồ.
          </Text>
          <Pressable
            className="mt-4 rounded-[18px] bg-[#FF4F86] px-6 py-3"
            onPress={() => router.push("/login?entry=home" as Href)}
          >
            <Text className="text-[13px] font-extrabold text-white">
              Đăng nhập
            </Text>
          </Pressable>
        </View>
      </View>
    );
  }

  return (
    <View className="gap-3">
      <View className="overflow-hidden rounded-3xl" style={cardShadowStyle}>
        <LinearGradient
          colors={["#FF6A8E", "#EB489B", "#F58752"]}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 1 }}
          className="p-4"
        >
          <Text className="text-[11px] font-bold uppercase tracking-wider text-white/80">
            Nhóm cộng đồng
          </Text>
          <Text className="mt-1 text-[18px] font-black text-white">
            Đi tuyến cùng nhóm của bạn
          </Text>
          <Text className="mt-1 text-[12px] leading-5 text-white/90">
            {status === "ready"
              ? `Bạn đang có ${groups.length} nhóm. Mở một tuyến rồi chọn "Đi cùng nhóm" để bắt đầu hành trình chung.`
              : "Tạo nhóm, mời bạn bè rồi bắt đầu hành trình chung ngay trên tuyến bạn thích."}
          </Text>

          <View className="mt-4 flex-row gap-2">
            <Pressable
              className="flex-row items-center gap-1.5 rounded-2xl bg-white px-4 py-2.5"
              onPress={() => {
                if (!requirePremium(GROUP_PREMIUM_LABEL)) return;
                router.push("/community/group-create" as Href);
              }}
            >
              <SymbolView
                name={{ ios: "plus", android: "add", web: "add" }}
                size={13}
                tintColor="#EB489B"
              />
              <Text className="text-[12px] font-semibold text-[#EB489B]">
                Tạo nhóm mới
              </Text>
            </Pressable>
            <Pressable
              className="rounded-2xl border border-white/50 bg-white/15 px-4 py-2.5"
              onPress={() => {
                if (!requirePremium(GROUP_PREMIUM_LABEL)) return;
                router.push("/community/groups" as Href);
              }}
            >
              <Text className="text-[12px] font-semibold text-white">
                Xem tất cả
              </Text>
            </Pressable>
          </View>
        </LinearGradient>
      </View>

      {status === "error" ? (
        <View className="rounded-[20px] border border-[#FFE1E8] bg-[#FFF5F8] px-4 py-3">
          <Text className="text-[12px] font-semibold text-[#B42345]">
            {errorMessage ?? "Không tải được danh sách nhóm cộng đồng."}
          </Text>
          <Pressable
            className="mt-2.5 self-start rounded-[14px] border border-[#F7C7D1] bg-white px-4 py-2"
            onPress={onRetry}
          >
            <Text className="text-[12px] font-extrabold text-[#B42345]">
              Thử lại
            </Text>
          </Pressable>
        </View>
      ) : null}

      {groups.length === 0 && isLoading ? (
        <EmptyState />
      ) : null}

      {groups.length === 0 && status === "ready" ? (
        <EmptyState text="Bạn chưa tham gia nhóm nào. Hãy tạo nhóm đầu tiên để rủ bạn bè cùng đi tuyến." />
      ) : null}

      {groups.map((group) => {
        const groupName = readGroupText(group.groupName) ?? GROUP_UNNAMED_LABEL;
        const isLeader =
          currentProfileId !== null &&
          readGroupText(group.leaderId) === currentProfileId;
        const accessMeta = getGroupAccessMeta(group.requiredApproval);
        const journeySession =
          getCachedCommunityGroupJourneySession(group.shareToken) ??
          getCachedCommunityGroupJourneySession(group.groupId);

        return (
          <Pressable
            key={group.shareToken}
            className="overflow-hidden rounded-[24px] border border-[#F5E7EC] bg-white px-4 py-4"
            style={cardShadowStyle}
            onPress={() => openGroupDetail(group)}
          >
            <View className="flex-row items-center gap-3">
              <GroupAvatar imageUrl={group.imageUrl} />

              <View className="min-w-0 flex-1">
                <View className="flex-row items-center gap-1.5">
                  <Text
                    className="text-[15px] font-extrabold text-[#2B2233]"
                    numberOfLines={1}
                    style={{ flexShrink: 1 }}
                  >
                    {groupName}
                  </Text>
                  {isLeader ? (
                    <SymbolView
                      name={{
                        ios: "crown.fill",
                        android: "workspace_premium",
                        web: "workspace_premium",
                      }}
                      size={14}
                      tintColor="#E39B1A"
                    />
                  ) : null}
                </View>

                <View className="mt-2 flex-row flex-wrap items-center gap-2">
                  <GroupMetaPill
                    backgroundColor="#F8F5F6"
                    color="#6F657A"
                    icon={{
                      ios: "person.2.fill",
                      android: "groups",
                      web: "groups",
                    }}
                    label={`${formatGroupMemberCount(group.totalMembers)} thành viên`}
                  />
                  <GroupMetaPill
                    backgroundColor={accessMeta.backgroundColor}
                    color={accessMeta.color}
                    icon={accessMeta.icon}
                    label={accessMeta.label}
                  />
                </View>
              </View>

              <SymbolView
                name={{
                  ios: "chevron.right",
                  android: "chevron_right",
                  web: "chevron_right",
                }}
                size={14}
                tintColor="#D2C6CE"
              />
            </View>

            {journeySession ? (
              <View className="mt-3 rounded-[18px] border border-[#FFE1EA] bg-[#FFF5F8] px-3.5 py-3">
                <Text className="text-[10px] font-extrabold uppercase tracking-[1.1px] text-[#EB489B]">
                  Đang đi cùng nhóm
                </Text>
                <Text
                  className="mt-1 text-[13px] font-extrabold text-[#2B2233]"
                  numberOfLines={1}
                >
                  {readGroupText(journeySession.routeName) ?? "Hành trình nhóm"}
                </Text>
                <Pressable
                  className="mt-2.5 rounded-[16px] bg-[#FF4F86] py-2.5"
                  onPress={() => openGroupJourney(group, journeySession)}
                >
                  <Text className="text-center text-[12px] font-extrabold text-white">
                    Mở hành trình nhóm
                  </Text>
                </Pressable>
              </View>
            ) : null}
          </Pressable>
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
        <Text className="text-[11px] uppercase tracking-wider text-[#EB489B]">Cộng đồng</Text>
        <Text className="mt-1 text-[17px] font-bold text-[#2B2233]">Khám phá hành trình đã xuất bản</Text>
      </View>

      {isLoading ? (
        <EmptyState />
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
                  <Text className="text-[15px] font-bold text-[#2B2233]">
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
                <Text className="text-[15px] font-bold text-[#2B2233]">
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
        <Text className="text-[12px] font-semibold">#{rank}</Text>
      </View>
      <Image
        source={route.cover}
        contentFit="cover"
        style={{ height: 56, width: 56, borderRadius: 12 }}
      />
      <View className="min-w-0 flex-1">
        <Text
          className="text-[13px] font-bold leading-tight text-[#2B2233]"
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
            className="text-[14px] font-bold leading-tight text-white"
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
          className="flex-1 text-[11px] text-[#2B2233]"
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
          <Text className="text-[11px] text-[#F58752]">+{route.xp} XP</Text>
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

  // Tab "Đã lưu" dùng chung đúng khung thẻ của tab "Chính thức" (ảnh gọn +
  // tiêu đề in đậm + phần meta chữ thường) thay vì thẻ ảnh lớn phủ chữ đậm
  // trên nền tối — cách cũ khiến danh sách nhìn nặng hơn hẳn phần còn lại.
  if (variant === "official" || variant === "bookmarked") {
    return (
      <View
        className="overflow-hidden rounded-[24px] border border-[#F5E7EC] bg-white"
        style={cardShadowStyle}
      >
        <Pressable onPress={() => router.push(`/route/${route.id}` as Href)}>
          <View style={styles.officialRouteMedia}>
            <Image
              source={route.cover}
              contentFit="cover"
              style={styles.cardImage}
            />

            <View style={styles.officialRouteTopRow}>
              <Badge text={route.era} />
              <View style={styles.officialRouteHeart}>
                <SymbolView
                  name={
                    variant === "bookmarked"
                      ? { ios: "bookmark.fill", android: "bookmark", web: "bookmark" }
                      : { ios: "heart", android: "favorite_border", web: "favorite_border" }
                  }
                  size={15}
                  tintColor="#FFFFFF"
                />
              </View>
            </View>
          </View>

          <View className="px-4 pb-4 pt-2.5">
            <Text
              className="text-[15px] text-[#2B2233]"
              style={styles.officialRouteTitle}
              numberOfLines={1}
            >
              {route.title}
            </Text>

            <View className="mt-1 flex-row items-end justify-between gap-3">
              <View className="flex-1 flex-row flex-wrap items-center gap-x-4 gap-y-2">
                <RouteMetaInline
                  icon={{
                    ios: "mappin.and.ellipse",
                    android: "location_on",
                    web: "location_on",
                  }}
                  label={route.distance}
                />
                <RouteMetaInline
                  icon={{ ios: "clock", android: "schedule", web: "schedule" }}
                  label={route.duration}
                />
                <RouteMetaInline
                  icon={{ ios: "star", android: "star_outline", web: "star_outline" }}
                  label={`${route.hotspotIds.length} điểm`}
                />
              </View>

              <View style={styles.officialRouteXpPill}>
                <Text className="text-[11px] font-semibold text-[#FF4F86]">
                  +{route.xp} XP
                </Text>
              </View>
            </View>
          </View>
        </Pressable>

        {variant === "bookmarked" &&
        savedRouteId !== undefined &&
        onUnsaveRoute ? (
          <View className="border-t border-[#F6E8EE] px-4 py-3">
            <Pressable
              disabled={isRemovingSavedRoute}
              onPress={() => onUnsaveRoute(savedRouteId, route.title)}
              className={`flex-row items-center justify-center gap-2 rounded-[16px] border border-[#F7C7D1] bg-[#FFF5F8] py-2.5 ${
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
              <Text className="text-[12px] font-semibold text-[#B42345]">
                {isRemovingSavedRoute ? "Đang bỏ lưu..." : "Bỏ lưu"}
              </Text>
            </Pressable>
          </View>
        ) : null}
      </View>
    );
  }

  const quickActionIcon: SymbolName =
    variant === "completed"
      ? {
          ios: "checkmark.circle.fill",
          android: "check_circle",
          web: "check_circle",
        }
      : { ios: "heart", android: "favorite_border", web: "favorite_border" };

  return (
    <View
      className="overflow-hidden rounded-[26px] border border-[#F7E5EB] bg-white"
      style={cardShadowStyle}
    >
      <Pressable onPress={() => router.push(`/route/${route.id}` as Href)}>
        <View style={styles.routeFeatureMedia}>
          <Image
            source={route.cover}
            contentFit="cover"
            style={styles.cardImage}
          />
          <LinearGradient
            colors={[
              "rgba(43,34,51,0.06)",
              "rgba(43,34,51,0.24)",
              "rgba(25,19,29,0.84)",
            ]}
            locations={[0, 0.42, 1]}
            pointerEvents="none"
            style={StyleSheet.absoluteFill}
          />

          <View style={styles.routeFeatureTopRow}>
            <Badge text={route.era} />
            <View style={styles.routeActionBubble}>
              <SymbolView
                name={quickActionIcon}
                size={13}
                tintColor="#FFFFFF"
              />
            </View>
          </View>

          <View style={styles.routeFeatureBottom}>
            <Text
              className="text-[15px] font-extrabold text-white"
              style={styles.routeFeatureTitle}
              numberOfLines={1}
            >
              {route.title}
            </Text>
            <View className="mt-2 flex-row flex-wrap items-center gap-x-3 gap-y-1">
              <RouteStat
                icon={{
                  ios: "point.bottomleft.forward.to.point.topright.scurvepath.fill",
                  android: "route",
                  web: "route",
                }}
                label={route.distance}
              />
              <RouteStat
                icon={{ ios: "clock.fill", android: "schedule", web: "schedule" }}
                label={route.duration}
              />
              <RouteStat
                icon={{
                  ios: "mappin.and.ellipse",
                  android: "location_on",
                  web: "location_on",
                }}
                label={`${route.hotspotIds.length} điểm`}
              />
            </View>
          </View>

          <View style={styles.routeXpPill}>
            <Text className="text-[11px] font-extrabold text-[#FF4F86]">
              +{route.xp} XP
            </Text>
          </View>
        </View>
      </Pressable>

      {variant === "active" && progress !== undefined && (
        <View className="border-t border-[#F6E8EE] px-4 pb-4">
          <View className="mb-2 mt-3 flex-row items-center justify-between">
            <Text className="text-[11px] font-bold text-[#2B2233]">
              Tiến độ {Math.round(progress)}%
            </Text>
            {progressInfo ? (
              <Text className="text-[11px] font-semibold text-[#8E869A]">
                {progressInfo.completedStops}/{progressInfo.totalStops} điểm
              </Text>
            ) : null}
          </View>
          <XPBar
            value={progress}
            max={100}
            trackColor="#F6E5EB"
            height={6}
            fillColors={["#FF7AA8", "#FF4F86"]}
          />

          <View className="mt-3 flex-row gap-2">
            <Pressable
              className="flex-1 rounded-[16px] bg-[#FF4F86] py-2.5"
              onPress={() => router.push(`/route/${route.id}` as Href)}
            >
              <Text className="text-center text-[12px] font-extrabold text-white">
                Tiếp tục
              </Text>
            </Pressable>
            {progressId !== undefined && onAbandonRoute ? (
              <Pressable
                className={`flex-1 rounded-[16px] border border-[#F7C7D1] bg-[#FFF5F8] py-2.5 ${abandoningProgressId === progressId ? "opacity-70" : ""}`}
                onPress={() => onAbandonRoute(progressId)}
                disabled={abandoningProgressId === progressId}
              >
                <Text className="text-center text-[12px] font-extrabold text-[#B42345]">
                  {abandoningProgressId === progressId
                    ? "Đang bỏ..."
                    : "Bỏ tuyến"}
                </Text>
              </Pressable>
            ) : null}
          </View>
        </View>
      )}

    </View>
  );
}

function RouteStat({
  icon,
  label,
}: {
  icon: SymbolName;
  label: string;
}) {
  return (
    <View className="flex-row items-center gap-1.5">
      <SymbolView name={icon} size={11} tintColor="rgba(255,255,255,0.94)" />
      <Text className="text-[11px] font-medium text-white/92">{label}</Text>
    </View>
  );
}

function RouteMetaInline({
  icon,
  label,
}: {
  icon: SymbolName;
  label: string;
}) {
  return (
    <View className="flex-row items-center gap-1.5">
      <SymbolView name={icon} size={12} tintColor="#8E869A" />
      <Text className="text-[11px] text-[#6F657A]">{label}</Text>
    </View>
  );
}

function Badge({ text }: { text: string }) {
  return (
    <View className="rounded-full bg-[#FF5F8D] px-3 py-1">
      <Text className="text-[10px] font-extrabold text-white">{text}</Text>
    </View>
  );
}

function EmptyState({ text }: { text?: string }) {
  return (
    <View className="items-center rounded-[24px] border border-[#F4E2E8] bg-[#FFF9FB] px-6 py-10">
      <View className="h-14 w-14 items-center justify-center rounded-full bg-[#FFF0F4]">
        <SymbolView
          name={{ ios: "sparkles", android: "auto_awesome", web: "auto_awesome" }}
          size={28}
          tintColor="#FF4F86"
        />
      </View>
      {text ? (
        <Text className="mt-3 text-center text-[13px] leading-5 text-[#8E869A]">
          {text}
        </Text>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  heroShell: {
    backgroundColor: "#FDF7F8",
    overflow: "hidden",
    position: "relative",
    width: "100%",
    zIndex: 1,
  },
  heroBannerImage: {
    bottom: 0,
    left: 0,
    position: "absolute",
    right: 0,
    top: 0,
  },
  contentFrame: {
    alignSelf: "center",
    maxWidth: 520,
    width: "100%",
  },
  heroEyebrow: {
    color: "#FF6E98",
    fontSize: 12,
    fontWeight: "800",
    letterSpacing: 1.1,
    lineHeight: lineHeightFor(12),
  },
  heroTitle: {
    color: "#2B2233",
    fontSize: 20,
    fontWeight: "900",
    lineHeight: lineHeightFor(20),
    marginTop: 3,
  },
  tabRow: {
    backgroundColor: "#FFFFFF",
    borderRadius: 22,
    gap: 3,
    paddingHorizontal: 2,
    paddingVertical: 2,
  },
  tabButton: {
    alignItems: "center",
    borderColor: "transparent",
    borderRadius: 20,
    borderWidth: 1,
    gap: 4,
    justifyContent: "center",
    minHeight: 56,
    minWidth: 76,
    overflow: "hidden",
    paddingHorizontal: 8,
    paddingVertical: 6,
    position: "relative",
  },
  tabButtonSelected: {
    borderColor: "#FFDCE7",
  },
  tabLabel: {
    color: "#8E869A",
    flexShrink: 1,
    fontSize: 9.5,
    fontWeight: "700",
    lineHeight: lineHeightFor(10),
    textAlign: "center",
  },
  tabLabelSelected: {
    color: "#FF4F86",
  },
  tabIconWrap: {
    alignItems: "center",
    backgroundColor: "#F8F5F6",
    borderRadius: 14,
    height: 26,
    justifyContent: "center",
    width: 26,
  },
  tabIconWrapSelected: {
    backgroundColor: "#FFF0F4",
  },
  sectionTitle: {
    color: "#2B2233",
    fontSize: 17,
    fontWeight: "800",
    lineHeight: 22,
  },
  sectionActionLabel: {
    color: "#FF4F86",
    fontSize: 11,
    fontWeight: "800",
  },
  officialRouteMedia: {
    height: 132,
    overflow: "hidden",
    position: "relative",
  },
  officialRouteTopRow: {
    alignItems: "center",
    flexDirection: "row",
    justifyContent: "space-between",
    left: 12,
    position: "absolute",
    right: 12,
    top: 12,
  },
  officialRouteHeart: {
    alignItems: "center",
    backgroundColor: "rgba(43,34,51,0.18)",
    borderColor: "rgba(255,255,255,0.28)",
    borderRadius: 999,
    borderWidth: 1,
    height: 28,
    justifyContent: "center",
    width: 28,
  },
  officialRouteTitle: {
    includeFontPadding: false,
    // Chỉ tiêu đề thẻ được in đậm, mọi dòng meta bên dưới để chữ thường.
    fontWeight: "700",
    lineHeight: lineHeightFor(15),
  },
  officialRouteXpPill: {
    alignItems: "center",
    backgroundColor: "#FFF1F5",
    borderRadius: 999,
    justifyContent: "center",
    paddingHorizontal: 12,
    paddingVertical: 7,
  },
  cardImageWrap: {
    height: 112,
    overflow: "hidden",
    position: "relative",
  },
  routeFeatureMedia: {
    height: 176,
    overflow: "hidden",
    position: "relative",
  },
  cardImage: {
    height: "100%",
    width: "100%",
  },
  levelBadge: {
    alignItems: "center",
    borderColor: "#FFFFFF",
    borderRadius: 14,
    borderWidth: 2,
    bottom: -2,
    height: 28,
    justifyContent: "center",
    position: "absolute",
    right: -4,
    width: 28,
  },
  levelBadgeText: {
    color: "#FFFFFF",
    fontSize: 12,
    fontWeight: "900",
    includeFontPadding: false,
    lineHeight: lineHeightFor(12),
  },
  levelTitleText: {
    includeFontPadding: false,
    fontSize: 15,
    lineHeight: lineHeightFor(15),
  },
  routeFeatureTopRow: {
    alignItems: "center",
    flexDirection: "row",
    justifyContent: "space-between",
    left: 12,
    position: "absolute",
    right: 12,
    top: 12,
  },
  routeActionBubble: {
    alignItems: "center",
    backgroundColor: "rgba(255,255,255,0.18)",
    borderColor: "rgba(255,255,255,0.26)",
    borderRadius: 999,
    borderWidth: 1,
    height: 32,
    justifyContent: "center",
    width: 32,
  },
  routeFeatureBottom: {
    bottom: 14,
    left: 12,
    paddingRight: 88,
    position: "absolute",
    right: 12,
  },
  routeFeatureTitle: {
    includeFontPadding: false,
    lineHeight: lineHeightFor(15),
  },
  routeXpPill: {
    alignItems: "center",
    backgroundColor: "#FFFFFF",
    borderRadius: 999,
    bottom: 14,
    justifyContent: "center",
    paddingHorizontal: 12,
    paddingVertical: 6,
    position: "absolute",
    right: 12,
  },
});
