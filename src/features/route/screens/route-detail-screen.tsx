import { AppLoadingScreen } from "@/components/ui/app-loading-screen";
import { SymbolView } from "@/components/ui/symbol-view";
import { ScreenHorizontalPadding } from "@/constants/theme";
import { Image } from "expo-image";
import { LinearGradient } from "expo-linear-gradient";
import {
  type Href,
  useFocusEffect,
  useLocalSearchParams,
  useRouter,
} from "expo-router";
import {
  ActivityIndicator,
  Alert,
  type GestureResponderEvent,
  Modal,
  Pressable,
  ScrollView,
  Text,
  useWindowDimensions,
  View,
} from "react-native";

import { SafeAreaView, useSafeAreaInsets } from "react-native-safe-area-context";

import { routeSystemAlert } from "@/features/route/components/route-system-alert";

import {
  type ReactNode,
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";

import {
  getValidAccessToken,
  useAuthSession,
} from "@/features/auth/hooks/use-auth-session";
import {
  findMatchingHotspotByNameOrCoordinate,
  getApiHotspotRouteSlug,
  getHotspotHref,
} from "@/features/home/data/hotspots";
import {
  getHotspotReviews,
  getReviewCreatedAtTime,
  type HotspotReview,
} from "@/features/home/api/get-hotspot-reviews";
import { likeReview } from "@/features/home/api/like-review";
import { deleteReview } from "@/features/home/api/review-mutations";
import { ReviewDeleteDialog } from "@/features/home/components/review-delete-dialog";
import { avatarImageUri } from "@/features/home/data/home-screen.mock";
import { cacheHotspotReviewForEdit } from "@/features/home/data/hotspot-review-edit-cache";
import { getMultiStopRouteCoordinates } from "@/features/map/api/goong-directions";
import { AppMap } from "@/features/map/components/app-map";
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
} from "@/features/route/api/route-api";
import { openGoogleMapsMultiStopRoute } from "@/lib/google-maps-navigation";
import { getHotspotDetailHref } from "@/lib/hotspot-navigation";

const fallbackStopImage =
  "https://i.pinimg.com/736x/f3/0f/e8/f30fe84218790e6ffd25f987d434eb13.jpg";

const cardShadow = {
  shadowColor: "rgba(28, 45, 80, 0.10)",
  shadowOpacity: 1,
  shadowRadius: 16,
  shadowOffset: { width: 0, height: 8 },
  elevation: 5,
} as const;

const glowShadow = {
  shadowColor: "rgba(235, 72, 155, 0.32)",
  shadowOpacity: 1,
  shadowRadius: 18,
  shadowOffset: { width: 0, height: 8 },
  elevation: 10,
} as const;

const reviewMediaGridGap = 6;
const reviewMediaBorderRadius = 10;
const singleMediaAspectRatio = 16 / 9;
const twoMediaAspectRatio = 6 / 5;
const gridMediaAspectRatio = 16 / 9;

type RouteReview = {
  id: string;
  user: string;
  avatar: string;
  levelLabel?: string | null;
  visitedOn: string;
  isLikePending: boolean;
  isLiked: boolean;
  rating: number;
  review: HotspotReview;
  reviewId: number;
  text: string;
  photos: string[];
  helpful: number;
};

function getCoordinate(stop: RouteHotspotDto) {
  if (typeof stop.latitude !== "number" || typeof stop.longitude !== "number")
    return null;
  if (!Number.isFinite(stop.latitude) || !Number.isFinite(stop.longitude))
    return null;
  if (Math.abs(stop.latitude) > 90 || Math.abs(stop.longitude) > 180)
    return null;
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

  return (
    earthRadiusKm *
    2 *
    Math.atan2(Math.sqrt(haversine), Math.sqrt(1 - haversine))
  );
}

function formatDistance(distanceKm: number | null) {
  if (distanceKm === null || !Number.isFinite(distanceKm))
    return "Điểm cuối tuyến";
  if (distanceKm < 1) return `${Math.round(distanceKm * 1000)} m tới điểm sau`;
  if (distanceKm < 10) return `${distanceKm.toFixed(1)} km tới điểm sau`;
  return `${Math.round(distanceKm)} km tới điểm sau`;
}

function clampNumber(value: number, minimum: number, maximum: number) {
  return Math.min(Math.max(value, minimum), maximum);
}

function getElapsedCalendarMonths(fromTime: number, toTime: number) {
  const fromDate = new Date(fromTime);
  const toDate = new Date(toTime);
  let monthDelta =
    (toDate.getFullYear() - fromDate.getFullYear()) * 12 +
    (toDate.getMonth() - fromDate.getMonth());

  if (toDate.getDate() < fromDate.getDate()) {
    monthDelta -= 1;
  }

  return Math.max(monthDelta, 0);
}

function formatReviewDateLabel(createdAtTime: number, currentTime: number) {
  if (!Number.isFinite(createdAtTime) || createdAtTime <= 0) {
    return "Vừa xong";
  }

  const elapsedMilliseconds = currentTime - createdAtTime;

  if (elapsedMilliseconds <= 0) {
    return "Vừa xong";
  }

  const minuteInMilliseconds = 60 * 1000;
  const hourInMilliseconds = 60 * minuteInMilliseconds;
  const dayInMilliseconds = 24 * hourInMilliseconds;

  if (elapsedMilliseconds < minuteInMilliseconds) {
    return "Vừa xong";
  }

  const formatElapsedValue = (value: number, unit: string) => `${value} ${unit}`;
  const elapsedMinutes = Math.floor(elapsedMilliseconds / minuteInMilliseconds);

  if (elapsedMinutes < 60) {
    return formatElapsedValue(elapsedMinutes, "phút");
  }

  const elapsedHours = Math.floor(elapsedMinutes / 60);

  if (elapsedHours < 24) {
    return formatElapsedValue(elapsedHours, "giờ");
  }

  const elapsedDays = Math.floor(elapsedMilliseconds / dayInMilliseconds);

  if (elapsedDays < 7) {
    return formatElapsedValue(elapsedDays, "ngày");
  }

  if (elapsedDays <= 30) {
    return formatElapsedValue(Math.floor(elapsedDays / 7), "tuần");
  }

  const elapsedMonths = getElapsedCalendarMonths(createdAtTime, currentTime);

  if (elapsedMonths < 12) {
    return formatElapsedValue(Math.max(elapsedMonths, 1), "tháng");
  }

  return formatElapsedValue(Math.floor(elapsedMonths / 12), "năm");
}

function getDifficultyLabel(difficulty?: string) {
  switch (difficulty?.toUpperCase()) {
    case "EASY":
      return "Dễ";
    case "MEDIUM":
      return "Vừa";
    case "HARD":
      return "Khó";
    default:
      return difficulty || "Dễ";
  }
}

function getStopImage(stop: RouteHotspotDto) {
  const image =
    stop.medias?.find((media) => {
      const kind =
        `${media.mediaType ?? ""} ${media.mimeType ?? ""}`.toLowerCase();
      return kind.includes("image");
    }) ?? stop.medias?.[0];

  return image?.fileUrl || fallbackStopImage;
}

function getRouteHotspotOrder(stop: RouteHotspotDto, fallbackIndex: number) {
  return (
    stop.orderIndex ?? stop.sequenceNumber ?? stop.index ?? fallbackIndex + 1
  );
}

function getOrderedRouteHotspots(hotspots: RouteHotspotDto[]) {
  return hotspots
    .map((stop, index) => ({ stop, index }))
    .sort((a, b) => {
      const orderDiff =
        getRouteHotspotOrder(a.stop, a.index) -
        getRouteHotspotOrder(b.stop, b.index);
      return orderDiff !== 0 ? orderDiff : a.index - b.index;
    })
    .map((item) => item.stop);
}

function resolveRouteHotspotHref(
  stop: RouteHotspotDto,
  routeId?: number | string | null,
): Href {
  const matchedHotspot = findMatchingHotspotByNameOrCoordinate({
    hotspotName: stop.hotspotName ?? "",
    latitude: Number(stop.latitude ?? 0),
    longitude: Number(stop.longitude ?? 0),
  });

  if (matchedHotspot) {
    return getHotspotHref(matchedHotspot.slug, stop.hotspotId, routeId);
  }

  return (
    getHotspotDetailHref(String(stop.hotspotId), routeId) ??
    getHotspotHref(
      getApiHotspotRouteSlug(stop.hotspotId),
      stop.hotspotId,
      routeId,
    )
  );
}

function normalizeRouteUserProgressStatus(status?: string | null) {
  return (status ?? "").trim().toUpperCase();
}

function clampReviewRatingValue(value?: number | null) {
  return typeof value === "number" && Number.isFinite(value)
    ? clampNumber(value, 0, 5)
    : 0;
}

function formatReviewCountLabel(value?: number | null) {
  const reviewCount =
    typeof value === "number" && Number.isFinite(value)
      ? Math.max(0, Math.round(value))
      : 0;

  return new Intl.NumberFormat("vi-VN").format(reviewCount);
}

function XPBar({
  value,
  max,
  colors = ["#FFE566", "#FFB400"],
  trackColor = "#ECEEF4",
}: {
  value: number;
  max: number;
  colors?: [string, string] | readonly [string, string];
  trackColor?: string;
}) {
  const percent = max > 0 ? Math.min(Math.max((value / max) * 100, 0), 100) : 0;

  return (
    <View
      className="flex-1 overflow-hidden rounded-full"
      style={{ backgroundColor: trackColor, height: 8 }}
    >
      <LinearGradient
        colors={[...colors]}
        start={{ x: 0, y: 0.5 }}
        end={{ x: 1, y: 0.5 }}
        style={{ borderRadius: 999, height: "100%", width: `${percent}%` }}
      />
    </View>
  );
}

function RouteJoinedCard() {
  return (
    <View className="mt-3 overflow-hidden rounded-[24px] border border-[#CDEFD9] bg-[#ECFDF3] px-4 py-3">
      <View className="flex-row items-center gap-2.5">
        <View className="h-8 w-8 items-center justify-center rounded-full bg-[#12B76A]">
          <SymbolView
            name={{
              ios: "checkmark",
              android: "check",
              web: "check",
            }}
            size={16}
            tintColor="#fff"
          />
        </View>
        <Text className="flex-1 text-[14px] font-medium text-[#027A48]">
          Tuyến đường đã tham gia
        </Text>
      </View>
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
        .filter(
          (stop) =>
            Number.isFinite(stop.latitude) && Number.isFinite(stop.longitude),
        )
        .map((stop) => ({
          id: stop.hotspotId,
          title: stop.hotspotName || `Hotspot #${stop.hotspotId}`,
          description: checkedInIds.includes(String(stop.hotspotId))
            ? "Đã check-in"
            : stop.address,
          latitude: Number(stop.latitude),
          longitude: Number(stop.longitude),
        })),
    [checkedInIds, route.hotspots],
  );

  const [routeCoordinates, setRouteCoordinates] = useState(
    points.map((point) => ({
      latitude: point.latitude,
      longitude: point.longitude,
    })),
  );

  useEffect(() => {
    let cancelled = false;

    async function loadDirections() {
      if (points.length < 2) {
        setRouteCoordinates(
          points.map((point) => ({
            latitude: point.latitude,
            longitude: point.longitude,
          })),
        );
        return;
      }

      try {
        const coordinates = await getMultiStopRouteCoordinates(
          points.map(({ latitude, longitude }) => ({ latitude, longitude })),
        );

        if (!cancelled) setRouteCoordinates(coordinates);
      } catch (error) {
        console.warn("[route-detail] load Goong directions failed", error);
        if (!cancelled) {
          setRouteCoordinates(
            points.map((point) => ({
              latitude: point.latitude,
              longitude: point.longitude,
            })),
          );
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
        colors={["rgba(0,0,0,0.35)", "transparent"]}
        className="absolute inset-x-0 top-0 h-24"
        pointerEvents="none"
      />
      <LinearGradient
        colors={["transparent", "#FCF6F8"]}
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
    <View
      className={`flex-1 rounded-2xl p-2 ${highlight ? "bg-[#FFF2E8]" : "bg-[#F8EEF4]"}`}
    >
      {icon ? <View className="mb-0.5 items-center">{icon}</View> : null}
      <Text
        className={`text-center text-[12px] font-bold leading-tight ${highlight ? "text-[#B86D2A]" : "text-[#2B2233]"}`}
      >
        {label}
      </Text>
      <Text
        className={`text-center text-[9px] ${highlight ? "text-[#B86D2A]/80" : "text-[#8E869A]"}`}
      >
        {hint}
      </Text>
    </View>
  );
}

function Stars({
  activeColor = "#EB489B",
  inactiveColor = "#D4C8DE",
  rating,
  size = 11,
}: {
  activeColor?: string;
  inactiveColor?: string;
  rating: number;
  size?: number;
}) {
  return (
    <View className="flex-row gap-0.5">
      {Array.from({ length: 5 }).map((_, i) => (
        <Text
          key={i}
          style={{
            fontSize: size,
            color: i < rating ? activeColor : inactiveColor,
          }}
        >
          ★
        </Text>
      ))}
    </View>
  );
}

function RouteRatingStars({
  activeTintColor = "#FFC93C",
  inactiveTintColor = "#DFD7E2",
  rating,
  size = 13,
}: {
  activeTintColor?: string;
  inactiveTintColor?: string;
  rating: number;
  size?: number;
}) {
  const roundedRating = Math.round(clampReviewRatingValue(rating));

  return (
    <View className="flex-row items-center gap-1">
      {Array.from({ length: 5 }).map((_, index) => {
        const isFilled = index < roundedRating;

        return (
          <SymbolView
            key={`route-rating-star-${size}-${index}`}
            name={
              isFilled
                ? {
                    ios: "star.fill",
                    android: "star",
                    web: "star",
                  }
                : "star-border"
            }
            size={size}
            tintColor={isFilled ? activeTintColor : inactiveTintColor}
          />
        );
      })}
    </View>
  );
}

function RouteReviewMediaGallery({
  photos,
  reviewId,
}: {
  photos: string[];
  reviewId: string;
}) {
  const [measuredMediaWidth, setMeasuredMediaWidth] = useState(0);
  const hasSingleMedia = photos.length === 1;
  const hasTwoMedia = photos.length === 2;
  const hasThreeMedia = photos.length === 3;
  const mediaContentWidth = Math.max(measuredMediaWidth, 0);
  const previewPhotos = hasSingleMedia ? photos : photos.slice(0, 4);
  const hiddenPhotoCount = Math.max(photos.length - previewPhotos.length, 0);
  const halfWidthMediaItemWidth = Math.max(
    Math.floor((mediaContentWidth - reviewMediaGridGap) / 2),
    0,
  );
  const singleMediaHeight = Math.round(
    mediaContentWidth / singleMediaAspectRatio,
  );
  const twoMediaHeight = Math.round(
    halfWidthMediaItemWidth / twoMediaAspectRatio,
  );
  const gridMediaHeight = Math.round(
    halfWidthMediaItemWidth / gridMediaAspectRatio,
  );
  const threeMediaLeadWidth = Math.max(
    Math.round(mediaContentWidth * 0.56),
    0,
  );
  const threeMediaSideWidth = Math.max(
    mediaContentWidth - threeMediaLeadWidth - reviewMediaGridGap,
    0,
  );
  const threeMediaHeight = Math.round(
    threeMediaLeadWidth / twoMediaAspectRatio,
  );
  const threeMediaStackHeight = Math.max(
    (threeMediaHeight - reviewMediaGridGap) / 2,
    0,
  );

  const renderPhoto = ({
    height,
    overlayLabel,
    photo,
    width,
  }: {
    height: number;
    overlayLabel?: string;
    photo: string;
    width: number | "100%";
  }) => (
    <View
      className="overflow-hidden bg-[#F2EEF2]"
      style={{
        borderRadius: reviewMediaBorderRadius,
        height,
        width,
      }}
    >
      <Image source={photo} contentFit="cover" style={{ height: "100%", width: "100%" }} />
      {overlayLabel ? (
        <View className="absolute inset-0 items-center justify-center bg-black/35">
          <Text className="text-[22px] font-bold text-white">{overlayLabel}</Text>
        </View>
      ) : null}
    </View>
  );

  return (
    <View
      className="mt-1"
      onLayout={(event) => {
        const nextWidth = Math.round(event.nativeEvent.layout.width);

        setMeasuredMediaWidth((currentWidth) =>
          currentWidth === nextWidth ? currentWidth : nextWidth,
        );
      }}
    >
      {mediaContentWidth > 0 ? (
        hasSingleMedia ? (
          renderPhoto({
            height: singleMediaHeight,
            photo: photos[0],
            width: "100%",
          })
        ) : hasTwoMedia ? (
          <View
            className="flex-row"
            style={{ columnGap: reviewMediaGridGap }}
          >
            {photos.map((photo, index) => (
              <View key={`${reviewId}-photo-${index}`}>
                {renderPhoto({
                  height: twoMediaHeight,
                  photo,
                  width: halfWidthMediaItemWidth,
                })}
              </View>
            ))}
          </View>
        ) : hasThreeMedia ? (
          <View
            className="flex-row"
            style={{ columnGap: reviewMediaGridGap }}
          >
            {renderPhoto({
              height: threeMediaHeight,
              photo: photos[0],
              width: threeMediaLeadWidth,
            })}
            <View
              style={{
                rowGap: reviewMediaGridGap,
                width: threeMediaSideWidth,
              }}
            >
              {photos.slice(1).map((photo, index) => (
                <View key={`${reviewId}-photo-stack-${index}`}>
                  {renderPhoto({
                    height: threeMediaStackHeight,
                    photo,
                    width: threeMediaSideWidth,
                  })}
                </View>
              ))}
            </View>
          </View>
        ) : (
          <View
            style={{
              columnGap: reviewMediaGridGap,
              flexDirection: "row",
              flexWrap: "wrap",
              rowGap: reviewMediaGridGap,
            }}
          >
            {previewPhotos.map((photo, index) => (
              <View key={`${reviewId}-photo-grid-${index}`}>
                {renderPhoto({
                  height: gridMediaHeight,
                  overlayLabel:
                    index === previewPhotos.length - 1 && hiddenPhotoCount > 0
                      ? `+${hiddenPhotoCount}`
                      : undefined,
                  photo,
                  width: halfWidthMediaItemWidth,
                })}
              </View>
            ))}
          </View>
        )
      ) : null}
    </View>
  );
}

function RouteReviewCard({
  insets,
  isReviewActionPending,
  review,
  screenHeight,
  screenWidth,
  showDivider = true,
  onDeleteReview,
  onEditReview,
  onPressLikeReview,
}: {
  insets: ReturnType<typeof useSafeAreaInsets>;
  isReviewActionPending: boolean;
  review: RouteReview;
  screenHeight: number;
  screenWidth: number;
  showDivider?: boolean;
  onDeleteReview: (review: HotspotReview) => void;
  onEditReview: (review: HotspotReview) => void;
  onPressLikeReview: (reviewId: number) => void;
}) {
  const [reviewMenuAnchor, setReviewMenuAnchor] = useState<{
    left: number;
    top: number;
  } | null>(null);
  const manageableReview = review.review.isOwner ? review.review : null;
  const reportableReview = review.review;

  const handleOpenReviewMenu = (event: GestureResponderEvent) => {
    if (isReviewActionPending) {
      return;
    }

    const menuWidth = 216;
    const menuHeight = manageableReview ? 104 : 52;
    const viewportInset = 12;
    const pressX = event.nativeEvent.pageX;
    const pressY = event.nativeEvent.pageY;
    const maximumLeft = Math.max(
      viewportInset,
      screenWidth - menuWidth - viewportInset,
    );
    const left = Math.min(
      Math.max(pressX - menuWidth + 18, viewportInset),
      maximumLeft,
    );
    const preferredTop = pressY + 20;
    const maximumTop = screenHeight - insets.bottom - menuHeight - 8;
    const top =
      preferredTop <= maximumTop
        ? preferredTop
        : Math.max(insets.top + 8, pressY - menuHeight - 20);

    setReviewMenuAnchor({ left, top });
  };

  const handleReportReview = () => {
    setReviewMenuAnchor(null);
    Alert.alert(
      "Đã ghi nhận báo cáo",
      "Cảm ơn bạn. Chúng tôi sẽ xem xét bài đánh giá này sớm nhất có thể.",
    );
  };

  return (
    <View className={`py-2 ${showDivider ? "border-b border-[#F0DEE7]" : ""}`}>
      <View className="flex-row items-start">
        <Image
          source={review.avatar}
          contentFit="cover"
          style={{ width: 36, height: 36, borderRadius: 18 }}
        />
        <View className="ml-2 flex-1">
          <View className="flex-row items-center gap-1.5">
            <Text
              className="text-[13px] font-semibold text-[#2B2233]"
              numberOfLines={1}
              style={{ lineHeight: 14 }}
            >
              {review.user}
            </Text>
            {review.levelLabel ? (
              <View className="rounded-full bg-[#FFF0F6] px-1.5 py-0.5">
                <Text className="text-[10px] font-semibold text-[#EB489B]">
                  {review.levelLabel}
                </Text>
              </View>
            ) : null}
          </View>
          <Text
            className="text-[11px] text-[#8A7B83]"
            numberOfLines={1}
            style={{ lineHeight: 12, marginTop: 0 }}
          >
            {review.visitedOn}
          </Text>
        </View>
        {reportableReview ? (
          <Pressable
            accessibilityLabel="Mở tùy chọn bài đánh giá"
            accessibilityRole="button"
            accessibilityState={{ disabled: isReviewActionPending }}
            className="ml-1 h-8 w-8 items-center justify-center rounded-full"
            disabled={isReviewActionPending}
            hitSlop={8}
            onPress={handleOpenReviewMenu}
            style={{ opacity: isReviewActionPending ? 0.5 : 1 }}
          >
            {isReviewActionPending ? (
              <ActivityIndicator color="#8A7B83" size="small" />
            ) : (
              <SymbolView
                name={{
                  ios: "ellipsis",
                  android: "more_horiz",
                  web: "more_horiz",
                }}
                size={19}
                tintColor="#5F5662"
              />
            )}
          </Pressable>
        ) : null}
      </View>

      <Modal
        animationType="fade"
        onRequestClose={() => setReviewMenuAnchor(null)}
        statusBarTranslucent
        transparent
        visible={reviewMenuAnchor !== null}
      >
        <View className="flex-1">
          <Pressable
            accessibilityLabel="Đóng tùy chọn bài đánh giá"
            className="absolute inset-0"
            onPress={() => setReviewMenuAnchor(null)}
          />

          {reviewMenuAnchor ? (
            <View
              className="overflow-hidden border border-[#E7E3E8] bg-white"
              style={[
                cardShadow,
                {
                  borderRadius: 8,
                  left: reviewMenuAnchor.left,
                  position: "absolute",
                  top: reviewMenuAnchor.top,
                  width: 216,
                },
              ]}
            >
              {manageableReview ? (
                <>
                  <Pressable
                    accessibilityRole="button"
                    className="flex-row items-center px-4"
                    onPress={() => {
                      setReviewMenuAnchor(null);
                      onEditReview(manageableReview);
                    }}
                    style={{ height: 52 }}
                  >
                    <SymbolView
                      name={{ ios: "pencil", android: "edit", web: "edit" }}
                      size={19}
                      tintColor="#2B2233"
                    />
                    <Text className="ml-3 flex-1 text-[15px] font-normal text-[#2B2233]">
                      Chỉnh sửa bài đánh giá
                    </Text>
                  </Pressable>

                  <View className="h-px bg-[#ECE8ED]" />

                  <Pressable
                    accessibilityRole="button"
                    className="flex-row items-center px-4"
                    onPress={() => {
                      setReviewMenuAnchor(null);
                      onDeleteReview(manageableReview);
                    }}
                    style={{ height: 52 }}
                  >
                    <SymbolView
                      name={{
                        ios: "trash",
                        android: "delete_outline",
                        web: "delete_outline",
                      }}
                      size={19}
                      tintColor="#C24157"
                    />
                    <Text className="ml-3 flex-1 text-[15px] font-normal text-[#C24157]">
                      Xóa bài đánh giá
                    </Text>
                  </Pressable>
                </>
              ) : null}

              {!manageableReview ? (
                <Pressable
                  accessibilityRole="button"
                  className="flex-row items-center px-4"
                  onPress={handleReportReview}
                  style={{ height: 52 }}
                >
                  <SymbolView
                    name={{
                      ios: "exclamationmark.bubble",
                      android: "report_problem",
                      web: "report_problem",
                    }}
                    size={19}
                    tintColor="#2B2233"
                  />
                  <Text className="ml-3 flex-1 text-[15px] font-semibold text-[#2B2233]">
                    Báo cáo đánh giá vi phạm
                  </Text>
                </Pressable>
              ) : null}
            </View>
          ) : null}
        </View>
      </Modal>

      <View className="mt-0.5">
        <Stars
          activeColor="#F5A524"
          inactiveColor="#E6D9C4"
          rating={review.rating}
          size={11}
        />
      </View>

      <Text
        className="mt-0.5 text-[13px] text-[#3D3446]"
        style={{ lineHeight: 17 }}
      >
        {review.text}
      </Text>

      {review.photos.length ? (
        <RouteReviewMediaGallery
          photos={review.photos}
          reviewId={review.id}
        />
      ) : null}

      <View className="mt-1 flex-row items-center justify-between">
        <Pressable
          accessibilityLabel={review.isLiked ? "Gỡ tim bài đánh giá" : "Thả tim bài đánh giá"}
          accessibilityRole="button"
          accessibilityState={{
            disabled: review.isLikePending,
            selected: review.isLiked,
          }}
          className="flex-row items-center gap-1.5 self-start py-0.5"
          disabled={review.isLikePending}
          hitSlop={8}
          onPress={() => onPressLikeReview(review.reviewId)}
          style={{ opacity: review.isLikePending ? 0.6 : 1 }}
        >
          <SymbolView
            name={
              review.isLiked
                ? { ios: "heart.fill", android: "favorite", web: "favorite" }
                : {
                    ios: "heart",
                    android: "favorite_border",
                    web: "favorite_border",
                  }
            }
            size={20}
            tintColor={review.isLiked ? "#F43F5E" : "#2B2233"}
          />
          <Text
            className="text-[13px] font-semibold"
            style={{
              color: review.isLiked ? "#F43F5E" : "#2B2233",
              lineHeight: 13,
            }}
          >
            {review.helpful}
          </Text>
        </Pressable>
      </View>
    </View>
  );
}

export default function RouteDetailScreen() {
  const { id: routeId } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const session = useAuthSession();
  const insets = useSafeAreaInsets();
  const { height: screenHeight, width: screenWidth } = useWindowDimensions();
  const [route, setRoute] = useState<RouteDto | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [isSavingRoute, setIsSavingRoute] = useState(false);
  const [isStartingRoute, setIsStartingRoute] = useState(false);
  const [isSavedRoute, setIsSavedRoute] = useState(false);
  const [savedRouteId, setSavedRouteId] = useState<number | null>(null);
  const [activeRouteProgress, setActiveRouteProgress] =
    useState<UserRouteProgressDto | null>(null);
  const [relativeTimeNow, setRelativeTimeNow] = useState(() => Date.now());
  const [apiRouteReviews, setApiRouteReviews] = useState<HotspotReview[]>([]);
  const [isRouteReviewsLoading, setIsRouteReviewsLoading] = useState(false);
  const [likingReviewIds, setLikingReviewIds] = useState<number[]>([]);
  const [deletingReviewId, setDeletingReviewId] = useState<number | null>(null);
  const [routeReviewsError, setRouteReviewsError] = useState<string | null>(
    null,
  );
  const [reviewPendingDeletion, setReviewPendingDeletion] =
    useState<HotspotReview | null>(null);
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

      const dragDistance = event.nativeEvent.pageY - touchStartYRef.current;

      // Chỉ kéo xuống mới làm bản đồ lớn hơn.
      // Vuốt lên vẫn được ScrollView xử lý để cuộn nội dung.
      if (dragDistance <= 0) return;

      updateMapHeight(touchStartMapHeightRef.current + dragDistance);
    },
    [updateMapHeight],
  );

  const handleContentTouchEnd = useCallback(() => {
    if (isPullingMapRef.current) {
      const middlePoint =
        collapsedMapHeight + (expandedMapHeight - collapsedMapHeight) * 0.35;

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
          setError("Thiếu mã tuyến.");
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
                  sortBy: "startedAt",
                  sortDirection: "DESC",
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
            const status = `${progress.status ?? ""}`.toUpperCase();
            return (
              sameRoute && (status === "IN_PROGRESS" || status === "COMPLETED")
            );
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
              console.warn(
                "[route-detail] load progress detail failed",
                progressDetailError,
              );
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
          setError(
            loadError instanceof Error
              ? loadError.message
              : "Không thể tải chi tiết tuyến.",
          );
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
  useFocusEffect(
    useCallback(() => {
      setRelativeTimeNow(Date.now());

      const relativeTimeTimer = setInterval(() => {
        setRelativeTimeNow(Date.now());
      }, 30 * 1000);

      return () => {
        clearInterval(relativeTimeTimer);
      };
    }, []),
  );
  useFocusEffect(
    useCallback(() => {
      let cancelled = false;

      async function loadRouteReviews() {
        const normalizedRouteId = Number(routeId);

        if (!Number.isInteger(normalizedRouteId) || normalizedRouteId <= 0) {
          setApiRouteReviews([]);
          setRouteReviewsError(null);
          setIsRouteReviewsLoading(false);
          return;
        }

        setIsRouteReviewsLoading(true);
        setRouteReviewsError(null);

        try {
          const accessToken = session.isAuthenticated
            ? await getValidAccessToken()
            : null;
          const response = await getHotspotReviews({
            accessToken,
            page: 0,
            size: 20,
            targetId: normalizedRouteId,
            targetType: "ROUTE",
            tokenType: session.tokenType,
          });

          if (cancelled) {
            return;
          }

          setApiRouteReviews(response.content);
        } catch (loadReviewsError) {
          if (cancelled) {
            return;
          }

          console.warn("[route-detail] load route reviews failed", loadReviewsError);
          setApiRouteReviews([]);
          setRouteReviewsError(
            loadReviewsError instanceof Error
              ? loadReviewsError.message
              : "Không tải được đánh giá của tuyến.",
          );
        } finally {
          if (!cancelled) {
            setIsRouteReviewsLoading(false);
          }
        }
      }

      void loadRouteReviews();

      return () => {
        cancelled = true;
      };
    }, [routeId, session.isAuthenticated, session.tokenType]),
  );

  const checkedInIdsFromProgress = useMemo(() => {
    return (
      activeRouteProgress?.hotspotProgressList
        ?.filter((item) => item.isCheckedIn)
        .map((item) => String(item.hotspotId)) ?? []
    );
  }, [activeRouteProgress]);
  const routeUserProgressStatus = normalizeRouteUserProgressStatus(
    route?.userProgress,
  );
  const isRouteCompleted = routeUserProgressStatus === "COMPLETED";
  const checkedInIds = useMemo(() => {
    if (isRouteCompleted && route) {
      return Array.from(
        new Set<string>(route.hotspots.map((stop) => String(stop.hotspotId))),
      );
    }

    return Array.from(new Set<string>(checkedInIdsFromProgress));
  }, [checkedInIdsFromProgress, isRouteCompleted, route]);
  const orderedStops = useMemo(
    () => (route ? getOrderedRouteHotspots(route.hotspots) : []),
    [route],
  );
  const hasStartedRoute = Boolean(activeRouteProgress);
  const nextStop = useMemo(() => {
    if (!orderedStops.length) return undefined;
    return (
      orderedStops.find(
        (stop) => !checkedInIds.includes(String(stop.hotspotId)),
      ) ?? orderedStops[0]
    );
  }, [checkedInIds, orderedStops]);
  const routeReviews = useMemo<RouteReview[]>(
    () =>
      apiRouteReviews.map((review) => {
        const createdAtTime = getReviewCreatedAtTime(review);
        return {
          id: `${review.reviewId}`,
          user:
            review.displayName.trim() || review.username.trim() || "Người dùng",
          avatar: review.avatarUrl.trim() || avatarImageUri,
          levelLabel: null,
          isLiked: review.isLiked,
          isLikePending: likingReviewIds.includes(review.reviewId),
          visitedOn: formatReviewDateLabel(createdAtTime, relativeTimeNow),
          rating: Math.round(review.rating),
          review,
          reviewId: review.reviewId,
          text: review.comment.trim(),
          photos: review.medias.slice(0, 3).map((media) => media.url),
          helpful: review.likeCount,
        };
      }),
    [apiRouteReviews, likingReviewIds, relativeTimeNow],
  );
  const filteredReviews = routeReviews;

  if (isLoading) {
    return <AppLoadingScreen message="Đang tải chi tiết tuyến..." />;
  }

  if (!route) {
    return (
      <SafeAreaView className="flex-1 items-center justify-center bg-white">
        <Text className="text-[17px] text-[#8E869A]">
          {error ?? "Tuyến không tồn tại"}
        </Text>
        <Pressable onPress={() => router.back()} className="mt-4">
          <Text className="text-[15px] font-bold text-[#EB489B]">Quay lại</Text>
        </Pressable>
      </SafeAreaView>
    );
  }

  const completed = orderedStops.filter((stop) =>
    checkedInIds.includes(String(stop.hotspotId)),
  ).length;
  const progress =
    orderedStops.length > 0 ? (completed / orderedStops.length) * 100 : 0;
  const totalStops = orderedStops.length;
  const continueHref = nextStop
    ? resolveRouteHotspotHref(nextStop, route.routeId)
    : undefined;
  const routeTheme = route.tags[0]?.tagName || "Di sản";
  const routeAverageRating = clampReviewRatingValue(route.averageRating);
  const routeReviewCountLabel = formatReviewCountLabel(route.totalReviews);
  const routeDistanceLabel = `${route.totalDistance || 0} km`;
  const routeDurationLabel = `${route.estimateTime || 0} phút`;
  const routeDifficultyLabel = getDifficultyLabel(String(route.difficulty));
  const isFinished = isRouteCompleted || (totalStops > 0 && completed >= totalStops);
  const reviewComposeHref =
    `/route/${route.routeId}/review-compose?title=${encodeURIComponent(route.routeName)}` as Href;

  const handleEditRouteReview = (review: HotspotReview) => {
    if (!review.isOwner || deletingReviewId !== null) {
      return;
    }

    cacheHotspotReviewForEdit(review);
    router.push(
      `/route/${route.routeId}/review-compose?title=${encodeURIComponent(route.routeName)}&reviewId=${review.reviewId}` as Href,
    );
  };

  const confirmDeleteRouteReview = async (review: HotspotReview) => {
    if (!review.isOwner || deletingReviewId !== null) {
      return;
    }

    if (!session.isAuthenticated) {
      setReviewPendingDeletion(null);
      Alert.alert("Cần đăng nhập", "Bạn cần đăng nhập để xóa bài đánh giá.");
      return;
    }

    setDeletingReviewId(review.reviewId);

    try {
      const accessToken = await getValidAccessToken();

      if (!accessToken) {
        setReviewPendingDeletion(null);
        Alert.alert(
          "Phiên đăng nhập hết hạn",
          "Vui lòng đăng nhập lại trước khi xóa bài đánh giá.",
        );
        return;
      }

      await deleteReview({
        accessToken,
        reviewId: review.reviewId,
        tokenType: session.tokenType,
      });

      setApiRouteReviews((currentReviews) =>
        currentReviews.filter(
          (currentReview) => currentReview.reviewId !== review.reviewId,
        ),
      );
      setReviewPendingDeletion(null);
      Alert.alert("Đã xóa", "Bài đánh giá đã được xóa.");
    } catch (deleteError) {
      Alert.alert(
        "Không thể xóa bài",
        deleteError instanceof Error
          ? deleteError.message
          : "Đã có lỗi xảy ra khi xóa bài đánh giá.",
      );
    } finally {
      setDeletingReviewId(null);
    }
  };

  const handleDeleteRouteReview = (review: HotspotReview) => {
    setReviewPendingDeletion(review);
  };

  async function handlePressLikeRouteReview(reviewId: number) {
    if (likingReviewIds.includes(reviewId)) {
      return;
    }

    const targetReview = apiRouteReviews.find(
      (review) => review.reviewId === reviewId,
    );

    if (!targetReview) {
      return;
    }

    if (!session.isAuthenticated) {
      Alert.alert(
        "Cần đăng nhập",
        "Bạn cần đăng nhập để thả tim bài đánh giá này.",
      );
      return;
    }

    const accessToken = await getValidAccessToken();

    if (!accessToken) {
      Alert.alert(
        "Phiên đăng nhập hết hạn",
        "Vui lòng đăng nhập lại trước khi thả tim bài đánh giá.",
      );
      return;
    }

    const currentIsLiked = targetReview.isLiked;
    const currentLikeCount = Math.max(0, Math.round(targetReview.likeCount));
    const optimisticIsLiked = !currentIsLiked;
    const optimisticLikeCount = optimisticIsLiked
      ? currentLikeCount + 1
      : Math.max(0, currentLikeCount - 1);

    const applyReviewLikeState = (isLiked: boolean, likeCount: number) => {
      setApiRouteReviews((current) =>
        current.map((review) =>
          review.reviewId === reviewId
            ? { ...review, isLiked, likeCount }
            : review,
        ),
      );
    };

    setLikingReviewIds((current) =>
      current.includes(reviewId) ? current : [...current, reviewId],
    );
    applyReviewLikeState(optimisticIsLiked, optimisticLikeCount);

    try {
      const result = await likeReview({
        accessToken,
        reviewId,
        tokenType: session.tokenType,
      });

      if (result.review) {
        const likedReview = result.review;

        setApiRouteReviews((current) =>
          current.map((review) =>
            review.reviewId === reviewId
              ? { ...review, ...likedReview }
              : review,
          ),
        );
      } else {
        applyReviewLikeState(
          result.isLiked ?? optimisticIsLiked,
          result.likeCount ?? optimisticLikeCount,
        );
      }
    } catch (likeError) {
      applyReviewLikeState(currentIsLiked, currentLikeCount);
      Alert.alert(
        "Không thể thả tim",
        likeError instanceof Error
          ? likeError.message
          : "Đã có lỗi xảy ra khi thả tim bài đánh giá.",
      );
    } finally {
      setLikingReviewIds((current) => current.filter((id) => id !== reviewId));
    }
  }

  async function handleSaveRoute() {
    if (!route || isSavingRoute) return;

    setIsSavingRoute(true);
    try {
      const accessToken = await getValidAccessToken();

      if (isSavedRoute) {
        if (!savedRouteId) {
          throw new Error("Không tìm thấy mã tuyến đã lưu để bỏ lưu.");
        }

        await unSaveRoute({
          accessToken,
          savedRouteId,
          tokenType: session.tokenType,
        });
        setIsSavedRoute(false);
        setSavedRouteId(null);
        routeSystemAlert.alert(
          "Đã bỏ lưu",
          "Tuyến đã được xóa khỏi danh sách đã lưu.",
        );
        return;
      }

      const saved = await saveRoute({
        accessToken,
        routeId: route.routeId,
        tokenType: session.tokenType,
      });

      const nextSavedRouteId =
        typeof saved === "object" && saved !== null && "savedRouteId" in saved
          ? Number(saved.savedRouteId)
          : null;

      setIsSavedRoute(true);
      setSavedRouteId(
        nextSavedRouteId && Number.isFinite(nextSavedRouteId)
          ? nextSavedRouteId
          : null,
      );
      routeSystemAlert.alert(
        "Đã lưu tuyến",
        "Tuyến này đã được thêm vào danh sách đã lưu.",
      );
    } catch (saveError) {
      routeSystemAlert.alert(
        isSavedRoute ? "Không thể bỏ lưu tuyến" : "Không thể lưu tuyến",
        saveError instanceof Error
          ? saveError.message
          : "Vui lòng thử lại sau.",
      );
    } finally {
      setIsSavingRoute(false);
    }
  }

  async function handleStartRoute() {
    if (!route || !continueHref || isStartingRoute || isRouteCompleted) return;

    setIsStartingRoute(true);
    try {
      const accessToken = await getValidAccessToken();
      if (!hasStartedRoute) {
        await startRouteProgress({
          accessToken,
          routeId: route.routeId,
          tokenType: session.tokenType,
        });
      }
      router.push(continueHref);
    } catch (startError) {
      routeSystemAlert.alert(
        "Không thể bắt đầu tuyến",
        startError instanceof Error
          ? startError.message
          : "Vui lòng thử lại sau.",
      );
    } finally {
      setIsStartingRoute(false);
    }
  }

  return (
    <View className="flex-1 bg-[#FCF6F8]">
      <ScrollView
        className="flex-1 bg-[#FCF6F8]"
        contentContainerStyle={{
          paddingBottom: isRouteCompleted
            ? Math.max(insets.bottom + 28, 40)
            : Math.max(insets.bottom + 108, 124),
        }}
        showsVerticalScrollIndicator={false}
        scrollEventThrottle={16}
        bounces={false}
        overScrollMode="never"
        onScroll={(event) => {
          scrollOffsetRef.current = Math.max(
            event.nativeEvent.contentOffset.y,
            0,
          );
        }}
        onTouchStart={handleContentTouchStart}
        onTouchMove={handleContentTouchMove}
        onTouchEnd={handleContentTouchEnd}
        onTouchCancel={handleContentTouchEnd}
      >
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
            edges={["top"]}
            className="absolute inset-x-0 top-0"
            pointerEvents="box-none"
          >
            <View className="flex-row items-center justify-between px-3 pt-2">
              <Pressable
                onPress={() => router.back()}
                className="h-10 w-10 items-center justify-center rounded-full bg-black/30"
              >
                <SymbolView
                  name={{
                    ios: "chevron.left",
                    android: "arrow_back",
                    web: "arrow_back",
                  }}
                  size={18}
                  tintColor="#fff"
                />
              </Pressable>
              <View className="rounded-full bg-black/30 px-3 py-2">
                <Text className="text-[11px] font-bold text-white">
                  {route.status}
                </Text>
              </View>
            </View>
          </SafeAreaView>
        </View>

        <View
          className="relative rounded-t-[30px] bg-[#FCF6F8]"
          style={{
            marginTop: -24,
            minHeight: screenHeight,
            paddingHorizontal: ScreenHorizontalPadding,
            zIndex: 2,
          }}
        >
          <View className="items-center pb-2 pt-1">
            <View className="h-1.5 w-12 rounded-full bg-[#D9DCE5]" />
            <Text className="mt-1 text-[10px] text-[#8E869A]">
              {mapHeight > collapsedMapHeight
                ? "Bản đồ đang được mở rộng"
                : "Kéo xuống để mở rộng bản đồ"}
            </Text>
          </View>

          <View className="pt-5">
            <View className="flex-row items-center gap-2">
              <SymbolView
                name={{
                  ios: "sparkles",
                  android: "auto_awesome",
                  web: "auto_awesome",
                }}
                size={13}
                tintColor="#EB489B"
              />
              <Text
                className="flex-1 text-[13px] font-semibold uppercase tracking-[1px] text-[#D95B8D]"
                numberOfLines={1}
                minimumFontScale={0.85}
              >
                Tuyến chủ đề · {routeTheme}
              </Text>
            </View>
            <Text className="text-[18px] font-semibold leading-[21px] text-[#2B2233]">
              {route.routeName}
            </Text>

            <View className="mt-1 flex-row items-center gap-1.5">
              <Text
                className="text-[13px] font-semibold text-[#3B4454]"
                style={{ includeFontPadding: false, lineHeight: 15 }}
              >
                {routeAverageRating.toFixed(1).replace(".", ",")}
              </Text>

              <RouteRatingStars rating={routeAverageRating} size={13} />

              <Text
                className="text-[13px] text-[#6F657A]"
                style={{ includeFontPadding: false, lineHeight: 15 }}
              >
                ({routeReviewCountLabel})
              </Text>
            </View>

            <View className="mt-2.5 flex-row gap-2">
              <Stat
                icon={
                  <SymbolView
                    name={{
                      ios: "figure.walk",
                      android: "directions_walk",
                      web: "directions_walk",
                    }}
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
                    name={{
                      ios: "clock",
                      android: "schedule",
                      web: "schedule",
                    }}
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
                    name={{
                      ios: "mountain.2",
                      android: "terrain",
                      web: "terrain",
                    }}
                    size={14}
                    tintColor="#8E869A"
                  />
                }
                label={routeDifficultyLabel}
                hint="Độ khó"
              />
              <Stat
                icon={
                  <SymbolView
                    name={{
                      ios: "trophy.fill",
                      android: "emoji_events",
                      web: "emoji_events",
                    }}
                    size={14}
                    tintColor="#8E869A"
                  />
                }
                label={`+${route.xp}`}
                hint="Phần thưởng"
              />
            </View>

            <View className="mt-2.5 flex-row items-center gap-2">
              <XPBar
                value={completed}
                max={totalStops}
                colors={
                  isRouteCompleted
                    ? ["#34D399", "#12B76A"]
                    : ["#FFE566", "#FFB400"]
                }
                trackColor={isRouteCompleted ? "#D1FADF" : "#ECEEF4"}
              />
              <Text className="text-[12px] font-bold text-[#2B2233]">
                {completed}/{totalStops}
              </Text>
            </View>
            <Text className="text-[12px] leading-[13px] text-[#8E869A]">
              Tiến độ {Math.round(progress)}% · check-in theo bất kỳ thứ tự nào
            </Text>
            {isRouteCompleted ? <RouteJoinedCard /> : null}
          </View>

          <View className="mt-3.5 gap-2.5">
            <View className="overflow-hidden rounded-[30px]">
              <LinearGradient
                colors={["#FFF7FA", "#FCEEF4", "#F9E7F0"]}
                start={{ x: 0, y: 0 }}
                end={{ x: 1, y: 1 }}
                className="p-3.5"
              >
                <View className="self-start rounded-full bg-[#F6E5ED] px-3 py-1.5">
                  <View className="flex-row items-center gap-2">
                    <SymbolView
                      name={{
                        ios: "person.2",
                        android: "groups",
                        web: "groups",
                      }}
                      size={12}
                      tintColor="#B94A77"
                    />
                    <Text className="text-[12px] font-extrabold uppercase tracking-wider text-[#8A5570]">
                      Đi cùng nhau
                    </Text>
                  </View>
                </View>

                <Text className="pt-1 text-[14px] leading-[15px] text-[#6F6671]">
                  Chọn một nhóm bạn đã tạo trước đó để gắn với tuyến. Liên kết
                  sẽ được lưu sau khi bạn xác nhận.
                </Text>

                <Pressable
                  className="mt-2 rounded-full bg-[#D95B8D] px-4 py-3"
                  onPress={() => {
                    router.push(
                      `/route/${route.routeId}/group-quest?routeName=${encodeURIComponent(route.routeName)}` as Href,
                    );
                  }}
                >
                  <View className="flex-row items-center justify-center gap-2.5">
                    <SymbolView
                      name={{
                        ios: "person.badge.plus",
                        android: "person_add",
                        web: "person_add",
                      }}
                      size={15}
                      tintColor="#FFFFFF"
                    />
                    <Text className="text-center text-[14px] font-bold text-white">
                      Chọn nhóm để tham gia tuyến
                    </Text>
                  </View>
                </Pressable>
              </LinearGradient>
            </View>

            <View className="mt-0.5 h-px bg-[#F0DEE7]" />
          </View>

          <View className="mt-5">
            <View className="mb-2.5 flex-row justify-end">
              <Pressable
                onPress={() => {
                  const points = orderedStops.flatMap((stop) => {
                    const coordinate = getCoordinate(stop);
                    return coordinate
                      ? [
                          {
                            ...coordinate,
                            title: stop.hotspotName ?? undefined,
                          },
                        ]
                      : [];
                  });

                  void openGoogleMapsMultiStopRoute({
                    points,
                    travelMode: "driving",
                    useCurrentLocationAsOrigin: true,
                  }).catch((error) => {
                    routeSystemAlert.alert(
                      "Không thể mở Google Maps",
                      error instanceof Error
                        ? error.message
                        : "Vui lòng thử lại.",
                    );
                  });
                }}
                className="flex-row items-center gap-1.5 rounded-xl border border-[#E8DCE7] bg-[#FFF7FA] px-3 py-2.5"
              >
                <SymbolView
                  name={{ ios: "map.fill", android: "map", web: "map" }}
                  size={14}
                  tintColor="#1677C8"
                />
                <Text className="text-[12px] font-bold text-[#1677C8]">
                  Mở Google Maps
                </Text>
              </Pressable>
            </View>
            <View className="pl-7 pr-3">
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
                        done ? "bg-[#34C759]" : "bg-[#EB489B]"
                      }`}
                    >
                      {done ? (
                        <SymbolView
                          name={{
                            ios: "checkmark",
                            android: "check",
                            web: "check",
                          }}
                          size={12}
                          tintColor="#fff"
                        />
                      ) : (
                        <Text className="text-[11px] font-bold text-white">
                          {index + 1}
                        </Text>
                      )}
                    </View>
                    <Image
                      source={getStopImage(stop)}
                      contentFit="cover"
                      style={{ width: 64, height: 64, borderRadius: 16 }}
                    />
                    <View className="min-w-0 flex-1">
                      <Text
                        className="text-[14px] font-semibold text-[#2B2233]"
                        numberOfLines={1}
                      >
                        {stop.hotspotName || `Điểm #${stop.hotspotId}`}
                      </Text>
                      <Text
                        className="text-[12px] text-[#8E869A]"
                        numberOfLines={1}
                      >
                        {stop.address}
                      </Text>
                      <View className="mt-1.5 flex-row items-center gap-2">
                        <View className="rounded-full bg-[#F8EEF4] px-2 py-0.5">
                          <Text className="text-[12px] text-[#2B2233]">
                            {formatDistance(
                              getDistanceKm(stop, orderedStops[index + 1]),
                            )}
                          </Text>
                        </View>
                        <Text className="ml-auto text-[12px] font-bold text-[#D95B8D]">
                          +{stop.xp} XP
                        </Text>
                      </View>
                    </View>
                  </Pressable>
                );
              })}
            </View>
          </View>

          <View className="mt-4.5 rounded-[28px] border border-[#F0DEE7] bg-[#FFF8FB] px-4 py-3.5">
            <View className="flex-row items-center gap-2">
              <View className="h-8 w-8 items-center justify-center rounded-xl bg-[#241C2C]">
                <SymbolView
                  name={{
                    ios: "sparkles",
                    android: "auto_awesome",
                    web: "auto_awesome",
                  }}
                  size={14}
                  tintColor="#FFC93C"
                />
              </View>
              <View>
                <Text className="text-[12px] font-bold uppercase tracking-wider text-[#D97A55]">
                  AI Gợi ý
                </Text>
                <Text className="text-[16px] font-semibold leading-[17px] text-[#2B2233]">
                  Tuyến này hợp với bạn 94%
                </Text>
              </View>
            </View>
            <Text className="mt-1 text-[14px] leading-[15px] text-[#3D3446]/80">
              Dựa trên 7 tuyến bạn đã hoàn thành, bạn yêu kiến trúc Pháp thuộc.
              Tuyến này có 3/4 điểm khớp sở thích — và thời tiết sáng mai lý
              tưởng để đi bộ ☀️ 26°C.
            </Text>
          </View>

          <View className="mt-3.5 h-px bg-[#F0DEE7]" />

          <Pressable className="mt-2.5 flex-row items-center justify-between rounded-[18px] border border-[#F3E6D8] bg-[#FFF8F0] px-4 py-3">
            <View className="flex-row items-center gap-2.5">
              <SymbolView
                name={{
                  ios: "arrow.down.circle",
                  android: "download",
                  web: "download",
                }}
                size={16}
                tintColor="#F58752"
              />
              <View>
                <Text className="text-[14px] font-semibold text-[#2B2233]">
                  Tải về để dùng offline
                </Text>
                <Text className="text-[12px] leading-[14px] text-[#8E869A]">
                  Bản đồ + story · 12.4 MB
                </Text>
              </View>
            </View>
            <Text className="text-[12px] font-bold text-[#D97A55]">
              Tải xuống
            </Text>
          </Pressable>

          <View className="mt-5">
              <View className="mb-1.5">
                <Text className="text-[12px] font-extrabold tracking-wider text-[#D95B8D]">
                  {`PHẢN HỒI VỀ TUYẾN (${routeReviewCountLabel})`}
                </Text>
              </View>

            <View className="mt-2.5">
              {routeReviewsError ? (
                <View className="py-3">
                  <Text className="text-[13px] text-[#B94A77]">
                    {routeReviewsError}
                  </Text>
                </View>
              ) : isRouteReviewsLoading ? (
                <View className="py-3">
                  <Text className="text-[13px] text-[#8E869A]">
                    Đang tải đánh giá...
                  </Text>
                </View>
              ) : filteredReviews.length ? (
                filteredReviews.map((review, index) => (
                  <RouteReviewCard
                    key={review.id}
                    insets={insets}
                    isReviewActionPending={review.review.reviewId === deletingReviewId}
                    onDeleteReview={handleDeleteRouteReview}
                    onEditReview={handleEditRouteReview}
                    onPressLikeReview={handlePressLikeRouteReview}
                    review={review}
                    screenHeight={screenHeight}
                    screenWidth={screenWidth}
                    showDivider={index < filteredReviews.length - 1}
                  />
                ))
              ) : (
                <View className="px-4 py-6">
                  <Text className="text-center text-[14px] font-medium text-[#6F6671]">
                    Chưa có đánh giá nào cho tuyến này.
                  </Text>
                </View>
              )}
            </View>

            <View className="mt-4 pt-0.5">
              <View className="flex-row items-center gap-3">
                <Image
                  source={avatarImageUri}
                  contentFit="cover"
                  style={{ width: 44, height: 44, borderRadius: 22 }}
                />
                <Pressable
                  onPress={() => {
                    if (!isFinished) {
                      routeSystemAlert.alert(
                        "Chưa thể đánh giá tuyến",
                        `Bạn còn ${Math.max(totalStops - completed, 0)} điểm check-in để hoàn thành tuyến.`,
                      );
                      return;
                    }

                    router.push(reviewComposeHref);
                  }}
                  className={`flex-1 overflow-hidden rounded-full ${
                    isFinished ? "" : "opacity-70"
                  }`}
                  style={glowShadow}
                >
                  <View
                    className="flex-row items-center justify-center px-5 py-3"
                    style={{
                      backgroundColor: isFinished ? "#D95B8D" : "#EAC6D6",
                    }}
                  >
                    <SymbolView
                      name={{
                        ios: "square.and.pencil",
                        android: "rate_review",
                        web: "rate_review",
                      }}
                      size={16}
                      tintColor="#FFFFFF"
                    />
                    <Text className="ml-2 text-[15px] font-semibold text-white">
                      Chia sẻ bài đánh giá
                    </Text>
                  </View>
                </Pressable>
              </View>

              {!isFinished ? (
                <Text className="mt-2 text-[12px] text-[#8E869A]">
                  {`Hoàn thành thêm ${Math.max(totalStops - completed, 0)} điểm check-in để mở quyền đánh giá tuyến.`}
                </Text>
              ) : null}
            </View>
          </View>
        </View>
      </ScrollView>

      <ReviewDeleteDialog
        isDeleting={
          reviewPendingDeletion !== null &&
          deletingReviewId === reviewPendingDeletion.reviewId
        }
        onCancel={() => setReviewPendingDeletion(null)}
        onConfirm={() => {
          if (reviewPendingDeletion) {
            void confirmDeleteRouteReview(reviewPendingDeletion);
          }
        }}
        visible={reviewPendingDeletion !== null}
      />

      {!isRouteCompleted ? (
        <View
          className="absolute inset-x-0 bottom-0 pt-2"
          style={{
            paddingBottom: Math.max(insets.bottom + 18, 28),
            paddingHorizontal: ScreenHorizontalPadding,
          }}
        >
          <View
            className="flex-row gap-2 rounded-2xl border border-[#F0DEE7] bg-[#FFF8FB]/95 p-2.5"
            style={cardShadow}
          >
            <Pressable
              disabled={isSavingRoute}
              onPress={handleSaveRoute}
              className={`h-12 w-12 items-center justify-center rounded-xl ${isSavedRoute ? "bg-[#FCE7EF]" : "bg-[#F5EDF3]"} ${isSavingRoute ? "opacity-60" : ""}`}
            >
              <SymbolView
                name={{
                  ios: isSavedRoute ? "bookmark.fill" : "bookmark",
                  android: isSavedRoute ? "bookmark" : "bookmark_border",
                  web: isSavedRoute ? "bookmark" : "bookmark_border",
                }}
                size={16}
                tintColor={isSavedRoute ? "#D95B8D" : "#8E869A"}
              />
            </Pressable>
            <Pressable
              disabled={!continueHref || isStartingRoute}
              onPress={handleStartRoute}
              className={`flex-1 overflow-hidden rounded-xl ${continueHref && !isStartingRoute ? "" : "opacity-60"}`}
              style={glowShadow}
            >
              <LinearGradient
                colors={["#D95B8D", "#C8457B"]}
                start={{ x: 0, y: 0 }}
                end={{ x: 1, y: 0 }}
                className="flex-row items-center justify-center gap-2 py-3.5"
              >
                <SymbolView
                  name={{
                    ios: "play.fill",
                    android: "play_arrow",
                    web: "play_arrow",
                  }}
                  size={16}
                  tintColor="#fff"
                />
                <Text className="text-[14px] font-bold text-white">
                  {isStartingRoute
                    ? "Đang bắt đầu..."
                    : hasStartedRoute
                      ? "Tiếp tục hành trình"
                      : "Bắt đầu hành trình"}
                </Text>
              </LinearGradient>
            </Pressable>
          </View>
        </View>
      ) : null}
    </View>
  );
}
