import { Image } from "expo-image";
import { useFocusEffect, useLocalSearchParams, useRouter } from "expo-router";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  Keyboard,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  Text,
  TextInput,
  View,
} from "react-native";
import { SafeAreaView, useSafeAreaInsets } from "react-native-safe-area-context";

import { SymbolView } from "@/components/ui/symbol-view";
import {
  getValidAccessToken,
  useAuthSession,
} from "@/features/auth/hooks/use-auth-session";
import { commentPost } from "@/features/home/api/comment-post";
import {
  getPostComments,
  type PostComment,
} from "@/features/home/api/get-post-comments";
import {
  cacheCommunityPost,
  getCachedCommunityPost,
  updateCachedCommunityPost,
  type CommunityFeedMediaItem,
  type CommunityFeedPost,
} from "../data/community-post-cache";

const socialCardShadowStyle = {
  shadowColor: "rgba(15, 23, 42, 0.08)",
  shadowOpacity: 1,
  shadowRadius: 18,
  shadowOffset: {
    width: 0,
    height: 10,
  },
  elevation: 6,
} as const;

const communityCommentMaxLength = 320;
const communityPostCommentsPageSize = 10;

type CommunityCommentsStatus = "idle" | "loading" | "ready" | "error";

const meaninglessTextValues = new Set(["", "string", "null", "undefined"]);
const avatarPalettes = [
  ["#1D4ED8", "#60A5FA"],
  ["#0F766E", "#2DD4BF"],
  ["#CA8A04", "#FBBF24"],
  ["#DC2626", "#FB7185"],
  ["#7C3AED", "#C084FC"],
] as const;

function readMeaningfulText(value?: string | null) {
  if (typeof value !== "string") {
    return null;
  }

  const trimmedValue = value.trim();

  if (!trimmedValue) {
    return null;
  }

  return meaninglessTextValues.has(trimmedValue.toLowerCase())
    ? null
    : trimmedValue;
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

  return `${formattedValue >= 10 ? formattedValue.toFixed(0) : formattedValue.toFixed(1)}K`;
}

function formatCommunityTime(isoTimestamp?: string | null) {
  const meaningfulValue = readMeaningfulText(isoTimestamp);

  if (!meaningfulValue) {
    return "Vừa xong";
  }

  const parsedDate = new Date(meaningfulValue);
  const parsedTime = parsedDate.getTime();

  if (Number.isNaN(parsedTime)) {
    return meaningfulValue;
  }

  const elapsedMilliseconds = Date.now() - parsedTime;

  if (elapsedMilliseconds < 60 * 1000) {
    return "Vừa xong";
  }

  const elapsedMinutes = Math.floor(elapsedMilliseconds / (60 * 1000));

  if (elapsedMinutes < 60) {
    return `${elapsedMinutes} phút`;
  }

  const elapsedHours = Math.floor(elapsedMinutes / 60);

  if (elapsedHours < 24) {
    return `${elapsedHours} giờ`;
  }

  const elapsedDays = Math.floor(elapsedHours / 24);

  if (elapsedDays < 7) {
    return `${elapsedDays} ngày`;
  }

  return `${parsedDate.getDate().toString().padStart(2, "0")}/${(parsedDate.getMonth() + 1)
    .toString()
    .padStart(2, "0")}/${parsedDate.getFullYear()}`;
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

function buildPostMediaItems(post: CommunityFeedPost) {
  if (Array.isArray(post.mediaItems) && post.mediaItems.length > 0) {
    return post.mediaItems;
  }

  if (post.image) {
    return [
      {
        key: `${post.id}-fallback-image`,
        source: post.image,
      } satisfies CommunityFeedMediaItem,
    ];
  }

  return [];
}

function getCommentDisplayName(item: PostComment) {
  return (
    readMeaningfulText(item.displayName) ??
    readMeaningfulText(item.username) ??
    "Người dùng"
  );
}

function replaceCommunityPostCommentCount(post: CommunityFeedPost, commentCount: number) {
  const normalizedCommentCount = Math.max(0, Math.round(commentCount));

  return {
    ...post,
    commentCountValue: normalizedCommentCount,
    comments: formatCompactCount(normalizedCommentCount),
  };
}

function replaceCommunityPostStats(
  post: CommunityFeedPost,
  {
    commentCount,
    likeCount,
    replyCount,
    shareCount,
  }: {
    commentCount?: number | null;
    likeCount?: number | null;
    replyCount?: number | null;
    shareCount?: number | null;
  },
) {
  let nextPost = post;

  if (typeof likeCount === "number" && Number.isFinite(likeCount)) {
    const normalizedLikeCount = Math.max(0, Math.round(likeCount));
    nextPost = {
      ...nextPost,
      likeCountValue: normalizedLikeCount,
      likes: formatCompactCount(normalizedLikeCount),
    };
  }

  if (typeof commentCount === "number" && Number.isFinite(commentCount)) {
    nextPost = replaceCommunityPostCommentCount(nextPost, commentCount);
  }

  if (typeof replyCount === "number" && Number.isFinite(replyCount)) {
    const normalizedReplyCount = Math.max(0, Math.round(replyCount));
    nextPost = {
      ...nextPost,
      replies: formatCompactCount(normalizedReplyCount),
      replyCountValue: normalizedReplyCount,
    };
  }

  if (typeof shareCount === "number" && Number.isFinite(shareCount)) {
    const normalizedShareCount = Math.max(0, Math.round(shareCount));
    nextPost = {
      ...nextPost,
      shares: formatCompactCount(normalizedShareCount),
      shareCountValue: normalizedShareCount,
    };
  }

  return nextPost;
}

function AvatarMonogram({
  colors,
  initials,
  size,
}: {
  colors: readonly [string, string];
  initials: string;
  size: number;
}) {
  return (
    <View
      style={{
        alignItems: "center",
        borderRadius: size / 2,
        height: size,
        justifyContent: "center",
        overflow: "hidden",
        width: size,
      }}
    >
      <View
        style={{
          backgroundColor: colors[0],
          height: size,
          position: "absolute",
          width: size,
        }}
      />
      <View
        style={{
          backgroundColor: colors[1],
          borderRadius: size / 2,
          height: size * 0.72,
          opacity: 0.82,
          position: "absolute",
          right: -(size * 0.1),
          top: -(size * 0.12),
          width: size * 0.72,
        }}
      />
      <Text
        className="font-black text-white"
        style={{ fontSize: Math.max(14, size * 0.34) }}
      >
        {initials}
      </Text>
    </View>
  );
}

function SocialCountChip({
  icon,
  value,
}: {
  icon: {
    android: string;
    ios: string;
    web: string;
  };
  value: string;
}) {
  return (
    <View className="flex-row items-center">
      <SymbolView name={icon} size={16} tintColor="#6B7280" />
      <Text
        className="ml-1 text-[13px] font-semibold text-[#4B5563]"
        style={{ includeFontPadding: false, lineHeight: 14 }}
      >
        {value}
      </Text>
    </View>
  );
}

function SocialPostMediaGallery({ items }: { items: CommunityFeedMediaItem[] }) {
  if (items.length === 0) {
    return null;
  }

  if (items.length === 1) {
    return (
      <View className="overflow-hidden bg-[#EEF2F7]">
        <Image
          source={items[0].source}
          contentFit="cover"
          style={{ height: 360, width: "100%" }}
        />
      </View>
    );
  }

  const previewItems = items.slice(0, 4);
  const hiddenCount = Math.max(items.length - previewItems.length, 0);

  return (
    <View className="flex-row flex-wrap bg-[#EEF2F7]" style={{ gap: 2 }}>
      {previewItems.map((item, index) => {
        const isWideSingle =
          previewItems.length === 3 && index === 0;
        const shouldShowOverlay =
          index === previewItems.length - 1 && hiddenCount > 0;
        const itemWidth =
          previewItems.length === 3 && index > 0 ? "49.7%" : "49.7%";
        const itemHeight = isWideSingle ? 272 : 180;

        return (
          <View
            key={item.key}
            style={{
              height: itemHeight,
              overflow: "hidden",
              position: "relative",
              width: previewItems.length === 3 && index === 0 ? "100%" : itemWidth,
            }}
          >
            <Image
              source={item.source}
              contentFit="cover"
              style={{ height: "100%", width: "100%" }}
            />
            {shouldShowOverlay ? (
              <View className="absolute inset-0 items-center justify-center bg-[#111827]/48">
                <Text className="text-[32px] font-black text-white">{`+${hiddenCount}`}</Text>
              </View>
            ) : null}
          </View>
        );
      })}
    </View>
  );
}

function CommunityCommentItem({
  item,
  onReply,
  replyCount,
  showReplyingState = false,
}: {
  item: PostComment;
  onReply: (item: PostComment) => void;
  replyCount: number;
  showReplyingState?: boolean;
}) {
  const displayName = getCommentDisplayName(item);
  const palette = getAvatarPalette(`${displayName}-${item.userId}`);

  return (
    <View className="flex-row items-start gap-2.5">
      <AvatarMonogram
        colors={palette}
        initials={getNameInitials(displayName)}
        size={36}
      />

      <View className="flex-1">
        <View className="self-start rounded-[18px] bg-[#F3F4F6] px-3.5 py-2.5">
          <Text
            className="text-[14px] font-bold text-[#111827]"
            style={{ includeFontPadding: false, lineHeight: 15 }}
          >
            {displayName}
          </Text>
          <Text
            className="mt-0.5 text-[15px] text-[#374151]"
            style={{ includeFontPadding: false, lineHeight: 19 }}
          >
            {readMeaningfulText(item.comment) ?? "Đã gửi một bình luận."}
          </Text>
        </View>

        <View className="mt-1.5 flex-row flex-wrap items-center">
          <Text className="text-[12px] font-medium text-[#6B7280]">
            {formatCommunityTime(item.createdAt)}
          </Text>
          <Text className="ml-4 text-[12px] font-semibold text-[#4B5563]">
            Thích
          </Text>
          <Pressable
            className="ml-4"
            hitSlop={8}
            onPress={() => {
              onReply(item);
            }}
          >
            <Text className="text-[12px] font-semibold text-[#4B5563]">
              Trả lời
            </Text>
          </Pressable>
          {replyCount > 0 ? (
            <Text className="ml-4 text-[12px] font-medium text-[#6B7280]">
              {`${replyCount} phản hồi`}
            </Text>
          ) : null}
          {showReplyingState ? (
            <Text className="ml-4 text-[12px] font-semibold text-[#2563EB]">
              Đang trả lời
            </Text>
          ) : null}
          {typeof item.likeCount === "number" && item.likeCount > 0 ? (
            <Text className="ml-4 text-[12px] font-medium text-[#6B7280]">
              {`${item.likeCount} thích`}
            </Text>
          ) : null}
          {item.isLiked ? (
            <Text className="ml-4 text-[12px] font-semibold text-[#2563EB]">
              Đã thích
            </Text>
          ) : null}
        </View>
      </View>
    </View>
  );
}

function CommunityCommentThread({
  depth = 0,
  item,
  onReply,
  repliesByParentId,
  replyTargetId,
}: {
  depth?: number;
  item: PostComment;
  onReply: (item: PostComment) => void;
  repliesByParentId: Record<number, PostComment[]>;
  replyTargetId: number | null;
}) {
  const childComments = repliesByParentId[item.postActionId] ?? [];
  const nestedDepth = Math.min(depth + 1, 3);

  return (
    <View style={{ marginLeft: depth > 0 ? 18 : 0 }}>
      <CommunityCommentItem
        item={item}
        onReply={onReply}
        replyCount={Math.max(item.replyCount ?? 0, childComments.length)}
        showReplyingState={replyTargetId === item.postActionId}
      />

      {childComments.length > 0 ? (
        <View className="mt-2 gap-3">
          {childComments.map((reply) => (
            <CommunityCommentThread
              key={`${reply.postActionId}-${reply.userId}`}
              depth={nestedDepth}
              item={reply}
              onReply={onReply}
              repliesByParentId={repliesByParentId}
              replyTargetId={replyTargetId}
            />
          ))}
        </View>
      ) : null}
    </View>
  );
}

function NotFoundState() {
  const router = useRouter();

  return (
    <SafeAreaView className="flex-1 bg-white" edges={["top", "left", "right", "bottom"]}>
      <View className="flex-1 items-center justify-center px-6">
        <View
          className="w-full max-w-[360px] rounded-[32px] bg-[#F9FAFB] px-6 py-7"
          style={socialCardShadowStyle}
        >
          <Text className="text-center text-[22px] font-black text-[#111827]">
            Không tìm thấy bài viết
          </Text>
          <Text className="mt-3 text-center text-[15px] leading-6 text-[#6B7280]">
            Hãy mở lại từ feed cộng đồng để xem đầy đủ nội dung và bình luận.
          </Text>

          <Pressable
            className="mt-5 items-center rounded-[20px] bg-[#111827] px-4 py-3.5"
            onPress={() => router.back()}
          >
            <Text className="text-[14px] font-bold text-white">Quay lại</Text>
          </Pressable>
        </View>
      </View>
    </SafeAreaView>
  );
}

export default function CommunityPostCommentsScreen() {
  const router = useRouter();
  const authSession = useAuthSession();
  const insets = useSafeAreaInsets();
  const commentInputRef = useRef<TextInput>(null);
  const { id } = useLocalSearchParams<{ id?: string }>();
  const resolvedPostId = Number.parseInt(Array.isArray(id) ? (id[0] ?? "") : (id ?? ""), 10);
  const [post, setPost] = useState<CommunityFeedPost | null>(() =>
      Number.isInteger(resolvedPostId) && resolvedPostId > 0
        ? getCachedCommunityPost(resolvedPostId)?.post ?? null
        : null,
  );
  const [commentDraft, setCommentDraft] = useState("");
  const [comments, setComments] = useState<PostComment[]>([]);
  const [commentsError, setCommentsError] = useState<string | null>(null);
  const [commentsStatus, setCommentsStatus] = useState<CommunityCommentsStatus>("idle");
  const [isComposerFocused, setIsComposerFocused] = useState(false);
  const [keyboardHeight, setKeyboardHeight] = useState(0);
  const [replyTarget, setReplyTarget] = useState<PostComment | null>(null);
  const [isSubmittingComment, setIsSubmittingComment] = useState(false);

  const postMediaItems = useMemo(() => (post ? buildPostMediaItems(post) : []), [post]);
  const { repliesByParentId, topLevelComments } = useMemo(() => {
    const commentIds = new Set(comments.map((item) => item.postActionId));
    const nextRepliesByParentId: Record<number, PostComment[]> = {};
    const nextTopLevelComments: PostComment[] = [];

    for (const item of comments) {
      const parentActionId = item.parentActionId;

      if (
        typeof parentActionId === "number" &&
        parentActionId > 0 &&
        parentActionId !== item.postActionId &&
        commentIds.has(parentActionId)
      ) {
        const currentReplies = nextRepliesByParentId[parentActionId] ?? [];

        nextRepliesByParentId[parentActionId] = [...currentReplies, item];
        continue;
      }

      nextTopLevelComments.push(item);
    }

    return {
      repliesByParentId: nextRepliesByParentId,
      topLevelComments: nextTopLevelComments,
    };
  }, [comments]);

  const loadComments = useCallback(async () => {
    if (!Number.isInteger(resolvedPostId) || resolvedPostId <= 0) {
      return;
    }

    setCommentsStatus("loading");
    setCommentsError(null);

    try {
      const accessToken = authSession.isAuthenticated
        ? await getValidAccessToken()
        : null;
      const response = await getPostComments({
        accessToken,
        page: 0,
        postId: resolvedPostId,
        size: communityPostCommentsPageSize,
        tokenType: authSession.tokenType,
      });

      setComments(response.content);
      setCommentsStatus("ready");
    } catch (error) {
      setComments([]);
      setCommentsError(
        error instanceof Error
          ? error.message
          : "Không tải được bình luận của bài viết cộng đồng.",
      );
      setCommentsStatus("error");
    }
  }, [authSession.isAuthenticated, authSession.tokenType, resolvedPostId]);

  useEffect(() => {
    const showEvent = Platform.OS === "ios" ? "keyboardWillShow" : "keyboardDidShow";
    const hideEvent = Platform.OS === "ios" ? "keyboardWillHide" : "keyboardDidHide";
    const changeFrameEvent = Platform.OS === "ios" ? "keyboardWillChangeFrame" : null;
    const handleKeyboardShow = (event: {
      endCoordinates?: {
        height?: number;
      };
    }) => {
      const nextKeyboardHeight = Math.max(
        0,
        Math.round((event.endCoordinates?.height ?? 0) - insets.bottom),
      );

      setKeyboardHeight(nextKeyboardHeight);
    };
    const handleKeyboardHide = () => {
      setKeyboardHeight(0);
    };

    const subscriptions = [
      Keyboard.addListener(showEvent, handleKeyboardShow),
      Keyboard.addListener(hideEvent, handleKeyboardHide),
    ];

    if (changeFrameEvent) {
      subscriptions.push(Keyboard.addListener(changeFrameEvent, handleKeyboardShow));
    }

    return () => {
      subscriptions.forEach((subscription) => {
        subscription.remove();
      });
    };
  }, [insets.bottom]);

  useFocusEffect(
    useCallback(() => {
      if (!Number.isInteger(resolvedPostId) || resolvedPostId <= 0) {
        return;
      }

      const nextCachedPost = getCachedCommunityPost(resolvedPostId);

      setPost(nextCachedPost?.post ?? null);

      void loadComments();
    }, [loadComments, resolvedPostId]),
  );

  function handleReplyToComment(item: PostComment) {
    setReplyTarget(item);
    setIsComposerFocused(true);

    requestAnimationFrame(() => {
      commentInputRef.current?.focus();
    });
  }

  function handleCancelReplyTarget() {
    setReplyTarget(null);
  }

  async function handleSubmitComment() {
    if (!Number.isInteger(resolvedPostId) || resolvedPostId <= 0 || !post) {
      return;
    }

    const trimmedComment = commentDraft.trim();

    if (!trimmedComment) {
      return;
    }

    if (!authSession.isAuthenticated) {
      Alert.alert(
        "Cần đăng nhập",
        "Bạn cần đăng nhập để bình luận bài viết cộng đồng.",
      );
      return;
    }

    const accessToken = await getValidAccessToken();

    if (!accessToken) {
      Alert.alert(
        "Phiên đăng nhập hết hạn",
        "Vui lòng đăng nhập lại trước khi gửi bình luận.",
      );
      return;
    }

    setIsSubmittingComment(true);

    try {
      const result = await commentPost({
        accessToken,
        comment: trimmedComment,
        parentActionId: replyTarget?.postActionId ?? null,
        postId: resolvedPostId,
        tokenType: authSession.tokenType,
      });
      const nextPost = replaceCommunityPostStats(post, {
        commentCount:
          result.commentCount ??
          Math.max(0, Math.round(post.commentCountValue ?? 0)) + 1,
        likeCount: result.likeCount,
        replyCount: result.replyCount,
        shareCount: result.shareCount,
      });

      setPost(nextPost);
      cacheCommunityPost(nextPost);
      updateCachedCommunityPost(resolvedPostId, () => nextPost);
      setCommentDraft("");
      setReplyTarget(null);
      await loadComments();
    } catch (error) {
      Alert.alert(
        "Không thể gửi bình luận",
        error instanceof Error
          ? error.message
          : "Đã có lỗi xảy ra khi gửi bình luận cho bài viết cộng đồng.",
      );
    } finally {
      setIsSubmittingComment(false);
    }
  }

  if (!post) {
    return <NotFoundState />;
  }

  const palette = getAvatarPalette(`${post.author}-${post.authorId}`);
  const trimmedCommentDraft = commentDraft.trim();
  const composerBottomInset = Math.max(insets.bottom, 6);
  const composerLift = Math.max(0, keyboardHeight);
  const replyTargetDisplayName = replyTarget ? getCommentDisplayName(replyTarget) : null;
  const shouldShowComposerQuickActions =
    trimmedCommentDraft.length === 0 &&
    !isSubmittingComment &&
    replyTarget === null;

  return (
    <SafeAreaView className="flex-1 bg-white" edges={["top", "left", "right"]}>
      <KeyboardAvoidingView className="flex-1">
        <View className="border-b border-[#E5E7EB] bg-white px-4 pb-3 pt-2">
          <View className="flex-row items-center justify-between">
            <Pressable
              className="h-10 w-10 items-center justify-center rounded-full bg-[#F3F4F6]"
              onPress={() => router.back()}
            >
              <SymbolView
                name={{
                  ios: "chevron.left",
                  android: "arrow_back",
                  web: "arrow_back",
                }}
                size={18}
                tintColor="#111827"
              />
            </Pressable>

            <Text className="text-[17px] font-black text-[#111827]">Bình luận</Text>

            <Pressable className="h-10 w-10 items-center justify-center rounded-full bg-[#F3F4F6]">
              <SymbolView
                name={{
                  ios: "ellipsis",
                  android: "more_horiz",
                  web: "more_horiz",
                }}
                size={18}
                tintColor="#111827"
              />
            </Pressable>
          </View>
        </View>

        <View className="flex-1">
          <ScrollView
            className="flex-1"
            keyboardShouldPersistTaps="handled"
            showsVerticalScrollIndicator={false}
            contentContainerStyle={{ paddingBottom: 16 }}
          >
            <View className="bg-white">
              <View className="px-4 pb-2.5 pt-2.5">
                <View className="flex-row items-start">
                  <AvatarMonogram
                    colors={palette}
                    initials={getNameInitials(post.author)}
                    size={42}
                  />

                  <View className="ml-3 flex-1">
                    <View className="flex-row items-center">
                      <Text
                        className="text-[16px] font-black text-[#111827]"
                        numberOfLines={1}
                        style={{ includeFontPadding: false, lineHeight: 17 }}
                      >
                        {post.author}
                      </Text>
                      <SymbolView
                        name={{
                          ios: "checkmark.seal.fill",
                          android: "verified",
                          web: "verified",
                        }}
                        size={15}
                        tintColor="#2563EB"
                      />
                    </View>
                    <View className="mt-1 flex-row items-center">
                      <Text
                        className="text-[12px] font-medium text-[#6B7280]"
                        style={{ includeFontPadding: false, lineHeight: 13 }}
                      >
                        {post.time}
                      </Text>
                      <Text className="mx-1 text-[12px] text-[#9CA3AF]">·</Text>
                      <SymbolView
                        name={{
                          ios: "globe.asia.australia.fill",
                          android: "public",
                          web: "public",
                        }}
                        size={13}
                        tintColor="#9CA3AF"
                      />
                    </View>
                  </View>
                </View>

                <Text
                  className="mt-2 text-[14px] text-[#111827]"
                  style={{ includeFontPadding: false, lineHeight: 18 }}
                >
                  {post.caption}
                </Text>
              </View>

              <SocialPostMediaGallery items={postMediaItems} />

              <View className="border-t border-[#E5E7EB] px-4 py-2.5">
                <View className="flex-row items-center justify-between gap-3">
                  <View className="flex-row items-center gap-5">
                    <SocialCountChip
                      icon={{
                        ios: "hand.thumbsup",
                        android: "thumb_up_off_alt",
                        web: "thumb_up_off_alt",
                      }}
                      value={post.likes}
                    />
                    <SocialCountChip
                      icon={{
                        ios: "bubble.left",
                        android: "chat_bubble_outline",
                        web: "chat_bubble_outline",
                      }}
                      value={post.comments}
                    />
                    {typeof post.replyCountValue === "number" ? (
                      <SocialCountChip
                        icon={{
                          ios: "arrowshape.turn.up.left",
                          android: "reply",
                          web: "reply",
                        }}
                        value={post.replies ?? formatCompactCount(post.replyCountValue)}
                      />
                    ) : null}
                    <SocialCountChip
                      icon={{
                        ios: "square.and.arrow.up",
                        android: "ios_share",
                        web: "ios_share",
                      }}
                      value={post.shares}
                    />
                  </View>

                  <View className="flex-row items-center">
                    <View className="h-5 w-5 items-center justify-center rounded-full bg-[#2563EB]">
                      <SymbolView
                        name={{
                          ios: "hand.thumbsup.fill",
                          android: "thumb_up",
                          web: "thumb_up",
                        }}
                        size={10}
                        tintColor="#FFFFFF"
                      />
                    </View>
                    <View className="-ml-1.5 h-5 w-5 items-center justify-center rounded-full bg-[#F43F5E]">
                      <SymbolView
                        name={{
                          ios: "heart.fill",
                          android: "favorite",
                          web: "favorite",
                        }}
                        size={10}
                        tintColor="#FFFFFF"
                      />
                    </View>
                    <View className="-ml-1.5 h-5 w-5 items-center justify-center rounded-full bg-[#F59E0B]">
                      <SymbolView
                        name={{
                          ios: "face.smiling.fill",
                          android: "sentiment_very_satisfied",
                          web: "sentiment_very_satisfied",
                        }}
                        size={10}
                        tintColor="#FFFFFF"
                      />
                    </View>
                  </View>
                </View>
              </View>
            </View>

            <View className="px-4 pb-5 pt-3">
              <View className="flex-row items-center">
                <Text className="text-[16px] font-black text-[#111827]">
                  Phù hợp nhất
                </Text>
                <SymbolView
                  name={{
                    ios: "chevron.down",
                    android: "keyboard_arrow_down",
                    web: "keyboard_arrow_down",
                  }}
                  size={15}
                  tintColor="#374151"
                />
              </View>

              {commentsStatus === "loading" ? (
                <View className="mt-4 items-center px-4 py-4">
                  <ActivityIndicator color="#2563EB" size="small" />
                  <Text className="mt-3 text-[14px] font-semibold text-[#374151]">
                    Đang tải bình luận
                  </Text>
                </View>
              ) : null}

              {commentsError ? (
                <View className="mt-4 px-1 py-1">
                  <Text className="text-[14px] font-bold text-[#B91C1C]">
                    {commentsError}
                  </Text>
                  <Pressable
                    className="mt-3 self-start rounded-full bg-[#E5E7EB] px-4 py-2"
                    onPress={() => {
                      void loadComments();
                    }}
                  >
                    <Text className="text-[12px] font-bold text-[#111827]">
                      Tải lại
                    </Text>
                  </Pressable>
                </View>
              ) : null}

              {topLevelComments.length > 0 ? (
                <View className="mt-3 gap-3.5">
                  {topLevelComments.map((item) => (
                    <CommunityCommentThread
                      key={`${item.postActionId}-${item.userId}`}
                      onReply={handleReplyToComment}
                      item={item}
                      repliesByParentId={repliesByParentId}
                      replyTargetId={replyTarget?.postActionId ?? null}
                    />
                  ))}
                </View>
              ) : null}

              {commentsStatus === "ready" && topLevelComments.length === 0 ? (
                <View className="mt-4 px-1 py-1">
                  <Text className="text-[15px] font-semibold text-[#111827]">
                    Chưa có bình luận
                  </Text>
                  <Text className="mt-2 text-[14px] leading-5 text-[#6B7280]">
                    Hãy là người đầu tiên để lại cảm nhận cho bài viết này.
                  </Text>
                </View>
              ) : null}
            </View>
          </ScrollView>

          <View
            className="border-t border-[#E5E7EB] bg-white"
            style={{
              marginBottom: composerLift,
              paddingBottom: keyboardHeight > 0 ? 8 : composerBottomInset,
            }}
          >
            <View className="px-3 pb-2 pt-2">
              {replyTargetDisplayName ? (
                <View className="mb-2 flex-row items-center justify-between rounded-[16px] bg-[#EFF6FF] px-3 py-2">
                  <Text
                    className="flex-1 text-[12px] font-semibold text-[#2563EB]"
                    numberOfLines={1}
                    style={{ includeFontPadding: false, lineHeight: 13 }}
                  >
                    {`Đang trả lời ${replyTargetDisplayName}`}
                  </Text>
                  <Pressable
                    className="ml-3 h-6 w-6 items-center justify-center rounded-full bg-white"
                    hitSlop={8}
                    onPress={handleCancelReplyTarget}
                  >
                    <SymbolView
                      name={{
                        ios: "xmark",
                        android: "close",
                        web: "close",
                      }}
                      size={14}
                      tintColor="#2563EB"
                    />
                  </Pressable>
                </View>
              ) : null}

              <View className="flex-row items-center gap-3">
                {!isComposerFocused ? (
                  <AvatarMonogram
                    colors={getAvatarPalette(authSession.displayName || "me")}
                    initials={getNameInitials(authSession.displayName || "Bạn")}
                    size={36}
                  />
                ) : null}

                <View className="flex-1 flex-row items-center rounded-full bg-[#F3F4F6] px-3">
                  <TextInput
                    blurOnSubmit={false}
                    className="flex-1 py-2.5 text-[14px] text-[#111827]"
                    editable={!isSubmittingComment}
                    maxLength={communityCommentMaxLength}
                    ref={commentInputRef}
                    onBlur={() => {
                      setIsComposerFocused(false);
                    }}
                    onChangeText={setCommentDraft}
                    onFocus={() => {
                      setIsComposerFocused(true);
                    }}
                    onSubmitEditing={() => {
                      if (trimmedCommentDraft.length > 0) {
                        void handleSubmitComment();
                      }
                    }}
                    placeholder={
                      replyTargetDisplayName
                        ? `Trả lời ${replyTargetDisplayName}...`
                        : isComposerFocused
                        ? "Viết bình luận công khai..."
                        : "Viết bình luận..."
                    }
                    placeholderTextColor="#9CA3AF"
                    returnKeyType="send"
                    style={{ includeFontPadding: false }}
                    value={commentDraft}
                  />

                  {shouldShowComposerQuickActions ? (
                    <View className="flex-row items-center">
                      <Pressable className="h-8 w-8 items-center justify-center rounded-full">
                        <SymbolView
                          name={{
                            ios: "camera",
                            android: "photo_camera",
                            web: "photo_camera",
                          }}
                          size={18}
                          tintColor="#6B7280"
                        />
                      </Pressable>
                      <Pressable className="h-8 w-8 items-center justify-center rounded-full">
                        <SymbolView
                          name={{
                            ios: "plus.circle",
                            android: "add_circle_outline",
                            web: "add_circle_outline",
                          }}
                          size={20}
                          tintColor="#6B7280"
                        />
                      </Pressable>
                    </View>
                  ) : (
                    <Pressable
                      className="h-8 w-8 items-center justify-center rounded-full"
                      disabled={isSubmittingComment || trimmedCommentDraft.length === 0}
                      onPress={() => {
                        void handleSubmitComment();
                      }}
                      style={{
                        opacity:
                          isSubmittingComment || trimmedCommentDraft.length === 0
                            ? 0.45
                            : 1,
                      }}
                    >
                      {isSubmittingComment ? (
                        <ActivityIndicator color="#2563EB" size="small" />
                      ) : (
                        <SymbolView
                          name={{
                            ios: "paperplane.fill",
                            android: "send",
                            web: "send",
                          }}
                          size={18}
                          tintColor="#2563EB"
                        />
                      )}
                    </Pressable>
                  )}
                </View>
              </View>
            </View>
          </View>
        </View>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}
