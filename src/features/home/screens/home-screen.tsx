import { Image } from "expo-image";
import { LinearGradient } from "expo-linear-gradient";
import * as Linking from "expo-linking";
import * as Location from "expo-location";
import { useFocusEffect, useRouter } from "expo-router";
import { SymbolView } from "expo-symbols";
import { useCallback, useEffect, useRef, useState } from "react";
import {
  Platform,
  Pressable,
  ScrollView,
  Text,
  View,
  useWindowDimensions,
} from "react-native";
import Animated, {
  Easing,
  ReduceMotion,
  cancelAnimation,
  useAnimatedStyle,
  useSharedValue,
  withRepeat,
  withTiming,
} from "react-native-reanimated";
import { SafeAreaView } from "react-native-safe-area-context";

import {
  getValidAccessToken,
  useAuthSession,
} from "@/features/auth/hooks/use-auth-session";
import { getMyProfile } from "@/features/profile/api/get-me";

import { getActiveTagNames } from "../api/get-tags";
import {
  type NearbyCategoryCard,
  type CommunityBoardTab,
  type RouteDifficulty,
  activeJourney,
  avatarImageUri,
  communityBoards,
  communityTabs,
  featuredRoutes,
  nearbyCategories,
  nearbyPlaces,
  nearbyRoutes,
  voucherMerchants,
} from "../data/home-screen.mock";
import { getHotspotHref } from "../data/hotspots";

const gradientColors = ["#EB489B", "#F58752", "#FFC93C"] as const;
const guestPreviewLogo = require("../../../../assets/images/logo3.png");

const themeCategoryPresets: Record<
  string,
  Omit<NearbyCategoryCard, "label">
> = {
  am_thuc: {
    accent: "#C96A00",
    background: "#FFE7CC",
    icon: { ios: "fork.knife", android: "restaurant", web: "restaurant" },
  },
  check_in: {
    accent: "#2563EB",
    background: "#DCEBFF",
    icon: { ios: "camera.fill", android: "photo_camera", web: "photo_camera" },
  },
  di_san: {
    accent: "#7C3AED",
    background: "#EEE4FF",
    icon: {
      ios: "building.columns.fill",
      android: "account_balance",
      web: "account_balance",
    },
  },
  giao_duc: {
    accent: "#2563EB",
    background: "#DCEBFF",
    icon: { ios: "book.closed.fill", android: "menu_book", web: "menu_book" },
  },
  kien_truc: {
    accent: "#B83280",
    background: "#FFD7EA",
    icon: { ios: "building.2.fill", android: "architecture", web: "architecture" },
  },
  lich_su: {
    accent: "#D95C22",
    background: "#FFE4D3",
    icon: { ios: "clock.arrow.circlepath", android: "history", web: "history" },
  },
  nghe_thuat: {
    accent: "#0D8C7D",
    background: "#D9F7F1",
    icon: { ios: "paintpalette.fill", android: "palette", web: "palette" },
  },
  thien_nhien: {
    accent: "#2F855A",
    background: "#DCFCE7",
    icon: { ios: "leaf.fill", android: "park", web: "park" },
  },
  van_hoa: {
    accent: "#B45309",
    background: "#FFF1D6",
    icon: { ios: "theatermasks.fill", android: "theater_comedy", web: "theater_comedy" },
  },
};

function normalizeTagName(tagName: string) {
  return tagName
    .trim()
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "");
}

function resolveThemeCategoryPreset(
  tagName: string,
  index: number,
): Omit<NearbyCategoryCard, "label"> {
  const normalizedTagName = normalizeTagName(tagName);

  if (normalizedTagName.includes("di san")) {
    return themeCategoryPresets.di_san;
  }

  if (normalizedTagName.includes("van hoa")) {
    return themeCategoryPresets.van_hoa;
  }

  if (normalizedTagName.includes("lich su")) {
    return themeCategoryPresets.lich_su;
  }

  if (normalizedTagName.includes("kien truc")) {
    return themeCategoryPresets.kien_truc;
  }

  if (normalizedTagName.includes("thien nhien")) {
    return themeCategoryPresets.thien_nhien;
  }

  if (normalizedTagName.includes("nghe thuat")) {
    return themeCategoryPresets.nghe_thuat;
  }

  if (normalizedTagName.includes("am thuc")) {
    return themeCategoryPresets.am_thuc;
  }

  if (normalizedTagName.includes("giao duc")) {
    return themeCategoryPresets.giao_duc;
  }

  if (normalizedTagName.includes("check in")) {
    return themeCategoryPresets.check_in;
  }

  return nearbyCategories[index % nearbyCategories.length];
}

function mapTagNamesToNearbyCategories(tagNames: string[]) {
  return tagNames.map((tagName, index) => ({
    ...resolveThemeCategoryPreset(tagName, index),
    label: tagName,
  }));
}

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

const communityRankRingColors = ["#F7B500", "#C9D4E5", "#FF8A00"] as const;
const communityRankBadgeColors = ["#F7B500", "#9AACBF", "#FF8A00"] as const;

const communityRowShadowStyle = {
  shadowColor: "rgba(15, 23, 42, 0.08)",
  shadowOpacity: 1,
  shadowRadius: 10,
  shadowOffset: {
    width: 0,
    height: 4,
  },
  elevation: 2,
} as const;

type GuestLocationMode =
  | "error"
  | "loading"
  | "permission-denied"
  | "ready"
  | "services-disabled";

type GuestLocationState = {
  label: string;
  mode: GuestLocationMode;
};

type ExplorerSummary = {
  level: number | null;
  name: string;
};

const guestLocationLoadingState: GuestLocationState = {
  label: "Đang định vị...",
  mode: "loading",
};

function formatGuestLocationLabel(
  address?: Location.LocationGeocodedAddress | null,
) {
  if (!address) {
    return "Vị trí của bạn";
  }

  const district = address.district?.trim();
  const subregion = address.subregion?.trim();
  const city = address.city?.trim();
  const region = address.region?.trim();
  const country = address.country?.trim();

  const primary = district || subregion || city || region || country;

  if (!primary) {
    return "Vị trí của bạn";
  }

  if (city && primary !== city) {
    return `${primary}, ${city}`;
  }

  return primary;
}

async function resolveGuestLocationState(): Promise<GuestLocationState> {
  const servicesEnabled = await Location.hasServicesEnabledAsync();

  if (!servicesEnabled) {
    return {
      label: "Mở GPS",
      mode: "services-disabled",
    };
  }

  const permission = await Location.getForegroundPermissionsAsync();

  const permissionResponse =
    permission.granted || !permission.canAskAgain
      ? permission
      : await Location.requestForegroundPermissionsAsync();

  if (permissionResponse.status !== "granted") {
    return {
      label: "Bật vị trí",
      mode: "permission-denied",
    };
  }

  const lastKnownLocation = await Location.getLastKnownPositionAsync({
    maxAge: 60_000,
    requiredAccuracy: 150,
  });

  const currentLocation =
    lastKnownLocation ??
    (await Location.getCurrentPositionAsync({
      accuracy: Location.Accuracy.Balanced,
      mayShowUserSettingsDialog: Platform.OS === "android",
    }));

  if (!currentLocation) {
    return {
      label: "Thử lại",
      mode: "error",
    };
  }

  if (Platform.OS === "web") {
    return {
      label: "Vị trí hiện tại",
      mode: "ready",
    };
  }

  const addresses = await Location.reverseGeocodeAsync({
    latitude: currentLocation.coords.latitude,
    longitude: currentLocation.coords.longitude,
  });

  return {
    label: formatGuestLocationLabel(addresses[0]),
    mode: "ready",
  };
}

function useGuestLocationPill() {
  const [locationState, setLocationState] = useState<GuestLocationState>(
    guestLocationLoadingState,
  );
  const requestIdRef = useRef(0);

  useEffect(() => {
    let isMounted = true;

    async function refreshLocation() {
      const requestId = ++requestIdRef.current;

      if (isMounted) {
        setLocationState(guestLocationLoadingState);
      }

      try {
        const nextState = await resolveGuestLocationState();

        if (isMounted && requestId === requestIdRef.current) {
          setLocationState(nextState);
        }
      } catch {
        if (isMounted && requestId === requestIdRef.current) {
          setLocationState({
            label: "Thử lại",
            mode: "error",
          });
        }
      }
    }

    void refreshLocation();

    return () => {
      isMounted = false;
    };
  }, []);

  const handlePress = async () => {
    if (locationState.mode === "permission-denied") {
      await Linking.openSettings();
      return;
    }

    if (locationState.mode === "services-disabled") {
      if (Platform.OS === "android") {
        try {
          await Location.enableNetworkProviderAsync();
        } catch {
          await Linking.openSettings();
          return;
        }
      } else {
        await Linking.openSettings();
        return;
      }
    }

    const requestId = ++requestIdRef.current;
    setLocationState(guestLocationLoadingState);

    try {
      const nextState = await resolveGuestLocationState();

      if (requestId === requestIdRef.current) {
        setLocationState(nextState);
      }
    } catch {
      if (requestId === requestIdRef.current) {
        setLocationState({
          label: "Thử lại",
          mode: "error",
        });
      }
    }
  };

  return {
    handlePress,
    locationState,
  };
}

function GuestAccessCard({ onPress }: { onPress: () => void }) {
  const arrowOffset = useSharedValue(0);

  useEffect(() => {
    arrowOffset.set(
      withRepeat(
        withTiming(10, {
          duration: 850,
          easing: Easing.inOut(Easing.quad),
          reduceMotion: ReduceMotion.System,
        }),
        -1,
        true,
        undefined,
        ReduceMotion.System,
      ),
    );

    return () => {
      cancelAnimation(arrowOffset);
      arrowOffset.set(0);
    };
  }, [arrowOffset]);

  const animatedArrowStyle = useAnimatedStyle(() => {
    return {
      transform: [{ translateX: arrowOffset.get() }],
    };
  });

  return (
    <View className="gap-3">
      <Text className="text-[20px] font-extrabold text-[#2B2233]">
        Mở khóa hành trình của bạn
      </Text>

      <View
        className="overflow-hidden rounded-[28px] border border-[#F8D7E3] bg-white"
        style={cardShadowStyle}
      >
        <LinearGradient
          colors={["#FFF7FB", "#FFF3EC"]}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 1 }}
          className="absolute inset-0"
        />

        <View className="gap-5 px-4 py-4">
          <View className="flex-row items-start gap-4">
            <View className="flex-1 gap-2">
              <View className="self-start rounded-full bg-white/90 px-3 py-1">
                <Text className="text-[10px] font-extrabold uppercase tracking-[0.6px] text-[#EB489B]">
                  Guest mode
                </Text>
              </View>

              <View className="items-center py-1.5">
                <LinearGradient
                  colors={gradientColors}
                  start={{ x: 0, y: 0.2 }}
                  end={{ x: 1, y: 0.8 }}
                  className="h-24 w-24 rounded-full p-[2px]"
                  style={{
                    shadowColor: "rgba(235, 72, 155, 0.16)",
                    shadowOpacity: 1,
                    shadowRadius: 14,
                    shadowOffset: {
                      width: 0,
                      height: 8,
                    },
                    elevation: 5,
                  }}
                >
                  <View className="h-full w-full items-center justify-center rounded-full bg-[#FFF1F6]">
                    <SymbolView
                      name={{
                        ios: "lock.fill",
                        android: "lock",
                        web: "lock",
                      }}
                      size={38}
                      tintColor="#EB489B"
                    />
                  </View>
                </LinearGradient>
              </View>
            </View>
          </View>

          <View className="flex-row flex-wrap gap-2">
            <View className="rounded-full bg-white/90 px-3 py-2">
              <Text className="text-[11px] font-bold text-[#D9587F]">
                Lưu tiến trình
              </Text>
            </View>
            <View className="rounded-full bg-white/90 px-3 py-2">
              <Text className="text-[11px] font-bold text-[#D9587F]">
                Mở khóa story
              </Text>
            </View>
            <View className="rounded-full bg-white/90 px-3 py-2">
              <Text className="text-[11px] font-bold text-[#D9587F]">
                Nhận voucher
              </Text>
            </View>
          </View>

          <Pressable
            onPress={onPress}
            className="self-center overflow-hidden rounded-[18px]"
            style={{ minWidth: 282 }}
          >
            <LinearGradient
              colors={gradientColors}
              start={{ x: 0, y: 0.5 }}
              end={{ x: 1, y: 0.5 }}
              locations={[0, 0.58, 1]}
              className="relative items-center justify-center px-5 py-3.5"
            >
              <Text className="text-[15px] font-extrabold text-white">
                Trải nghiệm ngay
              </Text>

              <View className="absolute right-3 h-9 w-9 items-center justify-center rounded-full bg-white/18">
                <Animated.View style={animatedArrowStyle}>
                  <SymbolView
                    name={{
                      ios: "arrow.right",
                      android: "arrow_forward",
                      web: "arrow_forward",
                    }}
                    size={16}
                    tintColor="#FFFFFF"
                  />
                </Animated.View>
              </View>
            </LinearGradient>
          </Pressable>
        </View>
      </View>
    </View>
  );
}

function GuestWelcomeHeader({
  onGreetingPress,
}: {
  onGreetingPress: () => void;
}) {
  const logoOffset = useSharedValue(0);
  const { handlePress, locationState } = useGuestLocationPill();

  useEffect(() => {
    logoOffset.set(
      withRepeat(
        withTiming(-8, {
          duration: 1100,
          easing: Easing.inOut(Easing.quad),
          reduceMotion: ReduceMotion.System,
        }),
        -1,
        true,
        undefined,
        ReduceMotion.System,
      ),
    );

    return () => {
      cancelAnimation(logoOffset);
      logoOffset.set(0);
    };
  }, [logoOffset]);

  const animatedLogoStyle = useAnimatedStyle(() => {
    return {
      transform: [{ translateY: logoOffset.get() }],
    };
  });

  return (
    <View className="flex-row items-center gap-4 px-1 py-2">
      <Animated.View style={animatedLogoStyle}>
        <View className="h-16 w-16 items-center justify-center rounded-full bg-white/95">
          <Image
            source={guestPreviewLogo}
            contentFit="contain"
            transition={380}
            style={{ height: 90, width: 90 }}
          />
        </View>
      </Animated.View>

      <View className="flex-1 gap-1">
        <View className="flex-row items-center justify-between gap-3">
          <Pressable className="flex-1" hitSlop={8} onPress={onGreetingPress}>
            <Text className="text-[22px] font-extrabold tracking-[-0.3px] text-[#2B2233]">
              Xin chào bạn
            </Text>
          </Pressable>

          <Pressable
            className="max-w-[48%] flex-row items-center gap-1.5 rounded-full border border-[#F5D7C7] bg-white px-3 py-2"
            onPress={() => {
              void handlePress();
            }}
          >
            <SymbolView
              name={{
                ios: "location",
                android: "my_location",
                web: "my_location",
              }}
              size={14}
              tintColor="#F58752"
            />
            <Text
              className="text-[11px] font-semibold text-[#8E869A]"
              numberOfLines={1}
            >
              {locationState.label}
            </Text>
          </Pressable>
        </View>

        <View className="flex-row items-center gap-1.5">
          <SymbolView
            name={{
              ios: "star.fill",
              android: "star",
              web: "star",
            }}
            size={14}
            tintColor="#F7B500"
          />
          <Text className="text-[13px] font-bold text-[#8E869A]">
            Đăng nhập để lưu hành trình
          </Text>
        </View>
      </View>
    </View>
  );
}

function ExplorerHeaderActions() {
  const { handlePress } = useGuestLocationPill();

  return (
    <View className="flex-row items-center gap-3">
      <Pressable
        className="h-12 w-12 items-center justify-center rounded-full bg-[#FFF4EF]"
        onPress={() => {
          void handlePress();
        }}
      >
        <SymbolView
          name={{
            ios: "location",
            android: "my_location",
            web: "my_location",
          }}
          size={20}
          tintColor="#F58752"
        />
      </Pressable>

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
  );
}

export default function HomeScreen() {
  const router = useRouter();
  const authSession = useAuthSession();
  const { width } = useWindowDimensions();
  const activeRouteIndexRef = useRef(0);
  const [activeRouteIndex, setActiveRouteIndex] = useState(0);
  const [explorerSummary, setExplorerSummary] = useState<ExplorerSummary | null>(
    null,
  );
  const [themeCategories, setThemeCategories] = useState(() => nearbyCategories);
  const [activeCommunityTab, setActiveCommunityTab] =
    useState<CommunityBoardTab>("community");
  const isGuest = authSession.role === "guest";
  const routeCardLeftInset = 20;
  const routeCardRightInset = 16;
  const routeCardWidth = Math.max(
    width - routeCardLeftInset - routeCardRightInset,
    264,
  );
  const nearbyRouteCardWidth = Math.min(Math.max(width * 0.64, 220), 252);
  const nearbyPlaceCardWidth = Math.min(Math.max(width * 0.4, 156), 170);
  const nearbyPlaceImageHeight = Math.round(nearbyPlaceCardWidth * 0.8);
  const voucherMerchantCircleSize = Math.min(Math.max(width * 0.2, 76), 86);
  const voucherMerchantLogoSize = Math.round(voucherMerchantCircleSize * 0.88);
  const voucherMerchantItemWidth = voucherMerchantCircleSize + 14;
  const currentJourney =
    !isGuest && activeJourney && !activeJourney.completed
      ? activeJourney
      : null;
  const activeJourneyProgress = currentJourney
    ? Math.min(Math.max(currentJourney.progress, 0), 100)
    : 0;
  const activeCommunityBoard = communityBoards[activeCommunityTab];
  const activeFeaturedRoute = featuredRoutes[activeRouteIndex];
  const explorerName =
    explorerSummary?.name.trim() ||
    authSession.displayName.trim() ||
    authSession.username?.trim() ||
    "Ngọc";
  const explorerLevel = explorerSummary?.level ?? authSession.level ?? 12;
  const handleOpenHotspots = () => {
    router.push("/hotspots");
  };
  const handleOpenRegister = () => {
    router.push("/login?entry=home");
  };

  useEffect(() => {
    const intervalId = setInterval(() => {
      const nextIndex =
        (activeRouteIndexRef.current + 1) % featuredRoutes.length;

      activeRouteIndexRef.current = nextIndex;
      setActiveRouteIndex(nextIndex);
    }, 3600);

    return () => {
      clearInterval(intervalId);
    };
  }, []);

  useEffect(() => {
    let isActive = true;

    async function loadThemeCategories() {
      if (!authSession.isAuthenticated) {
        setThemeCategories(nearbyCategories);
        return;
      }

      try {
        const accessToken = await getValidAccessToken();

        if (!isActive || !accessToken) {
          return;
        }

        const tagNames = await getActiveTagNames({
          accessToken,
          tokenType: authSession.tokenType,
        });

        if (!isActive || tagNames.length === 0) {
          return;
        }

        setThemeCategories(mapTagNamesToNearbyCategories(tagNames));
      } catch (error) {
        console.warn("[home] load theme categories failed", {
          error: error instanceof Error ? error.message : error,
        });
      }
    }

    void loadThemeCategories();

    return () => {
      isActive = false;
    };
  }, [authSession.isAuthenticated, authSession.tokenType]);

  useFocusEffect(
    useCallback(() => {
      let isActive = true;

      async function loadExplorerSummary() {
        if (!authSession.isAuthenticated) {
          if (isActive) {
            setExplorerSummary(null);
          }
          return;
        }

        try {
          const accessToken = await getValidAccessToken();

          if (!accessToken || !isActive) {
            return;
          }

          const profile = await getMyProfile({
            accessToken,
            tokenType: authSession.tokenType,
          });

          if (!isActive) {
            return;
          }

          const resolvedName = profile.name.trim() || profile.username.trim();

          setExplorerSummary({
            level: profile.level,
            name: resolvedName || "Ngọc",
          });
        } catch (error) {
          if (!isActive) {
            return;
          }

          console.warn("[home] load explorer summary failed", {
            error: error instanceof Error ? error.message : error,
          });
        }
      }

      void loadExplorerSummary();

      return () => {
        isActive = false;
      };
    }, [authSession.isAuthenticated, authSession.tokenType]),
  );

  return (
    <SafeAreaView
      className="flex-1 bg-white"
      edges={["top", "left", "right", "bottom"]}
    >
      <ScrollView
        className="flex-1"
        contentContainerStyle={{ paddingBottom: 0 }}
        showsVerticalScrollIndicator={false}
      >
        <View className="gap-6 px-5 pt-1">
          {isGuest ? (
            <GuestWelcomeHeader onGreetingPress={handleOpenRegister} />
          ) : (
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
                      {`Lv.${explorerLevel}`}
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
                      {`Chào ${explorerName}`}
                    </Text>
                    <Text className="text-[13px] leading-5 text-[#8E869A]">
                      Sẵn sàng khám phá hành trình
                    </Text>
                  </View>
                </View>
              </View>

              <ExplorerHeaderActions />
            </View>
          )}

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
            <Text className="text-[20px] font-extrabold text-[#2B2233]">
              Tuyến nổi bật
            </Text>

            <View
              className="items-start"
              style={{
                marginHorizontal: -20,
                width,
                paddingLeft: routeCardLeftInset,
              }}
            >
              <View
                key={activeFeaturedRoute.title}
                className="overflow-hidden rounded-[30px] bg-[#2B2233]"
                style={[
                  heroShadowStyle,
                  {
                    width: routeCardWidth,
                  },
                ]}
              >
                <Image
                  source={activeFeaturedRoute.imageUri}
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
                            {activeFeaturedRoute.title}
                          </Text>
                        </View>
                        <View className="gap-3">
                          <View className="flex-row flex-wrap gap-2">
                            <View className="rounded-full bg-white/18 px-3 py-1.5">
                              <Text className="text-[12px] font-bold text-white">
                                {activeFeaturedRoute.stops}
                              </Text>
                            </View>
                            <View className="rounded-full bg-white/18 px-3 py-1.5">
                              <Text className="text-[12px] font-bold text-white">
                                {activeFeaturedRoute.distance}
                              </Text>
                            </View>
                            <View className="rounded-full bg-white/18 px-3 py-1.5">
                              <Text className="text-[12px] font-bold text-white">
                                {activeFeaturedRoute.duration}
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

            <View className="flex-row items-center justify-center gap-2 px-5">
              {featuredRoutes.map((route, index) => (
                <Pressable
                  key={route.title}
                  onPress={() => {
                    activeRouteIndexRef.current = index;
                    setActiveRouteIndex(index);
                  }}
                  className={`rounded-full ${
                    index === activeRouteIndex
                      ? "h-2.5 w-8 bg-[#EB489B]"
                      : "h-2.5 w-2.5 bg-[#F3C9D9]"
                  }`}
                />
              ))}
            </View>
          </View>

          {isGuest ? (
            <GuestAccessCard onPress={handleOpenRegister} />
          ) : currentJourney ? (
            <View className="gap-3">
              <Text className="text-[20px] font-extrabold text-[#2B2233]">
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
                    source={currentJourney.imageUri}
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
                        {currentJourney.rewardLabel}
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
                        {currentJourney.title}
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
                          Tiếp theo: {currentJourney.nextStop} ·{" "}
                          {currentJourney.distanceToNext}
                        </Text>
                      </View>

                      <View className="mt-1 flex-row items-center">
                        {Array.from({
                          length: currentJourney.totalCheckpoints,
                        }).map((_, index) => {
                          const isPast =
                            index < currentJourney.currentCheckpoint;
                          const isCurrent =
                            index === currentJourney.currentCheckpoint;

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
                              {index < currentJourney.totalCheckpoints - 1 ? (
                                <View
                                  className={`h-[3px] flex-1 rounded-full ${
                                    index < currentJourney.currentCheckpoint
                                      ? ""
                                      : "bg-[#E5DCE2]"
                                  }`}
                                  style={
                                    index < currentJourney.currentCheckpoint
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
                        {currentJourney.remainingStopsLabel} ·{" "}
                        {currentJourney.remainingTimeLabel}
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
              <Pressable hitSlop={8} onPress={handleOpenHotspots}>
                <Text className="text-[20px] font-extrabold text-[#2B2233]">
                  Địa điểm gần bạn
                </Text>
              </Pressable>
              <Pressable
                className="rounded-full bg-[#FFF4EF] px-3.5 py-2"
                onPress={handleOpenHotspots}
              >
                <Text className="text-[13px] font-bold text-[#F58752]">
                  Xem tất cả
                </Text>
              </Pressable>
            </View>

            <ScrollView
              horizontal
              contentContainerStyle={{ paddingRight: 8 }}
              showsHorizontalScrollIndicator={false}
            >
              {nearbyPlaces.map((place, index) => (
                <Pressable
                  key={place.slug}
                  className={index === nearbyPlaces.length - 1 ? "" : "mr-3.5"}
                  onPress={() => {
                    router.push(getHotspotHref(place.slug));
                  }}
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
                </Pressable>
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
              {themeCategories.map((item, index) => (
                <Pressable
                  key={`${item.label}-${index}`}
                  className={
                    index === themeCategories.length - 1 ? "" : "mr-3.5"
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
                  <Text className="text-[20px] font-extrabold text-[#2B2233]">
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
                            className="items-center justify-center"
                            style={{
                              height: voucherMerchantCircleSize,
                              width: voucherMerchantCircleSize,
                            }}
                          >
                            <Image
                              source={merchant.logoUri}
                              contentFit="contain"
                              transition={180}
                              cachePolicy="memory-disk"
                              style={{
                                height:
                                  voucherMerchantLogoSize * merchant.logoScale,
                                width:
                                  voucherMerchantLogoSize * merchant.logoScale,
                              }}
                            />
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
            className="overflow-hidden rounded-[28px] bg-white"
            style={cardShadowStyle}
          >
            <View className="px-4 pb-4 pt-4">
              <View className="flex-row items-center justify-between">
                <View className="flex-row items-center gap-2.5">
                  <View className="h-7 w-7 items-center justify-center rounded-full bg-[#FFF1D6]">
                    <SymbolView
                      name={{
                        ios: "trophy.fill",
                        android: "emoji_events",
                        web: "emoji_events",
                      }}
                      size={15}
                      tintColor="#C98A10"
                    />
                  </View>
                  <Text className="text-[20px] font-extrabold text-[#1F2940]">
                    Cộng đồng hôm nay
                  </Text>
                </View>

                <Text className="text-[11px] font-bold uppercase tracking-[0.3px] text-[#FF6F95]">
                  BXH
                </Text>
              </View>

              <View className="mt-4 flex-row items-end justify-between border-b border-[#F3E7ED]">
                <View className="flex-row">
                  {communityTabs.map((tab) => {
                    const isActive = activeCommunityTab === tab.key;

                    return (
                      <Pressable
                        key={tab.key}
                        className="mr-6 pb-3"
                        onPress={() => {
                          setActiveCommunityTab(tab.key);
                        }}
                      >
                        <Text
                          className={`text-[12px] font-bold ${
                            isActive ? "text-[#FF5F87]" : "text-[#7D7281]"
                          }`}
                        >
                          {tab.label}
                        </Text>
                        <View
                          className={`mt-2 h-[2.5px] rounded-full ${
                            isActive ? "bg-[#FF5F87]" : "bg-transparent"
                          }`}
                        />
                      </Pressable>
                    );
                  })}
                </View>

                <View className="mb-3 flex-row items-center">
                  <SymbolView
                    name={{
                      ios: "chart.line.uptrend.xyaxis",
                      android: "show_chart",
                      web: "show_chart",
                    }}
                    size={12}
                    tintColor="#7D7281"
                  />
                  <Text className="ml-1 text-[10px] font-semibold text-[#7D7281]">
                    Live
                  </Text>
                </View>
              </View>

              <View className="mt-4 gap-3">
                <LinearGradient
                  colors={["#FFF6F9", "#FFF1F5"]}
                  start={{ x: 0, y: 0.5 }}
                  end={{ x: 1, y: 0.5 }}
                  className="flex-row items-center rounded-[22px] border border-[#F9E2EA] px-3.5 py-3.5"
                >
                  <View className="mr-3 h-12 w-12 items-center justify-center rounded-full bg-[#FFE8F0]">
                    <Text className="text-[11px] font-black text-[#FF5F87]">
                      #{activeCommunityTab === "community" ? "24" : "01"}
                    </Text>
                  </View>

                  <View className="flex-1 pr-3">
                    <Text className="text-[13px] font-extrabold text-[#1F2940]">
                      {activeCommunityBoard.summaryLabel}
                    </Text>
                    <Text className="mt-0.5 text-[10px] leading-4 text-[#9B8D9A]">
                      {activeCommunityBoard.summaryNote}
                    </Text>
                  </View>

                  <View className="flex-row items-center rounded-full border border-[#F8D8E3] bg-white px-3 py-1.5">
                    <SymbolView
                      name={{
                        ios: "star.fill",
                        android: "star",
                        web: "star",
                      }}
                      size={12}
                      tintColor="#FF5F87"
                    />
                    <Text className="ml-1 text-[11px] font-extrabold text-[#1F2940]">
                      {activeCommunityBoard.totalPoints}
                    </Text>
                  </View>
                </LinearGradient>

                <View className="gap-3">
                  {activeCommunityBoard.entries.map((entry, index) => (
                    <View
                      key={`${activeCommunityTab}-${entry.name}`}
                      className="flex-row items-center rounded-[24px] border border-[#EEF1F4] bg-white px-3.5 py-3"
                      style={communityRowShadowStyle}
                    >
                      <View className="relative mr-3.5 h-[54px] w-[54px] items-center justify-center">
                        <View
                          className="items-center justify-center rounded-full bg-white"
                          style={{
                            borderColor:
                              communityRankRingColors[
                                Math.min(
                                  index,
                                  communityRankRingColors.length - 1,
                                )
                              ],
                            borderWidth: 2.5,
                            height: 46,
                            width: 46,
                          }}
                        >
                          <View className="h-[38px] w-[38px] overflow-hidden rounded-full bg-[#F3F4F6]">
                            <Image
                              source={entry.avatarUri}
                              contentFit="cover"
                              transition={180}
                              cachePolicy="memory-disk"
                              style={{ height: "100%", width: "100%" }}
                            />
                          </View>
                        </View>

                        <View
                          className="absolute bottom-0 right-0 h-6 w-6 items-center justify-center rounded-full border-[2px] border-white"
                          style={{
                            backgroundColor:
                              communityRankBadgeColors[
                                Math.min(
                                  index,
                                  communityRankBadgeColors.length - 1,
                                )
                              ],
                          }}
                        >
                          <Text className="text-[12px] font-black text-white">
                            {index + 1}
                          </Text>
                        </View>
                      </View>

                      <View className="flex-1 pr-3">
                        <Text className="text-[14px] font-extrabold text-[#1F2940]">
                          {entry.name}
                        </Text>
                        <Text className="mt-0.5 text-[11px] leading-4 text-[#8F8290]">
                          {entry.subtitle}
                        </Text>
                      </View>

                      <View className="flex-row items-center rounded-full border border-[#F4DCE5] bg-white px-3 py-1.5">
                        <SymbolView
                          name={{
                            ios: "star.fill",
                            android: "star",
                            web: "star",
                          }}
                          size={11}
                          tintColor="#FF5F87"
                        />
                        <Text className="ml-1 text-[11px] font-extrabold text-[#1F2940]">
                          {entry.points}
                        </Text>
                      </View>
                    </View>
                  ))}
                </View>
              </View>
            </View>

            <Pressable className="border-t border-[#F3E7ED] px-4 py-3">
              <View className="flex-row items-center justify-center">
                <SymbolView
                  name={{
                    ios: "list.number",
                    android: "leaderboard",
                    web: "leaderboard",
                  }}
                  size={13}
                  tintColor="#FF5F87"
                />
                <Text className="ml-1.5 text-[12px] font-bold text-[#FF5F87]">
                  Xem bảng xếp hạng đầy đủ
                </Text>
              </View>
            </Pressable>
          </View>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}
