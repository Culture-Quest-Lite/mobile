import { Image } from "expo-image";
import {
  useFocusEffect,
  useLocalSearchParams,
  useRouter,
  type Href,
} from "expo-router";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import {
  ActivityIndicator,
  Pressable,
  ScrollView,
  Text,
  TextInput,
  View,
} from "react-native";
import { useReanimatedKeyboardAnimation } from "react-native-keyboard-controller";
import Animated, { useAnimatedStyle } from "react-native-reanimated";
import {
  SafeAreaView,
  useSafeAreaInsets,
} from "react-native-safe-area-context";

import { appAlert } from "@/components/ui/app-dialog";
import { SymbolView } from "@/components/ui/symbol-view";
import { UserAvatar } from "@/components/ui/user-avatar";
import {
  getValidAccessToken,
  useAuthSession,
} from "@/features/auth/hooks/use-auth-session";
import { commentPost } from "@/features/home/api/comment-post";
import { getHotspotById } from "@/features/home/api/get-hotspot-by-id";
import {
  getPostComments,
  type PostComment,
} from "@/features/home/api/get-post-comments";
import { likePost } from "@/features/home/api/like-post";
import {
  getApiHotspotRouteSlug,
  getHotspotHref,
} from "@/features/home/data/hotspots";
import {
  addLikedPostId,
  removeLikedPostId,
  useLikedPostIds,
} from "@/features/home/data/liked-post-store";
import { getMyProfile } from "@/features/profile/api/get-me";
import { getRouteById } from "@/features/route/api/route-api";
import { useScreenLayout } from "@/hooks/use-screen-layout";
import {
  getPostVisibilityIcon,
  getPostVisibilityLabel,
} from "@/lib/post-visibility";
import { useCommunityAuthorAvatar } from "../data/community-author-avatar-cache";
import { getCachedCommunityExplorerProfile } from "../data/community-explorer-profile-cache";
import {
  cacheCommunityPost,
  getCachedCommunityPost,
  updateCachedCommunityPost,
  type CommunityFeedMediaItem,
  type CommunityFeedPost,
} from "../data/community-post-cache";
import { bodyLineHeightFor, lineHeightFor } from "@/lib/text-scale";

const postCommentEmptyImage = require("../../../../assets/images/posttachnen.png");

const communityCommentMaxLength = 320;
const composerKeyboardGap = 10;
const communityPostCommentsPageSize = 10;

type CommunityCommentsStatus = "idle" | "loading" | "ready" | "error";
type ResolvedHotspotPreview = {
  hotspotId: number;
  imageUri: string | null;
  hotspotName: string;
};
type ResolvedRoutePreview = {
  hotspotCount: number;
  routeDurationLabel: string | null;
  routeId: number;
  routeName: string;
};

const meaninglessTextValues = new Set(["", "string", "null", "undefined"]);
const avatarPalettes = [
  ["#1D4ED8", "#60A5FA"],
  ["#0F766E", "#2DD4BF"],
  ["#CA8A04", "#FBBF24"],
  ["#DC2626", "#FB7185"],
  ["#7C3AED", "#C084FC"],
] as const;
const socialCardShadowStyle = {
  shadowColor: "rgba(15, 23, 42, 0.12)",
  shadowOffset: { width: 0, height: 10 },
  shadowOpacity: 0.16,
  shadowRadius: 18,
  elevation: 4,
};

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

function formatCommunityTagLabel(tag: string) {
  const meaningfulTag = readMeaningfulText(tag)
    ?.replace(/^#/, "")
    .replace(/\s+/g, "_");

  return meaningfulTag ? `#${meaningfulTag}` : null;
}

function formatCommunityTime(
  isoTimestamp: string | null | undefined,
  t: (key: string, options?: Record<string, unknown>) => string,
) {
  const meaningfulValue = readMeaningfulText(isoTimestamp);

  if (!meaningfulValue) {
    return t("community.time.justNow");
  }

  const parsedDate = new Date(meaningfulValue);
  const parsedTime = parsedDate.getTime();

  if (Number.isNaN(parsedTime)) {
    return meaningfulValue;
  }

  const elapsedMilliseconds = Date.now() - parsedTime;

  if (elapsedMilliseconds < 60 * 1000) {
    return t("community.time.justNow");
  }

  const elapsedMinutes = Math.floor(elapsedMilliseconds / (60 * 1000));

  if (elapsedMinutes < 60) {
    return t("community.feed.time.minutes", { count: elapsedMinutes });
  }

  const elapsedHours = Math.floor(elapsedMinutes / 60);

  if (elapsedHours < 24) {
    return t("community.feed.time.hours", { count: elapsedHours });
  }

  const elapsedDays = Math.floor(elapsedHours / 24);

  if (elapsedDays < 7) {
    return t("community.feed.time.days", { count: elapsedDays });
  }

  return `${parsedDate.getDate().toString().padStart(2, "0")}/${(
    parsedDate.getMonth() + 1
  )
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

function formatRouteEstimateLabel(
  estimateTimeMinutes: number | null | undefined,
  t: (key: string, options?: Record<string, unknown>) => string,
) {
  if (
    typeof estimateTimeMinutes !== "number" ||
    !Number.isFinite(estimateTimeMinutes) ||
    estimateTimeMinutes <= 0
  ) {
    return null;
  }

  if (estimateTimeMinutes >= 480) {
    const dayCount = Math.max(1, Math.round(estimateTimeMinutes / 480));
    return t("community.feed.routeEstimate.days", { count: dayCount });
  }

  if (estimateTimeMinutes >= 60) {
    const hourCount = Math.max(1, Math.round(estimateTimeMinutes / 60));
    return t("community.feed.routeEstimate.hours", { count: hourCount });
  }

  return t("community.feed.routeEstimate.minutes", {
    count: Math.round(estimateTimeMinutes),
  });
}

function getCommentDisplayName(
  item: PostComment,
  t: (key: string, options?: Record<string, unknown>) => string,
) {
  return (
    readMeaningfulText(item.displayName) ??
    readMeaningfulText(item.username) ??
    t("community.feed.fallbackUserName")
  );
}

function replaceCommunityPostCommentCount(
  post: CommunityFeedPost,
  commentCount: number,
) {
  const normalizedCommentCount = Math.max(0, Math.round(commentCount));

  return {
    ...post,
    commentCountValue: normalizedCommentCount,
    comments: formatCompactCount(normalizedCommentCount),
  };
}

function replaceCommunityPostLikeState(
  post: CommunityFeedPost,
  {
    isLiked,
    likeCount,
  }: {
    isLiked: boolean;
    likeCount: number;
  },
) {
  const normalizedLikeCount = Math.max(0, Math.round(likeCount));

  return {
    ...post,
    isLiked,
    likeCountValue: normalizedLikeCount,
    likes: formatCompactCount(normalizedLikeCount),
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

function CommunityPostMediaGallery({
  edgeToEdgeWidth,
  items,
}: {
  edgeToEdgeWidth: number;
  items: CommunityFeedMediaItem[];
}) {
  const [activeIndex, setActiveIndex] = useState(0);
  const [galleryWidth, setGalleryWidth] = useState(
    Math.max(edgeToEdgeWidth - 32, 240),
  );
  const safeActiveIndex = Math.max(0, Math.min(items.length - 1, activeIndex));
  const mediaHeight = Math.min(Math.max(galleryWidth * 0.74, 188), 278);

  if (items.length === 0) {
    return null;
  }

  return (
    <View
      className="overflow-hidden rounded-[18px] bg-[#EEF2F7]"
      onLayout={(event) => {
        const nextWidth = event.nativeEvent.layout.width;

        if (Math.abs(nextWidth - galleryWidth) > 1) {
          setGalleryWidth(nextWidth);
        }
      }}
    >
      {items.length === 1 ? (
        <Image
          source={items[0].source}
          contentFit="cover"
          style={{ height: mediaHeight, width: "100%" }}
        />
      ) : (
        <>
          <ScrollView
            decelerationRate="fast"
            horizontal
            pagingEnabled
            showsHorizontalScrollIndicator={false}
            onMomentumScrollEnd={(event) => {
              const layoutWidth =
                galleryWidth ||
                event.nativeEvent.layoutMeasurement.width ||
                1;
              const nextIndex = Math.round(
                event.nativeEvent.contentOffset.x / layoutWidth,
              );

              setActiveIndex(
                Math.max(0, Math.min(items.length - 1, nextIndex)),
              );
            }}
          >
            {items.map((item) => (
              <Image
                key={item.key}
                source={item.source}
                contentFit="cover"
                style={{ height: mediaHeight, width: galleryWidth }}
              />
            ))}
          </ScrollView>

          <View className="absolute right-3 top-3 rounded-full bg-black/35 px-2.5 py-1">
            <Text
              className="text-[11px] font-semibold text-white"
              style={{
                includeFontPadding: false,
                lineHeight: lineHeightFor(11),
              }}
            >
              {`${safeActiveIndex + 1}/${items.length}`}
            </Text>
          </View>

          <View className="absolute bottom-3 left-0 right-0 flex-row items-center justify-center">
            {items.map((item, index) => (
              <View
                key={`${item.key}-dot`}
                className={`mx-1 rounded-full ${index === safeActiveIndex ? "bg-[#F15C9B]" : "bg-white/88"}`}
                style={{
                  height: index === safeActiveIndex ? 7 : 6,
                  width: index === safeActiveIndex ? 7 : 6,
                }}
              />
            ))}
          </View>
        </>
      )}
    </View>
  );
}

function CommunityPostFooterAction({
  active = false,
  disabled = false,
  icon,
  isLoading = false,
  label,
  onPress,
}: {
  active?: boolean;
  disabled?: boolean;
  icon: {
    android: string;
    ios: string;
    web: string;
  };
  isLoading?: boolean;
  label: string;
  onPress?: (() => void) | undefined;
}) {
  return (
    <Pressable
      className="flex-row items-center rounded-full pr-2"
      disabled={disabled || !onPress}
      hitSlop={8}
      onPress={onPress}
      style={({ pressed }) => ({
        opacity: disabled ? 0.5 : pressed ? 0.72 : 1,
      })}
    >
      {isLoading ? (
        <ActivityIndicator color="#F15C9B" size="small" />
      ) : (
        <SymbolView
          name={icon}
          size={18}
          tintColor={active ? "#F15C9B" : "#7A7380"}
        />
      )}
      <Text
        className="ml-1.5 text-[13px] text-[#706775]"
        style={{
          includeFontPadding: false,
          lineHeight: lineHeightFor(13),
        }}
      >
        {label}
      </Text>
    </Pressable>
  );
}

function CommunityPostTagChip({ label }: { label: string }) {
  return (
    <View className="mr-2 mt-1.5 rounded-full bg-[#F4F1F4] px-3 py-0.5">
      <Text
        className="text-[12px] text-[#7D7680]"
        style={{ includeFontPadding: false, lineHeight: lineHeightFor(12) }}
      >
        {label}
      </Text>
    </View>
  );
}

function CommunityPostRouteCard({
  label,
  onPress,
}: {
  label: string;
  onPress?: () => void;
}) {
  const { t } = useTranslation();

  return (
    <Pressable
      className="rounded-[16px] bg-[#FFF4F8] px-2.5 py-1.5"
      disabled={!onPress}
      hitSlop={8}
      onPress={onPress}
      style={({ pressed }) => ({
        opacity: onPress && pressed ? 0.72 : 1,
      })}
    >
      <View className="flex-row items-center">
        <View className="mr-2 h-8 w-8 items-center justify-center rounded-full bg-white/80">
          <SymbolView
            name={{
              ios: "point.topleft.down.curvedto.point.bottomright.up",
              android: "alt_route",
              web: "alt_route",
            }}
            size={15}
            tintColor="#F2608E"
          />
        </View>
        <View className="flex-1 pr-2">
          <Text
            className="text-[12px] font-semibold text-[#F2608E]"
            style={{ includeFontPadding: false, lineHeight: lineHeightFor(12) }}
          >
            {t("community.explorerProfile.routeCardLabel")}
          </Text>
          <Text
            className="text-[13px] font-medium text-[#4B414C]"
            numberOfLines={2}
            style={{ includeFontPadding: false, lineHeight: lineHeightFor(13) }}
          >
            {label}
          </Text>
        </View>
        <SymbolView
          name={{
            ios: "chevron.right",
            android: "chevron_right",
            web: "chevron_right",
          }}
          size={16}
          tintColor="#8A7D86"
        />
      </View>
    </Pressable>
  );
}

function CommunityPostHotspotCard({
  count,
  imageUris,
  onPress,
  subtitle,
}: {
  count: number;
  imageUris: string[];
  onPress?: () => void;
  subtitle: string;
}) {
  const { t } = useTranslation();
  const previewImageUris = imageUris.slice(0, 3);
  const remainingCount = Math.max(imageUris.length - previewImageUris.length, 0);

  return (
    <Pressable
      className="rounded-[16px] bg-[#F2FAFB] px-2.5 py-1.5"
      disabled={!onPress}
      hitSlop={8}
      onPress={onPress}
      style={({ pressed }) => ({
        opacity: onPress && pressed ? 0.72 : 1,
      })}
    >
      <View className="flex-row items-start">
        <View className="mr-2 h-8 w-8 items-center justify-center rounded-full bg-white/80">
          <SymbolView
            name={{
              ios: "mappin.and.ellipse",
              android: "location_on",
              web: "location_on",
            }}
            size={15}
            tintColor="#18A7B4"
          />
        </View>
        <View className="flex-1 pr-2">
          <Text
            className="text-[12px] font-semibold text-[#18A7B4]"
            style={{ includeFontPadding: false, lineHeight: lineHeightFor(12) }}
          >
            {t("community.explorerProfile.hotspotCountLabel", { count })}
          </Text>
          <Text
            className="text-[13px] text-[#6D6671]"
            numberOfLines={2}
            style={{ includeFontPadding: false, lineHeight: lineHeightFor(13) }}
          >
            {subtitle}
          </Text>
          {previewImageUris.length > 0 ? (
            <View className="mt-1 flex-row items-center">
              {previewImageUris.map((imageUri, index) => (
                <View
                  key={`${imageUri}-${index}`}
                  className={index === 0 ? "h-6 w-6 overflow-hidden rounded-full border-2 border-white" : "-ml-2 h-6 w-6 overflow-hidden rounded-full border-2 border-white"}
                >
                  <Image
                    source={{ uri: imageUri }}
                    contentFit="cover"
                    style={{ height: "100%", width: "100%" }}
                  />
                </View>
              ))}
              {remainingCount > 0 ? (
                <View className="-ml-2 h-6 w-6 items-center justify-center rounded-full border-2 border-white bg-[#E7EEF2]">
                  <Text
                    className="text-[11px] font-semibold text-[#55606C]"
                    style={{
                      includeFontPadding: false,
                      lineHeight: lineHeightFor(11),
                    }}
                  >
                    {`+${remainingCount}`}
                  </Text>
                </View>
              ) : null}
            </View>
          ) : null}
        </View>
        <SymbolView
          name={{
            ios: "chevron.right",
            android: "chevron_right",
            web: "chevron_right",
          }}
          size={16}
          tintColor="#8A7D86"
        />
      </View>
    </Pressable>
  );
}

function CommunityPostAuthorAvatar({
  authorId,
  authorName,
  size,
}: {
  authorId: string;
  authorName: string;
  avatarColors: readonly [string, string];
  initials: string;
  size: number;
}) {
  // Dùng chung cache ảnh tác giả với bảng tin: người dùng mở bình luận từ bảng
  // tin nên ảnh thường đã có sẵn, không phát sinh request mới.
  const fetchedAvatarUri = useCommunityAuthorAvatar(authorId);
  const avatarUri =
    getCachedCommunityExplorerProfile(authorId)?.profile.avatar ??
    fetchedAvatarUri;
  return (
    <UserAvatar
      displayName={authorName}
      size={size}
      uri={avatarUri}
    />
  );
}

function ExpandablePostCaption({ text }: { text: string }) {
  const { t } = useTranslation();
  const [expanded, setExpanded] = useState(false);
  const normalizedText = text.trim();
  const maxLength = 150;
  const shouldTruncate = normalizedText.length > maxLength;
  const collapsedText = shouldTruncate
    ? `${normalizedText.slice(0, maxLength).trimEnd()}...`
    : normalizedText;

  return (
    <Text
      className="text-[13px] text-[#2B232D]"
      style={{
        includeFontPadding: false,
        lineHeight: bodyLineHeightFor(13),
      }}
    >
      {expanded || !shouldTruncate ? normalizedText : collapsedText}
      {shouldTruncate ? (
        <Text
          className="font-medium text-[#D4578F]"
          onPress={() => {
            setExpanded((current) => !current);
          }}
        >
          {expanded
            ? ` ${t("community.feed.showLess")}`
            : ` ${t("community.feed.showMore")}`}
        </Text>
      ) : null}
    </Text>
  );
}

function CommunityPostCard({
  edgeToEdgeWidth,
  isEmbedded = false,
  isLiked,
  isLiking,
  post,
  resolvedHotspots,
  resolvedRoutes,
  onCommentPost,
  onLikePost,
  onOpenProfile,
  onOpenHotspot,
  onOpenRoute,
}: {
  edgeToEdgeWidth: number;
  isEmbedded?: boolean;
  isLiked: boolean;
  isLiking: boolean;
  post: CommunityFeedPost;
  resolvedHotspots: Record<number, ResolvedHotspotPreview>;
  resolvedRoutes: Record<number, ResolvedRoutePreview>;
  onCommentPost: (post: CommunityFeedPost) => void;
  onLikePost: (post: CommunityFeedPost) => void;
  onOpenProfile: (authorId: string) => void;
  onOpenHotspot: (hotspotId: number) => void;
  onOpenRoute: (routeId: number) => void;
}) {
  const { t } = useTranslation();
  const mediaItems = buildPostMediaItems(post);
  const visibilityIcon = getPostVisibilityIcon(post.visibility);
  const visibilityLabel = getPostVisibilityLabel(post.visibility);
  const hotspotIds = (post.hotspotIds ?? []).filter(
    (hotspotId) => Number.isInteger(hotspotId) && hotspotId > 0,
  );
  const routeIds = (post.routeIds ?? []).filter(
    (routeId) => Number.isInteger(routeId) && routeId > 0,
  );
  const tagLabels = post.tags
    .map(formatCommunityTagLabel)
    .filter((tagLabel): tagLabel is string => Boolean(tagLabel));
  const routeItems = routeIds.map((routeId) => ({
    id: routeId,
    hotspotCount: resolvedRoutes[routeId]?.hotspotCount ?? 0,
    label:
      resolvedRoutes[routeId]?.routeName?.trim() ||
      t("community.feed.routeFallbackName", { id: routeId }),
    routeDurationLabel: resolvedRoutes[routeId]?.routeDurationLabel ?? null,
  }));
  const hotspotItems = hotspotIds.map((hotspotId) => ({
    id: hotspotId,
    imageUri: resolvedHotspots[hotspotId]?.imageUri ?? null,
    label:
      resolvedHotspots[hotspotId]?.hotspotName?.trim() ||
      t("community.feed.hotspotFallbackName", { id: hotspotId }),
  }));
  const primaryRouteLabel =
    routeItems.length <= 1
      ? routeItems[0]?.label ?? null
      : `${routeItems[0]?.label ?? t("community.explorerProfile.routeCardLabel")} +${routeItems.length - 1}`;
  const hotspotSubtitle =
    hotspotItems.length === 0
      ? null
      : hotspotItems.length === 1
        ? hotspotItems[0]?.label ?? null
        : hotspotItems.length === 2
          ? `${hotspotItems[0]?.label ?? ""}, ${hotspotItems[1]?.label ?? ""}`
          : t("community.feed.hotspotMoreLabel", {
              first: hotspotItems[0]?.label ?? "",
              second: hotspotItems[1]?.label ?? "",
              count: hotspotItems.length - 2,
            });
  const hotspotImageUris = hotspotItems
    .map((item) => item.imageUri)
    .filter((imageUri): imageUri is string => Boolean(imageUri));

  return (
    <View className="rounded-[20px] bg-white px-4 pb-2 pt-2">
      <View className="flex-row items-start">
        <Pressable
          accessibilityLabel={t("community.feed.openProfileA11y", {
            name: post.author,
          })}
          accessibilityRole={post.canOpenProfile === false ? undefined : "button"}
          className="rounded-full"
          disabled={post.canOpenProfile === false}
          hitSlop={8}
          onPress={() => {
            if (post.canOpenProfile === false) {
              return;
            }

            onOpenProfile(post.authorId);
          }}
        >
          <CommunityPostAuthorAvatar
            authorId={post.authorId}
            authorName={post.author}
            avatarColors={post.avatarColors}
            initials={post.initials}
            size={42}
          />
        </Pressable>

        <View className="ml-2 flex-1 pr-1">
          <Text
            className="text-[15px] font-bold text-[#2F2432]"
            numberOfLines={1}
            style={{ includeFontPadding: false, lineHeight: lineHeightFor(15) }}
          >
            {post.author}
          </Text>

          <View className="-mt-0.5 flex-row flex-wrap items-center gap-1">
            <Text
              className="text-[12px] text-[#8A7D86]"
              style={{
                includeFontPadding: false,
                lineHeight: lineHeightFor(12),
              }}
            >
              {post.time}
            </Text>
            <Text
              className="text-[12px] text-[#8A7D86]"
              style={{
                includeFontPadding: false,
                lineHeight: lineHeightFor(12),
              }}
            >
              •
            </Text>
            <SymbolView name={visibilityIcon} size={10} tintColor="#8A7D86" />
            <Text
              className="text-[12px] text-[#8A7D86]"
              style={{
                includeFontPadding: false,
                lineHeight: lineHeightFor(12),
              }}
            >
              {visibilityLabel}
            </Text>
          </View>
        </View>

        <View className="h-8 w-8 items-center justify-center">
          <SymbolView
            name={{
              ios: "ellipsis",
              android: "more_horiz",
              web: "more_horiz",
            }}
            size={20}
            tintColor="#554C56"
          />
        </View>
      </View>

      <View className="pt-1">
        <ExpandablePostCaption text={post.caption} />

        {tagLabels.length > 0 ? (
          <View className="mt-1 flex-row flex-wrap items-center gap-1.5">
            {tagLabels.map((tagLabel) => (
              <CommunityPostTagChip
                key={`${post.id}-${tagLabel}`}
                label={tagLabel}
              />
            ))}
          </View>
        ) : null}

        {primaryRouteLabel ? (
          <View className="mt-1.5">
            <CommunityPostRouteCard
              label={primaryRouteLabel}
              onPress={() => {
                onOpenRoute(routeItems[0]?.id ?? 0);
              }}
            />
          </View>
        ) : null}

        {hotspotSubtitle ? (
          <View className="mt-1.5">
            <CommunityPostHotspotCard
              count={hotspotItems.length}
              imageUris={hotspotImageUris}
              onPress={() => {
                onOpenHotspot(hotspotItems[0]?.id ?? 0);
              }}
              subtitle={hotspotSubtitle}
            />
          </View>
        ) : null}
      </View>

      {mediaItems.length > 0 ? (
        <View className="mt-1.5">
          <CommunityPostMediaGallery
            edgeToEdgeWidth={edgeToEdgeWidth}
            items={mediaItems}
          />
        </View>
      ) : null}

      <View className="mt-2 pt-2">
        <View className="flex-row items-center">
          <CommunityPostFooterAction
            active={isLiked}
            disabled={!post.canLike || isLiking}
            icon={
              isLiked
                ? {
                    ios: "heart.fill",
                    android: "favorite",
                    web: "favorite",
                  }
                : {
                    ios: "heart",
                    android: "favorite_border",
                    web: "favorite_border",
                  }
            }
            isLoading={isLiking}
            onPress={
              post.canLike
                ? () => {
                    onLikePost(post);
                  }
                : undefined
            }
            label={post.likes}
          />
          <View className="ml-4">
            <CommunityPostFooterAction
              disabled={!post.canComment}
              icon={{
                ios: "bubble.left",
                android: "chat_bubble_outline",
                web: "chat_bubble_outline",
              }}
              onPress={
                post.canComment
                  ? () => {
                      onCommentPost(post);
                    }
                  : undefined
              }
              label={post.comments}
            />
          </View>
          <View className="ml-4">
            <CommunityPostFooterAction
              disabled
              icon={{
                ios: "arrowshape.turn.up.right",
                android: "share",
                web: "share",
              }}
              label={t("community.posts.share")}
            />
          </View>
        </View>
      </View>
    </View>
  );
}

function CommunityCommentItem({
  item,
  onOpenProfile,
  onReply,
  replyCount,
  showReplyingState = false,
}: {
  item: PostComment;
  onOpenProfile: (authorId: string) => void;
  onReply: (item: PostComment) => void;
  replyCount: number;
  showReplyingState?: boolean;
}) {
  const { t } = useTranslation();
  const displayName = getCommentDisplayName(item, t);
  const palette = getAvatarPalette(`${displayName}-${item.userId}`);
  const commenterId =
    Number.isInteger(item.userId) && item.userId > 0 ? `${item.userId}` : null;

  return (
    <View className="flex-row items-start gap-1">
      <Pressable
        accessibilityLabel={t("community.postComments.viewProfileA11y", {
          name: displayName,
        })}
        accessibilityRole="button"
        disabled={commenterId === null}
        hitSlop={6}
        onPress={() => {
          if (commenterId !== null) {
            onOpenProfile(commenterId);
          }
        }}
        style={({ pressed }) => ({ opacity: pressed ? 0.7 : 1 })}
      >
        <CommunityPostAuthorAvatar
          authorId={commenterId ?? ""}
          authorName={displayName}
          avatarColors={palette}
          initials={getNameInitials(displayName)}
          size={36}
        />
      </Pressable>

      <View className="flex-1">
        <View className="max-w-full self-start rounded-[14px] bg-[#F7F4F6] px-2.5 py-1.5">
          <Text
            className="text-[14px] font-semibold text-[#111827]"
            onPress={() => {
              if (commenterId !== null) {
                onOpenProfile(commenterId);
              }
            }}
            style={{ includeFontPadding: false, lineHeight: lineHeightFor(14) }}
          >
            {displayName}
          </Text>
          <Text
            className="mt-0.5 text-[14px] text-[#374151]"
            style={{ includeFontPadding: false, lineHeight: lineHeightFor(14) }}
          >
            {readMeaningfulText(item.comment) ??
              t("community.feed.defaultCommentText")}
          </Text>
        </View>

        <View className="mt-1 flex-row flex-wrap items-center">
          <Text className="text-[12px] font-medium text-[#6B7280]">
            {formatCommunityTime(item.createdAt, t)}
          </Text>
          <Text className="ml-4 text-[12px] font-semibold text-[#4B5563]">
            {t("community.postComments.likeAction")}
          </Text>
          <Pressable
            className="ml-4"
            hitSlop={8}
            onPress={() => {
              onReply(item);
            }}
          >
            <Text className="text-[12px] font-semibold text-[#4B5563]">
              {t("community.postComments.replyAction")}
            </Text>
          </Pressable>
          {replyCount > 0 ? (
            <Text className="ml-4 text-[12px] font-medium text-[#6B7280]">
              {t("community.postComments.replyCountLabel", { count: replyCount })}
            </Text>
          ) : null}
          {showReplyingState ? (
            <Text className="ml-4 text-[12px] font-semibold text-[#2563EB]">
              {t("community.postComments.replyingIndicator")}
            </Text>
          ) : null}
          {typeof item.likeCount === "number" && item.likeCount > 0 ? (
            <Text className="ml-4 text-[12px] font-medium text-[#6B7280]">
              {t("community.postComments.likeCountLabel", {
                count: item.likeCount,
              })}
            </Text>
          ) : null}
          {item.isLiked ? (
            <Text className="ml-4 text-[12px] font-semibold text-[#2563EB]">
              {t("community.postComments.likedState")}
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
  onOpenProfile,
  onReply,
  repliesByParentId,
  replyTargetId,
}: {
  depth?: number;
  item: PostComment;
  onOpenProfile: (authorId: string) => void;
  onReply: (item: PostComment) => void;
  repliesByParentId: Record<number, PostComment[]>;
  replyTargetId: number | null;
}) {
  const childComments = repliesByParentId[item.postActionId] ?? [];
  const nestedDepth = Math.min(depth + 1, 3);

  return (
    <View style={{ marginLeft: depth > 0 ? 12 : 0 }}>
      <CommunityCommentItem
        item={item}
        onOpenProfile={onOpenProfile}
        onReply={onReply}
        replyCount={Math.max(item.replyCount ?? 0, childComments.length)}
        showReplyingState={replyTargetId === item.postActionId}
      />

      {childComments.length > 0 ? (
        <View className="mt-1.5 gap-2">
          {childComments.map((reply) => (
            <CommunityCommentThread
              key={`${reply.postActionId}-${reply.userId}`}
              depth={nestedDepth}
              item={reply}
              onOpenProfile={onOpenProfile}
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
  const { t } = useTranslation();
  const router = useRouter();

  return (
    <SafeAreaView
      className="flex-1 bg-white"
      edges={["top", "left", "right", "bottom"]}
    >
      <View className="flex-1 items-center justify-center px-6">
        <View
          className="w-full max-w-[360px] rounded-[32px] bg-[#F9FAFB] px-6 py-7"
          style={socialCardShadowStyle}
        >
          <Text className="text-center text-[22px] font-black text-[#111827]">
            {t("community.postComments.notFoundTitle")}
          </Text>
          <Text className="mt-3 text-center text-[15px] leading-6 text-[#6B7280]">
            {t("community.postComments.notFoundDescription")}
          </Text>

          <Pressable
            className="mt-5 items-center rounded-[20px] bg-[#111827] px-4 py-3.5"
            onPress={() => router.back()}
          >
            <Text className="text-[14px] font-bold text-white">
              {t("common.back")}
            </Text>
          </Pressable>
        </View>
      </View>
    </SafeAreaView>
  );
}

export default function CommunityPostCommentsScreen() {
  const { t } = useTranslation();
  const router = useRouter();
  const authSession = useAuthSession();
  const insets = useSafeAreaInsets();
  const { safeWidth } = useScreenLayout({ maxContentWidth: 640 });
  const commentInputRef = useRef<TextInput>(null);
  const { id } = useLocalSearchParams<{ id?: string }>();
  const resolvedPostId = Number.parseInt(
    Array.isArray(id) ? (id[0] ?? "") : (id ?? ""),
    10,
  );
  const likedPostsAccountKey = authSession.isAuthenticated
    ? authSession.username?.trim() || authSession.displayName.trim() || null
    : null;
  const [post, setPost] = useState<CommunityFeedPost | null>(() =>
    Number.isInteger(resolvedPostId) && resolvedPostId > 0
      ? (getCachedCommunityPost(resolvedPostId)?.post ?? null)
      : null,
  );
  const [commentDraft, setCommentDraft] = useState("");
  const [comments, setComments] = useState<PostComment[]>([]);
  const [commentsError, setCommentsError] = useState<string | null>(null);
  const [commentsStatus, setCommentsStatus] =
    useState<CommunityCommentsStatus>("idle");
  const { height: keyboardOffset, progress: keyboardProgress } =
    useReanimatedKeyboardAnimation();
  const composerBottomInset = Math.max(insets.bottom, 6);
  // Khi bàn phím mở thì không cần chừa safe-area nữa, chỉ giữ một khoảng nhỏ.
  const composerInsetCollapse = Math.max(
    composerBottomInset - composerKeyboardGap,
    0,
  );
  const composerAnimatedStyle = useAnimatedStyle(() => ({
    transform: [
      {
        translateY:
          keyboardOffset.value + keyboardProgress.value * composerInsetCollapse,
      },
    ],
  }));
  const keyboardSpacerAnimatedStyle = useAnimatedStyle(() => ({
    height: -keyboardOffset.value,
  }));
  const [replyTarget, setReplyTarget] = useState<PostComment | null>(null);
  const [isSubmittingComment, setIsSubmittingComment] = useState(false);
  const [isLikingPost, setIsLikingPost] = useState(false);
  const [currentProfileId, setCurrentProfileId] = useState<string | null>(null);
  const [resolvedHotspots, setResolvedHotspots] = useState<
    Record<number, ResolvedHotspotPreview>
  >({});
  const [resolvedRoutes, setResolvedRoutes] = useState<
    Record<number, ResolvedRoutePreview>
  >({});
  const persistedLikedPostIds = useLikedPostIds(likedPostsAccountKey);
  const likedPostIdsSet = useMemo(
    () => new Set(persistedLikedPostIds),
    [persistedLikedPostIds],
  );

  const hotspotIdsToResolve = useMemo(() => {
    const hotspotIds = new Set<number>();

    for (const hotspotId of post?.hotspotIds ?? []) {
      if (Number.isInteger(hotspotId) && hotspotId > 0) {
        hotspotIds.add(hotspotId);
      }
    }

    return Array.from(hotspotIds);
  }, [post]);
  const routeIdsToResolve = useMemo(() => {
    const routeIds = new Set<number>();

    for (const routeId of post?.routeIds ?? []) {
      if (Number.isInteger(routeId) && routeId > 0) {
        routeIds.add(routeId);
      }
    }

    return Array.from(routeIds);
  }, [post]);
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
          : t("community.feed.commentsLoadError"),
      );
      setCommentsStatus("error");
    }
  }, [authSession.isAuthenticated, authSession.tokenType, resolvedPostId, t]);

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

  useEffect(() => {
    if (hotspotIdsToResolve.length === 0) {
      return;
    }

    let isActive = true;

    async function loadHotspotPreviews() {
      try {
        const accessToken = authSession.isAuthenticated
          ? await getValidAccessToken()
          : null;
        const results = await Promise.allSettled(
          hotspotIdsToResolve.map((hotspotId) =>
            getHotspotById({
              accessToken,
              hotspotId,
              tokenType: authSession.tokenType,
            }),
          ),
        );

        if (!isActive) {
          return;
        }

        setResolvedHotspots((current) => {
          const next = { ...current };

          for (const result of results) {
            if (result.status !== "fulfilled") {
              continue;
            }

            const hotspotName = readMeaningfulText(result.value.hotspotName);

            if (!hotspotName) {
              continue;
            }

            const imageUri =
              result.value.medias
                .map((media) => readMeaningfulText(media.fileUrl))
                .find((uri): uri is string => Boolean(uri)) ?? null;

            next[result.value.hotspotId] = {
              hotspotId: result.value.hotspotId,
              imageUri,
              hotspotName,
            };
          }

          return next;
        });
      } catch (error) {
        console.warn("[community-comments] load hotspot previews failed", {
          error: error instanceof Error ? error.message : error,
        });
      }
    }

    void loadHotspotPreviews();

    return () => {
      isActive = false;
    };
  }, [authSession.isAuthenticated, authSession.tokenType, hotspotIdsToResolve]);

  useEffect(() => {
    if (routeIdsToResolve.length === 0) {
      return;
    }

    let isActive = true;

    async function loadRoutePreviews() {
      try {
        const accessToken = authSession.isAuthenticated
          ? await getValidAccessToken()
          : null;
        const results = await Promise.allSettled(
          routeIdsToResolve.map((routeId) =>
            getRouteById({
              accessToken,
              routeId,
              tokenType: authSession.tokenType,
            }),
          ),
        );

        if (!isActive) {
          return;
        }

        setResolvedRoutes((current) => {
          const next = { ...current };

          for (const result of results) {
            if (result.status !== "fulfilled") {
              continue;
            }

            const routeName = readMeaningfulText(result.value.routeName);

            if (!routeName) {
              continue;
            }

            next[result.value.routeId] = {
              hotspotCount: result.value.hotspots.length,
              routeDurationLabel: formatRouteEstimateLabel(
                result.value.estimateTime,
                t,
              ),
              routeId: result.value.routeId,
              routeName,
            };
          }

          return next;
        });
      } catch (error) {
        console.warn("[community-comments] load route previews failed", {
          error: error instanceof Error ? error.message : error,
        });
      }
    }

    void loadRoutePreviews();

    return () => {
      isActive = false;
    };
  }, [authSession.isAuthenticated, authSession.tokenType, routeIdsToResolve, t]);

  function focusCommentComposer() {
    requestAnimationFrame(() => {
      commentInputRef.current?.focus();
    });
  }

  function handleOpenCommentComposer() {
    focusCommentComposer();
  }

  function handleOpenProfile(authorId: string) {
    void (async () => {
      if (currentProfileId && authorId === currentProfileId) {
        router.push("/profile" as Href);
        return;
      }

      if (!currentProfileId && authSession.isAuthenticated) {
        try {
          const accessToken = await getValidAccessToken();

          if (accessToken) {
            const profile = await getMyProfile({
              accessToken,
              tokenType: authSession.tokenType,
            });

            setCurrentProfileId(profile.id);
            router.push(
              (authorId === profile.id
                ? "/profile"
                : `/community/profile/${authorId}`) as Href,
            );
            return;
          }
        } catch (error) {
          console.warn("[community-comments] resolve profile route failed", {
            authorId,
            error: error instanceof Error ? error.message : error,
          });
        }
      }

      router.push(`/community/profile/${authorId}` as Href);
    })();
  }

  function openHotspotDetail(hotspotId: number) {
    if (!Number.isInteger(hotspotId) || hotspotId <= 0) {
      return;
    }

    router.push(getHotspotHref(getApiHotspotRouteSlug(hotspotId), hotspotId));
  }

  function openRouteDetail(routeId: number) {
    if (!Number.isInteger(routeId) || routeId <= 0) {
      return;
    }

    router.push(`/route/${routeId}` as Href);
  }

  function handleReplyToComment(item: PostComment) {
    setReplyTarget(item);
    focusCommentComposer();
  }

  function handleCancelReplyTarget() {
    setReplyTarget(null);
  }

  async function handleLikePost(targetPost: CommunityFeedPost) {
    const postNumericId = targetPost.postNumericId;

    if (
      !targetPost.canLike ||
      typeof postNumericId !== "number" ||
      postNumericId <= 0 ||
      isLikingPost
    ) {
      return;
    }

    if (!authSession.isAuthenticated) {
      appAlert.alert(
        t("community.feed.loginRequiredTitle"),
        t("community.feed.loginRequiredLike"),
      );
      return;
    }

    const accessToken = await getValidAccessToken();

    if (!accessToken) {
      appAlert.alert(
        t("community.feed.sessionExpiredTitle"),
        t("community.feed.sessionExpiredLike"),
      );
      return;
    }

    const currentIsLiked =
      targetPost.isLiked === true || likedPostIdsSet.has(postNumericId);
    const currentLikeCount = Math.max(
      0,
      Math.round(targetPost.likeCountValue ?? 0),
    );
    const optimisticIsLiked = !currentIsLiked;
    const optimisticLikeCount = optimisticIsLiked
      ? currentLikeCount + 1
      : Math.max(0, currentLikeCount - 1);
    const optimisticPost = replaceCommunityPostLikeState(targetPost, {
      isLiked: optimisticIsLiked,
      likeCount: optimisticLikeCount,
    });

    setIsLikingPost(true);
    setPost(optimisticPost);
    cacheCommunityPost(optimisticPost);
    updateCachedCommunityPost(postNumericId, () => optimisticPost);

    try {
      const result = await likePost({
        accessToken,
        postId: postNumericId,
        tokenType: authSession.tokenType,
      });
      const resolvedIsLiked = result.isLiked ?? optimisticIsLiked;
      const resolvedLikeCount = result.likeCount ?? optimisticLikeCount;
      const resolvedPost = replaceCommunityPostLikeState(optimisticPost, {
        isLiked: resolvedIsLiked,
        likeCount: resolvedLikeCount,
      });

      setPost(resolvedPost);
      cacheCommunityPost(resolvedPost);
      updateCachedCommunityPost(postNumericId, () => resolvedPost);

      if (likedPostsAccountKey) {
        if (resolvedIsLiked) {
          addLikedPostId(likedPostsAccountKey, postNumericId);
        } else {
          removeLikedPostId(likedPostsAccountKey, postNumericId);
        }
      }
    } catch (error) {
      const revertedPost = replaceCommunityPostLikeState(targetPost, {
        isLiked: currentIsLiked,
        likeCount: currentLikeCount,
      });

      setPost(revertedPost);
      cacheCommunityPost(revertedPost);
      updateCachedCommunityPost(postNumericId, () => revertedPost);

      if (likedPostsAccountKey) {
        if (currentIsLiked) {
          addLikedPostId(likedPostsAccountKey, postNumericId);
        } else {
          removeLikedPostId(likedPostsAccountKey, postNumericId);
        }
      }

      appAlert.alert(
        t("community.feed.likeErrorTitle"),
        error instanceof Error
          ? error.message
          : t("community.feed.likeErrorMessage"),
      );
    } finally {
      setIsLikingPost(false);
    }
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
      appAlert.alert(
        t("community.feed.loginRequiredTitle"),
        t("community.postComments.loginRequiredCommentMessage"),
      );
      return;
    }

    const accessToken = await getValidAccessToken();

    if (!accessToken) {
      appAlert.alert(
        t("community.feed.sessionExpiredTitle"),
        t("community.feed.sessionExpiredComment"),
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
      appAlert.alert(
        t("community.feed.commentSubmitErrorTitle"),
        error instanceof Error
          ? error.message
          : t("community.feed.commentSubmitErrorMessage"),
      );
    } finally {
      setIsSubmittingComment(false);
    }
  }

  if (!post) {
    return <NotFoundState />;
  }

  const postNumericId = post.postNumericId ?? null;
  const isPostLiked =
    (typeof postNumericId === "number" && likedPostIdsSet.has(postNumericId)) ||
    post.isLiked === true;
  const trimmedCommentDraft = commentDraft.trim();
  const replyTargetDisplayName = replyTarget
    ? getCommentDisplayName(replyTarget, t)
    : null;
  const canSubmitComment =
    !isSubmittingComment && trimmedCommentDraft.length > 0;

  return (
    <SafeAreaView className="flex-1 bg-white" edges={["top", "left", "right"]}>
      <View className="flex-1 bg-white">
        <View className="border-b border-[#F2E8EE] bg-white px-4 pb-3 pt-2">
          <View className="flex-row items-center justify-between">
            <Pressable
              className="h-10 w-10 items-center justify-center rounded-full bg-[#FFF1F6]"
              onPress={() => router.back()}
            >
              <SymbolView
                name={{
                  ios: "chevron.left",
                  android: "arrow_back",
                  web: "arrow_back",
                }}
                size={18}
                tintColor="#FF5D8F"
              />
            </Pressable>

            <Text className="text-[16px] font-semibold text-[#6A5564]">
              {t("community.posts.comment")}
            </Text>

            <View className="h-10 w-10" />
          </View>
        </View>

        <View className="flex-1">
          <ScrollView
            className="flex-1"
            keyboardShouldPersistTaps="handled"
            showsVerticalScrollIndicator={false}
            contentContainerStyle={{ paddingBottom: 20 }}
          >
            <View className="pb-2 pt-1">
              <CommunityPostCard
                edgeToEdgeWidth={safeWidth}
                isEmbedded
                isLiked={isPostLiked}
                isLiking={isLikingPost}
                post={post}
                resolvedHotspots={resolvedHotspots}
                resolvedRoutes={resolvedRoutes}
                onCommentPost={handleOpenCommentComposer}
                onLikePost={(targetPost) => {
                  void handleLikePost(targetPost);
                }}
                onOpenProfile={handleOpenProfile}
                onOpenHotspot={openHotspotDetail}
                onOpenRoute={openRouteDetail}
              />
            </View>

            <View className="px-4 pb-4 pt-1">
              {commentsStatus === "loading" ? (
                <View className="mt-5 items-center px-4 py-3">
                  <ActivityIndicator color="#FF5D8F" size="small" />
                </View>
              ) : null}

              {commentsError ? (
                <View className="mt-4 rounded-[20px] bg-[#FFF1F6] px-4 py-4">
                  <Text className="text-[14px] font-bold text-[#B91C1C]">
                    {commentsError}
                  </Text>
                </View>
              ) : null}

              {topLevelComments.length > 0 ? (
                <View className="mt-4 gap-2 px-0 py-0">
                  {topLevelComments.map((item) => (
                    <CommunityCommentThread
                      key={`${item.postActionId}-${item.userId}`}
                      onOpenProfile={handleOpenProfile}
                      onReply={handleReplyToComment}
                      item={item}
                      repliesByParentId={repliesByParentId}
                      replyTargetId={replyTarget?.postActionId ?? null}
                    />
                  ))}
                </View>
              ) : null}

              {commentsStatus === "ready" && topLevelComments.length === 0 ? (
                <View className="mt-0 items-center px-2 py-0">
                  <Image
                    source={postCommentEmptyImage}
                    contentFit="contain"
                    style={{ height: 300, width: 300, marginBottom: -75 }}
                  />
                  <Text className="mt-0 text-[15px] font-semibold text-[#111827]">
                    {t("community.feed.noCommentsTitle")}
                  </Text>
                  <Text
                    className="mt-0 text-center text-[14px] text-[#6B7280]"
                    style={{
                      includeFontPadding: false,
                      lineHeight: lineHeightFor(14),
                    }}
                  >
                    {t("community.feed.noCommentsDescription")}
                  </Text>
                </View>
              ) : null}
            </View>

            {/* Chừa chỗ để bình luận cuối không nằm dưới bàn phím. */}
            <Animated.View style={keyboardSpacerAnimatedStyle} />
          </ScrollView>

          <Animated.View style={composerAnimatedStyle}>
            <View
              className="border-t border-[#F5E8EF] bg-white px-4 pt-2.5"
              style={{ paddingBottom: composerBottomInset }}
            >
              {replyTargetDisplayName ? (
                <View className="mb-2 flex-row items-center justify-between rounded-[16px] bg-[#EFF6FF] px-3 py-2">
                  <Text
                    className="flex-1 text-[12px] font-semibold text-[#2563EB]"
                    numberOfLines={1}
                    style={{
                      includeFontPadding: false,
                      lineHeight: lineHeightFor(12),
                    }}
                  >
                    {t("community.postComments.replyingToLabel", {
                      name: replyTargetDisplayName,
                    })}
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

              <View className="flex-row items-center gap-2">
                <View className="flex-1 flex-row items-center rounded-full border border-[#E9E5EA] bg-white px-3">
                  <TextInput
                    blurOnSubmit={false}
                    className="flex-1 py-2 text-[14px] text-[#111827]"
                    editable={!isSubmittingComment}
                    maxLength={communityCommentMaxLength}
                    ref={commentInputRef}
                    onChangeText={setCommentDraft}
                    onSubmitEditing={() => {
                      if (trimmedCommentDraft.length > 0) {
                        void handleSubmitComment();
                      }
                    }}
                    placeholder={
                      replyTargetDisplayName
                        ? t("community.postComments.replyPlaceholder", {
                            name: replyTargetDisplayName,
                          })
                        : t("community.postComments.commentPlaceholder")
                    }
                    placeholderTextColor="#9CA3AF"
                    returnKeyType="send"
                    style={{ includeFontPadding: false }}
                    value={commentDraft}
                  />
                </View>

                <Pressable
                  className="h-9 w-9 items-center justify-center rounded-full bg-[#FF6A93]"
                  disabled={!canSubmitComment}
                  hitSlop={8}
                  onPress={() => {
                    if (canSubmitComment) {
                      void handleSubmitComment();
                    }
                  }}
                  style={{ opacity: canSubmitComment ? 1 : 0.55 }}
                >
                  {isSubmittingComment ? (
                    <ActivityIndicator color="#FFFFFF" size="small" />
                  ) : (
                    <SymbolView
                      name={{
                        ios: "paperplane.fill",
                        android: "send",
                        web: "send",
                      }}
                      size={15}
                      tintColor="#FFFFFF"
                    />
                  )}
                </Pressable>
              </View>
            </View>
          </Animated.View>
        </View>
      </View>
    </SafeAreaView>
  );
}
