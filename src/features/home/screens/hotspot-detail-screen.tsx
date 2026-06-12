import { Image } from "expo-image";
import { LinearGradient } from "expo-linear-gradient";
import { useLocalSearchParams, useRouter } from "expo-router";
import { StatusBar } from "expo-status-bar";
import { SymbolView } from "expo-symbols";
import { useState, type ComponentProps } from "react";
import {
  Pressable,
  ScrollView,
  Text,
  View,
  useWindowDimensions,
} from "react-native";
import Animated, {
  Extrapolation,
  interpolate,
  useAnimatedScrollHandler,
  useAnimatedStyle,
  useSharedValue,
} from "react-native-reanimated";
import {
  SafeAreaView,
  useSafeAreaInsets,
} from "react-native-safe-area-context";

import {
  getHotspotBySlug,
  getHotspotFactItems,
  type HotspotDetail,
} from "../data/hotspots";

type SymbolName = ComponentProps<typeof SymbolView>["name"];

const loginGradientColors = ["#EB489B", "#F58752", "#FFC93C"] as const;
const screenBackground = "#FFFFFF";
const panelBackground = "#FFFFFF";
const highlightAccentColors = ["#EB489B", "#F58752", "#FFC93C"] as const;

const heroShadowStyle = {
  shadowColor: "rgba(15, 23, 42, 0.20)",
  shadowOpacity: 1,
  shadowRadius: 22,
  shadowOffset: {
    width: 0,
    height: 14,
  },
  elevation: 8,
} as const;

const sheetShadowStyle = {
  shadowColor: "rgba(235, 72, 155, 0.10)",
  shadowOpacity: 1,
  shadowRadius: 18,
  shadowOffset: {
    width: 0,
    height: -6,
  },
  elevation: 6,
} as const;

const cardShadowStyle = {
  shadowColor: "rgba(235, 72, 155, 0.08)",
  shadowOpacity: 1,
  shadowRadius: 14,
  shadowOffset: {
    width: 0,
    height: 10,
  },
  elevation: 4,
} as const;

const buttonShadowStyle = {
  shadowColor: "rgba(235, 72, 155, 0.22)",
  shadowOpacity: 1,
  shadowRadius: 18,
  shadowOffset: {
    width: 0,
    height: 10,
  },
  elevation: 6,
} as const;

function clampNumber(value: number, minimum: number, maximum: number) {
  return Math.min(Math.max(value, minimum), maximum);
}

function formatCompactCount(value: number | string) {
  const resolvedValue =
    typeof value === "number" ? value : Number(value.replace(/\D/g, ""));

  if (!Number.isFinite(resolvedValue) || resolvedValue <= 0) {
    return `${value}`;
  }

  if (resolvedValue >= 1000) {
    return `${(resolvedValue / 1000).toFixed(1)}K`;
  }

  return `${resolvedValue}`;
}

function getRewardValue(reward: string) {
  const resolvedValue = Number(reward.replace(/\D/g, ""));

  if (!Number.isFinite(resolvedValue) || resolvedValue <= 0) {
    return reward;
  }

  return `${resolvedValue}`;
}

function getBestTimeWindow(bestTimeLabel: string) {
  const [timeRange] = bestTimeLabel.split(" de ");

  return timeRange?.trim() || bestTimeLabel;
}

function getTicketSummary(ticketLabel: string) {
  if (/mien phi/i.test(ticketLabel)) {
    return "Free access";
  }

  const matchedValue = ticketLabel.match(/(\d[\d.]*)\s*d/i);

  if (matchedValue) {
    return `${matchedValue[1]}d`;
  }

  return ticketLabel;
}

function getGalleryPreviewImages(hotspot: HotspotDetail) {
  return [hotspot.imageUri, ...hotspot.gallery].slice(0, 4);
}

function SectionHeader({
  eyebrow,
  title,
  description,
}: {
  description?: string;
  eyebrow: string;
  title: string;
}) {
  return (
    <View>
      <Text className="text-[11px] font-extrabold uppercase tracking-[1.2px] text-[#EB489B]">
        {eyebrow}
      </Text>
      <Text className="mt-2 text-[24px] font-black leading-[28px] text-[#1A2C3D]">
        {title}
      </Text>
      {description ? (
        <Text className="mt-2 text-[14px] leading-6 text-[#667B8E]">
          {description}
        </Text>
      ) : null}
    </View>
  );
}

function HeroChip({ icon, label }: { icon: SymbolName; label: string }) {
  return (
    <View className="flex-row items-center rounded-full bg-black/24 px-3 py-2">
      <SymbolView name={icon} size={13} tintColor="#FFFFFF" />
      <Text className="ml-1.5 text-[12px] font-semibold text-white">
        {label}
      </Text>
    </View>
  );
}

function HeroGalleryThumb({
  imageUri,
  isActive = false,
  onPress,
}: {
  imageUri: string;
  isActive?: boolean;
  onPress: () => void;
}) {
  return (
    <Pressable onPress={onPress}>
      <View
        className="overflow-hidden rounded-[24px]"
        style={{
          backgroundColor: "rgba(255,255,255,0.12)",
          height: isActive ? 132 : 118,
          width: isActive ? 104 : 92,
        }}
      >
        <Image
          source={imageUri}
          contentFit="cover"
          transition={160}
          cachePolicy="memory-disk"
          style={{ height: "100%", width: "100%" }}
        />
        {!isActive ? (
          <View
            pointerEvents="none"
            style={{
              backgroundColor: "rgba(3, 18, 28, 0.26)",
              bottom: 0,
              left: 0,
              position: "absolute",
              right: 0,
              top: 0,
            }}
          />
        ) : null}
      </View>
    </Pressable>
  );
}

function SummaryStat({
  icon,
  label,
  value,
}: {
  icon: SymbolName;
  label: string;
  value: string;
}) {
  return (
    <View className="min-w-[62px] flex-row items-center">
      <View className="h-7 w-7 items-center justify-center rounded-full bg-[#FFF0F6]">
        <SymbolView name={icon} size={13} tintColor="#EB489B" />
      </View>
      <View className="ml-2">
        <Text className="text-[13px] font-black text-[#1E3142]">{value}</Text>
        <Text className="text-[10px] font-semibold uppercase tracking-[0.8px] text-[#9B91A0]">
          {label}
        </Text>
      </View>
    </View>
  );
}

function FactRow({
  icon,
  label,
  value,
}: {
  icon: SymbolName;
  label: string;
  value: string;
}) {
  return (
    <View
      className="flex-row items-start rounded-[24px] bg-white px-4 py-4"
      style={cardShadowStyle}
    >
      <View className="mt-0.5 h-10 w-10 items-center justify-center rounded-full bg-[#FFF0F6]">
        <SymbolView name={icon} size={16} tintColor="#EB489B" />
      </View>
      <View className="ml-3 flex-1">
        <Text className="text-[11px] font-bold uppercase tracking-[1px] text-[#86A0B5]">
          {label}
        </Text>
        <Text className="mt-1 text-[15px] font-semibold leading-6 text-[#1F3245]">
          {value}
        </Text>
      </View>
    </View>
  );
}

function HighlightCard({ index, text }: { index: number; text: string }) {
  const accentColor =
    highlightAccentColors[index % highlightAccentColors.length];

  return (
    <View
      className="rounded-[24px] bg-white px-4 py-4"
      style={[
        cardShadowStyle,
        { borderLeftColor: accentColor, borderLeftWidth: 4 },
      ]}
    >
      <Text
        className="text-[12px] font-black uppercase tracking-[1px]"
        style={{ color: accentColor }}
      >
        Stop {index + 1}
      </Text>
      <Text className="mt-2 text-[14px] leading-6 text-[#31495C]">{text}</Text>
    </View>
  );
}

function GalleryCard({
  imageUri,
  isPrimary = false,
  label,
}: {
  imageUri: string;
  isPrimary?: boolean;
  label: string;
}) {
  return (
    <View
      className="overflow-hidden rounded-[28px] bg-[#0F2433]"
      style={[
        cardShadowStyle,
        {
          height: 178,
          width: isPrimary ? 220 : 148,
        },
      ]}
    >
      <Image
        source={imageUri}
        contentFit="cover"
        transition={180}
        cachePolicy="memory-disk"
        style={{ height: "100%", width: "100%" }}
      />
      <LinearGradient
        colors={["rgba(0,0,0,0.02)", "rgba(0,0,0,0.62)"]}
        locations={[0.18, 1]}
        start={{ x: 0.5, y: 0 }}
        end={{ x: 0.5, y: 1 }}
        style={{ bottom: 0, left: 0, position: "absolute", right: 0, top: 0 }}
      />
      <View className="absolute inset-x-4 bottom-4">
        <Text className="text-[11px] font-bold uppercase tracking-[1px] text-[#C8EDF6]">
          {label}
        </Text>
      </View>
    </View>
  );
}

function RoutePairingCard({ text }: { text: string }) {
  return (
    <LinearGradient
      colors={["#FFF0F6", "#FFF7ED"]}
      start={{ x: 0, y: 0 }}
      end={{ x: 1, y: 1 }}
      className="rounded-[28px] px-5 py-5"
      style={cardShadowStyle}
    >
      <Text className="text-[11px] font-extrabold uppercase tracking-[1.2px] text-[#EB489B]">
        Route pairing
      </Text>
      <Text className="mt-3 text-[16px] font-black leading-6 text-[#1E3142]">
        {text}
      </Text>
    </LinearGradient>
  );
}

function TipRow({ text }: { text: string }) {
  return (
    <View
      className="flex-row items-start rounded-[22px] bg-white px-4 py-4"
      style={cardShadowStyle}
    >
      <View className="mt-0.5 h-8 w-8 items-center justify-center rounded-full bg-[#FFF0F6]">
        <SymbolView
          name={{
            ios: "sparkles",
            android: "auto_awesome",
            web: "auto_awesome",
          }}
          size={14}
          tintColor="#EB489B"
        />
      </View>
      <Text className="ml-3 flex-1 text-[14px] leading-6 text-[#385062]">
        {text}
      </Text>
    </View>
  );
}

function AvatarPreview({
  imageUri,
  index,
}: {
  imageUri: string;
  index: number;
}) {
  return (
    <View
      className="overflow-hidden rounded-full border-2 border-white"
      style={{ height: 34, marginLeft: index === 0 ? 0 : -8, width: 34 }}
    >
      <Image
        source={imageUri}
        contentFit="cover"
        transition={140}
        cachePolicy="memory-disk"
        style={{ height: "100%", width: "100%" }}
      />
    </View>
  );
}

function NotFoundState() {
  const router = useRouter();

  return (
    <View className="flex-1" style={{ backgroundColor: screenBackground }}>
      <SafeAreaView
        className="flex-1"
        edges={["top", "left", "right", "bottom"]}
      >
        <View className="flex-1 items-center justify-center px-6">
          <View
            className="w-full rounded-[32px] bg-[#F4F7FB] px-6 py-8"
            style={[cardShadowStyle, { maxWidth: 360 }]}
          >
            <Text className="text-center text-[24px] font-black text-[#1E3245]">
              Hotspot khong ton tai
            </Text>
            <Text className="mt-3 text-center text-[14px] leading-6 text-[#5E7486]">
              Dia diem nay khong con trong danh sach hien tai. Ban co the quay
              lai hoac mo danh sach hotspot de chon diem khac.
            </Text>
            <View className="mt-6 flex-row gap-3">
              <Pressable
                className="flex-1 items-center rounded-full bg-[#E7EFF5] px-4 py-3.5"
                onPress={() => router.back()}
              >
                <Text className="text-[13px] font-bold text-[#28475D]">
                  Quay lai
                </Text>
              </Pressable>
              <Pressable
                className="flex-1 items-center rounded-full bg-[#13384D] px-4 py-3.5"
                onPress={() => router.replace("/hotspots")}
              >
                <Text className="text-[13px] font-bold text-white">
                  Xem danh sach
                </Text>
              </Pressable>
            </View>
          </View>
        </View>
      </SafeAreaView>
    </View>
  );
}

export default function HotspotDetailScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { height: screenHeight } = useWindowDimensions();
  const { slug } = useLocalSearchParams<{ slug: string }>();
  const scrollY = useSharedValue(0);
  const resolvedSlug = Array.isArray(slug) ? (slug[0] ?? "") : (slug ?? "");
  const [gallerySelection, setGallerySelection] = useState(() => ({
    index: 0,
    slugKey: resolvedSlug,
  }));
  const heroHeightExpanded = clampNumber(
    screenHeight + insets.bottom + 12,
    640,
    960,
  );
  const heroHeightCollapsed = clampNumber(screenHeight * 0.42, 290, 360);
  const collapseDistance = Math.max(
    heroHeightExpanded - heroHeightCollapsed,
    1,
  );
  const contentOverlap = 28;

  const heroContainerStyle = useAnimatedStyle(() => ({
    height: interpolate(
      scrollY.value,
      [0, collapseDistance],
      [heroHeightExpanded, heroHeightCollapsed],
      Extrapolation.CLAMP,
    ),
  }));

  const heroMediaStyle = useAnimatedStyle(() => ({
    transform: [
      {
        translateY: interpolate(
          scrollY.value,
          [-heroHeightExpanded, 0, collapseDistance],
          [heroHeightExpanded * 0.08, 0, -24],
          Extrapolation.CLAMP,
        ),
      },
    ],
  }));

  const heroContentStyle = useAnimatedStyle(() => ({
    opacity: interpolate(
      scrollY.value,
      [0, collapseDistance * 0.48, collapseDistance],
      [1, 0.58, 0],
      Extrapolation.CLAMP,
    ),
    transform: [
      {
        translateY: interpolate(
          scrollY.value,
          [0, collapseDistance],
          [0, -28],
          Extrapolation.CLAMP,
        ),
      },
    ],
  }));

  const compactHeaderStyle = useAnimatedStyle(() => ({
    opacity: interpolate(
      scrollY.value,
      [collapseDistance * 0.58, collapseDistance],
      [0, 1],
      Extrapolation.CLAMP,
    ),
    transform: [
      {
        translateY: interpolate(
          scrollY.value,
          [collapseDistance * 0.58, collapseDistance],
          [10, 0],
          Extrapolation.CLAMP,
        ),
      },
    ],
  }));

  const sheetLiftStyle = useAnimatedStyle(() => ({
    transform: [
      {
        translateY: interpolate(
          scrollY.value,
          [0, collapseDistance],
          [0, -52],
          Extrapolation.CLAMP,
        ),
      },
    ],
  }));

  const handleScroll = useAnimatedScrollHandler({
    onScroll: (event) => {
      // eslint-disable-next-line react-hooks/immutability
      scrollY.value = event.contentOffset.y;
    },
  });

  const hotspot = getHotspotBySlug(slug);

  if (!hotspot) {
    return <NotFoundState />;
  }

  const galleryPreviewImages = getGalleryPreviewImages(hotspot);
  const activeGalleryIndex =
    gallerySelection.slugKey === resolvedSlug ? gallerySelection.index : 0;
  const activeHeroImageUri =
    galleryPreviewImages[activeGalleryIndex] ?? hotspot.imageUri;
  const factItems = [
    ...getHotspotFactItems(hotspot),
    {
      icon: {
        ios: "map.fill",
        android: "map",
        web: "map",
      } as SymbolName,
      label: "Lich trinh goi y",
      value: hotspot.scheduleLabel,
    },
    {
      icon: {
        ios: "location.fill",
        android: "place",
        web: "place",
      } as SymbolName,
      label: "Dia chi",
      value: hotspot.address,
    },
  ];

  const summaryStats = [
    {
      icon: {
        ios: "star.fill",
        android: "star",
        web: "star",
      } as SymbolName,
      label: "Rating",
      value: hotspot.rating.toFixed(1),
    },
    {
      icon: {
        ios: "heart.fill",
        android: "favorite",
        web: "favorite",
      } as SymbolName,
      label: "Reviews",
      value: formatCompactCount(hotspot.reviews),
    },
    {
      icon: {
        ios: "photo.on.rectangle",
        android: "photo_library",
        web: "photo_library",
      } as SymbolName,
      label: "Gallery",
      value: `${galleryPreviewImages.length}`,
    },
    {
      icon: {
        ios: "sparkles",
        android: "auto_awesome",
        web: "auto_awesome",
      } as SymbolName,
      label: "Reward",
      value: `${getRewardValue(hotspot.reward)} XP`,
    },
  ];

  return (
    <View className="flex-1" style={{ backgroundColor: screenBackground }}>
      <StatusBar style="light" />

      <Animated.View
        pointerEvents="none"
        style={[
          heroShadowStyle,
          heroContainerStyle,
          {
            borderBottomLeftRadius: 36,
            borderBottomRightRadius: 36,
            left: 0,
            overflow: "hidden",
            position: "absolute",
            right: 0,
            top: 0,
            zIndex: 0,
          },
        ]}
      >
        <Animated.View
          style={[
            heroMediaStyle,
            {
              bottom: 0,
              left: 0,
              position: "absolute",
              right: 0,
              top: 0,
            },
          ]}
        >
          <Image
            source={activeHeroImageUri}
            contentFit="cover"
            transition={220}
            cachePolicy="memory-disk"
            style={{ height: "100%", width: "100%" }}
          />
        </Animated.View>

        <LinearGradient
          colors={[
            "rgba(0, 0, 0, 0.06)",
            "rgba(0, 0, 0, 0.16)",
            "rgba(5, 16, 28, 0.72)",
          ]}
          locations={[0, 0.45, 1]}
          start={{ x: 0.5, y: 0 }}
          end={{ x: 0.5, y: 1 }}
          style={{ bottom: 0, left: 0, position: "absolute", right: 0, top: 0 }}
        />
      </Animated.View>

      <View
        style={{
          left: 0,
          position: "absolute",
          right: 0,
          top: 0,
          zIndex: 3,
        }}
      >
        <View className="px-4" style={{ paddingTop: insets.top + 8 }}>
          <View style={{ alignSelf: "center", maxWidth: 520, width: "100%" }}>
            <View className="flex-row items-center justify-between">
              <Pressable
                className="h-[52px] w-[52px] items-center justify-center rounded-full bg-black/22"
                hitSlop={8}
                onPress={() => router.back()}
              >
                <SymbolView
                  name={{
                    ios: "chevron.left",
                    android: "arrow_back",
                    web: "arrow_back",
                  }}
                  size={20}
                  tintColor="#FFFFFF"
                />
              </Pressable>

              <Animated.View
                pointerEvents="none"
                style={[compactHeaderStyle, { flex: 1, marginHorizontal: 18 }]}
              >
                <Text
                  className="text-center text-[16px] font-black text-white"
                  numberOfLines={1}
                >
                  {hotspot.title}
                </Text>
                <Text className="mt-0.5 text-center text-[11px] font-semibold uppercase tracking-[1px] text-[#C3EAF5]">
                  {hotspot.category}
                </Text>
              </Animated.View>

              <Pressable
                className="h-[52px] w-[52px] items-center justify-center rounded-full bg-black/22"
                hitSlop={8}
                onPress={() => router.replace("/hotspots")}
              >
                <SymbolView
                  name={{
                    ios: "list.bullet",
                    android: "view_list",
                    web: "view_list",
                  }}
                  size={20}
                  tintColor="#FFFFFF"
                />
              </Pressable>
            </View>
          </View>
        </View>
      </View>

      <SafeAreaView className="flex-1" edges={["left", "right", "bottom"]}>
        <Animated.ScrollView
          style={{ flex: 1 }}
          contentContainerStyle={{
            paddingBottom: Math.max(insets.bottom + 40, 56),
            paddingTop: heroHeightExpanded - contentOverlap,
          }}
          onScroll={handleScroll}
          scrollEventThrottle={16}
          showsVerticalScrollIndicator={false}
        >
          <Animated.View
            pointerEvents="box-none"
            style={[
              heroContentStyle,
              {
                left: 0,
                position: "absolute",
                right: 0,
                top: 0,
              },
            ]}
          >
            <View
              className="px-5"
              style={{
                justifyContent: "center",
                minHeight: heroHeightExpanded,
                paddingBottom: Math.max(insets.bottom + 126, 144),
                paddingTop: insets.top + 84,
                width: "100%",
              }}
            >
              <View style={{ maxWidth: 340 }}>
                <View className="flex-row flex-wrap gap-2">
                  <HeroChip
                    icon={{
                      ios: "clock.fill",
                      android: "schedule",
                      web: "schedule",
                    }}
                    label={getBestTimeWindow(hotspot.bestTimeLabel)}
                  />
                  <HeroChip
                    icon={{
                      ios: "location.fill",
                      android: "place",
                      web: "place",
                    }}
                    label={`${hotspot.distance} • ${hotspot.district}`}
                  />
                </View>

                <Text className="mt-4 text-[34px] font-black leading-[38px] text-white">
                  {hotspot.title}
                </Text>

                <Text
                  className="mt-3 text-[14px] leading-6 text-[#D3EEF6]"
                  numberOfLines={4}
                >
                  {hotspot.story}
                </Text>
              </View>
            </View>

            <View
              className="absolute inset-x-0"
              style={{
                bottom: Math.max(contentOverlap + insets.bottom + 12, 42),
              }}
            >
              <ScrollView
                horizontal
                nestedScrollEnabled
                contentContainerStyle={{ paddingLeft: 20, paddingRight: 30 }}
                showsHorizontalScrollIndicator={false}
              >
                {galleryPreviewImages.map((imageUri, index) => (
                  <View
                    key={`${hotspot.slug}-hero-gallery-${index}`}
                    className={
                      index === galleryPreviewImages.length - 1 ? "" : "mr-3"
                    }
                  >
                    <HeroGalleryThumb
                      imageUri={imageUri}
                      isActive={index === activeGalleryIndex}
                      onPress={() =>
                        setGallerySelection({
                          index,
                          slugKey: resolvedSlug,
                        })
                      }
                    />
                  </View>
                ))}
              </ScrollView>
            </View>
          </Animated.View>

          <Animated.View
            className="rounded-t-[34px] rounded-b-[34px] px-5 pb-6 pt-4"
            style={[
              sheetShadowStyle,
              sheetLiftStyle,
              {
                backgroundColor: panelBackground,
                minHeight: screenHeight,
              },
            ]}
          >
            <Pressable
              className="absolute right-5 z-10 h-12 w-12 items-center justify-center rounded-full"
              onPress={() => router.replace("/hotspots")}
              style={[buttonShadowStyle, { top: -22 }]}
            >
              <LinearGradient
                colors={loginGradientColors}
                end={{ x: 1, y: 0.5 }}
                locations={[0, 0.58, 1]}
                start={{ x: 0, y: 0.5 }}
                className="h-12 w-12 items-center justify-center rounded-full"
              >
                <SymbolView
                  name={{
                    ios: "paperplane.fill",
                    android: "near_me",
                    web: "near_me",
                  }}
                  size={17}
                  tintColor="#FFFFFF"
                />
              </LinearGradient>
            </Pressable>

            <View className="mt-5">
              <View className="flex-row items-center justify-between gap-3">
                <View className="flex-1">
                  <Text className="text-[11px] font-extrabold uppercase tracking-[1.2px] text-[#EB489B]">
                    Hotspot detail
                  </Text>
                  <Text className="mt-2 text-[30px] font-black leading-[34px] text-[#1E3142]">
                    {hotspot.title}
                  </Text>
                </View>
                <View className="rounded-full bg-[#FFF0F6] px-3 py-2">
                  <Text className="text-[12px] font-semibold uppercase tracking-[0.8px] text-[#EB489B]">
                    {hotspot.category}
                  </Text>
                </View>
              </View>

              <Text className="mt-4 text-[14px] leading-6 text-[#677C8E]">
                {hotspot.overview}
              </Text>

              <View className="mt-5 flex-row flex-wrap items-center justify-between gap-y-3">
                {summaryStats.map((item, index) => (
                  <SummaryStat
                    key={`${hotspot.slug}-summary-${index}`}
                    icon={item.icon}
                    label={item.label}
                    value={item.value}
                  />
                ))}
              </View>

              <View className="mt-5 flex-row items-center justify-between">
                <View className="flex-row items-center">
                  {galleryPreviewImages.slice(0, 3).map((imageUri, index) => (
                    <AvatarPreview
                      key={`${hotspot.slug}-avatar-${index}`}
                      imageUri={imageUri}
                      index={index}
                    />
                  ))}
                </View>

                <View className="h-10 w-10 items-center justify-center rounded-full bg-[#F7EFF6]">
                  <SymbolView
                    name={{
                      ios: "ellipsis",
                      android: "more_horiz",
                      web: "more_horiz",
                    }}
                    size={18}
                    tintColor="#7E6F82"
                  />
                </View>
              </View>

              <View className="mt-5 rounded-[24px] bg-[#FAF7FC] px-4 py-4">
                <View className="flex-row items-center justify-between gap-4">
                  <View className="flex-1">
                    <Text className="text-[11px] font-semibold uppercase tracking-[1px] text-[#B1A2B9]">
                      From
                    </Text>
                    <Text className="mt-1 text-[17px] font-black text-[#2A3142]">
                      {hotspot.district}
                    </Text>
                  </View>

                  <View className="h-px flex-1 bg-[#E6DDEA]" />

                  <View className="flex-1 items-end">
                    <Text className="text-[11px] font-semibold uppercase tracking-[1px] text-[#B1A2B9]">
                      To
                    </Text>
                    <Text
                      className="mt-1 text-right text-[17px] font-black text-[#2A3142]"
                      numberOfLines={1}
                    >
                      {hotspot.title}
                    </Text>
                  </View>
                </View>
              </View>
            </View>

            <View className="mt-7 gap-6">
              <SectionHeader
                eyebrow="Quick facts"
                title="Thong tin can biet truoc khi den"
                description="Noi dung hotspot duoc day len tu mot white sheet, trong khi hero image chi bi crop lai theo scroll thay vi bi scale nho."
              />

              <View className="gap-3">
                {factItems.map((item, index) => (
                  <FactRow
                    key={`${hotspot.slug}-fact-${index}`}
                    icon={item.icon}
                    label={item.label}
                    value={item.value}
                  />
                ))}
              </View>
            </View>

            <View className="mt-8 gap-5">
              <SectionHeader
                eyebrow="Highlights"
                title="Diem nhan cua stop nay"
                description="Ba ly do chinh de hotspot nay xung dang la mot diem dung trong route."
              />

              <View className="gap-3">
                {hotspot.highlights.map((item, index) => (
                  <HighlightCard
                    key={`${hotspot.slug}-highlight-${index}`}
                    index={index}
                    text={item}
                  />
                ))}
              </View>
            </View>

            <View className="mt-8 gap-5">
              <SectionHeader
                eyebrow="Gallery"
                title="Mot strip anh bo sung cho hero"
                description="Anh chinh o dau trang giu vai tro cover, con day la cac frame bo sung de nguoi dung xem nhanh."
              />

              <ScrollView
                horizontal
                contentContainerStyle={{ paddingRight: 4 }}
                showsHorizontalScrollIndicator={false}
              >
                {galleryPreviewImages.map((imageUri, index) => (
                  <View
                    key={`${hotspot.slug}-gallery-${index}`}
                    className={
                      index === galleryPreviewImages.length - 1 ? "" : "mr-3"
                    }
                  >
                    <GalleryCard
                      imageUri={imageUri}
                      isPrimary={index === 0}
                      label={index === 0 ? "Hero frame" : `Gallery ${index}`}
                    />
                  </View>
                ))}
              </ScrollView>
            </View>

            <View className="mt-8 gap-5">
              <SectionHeader
                eyebrow="Story"
                title="Chieu sau cua dia diem"
                description="Day la phan ke chuyen chinh cua hotspot, di sau hon so voi doan mo ta ngan o hero."
              />

              <View
                className="rounded-[28px] bg-white px-5 py-5"
                style={cardShadowStyle}
              >
                <Text className="text-[15px] leading-7 text-[#2E4659]">
                  {hotspot.story}
                </Text>
              </View>

              <RoutePairingCard text={hotspot.routePairing} />
            </View>

            <View className="mt-8 gap-5">
              <SectionHeader
                eyebrow="Visit plan"
                title="Thoi diem va chi phi"
                description="Mot card ngan de gom lai thong tin thuc dung nhat cho nguoi di route."
              />

              <View
                className="rounded-[28px] bg-white px-5 py-5"
                style={cardShadowStyle}
              >
                <View className="flex-row flex-wrap gap-2">
                  <View className="rounded-full bg-[#EDF7FA] px-3 py-2">
                    <Text className="text-[12px] font-semibold text-[#1A96B7]">
                      {getBestTimeWindow(hotspot.bestTimeLabel)}
                    </Text>
                  </View>
                  <View className="rounded-full bg-[#EEF2FF] px-3 py-2">
                    <Text className="text-[12px] font-semibold text-[#4156D8]">
                      {getTicketSummary(hotspot.ticketLabel)}
                    </Text>
                  </View>
                  <View className="rounded-full bg-[#FFF1E8] px-3 py-2">
                    <Text className="text-[12px] font-semibold text-[#CC6728]">
                      {hotspot.vibeTags[0] ?? hotspot.category}
                    </Text>
                  </View>
                </View>

                <Text className="mt-4 text-[15px] font-black text-[#203244]">
                  {hotspot.scheduleLabel}
                </Text>
                <Text className="mt-2 text-[14px] leading-6 text-[#5F7486]">
                  {hotspot.address}
                </Text>
              </View>
            </View>

            <View className="mt-8 gap-5">
              <SectionHeader
                eyebrow="Travel tips"
                title="Meo nho de trai nghiem muot hon"
                description="Nhom tips nay duoc dua xuong cuoi content sheet de nguoi dung tiep can ngay truoc khi bat dau route."
              />

              <View className="gap-3">
                {hotspot.tips.map((item, index) => (
                  <TipRow key={`${hotspot.slug}-tip-${index}`} text={item} />
                ))}
              </View>
            </View>

            <View className="mt-8 gap-3">
              <Pressable
                className="overflow-hidden rounded-[22px]"
                onPress={() => router.replace("/hotspots")}
                style={buttonShadowStyle}
              >
                <LinearGradient
                  colors={loginGradientColors}
                  end={{ x: 1, y: 0.5 }}
                  locations={[0, 0.58, 1]}
                  start={{ x: 0, y: 0.5 }}
                  className="items-center px-5 py-4"
                >
                  <Text className="text-[15px] font-black tracking-[0.3px] text-white">
                    Bat dau hanh trinh
                  </Text>
                </LinearGradient>
              </Pressable>

              <Pressable
                className="items-center rounded-[22px] bg-white px-5 py-4"
                onPress={() => router.back()}
                style={cardShadowStyle}
              >
                <Text className="text-[14px] font-bold text-[#254055]">
                  Quay lai hero list
                </Text>
              </Pressable>
            </View>
          </Animated.View>
        </Animated.ScrollView>
      </SafeAreaView>
    </View>
  );
}
