import { AppLoadingScreen } from "@/components/ui/app-loading-screen";
import { SymbolView } from "@/components/ui/symbol-view";
import { UserAvatar, UserAvatarFallback } from "@/components/ui/user-avatar";
import { LinearGradient } from "expo-linear-gradient";
import { useFocusEffect, useRouter, type Href } from "expo-router";
import { StatusBar } from "expo-status-bar";
import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ComponentProps,
} from "react";
import { useTranslation } from "react-i18next";
import {
  ActivityIndicator,
  Alert,
  Animated,
  Image,
  KeyboardAvoidingView,
  Modal,
  Platform,
  Pressable,
  RefreshControl,
  Text as RNText,
  ScrollView,
  StyleSheet,
  TextInput,
  View,
  type TextProps,
} from "react-native";
import {
  SafeAreaView,
  useSafeAreaInsets,
} from "react-native-safe-area-context";

import {
  getValidAccessToken,
  useAuthSession,
  type AuthSession,
} from "@/features/auth/hooks/use-auth-session";
import { commentPost } from "@/features/home/api/comment-post";
import type { CreatedPostResponse } from "@/features/home/api/create-post";
import { deletePost } from "@/features/home/api/delete-post";
import { getHotspotById } from "@/features/home/api/get-hotspot-by-id";
import {
  getPostComments,
  type PostComment,
} from "@/features/home/api/get-post-comments";
import { likePost } from "@/features/home/api/like-post";
import { sharePost } from "@/features/home/api/share-post";
import { ReviewDeleteDialog } from "@/features/home/components/review-delete-dialog";
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
import {
  cacheProfilePost,
  updateCachedProfilePost,
} from "@/features/profile/data/profile-post-cache";
import { mapCreatedPostToProfilePost } from "@/features/profile/lib/map-created-post-to-profile-post";
import type { Profile } from "@/features/profile/types";
import { getRouteById } from "@/features/route/api/route-api";
import { useScreenLayout } from "@/hooks/use-screen-layout";
import {
  getPostVisibilityDescription,
  getPostVisibilityIcon,
  getPostVisibilityLabel,
  normalizePostVisibilityValue,
  postVisibilityOptions,
  type PostVisibilityValue,
} from "@/lib/post-visibility";
import type { SharedPostSummary } from "@/lib/shared-post";
import { bodyLineHeightFor, textStyle } from "@/lib/text-scale";
import { getNewsfeedPosts, type NewsfeedPost } from "../api/get-newsfeed-posts";
import type { CommunityGroupPayload } from "../api/group-api";
import {
  CommunityCreateGroupCard,
  CommunityGroupCompactStateCard,
  CommunityGroupListCard,
  CommunityGroupPlaceholderCard,
} from "../components/community-group-list-ui";
import {
  communityPosts,
  type CommunityPostTopic,
} from "../data/community-demo";
import {
  cacheCommunityExplorerProfile,
  getCachedCommunityExplorerProfile,
} from "../data/community-explorer-profile-cache";
import { cacheCommunityGroupSession } from "../data/community-group-session-store";
import {
  cacheCommunityPost,
  clearCommunityPostCache,
  getCachedCommunityPosts,
  removeCachedCommunityPost,
  updateCachedCommunityPost,
  type CommunityFeedMediaItem,
  type CommunityFeedPost,
} from "../data/community-post-cache";
import {
  useCommunityGroups,
  type CommunityGroupsStatus,
} from "../hooks/use-community-groups";

const PROJECT_WORDMARK = "Công đồng hôm nay";
const detailTextMaxFontSizeMultiplier = 1.05;

const gradientColors = ["#EB489B", "#F58752", "#FFC93C"] as const;

const cardShadowStyle = {
  shadowColor: "rgba(235, 72, 155, 0.14)",
  shadowOpacity: 1,
  shadowRadius: 24,
  shadowOffset: {
    width: 0,
    height: 12,
  },
  elevation: 10,
} as const;

const pillShadowStyle = {
  shadowColor: "rgba(235, 72, 155, 0.12)",
  shadowOpacity: 1,
  shadowRadius: 14,
  shadowOffset: {
    width: 0,
    height: 8,
  },
  elevation: 6,
} as const;

const subtleBorderColor = "#E5E7EB";
const subtleBorderWidth = 0.8;
// Chiều cao phần ảnh header nằm dưới status bar - ảnh thấp lại theo thiết kế.
const headerImageContentHeight = 220;
// Thanh "Chia sẻ trải nghiệm" đè lên mép dưới ảnh header để che đường giao nhau.
const shareBarOverlap = 48;

type SymbolName = ComponentProps<typeof SymbolView>["name"];
type CommunityCommentsStatus = "idle" | "loading" | "ready" | "error";
type CommunityFeedStatus = "idle" | "loading" | "ready" | "error";
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
type CommunityPostMenuItem = {
  description?: string;
  icon: SymbolName;
  isDestructive?: boolean;
  key: "edit-post" | "edit-visibility" | "move-to-trash" | "toggle-notifications";
  label: string;
};
type ComposerIdentity = {
  accountKey: string | null;
  avatarUri: string | null;
  displayName: string;
  username: string | null;
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

const meaninglessTextValues = new Set(["", "string", "null", "undefined"]);
const communityFeedPageSize = 10;
const communityPostCommentsPageSize = 10;
const communityCommentMaxLength = 320;
const communitySharePostMaxLength = 500;

function buildCommunityPostMenuItems(
  t: (key: string, options?: Record<string, unknown>) => string,
): readonly CommunityPostMenuItem[] {
  return [
    {
      key: "edit-post",
      label: t("community.posts.edit"),
      icon: { ios: "pencil", android: "edit", web: "edit" },
    },
    {
      key: "edit-visibility",
      label: t("community.feed.menu.editVisibility"),
      icon: { ios: "lock", android: "lock", web: "lock" },
    },
    {
      key: "move-to-trash",
      label: t("community.feed.menu.moveToTrash"),
      icon: {
        ios: "trash",
        android: "delete_outline",
        web: "delete_outline",
      },
      isDestructive: true,
    },
  ] as const;
}
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

  return meaninglessTextValues.has(trimmedValue.toLowerCase())
    ? null
    : trimmedValue;
}

function normalizeLookupText(value: string) {
  return value
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase();
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

function parseCommunityTimestamp(value: string) {
  const normalizedValue = value.trim().replace(" ", "T");

  if (!normalizedValue) {
    return null;
  }

  const hasTimezone = /(?:Z|[+-]\d{2}:?\d{2})$/i.test(normalizedValue);
  const date = new Date(hasTimezone ? normalizedValue : `${normalizedValue}Z`);

  return Number.isNaN(date.getTime()) ? null : date;
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

function getCommunityCreatedAtTime(isoTimestamp?: string | null) {
  const meaningfulValue = readMeaningfulText(isoTimestamp);

  if (!meaningfulValue) {
    return 0;
  }

  return parseCommunityTimestamp(meaningfulValue)?.getTime() ?? 0;
}

function formatCommunityTime(
  isoTimestamp: string | null | undefined,
  t: (key: string, options?: Record<string, unknown>) => string,
) {
  const createdAtTime = getCommunityCreatedAtTime(isoTimestamp);

  if (!Number.isFinite(createdAtTime) || createdAtTime <= 0) {
    return t("community.time.justNow");
  }

  const currentTime = Date.now();
  const elapsedMilliseconds = currentTime - createdAtTime;

  if (elapsedMilliseconds <= 0) {
    return t("community.time.justNow");
  }

  const minuteInMilliseconds = 60 * 1000;
  const hourInMilliseconds = 60 * minuteInMilliseconds;
  const dayInMilliseconds = 24 * hourInMilliseconds;

  if (elapsedMilliseconds < minuteInMilliseconds) {
    return t("community.time.justNow");
  }

  const elapsedMinutes = Math.floor(elapsedMilliseconds / minuteInMilliseconds);

  if (elapsedMinutes < 60) {
    return t("community.feed.time.minutes", { count: elapsedMinutes });
  }

  const elapsedHours = Math.floor(elapsedMinutes / 60);

  if (elapsedHours < 24) {
    return t("community.feed.time.hours", { count: elapsedHours });
  }

  const elapsedDays = Math.floor(elapsedMilliseconds / dayInMilliseconds);

  if (elapsedDays < 7) {
    return t("community.feed.time.days", { count: elapsedDays });
  }

  if (elapsedDays <= 30) {
    return t("community.feed.time.weeks", {
      count: Math.floor(elapsedDays / 7),
    });
  }

  const elapsedMonths = getElapsedCalendarMonths(createdAtTime, currentTime);

  if (elapsedMonths < 12) {
    return t("community.feed.time.months", {
      count: Math.max(elapsedMonths, 1),
    });
  }

  return t("community.feed.time.years", {
    count: Math.floor(elapsedMonths / 12),
  });
}

function isCurrentUserCommunityPost(
  postAuthorId: string,
  currentProfileId?: string | null,
) {
  const normalizedAuthorId = readMeaningfulText(postAuthorId);
  const normalizedProfileId = readMeaningfulText(currentProfileId);

  return (
    normalizedAuthorId !== null &&
    normalizedProfileId !== null &&
    normalizedAuthorId === normalizedProfileId
  );
}

function getCommunityFeedPostSortTimestamp(post: CommunityFeedPost) {
  const createdAtTime = getCommunityCreatedAtTime(post.createdAt);

  if (createdAtTime > 0) {
    return createdAtTime;
  }

  return typeof post.postNumericId === "number" &&
    Number.isFinite(post.postNumericId)
    ? post.postNumericId
    : 0;
}

function sortCommunityFeedPostsNewestFirst(posts: CommunityFeedPost[]) {
  return [...posts].sort((left, right) => {
    const timestampDifference =
      getCommunityFeedPostSortTimestamp(right) -
      getCommunityFeedPostSortTimestamp(left);

    if (timestampDifference !== 0) {
      return timestampDifference;
    }

    const rightPostId =
      typeof right.postNumericId === "number" &&
      Number.isFinite(right.postNumericId)
        ? right.postNumericId
        : 0;
    const leftPostId =
      typeof left.postNumericId === "number" &&
      Number.isFinite(left.postNumericId)
        ? left.postNumericId
        : 0;

    return rightPostId - leftPostId;
  });
}

function isCommunityGroupLeader(
  group: CommunityGroupPayload,
  currentProfileId?: string | null,
) {
  if (!currentProfileId) {
    return false;
  }

  return readMeaningfulText(group.leaderId) === currentProfileId;
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

function buildComposerIdentityFromSession(
  authSession: AuthSession,
  t: (key: string, options?: Record<string, unknown>) => string,
): ComposerIdentity {
  const normalizedDisplayName = readMeaningfulText(authSession.displayName);
  const normalizedUsername =
    readMeaningfulText(authSession.username)?.replace(/^@/, "") ?? null;
  const accountKey =
    normalizedUsername ??
    normalizedDisplayName ??
    (authSession.isAuthenticated ? "authenticated-user" : null);

  return {
    accountKey,
    avatarUri: null,
    displayName: authSession.isAuthenticated
      ? (normalizedDisplayName ??
        normalizedUsername ??
        t("community.feed.composerIdentity.you"))
      : t("community.feed.composerIdentity.guest"),
    username: normalizedUsername,
  };
}

function buildComposerIdentityFromProfile(
  profile: Profile,
  fallbackIdentity: ComposerIdentity,
): ComposerIdentity {
  const normalizedDisplayName = readMeaningfulText(profile.name);
  const normalizedUsername =
    readMeaningfulText(profile.username)?.replace(/^@/, "") ?? null;

  return {
    accountKey: fallbackIdentity.accountKey,
    avatarUri: readMeaningfulText(profile.avatar),
    displayName:
      normalizedDisplayName ??
      normalizedUsername ??
      fallbackIdentity.displayName,
    username: normalizedUsername ?? fallbackIdentity.username,
  };
}

function buildNewsfeedTags(post: NewsfeedPost) {
  return post.tags
    .map((tag) => readMeaningfulText(tag.name))
    .filter((tag): tag is string => Boolean(tag));
}

function resolveTopicFromNewsfeed(
  post: NewsfeedPost,
  tags: string[],
): CommunityPostTopic {
  const classificationSource = normalizeLookupText(
    `${tags.join(" ")} ${post.text} ${post.displayName} ${post.username}`,
  );

  if (
    classificationSource.includes("am thuc") ||
    classificationSource.includes("mon an") ||
    classificationSource.includes("cho dem")
  ) {
    return "cuisine";
  }

  if (
    classificationSource.includes("nghe thuat") ||
    classificationSource.includes("trien lam") ||
    classificationSource.includes("san khau")
  ) {
    return "art";
  }

  if (
    classificationSource.includes("lich su") ||
    classificationSource.includes("di san") ||
    classificationSource.includes("bao tang")
  ) {
    return "history";
  }

  return "culture";
}

function buildNewsfeedLocation(
  post: {
    hotspotIds: number[];
    routeIds: number[];
  },
  t: (key: string, options?: Record<string, unknown>) => string,
) {
  if (post.hotspotIds.length >= 1) {
    return t("community.feed.location.hotspotTagged", {
      count: post.hotspotIds.length,
    });
  }

  if (post.routeIds.length >= 1) {
    return t("community.feed.location.routeTagged", {
      count: post.routeIds.length,
    });
  }

  return "";
}

function buildNewsfeedMood(
  post: { status: string; visibility: string },
  t: (key: string, options?: Record<string, unknown>) => string,
) {
  const statusLabel =
    readMeaningfulText(post.status)?.toUpperCase() === "APPROVED"
      ? t("community.status.approved")
      : readMeaningfulText(post.status);
  const visibilityValue = readMeaningfulText(post.visibility);
  const visibilityLabel = visibilityValue
    ? getPostVisibilityLabel(visibilityValue)
    : null;
  const segments = [statusLabel, visibilityLabel].filter(
    (value): value is string => Boolean(value),
  );

  return segments.join(" · ") || t("community.feed.defaultMood");
}

function buildNewsfeedBadge(
  post: {
    isTaggedHotspot: boolean;
    isTaggedRoute: boolean;
  },
  t: (key: string, options?: Record<string, unknown>) => string,
) {
  if (post.isTaggedHotspot) {
    return t("community.feed.badge.location");
  }

  if (post.isTaggedRoute) {
    return t("community.feed.badge.route");
  }

  return t("community.feed.badge.feed");
}

function replaceCommunityFeedPostLikeState(
  posts: CommunityFeedPost[],
  postNumericId: number,
  options: {
    isLiked: boolean;
    likeCount: number;
  },
) {
  const normalizedLikeCount = Math.max(0, Math.round(options.likeCount));

  return posts.map((post) =>
    post.postNumericId === postNumericId
      ? {
          ...post,
          isLiked: options.isLiked,
          likeCountValue: normalizedLikeCount,
          likes: formatCompactCount(normalizedLikeCount),
        }
      : post,
  );
}

function replaceCommunityFeedPostShareCount(
  posts: CommunityFeedPost[],
  postNumericId: number,
  shareCount: number,
) {
  const normalizedShareCount = Math.max(0, Math.round(shareCount));

  return posts.map((post) =>
    post.postNumericId === postNumericId
      ? {
          ...post,
          shareCountValue: normalizedShareCount,
          shares: formatCompactCount(normalizedShareCount),
        }
      : post,
  );
}

function replaceCommunityFeedPostCommentCount(
  posts: CommunityFeedPost[],
  postNumericId: number,
  commentCount: number,
) {
  const normalizedCommentCount = Math.max(0, Math.round(commentCount));

  return posts.map((post) =>
    post.postNumericId === postNumericId
      ? {
          ...post,
          commentCountValue: normalizedCommentCount,
          comments: formatCompactCount(normalizedCommentCount),
        }
      : post,
  );
}

function formatCommunityTagLabel(tag: string) {
  const meaningfulTag = readMeaningfulText(tag)
    ?.replace(/^#/, "")
    .replace(/\s+/g, "_");

  return meaningfulTag ? `#${meaningfulTag}` : null;
}

function stripTrailingHashtagBlock(content: string) {
  const normalizedContent = content.trim();

  if (!normalizedContent) {
    return normalizedContent;
  }

  const lines = normalizedContent.split(/\r?\n/).map((line) => line.trimEnd());
  let lastMeaningfulLineIndex = lines.length - 1;

  while (
    lastMeaningfulLineIndex >= 0 &&
    lines[lastMeaningfulLineIndex]?.trim() === ""
  ) {
    lastMeaningfulLineIndex -= 1;
  }

  if (lastMeaningfulLineIndex < 0) {
    return "";
  }

  const trailingLine = lines[lastMeaningfulLineIndex]?.trim() ?? "";
  const hashtagLinePattern = /^(#[\p{L}\p{N}_-]+)(\s+#[\p{L}\p{N}_-]+)*$/u;

  if (!hashtagLinePattern.test(trailingLine)) {
    return normalizedContent;
  }

  let previousMeaningfulLineIndex = lastMeaningfulLineIndex - 1;

  while (
    previousMeaningfulLineIndex >= 0 &&
    lines[previousMeaningfulLineIndex]?.trim() === ""
  ) {
    previousMeaningfulLineIndex -= 1;
  }

  if (previousMeaningfulLineIndex < 0) {
    return "";
  }

  return lines
    .slice(0, previousMeaningfulLineIndex + 1)
    .join("\n")
    .trimEnd();
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

function mergeCommunityFeedPostsWithCache(posts: CommunityFeedPost[]) {
  const cachedEntries = getCachedCommunityPosts().sort(
    (left, right) => right.updatedAt - left.updatedAt,
  );

  if (cachedEntries.length === 0) {
    return posts;
  }

  const cachedPostsById = new Map(
    cachedEntries.map((entry) => [entry.postId, entry.post] as const),
  );
  let hasChanges = false;

  const next = posts.map((post) => {
    const postNumericId = post.postNumericId;

    if (typeof postNumericId !== "number" || postNumericId <= 0) {
      return post;
    }

    const cachedPost = cachedPostsById.get(postNumericId);

    if (!cachedPost) {
      return post;
    }

    hasChanges = true;
    return cachedPost;
  });

  const nextPostIds = new Set(
    next
      .map((post) => post.postNumericId)
      .filter(
        (postNumericId): postNumericId is number =>
          typeof postNumericId === "number" && postNumericId > 0,
      ),
  );
  const missingCachedPosts = cachedEntries
    .map((entry) => entry.post)
    .filter((post) => {
      const postNumericId = post.postNumericId;

      return (
        typeof postNumericId === "number" &&
        postNumericId > 0 &&
        !nextPostIds.has(postNumericId)
      );
    });

  if (!hasChanges && missingCachedPosts.length === 0) {
    return sortCommunityFeedPostsNewestFirst(posts);
  }

  return sortCommunityFeedPostsNewestFirst([...missingCachedPosts, ...next]);
}

function dedupeCommunityFeedPosts(posts: CommunityFeedPost[]) {
  const seenPostIds = new Set<number>();
  const seenFallbackIds = new Set<string>();

  return posts.filter((post) => {
    const postNumericId = post.postNumericId;

    if (typeof postNumericId === "number" && postNumericId > 0) {
      if (seenPostIds.has(postNumericId)) {
        return false;
      }

      seenPostIds.add(postNumericId);
      return true;
    }

    if (seenFallbackIds.has(post.id)) {
      return false;
    }

    seenFallbackIds.add(post.id);
    return true;
  });
}

function mapNewsfeedPostToCommunityFeedPost(
  post: NewsfeedPost,
  t: (key: string, options?: Record<string, unknown>) => string,
): CommunityFeedPost {
  const author =
    readMeaningfulText(post.displayName) ??
    readMeaningfulText(post.username) ??
    t("community.feed.fallbackUserName");
  const tags = buildNewsfeedTags(post);
  const topic = resolveTopicFromNewsfeed(post, tags);
  const mediaItems: CommunityFeedMediaItem[] = post.medias
    .filter(
      (media) =>
        media.type.trim().toUpperCase() === "IMAGE" &&
        Boolean(readMeaningfulText(media.url)),
    )
    .map((media) => ({
      key: `${post.postId}-media-${media.id}`,
      source: {
        uri: media.url,
      },
    }));
  const firstMediaItem = mediaItems[0] ?? null;
  const engagementTotal =
    (post.likeCount ?? 0) +
    (post.commentCount ?? 0) +
    (post.replyCount ?? 0) +
    (post.shareCount ?? 0);

  return {
    id: `newsfeed-post-${post.postId}`,
    authorId: `${post.userNumericId}`,
    author,
    initials: getNameInitials(author),
    role: readMeaningfulText(post.username)
      ? `@${post.username.trim()}`
      : t("community.feed.fallbackRole"),
    time: formatCommunityTime(post.createdAt, t),
    caption:
      readMeaningfulText(stripTrailingHashtagBlock(post.text)) ??
      (post.sharedPost ? "" : t("community.feed.fallbackCaption")),
    location: buildNewsfeedLocation(post, t),
    mood: buildNewsfeedMood(post, t),
    badge: post.sharedPost ? t("community.feed.badge.shared") : buildNewsfeedBadge(post, t),
    hotScore: formatCompactCount(engagementTotal),
    views: formatCompactCount(post.pointRemaining ?? 0),
    likes: formatCompactCount(post.likeCount),
    comments: formatCompactCount(post.commentCount),
    replies: formatCompactCount(post.replyCount),
    shares: formatCompactCount(post.shareCount),
    topic,
    isFollowing: false,
    tags,
    image: firstMediaItem?.source ?? null,
    hotspotIds: post.hotspotIds,
    routeIds: post.routeIds,
    commentCountValue: post.commentCount,
    isLiked: post.isLiked === true,
    likeCountValue: post.likeCount,
    mediaItems,
    postNumericId: post.postId,
    replyCountValue: post.replyCount,
    shareCountValue: post.shareCount,
    sharedPost: post.sharedPost,
    avatarColors: getAvatarPalette(`${author}-${post.userNumericId}`),
    canComment: true,
    canLike: true,
    canOpenProfile: true,
    createdAt: post.createdAt,
    status: readMeaningfulText(post.status) ?? "",
    visibility: readMeaningfulText(post.visibility) ?? "PUBLIC",
  };
}

function mapSharedPostToCommunityFeedPost(
  sharedPost: CreatedPostResponse,
  t: (key: string, options?: Record<string, unknown>) => string,
): CommunityFeedPost {
  const author =
    readMeaningfulText(sharedPost.displayName) ??
    readMeaningfulText(sharedPost.username) ??
    t("community.feed.fallbackUserName");
  const tags = sharedPost.tags
    .map((tag) => readMeaningfulText(tag.tagName))
    .filter((tag): tag is string => Boolean(tag));
  const mediaItems: CommunityFeedMediaItem[] = sharedPost.medias
    .filter(
      (media) =>
        media.mediaType.trim().toUpperCase() === "IMAGE" &&
        Boolean(readMeaningfulText(media.fileUrl)),
    )
    .map((media) => ({
      key: `${sharedPost.postId}-media-${media.mediaId}`,
      source: {
        uri: media.fileUrl,
      },
    }));
  const originalPost = sharedPost.sharedPost;
  const normalizedVisibility = normalizePostVisibilityValue(
    sharedPost.visibility,
  );
  const shareCount = Math.max(0, Math.round(sharedPost.shareCount ?? 0));
  const likeCount = Math.max(0, Math.round(sharedPost.likeCount ?? 0));
  const commentCount = Math.max(0, Math.round(sharedPost.commentCount ?? 0));

  return {
    id: `newsfeed-post-${sharedPost.postId}`,
    authorId: `${sharedPost.userId}`,
    author,
    initials: getNameInitials(author),
    role: readMeaningfulText(sharedPost.username)
      ? `@${sharedPost.username.trim()}`
      : t("community.feed.fallbackRole"),
    time: formatCommunityTime(sharedPost.createdAt, t),
    caption:
      readMeaningfulText(stripTrailingHashtagBlock(sharedPost.content)) ?? "",
    location: buildNewsfeedLocation(sharedPost, t),
    mood: buildNewsfeedMood(
      {
        status: sharedPost.status,
        visibility: normalizedVisibility,
      },
      t,
    ),
    badge: originalPost
      ? t("community.feed.badge.shared")
      : buildNewsfeedBadge(sharedPost, t),
    hotScore: formatCompactCount(likeCount + commentCount + shareCount),
    views: formatCompactCount(sharedPost.pointRemaining ?? 0),
    likes: formatCompactCount(likeCount),
    comments: formatCompactCount(commentCount),
    replies: formatCompactCount(0),
    shares: formatCompactCount(shareCount),
    topic: "culture",
    isFollowing: false,
    tags,
    image: mediaItems[0]?.source ?? null,
    hotspotIds: sharedPost.hotspotIds,
    routeIds: sharedPost.routeIds,
    commentCountValue: commentCount,
    isLiked: sharedPost.isLiked === true,
    likeCountValue: likeCount,
    mediaItems,
    postNumericId: sharedPost.postId,
    replyCountValue: 0,
    shareCountValue: shareCount,
    sharedPost: originalPost,
    avatarColors: getAvatarPalette(`${author}-${sharedPost.userId}`),
    canComment: true,
    canLike: true,
    canOpenProfile: true,
    createdAt: sharedPost.createdAt,
    status: readMeaningfulText(sharedPost.status) ?? "",
    visibility: normalizedVisibility,
  };
}

function CommunityLoadingState() {
  return (
    <View className="flex-1 bg-white">
      <AppLoadingScreen />
    </View>
  );
}

export default function CommunityScreen() {
  const { t } = useTranslation();
  const router = useRouter();
  const authSession = useAuthSession();
  const insets = useSafeAreaInsets();
  const { gutter, safeWidth } = useScreenLayout({ maxContentWidth: 640 });
  const communitySessionKey = authSession.isAuthenticated
    ? authSession.username?.trim() ||
      authSession.displayName.trim() ||
      "authenticated-user"
    : "guest";
  const likedPostsAccountKey = authSession.isAuthenticated
    ? authSession.username?.trim() || authSession.displayName.trim() || null
    : null;
  const fallbackComposerIdentity =
    buildComposerIdentityFromSession(authSession, t);
  const [communityFeedPosts, setCommunityFeedPosts] = useState<
    CommunityFeedPost[]
  >([]);
  const [communityFeedError, setCommunityFeedError] = useState<string | null>(
    null,
  );
  const [, setRequestedHotspotIds] = useState<Record<number, true>>({});
  const [resolvedHotspots, setResolvedHotspots] = useState<
    Record<number, ResolvedHotspotPreview>
  >({});
  const [, setRequestedRouteIds] = useState<Record<number, true>>({});
  const [resolvedRoutes, setResolvedRoutes] = useState<
    Record<number, ResolvedRoutePreview>
  >({});
  const [commentDraft, setCommentDraft] = useState("");
  const [commentTargetPost, setCommentTargetPost] =
    useState<CommunityFeedPost | null>(null);
  const [communityPostComments, setCommunityPostComments] = useState<
    PostComment[]
  >([]);
  const [communityPostCommentsError, setCommunityPostCommentsError] = useState<
    string | null
  >(null);
  const [communityPostCommentsStatus, setCommunityPostCommentsStatus] =
    useState<CommunityCommentsStatus>("idle");
  const [isCommentSubmitting, setIsCommentSubmitting] = useState(false);
  const [deletingPostIds, setDeletingPostIds] = useState<number[]>([]);
  const [postPendingDeletion, setPostPendingDeletion] =
    useState<CommunityFeedPost | null>(null);
  const [postOptionsTarget, setPostOptionsTarget] =
    useState<CommunityFeedPost | null>(null);
  const [communityToastMessage, setCommunityToastMessage] = useState<
    string | null
  >(null);
  const [communityToastAction, setCommunityToastAction] = useState<{
    label: string;
    onPress: () => void;
  } | null>(null);
  const [likingPostIds, setLikingPostIds] = useState<number[]>([]);
  const [sharePostTarget, setSharePostTarget] =
    useState<CommunityFeedPost | null>(null);
  const [shareDraft, setShareDraft] = useState("");
  const [shareVisibility, setShareVisibility] =
    useState<PostVisibilityValue>("PUBLIC");
  const [isSharingPost, setIsSharingPost] = useState(false);
  const [communityFeedStatus, setCommunityFeedStatus] =
    useState<CommunityFeedStatus>("loading");
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [composerIdentity, setComposerIdentity] = useState<ComposerIdentity>(
    fallbackComposerIdentity,
  );
  const [currentProfileId, setCurrentProfileId] = useState<string | null>(null);
  const communitySessionKeyRef = useRef(communitySessionKey);
  const communityFeedPostsRef = useRef<CommunityFeedPost[]>([]);
  const shareBarTextOpacity = useMemo(() => new Animated.Value(1), []);
  const fadeShareBarText = (toValue: number) => {
    Animated.timing(shareBarTextOpacity, {
      duration: 140,
      toValue,
      useNativeDriver: true,
    }).start();
  };
  const hasSkippedInitialFeedFocusRef = useRef(false);
  const communityToastTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(
    null,
  );
  const persistedLikedPostIds = useLikedPostIds(likedPostsAccountKey);
  const {
    errorMessage: communityGroupsError,
    groups: communityGroups,
    reload: reloadCommunityGroups,
    status: communityGroupsStatus,
  } = useCommunityGroups();

  useEffect(() => {
    communitySessionKeyRef.current = communitySessionKey;
  }, [communitySessionKey]);

  useEffect(() => {
    communityFeedPostsRef.current = communityFeedPosts;
  }, [communityFeedPosts]);

  useEffect(() => {
    if (communityToastTimeoutRef.current) {
      clearTimeout(communityToastTimeoutRef.current);
      communityToastTimeoutRef.current = null;
    }

    if (!communityToastMessage) {
      return;
    }

    communityToastTimeoutRef.current = setTimeout(() => {
      setCommunityToastMessage(null);
      setCommunityToastAction(null);
      communityToastTimeoutRef.current = null;
    }, 2600);

    return () => {
      if (communityToastTimeoutRef.current) {
        clearTimeout(communityToastTimeoutRef.current);
        communityToastTimeoutRef.current = null;
      }
    };
  }, [communityToastMessage]);

  const showCommunityToast = useCallback(
    (
      message: string,
      action?: { label: string; onPress: () => void } | null,
    ) => {
      setCommunityToastMessage(message);
      setCommunityToastAction(action ?? null);
    },
    [],
  );

  useEffect(() => {
    clearCommunityPostCache();
    communityFeedPostsRef.current = [];
    hasSkippedInitialFeedFocusRef.current = false;
  }, [communitySessionKey]);

  const fetchCommunityNewsfeed = useCallback(async () => {
    const accessToken = authSession.isAuthenticated
      ? await getValidAccessToken()
      : null;
    const response = await getNewsfeedPosts({
      accessToken,
      page: 0,
      size: communityFeedPageSize,
      tokenType: authSession.tokenType,
    });
    const mappedPosts = response.content
      .filter(
        (post) => normalizePostVisibilityValue(post.visibility) !== "PRIVATE",
      )
      .map((post) => mapNewsfeedPostToCommunityFeedPost(post, t));

    mappedPosts.forEach(cacheCommunityExplorerProfile);

    return mergeCommunityFeedPostsWithCache(mappedPosts);
  }, [authSession.isAuthenticated, authSession.tokenType, t]);

  useEffect(() => {
    let isActive = true;
    const sessionKeyAtRequestStart = communitySessionKey;

    async function loadCommunityNewsfeed() {
      setCommunityFeedStatus("loading");
      setCommunityFeedError(null);

      try {
        const mappedPosts = await fetchCommunityNewsfeed();

        if (
          !isActive ||
          communitySessionKeyRef.current !== sessionKeyAtRequestStart
        ) {
          return;
        }

        setCommunityFeedPosts(mappedPosts);
        setCommunityFeedStatus("ready");
      } catch (error) {
        console.warn("[community] load newsfeed failed", {
          error: error instanceof Error ? error.message : error,
        });

        if (
          !isActive ||
          communitySessionKeyRef.current !== sessionKeyAtRequestStart
        ) {
          return;
        }

        setCommunityFeedPosts([]);
        setCommunityFeedError(
          error instanceof Error
            ? error.message
            : t("community.feed.loadError"),
        );
        setCommunityFeedStatus("error");
      }
    }

    void loadCommunityNewsfeed();

    return () => {
      isActive = false;
    };
  }, [communitySessionKey, fetchCommunityNewsfeed, t]);

  useEffect(() => {
    communityFeedPosts.forEach(cacheCommunityExplorerProfile);
  }, [communityFeedPosts]);

  const hotspotIdsToResolve = useMemo(() => {
    const hotspotIds = new Set<number>();

    for (const post of communityFeedPosts) {
      for (const hotspotId of [
        ...(post.hotspotIds ?? []),
        ...(post.sharedPost?.hotspotIds ?? []),
      ]) {
        if (Number.isInteger(hotspotId) && hotspotId > 0) {
          hotspotIds.add(hotspotId);
        }
      }
    }

    return Array.from(hotspotIds);
  }, [communityFeedPosts]);

  const routeIdsToResolve = useMemo(() => {
    const routeIds = new Set<number>();

    for (const post of communityFeedPosts) {
      for (const routeId of [
        ...(post.routeIds ?? []),
        ...(post.sharedPost?.routeIds ?? []),
      ]) {
        if (Number.isInteger(routeId) && routeId > 0) {
          routeIds.add(routeId);
        }
      }
    }

    return Array.from(routeIds);
  }, [communityFeedPosts]);

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

        setRequestedHotspotIds((current) => {
          const next = { ...current };

          for (const hotspotId of hotspotIdsToResolve) {
            next[hotspotId] = true;
          }

          return next;
        });
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
        console.warn("[community] load hotspot previews failed", {
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

        setRequestedRouteIds((current) => {
          const next = { ...current };

          for (const routeId of routeIdsToResolve) {
            next[routeId] = true;
          }

          return next;
        });
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
        console.warn("[community] load route previews failed", {
          error: error instanceof Error ? error.message : error,
        });
      }
    }

    void loadRoutePreviews();

    return () => {
      isActive = false;
    };
  }, [
    authSession.isAuthenticated,
    authSession.tokenType,
    routeIdsToResolve,
    t,
  ]);

  const displayedPosts = useMemo<CommunityFeedPost[]>(
    () =>
      dedupeCommunityFeedPosts(
        communityFeedStatus === "ready"
          ? communityFeedPosts
          : communityFeedStatus === "error"
            ? communityPosts.slice()
            : [],
      ),
    [communityFeedPosts, communityFeedStatus],
  );
  const likedPostIdsSet = useMemo(
    () => new Set(persistedLikedPostIds),
    [persistedLikedPostIds],
  );
  const likingPostIdsSet = useMemo(
    () => new Set(likingPostIds),
    [likingPostIds],
  );
  const deletingPostIdsSet = useMemo(
    () => new Set(deletingPostIds),
    [deletingPostIds],
  );
  const resolvedComposerIdentity =
    composerIdentity.accountKey === fallbackComposerIdentity.accountKey
      ? composerIdentity
      : fallbackComposerIdentity;
  const composerPlaceholderText = authSession.isAuthenticated
    ? t("community.feed.composerPlaceholder.authenticated")
    : t("community.feed.composerPlaceholder.guest");
  const previewCommunityGroups = useMemo(
    () => communityGroups.slice(0, 3),
    [communityGroups],
  );
  const showInitialCommunityLoading =
    communityFeedStatus === "loading" && communityFeedPosts.length === 0;

  const handleRefresh = useCallback(async () => {
    if (isRefreshing) {
      return;
    }

    setIsRefreshing(true);
    setCommunityFeedError(null);

    try {
      const [mappedPosts] = await Promise.all([
        fetchCommunityNewsfeed(),
        reloadCommunityGroups(),
      ]);

      setCommunityFeedPosts(mappedPosts);
      setCommunityFeedStatus("ready");
    } catch (error) {
      console.warn("[community] pull to refresh newsfeed failed", {
        error: error instanceof Error ? error.message : error,
      });

      if (communityFeedPostsRef.current.length === 0) {
        setCommunityFeedPosts([]);
        setCommunityFeedError(
          error instanceof Error
            ? error.message
            : t("community.feed.loadError"),
        );
        setCommunityFeedStatus("error");
      } else {
        Alert.alert(
          t("community.feed.refreshErrorTitle"),
          error instanceof Error
            ? error.message
            : t("community.feed.refreshError"),
        );
      }
    } finally {
      setIsRefreshing(false);
    }
  }, [fetchCommunityNewsfeed, isRefreshing, reloadCommunityGroups, t]);

  useFocusEffect(
    useCallback(() => {
      if (!hasSkippedInitialFeedFocusRef.current) {
        hasSkippedInitialFeedFocusRef.current = true;
        return undefined;
      }

      let isActive = true;

      async function refetchCommunityNewsfeedOnFocus() {
        const shouldShowLoadingState =
          communityFeedPostsRef.current.length === 0;

        if (shouldShowLoadingState) {
          setCommunityFeedStatus("loading");
        }

        setCommunityFeedError(null);

        try {
          const mappedPosts = await fetchCommunityNewsfeed();

          if (!isActive) {
            return;
          }

          setCommunityFeedPosts(mappedPosts);
          setCommunityFeedStatus("ready");
        } catch (error) {
          console.warn("[community] refetch newsfeed on focus failed", {
            error: error instanceof Error ? error.message : error,
          });

          if (!isActive) {
            return;
          }

          if (communityFeedPostsRef.current.length === 0) {
            setCommunityFeedPosts([]);
            setCommunityFeedError(
              error instanceof Error
                ? error.message
                : t("community.feed.loadError"),
            );
            setCommunityFeedStatus("error");
            return;
          }

          setCommunityFeedError(
            error instanceof Error
              ? error.message
              : t("community.feed.refreshError"),
          );
          setCommunityFeedStatus("ready");
        }
      }

      void refetchCommunityNewsfeedOnFocus();

      return () => {
        isActive = false;
      };
    }, [fetchCommunityNewsfeed, t]),
  );

  useFocusEffect(
    useCallback(() => {
      let isActive = true;
      const sessionKeyAtRequestStart = communitySessionKey;

      async function loadComposerIdentity() {
        if (!authSession.isAuthenticated) {
          if (
            !isActive ||
            communitySessionKeyRef.current !== sessionKeyAtRequestStart
          ) {
            return;
          }

          setCurrentProfileId(null);
          setComposerIdentity(fallbackComposerIdentity);
          return;
        }

        try {
          const accessToken = await getValidAccessToken();

          if (!accessToken) {
            if (
              !isActive ||
              communitySessionKeyRef.current !== sessionKeyAtRequestStart
            ) {
              return;
            }

            setComposerIdentity(fallbackComposerIdentity);
            setCurrentProfileId(null);
            return;
          }

          const profile = await getMyProfile({
            accessToken,
            tokenType: authSession.tokenType,
          });

          if (
            !isActive ||
            communitySessionKeyRef.current !== sessionKeyAtRequestStart
          ) {
            return;
          }

          setCurrentProfileId(profile.id);
          setComposerIdentity(
            buildComposerIdentityFromProfile(profile, fallbackComposerIdentity),
          );
        } catch (error) {
          console.warn("[community] load composer identity failed", {
            error: error instanceof Error ? error.message : error,
          });

          if (
            !isActive ||
            communitySessionKeyRef.current !== sessionKeyAtRequestStart
          ) {
            return;
          }

          setCurrentProfileId(null);
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
      communitySessionKey,
      fallbackComposerIdentity,
    ]),
  );

  useFocusEffect(
    useCallback(() => {
      setCommunityFeedPosts((current) => {
        return mergeCommunityFeedPostsWithCache(current);
      });
    }, []),
  );

  const openCommunityGroupCreate = () => {
    router.push("/community/group-create" as Href);
  };
  const openCommunityGroupsList = () => {
    router.push("/community/groups" as Href);
  };
  const handleOpenDiscoverGroup = (group: CommunityGroupPayload) => {
    const cachedGroup = cacheCommunityGroupSession({
      ...group,
      source: "listed",
    });

    if (!cachedGroup) {
      Alert.alert(
        t("community.groupsCommon.openErrorTitle"),
        t("community.groupsCommon.openErrorMessage"),
      );
      return;
    }

    const detailRouteKey = cachedGroup.groupId ?? cachedGroup.shareToken;

    router.push(
      `/community/group/${encodeURIComponent(detailRouteKey)}` as Href,
    );
  };
  const openExplorerProfile = (authorId: string) => {
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
          console.warn("[community] resolve profile route failed", {
            authorId,
            error: error instanceof Error ? error.message : error,
          });
        }
      }

      router.push(`/community/profile/${authorId}` as Href);
    })();
  };
  const openHotspotDetail = (hotspotId: number) => {
    router.push(getHotspotHref(getApiHotspotRouteSlug(hotspotId), hotspotId));
  };
  const openRouteDetail = (routeId: number) => {
    router.push(`/route/${routeId}` as Href);
  };

  async function handleReloadPostComments(postNumericId: number) {
    setCommunityPostCommentsStatus("loading");
    setCommunityPostCommentsError(null);

    try {
      const accessToken = authSession.isAuthenticated
        ? await getValidAccessToken()
        : null;
      const response = await getPostComments({
        accessToken,
        page: 0,
        postId: postNumericId,
        size: communityPostCommentsPageSize,
        tokenType: authSession.tokenType,
      });

      setCommunityPostComments(response.content);
      setCommunityPostCommentsStatus("ready");
    } catch (error) {
      setCommunityPostComments([]);
      setCommunityPostCommentsError(
        error instanceof Error
          ? error.message
          : t("community.feed.commentsLoadError"),
      );
      setCommunityPostCommentsStatus("error");
    }
  }

  useEffect(() => {
    const postNumericId = commentTargetPost?.postNumericId;

    if (typeof postNumericId !== "number" || postNumericId <= 0) {
      return;
    }

    const resolvedPostNumericId = postNumericId;
    let isActive = true;

    async function loadPostComments() {
      setCommunityPostCommentsStatus("loading");
      setCommunityPostCommentsError(null);

      try {
        const accessToken = authSession.isAuthenticated
          ? await getValidAccessToken()
          : null;
        const response = await getPostComments({
          accessToken,
          page: 0,
          postId: resolvedPostNumericId,
          size: communityPostCommentsPageSize,
          tokenType: authSession.tokenType,
        });

        if (!isActive) {
          return;
        }

        setCommunityPostComments(response.content);
        setCommunityPostCommentsStatus("ready");
      } catch (error) {
        if (!isActive) {
          return;
        }

        setCommunityPostComments([]);
        setCommunityPostCommentsError(
          error instanceof Error
            ? error.message
            : t("community.feed.commentsLoadError"),
        );
        setCommunityPostCommentsStatus("error");
      }
    }

    void loadPostComments();

    return () => {
      isActive = false;
    };
  }, [
    authSession.isAuthenticated,
    authSession.tokenType,
    commentTargetPost?.postNumericId,
    t,
  ]);

  function handleOpenCommentComposer(post: CommunityFeedPost) {
    const postNumericId = post.postNumericId;

    if (
      !post.canComment ||
      typeof postNumericId !== "number" ||
      postNumericId <= 0
    ) {
      return;
    }

    cacheCommunityPost(post);
    router.push(`/community/post/${postNumericId}` as Href);
  }

  function handleCloseCommentComposer() {
    if (isCommentSubmitting) {
      return;
    }

    setCommentDraft("");
    setCommunityPostComments([]);
    setCommunityPostCommentsError(null);
    setCommunityPostCommentsStatus("idle");
    setCommentTargetPost(null);
  }

  async function handleRetryLoadComments() {
    const postNumericId = commentTargetPost?.postNumericId;

    if (typeof postNumericId !== "number" || postNumericId <= 0) {
      return;
    }

    await handleReloadPostComments(postNumericId);
  }

  async function handleSubmitComment() {
    const postNumericId = commentTargetPost?.postNumericId;
    const trimmedComment = commentDraft.trim();

    if (typeof postNumericId !== "number" || postNumericId <= 0) {
      return;
    }

    if (!trimmedComment) {
      Alert.alert(
        t("community.feed.missingContentTitle"),
        t("community.feed.missingCommentMessage"),
      );
      return;
    }

    const accessToken = await getValidAccessToken();

    if (!accessToken) {
      Alert.alert(
        t("community.feed.sessionExpiredTitle"),
        t("community.feed.sessionExpiredComment"),
      );
      return;
    }

    setIsCommentSubmitting(true);

    try {
      const result = await commentPost({
        accessToken,
        comment: trimmedComment,
        postId: postNumericId,
        tokenType: authSession.tokenType,
      });

      setCommunityFeedPosts((current) => {
        const currentPost = current.find(
          (post) => post.postNumericId === postNumericId,
        );
        const nextCommentCount =
          result.commentCount !== null
            ? result.commentCount
            : Math.max(0, Math.round(currentPost?.commentCountValue ?? 0)) + 1;

        return replaceCommunityFeedPostCommentCount(
          current,
          postNumericId,
          nextCommentCount,
        );
      });
      setCommentDraft("");
      await handleReloadPostComments(postNumericId);
    } catch (error) {
      Alert.alert(
        t("community.feed.commentSubmitErrorTitle"),
        error instanceof Error
          ? error.message
          : t("community.feed.commentSubmitErrorMessage"),
      );
    } finally {
      setIsCommentSubmitting(false);
    }
  }

  async function handleLikePost(post: CommunityFeedPost) {
    const postNumericId = post.postNumericId;

    if (
      !post.canLike ||
      typeof postNumericId !== "number" ||
      postNumericId <= 0
    ) {
      return;
    }

    if (likingPostIds.includes(postNumericId)) {
      return;
    }

    if (!authSession.isAuthenticated) {
      Alert.alert(
        t("community.feed.loginRequiredTitle"),
        t("community.feed.loginRequiredLike"),
      );
      return;
    }

    const accessToken = await getValidAccessToken();

    if (!accessToken) {
      Alert.alert(
        t("community.feed.sessionExpiredTitle"),
        t("community.feed.sessionExpiredLike"),
      );
      return;
    }

    const currentIsLiked =
      post.isLiked === true || persistedLikedPostIds.includes(postNumericId);
    const currentLikeCount = Math.max(0, Math.round(post.likeCountValue ?? 0));
    const optimisticIsLiked = !currentIsLiked;
    const optimisticLikeCount = optimisticIsLiked
      ? currentLikeCount + 1
      : Math.max(0, currentLikeCount - 1);

    setLikingPostIds((current) =>
      current.includes(postNumericId) ? current : [...current, postNumericId],
    );
    setCommunityFeedPosts((current) =>
      replaceCommunityFeedPostLikeState(current, postNumericId, {
        isLiked: optimisticIsLiked,
        likeCount: optimisticLikeCount,
      }),
    );
    updateCachedCommunityPost(postNumericId, (currentPost) => ({
      ...currentPost,
      isLiked: optimisticIsLiked,
      likeCountValue: optimisticLikeCount,
      likes: formatCompactCount(optimisticLikeCount),
    }));

    try {
      const result = await likePost({
        accessToken,
        postId: postNumericId,
        tokenType: authSession.tokenType,
      });

      const resolvedIsLiked = result.isLiked ?? optimisticIsLiked;
      const resolvedLikeCount = result.likeCount ?? optimisticLikeCount;

      setCommunityFeedPosts((current) =>
        replaceCommunityFeedPostLikeState(current, postNumericId, {
          isLiked: resolvedIsLiked,
          likeCount: resolvedLikeCount,
        }),
      );
      updateCachedCommunityPost(postNumericId, (currentPost) => ({
        ...currentPost,
        isLiked: resolvedIsLiked,
        likeCountValue: resolvedLikeCount,
        likes: formatCompactCount(resolvedLikeCount),
      }));

      if (likedPostsAccountKey) {
        if (resolvedIsLiked) {
          addLikedPostId(likedPostsAccountKey, postNumericId);
        } else {
          removeLikedPostId(likedPostsAccountKey, postNumericId);
        }
      }
    } catch (error) {
      setCommunityFeedPosts((current) =>
        replaceCommunityFeedPostLikeState(current, postNumericId, {
          isLiked: currentIsLiked,
          likeCount: currentLikeCount,
        }),
      );
      updateCachedCommunityPost(postNumericId, (currentPost) => ({
        ...currentPost,
        isLiked: currentIsLiked,
        likeCountValue: currentLikeCount,
        likes: formatCompactCount(currentLikeCount),
      }));

      if (likedPostsAccountKey) {
        if (currentIsLiked) {
          addLikedPostId(likedPostsAccountKey, postNumericId);
        } else {
          removeLikedPostId(likedPostsAccountKey, postNumericId);
        }
      }

      Alert.alert(
        t("community.feed.likeErrorTitle"),
        error instanceof Error
          ? error.message
          : t("community.feed.likeErrorMessage"),
      );
    } finally {
      setLikingPostIds((current) =>
        current.filter((id) => id !== postNumericId),
      );
    }
  }

  function handleOpenSharePostComposer(post: CommunityFeedPost) {
    const postNumericId = post.postNumericId;

    if (typeof postNumericId !== "number" || postNumericId <= 0) {
      Alert.alert(
        t("community.feed.shareErrorTitle"),
        t("community.feed.shareInvalidIdMessage"),
      );
      return;
    }

    if (!authSession.isAuthenticated) {
      Alert.alert(
        t("community.feed.loginRequiredTitle"),
        t("community.feed.loginRequiredShare"),
      );
      return;
    }

    setShareDraft("");
    setShareVisibility("PUBLIC");
    setSharePostTarget(post);
  }

  function handleCloseSharePostComposer() {
    if (isSharingPost) {
      return;
    }

    setShareDraft("");
    setShareVisibility("PUBLIC");
    setSharePostTarget(null);
  }

  async function handleSubmitSharePost() {
    const post = sharePostTarget;
    const postNumericId = post?.postNumericId;

    if (!post || typeof postNumericId !== "number" || postNumericId <= 0) {
      return;
    }

    const accessToken = await getValidAccessToken();

    if (!accessToken) {
      Alert.alert(
        t("community.feed.sessionExpiredTitle"),
        t("community.feed.sessionExpiredShare"),
      );
      return;
    }

    setIsSharingPost(true);

    try {
      const sharedPost = await sharePost({
        accessToken,
        content: shareDraft,
        postId: postNumericId,
        tokenType: authSession.tokenType,
        visibility: shareVisibility,
      });
      const sharedVisibility = normalizePostVisibilityValue(
        sharedPost.visibility,
      );
      const sharedFeedPost = mapSharedPostToCommunityFeedPost(sharedPost, t);
      const nextShareCount =
        Math.max(0, Math.round(post.shareCountValue ?? 0)) + 1;

      setCommunityFeedPosts((current) => {
        const withUpdatedShareCount = replaceCommunityFeedPostShareCount(
          current,
          postNumericId,
          nextShareCount,
        );

        if (sharedVisibility === "PRIVATE") {
          return withUpdatedShareCount;
        }

        return sortCommunityFeedPostsNewestFirst([
          sharedFeedPost,
          ...withUpdatedShareCount.filter(
            (currentPost) =>
              currentPost.postNumericId !== sharedFeedPost.postNumericId,
          ),
        ]);
      });
      updateCachedCommunityPost(postNumericId, (currentPost) => ({
        ...currentPost,
        shareCountValue: nextShareCount,
        shares: formatCompactCount(nextShareCount),
      }));

      // Bài chia sẻ luôn nằm trong hồ sơ của mình: công khai ở tab bài viết,
      // riêng tư ở tab ổ khóa.
      cacheProfilePost(mapCreatedPostToProfilePost(sharedPost));

      if (sharedVisibility === "PRIVATE") {
        removeCachedCommunityPost(sharedPost.postId);
      } else {
        cacheCommunityPost(sharedFeedPost);
      }

      setSharePostTarget(null);
      setShareDraft("");
      setShareVisibility("PUBLIC");
      showCommunityToast(
        sharedVisibility === "PRIVATE"
          ? t("community.feed.sharedPrivateToast")
          : t("community.feed.sharedPublicToast"),
      );
    } catch (error) {
      Alert.alert(
        t("community.feed.shareErrorTitle"),
        error instanceof Error
          ? error.message
          : t("community.feed.shareErrorMessage"),
      );
    } finally {
      setIsSharingPost(false);
    }
  }

  function handleEditPost(post: CommunityFeedPost) {
    const postNumericId = post.postNumericId;

    if (typeof postNumericId !== "number" || postNumericId <= 0) {
      Alert.alert(
        t("community.feed.editErrorTitle"),
        t("community.feed.editUnknownPostMessage"),
      );
      return;
    }

    cacheCommunityPost(post);
    router.push({
      pathname: "/community/create",
      params: {
        mode: "edit",
        postId: `${postNumericId}`,
      },
    } as Href);
  }

  function handleEditPostVisibility(post: CommunityFeedPost) {
    const postNumericId = post.postNumericId;

    if (typeof postNumericId !== "number" || postNumericId <= 0) {
      Alert.alert(
        t("community.feed.editErrorTitle"),
        t("community.feed.editVisibilityUnknownPostMessage"),
      );
      return;
    }

    cacheCommunityPost(post);
    router.push({
      pathname: "/community/post-visibility",
      params: {
        mode: "edit",
        postId: `${postNumericId}`,
      },
    } as Href);
  }

  function handleMovePostToTrash(post: CommunityFeedPost) {
    const postNumericId = post.postNumericId;

    if (typeof postNumericId !== "number" || postNumericId <= 0) {
      Alert.alert(
        t("community.feed.trashErrorTitle"),
        t("community.feed.trashInvalidIdMessage"),
      );
      return;
    }

    if (deletingPostIdsSet.has(postNumericId)) {
      return;
    }

    setPostPendingDeletion(post);
  }

  function handleOpenPostOptions(post: CommunityFeedPost) {
    setPostOptionsTarget(post);
  }

  function handleClosePostOptions() {
    setPostOptionsTarget(null);
  }

  function handleSelectPostOption(item: CommunityPostMenuItem) {
    const selectedPost = postOptionsTarget;

    setPostOptionsTarget(null);

    if (!selectedPost) {
      return;
    }

    requestAnimationFrame(() => {
      if (item.key === "edit-post") {
        handleEditPost(selectedPost);
        return;
      }

      if (item.key === "edit-visibility") {
        handleEditPostVisibility(selectedPost);
        return;
      }

      if (item.key === "toggle-notifications") {
        return;
      }

      handleMovePostToTrash(selectedPost);
    });
  }

  async function confirmMovePostToTrash() {
    const post = postPendingDeletion;
    const postNumericId = post?.postNumericId;
    const wasCommentTarget = commentTargetPost?.postNumericId === postNumericId;

    if (typeof postNumericId !== "number" || postNumericId <= 0) {
      setPostPendingDeletion(null);
      return;
    }

    if (!authSession.isAuthenticated) {
      setPostPendingDeletion(null);
      Alert.alert(
        t("community.feed.loginRequiredTitle"),
        t("community.feed.loginRequiredTrash"),
      );
      return;
    }

    const accessToken = await getValidAccessToken();

    if (!accessToken) {
      setPostPendingDeletion(null);
      Alert.alert(
        t("community.feed.sessionExpiredTitle"),
        t("community.feed.sessionExpiredTrash"),
      );
      return;
    }

    setDeletingPostIds((current) =>
      current.includes(postNumericId) ? current : [...current, postNumericId],
    );

    try {
      await deletePost({
        accessToken,
        postId: postNumericId,
        tokenType: authSession.tokenType,
      });

      setCommunityFeedPosts((current) =>
        current.filter(
          (currentPost) => currentPost.postNumericId !== postNumericId,
        ),
      );
      removeCachedCommunityPost(postNumericId);
      updateCachedProfilePost(postNumericId, (currentPost) => ({
        ...currentPost,
        status: "DELETED",
      }));
      setCommentTargetPost((current) =>
        current?.postNumericId === postNumericId ? null : current,
      );

      if (wasCommentTarget) {
        setCommunityPostComments([]);
        setCommunityPostCommentsError(null);
        setCommunityPostCommentsStatus("idle");
      }

      if (likedPostsAccountKey) {
        removeLikedPostId(likedPostsAccountKey, postNumericId);
      }

      setPostPendingDeletion(null);
      setCommunityToastMessage(t("community.feed.trashSuccessToast"));
    } catch (error) {
      Alert.alert(
        t("community.feed.trashErrorTitle"),
        error instanceof Error
          ? error.message
          : t("community.feed.trashErrorMessage"),
      );
    } finally {
      setDeletingPostIds((current) =>
        current.filter((id) => id !== postNumericId),
      );
    }
  }

  if (showInitialCommunityLoading) {
    return <CommunityLoadingState />;
  }

  return (
    <SafeAreaView className="flex-1 bg-white" edges={["left", "right"]}>
      <StatusBar style="dark" />

      <View className="flex-1 bg-white">
        <ScrollView
          contentContainerStyle={{ paddingBottom: 20 }}
          refreshControl={
            <RefreshControl
              colors={["#EB489B"]}
              onRefresh={() => {
                void handleRefresh();
              }}
              // Nội dung chạy lên dưới status bar nên spinner phải lùi xuống theo inset.
              progressViewOffset={insets.top}
              refreshing={isRefreshing}
              tintColor="#EB489B"
            />
          }
          showsVerticalScrollIndicator={false}
        >
          {/* Header Image - tràn lên sát mép trên của điện thoại (phủ cả vùng status bar) */}
          <View
            className="relative"
            style={{
              height: insets.top + headerImageContentHeight,
              paddingTop: insets.top,
            }}
          >
            <Image
              source={require("../../../../assets/images/postheader.png")}
              style={{
                width: "100%",
                height: "100%",
                position: "absolute",
              }}
              resizeMode="cover"
            />

            {/* Overlay gradient untuk readability */}
            <LinearGradient
              colors={["rgba(0, 0, 0, 0.3)", "rgba(0, 0, 0, 0.1)"]}
              start={{ x: 0, y: 0 }}
              end={{ x: 0, y: 1 }}
              style={{
                position: "absolute",
                width: "100%",
                height: "100%",
              }}
            />
            <LinearGradient
              colors={["rgba(255, 255, 255, 0)", "rgba(255, 255, 255, 0.94)"]}
              start={{ x: 0, y: 0 }}
              end={{ x: 0, y: 1 }}
              style={{
                position: "absolute",
                width: "100%",
                height: 80,
                bottom: 0,
              }}
            />

            {/* Header top bar */}
            <View className="flex-row items-center justify-between px-4 py-2">
              <View className="flex-row items-center gap-2.5">
                <Pressable
                  className="h-9 w-9 items-center justify-center rounded-[16px] border bg-white"
                  style={[
                    pillShadowStyle,
                    {
                      borderColor: subtleBorderColor,
                      borderWidth: subtleBorderWidth,
                    },
                  ]}
                >
                  <SymbolView
                    name={{
                      ios: "line.3.horizontal",
                      android: "menu",
                      web: "menu",
                    }}
                    size={15}
                    tintColor="#D55E8E"
                  />
                </Pressable>

                <Text
                  className="text-[19px] font-black tracking-[-0.4px] text-white"
                  style={textStyle(20)}
                >
                  {PROJECT_WORDMARK}
                </Text>
              </View>

              <CircleIconButton
                icon={{
                  ios: "bell",
                  android: "notifications",
                  web: "notifications",
                }}
              />
            </View>
          </View>

          {/* Share experience bar - nằm ở giữa, nền trắng che ranh giới */}
          <View
            style={{
              paddingHorizontal: gutter,
              marginTop: -shareBarOverlap,
              marginBottom: 4,
              position: "relative",
              zIndex: 10,
            }}
          >
            <Pressable
              className="flex-row items-center rounded-[24px] bg-white px-4 py-3"
              onPress={() => {
                fadeShareBarText(0);
                router.push("/community/create" as Href);
              }}
              onPressIn={() => fadeShareBarText(0)}
              onPressOut={() => fadeShareBarText(1)}
              style={[
                cardShadowStyle,
                {
                  borderColor: subtleBorderColor,
                  borderWidth: subtleBorderWidth,
                },
              ]}
            >
              <UserAvatar
                displayName={resolvedComposerIdentity.displayName}
                size={36}
                uri={resolvedComposerIdentity.avatarUri}
                username={resolvedComposerIdentity.username}
              />
              <Animated.Text
                className="ml-3 flex-1 text-[14px] font-medium text-[#8F8298]"
                style={[textStyle(14), { opacity: shareBarTextOpacity }]}
              >
                Hãy chia sẻ trải nghiệm của bạn...
              </Animated.Text>

              <View
                className="ml-2 h-8 w-8 items-center justify-center rounded-full bg-[#FDECF4]"
              >
                <SymbolView
                  name={{
                    ios: "photo.on.rectangle.angled",
                    android: "image",
                    web: "image",
                  }}
                  size={16}
                  tintColor="#D55E8E"
                />
              </View>
            </Pressable>
          </View>

          <View className="pb-5" style={{ paddingHorizontal: gutter }}>
            <View className="mt-2">
              <CommunityDiscoverGroupsSection
                currentProfileId={currentProfileId}
                errorMessage={communityGroupsError}
                groups={previewCommunityGroups}
                onCreateGroup={openCommunityGroupCreate}
                onOpenAll={openCommunityGroupsList}
                onOpenGroup={handleOpenDiscoverGroup}
                pageGutter={gutter}
                status={communityGroupsStatus}
              />
            </View>

            <View className="mt-5">
              <Text
                className="text-[18px] font-bold text-[#2E2336]"
                style={textStyle(18)}
              >
                Bài viết cộng đồng
              </Text>
            </View>

            <View className="mt-2">
              {communityFeedStatus === "loading" ? (
                <View
                  className="mb-3 rounded-[28px] border bg-white px-4 py-5"
                  style={[
                    cardShadowStyle,
                    {
                      borderColor: subtleBorderColor,
                      borderWidth: subtleBorderWidth,
                    },
                  ]}
                >
                  <View className="items-center">
                    <ActivityIndicator color="#EB489B" />
                  </View>
                </View>
              ) : null}

              {communityFeedStatus === "error" ? (
                <View
                  className="mb-3 rounded-[28px] border bg-[#FFF8FC] px-4 py-4"
                  style={{
                    borderColor: subtleBorderColor,
                    borderWidth: subtleBorderWidth,
                  }}
                >
                  <Text
                    className="text-[15px] font-bold text-[#C2416C]"
                    style={textStyle(15)}
                  >
                    {communityFeedError ?? t("community.feed.loadError")}
                  </Text>
                  <Text className="mt-1 text-[14px] leading-[15px] text-[#8E869A]">
                    {t("community.feed.demoFallbackNotice")}
                  </Text>
                </View>
              ) : null}

              {communityFeedStatus !== "loading" ? (
                displayedPosts.length ? (
                  displayedPosts.map((post, postIndex) => {
                    const postNumericId = post.postNumericId ?? null;
                    const isLiking =
                      postNumericId !== null &&
                      likingPostIdsSet.has(postNumericId);
                    const isLiked =
                      postNumericId !== null &&
                      (likedPostIdsSet.has(postNumericId) ||
                        post.isLiked === true);

                    return (
                      <CommunityPostCard
                        canManagePost={isCurrentUserCommunityPost(
                          post.authorId,
                          currentProfileId,
                        )}
                        key={post.id}
                        edgeToEdgeWidth={safeWidth}
                        isDeleting={deletingPostIdsSet.has(postNumericId ?? -1)}
                        isLiked={isLiked}
                        isLiking={isLiking}
                        isSharing={
                          isSharingPost &&
                          postNumericId !== null &&
                          sharePostTarget?.postNumericId === postNumericId
                        }
                        onOpenPostOptions={handleOpenPostOptions}
                        pageGutter={gutter}
                        post={post}
                        resolvedHotspots={resolvedHotspots}
                        resolvedRoutes={resolvedRoutes}
                        showDivider={postIndex < displayedPosts.length - 1}
                        onCommentPost={handleOpenCommentComposer}
                        onLikePost={handleLikePost}
                        onSharePost={handleOpenSharePostComposer}
                        onOpenProfile={openExplorerProfile}
                        onOpenHotspot={openHotspotDetail}
                        onOpenRoute={openRouteDetail}
                      />
                    );
                  })
                ) : (
                  <View
                    className="rounded-[28px] border bg-white px-4 py-5"
                    style={{
                      borderColor: subtleBorderColor,
                      borderWidth: subtleBorderWidth,
                    }}
                  >
                    <Text
                      className="text-[18px] font-black text-[#2E2336]"
                      style={textStyle(18)}
                    >
                      {t("community.empty.noUpdates")}
                    </Text>
                    <Text className="mt-1 text-[14px] leading-[15px] text-[#8E869A]">
                      {t("community.feed.emptyFeedDescription")}
                    </Text>
                  </View>
                )
              ) : null}
            </View>
          </View>
        </ScrollView>
      </View>

      <CommunityCommentComposerModal
        comments={communityPostComments}
        commentsErrorMessage={communityPostCommentsError}
        commentsStatus={communityPostCommentsStatus}
        draft={commentDraft}
        isSubmitting={isCommentSubmitting}
        onChangeDraft={setCommentDraft}
        onClose={handleCloseCommentComposer}
        onRetryComments={handleRetryLoadComments}
        onSubmit={handleSubmitComment}
        postAuthor={commentTargetPost?.author ?? null}
        visible={commentTargetPost !== null}
      />

      <CommunitySharePostModal
        authorAvatarUri={resolvedComposerIdentity.avatarUri}
        authorName={resolvedComposerIdentity.displayName}
        authorUsername={resolvedComposerIdentity.username}
        draft={shareDraft}
        isSubmitting={isSharingPost}
        key={sharePostTarget?.postNumericId ?? "community-share-modal"}
        onChangeDraft={setShareDraft}
        onChangeVisibility={setShareVisibility}
        onClose={handleCloseSharePostComposer}
        onSubmit={() => {
          void handleSubmitSharePost();
        }}
        visibility={shareVisibility}
        visible={sharePostTarget !== null}
      />

      <CommunityPostOptionsSheet
        bottomInset={insets.bottom}
        items={communityPostMenuItems}
        onClose={handleClosePostOptions}
        onSelectItem={handleSelectPostOption}
        visible={postOptionsTarget !== null}
      />

      <ReviewDeleteDialog
        confirmLabel={t("community.feed.trashConfirmLabel")}
        description={t("community.feed.trashConfirmDescription")}
        isDeleting={
          postPendingDeletion !== null &&
          deletingPostIdsSet.has(postPendingDeletion.postNumericId ?? -1)
        }
        onCancel={() => {
          setPostPendingDeletion(null);
        }}
        onConfirm={() => {
          void confirmMovePostToTrash();
        }}
        title={t("community.feed.trashConfirmTitle")}
        visible={postPendingDeletion !== null}
      />

      {communityToastMessage ? (
        <View
          pointerEvents="box-none"
          style={{
            bottom: Math.max(insets.bottom, 12) + 12,
            left: 10,
            position: "absolute",
            right: 10,
          }}
        >
          <Pressable
            className="rounded-[18px] px-4 py-3"
            onPress={() => {
              setCommunityToastMessage(null);
              setCommunityToastAction(null);
            }}
            style={{
              backgroundColor: "rgba(33, 33, 33, 0.92)",
              shadowColor: "rgba(0, 0, 0, 0.26)",
              shadowOffset: { width: 0, height: 8 },
              shadowOpacity: 1,
              shadowRadius: 16,
              elevation: 10,
            }}
          >
            <View className="flex-row items-center">
              <Text
                className="flex-1 text-[14px] font-normal text-white"
                style={textStyle(14)}
              >
                {communityToastMessage}
              </Text>

              {communityToastAction ? (
                <Pressable
                  hitSlop={8}
                  onPress={() => {
                    const action = communityToastAction;
                    setCommunityToastMessage(null);
                    setCommunityToastAction(null);
                    action?.onPress();
                  }}
                >
                  <Text
                    className="ml-3 font-semibold text-[#5AB0FF] underline"
                    style={textStyle(14)}
                  >
                    {communityToastAction.label}
                  </Text>
                </Pressable>
              ) : null}
            </View>
          </Pressable>
        </View>
      ) : null}
    </SafeAreaView>
  );
}

function CircleIconButton({ icon }: { icon: SymbolName }) {
  return (
    <Pressable
      className="h-9 w-9 items-center justify-center rounded-full border"
      style={{
        backgroundColor: "rgba(255,255,255,0.92)",
        borderColor: subtleBorderColor,
        borderWidth: subtleBorderWidth,
      }}
    >
      <SymbolView name={icon} size={15} tintColor="#C95B89" />
    </Pressable>
  );
}

function CommunityDiscoverGroupsSection({
  currentProfileId,
  errorMessage,
  groups,
  onCreateGroup,
  onOpenAll,
  onOpenGroup,
  pageGutter,
  status,
}: {
  currentProfileId: string | null;
  errorMessage: string | null;
  groups: readonly CommunityGroupPayload[];
  onCreateGroup: () => void;
  onOpenAll: () => void;
  onOpenGroup: (group: CommunityGroupPayload) => void;
  pageGutter: number;
  status: CommunityGroupsStatus;
}) {
  const { t } = useTranslation();
  const showEmptyState = status === "ready" && groups.length === 0;
  const showErrorState = status === "error" && groups.length === 0;
  const showLoadingState = status === "loading" && groups.length === 0;

  return (
    <View>
      <View className="flex-row items-center justify-between">
        <Text
          className="text-[16px] font-bold text-[#2E2336]"
          style={textStyle(16)}
        >
          {t("community.groups.title")}
        </Text>
        <Pressable hitSlop={8} onPress={onOpenAll}>
          <Text
            className="text-[13px] font-semibold text-[#D97706]"
            style={textStyle(13)}
          >
            {t("community.groups.viewAll")}
          </Text>
        </Pressable>
      </View>

      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={{
          paddingBottom: 8,
          paddingLeft: pageGutter,
          paddingRight: 8,
          paddingTop: 8,
          gap: 10,
        }}
        style={{
          marginHorizontal: -pageGutter,
          marginTop: 10,
        }}
      >
        <CommunityCreateGroupCard onPress={onCreateGroup} />
        {groups.map((group) => (
          <CommunityGroupListCard
            key={group.shareToken}
            group={group}
            isLeader={isCommunityGroupLeader(group, currentProfileId)}
            onPress={() => {
              onOpenGroup(group);
            }}
          />
        ))}
        {showLoadingState ? <CommunityGroupPlaceholderCard /> : null}
        {showErrorState ? (
          <CommunityGroupCompactStateCard
            description={errorMessage ?? t("community.groupsCommon.loadError")}
            title={t("community.groupsCommon.loadErrorTitle")}
          />
        ) : null}
        {showEmptyState ? (
          <CommunityGroupCompactStateCard
            description={t("community.groupsCommon.emptyDescription")}
            title={t("community.groupsCommon.emptyTitle")}
          />
        ) : null}
      </ScrollView>
    </View>
  );
}

function buildCommunityPostMediaItems(post: CommunityFeedPost) {
  if (Array.isArray(post.mediaItems) && post.mediaItems.length > 0) {
    return post.mediaItems;
  }

  if (post.image) {
    return [
      {
        key: `${post.id}-fallback-image`,
        source: post.image,
      },
    ] satisfies CommunityFeedMediaItem[];
  }

  return [];
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
    Math.max(edgeToEdgeWidth - 52, 240),
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
          resizeMode="cover"
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
                galleryWidth || event.nativeEvent.layoutMeasurement.width || 1;
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
                resizeMode="cover"
                style={{ height: mediaHeight, width: galleryWidth }}
              />
            ))}
          </ScrollView>

          <View className="absolute right-3 top-3 rounded-full bg-black/35 px-2.5 py-1">
            <Text
              className="text-[11px] font-semibold text-white"
              style={textStyle(11)}
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
  icon: SymbolName;
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
      <Text className="ml-1.5 text-[15px] text-[#706775]" style={textStyle(15)}>
        {label}
      </Text>
    </Pressable>
  );
}

function CommunityPostTagChip({ label }: { label: string }) {
  return (
    <View className="mr-2 mt-1.5 rounded-full bg-[#F4F1F4] px-3 py-0.5">
      <Text className="text-[14px] text-[#7D7680]" style={textStyle(14)}>
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
            className="text-[13px] font-semibold text-[#F2608E]"
            style={textStyle(13)}
          >
            {t("community.feed.badge.route")}
          </Text>
          <Text
            className="text-[16px] font-medium text-[#4B414C]"
            numberOfLines={2}
            style={textStyle(16)}
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
  const remainingCount = Math.max(
    imageUris.length - previewImageUris.length,
    0,
  );

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
            className="text-[13px] font-semibold text-[#18A7B4]"
            style={textStyle(13)}
          >
            {t("community.feed.hotspotCountLabel", { count })}
          </Text>
          <Text
            className="text-[15px] text-[#6D6671]"
            numberOfLines={2}
            style={textStyle(15)}
          >
            {subtitle}
          </Text>
          {previewImageUris.length > 0 ? (
            <View className="mt-1 flex-row items-center">
              {previewImageUris.map((imageUri, index) => (
                <View
                  key={`${imageUri}-${index}`}
                  className={
                    index === 0
                      ? "h-6 w-6 overflow-hidden rounded-full border-2 border-white"
                      : "-ml-2 h-6 w-6 overflow-hidden rounded-full border-2 border-white"
                  }
                >
                  <Image
                    source={{ uri: imageUri }}
                    style={{ height: "100%", width: "100%" }}
                  />
                </View>
              ))}
              {remainingCount > 0 ? (
                <View className="-ml-2 h-6 w-6 items-center justify-center rounded-full border-2 border-white bg-[#E7EEF2]">
                  <Text
                    className="text-[11px] font-semibold text-[#55606C]"
                    style={textStyle(11)}
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
  const avatarUri =
    getCachedCommunityExplorerProfile(authorId)?.profile.avatar ?? null;
  return <UserAvatar displayName={authorName} size={size} uri={avatarUri} />;
}

function CommunitySharedPostCard({
  edgeToEdgeWidth,
  onOpenHotspot,
  onOpenRoute,
  resolvedHotspots,
  resolvedRoutes,
  sharedPost,
  withTopSpacing,
}: {
  edgeToEdgeWidth: number;
  onOpenHotspot: (hotspotId: number) => void;
  onOpenRoute: (routeId: number) => void;
  resolvedHotspots: Record<number, ResolvedHotspotPreview>;
  resolvedRoutes: Record<number, ResolvedRoutePreview>;
  sharedPost: SharedPostSummary;
  withTopSpacing: boolean;
}) {
  const { t } = useTranslation();
  const author =
    readMeaningfulText(sharedPost.displayName) ??
    readMeaningfulText(sharedPost.username) ??
    t("community.feed.fallbackUserName");
  const caption = readMeaningfulText(
    stripTrailingHashtagBlock(sharedPost.content),
  );
  const mediaItems: CommunityFeedMediaItem[] = sharedPost.medias
    .filter(
      (media) =>
        media.type.trim().toUpperCase() === "IMAGE" &&
        Boolean(readMeaningfulText(media.url)),
    )
    .map((media) => ({
      key: `shared-${sharedPost.postId}-media-${media.id}`,
      source: {
        uri: media.url,
      },
    }));
  const tagLabels = sharedPost.tags
    .map((tag) => formatCommunityTagLabel(tag.name))
    .filter((tagLabel): tagLabel is string => Boolean(tagLabel));
  const routeItems = sharedPost.routeIds
    .filter((routeId) => Number.isInteger(routeId) && routeId > 0)
    .map((routeId) => ({
      id: routeId,
      label:
        resolvedRoutes[routeId]?.routeName?.trim() ||
        t("community.feed.routeFallbackName", { id: routeId }),
    }));
  const hotspotItems = sharedPost.hotspotIds
    .filter((hotspotId) => Number.isInteger(hotspotId) && hotspotId > 0)
    .map((hotspotId) => ({
      id: hotspotId,
      imageUri: resolvedHotspots[hotspotId]?.imageUri ?? null,
      label:
        resolvedHotspots[hotspotId]?.hotspotName?.trim() ||
        t("community.feed.hotspotFallbackName", { id: hotspotId }),
    }));
  const primaryRouteLabel =
    routeItems.length <= 1
      ? (routeItems[0]?.label ?? null)
      : `${routeItems[0]?.label ?? t("community.feed.badge.route")} +${routeItems.length - 1}`;
  const hotspotSubtitle =
    hotspotItems.length === 0
      ? null
      : hotspotItems.length === 1
        ? (hotspotItems[0]?.label ?? null)
        : hotspotItems.length === 2
          ? `${hotspotItems[0]?.label ?? ""}, ${hotspotItems[1]?.label ?? ""}`
          : t("community.feed.hotspotMoreLabel", {
              count: hotspotItems.length - 2,
              first: hotspotItems[0]?.label ?? "",
              second: hotspotItems[1]?.label ?? "",
            });
  const hotspotImageUris = hotspotItems
    .map((item) => item.imageUri)
    .filter((imageUri): imageUri is string => Boolean(imageUri));

  return (
    <View
      className="overflow-hidden rounded-[20px] border bg-[#FDFBFC] px-3 pb-3 pt-2.5"
      style={{
        borderColor: "#F0E7ED",
        borderWidth: subtleBorderWidth,
        marginTop: withTopSpacing ? 10 : 4,
      }}
    >
      <View className="flex-row items-center">
        <CommunityPostAuthorAvatar
          authorId={sharedPost.userId}
          authorName={author}
          avatarColors={getAvatarPalette(`${author}-${sharedPost.userId}`)}
          initials={getNameInitials(author)}
          size={34}
        />

        <View className="ml-2.5 flex-1 pr-2">
          <Text
            className="text-[16px] font-bold text-[#2F2432]"
            style={textStyle(16)}
          >
            {author}
          </Text>

          <View
            className="flex-row flex-wrap items-center gap-1"
            style={{ marginTop: -4 }}
          >
            <Text className="text-[14px] text-[#8A7D86]" style={textStyle(14)}>
              {formatCommunityTime(sharedPost.createdAt, t)}
            </Text>
            <Text className="text-[14px] text-[#8A7D86]" style={textStyle(14)}>
              •
            </Text>
            <SymbolView
              name={getPostVisibilityIcon(sharedPost.visibility)}
              size={12}
              tintColor="#8A7D86"
            />
          </View>
        </View>
      </View>

      {caption ? (
        <View className="pt-2">
          <ExpandablePostCaption text={caption} />
        </View>
      ) : null}

      {mediaItems.length > 0 ? (
        <View className="mt-2">
          <CommunityPostMediaGallery
            edgeToEdgeWidth={Math.max(edgeToEdgeWidth - 24, 200)}
            items={mediaItems}
          />
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

      {tagLabels.length > 0 ? (
        <View className="mt-1 flex-row flex-wrap items-center">
          {tagLabels.map((tagLabel) => (
            <CommunityPostTagChip
              key={`shared-${sharedPost.postId}-${tagLabel}`}
              label={tagLabel}
            />
          ))}
        </View>
      ) : null}
    </View>
  );
}

function CommunityPostCard({
  canManagePost,
  edgeToEdgeWidth,
  isDeleting,
  isLiked,
  isLiking,
  isSharing,
  onOpenPostOptions,
  pageGutter,
  post,
  resolvedHotspots,
  resolvedRoutes,
  showDivider,
  onCommentPost,
  onLikePost,
  onSharePost,
  onOpenProfile,
  onOpenHotspot,
  onOpenRoute,
}: {
  canManagePost: boolean;
  edgeToEdgeWidth: number;
  isDeleting: boolean;
  isLiked: boolean;
  isLiking: boolean;
  isSharing: boolean;
  pageGutter: number;
  showDivider: boolean;
  onOpenPostOptions: (post: CommunityFeedPost) => void;
  post: CommunityFeedPost;
  resolvedHotspots: Record<number, ResolvedHotspotPreview>;
  resolvedRoutes: Record<number, ResolvedRoutePreview>;
  onCommentPost: (post: CommunityFeedPost) => void;
  onLikePost: (post: CommunityFeedPost) => void;
  onSharePost: (post: CommunityFeedPost) => void;
  onOpenProfile: (authorId: string) => void;
  onOpenHotspot: (hotspotId: number) => void;
  onOpenRoute: (routeId: number) => void;
}) {
  const { t } = useTranslation();
  const insets = useSafeAreaInsets();
  const [isPostOptionsVisible, setIsPostOptionsVisible] = useState(false);
  const postMenuItems = useMemo(() => buildCommunityPostMenuItems(t), [t]);
  const mediaItems = buildCommunityPostMediaItems(post);
  const sharedPost = post.sharedPost ?? null;
  const caption = readMeaningfulText(post.caption);
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
      ? (routeItems[0]?.label ?? null)
      : `${routeItems[0]?.label ?? t("community.feed.badge.route")} +${routeItems.length - 1}`;
  const hotspotSubtitle =
    hotspotItems.length === 0
      ? null
      : hotspotItems.length === 1
        ? (hotspotItems[0]?.label ?? null)
        : hotspotItems.length === 2
          ? `${hotspotItems[0]?.label ?? ""}, ${hotspotItems[1]?.label ?? ""}`
          : t("community.feed.hotspotMoreLabel", {
              count: hotspotItems.length - 2,
              first: hotspotItems[0]?.label ?? "",
              second: hotspotItems[1]?.label ?? "",
            });
  const hotspotImageUris = hotspotItems
    .map((item) => item.imageUri)
    .filter((imageUri): imageUri is string => Boolean(imageUri));

  return (
    <>
      <View className="bg-white pb-3 pt-3.5">
        <View className="flex-row items-start">
          <Pressable
            accessibilityLabel={t("community.feed.openProfileA11y", {
              name: post.author,
            })}
            accessibilityRole={
              post.canOpenProfile === false ? undefined : "button"
            }
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

          <View className="ml-3 flex-1 pr-2">
            <Text
              className="text-[17px] font-bold text-[#2F2432]"
              style={textStyle(17)}
            >
              {post.author}
            </Text>

            <View
              className="flex-row flex-wrap items-center gap-x-1"
              style={{ marginTop: -4 }}
            >
              <Text
                className="text-[14px] text-[#8A7D86]"
                style={textStyle(14)}
              >
                {post.time}
              </Text>
              <Text
                className="text-[14px] text-[#8A7D86]"
                style={textStyle(14)}
              >
                •
              </Text>
              <SymbolView name={visibilityIcon} size={12} tintColor="#8A7D86" />
              <Text
                className="text-[14px] text-[#8A7D86]"
                style={textStyle(14)}
              >
                {visibilityLabel}
              </Text>
            </View>
          </View>

          {canManagePost ? (
            <Pressable
              className="h-8 w-8 items-center justify-center rounded-full"
              disabled={isDeleting}
              hitSlop={8}
              onPress={() => {
                onOpenPostOptions(post);
              }}
            >
              <SymbolView
                name={{
                  ios: "ellipsis",
                  android: "more_horiz",
                  web: "more_horiz",
                }}
                size={20}
                tintColor="#554C56"
              />
            </Pressable>
          ) : (
            <View className="h-8 w-8" />
          )}
        </View>

        <View className="pt-0.5">
          {caption ? <ExpandablePostCaption text={caption} /> : null}

          {sharedPost ? (
            <CommunitySharedPostCard
              edgeToEdgeWidth={edgeToEdgeWidth}
              onOpenHotspot={onOpenHotspot}
              onOpenRoute={onOpenRoute}
              resolvedHotspots={resolvedHotspots}
              resolvedRoutes={resolvedRoutes}
              sharedPost={sharedPost}
              withTopSpacing={Boolean(caption)}
            />
          ) : null}

          {tagLabels.length > 0 ? (
            <View className="mt-1 flex-row flex-wrap items-center">
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
          <View className="mt-2">
            <CommunityPostMediaGallery
              edgeToEdgeWidth={edgeToEdgeWidth}
              items={mediaItems}
            />
          </View>
        ) : null}

        <View className="mt-1.5 flex-row items-center">
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
              disabled={isSharing}
              icon={{
                ios: "arrowshape.turn.up.right",
                android: "share",
                web: "share",
              }}
              isLoading={isSharing}
              onPress={() => {
                onSharePost(post);
              }}
              label={post.shares}
            />
          </View>
          <View className="flex-1" />
        </View>
      </View>

      {showDivider ? (
        <View
          style={{
            backgroundColor: "#ECE6EA",
            height: StyleSheet.hairlineWidth,
            marginHorizontal: -pageGutter,
          }}
        />
      ) : null}

      <CommunityPostOptionsSheet
        bottomInset={insets.bottom}
        items={postMenuItems}
        onClose={handleClosePostOptions}
        onSelectItem={handleSelectPostOption}
        visible={isPostOptionsVisible}
      />
    </>
  );
}

function CommunityPostOptionsSheet({
  bottomInset,
  items,
  onClose,
  onSelectItem,
  visible,
}: {
  bottomInset: number;
  items: readonly CommunityPostMenuItem[];
  onClose: () => void;
  onSelectItem: (item: CommunityPostMenuItem) => void;
  visible: boolean;
}) {
  return (
    <Modal
      animationType="slide"
      onRequestClose={onClose}
      statusBarTranslucent
      transparent
      visible={visible}
    >
      <View className="flex-1 bg-black/35">
        <Pressable className="flex-1" onPress={onClose} />

        <View
          className="rounded-t-[28px] bg-white px-3 pt-3"
          style={{ paddingBottom: Math.max(bottomInset, 14) }}
        >
          <View className="items-center pb-2">
            <View className="h-1.5 w-14 rounded-full bg-[#D3D2DC]" />
          </View>

          <View className="rounded-[22px] bg-[#F7F6FB] px-4 py-0.5">
            {items.map((item, index) => (
              <CommunityPostMenuRow
                key={item.label}
                isLast={index === items.length - 1}
                item={item}
                onPress={() => {
                  onSelectItem(item);
                }}
              />
            ))}
          </View>
        </View>
      </View>
    </Modal>
  );
}

function CommunityPostMenuRow({
  isLast,
  item,
  onPress,
}: {
  isLast: boolean;
  item: CommunityPostMenuItem;
  onPress: () => void;
}) {
  const labelColor = item.isDestructive ? "#C24F3B" : "#202124";
  const descriptionColor = item.isDestructive ? "#B46A5F" : "#8E869A";

  return (
    <Pressable
      className={`flex-row items-start gap-2.5 py-2.5 ${isLast ? "" : "border-b border-[#E7E5EF]"}`}
      onPress={onPress}
    >
      <View className="w-6 items-center pt-px">
        <SymbolView name={item.icon} size={19} tintColor={labelColor} />
      </View>
      <View className="min-w-0 flex-1">
        <Text
          className="text-[15px] font-normal"
          style={[textStyle(15), { color: labelColor }]}
        >
          {item.label}
        </Text>
        {item.description ? (
          <Text
            className="mt-0.5 text-[12px]"
            style={[textStyle(12), { color: descriptionColor }]}
          >
            {item.description}
          </Text>
        ) : null}
      </View>
    </Pressable>
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
    <Text className="text-[15px] text-[#2B232D]" style={textStyle(15)}>
      {expanded || !shouldTruncate ? normalizedText : collapsedText}
      {shouldTruncate ? (
        <Text
          className="font-medium text-[#D4578F]"
          onPress={() => {
            setExpanded((current) => !current);
          }}
        >
          {" "}
          {expanded ? t("community.feed.showLess") : t("community.feed.showMore")}
        </Text>
      ) : null}
    </Text>
  );
}

function AvatarMonogram({
  initials,
  size,
}: {
  colors: readonly [string, string];
  initials: string;
  size: number;
}) {
  return <UserAvatarFallback displayName={initials} size={size} />;
}

function CommunityCommentCard({ item }: { item: PostComment }) {
  const { t } = useTranslation();
  const displayName =
    readMeaningfulText(item.displayName) ??
    readMeaningfulText(item.username) ??
    t("community.feed.fallbackUserName");
  const normalizedUsername =
    readMeaningfulText(item.username)?.replace(/^@/, "") ?? null;
  const shouldShowUsername =
    normalizedUsername !== null &&
    normalizeLookupText(normalizedUsername) !==
      normalizeLookupText(displayName);

  return (
    <View className="px-0.5 py-1">
      <View className="flex-row items-start gap-1.5">
        <AvatarMonogram
          colors={getAvatarPalette(`${displayName}-${item.userId}`)}
          initials={getNameInitials(displayName)}
          size={42}
        />

        <View className="flex-1">
          <View className="flex-row items-center justify-between gap-2">
            <View className="flex-1">
              <Text
                className="text-[15px] font-bold text-[#2E2432]"
                style={textStyle(15)}
              >
                {displayName}
              </Text>
              {shouldShowUsername ? (
                <Text
                  className="text-[12px] font-medium text-[#9B8794]"
                  numberOfLines={1}
                  style={textStyle(12)}
                >
                  @{normalizedUsername}
                </Text>
              ) : null}
            </View>

            <Text
              className="text-[12px] font-medium text-[#978B98]"
              style={textStyle(12)}
            >
              {formatCommunityTime(item.createdAt, t)}
            </Text>
          </View>

          <Text
            className="mt-0.5 text-[15px] text-[#4B4150]"
            style={textStyle(15)}
          >
            {readMeaningfulText(item.comment) ??
              t("community.feed.defaultCommentText")}
          </Text>
        </View>
      </View>
    </View>
  );
}

function CommunitySharePostPill({
  disabled,
  icon,
  isActive,
  label,
  onPress,
}: {
  disabled: boolean;
  icon: SymbolName;
  isActive: boolean;
  label: string;
  onPress: () => void;
}) {
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityState={{ disabled, expanded: isActive }}
      className="flex-row items-center rounded-[8px] px-2.5 py-[3px]"
      disabled={disabled}
      hitSlop={8}
      onPress={onPress}
      style={({ pressed }) => ({
        backgroundColor: isActive ? "#FCE4F0" : "#F7F1F5",
        opacity: disabled ? 0.6 : pressed ? 0.75 : 1,
      })}
    >
      <SymbolView name={icon} size={12} tintColor="#EB489B" />

      <Text
        className="ml-[5px] text-[13px] font-normal text-[#2F2337]"
        style={textStyle(13)}
      >
        {label}
      </Text>

      <View className="ml-1">
        <SymbolView
          name={{
            ios: "chevron.down",
            android: "keyboard_arrow_down",
            web: "keyboard_arrow_down",
          }}
          size={12}
          tintColor="#8A7D86"
        />
      </View>
    </Pressable>
  );
}

function CommunitySharePostMenuRow({
  description,
  disabled,
  icon,
  isSelected,
  label,
  onPress,
}: {
  description: string;
  disabled: boolean;
  icon: SymbolName;
  isSelected: boolean;
  label: string;
  onPress: () => void;
}) {
  return (
    <Pressable
      accessibilityRole="radio"
      accessibilityState={{ disabled, selected: isSelected }}
      className="flex-row items-center rounded-[12px] px-2 py-2"
      disabled={disabled}
      onPress={onPress}
      style={({ pressed }) => ({
        backgroundColor: isSelected
          ? "#FFE7F2"
          : pressed
            ? "#F7F1F5"
            : "transparent",
        opacity: disabled ? 0.6 : 1,
      })}
    >
      <View className="h-8 w-8 items-center justify-center rounded-full bg-white">
        <SymbolView
          name={icon}
          size={15}
          tintColor={isSelected ? "#EB489B" : "#7A7380"}
        />
      </View>

      <View className="ml-2.5 flex-1">
        <Text
          className="text-[14px] font-semibold text-[#2F2337]"
          style={textStyle(14)}
        >
          {label}
        </Text>
        <Text
          className="mt-0.5 text-[12px] text-[#8F8298]"
          style={textStyle(12)}
        >
          {description}
        </Text>
      </View>

      {isSelected ? (
        <SymbolView
          name={{
            ios: "checkmark.circle.fill",
            android: "check_circle",
            web: "check_circle",
          }}
          size={18}
          tintColor="#EB489B"
        />
      ) : null}
    </Pressable>
  );
}

function CommunitySharePostModal({
  authorAvatarUri,
  authorName,
  authorUsername,
  draft,
  isSubmitting,
  onChangeDraft,
  onChangeVisibility,
  onClose,
  onSubmit,
  visibility,
  visible,
}: {
  authorAvatarUri: string | null;
  authorName: string;
  authorUsername: string | null;
  draft: string;
  isSubmitting: boolean;
  onChangeDraft: (value: string) => void;
  onChangeVisibility: (value: PostVisibilityValue) => void;
  onClose: () => void;
  onSubmit: () => void;
  visibility: PostVisibilityValue;
  visible: boolean;
}) {
  const { t } = useTranslation();
  const [isVisibilityMenuOpen, setIsVisibilityMenuOpen] = useState(false);

  return (
    <Modal
      animationType="slide"
      onRequestClose={onClose}
      statusBarTranslucent
      transparent
      visible={visible}
    >
      <KeyboardAvoidingView
        behavior={Platform.OS === "ios" ? "padding" : undefined}
        className="flex-1"
      >
        <View className="flex-1 justify-end bg-black/35">
          <Pressable
            className="flex-1"
            disabled={isSubmitting}
            onPress={onClose}
          />

          <SafeAreaView edges={["left", "right", "bottom"]}>
            <View className="rounded-t-[26px] bg-white px-4 pb-5 pt-2.5">
              <View className="items-center pb-2.5">
                <View className="h-1 w-10 rounded-full bg-[#EFDCE7]" />
              </View>

              <View className="flex-row items-center">
                <UserAvatar
                  displayName={authorName}
                  size={44}
                  uri={authorAvatarUri}
                  username={authorUsername}
                />

                <View className="ml-3 flex-1">
                  <Text
                    className="text-[15px] font-bold text-[#2F2337]"
                    style={textStyle(15)}
                  >
                    {authorName}
                  </Text>

                  <View className="flex-row items-center">
                    <CommunitySharePostPill
                      disabled={isSubmitting}
                      icon={getPostVisibilityIcon(visibility)}
                      isActive={isVisibilityMenuOpen}
                      label={getPostVisibilityLabel(visibility)}
                      onPress={() => {
                        setIsVisibilityMenuOpen((current) => !current);
                      }}
                    />
                  </View>
                </View>
              </View>

              {isVisibilityMenuOpen ? (
                <View className="mt-2.5 rounded-[16px] bg-[#FDF4F9] px-1.5 py-1.5">
                  {postVisibilityOptions.map((option) => (
                    <CommunitySharePostMenuRow
                      key={option}
                      description={getPostVisibilityDescription(option)}
                      disabled={isSubmitting}
                      icon={getPostVisibilityIcon(option)}
                      isSelected={visibility === option}
                      label={getPostVisibilityLabel(option)}
                      onPress={() => {
                        onChangeVisibility(option);
                        setIsVisibilityMenuOpen(false);
                      }}
                    />
                  ))}
                </View>
              ) : null}

              <TextInput
                editable={!isSubmitting}
                maxLength={communitySharePostMaxLength}
                multiline
                onChangeText={onChangeDraft}
                placeholder={t("community.feed.sharePlaceholder")}
                placeholderTextColor="#B39EAD"
                style={{
                  color: "#2F242C",
                  fontSize: 15,
                  lineHeight: bodyLineHeightFor(15),
                  marginTop: 12,
                  maxHeight: 148,
                  minHeight: 92,
                  padding: 0,
                  textAlignVertical: "top",
                }}
                value={draft}
              />

              <View className="mt-2.5 flex-row items-center justify-end">
                <Pressable
                  className="overflow-hidden rounded-[12px]"
                  disabled={isSubmitting}
                  onPress={onSubmit}
                  style={({ pressed }) => ({
                    opacity: isSubmitting ? 0.72 : pressed ? 0.9 : 1,
                  })}
                >
                  <LinearGradient
                    colors={gradientColors}
                    end={{ x: 1, y: 0.5 }}
                    locations={[0, 0.58, 1]}
                    start={{ x: 0, y: 0.5 }}
                    className="items-center justify-center px-4 py-1.5"
                    style={{ minWidth: 118 }}
                  >
                    {isSubmitting ? (
                      <ActivityIndicator color="#FFFFFF" size="small" />
                    ) : (
                      <Text
                        className="text-[14px] font-extrabold text-white"
                        style={textStyle(14)}
                      >
                        {t("community.feed.shareNowButton")}
                      </Text>
                    )}
                  </LinearGradient>
                </Pressable>
              </View>
            </View>
          </SafeAreaView>
        </View>
      </KeyboardAvoidingView>
    </Modal>
  );
}

function CommunityCommentComposerModal({
  comments,
  commentsErrorMessage,
  commentsStatus,
  draft,
  isSubmitting,
  onChangeDraft,
  onClose,
  onRetryComments,
  onSubmit,
  postAuthor,
  visible,
}: {
  comments: PostComment[];
  commentsErrorMessage: string | null;
  commentsStatus: CommunityCommentsStatus;
  draft: string;
  isSubmitting: boolean;
  onChangeDraft: (value: string) => void;
  onClose: () => void;
  onRetryComments: () => void;
  onSubmit: () => void;
  postAuthor: string | null;
  visible: boolean;
}) {
  const { t } = useTranslation();
  const trimmedDraftLength = draft.trim().length;
  const showCommentsLoading = commentsStatus === "loading";
  const showCommentsEmptyState =
    commentsStatus === "ready" && comments.length === 0;
  const emptyCommentIllustration = require("../../../../assets/images/posttachnen.png");

  return (
    <Modal
      animationType="slide"
      onRequestClose={onClose}
      transparent
      visible={visible}
    >
      <KeyboardAvoidingView
        behavior={Platform.OS === "ios" ? "padding" : undefined}
        className="flex-1"
      >
        <View className="flex-1 justify-end bg-[#20161C]/42">
          <Pressable
            className="flex-1"
            disabled={isSubmitting}
            onPress={onClose}
          />

          <SafeAreaView edges={["left", "right", "bottom"]}>
            <View
              className="rounded-t-[32px] bg-[#FFF9FD] px-4 pb-4 pt-3"
              style={{ maxHeight: "88%" }}
            >
              <ScrollView
                keyboardShouldPersistTaps="handled"
                showsVerticalScrollIndicator={false}
              >
                <View className="flex-row items-start justify-between gap-3">
                  <View className="flex-1">
                    <Text
                      className="text-[18px] font-black text-[#2F2337]"
                      style={textStyle(18)}
                    >
                      {t("community.feed.writeCommentTitle")}
                    </Text>
                    <Text
                      className="mt-0.5 text-[12px] text-[#8F8298]"
                      style={textStyle(12)}
                    >
                      {postAuthor
                        ? t("community.feed.commentForAuthor", {
                            author: postAuthor,
                          })
                        : t("community.feed.commentForPost")}
                    </Text>
                  </View>

                  <Pressable
                    className="h-10 w-10 items-center justify-center rounded-full bg-white"
                    disabled={isSubmitting}
                    onPress={onClose}
                    style={pillShadowStyle}
                  >
                    <SymbolView
                      name={{
                        ios: "xmark",
                        android: "close",
                        web: "close",
                      }}
                      size={16}
                      tintColor="#A06A85"
                    />
                  </Pressable>
                </View>

                <View className="mt-3 rounded-[24px] bg-white px-3.5 py-3.5">
                  <TextInput
                    editable={!isSubmitting}
                    maxLength={communityCommentMaxLength}
                    multiline
                    onChangeText={onChangeDraft}
                    placeholder={t("community.feed.commentPlaceholder")}
                    placeholderTextColor="#B39EAD"
                    style={{
                      color: "#2F242C",
                      fontSize: 15,
                      lineHeight: bodyLineHeightFor(15),
                      minHeight: 104,
                      padding: 0,
                      textAlignVertical: "top",
                    }}
                    value={draft}
                  />
                </View>

                <View className="mt-1.5 flex-row items-center justify-between">
                  <Text
                    className="text-[11px] font-medium text-[#A897B2]"
                    style={textStyle(11)}
                  >
                    {t("community.feed.commentPublicNotice")}
                  </Text>
                  <Text
                    className="text-[11px] font-medium text-[#A897B2]"
                    style={textStyle(11)}
                  >
                    {`${trimmedDraftLength}/${communityCommentMaxLength}`}
                  </Text>
                </View>

                <View className="mt-3 flex-row gap-2.5">
                  <Pressable
                    className="flex-1 items-center justify-center rounded-[20px] bg-white px-4 py-3"
                    disabled={isSubmitting}
                    onPress={onClose}
                    style={pillShadowStyle}
                  >
                    <Text
                      className="text-[13px] font-bold text-[#8E869A]"
                      style={textStyle(13)}
                    >
                      {t("common.cancel")}
                    </Text>
                  </Pressable>

                  <Pressable
                    className="flex-1 overflow-hidden rounded-[20px]"
                    disabled={isSubmitting || trimmedDraftLength === 0}
                    onPress={onSubmit}
                    style={({ pressed }) => ({
                      opacity:
                        isSubmitting || trimmedDraftLength === 0
                          ? 0.72
                          : pressed
                            ? 0.9
                            : 1,
                    })}
                  >
                    <LinearGradient
                      colors={gradientColors}
                      end={{ x: 1, y: 0.5 }}
                      locations={[0, 0.58, 1]}
                      start={{ x: 0, y: 0.5 }}
                      className="items-center justify-center px-4 py-3"
                    >
                      {isSubmitting ? (
                        <ActivityIndicator color="#FFFFFF" size="small" />
                      ) : (
                        <Text
                          className="text-[13px] font-extrabold text-white"
                          style={textStyle(13)}
                        >
                          {t("community.feed.submitCommentButton")}
                        </Text>
                      )}
                    </LinearGradient>
                  </Pressable>
                </View>

                <View className="mt-4">
                  <View className="flex-row items-center justify-between">
                    <Text
                      className="text-[14px] font-black text-[#2F2337]"
                      style={textStyle(14)}
                    >
                      {t("community.posts.comment")}
                    </Text>
                    <Text
                      className="text-[11px] font-medium text-[#A897B2]"
                      style={textStyle(11)}
                    >
                      {commentsStatus === "ready"
                        ? t("community.feed.commentCountLabel", {
                            count: comments.length,
                          })
                        : t("community.feed.commentsPagePlaceholder", {
                            size: communityPostCommentsPageSize,
                          })}
                    </Text>
                  </View>

                  {showCommentsLoading ? (
                    <View className="mt-3 rounded-[22px] bg-white px-3.5 py-3.5">
                      <View className="items-center">
                        <ActivityIndicator color="#EB489B" size="small" />
                      </View>
                    </View>
                  ) : null}

                  {commentsErrorMessage ? (
                    <View className="mt-3 rounded-[22px] bg-[#FFF7FB] px-3.5 py-3.5">
                      <Text
                        className="text-[13px] font-bold text-[#C2416C]"
                        style={textStyle(13)}
                      >
                        {commentsErrorMessage}
                      </Text>
                      <Pressable
                        className="mt-2.5 self-start rounded-full bg-white px-4 py-2"
                        onPress={onRetryComments}
                        style={pillShadowStyle}
                      >
                        <Text
                          className="text-[12px] font-bold text-[#B45384]"
                          style={textStyle(12)}
                        >
                          {t("community.feed.retryLoad")}
                        </Text>
                      </Pressable>
                    </View>
                  ) : null}

                  {comments.length > 0 ? (
                    <View className="mt-2.5 gap-2.5">
                      {comments.map((item) => (
                        <CommunityCommentCard
                          key={`${item.postActionId}-${item.userId}`}
                          item={item}
                        />
                      ))}
                    </View>
                  ) : null}

                  {showCommentsEmptyState ? (
                    <View className="items-center px-3 py-0">
                      <Image
                        source={emptyCommentIllustration}
                        style={{ height: 420, width: 420 }}
                      />
                      <Text
                        className="mt-[-28px] text-[14px] font-semibold text-[#43354C]"
                        style={textStyle(14)}
                      >
                        {t("community.feed.noCommentsTitle")}
                      </Text>
                      <Text
                        className="mt-[-6px] text-center text-[12px] text-[#8F8298]"
                        style={textStyle(12)}
                      >
                        {t("community.feed.noCommentsDescription")}
                      </Text>
                    </View>
                  ) : null}
                </View>
              </ScrollView>
            </View>
          </SafeAreaView>
        </View>
      </KeyboardAvoidingView>
    </Modal>
  );
}
