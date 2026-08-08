import { SymbolView } from "@/components/ui/symbol-view";
import { UserAvatar } from "@/components/ui/user-avatar";
import { AppLoadingScreen } from "@/components/ui/app-loading-screen";
import {
  getValidAccessToken,
  useAuthSession,
} from "@/features/auth/hooks/use-auth-session";
import {
  followUser,
  unfollowUser,
} from "@/features/community/api/toggle-user-follow";
import { getHotspotById } from "@/features/home/api/get-hotspot-by-id";
import { likePost } from "@/features/home/api/like-post";
import { sharePost } from "@/features/home/api/share-post";
import {
  getApiHotspotRouteSlug,
  getHotspotHref,
} from "@/features/home/data/hotspots";
import {
  addLikedPostId,
  removeLikedPostId,
  useLikedPostIds,
} from "@/features/home/data/liked-post-store";
import { getUserProfileById } from "@/features/profile/api/get-user-by-id";
import { cacheProfilePost } from "@/features/profile/data/profile-post-cache";
import { mapCreatedPostToProfilePost } from "@/features/profile/lib/map-created-post-to-profile-post";
import type { Profile, ProfilePost } from "@/features/profile/types";
import { getRouteById } from "@/features/route/api/route-api";
import { useScreenLayout } from "@/hooks/use-screen-layout";
import { routes, type RouteItem } from "@/lib/demo-data";
import {
  getPostVisibilityDescription,
  getPostVisibilityIcon,
  getPostVisibilityLabel,
  normalizePostVisibilityValue,
  postVisibilityOptions,
  type PostVisibilityValue,
} from "@/lib/post-visibility";
import type { SharedPostSummary } from "@/lib/shared-post";
import { Image } from "expo-image";
import { LinearGradient } from "expo-linear-gradient";
import {
  useFocusEffect,
  useLocalSearchParams,
  useRouter,
  type Href,
} from "expo-router";
import { StatusBar } from "expo-status-bar";
import {
  useCallback,
  useEffect,
  useMemo,
  useState,
  type ComponentProps,
} from "react";
import {
  Alert,
  KeyboardAvoidingView,
  Modal,
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

import { getCommunityExplorerPosts } from "../api/get-community-explorer-posts";
import {
  getCommunityExplorerProfileById,
  getCommunityPostsByAuthorId,
  type CommunityExplorerProfile,
} from "../data/community-demo";
import { getCachedCommunityExplorerProfile } from "../data/community-explorer-profile-cache";
import {
  cacheCommunityPost,
  getCachedCommunityPost,
  type CommunityFeedMediaItem,
  type CommunityFeedPost,
} from "../data/community-post-cache";
import { bodyLineHeightFor, lineHeightFor } from "@/lib/text-scale";

type SymbolName = ComponentProps<typeof SymbolView>["name"];
type ProfileTabKey = "posts" | "routes";
type PersonalInfoItem = {
  accentColor: string;
  icon: SymbolName;
  text: string;
};
type ApiRouteReference = {
  postCount: number;
  routeId: number;
  sharedPostCount: number;
};
type ResolvedExplorerHotspotPreview = {
  hotspotId: number;
  hotspotName: string;
  imageUri: string | null;
};
type ResolvedExplorerRoutePreview = {
  routeId: number;
  routeName: string;
};

const PROFILE_TABS: readonly {
  key: ProfileTabKey;
  label: string;
  icon: SymbolName;
}[] = [
  {
    key: "posts",
    label: "Bài viết",
    icon: {
      ios: "rectangle.grid.1x2",
      android: "view_agenda",
      web: "view_agenda",
    },
  },
  {
    key: "routes",
    label: "Tuyến đường",
    icon: { ios: "map", android: "route", web: "route" },
  },
] as const;

const cardShadow = {
  shadowColor: "rgba(28, 45, 80, 0.10)",
  shadowOpacity: 1,
  shadowRadius: 20,
  shadowOffset: { width: 0, height: 10 },
  elevation: 10,
} as const;

const heroGradientColors = ["#20476B", "#4F87B2", "#F7F8FC"] as const;
const communitySharePostMaxLength = 500;
const avatarPalettes = [
  ["#EB489B", "#F58752"],
  ["#F58752", "#FFC93C"],
  ["#4F46E5", "#38BDF8"],
  ["#10B981", "#2DD4BF"],
  ["#9333EA", "#EC4899"],
] as const;
const meaninglessTextValues = new Set(["", "string", "null", "undefined"]);
const fallbackPostTimestamp = "03/08/2026";

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

function isNonNull<T>(value: T | null): value is T {
  return value !== null;
}

function getAvatarPalette(seed: string) {
  const paletteIndex =
    Array.from(seed).reduce((total, char) => total + char.charCodeAt(0), 0) %
    avatarPalettes.length;

  return avatarPalettes[paletteIndex] as readonly [string, string];
}

function formatCommunityUsername(username: string) {
  const normalizedUsername = readMeaningfulText(username)?.replace(/^@+/, "");

  if (!normalizedUsername) {
    return "@explorer";
  }

  return `@${normalizedUsername}`;
}

function formatRoleLabel(role: string | null) {
  const normalizedRole = readMeaningfulText(role);

  if (!normalizedRole) {
    return "Explorer";
  }

  return normalizedRole
    .replace(/[_-]+/g, " ")
    .toLowerCase()
    .replace(/\b\w/g, (character) => character.toUpperCase());
}

function buildCommunityExplorerProfileFromApiProfile(
  profile: Profile,
  fallbackProfile?: CommunityExplorerProfile | null,
): CommunityExplorerProfile {
  const normalizedName =
    readMeaningfulText(profile.name) ??
    readMeaningfulText(profile.username) ??
    fallbackProfile?.name ??
    "Explorer";
  const formattedUsername = readMeaningfulText(profile.username)
    ? formatCommunityUsername(profile.username)
    : (fallbackProfile?.username ?? "@explorer");
  const formattedRole = formatRoleLabel(profile.role);
  const levelLabel =
    readMeaningfulText(profile.levelName) ??
    (profile.level ? `Level ${profile.level}` : null);
  const fallbackHeadline = readMeaningfulText(fallbackProfile?.headline);
  const coverSource = readMeaningfulText(profile.cover) ?? "";

  return {
    id: profile.id,
    name: normalizedName,
    username: formattedUsername,
    role: formattedRole,
    headline:
      fallbackHeadline ??
      ([levelLabel, formattedRole].filter(Boolean).join(" • ") ||
        "Explorer đang hoạt động trên cộng đồng Culture Quest."),
    bio: "",
    birthDate: "",
    city: "",
    level: profile.level ?? fallbackProfile?.level ?? 1,
    checkIns: 0,
    followers: profile.followers,
    following: profile.following,
    routesCompleted: 0,
    streakDays: 0,
    badgeCount: 0,
    responseTime: "",
    isPremium: profile.isPremium,
    avatar: profile.avatar ?? undefined,
    cover: coverSource,
    initials: getProfileInitials(normalizedName, formattedUsername),
    avatarColors:
      fallbackProfile?.avatarColors ??
      getAvatarPalette(`${normalizedName}-${profile.id}`),
    interests: [],
    badges: [],
    routeIds: [],
    favoriteRouteIds: [],
  };
}

function formatProfileDate(value?: string | null) {
  const normalizedValue = readMeaningfulText(value);

  if (!normalizedValue) {
    return null;
  }

  const parsedDate = new Date(normalizedValue);
  const parsedTime = parsedDate.getTime();

  if (Number.isNaN(parsedTime)) {
    return normalizedValue;
  }

  return `${parsedDate.getDate().toString().padStart(2, "0")}/${(
    parsedDate.getMonth() + 1
  )
    .toString()
    .padStart(2, "0")}/${parsedDate.getFullYear()}`;
}

function formatCommunityTime(value?: string | null) {
  const normalizedValue = readMeaningfulText(value);

  if (!normalizedValue) {
    return "Vừa xong";
  }

  const parsedDate = new Date(normalizedValue);
  const parsedTime = parsedDate.getTime();

  if (Number.isNaN(parsedTime)) {
    return normalizedValue;
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

  return formatProfileDate(normalizedValue) ?? normalizedValue;
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

function formatCountLabel(value?: number | null) {
  return formatCompactCount(value);
}

function formatProfileTagLabel(tag: string) {
  const normalizedTag = tag.trim().replace(/^#/, "").replace(/\s+/g, "_");

  return normalizedTag ? `#${normalizedTag}` : null;
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

function normalizeExplorerPostStatus(value?: string | null) {
  const normalizedValue =
    typeof value === "string" ? value.trim().toUpperCase() : "";

  switch (normalizedValue) {
    case "APPROVED":
    case "PENDING":
    case "REJECTED":
    case "DELETED":
      return normalizedValue;
    default:
      return null;
  }
}

function getExplorerPostStatusLabel(value?: string | null) {
  switch (normalizeExplorerPostStatus(value)) {
    case "APPROVED":
      return "Đã duyệt";
    case "PENDING":
      return "Chờ duyệt";
    case "REJECTED":
      return "Bị từ chối";
    case "DELETED":
      return "Đã xóa";
    default:
      return typeof value === "string" && value.trim()
        ? value.trim()
        : "Chưa rõ";
  }
}

function getExplorerPostStatusTone(value?: string | null) {
  switch (normalizeExplorerPostStatus(value)) {
    case "APPROVED":
      return {
        backgroundColor: "#E8F7EE",
        borderColor: "#B7E4C7",
        textColor: "#137333",
      };
    case "PENDING":
      return {
        backgroundColor: "#FFF4E5",
        borderColor: "#FAD7A0",
        textColor: "#B45309",
      };
    case "REJECTED":
      return {
        backgroundColor: "#FDECEC",
        borderColor: "#F5C2C7",
        textColor: "#B42318",
      };
    case "DELETED":
      return {
        backgroundColor: "#F3F4F6",
        borderColor: "#E5E7EB",
        textColor: "#6B7280",
      };
    default:
      return {
        backgroundColor: "#F3F4F6",
        borderColor: "#E5E7EB",
        textColor: "#6B7280",
      };
  }
}

function buildCommunityFeedMediaItems(post: CommunityFeedPost) {
  if (Array.isArray(post.mediaItems) && post.mediaItems.length > 0) {
    return post.mediaItems;
  }

  if (post.image) {
    return [
      {
        key: `${post.id}-fallback-image`,
        source: post.image,
      },
    ];
  }

  return [];
}

function buildExplorerRouteLabel(
  routeIds: number[],
  resolvedRoutes: Record<number, ResolvedExplorerRoutePreview>,
) {
  const validRouteIds = routeIds.filter(
    (routeId) => Number.isInteger(routeId) && routeId > 0,
  );

  if (validRouteIds.length === 0) {
    return null;
  }

  const primaryRouteId = validRouteIds[0] ?? null;
  const primaryRouteName =
    primaryRouteId === null
      ? null
      : resolvedRoutes[primaryRouteId]?.routeName?.trim() || null;

  if (validRouteIds.length === 1) {
    return primaryRouteName ?? "Đang tải tuyến đường...";
  }

  return `${primaryRouteName ?? `${validRouteIds.length} tuyến đường được gắn`} +${validRouteIds.length - 1}`;
}

function buildExplorerHotspotSubtitle(
  hotspotIds: number[],
  resolvedHotspots: Record<number, ResolvedExplorerHotspotPreview>,
) {
  const validHotspotIds = hotspotIds.filter(
    (hotspotId) => Number.isInteger(hotspotId) && hotspotId > 0,
  );

  if (validHotspotIds.length === 0) {
    return null;
  }

  const hotspotNames = validHotspotIds
    .map(
      (hotspotId) => resolvedHotspots[hotspotId]?.hotspotName?.trim() || null,
    )
    .filter((hotspotName): hotspotName is string => Boolean(hotspotName));

  if (validHotspotIds.length === 1) {
    return hotspotNames[0] ?? "Đang tải địa điểm...";
  }

  if (hotspotNames.length >= 2) {
    return hotspotNames.length === 2
      ? `${hotspotNames[0]}, ${hotspotNames[1]}`
      : `${hotspotNames[0]}, ${hotspotNames[1]} và ${validHotspotIds.length - 2} địa điểm khác`;
  }

  return `${validHotspotIds.length} địa điểm được gắn`;
}

function buildExplorerHotspotImageUris(
  hotspotIds: number[],
  resolvedHotspots: Record<number, ResolvedExplorerHotspotPreview>,
) {
  return hotspotIds
    .map((hotspotId) => resolvedHotspots[hotspotId]?.imageUri ?? null)
    .filter((imageUri): imageUri is string => Boolean(imageUri));
}

function getExplorerPostTimestamp(post: CommunityFeedPost) {
  const createdAtLabel = formatProfileDate(post.createdAt ?? null);

  if (createdAtLabel) {
    return createdAtLabel;
  }

  return readMeaningfulText(post.time) ?? fallbackPostTimestamp;
}

function syncExplorerPostsWithCommunityCache(posts: CommunityFeedPost[]) {
  return posts.map((post) => {
    const postNumericId = post.postNumericId ?? null;

    if (typeof postNumericId !== "number" || postNumericId <= 0) {
      return post;
    }

    return getCachedCommunityPost(postNumericId)?.post ?? post;
  });
}

function updateOrCacheExplorerFeedPost(
  post: CommunityFeedPost,
  updater: (currentPost: CommunityFeedPost) => CommunityFeedPost,
) {
  const postNumericId = post.postNumericId ?? null;

  if (typeof postNumericId !== "number" || postNumericId <= 0) {
    return null;
  }

  const cachedPost = getCachedCommunityPost(postNumericId)?.post ?? post;

  return cacheCommunityPost(updater(cachedPost));
}

function hasSharedProfilePost(post: ProfilePost) {
  return post.sharedPost !== null;
}

function mapProfilePostToCommunityFeedPost(
  post: ProfilePost,
): CommunityFeedPost {
  const author =
    readMeaningfulText(post.displayName) ??
    readMeaningfulText(post.username) ??
    "Người dùng";
  const normalizedUsername =
    readMeaningfulText(post.username)?.replace(/^@+/, "") ?? null;
  const tags = post.tags
    .map((tag) => readMeaningfulText(tag.name))
    .filter((tag): tag is string => Boolean(tag));
  const firstMedia =
    post.medias.find((media) => readMeaningfulText(media.url)) ?? null;
  const sharedPost = post.sharedPost;
  const caption =
    readMeaningfulText(post.text) ??
    readMeaningfulText(sharedPost?.content) ??
    "Bài viết mới từ cộng đồng.";

  return {
    id: `profile-post-${post.id}`,
    authorId: post.userId,
    author,
    initials: getProfileInitials(author, normalizedUsername ?? author),
    role: normalizedUsername ? `@${normalizedUsername}` : "Explorer community",
    time: formatCommunityTime(post.createdAt),
    caption,
    location: "",
    mood: "",
    badge: sharedPost ? "Chia sẻ" : "",
    hotScore: "",
    views: "",
    likes: formatCountLabel(post.likeCount),
    comments: formatCountLabel(post.commentCount),
    shares: formatCountLabel(post.shareCount),
    topic: "culture",
    isFollowing: false,
    tags,
    image: firstMedia?.url ? { uri: firstMedia.url } : null,
    hotspotIds: post.hotspotIds,
    routeIds: post.routeIds,
    commentCountValue: post.commentCount,
    isLiked: post.isLiked === true,
    likeCountValue: post.likeCount,
    mediaItems: post.medias
      .filter((media) => Boolean(readMeaningfulText(media.url)))
      .map((media) => ({
        key: `${post.id}-media-${media.id}`,
        source: { uri: media.url },
      })),
    postNumericId: Number.isFinite(Number(post.id)) ? Number(post.id) : null,
    shareCountValue: post.shareCount,
    avatarColors: getAvatarPalette(`${author}-${post.userId}`),
    canComment: true,
    canLike: true,
    canOpenProfile: false,
    sharedPost,
    status: readMeaningfulText(post.status) ?? "",
    visibility: readMeaningfulText(post.visibility) ?? "PUBLIC",
  };
}

function buildApiRouteReferences(
  posts: readonly ProfilePost[],
): ApiRouteReference[] {
  const routeReferenceMap = new Map<number, ApiRouteReference>();

  for (const post of posts) {
    const sharedPost = hasSharedProfilePost(post);
    const uniqueRouteIds = Array.from(
      new Set(
        post.routeIds.filter(
          (routeId) => Number.isInteger(routeId) && routeId > 0,
        ),
      ),
    );

    for (const routeId of uniqueRouteIds) {
      const currentReference = routeReferenceMap.get(routeId);

      if (currentReference) {
        currentReference.postCount += 1;
        currentReference.sharedPostCount += sharedPost ? 1 : 0;
        continue;
      }

      routeReferenceMap.set(routeId, {
        postCount: 1,
        routeId,
        sharedPostCount: sharedPost ? 1 : 0,
      });
    }
  }

  return Array.from(routeReferenceMap.values()).sort((left, right) => {
    if (left.postCount !== right.postCount) {
      return right.postCount - left.postCount;
    }

    return left.routeId - right.routeId;
  });
}

export default function CommunityExplorerProfileScreen() {
  const router = useRouter();
  const authSession = useAuthSession();
  const likedPostsAccountKey = authSession.isAuthenticated
    ? authSession.username?.trim() || authSession.displayName.trim() || null
    : null;
  const insets = useSafeAreaInsets();
  const { gutter, safeWidth } = useScreenLayout({ maxContentWidth: 640 });
  const { id } = useLocalSearchParams<{ id?: string | string[] }>();

  const explorerId = Array.isArray(id) ? id[0] : id;
  const demoProfile = useMemo(
    () =>
      explorerId ? getCommunityExplorerProfileById(explorerId) : undefined,
    [explorerId],
  );
  const cachedExplorerProfileEntry = useMemo(
    () => (explorerId ? getCachedCommunityExplorerProfile(explorerId) : null),
    [explorerId],
  );
  const numericExplorerId = explorerId ? Number(explorerId) : Number.NaN;
  const [remoteProfileEntry, setRemoteProfileEntry] = useState<{
    explorerId: string;
    profile: Profile;
  } | null>(null);
  const [remoteProfileErrorEntry, setRemoteProfileErrorEntry] = useState<{
    explorerId: string;
    message: string;
  } | null>(null);
  const [remotePostsEntry, setRemotePostsEntry] = useState<{
    explorerId: string;
    posts: ProfilePost[];
  } | null>(null);
  const [remotePostsErrorEntry, setRemotePostsErrorEntry] = useState<{
    explorerId: string;
    message: string;
  } | null>(null);
  const shouldLoadRemoteProfile = Boolean(
    explorerId && !demoProfile && Number.isFinite(numericExplorerId),
  );

  useEffect(() => {
    if (!shouldLoadRemoteProfile || !explorerId) {
      return;
    }

    let isActive = true;

    void (async () => {
      try {
        const accessToken = authSession.isAuthenticated
          ? await getValidAccessToken()
          : null;
        const [nextProfileResult, nextPostsResult] = await Promise.allSettled([
          getUserProfileById({
            accessToken,
            tokenType: authSession.tokenType,
            userId: explorerId,
          }),
          getCommunityExplorerPosts({
            accessToken,
            page: 0,
            size: 10,
            sort: ["createdAt,DESC"],
            tokenType: authSession.tokenType,
            userId: numericExplorerId,
          }),
        ]);

        if (!isActive) {
          return;
        }

        if (nextProfileResult.status === "fulfilled") {
          setRemoteProfileEntry({
            explorerId,
            profile: nextProfileResult.value,
          });
          setRemoteProfileErrorEntry((current) =>
            current?.explorerId === explorerId ? null : current,
          );
        } else {
          console.warn("[community] failed to load explorer profile", {
            error:
              nextProfileResult.reason instanceof Error
                ? {
                    message: nextProfileResult.reason.message,
                    name: nextProfileResult.reason.name,
                    stack: nextProfileResult.reason.stack,
                  }
                : nextProfileResult.reason,
            explorerId,
          });
          setRemoteProfileErrorEntry({
            explorerId,
            message:
              nextProfileResult.reason instanceof Error
                ? nextProfileResult.reason.message
                : "Không thể tải hồ sơ explorer.",
          });
        }

        if (nextPostsResult.status === "fulfilled") {
          setRemotePostsEntry({
            explorerId,
            posts: nextPostsResult.value.content,
          });
          setRemotePostsErrorEntry((current) =>
            current?.explorerId === explorerId ? null : current,
          );
          return;
        }

        console.warn("[community] failed to load explorer posts", {
          error:
            nextPostsResult.reason instanceof Error
              ? {
                  message: nextPostsResult.reason.message,
                  name: nextPostsResult.reason.name,
                  stack: nextPostsResult.reason.stack,
                }
              : nextPostsResult.reason,
          explorerId,
        });
        setRemotePostsErrorEntry({
          explorerId,
          message:
            nextPostsResult.reason instanceof Error
              ? nextPostsResult.reason.message
              : "Không thể tải bài viết của explorer.",
        });
      } catch (error) {
        if (!isActive) {
          return;
        }

        console.warn("[community] failed to load explorer community data", {
          error:
            error instanceof Error
              ? { message: error.message, name: error.name, stack: error.stack }
              : error,
          explorerId,
        });
        setRemoteProfileErrorEntry({
          explorerId,
          message:
            error instanceof Error
              ? error.message
              : "Không thể tải hồ sơ explorer.",
        });
        setRemotePostsErrorEntry({
          explorerId,
          message:
            error instanceof Error
              ? error.message
              : "Không thể tải bài viết của explorer.",
        });
      }
    })();

    return () => {
      isActive = false;
    };
  }, [
    authSession.isAuthenticated,
    authSession.tokenType,
    explorerId,
    numericExplorerId,
    shouldLoadRemoteProfile,
  ]);
  const remoteProfile =
    shouldLoadRemoteProfile &&
    explorerId &&
    remoteProfileEntry?.explorerId === explorerId
      ? remoteProfileEntry.profile
      : null;
  const remoteProfileError =
    shouldLoadRemoteProfile &&
    explorerId &&
    remoteProfileErrorEntry?.explorerId === explorerId
      ? remoteProfileErrorEntry.message
      : null;
  const remotePosts =
    shouldLoadRemoteProfile &&
    explorerId &&
    remotePostsEntry?.explorerId === explorerId
      ? remotePostsEntry.posts
      : null;
  const remotePostsError =
    shouldLoadRemoteProfile &&
    explorerId &&
    remotePostsErrorEntry?.explorerId === explorerId
      ? remotePostsErrorEntry.message
      : null;
  const usesApiProfileLayout = shouldLoadRemoteProfile;
  const isRemoteProfileLoading =
    shouldLoadRemoteProfile &&
    remoteProfile === null &&
    remoteProfileError === null;
  const apiBackedProfile = useMemo(
    () =>
      remoteProfile
        ? buildCommunityExplorerProfileFromApiProfile(
            remoteProfile,
            cachedExplorerProfileEntry?.profile,
          )
        : null,
    [cachedExplorerProfileEntry?.profile, remoteProfile],
  );
  const profile = useMemo(
    () =>
      demoProfile ??
      apiBackedProfile ??
      (usesApiProfileLayout
        ? null
        : (cachedExplorerProfileEntry?.profile ?? null)),
    [
      apiBackedProfile,
      cachedExplorerProfileEntry,
      demoProfile,
      usesApiProfileLayout,
    ],
  );
  const posts = useMemo<CommunityFeedPost[]>(
    () =>
      explorerId
        ? demoProfile
          ? getCommunityPostsByAuthorId(explorerId)
          : usesApiProfileLayout
            ? (remotePosts ?? []).map(mapProfilePostToCommunityFeedPost)
            : (cachedExplorerProfileEntry?.posts ?? [])
        : [],
    [
      cachedExplorerProfileEntry?.posts,
      demoProfile,
      explorerId,
      remotePosts,
      usesApiProfileLayout,
    ],
  );
  const apiRouteReferences = useMemo(
    () =>
      usesApiProfileLayout ? buildApiRouteReferences(remotePosts ?? []) : [],
    [remotePosts, usesApiProfileLayout],
  );
  const completedRoutes = useMemo<RouteItem[]>(
    () =>
      profile
        ? profile.routeIds
            .map((routeId) => routes.find((route) => route.id === routeId))
            .filter((route): route is RouteItem => Boolean(route))
        : [],
    [profile],
  );
  const favoriteRoutes = useMemo<RouteItem[]>(
    () =>
      profile
        ? profile.favoriteRouteIds
            .map((routeId) => routes.find((route) => route.id === routeId))
            .filter((route): route is RouteItem => Boolean(route))
        : [],
    [profile],
  );
  const serverFollowState = useMemo(() => {
    if (typeof remoteProfile?.isFollowing === "boolean") {
      return remoteProfile.isFollowing;
    }

    return null;
  }, [remoteProfile]);
  const initialIsFollowing = useMemo(() => {
    if (serverFollowState !== null) {
      return serverFollowState;
    }

    return posts.some((post) => post.isFollowing);
  }, [posts, serverFollowState]);
  const [activeTab, setActiveTab] = useState<ProfileTabKey>("posts");
  const [followOverrides, setFollowOverrides] = useState<
    Record<string, boolean>
  >({});
  const [followFollowerCounts, setFollowFollowerCounts] = useState<
    Record<string, number>
  >({});
  const [isFollowRequestPending, setIsFollowRequestPending] = useState(false);
  const [, setCommunityPostCacheVersion] = useState(0);
  const [likingPostIds, setLikingPostIds] = useState<number[]>([]);
  const [resolvedPostHotspots, setResolvedPostHotspots] = useState<
    Record<number, ResolvedExplorerHotspotPreview>
  >({});
  const [resolvedPostRoutes, setResolvedPostRoutes] = useState<
    Record<number, ResolvedExplorerRoutePreview>
  >({});
  const [shareDraft, setShareDraft] = useState("");
  const [shareVisibility, setShareVisibility] =
    useState<PostVisibilityValue>("PUBLIC");
  const [sharePostTarget, setSharePostTarget] =
    useState<CommunityFeedPost | null>(null);
  const [isSharingPost, setIsSharingPost] = useState(false);
  const persistedLikedPostIds = useLikedPostIds(likedPostsAccountKey);
  const displayedPosts = syncExplorerPostsWithCommunityCache(posts);
  const likedPostIdsSet = useMemo(
    () => new Set(persistedLikedPostIds),
    [persistedLikedPostIds],
  );
  const likingPostIdsSet = useMemo(
    () => new Set(likingPostIds),
    [likingPostIds],
  );
  const visibleHotspotIdsToResolve = useMemo(() => {
    const hotspotIds = new Set<number>();

    for (const post of displayedPosts) {
      for (const hotspotId of post.hotspotIds ?? []) {
        if (
          Number.isInteger(hotspotId) &&
          hotspotId > 0 &&
          !resolvedPostHotspots[hotspotId]
        ) {
          hotspotIds.add(hotspotId);
        }
      }
    }

    return Array.from(hotspotIds);
  }, [displayedPosts, resolvedPostHotspots]);
  const visibleRouteIdsToResolve = useMemo(() => {
    const routeIds = new Set<number>();

    for (const post of displayedPosts) {
      for (const routeId of post.routeIds ?? []) {
        if (
          Number.isInteger(routeId) &&
          routeId > 0 &&
          !resolvedPostRoutes[routeId]
        ) {
          routeIds.add(routeId);
        }
      }
    }

    return Array.from(routeIds);
  }, [displayedPosts, resolvedPostRoutes]);

  const handleOpenPostHotspot = useCallback(
    (hotspotId: number) => {
      router.push(getHotspotHref(getApiHotspotRouteSlug(hotspotId), hotspotId));
    },
    [router],
  );

  const handleOpenPostRoute = useCallback(
    (routeId: number) => {
      router.push(`/route/${routeId}` as Href);
    },
    [router],
  );

  const handleOpenCommentPost = useCallback(
    (post: CommunityFeedPost) => {
      const postNumericId = post.postNumericId;

      if (
        post.canComment === false ||
        typeof postNumericId !== "number" ||
        postNumericId <= 0
      ) {
        return;
      }

      cacheCommunityPost(post);
      router.push(`/community/post/${postNumericId}` as Href);
    },
    [router],
  );

  const handleLikePost = useCallback(
    async (post: CommunityFeedPost) => {
      const postNumericId = post.postNumericId;

      if (
        post.canLike === false ||
        typeof postNumericId !== "number" ||
        postNumericId <= 0
      ) {
        return;
      }

      if (likingPostIdsSet.has(postNumericId)) {
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

      const currentIsLiked =
        post.isLiked === true || likedPostIdsSet.has(postNumericId);
      const currentLikeCount = Math.max(
        0,
        Math.round(post.likeCountValue ?? 0),
      );
      const optimisticIsLiked = !currentIsLiked;
      const optimisticLikeCount = optimisticIsLiked
        ? currentLikeCount + 1
        : Math.max(0, currentLikeCount - 1);

      setLikingPostIds((current) =>
        current.includes(postNumericId) ? current : [...current, postNumericId],
      );
      updateOrCacheExplorerFeedPost(post, (currentPost) => ({
        ...currentPost,
        isLiked: optimisticIsLiked,
        likeCountValue: optimisticLikeCount,
        likes: formatCompactCount(optimisticLikeCount),
      }));
      setCommunityPostCacheVersion((current) => current + 1);

      try {
        const result = await likePost({
          accessToken,
          postId: postNumericId,
          tokenType: authSession.tokenType,
        });

        const resolvedIsLiked = result.isLiked ?? optimisticIsLiked;
        const resolvedLikeCount = result.likeCount ?? optimisticLikeCount;

        updateOrCacheExplorerFeedPost(post, (currentPost) => ({
          ...currentPost,
          isLiked: resolvedIsLiked,
          likeCountValue: resolvedLikeCount,
          likes: formatCompactCount(resolvedLikeCount),
        }));
        setCommunityPostCacheVersion((current) => current + 1);

        if (likedPostsAccountKey) {
          if (resolvedIsLiked) {
            addLikedPostId(likedPostsAccountKey, postNumericId);
          } else {
            removeLikedPostId(likedPostsAccountKey, postNumericId);
          }
        }
      } catch (error) {
        updateOrCacheExplorerFeedPost(post, (currentPost) => ({
          ...currentPost,
          isLiked: currentIsLiked,
          likeCountValue: currentLikeCount,
          likes: formatCompactCount(currentLikeCount),
        }));
        setCommunityPostCacheVersion((current) => current + 1);

        if (likedPostsAccountKey) {
          if (currentIsLiked) {
            addLikedPostId(likedPostsAccountKey, postNumericId);
          } else {
            removeLikedPostId(likedPostsAccountKey, postNumericId);
          }
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
    },
    [
      authSession.isAuthenticated,
      authSession.tokenType,
      likedPostIdsSet,
      likedPostsAccountKey,
      likingPostIdsSet,
    ],
  );

  const handleOpenSharePostComposer = useCallback(
    (post: CommunityFeedPost) => {
      const postNumericId = post.postNumericId;

      if (typeof postNumericId !== "number" || postNumericId <= 0) {
        Alert.alert(
          "Không thể chia sẻ",
          "Bài viết này chưa có mã hợp lệ để chia sẻ.",
        );
        return;
      }

      if (!authSession.isAuthenticated) {
        Alert.alert(
          "Cần đăng nhập",
          "Bạn cần đăng nhập để chia sẻ bài viết cộng đồng.",
        );
        return;
      }

      setShareDraft("");
      setShareVisibility("PUBLIC");
      setSharePostTarget(post);
    },
    [authSession.isAuthenticated],
  );

  const handleCloseSharePostComposer = useCallback(() => {
    if (isSharingPost) {
      return;
    }

    setShareDraft("");
    setShareVisibility("PUBLIC");
    setSharePostTarget(null);
  }, [isSharingPost]);

  const handleSubmitSharePost = useCallback(async () => {
    const post = sharePostTarget;
    const postNumericId = post?.postNumericId;

    if (!post || typeof postNumericId !== "number" || postNumericId <= 0) {
      return;
    }

    const accessToken = await getValidAccessToken();

    if (!accessToken) {
      Alert.alert(
        "Phiên đăng nhập hết hạn",
        "Vui lòng đăng nhập lại trước khi chia sẻ bài viết cộng đồng.",
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
      const nextShareCount =
        Math.max(0, Math.round(post.shareCountValue ?? 0)) + 1;

      updateOrCacheExplorerFeedPost(post, (currentPost) => ({
        ...currentPost,
        shareCountValue: nextShareCount,
        shares: formatCompactCount(nextShareCount),
      }));
      setCommunityPostCacheVersion((current) => current + 1);
      cacheProfilePost(mapCreatedPostToProfilePost(sharedPost));

      setSharePostTarget(null);
      setShareDraft("");
      setShareVisibility("PUBLIC");
      Alert.alert(
        "Đã chia sẻ",
        normalizePostVisibilityValue(sharedPost.visibility) === "PRIVATE"
          ? "Bài viết đã được chia sẻ vào mục riêng tư trong hồ sơ của bạn."
          : "Bài viết đã được chia sẻ lên cộng đồng.",
      );
    } catch (error) {
      Alert.alert(
        "Không thể chia sẻ",
        error instanceof Error
          ? error.message
          : "Đã có lỗi xảy ra khi chia sẻ bài viết cộng đồng.",
      );
    } finally {
      setIsSharingPost(false);
    }
  }, [authSession.tokenType, shareDraft, sharePostTarget, shareVisibility]);

  useEffect(() => {
    posts.forEach((post) => {
      if (
        typeof post.postNumericId === "number" &&
        Number.isInteger(post.postNumericId) &&
        post.postNumericId > 0
      ) {
        cacheCommunityPost(post);
      }
    });
  }, [posts]);

  useFocusEffect(
    useCallback(() => {
      setCommunityPostCacheVersion((current) => current + 1);
    }, []),
  );

  useEffect(() => {
    if (visibleHotspotIdsToResolve.length === 0) {
      return;
    }

    let isActive = true;

    async function loadHotspotPreviews() {
      try {
        const accessToken = authSession.isAuthenticated
          ? await getValidAccessToken()
          : null;
        const results = await Promise.allSettled(
          visibleHotspotIdsToResolve.map((hotspotId) =>
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

        setResolvedPostHotspots((current) => {
          const next = { ...current };

          for (const result of results) {
            if (result.status !== "fulfilled") {
              continue;
            }

            const hotspotName = result.value.hotspotName.trim();

            if (!hotspotName) {
              continue;
            }

            const imageUri =
              result.value.medias
                .map((media) => media.fileUrl.trim())
                .find(Boolean) ?? null;

            next[result.value.hotspotId] = {
              hotspotId: result.value.hotspotId,
              hotspotName,
              imageUri,
            };
          }

          return next;
        });
      } catch (error) {
        console.warn("[community] load explorer hotspot previews failed", {
          error: error instanceof Error ? error.message : error,
        });
      }
    }

    void loadHotspotPreviews();

    return () => {
      isActive = false;
    };
  }, [
    authSession.isAuthenticated,
    authSession.tokenType,
    visibleHotspotIdsToResolve,
  ]);

  useEffect(() => {
    if (visibleRouteIdsToResolve.length === 0) {
      return;
    }

    let isActive = true;

    async function loadRoutePreviews() {
      try {
        const accessToken = authSession.isAuthenticated
          ? await getValidAccessToken()
          : null;
        const results = await Promise.allSettled(
          visibleRouteIdsToResolve.map((routeId) =>
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

        setResolvedPostRoutes((current) => {
          const next = { ...current };

          for (const result of results) {
            if (result.status !== "fulfilled") {
              continue;
            }

            const routeName = result.value.routeName.trim();

            if (!routeName) {
              continue;
            }

            next[result.value.routeId] = {
              routeId: result.value.routeId,
              routeName,
            };
          }

          return next;
        });
      } catch (error) {
        console.warn("[community] load explorer route previews failed", {
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
    visibleRouteIdsToResolve,
  ]);

  if (!profile && isRemoteProfileLoading) {
    return <AppLoadingScreen />;
  }

  if (!profile) {
    return (
      <SafeAreaView className="flex-1 items-center justify-center bg-[#F7F8FC] px-6">
        <StatusBar style="dark" />
        <Text className="text-center text-[18px] font-extrabold text-[#2B2233]">
          Không tìm thấy explorer
        </Text>
        <Text className="mt-2 text-center text-[14px] leading-5 text-[#8E869A]">
          {remoteProfileError ??
            "Hồ sơ cộng đồng này không còn khả dụng hoặc dữ liệu demo chưa được tạo."}
        </Text>
        <Pressable
          onPress={() => router.replace("/bookings")}
          className="mt-5 rounded-full bg-[#F58752] px-5 py-3"
          style={cardShadow}
        >
          <Text className="text-[14px] font-extrabold text-white">
            Quay lại cộng đồng
          </Text>
        </Pressable>
      </SafeAreaView>
    );
  }

  const heroHeight = Math.max(Math.min(safeWidth * 0.82, 296), 252);
  const avatarSize = 124;
  const profileOverlap = avatarSize * 0.5;
  const contentBottomPadding = Math.max(28, insets.bottom + 24);
  const canCallFollowApi = Number.isFinite(numericExplorerId);
  const isFollowingProfile = explorerId
    ? (followOverrides[explorerId] ?? serverFollowState ?? initialIsFollowing)
    : initialIsFollowing;
  const followerCount =
    explorerId && typeof followFollowerCounts[explorerId] === "number"
      ? followFollowerCounts[explorerId]
      : isFollowingProfile === initialIsFollowing
        ? profile.followers
        : Math.max(0, profile.followers + (isFollowingProfile ? 1 : -1));
  const postCount = remoteProfile?.totalPosts ?? posts.length;
  const socialStats = [
    { label: "Đang theo dõi", value: profile.following },
    { label: "Follower", value: followerCount },
    { label: "Bài viết", value: postCount },
  ];
  const visibleTabs = PROFILE_TABS;
  const resolvedActiveTab = visibleTabs.some((tab) => tab.key === activeTab)
    ? activeTab
    : "posts";

  async function handleFollowPress() {
    if (!explorerId) {
      return;
    }

    if (!canCallFollowApi) {
      setFollowOverrides((current) => ({
        ...current,
        [explorerId]: !(current[explorerId] ?? initialIsFollowing),
      }));
      return;
    }

    if (!authSession.isAuthenticated) {
      Alert.alert("Cần đăng nhập", "Vui lòng đăng nhập để theo dõi explorer.");
      return;
    }

    const accessToken = await getValidAccessToken();

    if (!accessToken) {
      Alert.alert(
        "Phiên đăng nhập đã hết hạn",
        "Vui lòng đăng nhập lại để tiếp tục.",
      );
      return;
    }

    setIsFollowRequestPending(true);

    try {
      const followResponse = isFollowingProfile
        ? await unfollowUser({
            accessToken,
            tokenType: authSession.tokenType,
            userId: numericExplorerId,
          })
        : await followUser({
            accessToken,
            tokenType: authSession.tokenType,
            userId: numericExplorerId,
          });

      setFollowOverrides((current) => ({
        ...current,
        [explorerId]: followResponse.isFollowing,
      }));
      setFollowFollowerCounts((current) => ({
        ...current,
        [explorerId]: followResponse.totalFollowers,
      }));
    } catch (error) {
      Alert.alert(
        "Không thể cập nhật theo dõi",
        error instanceof Error
          ? error.message
          : "Đã có lỗi xảy ra khi cập nhật theo dõi.",
      );
    } finally {
      setIsFollowRequestPending(false);
    }
  }

  return (
    <SafeAreaView className="flex-1 bg-[#F7F8FC]" edges={["left", "right"]}>
      <StatusBar style="light" />

      <ScrollView
        className="flex-1"
        contentContainerStyle={{ paddingBottom: contentBottomPadding }}
        showsVerticalScrollIndicator={false}
      >
        <View className="relative" style={{ height: heroHeight }}>
          {profile.cover ? (
            <Image
              source={profile.cover}
              contentFit="cover"
              transition={180}
              cachePolicy="memory-disk"
              style={{ width: "100%", height: "100%" }}
            />
          ) : (
            <LinearGradient
              colors={heroGradientColors}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 1 }}
              style={{ width: "100%", height: "100%" }}
            />
          )}
          <LinearGradient
            colors={[
              "rgba(0,0,0,0.10)",
              "rgba(0,0,0,0.05)",
              "rgba(247,248,252,0.28)",
            ]}
            locations={[0, 0.72, 1]}
            style={{ position: "absolute", inset: 0 }}
          />

          <View
            className="absolute flex-row items-center justify-between"
            style={{ left: gutter, paddingTop: insets.top + 10, right: gutter }}
          >
            <Pressable
              accessibilityLabel="Quay lại cộng đồng"
              className="h-10 w-10 items-center justify-center rounded-full bg-black/30"
              onPress={() => router.replace("/bookings")}
            >
              <SymbolView
                name={{
                  ios: "chevron.left",
                  android: "arrow_back",
                  web: "arrow_back",
                }}
                size={16}
                tintColor="#FFFFFF"
              />
            </Pressable>

            <View className="flex-row items-center gap-2">
              <HeroActionButton
                icon={{
                  ios: "bell",
                  android: "notifications_none",
                  web: "notifications_none",
                }}
              />
              <HeroActionButton
                icon={{
                  ios: "square.and.arrow.up",
                  android: "ios_share",
                  web: "ios_share",
                }}
              />
            </View>
          </View>
        </View>

        <View style={{ marginTop: -profileOverlap, paddingHorizontal: gutter }}>
          <View className="items-center">
            <ExplorerAvatar
              avatar={profile.avatar}
              avatarColors={profile.avatarColors}
              initials={getProfileInitials(profile.name, profile.username)}
              size={avatarSize}
            />

            <Text
              className="mt-2 text-center text-[20px] font-extrabold leading-tight text-[#2B2233]"
              numberOfLines={2}
            >
              {profile.name}
            </Text>
            <Text
              className="mt-0.5 text-center text-[13px] font-semibold text-[#8E869A]"
              numberOfLines={1}
            >
              {profile.username}
            </Text>

            <View className="mt-2.5 w-full max-w-[320px] flex-row items-start justify-center">
              {socialStats.map((item, index) => (
                <ProfileCountMetric
                  key={item.label}
                  hasDivider={index < socialStats.length - 1}
                  label={item.label}
                  value={item.value}
                />
              ))}
            </View>

            <View className="mt-2.5 flex-row items-center justify-center gap-2">
              <Pressable
                accessibilityLabel={
                  isFollowingProfile
                    ? "Bỏ theo dõi explorer"
                    : "Theo dõi explorer"
                }
                className={`min-w-[128px] rounded-full px-5 py-2.5 ${
                  isFollowingProfile ? "bg-[#EDEFF4]" : "bg-[#FF4D73]"
                }`}
                disabled={isFollowRequestPending}
                onPress={() => {
                  void handleFollowPress();
                }}
                style={[
                  cardShadow,
                  isFollowRequestPending ? { opacity: 0.7 } : null,
                ]}
              >
                <Text
                  className={`text-center text-[14px] font-extrabold ${
                    isFollowingProfile ? "text-[#2B2233]" : "text-white"
                  }`}
                >
                  {isFollowRequestPending
                    ? "Đang xử lý..."
                    : isFollowingProfile
                      ? "Đã follow"
                      : "Follow"}
                </Text>
              </Pressable>

              <Pressable
                accessibilityLabel="Nhắn tin explorer"
                className="rounded-full border border-[#E6E8EE] bg-white px-4 py-2.5"
              >
                <Text className="text-[14px] font-bold text-[#2B2233]">
                  Nhắn tin
                </Text>
              </Pressable>
            </View>
          </View>

          <View className="mt-2">
            <PersonalInfoCard profile={profile} apiProfile={remoteProfile} />
          </View>

          <View className="mt-2.5 flex-row border-y border-[#E9EAF0]">
            {visibleTabs.map((tab) => {
              const selected = resolvedActiveTab === tab.key;

              return (
                <Pressable
                  key={tab.key}
                  onPress={() => setActiveTab(tab.key)}
                  accessibilityLabel={tab.label}
                  className="flex-1 items-center justify-center gap-1 py-2.5"
                  style={{
                    borderBottomColor: selected ? "#EB489B" : "transparent",
                    borderBottomWidth: 2,
                  }}
                >
                  <SymbolView
                    name={tab.icon}
                    size={16}
                    tintColor={selected ? "#F58752" : "#AA9FB0"}
                  />
                  <Text
                    className={`text-[11px] font-bold ${
                      selected ? "text-[#F58752]" : "text-[#AA9FB0]"
                    }`}
                  >
                    {tab.label}
                  </Text>
                </Pressable>
              );
            })}
          </View>

          <View className="mt-3">
            {resolvedActiveTab === "posts" ? (
              <PostsTabContent
                emptyMessage="Explorer này chưa có bài viết công khai nào."
                errorMessage={usesApiProfileLayout ? remotePostsError : null}
                isSharingPost={isSharingPost}
                likingPostIdsSet={likingPostIdsSet}
                likedPostIdsSet={likedPostIdsSet}
                onCommentPost={handleOpenCommentPost}
                onLikePost={handleLikePost}
                onOpenHotspot={handleOpenPostHotspot}
                onOpenRoute={handleOpenPostRoute}
                onSharePost={handleOpenSharePostComposer}
                posts={displayedPosts}
                profile={profile}
                resolvedHotspots={resolvedPostHotspots}
                resolvedRoutes={resolvedPostRoutes}
                sharePostTarget={sharePostTarget}
              />
            ) : resolvedActiveTab === "routes" ? (
              usesApiProfileLayout ? (
                <ApiRoutesTabContent
                  errorMessage={remotePostsError}
                  onOpenRoute={(routeId) =>
                    router.push(`/route/${routeId}` as Href)
                  }
                  routes={apiRouteReferences}
                />
              ) : (
                <RoutesTabContent
                  completedRoutes={completedRoutes}
                  favoriteRoutes={favoriteRoutes}
                  onOpenRoute={(routeId) =>
                    router.push(`/route/${routeId}` as Href)
                  }
                />
              )
            ) : null}
          </View>
        </View>
      </ScrollView>

      <ExplorerSharePostModal
        authorAvatarUri={null}
        authorName={
          authSession.displayName.trim() ||
          authSession.username?.trim() ||
          "Explorer"
        }
        authorUsername={authSession.username?.trim() ?? null}
        draft={shareDraft}
        isSubmitting={isSharingPost}
        onChangeDraft={setShareDraft}
        onChangeVisibility={setShareVisibility}
        onClose={handleCloseSharePostComposer}
        onSubmit={() => {
          void handleSubmitSharePost();
        }}
        visibility={shareVisibility}
        visible={sharePostTarget !== null}
      />
    </SafeAreaView>
  );
}

function ExplorerAvatar({
  avatar,
  initials,
  size,
}: {
  avatar?: string;
  avatarColors: readonly [string, string];
  initials: string;
  size: number;
}) {
  return (
    <View className="relative">
      <UserAvatar
        containerStyle={{
          elevation: 8,
          shadowColor: "rgba(32, 71, 107, 0.16)",
          shadowOffset: { width: 0, height: 6 },
          shadowOpacity: 1,
          shadowRadius: 14,
        }}
        displayName={initials}
        size={size}
        uri={avatar}
      />
    </View>
  );
}

function HeroActionButton({ icon }: { icon: SymbolName }) {
  return (
    <Pressable className="h-10 w-10 items-center justify-center rounded-full bg-black/30">
      <SymbolView name={icon} size={16} tintColor="#FFFFFF" />
    </Pressable>
  );
}

function ProfileCountMetric({
  hasDivider,
  label,
  value,
}: {
  hasDivider: boolean;
  label: string;
  value: number;
}) {
  return (
    <View className="relative flex-1 items-center px-1">
      <Text className="text-center text-[16px] font-extrabold text-[#2B2233]">
        {formatCompactValue(value)}
      </Text>
      <Text className="mt-0.5 text-center text-[10px] leading-3 text-[#8E869A]">
        {label}
      </Text>
      {hasDivider ? (
        <View
          className="absolute right-0 top-1/2 w-px bg-[#D9DDE6]"
          style={{ height: 28, transform: [{ translateY: -14 }] }}
        />
      ) : null}
    </View>
  );
}

function PersonalInfoCard({
  apiProfile,
  profile,
}: {
  apiProfile: Profile | null;
  profile: CommunityExplorerProfile;
}) {
  const levelLabel =
    typeof apiProfile?.level === "number"
      ? `${apiProfile.level}`
      : (() => {
          const normalizedLevelName = readMeaningfulText(apiProfile?.levelName);
          const matchedLevelNumber =
            normalizedLevelName?.match(/(\d+)/)?.[1] ?? null;
          return matchedLevelNumber ?? normalizedLevelName;
        })();
  const emailLabel = readMeaningfulText(apiProfile?.email);
  const createdAtLabel = formatProfileDate(apiProfile?.createdAt);
  const infoRows: PersonalInfoItem[] = apiProfile
    ? [
        levelLabel
          ? {
              accentColor: "#F59E0B",
              icon: {
                ios: "sparkles",
                android: "auto_awesome",
                web: "auto_awesome",
              } satisfies SymbolName,
              text: `Level: ${levelLabel}`,
            }
          : null,
        emailLabel
          ? {
              accentColor: "#4F87B2",
              icon: {
                ios: "envelope",
                android: "mail",
                web: "mail",
              } satisfies SymbolName,
              text: `Email: ${emailLabel}`,
            }
          : null,
        createdAtLabel
          ? {
              accentColor: "#4F87B2",
              icon: {
                ios: "calendar",
                android: "calendar_month",
                web: "calendar_month",
              } satisfies SymbolName,
              text: `Ngày tham gia: ${createdAtLabel}`,
            }
          : null,
      ].filter(isNonNull)
    : [];

  if (apiProfile && infoRows.length === 0) {
    return null;
  }

  if (!apiProfile) {
    const introText = profile.bio.trim() || profile.headline.trim();
    const fallbackLevelLabel = `Level ${profile.level}`;

    return (
      <View className="px-1 py-1">
        <Text className="text-[17px] font-extrabold text-[#202124]">
          Thông tin cá nhân
        </Text>

        <View className="mt-2.5 gap-2.5">
          <ExpandablePersonalInfoRow
            icon={{
              ios: "text.alignleft",
              android: "subject",
              web: "subject",
            }}
            accentColor="#F58752"
            text={introText}
          />
          <PersonalInfoRow
            icon={{
              ios: "sparkles",
              android: "auto_awesome",
              web: "auto_awesome",
            }}
            accentColor="#F59E0B"
            text={fallbackLevelLabel}
          />
          <PersonalInfoRow
            icon={{
              ios: "mappin.and.ellipse",
              android: "location_on",
              web: "location_on",
            }}
            accentColor="#EB489B"
            text={profile.city}
          />
          <PersonalInfoRow
            icon={{
              ios: "calendar",
              android: "calendar_month",
              web: "calendar_month",
            }}
            accentColor="#4F87B2"
            text={profile.birthDate}
          />
        </View>
      </View>
    );
  }

  return (
    <View className="px-1 py-1">
      <Text className="text-[17px] font-extrabold text-[#202124]">
        Thông tin cá nhân
      </Text>

      <View className="mt-2.5 gap-2.5">
        {infoRows.map((item) => (
          <PersonalInfoRow
            key={`${item.text}-${item.accentColor}`}
            icon={item.icon}
            accentColor={item.accentColor}
            text={item.text}
          />
        ))}
      </View>
    </View>
  );
}

function PersonalInfoRow({
  accentColor,
  icon,
  text,
}: {
  accentColor: string;
  icon: SymbolName;
  text: string;
}) {
  return (
    <View className="flex-row items-center gap-2">
      <View
        className="h-8 w-8 items-center justify-center rounded-full"
        style={{ backgroundColor: `${accentColor}14` }}
      >
        <SymbolView name={icon} size={15} tintColor={accentColor} />
      </View>
      <Text className="min-w-0 flex-1 text-[13px] font-normal leading-[17px] text-[#202124]">
        {text}
      </Text>
    </View>
  );
}

function ExpandablePersonalInfoRow({
  accentColor,
  icon,
  text,
}: {
  accentColor: string;
  icon: SymbolName;
  text: string;
}) {
  const [expanded, setExpanded] = useState(false);
  const maxLength = 78;
  const shouldTruncate = text.length > maxLength;
  const collapsedText = shouldTruncate
    ? `${text.slice(0, maxLength).trimEnd()}...`
    : text;

  return (
    <View className="flex-row items-start gap-2">
      <View
        className="h-8 w-8 items-center justify-center rounded-full"
        style={{ backgroundColor: `${accentColor}14` }}
      >
        <SymbolView name={icon} size={15} tintColor={accentColor} />
      </View>
      <Text className="min-w-0 flex-1 text-[13px] font-normal leading-[17px] text-[#202124]">
        {expanded || !shouldTruncate ? text : collapsedText}
        {shouldTruncate ? (
          <Text
            className="font-semibold text-[#F58752]"
            onPress={() => setExpanded((current) => !current)}
          >
            {expanded ? " Thu gọn" : " Xem thêm"}
          </Text>
        ) : null}
      </Text>
    </View>
  );
}

function PostsTabContent({
  emptyMessage,
  errorMessage,
  isSharingPost,
  likingPostIdsSet,
  likedPostIdsSet,
  onCommentPost,
  onLikePost,
  onOpenHotspot,
  onOpenRoute,
  onSharePost,
  posts,
  profile,
  resolvedHotspots,
  resolvedRoutes,
  sharePostTarget,
}: {
  emptyMessage: string;
  errorMessage?: string | null;
  isSharingPost: boolean;
  likingPostIdsSet: ReadonlySet<number>;
  likedPostIdsSet: ReadonlySet<number>;
  onCommentPost: (post: CommunityFeedPost) => void;
  onLikePost: (post: CommunityFeedPost) => void;
  onOpenHotspot: (hotspotId: number) => void;
  onOpenRoute: (routeId: number) => void;
  onSharePost: (post: CommunityFeedPost) => void;
  posts: CommunityFeedPost[];
  profile: CommunityExplorerProfile;
  resolvedHotspots: Record<number, ResolvedExplorerHotspotPreview>;
  resolvedRoutes: Record<number, ResolvedExplorerRoutePreview>;
  sharePostTarget: CommunityFeedPost | null;
}) {
  if (errorMessage) {
    return (
      <EmptyState
        icon={{
          ios: "exclamationmark.triangle",
          android: "error_outline",
          web: "error_outline",
        }}
        message={errorMessage}
      />
    );
  }

  if (!posts.length) {
    return (
      <EmptyState
        icon={{ ios: "photo", android: "image", web: "image" }}
        message={emptyMessage}
      />
    );
  }

  return (
    <View>
      {posts.map((post, index) => {
        const postNumericId = post.postNumericId ?? null;
        const isLiked =
          postNumericId !== null &&
          (likedPostIdsSet.has(postNumericId) || post.isLiked === true);
        const isLiking =
          postNumericId !== null && likingPostIdsSet.has(postNumericId);

        return (
          <ExplorerProfilePostCard
            isLast={index === posts.length - 1}
            isLiked={isLiked}
            isLiking={isLiking}
            isSharing={
              isSharingPost &&
              postNumericId !== null &&
              sharePostTarget?.postNumericId === postNumericId
            }
            key={post.id}
            onCommentPost={onCommentPost}
            onLikePost={onLikePost}
            onOpenHotspot={onOpenHotspot}
            onOpenRoute={onOpenRoute}
            onSharePost={onSharePost}
            post={post}
            profile={profile}
            resolvedHotspots={resolvedHotspots}
            resolvedRoutes={resolvedRoutes}
          />
        );
      })}
    </View>
  );
}

function ExplorerPostAuthorAvatar({
  avatar,
  name,
}: {
  avatar: string | null | undefined;
  name: string;
}) {
  return <UserAvatar displayName={name} size={42} uri={avatar ?? null} />;
}

function ExplorerExpandablePostCaption({ text }: { text: string }) {
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
      style={{ includeFontPadding: false, lineHeight: lineHeightFor(13) }}
    >
      {expanded || !shouldTruncate ? normalizedText : collapsedText}
      {shouldTruncate ? (
        <Text
          className="font-medium text-[#D4578F]"
          onPress={() => setExpanded((current) => !current)}
        >
          {expanded ? " Rút gọn" : " Xem thêm"}
        </Text>
      ) : null}
    </Text>
  );
}

function ExplorerPostTagChip({ label }: { label: string }) {
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

function ExplorerPostMediaGallery({
  items,
}: {
  items: CommunityFeedMediaItem[];
}) {
  const [activeIndex, setActiveIndex] = useState(0);
  const [galleryWidth, setGalleryWidth] = useState(240);
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
          transition={180}
          cachePolicy="memory-disk"
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
                contentFit="cover"
                transition={180}
                cachePolicy="memory-disk"
                style={{ height: mediaHeight, width: galleryWidth }}
              />
            ))}
          </ScrollView>

          <View className="absolute right-3 top-3 rounded-full bg-black/35 px-2.5 py-1">
            <Text
              className="text-[11px] font-semibold text-white"
              style={{ includeFontPadding: false, lineHeight: lineHeightFor(11) }}
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

function ExplorerSharedPostCard({
  sharedPost,
  withTopSpacing,
}: {
  sharedPost: SharedPostSummary;
  withTopSpacing: boolean;
}) {
  const author =
    sharedPost.displayName.trim() || sharedPost.username.trim() || "Người dùng";
  const content = stripTrailingHashtagBlock(sharedPost.content);
  const mediaItems: CommunityFeedMediaItem[] = sharedPost.medias
    .filter(
      (media: SharedPostSummary["medias"][number]) =>
        media.type.trim().toUpperCase() === "IMAGE" &&
        Boolean(media.url.trim()),
    )
    .map((media: SharedPostSummary["medias"][number]) => ({
      key: `shared-${sharedPost.postId}-media-${media.id}`,
      source: {
        uri: media.url,
      },
    }));
  const tagLabels = sharedPost.tags
    .map((tag: SharedPostSummary["tags"][number]) =>
      formatProfileTagLabel(tag.name),
    )
    .filter((tagLabel): tagLabel is string => Boolean(tagLabel));

  return (
    <View
      className="overflow-hidden rounded-[20px] border border-[#E9EAF0] bg-[#FBFBFD] px-3 pb-3 pt-2.5"
      style={{ marginTop: withTopSpacing ? 10 : 4 }}
    >
      <View className="flex-row items-center">
        <UserAvatar displayName={author} size={34} uri={null} />

        <View className="ml-2.5 flex-1 pr-2">
          <Text
            className="text-[14px] font-bold text-[#2F2432]"
            numberOfLines={1}
            style={{ includeFontPadding: false, lineHeight: lineHeightFor(14) }}
          >
            {author}
          </Text>

          <View className="mt-0.5 flex-row items-center gap-1">
            <Text
              className="text-[12px] text-[#8A7D86]"
              style={{ includeFontPadding: false, lineHeight: lineHeightFor(12) }}
            >
              {formatProfileDate(sharedPost.createdAt) ?? fallbackPostTimestamp}
            </Text>
            <SymbolView
              name={getPostVisibilityIcon(sharedPost.visibility)}
              size={10}
              tintColor="#8A7D86"
            />
          </View>
        </View>
      </View>

      {content ? (
        <View className="pt-2">
          <ExplorerExpandablePostCaption text={content} />
        </View>
      ) : null}

      {mediaItems.length > 0 ? (
        <View className="mt-2">
          <ExplorerPostMediaGallery items={mediaItems} />
        </View>
      ) : null}

      {tagLabels.length > 0 ? (
        <View className="mt-1 flex-row flex-wrap items-center">
          {tagLabels.map((tagLabel) => (
            <ExplorerPostTagChip
              key={`shared-${sharedPost.postId}-${tagLabel}`}
              label={tagLabel}
            />
          ))}
        </View>
      ) : null}
    </View>
  );
}

function ExplorerPostRouteCard({
  label,
  onPress,
}: {
  label: string;
  onPress?: () => void;
}) {
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
            Route
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

function ExplorerPostHotspotCard({
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
            className="text-[12px] font-semibold text-[#18A7B4]"
            style={{ includeFontPadding: false, lineHeight: lineHeightFor(12) }}
          >
            {`${count} hotspot`}
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
                  className={
                    index === 0
                      ? "h-6 w-6 overflow-hidden rounded-full border-2 border-white"
                      : "-ml-2 h-6 w-6 overflow-hidden rounded-full border-2 border-white"
                  }
                >
                  <Image
                    source={{ uri: imageUri }}
                    contentFit="cover"
                    transition={180}
                    cachePolicy="memory-disk"
                    style={{ height: "100%", width: "100%" }}
                  />
                </View>
              ))}
              {remainingCount > 0 ? (
                <View className="-ml-2 h-6 w-6 items-center justify-center rounded-full border-2 border-white bg-[#E7EEF2]">
                  <Text
                    className="text-[11px] font-semibold text-[#55606C]"
                    style={{ includeFontPadding: false, lineHeight: lineHeightFor(11) }}
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

function ExplorerPostAction({
  active = false,
  disabled = false,
  icon,
  label,
  onPress,
  tintColor = "#F15C9B",
}: {
  active?: boolean;
  disabled?: boolean;
  icon: SymbolName;
  label: number | string;
  onPress?: () => void;
  tintColor?: string;
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
      <SymbolView
        name={icon}
        size={18}
        tintColor={active ? tintColor : "#7A7380"}
      />
      <Text
        className="ml-1.5 text-[13px] text-[#706775]"
        style={{ includeFontPadding: false, lineHeight: lineHeightFor(13) }}
      >
        {label}
      </Text>
    </Pressable>
  );
}

function ExplorerSharePostPill({
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
        style={{ includeFontPadding: false, lineHeight: lineHeightFor(13) }}
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

function ExplorerSharePostMenuRow({
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
          style={{ includeFontPadding: false, lineHeight: lineHeightFor(14) }}
        >
          {label}
        </Text>
        <Text
          className="mt-0.5 text-[12px] text-[#8F8298]"
          style={{ includeFontPadding: false, lineHeight: bodyLineHeightFor(12) }}
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

function ExplorerSharePostModal({
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
  const [isVisibilityMenuOpen, setIsVisibilityMenuOpen] = useState(false);
  const [wasVisible, setWasVisible] = useState(visible);

  if (wasVisible !== visible) {
    setWasVisible(visible);
    setIsVisibilityMenuOpen(false);
  }

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
                    style={{
                      includeFontPadding: false,
                      lineHeight: lineHeightFor(15),
                      marginTop: 7,
                    }}
                  >
                    {authorName}
                  </Text>

                  <View className="flex-row items-center">
                    <ExplorerSharePostPill
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
                    <ExplorerSharePostMenuRow
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
                placeholder="Hãy nói gì đó về nội dung này..."
                placeholderTextColor="#B39EAD"
                style={{
                  color: "#2F242C",
                  fontSize: 14,
                  lineHeight: bodyLineHeightFor(14),
                  marginTop: 12,
                  maxHeight: 96,
                  minHeight: 46,
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
                    colors={["#EB489B", "#F58752"]}
                    start={{ x: 0, y: 0.5 }}
                    end={{ x: 1, y: 0.5 }}
                    style={{
                      alignItems: "center",
                      justifyContent: "center",
                      minWidth: 96,
                      paddingHorizontal: 18,
                      paddingVertical: 10,
                    }}
                  >
                    <Text
                      className="text-[14px] font-semibold text-white"
                      style={{ includeFontPadding: false, lineHeight: lineHeightFor(14) }}
                    >
                      {isSubmitting ? "Đang chia sẻ..." : "Chia sẻ"}
                    </Text>
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

function ExplorerProfilePostCard({
  isLast,
  isLiked,
  isLiking,
  isSharing,
  onCommentPost,
  onLikePost,
  onOpenHotspot,
  onOpenRoute,
  onSharePost,
  post,
  profile,
  resolvedHotspots,
  resolvedRoutes,
}: {
  isLast: boolean;
  isLiked: boolean;
  isLiking: boolean;
  isSharing: boolean;
  onCommentPost: (post: CommunityFeedPost) => void;
  onLikePost: (post: CommunityFeedPost) => void;
  onOpenHotspot: (hotspotId: number) => void;
  onOpenRoute: (routeId: number) => void;
  onSharePost: (post: CommunityFeedPost) => void;
  post: CommunityFeedPost;
  profile: CommunityExplorerProfile;
  resolvedHotspots: Record<number, ResolvedExplorerHotspotPreview>;
  resolvedRoutes: Record<number, ResolvedExplorerRoutePreview>;
}) {
  const authorName =
    readMeaningfulText(post.author) ??
    readMeaningfulText(profile.name) ??
    "Người dùng";
  const sharedPost = post.sharedPost ?? null;
  const postContent =
    stripTrailingHashtagBlock(readMeaningfulText(post.caption) ?? "") ||
    (sharedPost ? "" : "Chuyến đi hôm nay rất đáng nhớ.");
  const mediaItems = buildCommunityFeedMediaItems(post);
  const visibilityValue = normalizePostVisibilityValue(
    post.visibility ?? "PUBLIC",
  );
  const visibilityLabel = getPostVisibilityLabel(visibilityValue);
  const visibilityIcon = getPostVisibilityIcon(visibilityValue);
  const statusLabel = getExplorerPostStatusLabel(post.status);
  const statusTone = getExplorerPostStatusTone(post.status);
  const normalizedStatus = normalizeExplorerPostStatus(post.status);
  const hasValidPostId =
    typeof post.postNumericId === "number" && post.postNumericId > 0;
  const isApprovedOrUnknown =
    normalizedStatus === null || normalizedStatus === "APPROVED";
  const canInteractWithPost =
    hasValidPostId && isApprovedOrUnknown && visibilityValue === "PUBLIC";
  const likeCount = Math.max(0, Math.round(post.likeCountValue ?? 0));
  const commentCount = Math.max(0, Math.round(post.commentCountValue ?? 0));
  const shareCount = Math.max(0, Math.round(post.shareCountValue ?? 0));
  const routeIds = (post.routeIds ?? []).filter(
    (routeId) => Number.isInteger(routeId) && routeId > 0,
  );
  const hotspotIds = (post.hotspotIds ?? []).filter(
    (hotspotId) => Number.isInteger(hotspotId) && hotspotId > 0,
  );
  const tagLabels = post.tags
    .map((tag) => formatProfileTagLabel(tag))
    .filter((tagLabel): tagLabel is string => Boolean(tagLabel));
  const routeLabel = buildExplorerRouteLabel(routeIds, resolvedRoutes);
  const hotspotSubtitle = buildExplorerHotspotSubtitle(
    hotspotIds,
    resolvedHotspots,
  );
  const hotspotImageUris = buildExplorerHotspotImageUris(
    hotspotIds,
    resolvedHotspots,
  );
  const isPendingPost = normalizedStatus === "PENDING";
  const statusBadgeLabel =
    normalizedStatus === "PENDING" ? "Chờ duyệt" : statusLabel;

  return (
    <View
      className={isLast ? "" : "mb-3"}
      style={{
        backgroundColor: "#FFFFFF",
        borderColor: "#F0E7ED",
        borderRadius: 24,
        borderWidth: 0.8,
        paddingBottom: 10,
        paddingHorizontal: 16,
        paddingTop: 12,
        shadowColor: "rgba(64, 34, 58, 0.08)",
        shadowOffset: { width: 0, height: 10 },
        shadowOpacity: 1,
        shadowRadius: 20,
        elevation: 4,
      }}
    >
      <View className="flex-row items-start">
        <View className="min-w-0 flex-1 flex-row items-start">
          <ExplorerPostAuthorAvatar
            avatar={profile.avatar ?? null}
            name={authorName}
          />

          <View className="ml-3 flex-1 pr-2">
            <View className="flex-row items-center gap-2">
              <Text
                className="min-w-0 flex-1 text-[15px] font-bold text-[#2F2432]"
                numberOfLines={1}
                style={{ includeFontPadding: false, lineHeight: lineHeightFor(15) }}
              >
                {authorName}
              </Text>
              {isPendingPost ? (
                <View
                  className="rounded-full border px-2 py-[2px]"
                  style={{
                    backgroundColor: statusTone.backgroundColor,
                    borderColor: statusTone.borderColor,
                  }}
                >
                  <Text
                    className="text-[10px] font-semibold"
                    style={{
                      color: statusTone.textColor,
                      includeFontPadding: false,
                      lineHeight: lineHeightFor(10),
                    }}
                  >
                    {statusBadgeLabel}
                  </Text>
                </View>
              ) : null}
            </View>

            <View className="-mt-0.5 flex-row flex-wrap items-center gap-1">
              <Text
                className="text-[12px] text-[#8A7D86]"
                style={{ includeFontPadding: false, lineHeight: lineHeightFor(12) }}
              >
                {getExplorerPostTimestamp(post)}
              </Text>
              <Text
                className="text-[12px] text-[#8A7D86]"
                style={{ includeFontPadding: false, lineHeight: lineHeightFor(12) }}
              >
                •
              </Text>
              <SymbolView name={visibilityIcon} size={10} tintColor="#8A7D86" />
              <Text
                className="text-[12px] text-[#8A7D86]"
                style={{ includeFontPadding: false, lineHeight: lineHeightFor(12) }}
              >
                {visibilityLabel}
              </Text>
              {normalizedStatus !== "APPROVED" && !isPendingPost ? (
                <View
                  className="rounded-full border px-2 py-[2px]"
                  style={{
                    backgroundColor: statusTone.backgroundColor,
                    borderColor: statusTone.borderColor,
                  }}
                >
                  <Text
                    className="text-[10px] font-semibold"
                    style={{
                      color: statusTone.textColor,
                      includeFontPadding: false,
                      lineHeight: lineHeightFor(10),
                    }}
                  >
                    {statusBadgeLabel}
                  </Text>
                </View>
              ) : null}
            </View>
          </View>
        </View>
      </View>

      <View className="pt-1.5">
        {postContent ? (
          <ExplorerExpandablePostCaption text={postContent} />
        ) : null}

        {sharedPost ? (
          <ExplorerSharedPostCard
            sharedPost={sharedPost}
            withTopSpacing={Boolean(postContent)}
          />
        ) : null}

        {tagLabels.length > 0 ? (
          <View className="mt-1 flex-row flex-wrap items-center">
            {tagLabels.map((tagLabel) => (
              <ExplorerPostTagChip
                key={`${post.id}-${tagLabel}`}
                label={tagLabel}
              />
            ))}
          </View>
        ) : null}

        {routeLabel ? (
          <View className="mt-1.5">
            <ExplorerPostRouteCard
              label={routeLabel}
              onPress={
                routeIds.length > 0
                  ? () => {
                      onOpenRoute(routeIds[0] ?? 0);
                    }
                  : undefined
              }
            />
          </View>
        ) : null}

        {hotspotSubtitle ? (
          <View className="mt-1.5">
            <ExplorerPostHotspotCard
              count={hotspotIds.length}
              imageUris={hotspotImageUris}
              onPress={
                hotspotIds.length > 0
                  ? () => {
                      onOpenHotspot(hotspotIds[0] ?? 0);
                    }
                  : undefined
              }
              subtitle={hotspotSubtitle}
            />
          </View>
        ) : null}
      </View>

      {mediaItems.length > 0 ? (
        <View className="mt-2">
          <ExplorerPostMediaGallery items={mediaItems} />
        </View>
      ) : null}

      <View className="mt-2.5 flex-row items-center">
        <ExplorerPostAction
          active={canInteractWithPost && isLiked}
          disabled={!canInteractWithPost || isLiking}
          icon={
            canInteractWithPost && isLiked
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
          label={likeCount}
          onPress={
            canInteractWithPost
              ? () => {
                  onLikePost(post);
                }
              : undefined
          }
        />
        <View className="ml-4">
          <ExplorerPostAction
            disabled={!canInteractWithPost}
            icon={{
              ios: "bubble.left",
              android: "chat_bubble_outline",
              web: "chat_bubble_outline",
            }}
            label={commentCount}
            onPress={
              canInteractWithPost
                ? () => {
                    onCommentPost(post);
                  }
                : undefined
            }
          />
        </View>
        <View className="ml-4">
          <ExplorerPostAction
            disabled={!canInteractWithPost || isSharing}
            icon={{
              ios: "arrowshape.turn.up.right",
              android: "share",
              web: "share",
            }}
            label={shareCount > 0 ? shareCount : "Chia sẻ"}
            onPress={
              canInteractWithPost
                ? () => {
                    onSharePost(post);
                  }
                : undefined
            }
          />
        </View>
      </View>

      {readMeaningfulText(post.mood) ? (
        <Text
          className="mt-2 text-[12px] font-semibold text-[#C24F3B]"
          style={{ includeFontPadding: false, lineHeight: lineHeightFor(12) }}
        >
          {readMeaningfulText(post.mood)}
        </Text>
      ) : null}
    </View>
  );
}

function RoutesTabContent({
  completedRoutes,
  favoriteRoutes,
  onOpenRoute,
}: {
  completedRoutes: RouteItem[];
  favoriteRoutes: RouteItem[];
  onOpenRoute: (routeId: string) => void;
}) {
  if (!completedRoutes.length && !favoriteRoutes.length) {
    return (
      <EmptyState
        icon={{ ios: "map", android: "map", web: "map" }}
        message="Explorer này chưa chia sẻ route công khai nào."
      />
    );
  }

  return (
    <View className="gap-3">
      <RouteSection
        title="Route đã hoàn thành"
        actionLabel={`${completedRoutes.length} route`}
        emptyMessage="Chưa có route hoàn thành được chia sẻ công khai."
        routes={completedRoutes}
        statusIcon={{
          ios: "checkmark.circle.fill",
          android: "task_alt",
          web: "task_alt",
        }}
        statusLabel="Hoàn thành"
        onOpenRoute={onOpenRoute}
      />
      <RouteSection
        title="Route yêu thích"
        actionLabel={`${favoriteRoutes.length} route`}
        emptyMessage="Chưa có route yêu thích được đánh dấu công khai."
        routes={favoriteRoutes}
        statusIcon={{
          ios: "star.fill",
          android: "star",
          web: "star",
        }}
        statusLabel="Yêu thích"
        onOpenRoute={onOpenRoute}
      />
    </View>
  );
}

function ApiRoutesTabContent({
  errorMessage,
  onOpenRoute,
  routes,
}: {
  errorMessage?: string | null;
  onOpenRoute: (routeId: string) => void;
  routes: ApiRouteReference[];
}) {
  if (errorMessage) {
    return (
      <EmptyState
        icon={{
          ios: "exclamationmark.triangle",
          android: "error_outline",
          web: "error_outline",
        }}
        message={errorMessage}
      />
    );
  }

  if (!routes.length) {
    return (
      <EmptyState
        icon={{ ios: "map", android: "map", web: "map" }}
        message="Explorer này chưa gắn route nào trong các bài viết."
      />
    );
  }

  return (
    <View className="gap-2">
      {routes.map((route) => (
        <Pressable
          key={`route-reference-${route.routeId}`}
          onPress={() => onOpenRoute(`${route.routeId}`)}
          className="rounded-[22px] bg-white px-4 py-4"
          style={cardShadow}
        >
          <View className="flex-row items-start justify-between gap-3">
            <View className="min-w-0 flex-1">
              <Text className="text-[15px] font-extrabold text-[#202124]">
                {`Route #${route.routeId}`}
              </Text>
              <Text className="mt-1 text-[12px] leading-[18px] text-[#6B7280]">
                {`${route.postCount} bài viết có gắn route này`}
              </Text>
            </View>

            <View className="rounded-full bg-[#FFF4EF] px-3 py-1.5">
              <Text className="text-[11px] font-extrabold text-[#F58752]">
                {route.sharedPostCount > 0
                  ? `${route.sharedPostCount} chia sẻ`
                  : "Chi tiết"}
              </Text>
            </View>
          </View>
        </Pressable>
      ))}
    </View>
  );
}

function RouteSection({
  actionLabel,
  emptyMessage,
  onOpenRoute,
  routes,
  statusIcon,
  statusLabel,
  title,
}: {
  actionLabel: string;
  emptyMessage: string;
  onOpenRoute: (routeId: string) => void;
  routes: RouteItem[];
  statusIcon: SymbolName;
  statusLabel: string;
  title: string;
}) {
  return (
    <View>
      <View className="mb-2.5 flex-row items-center justify-between">
        <Text className="text-[15px] font-extrabold text-[#2B2233]">
          {title}
        </Text>
        <Text className="text-[12px] font-semibold text-[#8E869A]">
          {actionLabel}
        </Text>
      </View>

      {routes.length ? (
        <View className="gap-2">
          {routes.map((route) => (
            <ExplorerRouteCard
              key={`${title}-${route.id}`}
              onPress={() => onOpenRoute(route.id)}
              route={route}
              statusIcon={statusIcon}
              statusLabel={statusLabel}
            />
          ))}
        </View>
      ) : (
        <EmptyState icon={statusIcon} message={emptyMessage} />
      )}
    </View>
  );
}

function ExplorerRouteCard({
  onPress,
  route,
  statusIcon,
  statusLabel,
}: {
  onPress: () => void;
  route: RouteItem;
  statusIcon: SymbolName;
  statusLabel: string;
}) {
  return (
    <Pressable
      onPress={onPress}
      className="flex-row gap-3 rounded-2xl bg-white p-2.5"
      style={cardShadow}
    >
      <Image
        source={route.cover}
        contentFit="cover"
        transition={180}
        cachePolicy="memory-disk"
        style={{ width: 74, height: 74, borderRadius: 14 }}
      />

      <View className="min-w-0 flex-1 justify-center">
        <View className="flex-row items-start justify-between gap-2">
          <Text
            className="flex-1 text-[14px] font-semibold text-[#2B2233]"
            numberOfLines={1}
          >
            {route.title}
          </Text>
          <View className="flex-row items-center gap-1 rounded-full bg-[#FFF4EF] px-2 py-1">
            <SymbolView name={statusIcon} size={11} tintColor="#F58752" />
            <Text className="text-[10px] font-extrabold text-[#F58752]">
              {statusLabel}
            </Text>
          </View>
        </View>

        <Text className="mt-0.5 text-[11px] text-[#8E869A]" numberOfLines={2}>
          {route.subtitle}
        </Text>

        <View className="mt-1.5 flex-row flex-wrap items-center gap-3">
          <RouteMeta
            icon={{
              ios: "figure.walk",
              android: "directions_walk",
              web: "directions_walk",
            }}
            value={route.distance}
          />
          <RouteMeta
            icon={{
              ios: "clock",
              android: "schedule",
              web: "schedule",
            }}
            value={route.duration}
          />
          <RouteMeta
            icon={{
              ios: "sparkles",
              android: "auto_awesome",
              web: "auto_awesome",
            }}
            value={`+${route.xp} XP`}
          />
        </View>
      </View>
    </Pressable>
  );
}

function RouteMeta({ icon, value }: { icon: SymbolName; value: string }) {
  return (
    <View className="flex-row items-center gap-1.5">
      <SymbolView name={icon} size={12} tintColor="#EB489B" />
      <Text className="text-[12px] font-semibold text-[#5E5168]">{value}</Text>
    </View>
  );
}

function EmptyState({ icon, message }: { icon: SymbolName; message: string }) {
  return (
    <View
      className="items-center rounded-2xl bg-white py-12"
      style={cardShadow}
    >
      <SymbolView name={icon} size={30} tintColor="#AA9FB0" />
      <Text className="mt-2 px-6 text-center text-[13px] text-[#8E869A]">
        {message}
      </Text>
    </View>
  );
}

function formatCompactValue(value: number): string {
  if (value >= 1000) {
    return `${Math.round(value / 100) / 10}K`;
  }

  return value.toString();
}

function getProfileInitials(name: string, username: string) {
  const source = name.trim() || username.replace(/^@+/, "").trim();

  if (!source) {
    return "CQ";
  }

  const parts = source.split(/\s+/).filter(Boolean);

  if (parts.length === 1) {
    return parts[0].slice(0, 2).toUpperCase();
  }

  const firstInitial = parts[0][0] ?? "";
  const lastInitial = parts[parts.length - 1][0] ?? "";
  return `${firstInitial}${lastInitial}`.toUpperCase();
}
