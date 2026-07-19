import { SymbolView } from '@/components/ui/symbol-view';
import { Image } from 'expo-image';
import { LinearGradient } from 'expo-linear-gradient';
import { type Href, useFocusEffect, useLocalSearchParams, useRouter } from 'expo-router';
import {
  ActivityIndicator,
  Alert,
  type GestureResponderEvent,
  Pressable,
  ScrollView,
  Text,
  useWindowDimensions,
  View,
} from 'react-native';

import { SafeAreaView } from 'react-native-safe-area-context';

import {
  type ReactNode,
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from 'react';

import { getValidAccessToken, useAuthSession } from '@/features/auth/hooks/use-auth-session';
import {
  findMatchingHotspotByNameOrCoordinate,
  getApiHotspotRouteSlug,
  getHotspotHref,
} from '@/features/home/data/hotspots';
import { getMultiStopRouteCoordinates } from '@/features/map/api/goong-directions';
import { AppMap } from '@/features/map/components/app-map';
import {
  getRouteById,
  getSavedRoutes,
  getUserRouteProgressById,
  getUserRouteProgressList,
  type RouteDto,
  type RouteHotspotDto,
  saveRoute,
  startRouteProgress,
  unSaveRoute,
  type UserRouteProgressDto,
} from '@/features/route/api/route-api';
import { useCheckins } from '@/lib/checkin-store';
import { getHotspotDetailHref } from '@/lib/hotspot-navigation';
import { openGoogleMapsMultiStopRoute } from '@/lib/google-maps-navigation';

const fallbackRouteImage =
  'https://i.pinimg.com/1200x/80/69/f9/8069f9581583a196f9f39bda000b9312.jpg';
const fallbackStopImage =
  'https://i.pinimg.com/736x/f3/0f/e8/f30fe84218790e6ffd25f987d434eb13.jpg';

const cardShadow = {
  shadowColor: 'rgba(28, 45, 80, 0.10)',
  shadowOpacity: 1,
  shadowRadius: 16,
  shadowOffset: { width: 0, height: 8 },
  elevation: 5,
} as const;

const glowShadow = {
  shadowColor: 'rgba(235, 72, 155, 0.32)',
  shadowOpacity: 1,
  shadowRadius: 18,
  shadowOffset: { width: 0, height: 8 },
  elevation: 10,
} as const;


type RouteReview = {
  id: string;
  user: string;
  avatar: string;
  completedIn: string;
  date: string;
  rating: number;
  highlight: string;
  text: string;
  tags: string[];
  helpful: number;
};




function getCoordinate(stop: RouteHotspotDto) {
  if (typeof stop.latitude !== 'number' || typeof stop.longitude !== 'number') return null;
  if (!Number.isFinite(stop.latitude) || !Number.isFinite(stop.longitude)) return null;
  if (Math.abs(stop.latitude) > 90 || Math.abs(stop.longitude) > 180) return null;
  return { latitude: stop.latitude, longitude: stop.longitude };
}

function getDistanceKm(from?: RouteHotspotDto, to?: RouteHotspotDto) {
  const a = from ? getCoordinate(from) : null;
  const b = to ? getCoordinate(to) : null;
  if (!a || !b) return null;

  const earthRadiusKm = 6371;
  const toRad = (value: number) => (value * Math.PI) / 180;
  const dLat = toRad(b.latitude - a.latitude);
  const dLon = toRad(b.longitude - a.longitude);
  const lat1 = toRad(a.latitude);
  const lat2 = toRad(b.latitude);

  const haversine =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(lat1) * Math.cos(lat2) * Math.sin(dLon / 2) ** 2;

  return earthRadiusKm * 2 * Math.atan2(Math.sqrt(haversine), Math.sqrt(1 - haversine));
}

function formatDistance(distanceKm: number | null) {
  if (distanceKm === null || !Number.isFinite(distanceKm)) return 'Điểm cuối tuyến';
  if (distanceKm < 1) return `${Math.round(distanceKm * 1000)} m tới điểm sau`;
  if (distanceKm < 10) return `${distanceKm.toFixed(1)} km tới điểm sau`;
  return `${Math.round(distanceKm)} km tới điểm sau`;
}

function getDifficultyLabel(difficulty?: string) {
  switch (difficulty?.toUpperCase()) {
    case 'EASY':
      return 'Dễ';
    case 'MEDIUM':
      return 'Vừa';
    case 'HARD':
      return 'Khó';
    default:
      return difficulty || 'Dễ';
  }
}

function getStopImage(stop: RouteHotspotDto) {
  const image = stop.medias?.find((media) => {
    const kind = `${media.mediaType ?? ''} ${media.mimeType ?? ''}`.toLowerCase();
    return kind.includes('image');
  }) ?? stop.medias?.[0];

  return image?.fileUrl || fallbackStopImage;
}

function getRouteHotspotOrder(stop: RouteHotspotDto, fallbackIndex: number) {
  return stop.orderIndex ?? stop.sequenceNumber ?? stop.index ?? fallbackIndex + 1;
}

function getOrderedRouteHotspots(hotspots: RouteHotspotDto[]) {
  return hotspots
    .map((stop, index) => ({ stop, index }))
    .sort((a, b) => {
      const orderDiff = getRouteHotspotOrder(a.stop, a.index) - getRouteHotspotOrder(b.stop, b.index);
      return orderDiff !== 0 ? orderDiff : a.index - b.index;
    })
    .map((item) => item.stop);
}

function resolveRouteHotspotHref(
  stop: RouteHotspotDto,
  routeId?: number | string | null,
): Href {
  const matchedHotspot = findMatchingHotspotByNameOrCoordinate({
    hotspotName: stop.hotspotName ?? '',
    latitude: Number(stop.latitude ?? 0),
    longitude: Number(stop.longitude ?? 0),
  });

  if (matchedHotspot) {
    return getHotspotHref(matchedHotspot.slug, stop.hotspotId, routeId);
  }

  return (
    getHotspotDetailHref(String(stop.hotspotId), routeId) ??
    getHotspotHref(getApiHotspotRouteSlug(stop.hotspotId), stop.hotspotId, routeId)
  );
}

function XPBar({ value, max }: { value: number; max: number }) {
  const percent = max > 0 ? Math.min(Math.max((value / max) * 100, 0), 100) : 0;

  return (
    <View className="flex-1 overflow-hidden rounded-full bg-[#ECEEF4]" style={{ height: 8 }}>
      <LinearGradient
        colors={['#FFE566', '#FFB400']}
        start={{ x: 0, y: 0.5 }}
        end={{ x: 1, y: 0.5 }}
        style={{ borderRadius: 999, height: '100%', width: `${percent}%` }}
      />
    </View>
  );
}

function RouteMapHero({
  checkedInIds,
  route,
  height,
}: {
  checkedInIds: string[];
  route: RouteDto;
  height: number;
}) {
  const points = useMemo(
    () =>
      route.hotspots
        .filter((stop) => Number.isFinite(stop.latitude) && Number.isFinite(stop.longitude))
        .map((stop) => ({
          id: stop.hotspotId,
          title: stop.hotspotName || `Hotspot #${stop.hotspotId}`,
          description: checkedInIds.includes(String(stop.hotspotId)) ? 'Đã check-in' : stop.address,
          latitude: Number(stop.latitude),
          longitude: Number(stop.longitude),
        })),
    [checkedInIds, route.hotspots],
  );

  const [routeCoordinates, setRouteCoordinates] = useState(
    points.map((point) => ({ latitude: point.latitude, longitude: point.longitude })),
  );

  useEffect(() => {
    let cancelled = false;

    async function loadDirections() {
      if (points.length < 2) {
        setRouteCoordinates(points.map((point) => ({ latitude: point.latitude, longitude: point.longitude })));
        return;
      }

      try {
        const coordinates = await getMultiStopRouteCoordinates(
          points.map(({ latitude, longitude }) => ({ latitude, longitude })),
        );

        if (!cancelled) setRouteCoordinates(coordinates);
      } catch (error) {
        console.warn('[route-detail] load Goong directions failed', error);
        if (!cancelled) {
          setRouteCoordinates(points.map((point) => ({ latitude: point.latitude, longitude: point.longitude })));
        }
      }
    }

    void loadDirections();

    return () => {
      cancelled = true;
    };
  }, [points]);

  return (
    <View className="relative overflow-hidden bg-[#E8F0FE]" style={{ height }}>
      <AppMap
        points={points}
        routeCoordinates={routeCoordinates}
        height={height}
        showsUserLocation
      />
      <LinearGradient
        colors={['rgba(0,0,0,0.35)', 'transparent']}
        className="absolute inset-x-0 top-0 h-24"
        pointerEvents="none"
      />
      <LinearGradient
        colors={['transparent', '#FFFFFF']}
        className="absolute inset-x-0 bottom-0 h-16"
        pointerEvents="none"
      />
    </View>
  );
}
function Stat({
  icon,
  label,
  hint,
  highlight = false,
}: {
  icon?: ReactNode;
  label: string;
  hint: string;
  highlight?: boolean;
}) {
  return (
    <View className={`flex-1 rounded-2xl p-2 ${highlight ? 'bg-[#FFF5E8]' : 'bg-[#F4EFF8]'}`}>
      {icon ? <View className="mb-0.5 items-center">{icon}</View> : null}
      <Text
        className={`text-center text-[13px] font-bold leading-tight ${highlight ? 'text-[#B86D2A]' : 'text-[#2B2233]'}`}
      >
        {label}
      </Text>
      <Text
        className={`text-center text-[10px] ${highlight ? 'text-[#B86D2A]/80' : 'text-[#8E869A]'}`}
      >
        {hint}
      </Text>
    </View>
  );
}

function StoryCard({
  title,
  body,
  emoji,
  tone = 'default',
}: {
  title: string;
  body: string;
  emoji: string;
  tone?: 'default' | 'jade' | 'sunset';
}) {
  const bgClass =
    tone === 'jade'
      ? 'border-[#F58752]/20 bg-[#FFF4EF]'
      : tone === 'sunset'
        ? 'border-[#EB489B]/20 bg-[#FFF8FC]'
        : 'border-[#E8EDF4] bg-white';

  return (
    <View className={`rounded-2xl border p-4 ${bgClass}`}>
      <View className="mb-1.5 flex-row items-center gap-2">
        <Text className="text-lg">{emoji}</Text>
        <Text className="text-[15px] font-bold text-[#2B2233]">{title}</Text>
      </View>
      <Text className="text-[12.5px] leading-5 text-[#3D3446]/85">{body}</Text>
    </View>
  );
}

function Stars({ rating, size = 11 }: { rating: number; size?: number }) {
  return (
    <View className="flex-row gap-0.5">
      {Array.from({ length: 5 }).map((_, i) => (
        <Text
          key={i}
          style={{ fontSize: size, color: i < rating ? '#EB489B' : '#D4C8DE' }}
        >
          ★
        </Text>
      ))}
    </View>
  );
}

function RouteReviewCard({ review }: { review: RouteReview }) {
  return (
    <View className="rounded-2xl bg-white p-3.5" style={cardShadow}>
      <View className="flex-row items-center gap-2.5">
        <Image
          source={review.avatar}
          contentFit="cover"
          style={{ width: 40, height: 40, borderRadius: 20 }}
        />
        <View className="min-w-0 flex-1">
          <View className="flex-row items-center gap-1.5">
            <Text className="text-[14px] font-semibold text-[#2B2233]">{review.user}</Text>
            <View className="rounded-full bg-[#FFF4EF] px-1.5 py-0.5">
              <Text className="text-[10px] font-bold text-[#F58752]">Đã hoàn thành</Text>
            </View>
          </View>
          <View className="mt-0.5 flex-row items-center gap-1">
            <SymbolView
              name={{ ios: 'clock', android: 'schedule', web: 'schedule' }}
              size={9}
              tintColor="#8E869A"
            />
            <Text className="text-[11px] text-[#8E869A]">
              {review.completedIn} · {review.date}
            </Text>
          </View>
        </View>
        <Stars rating={review.rating} size={10} />
      </View>

      <Text className="mt-2 text-[12.5px] font-bold text-[#EB489B]">
        &ldquo;{review.highlight}&rdquo;
      </Text>
      <Text className="mt-1 text-[13px] leading-5 text-[#3D3446]/85">{review.text}</Text>

      <View className="mt-2 flex-row flex-wrap gap-1.5">
        {review.tags.map((tag) => (
          <View key={tag} className="rounded-full bg-[#F4EFF8] px-2 py-0.5">
            <Text className="text-[9.5px] font-semibold text-[#3D3446]/75">#{tag}</Text>
          </View>
        ))}
      </View>

      <View className="mt-2.5 flex-row items-center justify-between border-t border-[#E8EDF4]/60 pt-2.5">
        <Pressable className="flex-row items-center gap-1.5">
          <SymbolView
            name={{ ios: 'hand.thumbsup', android: 'thumb_up', web: 'thumb_up' }}
            size={12}
            tintColor="#8E869A"
          />
          <Text className="text-[12px] font-semibold text-[#8E869A]">
            Hữu ích · {review.helpful}
          </Text>
        </Pressable>
        <Text className="text-[11px] text-[#8E869A]">Trả lời</Text>
      </View>
    </View>
  );
}

export default function RouteDetailScreen() {
  const { id: routeId } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const session = useAuthSession();
  const checkins = useCheckins();
  const [route, setRoute] = useState<RouteDto | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [isSavingRoute, setIsSavingRoute] = useState(false);
  const [isStartingRoute, setIsStartingRoute] = useState(false);
  const [isSavedRoute, setIsSavedRoute] = useState(false);
  const [savedRouteId, setSavedRouteId] = useState<number | null>(null);
  const [activeRouteProgress, setActiveRouteProgress] = useState<UserRouteProgressDto | null>(null);

  const { height: screenHeight } = useWindowDimensions();
  const collapsedMapHeight = 240;
  const expandedMapHeight = Math.max(
    360,
    Math.min(Math.round(screenHeight * 0.62), screenHeight - 220),
  );

  const [mapHeight, setMapHeight] = useState(collapsedMapHeight);
  const mapHeightRef = useRef(collapsedMapHeight);
  const scrollOffsetRef = useRef(0);
  const touchStartYRef = useRef<number | null>(null);
  const touchStartMapHeightRef = useRef(collapsedMapHeight);
  const isPullingMapRef = useRef(false);

  const clampMapHeight = useCallback(
    (height: number) =>
      Math.min(Math.max(height, collapsedMapHeight), expandedMapHeight),
    [expandedMapHeight],
  );

  const updateMapHeight = useCallback(
    (height: number) => {
      const nextHeight = clampMapHeight(height);
      mapHeightRef.current = nextHeight;
      setMapHeight(nextHeight);
    },
    [clampMapHeight],
  );

  const handleContentTouchStart = useCallback(
    (event: GestureResponderEvent) => {
      touchStartYRef.current = event.nativeEvent.pageY;
      touchStartMapHeightRef.current = mapHeightRef.current;
      isPullingMapRef.current = scrollOffsetRef.current <= 1;
    },
    [],
  );

  const handleContentTouchMove = useCallback(
    (event: GestureResponderEvent) => {
      if (!isPullingMapRef.current || touchStartYRef.current === null) return;

      const dragDistance =
        event.nativeEvent.pageY - touchStartYRef.current;

      // Chỉ kéo xuống mới làm bản đồ lớn hơn.
      // Vuốt lên vẫn được ScrollView xử lý để cuộn nội dung.
      if (dragDistance <= 0) return;

      updateMapHeight(
        touchStartMapHeightRef.current + dragDistance,
      );
    },
    [updateMapHeight],
  );

  const handleContentTouchEnd = useCallback(() => {
    if (isPullingMapRef.current) {
      const middlePoint =
        collapsedMapHeight +
        (expandedMapHeight - collapsedMapHeight) * 0.35;

      updateMapHeight(
        mapHeightRef.current >= middlePoint
          ? expandedMapHeight
          : collapsedMapHeight,
      );
    }

    touchStartYRef.current = null;
    isPullingMapRef.current = false;
  }, [expandedMapHeight, updateMapHeight]);

  useFocusEffect(
    useCallback(() => {
      let cancelled = false;

      async function loadRouteDetail() {
        if (!routeId) {
          setError('Thiếu mã tuyến.');
          setIsLoading(false);
          return;
        }

        setIsLoading(true);
        setError(null);
        setActiveRouteProgress(null);

        try {
          const accessToken = await getValidAccessToken();
          const [routeDetail, progressPage, savedRoutes] = await Promise.all([
            getRouteById({
              accessToken,
              routeId,
              tokenType: session.tokenType,
            }),
            accessToken
              ? getUserRouteProgressList({
                  accessToken,
                  page: 0,
                  size: 50,
                  sortBy: 'startedAt',
                  sortDirection: 'DESC',
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
          ]);

          if (cancelled) return;

          let startedProgress = progressPage.content.find((progress) => {
            const sameRoute = Number(progress.routeId) === Number(routeId);
            const status = `${progress.status ?? ''}`.toUpperCase();
            return sameRoute && (status === 'IN_PROGRESS' || status === 'COMPLETED');
          });

          if (startedProgress?.userRouteProgressId && accessToken) {
            try {
              const detailedProgress = await getUserRouteProgressById({
                accessToken,
                progressId: startedProgress.userRouteProgressId,
                tokenType: session.tokenType,
              });
              if (!cancelled) {
                startedProgress = detailedProgress;
              }
            } catch (progressDetailError) {
              console.warn('[route-detail] load progress detail failed', progressDetailError);
            }
          }

          const savedRoute = savedRoutes.find(
            (item) => Number(item.routeId) === Number(routeId),
          );

          setRoute(routeDetail);
          setActiveRouteProgress(startedProgress ?? null);
          setIsSavedRoute(Boolean(savedRoute));
          setSavedRouteId(savedRoute?.savedRouteId ?? null);
        } catch (loadError) {
          if (cancelled) return;
          setError(loadError instanceof Error ? loadError.message : 'Không thể tải chi tiết tuyến.');
          setRoute(null);
        } finally {
          if (!cancelled) setIsLoading(false);
        }
      }

      void loadRouteDetail();

      return () => {
        cancelled = true;
      };
    }, [routeId, session.tokenType]),
  );

  const checkedInIdsFromProgress = useMemo(() => {
    return (
      activeRouteProgress?.hotspotProgressList
        ?.filter((item) => item.isCheckedIn)
        .map((item) => String(item.hotspotId)) ?? []
    );
  }, [activeRouteProgress]);
  const checkedInIds = useMemo(() => {
    const ids = new Set<string>([...checkins.map(String), ...checkedInIdsFromProgress]);
    return Array.from(ids);
  }, [checkins, checkedInIdsFromProgress]);
  const orderedStops = useMemo(
    () => (route ? getOrderedRouteHotspots(route.hotspots) : []),
    [route],
  );
  const hasStartedRoute = Boolean(activeRouteProgress);
  const nextStop = useMemo(() => {
    if (!orderedStops.length) return undefined;
    return orderedStops.find((stop) => !checkedInIds.includes(String(stop.hotspotId))) ?? orderedStops[0];
  }, [checkedInIds, orderedStops]);


  if (isLoading) {
    return (
      <SafeAreaView className="flex-1 items-center justify-center bg-white">
        <ActivityIndicator color="#EB489B" />
        <Text className="mt-3 text-[14px] text-[#8E869A]">Đang tải chi tiết tuyến...</Text>
      </SafeAreaView>
    );
  }

  if (!route) {
    return (
      <SafeAreaView className="flex-1 items-center justify-center bg-white">
        <Text className="text-[17px] text-[#8E869A]">Tuyến không tồn tại</Text>
        <Pressable onPress={() => router.back()} className="mt-4">
          <Text className="text-[15px] font-bold text-[#EB489B]">Quay lại</Text>
        </Pressable>
      </SafeAreaView>
    );
  }

  const completed = orderedStops.filter((stop) => checkedInIds.includes(String(stop.hotspotId))).length;
  const progress = orderedStops.length > 0 ? (completed / orderedStops.length) * 100 : 0;
  const totalStops = orderedStops.length;
  const continueHref = nextStop
    ? resolveRouteHotspotHref(nextStop, route.routeId)
    : undefined;
  const routeTheme = route.tags[0]?.tagName || 'Di sản';
  const routeDistanceLabel = `${route.totalDistance || 0} km`;
  const routeDurationLabel = `${route.estimateTime || 0} phút`;
  const routeDifficultyLabel = getDifficultyLabel(String(route.difficulty));
  const isFinished = totalStops > 0 && completed >= totalStops;
  const rating = { avg: 4.8, count: 0 };
  const ratingDist = [
    { star: 5, pct: 72 },
    { star: 4, pct: 18 },
    { star: 3, pct: 7 },
    { star: 2, pct: 2 },
    { star: 1, pct: 1 },
  ];
  const feedbackTags = ['Dễ đi', 'Cảnh đẹp', 'Nội dung hay'];
  const reviews: RouteReview[] = [];

  async function handleSaveRoute() {
    if (!route || isSavingRoute) return;

    setIsSavingRoute(true);
    try {
      const accessToken = await getValidAccessToken();

      if (isSavedRoute) {
        if (!savedRouteId) {
          throw new Error('Không tìm thấy mã tuyến đã lưu để bỏ lưu.');
        }

        await unSaveRoute({
          accessToken,
          savedRouteId,
          tokenType: session.tokenType,
        });
        setIsSavedRoute(false);
        setSavedRouteId(null);
        Alert.alert('Đã bỏ lưu', 'Tuyến đã được xóa khỏi danh sách đã lưu.');
        return;
      }

      const saved = await saveRoute({
        accessToken,
        routeId: route.routeId,
        tokenType: session.tokenType,
      });

      const nextSavedRouteId =
        typeof saved === 'object' && saved !== null && 'savedRouteId' in saved
          ? Number(saved.savedRouteId)
          : null;

      setIsSavedRoute(true);
      setSavedRouteId(
        nextSavedRouteId && Number.isFinite(nextSavedRouteId)
          ? nextSavedRouteId
          : null,
      );
      Alert.alert('Đã lưu tuyến', 'Tuyến này đã được thêm vào danh sách đã lưu.');
    } catch (saveError) {
      Alert.alert(
        isSavedRoute ? 'Không thể bỏ lưu tuyến' : 'Không thể lưu tuyến',
        saveError instanceof Error ? saveError.message : 'Vui lòng thử lại sau.',
      );
    } finally {
      setIsSavingRoute(false);
    }
  }

  async function handleStartRoute() {
    if (!route || !continueHref || isStartingRoute) return;

    setIsStartingRoute(true);
    try {
      const accessToken = await getValidAccessToken();
      if (!hasStartedRoute) {
        await startRouteProgress({ accessToken, routeId: route.routeId, tokenType: session.tokenType });
      }
      router.push(continueHref);
    } catch (startError) {
      Alert.alert(
        'Không thể bắt đầu tuyến',
        startError instanceof Error ? startError.message : 'Vui lòng thử lại sau.',
      );
    } finally {
      setIsStartingRoute(false);
    }
  }

  return (
    <View className="flex-1 bg-white">
      <View
        className="relative overflow-hidden bg-[#E8F0FE]"
        style={{ height: mapHeight }}
      >
        <RouteMapHero
          route={route}
          checkedInIds={checkedInIds}
          height={mapHeight}
        />

        <SafeAreaView
          edges={['top']}
          className="absolute inset-x-0 top-0"
          pointerEvents="box-none"
        >
          <View className="flex-row items-center justify-between px-3 pt-2">
            <Pressable
              onPress={() => router.back()}
              className="h-10 w-10 items-center justify-center rounded-full bg-black/30"
            >
              <SymbolView
                name={{ ios: 'chevron.left', android: 'arrow_back', web: 'arrow_back' }}
                size={18}
                tintColor="#fff"
              />
            </Pressable>
            <View className="rounded-full bg-black/30 px-3 py-2">
              <Text className="text-[11px] font-bold text-white">{route.status}</Text>
            </View>
          </View>
        </SafeAreaView>
      </View>

      <ScrollView
        className="flex-1 bg-white"
        contentContainerStyle={{ paddingBottom: 104 }}
        showsVerticalScrollIndicator={false}
        scrollEventThrottle={16}
        bounces={false}
        overScrollMode="never"
        onScroll={(event) => {
          scrollOffsetRef.current = Math.max(event.nativeEvent.contentOffset.y, 0);
        }}
        onTouchStart={handleContentTouchStart}
        onTouchMove={handleContentTouchMove}
        onTouchEnd={handleContentTouchEnd}
        onTouchCancel={handleContentTouchEnd}
      >
          <View className="relative px-4">
          <View className="items-center pb-2 pt-1">
            <View className="h-1.5 w-12 rounded-full bg-[#D9DCE5]" />
            <Text className="mt-1 text-[10px] text-[#8E869A]">
              {mapHeight > collapsedMapHeight ? 'Bản đồ đang được mở rộng' : 'Kéo xuống để mở rộng bản đồ'}
            </Text>
          </View>

          <View className="rounded-3xl bg-white p-5" style={cardShadow}>
            <View className="flex-row items-center gap-2">
              <SymbolView
                name={{ ios: 'sparkles', android: 'auto_awesome', web: 'auto_awesome' }}
                size={12}
                tintColor="#EB489B"
              />
              <Text className="text-[11px] font-semibold uppercase tracking-wider text-[#EB489B]">
                Tuyến chủ đề · {routeTheme}
              </Text>
            </View>
            <Text className="mt-1 text-[24px] font-extrabold leading-tight text-[#2B2233]">
              {route.routeName}
            </Text>
            <Text className="mt-1 text-[13px] text-[#8E869A]">
              {route.description || 'Chưa có mô tả cho tuyến này.'}
            </Text>
            <Text className="mt-1 text-[14px] text-[#8E869A]">{routeTheme}</Text>

            <View className="mt-4 flex-row gap-2">
              <Stat
                icon={
                  <SymbolView
                    name={{ ios: 'figure.walk', android: 'directions_walk', web: 'directions_walk' }}
                    size={14}
                    tintColor="#8E869A"
                  />
                }
                label={routeDistanceLabel}
                hint="Quãng đường"
              />
              <Stat
                icon={
                  <SymbolView
                    name={{ ios: 'clock', android: 'schedule', web: 'schedule' }}
                    size={14}
                    tintColor="#8E869A"
                  />
                }
                label={routeDurationLabel}
                hint="Thời lượng"
              />
              <Stat
                icon={
                  <SymbolView
                    name={{ ios: 'mountain.2', android: 'terrain', web: 'terrain' }}
                    size={14}
                    tintColor="#8E869A"
                  />
                }
                label={routeDifficultyLabel}
                hint="Độ khó"
              />
              <Stat
                icon={<Text className="text-[12px] font-bold text-[#B86D2A]">XP</Text>}
                label={`+${route.xp}`}
                hint="Phần thưởng"
                highlight
              />
            </View>

            <View className="mt-4 flex-row items-center gap-2">
              <XPBar value={completed} max={totalStops} />
              <Text className="text-[12px] font-bold text-[#2B2233]">
                {completed}/{totalStops}
              </Text>
            </View>
            <Text className="mt-1 text-[11px] text-[#8E869A]">
              Tiến độ {Math.round(progress)}% · check-in theo bất kỳ thứ tự nào
            </Text>
          </View>

          <View className="mt-4 gap-3">
            <View className="rounded-2xl border border-[#E8EDF4] bg-white p-4">
              <Text className="text-[14px] font-bold text-[#2B2233]">Tag tuyến</Text>
              <View className="mt-2 flex-row flex-wrap gap-2">
                {route.tags.length > 0 ? route.tags.map((tag) => (
                  <View key={tag.tagId} className="rounded-full bg-[#F4EFF8] px-3 py-1">
                    <Text className="text-[11px] font-semibold text-[#3D3446]/80">#{tag.tagName}</Text>
                  </View>
                )) : (
                  <Text className="text-[12px] text-[#8E869A]">Chưa có tag.</Text>
                )}
              </View>
            </View>
          </View>

          <View className="mt-6">
            <View className="mb-3 flex-row items-center justify-between gap-3">
              <View className="flex-1">
                <Text className="text-[19px] font-bold text-[#2B2233]">Hành trình của bạn</Text>
                <Text className="mt-0.5 text-[11px] text-[#8E869A]">Các hotspot được mở trong Google Maps theo đúng thứ tự bên dưới.</Text>
              </View>
              <Pressable
                onPress={() => {
                  const points = orderedStops.flatMap((stop) => {
                    const coordinate = getCoordinate(stop);
                    return coordinate
                      ? [{ ...coordinate, title: stop.hotspotName ?? undefined }]
                      : [];
                  });

                  void openGoogleMapsMultiStopRoute({
                    points,
                    travelMode: 'driving',
                    useCurrentLocationAsOrigin: true,
                  }).catch((error) => {
                    Alert.alert(
                      'Không thể mở Google Maps',
                      error instanceof Error ? error.message : 'Vui lòng thử lại.',
                    );
                  });
                }}
                className="flex-row items-center gap-1.5 rounded-xl bg-[#EEF7FF] px-3 py-2.5"
              >
                <SymbolView
                  name={{ ios: 'map.fill', android: 'map', web: 'map' }}
                  size={14}
                  tintColor="#1677C8"
                />
                <Text className="text-[11px] font-bold text-[#1677C8]">Mở Google Maps</Text>
              </Pressable>
            </View>
            <View className="pl-7">
              <View className="absolute bottom-2 left-3 top-2 w-px bg-[#EB489B]/40" />
              {orderedStops.map((stop, index) => {
                const done = checkedInIds.includes(String(stop.hotspotId));
                return (
                  <Pressable
                    key={`${stop.hotspotId}-${index}`}
                    onPress={() => {
                      router.push(resolveRouteHotspotHref(stop, route.routeId));
                    }}
                    className="relative flex-row gap-3 pb-4"
                  >
                    <View
                      className={`absolute -left-7 top-2 h-6 w-6 items-center justify-center rounded-full border-2 border-white ${
                        done ? 'bg-[#34C759]' : 'bg-[#EB489B]'
                      }`}
                    >
                      {done ? (
                        <SymbolView
                          name={{ ios: 'checkmark', android: 'check', web: 'check' }}
                          size={12}
                          tintColor="#fff"
                        />
                      ) : (
                        <Text className="text-[11px] font-bold text-white">{index + 1}</Text>
                      )}
                    </View>
                    <Image
                      source={getStopImage(stop)}
                      contentFit="cover"
                      style={{ width: 64, height: 64, borderRadius: 16 }}
                    />
                    <View className="min-w-0 flex-1">
                      <Text className="text-[15px] font-semibold text-[#2B2233]" numberOfLines={1}>
                        {stop.hotspotName || `Điểm #${stop.hotspotId}`}
                      </Text>
                      <Text className="text-[12px] text-[#8E869A]" numberOfLines={1}>
                        {stop.address}
                      </Text>
                      <View className="mt-1.5 flex-row items-center gap-2">
                        <View className="rounded-full bg-[#F4EFF8] px-2 py-0.5">
                          <Text className="text-[11px] text-[#2B2233]">{formatDistance(getDistanceKm(stop, orderedStops[index + 1]))}</Text>
                        </View>
                        <View className="rounded-full bg-[#F4EFF8] px-2 py-0.5">
                          <Text className="text-[11px] text-[#2B2233]">{`Thứ tự ${stop.orderIndex ?? stop.sequenceNumber ?? index + 1}`}</Text>
                        </View>
                        <Text className="ml-auto text-[11px] font-bold text-[#EB489B]">
                          +{stop.xp} XP
                        </Text>
                      </View>
                    </View>
                  </Pressable>
                );
              })}
            </View>
          </View>

          <View className="mt-5 rounded-3xl border border-[#EB489B]/20 bg-[#FFF8FC] p-4">
            <View className="flex-row items-center gap-2">
              <View className="h-8 w-8 items-center justify-center rounded-xl bg-[#241C2C]">
                <SymbolView
                  name={{ ios: 'sparkles', android: 'auto_awesome', web: 'auto_awesome' }}
                  size={14}
                  tintColor="#FFC93C"
                />
              </View>
              <View>
                <Text className="text-[11px] font-bold uppercase tracking-wider text-[#F58752]">
                  AI Gợi ý
                </Text>
                <Text className="text-[14px] font-semibold text-[#2B2233]">
                  Tuyến này hợp với bạn 94%
                </Text>
              </View>
            </View>
            <Text className="mt-2 text-[13px] leading-5 text-[#3D3446]/80">
              Dựa trên 7 tuyến bạn đã hoàn thành, bạn yêu kiến trúc Pháp thuộc. Tuyến này có 3/4 điểm
              khớp sở thích — và thời tiết sáng mai lý tưởng để đi bộ ☀️ 26°C.
            </Text>
          </View>

          <Pressable className="mt-3 flex-row items-center justify-between rounded-2xl bg-[#F4EFF8] p-3.5">
            <View className="flex-row items-center gap-2.5">
              <SymbolView
                name={{ ios: 'arrow.down.circle', android: 'download', web: 'download' }}
                size={16}
                tintColor="#F58752"
              />
              <View>
                <Text className="text-[14px] font-semibold text-[#2B2233]">
                  Tải về để dùng offline
                </Text>
                <Text className="text-[11px] text-[#8E869A]">Bản đồ + story · 12.4 MB</Text>
              </View>
            </View>
            <Text className="text-[12px] font-bold text-[#F58752]">Tải xuống</Text>
          </Pressable>

          <View className="mt-6">
            <View className="mb-3 flex-row items-center justify-between">
              <Text className="text-[19px] font-bold text-[#2B2233]">Phản hồi về tuyến</Text>
              <Text className="text-[11px] text-[#8E869A]">{rating.count} đánh giá</Text>
            </View>

            <View className="rounded-3xl bg-white p-4" style={cardShadow}>
              <View className="flex-row items-center gap-4">
                <View className="items-center">
                  <Text className="text-[36px] font-extrabold leading-none text-[#2B2233]">
                    {rating.avg}
                  </Text>
                  <Stars rating={Math.round(rating.avg)} />
                  <Text className="mt-0.5 text-[11px] text-[#8E869A]">{rating.count} người</Text>
                </View>
                <View className="flex-1 gap-1">
                  {ratingDist.map((d) => (
                    <View key={d.star} className="flex-row items-center gap-2">
                      <Text className="w-3 text-[11px] text-[#8E869A]">{d.star}</Text>
                      <Text style={{ fontSize: 9, color: '#EB489B' }}>★</Text>
                      <View className="h-1.5 flex-1 overflow-hidden rounded-full bg-[#F4EFF8]">
                        <LinearGradient
                          colors={['#EB489B', '#F58752']}
                          start={{ x: 0, y: 0.5 }}
                          end={{ x: 1, y: 0.5 }}
                          style={{ height: '100%', width: `${d.pct}%`, borderRadius: 999 }}
                        />
                      </View>
                      <Text className="w-7 text-right text-[11px] text-[#8E869A]">{d.pct}%</Text>
                    </View>
                  ))}
                </View>
              </View>

              <View className="mt-3 flex-row flex-wrap gap-1.5">
                {feedbackTags.map((tag) => (
                  <View key={tag} className="rounded-full bg-[#F4EFF8] px-2.5 py-1">
                    <Text className="text-[11px] font-semibold text-[#3D3446]/80">{tag}</Text>
                  </View>
                ))}
              </View>
            </View>

            <Pressable
              disabled={!isFinished}
              className={`mt-3 flex-row items-center gap-3 rounded-2xl p-3.5 ${
                isFinished ? 'border border-[#EB489B]/30 bg-[#FFF8FC]' : 'bg-[#F4EFF8] opacity-80'
              }`}
            >
              <View className="h-10 w-10 items-center justify-center rounded-xl bg-[#EB489B]">
                <SymbolView
                  name={{ ios: 'pencil', android: 'edit', web: 'edit' }}
                  size={16}
                  tintColor="#fff"
                />
              </View>
              <View className="flex-1">
                <Text className="text-[14px] font-bold text-[#2B2233]">
                  {isFinished ? 'Chia sẻ trải nghiệm tuyến này' : 'Hoàn thành tuyến để viết feedback'}
                </Text>
                <Text className="text-[11px] text-[#8E869A]">
                  {isFinished
                    ? '+50 XP cho đánh giá có ảnh'
                    : `Còn ${Math.max(totalStops - completed, 0)} điểm check-in`}
                </Text>
              </View>
              {isFinished && (
                <Text className="text-[12px] font-bold text-[#EB489B]">Viết ngay</Text>
              )}
            </Pressable>

            <View className="mt-3 gap-3">
              {reviews.map((review) => (
                <RouteReviewCard key={review.id} review={review} />
              ))}
            </View>
          </View>
          </View>
      </ScrollView>

      <View className="absolute inset-x-0 bottom-0 px-4 pb-6 pt-2">
        <View className="flex-row gap-2 rounded-2xl bg-white/95 p-2.5" style={cardShadow}>
          <Pressable
            disabled={isSavingRoute}
            onPress={handleSaveRoute}
            className={`h-12 w-12 items-center justify-center rounded-xl ${isSavedRoute ? 'bg-[#FFF4EF]' : 'bg-[#F4EFF8]'} ${isSavingRoute ? 'opacity-60' : ''}`}
          >
            <SymbolView
              name={{ ios: isSavedRoute ? 'bookmark.fill' : 'bookmark', android: isSavedRoute ? 'bookmark' : 'bookmark_border', web: isSavedRoute ? 'bookmark' : 'bookmark_border' }}
              size={16}
              tintColor={isSavedRoute ? '#F58752' : '#8E869A'}
            />
          </Pressable>
          <Pressable
            disabled={!continueHref || isStartingRoute}
            onPress={handleStartRoute}
            className={`flex-1 overflow-hidden rounded-xl ${continueHref && !isStartingRoute ? '' : 'opacity-60'}`}
            style={glowShadow}
          >
            <LinearGradient
              colors={['#EB489B', '#F58752']}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 0 }}
              className="flex-row items-center justify-center gap-2 py-3.5"
            >
              <SymbolView
                name={{ ios: 'play.fill', android: 'play_arrow', web: 'play_arrow' }}
                size={16}
                tintColor="#fff"
              />
              <Text className="text-[15px] font-bold text-white">
                {isStartingRoute ? 'Đang bắt đầu...' : hasStartedRoute ? 'Tiếp tục hành trình' : 'Bắt đầu hành trình'}
              </Text>
            </LinearGradient>
          </Pressable>
        </View>
      </View>
    </View>
  );
}
