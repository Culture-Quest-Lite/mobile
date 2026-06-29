import { Image } from 'expo-image';
import { LinearGradient } from 'expo-linear-gradient';
import { type Href, useLocalSearchParams, useRouter } from 'expo-router';
import { SymbolView } from 'expo-symbols';
import { useEffect, useMemo, useState } from 'react';
import { ActivityIndicator, Pressable, ScrollView, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { getValidAccessToken, useAuthSession } from '@/features/auth/hooks/use-auth-session';
import { getGoongRouteCoordinates } from '@/features/map/api/goong-directions';
import { AppMap } from '@/features/map/components/app-map';
import { useCheckins } from '@/lib/checkin-store';
import {
  getRouteById,
  getRouteCoverUrl,
  type RouteDto,
  type RouteHotspotDto,
} from '@/features/route/api/route-api';

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
}: {
  checkedInIds: string[];
  route: RouteDto;
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
        const coordinates = await getGoongRouteCoordinates({
          origin: points[0],
          destination: points[points.length - 1],
          waypoints: points.slice(1, -1),
        });

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
    <View className="relative bg-[#E8F0FE]">
      <AppMap
        points={points}
        routeCoordinates={routeCoordinates}
        height={288}
        showsUserLocation
      />
      <LinearGradient
        colors={['rgba(0,0,0,0.45)', 'transparent']}
        className="absolute inset-x-0 top-0 h-28"
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

function Stat({ label, hint }: { label: string; hint: string }) {
  return (
    <View className="flex-1 rounded-2xl bg-[#F4EFF8] p-2">
      <Text className="text-center text-[12px] font-bold leading-tight text-[#2B2233]">
        {label}
      </Text>
      <Text className="text-center text-[9px] text-[#8E869A]">{hint}</Text>
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

  useEffect(() => {
    let cancelled = false;

    async function loadRouteDetail() {
      if (!routeId) {
        setError('Thiếu mã tuyến.');
        setIsLoading(false);
        return;
      }

      setIsLoading(true);
      setError(null);

      try {
        const accessToken = await getValidAccessToken();
        const routeDetail = await getRouteById({
          accessToken,
          routeId,
          tokenType: session.tokenType,
        });

        if (cancelled) return;
        setRoute(routeDetail);
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
  }, [routeId, session.tokenType]);

  const checkedInIds = useMemo(() => checkins.map(String), [checkins]);

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
      <SafeAreaView className="flex-1 items-center justify-center bg-white px-6">
        <Text className="text-center text-[16px] font-bold text-[#2B2233]">Tuyến không tồn tại</Text>
        <Text className="mt-2 text-center text-[13px] text-[#8E869A]">
          {error || 'Không tìm thấy dữ liệu tuyến.'}
        </Text>
        <Pressable onPress={() => router.back()} className="mt-4 rounded-full bg-[#FFF4EF] px-4 py-2">
          <Text className="text-[14px] font-bold text-[#EB489B]">Quay lại</Text>
        </Pressable>
      </SafeAreaView>
    );
  }

  const completed = route.hotspots.filter((stop) => checkedInIds.includes(String(stop.hotspotId))).length;
  const progress = route.hotspots.length > 0 ? (completed / route.hotspots.length) * 100 : 0;
  const firstStop = route.hotspots[0];

  return (
    <View className="flex-1 bg-white">
      <ScrollView className="flex-1" contentContainerStyle={{ paddingBottom: 120 }} showsVerticalScrollIndicator={false}>
        <View className="relative">
          <RouteMapHero route={route} checkedInIds={checkedInIds} />

          <SafeAreaView edges={['top']} className="absolute inset-x-0 top-0">
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

        <View className="relative -mt-8 px-4">
          <View className="rounded-3xl bg-white p-5" style={cardShadow}>
            <View className="flex-row items-center gap-2">
              <SymbolView
                name={{ ios: 'sparkles', android: 'auto_awesome', web: 'auto_awesome' }}
                size={12}
                tintColor="#EB489B"
              />
              <Text className="text-[10px] font-semibold uppercase tracking-wider text-[#EB489B]">
                Tuyến di sản · API Backend
              </Text>
            </View>
            <Text className="mt-1 text-[24px] font-extrabold leading-tight text-[#2B2233]">
              {route.routeName}
            </Text>
            <Text className="mt-1 text-[13px] text-[#8E869A]">
              {route.description || 'Chưa có mô tả cho tuyến này.'}
            </Text>

            <View className="mt-4 flex-row gap-2">
              <Stat label={`${route.totalDistance || 0} km`} hint="Quãng đường" />
              <Stat label={`${route.estimateTime || 0} phút`} hint="Thời lượng" />
              <Stat label={getDifficultyLabel(route.difficulty)} hint="Độ khó" />
              <View className="flex-1 rounded-2xl bg-[#FFF5E8] p-2">
                <Text className="text-center text-[12px] font-bold leading-tight text-[#B86D2A]">
                  +{route.xp}
                </Text>
                <Text className="text-center text-[9px] text-[#B86D2A]/80">XP</Text>
              </View>
            </View>

            <View className="mt-4 flex-row items-center gap-2">
              <XPBar value={completed} max={route.hotspots.length} />
              <Text className="text-[11px] font-bold text-[#2B2233]">
                {completed}/{route.hotspots.length}
              </Text>
            </View>
            <Text className="mt-1 text-[10px] text-[#8E869A]">
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
            <Text className="mb-3 text-[18px] font-bold text-[#2B2233]">Hành trình của bạn</Text>
            <View className="pl-7">
              <View className="absolute bottom-2 left-3 top-2 w-px bg-[#EB489B]/40" />
              {route.hotspots.length > 0 ? route.hotspots.map((stop, index) => {
                const done = checkedInIds.includes(String(stop.hotspotId));
                return (
                  <Pressable
                    key={`${stop.hotspotId}-${index}`}
                    onPress={() => router.push(`/hotspot/${stop.hotspotId}` as Href)}
                    className="relative flex-row gap-3 pb-4"
                  >
                    <View
                      className={`absolute -left-7 top-2 h-6 w-6 items-center justify-center rounded-full border-2 border-white ${
                        done ? 'bg-[#F58752]' : 'bg-[#EB489B]'
                      }`}
                    >
                      {done ? (
                        <SymbolView
                          name={{ ios: 'checkmark.circle.fill', android: 'check_circle', web: 'check_circle' }}
                          size={12}
                          tintColor="#fff"
                        />
                      ) : (
                        <Text className="text-[10px] font-bold text-white">{index + 1}</Text>
                      )}
                    </View>
                    <Image
                      source={getStopImage(stop)}
                      contentFit="cover"
                      style={{ width: 64, height: 64, borderRadius: 16 }}
                    />
                    <View className="min-w-0 flex-1">
                      <Text className="text-[14px] font-semibold text-[#2B2233]" numberOfLines={1}>
                        {stop.hotspotName || `Hotspot #${stop.hotspotId}`}
                      </Text>
                      <Text className="text-[11px] text-[#8E869A]" numberOfLines={1}>
                        {stop.address || 'Chưa có địa chỉ'}
                      </Text>
                      <View className="mt-1.5 flex-row items-center gap-2">
                        <View className="rounded-full bg-[#F4EFF8] px-2 py-0.5">
                          <Text className="text-[10px] text-[#2B2233]">
                            {formatDistance(getDistanceKm(stop, route.hotspots[index + 1]))}
                          </Text>
                        </View>
                        <Text className="ml-auto text-[10px] font-bold text-[#EB489B]">
                          +{stop.xp ?? 0} XP
                        </Text>
                      </View>
                    </View>
                  </Pressable>
                );
              }) : (
                <View className="rounded-2xl bg-[#F4EFF8] p-4">
                  <Text className="text-[12px] text-[#8E869A]">
                    Backend chưa trả hotspot cho route này.
                  </Text>
                </View>
              )}
            </View>
          </View>
        </View>
      </ScrollView>

      <View className="absolute inset-x-0 bottom-0 px-4 pb-6 pt-2">
        <View className="flex-row gap-2 rounded-2xl bg-white/95 p-2.5" style={cardShadow}>
          <Pressable className="h-12 w-12 items-center justify-center rounded-xl bg-[#F4EFF8]">
            <SymbolView
              name={{ ios: 'bookmark', android: 'bookmark_border', web: 'bookmark_border' }}
              size={16}
              tintColor="#8E869A"
            />
          </Pressable>
          <Pressable
            disabled={!firstStop}
            onPress={() => {
              if (firstStop) {
                router.push(`/checkin/${firstStop.hotspotId}?routeId=${route.routeId}` as Href);
              }
            }}
            className={`flex-1 overflow-hidden rounded-xl ${firstStop ? '' : 'opacity-60'}`}
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
              <Text className="text-[14px] font-bold text-white">Bắt đầu hành trình</Text>
            </LinearGradient>
          </Pressable>
        </View>
      </View>
    </View>
  );
}
