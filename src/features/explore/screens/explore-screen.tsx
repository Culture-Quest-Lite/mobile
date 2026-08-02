import { Image } from 'expo-image';
import { LinearGradient } from 'expo-linear-gradient';
import * as Location from 'expo-location';
import { type Href, useFocusEffect, useRouter } from 'expo-router';
import { SymbolView } from '@/components/ui/symbol-view';
import { type ComponentProps, useCallback, useEffect, useMemo, useRef, useState } from 'react';
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
import { getGamificationLevels } from '@/features/profile/api/get-levels';
import { getMyProfile } from '@/features/profile/api/get-me';
import { setPremiumStatusFromProfile, usePremiumStatus } from '@/features/profile/hooks/use-premium-status';
import { applyLevelProgressToProfile } from '@/features/profile/lib/level-progress';
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


type ExplorerSummary = {
  avatar: string | null;
  isPremium: boolean;
  level: number | null;
  name: string;
  username: string;
};

function getProfileInitials(name: string, username: string) {
  const source = name.trim() || username.replace(/^@+/, '').trim();

  if (!source) return 'ME';

  const parts = source.split(/\s+/).filter(Boolean);
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();

  return `${parts[0][0] ?? ''}${parts[parts.length - 1][0] ?? ''}`.toUpperCase();
}

function ExplorerHeaderAvatar({
  avatar,
  level,
  name,
  username,
}: Omit<ExplorerSummary, 'isPremium'>) {
  const [failedAvatar, setFailedAvatar] = useState<string | null>(null);
  const initials = getProfileInitials(name, username);
  const shouldShowFallback = !avatar || failedAvatar === avatar;

  return (
    <View className="relative">
      <LinearGradient
        colors={gradientColors}
        end={{ x: 1, y: 0.9 }}
        start={{ x: 0, y: 0.1 }}
        className="h-16 w-16 rounded-full p-[2px]"
      >
        <View className="flex-1 rounded-full bg-white p-[3px]">
          {shouldShowFallback ? (
            <View className="flex-1 items-center justify-center rounded-full bg-[#FFF1F6]">
              <Text className="text-[18px] font-black text-[#D9587F]">{initials}</Text>
            </View>
          ) : (
            <Image
              source={avatar}
              contentFit="cover"
              transition={180}
              cachePolicy="memory-disk"
              onError={() => setFailedAvatar(avatar)}
              style={{ flex: 1, borderRadius: 999 }}
            />
          )}
        </View>
      </LinearGradient>

      {typeof level === 'number' ? (
        <View className="absolute -bottom-1 -right-2 rounded-full border-2 border-white bg-[#b1741e] px-2.5 py-1">
          <Text className="text-[11px] font-extrabold text-white">{`Lv.${level}`}</Text>
        </View>
      ) : null}
    </View>
  );
}

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
  const { requirePremium } = usePremiumStatus();
  const { width } = useWindowDimensions();
  const [activeCategory, setActiveCategory] = useState<string>('Tất cả');
  const [activeRouteIndex, setActiveRouteIndex] = useState(0);
  const [apiRoutes, setApiRoutes] = useState<RouteDto[]>([]);
  const [nearbyPlaces, setNearbyPlaces] = useState<ApiPlaceCard[]>([]);
  const [isRoutesLoading, setIsRoutesLoading] = useState(true);
  const [isPlacesLoading, setIsPlacesLoading] = useState(true);
  const [routeError, setRouteError] = useState<string | null>(null);
  const [placeError, setPlaceError] = useState<string | null>(null);
  const [explorerSummary, setExplorerSummary] = useState<ExplorerSummary | null>(null);
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
            name: resolvedName || 'Ngọc',
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

  const explorerName =
    explorerSummary?.name.trim() ||
    session.displayName.trim() ||
    session.username?.trim() ||
    'Ngọc';
  const explorerUsername =
    explorerSummary?.username.trim() || session.username?.trim() || explorerName;
  const explorerAvatar = explorerSummary?.avatar ?? null;
  const explorerLevel = explorerSummary?.level ?? null;
  const isPremiumExplorer = explorerSummary?.isPremium ?? false;

  return (
    <SafeAreaView className="flex-1 bg-white" edges={['top', 'left', 'right']}>
      <ScrollView
        className="flex-1"
        contentContainerStyle={{ paddingBottom: 32 }}
        showsVerticalScrollIndicator={false}
      >
        <View className="gap-6 px-5 pb-2 pt-4">
          <View className="flex-row items-center justify-between">
            <View className="flex-1 flex-row items-center gap-3.5 pr-3">
              <ExplorerHeaderAvatar
                avatar={explorerAvatar}
                level={explorerLevel}
                name={explorerName}
                username={explorerUsername}
              />

              <View className="flex-1 gap-0.5">
                <Text
                  className="text-[15px] font-extrabold tracking-[-0.3px] text-[#2B2233]"
                  numberOfLines={1}
                >
                  Chào {explorerName}
                </Text>
                <Text className="text-[11px] leading-4 text-[#8E869A]">
                  Sẵn sàng khám phá
                </Text>
              </View>
            </View>

            <View className="flex-row items-center gap-2.5">
              <Pressable
                accessibilityLabel="Mở địa điểm gần bạn"
                className="h-10 w-10 items-center justify-center rounded-full bg-[#FFF4EF]"
                hitSlop={8}
                onPress={() => router.push('/hotspots')}
              >
                <SymbolView
                  name={{ ios: 'location', android: 'my_location', web: 'my_location' }}
                  size={16}
                  tintColor="#F58752"
                />
              </Pressable>

              <Pressable
                accessibilityLabel="Mở danh sách địa danh"
                className="h-10 w-10 items-center justify-center rounded-full bg-[#FAF7FC]"
                hitSlop={8}
                onPress={() => router.push('/hotspots')}
              >
                <SymbolView
                  name={{ ios: 'magnifyingglass', android: 'search', web: 'search' }}
                  size={16}
                  tintColor="#8E869A"
                />
              </Pressable>

              <Pressable
                accessibilityLabel="Mở thông báo"
                className="h-10 w-10 items-center justify-center rounded-full bg-[#FFF4EF]"
                hitSlop={8}
                onPress={() => router.push('/notifications')}
              >
                <SymbolView
                  name={{ ios: 'bell', android: 'notifications', web: 'notifications' }}
                  size={16}
                  tintColor="#EB489B"
                />
              </Pressable>
            </View>
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
              onPress={() => {
                if (!requirePremium("Tạo kế hoạch hành trình (User Plan)")) return;
                router.push('/route/custom/plan');
              }}
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
              onPress={() => {
                if (!requirePremium('Ghi hành trình cá nhân (Record Journey)')) return;
                router.push('/route/custom/record');
              }}
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

          </View>

          {/* Premium status / upsell card (driven by real subscription data) */}
          {isPremiumExplorer ? (
            <View
              className="overflow-hidden rounded-[28px] border border-[#E9D5FF] bg-[#FAF5FF] p-5"
              style={heroShadowStyle}
            >
              <View className="absolute -right-5 -top-6 h-24 w-24 rounded-full bg-[#E9D5FF]/70" />
              <View className="absolute -bottom-8 right-14 h-20 w-20 rounded-full bg-[#FBCFE8]/60" />

              <View className="flex-row items-start justify-between gap-4">
                <View className="flex-1">
                  <View className="mb-3 flex-row items-center gap-2 self-start rounded-full bg-white px-3 py-1.5">
                    <SymbolView
                      name={{
                        ios: 'crown.fill',
                        android: 'workspace_premium',
                        web: 'workspace_premium',
                      }}
                      size={13}
                      tintColor="#7C3AED"
                    />
                    <Text className="text-[10px] font-extrabold uppercase tracking-[1px] text-[#7C3AED]">
                      Premium Explorer
                    </Text>
                  </View>

                  <Text className="text-[22px] font-black leading-7 text-[#2B2233]">
                    Tài khoản của bạn đã là Premium
                  </Text>
                  <Text className="mt-2 text-[13px] leading-5 text-[#6F6678]">
                    Hành trình độc quyền, AI lập kế hoạch, ghi hành trình Live và trải nghiệm không quảng cáo đã được mở khóa.
                  </Text>
                </View>

                <View className="mt-2 h-16 w-16 items-center justify-center rounded-[22px] bg-white">
                  <SymbolView
                    name={{
                      ios: 'crown.fill',
                      android: 'workspace_premium',
                      web: 'workspace_premium',
                    }}
                    size={30}
                    tintColor="#7C3AED"
                  />
                </View>
              </View>
            </View>
          ) : (
            <Pressable
              onPress={() => router.push('/subscription/premium')}
              className="overflow-hidden rounded-[28px] border border-[#E9D5FF] bg-[#FAF5FF] p-5"
              style={heroShadowStyle}
            >
              <View className="absolute -right-5 -top-6 h-24 w-24 rounded-full bg-[#E9D5FF]/70" />
              <View className="absolute -bottom-8 right-14 h-20 w-20 rounded-full bg-[#FBCFE8]/60" />

              <View className="flex-row items-start justify-between gap-4">
                <View className="flex-1">
                  <View className="mb-3 flex-row items-center gap-2 self-start rounded-full bg-white px-3 py-1.5">
                    <SymbolView
                      name={{
                        ios: 'sparkles',
                        android: 'auto_awesome',
                        web: 'auto_awesome',
                      }}
                      size={13}
                      tintColor="#7C3AED"
                    />
                    <Text className="text-[10px] font-extrabold uppercase tracking-[1px] text-[#7C3AED]">
                      CultureQuest Premium
                    </Text>
                  </View>

                  <Text className="text-[22px] font-black leading-7 text-[#2B2233]">
                    Khám phá nhiều hơn
                  </Text>
                  <Text className="mt-2 text-[13px] leading-5 text-[#6F6678]">
                    Mở khóa hành trình độc quyền, nhận thêm XP và tận hưởng trải nghiệm không quảng cáo.
                  </Text>

                  <View className="mt-4 flex-row items-center gap-2 self-start rounded-full bg-[#7C3AED] px-4 py-2.5">
                    <Text className="text-[12px] font-extrabold text-white">
                      Xem quyền lợi Premium
                    </Text>
                    <SymbolView
                      name={{ ios: 'chevron.right', android: 'chevron_right', web: 'chevron_right' }}
                      size={14}
                      tintColor="#FFFFFF"
                    />
                  </View>
                </View>

                <View className="mt-2 h-16 w-16 items-center justify-center rounded-[22px] bg-white">
                  <SymbolView
                    name={{
                      ios: 'crown.fill',
                      android: 'workspace_premium',
                      web: 'workspace_premium',
                    }}
                    size={30}
                    tintColor="#7C3AED"
                  />
                </View>
              </View>
            </Pressable>
          )}

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
              {!isRoutesLoading ? (
                <Text className="text-[12px] font-semibold text-[#8A7D6D]">
                  {`${apiRoutes.length} tuyến`}
                </Text>
              ) : null}
            </View>

            {isRoutesLoading ? (
              <View className="h-[260px] items-center justify-center rounded-[30px] bg-[#F7F3EA]">
                <ActivityIndicator color="#EB489B" />
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

