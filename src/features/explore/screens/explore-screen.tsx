import { Image } from 'expo-image';
import { LinearGradient } from 'expo-linear-gradient';
import * as Location from 'expo-location';
import { type Href, useFocusEffect, useRouter } from 'expo-router';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  ActivityIndicator,
  FlatList,
  Pressable,
  ScrollView,
  Text,
  useWindowDimensions,
  View,
} from 'react-native';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useTranslation } from 'react-i18next';

import { SymbolView } from '@/components/ui/symbol-view';
import { UserAvatar } from '@/components/ui/user-avatar';
import { getValidAccessToken, useAuthSession } from '@/features/auth/hooks/use-auth-session';
import { AppMap, type AppMapPoint } from '@/features/map/components/app-map';
import { getGamificationLevels } from '@/features/profile/api/get-levels';
import { getMyProfile } from '@/features/profile/api/get-me';
import { setPremiumStatusFromProfile, usePremiumStatus } from '@/features/profile/hooks/use-premium-status';
import { applyLevelProgressToProfile } from '@/features/profile/lib/level-progress';
import {
  type NearbyHotspotDto,
  getNearbyHotspots,
} from '@/features/home/api/get-nearby-hotspots';
import {
  getApiHotspotRouteSlug,
  getHotspotHref,
} from '@/features/home/data/hotspots';
import {
  getRouteCoverUrl,
  getRouteStopCount,
  searchRoutes,
  type RouteDto,
} from '@/features/route/api/route-api';
import {
  ExploreBottomSheet,
  getExploreSheetHeights,
  type ExploreSheetSnap,
} from '@/features/explore/components/explore-bottom-sheet';
import { useCheckedInApiHotspots } from '@/lib/checkin-store';
import {
  type AppCoordinate,
  ensureForegroundLocationPermission,
  formatDistance,
  getDevelopmentLocationOverride,
  getDeviceCoordinate,
  getDistanceMeters,
} from '@/lib/location';

const gradientColors = ['#EB489B', '#F58752', '#FFC93C'] as const;
const fallbackRouteImage =
  'https://i.pinimg.com/1200x/80/69/f9/8069f9581583a196f9f39bda000b9312.jpg';
const fallbackPlaceImage =
  'https://i.pinimg.com/736x/f3/0f/e8/f30fe84218790e6ffd25f987d434eb13.jpg';
const defaultCoordinate: AppCoordinate = {
  latitude: 10.7769,
  longitude: 106.7009,
  accuracy: null,
  source: 'dev-override',
};

/** Bán kính tìm quanh vị trí hiện tại, tính bằng km. */
const radiusOptions = [1, 3, 5, 10] as const;
const defaultRadiusKm = 5;

const allTagsKey = 'all';

/** Thẻ địa điểm trong sheet cao cố định để `getItemLayout` cuộn tới đúng thẻ. */
const placeRowHeight = 96;
const placeRowGap = 12;

/**
 * Sheet chia đúng như tab Hành trình: tuyến do hệ thống xuất bản (OFFICIAL) và
 * tuyến do người dùng khác chia sẻ (CUSTOM) là hai nhóm riêng.
 */
type ExploreSheetTab = 'places' | 'official' | 'community';

const markerColors = {
  checkedIn: '#B7B2BE',
  default: '#5B9BFF',
  routeStop: '#7C3AED',
  selected: '#EB489B',
} as const;

type ExplorerSummary = {
  avatar: string | null;
  isPremium: boolean;
  level: number | null;
  name: string;
  username: string;
};

type ExplorePlace = {
  category: string;
  distanceMeters: number | null;
  hotspotId: number;
  imageUri: string;
  isCheckedIn: boolean;
  latitude: number;
  longitude: number;
  rating: number | null;
  reviews: number;
  title: string;
  xp: number;
};

function ExplorerHeaderAvatar({
  avatar,
  level,
  name,
  username,
}: Omit<ExplorerSummary, 'isPremium'>) {
  return (
    <View className="relative">
      <LinearGradient
        colors={gradientColors}
        end={{ x: 1, y: 0.9 }}
        start={{ x: 0, y: 0.1 }}
        className="h-11 w-11 rounded-full p-[2px]"
      >
        <View className="flex-1 items-center justify-center rounded-full bg-white p-[2px]">
          <UserAvatar
            displayName={name}
            size={35}
            uri={avatar}
            username={username}
          />
        </View>
      </LinearGradient>

      {typeof level === 'number' ? (
        <View className="absolute -bottom-1 -right-1 rounded-full border-2 border-white bg-[#b1741e] px-1.5 py-[1px]">
          <Text className="text-[9px] font-extrabold text-white">{`Lv.${level}`}</Text>
        </View>
      ) : null}
    </View>
  );
}

function getHotspotImage(hotspot: NearbyHotspotDto) {
  const image = hotspot.medias.find((media) => {
    const kind = `${media.mediaType ?? ''} ${media.mimeType ?? ''}`.toLowerCase();
    return kind.includes('image');
  }) ?? hotspot.medias[0];

  return image?.fileUrl || fallbackPlaceImage;
}

function getRouteImage(route: RouteDto) {
  return getRouteCoverUrl(route) || fallbackRouteImage;
}

function mapHotspotToPlace(
  hotspot: NearbyHotspotDto,
  origin: AppCoordinate | null,
  fallbackCategory: string,
): ExplorePlace {
  return {
    category: hotspot.tags[0]?.tagName?.trim() || fallbackCategory,
    distanceMeters: origin
      ? getDistanceMeters(origin, {
          latitude: hotspot.latitude,
          longitude: hotspot.longitude,
        })
      : null,
    hotspotId: hotspot.hotspotId,
    imageUri: getHotspotImage(hotspot),
    isCheckedIn: hotspot.isCheckedIn === true,
    latitude: hotspot.latitude,
    longitude: hotspot.longitude,
    rating: typeof hotspot.averageRating === 'number' ? hotspot.averageRating : null,
    reviews: hotspot.totalReviews ?? 0,
    title: hotspot.hotspotName,
    xp: hotspot.xp ?? hotspot.point ?? 0,
  };
}

function getRouteStopCoordinates(route: RouteDto | null) {
  if (!route) {
    return [];
  }

  return (route.hotspots ?? [])
    .filter(
      (stop) =>
        Number.isFinite(Number(stop.latitude)) &&
        Number.isFinite(Number(stop.longitude)),
    )
    .map((stop) => ({
      latitude: Number(stop.latitude),
      longitude: Number(stop.longitude),
    }));
}

function FilterChip({
  active,
  label,
  onPress,
}: {
  active: boolean;
  label: string;
  onPress: () => void;
}) {
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityState={{ selected: active }}
      className={`mr-2 rounded-full border px-3.5 py-2 ${
        active ? 'border-[#EB489B] bg-[#EB489B]' : 'border-[#EEF1F4] bg-white'
      }`}
      onPress={onPress}
    >
      <Text
        className={`text-[12px] font-bold ${active ? 'text-white' : 'text-[#6F6678]'}`}
      >
        {label}
      </Text>
    </Pressable>
  );
}

function MapControlButton({
  accessibilityLabel,
  backgroundColor,
  icon,
  onPress,
  tintColor,
}: {
  accessibilityLabel: string;
  backgroundColor: string;
  icon: Parameters<typeof SymbolView>[0]['name'];
  onPress: () => void;
  tintColor: string;
}) {
  return (
    <Pressable
      accessibilityLabel={accessibilityLabel}
      accessibilityRole="button"
      className="h-11 w-11 items-center justify-center rounded-[16px]"
      onPress={onPress}
      style={{
        backgroundColor,
        elevation: 6,
        shadowColor: 'rgba(31, 22, 48, 0.2)',
        shadowOffset: { height: 6, width: 0 },
        shadowOpacity: 1,
        shadowRadius: 12,
      }}
    >
      <SymbolView name={icon} size={19} tintColor={tintColor} />
    </Pressable>
  );
}

/**
 * Nút hành động nổi trên bản đồ, dạng viên thuốc có nhãn chữ.
 *
 * Vì sao không để icon trơn như nút định vị: biểu tượng "tia sáng" và "chấm ghi
 * hình" không có nghĩa phổ quát, người dùng phải bấm thử mới biết nó làm gì.
 * Nút định vị thì giữ nguyên icon trơn vì đó là quy ước ai cũng hiểu.
 */
function MapActionButton({
  backgroundColor,
  icon,
  isPro,
  label,
  onPress,
}: {
  backgroundColor: string;
  icon: Parameters<typeof SymbolView>[0]['name'];
  isPro?: boolean;
  label: string;
  onPress: () => void;
}) {
  return (
    <Pressable
      accessibilityRole="button"
      className="h-11 flex-row items-center rounded-full pl-3 pr-3.5"
      onPress={onPress}
      style={{
        backgroundColor,
        elevation: 6,
        shadowColor: 'rgba(31, 22, 48, 0.2)',
        shadowOffset: { height: 6, width: 0 },
        shadowOpacity: 1,
        shadowRadius: 12,
      }}
    >
      <SymbolView name={icon} size={17} tintColor="#FFFFFF" />

      <Text className="ml-1.5 text-[12px] font-extrabold text-white">
        {label}
      </Text>

      {isPro ? (
        <View className="ml-1.5 rounded-full bg-white/25 px-1.5 py-[1px]">
          <Text className="text-[9px] font-extrabold text-white">PRO</Text>
        </View>
      ) : null}
    </Pressable>
  );
}

function SheetEmptyState({
  description,
  title,
}: {
  description: string;
  title: string;
}) {
  return (
    <View className="mx-4 rounded-[22px] border border-[#EEF1F4] bg-[#FAF7FC] px-4 py-4">
      <Text className="text-[15px] font-bold text-[#3B4454]">{title}</Text>
      <Text className="mt-1 text-[13px] leading-5 text-[#8E869A]">
        {description}
      </Text>
    </View>
  );
}

export default function ExploreScreen() {
  const router = useRouter();
  const session = useAuthSession();
  const { requirePremium } = usePremiumStatus();
  const { height, width } = useWindowDimensions();
  const { t } = useTranslation();
  const checkedInHotspotIds = useCheckedInApiHotspots();

  const [activeTag, setActiveTag] = useState<string>(allTagsKey);
  const [radiusKm, setRadiusKm] = useState<number>(defaultRadiusKm);
  const [onlyNotVisited, setOnlyNotVisited] = useState(false);
  const [sheetSnap, setSheetSnap] = useState<ExploreSheetSnap>('half');
  const [sheetTab, setSheetTab] = useState<ExploreSheetTab>('places');
  const [selectedPlaceId, setSelectedPlaceId] = useState<number | null>(null);
  const [selectedRouteId, setSelectedRouteId] = useState<number | null>(null);
  const [places, setPlaces] = useState<ExplorePlace[]>([]);
  const [officialRoutes, setOfficialRoutes] = useState<RouteDto[]>([]);
  const [communityRoutes, setCommunityRoutes] = useState<RouteDto[]>([]);
  const [isPlacesLoading, setIsPlacesLoading] = useState(true);
  const [isRoutesLoading, setIsRoutesLoading] = useState(true);
  const [placeError, setPlaceError] = useState<string | null>(null);
  const [routeError, setRouteError] = useState<string | null>(null);
  const [explorerSummary, setExplorerSummary] = useState<ExplorerSummary | null>(null);
  const [mapAreaHeight, setMapAreaHeight] = useState(0);
  const [reloadToken, setReloadToken] = useState(0);
  const placeListRef = useRef<FlatList<ExplorePlace>>(null);

  const safeWidth = Math.max(width, 320);
  const sheetHeights = useMemo(
    () => getExploreSheetHeights(mapAreaHeight || height),
    [height, mapAreaHeight],
  );
  // Phải memo: AppMap dùng object này trong dependency của effect fit map, tạo
  // mới mỗi lần render sẽ khiến bản đồ tự animate lại liên tục.
  const mapEdgePadding = useMemo(
    () => ({
      bottom: sheetHeights.peek + 40,
      left: 48,
      right: 48,
      top: 56,
    }),
    [sheetHeights.peek],
  );

  const visiblePlaces = useMemo(() => {
    const checkedInSet = new Set(checkedInHotspotIds);

    return places
      .map((place) => ({
        ...place,
        isCheckedIn: place.isCheckedIn || checkedInSet.has(place.hotspotId),
      }))
      .filter((place) => {
        if (activeTag !== allTagsKey && place.category !== activeTag) {
          return false;
        }

        return !(onlyNotVisited && place.isCheckedIn);
      })
      .sort((left, right) => {
        if (left.distanceMeters === null || right.distanceMeters === null) {
          return 0;
        }

        return left.distanceMeters - right.distanceMeters;
      });
  }, [activeTag, checkedInHotspotIds, onlyNotVisited, places]);

  const tagOptions = useMemo(() => {
    const seen = new Map<string, number>();

    for (const place of places) {
      seen.set(place.category, (seen.get(place.category) ?? 0) + 1);
    }

    return Array.from(seen.entries())
      .sort((left, right) => right[1] - left[1])
      .slice(0, 8)
      .map(([label]) => label);
  }, [places]);

  const visibleRoutes = sheetTab === 'community' ? communityRoutes : officialRoutes;

  const selectedRoute = useMemo(
    () =>
      [...officialRoutes, ...communityRoutes].find(
        (route) => route.routeId === selectedRouteId,
      ) ?? null,
    [communityRoutes, officialRoutes, selectedRouteId],
  );

  const routeCoordinates = useMemo(
    () => getRouteStopCoordinates(selectedRoute),
    [selectedRoute],
  );

  const mapPoints = useMemo<AppMapPoint[]>(() => {
    if (selectedRoute) {
      return (selectedRoute.hotspots ?? [])
        .filter(
          (stop) =>
            Number.isFinite(Number(stop.latitude)) &&
            Number.isFinite(Number(stop.longitude)),
        )
        .map((stop) => ({
          accentColor: markerColors.routeStop,
          id: `route-stop-${stop.hotspotId}`,
          latitude: Number(stop.latitude),
          longitude: Number(stop.longitude),
          title: stop.hotspotName || selectedRoute.routeName,
          description: stop.address,
        }));
    }

    return visiblePlaces.map((place) => ({
      accentColor:
        place.hotspotId === selectedPlaceId
          ? markerColors.selected
          : place.isCheckedIn
            ? markerColors.checkedIn
            : markerColors.default,
      id: place.hotspotId,
      latitude: place.latitude,
      longitude: place.longitude,
      title: place.title,
      description: place.category,
    }));
  }, [selectedPlaceId, selectedRoute, visiblePlaces]);

  useFocusEffect(
    useCallback(() => {
      let isActive = true;

      async function loadExplorerSummary() {
        if (!session.isAuthenticated) {
          if (isActive) setExplorerSummary(null);
          return;
        }

        try {
          const accessToken = await getValidAccessToken();
          if (!isActive) return;

          if (!accessToken) {
            setExplorerSummary(null);
            return;
          }

          const [profileResult, levelsResult] = await Promise.allSettled([
            getMyProfile({ accessToken, tokenType: session.tokenType }),
            getGamificationLevels({ accessToken, tokenType: session.tokenType }),
          ]);

          if (profileResult.status !== 'fulfilled') throw profileResult.reason;

          const profile =
            levelsResult.status === 'fulfilled'
              ? applyLevelProgressToProfile(profileResult.value, levelsResult.value)
              : profileResult.value;

          if (!isActive) return;

          const resolvedName = profile.name.trim() || profile.username.trim();
          // Đẩy isPremium vào store dùng chung để các màn/hành động Premium
          // khác trong app (VD nút "Ghi hành trình") đọc được giá trị mới
          // nhất mà không phải tự gọi lại getMyProfile().
          setPremiumStatusFromProfile(profile.isPremium);
          setExplorerSummary({
            avatar: profile.avatar?.trim() || null,
            isPremium: profile.isPremium,
            level: profile.level,
            name: resolvedName,
            username: profile.username.trim(),
          });
        } catch (error) {
          if (!isActive) return;
          setExplorerSummary(null);
          console.warn('[explore] load explorer summary failed', {
            error: error instanceof Error ? error.message : error,
          });
        }
      }

      void loadExplorerSummary();
      return () => {
        isActive = false;
      };
    }, [session.isAuthenticated, session.tokenType]),
  );

  useEffect(() => {
    let cancelled = false;

    async function loadRoutes() {
      setIsRoutesLoading(true);
      setRouteError(null);

      try {
        const accessToken = await getValidAccessToken();
        // Cùng hai nguồn với tab Hành trình: OFFICIAL là tuyến hệ thống xuất
        // bản, CUSTOM là tuyến người dùng chia sẻ sau khi được duyệt.
        const [officialResult, communityResult] = await Promise.allSettled([
          searchRoutes({
            accessToken,
            page: 0,
            size: 20,
            sortBy: 'routeId',
            sortDirection: 'DESC',
            status: 'PUBLISHED',
            tokenType: session.tokenType,
            type: 'OFFICIAL',
          }),
          searchRoutes({
            accessToken,
            page: 0,
            size: 20,
            sortBy: 'routeId',
            sortDirection: 'DESC',
            status: 'PUBLISHED',
            tokenType: session.tokenType,
            type: 'CUSTOM',
          }),
        ]);

        if (cancelled) return;

        setOfficialRoutes(
          officialResult.status === 'fulfilled'
            ? officialResult.value.content
            : [],
        );
        setCommunityRoutes(
          communityResult.status === 'fulfilled'
            ? communityResult.value.content
            : [],
        );

        if (officialResult.status === 'rejected') {
          console.warn('[explore] load official routes failed', {
            error: officialResult.reason,
          });
        }

        if (communityResult.status === 'rejected') {
          console.warn('[explore] load community routes failed', {
            error: communityResult.reason,
          });
        }

        setRouteError(
          officialResult.status === 'rejected' &&
            communityResult.status === 'rejected'
            ? t('explore.routes.loadError')
            : null,
        );
      } catch (error) {
        if (cancelled) return;
        setOfficialRoutes([]);
        setCommunityRoutes([]);
        setRouteError(
          error instanceof Error ? error.message : t('explore.routes.loadError'),
        );
      } finally {
        if (!cancelled) setIsRoutesLoading(false);
      }
    }

    void loadRoutes();

    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [session.tokenType]);

  useEffect(() => {
    let cancelled = false;

    async function loadNearbyPlaces() {
      setIsPlacesLoading(true);
      setPlaceError(null);

      try {
        const permission = getDevelopmentLocationOverride()
          ? { status: Location.PermissionStatus.GRANTED }
          : await ensureForegroundLocationPermission();

        const coordinate =
          getDevelopmentLocationOverride() ??
          (permission.status === Location.PermissionStatus.GRANTED
            ? await getDeviceCoordinate({
                accuracy: Location.Accuracy.Balanced,
                maxAge: 60_000,
                mayShowUserSettingsDialog: true,
                requiredAccuracy: 1000,
              })
            : null) ??
          defaultCoordinate;

        const accessToken = await getValidAccessToken();
        const hotspots = await getNearbyHotspots({
          accessToken,
          distance: radiusKm,
          latitude: coordinate.latitude,
          longitude: coordinate.longitude,
          tokenType: session.tokenType,
        });

        if (cancelled) return;

        setPlaces(
          hotspots.map((hotspot) =>
            mapHotspotToPlace(
              hotspot,
              coordinate,
              t('explore.categories.heritage'),
            ),
          ),
        );
      } catch (error) {
        if (cancelled) return;
        setPlaces([]);
        setPlaceError(
          error instanceof Error ? error.message : t('explore.places.loadError'),
        );
      } finally {
        if (!cancelled) setIsPlacesLoading(false);
      }
    }

    void loadNearbyPlaces();

    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [radiusKm, reloadToken, session.tokenType]);

  function openRoute(routeId: number) {
    router.push(`/route/${routeId}` as Href);
  }

  function openPlace(hotspotId: number) {
    if (!Number.isInteger(hotspotId) || hotspotId <= 0) {
      return;
    }

    router.push(getHotspotHref(getApiHotspotRouteSlug(hotspotId), hotspotId));
  }

  function focusPlace(hotspotId: number) {
    setSelectedRouteId(null);
    setSelectedPlaceId(hotspotId);
    setSheetSnap('peek');

    const index = visiblePlaces.findIndex(
      (place) => place.hotspotId === hotspotId,
    );

    if (index >= 0) {
      placeListRef.current?.scrollToIndex({ animated: true, index });
    }
  }

  function handleMarkerPress(point: AppMapPoint) {
    // Khi đang xem một tuyến, ghim trên bản đồ là điểm dừng của tuyến đó nên
    // chạm vào sẽ mở thẳng chi tiết điểm dừng.
    if (selectedRoute) {
      openPlace(Number(`${point.id}`.replace('route-stop-', '')));
      return;
    }

    const hotspotId = Number(point.id);

    if (!Number.isInteger(hotspotId)) {
      return;
    }

    setSheetTab('places');
    focusPlace(hotspotId);
  }

  function handlePlaceRowPress(place: ExplorePlace) {
    if (place.hotspotId === selectedPlaceId) {
      openPlace(place.hotspotId);
      return;
    }

    focusPlace(place.hotspotId);
  }

  function handleRouteRowPress(route: RouteDto) {
    if (route.routeId === selectedRouteId) {
      openRoute(route.routeId);
      return;
    }

    setSelectedPlaceId(null);
    setSelectedRouteId(route.routeId);
    setSheetSnap('peek');
  }

  const explorerName =
    explorerSummary?.name.trim() ||
    session.displayName.trim() ||
    session.username?.trim() ||
    '';
  const explorerUsername =
    explorerSummary?.username.trim() || session.username?.trim() || explorerName;

  const sheetHeader = (
    <View className="gap-3">
      <View className="flex-row items-center gap-1.5">
        {(['places', 'official', 'community'] as const).map((tab) => {
          const active = tab === sheetTab;

          return (
            <Pressable
              accessibilityRole="button"
              accessibilityState={{ selected: active }}
              className={`rounded-full px-3 py-1.5 ${active ? 'bg-[#FDEBF3]' : 'bg-[#F5F3F7]'}`}
              key={tab}
              onPress={() => {
                setSheetTab(tab);
                setSelectedRouteId(null);
              }}
            >
              <Text
                className={`text-[12px] font-bold ${active ? 'text-[#EB489B]' : 'text-[#8E869A]'}`}
              >
                {t(`explore.sheet.tab.${tab}`)}
              </Text>
            </Pressable>
          );
        })}

        <View className="flex-1" />

        <Text className="text-[12px] font-semibold text-[#8E869A]">
          {sheetTab === 'places'
            ? t('explore.sheet.placesCount', { count: visiblePlaces.length })
            : t('explore.sheet.routesCount', { count: visibleRoutes.length })}
        </Text>
      </View>

      {selectedRoute ? (
        <Pressable
          className="flex-row items-center justify-between rounded-[16px] bg-[#F6F1FF] px-3 py-2.5"
          onPress={() => setSelectedRouteId(null)}
        >
          <Text className="flex-1 text-[12px] font-bold text-[#5B21B6]" numberOfLines={1}>
            {t('explore.sheet.showingRoute', { name: selectedRoute.routeName })}
          </Text>
          <Text className="text-[12px] font-bold text-[#7C3AED]">
            {t('explore.sheet.clearRoute')}
          </Text>
        </Pressable>
      ) : null}
    </View>
  );

  return (
    <GestureHandlerRootView style={{ flex: 1 }}>
      <SafeAreaView className="flex-1 bg-white" edges={['top', 'left', 'right']}>
        {/* Header nằm trên nền trắng riêng thay vì nổi trên bản đồ: chữ và chip
            lọc không còn bị hoạ tiết bản đồ nuốt mất. */}
        <View
          className="gap-2.5 bg-white px-4 pb-2.5 pt-2"
          style={{
            elevation: 4,
            shadowColor: 'rgba(31, 22, 48, 0.12)',
            shadowOffset: { height: 4, width: 0 },
            shadowOpacity: 1,
            shadowRadius: 10,
            zIndex: 10,
          }}
        >
          <View className="flex-row items-center gap-2.5">
            <ExplorerHeaderAvatar
              avatar={explorerSummary?.avatar ?? null}
              level={explorerSummary?.level ?? null}
              name={explorerName}
              username={explorerUsername}
            />

            <Pressable
              accessibilityRole="search"
              className="h-11 flex-1 flex-row items-center rounded-full border border-[#EEF1F4] bg-[#FAF7FC] px-4"
              onPress={() => router.push('/hotspots/search' as Href)}
            >
              <SymbolView
                name={{ ios: 'magnifyingglass', android: 'search', web: 'search' }}
                size={16}
                tintColor="#AA9FB0"
              />
              <Text className="ml-2 flex-1 text-[13px] text-[#AA9FB0]" numberOfLines={1}>
                {t('explore.search.placeholder')}
              </Text>
            </Pressable>

            <Pressable
              accessibilityLabel={t('explore.a11y.notifications')}
              accessibilityRole="button"
              className="h-11 w-11 items-center justify-center rounded-[16px] bg-[#FFF1F6]"
              hitSlop={6}
              onPress={() => router.push('/notifications' as Href)}
            >
              <SymbolView
                name={{ ios: 'bell', android: 'notifications', web: 'notifications' }}
                size={19}
                tintColor="#EB489B"
              />
            </Pressable>
          </View>

          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            contentContainerStyle={{ paddingRight: 8, paddingVertical: 2 }}
            style={{ marginHorizontal: -16, paddingHorizontal: 16, width: safeWidth }}
          >
            {radiusOptions.map((option) => (
              <FilterChip
                active={option === radiusKm}
                key={`radius-${option}`}
                label={t('explore.filters.radius', { value: option })}
                onPress={() => {
                  setRadiusKm(option);
                  setSelectedPlaceId(null);
                }}
              />
            ))}

            <View className="mr-2 h-6 w-px self-center bg-[#E3E0E8]" />

            <FilterChip
              active={onlyNotVisited}
              label={t('explore.filters.notVisited')}
              onPress={() => setOnlyNotVisited((current) => !current)}
            />

            <FilterChip
              active={activeTag === allTagsKey}
              label={t('explore.filters.allTags')}
              onPress={() => setActiveTag(allTagsKey)}
            />

            {tagOptions.map((tag) => (
              <FilterChip
                active={activeTag === tag}
                key={`tag-${tag}`}
                label={tag}
                onPress={() =>
                  setActiveTag((current) => (current === tag ? allTagsKey : tag))
                }
              />
            ))}
          </ScrollView>
        </View>

        <View
          className="flex-1 overflow-hidden"
          onLayout={(event) => setMapAreaHeight(event.nativeEvent.layout.height)}
        >
          {mapAreaHeight > 0 ? (
            <AppMap
              borderRadius={0}
              connectPointsWhenRouteMissing={false}
              fitEdgePadding={mapEdgePadding}
              focusVerticalOffsetRatio={0.18}
              focusedPointId={selectedPlaceId}
              height={mapAreaHeight}
              highlightedPointId={selectedPlaceId}
              onPointPress={handleMarkerPress}
              points={mapPoints}
              routeCoordinates={routeCoordinates}
              showsMyLocationButton={false}
              showsUserLocation
            />
          ) : null}

          <View
            className="absolute right-4 items-end gap-2.5"
            style={{ bottom: sheetHeights.peek + 16 }}
          >
            <MapControlButton
              accessibilityLabel={t('explore.a11y.recenter')}
              backgroundColor="#FFFFFF"
              icon={{ ios: 'location', android: 'my_location', web: 'my_location' }}
              onPress={() => {
                setSelectedPlaceId(null);
                setSelectedRouteId(null);
                setReloadToken((current) => current + 1);
              }}
              tintColor="#2B2233"
            />

            {/* Hai lối tắt Premium, thay cho hàng nút Plan/Record cũ ở đầu màn. */}
            <MapActionButton
              backgroundColor="#7C3AED"
              icon={{ ios: 'sparkles', android: 'auto_awesome', web: 'auto_awesome' }}
              isPro
              label={t('explore.actions.plan')}
              onPress={() => {
                if (!requirePremium(t('explore.actions.planPremiumFeature'))) return;

                router.push('/route/custom/plan');
              }}
            />

            <MapActionButton
              backgroundColor="#EB489B"
              icon={{
                ios: 'record.circle',
                android: 'radio_button_checked',
                web: 'radio_button_checked',
              }}
              isPro
              label={t('explore.actions.record')}
              onPress={() => {
                if (!requirePremium(t('explore.actions.recordPremiumFeature'))) return;

                router.push('/route/custom/record');
              }}
            />
          </View>

          <ExploreBottomSheet
            header={sheetHeader}
            maxHeight={mapAreaHeight || height}
            onSnapChange={setSheetSnap}
            snap={sheetSnap}
          >
            {sheetTab === 'places' ? (
              isPlacesLoading ? (
                <View className="items-center py-8">
                  <ActivityIndicator color="#EB489B" />
                </View>
              ) : visiblePlaces.length === 0 ? (
                <SheetEmptyState
                  description={
                    placeError ??
                    t('explore.sheet.emptyPlacesDescription', { radius: radiusKm })
                  }
                  title={t('explore.sheet.emptyPlacesTitle')}
                />
              ) : (
                <FlatList
                  contentContainerStyle={{
                    gap: placeRowGap,
                    paddingBottom: 28,
                    paddingHorizontal: 16,
                    paddingTop: 6,
                  }}
                  data={visiblePlaces}
                  getItemLayout={(_data, index) => ({
                    index,
                    length: placeRowHeight + placeRowGap,
                    offset: (placeRowHeight + placeRowGap) * index,
                  })}
                  keyExtractor={(place) => `${place.hotspotId}`}
                  onScrollToIndexFailed={() => {}}
                  ref={placeListRef}
                  renderItem={({ item }) => {
                    const selected = item.hotspotId === selectedPlaceId;

                    return (
                      <Pressable
                        className={`flex-row items-center rounded-[18px] border px-3 ${
                          selected
                            ? 'border-[#F7C2DC] bg-[#FFF6FA]'
                            : 'border-[#EEF1F4] bg-white'
                        }`}
                        onPress={() => handlePlaceRowPress(item)}
                        style={{ height: placeRowHeight }}
                      >
                        <Image
                          source={item.imageUri}
                          contentFit="cover"
                          transition={160}
                          cachePolicy="memory-disk"
                          style={{ borderRadius: 14, height: 70, width: 70 }}
                        />

                        <View className="ml-3 flex-1">
                          <Text
                            className="text-[14px] font-extrabold text-[#2B2233]"
                            numberOfLines={1}
                          >
                            {item.title}
                          </Text>

                          <Text
                            className="mt-0.5 text-[12px] text-[#8E869A]"
                            numberOfLines={1}
                          >
                            {item.category}
                            {item.distanceMeters === null
                              ? ''
                              : ` · ${formatDistance(item.distanceMeters)}`}
                          </Text>

                          <View className="mt-1.5 flex-row items-center gap-2">
                            {item.rating === null ? null : (
                              <View className="flex-row items-center gap-1">
                                <SymbolView
                                  name={{ ios: 'star.fill', android: 'star', web: 'star' }}
                                  size={11}
                                  tintColor="#F58752"
                                />
                                <Text className="text-[11px] font-bold text-[#2B2233]">
                                  {item.rating.toFixed(1)}
                                </Text>
                                <Text className="text-[11px] text-[#8E869A]">
                                  ({item.reviews})
                                </Text>
                              </View>
                            )}

                            <View className="rounded-full bg-[#FFF7E8] px-2 py-[3px]">
                              <Text className="text-[10px] font-extrabold text-[#D97706]">
                                +{item.xp} XP
                              </Text>
                            </View>

                            {item.isCheckedIn ? (
                              <View className="rounded-full bg-[#EAF7EF] px-2 py-[3px]">
                                <Text className="text-[10px] font-extrabold text-[#2A8A52]">
                                  {t('explore.places.checkedIn')}
                                </Text>
                              </View>
                            ) : null}
                          </View>
                        </View>

                        {selected ? (
                          <View className="ml-2 flex-row items-center">
                            <Text className="text-[11px] font-extrabold text-[#EB489B]">
                              {t('explore.sheet.viewDetail')}
                            </Text>
                            <SymbolView
                              name={{
                                ios: 'chevron.right',
                                android: 'chevron_right',
                                web: 'chevron_right',
                              }}
                              size={13}
                              tintColor="#EB489B"
                            />
                          </View>
                        ) : null}
                      </Pressable>
                    );
                  }}
                  showsVerticalScrollIndicator={false}
                />
              )
            ) : isRoutesLoading ? (
              <View className="items-center py-8">
                <ActivityIndicator color="#EB489B" />
              </View>
            ) : visibleRoutes.length === 0 ? (
              <SheetEmptyState
                description={routeError ?? t('explore.routes.emptyDescription')}
                title={t('explore.routes.emptyTitle')}
              />
            ) : (
              <ScrollView
                contentContainerStyle={{
                  gap: placeRowGap,
                  paddingBottom: 28,
                  paddingHorizontal: 16,
                  paddingTop: 6,
                }}
                showsVerticalScrollIndicator={false}
              >
                {visibleRoutes.map((route) => {
                  const selected = route.routeId === selectedRouteId;

                  return (
                    <Pressable
                      className={`flex-row items-center rounded-[18px] border px-3 ${
                        selected
                          ? 'border-[#D8C7FB] bg-[#F9F5FF]'
                          : 'border-[#EEF1F4] bg-white'
                      }`}
                      key={route.routeId}
                      onPress={() => handleRouteRowPress(route)}
                      style={{ height: placeRowHeight }}
                    >
                      <Image
                        source={getRouteImage(route)}
                        contentFit="cover"
                        transition={160}
                        cachePolicy="memory-disk"
                        style={{ borderRadius: 14, height: 70, width: 70 }}
                      />

                      <View className="ml-3 flex-1">
                        <Text
                          className="text-[14px] font-extrabold text-[#2B2233]"
                          numberOfLines={1}
                        >
                          {route.routeName}
                        </Text>

                        <Text className="mt-0.5 text-[12px] text-[#8E869A]" numberOfLines={1}>
                          {`${getRouteStopCount(route)} ${t('explore.routes.stops')} · ${route.totalDistance || 0} km · ${route.estimateTime || 0} ${t('explore.routes.minutes')}`}
                        </Text>

                        <View className="mt-1.5 flex-row items-center gap-2">
                          <View className="rounded-full bg-[#FFF7E8] px-2 py-[3px]">
                            <Text className="text-[10px] font-extrabold text-[#D97706]">
                              +{route.xp} XP
                            </Text>
                          </View>

                          {selected ? (
                            <Text className="text-[11px] font-extrabold text-[#7C3AED]">
                              {t('explore.sheet.viewDetail')} ›
                            </Text>
                          ) : null}
                        </View>
                      </View>
                    </Pressable>
                  );
                })}
              </ScrollView>
            )}
          </ExploreBottomSheet>
        </View>
      </SafeAreaView>
    </GestureHandlerRootView>
  );
}
