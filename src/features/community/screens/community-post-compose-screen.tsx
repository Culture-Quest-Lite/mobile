import { SymbolView } from "@/components/ui/symbol-view";
import {
  getValidAccessToken,
  useAuthSession,
} from "@/features/auth/hooks/use-auth-session";
import {
  createPost,
  type CreatedPostResponse,
  type PostVisibility,
} from "@/features/home/api/create-post";
import {
  getCreatedPostRewardMessage,
  isCreatedPostApproved,
  isCreatedPostPending,
} from "@/features/home/lib/created-post-feedback";
import { cacheProfilePost } from "@/features/profile/data/profile-post-cache";
import { mapCreatedPostToProfilePost } from "@/features/profile/lib/map-created-post-to-profile-post";
import { getMyProfile } from "@/features/profile/api/get-me";
import { Image } from "expo-image";
import * as ImagePicker from "expo-image-picker";
import { LinearGradient } from "expo-linear-gradient";
import { type Href, useFocusEffect, useRouter } from "expo-router";
import { StatusBar } from "expo-status-bar";
import { useCallback, useEffect, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  Text,
  TextInput,
  View,
} from "react-native";
import {
  SafeAreaView,
  useSafeAreaInsets,
} from "react-native-safe-area-context";

import { getPostVisibilityLabel } from "@/lib/post-visibility";
import { getCommunityPostVisibility } from "../data/community-post-visibility-store";
import {
  cacheCommunityPost,
  type CommunityFeedMediaItem,
  type CommunityFeedPost,
} from "../data/community-post-cache";
type ComposerIdentity = {
  accountKey: string | null;
  avatarUri: string | null;
  displayName: string;
  username: string | null;
};
type ComposerMediaItem = {
  fileName: string;
  mimeType: string;
  type: "image" | "video";
  uri: string;
};

const maxPostLength = 320;
const maxMediaCount = 6;
const gradientColors = ["#EB489B", "#F58752", "#FFC93C"] as const;
const avatarFallbackColors = ["#EB489B", "#F58752"] as const;
const chipBorderColor = "#E7E5EA";
const footerActionHeight = 46;
const pageHorizontalPadding = 16;
const footerShadowStyle = {
  elevation: 14,
  shadowColor: "rgba(24, 24, 27, 0.12)",
  shadowOffset: { width: 0, height: -6 },
  shadowOpacity: 1,
  shadowRadius: 16,
} as const;
const cardShadowStyle = {
  elevation: 6,
  shadowColor: "rgba(24, 24, 27, 0.08)",
  shadowOffset: { width: 0, height: 8 },
  shadowOpacity: 1,
  shadowRadius: 16,
} as const;
const avatarPalettes = [
  ["#EB489B", "#F58752"],
  ["#F58752", "#FFC93C"],
  ["#4F46E5", "#38BDF8"],
  ["#10B981", "#2DD4BF"],
  ["#9333EA", "#EC4899"],
] as const;

function readMeaningfulText(value?: string | null) {
  if (typeof value !== "string") {
    return null;
  }

  const trimmedValue = value.trim();

  if (!trimmedValue) {
    return null;
  }

  return ["string", "null", "undefined"].includes(trimmedValue.toLowerCase())
    ? null
    : trimmedValue;
}

function getNameInitials(name: string) {
  const tokens = name.trim().split(/\s+/).filter(Boolean);

  if (tokens.length === 0) {
    return "CQ";
  }

  if (tokens.length === 1) {
    return tokens[0].slice(0, 2).toUpperCase();
  }

  return `${tokens[0][0] ?? ""}${tokens.at(-1)?.[0] ?? ""}`.toUpperCase();
}

function getAvatarPalette(seed: string) {
  const paletteIndex =
    Array.from(seed).reduce((total, char) => total + char.charCodeAt(0), 0) %
    avatarPalettes.length;

  return avatarPalettes[paletteIndex] as readonly [string, string];
}

function formatCompactCount(value?: number | null) {
  const resolvedValue =
    typeof value === "number" && Number.isFinite(value)
      ? Math.max(0, Math.round(value))
      : 0;

  if (resolvedValue < 1000) {
    return `${resolvedValue}`;
  }

  const formattedValue = resolvedValue / 1000;

  return `${formattedValue >= 10 ? formattedValue.toFixed(0) : formattedValue.toFixed(1)}k`;
}

function buildComposerIdentityFromSession(
  isAuthenticated: boolean,
  displayName: string,
  username: string | null,
): ComposerIdentity {
  const normalizedDisplayName = readMeaningfulText(displayName);
  const normalizedUsername =
    readMeaningfulText(username)?.replace(/^@/, "") ?? null;
  const accountKey =
    normalizedUsername ??
    normalizedDisplayName ??
    (isAuthenticated ? "authenticated-user" : null);

  return {
    accountKey,
    avatarUri: null,
    displayName: isAuthenticated
      ? (normalizedDisplayName ?? normalizedUsername ?? "Bạn")
      : "Khách",
    username: normalizedUsername,
  };
}

function buildComposerIdentityFromProfile(
  response: Awaited<ReturnType<typeof getMyProfile>>,
  fallbackIdentity: ComposerIdentity,
): ComposerIdentity {
  const normalizedDisplayName = readMeaningfulText(response.name);
  const normalizedUsername =
    readMeaningfulText(response.username)?.replace(/^@/, "") ?? null;

  return {
    accountKey: fallbackIdentity.accountKey,
    avatarUri: readMeaningfulText(response.avatar),
    displayName:
      normalizedDisplayName ??
      normalizedUsername ??
      fallbackIdentity.displayName,
    username: normalizedUsername ?? fallbackIdentity.username,
  };
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

  return `community-post-${Date.now()}-${order}.${extension}`;
}

function mapCreatedPostToCommunityFeedPost(
  createdPost: CreatedPostResponse,
): CommunityFeedPost {
  const author =
    readMeaningfulText(createdPost.displayName) ??
    readMeaningfulText(createdPost.username) ??
    "Người dùng";
  const tags = createdPost.tags
    .map((tag) => readMeaningfulText(tag.tagName))
    .filter((tag): tag is string => Boolean(tag))
    .slice(0, 4);
  const mediaItems: CommunityFeedMediaItem[] = createdPost.medias
    .filter(
      (media) =>
        media.mediaType.trim().toUpperCase() === "IMAGE" &&
        Boolean(readMeaningfulText(media.fileUrl)),
    )
    .map((media) => ({
      key: `${createdPost.postId}-media-${media.mediaId}`,
      source: {
        uri: media.fileUrl,
      },
    }));
  const firstMediaItem = mediaItems[0] ?? null;
  const statusLabel =
    readMeaningfulText(createdPost.status)?.toUpperCase() === "PENDING"
      ? "Đang chờ duyệt"
      : "Cập nhật mới từ cộng đồng";
  const visibilityValue = readMeaningfulText(createdPost.visibility) ?? "PUBLIC";

  return {
    id: `newsfeed-post-${createdPost.postId}`,
    authorId: `${createdPost.userId}`,
    author,
    initials: getNameInitials(author),
    role: readMeaningfulText(createdPost.username)
      ? `@${createdPost.username.trim()}`
      : "Explorer community",
    time: "Vừa xong",
    caption:
      readMeaningfulText(createdPost.content) ?? "Bài viết mới từ cộng đồng.",
    location: "",
    mood: `${statusLabel} · ${getPostVisibilityLabel(visibilityValue)}`,
    badge: "Newsfeed",
    hotScore: "0",
    views: formatCompactCount(createdPost.pointRemaining),
    likes: formatCompactCount(createdPost.likeCount),
    comments: formatCompactCount(createdPost.commentCount),
    replies: "0",
    shares: formatCompactCount(createdPost.shareCount),
    topic: "culture",
    isFollowing: false,
    tags,
    image: firstMediaItem?.source ?? null,
    hotspotIds: createdPost.hotspotIds,
    commentCountValue: createdPost.commentCount,
    isLiked: createdPost.isLiked,
    likeCountValue: createdPost.likeCount,
    mediaItems,
    postNumericId: createdPost.postId,
    replyCountValue: 0,
    shareCountValue: createdPost.shareCount,
    avatarColors: getAvatarPalette(`${author}-${createdPost.userId}`),
    canComment: true,
    canLike: true,
    canOpenProfile: false,
    visibility: visibilityValue,
  };
}

function AvatarMonogram({
  initials,
  size,
}: {
  initials: string;
  size: number;
}) {
  return (
    <LinearGradient
      colors={avatarFallbackColors}
      end={{ x: 1, y: 0.5 }}
      start={{ x: 0, y: 0.5 }}
      style={{
        alignItems: "center",
        borderRadius: size / 2,
        height: size,
        justifyContent: "center",
        width: size,
      }}
    >
      <Text
        className="font-black text-white"
        style={{ fontSize: Math.max(16, size * 0.34) }}
      >
        {initials}
      </Text>
    </LinearGradient>
  );
}

function ComposerAvatar({
  displayName,
  uri,
}: {
  displayName: string;
  uri: string | null;
}) {
  const [failedUri, setFailedUri] = useState<string | null>(null);
  const hasError = !uri || failedUri === uri;

  if (hasError) {
    return <AvatarMonogram initials={getNameInitials(displayName)} size={48} />;
  }

  return (
    <Image
      source={{ uri }}
      contentFit="cover"
      transition={120}
      style={{ borderRadius: 24, height: 48, width: 48 }}
      onError={() => {
        setFailedUri(uri);
      }}
    />
  );
}

function MediaPreviewCard({
  item,
  onRemove,
}: {
  item: ComposerMediaItem;
  onRemove: () => void;
}) {
  return (
    <View
      className="overflow-hidden rounded-[22px] bg-[#F4F4F5]"
      style={[cardShadowStyle, { height: 112, width: "31.5%" }]}
    >
      <Image
        source={item.uri}
        contentFit="cover"
        transition={120}
        style={{ height: "100%", width: "100%" }}
      />

      {item.type === "video" ? (
        <View className="absolute inset-0 items-center justify-center bg-black/20">
          <View className="h-10 w-10 items-center justify-center rounded-full bg-black/45">
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
        hitSlop={6}
        onPress={onRemove}
      >
        <SymbolView
          name={{
            ios: "xmark",
            android: "close",
            web: "close",
          }}
          size={13}
          tintColor="#FFFFFF"
        />
      </Pressable>
    </View>
  );
}

export default function CommunityPostComposeScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const authSession = useAuthSession();
  const fallbackComposerIdentity = buildComposerIdentityFromSession(
    authSession.isAuthenticated,
    authSession.displayName,
    authSession.username,
  );
  const [composerIdentity, setComposerIdentity] = useState<ComposerIdentity>(
    fallbackComposerIdentity,
  );
  const [draftText, setDraftText] = useState("");
  const [selectedMedia, setSelectedMedia] = useState<ComposerMediaItem[]>([]);
  const [postVisibility, setPostVisibility] = useState<PostVisibility>(() =>
    getCommunityPostVisibility(),
  );
  const [isSubmitting, setIsSubmitting] = useState(false);
  const resolvedComposerIdentity =
    composerIdentity.accountKey === fallbackComposerIdentity.accountKey
      ? composerIdentity
      : fallbackComposerIdentity;
  const trimmedDraftText = draftText.trim();
  const visibilityLabel = getPostVisibilityLabel(postVisibility);
  const submitDisabledReason = !authSession.isAuthenticated
    ? "Đăng nhập để đăng bài viết cộng đồng."
    : !trimmedDraftText
      ? "Nhập nội dung để bật nút đăng."
      : null;
  const isSubmitDisabled = submitDisabledReason !== null || isSubmitting;

  useFocusEffect(
    useCallback(() => {
      setPostVisibility(getCommunityPostVisibility());
    }, []),
  );

  useEffect(() => {
    let isActive = true;

    async function loadComposerIdentity() {
      if (!authSession.isAuthenticated) {
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

        setComposerIdentity(
          buildComposerIdentityFromProfile(profile, fallbackComposerIdentity),
        );
      } catch (error) {
        console.warn("[community] load post composer identity failed", {
          error: error instanceof Error ? error.message : error,
        });

        if (!isActive) {
          return;
        }

        setComposerIdentity(fallbackComposerIdentity);
      }
    }

    void loadComposerIdentity();

    return () => {
      isActive = false;
    };
  }, [
    authSession.isAuthenticated,
    authSession.tokenType,
    fallbackComposerIdentity,
  ]);

  async function handlePickMedia() {
    if (selectedMedia.length >= maxMediaCount) {
      Alert.alert(
        "Đã đủ ảnh/video",
        `Bạn có thể thêm tối đa ${maxMediaCount} tệp.`,
      );
      return;
    }

    const permissionResult =
      await ImagePicker.requestMediaLibraryPermissionsAsync();

    if (!permissionResult.granted) {
      Alert.alert(
        "Cần cấp quyền",
        "Hãy cho phép truy cập thư viện để thêm ảnh hoặc video vào bài viết.",
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
        type: asset.type === "video" ? "video" : "image",
        uri: asset.uri,
      },
    ]);
  }

  async function handleSubmit() {
    if (!authSession.isAuthenticated) {
      Alert.alert(
        "Cần đăng nhập",
        "Bạn cần đăng nhập để đăng bài viết cộng đồng.",
      );
      return;
    }

    const accessToken = await getValidAccessToken();

    if (!accessToken) {
      Alert.alert(
        "Phiên đăng nhập hết hạn",
        "Vui lòng đăng nhập lại trước khi đăng bài viết cộng đồng.",
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
        hotspotIds: [],
        tokenType: authSession.tokenType,
        visibility: postVisibility,
      });
      const createdPostStatus = readMeaningfulText(createdPost.status)?.toUpperCase() ?? "";
      const createdPostVisibility =
        readMeaningfulText(createdPost.visibility)?.toUpperCase() ?? "PUBLIC";
      const shouldAppearInCommunityFeed =
        createdPostVisibility === "PUBLIC" && createdPostStatus === "APPROVED";

      cacheProfilePost(mapCreatedPostToProfilePost(createdPost));

      if (shouldAppearInCommunityFeed) {
        cacheCommunityPost(mapCreatedPostToCommunityFeedPost(createdPost));
      }

      const rewardMessage = getCreatedPostRewardMessage(createdPost);
      const successMessage = isCreatedPostPending(createdPost)
        ? "Bài viết đã được gửi và hiện chỉ xuất hiện trong hồ sơ của bạn để chờ duyệt."
        : createdPostVisibility !== "PUBLIC"
          ? "Bài viết đã được lưu trong hồ sơ của bạn."
          : isCreatedPostApproved(createdPost) && shouldAppearInCommunityFeed
            ? "Bài viết đã được duyệt và xuất hiện trên cộng đồng."
            : "Bài viết đã được lưu trong hồ sơ của bạn.";

      Alert.alert(
        "Đăng bài thành công",
        rewardMessage ? `${successMessage} ${rewardMessage}` : successMessage,
        [
          {
            text: "OK",
            onPress: () => {
              router.back();
            },
          },
        ],
      );
    } catch (error) {
      Alert.alert(
        "Không thể đăng bài",
        error instanceof Error
          ? error.message
          : "Đã có lỗi xảy ra khi gửi bài viết cộng đồng.",
      );
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <View className="flex-1 bg-white">
      <StatusBar style="dark" />

      <SafeAreaView
        className="flex-1 bg-white"
        edges={["top", "left", "right"]}
      >
        <KeyboardAvoidingView
          behavior={Platform.OS === "ios" ? "padding" : "height"}
          className="flex-1"
          keyboardVerticalOffset={0}
        >
          <View className="flex-row items-center justify-between border-b border-[#F2F4F7] px-4 py-3">
            <Pressable
              className="h-11 w-11 items-center justify-center rounded-full"
              hitSlop={8}
              onPress={() => {
                router.back();
              }}
            >
              <SymbolView
                name={{
                  ios: "xmark",
                  android: "close",
                  web: "close",
                }}
                size={22}
                tintColor="#111827"
              />
            </Pressable>

            <Text className="text-[18px] font-extrabold text-[#111827]">
              Bài viết mới
            </Text>

            <View className="h-11 w-11 items-center justify-center rounded-full">
              <SymbolView
                name={{
                  ios: "ellipsis",
                  android: "more_horiz",
                  web: "more_horiz",
                }}
                size={20}
                tintColor="#111827"
              />
            </View>
          </View>

          <ScrollView
            contentContainerStyle={{
              paddingBottom: Math.max(insets.bottom + 120, 168),
              paddingHorizontal: pageHorizontalPadding,
              paddingTop: 14,
            }}
            keyboardShouldPersistTaps="handled"
            showsVerticalScrollIndicator={false}
          >
            <View className="flex-row items-center">
              <ComposerAvatar
                displayName={resolvedComposerIdentity.displayName}
                uri={resolvedComposerIdentity.avatarUri}
              />

              <View className="ml-3 flex-1">
                <Text className="text-[16px] font-black text-[#111827]">
                  {resolvedComposerIdentity.displayName}
                </Text>
              </View>
            </View>

            <View className="mt-5 min-h-[280px]">
              <TextInput
                multiline
                maxLength={maxPostLength}
                onChangeText={setDraftText}
                placeholder="Bạn đang nghĩ gì?"
                placeholderTextColor="#6B7280"
                style={{
                  color: "#111827",
                  fontSize: 18,
                  lineHeight: 28,
                  minHeight: 220,
                  padding: 0,
                  textAlignVertical: "top",
                }}
                value={draftText}
              />

              {selectedMedia.length > 0 ? (
                <View className="mt-5 flex-row flex-wrap gap-3">
                  {selectedMedia.map((media, index) => (
                    <MediaPreviewCard
                      key={`${media.uri}-${index}`}
                      item={media}
                      onRemove={() => {
                        setSelectedMedia((current) =>
                          current.filter(
                            (_, currentIndex) => currentIndex !== index,
                          ),
                        );
                      }}
                    />
                  ))}
                </View>
              ) : null}
            </View>
          </ScrollView>

          <View
            className="absolute inset-x-0 bottom-0 border-t border-[#F2F4F7] bg-white px-4 pt-3"
            style={[
              footerShadowStyle,
              {
                paddingBottom: Math.max(insets.bottom + 10, 16),
              },
            ]}
          >
            <View className="flex-row items-center justify-between gap-3">
              <Pressable
                className="flex-1 flex-row items-center justify-center rounded-[15px] border bg-white px-4"
                onPress={() => {
                  void handlePickMedia();
                }}
                style={{
                  borderColor: chipBorderColor,
                  height: footerActionHeight,
                }}
              >
                <SymbolView
                  name={{
                    ios: "photo.on.rectangle.angled",
                    android: "image",
                    web: "image",
                  }}
                  size={18}
                  tintColor="#111827"
                />
                <Text className="ml-2 text-[14px] font-semibold text-[#111827]">
                  Thư viện
                </Text>
              </Pressable>

              <Pressable
                className="flex-row items-center rounded-[15px] border bg-[#F9FAFB] px-3.5"
                onPress={() => {
                  router.push("/community/post-visibility" as Href);
                }}
                style={{
                  borderColor: chipBorderColor,
                  height: footerActionHeight,
                }}
              >
                <Text
                  className="text-[14px] font-semibold text-[#111827]"
                  numberOfLines={1}
                >
                  {visibilityLabel}
                </Text>
                <SymbolView
                  name={{
                    ios: "chevron.down",
                    android: "keyboard_arrow_down",
                    web: "keyboard_arrow_down",
                  }}
                  size={18}
                  tintColor="#6B7280"
                />
              </Pressable>

              <Pressable
                className="overflow-hidden rounded-[15px]"
                disabled={isSubmitDisabled}
                onPress={() => {
                  void handleSubmit();
                }}
              >
                <LinearGradient
                  colors={
                    isSubmitDisabled ? ["#E5E7EB", "#E5E7EB"] : gradientColors
                  }
                  end={{ x: 1, y: 0.5 }}
                  start={{ x: 0, y: 0.5 }}
                  style={{
                    height: footerActionHeight,
                    justifyContent: "center",
                    minWidth: 92,
                    opacity: isSubmitDisabled ? 0.88 : 1,
                    paddingHorizontal: 20,
                  }}
                >
                  <View className="items-center justify-center">
                    {isSubmitting ? (
                      <ActivityIndicator color="#FFFFFF" size="small" />
                    ) : (
                      <Text className="text-[16px] font-black text-white">
                        Đăng
                      </Text>
                    )}
                  </View>
                </LinearGradient>
              </Pressable>
            </View>

            <View className="mt-2 flex-row items-center justify-between">
              <Text className="text-[12px] font-medium text-[#9CA3AF]">
                {submitDisabledReason ?? `Quyền riêng tư hiện tại: ${visibilityLabel}.`}
              </Text>
              <Text className="text-[12px] font-medium text-[#9CA3AF]">
                {`${trimmedDraftText.length}/${maxPostLength}`}
              </Text>
            </View>
          </View>
        </KeyboardAvoidingView>
      </SafeAreaView>
    </View>
  );
}
