import { SymbolView } from "@/components/ui/symbol-view";
import { Image } from "expo-image";
import * as ImagePicker from "expo-image-picker";
import { LinearGradient } from "expo-linear-gradient";
import { useLocalSearchParams, useRouter } from "expo-router";
import { StatusBar } from "expo-status-bar";
import { useState, type ComponentProps } from "react";
import {
  Alert,
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
  getCreatedPostRewardMessage,
  isCreatedPostApproved,
  isCreatedPostPending,
} from "@/features/home/lib/created-post-feedback";
import { cacheProfilePost } from "@/features/profile/data/profile-post-cache";
import { mapCreatedPostToProfilePost } from "@/features/profile/lib/map-created-post-to-profile-post";

import { createPost, type PostVisibility } from "../api/create-post";
import { avatarImageUri } from "../data/home-screen.mock";
import { getCachedHotspotDetail } from "../data/hotspot-detail-cache";
import { getHotspotBySlug } from "../data/hotspots";
import { resolveSelectedHotspotId } from "../utils/resolve-selected-hotspot-id";

type TextProps = ComponentProps<typeof RNText>;
type ComposerMediaItem = {
  durationLabel?: string;
  fileName: string;
  mimeType: string;
  type: "image" | "video";
  uri: string;
};

const detailTextMaxFontSizeMultiplier = 1.05;
const loginGradientColors = ["#EB489B", "#F58752", "#FFC93C"] as const;
const detailContentHorizontalPadding = 23;
const sectionMutedTextColor = "#7A6F67";
const sectionBodyTextColor = "#6F657A";
const publishVisibility: PostVisibility = "PUBLIC";
const submitFooterInset = 118;
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

function ReviewMediaPreview({
  item,
  onRemove,
}: {
  item: ComposerMediaItem;
  onRemove: () => void;
}) {
  return (
    <View
      className="overflow-hidden rounded-[22px]"
      style={[cardShadowStyle, { height: 116, width: "31.5%" }]}
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
          <View className="h-10 w-10 items-center justify-center rounded-full bg-black/35">
            <SymbolView
              name={{
                ios: "play.fill",
                android: "play_arrow",
                web: "play_arrow",
              }}
              size={18}
              tintColor="#FFFFFF"
            />
          </View>
        </View>
      ) : null}

      <Pressable
        className="absolute right-2 top-2 h-7 w-7 items-center justify-center rounded-full bg-black/60"
        onPress={onRemove}
      >
        <SymbolView
          name={{
            ios: "xmark",
            android: "close",
            web: "close",
          }}
          size={14}
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
    slug?: string | string[];
    title?: string | string[];
  }>();
  const authSession = useAuthSession();
  const resolvedSlug = Array.isArray(params.slug)
    ? (params.slug[0] ?? "")
    : (params.slug ?? "");
  const resolvedHotspotId = resolveSelectedHotspotId({
    hotspotId: params.hotspotId,
    slug: resolvedSlug,
  });
  const routeHotspotTitle = Array.isArray(params.title)
    ? (params.title[0] ?? "")
    : (params.title ?? "");
  const cachedHotspotEntry = getCachedHotspotDetail({
    hotspotId: resolvedHotspotId,
    slug: resolvedSlug,
  });
  const hotspot = cachedHotspotEntry?.hotspot ?? getHotspotBySlug(resolvedSlug);
  const resolvedHotspotTitle =
    hotspot?.title.trim() ||
    routeHotspotTitle.trim() ||
    resolvedSlug.trim() ||
    "Bài đánh giá mới";
  const authorDisplayName =
    authSession.displayName.trim() || authSession.username?.trim() || "Bạn";
  const [draftText, setDraftText] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [selectedMedia, setSelectedMedia] = useState<ComposerMediaItem[]>([]);
  const submitDisabledReason = !authSession.isAuthenticated
    ? "Đăng nhập để đăng bài đánh giá."
    : resolvedHotspotId === null
      ? "Không xác định được hotspot để gắn bài viết."
      : !draftText.trim()
        ? "Nhập nội dung đánh giá để bật nút đăng bài."
        : null;
  const isSubmitDisabled =
    submitDisabledReason !== null ||
    isSubmitting;

  const handlePickMedia = async () => {
    if (selectedMedia.length >= 6) {
      Alert.alert("Đã đủ media", "Bạn có thể thêm tối đa 6 ảnh hoặc video.");
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
        durationLabel: asset.type === "video" ? "Video" : undefined,
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
        type: asset.type === "video" ? "video" : "image",
        uri: asset.uri,
      },
    ]);
  };

  const handleSubmit = async () => {
    if (!authSession.isAuthenticated) {
      Alert.alert(
        "Cần đăng nhập",
        "Bạn cần đăng nhập để đăng bài đánh giá lên hệ thống.",
      );
      return;
    }

    if (resolvedHotspotId === null) {
      Alert.alert(
        "Thiếu hotspot",
        "Không xác định được hotspot hiện tại để gắn vào bài viết.",
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
      const createdPost = await createPost({
        accessToken,
        content: draftText,
        files: selectedMedia.map((media) => ({
          fileName: media.fileName,
          mimeType: media.mimeType,
          uri: media.uri,
        })),
        hotspotIds: [resolvedHotspotId],
        tokenType: authSession.tokenType,
        visibility: publishVisibility,
      });
      cacheProfilePost(mapCreatedPostToProfilePost(createdPost));
      const rewardMessage = getCreatedPostRewardMessage(createdPost);
      const successMessage = isCreatedPostPending(createdPost)
        ? "Bài viết đã được gửi lên hệ thống và hiện chỉ hiển thị trong hồ sơ của bạn để chờ duyệt."
        : isCreatedPostApproved(createdPost)
          ? "Bài viết đã được duyệt và có thể xuất hiện ở hotspot tương ứng."
          : "Bài viết đã được gửi lên hệ thống và được lưu trong hồ sơ của bạn.";

      Alert.alert(
        "Đăng bài thành công",
        rewardMessage ? `${successMessage} ${rewardMessage}` : successMessage,
        [
          {
            text: "OK",
            onPress: () => router.back(),
          },
        ],
      );
    } catch (error) {
      Alert.alert(
        "Không thể đăng bài",
        error instanceof Error
          ? error.message
          : "Đã có lỗi xảy ra khi gửi bài viết.",
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
        <View
          className="flex-row items-center justify-between py-3"
          style={{ paddingHorizontal: detailContentHorizontalPadding }}
        >
          <Pressable
            className="h-11 w-11 items-center justify-center rounded-full bg-[#F7EFF6]"
            hitSlop={8}
            onPress={() => router.back()}
          >
            <SymbolView
              name={{
                ios: "chevron.left",
                android: "arrow_back",
                web: "arrow_back",
              }}
              size={19}
              tintColor="#2F242C"
            />
          </Pressable>

          <View className="flex-1 items-center px-3">
            <Text className="text-center text-[16px] font-semibold text-[#2B2233]">
              Chia sẻ bài đánh giá
            </Text>
            <Text
              className="mt-0.5 text-center text-[12px] font-semibold"
              style={{ color: sectionMutedTextColor, lineHeight: 14 }}
            >
              Công khai
            </Text>
          </View>

          <View className="h-11 w-11" />
        </View>

        <ScrollView
          contentContainerStyle={{
            paddingBottom: Math.max(insets.bottom + submitFooterInset, 144),
            paddingHorizontal: detailContentHorizontalPadding,
            paddingTop: 2,
          }}
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}
        >
          <View>
            <View className="mt-1 flex-row items-center">
              <Image
                source={avatarImageUri}
                contentFit="cover"
                transition={120}
                cachePolicy="memory-disk"
                style={{ height: 44, width: 44, borderRadius: 22 }}
              />
              <View className="ml-3 flex-1">
                <Text className="text-[15px] font-semibold text-[#2B2233]">
                  {authorDisplayName}
                </Text>
                <Text
                  className="mt-1 text-[12px] font-semibold uppercase tracking-[1px]"
                  style={{ color: sectionMutedTextColor, lineHeight: 14 }}
                >
                  Người chia sẻ
                </Text>
              </View>
            </View>

            <Text
              className="mt-3 text-[22px] font-semibold text-[#2B2233]"
              style={{ lineHeight: 24 }}
            >
              {resolvedHotspotTitle}
            </Text>
            <Text
              className="mt-0.5 text-[15px]"
              style={{ color: sectionBodyTextColor, lineHeight: 19 }}
            >
              Thêm ảnh, video và ghi lại cảm nhận ngắn của bạn sau khi tham
              quan.
            </Text>

            <View
              className="mt-3 rounded-[24px] border border-[#F1E4EC] bg-[#FFF9FD] px-4 py-4"
              style={cardShadowStyle}
            >
              <TextInput
                multiline
                maxLength={320}
                onChangeText={setDraftText}
                placeholder="Điều gì làm bạn ấn tượng nhất ở hotspot này?"
                placeholderTextColor="#AA9AAA"
                style={{
                  color: "#2F242C",
                  fontSize: 15,
                  lineHeight: 22,
                  minHeight: 148,
                  padding: 0,
                  textAlignVertical: "top",
                }}
                value={draftText}
              />
            </View>

            <View className="mt-1.5 items-end">
              <Text className="text-[12px] font-medium text-[#A897B2]">
                {`${draftText.trim().length}/320 ký tự`}
              </Text>
            </View>

            <View className="mt-3 flex-row items-center justify-between">
              <Text
                className="text-[14px] font-black uppercase tracking-[1.4px]"
                style={{ color: sectionMutedTextColor, lineHeight: 18 }}
              >
                Phương tiện
              </Text>
              <Text className="text-[12px] font-medium text-[#A897B2]">
                {`${selectedMedia.length}/6 media`}
              </Text>
            </View>

            <View
              className="mt-2 rounded-[24px] border border-dashed border-[#D9D4DD] bg-[#FAF7FB] px-4 py-4"
              style={{ minHeight: 172 }}
            >
              {selectedMedia.length > 0 ? (
                <View className="flex-row flex-wrap gap-3">
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
                </View>
              ) : (
                <View className="flex-1 items-center justify-center px-5">
                  <View className="h-14 w-14 items-center justify-center rounded-full bg-[#F7EFF6]">
                    <SymbolView
                      name={{
                        ios: "photo.on.rectangle.angled",
                        android: "image",
                        web: "image",
                      }}
                      size={22}
                      tintColor="#8A7B83"
                    />
                  </View>
                  <Text
                    className="mt-3 text-center text-[15px] text-[#6F657A]"
                    style={{ lineHeight: 19 }}
                  >
                    Chưa có ảnh hoặc video nào được chọn.
                  </Text>
                </View>
              )}
            </View>

            <Pressable
              className="mt-3 overflow-hidden rounded-full"
              onPress={handlePickMedia}
              style={buttonShadowStyle}
            >
              <View
                className="flex-row items-center justify-center px-5 py-3.5"
                style={{ backgroundColor: "#D8F2F9" }}
              >
                <SymbolView
                  name={{
                    ios: "plus",
                    android: "add",
                    web: "add",
                  }}
                  size={18}
                  tintColor="#2A6B80"
                />
                <Text className="ml-2 text-[15px] font-semibold text-[#2A6B80]">
                  Thêm ảnh và video
                </Text>
              </View>
            </Pressable>
          </View>
        </ScrollView>

        <View
          className="absolute inset-x-0 bottom-0 bg-white px-5"
          style={{
            elevation: 12,
            paddingBottom: Math.max(insets.bottom + 10, 16),
            paddingTop: 8,
            shadowColor: "rgba(43, 34, 51, 0.08)",
            shadowOffset: { width: 0, height: -4 },
            shadowOpacity: 1,
            shadowRadius: 12,
            zIndex: 20,
          }}
        >
          {submitDisabledReason ? (
            <Text
              className="mb-2 text-center text-[12px]"
              style={{ color: sectionMutedTextColor, lineHeight: 16 }}
            >
              {submitDisabledReason}
            </Text>
          ) : null}
          <Pressable
            className="overflow-hidden rounded-full"
            disabled={isSubmitDisabled}
            onPress={() => {
              void handleSubmit();
            }}
            style={buttonShadowStyle}
          >
            <LinearGradient
              colors={
                isSubmitDisabled
                  ? ["#E3DDEB", "#D9D1E4", "#CEC5DD"]
                  : loginGradientColors
              }
              end={{ x: 1, y: 0.5 }}
              locations={[0, 0.58, 1]}
              start={{ x: 0, y: 0.5 }}
              className="items-center px-5 py-3.5"
              style={{ opacity: isSubmitDisabled ? 0.96 : 1 }}
            >
              <Text className="text-[17px] font-black text-white">
                {isSubmitting ? "Đang gửi bài..." : "Đăng bài đánh giá"}
              </Text>
            </LinearGradient>
          </Pressable>
        </View>
        </KeyboardAvoidingView>
      </SafeAreaView>
    </View>
  );
}
