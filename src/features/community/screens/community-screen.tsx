import { type Href, useFocusEffect, useRouter } from "expo-router";
import { LinearGradient } from "expo-linear-gradient";
import { StatusBar } from "expo-status-bar";
import { SymbolView } from "@/components/ui/symbol-view";
import {
  useCallback,
  useEffect,
  useMemo,
  useState,
  type ComponentProps,
} from "react";
import {
  ActivityIndicator,
  Alert,
  Image,
  KeyboardAvoidingView,
  Modal,
  Platform,
  Pressable,
  ScrollView,
  Text,
  TextInput,
  View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

import {
  type AuthSession,
  getValidAccessToken,
  useAuthSession,
} from "@/features/auth/hooks/use-auth-session";
import { commentPost } from "@/features/home/api/comment-post";
import {
  getPostComments,
  type PostComment,
} from "@/features/home/api/get-post-comments";
import { likePost } from "@/features/home/api/like-post";
import { getHotspotById } from "@/features/home/api/get-hotspot-by-id";
import {
  addLikedPostId,
  removeLikedPostId,
  useLikedPostIds,
} from "@/features/home/data/liked-post-store";
import {
  getApiHotspotRouteSlug,
  getHotspotHref,
} from "@/features/home/data/hotspots";
import { useScreenLayout } from "@/hooks/use-screen-layout";
import { getPostVisibilityLabel } from "@/lib/post-visibility";
import {
  communityPosts,
  type CommunityPostTopic,
} from "../data/community-demo";
import {
  cacheCommunityPost,
  getCachedCommunityPosts,
  type CommunityFeedMediaItem,
  type CommunityFeedPost,
} from "../data/community-post-cache";
import {
  getNewsfeedPosts,
  type NewsfeedPost,
} from "../api/get-newsfeed-posts";
import { getMyProfile } from "@/features/profile/api/get-me";
import type { Profile } from "@/features/profile/types";

const PROJECT_WORDMARK = "Culture Quest Lite";

const gradientColors = ["#EB489B", "#F58752", "#FFC93C"] as const;

const composerShadowStyle = {
  shadowColor: "rgba(235, 72, 155, 0.16)",
  shadowOpacity: 1,
  shadowRadius: 20,
  shadowOffset: {
    width: 0,
    height: 10,
  },
  elevation: 8,
} as const;

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

type SymbolName = ComponentProps<typeof SymbolView>["name"];
type CommunityCommentsStatus = "idle" | "loading" | "ready" | "error";
type CommunityTabKey = "community" | "following";
type CommunityFeedStatus = "idle" | "loading" | "ready" | "error";
type ResolvedHotspotPreview = {
  hotspotId: number;
  hotspotName: string;
};
type ComposerIdentity = {
  accountKey: string | null;
  avatarUri: string | null;
  displayName: string;
  username: string | null;
};

type CommunityTab = {
  key: CommunityTabKey;
  label: string;
  description: string;
  eyebrow: string;
  icon: SymbolName;
  stat: string;
  statLabel: string;
  title: string;
};

type TagPalette = {
  backgroundColor: string;
  borderColor: string;
  textColor: string;
};

const communityTabs: readonly CommunityTab[] = [
  {
    key: "community",
    label: "Cộng đồng",
    eyebrow: "Toàn bộ hoạt động",
    title: "Nhịp cộng đồng đang diễn ra",
    description:
      "Bài chia sẻ, meetup và lời mời tham gia route được gom trong một feed để bạn theo dõi nhanh mọi chuyển động.",
    stat: "143",
    statLabel: "hoạt động mới",
    icon: {
      ios: "person.3.fill",
      android: "groups",
      web: "groups",
    },
  },
  {
    key: "following",
    label: "Đang theo dõi",
    eyebrow: "Mạng lưới của bạn",
    title: "Cập nhật từ những người bạn đang theo dõi",
    description:
      "Xem nhanh bài đăng và lời mời mới nhất từ host, culture guide và explorer mà bạn đã chọn theo dõi.",
    stat: "24",
    statLabel: "nguồn tin",
    icon: {
      ios: "bell",
      android: "notifications",
      web: "notifications",
    },
  },
] as const;

const topicTagPalettes: Record<CommunityPostTopic, TagPalette> = {
  culture: {
    backgroundColor: "#FFF1F6",
    borderColor: "#F6C9DA",
    textColor: "#D24C89",
  },
  art: {
    backgroundColor: "#EEF5FF",
    borderColor: "#C8DBFF",
    textColor: "#3E73DD",
  },
  cuisine: {
    backgroundColor: "#FFF4E8",
    borderColor: "#FFD9B0",
    textColor: "#D9781E",
  },
  history: {
    backgroundColor: "#F3EEE6",
    borderColor: "#DCC9A9",
    textColor: "#8A5B2E",
  },
};

const tagPalettes: Record<string, TagPalette> = {
  "Văn hóa": topicTagPalettes.culture,
  "Nghệ thuật": topicTagPalettes.art,
  "Ẩm thực": topicTagPalettes.cuisine,
  "Lịch sử": topicTagPalettes.history,
  "Check-in": {
    backgroundColor: "#F6F0FF",
    borderColor: "#DDCCFF",
    textColor: "#8557D3",
  },
  "Góc đẹp": {
    backgroundColor: "#EDFDF5",
    borderColor: "#BCECCF",
    textColor: "#238A57",
  },
  "Triển lãm": {
    backgroundColor: "#EFF8FF",
    borderColor: "#BFE1FF",
    textColor: "#2D7CD6",
  },
  "Sinh viên": {
    backgroundColor: "#F4F3FF",
    borderColor: "#D6D3FF",
    textColor: "#6D5BD0",
  },
  Meetup: {
    backgroundColor: "#FFF0F3",
    borderColor: "#F7C7D1",
    textColor: "#D65377",
  },
  "Đi bộ nhẹ": {
    backgroundColor: "#ECFDF5",
    borderColor: "#BBF7D0",
    textColor: "#1C9A5F",
  },
  "Kiến trúc": {
    backgroundColor: "#F4F0EA",
    borderColor: "#D9C8B1",
    textColor: "#8C6943",
  },
  "Hoàng hôn": {
    backgroundColor: "#FFF7E8",
    borderColor: "#FFE0A6",
    textColor: "#C78418",
  },
};

const meaninglessTextValues = new Set(["", "string", "null", "undefined"]);
const communityFeedPageSize = 10;
const communityPostCommentsPageSize = 10;
const communityCommentMaxLength = 320;
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
    return `${elapsedMinutes} phút trước`;
  }

  const elapsedHours = Math.floor(elapsedMinutes / 60);

  if (elapsedHours < 24) {
    return `${elapsedHours} giờ trước`;
  }

  const elapsedDays = Math.floor(elapsedHours / 24);

  if (elapsedDays < 7) {
    return `${elapsedDays} ngày trước`;
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

function buildComposerIdentityFromSession(authSession: AuthSession): ComposerIdentity {
  const normalizedDisplayName = readMeaningfulText(authSession.displayName);
  const normalizedUsername = readMeaningfulText(authSession.username)?.replace(/^@/, "") ?? null;
  const accountKey =
    normalizedUsername ??
    normalizedDisplayName ??
    (authSession.isAuthenticated ? "authenticated-user" : null);

  return {
    accountKey,
    avatarUri: null,
    displayName: authSession.isAuthenticated
      ? normalizedDisplayName ?? normalizedUsername ?? "Bạn"
      : "Khách",
    username: normalizedUsername,
  };
}

function buildComposerIdentityFromProfile(
  profile: Profile,
  fallbackIdentity: ComposerIdentity,
): ComposerIdentity {
  const normalizedDisplayName = readMeaningfulText(profile.name);
  const normalizedUsername = readMeaningfulText(profile.username)?.replace(/^@/, "") ?? null;

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
  const tags = post.tags
    .map((tag) => readMeaningfulText(tag.name))
    .filter((tag): tag is string => Boolean(tag));

  if (post.isTaggedRoute) {
    tags.unshift("Route");
  }

  return Array.from(new Set(tags)).slice(0, 4);
}

function resolveTopicFromNewsfeed(post: NewsfeedPost, tags: string[]): CommunityPostTopic {
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

function buildNewsfeedLocation(post: NewsfeedPost) {
  if (post.hotspotIds.length === 1) {
    return "1 hotspot được gắn";
  }

  if (post.hotspotIds.length > 1) {
    return `${post.hotspotIds.length} hotspot được gắn`;
  }

  if (post.routeIds.length === 1) {
    return `Route #${post.routeIds[0]}`;
  }

  if (post.routeIds.length > 1) {
    return `${post.routeIds.length} route được gắn`;
  }

  return "";
}

function buildNewsfeedMood(post: NewsfeedPost) {
  const statusLabel =
    readMeaningfulText(post.status)?.toUpperCase() === "APPROVED"
      ? "Đã duyệt"
      : readMeaningfulText(post.status);
  const visibilityValue = readMeaningfulText(post.visibility);
  const visibilityLabel = visibilityValue
    ? getPostVisibilityLabel(visibilityValue)
    : null;
  const segments = [statusLabel, visibilityLabel].filter(
    (value): value is string => Boolean(value),
  );

  return segments.join(" · ") || "Cập nhật mới từ cộng đồng";
}

function buildNewsfeedBadge(post: NewsfeedPost) {
  if (post.isTaggedHotspot) {
    return "Hotspot";
  }

  if (post.isTaggedRoute) {
    return "Route";
  }

  return "Newsfeed";
}

function replaceCommunityFeedPostLikeCount(
  posts: CommunityFeedPost[],
  postNumericId: number,
  likeCount: number,
) {
  const normalizedLikeCount = Math.max(0, Math.round(likeCount));

  return posts.map((post) =>
    post.postNumericId === postNumericId
      ? {
          ...post,
          likeCountValue: normalizedLikeCount,
          likes: formatCompactCount(normalizedLikeCount),
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

function mapNewsfeedPostToCommunityFeedPost(post: NewsfeedPost): CommunityFeedPost {
  const author =
    readMeaningfulText(post.displayName) ??
    readMeaningfulText(post.username) ??
    "Người dùng";
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
      : "Explorer community",
    time: formatCommunityTime(post.createdAt),
    caption: readMeaningfulText(post.text) ?? "Bài viết mới từ cộng đồng.",
    location: buildNewsfeedLocation(post),
    mood: buildNewsfeedMood(post),
    badge: buildNewsfeedBadge(post),
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
    commentCountValue: post.commentCount,
    isLiked: post.isLiked === true,
    likeCountValue: post.likeCount,
    mediaItems,
    postNumericId: post.postId,
    replyCountValue: post.replyCount,
    shareCountValue: post.shareCount,
    avatarColors: getAvatarPalette(`${author}-${post.userNumericId}`),
    canComment: true,
    canLike: true,
    canOpenProfile: false,
    visibility: readMeaningfulText(post.visibility) ?? "PUBLIC",
  };
}

export default function CommunityScreen() {
  const router = useRouter();
  const authSession = useAuthSession();
  const { gutter, safeWidth } = useScreenLayout({ maxContentWidth: 640 });
  const likedPostsAccountKey = authSession.isAuthenticated
    ? authSession.username?.trim() || authSession.displayName.trim() || null
    : null;
  const fallbackComposerIdentity = buildComposerIdentityFromSession(authSession);
  const [activeTab, setActiveTab] = useState<CommunityTabKey>("community");
  const [communityFeedPosts, setCommunityFeedPosts] = useState<CommunityFeedPost[]>(
    [],
  );
  const [communityFeedError, setCommunityFeedError] = useState<string | null>(
    null,
  );
  const [requestedHotspotIds, setRequestedHotspotIds] = useState<Record<number, true>>({});
  const [resolvedHotspots, setResolvedHotspots] = useState<
    Record<number, ResolvedHotspotPreview>
  >({});
  const [commentDraft, setCommentDraft] = useState("");
  const [commentTargetPost, setCommentTargetPost] = useState<CommunityFeedPost | null>(
    null,
  );
  const [communityPostComments, setCommunityPostComments] = useState<PostComment[]>(
    [],
  );
  const [communityPostCommentsError, setCommunityPostCommentsError] =
    useState<string | null>(null);
  const [communityPostCommentsStatus, setCommunityPostCommentsStatus] =
    useState<CommunityCommentsStatus>("idle");
  const [isCommentSubmitting, setIsCommentSubmitting] = useState(false);
  const [likingPostIds, setLikingPostIds] = useState<number[]>([]);
  const [communityFeedStatus, setCommunityFeedStatus] =
    useState<CommunityFeedStatus>("idle");
  const [composerIdentity, setComposerIdentity] = useState<ComposerIdentity>(
    fallbackComposerIdentity,
  );
  const persistedLikedPostIds = useLikedPostIds(likedPostsAccountKey);

  useEffect(() => {
    let isActive = true;

    async function loadCommunityNewsfeed() {
      setCommunityFeedStatus("loading");
      setCommunityFeedError(null);

      try {
        const accessToken = authSession.isAuthenticated
          ? await getValidAccessToken()
          : null;
        const response = await getNewsfeedPosts({
          accessToken,
          page: 0,
          size: communityFeedPageSize,
          tokenType: authSession.tokenType,
        });

        if (!isActive) {
          return;
        }

        setCommunityFeedPosts(response.content.map(mapNewsfeedPostToCommunityFeedPost));
        setCommunityFeedStatus("ready");
      } catch (error) {
        console.warn("[community] load newsfeed failed", {
          error: error instanceof Error ? error.message : error,
        });

        if (!isActive) {
          return;
        }

        setCommunityFeedPosts([]);
        setCommunityFeedError(
          error instanceof Error
            ? error.message
            : "Không tải được newsfeed cộng đồng.",
        );
        setCommunityFeedStatus("error");
      }
    }

    void loadCommunityNewsfeed();

    return () => {
      isActive = false;
    };
  }, [authSession.isAuthenticated, authSession.tokenType]);

  const hotspotIdsToResolve = useMemo(() => {
    const hotspotIds = new Set<number>();

    for (const post of communityFeedPosts) {
      for (const hotspotId of post.hotspotIds ?? []) {
        if (Number.isInteger(hotspotId) && hotspotId > 0) {
          hotspotIds.add(hotspotId);
        }
      }
    }

    return Array.from(hotspotIds);
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

            next[result.value.hotspotId] = {
              hotspotId: result.value.hotspotId,
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

  const filteredPosts = useMemo<CommunityFeedPost[]>(() =>
      activeTab === "community"
        ? (
            communityFeedStatus === "ready"
              ? communityFeedPosts
              : communityFeedStatus === "error"
                ? communityPosts.slice()
                : []
          )
        : communityPosts.filter((post) => post.isFollowing),
    [activeTab, communityFeedPosts, communityFeedStatus],
  );
  const likedPostIdsSet = useMemo(
    () => new Set(persistedLikedPostIds),
    [persistedLikedPostIds],
  );
  const likingPostIdsSet = useMemo(() => new Set(likingPostIds), [likingPostIds]);
  const resolvedComposerIdentity =
    composerIdentity.accountKey === fallbackComposerIdentity.accountKey
      ? composerIdentity
      : fallbackComposerIdentity;
  const composerPlaceholderText = authSession.isAuthenticated
    ? "Chia sẻ trải nghiệm của bạn..."
    : "Đăng nhập để chia sẻ trải nghiệm của bạn...";

  useFocusEffect(
    useCallback(() => {
      let isActive = true;

      async function loadComposerIdentity() {
        if (!authSession.isAuthenticated) {
          return;
        }

        try {
          const accessToken = await getValidAccessToken();

          if (!accessToken) {
            if (!isActive) {
              return;
            }

            setComposerIdentity(fallbackComposerIdentity);
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
          console.warn("[community] load composer identity failed", {
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
    ]),
  );

  useFocusEffect(
    useCallback(() => {
      const cachedEntries = getCachedCommunityPosts().sort(
        (left, right) => right.updatedAt - left.updatedAt,
      );
      const cachedPostsById = new Map(
        cachedEntries.map((entry) => [entry.postId, entry.post] as const),
      );

      if (cachedPostsById.size === 0) {
        return;
      }

      setCommunityFeedPosts((current) => {
        let hasChanges = false;

        const next = current.map((post) => {
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

        if (missingCachedPosts.length === 0) {
          return hasChanges ? next : current;
        }

        return [...missingCachedPosts, ...next];
      });
    }, []),
  );

  const openCommunityComposer = () => {
    router.push("/community/create" as Href);
  };
  const openExplorerProfile = (authorId: string) => {
    router.push(`/community/profile/${authorId}` as Href);
  };
  const openHotspotDetail = (hotspotId: number) => {
    router.push(getHotspotHref(getApiHotspotRouteSlug(hotspotId), hotspotId));
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
          : "Không tải được bình luận của bài viết cộng đồng.",
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
            : "Không tải được bình luận của bài viết cộng đồng.",
        );
        setCommunityPostCommentsStatus("error");
      }
    }

    void loadPostComments();

    return () => {
      isActive = false;
    };
  }, [authSession.isAuthenticated, authSession.tokenType, commentTargetPost?.postNumericId]);

  function handleOpenCommentComposer(post: CommunityFeedPost) {
    const postNumericId = post.postNumericId;

    if (!post.canComment || typeof postNumericId !== "number" || postNumericId <= 0) {
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
      Alert.alert("Thiếu nội dung", "Hãy nhập nội dung trước khi gửi bình luận.");
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

    setIsCommentSubmitting(true);

    try {
      const result = await commentPost({
        accessToken,
        comment: trimmedComment,
        postId: postNumericId,
        tokenType: authSession.tokenType,
      });

      setCommunityFeedPosts((current) => {
        const currentPost = current.find((post) => post.postNumericId === postNumericId);
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
        "Không thể gửi bình luận",
        error instanceof Error
          ? error.message
          : "Đã có lỗi xảy ra khi gửi bình luận cho bài viết cộng đồng.",
      );
    } finally {
      setIsCommentSubmitting(false);
    }
  }

  async function handleLikePost(post: CommunityFeedPost) {
    const postNumericId = post.postNumericId;

    if (!post.canLike || typeof postNumericId !== "number" || postNumericId <= 0) {
      return;
    }

    if (persistedLikedPostIds.includes(postNumericId) || likingPostIds.includes(postNumericId)) {
      return;
    }

    if (!authSession.isAuthenticated) {
      Alert.alert(
        "Cần đăng nhập",
        "Bạn cần đăng nhập để thả tim bài viết cộng đồng.",
      );
      return;
    }

    const accessToken = await getValidAccessToken();

    if (!accessToken) {
      Alert.alert(
        "Phiên đăng nhập hết hạn",
        "Vui lòng đăng nhập lại trước khi thả tim bài viết cộng đồng.",
      );
      return;
    }

    setLikingPostIds((current) =>
      current.includes(postNumericId) ? current : [...current, postNumericId],
    );
    setCommunityFeedPosts((current) =>
      replaceCommunityFeedPostLikeCount(
        current,
        postNumericId,
        Math.max(0, Math.round(post.likeCountValue ?? 0)) + 1,
      ),
    );

    try {
      const result = await likePost({
        accessToken,
        postId: postNumericId,
        tokenType: authSession.tokenType,
      });

      const resolvedLikeCount = result.likeCount;

      if (resolvedLikeCount !== null) {
        setCommunityFeedPosts((current) =>
          replaceCommunityFeedPostLikeCount(current, postNumericId, resolvedLikeCount),
        );
      }

      if (likedPostsAccountKey) {
        addLikedPostId(likedPostsAccountKey, postNumericId);
      }
    } catch (error) {
      setCommunityFeedPosts((current) =>
        replaceCommunityFeedPostLikeCount(
          current,
          postNumericId,
          Math.max(0, Math.round(post.likeCountValue ?? 0)),
        ),
      );

      const errorMessage = error instanceof Error ? error.message : "";
      const normalizedErrorMessage = normalizeLookupText(errorMessage);
      const hasAlreadyLikedError =
        normalizedErrorMessage.includes("already liked") ||
        normalizedErrorMessage.includes("already like") ||
        normalizedErrorMessage.includes("da like") ||
        normalizedErrorMessage.includes("da thich");

      if (hasAlreadyLikedError && likedPostsAccountKey) {
        addLikedPostId(likedPostsAccountKey, postNumericId);
        return;
      }

      if (likedPostsAccountKey) {
        removeLikedPostId(likedPostsAccountKey, postNumericId);
      }

      Alert.alert(
        "Không thể thả tim",
        error instanceof Error
          ? error.message
          : "Đã có lỗi xảy ra khi thả tim bài viết cộng đồng.",
      );
    } finally {
      setLikingPostIds((current) => current.filter((id) => id !== postNumericId));
    }
  }

  return (
    <SafeAreaView className="flex-1 bg-white" edges={["top", "left", "right"]}>
      <StatusBar style="dark" />

      <View className="flex-1 bg-white">
        <ScrollView
          showsVerticalScrollIndicator={false}
          contentContainerStyle={{ paddingBottom: 28 }}
        >
          <View className="pb-8 pt-4" style={{ paddingHorizontal: gutter }}>
            <View className="flex-row items-center justify-between">
              <View className="flex-row items-center gap-3">
                <Pressable
                  className="h-10 w-10 items-center justify-center rounded-[16px] border border-[#F6DFE8] bg-white"
                  style={pillShadowStyle}
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

                <Text className="text-[20px] font-black tracking-[-0.4px] text-[#EB489B]">
                  {PROJECT_WORDMARK}
                </Text>
              </View>

              <View className="flex-row items-center gap-2">
                <CircleIconButton
                  icon={{
                    ios: "magnifyingglass",
                    android: "search",
                    web: "search",
                  }}
                />
                <CircleIconButton
                  icon={{
                    ios: "bell",
                    android: "notifications",
                    web: "notifications",
                  }}
                />
              </View>
            </View>

            <View className="mt-7 gap-3">
              <View
                className="flex-row items-center rounded-[24px] bg-white"
                style={[
                  composerShadowStyle,
                  {
                    marginHorizontal: -6,
                    paddingBottom: 12,
                    paddingLeft: 8,
                    paddingRight: 10,
                    paddingTop: 12,
                  },
                ]}
              >
                <ComposerAvatar
                  displayName={resolvedComposerIdentity.displayName}
                  uri={resolvedComposerIdentity.avatarUri}
                />

                <Pressable
                  className="ml-2.5 flex-1 px-0.5 py-1.5"
                  onPress={openCommunityComposer}
                >
                  <Text
                    className="text-[12px] font-medium text-[#B1A2AB]"
                    style={{ includeFontPadding: false, lineHeight: 13 }}
                  >
                    {composerPlaceholderText}
                  </Text>
                </Pressable>

                <Pressable
                  className="ml-2.5 overflow-hidden rounded-full"
                  onPress={openCommunityComposer}
                >
                  <LinearGradient
                    colors={gradientColors}
                    end={{ x: 1, y: 0.5 }}
                    locations={[0, 0.58, 1]}
                    start={{ x: 0, y: 0.5 }}
                    className="h-9 w-9 items-center justify-center rounded-full"
                  >
                    <SymbolView
                      name={{
                        ios: "photo.on.rectangle.angled",
                        android: "image",
                        web: "image",
                      }}
                      size={15}
                      tintColor="#FFFFFF"
                    />
                  </LinearGradient>
                </Pressable>
              </View>

              <View className="flex-row rounded-full bg-[#FFF1F6] p-1.5">
                {communityTabs.map((tab) => {
                  const isActive = activeTab === tab.key;

                  return (
                    <Pressable
                      key={tab.key}
                      className="flex-1"
                      onPress={() => {
                        setActiveTab(tab.key);
                      }}
                    >
                      {isActive ? (
                        <LinearGradient
                          colors={gradientColors}
                          end={{ x: 1, y: 0.5 }}
                          locations={[0, 0.58, 1]}
                          start={{ x: 0, y: 0.5 }}
                          className="rounded-full px-3.5 py-3"
                          style={pillShadowStyle}
                        >
                          <CommunityTabLabel tab={tab} active />
                        </LinearGradient>
                      ) : (
                        <View className="rounded-full px-3.5 py-3">
                          <CommunityTabLabel tab={tab} />
                        </View>
                      )}
                    </Pressable>
                  );
                })}
              </View>
            </View>

            <View className="mt-4 gap-2">
              {activeTab === "community" && communityFeedStatus === "loading" ? (
                <View
                  className="rounded-[28px] border border-[#F4E0D5] bg-white px-5 py-6"
                  style={cardShadowStyle}
                >
                  <View className="flex-row items-center">
                    <ActivityIndicator color="#EB489B" />
                    <Text className="ml-3 text-[15px] font-semibold text-[#2E2336]">
                      Đang tải newsfeed cộng đồng
                    </Text>
                  </View>
                </View>
              ) : null}

              {activeTab === "community" && communityFeedStatus === "error" ? (
                <View className="rounded-[28px] border border-[#F9E2EA] bg-[#FFF8FC] px-5 py-5">
                  <Text className="text-[15px] font-bold text-[#C2416C]">
                    {communityFeedError ?? "Không tải được newsfeed cộng đồng."}
                  </Text>
                  <Text className="mt-2 text-[14px] leading-5 text-[#8E869A]">
                    Đang hiển thị feed mẫu tạm thời để màn hình không bị trống.
                  </Text>
                </View>
              ) : null}

              {communityFeedStatus !== "loading"
                ? filteredPosts.length
                  ? filteredPosts.map((post) => {
                      const postNumericId = post.postNumericId ?? null;
                      const isLiking =
                        postNumericId !== null && likingPostIdsSet.has(postNumericId);
                      const isLiked =
                        postNumericId !== null &&
                        (isLiking ||
                          likedPostIdsSet.has(postNumericId) ||
                          post.isLiked === true);

                      return (
                        <CommunityPostCard
                          key={post.id}
                          edgeToEdgeWidth={safeWidth}
                          isLiked={isLiked}
                          isLiking={isLiking}
                          pageGutter={gutter}
                          requestedHotspotIds={requestedHotspotIds}
                          post={post}
                          resolvedHotspots={resolvedHotspots}
                          onCommentPost={handleOpenCommentComposer}
                          onLikePost={handleLikePost}
                          onOpenProfile={openExplorerProfile}
                          onOpenHotspot={openHotspotDetail}
                        />
                      );
                    })
                  : (
                      <View className="rounded-[28px] border border-[#F4E0D5] bg-white px-5 py-6">
                        <Text className="text-[18px] font-black text-[#2E2336]">
                          Chưa có cập nhật mới
                        </Text>
                        <Text className="mt-2 text-[14px] leading-5 text-[#8E869A]">
                          {activeTab === "following"
                            ? "Danh sách bạn đang theo dõi hiện chưa có cập nhật mới. Chuyển sang Cộng đồng để xem thêm hoạt động nổi bật."
                            : "Feed cộng đồng hiện chưa có bài mới. Hãy quay lại sau để xem thêm hoạt động từ các explorer."}
                        </Text>
                      </View>
                    )
                : null}
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
    </SafeAreaView>
  );
}

function CircleIconButton({ icon }: { icon: SymbolName }) {
  return (
    <Pressable
      className="h-9 w-9 items-center justify-center rounded-full border"
      style={{
        backgroundColor: "rgba(255,255,255,0.92)",
        borderColor: "#F8DEE8",
      }}
    >
      <SymbolView name={icon} size={15} tintColor="#C95B89" />
    </Pressable>
  );
}

function CommunityTabLabel({
  active = false,
  tab,
}: {
  active?: boolean;
  tab: CommunityTab;
}) {
  return (
    <View className="flex-row items-center justify-center gap-2">
      <SymbolView
        name={tab.icon}
        size={15}
        tintColor={active ? "#FFFFFF" : "#EB489B"}
      />
      <Text
        className={`text-[12px] font-extrabold ${
          active ? "text-white" : "text-[#7C6F82]"
        }`}
      >
        {tab.label}
      </Text>
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
  if (items.length === 0) {
    return null;
  }

  const singleMediaHeight = Math.min(Math.max(edgeToEdgeWidth * 0.82, 250), 360);

  if (items.length === 1) {
    return (
      <View className="overflow-hidden bg-[#EEF2F7]">
        <Image
          source={items[0].source}
          resizeMode="cover"
          style={{ height: singleMediaHeight, width: "100%" }}
        />
      </View>
    );
  }

  const previewItems = items.slice(0, 4);
  const hiddenCount = Math.max(items.length - previewItems.length, 0);

  return (
    <View className="flex-row flex-wrap bg-[#EEF2F7]" style={{ gap: 2 }}>
      {previewItems.map((item, index) => {
        const isHeroImage = previewItems.length === 3 && index === 0;
        const shouldShowOverlay =
          index === previewItems.length - 1 && hiddenCount > 0;
        const itemHeight = isHeroImage ? 264 : 176;

        return (
          <View
            key={item.key}
            style={{
              height: itemHeight,
              overflow: "hidden",
              position: "relative",
              width: isHeroImage ? "100%" : "49.7%",
            }}
          >
            <Image
              source={item.source}
              resizeMode="cover"
              style={{ height: "100%", width: "100%" }}
            />
            {shouldShowOverlay ? (
              <View className="absolute inset-0 items-center justify-center bg-[#111827]/48">
                <Text className="text-[30px] font-black text-white">{`+${hiddenCount}`}</Text>
              </View>
            ) : null}
          </View>
        );
      })}
    </View>
  );
}

function CommunityPostReactionSummary({
  comments,
  isLiked,
  likes,
  shares,
}: {
  comments: string;
  isLiked: boolean;
  likes: string;
  shares: string;
}) {
  return (
    <View className="flex-row items-center justify-between gap-3">
      <View className="flex-row items-center">
        <View
          className="h-6 w-6 items-center justify-center rounded-full"
          style={{ backgroundColor: isLiked ? "#2563EB" : "#1D4ED8" }}
        >
          <SymbolView
            name={{
              ios: "hand.thumbsup.fill",
              android: "thumb_up",
              web: "thumb_up",
            }}
            size={12}
            tintColor="#FFFFFF"
          />
        </View>
        <Text
          className="ml-2 text-[13px] font-medium text-[#4B5563]"
          style={{ includeFontPadding: false, lineHeight: 14 }}
        >
          {likes}
        </Text>
      </View>

      <Text
        className="flex-1 text-right text-[13px] font-medium text-[#6B7280]"
        numberOfLines={1}
        style={{ includeFontPadding: false, lineHeight: 14 }}
      >
        {`${comments} bình luận · ${shares} chia sẻ`}
      </Text>
    </View>
  );
}

function CommunityPostActionButton({
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
  const iconColor = active ? "#2563EB" : "#6B7280";
  const textColor = active ? "#2563EB" : "#4B5563";

  return (
    <Pressable
      className="flex-1 flex-row items-center justify-center rounded-[14px] px-3 py-2.5"
      disabled={disabled || !onPress}
      hitSlop={8}
      onPress={onPress}
      style={({ pressed }) => ({
        backgroundColor: active ? "#EFF6FF" : "transparent",
        opacity: disabled ? 0.5 : pressed ? 0.72 : 1,
      })}
    >
      {isLoading ? (
        <ActivityIndicator color="#2563EB" size="small" />
      ) : (
        <SymbolView name={icon} size={18} tintColor={iconColor} />
      )}
      <Text
        className="ml-2 text-[14px] font-semibold"
        style={{ color: textColor, includeFontPadding: false, lineHeight: 15 }}
      >
        {label}
      </Text>
    </Pressable>
  );
}

function CommunityPostCard({
  edgeToEdgeWidth,
  isLiked,
  isLiking,
  pageGutter,
  post,
  requestedHotspotIds,
  resolvedHotspots,
  onCommentPost,
  onLikePost,
  onOpenProfile,
  onOpenHotspot,
}: {
  edgeToEdgeWidth: number;
  isLiked: boolean;
  isLiking: boolean;
  pageGutter: number;
  post: CommunityFeedPost;
  requestedHotspotIds: Record<number, true>;
  resolvedHotspots: Record<number, ResolvedHotspotPreview>;
  onCommentPost: (post: CommunityFeedPost) => void;
  onLikePost: (post: CommunityFeedPost) => void;
  onOpenProfile: (authorId: string) => void;
  onOpenHotspot: (hotspotId: number) => void;
}) {
  const mediaItems = buildCommunityPostMediaItems(post);
  const hotspotIds = (post.hotspotIds ?? []).filter(
    (hotspotId) => Number.isInteger(hotspotId) && hotspotId > 0,
  );
  const resolvedHotspotItems = hotspotIds
    .map((hotspotId) => resolvedHotspots[hotspotId])
    .filter((item): item is ResolvedHotspotPreview => Boolean(item));
  const hasPendingHotspotRequests = hotspotIds.some(
    (hotspotId) => !requestedHotspotIds[hotspotId],
  );
  const showHotspotLoadingState =
    hotspotIds.length > 0 && hasPendingHotspotRequests;
  const showHotspotFallbackLabel =
    hotspotIds.length > 0 &&
    !showHotspotLoadingState &&
    resolvedHotspotItems.length === 0;
  const primaryHotspot = resolvedHotspotItems[0] ?? null;
  const remainingHotspotCount = Math.max(resolvedHotspotItems.length - 1, 0);
  const locationLabel = primaryHotspot
    ? remainingHotspotCount > 0
      ? `${primaryHotspot.hotspotName} +${remainingHotspotCount}`
      : primaryHotspot.hotspotName
    : showHotspotLoadingState
      ? "Đang tải hotspot"
      : showHotspotFallbackLabel
        ? "Hotspot đang cập nhật"
        : readMeaningfulText(post.location);
  const canOpenHotspotLocation = primaryHotspot !== null;

  return (
    <View className="overflow-hidden bg-white" style={{ marginHorizontal: -pageGutter }}>
      <Pressable
        onPress={() => {
          if (post.canOpenProfile === false) {
            return;
          }

          onOpenProfile(post.authorId);
        }}
        className="flex-row items-start px-4 pb-3 pt-3"
      >
        <AvatarMonogram colors={post.avatarColors} initials={post.initials} size={46} />

        <View className="ml-3 flex-1 pr-3">
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
              size={14}
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
            <Text className="mx-1.5 text-[12px] text-[#9CA3AF]">·</Text>
            <SymbolView
              name={{
                ios: "globe.asia.australia.fill",
                android: "public",
                web: "public",
              }}
              size={12}
              tintColor="#9CA3AF"
            />
          </View>
        </View>

        <View className="h-9 w-9 items-center justify-center rounded-full bg-[#F3F4F6]">
          <SymbolView
            name={{
              ios: "ellipsis",
              android: "more_horiz",
              web: "more_horiz",
            }}
            size={16}
            tintColor="#4B5563"
          />
        </View>
      </Pressable>

      <View className="px-4 pb-3">
        <ExpandablePostCaption text={post.caption} />

        {locationLabel ? (
          <Pressable
            className="mt-2 flex-row items-center"
            disabled={!canOpenHotspotLocation}
            onPress={
              canOpenHotspotLocation
                ? () => {
                    onOpenHotspot(primaryHotspot.hotspotId);
                  }
                : undefined
            }
            style={({ pressed }) => ({
              opacity: canOpenHotspotLocation && pressed ? 0.72 : 1,
            })}
          >
            {showHotspotLoadingState ? (
              <ActivityIndicator color="#2563EB" size="small" />
            ) : (
              <SymbolView
                name={{
                  ios: "mappin.and.ellipse",
                  android: "location_on",
                  web: "location_on",
                }}
                size={17}
                tintColor={canOpenHotspotLocation ? "#2563EB" : "#9CA3AF"}
              />
            )}
            <Text
              className="ml-2 flex-1 text-[14px] font-semibold text-[#4B5563]"
              numberOfLines={1}
              style={{ includeFontPadding: false, lineHeight: 15 }}
            >
              {locationLabel}
            </Text>
          </Pressable>
        ) : null}

        {post.tags.length > 0 ? (
          <View className="mt-2 flex-row flex-wrap gap-1.5">
            {post.tags.slice(0, 3).map((tag) => (
              <TagPill key={`${post.id}-${tag}`} label={tag} />
            ))}
          </View>
        ) : null}
      </View>

      <CommunityPostMediaGallery edgeToEdgeWidth={edgeToEdgeWidth} items={mediaItems} />

      <View className="px-4 pb-3 pt-3">
        <CommunityPostReactionSummary
          comments={post.comments}
          isLiked={isLiked}
          likes={post.likes}
          shares={post.shares}
        />

        <View className="mt-3 h-px bg-[#E5E7EB]" />

        <View className="mt-1 flex-row items-center gap-1">
          <CommunityPostActionButton
            active={isLiked}
            disabled={!post.canLike || isLiking}
            icon={
              isLiked
                ? {
                    ios: "hand.thumbsup.fill",
                    android: "thumb_up",
                    web: "thumb_up",
                  }
                : {
                    ios: "hand.thumbsup",
                    android: "thumb_up_off_alt",
                    web: "thumb_up_off_alt",
                  }
            }
            isLoading={isLiking}
            label="Thích"
            onPress={
              post.canLike
                ? () => {
                    onLikePost(post);
                  }
                : undefined
            }
          />
          <CommunityPostActionButton
            disabled={!post.canComment}
            icon={{
              ios: "bubble.left",
              android: "chat_bubble_outline",
              web: "chat_bubble_outline",
            }}
            label="Bình luận"
            onPress={
              post.canComment
                ? () => {
                    onCommentPost(post);
                  }
                : undefined
            }
          />
          <CommunityPostActionButton
            disabled
            icon={{
              ios: "square.and.arrow.up",
              android: "ios_share",
              web: "ios_share",
            }}
            label="Chia sẻ"
          />
        </View>
      </View>
    </View>
  );
}

function ExpandablePostCaption({ text }: { text: string }) {
  const [expanded, setExpanded] = useState(false);
  const normalizedText = text.trim();
  const maxLength = 150;
  const shouldTruncate = normalizedText.length > maxLength;
  const collapsedText = shouldTruncate
    ? `${normalizedText.slice(0, maxLength).trimEnd()}...`
    : normalizedText;

  return (
    <Text
      className="mt-2 text-[14px] text-[#33293A]"
      style={{ includeFontPadding: false, lineHeight: 16 }}
    >
      {expanded || !shouldTruncate ? normalizedText : collapsedText}
      {shouldTruncate ? (
        <Text
          className="font-medium text-[#B45384]"
          onPress={() => {
            setExpanded((current) => !current);
          }}
        >
          {expanded ? " Rút gọn" : " Xem thêm"}
        </Text>
      ) : null}
    </Text>
  );
}

function TagPill({ label }: { label: string }) {
  const palette = getTagPalette(label);

  return (
    <View
      className="rounded-full border px-2.5 py-1"
      style={{
        backgroundColor: palette.backgroundColor,
        borderColor: palette.borderColor,
      }}
    >
      <Text
        className="text-[10px] font-bold uppercase tracking-[0.4px]"
        style={{ color: palette.textColor, includeFontPadding: false, lineHeight: 11 }}
      >
        {label}
      </Text>
    </View>
  );
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
    <LinearGradient
      colors={colors}
      end={{ x: 1, y: 0.5 }}
      start={{ x: 0, y: 0.5 }}
      style={{
        alignItems: "center",
        borderRadius: Math.max(18, size / 2.8),
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

function getTagPalette(label: string): TagPalette {
  return (
    tagPalettes[label] ?? {
      backgroundColor: "#F5F0FA",
      borderColor: "#DFD4EB",
      textColor: "#7A6197",
    }
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
    return (
      <View className="rounded-full bg-white">
        <AvatarMonogram
          colors={["#EB489B", "#F58752"]}
          initials={getNameInitials(displayName)}
          size={36}
        />
      </View>
    );
  }

  return (
    <View className="overflow-hidden rounded-full bg-white">
      <Image
        source={{ uri }}
        resizeMode="cover"
        style={{ height: 36, width: 36, borderRadius: 18 }}
        onError={() => {
          setFailedUri(uri);
        }}
      />
    </View>
  );
}

function CommunityCommentCard({ item }: { item: PostComment }) {
  const displayName =
    readMeaningfulText(item.displayName) ??
    readMeaningfulText(item.username) ??
    "Người dùng";
  const normalizedUsername = readMeaningfulText(item.username)?.replace(/^@/, "") ?? null;
  const shouldShowUsername =
    normalizedUsername !== null &&
    normalizeLookupText(normalizedUsername) !== normalizeLookupText(displayName);

  return (
    <View
      className="rounded-[24px] border border-[#F1E4EC] bg-white px-4 py-3.5"
      style={cardShadowStyle}
    >
      <View className="flex-row items-start gap-3">
        <AvatarMonogram
          colors={getAvatarPalette(`${displayName}-${item.userId}`)}
          initials={getNameInitials(displayName)}
          size={40}
        />

        <View className="flex-1">
          <View className="flex-row items-center justify-between gap-3">
            <View className="flex-1">
              <Text
                className="text-[14px] font-bold text-[#2F2337]"
                numberOfLines={1}
                style={{ includeFontPadding: false, lineHeight: 15 }}
              >
                {displayName}
              </Text>
              {shouldShowUsername ? (
                <Text
                  className="mt-0.5 text-[11px] font-medium text-[#A06A85]"
                  numberOfLines={1}
                  style={{ includeFontPadding: false, lineHeight: 12 }}
                >
                  @{normalizedUsername}
                </Text>
              ) : null}
            </View>

            <Text
              className="text-[11px] font-medium text-[#94889B]"
              style={{ includeFontPadding: false, lineHeight: 12 }}
            >
              {formatCommunityTime(item.createdAt)}
            </Text>
          </View>

          <Text
            className="mt-2 text-[14px] text-[#4A3C54]"
            style={{ includeFontPadding: false, lineHeight: 18 }}
          >
            {readMeaningfulText(item.comment) ?? "Đã gửi một bình luận."}
          </Text>
        </View>
      </View>
    </View>
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
  const trimmedDraftLength = draft.trim().length;
  const showCommentsLoading = commentsStatus === "loading";
  const showCommentsEmptyState = commentsStatus === "ready" && comments.length === 0;

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
          <Pressable className="flex-1" disabled={isSubmitting} onPress={onClose} />

          <SafeAreaView edges={["left", "right", "bottom"]}>
            <View
              className="rounded-t-[32px] bg-[#FFF9FD] px-5 pb-5 pt-4"
              style={{ maxHeight: "88%" }}
            >
              <ScrollView
                keyboardShouldPersistTaps="handled"
                showsVerticalScrollIndicator={false}
              >
                <View className="flex-row items-start justify-between gap-3">
                  <View className="flex-1">
                    <Text className="text-[20px] font-black text-[#2F2337]">
                      Viết bình luận
                    </Text>
                    <Text className="mt-1 text-[13px] leading-5 text-[#8F8298]">
                      {postAuthor
                        ? `Bình luận cho bài viết của ${postAuthor}.`
                        : "Bình luận cho bài viết cộng đồng."}
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

                <View
                  className="mt-4 rounded-[24px] border border-[#F1E4EC] bg-white px-4 py-4"
                  style={cardShadowStyle}
                >
                  <TextInput
                    editable={!isSubmitting}
                    maxLength={communityCommentMaxLength}
                    multiline
                    onChangeText={onChangeDraft}
                    placeholder="Chia sẻ cảm nhận của bạn về bài viết này..."
                    placeholderTextColor="#B39EAD"
                    style={{
                      color: "#2F242C",
                      fontSize: 15,
                      lineHeight: 22,
                      minHeight: 136,
                      padding: 0,
                      textAlignVertical: "top",
                    }}
                    value={draft}
                  />
                </View>

                <View className="mt-2 flex-row items-center justify-between">
                  <Text className="text-[12px] font-medium text-[#A897B2]">
                    Bình luận sẽ được gửi công khai.
                  </Text>
                  <Text className="text-[12px] font-medium text-[#A897B2]">
                    {`${trimmedDraftLength}/${communityCommentMaxLength}`}
                  </Text>
                </View>

                <View className="mt-4 flex-row gap-3">
                  <Pressable
                    className="flex-1 items-center justify-center rounded-[20px] border border-[#F0DCE8] bg-white px-4 py-3.5"
                    disabled={isSubmitting}
                    onPress={onClose}
                  >
                    <Text className="text-[14px] font-bold text-[#8E869A]">
                      Hủy
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
                      className="items-center justify-center px-4 py-3.5"
                    >
                      {isSubmitting ? (
                        <ActivityIndicator color="#FFFFFF" size="small" />
                      ) : (
                        <Text className="text-[14px] font-extrabold text-white">
                          Gửi bình luận
                        </Text>
                      )}
                    </LinearGradient>
                  </Pressable>
                </View>

                <View className="mt-5">
                  <View className="flex-row items-center justify-between">
                    <Text className="text-[16px] font-black text-[#2F2337]">
                      Bình luận gần đây
                    </Text>
                    <Text className="text-[12px] font-medium text-[#A897B2]">
                      {commentsStatus === "ready"
                        ? `${comments.length} mục`
                        : `Trang 1 / ${communityPostCommentsPageSize}`}
                    </Text>
                  </View>

                  {showCommentsLoading ? (
                    <View
                      className="mt-3 rounded-[22px] border border-[#F1E4EC] bg-white px-4 py-4"
                      style={cardShadowStyle}
                    >
                      <View className="flex-row items-center">
                        <ActivityIndicator color="#EB489B" size="small" />
                        <Text className="ml-3 text-[14px] font-semibold text-[#43354C]">
                          Đang tải bình luận
                        </Text>
                      </View>
                    </View>
                  ) : null}

                  {commentsErrorMessage ? (
                    <View
                      className="mt-3 rounded-[22px] border border-[#F7D9E4] bg-[#FFF7FB] px-4 py-4"
                    >
                      <Text className="text-[14px] font-bold text-[#C2416C]">
                        {commentsErrorMessage}
                      </Text>
                      <Pressable
                        className="mt-3 self-start rounded-full bg-white px-4 py-2"
                        onPress={onRetryComments}
                        style={pillShadowStyle}
                      >
                        <Text className="text-[12px] font-bold text-[#B45384]">
                          Thử tải lại
                        </Text>
                      </Pressable>
                    </View>
                  ) : null}

                  {comments.length > 0 ? (
                    <View className="mt-3 gap-3">
                      {comments.map((item) => (
                        <CommunityCommentCard
                          key={`${item.postActionId}-${item.userId}`}
                          item={item}
                        />
                      ))}
                    </View>
                  ) : null}

                  {showCommentsEmptyState ? (
                    <View
                      className="mt-3 rounded-[22px] border border-[#F1E4EC] bg-white px-4 py-4"
                      style={cardShadowStyle}
                    >
                      <Text className="text-[15px] font-semibold text-[#43354C]">
                        Chưa có bình luận nào
                      </Text>
                      <Text className="mt-1.5 text-[13px] leading-5 text-[#8F8298]">
                        Hãy là người đầu tiên để lại cảm nhận cho bài viết này.
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
