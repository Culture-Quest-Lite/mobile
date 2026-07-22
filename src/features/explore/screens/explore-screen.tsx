import { Image } from 'expo-image';
import { LinearGradient } from 'expo-linear-gradient';
import * as Location from 'expo-location';
import { type Href, useRouter } from 'expo-router';
import { SymbolView } from '@/components/ui/symbol-view';
import { type ComponentProps, useEffect, useMemo, useRef, useState } from 'react';
import {
  ActivityIndicator,
  type NativeScrollEvent,
  type NativeSyntheticEvent,
  Pressable,
  ScrollView,
  Text,
  useWindowDimensions,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { getValidAccessToken, useAuthSession } from '@/features/auth/hooks/use-auth-session';
import { AppMap } from '@/features/map/components/app-map';
import {
  type NearbyHotspotDto,
  getNearbyHotspots,
} from '@/features/home/api/get-nearby-hotspots';
import {
  getRouteCoverUrl,
  getRouteStopCount,
  searchRoutes,
  type RouteDto,
} from '@/features/route/api/route-api';
import {
  type AppCoordinate,
  ensureForegroundLocationPermission,
  getDevelopmentLocationOverride,
  getDeviceCoordinate,
} from '@/lib/location';

const gradientColors = ['#EB489B', '#F58752', '#FFC93C'] as const;
const avatarImageUri =
  'https://i.pinimg.com/736x/25/c7/c1/25c7c1671263058c274374435c142b4f.jpg';
const fallbackRouteImage =
  'https://i.pinimg.com/1200x/80/69/f9/8069f9581583a196f9f39bda000b9312.jpg';
const fallbackPlaceImage =
  'https://i.pinimg.com/736x/f3/0f/e8/f30fe84218790e6ffd25f987d434eb13.jpg';
const defaultCoordinate: AppCoordinate = {
  latitude: 10.7769,
  longitude: 106.7009,
  source: 'dev-override',
};

type SymbolName = ComponentProps<typeof SymbolView>['name'];

type ApiPlaceCard = {
  id: string;
  title: string;
  category: string;
  badge: string;
  distance: string;
  rating: string;
  reward: string;
  reviews: string;
  imageUri: string;
  latitude: number;
  longitude: number;
};

type MissionCard = {
  icon: SymbolName;
  iconBackground: string;
  label: string;
  reward: string;
  subtitle: string;
};

const categories = ['Tất cả', 'Lịch sử', 'Kiến trúc', 'Văn hoá', 'Ẩm thực', 'Di sản'];

const missions: MissionCard[] = [
  {
    icon: { ios: 'figure.walk', android: 'directions_walk', web: 'directions_walk' },
    iconBackground: '#FFE9E3',
    label: 'Săn dấu ấn Chợ Lớn',
    reward: '+120 XP',
    subtitle: 'Còn 2 checkpoint để mở huy hiệu',
  },
  {
    icon: { ios: 'paintbrush', android: 'brush', web: 'brush' },
    iconBackground: '#FDEFD9',
    label: 'Bảo tàng Mỹ thuật',
    reward: '+80 XP',
    subtitle: 'Hoàn thành trước 18:00 hôm nay',
  },
  {
    icon: { ios: 'music.note', android: 'music_note', web: 'music_note' },
    iconBackground: '#E6F7F4',
    label: 'Đêm nhạc dân gian',
    reward: '+160 XP',
    subtitle: 'Thưởng thêm khi check-in đúng giờ',
  },
];

const heroShadowStyle = {
  shadowColor: 'rgba(235, 72, 155, 0.24)',
  shadowOpacity: 1,
  shadowRadius: 22,
  shadowOffset: { width: 0, height: 16 },
  elevation: 14,
} as const;

const cardShadowStyle = {
  shadowColor: 'rgba(245, 135, 82, 0.14)',
  shadowOpacity: 1,
  shadowRadius: 16,
  shadowOffset: { width: 0, height: 10 },
  elevation: 7,
} as const;

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

function mapHotspotToPlace(hotspot: NearbyHotspotDto): ApiPlaceCard {
  const firstTag = hotspot.tags[0]?.tagName || 'Di sản';

  return {
    badge: hotspot.status || 'PUBLISHED',
    category: firstTag,
    distance: 'Gần bạn',
    id: String(hotspot.hotspotId),
    imageUri: getHotspotImage(hotspot),
    latitude: hotspot.latitude,
    longitude: hotspot.longitude,
    rating: '4.8',
    reward: `+${hotspot.xp ?? hotspot.point ?? 0}`,
    reviews: '0',
    title: hotspot.hotspotName,
  };
}

function ExploreMap({
  places,
  routes,
  onRoutePress,
}: {
  places: ApiPlaceCard[];
  routes: RouteDto[];
  onRoutePress: (routeId: number) => void;
}) {
  const routePoints = routes[0]?.hotspots
    ?.filter((stop) => Number.isFinite(stop.latitude) && Number.isFinite(stop.longitude))
    .map((stop) => ({
      id: stop.hotspotId,
      title: stop.hotspotName || `Điểm #${stop.hotspotId}`,
      description: stop.address,
      latitude: Number(stop.latitude),
      longitude: Number(stop.longitude),
    }));

  const placePoints = places.map((place) => ({
    id: place.id,
    title: place.title,
    description: `${place.category} · ${place.distance}`,
    latitude: place.latitude,
    longitude: place.longitude,
  }));

  const points = routePoints?.length ? routePoints : placePoints;

  return (
    <View className="mx-5 overflow-hidden rounded-[28px] bg-[#E8F0FE]">
      <AppMap
        points={points}
        height={230}
        showsUserLocation
        onPointPress={(point) => {
          const route = routes.find((item) => String(item.routeId) === String(point.id));
          if (route) onRoutePress(route.routeId);
        }}
      />

      <View className="absolute left-3 top-3 rounded-full bg-white px-3 py-1.5 shadow">
        <Text className="text-[12px] font-bold text-[#2B2233]">
          {places.length} địa điểm · {routes.length} tuyến
        </Text>
      </View>
    </View>
  );
}

export default function ExploreScreen() {
  const router = useRouter();
  const session = useAuthSession();
  const { width } = useWindowDimensions();
  const [activeCategory, setActiveCategory] = useState<string>('Tất cả');
  const [activeRouteIndex, setActiveRouteIndex] = useState(0);
  const [apiRoutes, setApiRoutes] = useState<RouteDto[]>([]);
  const [nearbyPlaces, setNearbyPlaces] = useState<ApiPlaceCard[]>([]);
  const [isRoutesLoading, setIsRoutesLoading] = useState(true);
  const [isPlacesLoading, setIsPlacesLoading] = useState(true);
  const [routeError, setRouteError] = useState<string | null>(null);
  const [placeError, setPlaceError] = useState<string | null>(null);
  const carouselRef = useRef<ScrollView>(null);
  const activeRouteIndexRef = useRef(0);

  const safeWidth = Math.max(width, 320);
  const gutter = 20;
  const contentWidth = Math.max(safeWidth - gutter * 2, 280);
  const snapInterval = safeWidth;
  const routeCardWidth = Math.max(contentWidth, 280);

  const filteredPlaces = useMemo(() => {
    if (activeCategory === 'Tất cả') return nearbyPlaces;
    return nearbyPlaces.filter((p) => p.category === activeCategory);
  }, [activeCategory, nearbyPlaces]);

  const handleScrollEnd = (event: NativeSyntheticEvent<NativeScrollEvent>) => {
    const nextIndex = Math.round(event.nativeEvent.contentOffset.x / snapInterval);
    const bounded = Math.min(Math.max(nextIndex, 0), Math.max(apiRoutes.length - 1, 0));
    activeRouteIndexRef.current = bounded;
    setActiveRouteIndex(bounded);
  };

  useEffect(() => {
    let cancelled = false;

    async function loadRoutes() {
      setIsRoutesLoading(true);
      setRouteError(null);

      try {
        const accessToken = await getValidAccessToken();
        const result = await searchRoutes({
          accessToken,
          page: 0,
          size: 10,
          sortBy: 'routeId',
          sortDirection: 'DESC',
          status: 'PUBLISHED',
          tokenType: session.tokenType,
        });

        if (cancelled) return;

        const publishedRoutes = result.content.filter((route) => {
          const status = route.status?.toUpperCase();
          return status === 'PUBLISHED' || status === 'APPROVED';
        });

        setApiRoutes(publishedRoutes.length > 0 ? publishedRoutes : result.content);
      } catch (error) {
        if (cancelled) return;
        setApiRoutes([]);
        setRouteError(error instanceof Error ? error.message : 'Không thể tải tuyến từ API.');
      } finally {
        if (!cancelled) setIsRoutesLoading(false);
      }
    }

    void loadRoutes();

    return () => {
      cancelled = true;
    };
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
          distance: 10,
          latitude: coordinate.latitude,
          longitude: coordinate.longitude,
          tokenType: session.tokenType,
        });

        if (cancelled) return;
        setNearbyPlaces(hotspots.map(mapHotspotToPlace));
      } catch (error) {
        if (cancelled) return;
        setNearbyPlaces([]);
        setPlaceError(error instanceof Error ? error.message : 'Không thể tải địa điểm gần bạn.');
      } finally {
        if (!cancelled) setIsPlacesLoading(false);
      }
    }

    void loadNearbyPlaces();

    return () => {
      cancelled = true;
    };
  }, [session.tokenType]);

  useEffect(() => {
    if (apiRoutes.length <= 1) return;

    const timer = setInterval(() => {
      const nextIndex = (activeRouteIndexRef.current + 1) % apiRoutes.length;
      carouselRef.current?.scrollTo({ x: nextIndex * snapInterval, y: 0, animated: true });
      activeRouteIndexRef.current = nextIndex;
      setActiveRouteIndex(nextIndex);
    }, 4200);

    return () => clearInterval(timer);
  }, [apiRoutes.length, snapInterval]);

  function openRoute(routeId: number) {
    router.push(`/route/${routeId}` as Href);
  }

  return (
    <SafeAreaView className="flex-1 bg-white" edges={['top', 'left', 'right']}>
      <ScrollView
        className="flex-1"
        contentContainerStyle={{ paddingBottom: 32 }}
        showsVerticalScrollIndicator={false}
      >
        <View className="gap-6 px-5 pb-2 pt-4">
          <View className="flex-row items-center justify-between gap-4">
            <View className="flex-row items-center gap-3.5">
              <LinearGradient
                colors={gradientColors}
                start={{ x: 0, y: 0 }}
                end={{ x: 1, y: 1 }}
                className="h-16 w-16 rounded-full p-[2px]"
              >
                <View className="flex-1 rounded-full bg-white p-[3px]">
                  <Image
                    source={avatarImageUri}
                    contentFit="cover"
                    transition={180}
                    cachePolicy="memory-disk"
                    style={{ flex: 1, borderRadius: 999 }}
                  />
                </View>
              </LinearGradient>

              <View className="gap-1">
                <Text className="text-[15px] font-semibold text-[#2B2233]">
                  Chào {session.displayName || 'Ngọc'}
                </Text>
                <Text className="text-[12px] text-[#8E869A]">
                  Khám phá hành trình di sản quanh bạn
                </Text>
              </View>
            </View>

            <Pressable className="h-10 w-10 items-center justify-center rounded-3xl bg-[#FFF4EF]">
              <SymbolView
                name={{ ios: 'bell', android: 'notifications', web: 'notifications' }}
                size={16}
                tintColor="#EB489B"
              />
            </Pressable>
          </View>

          <View className="rounded-[28px] bg-[#F7F3EA] p-4">
            <View className="flex-row items-center justify-between">
              <View className="flex-1 pr-3">
                <Text className="text-[13px] font-semibold uppercase tracking-[1px] text-[#8A7D6D]">
                  Nổi bật hôm nay
                </Text>
                <Text className="mt-1 text-[18px] font-bold text-[#2B2233]">
                  {apiRoutes[0]?.routeName || 'Khám phá ẩm thực Sài Gòn'}
                </Text>
              </View>
              <View className="rounded-full bg-white px-3 py-2">
                <Text className="text-[11px] font-semibold uppercase text-[#B86D2A]">
                  XP +{apiRoutes[0]?.xp ?? 320}
                </Text>
              </View>
            </View>
          </View>

          {/* Search & Filter Bar */}
          <View className="flex-row items-center gap-3">
            <View className="flex-1 flex-row items-center rounded-[26px] bg-[#FAF7FC] px-4 py-3.5 border border-[#F3EDF7]">
              <SymbolView
                name={{ ios: 'magnifyingglass', android: 'search', web: 'search' }}
                size={16}
                tintColor="#AA9FB0"
              />
              <Text className="ml-2 text-[15px] text-[#AA9FB0]">
                Tìm điểm, tuyến, thử thách...
              </Text>
            </View>
            <Pressable className="h-11 w-11 items-center justify-center rounded-[18px] bg-[#FFF4EF]">
              <SymbolView
                name={{ ios: 'slider.horizontal.3', android: 'tune', web: 'tune' }}
                size={16}
                tintColor="#EB489B"
              />
            </Pressable>
          </View>

          {/* Quick Actions Toolbar */}
          <View className="flex-row items-center justify-between rounded-2xl border border-[#FCDDEC] bg-[#FFF8FC] p-3 shadow-sm">
            <Pressable
              onPress={() => router.push('/route/custom/plan')}
              className="flex-1 items-center gap-1.5"
            >
              <View className="h-11 w-11 items-center justify-center rounded-2xl bg-[#7C3AED]">
                <SymbolView
                  name={{
                    ios: 'sparkles',
                    android: 'auto_awesome',
                    web: 'auto_awesome',
                  }}
                  size={20}
                  tintColor="#FFFFFF"
                />
              </View>
              <Text className="text-center text-[11px] font-extrabold text-[#2B2233]">
                User Plan
              </Text>
              <View className="rounded-full bg-[#7C3AED] px-1.5 py-0.5">
                <Text className="text-[8px] font-extrabold text-white">PRO</Text>
              </View>
            </Pressable>

            <Pressable
              onPress={() => router.push('/route/custom/record')}
              className="flex-1 items-center gap-1.5"
            >
              <View className="h-11 w-11 items-center justify-center rounded-2xl bg-[#EB489B]">
                <SymbolView
                  name={{
                    ios: 'record.circle.fill',
                    android: 'radio_button_checked',
                    web: 'radio_button_checked',
                  }}
                  size={20}
                  tintColor="#FFFFFF"
                />
              </View>
              <Text className="text-center text-[11px] font-extrabold text-[#2B2233]">
                Record
              </Text>
              <View className="rounded-full bg-[#EB489B] px-1.5 py-0.5">
                <Text className="text-[8px] font-extrabold text-white">PRO</Text>
              </View>
            </Pressable>

            <Pressable
              onPress={() => router.push('/route')}
              className="flex-1 items-center gap-1.5"
            >
              <View className="h-11 w-11 items-center justify-center rounded-2xl bg-[#F58752]">
                <SymbolView
                  name={{
                    ios: 'map',
                    android: 'map',
                    web: 'map',
                  }}
                  size={20}
                  tintColor="#FFFFFF"
                />
              </View>
              <Text className="text-center text-[11px] font-bold text-[#2B2233]">
                Tuyến đường
              </Text>
            </Pressable>

            <Pressable
              onPress={() => router.push('/subscription')}
              className="flex-1 items-center gap-1.5"
            >
              <View className="h-11 w-11 items-center justify-center rounded-2xl bg-[#FFC93C]">
                <SymbolView
                  name={{
                    ios: 'crown.fill',
                    android: 'workspace_premium',
                    web: 'workspace_premium',
                  }}
                  size={20}
                  tintColor="#2B2233"
                />
              </View>
              <Text className="text-center text-[11px] font-bold text-[#2B2233]">
                Gói VIP
              </Text>
            </Pressable>
          </View>

          {/* Premium Features Showcase Section */}
          <View className="gap-3">
            <View className="flex-row items-center justify-between">
              <View className="flex-row items-center gap-2">
                <SymbolView
                  name={{
                    ios: 'crown.fill',
                    android: 'workspace_premium',
                    web: 'workspace_premium',
                  }}
                  size={18}
                  tintColor="#7C3AED"
                />
                <Text className="text-[17px] font-extrabold text-[#2B2233]">
                  Tính năng Premium Nổi bật
                </Text>
              </View>
              <Pressable
                onPress={() => router.push('/subscription')}
                className="rounded-full bg-[#EFE7F6] px-3 py-1"
              >
                <Text className="text-[11px] font-bold text-[#7C3AED]">
                  Gói Explorer Premium
                </Text>
              </Pressable>
            </View>
            <Text className="text-[12px] text-[#8E869A]">
              Mở khóa bộ công cụ du lịch di sản thông minh dành cho thành viên Premium
            </Text>

            {/* Card 1: User Plan */}
            <Pressable
              onPress={() => router.push('/route/custom/plan')}
              className="overflow-hidden rounded-[24px] border border-[#E9D5FF] bg-[#FAF5FF] p-4 shadow-sm"
            >
              <View className="flex-row items-start justify-between">
                <View className="flex-1 pr-3">
                  <View className="mb-2 flex-row items-center gap-1.5 self-start rounded-full bg-[#7C3AED] px-2.5 py-0.5">
                    <SymbolView
                      name={{
                        ios: 'sparkles',
                        android: 'auto_awesome',
                        web: 'auto_awesome',
                      }}
                      size={10}
                      tintColor="#FFFFFF"
                    />
                    <Text className="text-[10px] font-extrabold uppercase tracking-wider text-white">
                      PREMIUM FEATURE
                    </Text>
                  </View>
                  <Text className="text-[17px] font-extrabold text-[#2B2233]">
                    Lập kế hoạch hành trình (User Plan)
                  </Text>
                  <Text className="mt-1 text-[13px] leading-5 text-[#6B7280]">
                    Tự động gợi ý & tối ưu hóa lịch trình du lịch cá nhân hóa bằng AI theo thời gian và sở thích.
                  </Text>
                </View>
                <View className="h-12 w-12 shrink-0 items-center justify-center rounded-2xl bg-[#7C3AED]/12">
                  <SymbolView
                    name={{
                      ios: 'calendar.badge.clock',
                      android: 'edit_calendar',
                      web: 'edit_calendar',
                    }}
                    size={24}
                    tintColor="#7C3AED"
                  />
                </View>
              </View>
              <View className="mt-4 flex-row items-center justify-between border-t border-[#E9D5FF]/60 pt-3">
                <View className="flex-row items-center gap-1.5">
                  <SymbolView
                    name={{
                      ios: 'checkmark.seal.fill',
                      android: 'verified',
                      web: 'verified',
                    }}
                    size={14}
                    tintColor="#7C3AED"
                  />
                  <Text className="text-[12px] font-bold text-[#7C3AED]">
                    AI Tối ưu lộ trình & thời gian
                  </Text>
                </View>
                <View className="flex-row items-center rounded-full bg-[#7C3AED] px-3.5 py-1.5">
                  <Text className="text-[12px] font-extrabold text-white">
                    Tạo kế hoạch AI →
                  </Text>
                </View>
              </View>
            </Pressable>

            {/* Card 2: Record Journey */}
            <Pressable
              onPress={() => router.push('/route/custom/record')}
              className="overflow-hidden rounded-[24px] border border-[#FCCEE2] bg-[#FFF5F9] p-4 shadow-sm"
            >
              <View className="flex-row items-start justify-between">
                <View className="flex-1 pr-3">
                  <View className="mb-2 flex-row items-center gap-1.5 self-start rounded-full bg-[#EB489B] px-2.5 py-0.5">
                    <SymbolView
                      name={{
                        ios: 'record.circle.fill',
                        android: 'radio_button_checked',
                        web: 'radio_button_checked',
                      }}
                      size={10}
                      tintColor="#FFFFFF"
                    />
                    <Text className="text-[10px] font-extrabold uppercase tracking-wider text-white">
                      PREMIUM FEATURE
                    </Text>
                  </View>
                  <Text className="text-[17px] font-extrabold text-[#2B2233]">
                    Ghi lại hành trình (Record Journey)
                  </Text>
                  <Text className="mt-1 text-[13px] leading-5 text-[#6B7280]">
                    Định vị GPS real-time, lưu lại khoảnh khắc, hình ảnh & câu chuyện di sản trên chuyến đi.
                  </Text>
                </View>
                <View className="h-12 w-12 shrink-0 items-center justify-center rounded-2xl bg-[#EB489B]/12">
                  <SymbolView
                    name={{
                      ios: 'location.fill',
                      android: 'my_location',
                      web: 'my_location',
                    }}
                    size={24}
                    tintColor="#EB489B"
                  />
                </View>
              </View>
              <View className="mt-4 flex-row items-center justify-between border-t border-[#FCCEE2]/60 pt-3">
                <View className="flex-row items-center gap-1.5">
                  <SymbolView
                    name={{
                      ios: 'map.fill',
                      android: 'map',
                      web: 'map',
                    }}
                    size={14}
                    tintColor="#EB489B"
                  />
                  <Text className="text-[12px] font-bold text-[#EB489B]">
                    Ghi tọa độ & nhật ký Live
                  </Text>
                </View>
                <View className="flex-row items-center rounded-full bg-[#EB489B] px-3.5 py-1.5">
                  <Text className="text-[12px] font-extrabold text-white">
                    Bắt đầu ghi lại →
                  </Text>
                </View>
              </View>
            </Pressable>
          </View>

          {/* Daily Featured Banner */}
          <View className="rounded-[28px] bg-[#F7F3EA] p-4 border border-[#EBE3D5]">
            <View className="flex-row items-center justify-between">
              <View className="flex-1 pr-3">
                <Text className="text-[12px] font-semibold uppercase tracking-[1px] text-[#8A7D6D]">
                  Nổi bật hôm nay
                </Text>
                <Text className="mt-1 text-[17px] font-bold text-[#2B2233]">
                  {apiRoutes[0]?.routeName || 'Khám phá ẩm thực Sài Gòn'}
                </Text>
              </View>
              <View className="rounded-full bg-white px-3 py-2 border border-[#E5DFD2]">
                <Text className="text-[11px] font-semibold uppercase text-[#B86D2A]">
                  XP +{apiRoutes[0]?.xp ?? 320}
                </Text>
              </View>
            </View>
          </View>

          {/* Category Filter Pills */}
          <View className="gap-2">
            <Text className="text-[14px] font-extrabold text-[#2B2233]">
              Lọc theo chủ đề:
            </Text>
            <ScrollView
              horizontal
              showsHorizontalScrollIndicator={false}
              contentContainerStyle={{ paddingVertical: 2 }}
            >
              {categories.map((category) => {
                const selected = category === activeCategory;
                return (
                  <Pressable
                    key={category}
                    onPress={() => setActiveCategory(category)}
                    className={`mr-2.5 rounded-full border px-4 py-2 ${
                      selected ? 'border-[#BB8B4D] bg-[#FBF1E5]' : 'border-[#E5DFD2] bg-white'
                    }`}
                  >
                    <Text
                      className={`text-[13px] font-bold ${
                        selected ? 'text-[#A2672B]' : 'text-[#6E6B62]'
                      }`}
                    >
                      {category}
                    </Text>
                  </Pressable>
                );
              })}
            </ScrollView>
          </View>
        </View>

        <View className="mb-6">
          <View
            className="mb-3 flex-row items-center justify-between"
            style={{ paddingHorizontal: gutter }}
          >
              <Text className="text-[19px] font-bold text-[#2B2233]">Bản đồ địa điểm</Text>
            <Pressable className="rounded-full bg-[#FFF4EF] px-3 py-2">
              <Text className="text-[14px] font-semibold text-[#F58752]">Toàn màn hình</Text>
            </Pressable>
          </View>
          <ExploreMap
            places={filteredPlaces}
            routes={apiRoutes}
            onRoutePress={openRoute}
          />
          {placeError ? (
            <Text className="mx-5 mt-2 text-[11px] text-[#B86D2A]">{placeError}</Text>
          ) : null}
        </View>

        <View className="gap-6 px-5">
          <View className="gap-4">
            <View className="flex-row items-center justify-between">
              <Text className="text-[22px] font-bold text-[#2B2233]">Tuyến gợi ý</Text>
              <Text className="text-[12px] font-semibold text-[#8A7D6D]">
                {isRoutesLoading ? 'Đang tải' : `${apiRoutes.length} tuyến`}
              </Text>
            </View>

            {isRoutesLoading ? (
              <View className="h-[260px] items-center justify-center rounded-[30px] bg-[#F7F3EA]">
                <ActivityIndicator color="#EB489B" />
                <Text className="mt-2 text-[12px] text-[#8E869A]">Đang tải tuyến từ API...</Text>
              </View>
            ) : apiRoutes.length === 0 ? (
              <View className="rounded-[28px] border border-[#E6DDD1] bg-[#FCFAF5] p-5">
                <Text className="text-[15px] font-bold text-[#2B2233]">Chưa có tuyến publish</Text>
                <Text className="mt-1 text-[12px] text-[#8E869A]">
                  {routeError || 'Backend chưa trả về tuyến PUBLISHED.'}
                </Text>
              </View>
            ) : (
              <ScrollView
                ref={carouselRef}
                horizontal
                pagingEnabled
                snapToAlignment="start"
                snapToInterval={snapInterval}
                decelerationRate="fast"
                bounces={false}
                showsHorizontalScrollIndicator={false}
                onMomentumScrollEnd={handleScrollEnd}
                style={{ width, marginHorizontal: -20 }}
              >
                {apiRoutes.map((route) => (
                  <View
                    key={route.routeId}
                    className="items-start"
                    style={{ width: snapInterval, paddingLeft: 20 }}
                  >
                    <View
                      className="overflow-hidden rounded-[30px] bg-[#2B2233]"
                      style={[heroShadowStyle, { width: routeCardWidth }]}
                    >
                      <Image
                        source={getRouteImage(route)}
                        contentFit="cover"
                        transition={220}
                        cachePolicy="memory-disk"
                        style={{ height: 220, width: '100%' }}
                      />
                      <LinearGradient
                        colors={[
                          'rgba(36, 28, 44, 0.12)',
                          'rgba(36, 28, 44, 0.58)',
                          'rgba(36, 28, 44, 0.96)',
                        ]}
                        start={{ x: 0.5, y: 0 }}
                        end={{ x: 0.5, y: 1 }}
                        className="absolute inset-0 px-5 py-5"
                      >
                        <View className="flex-1 justify-end gap-3">
                          <Text className="text-[12px] font-semibold uppercase tracking-[0.8px] text-[#E9D7C5]">
                            Tuyến di sản · {getDifficultyLabel(route.difficulty)}
                          </Text>
                          <Text className="text-[28px] font-extrabold leading-[36px] text-white" numberOfLines={2}>
                            {route.routeName}
                          </Text>
                          <Text className="text-[13px] leading-5 text-[#F4E4DA]" numberOfLines={2}>
                            {route.description || 'Khám phá tuyến di sản được curator xây dựng.'}
                          </Text>
                          <View className="flex-row flex-wrap gap-2 pt-1">
                            {[
                              `${getRouteStopCount(route)} điểm dừng`,
                              `${route.totalDistance || 0} km`,
                              `${route.estimateTime || 0} phút`,
                            ].map((tag) => (
                              <View key={tag} className="rounded-full bg-white/15 px-3 py-1.5">
                                <Text className="text-[12px] font-semibold text-white">{tag}</Text>
                              </View>
                            ))}
                          </View>
                          <View className="flex-row items-center justify-between pt-1">
                            <Pressable
                              onPress={() => openRoute(route.routeId)}
                              className="rounded-full bg-white/90 px-4 py-2.5"
                            >
                              <Text className="text-[14px] font-extrabold text-[#D9587F]">
                                Xem route
                              </Text>
                            </Pressable>
                            <View className="rounded-full bg-[#FFB400] px-3 py-1.5">
                              <Text className="text-[12px] font-extrabold text-[#2B2233]">
                                +{route.xp} XP
                              </Text>
                            </View>
                          </View>
                        </View>
                      </LinearGradient>
                    </View>
                  </View>
                ))}
              </ScrollView>
            )}

            {apiRoutes.length > 1 ? (
              <View className="flex-row items-center justify-center gap-2">
                {apiRoutes.map((_, index) => (
                  <View
                    key={index}
                    className={`rounded-full ${
                      index === activeRouteIndex
                        ? 'h-2.5 w-8 bg-[#EB489B]'
                        : 'h-2.5 w-2.5 bg-[#F3C9D9]'
                    }`}
                  />
                ))}
              </View>
            ) : null}
          </View>

          <View className="gap-4">
            <View className="flex-row items-center justify-between">
              <Text className="text-[19px] font-bold text-[#2B2233]">Gần bạn</Text>
              <Pressable className="rounded-full bg-[#FFF4EF] px-3 py-2">
                <Text className="text-[14px] font-semibold text-[#F58752]">Xem bản đồ</Text>
              </Pressable>
            </View>

            {isPlacesLoading ? (
              <View className="items-center py-8">
                <ActivityIndicator color="#EB489B" />
                <Text className="mt-2 text-[12px] text-[#8E869A]">Đang tải hotspot gần bạn...</Text>
              </View>
            ) : filteredPlaces.length === 0 ? (
              <View className="items-center py-8">
                <Text className="text-[15px] text-[#8E869A]">
                  Không có địa điểm cho danh mục này
                </Text>
              </View>
            ) : (
              <View className="gap-4">
                {filteredPlaces.map((place) => (
                  <Pressable
                    key={place.id}
                    className="overflow-hidden rounded-[28px] border border-[#E6DDD1] bg-[#FCFAF5]"
                  >
                    <Image
                      source={place.imageUri}
                      contentFit="cover"
                      style={{ height: 130, width: '100%' }}
                    />
                    <View className="px-4 py-4">
                      <View className="flex-row items-center justify-between">
                        <Text className="text-[17px] font-bold text-[#2B2233]" numberOfLines={1}>
                          {place.title}
                        </Text>
                        <View className="rounded-full bg-[#FFF5E8] px-3 py-1.5">
                          <Text className="text-[13px] font-semibold text-[#B86D2A]">
                            {place.reward} XP
                          </Text>
                        </View>
                      </View>
                      <Text className="mt-1 text-[14px] text-[#6E6B62]">
                        {place.category} · {place.badge}
                      </Text>
                      <View className="mt-3 flex-row items-center justify-between">
                        <View className="flex-row items-center gap-2">
                          <SymbolView
                            name={{ ios: 'star.fill', android: 'star', web: 'star' }}
                            size={13}
                            tintColor="#D18C2F"
                          />
                          <Text className="text-[14px] font-semibold text-[#2B2233]">
                            {place.rating}
                          </Text>
                          <Text className="text-[13px] text-[#8A7D6D]">
                            ({place.reviews} đánh giá)
                          </Text>
                        </View>
                        <View className="flex-row items-center gap-1">
                          <SymbolView
                            name={{ ios: 'location.fill', android: 'place', web: 'place' }}
                            size={12}
                            tintColor="#8A7D6D"
                          />
                          <Text className="text-[13px] text-[#8A7D6D]">{place.distance}</Text>
                        </View>
                      </View>
                    </View>
                  </Pressable>
                ))}
              </View>
            )}
          </View>

          <View
            className="gap-4 rounded-[28px] bg-[#FFF8FC] p-4"
            style={cardShadowStyle}
          >
            <View className="flex-row items-center justify-between">
              <Text className="text-[19px] font-bold text-[#2B2233]">Nhiệm vụ nổi bật</Text>
              <Pressable>
                <Text className="text-[15px] font-bold text-[#F58752]">Xem tất cả</Text>
              </Pressable>
            </View>

            <View className="gap-3">
              {missions.map((item) => (
                <View
                  key={item.label}
                  className="flex-row items-center rounded-[22px] bg-white px-3 py-3.5"
                >
                  <View
                    className="mr-3 h-10 w-10 items-center justify-center rounded-full"
                    style={{ backgroundColor: item.iconBackground }}
                  >
                    <SymbolView name={item.icon} size={16} tintColor="#3D3446" />
                  </View>
                  <View className="flex-1 pr-3">
                    <Text className="text-[17px] font-extrabold text-[#2B2233]">{item.label}</Text>
                    <Text className="mt-0.5 text-[13px] leading-4 text-[#8E869A]">
                      {item.subtitle}
                    </Text>
                  </View>
                  <Text className="text-[18px] font-extrabold text-[#2B2233]">{item.reward}</Text>
                </View>
              ))}
            </View>
          </View>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

