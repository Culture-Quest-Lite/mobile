import { Image } from "expo-image";
import { LinearGradient } from "expo-linear-gradient";
import { SymbolView } from "expo-symbols";
import { type ComponentProps, useEffect, useRef, useState } from "react";
import {
  type NativeScrollEvent,
  type NativeSyntheticEvent,
  Pressable,
  ScrollView,
  Text,
  View,
  useWindowDimensions,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

const gradientColors = ["#EB489B", "#F58752", "#FFC93C"] as const;
const avatarImageUri =
  "https://i.pinimg.com/736x/25/c7/c1/25c7c1671263058c274374435c142b4f.jpg";
const featuredRoutes = [
  {
    title: "Vịnh Hạ Long",
    description:
      "Lộ trình ghé Chợ Bến Thành, Bưu điện Thành phố và những góc kể chuyện văn hóa giữa trung tâm.",
    distance: "2.4 km",
    duration: "95 phút",
    stops: "06 điểm dừng",
    summary: "Hành trình đô thị dành cho người mới bắt đầu khám phá trung tâm.",
    imageUri:
      "https://i.pinimg.com/1200x/80/69/f9/8069f9581583a196f9f39bda000b9312.jpg",
  },
  {
    title: "Dấu ấn Mũi né",
    description:
      "Khám phá kiến trúc hội quán, chợ cổ và những lớp ký ức người Hoa giữa lòng thành phố.",
    distance: "3.1 km",
    duration: "110 phút",
    stops: "08 điểm dừng",
    summary:
      "Tuyến route giàu câu chuyện cộng đồng, ẩm thực và tín ngưỡng đô thị.",
    imageUri:
      "https://i.pinimg.com/1200x/6d/cd/14/6dcd140b80b210ac445a0eddfc40784a.jpg",
  },
  {
    title: "Phố cổ về đêm",
    description:
      "Đi qua các sân khấu, phố đi bộ và không gian âm nhạc để cảm nhận nhịp sống buổi tối.",
    distance: "2.8 km",
    duration: "88 phút",
    stops: "05 điểm dừng",
    summary:
      "Phù hợp cho người thích ánh sáng thành phố và trải nghiệm văn hóa đương đại.",
    imageUri:
      "https://i.pinimg.com/736x/00/17/04/001704938bb7cf0b964b07a6b2eeffc4.jpg",
  },
] as const;

const heroShadowStyle = {
  shadowColor: "rgba(235, 72, 155, 0.26)",
  shadowOpacity: 1,
  shadowRadius: 24,
  shadowOffset: {
    width: 0,
    height: 18,
  },
  elevation: 12,
} as const;

const cardShadowStyle = {
  shadowColor: "rgba(245, 135, 82, 0.14)",
  shadowOpacity: 1,
  shadowRadius: 16,
  shadowOffset: {
    width: 0,
    height: 10,
  },
  elevation: 7,
} as const;

const nearbyPlaceShadowStyle = {
  shadowColor: "rgba(15, 23, 42, 0.12)",
  shadowOpacity: 1,
  shadowRadius: 14,
  shadowOffset: {
    width: 0,
    height: 8,
  },
  elevation: 5,
} as const;

type SymbolName = ComponentProps<typeof SymbolView>["name"];

type NearbyPlaceCard = {
  category: string;
  distance: string;
  imageUri: string;
  rating: number;
  reviews: string;
  reward: string;
  title: string;
};

type MissionCard = {
  icon: SymbolName;
  iconBackground: string;
  label: string;
  reward: string;
  subtitle: string;
};

type NearbyCategoryCard = {
  accent: string;
  background: string;
  icon: SymbolName;
  label: string;
};

type RouteDifficulty = "Dễ" | "Trung bình" | "Khó";

type NearbyRouteCard = {
  difficulty: RouteDifficulty;
  distance: string;
  duration: string;
  imageUri: string;
  stops: string;
  subtitle: string;
  title: string;
  xp: string;
};

type ActiveJourneyCard = {
  rewardLabel: string;
  completed: boolean;
  currentCheckpoint: number;
  distanceToNext: string;
  imageUri: string;
  nextStop: string;
  progress: number;
  remainingStopsLabel: string;
  remainingTimeLabel: string;
  subtitle: string;
  totalCheckpoints: number;
  title: string;
};

type VoucherMerchant = {
  background: string;
  label: string;
  logoUri: string;
  logoScale: number;
  ring: string;
};

const nearbyPlaces: NearbyPlaceCard[] = [
  {
    category: "Kiến trúc",
    distance: "320m",
    imageUri:
      "https://i.pinimg.com/736x/f3/0f/e8/f30fe84218790e6ffd25f987d434eb13.jpg",
    rating: 4.8,
    reviews: "284",
    reward: "+120",
    title: "Bưu điện Sài Gòn",
  },
  {
    category: "Lịch sử",
    distance: "540m",
    imageUri:
      "https://i.pinimg.com/1200x/b3/07/e7/b307e7540a1d2c91f96933794c0b681c.jpg",
    rating: 4.9,
    reviews: "198",
    reward: "+95",
    title: "Nhà thờ Đức Bà",
  },
  {
    category: "Nghệ thuật",
    distance: "850m",
    imageUri:
      "https://i.pinimg.com/1200x/9a/d1/dd/9ad1dd8c33e939d6fa4731f72e6095fa.jpg",
    rating: 4.7,
    reviews: "312",
    reward: "+140",
    title: "Bảo tàng Mỹ thuật",
  },
];

const nearbyCategories: NearbyCategoryCard[] = [
  {
    accent: "#B83280",
    background: "#FFD7EA",
    icon: {
      ios: "building.columns",
      android: "account_balance",
      web: "account_balance",
    },
    label: "Kiến trúc",
  },
  {
    accent: "#D95C22",
    background: "#FFE4D3",
    icon: { ios: "clock.arrow.circlepath", android: "history", web: "history" },
    label: "Lịch sử",
  },
  {
    accent: "#0D8C7D",
    background: "#D9F7F1",
    icon: { ios: "paintpalette", android: "palette", web: "palette" },
    label: "Nghệ thuật",
  },
  {
    accent: "#6D28D9",
    background: "#EDE4FF",
    icon: { ios: "fork.knife", android: "restaurant", web: "restaurant" },
    label: "Ẩm thực",
  },
  {
    accent: "#2563EB",
    background: "#DCEBFF",
    icon: { ios: "camera", android: "photo_camera", web: "photo_camera" },
    label: "Check-in",
  },
];

const nearbyRoutes: NearbyRouteCard[] = [
  {
    difficulty: "Dễ",
    distance: "1.2 km",
    duration: "1.5 giờ",
    imageUri:
      "https://i.pinimg.com/1200x/b9/05/dd/b905ddb3d6e87ba4f85692125c1eec2a.jpg",
    stops: "05 điểm",
    subtitle: "Route ngắn cho buổi chiều quanh trung tâm",
    title: "Dấu ấn Sài Gòn cổ",
    xp: "+120 XP",
  },
  {
    difficulty: "Trung bình",
    distance: "2.4 km",
    duration: "2.5 giờ",
    imageUri:
      "https://i.pinimg.com/736x/26/c4/1e/26c41e38a3d34e4c88d8fdf8de32a5d3.jpg",
    stops: "07 điểm",
    subtitle: "Hành trình kết hợp kiến trúc, bảo tàng và phố đi bộ",
    title: "Lộ trình văn hóa quận 1",
    xp: "+180 XP",
  },
  {
    difficulty: "Khó",
    distance: "1.8 km",
    duration: "3 giờ",
    imageUri:
      "https://i.pinimg.com/736x/15/00/10/1500103a9ce1a16aed3cb6b35fe19aa8.jpg",
    stops: "04 điểm",
    subtitle: "Đi bộ nhẹ, nhiều góc check-in gần bạn",
    title: "Tuyến đêm thành phố",
    xp: "+220 XP",
  },
];

const routeDifficultyStyles: Record<
  RouteDifficulty,
  { background: string; color: string }
> = {
  Dễ: {
    background: "#DCFCE7",
    color: "#15803D",
  },
  Khó: {
    background: "#FEE2E2",
    color: "#DC2626",
  },
  "Trung bình": {
    background: "#FEF3C7",
    color: "#B45309",
  },
};

const activeJourney: ActiveJourneyCard | null = {
  completed: false,
  currentCheckpoint: 2,
  distanceToNext: "320m",
  imageUri:
    "https://i.pinimg.com/736x/42/b0/19/42b019d4a97b9f363534a8e2784c3b6a.jpg",
  nextStop: "Chùa Cầu",
  progress: 70,
  remainingStopsLabel: "Còn 2 điểm dừng",
  remainingTimeLabel: "25 phút nữa",
  rewardLabel: "+180 XP",
  subtitle: "Còn 2 điểm để hoàn thành tuyến và nhận thưởng.",
  totalCheckpoints: 5,
  title: "Phố cổ Hội An",
};

const voucherMerchants: VoucherMerchant[] = [
  {
    background: "#FFFFFF",
    label: "Starbucks",
    logoUri:
      "https://i.pinimg.com/1200x/55/4b/62/554b62cd21881bd0143923b21231cd6f.jpg",
    logoScale: 1.16,
    ring: "#E5F7F0",
  },
  {
    background: "#FFFFFF",
    label: "McDonald's",
    logoUri:
      "https://i.pinimg.com/736x/87/69/4b/87694b29884c0d0db10c0f27d2795e9e.jpg",
    logoScale: 0.94,
    ring: "#FFE7E1",
  },
  {
    background: "#FFFFFF",
    label: "Burger King",
    logoUri:
      "https://i.pinimg.com/736x/59/93/c4/5993c45ee0410544471f909835b8516c.jpg",
    logoScale: 0.94,
    ring: "#FFF0E3",
  },
  {
    background: "#FFFFFF",
    label: "KFC",
    logoUri:
      "https://i.pinimg.com/1200x/aa/92/89/aa9289de1ed2865bccd7c7457f246482.jpg",
    logoScale: 0.98,
    ring: "#FCE6EC",
  },
  {
    background: "#FFFFFF",
    label: "Highlands",
    logoUri:
      "https://i.pinimg.com/1200x/9e/d3/65/9ed3653a9eb6cad4d9eef5d1999a1e25.jpg",
    logoScale: 0.98,
    ring: "#F8E5E0",
  },
];

const journeyProgressSegmentCount = 72;
const journeyProgressRingSize = 76;
const journeyProgressRingStrokeWidth = 6;
const journeyProgressSegmentLength = 8;
const journeyProgressSegmentThickness = 6;
const journeyProgressStartAngle = -128;
const activeJourneyAccent = "#EB489B";
const activeJourneyAccentSoft = "#FDE1EC";
const activeJourneyAccentWarm = "#F58752";
const activeJourneyCardBackground = "#FFF8FC";
const journeyProgressSegmentRadius =
  journeyProgressRingSize / 2 - journeyProgressRingStrokeWidth / 2 - 1;

function JourneyProgressRing({ progress }: { progress: number }) {
  const boundedProgress = Math.min(Math.max(progress, 0), 100);
  const activeSegments = Math.round(
    (boundedProgress / 100) * journeyProgressSegmentCount,
  );

  return (
    <View
      className="items-center justify-center"
      style={{
        height: journeyProgressRingSize,
        width: journeyProgressRingSize,
      }}
    >
      <View
        className="absolute rounded-full bg-white"
        style={{
          borderColor: activeJourneyAccentSoft,
          borderWidth: journeyProgressRingStrokeWidth,
          height: journeyProgressRingSize,
          width: journeyProgressRingSize,
        }}
      />

      <View
        pointerEvents="none"
        style={{
          height: journeyProgressRingSize,
          position: "absolute",
          width: journeyProgressRingSize,
        }}
      >
        {Array.from({ length: activeSegments }).map((_, index) => {
          const angle =
            journeyProgressStartAngle +
            (index / journeyProgressSegmentCount) * 360;
          const radians = (angle * Math.PI) / 180;
          const left =
            journeyProgressRingSize / 2 +
            Math.cos(radians) * journeyProgressSegmentRadius -
            journeyProgressSegmentLength / 2;
          const top =
            journeyProgressRingSize / 2 +
            Math.sin(radians) * journeyProgressSegmentRadius -
            journeyProgressSegmentThickness / 2;

          return (
            <View
              key={index}
              className="absolute rounded-full"
              style={{
                backgroundColor: activeJourneyAccent,
                height: journeyProgressSegmentThickness,
                left,
                top,
                transform: [{ rotate: `${angle}deg` }],
                width: journeyProgressSegmentLength,
              }}
            />
          );
        })}
      </View>

      <View className="h-[58px] w-[58px] items-center justify-center rounded-full bg-white">
        <Text className="text-[22px] font-black leading-6 text-[#2B2233]">
          {boundedProgress}%
        </Text>
        <Text className="text-[8px] font-semibold text-[#6F657A]">
          Hoàn thành
        </Text>
      </View>
    </View>
  );
}

const missions: MissionCard[] = [
  {
    icon: {
      ios: "figure.walk",
      android: "directions_walk",
      web: "directions_walk",
    },
    iconBackground: "#FFE9E3",
    label: "Săn dấu ấn Chợ Lớn",
    reward: "+120 XP",
    subtitle: "Còn 2 checkpoint để mở huy hiệu",
  },
  {
    icon: { ios: "paintbrush", android: "brush", web: "brush" },
    iconBackground: "#FDEFD9",
    label: "Bảo tàng Mỹ thuật",
    reward: "+80 XP",
    subtitle: "Hoàn thành trước 18:00 hôm nay",
  },
  {
    icon: { ios: "music.note", android: "music_note", web: "music_note" },
    iconBackground: "#E6F7F4",
    label: "Đêm nhạc dân gian",
    reward: "+160 XP",
    subtitle: "Thưởng thêm khi check-in đúng giờ",
  },
];

export default function HomeScreen() {
  const { width } = useWindowDimensions();
  const routeCarouselRef = useRef<ScrollView>(null);
  const activeRouteIndexRef = useRef(0);
  const [activeRouteIndex, setActiveRouteIndex] = useState(0);
  const routeCardLeftInset = 20;
  const routeCardRightInset = 16;
  const routeCardWidth = Math.max(
    width - routeCardLeftInset - routeCardRightInset,
    264,
  );
  const nearbyRouteCardWidth = Math.min(Math.max(width * 0.64, 220), 252);
  const routePageWidth = width;
  const routeSnapInterval = routePageWidth;
  const nearbyPlaceCardWidth = Math.min(Math.max(width * 0.4, 156), 170);
  const nearbyPlaceImageHeight = Math.round(nearbyPlaceCardWidth * 0.8);
  const voucherMerchantCircleSize = Math.min(Math.max(width * 0.2, 76), 86);
  const voucherMerchantInnerSize = Math.round(voucherMerchantCircleSize * 0.78);
  const voucherMerchantItemWidth = voucherMerchantCircleSize + 14;
  const activeJourneyProgress = activeJourney
    ? Math.min(Math.max(activeJourney.progress, 0), 100)
    : 0;

  const handleRouteSnap = (event: NativeSyntheticEvent<NativeScrollEvent>) => {
    const nextIndex = Math.round(
      event.nativeEvent.contentOffset.x / routeSnapInterval,
    );
    const boundedIndex = Math.min(
      Math.max(nextIndex, 0),
      featuredRoutes.length - 1,
    );

    activeRouteIndexRef.current = boundedIndex;
    setActiveRouteIndex(boundedIndex);
  };

  useEffect(() => {
    const intervalId = setInterval(() => {
      const nextIndex =
        (activeRouteIndexRef.current + 1) % featuredRoutes.length;

      routeCarouselRef.current?.scrollTo({
        x: nextIndex * routeSnapInterval,
        y: 0,
        animated: true,
      });
      activeRouteIndexRef.current = nextIndex;
      setActiveRouteIndex(nextIndex);
    }, 3600);

    return () => {
      clearInterval(intervalId);
    };
  }, [routeSnapInterval]);

  return (
    <SafeAreaView
      className="flex-1 bg-white"
      edges={["top", "left", "right", "bottom"]}
    >
      <ScrollView
        className="flex-1"
        contentContainerStyle={{ paddingBottom: 32 }}
        showsVerticalScrollIndicator={false}
      >
        <View className="gap-6 px-5 pb-8 pt-1">
          <View className="flex-row items-center justify-between">
            <View className="flex-1 flex-row items-center gap-3.5 pr-3">
              <View className="relative">
                <LinearGradient
                  colors={gradientColors}
                  end={{ x: 1, y: 0.9 }}
                  start={{ x: 0, y: 0.1 }}
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

                <View className="absolute -bottom-1 -right-2 rounded-full border-2 border-white bg-[#b1741e] px-2.5 py-1">
                  <Text className="text-[10px] font-extrabold text-white">
                    Lv.12
                  </Text>
                </View>
              </View>

              <View className="flex-1 gap-1">
                <View className="self-start rounded-full bg-[#FFF1F6] px-2.5 py-1">
                  <Text className="text-[10px] font-extrabold uppercase tracking-[0.6px] text-[#EB489B]">
                    Explorer
                  </Text>
                </View>

                <View className="gap-0.5">
                  <Text className="text-[20px] font-extrabold tracking-[-0.3px] text-[#2B2233]">
                    Chào Ngọc
                  </Text>
                  <Text className="text-[13px] leading-5 text-[#8E869A]">
                    Sẵn sàng khám phá hành trình hôm nay
                  </Text>
                </View>
              </View>
            </View>

            <Pressable className="h-12 w-12 items-center justify-center rounded-full bg-[#FFF4EF]">
              <SymbolView
                name={{
                  ios: "bell",
                  android: "notifications",
                  web: "notifications",
                }}
                size={22}
                tintColor="#EB489B"
              />
            </Pressable>
          </View>

          <View className="flex-row items-center gap-3">
            <View className="flex-1 flex-row items-center rounded-[18px] bg-[#FAF7FC] px-4 py-4">
              <SymbolView
                name={{
                  ios: "magnifyingglass",
                  android: "search",
                  web: "search",
                }}
                size={20}
                tintColor="#AA9FB0"
              />
              <Text className="ml-2 text-[15px] text-[#AA9FB0]">
                Tìm địa danh, thử thách...
              </Text>
            </View>

            <Pressable className="h-[54px] w-[54px] items-center justify-center rounded-[18px] bg-[#FAF2FF]">
              <SymbolView
                name={{
                  ios: "slider.horizontal.3",
                  android: "tune",
                  web: "tune",
                }}
                size={20}
                tintColor="#EB489B"
              />
            </Pressable>
          </View>

          <View className="gap-4">
            <Text className="text-[24px] font-extrabold text-[#2B2233]">
              Tuyến nổi bật
            </Text>

            <ScrollView
              ref={routeCarouselRef}
              style={{
                width,
                marginHorizontal: -20,
              }}
              horizontal
              pagingEnabled
              bounces={false}
              decelerationRate="fast"
              disableIntervalMomentum
              snapToAlignment="start"
              snapToInterval={routeSnapInterval}
              showsHorizontalScrollIndicator={false}
              onMomentumScrollEnd={handleRouteSnap}
            >
              {featuredRoutes.map((route) => (
                <View
                  key={route.title}
                  className="items-start"
                  style={{
                    width: routePageWidth,
                    paddingLeft: routeCardLeftInset,
                  }}
                >
                  <View
                    className="overflow-hidden rounded-[30px] bg-[#2B2233]"
                    style={[
                      heroShadowStyle,
                      {
                        width: routeCardWidth,
                      },
                    ]}
                  >
                    <Image
                      source={route.imageUri}
                      contentFit="cover"
                      transition={220}
                      cachePolicy="memory-disk"
                      style={{ height: 210, width: "100%" }}
                    />

                    <LinearGradient
                      colors={[
                        "rgba(36, 28, 44, 0.10)",
                        "rgba(36, 28, 44, 0.38)",
                        "rgba(36, 28, 44, 0.92)",
                      ]}
                      locations={[0, 0.46, 1]}
                      start={{ x: 0.5, y: 0 }}
                      end={{ x: 0.5, y: 1 }}
                      className="absolute inset-0 px-4 py-4"
                    >
                      <View className="flex-1 justify-end gap-3">
                        <View className="flex-row items-start justify-between gap-3">
                          <View className="max-w-[78%] gap-2">
                            <View className="gap-1">
                              <Text className="text-[29px] font-extrabold leading-8 text-white">
                                {route.title}
                              </Text>
                            </View>
                            <View className="gap-3">
                              <View className="flex-row flex-wrap gap-2">
                                <View className="rounded-full bg-white/18 px-3 py-1.5">
                                  <Text className="text-[12px] font-bold text-white">
                                    {route.stops}
                                  </Text>
                                </View>
                                <View className="rounded-full bg-white/18 px-3 py-1.5">
                                  <Text className="text-[12px] font-bold text-white">
                                    {route.distance}
                                  </Text>
                                </View>
                                <View className="rounded-full bg-white/18 px-3 py-1.5">
                                  <Text className="text-[12px] font-bold text-white">
                                    {route.duration}
                                  </Text>
                                </View>
                              </View>

                              <View className="flex-row items-end">
                                <Pressable className="rounded-full bg-white/92 px-4 py-2.5">
                                  <Text className="text-[14px] font-extrabold text-[#D9587F]">
                                    Xem route
                                  </Text>
                                </Pressable>
                              </View>
                            </View>
                          </View>

                          <View className="h-12 w-12 items-center justify-center rounded-2xl bg-white/16">
                            <SymbolView
                              name={{ ios: "map", android: "map", web: "map" }}
                              size={22}
                              tintColor="#FFFFFF"
                            />
                          </View>
                        </View>
                      </View>
                    </LinearGradient>
                  </View>
                </View>
              ))}
            </ScrollView>

            <View className="flex-row items-center justify-center gap-2 px-5">
              {featuredRoutes.map((route, index) => (
                <View
                  key={route.title}
                  className={`rounded-full ${
                    index === activeRouteIndex
                      ? "h-2.5 w-8 bg-[#EB489B]"
                      : "h-2.5 w-2.5 bg-[#F3C9D9]"
                  }`}
                />
              ))}
            </View>
          </View>

          {activeJourney && !activeJourney.completed ? (
            <View className="gap-3">
              <Text className="text-[24px] font-extrabold text-[#2B2233]">
                Tiếp tục hành trình
              </Text>

              <View
                className="overflow-hidden rounded-[28px] border"
                style={[
                  cardShadowStyle,
                  {
                    backgroundColor: activeJourneyCardBackground,
                    borderColor: activeJourneyAccentSoft,
                  },
                ]}
              >
                <View className="relative h-[118px]">
                  <Image
                    source={activeJourney.imageUri}
                    contentFit="cover"
                    transition={220}
                    cachePolicy="memory-disk"
                    style={{ height: "100%", width: "100%" }}
                  />

                  <LinearGradient
                    colors={[
                      "rgba(36, 28, 44, 0.14)",
                      "rgba(255, 255, 255, 0.38)",
                      "rgba(255, 255, 255, 0.98)",
                    ]}
                    locations={[0, 0.56, 1]}
                    start={{ x: 0.5, y: 0 }}
                    end={{ x: 0.5, y: 1 }}
                    className="absolute inset-0"
                  />

                  <View className="absolute inset-x-3 top-3 flex-row items-center justify-between gap-2">
                    <View className="flex-row items-center rounded-full bg-white/96 px-2.5 py-1.5">
                      <View
                        className="mr-1.5 h-2 w-2 rounded-full"
                        style={{ backgroundColor: activeJourneyAccentWarm }}
                      />
                      <Text className="text-[10px] font-extrabold uppercase tracking-[0.5px] text-[#453D4A]">
                        Đang thực hiện
                      </Text>
                    </View>

                    <View className="flex-row items-center rounded-full bg-[#F58752] px-2.5 py-1.5">
                      <SymbolView
                        name={{
                          ios: "sparkles",
                          android: "auto_awesome",
                          web: "auto_awesome",
                        }}
                        size={12}
                        tintColor="#FFFFFF"
                      />
                      <Text className="ml-1 text-[10px] font-extrabold text-white">
                        {activeJourney.rewardLabel}
                      </Text>
                    </View>
                  </View>
                </View>

                <View className="-mt-9 gap-4 px-4 pb-4">
                  <View className="flex-row items-center gap-3">
                    <View className="shrink-0 rounded-full bg-white p-1.5">
                      <JourneyProgressRing progress={activeJourneyProgress} />
                    </View>

                    <View className="flex-1 gap-1.5 pt-4">
                      <Text className="text-[15px] font-extrabold text-[#2B2233]">
                        {activeJourney.title}
                      </Text>

                      <View className="flex-row items-center gap-1">
                        <SymbolView
                          name={{
                            ios: "mappin.and.ellipse",
                            android: "place",
                            web: "place",
                          }}
                          size={13}
                          tintColor="#8E869A"
                        />
                        <Text className="text-[12px] text-[#6F657A]">
                          Tiếp theo: {activeJourney.nextStop} ·{" "}
                          {activeJourney.distanceToNext}
                        </Text>
                      </View>

                      <View className="mt-1 flex-row items-center">
                        {Array.from({
                          length: activeJourney.totalCheckpoints,
                        }).map((_, index) => {
                          const isPast =
                            index < activeJourney.currentCheckpoint;
                          const isCurrent =
                            index === activeJourney.currentCheckpoint;

                          return (
                            <View
                              key={index}
                              className="flex-1 flex-row items-center"
                            >
                              <View
                                className={`h-3.5 w-3.5 rounded-full border-2 ${
                                  isPast
                                    ? "bg-white"
                                    : isCurrent
                                      ? "bg-white"
                                      : "border-[#E5DCE2] bg-white"
                                }`}
                                style={
                                  isPast || isCurrent
                                    ? { borderColor: activeJourneyAccent }
                                    : undefined
                                }
                              />
                              {index < activeJourney.totalCheckpoints - 1 ? (
                                <View
                                  className={`h-[3px] flex-1 rounded-full ${
                                    index < activeJourney.currentCheckpoint
                                      ? ""
                                      : "bg-[#E5DCE2]"
                                  }`}
                                  style={
                                    index < activeJourney.currentCheckpoint
                                      ? { backgroundColor: activeJourneyAccent }
                                      : undefined
                                  }
                                />
                              ) : null}
                            </View>
                          );
                        })}
                      </View>

                      <Text className="text-[11px] font-medium text-[#8E869A]">
                        {activeJourney.remainingStopsLabel} ·{" "}
                        {activeJourney.remainingTimeLabel}
                      </Text>
                    </View>
                  </View>

                  <Pressable className="overflow-hidden rounded-[18px]">
                    <LinearGradient
                      colors={gradientColors}
                      start={{ x: 0, y: 0.5 }}
                      end={{ x: 1, y: 0.5 }}
                      locations={[0, 0.58, 1]}
                      className="flex-row items-center justify-center px-5 py-4"
                    >
                      <SymbolView
                        name={{
                          ios: "play.fill",
                          android: "play_arrow",
                          web: "play_arrow",
                        }}
                        size={14}
                        tintColor="#FFFFFF"
                      />
                      <Text className="ml-2 text-[15px] font-extrabold text-white">
                        Tiếp tục khám phá
                      </Text>
                    </LinearGradient>
                  </Pressable>
                </View>
              </View>
            </View>
          ) : null}

          <View className="gap-4">
            <View className="flex-row items-center justify-between">
              <Text className="text-[24px] font-extrabold text-[#2B2233]">
                Địa điểm gần bạn
              </Text>
              <Pressable className="rounded-full bg-[#FFF4EF] px-3.5 py-2">
                <Text className="text-[13px] font-bold text-[#F58752]">
                  Xem bản đồ
                </Text>
              </Pressable>
            </View>

            <ScrollView
              horizontal
              contentContainerStyle={{ paddingRight: 8 }}
              showsHorizontalScrollIndicator={false}
            >
              {nearbyPlaces.map((place, index) => (
                <View
                  key={place.title}
                  className={index === nearbyPlaces.length - 1 ? "" : "mr-3.5"}
                  style={{ width: nearbyPlaceCardWidth }}
                >
                  <View
                    className="overflow-hidden rounded-[22px] border border-[#EEF1F4] bg-white"
                    style={nearbyPlaceShadowStyle}
                  >
                    <View className="relative">
                      <Image
                        source={place.imageUri}
                        contentFit="cover"
                        transition={220}
                        cachePolicy="memory-disk"
                        style={{
                          height: nearbyPlaceImageHeight,
                          width: "100%",
                        }}
                      />

                      <View className="absolute inset-x-2.5 top-2.5 flex-row items-center justify-between">
                        <View className="rounded-full bg-[#45414D]/92 px-2.5 py-1">
                          <Text className="text-[10px] font-extrabold text-white">
                            {place.distance}
                          </Text>
                        </View>

                        <View className="rounded-full bg-[#f0af16] px-2.5 py-1">
                          <Text className="text-[10px] font-extrabold text-[#2B2233]">
                            {place.reward} XP
                          </Text>
                        </View>
                      </View>
                    </View>

                    <View className="gap-2 px-3.5 pb-3.5 pt-3">
                      <Text
                        className="text-[13px] font-extrabold leading-[18px] text-[#3B4454]"
                        numberOfLines={2}
                      >
                        {place.title}
                      </Text>

                      <Text className="text-[12px] text-[#A39AAB]">
                        {place.category}
                      </Text>

                      <View className="flex-row items-center gap-1">
                        <Text className="text-[11px] text-[#F58752]">★</Text>
                        <Text className="text-[11px] font-bold text-[#F58752]">
                          {place.rating.toFixed(1)}
                        </Text>
                        <Text className="text-[11px] text-[#8E869A]">
                          ({place.reviews})
                        </Text>
                      </View>
                    </View>
                  </View>
                </View>
              ))}
            </ScrollView>

            <Text className="text-[20px] font-extrabold text-[#2B2233]">
              Chủ đề
            </Text>

            <ScrollView
              horizontal
              contentContainerStyle={{ paddingRight: 12 }}
              showsHorizontalScrollIndicator={false}
            >
              {nearbyCategories.map((item, index) => (
                <Pressable
                  key={item.label}
                  className={
                    index === nearbyCategories.length - 1 ? "" : "mr-3.5"
                  }
                >
                  <View
                    className="h-[112px] w-[112px] items-center justify-center rounded-[24px] p-4"
                    style={{ backgroundColor: item.background }}
                  >
                    <View className="items-center justify-center">
                      <SymbolView
                        name={item.icon}
                        size={28}
                        tintColor={item.accent}
                      />
                    </View>

                    <Text
                      className="mt-3 text-center text-[14px] font-extrabold leading-[18px] text-[#2F2A35]"
                      numberOfLines={2}
                    >
                      {item.label}
                    </Text>
                  </View>
                </Pressable>
              ))}
            </ScrollView>

            <Text className="text-[20px] font-extrabold text-[#2B2233]">
              Đề xuất tuyến đường
            </Text>

            <ScrollView
              horizontal
              contentContainerStyle={{ paddingRight: 8 }}
              showsHorizontalScrollIndicator={false}
            >
              {nearbyRoutes.map((route, index) => (
                <Pressable
                  key={route.title}
                  className={index === nearbyRoutes.length - 1 ? "" : "mr-4"}
                  style={{ width: nearbyRouteCardWidth }}
                >
                  <View
                    className="overflow-hidden rounded-[24px] border border-[#EEF1F4] bg-white"
                    style={cardShadowStyle}
                  >
                    <View className="relative">
                      <Image
                        source={route.imageUri}
                        contentFit="cover"
                        transition={220}
                        cachePolicy="memory-disk"
                        style={{ height: 128, width: "100%" }}
                      />

                      <View className="absolute right-3 top-3 rounded-full bg-[#FFF1F6] px-2.5 py-1">
                        <Text className="text-[10px] font-extrabold text-[#EB489B]">
                          {route.xp}
                        </Text>
                      </View>
                    </View>

                    <View className="gap-2.5 px-4 pb-4 pt-3.5">
                      <View className="flex-row flex-wrap items-center gap-2">
                        <View className="rounded-full bg-[#FFF1F6] px-2.5 py-1">
                          <Text className="text-[10px] font-extrabold text-[#EB489B]">
                            {route.distance}
                          </Text>
                        </View>
                        <View className="rounded-full bg-[#FFF4EF] px-2.5 py-1">
                          <Text className="text-[10px] font-extrabold text-[#F58752]">
                            {route.duration}
                          </Text>
                        </View>

                        <View
                          className="rounded-full px-2.5 py-1"
                          style={{
                            backgroundColor:
                              routeDifficultyStyles[route.difficulty]
                                .background,
                          }}
                        >
                          <Text
                            className="text-[10px] font-extrabold"
                            style={{
                              color:
                                routeDifficultyStyles[route.difficulty].color,
                            }}
                          >
                            {route.difficulty}
                          </Text>
                        </View>
                      </View>

                      <Text
                        className="text-[16px] font-extrabold leading-5 text-[#2B2233]"
                        numberOfLines={1}
                      >
                        {route.title}
                      </Text>

                      <Text
                        className="text-[12px] leading-[18px] text-[#8E869A]"
                        numberOfLines={2}
                      >
                        {route.subtitle}
                      </Text>
                    </View>
                  </View>
                </Pressable>
              ))}
            </ScrollView>

            <View className="gap-4">
              <View className="flex-row items-start justify-between gap-3">
                <View className="flex-1">
                  <Text className="text-[24px] font-extrabold text-[#2B2233]">
                    Voucher ưu đãi
                  </Text>
                </View>

                <Pressable className="rounded-full bg-[#FFF4EF] px-3.5 py-2">
                  <Text className="text-[13px] font-bold text-[#F58752]">
                    Xem tất cả
                  </Text>
                </Pressable>
              </View>

              <View
                className="gap-5 rounded-[28px]  bg-white p-4"
                style={cardShadowStyle}
              >
                <View className="gap-3">
                  <ScrollView
                    horizontal
                    contentContainerStyle={{ paddingRight: 10 }}
                    showsHorizontalScrollIndicator={false}
                  >
                    {voucherMerchants.map((merchant, index) => (
                      <Pressable
                        key={merchant.label}
                        className={
                          index === voucherMerchants.length - 1 ? "" : "mr-3.5"
                        }
                        style={{ width: voucherMerchantItemWidth }}
                      >
                        <View className="items-center">
                          <View
                            className="items-center justify-center rounded-full"
                            style={{
                              backgroundColor: merchant.ring,
                              height: voucherMerchantCircleSize,
                              width: voucherMerchantCircleSize,
                            }}
                          >
                            <View
                              className="items-center justify-center overflow-hidden rounded-full"
                              style={{
                                backgroundColor: merchant.background,
                                height: voucherMerchantInnerSize,
                                width: voucherMerchantInnerSize,
                              }}
                            >
                              <Image
                                source={merchant.logoUri}
                                contentFit="cover"
                                transition={180}
                                cachePolicy="memory-disk"
                                style={{
                                  borderRadius: 999,
                                  height:
                                    voucherMerchantInnerSize *
                                    merchant.logoScale,
                                  width:
                                    voucherMerchantInnerSize *
                                    merchant.logoScale,
                                }}
                              />
                            </View>
                          </View>

                          <Text
                            className="mt-2 text-center text-[12px] font-extrabold leading-4 text-[#2B2233]"
                            numberOfLines={2}
                          >
                            {merchant.label}
                          </Text>
                        </View>
                      </Pressable>
                    ))}
                  </ScrollView>
                </View>
              </View>
            </View>
          </View>

          <View
            className="gap-4 rounded-[28px] bg-[#FFF8FC] p-4"
            style={cardShadowStyle}
          >
            <View className="flex-row items-center justify-between">
              <Text className="text-[24px] font-extrabold text-[#2B2233]">
                Nhiệm vụ nổi bật
              </Text>
              <Pressable>
                <Text className="text-[14px] font-bold text-[#F58752]">
                  Xem tất cả
                </Text>
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
                    <SymbolView
                      name={item.icon}
                      size={22}
                      tintColor="#3D3446"
                    />
                  </View>

                  <View className="flex-1 pr-3">
                    <Text className="text-[16px] font-extrabold text-[#2B2233]">
                      {item.label}
                    </Text>
                    <Text className="mt-1 text-[12px] leading-4 text-[#8E869A]">
                      {item.subtitle}
                    </Text>
                  </View>

                  <Text className="text-[17px] font-extrabold text-[#2B2233]">
                    {item.reward}
                  </Text>
                </View>
              ))}
            </View>
          </View>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}
