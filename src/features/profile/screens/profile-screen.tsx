import { AppLoadingScreen } from "@/components/ui/app-loading-screen";
import { SymbolView } from "@/components/ui/symbol-view";
import { UserAvatar } from "@/components/ui/user-avatar";
import { lineHeightFor } from "@/lib/text-scale";
import { Image } from "expo-image";
import { LinearGradient } from "expo-linear-gradient";
import { type Href, useFocusEffect, useRouter } from "expo-router";
import {
  type ComponentProps,
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import {
  ActivityIndicator,
  Alert,
  Modal,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
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
  cacheCommunityPost,
  type CommunityFeedMediaItem,
  type CommunityFeedPost,
  updateCachedCommunityPost,
} from "@/features/community/data/community-post-cache";
import { getHotspotById } from "@/features/home/api/get-hotspot-by-id";
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
import { getRouteById } from "@/features/route/api/route-api";
import { useScreenLayout } from "@/hooks/use-screen-layout";
import {
  getPostVisibilityIcon,
  getPostVisibilityLabel,
  normalizePostVisibilityValue,
} from "@/lib/post-visibility";
import type { SharedPostSummary } from "@/lib/shared-post";
import { LevelProgressCard } from "../components/level-progress-card";
import {
  cacheProfilePost,
  updateCachedProfilePost,
} from "../data/profile-post-cache";
import { useProfile } from "../hooks/use-profile";
import {
  type ProfileRouteParticipant,
  useRouteParticipants,
} from "../hooks/use-route-participants";
import type { ProfilePost, ProfilePostStatus } from "../types";

type Tab = "posts" | "pending-posts" | "routes";
type SymbolName = ComponentProps<typeof SymbolView>["name"];
type ResolvedProfileHotspotPreview = {
  hotspotId: number;
  hotspotName: string;
  imageUri: string | null;
};
type ResolvedProfileRoutePreview = {
  routeId: number;
  routeName: string;
};

const cardShadow = {
  shadowColor: "rgba(28, 45, 80, 0.10)",
  shadowOpacity: 1,
  shadowRadius: 20,
  shadowOffset: { width: 0, height: 10 },
  elevation: 10,
} as const;

const heroGradientColors = ["#20476B", "#4F87B2", "#F7F8FC"] as const;
const guestHeroBannerImage = require("../../../../assets/images/tachnen5.png");
const levelBadgeLogo = require("../../../../assets/images/logo3.png");
const guestScreenGradientColors = ["#FFF1F8", "#FFE8F3", "#FFF9FC"] as const;
const guestHeroGradientColors = ["#F8B5CF", "#F49ABD", "#EB78A4"] as const;
const guestHeroShadow = {
  shadowColor: "rgba(185, 77, 132, 0.22)",
  shadowOpacity: 1,
  shadowRadius: 32,
  shadowOffset: { width: 0, height: 22 },
  elevation: 14,
} as const;
const guestPhoneShadow = {
  shadowColor: "rgba(149, 63, 111, 0.16)",
  shadowOpacity: 1,
  shadowRadius: 20,
  shadowOffset: { width: 0, height: 16 },
  elevation: 8,
} as const;
const guestBackButtonShadow = {
  shadowColor: "rgba(235, 72, 155, 0.12)",
  shadowOpacity: 1,
  shadowRadius: 14,
  shadowOffset: { width: 0, height: 8 },
  elevation: 6,
} as const;
const profilePostAvatarPalettes = [
  ["#EB489B", "#F58752"],
  ["#F58752", "#FFC93C"],
  ["#4F46E5", "#38BDF8"],
  ["#10B981", "#2DD4BF"],
  ["#9333EA", "#EC4899"],
] as const;
const TAB_ITEMS: { key: Tab; label: string; icon: SymbolName }[] = [
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
    key: "pending-posts",
    label: "Riêng tư & chờ duyệt",
    icon: {
      ios: "lock",
      android: "lock",
      web: "lock",
    },
  },
  {
    key: "routes",
    label: "Tuyến đường",
    icon: { ios: "map", android: "route", web: "route" },
  },
];
const routeParticipantFallbackCover =
  "https://i.pinimg.com/1200x/80/69/f9/8069f9581583a196f9f39bda000b9312.jpg";
const fallbackPostAuthorName = "Minh Anh";
/** Khớp `detailTextMaxFontSizeMultiplier` của community-screen để tên tác giả
 * phóng chữ cùng nhịp với bảng tin cộng đồng. */
const postAuthorMaxFontSizeMultiplier = 1.05;
const postMenuSections: {
  items: {
    description?: string;
    icon: SymbolName;
    isDestructive?: boolean;
    label: string;
  }[];
  key: string;
}[] = [
  {
    key: "primary",
    items: [
      {
        label: "Chỉnh sửa bài viết",
        icon: { ios: "pencil", android: "edit", web: "edit" },
      },
      {
        label: "Chỉnh sửa quyền riêng tư",
        icon: { ios: "lock", android: "lock", web: "lock" },
      },
      {
        label: "Chuyển vào thùng rác",
        description: "Các mục trong thùng rác sẽ bị xóa sau 30 ngày.",
        icon: {
          ios: "trash",
          android: "delete_outline",
          web: "delete_outline",
        },
        isDestructive: true,
      },
      {
        label: "Nhận thông báo về bài viết này",
        icon: {
          ios: "bell",
          android: "notifications_none",
          web: "notifications_none",
        },
      },
    ],
  },
];

const GUEST_MENU_ITEMS: {
  label: string;
  icon: SymbolName;
  value?: string;
}[] = [
  {
    label: "Hợp đồng và Chính sách",
    icon: { ios: "doc.text", android: "description", web: "description" },
  },
  {
    label: "Điều khoản và Điều kiện",
    icon: { ios: "checkmark.seal", android: "verified", web: "verified" },
  },
  {
    label: "Chính sách bảo vệ thông tin cá nhân",
    icon: { ios: "lock.shield", android: "shield", web: "shield" },
  },
  {
    label: "Trung tâm hỗ trợ",
    icon: { ios: "questionmark.circle", android: "help", web: "help" },
  },
  {
    label: "Hotline hỗ trợ",
    icon: { ios: "phone", android: "call", web: "call" },
  },
  {
    label: "Góp ý",
    icon: {
      ios: "bubble.left.and.bubble.right",
      android: "feedback",
      web: "feedback",
    },
  },
  {
    label: "Về ứng dụng",
    icon: { ios: "info.circle", android: "info", web: "info" },
  },
];

function getProfileInitials(name: string, username: string) {
  const source = name.trim() || username.replace(/^@+/, "").trim();

  if (!source) {
    return "ME";
  }

  const parts = source.split(/\s+/).filter(Boolean);

  if (parts.length === 1) {
    return parts[0].slice(0, 2).toUpperCase();
  }

  const firstInitial = parts[0][0] ?? "";
  const lastInitial = parts[parts.length - 1][0] ?? "";
  return `${firstInitial}${lastInitial}`.toUpperCase();
}

// Backend trả timestamp dạng "yyyy-MM-ddTHH:mm:ss" không kèm timezone (giờ
// UTC của server). new Date(value) trực tiếp sẽ bị JS hiểu nhầm là giờ local
// của máy, làm lệch ngày hiển thị — nên phải ép về UTC bằng cách thêm "Z"
// trước khi parse, giống cách các màn hình khác trong app đã xử lý.
function parseApiTimestamp(value: string) {
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

function formatPostTimestamp(value: string | null) {
  const parsedDate = value ? parseApiTimestamp(value) : null;

  if (!parsedDate) {
    return "Vừa xong";
  }

  const createdAtTime = parsedDate.getTime();
  const currentTime = Date.now();
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

  const formatElapsedValue = (elapsedValue: number, unit: string) =>
    `${elapsedValue} ${unit}`;
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

function formatRouteParticipantDate(value: string | null) {
  const parsedDate = value ? parseApiTimestamp(value) : null;

  if (!parsedDate) {
    return "";
  }

  return new Intl.DateTimeFormat("vi-VN", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
  }).format(parsedDate);
}

function normalizeRouteParticipantStatus(value?: string | null) {
  return (value ?? "").trim().toUpperCase();
}

function getRouteParticipantStatusLabel(value?: string | null) {
  switch (normalizeRouteParticipantStatus(value)) {
    case "COMPLETED":
      return "Hoàn thành";
    case "IN_PROGRESS":
      return "Đang đi";
    default:
      return "Đang đi";
  }
}

function getRouteParticipantStatusTone(value?: string | null) {
  switch (normalizeRouteParticipantStatus(value)) {
    case "COMPLETED":
      return {
        backgroundColor: "#E8F7EE",
        borderColor: "#B7E4C7",
        textColor: "#137333",
      };
    case "IN_PROGRESS":
      return {
        backgroundColor: "#FFF4E5",
        borderColor: "#F8D3A8",
        textColor: "#B45309",
      };
    default:
      return {
        backgroundColor: "#F3F4F6",
        borderColor: "#E5E7EB",
        textColor: "#6B7280",
      };
  }
}

function formatRouteParticipantRating(value?: number | null) {
  if (typeof value !== "number" || !Number.isFinite(value)) {
    return null;
  }

  return value.toFixed(value >= 5 ? 1 : 1);
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

function replaceProfilePostLikeState(
  post: ProfilePost,
  options: {
    isLiked: boolean;
    likeCount: number;
  },
): ProfilePost {
  const normalizedLikeCount = Math.max(0, Math.round(options.likeCount));

  return {
    ...post,
    isLiked: options.isLiked,
    likeCount: normalizedLikeCount,
  };
}

function getProfileAvatarPalette(seed: string) {
  const paletteIndex =
    Array.from(seed).reduce((total, char) => total + char.charCodeAt(0), 0) %
    profilePostAvatarPalettes.length;

  return profilePostAvatarPalettes[paletteIndex] as readonly [string, string];
}

function normalizeProfilePostStatus(
  value?: string | null,
): ProfilePostStatus | null {
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

function getProfilePostStatusLabel(value?: string | null) {
  switch (normalizeProfilePostStatus(value)) {
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

function getProfilePostStatusTone(value?: string | null) {
  switch (normalizeProfilePostStatus(value)) {
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

function buildProfileCommunityMediaItems(
  post: ProfilePost,
): CommunityFeedMediaItem[] {
  return post.medias
    .filter((media) => {
      const trimmedUrl = media.url.trim();
      const normalizedType = media.type.trim().toUpperCase();
      const normalizedMime = media.mimeType.trim().toLowerCase();

      return (
        trimmedUrl.length > 0 &&
        (normalizedType === "IMAGE" || normalizedMime.startsWith("image/"))
      );
    })
    .map((media) => ({
      key: `${post.id}-media-${media.id}`,
      source: {
        uri: media.url.trim(),
      },
    }));
}

function buildProfilePostMediaItems(
  post: ProfilePost,
): CommunityFeedMediaItem[] {
  const mediaItems = buildProfileCommunityMediaItems(post);

  if (mediaItems.length > 0) {
    return mediaItems;
  }

  if (post.image?.trim()) {
    return [
      {
        key: `${post.id}-legacy-image`,
        source: {
          uri: post.image.trim(),
        },
      },
    ];
  }

  return [];
}

function formatProfileTagLabel(tag: string) {
  const normalizedTag = tag.trim().replace(/^#/, "").replace(/\s+/g, "_");

  return normalizedTag ? `#${normalizedTag}` : null;
}

function stripTrailingProfileHashtagBlock(content: string) {
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

function buildProfileRouteLabel(
  routeIds: number[],
  resolvedRoutes: Record<number, ResolvedProfileRoutePreview>,
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
    return primaryRouteName ?? "1 tuyến đường được gắn";
  }

  return `${primaryRouteName ?? `${validRouteIds.length} tuyến đường được gắn`} +${validRouteIds.length - 1}`;
}

function buildProfileHotspotSubtitle(
  hotspotIds: number[],
  resolvedHotspots: Record<number, ResolvedProfileHotspotPreview>,
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
    return hotspotNames[0] ?? "1 địa điểm được gắn";
  }

  if (hotspotNames.length >= 2) {
    return hotspotNames.length === 2
      ? `${hotspotNames[0]}, ${hotspotNames[1]}`
      : `${hotspotNames[0]}, ${hotspotNames[1]} và ${validHotspotIds.length - 2} địa điểm khác`;
  }

  return `${validHotspotIds.length} địa điểm được gắn`;
}

function buildProfileHotspotImageUris(
  hotspotIds: number[],
  resolvedHotspots: Record<number, ResolvedProfileHotspotPreview>,
) {
  return hotspotIds
    .map((hotspotId) => resolvedHotspots[hotspotId]?.imageUri ?? null)
    .filter((imageUri): imageUri is string => Boolean(imageUri));
}

function mapProfilePostToCommunityFeedPost(
  post: ProfilePost,
  {
    profileName,
    profileUsername,
  }: {
    profileName: string;
    profileUsername: string;
  },
): CommunityFeedPost {
  const author =
    post.displayName.trim() || profileName.trim() || fallbackPostAuthorName;
  const normalizedUsername = post.username.trim() || profileUsername.trim();
  const mediaItems = buildProfileCommunityMediaItems(post);
  const parsedPostId = Number.parseInt(post.id, 10);
  const visibilityLabel = getPostVisibilityLabel(post.visibility);
  const statusLabel = getProfilePostStatusLabel(post.status);

  return {
    id: `profile-post-${post.id}`,
    authorId: post.userId,
    author,
    avatarColors: getProfileAvatarPalette(`${author}-${post.userId}`),
    badge: "Hồ sơ",
    caption:
      stripTrailingProfileHashtagBlock(post.text) ||
      "Bài viết mới từ hồ sơ cá nhân.",
    comments: formatCompactCount(post.commentCount),
    hotScore: "0",
    image: mediaItems[0]?.source ?? null,
    initials: getProfileInitials(author, normalizedUsername),
    likes: formatCompactCount(post.likeCount),
    location: "",
    mood: `${statusLabel} · ${visibilityLabel}`,
    topic: "culture",
    role: normalizedUsername
      ? `@${normalizedUsername.replace(/^@/, "")}`
      : "Explorer profile",
    shares: formatCompactCount(post.shareCount),
    isFollowing: false,
    tags: post.tags
      .map((tag) => tag.name.trim())
      .filter(Boolean)
      .slice(0, 4),
    time: formatPostTimestamp(post.createdAt),
    views: formatCompactCount(post.pointRemaining),
    canComment: true,
    canLike: true,
    canOpenProfile: false,
    commentCountValue: post.commentCount,
    createdAt: post.createdAt,
    hotspotIds: post.hotspotIds,
    isLiked: post.isLiked === true,
    likeCountValue: post.likeCount,
    mediaItems,
    postNumericId: Number.isInteger(parsedPostId) ? parsedPostId : null,
    replies: formatCompactCount(post.replyCount),
    replyCountValue: post.replyCount ?? 0,
    routeIds: post.routeIds,
    shareCountValue: post.shareCount,
    status: post.status,
    visibility: post.visibility,
  };
}

export default function ProfileScreen() {
  const router = useRouter();
  const authSession = useAuthSession();
  const likedPostsAccountKey = authSession.isAuthenticated
    ? authSession.username?.trim() || authSession.displayName.trim() || null
    : null;
  const hasFocusedProfileRef = useRef(false);
  const { profile, posts, isLoading, error, reloadProfile } = useProfile();
  const {
    error: routeParticipantsError,
    isLoading: isLoadingRouteParticipants,
    participants: routeParticipants,
  } = useRouteParticipants();
  const [tab, setTab] = useState<Tab>("posts");
  const [likingPostIds, setLikingPostIds] = useState<number[]>([]);
  const [resolvedPostHotspots, setResolvedPostHotspots] = useState<
    Record<number, ResolvedProfileHotspotPreview>
  >({});
  const [resolvedPostRoutes, setResolvedPostRoutes] = useState<
    Record<number, ResolvedProfileRoutePreview>
  >({});
  const persistedLikedPostIds = useLikedPostIds(likedPostsAccountKey);
  const insets = useSafeAreaInsets();
  const { gutter, safeWidth } = useScreenLayout({ maxContentWidth: 640 });
  const heroHeight = Math.max(Math.min(safeWidth * 0.88, 320), 280);
  const avatarSize = 112;
  const profileOverlap = avatarSize * 0.52;
  const approvedPosts = posts.filter(
    (post) =>
      normalizeProfilePostStatus(post.status) === "APPROVED" &&
      normalizePostVisibilityValue(post.visibility) !== "PRIVATE",
  );
  // Tab ổ khóa gom bài chờ duyệt và mọi bài riêng tư (kể cả bài chia sẻ lại).
  const lockedPosts = posts.filter(
    (post) =>
      normalizeProfilePostStatus(post.status) === "PENDING" ||
      (normalizeProfilePostStatus(post.status) === "APPROVED" &&
        normalizePostVisibilityValue(post.visibility) === "PRIVATE"),
  );
  const visiblePosts = tab === "pending-posts" ? lockedPosts : approvedPosts;
  const visibleHotspotIdsToResolve = useMemo(() => {
    const hotspotIds = new Set<number>();

    for (const post of visiblePosts) {
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
  }, [visiblePosts, resolvedPostHotspots]);
  const visibleRouteIdsToResolve = useMemo(() => {
    const routeIds = new Set<number>();

    for (const post of visiblePosts) {
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
  }, [visiblePosts, resolvedPostRoutes]);
  const persistedLikedPostIdsSet = useMemo(
    () => new Set(persistedLikedPostIds),
    [persistedLikedPostIds],
  );
  const handleOpenAuth = () => {
    router.push("/login?entry=home" as Href);
  };
  const handleBackToHome = () => {
    router.replace("/home");
  };
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
  const handleLikePost = useCallback(
    async (post: ProfilePost) => {
      const postNumericId = Number.parseInt(post.id, 10);
      const normalizedStatus = normalizeProfilePostStatus(post.status);
      const normalizedVisibility = post.visibility.trim().toUpperCase();

      if (
        !Number.isInteger(postNumericId) ||
        postNumericId <= 0 ||
        normalizedStatus !== "APPROVED" ||
        normalizedVisibility !== "PUBLIC"
      ) {
        return;
      }

      if (likingPostIds.includes(postNumericId)) {
        return;
      }

      if (!authSession.isAuthenticated) {
        Alert.alert(
          "Cần đăng nhập",
          "Bạn cần đăng nhập để thả tim bài viết trong hồ sơ.",
        );
        return;
      }

      const accessToken = await getValidAccessToken();

      if (!accessToken) {
        Alert.alert(
          "Phiên đăng nhập hết hạn",
          "Vui lòng đăng nhập lại trước khi thả tim bài viết trong hồ sơ.",
        );
        return;
      }

      const currentIsLiked =
        post.isLiked === true || persistedLikedPostIdsSet.has(postNumericId);
      const currentLikeCount = Math.max(0, Math.round(post.likeCount ?? 0));
      const optimisticIsLiked = !currentIsLiked;
      const optimisticLikeCount = optimisticIsLiked
        ? currentLikeCount + 1
        : Math.max(0, currentLikeCount - 1);

      setLikingPostIds((current) =>
        current.includes(postNumericId) ? current : [...current, postNumericId],
      );

      const optimisticPost = replaceProfilePostLikeState(post, {
        isLiked: optimisticIsLiked,
        likeCount: optimisticLikeCount,
      });
      if (!updateCachedProfilePost(postNumericId, () => optimisticPost)) {
        cacheProfilePost(optimisticPost);
      }
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
        const resolvedPost = replaceProfilePostLikeState(post, {
          isLiked: resolvedIsLiked,
          likeCount: resolvedLikeCount,
        });

        if (!updateCachedProfilePost(postNumericId, () => resolvedPost)) {
          cacheProfilePost(resolvedPost);
        }
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
      } catch (nextError) {
        const revertedPost = replaceProfilePostLikeState(post, {
          isLiked: currentIsLiked,
          likeCount: currentLikeCount,
        });

        if (!updateCachedProfilePost(postNumericId, () => revertedPost)) {
          cacheProfilePost(revertedPost);
        }
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
          "Không thể thả tim",
          nextError instanceof Error
            ? nextError.message
            : "Đã có lỗi xảy ra khi thả tim bài viết trong hồ sơ.",
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
      likedPostsAccountKey,
      likingPostIds,
      persistedLikedPostIdsSet,
    ],
  );

  useFocusEffect(
    useCallback(() => {
      if (!authSession.isAuthenticated) {
        return;
      }

      if (!hasFocusedProfileRef.current) {
        hasFocusedProfileRef.current = true;
        return;
      }

      void reloadProfile();
    }, [authSession.isAuthenticated, reloadProfile]),
  );

  useEffect(() => {
    if (
      !authSession.isAuthenticated ||
      visibleHotspotIdsToResolve.length === 0
    ) {
      return;
    }

    let isActive = true;

    async function loadHotspotPreviews() {
      try {
        const accessToken = await getValidAccessToken();
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
      } catch (nextError) {
        console.warn("[profile] load hotspot previews failed", {
          error: nextError instanceof Error ? nextError.message : nextError,
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
    if (!authSession.isAuthenticated || visibleRouteIdsToResolve.length === 0) {
      return;
    }

    let isActive = true;

    async function loadRoutePreviews() {
      try {
        const accessToken = await getValidAccessToken();
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
      } catch (nextError) {
        console.warn("[profile] load route previews failed", {
          error: nextError instanceof Error ? nextError.message : nextError,
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

  if (!authSession.isAuthenticated) {
    return (
      <GuestProfileScreen
        bottomInset={insets.bottom}
        onBackHome={handleBackToHome}
        onOpenAuth={handleOpenAuth}
        pageGutter={gutter}
        screenWidth={safeWidth}
      />
    );
  }

  if (isLoading && !profile) {
    return <AppLoadingScreen />;
  }

  if (error && !profile) {
    return (
      <SafeAreaView className="flex-1 items-center justify-center bg-[#F7F8FC] px-6">
        <Text className="text-center text-[17px] font-extrabold text-[#2B2233]">
          Không thể tải hồ sơ
        </Text>
        <Text className="mt-2 text-center text-[14px] leading-5 text-[#8E869A]">
          {error.message}
        </Text>
      </SafeAreaView>
    );
  }

  if (!profile) {
    return <AppLoadingScreen />;
  }

  const levelNumber = typeof profile.level === "number" ? profile.level : null;
  const levelDisplayName = profile.levelName?.trim() ?? "";
  const resolvedDisplayName =
    profile.name.trim() || authSession.displayName.trim() || "Explorer";
  const resolvedProfileUsername =
    profile.username.trim() ||
    authSession.username?.trim() ||
    resolvedDisplayName;
  const currentTotalXp = Math.max(profile.totalXp, 0);
  const nextLevelRequiredXp =
    typeof profile.nextLevelRequiredXp === "number"
      ? profile.nextLevelRequiredXp
      : null;
  const levelProgressPercent =
    typeof profile.levelProgressPercent === "number"
      ? profile.levelProgressPercent
      : null;
  const canShowLevelCard =
    currentTotalXp > 0 || levelNumber !== null || levelDisplayName.length > 0;
  const hasExactLevelProgress =
    profile.hasExactLevelProgress === true &&
    nextLevelRequiredXp !== null &&
    levelProgressPercent !== null;
  const postCount =
    typeof profile.totalPosts === "number" ? profile.totalPosts : posts.length;
  const statItems = [
    { label: "Đang theo dõi", value: profile.following },
    { label: "Người theo dõi", value: profile.followers },
    { label: "Bài viết", value: postCount },
  ];
  const badgeLabel =
    levelNumber !== null
      ? levelNumber.toString()
      : profile.isPremium
        ? "PRO"
        : null;
  const postSectionTitle =
    tab === "pending-posts"
      ? "Bài viết riêng tư & chờ duyệt"
      : "Bài viết của bạn";

  return (
    <SafeAreaView className="flex-1 bg-[#F7F8FC]" edges={["left", "right"]}>
      <ScrollView
        className="flex-1"
        contentContainerStyle={{ paddingBottom: 32 }}
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
              "rgba(0,0,0,0.08)",
              "rgba(0,0,0,0.04)",
              "rgba(247,248,252,0.98)",
            ]}
            locations={[0, 0.72, 1]}
            style={{ position: "absolute", inset: 0 }}
          />
          <View
            className="absolute flex-row items-center justify-between"
            style={{ left: gutter, paddingTop: insets.top + 10, right: gutter }}
          >
            <View className="w-10" />

            <View className="flex-row items-center gap-2">
              <View className="flex-row items-center gap-1 rounded-full bg-black/30 px-3 py-2">
                <SymbolView
                  name={{
                    ios: "dollarsign.circle.fill",
                    android: "monetization_on",
                    web: "monetization_on",
                  }}
                  size={15}
                  tintColor="#FFD54A"
                />
                <Text className="text-[13px] font-extrabold text-white">
                  {profile.points.toLocaleString()}
                </Text>
              </View>
              <Pressable
                accessibilityLabel="Mở thông báo"
                className="h-10 w-10 items-center justify-center rounded-full bg-black/30"
                onPress={() => router.push("/notifications" as Href)}
              >
                <SymbolView
                  name={{
                    ios: "bell",
                    android: "notifications",
                    web: "notifications",
                  }}
                  size={16}
                  tintColor="#FFFFFF"
                />
              </Pressable>
              <Pressable
                accessibilityLabel="Mở menu hồ sơ"
                className="h-10 w-10 items-center justify-center rounded-full bg-black/30"
                onPress={() => router.push("/profile/menu" as Href)}
              >
                <SymbolView
                  name={{
                    ios: "line.3.horizontal",
                    android: "menu",
                    web: "menu",
                  }}
                  size={15}
                  tintColor="#FFFFFF"
                />
              </Pressable>
            </View>
          </View>
        </View>

        <View style={{ marginTop: -profileOverlap, paddingHorizontal: gutter }}>
          <View className="flex-row items-start gap-4">
            <AccountAvatar
              avatar={profile.avatar}
              badgeLabel={badgeLabel}
              name={resolvedDisplayName}
              size={avatarSize}
            />

            <View className="min-w-0 flex-1 pt-6">
              <View className="mt-0 flex-row items-center">
                <Text
                  className="text-[18px] font-semibold leading-tight text-[#2B2233]"
                  numberOfLines={1}
                >
                  {resolvedDisplayName}
                </Text>
              </View>
              {canShowLevelCard ? (
                <LevelProgressCard
                  currentXp={currentTotalXp}
                  hasExactProgress={hasExactLevelProgress}
                  markerSource={levelBadgeLogo}
                  nextLevelRequiredXp={nextLevelRequiredXp}
                  progressPercent={levelProgressPercent}
                />
              ) : null}
            </View>
          </View>

          <View className="mt-4 flex-row gap-2">
            {statItems.map((item) => (
              <ProfileStat key={item.label} n={item.value} label={item.label} />
            ))}
          </View>

          {error ? <InlineNotice message={error.message} /> : null}

          <View className="mt-5 flex-row border-y border-[#E9EAF0] bg-white">
            {TAB_ITEMS.map((item) => {
              const selected = tab === item.key;
              return (
                <Pressable
                  key={item.key}
                  onPress={() => setTab(item.key)}
                  accessibilityLabel={item.label}
                  className="flex-1 items-center justify-center py-3"
                  style={{
                    borderBottomColor: selected ? "#EB489B" : "transparent",
                    borderBottomWidth: 2,
                  }}
                >
                  <SymbolView
                    name={item.icon}
                    size={16}
                    tintColor={selected ? "#F58752" : "#AA9FB0"}
                  />
                </Pressable>
              );
            })}
          </View>

          <View className="mt-4">
            {tab === "posts" || tab === "pending-posts" ? (
              visiblePosts.length === 0 ? (
                <View>
                  <ProfilePostsSectionHeader title={postSectionTitle} />
                  <EmptyPosts tab={tab} />
                </View>
              ) : (
                <View>
                  <ProfilePostsSectionHeader title={postSectionTitle} />
                  {visiblePosts.map((post, index) => {
                    const postNumericId = Number.parseInt(post.id, 10);
                    const isLiked =
                      normalizeProfilePostStatus(post.status) === "APPROVED" &&
                      post.visibility.trim().toUpperCase() === "PUBLIC" &&
                      (post.isLiked === true ||
                        (Number.isInteger(postNumericId) &&
                          persistedLikedPostIdsSet.has(postNumericId)));
                    const isLiking =
                      Number.isInteger(postNumericId) &&
                      likingPostIds.includes(postNumericId);

                    return (
                      <PostCard
                        key={post.id}
                        isLast={index === visiblePosts.length - 1}
                        isLiked={isLiked}
                        isLiking={isLiking}
                        onLikePost={handleLikePost}
                        onOpenHotspot={handleOpenPostHotspot}
                        onOpenRoute={handleOpenPostRoute}
                        pageGutter={gutter}
                        post={post}
                        profileAvatar={profile.avatar}
                        profileName={resolvedDisplayName}
                        profileUsername={resolvedProfileUsername}
                        resolvedHotspots={resolvedPostHotspots}
                        resolvedRoutes={resolvedPostRoutes}
                      />
                    );
                  })}
                </View>
              )
            ) : (
              <View>
                <ProfilePostsSectionHeader title="Tuyến đường của bạn" />

                {routeParticipantsError ? (
                  <InlineNotice message={routeParticipantsError.message} />
                ) : null}

                {isLoadingRouteParticipants &&
                routeParticipants.length === 0 ? (
                  <View className="items-center py-12">
                    <ActivityIndicator color="#EB489B" />
                  </View>
                ) : routeParticipants.length === 0 ? (
                  <EmptyRoutes />
                ) : (
                  <View>
                    {routeParticipants.map((participant, index) => (
                      <RouteParticipantCard
                        isLast={index === routeParticipants.length - 1}
                        key={participant.userRouteProgressId}
                        onPress={() =>
                          router.push(`/route/${participant.routeId}` as Href)
                        }
                        pageGutter={gutter}
                        participant={participant}
                      />
                    ))}
                  </View>
                )}
              </View>
            )}
          </View>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

function GuestProfileScreen({
  bottomInset,
  onBackHome,
  onOpenAuth,
  pageGutter,
  screenWidth,
}: {
  bottomInset: number;
  onBackHome: () => void;
  onOpenAuth: () => void;
  pageGutter: number;
  screenWidth: number;
}) {
  const cardInnerWidth = Math.max(screenWidth - pageGutter * 4, 220);
  const heroArtWidth = Math.min(Math.max(cardInnerWidth * 0.38, 116), 142);

  return (
    <SafeAreaView
      className="flex-1 bg-[#FFF1F8]"
      edges={["top", "left", "right"]}
    >
      <View className="absolute inset-0">
        <LinearGradient
          colors={guestScreenGradientColors}
          start={{ x: 0.08, y: 0 }}
          end={{ x: 1, y: 1 }}
          style={{
            position: "absolute",
            top: 0,
            left: 0,
            right: 0,
            height: 260,
          }}
        />
        <View
          style={{
            position: "absolute",
            left: -40,
            top: 40,
            width: 176,
            height: 176,
            borderRadius: 999,
            backgroundColor: "rgba(235, 120, 164, 0.12)",
          }}
        />
        <View
          style={{
            position: "absolute",
            right: -32,
            top: 112,
            width: 144,
            height: 144,
            borderRadius: 999,
            backgroundColor: "rgba(244, 154, 189, 0.10)",
          }}
        />
      </View>

      <ScrollView
        className="flex-1"
        contentContainerStyle={{
          paddingBottom: Math.max(bottomInset, 20) + 24,
        }}
        showsVerticalScrollIndicator={false}
      >
        <View
          className="flex-row items-center justify-between pt-3"
          style={{ paddingHorizontal: pageGutter }}
        >
          <Pressable
            accessibilityLabel="Về trang chủ"
            className="h-10 w-10 items-center justify-center rounded-[16px] border border-[#F6DFE8] bg-white"
            onPress={onBackHome}
            style={guestBackButtonShadow}
          >
            <SymbolView
              name={{
                ios: "chevron.left",
                android: "arrow_back",
                web: "arrow_back",
              }}
              size={16}
              tintColor="#2B2233"
            />
          </Pressable>

          <Text className="text-center text-[17px] font-semibold tracking-[-0.3px] text-[#2B2233]">
            Cá nhân
          </Text>

          <View className="h-10 w-10" />
        </View>

        <View style={{ paddingHorizontal: pageGutter, paddingTop: 20 }}>
          <View
            className="relative rounded-[30px]"
            style={[guestHeroShadow, { marginBottom: 14, overflow: "visible" }]}
          >
            <LinearGradient
              colors={guestHeroGradientColors}
              start={{ x: 0, y: 0.2 }}
              end={{ x: 1, y: 0.9 }}
              locations={[0, 0.56, 1]}
              style={{
                borderRadius: 30,
                minHeight: 198,
                overflow: "hidden",
                paddingHorizontal: 18,
                paddingVertical: 18,
              }}
            >
              <View
                style={{
                  position: "absolute",
                  top: -48,
                  right: 34,
                  width: 156,
                  height: 156,
                  borderRadius: 999,
                  backgroundColor: "rgba(255,255,255,0.10)",
                }}
              />
              <View
                style={{
                  position: "absolute",
                  left: -92,
                  bottom: -126,
                  width: 214,
                  height: 214,
                  borderRadius: 999,
                  backgroundColor: "rgba(255,255,255,0.12)",
                }}
              />
              <View
                style={{
                  position: "absolute",
                  left: -18,
                  bottom: -60,
                  width: 164,
                  height: 164,
                  borderRadius: 999,
                  borderWidth: 16,
                  borderColor: "rgba(255,255,255,0.12)",
                }}
              />
              <View
                style={{
                  position: "absolute",
                  left: 44,
                  bottom: -34,
                  width: 94,
                  height: 94,
                  borderRadius: 999,
                  borderWidth: 10,
                  borderColor: "rgba(255,255,255,0.16)",
                }}
              />

              <View
                style={{
                  position: "absolute",
                  left: 16,
                  top: 0,
                  bottom: 0,
                  width: 178,
                  justifyContent: "center",
                  alignItems: "flex-start",
                  zIndex: 2,
                }}
                className="gap-2.5"
              >
                <Text className="text-[20px] font-semibold leading-6 text-white">
                  Chào bạn
                </Text>
                <Text className="text-[12px] font-medium leading-4 text-white/90">
                  Hãy tham gia để trải nghiệm nội dung đặc sắc
                </Text>
                <Pressable
                  accessibilityLabel="Đăng ký hoặc đăng nhập"
                  className="rounded-[16px] bg-[#FFF1F8] px-3 py-2.5"
                  onPress={onOpenAuth}
                  style={cardShadow}
                >
                  <Text
                    className="text-[13px] font-semibold text-[#D94D89]"
                    numberOfLines={1}
                  >
                    Đăng ký / Đăng nhập
                  </Text>
                </Pressable>
              </View>
            </LinearGradient>

            <GuestProfileHeroArt width={heroArtWidth} />
          </View>

          <View className="mt-2.5">
            {GUEST_MENU_ITEMS.map((item, index) => (
              <GuestMenuPreviewRow
                key={item.label}
                item={item}
                showDivider={index < GUEST_MENU_ITEMS.length - 1}
              />
            ))}
          </View>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

function GuestProfileHeroArt({ width }: { width: number }) {
  const artWidth = Math.round((width + 30) * 2.35);
  const artHeight = Math.round(artWidth / 1.5);
  const artRightOffset = Math.round(artWidth * 0.26);
  const artBottomOffset = Math.round(artHeight * 0.14);
  const glowSize = Math.round(Math.max(Math.min(artWidth * 0.24, 104), 84));

  return (
    <View
      pointerEvents="none"
      style={{
        position: "absolute",
        right: -artRightOffset,
        bottom: -artBottomOffset,
        width: artWidth,
        height: artHeight,
      }}
    >
      <View
        className="absolute rounded-full bg-white/16"
        style={{
          right: Math.round(artWidth * 0.15),
          top: Math.round(artHeight * 0.14),
          width: glowSize,
          height: glowSize,
        }}
      />

      <View
        style={{
          position: "absolute",
          right: 0,
          bottom: 0,
          width: artWidth,
          height: artHeight,
        }}
      >
        <Image
          source={guestHeroBannerImage}
          contentFit="contain"
          transition={180}
          style={[
            guestPhoneShadow,
            {
              width: artWidth,
              height: artHeight,
              backgroundColor: "transparent",
            },
          ]}
        />
      </View>
    </View>
  );
}

function GuestMenuPreviewRow({
  item,
  showDivider,
}: {
  item: (typeof GUEST_MENU_ITEMS)[number];
  showDivider: boolean;
}) {
  return (
    <View
      className="flex-row items-center gap-3 px-4 py-4"
      style={
        showDivider
          ? {
              borderBottomColor: "#F7E8E0",
              borderBottomWidth: 1,
            }
          : undefined
      }
    >
      <View className="h-11 w-11 items-center justify-center rounded-full bg-[#FFF5F8]">
        <SymbolView name={item.icon} size={16} tintColor="#EB489B" />
      </View>

      <Text className="min-w-0 flex-1 text-[15px] font-medium leading-5 text-[#2B2233]">
        {item.label}
      </Text>

      {item.value ? (
        <Text className="text-[13px] text-[#A6ABB8]">{item.value}</Text>
      ) : null}

      <SymbolView
        name={{
          ios: "chevron.right",
          android: "chevron_right",
          web: "chevron_right",
        }}
        size={16}
        tintColor="#AA9FB0"
      />
    </View>
  );
}

function AccountAvatar({
  avatar,
  badgeLabel,
  name,
  size,
}: {
  avatar: string | null;
  badgeLabel: string | null;
  name: string;
  size: number;
}) {
  return (
    <View className="relative">
      <UserAvatar
        borderColor="#F7F8FC"
        borderWidth={4}
        displayName={name}
        size={size}
        uri={avatar}
      />

      {badgeLabel ? (
        <LinearGradient
          colors={["#F58752", "#EB489B"]}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 1 }}
          style={{
            position: "absolute",
            bottom: -3,
            right: -3,
            width: 44,
            height: 44,
            borderRadius: 22,
            alignItems: "center",
            justifyContent: "center",
            borderWidth: 3,
            borderColor: "#F7F8FC",
            ...cardShadow,
          }}
        >
          <Text
            className="font-extrabold text-white"
            style={{ fontSize: badgeLabel.length > 2 ? 12 : 18 }}
          >
            {badgeLabel}
          </Text>
        </LinearGradient>
      ) : null}
    </View>
  );
}

function ProfileStat({ n, label }: { n: number; label: string }) {
  return (
    <View className="flex-1 rounded-2xl bg-white py-3" style={cardShadow}>
      <Text className="text-center text-[18px] font-semibold text-[#2B2233]">
        {n.toLocaleString()}
      </Text>
      <Text className="mt-0.5 text-center text-[11px] leading-tight text-[#8E869A]">
        {label}
      </Text>
    </View>
  );
}

function InlineNotice({ message }: { message: string }) {
  return (
    <View className="mt-5 rounded-2xl border border-[#F6C9C0] bg-[#FFF4F1] px-4 py-3">
      <Text className="text-[13px] font-semibold leading-5 text-[#B54D3A]">
        {message}
      </Text>
    </View>
  );
}

function PostAuthorAvatar({
  avatar,
  name,
}: {
  avatar: string | null;
  name: string;
}) {
  return <UserAvatar displayName={name} size={42} uri={avatar} />;
}

function PostAction({
  active = false,
  disabled = false,
  dimmed,
  icon,
  label,
  onPress,
  tintColor = "#F15C9B",
}: {
  active?: boolean;
  disabled?: boolean;
  /**
   * Làm mờ nút. Mặc định đi theo `disabled`, nhưng tách riêng để bài riêng tư /
   * chờ duyệt vẫn hiển thị y hệt bài đã duyệt dù không bấm được.
   */
  dimmed?: boolean;
  icon: SymbolName;
  label: number | string;
  onPress?: () => void;
  tintColor?: string;
}) {
  const isDimmed = dimmed ?? disabled;

  return (
    <Pressable
      className="flex-row items-center rounded-full pr-2"
      disabled={disabled || !onPress}
      hitSlop={8}
      onPress={onPress}
      style={({ pressed }) => ({
        opacity: isDimmed ? 0.5 : pressed ? 0.72 : 1,
      })}
    >
      <SymbolView
        name={icon}
        size={18}
        tintColor={active ? tintColor : "#7A7380"}
      />
      <Text
        className="ml-1.5 text-[15px] text-[#706775]"
        style={{ includeFontPadding: false, lineHeight: lineHeightFor(15) }}
      >
        {label}
      </Text>
    </Pressable>
  );
}

function PostMediaGallery({ items }: { items: CommunityFeedMediaItem[] }) {
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
      className="text-[14px] text-[#2B232D]"
      style={{ includeFontPadding: false, lineHeight: lineHeightFor(14) }}
    >
      {expanded || !shouldTruncate ? normalizedText : collapsedText}
      {shouldTruncate ? (
        <Text
          className="font-medium text-[#D4578F]"
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

function SharedPostCard({
  sharedPost,
  withTopSpacing,
}: {
  sharedPost: SharedPostSummary;
  withTopSpacing: boolean;
}) {
  const author =
    sharedPost.displayName.trim() ||
    sharedPost.username.trim() ||
    fallbackPostAuthorName;
  const content = stripTrailingProfileHashtagBlock(sharedPost.content);
  const mediaItems: CommunityFeedMediaItem[] = sharedPost.medias
    .filter(
      (media) =>
        media.type.trim().toUpperCase() === "IMAGE" &&
        Boolean(media.url.trim()),
    )
    .map((media) => ({
      key: `shared-${sharedPost.postId}-media-${media.id}`,
      source: {
        uri: media.url,
      },
    }));
  const tagLabels = sharedPost.tags
    .map((tag) => formatProfileTagLabel(tag.name))
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
            className="text-[16px] font-semibold text-[#2F2432]"
            maxFontSizeMultiplier={postAuthorMaxFontSizeMultiplier}
            numberOfLines={1}
            style={{ includeFontPadding: false, lineHeight: lineHeightFor(16) }}
          >
            {author}
          </Text>

          <View className="mt-0.5 flex-row items-center gap-1">
            <Text
              className="text-[14px] text-[#8A7D86]"
              style={{
                includeFontPadding: false,
                lineHeight: lineHeightFor(14),
              }}
            >
              {formatPostTimestamp(sharedPost.createdAt)}
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
          <ExpandablePostCaption text={content} />
        </View>
      ) : null}

      {mediaItems.length > 0 ? (
        <View className="mt-2">
          <PostMediaGallery items={mediaItems} />
        </View>
      ) : null}

      {tagLabels.length > 0 ? (
        <View className="mt-1 flex-row flex-wrap items-center">
          {tagLabels.map((tagLabel) => (
            <PostTagChip
              key={`shared-${sharedPost.postId}-${tagLabel}`}
              label={tagLabel}
            />
          ))}
        </View>
      ) : null}
    </View>
  );
}

function PostTagChip({ label }: { label: string }) {
  return (
    <View className="mr-2 mt-1.5 rounded-full bg-[#F4F1F4] px-3 py-0.5">
      <Text
        className="text-[14px] text-[#7D7680]"
        style={{ includeFontPadding: false, lineHeight: lineHeightFor(14) }}
      >
        {label}
      </Text>
    </View>
  );
}

function PostRouteCard({
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
            className="text-[13px] font-semibold text-[#F2608E]"
            style={{ includeFontPadding: false, lineHeight: lineHeightFor(13) }}
          >
            Tuyến đường
          </Text>
          <Text
            className="text-[15px] font-medium text-[#4B414C]"
            numberOfLines={2}
            style={{ includeFontPadding: false, lineHeight: lineHeightFor(15) }}
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

function PostHotspotCard({
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
            className="text-[13px] font-semibold text-[#18A7B4]"
            style={{ includeFontPadding: false, lineHeight: lineHeightFor(13) }}
          >
            {`${count} địa điểm`}
          </Text>
          <Text
            className="text-[15px] text-[#6D6671]"
            numberOfLines={2}
            style={{ includeFontPadding: false, lineHeight: lineHeightFor(15) }}
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

function PostMenuRow({
  item,
  isLast,
  onPress,
}: {
  item: (typeof postMenuSections)[number]["items"][number];
  isLast: boolean;
  onPress: () => void;
}) {
  const labelColor = item.isDestructive ? "#C24F3B" : "#202124";
  const descriptionColor = item.isDestructive ? "#B46A5F" : "#8E869A";

  return (
    <Pressable
      className={`flex-row items-start gap-3 py-3 ${isLast ? "" : "border-b border-[#E7E5EF]"}`}
      onPress={onPress}
    >
      <View className="w-6 items-center pt-0.5">
        <SymbolView name={item.icon} size={19} tintColor={labelColor} />
      </View>
      <View className="min-w-0 flex-1">
        <Text
          className="text-[15px] font-normal"
          style={{
            color: labelColor,
            includeFontPadding: false,
            lineHeight: lineHeightFor(15),
          }}
        >
          {item.label}
        </Text>
        {item.description ? (
          <Text
            className="mt-0.5 text-[12px]"
            style={{
              color: descriptionColor,
              includeFontPadding: false,
              lineHeight: lineHeightFor(12),
            }}
          >
            {item.description}
          </Text>
        ) : null}
      </View>
    </Pressable>
  );
}

function PostOptionsSheet({
  bottomInset,
  onClose,
  visible,
}: {
  bottomInset: number;
  onClose: () => void;
  visible: boolean;
}) {
  return (
    <Modal
      transparent
      animationType="slide"
      visible={visible}
      onRequestClose={onClose}
      statusBarTranslucent
    >
      <View className="flex-1 bg-black/35">
        <Pressable className="flex-1" onPress={onClose} />
        <View
          className="rounded-t-[28px] bg-white px-3 pt-3"
          style={{ paddingBottom: Math.max(bottomInset, 14) }}
        >
          <View className="items-center pb-3">
            <View className="h-1.5 w-14 rounded-full bg-[#D3D2DC]" />
          </View>

          <ScrollView
            bounces={false}
            showsVerticalScrollIndicator={false}
            contentContainerStyle={{ paddingBottom: 4 }}
          >
            {postMenuSections.map((section) => (
              <View
                key={section.key}
                className="mb-3 rounded-[22px] bg-[#F7F6FB] px-4 py-1"
              >
                {section.items.map((item, index) => (
                  <PostMenuRow
                    key={`${section.key}-${item.label}`}
                    item={item}
                    isLast={index === section.items.length - 1}
                    onPress={onClose}
                  />
                ))}
              </View>
            ))}
          </ScrollView>
        </View>
      </View>
    </Modal>
  );
}

function PostCard({
  post,
  isLast,
  isLiked,
  isLiking,
  onLikePost,
  onOpenHotspot,
  onOpenRoute,
  pageGutter,
  profileAvatar,
  profileName,
  profileUsername,
  resolvedHotspots,
  resolvedRoutes,
}: {
  post: ProfilePost;
  isLast: boolean;
  isLiked: boolean;
  isLiking: boolean;
  onLikePost: (post: ProfilePost) => void;
  onOpenHotspot: (hotspotId: number) => void;
  onOpenRoute: (routeId: number) => void;
  pageGutter: number;
  profileAvatar: string | null;
  profileName: string;
  profileUsername: string;
  resolvedHotspots: Record<number, ResolvedProfileHotspotPreview>;
  resolvedRoutes: Record<number, ResolvedProfileRoutePreview>;
}) {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const [isPostMenuVisible, setIsPostMenuVisible] = useState(false);
  const authorName =
    post.displayName.trim() || profileName.trim() || fallbackPostAuthorName;
  const sharedPost = post.sharedPost;
  const postContent =
    stripTrailingProfileHashtagBlock(post.text) ||
    (sharedPost ? "" : "Chuyến đi hôm nay rất đáng nhớ.");
  const mediaItems = buildProfilePostMediaItems(post);
  const visibilityIcon = getPostVisibilityIcon(post.visibility);
  const visibilityLabel = getPostVisibilityLabel(post.visibility);
  const statusLabel = getProfilePostStatusLabel(post.status);
  const statusTone = getProfilePostStatusTone(post.status);
  const normalizedStatus = normalizeProfilePostStatus(post.status);
  const normalizedVisibility = post.visibility.trim().toUpperCase();
  const canInteractWithPost =
    normalizedStatus === "APPROVED" && normalizedVisibility === "PUBLIC";
  const likeCount = post.likeCount ?? 0;
  const commentCount = post.commentCount ?? 0;
  const shareCount = post.shareCount ?? 0;
  const routeIds = post.routeIds.filter(
    (routeId) => Number.isInteger(routeId) && routeId > 0,
  );
  const hotspotIds = post.hotspotIds.filter(
    (hotspotId) => Number.isInteger(hotspotId) && hotspotId > 0,
  );
  const tagLabels = post.tags
    .map((tag) => formatProfileTagLabel(tag.name))
    .filter((tagLabel): tagLabel is string => Boolean(tagLabel));
  const routeLabel = buildProfileRouteLabel(routeIds, resolvedRoutes);
  const hotspotSubtitle = buildProfileHotspotSubtitle(
    hotspotIds,
    resolvedHotspots,
  );
  const hotspotImageUris = buildProfileHotspotImageUris(
    hotspotIds,
    resolvedHotspots,
  );
  const isPendingPost = normalizedStatus === "PENDING";
  const statusBadgeLabel =
    normalizedStatus === "PENDING" ? "Chờ duyệt" : statusLabel;

  function handleOpenComments() {
    const cachedPost = mapProfilePostToCommunityFeedPost(post, {
      profileName,
      profileUsername,
    });

    if (
      typeof cachedPost.postNumericId !== "number" ||
      cachedPost.postNumericId <= 0
    ) {
      return;
    }

    cacheCommunityPost(cachedPost);
    router.push(`/community/post/${cachedPost.postNumericId}` as Href);
  }

  return (
    <>
      <View className="pb-3 pt-3.5">
        <View className="flex-row items-start">
          <View className="min-w-0 flex-1 flex-row items-start">
            <PostAuthorAvatar avatar={profileAvatar} name={authorName} />

            <View className="ml-3 flex-1 pr-2">
              <View className="flex-row items-center gap-2">
                <Text
                  className="min-w-0 flex-1 text-[17px] font-semibold text-[#2F2432]"
                  maxFontSizeMultiplier={postAuthorMaxFontSizeMultiplier}
                  numberOfLines={1}
                  style={{
                    includeFontPadding: false,
                    lineHeight: lineHeightFor(17),
                  }}
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
                  className="text-[14px] text-[#8A7D86]"
                  style={{
                    includeFontPadding: false,
                    lineHeight: lineHeightFor(14),
                  }}
                >
                  {formatPostTimestamp(post.createdAt)}
                </Text>
                <Text
                  className="text-[14px] text-[#8A7D86]"
                  style={{
                    includeFontPadding: false,
                    lineHeight: lineHeightFor(14),
                  }}
                >
                  •
                </Text>
                <SymbolView
                  name={visibilityIcon}
                  size={12}
                  tintColor="#8A7D86"
                />
                <Text
                  className="text-[14px] text-[#8A7D86]"
                  style={{
                    includeFontPadding: false,
                    lineHeight: lineHeightFor(14),
                  }}
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

          <Pressable
            className="h-8 w-8 items-center justify-center rounded-full"
            onPress={() => setIsPostMenuVisible(true)}
          >
            <SymbolView
              name={{
                ios: "ellipsis",
                android: "more_horiz",
                web: "more_horiz",
              }}
              size={18}
              tintColor="#554C56"
            />
          </Pressable>
        </View>

        <View className="pt-1.5">
          {postContent ? <ExpandablePostCaption text={postContent} /> : null}

          {sharedPost ? (
            <SharedPostCard
              sharedPost={sharedPost}
              withTopSpacing={Boolean(postContent)}
            />
          ) : null}

          {tagLabels.length > 0 ? (
            <View className="mt-1 flex-row flex-wrap items-center">
              {tagLabels.map((tagLabel) => (
                <PostTagChip key={`${post.id}-${tagLabel}`} label={tagLabel} />
              ))}
            </View>
          ) : null}

          {routeLabel ? (
            <View className="mt-1.5">
              <PostRouteCard
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
              <PostHotspotCard
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
            <PostMediaGallery items={mediaItems} />
          </View>
        ) : null}

        <View className="mt-1.5 flex-row items-center">
          <PostAction
            active={canInteractWithPost && isLiked}
            dimmed={isLiking}
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
            <PostAction
              dimmed={false}
              disabled={!canInteractWithPost}
              icon={{
                ios: "bubble.left",
                android: "chat_bubble_outline",
                web: "chat_bubble_outline",
              }}
              label={commentCount}
              onPress={canInteractWithPost ? handleOpenComments : undefined}
            />
          </View>
          <View className="ml-4">
            <PostAction
              icon={{
                ios: "arrowshape.turn.up.right",
                android: "share",
                web: "share",
              }}
              label={shareCount > 0 ? shareCount : "Chia sẻ"}
            />
          </View>
          <View className="flex-1" />
        </View>

        {post.reason ? (
          <Text
            className="mt-2 text-[12px] font-semibold text-[#C24F3B]"
            style={{ includeFontPadding: false, lineHeight: lineHeightFor(12) }}
          >
            Lý do: {post.reason}
          </Text>
        ) : null}
      </View>

      {isLast ? null : (
        <View
          style={{
            backgroundColor: "#ECE6EA",
            height: StyleSheet.hairlineWidth,
            marginHorizontal: -pageGutter,
          }}
        />
      )}

      <PostOptionsSheet
        bottomInset={insets.bottom}
        visible={isPostMenuVisible}
        onClose={() => setIsPostMenuVisible(false)}
      />
    </>
  );
}

function RouteParticipantCard({
  isLast,
  onPress,
  pageGutter,
  participant,
}: {
  isLast: boolean;
  onPress: () => void;
  pageGutter: number;
  participant: ProfileRouteParticipant;
}) {
  const routeName =
    participant.routeName?.trim() || `Tuyến đường #${participant.routeId}`;
  const normalizedStatus = normalizeRouteParticipantStatus(participant.status);
  const statusLabel = getRouteParticipantStatusLabel(participant.status);
  const statusTone = getRouteParticipantStatusTone(participant.status);
  const activityDateLabel = formatRouteParticipantDate(
    normalizedStatus === "COMPLETED"
      ? (participant.completedAt ?? participant.startedAt ?? null)
      : (participant.startedAt ?? participant.completedAt ?? null),
  );
  const ratingLabel = formatRouteParticipantRating(participant.rating);
  const progressLabel = `${participant.completedStops}/${participant.totalStops} điểm dừng`;
  const addressLabel =
    participant.address?.trim() ||
    participant.description ||
    "Nhấn để xem chi tiết tuyến đường.";
  const footerMetaItems = [
    participant.estimateTime ? `${participant.estimateTime} phút` : null,
    participant.totalDistance ? `${participant.totalDistance} km` : null,
  ].filter((item): item is string => Boolean(item));
  const activityLabel =
    normalizedStatus === "COMPLETED"
      ? activityDateLabel
        ? `Hoàn tất ${activityDateLabel}`
        : "Đã hoàn tất hành trình"
      : activityDateLabel
        ? `Bắt đầu ${activityDateLabel}`
        : "Đang khám phá";

  return (
    <>
      <Pressable
        className="py-3"
        onPress={onPress}
        style={({ pressed }) => ({
          opacity: pressed ? 0.72 : 1,
        })}
      >
        <View className="flex-row items-center">
          <View className="overflow-hidden rounded-[18px] bg-[#EDF2F7]">
            <Image
              cachePolicy="memory-disk"
              contentFit="cover"
              source={participant.cover ?? routeParticipantFallbackCover}
              style={{ height: 116, width: 116 }}
              transition={180}
            />

            {participant.xp ? (
              <LinearGradient
                className="absolute left-2 top-2 rounded-full px-2 py-1"
                colors={["#FFD84D", "#F59E0B"]}
                start={{ x: 0, y: 0 }}
                end={{ x: 1, y: 1 }}
              >
                <Text
                  className="text-[11px] font-extrabold text-[#5A3400]"
                  style={{
                    includeFontPadding: false,
                    lineHeight: lineHeightFor(11),
                  }}
                >
                  +{formatCompactCount(participant.xp)} XP
                </Text>
              </LinearGradient>
            ) : null}
          </View>

          <View className="ml-3 min-w-0 flex-1">
            <View className="flex-row items-start gap-1.5">
              <View className="min-w-0 flex-1">
                <Text
                  className="text-[17px] font-semibold text-[#2F2432]"
                  maxFontSizeMultiplier={postAuthorMaxFontSizeMultiplier}
                  numberOfLines={1}
                  style={{
                    includeFontPadding: false,
                    lineHeight: lineHeightFor(17),
                  }}
                >
                  {routeName}
                </Text>

                <Text
                  className="mt-[2px] text-[13px] text-[#8A7D86]"
                  numberOfLines={1}
                  style={{
                    includeFontPadding: false,
                    lineHeight: lineHeightFor(13),
                  }}
                >
                  {activityLabel}
                </Text>
              </View>

              <View
                className="rounded-full border px-2 py-[3px]"
                style={{
                  backgroundColor: statusTone.backgroundColor,
                  borderColor: statusTone.borderColor,
                }}
              >
                <Text
                  className="text-[10px] font-bold"
                  style={{
                    color: statusTone.textColor,
                    includeFontPadding: false,
                    lineHeight: lineHeightFor(10),
                  }}
                >
                  {statusLabel}
                </Text>
              </View>
            </View>

            <View className="mt-[2px] flex-row flex-wrap items-center gap-1">
              {ratingLabel ? (
                <View className="flex-row items-center gap-1">
                  <SymbolView
                    name={{ ios: "star.fill", android: "star", web: "star" }}
                    size={12}
                    tintColor="#F59E0B"
                  />
                  <Text
                    className="text-[13px] text-[#D97706]"
                    style={{
                      includeFontPadding: false,
                      lineHeight: lineHeightFor(13),
                    }}
                  >
                    {ratingLabel}
                  </Text>
                </View>
              ) : null}

              {ratingLabel ? (
                <Text
                  className="text-[13px] text-[#C49A72]"
                  style={{
                    includeFontPadding: false,
                    lineHeight: lineHeightFor(13),
                  }}
                >
                  ·
                </Text>
              ) : null}

              <Text
                className="text-[13px] text-[#E59A54]"
                numberOfLines={1}
                style={{
                  includeFontPadding: false,
                  lineHeight: lineHeightFor(13),
                }}
              >
                {progressLabel}
              </Text>
            </View>

            <View className="mt-[2px] flex-row items-start gap-1">
              <SymbolView
                name={{
                  ios: "mappin.and.ellipse",
                  android: "place",
                  web: "place",
                }}
                size={12}
                tintColor="#A38D9F"
              />
              <Text
                className="min-w-0 flex-1 text-[13px] text-[#776B77]"
                numberOfLines={1}
                style={{
                  includeFontPadding: false,
                  lineHeight: lineHeightFor(13),
                }}
              >
                {addressLabel}
              </Text>
            </View>

            <View className="mt-[3px] flex-row items-center">
              <View className="flex-row flex-wrap items-center gap-2">
                {footerMetaItems.map((item) => (
                  <View className="flex-row items-center gap-1" key={item}>
                    <SymbolView
                      name={{
                        ios: "clock",
                        android: "schedule",
                        web: "schedule",
                      }}
                      size={12}
                      tintColor="#A38D9F"
                    />
                    <Text
                      className="text-[13px] text-[#8A7D86]"
                      numberOfLines={1}
                      style={{
                        includeFontPadding: false,
                        lineHeight: lineHeightFor(13),
                      }}
                    >
                      {item}
                    </Text>
                  </View>
                ))}
              </View>
            </View>
          </View>
        </View>
      </Pressable>

      {isLast ? null : (
        <View
          style={{
            backgroundColor: "#ECE6EA",
            height: StyleSheet.hairlineWidth,
            marginHorizontal: -pageGutter,
          }}
        />
      )}
    </>
  );
}

function ProfilePostsSectionHeader({ title }: { title: string }) {
  return (
    <View className="mb-3 px-1">
      <Text className="text-[14px] font-semibold text-[#2B2233]">{title}</Text>
    </View>
  );
}

function EmptyPosts({ tab }: { tab: Extract<Tab, "posts" | "pending-posts"> }) {
  return (
    <View className="items-center py-12">
      <SymbolView
        name={
          tab === "pending-posts"
            ? ({ ios: "lock", android: "lock", web: "lock" } as SymbolName)
            : ({ ios: "photo", android: "image", web: "image" } as SymbolName)
        }
        size={30}
        tintColor="#AA9FB0"
      />
      <Text className="mt-2 text-[13px] text-[#8E869A]">
        {tab === "pending-posts"
          ? "Bạn chưa có bài viết riêng tư hoặc đang chờ duyệt"
          : "Bạn chưa có bài viết nào đã được duyệt"}
      </Text>
    </View>
  );
}

function EmptyRoutes() {
  return (
    <View className="items-center py-12">
      <SymbolView
        name={{ ios: "map", android: "map", web: "map" }}
        size={30}
        tintColor="#AA9FB0"
      />
      <Text className="mt-2 text-[13px] text-[#8E869A]">
        Bạn chưa tham gia tuyến đường nào
      </Text>
    </View>
  );
}
