import { SymbolView } from "@/components/ui/symbol-view";
import { Image } from "expo-image";
import * as ImagePicker from "expo-image-picker";
import { type Href, useLocalSearchParams, useRouter } from "expo-router";
import { StatusBar } from "expo-status-bar";
import { useEffect, useState, type ComponentProps } from "react";
import {
  ActivityIndicator,
  Alert,
  Keyboard,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  Text as RNText,
  ScrollView,
  TextInput,
  View,
} from "react-native";
import {
  SafeAreaView,
  useSafeAreaInsets,
} from "react-native-safe-area-context";

import {
  getValidAccessToken,
  useAuthSession,
} from "@/features/auth/hooks/use-auth-session";

import {
  createReview,
  isDuplicateReviewError,
  maxReviewRating,
  minReviewRating,
} from "../api/create-review";
import { getHotspotById } from "../api/get-hotspot-by-id";
import { updateReview } from "../api/review-mutations";
import { ReviewDuplicateDialog } from "../components/review-duplicate-dialog";
import { ReviewSuccessOverlay } from "../components/review-success-overlay";
import { avatarImageUri } from "../data/home-screen.mock";
import { getCachedHotspotDetail } from "../data/hotspot-detail-cache";
import {
  clearCachedHotspotReviewForEdit,
  getCachedHotspotReviewForEdit,
} from "../data/hotspot-review-edit-cache";
import {
  getApiHotspotRouteSlug,
  getHotspotBySlug,
  getHotspotHref,
} from "../data/hotspots";
import { resolveSelectedHotspotId } from "../utils/resolve-selected-hotspot-id";

type TextProps = ComponentProps<typeof RNText>;
type LoadedReviewHotspot = {
  hotspotId: number;
  name: string;
};
type ComposerMediaItem = {
  fileName: string;
  mediaId?: number;
  mimeType: string;
  sizeLabel?: string;
  type: "image" | "video";
  uri: string;
};
type ReviewSuccessState = {
  isPending: boolean;
  mode: "created" | "updated";
};

const detailTextMaxFontSizeMultiplier = 1.05;
const pageHorizontalPadding = 16;
const fieldBorderColor = "#E9EAEE";
const dividerColor = "#F1F1F4";
const accentColor = "#EB489B";
const accentSoftBackgroundColor = "#FFF3F8";
const accentSoftBorderColor = "#FBD3E5";
const primaryTextColor = "#1B1B1F";
const mutedTextColor = "#6B7280";
const subtleTextColor = "#9CA3AF";
const requiredMarkColor = "#E4483C";
const starActiveColor = "#F5A524";
const starInactiveColor = "#F3CE95";
const mediaSoftBackgroundColor = "#FAFAFB";
const mediaSoftBorderColor = "#DCDFE4";
const maxCommentLength = 2000;
const maxMediaCount = 10;
const mediaThumbWidth = 88;
const mediaTileHeight = 104;
const addMediaTileWidth = 96;
const ratingStars = Array.from(
  { length: maxReviewRating - minReviewRating + 1 },
  (_, index) => minReviewRating + index,
);
const ratingLabels: Record<number, string> = {
  1: "Rất không hài lòng",
  2: "Chưa hài lòng",
  3: "Bình thường",
  4: "Hài lòng",
  5: "Tuyệt vời",
};

function Text({
  maxFontSizeMultiplier = detailTextMaxFontSizeMultiplier,
  style,
  ...props
}: TextProps) {
  return (
    <RNText
      maxFontSizeMultiplier={maxFontSizeMultiplier}
      style={[{ includeFontPadding: false }, style]}
      {...props}
    />
  );
}

function getFallbackMediaExtension(
  type: "image" | "video",
  mimeType?: string | null,
) {
  const normalizedMimeType = mimeType?.trim().toLowerCase() ?? "";

  if (normalizedMimeType.includes("png")) {
    return "png";
  }

  if (normalizedMimeType.includes("webp")) {
    return "webp";
  }

  if (normalizedMimeType.includes("heic")) {
    return "heic";
  }

  if (normalizedMimeType.includes("mov")) {
    return "mov";
  }

  if (normalizedMimeType.includes("webm")) {
    return "webm";
  }

  if (normalizedMimeType.includes("mp4")) {
    return "mp4";
  }

  return type === "video" ? "mp4" : "jpg";
}

function buildFallbackFileName(
  type: "image" | "video",
  mimeType?: string | null,
  order = 1,
) {
  const extension = getFallbackMediaExtension(type, mimeType);

  return `hotspot-review-${Date.now()}-${order}.${extension}`;
}

function formatMediaFileSize(fileSize?: number | null) {
  if (typeof fileSize !== "number" || !Number.isFinite(fileSize) || fileSize <= 0) {
    return undefined;
  }

  if (fileSize >= 1024 * 1024) {
    return `${(fileSize / (1024 * 1024)).toFixed(2)} MB`;
  }

  return `${(fileSize / 1024).toFixed(2)} KB`;
}

function resolvePositiveIntegerParam(value?: string | string[]) {
  const normalizedValue = Array.isArray(value) ? value[0] : value;
  const parsedValue = Number(normalizedValue);

  return Number.isInteger(parsedValue) && parsedValue > 0 ? parsedValue : null;
}

function RequiredFieldLabel({ label }: { label: string }) {
  return (
    <Text
      className="text-[14px] font-semibold"
      style={{ color: primaryTextColor, lineHeight: 18 }}
    >
      {`${label} `}
      <Text
        className="text-[14px] font-semibold"
        style={{ color: requiredMarkColor }}
      >
        *
      </Text>
    </Text>
  );
}

function SectionDivider() {
  return <View className="mt-2 h-px" style={{ backgroundColor: dividerColor }} />;
}

function ReviewMediaPreview({
  item,
  onRemove,
}: {
  item: ComposerMediaItem;
  onRemove: () => void;
}) {
  return (
    <View style={{ width: mediaThumbWidth }}>
      <View
        className="overflow-hidden rounded-[12px] bg-[#F2F4F7]"
        style={{ height: mediaTileHeight, width: mediaThumbWidth }}
      >
        <Image
          source={item.uri}
          contentFit="cover"
          transition={120}
          cachePolicy="memory-disk"
          style={{ height: "100%", width: "100%" }}
        />

        {item.type === "video" ? (
          <View className="absolute inset-0 items-center justify-center bg-black/20">
            <View className="h-8 w-8 items-center justify-center rounded-full bg-black/45">
              <SymbolView
                name={{
                  ios: "play.fill",
                  android: "play_arrow",
                  web: "play_arrow",
                }}
                size={16}
                tintColor="#FFFFFF"
              />
            </View>
          </View>
        ) : null}
      </View>

      <Pressable
        accessibilityLabel={`Xoá ${item.fileName}`}
        accessibilityRole="button"
        className="absolute h-6 w-6 items-center justify-center rounded-full"
        hitSlop={8}
        onPress={onRemove}
        style={{
          backgroundColor: mutedTextColor,
          borderColor: "#FFFFFF",
          borderWidth: 1.5,
          right: -6,
          top: -6,
        }}
      >
        <SymbolView
          name={{
            ios: "xmark",
            android: "close",
            web: "close",
          }}
          size={11}
          tintColor="#FFFFFF"
        />
      </Pressable>

    </View>
  );
}

export default function HotspotReviewComposeScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const params = useLocalSearchParams<{
    hotspotId?: string | string[];
    id?: string | string[];
    reviewId?: string | string[];
    routeId?: string | string[];
    slug?: string | string[];
    title?: string | string[];
  }>();
  const authSession = useAuthSession();
  const resolvedSlug = Array.isArray(params.slug)
    ? (params.slug[0] ?? "")
    : (params.slug ?? "");
  const routeHotspotId = resolveSelectedHotspotId({
    hotspotId: params.hotspotId,
    slug: resolvedSlug,
  });
  const resolvedRouteId = resolvePositiveIntegerParam(params.routeId ?? params.id);
  const resolvedReviewId = resolvePositiveIntegerParam(params.reviewId);
  const editingReview =
    resolvedReviewId !== null
      ? getCachedHotspotReviewForEdit(resolvedReviewId)
      : null;
  const isEditMode = resolvedReviewId !== null;
  const isRouteReviewMode = resolvedRouteId !== null;
  const resolvedHotspotId =
    isRouteReviewMode
      ? null
      : routeHotspotId ??
        (editingReview && editingReview.targetId > 0
          ? editingReview.targetId
          : null);
  const routeHotspotTitle = Array.isArray(params.title)
    ? (params.title[0] ?? "")
    : (params.title ?? "");
  const cachedHotspotEntry = getCachedHotspotDetail({
    hotspotId: resolvedHotspotId,
    slug: resolvedSlug,
  });
  const hotspot = cachedHotspotEntry?.hotspot ?? getHotspotBySlug(resolvedSlug);
  const fallbackTargetName = isRouteReviewMode
    ? routeHotspotTitle.trim() ||
      (resolvedRouteId !== null ? `Tuyến #${resolvedRouteId}` : "")
    : hotspot?.title.trim() || routeHotspotTitle.trim() || resolvedSlug.trim() || "";
  const authorDisplayName =
    editingReview?.displayName.trim() ||
    authSession.displayName.trim() ||
    authSession.username?.trim() ||
    "Bạn";
  const composerAvatarUri =
    editingReview?.avatarUrl.trim() || avatarImageUri;
  const initialMediaIds = editingReview?.medias.map((media) => media.mediaId) ?? [];
  const [draftText, setDraftText] = useState(
    () => editingReview?.comment ?? "",
  );
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [rating, setRating] = useState(() => {
    const initialRating = Math.round(editingReview?.rating ?? 0);

    return initialRating >= minReviewRating && initialRating <= maxReviewRating
      ? initialRating
      : 0;
  });
  const [selectedMedia, setSelectedMedia] = useState<ComposerMediaItem[]>(() =>
    editingReview?.medias.map((media, index) => {
      const normalizedMediaType = media.mediaType.trim().toUpperCase();
      const normalizedMimeType = media.mimeType.trim();
      const type =
        normalizedMediaType === "VIDEO" ||
        normalizedMimeType.toLowerCase().startsWith("video/")
          ? ("video" as const)
          : ("image" as const);

      return {
        fileName:
          media.fileName.trim() ||
          buildFallbackFileName(type, normalizedMimeType, index + 1),
        mediaId: media.mediaId,
        mimeType:
          normalizedMimeType ||
          (type === "video" ? "video/mp4" : "image/jpeg"),
        sizeLabel: formatMediaFileSize(media.fileSize),
        type,
        uri: media.url,
      };
    }) ?? [],
  );
  const [loadedHotspot, setLoadedHotspot] = useState<LoadedReviewHotspot | null>(
    null,
  );
  const [reviewSuccessState, setReviewSuccessState] =
    useState<ReviewSuccessState | null>(null);
  const [isDuplicateDialogVisible, setIsDuplicateDialogVisible] =
    useState(false);
  const trimmedDraftText = draftText.trim();
  const resolvedTargetId = isRouteReviewMode ? resolvedRouteId : resolvedHotspotId;
  const reviewTargetType = isRouteReviewMode ? "ROUTE" : "HOTSPOT";
  const hotspotDetailSlug =
    resolvedSlug.trim() ||
    (resolvedHotspotId !== null ? getApiHotspotRouteSlug(resolvedHotspotId) : "");
  const targetDetailHref = isRouteReviewMode
    ? (`/route/${resolvedRouteId}` as Href)
    : hotspotDetailSlug
      ? getHotspotHref(hotspotDetailSlug, resolvedHotspotId)
      : null;
  const targetLabelPrefix = isRouteReviewMode ? "Tuyến đường" : "Địa điểm";
  // Tên hotspot chỉ dùng khi payload đã tải khớp với hotspot đang đánh giá.
  const remoteHotspot =
    loadedHotspot?.hotspotId === resolvedHotspotId ? loadedHotspot : null;
  const isHotspotNameLoading =
    !isRouteReviewMode && resolvedHotspotId !== null && remoteHotspot === null;
  const resolvedHotspotName = remoteHotspot?.name || fallbackTargetName;
  const locationLabel =
    resolvedHotspotName ||
    (isHotspotNameLoading
      ? `Đang tải tên ${isRouteReviewMode ? "tuyến" : "địa điểm"}...`
      : `Chưa xác định ${isRouteReviewMode ? "tuyến" : "địa điểm"}`);
  useEffect(() => {
    if (isRouteReviewMode || resolvedHotspotId === null) {
      return;
    }

    let isActive = true;

    async function loadHotspotName(hotspotId: number) {
      try {
        const accessToken = authSession.isAuthenticated
          ? await getValidAccessToken()
          : null;
        const nextHotspot = await getHotspotById({
          accessToken,
          hotspotId,
          tokenType: authSession.tokenType,
        });

        if (!isActive) {
          return;
        }

        setLoadedHotspot({
          hotspotId,
          name: nextHotspot.hotspotName.trim(),
        });
      } catch (error) {
        console.warn("[reviews] load review hotspot name failed", {
          error: error instanceof Error ? error.message : error,
          hotspotId,
        });

        if (!isActive) {
          return;
        }

        // Đánh dấu đã tải xong để hàng địa điểm rơi về tên trong cache.
        setLoadedHotspot({ hotspotId, name: "" });
      }
    }

    void loadHotspotName(resolvedHotspotId);

    return () => {
      isActive = false;
    };
  }, [
    authSession.isAuthenticated,
    authSession.tokenType,
    isRouteReviewMode,
    resolvedHotspotId,
  ]);

  const handleOpenHotspotDetail = () => {
    if (!targetDetailHref) {
      Alert.alert(
        `${targetLabelPrefix} đánh giá`,
        `Không xác định được ${isRouteReviewMode ? "tuyến" : "hotspot"} để mở trang chi tiết.`,
      );
      return;
    }

    router.push(targetDetailHref);
  };

  const handleLeaveComposer = () => {
    setReviewSuccessState(null);

    if (router.canGoBack()) {
      router.back();
      return;
    }

    if (targetDetailHref) {
      router.replace(targetDetailHref);
      return;
    }

    router.replace("/home");
  };

  const handleContinueExplore = () => {
    setReviewSuccessState(null);
    router.replace("/explore");
  };

  const handleEditExistingReview = () => {
    setIsDuplicateDialogVisible(false);
    handleLeaveComposer();
  };

  const handlePickMedia = async () => {
    if (selectedMedia.length >= maxMediaCount) {
      Alert.alert(
        "Đã đủ media",
        `Bạn có thể thêm tối đa ${maxMediaCount} ảnh hoặc video.`,
      );
      return;
    }

    const permissionResult =
      await ImagePicker.requestMediaLibraryPermissionsAsync();

    if (!permissionResult.granted) {
      Alert.alert(
        "Cần cấp quyền",
        "Hãy cho phép truy cập thư viện để thêm ảnh và video vào bài đánh giá.",
      );
      return;
    }

    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ["images", "videos"],
      quality: 0.85,
    });

    if (result.canceled) {
      return;
    }

    const asset = result.assets[0];

    if (!asset?.uri) {
      return;
    }

    setSelectedMedia((current) => [
      ...current,
      {
        fileName:
          asset.fileName?.trim() ||
          buildFallbackFileName(
            asset.type === "video" ? "video" : "image",
            asset.mimeType,
            current.length + 1,
          ),
        mimeType:
          asset.mimeType?.trim() ||
          (asset.type === "video" ? "video/mp4" : "image/jpeg"),
        sizeLabel: formatMediaFileSize(asset.fileSize),
        type: asset.type === "video" ? "video" : "image",
        uri: asset.uri,
      },
    ]);
  };

  const handleSubmit = async () => {
    if (!authSession.isAuthenticated) {
      Alert.alert(
        "Cần đăng nhập",
        `Bạn cần đăng nhập để ${isEditMode ? "chỉnh sửa" : "đăng"} bài đánh giá.`,
      );
      return;
    }

    if (isEditMode && (!editingReview || !editingReview.isOwner)) {
      Alert.alert(
        "Không thể chỉnh sửa",
        "Không tìm thấy dữ liệu bài đánh giá của bạn. Hãy quay lại và mở lại menu chỉnh sửa.",
      );
      return;
    }

    if (resolvedTargetId === null) {
      Alert.alert(
        `Thiếu ${isRouteReviewMode ? "tuyến" : "hotspot"}`,
        `Không xác định được ${isRouteReviewMode ? "tuyến" : "hotspot"} hiện tại để gắn vào bài đánh giá.`,
      );
      return;
    }

    if (rating < minReviewRating) {
      Alert.alert(
        "Thiếu số sao",
        "Hãy chọn số sao đánh giá trước khi gửi bài.",
      );
      return;
    }

    if (!trimmedDraftText) {
      Alert.alert(
        "Thiếu cảm nhận",
        "Hãy chia sẻ cảm nhận của bạn trước khi gửi bài đánh giá.",
      );
      return;
    }

    const accessToken = await getValidAccessToken();

    if (!accessToken) {
      Alert.alert(
        "Phiên đăng nhập hết hạn",
        "Vui lòng đăng nhập lại trước khi đăng bài đánh giá.",
      );
      return;
    }

    setIsSubmitting(true);

    try {
      if (isEditMode && editingReview && resolvedReviewId !== null) {
        const selectedExistingMediaIds = new Set(
          selectedMedia
            .map((media) => media.mediaId)
            .filter((mediaId): mediaId is number => mediaId !== undefined),
        );

        await updateReview({
          accessToken,
          comment: draftText,
          files: selectedMedia
            .filter((media) => media.mediaId === undefined)
            .map((media) => ({
              fileName: media.fileName,
              mimeType: media.mimeType,
              uri: media.uri,
            })),
          rating,
          removedMediaIds: initialMediaIds.filter(
            (mediaId) => !selectedExistingMediaIds.has(mediaId),
          ),
          reviewId: resolvedReviewId,
          tokenType: authSession.tokenType,
        });

        clearCachedHotspotReviewForEdit(resolvedReviewId);
        Keyboard.dismiss();
        setReviewSuccessState({
          isPending: false,
          mode: "updated",
        });
        return;
      }

      const createdReview = await createReview({
        accessToken,
        comment: draftText,
        files: selectedMedia.map((media) => ({
          fileName: media.fileName,
          mimeType: media.mimeType,
          uri: media.uri,
        })),
        rating,
        targetId: resolvedTargetId,
        targetType: reviewTargetType,
        tokenType: authSession.tokenType,
      });

      Keyboard.dismiss();
      setReviewSuccessState({
        isPending:
          (createdReview.status.trim() || "APPROVED").toUpperCase() ===
          "PENDING",
        mode: "created",
      });
    } catch (error) {
      if (isDuplicateReviewError(error)) {
        setIsDuplicateDialogVisible(true);
        return;
      }

      Alert.alert(
        isEditMode ? "Không thể cập nhật" : "Không thể đăng bài",
        error instanceof Error
          ? error.message
          : `Đã có lỗi xảy ra khi ${
              isEditMode ? "cập nhật" : "gửi"
            } bài đánh giá.`,
      );
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <View className="flex-1 bg-white">
      <StatusBar style="dark" />

      <SafeAreaView className="flex-1 bg-white" edges={["top", "left", "right"]}>
        <KeyboardAvoidingView
          behavior={Platform.OS === "ios" ? "padding" : "height"}
          className="flex-1"
          keyboardVerticalOffset={0}
        >
          <View className="flex-row items-center bg-white px-3 py-2.5">
            <Pressable
              accessibilityLabel="Quay lại"
              accessibilityRole="button"
              className="h-10 w-14 items-start justify-center"
              hitSlop={8}
              onPress={() => router.back()}
            >
              <SymbolView
                name={{
                  ios: "chevron.left",
                  android: "chevron_left",
                  web: "chevron_left",
                }}
                size={24}
                tintColor={primaryTextColor}
              />
            </Pressable>

            <Text
              className="flex-1 text-center text-[17px] font-bold"
              numberOfLines={1}
              style={{ color: primaryTextColor }}
            >
              {isEditMode ? "Chỉnh sửa bài đánh giá" : "Viết bài đánh giá"}
            </Text>

            <Pressable
              accessibilityLabel={
                isEditMode ? "Lưu bài đánh giá" : "Đăng bài đánh giá"
              }
              accessibilityRole="button"
              accessibilityState={{ disabled: isSubmitting }}
              className="h-10 w-14 items-end justify-center"
              disabled={isSubmitting}
              hitSlop={8}
              onPress={() => {
                void handleSubmit();
              }}
            >
              {isSubmitting ? (
                <ActivityIndicator color={accentColor} size="small" />
              ) : (
                <Text
                  className="text-[16px] font-bold"
                  style={{ color: accentColor }}
                >
                  {isEditMode ? "Lưu" : "Đăng"}
                </Text>
              )}
            </Pressable>
          </View>

          <ScrollView
            className="flex-1 bg-white"
            contentContainerStyle={{
              paddingBottom: Math.max(insets.bottom + 20, 28),
              paddingHorizontal: pageHorizontalPadding,
              paddingTop: 8,
            }}
            keyboardShouldPersistTaps="handled"
            showsVerticalScrollIndicator={false}
          >
            <View className="flex-row items-center">
              <Image
                source={composerAvatarUri}
                contentFit="cover"
                transition={120}
                cachePolicy="memory-disk"
                style={{ height: 44, width: 44, borderRadius: 22 }}
              />

              <View className="ml-2.5 flex-1">
                <Text
                  className="text-[15px] font-bold"
                  numberOfLines={1}
                  style={{ color: primaryTextColor, lineHeight: 16 }}
                >
                  {authorDisplayName}
                </Text>

                <Pressable
                  accessibilityLabel={`Mở chi tiết ${locationLabel}`}
                  accessibilityRole="link"
                  className="flex-row items-center"
                  hitSlop={6}
                  onPress={handleOpenHotspotDetail}
                  style={{ marginTop: -4 }}
                >
                  <SymbolView
                    name={{
                      ios: isRouteReviewMode
                        ? "map"
                        : "mappin.and.ellipse",
                      android: isRouteReviewMode ? "map" : "location_on",
                      web: isRouteReviewMode ? "map" : "location_on",
                    }}
                    size={14}
                    tintColor={accentColor}
                  />
                  <Text
                    className="ml-1 flex-1 text-[13px] font-medium"
                    numberOfLines={1}
                    style={{ color: accentColor, lineHeight: 15 }}
                  >
                    {locationLabel}
                  </Text>
                </Pressable>
              </View>
            </View>

            <SectionDivider />

            <View className="mt-2">
              <RequiredFieldLabel label="Đánh giá của bạn" />
            </View>

            <View className="mt-1 flex-row items-center">
              {ratingStars.map((star) => (
                <Pressable
                  key={`review-rating-${star}`}
                  accessibilityLabel={`Chấm ${star} sao`}
                  accessibilityRole="button"
                  accessibilityState={{ selected: rating === star }}
                  hitSlop={6}
                  onPress={() => setRating(star)}
                  style={{ paddingRight: 5 }}
                >
                  <SymbolView
                    name={
                      star <= rating
                        ? {
                            ios: "star.fill",
                            android: "star",
                            web: "star",
                          }
                        : {
                            ios: "star",
                            android: "star_border",
                            web: "star_border",
                          }
                    }
                    size={26}
                    tintColor={star <= rating ? starActiveColor : starInactiveColor}
                  />
                </Pressable>
              ))}

              {rating >= minReviewRating ? (
                <Text
                  className="ml-1.5 text-[13px]"
                  style={{ color: mutedTextColor, lineHeight: 17 }}
                >
                  <Text
                    className="text-[13px] font-semibold"
                    style={{ color: primaryTextColor }}
                  >
                    {rating.toFixed(1)}
                  </Text>
                  {` (${ratingLabels[rating] ?? ""})`}
                </Text>
              ) : (
                <Text
                  className="ml-1.5 text-[13px]"
                  style={{ color: subtleTextColor, lineHeight: 17 }}
                >
                  Chạm để chấm sao
                </Text>
              )}
            </View>

            <SectionDivider />

            <View className="mt-2 flex-row items-center justify-between">
              <RequiredFieldLabel label="Chia sẻ cảm nhận của bạn" />
              <Text
                className="text-[12px]"
                style={{ color: subtleTextColor, lineHeight: 16 }}
              >
                {`${draftText.length}/${maxCommentLength}`}
              </Text>
            </View>

            <View
              className="mt-1 rounded-[12px] border bg-white px-3 py-2"
              style={{ borderColor: fieldBorderColor }}
            >
              <TextInput
                multiline
                maxLength={maxCommentLength}
                onChangeText={setDraftText}
                placeholderTextColor={subtleTextColor}
                style={{
                  color: primaryTextColor,
                  fontSize: 14,
                  lineHeight: 18,
                  minHeight: 108,
                  padding: 0,
                  textAlignVertical: "top",
                }}
                placeholder={
                  isRouteReviewMode
                    ? "Điều gì làm bạn ấn tượng nhất ở tuyến đường này?"
                    : "Điều gì làm bạn ấn tượng nhất ở hotspot này?"
                }
                value={draftText}
              />
            </View>

            <Text
              className="mt-4 text-[14px] font-semibold"
              style={{ color: primaryTextColor, lineHeight: 18 }}
            >
              {`Ảnh / Video (${selectedMedia.length}/${maxMediaCount})`}
            </Text>

            <View className="mt-1 flex-row flex-wrap items-start gap-2">
              {selectedMedia.map((media, index) => (
                <ReviewMediaPreview
                  key={`${media.uri}-${index}`}
                  item={media}
                  onRemove={() =>
                    setSelectedMedia((current) =>
                      current.filter(
                        (_, currentIndex) => currentIndex !== index,
                      ),
                    )
                  }
                />
              ))}

              {selectedMedia.length < maxMediaCount ? (
                <Pressable
                  accessibilityLabel="Thêm ảnh hoặc video"
                  accessibilityRole="button"
                  className="items-center justify-center rounded-[12px] border border-dashed px-2"
                  onPress={() => {
                    void handlePickMedia();
                  }}
                  style={{
                    backgroundColor: mediaSoftBackgroundColor,
                    borderColor: mediaSoftBorderColor,
                    height: mediaTileHeight,
                    width: addMediaTileWidth,
                  }}
                >
                  <SymbolView
                    name={{
                      ios: "photo.badge.plus",
                      android: "add_photo_alternate",
                      web: "add_photo_alternate",
                    }}
                    size={24}
                    tintColor={mutedTextColor}
                  />
                  <Text
                    className="mt-2 text-center text-[11px] font-medium"
                    style={{ color: mutedTextColor, lineHeight: 14 }}
                  >
                    Thêm ảnh / video
                  </Text>
                </Pressable>
              ) : null}
            </View>

            <SectionDivider />

            <View
              className="mt-2 flex-row items-start rounded-[14px] border px-3 py-2"
              style={{
                backgroundColor: accentSoftBackgroundColor,
                borderColor: accentSoftBorderColor,
              }}
            >
              <SymbolView
                name={{
                  ios: "info.circle",
                  android: "info_outline",
                  web: "info_outline",
                }}
                size={17}
                tintColor={accentColor}
              />

              <View className="ml-2 flex-1">
                <Text
                  className="text-[13px] font-bold"
                  style={{ color: primaryTextColor, lineHeight: 16 }}
                >
                  Mẹo viết bài:
                </Text>
                <Text
                  className="text-[12px]"
                  style={{ color: mutedTextColor, lineHeight: 16, marginTop: -4 }}
                >
                  Chia sẻ trải nghiệm thật chi tiết sẽ giúp ích cho cộng đồng
                  khám phá! ❤️
                </Text>
              </View>
            </View>
          </ScrollView>
        </KeyboardAvoidingView>
      </SafeAreaView>

      {isDuplicateDialogVisible ? (
        <ReviewDuplicateDialog
          onClose={() => setIsDuplicateDialogVisible(false)}
          onEditReview={handleEditExistingReview}
        />
      ) : null}

      {reviewSuccessState !== null ? (
        <ReviewSuccessOverlay
          avatarUri={composerAvatarUri}
          isPending={reviewSuccessState.isPending}
          mode={reviewSuccessState.mode}
          onClose={handleLeaveComposer}
          onContinueExplore={handleContinueExplore}
          onViewPost={handleLeaveComposer}
        />
      ) : null}
    </View>
  );
}
