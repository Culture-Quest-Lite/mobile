import { Image } from 'expo-image';
import { LinearGradient } from 'expo-linear-gradient';
import { type Href, useRouter } from 'expo-router';
import { SymbolView } from 'expo-symbols';
import { type ComponentProps, useEffect, useMemo, useRef, useState } from 'react';
import {
  type NativeScrollEvent,
  type NativeSyntheticEvent,
  Pressable,
  ScrollView,
  Text,
  View,
  useWindowDimensions,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

// ─── Shared data (đồng bộ với home-screen) ───────────────────────────────────
// Lý tưởng nhất: di chuyển 2 block này sang src/data/places.ts và import ở cả 2 màn hình

const gradientColors = ['#EB489B', '#F58752', '#FFC93C'] as const;
const avatarImageUri =
  'https://i.pinimg.com/736x/25/c7/c1/25c7c1671263058c274374435c142b4f.jpg';

type SymbolName = ComponentProps<typeof SymbolView>['name'];

// ── Dữ liệu tuyến nổi bật (giống home-screen) ────────────────────────────────
const featuredRoutes = [
  {
    id: 'vinh-ha-long',
    title: 'Vịnh Hạ Long',
    subtitle: 'Lộ trình ghé Chợ Bến Thành, Bưu điện Thành phố và những góc kể chuyện văn hóa giữa trung tâm.',
    distance: '2.4 km',
    duration: '95 phút',
    stops: '06 điểm dừng',
    xp: 120,
    imageUri:
      'https://i.pinimg.com/1200x/80/69/f9/8069f9581583a196f9f39bda000b9312.jpg',
  },
  {
    id: 'mui-ne',
    title: 'Dấu ấn Mũi Né',
    subtitle: 'Khám phá kiến trúc hội quán, chợ cổ và những lớp ký ức người Hoa giữa lòng thành phố.',
    distance: '3.1 km',
    duration: '110 phút',
    stops: '08 điểm dừng',
    xp: 150,
    imageUri:
      'https://i.pinimg.com/1200x/6d/cd/14/6dcd140b80b210ac445a0eddfc40784a.jpg',
  },
  {
    id: 'pho-co-dem',
    title: 'Phố cổ về đêm',
    subtitle: 'Đi qua các sân khấu, phố đi bộ và không gian âm nhạc để cảm nhận nhịp sống buổi tối.',
    distance: '2.8 km',
    duration: '88 phút',
    stops: '05 điểm dừng',
    xp: 110,
    imageUri:
      'https://i.pinimg.com/736x/00/17/04/001704938bb7cf0b964b07a6b2eeffc4.jpg',
  },
] as const;

// ── Dữ liệu địa điểm gần bạn (giống home-screen) ─────────────────────────────
type NearbyPlace = {
  id: string;
  title: string;
  category: string;
  badge: string;
  distance: string;
  rating: string;
  reward: string;
  reviews: string;
  imageUri: string;
};

const nearbyPlaces: NearbyPlace[] = [
  {
    id: 'quy-nhon',
    title: 'Quy Nhơn',
    category: 'Kiến trúc',
    badge: 'Biển đảo',
    distance: '320m',
    rating: '4.7',
    reward: '+120',
    reviews: '284',
    imageUri:
      'https://i.pinimg.com/736x/f3/0f/e8/f30fe84218790e6ffd25f987d434eb13.jpg',
  },
  {
    id: 'hai-phong',
    title: 'Hải Phòng',
    category: 'Lịch sử',
    badge: 'Cảng biển',
    distance: '540m',
    rating: '4.8',
    reward: '+95',
    reviews: '198',
    imageUri:
      'https://i.pinimg.com/1200x/b3/07/e7/b307e7540a1d2c91f96933794c0b681c.jpg',
  },
  {
    id: 'da-lat',
    title: 'Đà Lạt',
    category: 'Nghệ thuật',
    badge: 'Cao nguyên',
    distance: '850m',
    rating: '4.6',
    reward: '+140',
    reviews: '312',
    imageUri:
      'https://i.pinimg.com/1200x/9a/d1/dd/9ad1dd8c33e939d6fa4731f72e6095fa.jpg',
  },
];

// ── Nhiệm vụ nổi bật (giống home-screen) ─────────────────────────────────────
type MissionCard = {
  icon: SymbolName;
  iconBackground: string;
  label: string;
  reward: string;
  subtitle: string;
};

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

// ─── Danh mục lọc ─────────────────────────────────────────────────────────────
const categories = ['Tất cả', 'Lịch sử', 'Kiến trúc', 'Văn hoá', 'Ẩm thực', 'Di sản'];

// ─── Styles ───────────────────────────────────────────────────────────────────
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

// ─────────────────────────────────────────────────────────────────────────────
// MAP PLACEHOLDER
//
// Để thêm bản đồ thật, có 3 lựa chọn:
//
// 1. react-native-maps (Google Maps / Apple Maps — khuyến nghị)
//    npm install react-native-maps
//    Thêm vào app.json: { "android": { "googleMapsApiKey": "YOUR_KEY" } }
//    Dùng: <MapView style={{...}} initialRegion={...}> <Marker .../> </MapView>
//
// 2. expo-maps (SDK 53+, đang beta — chỉ iOS/Android)
//    npx expo install expo-maps
//    Dùng: <AppleMaps.View> / <GoogleMaps.View>
//    Ưu điểm: API Expo chuẩn, tích hợp sẵn với EAS
//
// 3. MapLibre / Mapbox (map tile tự host, không cần Google key)
//    npm install @maplibre/maplibre-react-native
//
// Component bên dưới là placeholder có thể thay thế bằng <MapView> thực tế.
// ─────────────────────────────────────────────────────────────────────────────
function MapPlaceholder() {
  return (
    <View
      className="mx-5 overflow-hidden rounded-[28px] bg-[#E8F0FE]"
      style={{ height: 200 }}
    >
      {/* Thay View này bằng <MapView> khi đã cài react-native-maps */}
      <View className="flex-1 items-center justify-center gap-2">
        <SymbolView
          name={{ ios: 'map.fill', android: 'map', web: 'map' }}
          size={36}
          tintColor="#4A80F5"
        />
        <Text className="text-[14px] font-bold text-[#4A80F5]">Bản đồ địa điểm</Text>
        <Text className="text-[12px] text-[#8A9BB8]">Cài react-native-maps để hiển thị</Text>
      </View>

      {/* Nút định vị góc phải dưới */}
      <Pressable className="absolute bottom-3 right-3 h-10 w-10 items-center justify-center rounded-full bg-white shadow">
        <SymbolView
          name={{ ios: 'location.fill', android: 'my_location', web: 'my_location' }}
          size={18}
          tintColor="#4A80F5"
        />
      </Pressable>

      {/* Badge số điểm trên map */}
      <View className="absolute left-3 top-3 rounded-full bg-white px-3 py-1.5 shadow">
        <Text className="text-[12px] font-bold text-[#2B2233]">
          {nearbyPlaces.length} địa điểm gần bạn
        </Text>
      </View>
    </View>
  );
}

// ─────────────────────────────────────────────────────────────────────────────

export default function ExploreScreen() {
  const router = useRouter();
  const { width } = useWindowDimensions();
  const [activeCategory, setActiveCategory] = useState<string>('Tất cả');
  const [activeRouteIndex, setActiveRouteIndex] = useState(0);
  const carouselRef = useRef<ScrollView>(null);
  const activeRouteIndexRef = useRef(0);

  const snapInterval = width;
  const routeCardWidth = Math.max(width - 72, 280);

  const filteredPlaces = useMemo(() => {
    if (activeCategory === 'Tất cả') return nearbyPlaces;
    return nearbyPlaces.filter((p) => p.category === activeCategory);
  }, [activeCategory]);

  const handleScrollEnd = (event: NativeSyntheticEvent<NativeScrollEvent>) => {
    const nextIndex = Math.round(event.nativeEvent.contentOffset.x / snapInterval);
    const bounded = Math.min(Math.max(nextIndex, 0), featuredRoutes.length - 1);
    activeRouteIndexRef.current = bounded;
    setActiveRouteIndex(bounded);
  };

  useEffect(() => {
    const timer = setInterval(() => {
      const nextIndex = (activeRouteIndexRef.current + 1) % featuredRoutes.length;
      carouselRef.current?.scrollTo({ x: nextIndex * snapInterval, y: 0, animated: true });
      activeRouteIndexRef.current = nextIndex;
      setActiveRouteIndex(nextIndex);
    }, 4200);
    return () => clearInterval(timer);
  }, [snapInterval]);

  return (
    <SafeAreaView className="flex-1 bg-white" edges={['top', 'left', 'right', 'bottom']}>
      <ScrollView
        className="flex-1"
        contentContainerStyle={{ paddingBottom: 32 }}
        showsVerticalScrollIndicator={false}
      >
        {/* ── Header ── */}
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
                <Text className="text-[15px] font-semibold text-[#2B2233]">Chào Ngọc</Text>
                <Text className="text-[12px] text-[#8E869A]">Khám phá hành trình di sản quanh bạn</Text>
              </View>
            </View>

            <Pressable className="h-12 w-12 items-center justify-center rounded-3xl bg-[#FFF4EF]">
              <SymbolView
                name={{ ios: 'bell', android: 'notifications', web: 'notifications' }}
                size={22}
                tintColor="#EB489B"
              />
            </Pressable>
          </View>

          {/* ── Banner hôm nay ── */}
          <View className="rounded-[28px] bg-[#F7F3EA] p-4">
            <View className="flex-row items-center justify-between">
              <View className="flex-1 pr-3">
                <Text className="text-[12px] font-semibold uppercase tracking-[1px] text-[#8A7D6D]">
                  Nổi bật hôm nay
                </Text>
                <Text className="mt-1 text-[18px] font-bold text-[#2B2233]">
                  Khám phá ẩm thực Sài Gòn
                </Text>
              </View>
              <View className="rounded-full bg-white px-3 py-2">
                <Text className="text-[11px] font-semibold uppercase text-[#B86D2A]">XP +320</Text>
              </View>
            </View>
          </View>

          {/* ── Thanh tìm kiếm ── */}
          <View className="flex-row items-center gap-3">
            <View className="flex-1 flex-row items-center rounded-[26px] bg-[#FAF7FC] px-4 py-4">
              <SymbolView
                name={{ ios: 'magnifyingglass', android: 'search', web: 'search' }}
                size={20}
                tintColor="#AA9FB0"
              />
              <Text className="ml-2 text-[15px] text-[#AA9FB0]">
                Tìm điểm, tuyến, thử thách...
              </Text>
            </View>
            <Pressable className="h-[54px] w-[54px] items-center justify-center rounded-[18px] bg-[#FFF4EF]">
              <SymbolView
                name={{ ios: 'slider.horizontal.3', android: 'tune', web: 'tune' }}
                size={20}
                tintColor="#EB489B"
              />
            </Pressable>
          </View>

          {/* ── Danh mục lọc ── */}
          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            contentContainerStyle={{ paddingVertical: 4 }}
          >
            {categories.map((category) => {
              const selected = category === activeCategory;
              return (
                <Pressable
                  key={category}
                  onPress={() => setActiveCategory(category)}
                  className={`mr-3 rounded-full border px-4 py-2 ${
                    selected ? 'border-[#BB8B4D] bg-[#FBF1E5]' : 'border-[#E5DFD2] bg-white'
                  }`}
                >
                  <Text
                    className={`text-[13px] font-semibold ${
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

        {/* ── Bản đồ ── */}
        <View className="mb-6">
          <View className="mb-3 flex-row items-center justify-between px-5">
            <Text className="text-[22px] font-bold text-[#2B2233]">Bản đồ địa điểm</Text>
            <Pressable className="rounded-full bg-[#FFF4EF] px-3 py-2">
              <Text className="text-[13px] font-semibold text-[#F58752]">Toàn màn hình</Text>
            </Pressable>
          </View>
          <MapPlaceholder />
        </View>

        <View className="gap-6 px-5">
          {/* ── Tuyến nổi bật (carousel) ── */}
          <View className="gap-4">
            <View className="flex-row items-center justify-between">
              <Text className="text-[22px] font-bold text-[#2B2233]">Tuyến gợi ý</Text>
              <Text className="text-[12px] font-semibold text-[#8A7D6D]">
                {featuredRoutes.length} tuyến
              </Text>
            </View>

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
              {featuredRoutes.map((route) => (
                <View
                  key={route.id}
                  className="items-start"
                  style={{ width: snapInterval, paddingLeft: 20 }}
                >
                  <View
                    className="overflow-hidden rounded-[30px] bg-[#2B2233]"
                    style={[heroShadowStyle, { width: routeCardWidth }]}
                  >
                    <Image
                      source={route.imageUri}
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
                          Tuyến di sản
                        </Text>
                        <Text className="text-[28px] font-extrabold leading-[36px] text-white">
                          {route.title}
                        </Text>
                        <Text className="text-[13px] leading-5 text-[#F4E4DA]">
                          {route.subtitle}
                        </Text>
                        <View className="flex-row flex-wrap gap-2 pt-1">
                          {[route.stops, route.distance, route.duration].map((tag) => (
                            <View key={tag} className="rounded-full bg-white/15 px-3 py-1.5">
                              <Text className="text-[12px] font-semibold text-white">{tag}</Text>
                            </View>
                          ))}
                        </View>
                        <View className="flex-row items-center justify-between pt-1">
                          <Pressable
                            onPress={() => router.push(`/route/${route.id}` as Href)}
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

            {/* Dot indicator */}
            <View className="flex-row items-center justify-center gap-2">
              {featuredRoutes.map((_, index) => (
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
          </View>

          {/* ── Địa điểm gần bạn ── */}
          <View className="gap-4">
            <View className="flex-row items-center justify-between">
              <Text className="text-[22px] font-bold text-[#2B2233]">Gần bạn</Text>
              <Pressable className="rounded-full bg-[#FFF4EF] px-3 py-2">
                <Text className="text-[13px] font-semibold text-[#F58752]">Xem bản đồ</Text>
              </Pressable>
            </View>

            {filteredPlaces.length === 0 ? (
              <View className="items-center py-8">
                <Text className="text-[14px] text-[#8E869A]">
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
                        <Text className="text-[17px] font-bold text-[#2B2233]">{place.title}</Text>
                        <View className="rounded-full bg-[#FFF5E8] px-3 py-1.5">
                          <Text className="text-[12px] font-semibold text-[#B86D2A]">
                            {place.reward} XP
                          </Text>
                        </View>
                      </View>
                      <Text className="mt-1 text-[13px] text-[#6E6B62]">
                        {place.category} · {place.badge}
                      </Text>
                      <View className="mt-3 flex-row items-center justify-between">
                        <View className="flex-row items-center gap-2">
                          <SymbolView
                            name={{ ios: 'star.fill', android: 'star', web: 'star' }}
                            size={13}
                            tintColor="#D18C2F"
                          />
                          <Text className="text-[13px] font-semibold text-[#2B2233]">
                            {place.rating}
                          </Text>
                          <Text className="text-[12px] text-[#8A7D6D]">
                            ({place.reviews} đánh giá)
                          </Text>
                        </View>
                        <View className="flex-row items-center gap-1">
                          <SymbolView
                            name={{ ios: 'location.fill', android: 'place', web: 'place' }}
                            size={12}
                            tintColor="#8A7D6D"
                          />
                          <Text className="text-[12px] text-[#8A7D6D]">{place.distance}</Text>
                        </View>
                      </View>
                    </View>
                  </Pressable>
                ))}
              </View>
            )}
          </View>

          {/* ── Nhiệm vụ nổi bật ── */}
          <View
            className="gap-4 rounded-[28px] bg-[#FFF8FC] p-4"
            style={cardShadowStyle}
          >
            <View className="flex-row items-center justify-between">
              <Text className="text-[22px] font-bold text-[#2B2233]">Nhiệm vụ nổi bật</Text>
              <Pressable>
                <Text className="text-[14px] font-bold text-[#F58752]">Xem tất cả</Text>
              </Pressable>
            </View>

            <View className="gap-3">
              {missions.map((item) => (
                <View
                  key={item.label}
                  className="flex-row items-center rounded-[22px] bg-white px-3 py-3.5"
                >
                  <View
                    className="mr-3 h-12 w-12 items-center justify-center rounded-full"
                    style={{ backgroundColor: item.iconBackground }}
                  >
                    <SymbolView name={item.icon} size={22} tintColor="#3D3446" />
                  </View>
                  <View className="flex-1 pr-3">
                    <Text className="text-[15px] font-extrabold text-[#2B2233]">{item.label}</Text>
                    <Text className="mt-0.5 text-[12px] leading-4 text-[#8E869A]">
                      {item.subtitle}
                    </Text>
                  </View>
                  <Text className="text-[16px] font-extrabold text-[#2B2233]">{item.reward}</Text>
                </View>
              ))}
            </View>
          </View>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}