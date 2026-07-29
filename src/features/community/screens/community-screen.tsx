import { SymbolView } from "@/components/ui/symbol-view";
import { LinearGradient } from "expo-linear-gradient";
import { useFocusEffect, useRouter, type Href } from "expo-router";
import { StatusBar } from "expo-status-bar";
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
  Text as RNText,
  TextInput,
  View,
  type TextProps,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

import {
  getValidAccessToken,
  useAuthSession,
  type AuthSession,
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
import type { Profile } from "@/features/profile/types";
import { useScreenLayout } from "@/hooks/use-screen-layout";
import { getPostVisibilityLabel } from "@/lib/post-visibility";
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
import { cacheCommunityGroupSession } from "../data/community-group-session-store";
import { cacheCommunityExplorerProfile } from "../data/community-explorer-profile-cache";
import {
  cacheCommunityPost,
  getCachedCommunityPosts,
  type CommunityFeedMediaItem,
  type CommunityFeedPost,
} from "../data/community-post-cache";
import {
  useCommunityGroups,
  type CommunityGroupsStatus,
} from "../hooks/use-community-groups";

const PROJECT_WORDMARK = "Culture Quest Lite";
const detailTextMaxFontSizeMultiplier = 1.05;

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

const screenShadowStyle = {
  shadowColor: "rgba(15, 23, 42, 0.12)",
  shadowOpacity: 1,
  shadowRadius: 28,
  shadowOffset: {
    width: 0,
    height: 18,
  },
  elevation: 10,
} as const;

const subtleBorderColor = "#E5E7EB";
const subtleBorderWidth = 0.8;

type SymbolName = ComponentProps<typeof SymbolView>["name"];
type CommunityCommentsStatus = "idle" | "loading" | "ready" | "error";
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

  return `${parsedDate.getDate().toString().padStart(2, "0")}/${(
    parsedDate.getMonth() + 1
  )
    .toString()
    .padStart(2, "0")}/${parsedDate.getFullYear()}`;
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
      ? (normalizedDisplayName ?? normalizedUsername ?? "Bạn")
      : "Khách",
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
  const tags = post.tags
    .map((tag) => readMeaningfulText(tag.name))
    .filter((tag): tag is string => Boolean(tag));

  if (post.isTaggedRoute) {
    tags.unshift("Route");
  }

  return Array.from(new Set(tags)).slice(0, 4);
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

function mapNewsfeedPostToCommunityFeedPost(
  post: NewsfeedPost,
): CommunityFeedPost {
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
    canOpenProfile: true,
    visibility: readMeaningfulText(post.visibility) ?? "PUBLIC",
  };
}

function buildCommunityPostMetaLabel(post: CommunityFeedPost) {
  const values = [
    readMeaningfulText(post.tags[0]),
    readMeaningfulText(post.badge),
    readMeaningfulText(post.mood),
  ];

  return values.find((value): value is string => Boolean(value)) ?? null;
}

function CommunityLoadingState() {
  return (
    <View className="flex-1 bg-[#FFF9FD]">
      <SafeAreaView
        className="flex-1"
        edges={["top", "left", "right", "bottom"]}
      >
        <View className="flex-1 items-center justify-center px-6">
          <View
            className="w-full rounded-[32px] bg-white px-6 py-8"
            style={[screenShadowStyle, { maxWidth: 360 }]}
          >
            <View className="items-center">
              <ActivityIndicator color="#EB489B" size="large" />
            </View>
          </View>
        </View>
      </SafeAreaView>
    </View>
  );
}

export default function CommunityScreen() {
  const router = useRouter();
  const authSession = useAuthSession();
  const { gutter, safeWidth } = useScreenLayout({ maxContentWidth: 640 });
  const likedPostsAccountKey = authSession.isAuthenticated
    ? authSession.username?.trim() || authSession.displayName.trim() || null
    : null;
  const fallbackComposerIdentity =
    buildComposerIdentityFromSession(authSession);
  const [communityFeedPosts, setCommunityFeedPosts] = useState<
    CommunityFeedPost[]
  >([]);
  const [communityFeedError, setCommunityFeedError] = useState<string | null>(
    null,
  );
  const [requestedHotspotIds, setRequestedHotspotIds] = useState<
    Record<number, true>
  >({});
  const [resolvedHotspots, setResolvedHotspots] = useState<
    Record<number, ResolvedHotspotPreview>
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
  const [likingPostIds, setLikingPostIds] = useState<number[]>([]);
  const [communityFeedStatus, setCommunityFeedStatus] =
    useState<CommunityFeedStatus>("loading");
  const [composerIdentity, setComposerIdentity] = useState<ComposerIdentity>(
    fallbackComposerIdentity,
  );
  const [currentProfileId, setCurrentProfileId] = useState<string | null>(null);
  const persistedLikedPostIds = useLikedPostIds(likedPostsAccountKey);
  const {
    errorMessage: communityGroupsError,
    groups: communityGroups,
    status: communityGroupsStatus,
  } = useCommunityGroups();

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

        const mappedPosts = response.content.map(
          mapNewsfeedPostToCommunityFeedPost,
        );
        mappedPosts.forEach(cacheCommunityExplorerProfile);
        setCommunityFeedPosts(mappedPosts);
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

  useEffect(() => {
    communityFeedPosts.forEach(cacheCommunityExplorerProfile);
  }, [communityFeedPosts]);

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

  const displayedPosts = useMemo<CommunityFeedPost[]>(
    () =>
      communityFeedStatus === "ready"
        ? communityFeedPosts
        : communityFeedStatus === "error"
          ? communityPosts.slice()
          : [],
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
  const resolvedComposerIdentity =
    composerIdentity.accountKey === fallbackComposerIdentity.accountKey
      ? composerIdentity
      : fallbackComposerIdentity;
  const composerPlaceholderText = authSession.isAuthenticated
    ? "Chia sẻ trải nghiệm của bạn..."
    : "Đăng nhập để chia sẻ trải nghiệm của bạn...";
  const previewCommunityGroups = useMemo(
    () => communityGroups.slice(0, 3),
    [communityGroups],
  );
  const showInitialCommunityLoading =
    communityFeedStatus === "loading" && communityFeedPosts.length === 0;

  useFocusEffect(
    useCallback(() => {
      let isActive = true;

      async function loadComposerIdentity() {
        if (!authSession.isAuthenticated) {
          if (!isActive) {
            return;
          }

          setCurrentProfileId(null);
          setComposerIdentity(fallbackComposerIdentity);
          return;
        }

        try {
          const accessToken = await getValidAccessToken();

          if (!accessToken) {
            if (!isActive) {
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

          if (!isActive) {
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

          if (!isActive) {
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
      Alert.alert("Không mở được nhóm", "Dữ liệu nhóm này chưa hợp lệ.");
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
  }, [
    authSession.isAuthenticated,
    authSession.tokenType,
    commentTargetPost?.postNumericId,
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
        "Thiếu nội dung",
        "Hãy nhập nội dung trước khi gửi bình luận.",
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

    if (
      !post.canLike ||
      typeof postNumericId !== "number" ||
      postNumericId <= 0
    ) {
      return;
    }

    if (
      persistedLikedPostIds.includes(postNumericId) ||
      likingPostIds.includes(postNumericId)
    ) {
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
          replaceCommunityFeedPostLikeCount(
            current,
            postNumericId,
            resolvedLikeCount,
          ),
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
      setLikingPostIds((current) =>
        current.filter((id) => id !== postNumericId),
      );
    }
  }

  if (showInitialCommunityLoading) {
    return <CommunityLoadingState />;
  }

  return (
    <SafeAreaView className="flex-1 bg-white" edges={["top", "left", "right"]}>
      <StatusBar style="dark" />

      <View className="flex-1 bg-white">
        <ScrollView
          showsVerticalScrollIndicator={false}
          contentContainerStyle={{ paddingBottom: 20 }}
        >
          <View className="pb-5 pt-3" style={{ paddingHorizontal: gutter }}>
            <View className="flex-row items-center justify-between">
              <View className="flex-row items-center gap-2.5">
                <Pressable
                  className="h-10 w-10 items-center justify-center rounded-[16px] border bg-white"
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

                <Text className="text-[20px] font-black tracking-[-0.4px] text-[#EB489B]">
                  {PROJECT_WORDMARK}
                </Text>
              </View>

              <View className="flex-row items-center gap-1.5">
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

            <View className="mt-4 gap-2">
              <View
                className="flex-row items-center rounded-[24px] bg-white"
                style={[
                  composerShadowStyle,
                  {
                    marginHorizontal: -4,
                    paddingBottom: 8,
                    paddingLeft: 6,
                    paddingRight: 8,
                    paddingTop: 8,
                  },
                ]}
              >
                <ComposerAvatar
                  displayName={resolvedComposerIdentity.displayName}
                  uri={resolvedComposerIdentity.avatarUri}
                />

                <Pressable
                  className="ml-2 flex-1 px-0 py-1"
                  onPress={openCommunityComposer}
                >
                  <Text
                    className="text-[12px] font-medium text-[#B1A2AB]"
                    style={{ includeFontPadding: false, lineHeight: 12 }}
                  >
                    {composerPlaceholderText}
                  </Text>
                </Pressable>

                <Pressable
                  className="ml-2 h-9 w-9 items-center justify-center rounded-full border"
                  onPress={openCommunityComposer}
                  style={{
                    backgroundColor: "#F1F3F5",
                    borderColor: subtleBorderColor,
                    borderWidth: subtleBorderWidth,
                  }}
                >
                  <SymbolView
                    name={{
                      ios: "photo.on.rectangle.angled",
                      android: "image",
                      web: "image",
                    }}
                    size={15}
                    tintColor="#9CA3AF"
                  />
                </Pressable>
              </View>
            </View>

            <View className="mt-4">
              <CommunityDiscoverGroupsSection
                currentProfileId={currentProfileId}
                errorMessage={communityGroupsError}
                groups={previewCommunityGroups}
                onCreateGroup={openCommunityGroupCreate}
                onOpenAll={openCommunityGroupsList}
                onOpenGroup={handleOpenDiscoverGroup}
                status={communityGroupsStatus}
              />
            </View>

            <View className="mt-4 gap-3">
              {communityFeedStatus === "loading" ? (
                <View
                  className="rounded-[28px] border bg-white px-4 py-5"
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
                  className="rounded-[28px] border bg-[#FFF8FC] px-4 py-4"
                  style={{
                    borderColor: subtleBorderColor,
                    borderWidth: subtleBorderWidth,
                  }}
                >
                  <Text className="text-[15px] font-bold text-[#C2416C]">
                    {communityFeedError ?? "Không tải được newsfeed cộng đồng."}
                  </Text>
                  <Text className="mt-1 text-[14px] leading-[17px] text-[#8E869A]">
                    Đang hiển thị feed mẫu tạm thời để màn hình không bị trống.
                  </Text>
                </View>
              ) : null}

              {communityFeedStatus !== "loading" ? (
                displayedPosts.length ? (
                  displayedPosts.map((post) => {
                    const postNumericId = post.postNumericId ?? null;
                    const isLiking =
                      postNumericId !== null &&
                      likingPostIdsSet.has(postNumericId);
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
                ) : (
                  <View
                    className="rounded-[28px] border bg-white px-4 py-5"
                    style={{
                      borderColor: subtleBorderColor,
                      borderWidth: subtleBorderWidth,
                    }}
                  >
                    <Text className="text-[18px] font-black text-[#2E2336]">
                      Chưa có cập nhật mới
                    </Text>
                    <Text className="mt-1 text-[14px] leading-[17px] text-[#8E869A]">
                      Feed cộng đồng hiện chưa có bài mới. Hãy quay lại sau để
                      xem thêm hoạt động từ các explorer.
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
  status,
}: {
  currentProfileId: string | null;
  errorMessage: string | null;
  groups: readonly CommunityGroupPayload[];
  onCreateGroup: () => void;
  onOpenAll: () => void;
  onOpenGroup: (group: CommunityGroupPayload) => void;
  status: CommunityGroupsStatus;
}) {
  const showEmptyState = status === "ready" && groups.length === 0;
  const showErrorState = status === "error" && groups.length === 0;
  const showLoadingState = status === "loading" && groups.length === 0;

  return (
    <View>
      <View className="flex-row items-center justify-between">
        <Text
          className="text-[16px] font-normal text-[#2E2336]"
          style={{ includeFontPadding: false, lineHeight: 18 }}
        >
          Nhóm cộng đồng
        </Text>
        <Pressable hitSlop={8} onPress={onOpenAll}>
          <Text className="text-[13px] font-semibold text-[#D97706]">
            Xem tất cả
          </Text>
        </Pressable>
      </View>

      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={{
          paddingRight: 8,
          paddingTop: 10,
          gap: 10,
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
            description={
              errorMessage ?? "Không tải được danh sách nhóm cộng đồng."
            }
            title="Không tải được nhóm"
          />
        ) : null}
        {showEmptyState ? (
          <CommunityGroupCompactStateCard
            description="Hiện chưa có nhóm nào để hiển thị."
            title="Chưa có nhóm"
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
  if (items.length === 0) {
    return null;
  }

  const singleMediaHeight = Math.min(
    Math.max((edgeToEdgeWidth - 48) * 0.62, 180),
    236,
  );

  if (items.length === 1) {
    return (
      <View className="overflow-hidden rounded-[10px] bg-[#EEF2F7]">
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
    <View className="overflow-hidden rounded-[10px] bg-[#EEF2F7]">
      <View className="flex-row flex-wrap" style={{ gap: 2 }}>
        {previewItems.map((item, index) => {
          const isHeroImage = previewItems.length === 3 && index === 0;
          const shouldShowOverlay =
            index === previewItems.length - 1 && hiddenCount > 0;
          const itemHeight = isHeroImage ? 184 : 112;

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
    </View>
  );
}

function CommunityPostFooterStatButton({
  active = false,
  disabled = false,
  count,
  icon,
  isLoading = false,
  onPress,
}: {
  active?: boolean;
  disabled?: boolean;
  count: string;
  icon: SymbolName;
  isLoading?: boolean;
  onPress?: (() => void) | undefined;
}) {
  const iconColor = active ? "#D94679" : "#6B7280";
  const textColor = active ? "#D94679" : "#6B7280";

  return (
    <Pressable
      className="flex-row items-center rounded-full pr-1"
      disabled={disabled || !onPress}
      hitSlop={8}
      onPress={onPress}
      style={({ pressed }) => ({
        opacity: disabled ? 0.5 : pressed ? 0.72 : 1,
      })}
    >
      {isLoading ? (
        <ActivityIndicator color="#D94679" size="small" />
      ) : (
        <SymbolView name={icon} size={20} tintColor={iconColor} />
      )}
      <Text
        className="ml-1.5 text-[14px] font-medium"
        style={{ color: textColor, includeFontPadding: false, lineHeight: 16 }}
      >
        {count}
      </Text>
    </Pressable>
  );
}

function CommunityPostCard({
  edgeToEdgeWidth,
  isLiked,
  isLiking,
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
      ? null
      : showHotspotFallbackLabel
        ? "Hotspot đang cập nhật"
        : readMeaningfulText(post.location);
  const shouldShowHotspotLocation =
    showHotspotLoadingState || Boolean(locationLabel);
  const canOpenHotspotLocation = primaryHotspot !== null;
  const metaLabel = buildCommunityPostMetaLabel(post);
  const locationPillLabel =
    locationLabel ?? (showHotspotLoadingState ? "Đang tải hotspot" : null);

  return (
    <View
      className="rounded-[28px] bg-white px-3.5 pb-3 pt-3"
      style={{
        borderColor: subtleBorderColor,
        borderWidth: subtleBorderWidth,
        shadowColor: "rgba(34, 23, 33, 0.06)",
        shadowOpacity: 1,
        shadowRadius: 18,
        shadowOffset: { width: 0, height: 8 },
        elevation: 4,
      }}
    >
      <View className="flex-row items-start">
        <Pressable
          accessibilityLabel={`Mở hồ sơ của ${post.author}`}
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
          <AvatarMonogram
            colors={post.avatarColors}
            initials={post.initials}
            size={42}
          />
        </Pressable>

        <View className="ml-2.5 flex-1 pr-2">
          <View className="flex-row flex-wrap items-center gap-1">
            <Text
              className="text-[15px] font-black text-[#2F2432]"
              numberOfLines={1}
              style={{ includeFontPadding: false, lineHeight: 15 }}
            >
              {post.author}
            </Text>
            {metaLabel ? (
              <View className="rounded-full bg-[#F3F0EC] px-2 py-0.5">
                <Text
                  className="text-[10px] font-semibold text-[#7A6D65]"
                  numberOfLines={1}
                  style={{ includeFontPadding: false, lineHeight: 11 }}
                >
                  {metaLabel}
                </Text>
              </View>
            ) : null}
          </View>

          <Text
            className="text-[12px] font-medium text-[#8A7D86]"
            style={{ includeFontPadding: false, lineHeight: 11 }}
          >
            {post.time}
          </Text>
        </View>

        <View className="h-8 w-8 items-center justify-center rounded-full bg-[#F7F4F1]">
          <SymbolView
            name={{
              ios: "ellipsis",
              android: "more_horiz",
              web: "more_horiz",
            }}
            size={15}
            tintColor="#7B7077"
          />
        </View>
      </View>

      <View className="pt-1">
        <ExpandablePostCaption text={post.caption} />

        {shouldShowHotspotLocation ? (
          <Pressable
            className="mt-1.5 self-start rounded-full bg-[#F7F4F1] px-2.5 py-1"
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
            <View className="flex-row items-center">
              {showHotspotLoadingState ? (
                <ActivityIndicator color="#D97706" size="small" />
              ) : (
                <SymbolView
                  name={{
                    ios: "mappin.and.ellipse",
                    android: "location_on",
                    web: "location_on",
                  }}
                  size={16}
                  tintColor={canOpenHotspotLocation ? "#D97706" : "#9CA3AF"}
                />
              )}
              {locationPillLabel ? (
                <Text
                  className="ml-1.5 text-[11px] font-semibold text-[#6D5F59]"
                  numberOfLines={1}
                  style={{ includeFontPadding: false, lineHeight: 11 }}
                >
                  {locationPillLabel}
                </Text>
              ) : null}
            </View>
          </Pressable>
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

      <View className="mt-2.5 flex-row items-center">
        <CommunityPostFooterStatButton
          active={isLiked}
          count={post.likes}
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
        />
        <View className="ml-3">
          <CommunityPostFooterStatButton
            count={post.comments}
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
          />
        </View>
        <View className="flex-1" />
        <Pressable
          className="h-9 w-9 items-center justify-center rounded-full"
          disabled
          style={{ opacity: 0.72 }}
        >
          <SymbolView
            name={{
              ios: "square.and.arrow.up",
              android: "share",
              web: "share",
            }}
            size={18}
            tintColor="#6B7280"
          />
        </Pressable>
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
      className="text-[15px] text-[#33293A]"
      style={{ includeFontPadding: false, lineHeight: 19 }}
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
  const normalizedUsername =
    readMeaningfulText(item.username)?.replace(/^@/, "") ?? null;
  const shouldShowUsername =
    normalizedUsername !== null &&
    normalizeLookupText(normalizedUsername) !==
      normalizeLookupText(displayName);

  return (
    <View
      className="rounded-[24px] border bg-white px-3.5 py-3"
      style={[
        cardShadowStyle,
        {
          borderColor: subtleBorderColor,
          borderWidth: subtleBorderWidth,
        },
      ]}
    >
      <View className="flex-row items-start gap-2.5">
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
                  className="text-[11px] font-medium text-[#A06A85]"
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
            className="mt-1.5 text-[14px] text-[#4A3C54]"
            style={{ includeFontPadding: false, lineHeight: 17 }}
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
  const showCommentsEmptyState =
    commentsStatus === "ready" && comments.length === 0;

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
                    <Text className="text-[20px] font-black text-[#2F2337]">
                      Viết bình luận
                    </Text>
                    <Text className="mt-0.5 text-[13px] leading-[18px] text-[#8F8298]">
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
                  className="mt-3 rounded-[24px] border bg-white px-3.5 py-3.5"
                  style={[
                    cardShadowStyle,
                    {
                      borderColor: subtleBorderColor,
                      borderWidth: subtleBorderWidth,
                    },
                  ]}
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
                      lineHeight: 20,
                      minHeight: 118,
                      padding: 0,
                      textAlignVertical: "top",
                    }}
                    value={draft}
                  />
                </View>

                <View className="mt-1.5 flex-row items-center justify-between">
                  <Text className="text-[12px] font-medium text-[#A897B2]">
                    Bình luận sẽ được gửi công khai.
                  </Text>
                  <Text className="text-[12px] font-medium text-[#A897B2]">
                    {`${trimmedDraftLength}/${communityCommentMaxLength}`}
                  </Text>
                </View>

                <View className="mt-3 flex-row gap-2.5">
                  <Pressable
                    className="flex-1 items-center justify-center rounded-[20px] border bg-white px-4 py-3"
                    disabled={isSubmitting}
                    onPress={onClose}
                    style={{
                      borderColor: subtleBorderColor,
                      borderWidth: subtleBorderWidth,
                    }}
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
                      className="items-center justify-center px-4 py-3"
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

                <View className="mt-4">
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
                      className="mt-2.5 rounded-[22px] border bg-white px-3.5 py-3.5"
                      style={[
                        cardShadowStyle,
                        {
                          borderColor: subtleBorderColor,
                          borderWidth: subtleBorderWidth,
                        },
                      ]}
                    >
                      <View className="items-center">
                        <ActivityIndicator color="#EB489B" size="small" />
                      </View>
                    </View>
                  ) : null}

                  {commentsErrorMessage ? (
                    <View
                      className="mt-2.5 rounded-[22px] border bg-[#FFF7FB] px-3.5 py-3.5"
                      style={{
                        borderColor: subtleBorderColor,
                        borderWidth: subtleBorderWidth,
                      }}
                    >
                      <Text className="text-[14px] font-bold text-[#C2416C]">
                        {commentsErrorMessage}
                      </Text>
                      <Pressable
                        className="mt-2.5 self-start rounded-full bg-white px-4 py-2"
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
                    <View
                      className="mt-2.5 rounded-[22px] border bg-white px-3.5 py-3.5"
                      style={[
                        cardShadowStyle,
                        {
                          borderColor: subtleBorderColor,
                          borderWidth: subtleBorderWidth,
                        },
                      ]}
                    >
                      <Text className="text-[15px] font-semibold text-[#43354C]">
                        Chưa có bình luận nào
                      </Text>
                      <Text className="mt-1 text-[13px] leading-[18px] text-[#8F8298]">
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
