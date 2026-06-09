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
  shadowColor: "rgba(28, 45, 80, 0.18)",
  shadowOpacity: 1,
  shadowRadius: 18,
  shadowOffset: {
    width: 0,
    height: 12,
  },
  elevation: 8,
} as const;

type SymbolName = ComponentProps<typeof SymbolView>["name"];

type NearbyPlaceCard = {
  category: string;
  distance: string;
  imageUri: string;
  rating: string;
  reward: string;
  reviews: string;
  title: string;
};

type MissionCard = {
  icon: SymbolName;
  iconBackground: string;
  label: string;
  reward: string;
  subtitle: string;
};

const nearbyPlaces: NearbyPlaceCard[] = [
  {
    category: "Kiến trúc",
    distance: "320m",
    imageUri:
      "https://i.pinimg.com/736x/f3/0f/e8/f30fe84218790e6ffd25f987d434eb13.jpg",
    rating: "4.7",
    reward: "+120",
    reviews: "284",
    title: "Quy Nhơn",
  },
  {
    category: "Lịch sử",
    distance: "540m",
    imageUri:
      "https://i.pinimg.com/1200x/b3/07/e7/b307e7540a1d2c91f96933794c0b681c.jpg",
    rating: "4.8",
    reward: "+95",
    reviews: "198",
    title: "Hải Phòng",
  },
  {
    category: "Nghệ thuật",
    distance: "850m",
    imageUri:
      "https://i.pinimg.com/1200x/9a/d1/dd/9ad1dd8c33e939d6fa4731f72e6095fa.jpg",
    rating: "4.6",
    reward: "+140",
    reviews: "312",
    title: "Đà Lạt",
  },
];

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
  const routePageWidth = width;
  const routeSnapInterval = routePageWidth;
  const nearbyPlaceCardWidth = Math.min(Math.max(width * 0.4, 160), 184);
  const nearbyPlaceImageHeight = Math.round(nearbyPlaceCardWidth * 0.64);

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
              contentContainerStyle={{ paddingRight: 4 }}
              showsHorizontalScrollIndicator={false}
            >
              {nearbyPlaces.map((place, index) => (
                <View
                  key={place.title}
                  className={index === nearbyPlaces.length - 1 ? "" : "mr-4"}
                  style={{ width: nearbyPlaceCardWidth }}
                >
                  <View
                    className="overflow-hidden rounded-[24px] bg-white"
                    style={nearbyPlaceShadowStyle}
                  >
                    <View>
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

                      <LinearGradient
                        colors={[
                          "rgba(22, 27, 39, 0.42)",
                          "rgba(22, 27, 39, 0)",
                        ]}
                        start={{ x: 0.5, y: 0 }}
                        end={{ x: 0.5, y: 1 }}
                        className="absolute inset-x-0 top-0 h-16"
                      />

                      <View className="absolute inset-x-2.5 top-2.5 flex-row items-center justify-between">
                        <View className="rounded-full bg-[#2E2A37]/92 px-2.5 py-1">
                          <Text className="text-[10px] font-extrabold text-white">
                            {place.distance}
                          </Text>
                        </View>

                        <View className="rounded-full bg-[#FFB400] px-2.5 py-1">
                          <Text className="text-[10px] font-extrabold text-[#2B2233]">
                            {place.reward}
                          </Text>
                        </View>
                      </View>
                    </View>

                    <View className="gap-1.5 px-3.5 pb-3.5 pt-3">
                      <Text
                        className="text-[14px] font-extrabold leading-[18px] text-[#2B2233]"
                        numberOfLines={1}
                      >
                        {place.title}
                      </Text>
                      <Text className="text-[12px] text-[#A39AAB]">
                        {place.category}
                      </Text>

                      <View className="flex-row items-center gap-1">
                        <Text className="text-[11px] text-[#F58752]">★</Text>
                        <Text className="text-[11px] font-bold text-[#F58752]">
                          {place.rating}
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
