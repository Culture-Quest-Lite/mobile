import { SymbolView } from "@/components/ui/symbol-view";
import { Image } from "expo-image";
import { LinearGradient } from "expo-linear-gradient";
import { type Href, useFocusEffect, useRouter } from "expo-router";
import { type ComponentProps, useCallback, useRef, useState } from "react";
import {
  ActivityIndicator,
  Modal,
  Pressable,
  ScrollView,
  Text,
  View,
} from "react-native";
import {
  SafeAreaView,
  useSafeAreaInsets,
} from "react-native-safe-area-context";

import { useAuthSession } from "@/features/auth/hooks/use-auth-session";
import {
  cacheCommunityPost,
  type CommunityFeedMediaItem,
  type CommunityFeedPost,
} from "@/features/community/data/community-post-cache";
import { getCachedHotspotDetail } from "@/features/home/data/hotspot-detail-cache";
import { getHotspotHref, type HotspotDetail } from "@/features/home/data/hotspots";
import { useScreenLayout } from "@/hooks/use-screen-layout";
import type { RouteItem } from "@/lib/demo-data";
import {
  getPostVisibilityIcon,
  getPostVisibilityLabel,
} from "@/lib/post-visibility";
import { LevelProgressCard } from "../components/level-progress-card";
import { useProfile } from "../hooks/use-profile";
import type { ProfilePost, ProfilePostStatus } from "../types";

type Tab = "posts" | "pending-posts" | "routes" | "liked-hotspots";
type SymbolName = ComponentProps<typeof SymbolView>["name"];

const cardShadow = {
  shadowColor: "rgba(28, 45, 80, 0.10)",
  shadowOpacity: 1,
  shadowRadius: 20,
  shadowOffset: { width: 0, height: 10 },
  elevation: 10,
} as const;

const heroGradientColors = ["#20476B", "#4F87B2", "#F7F8FC"] as const;
const avatarFallbackColors = ["#EB489B", "#F58752"] as const;
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
    label: "Chờ duyệt",
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
  {
    key: "liked-hotspots",
    label: "Hotspot đã thích",
    icon: { ios: "heart", android: "favorite_border", web: "favorite_border" },
  },
];
const fallbackPostImageUri =
  "https://i.pinimg.com/1200x/6d/cd/14/6dcd140b80b210ac445a0eddfc40784a.jpg";
const fallbackPostAuthorName = "Minh Anh";
const fallbackPostTimestamp = "02/07/2026";
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
        label: "Ghim bài viết",
        icon: { ios: "pin", android: "push_pin", web: "push_pin" },
      },
      {
        label: "Lưu bài viết",
        icon: {
          ios: "bookmark",
          android: "bookmark_border",
          web: "bookmark_border",
        },
      },
      {
        label: "Chia sẻ lên cộng đồng",
        icon: { ios: "camera", android: "photo_camera", web: "photo_camera" },
      },
      {
        label: "Chỉnh sửa bài viết",
        icon: { ios: "pencil", android: "edit", web: "edit" },
      },
      {
        label: "Chỉnh sửa quyền riêng tư",
        icon: { ios: "lock", android: "lock", web: "lock" },
      },
      {
        label: "Ai có thể bình luận về bài viết này?",
        icon: {
          ios: "bubble.left.and.bubble.right",
          android: "forum",
          web: "forum",
        },
      },
      {
        label: "Chuyển vào kho lưu trữ",
        icon: { ios: "archivebox", android: "inventory_2", web: "inventory_2" },
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
  {
    key: "secondary",
    items: [
      {
        label: "Thêm vào album",
        icon: {
          ios: "square.stack",
          android: "photo_album",
          web: "photo_album",
        },
      },
      {
        label: "Thêm ảnh/video khác vào bài viết này",
        icon: {
          ios: "plus.square.on.square",
          android: "add_photo_alternate",
          web: "add_photo_alternate",
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

function formatPostTimestamp(value: string | null) {
  if (!value) {
    return fallbackPostTimestamp;
  }

  const parsedDate = new Date(value);

  if (Number.isNaN(parsedDate.getTime())) {
    return fallbackPostTimestamp;
  }

  const dateText = new Intl.DateTimeFormat("vi-VN", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
  }).format(parsedDate);

  return dateText;
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

function resolvePostMediaUris(post: ProfilePost) {
  const mediaUris = post.medias
    .filter((media) => {
      const trimmedUrl = media.url.trim();
      const normalizedType = media.type.trim().toUpperCase();
      const normalizedMime = media.mimeType.trim().toLowerCase();

      return (
        trimmedUrl &&
        (normalizedType === "IMAGE" || normalizedMime.startsWith("image/"))
      );
    })
    .map((media) => media.url.trim());

  if (mediaUris.length > 0) {
    return Array.from(new Set(mediaUris));
  }

  if (post.image?.trim()) {
    return [post.image.trim()];
  }

  return [fallbackPostImageUri];
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
    caption: post.text.trim() || "Bài viết mới từ hồ sơ cá nhân.",
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
    hotspotIds: post.hotspotIds,
    isLiked: post.isLiked === true,
    likeCountValue: post.likeCount,
    mediaItems,
    postNumericId: Number.isInteger(parsedPostId) ? parsedPostId : null,
    replies: formatCompactCount(post.replyCount),
    replyCountValue: post.replyCount ?? 0,
    shareCountValue: post.shareCount,
    visibility: post.visibility,
  };
}

export default function ProfileScreen() {
  const router = useRouter();
  const authSession = useAuthSession();
  const hasFocusedProfileRef = useRef(false);
  const {
    likedHotspots,
    profile,
    posts,
    userRoutes,
    isLoading,
    error,
    reloadProfile,
  } = useProfile();
  const [tab, setTab] = useState<Tab>("posts");
  const insets = useSafeAreaInsets();
  const { gutter, safeWidth } = useScreenLayout({ maxContentWidth: 640 });
  const heroHeight = Math.max(Math.min(safeWidth * 0.88, 320), 280);
  const avatarSize = 126;
  const profileOverlap = avatarSize * 0.52;
  const handleOpenAuth = () => {
    router.push("/login?entry=home" as Href);
  };
  const handleBackToHome = () => {
    router.replace("/home");
  };
  const handleOpenLikedHotspot = (slug: string) => {
    const cachedHotspotId = getCachedHotspotDetail({ slug })?.hotspotId ?? null;
    router.push(getHotspotHref(slug, cachedHotspotId));
  };

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
    return (
      <SafeAreaView className="flex-1 items-center justify-center bg-[#F7F8FC]">
        <ActivityIndicator color="#F58752" size="large" />
      </SafeAreaView>
    );
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
    return (
      <SafeAreaView className="flex-1 items-center justify-center bg-[#F7F8FC]">
        <Text className="text-[15px] text-[#8E869A]">Không tìm thấy hồ sơ</Text>
      </SafeAreaView>
    );
  }

  const levelNumber = typeof profile.level === "number" ? profile.level : null;
  const levelDisplayName = profile.levelName?.trim() ?? "";
  const resolvedDisplayName =
    profile.name.trim() ||
    authSession.displayName.trim() ||
    "Explorer";
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
  const approvedPosts = posts.filter(
    (post) => normalizeProfilePostStatus(post.status) === "APPROVED",
  );
  const pendingPosts = posts.filter(
    (post) => normalizeProfilePostStatus(post.status) === "PENDING",
  );
  const visiblePosts = tab === "pending-posts" ? pendingPosts : approvedPosts;
  const postSectionTitle =
    tab === "pending-posts" ? "Bài viết chờ duyệt" : "Bài viết đã duyệt";

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
              username={resolvedProfileUsername}
            />

            <View className="min-w-0 flex-1 pt-8">
              <View className="mt-0 flex-row items-center">
                <Text
                  className="text-[16px] font-extrabold leading-tight text-[#2B2233]"
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
                  {visiblePosts.map((post, index) => (
                    <PostCard
                      key={post.id}
                      isLast={index === visiblePosts.length - 1}
                      pageGutter={gutter}
                      post={post}
                      profileAvatar={profile.avatar}
                      profileName={resolvedDisplayName}
                      profileUsername={resolvedProfileUsername}
                    />
                  ))}
                </View>
              )
            ) : tab === "routes" ? (
              userRoutes.length === 0 ? (
                <EmptyRoutes />
              ) : (
                <View className="gap-2">
                  {userRoutes.map((route) => (
                    <RouteCard
                      key={route.id}
                      route={route}
                      onPress={() => router.push(`/route/${route.id}` as Href)}
                    />
                  ))}
                </View>
              )
            ) : likedHotspots.length === 0 ? (
              <EmptyLikedHotspots />
            ) : (
              <View className="gap-2">
                {likedHotspots.map((hotspot) => (
                  <LikedHotspotCard
                    key={hotspot.slug}
                    hotspot={hotspot}
                    onPress={() => handleOpenLikedHotspot(hotspot.slug)}
                  />
                ))}
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

          <Text className="text-center text-[20px] font-black tracking-[-0.3px] text-[#2B2233]">
            Cá nhân
          </Text>

          <View className="h-10 w-10" />
        </View>

        <View style={{ paddingHorizontal: pageGutter, paddingTop: 20 }}>
          <View
            className="relative rounded-[30px]"
            style={[guestHeroShadow, { marginBottom: 22, overflow: "visible" }]}
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
                <Text className="text-[21px] font-black leading-6 text-white">
                  Chào bạn
                </Text>
                <Text className="text-[13px] leading-5 text-white/90">
                  Hãy tham gia để trải nghiệm nội dung đặc sắc
                </Text>
                <Pressable
                  accessibilityLabel="Đăng ký hoặc đăng nhập"
                  className="rounded-[16px] border border-[#D94D89] bg-[#FFF1F8] px-3 py-2.5"
                  onPress={onOpenAuth}
                  style={cardShadow}
                >
                  <Text
                    className="text-[14px] font-extrabold text-[#D94D89]"
                    numberOfLines={1}
                  >
                    Đăng ký / Đăng nhập
                  </Text>
                </Pressable>
              </View>
            </LinearGradient>

            <GuestProfileHeroArt width={heroArtWidth} />
          </View>

          <View className="mt-5">
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

      <Text className="min-w-0 flex-1 text-[17px] font-semibold leading-5 text-[#2B2233]">
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
  username,
}: {
  avatar: string | null;
  badgeLabel: string | null;
  name: string;
  size: number;
  username: string;
}) {
  const [hasError, setHasError] = useState(!avatar);
  const initials = getProfileInitials(name, username);

  return (
    <View className="relative">
      <View
        className="overflow-hidden rounded-full bg-white"
        style={{
          width: size,
          height: size,
          borderRadius: size / 2,
          borderWidth: 4,
          borderColor: "#F7F8FC",
        }}
      >
        {hasError || !avatar ? (
          <LinearGradient
            colors={avatarFallbackColors}
            start={{ x: 0, y: 0.5 }}
            end={{ x: 1, y: 0.5 }}
            style={{
              width: "100%",
              height: "100%",
              alignItems: "center",
              justifyContent: "center",
            }}
          >
            <Text
              className="font-black text-white"
              style={{ fontSize: Math.max(22, size * 0.28) }}
            >
              {initials}
            </Text>
          </LinearGradient>
        ) : (
          <Image
            source={avatar}
            contentFit="cover"
            transition={180}
            cachePolicy="memory-disk"
            onError={() => setHasError(true)}
            style={{
              width: "100%",
              height: "100%",
            }}
          />
        )}
      </View>

      {badgeLabel ? (
        <LinearGradient
          colors={["#F58752", "#EB489B"]}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 1 }}
          style={{
            position: "absolute",
            bottom: -4,
            right: -4,
            width: 48,
            height: 48,
            borderRadius: 24,
            alignItems: "center",
            justifyContent: "center",
            borderWidth: 3,
            borderColor: "#F7F8FC",
            ...cardShadow,
          }}
        >
          <Text
            className="font-extrabold text-white"
            style={{ fontSize: badgeLabel.length > 2 ? 13 : 21 }}
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
    <View className="flex-1 rounded-2xl bg-white py-2.5" style={cardShadow}>
      <Text className="text-center text-[17px] font-extrabold text-[#2B2233]">
        {n.toLocaleString()}
      </Text>
      <Text className="mt-0.5 text-center text-[10px] leading-tight text-[#8E869A]">
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
  username,
}: {
  avatar: string | null;
  name: string;
  username: string;
}) {
  const [hasError, setHasError] = useState(!avatar);
  const initials = getProfileInitials(name, username);

  return (
    <View className="h-11 w-11 overflow-hidden rounded-full bg-[#F3F4F6]">
      {hasError || !avatar ? (
        <LinearGradient
          colors={avatarFallbackColors}
          start={{ x: 0, y: 0.5 }}
          end={{ x: 1, y: 0.5 }}
          style={{
            width: "100%",
            height: "100%",
            alignItems: "center",
            justifyContent: "center",
          }}
        >
          <Text className="text-[16px] font-black text-white">{initials}</Text>
        </LinearGradient>
      ) : (
        <Image
          source={avatar}
          contentFit="cover"
          transition={180}
          cachePolicy="memory-disk"
          onError={() => setHasError(true)}
          style={{ width: "100%", height: "100%" }}
        />
      )}
    </View>
  );
}

function PostAction({
  active = false,
  icon,
  onPress,
  tintColor = "#6B7280",
  value,
}: {
  active?: boolean;
  icon: SymbolName;
  onPress?: () => void;
  tintColor?: string;
  value?: number;
}) {
  const resolvedTintColor = active ? tintColor : "#6B7280";
  const ActionContainer = onPress ? Pressable : View;

  return (
    <ActionContainer
      className="flex-row items-center gap-1.5"
      onPress={onPress}
      style={
        onPress
          ? ({ pressed }: { pressed: boolean }) => ({
              opacity: pressed ? 0.72 : 1,
            })
          : undefined
      }
    >
      <SymbolView name={icon} size={17} tintColor={resolvedTintColor} />
      {typeof value === "number" ? (
        <Text
          className="text-[14px] font-medium"
          style={{ color: active ? resolvedTintColor : "#4B5563" }}
        >
          {value}
        </Text>
      ) : null}
    </ActionContainer>
  );
}

function PostMediaGallery({ sources }: { sources: string[] }) {
  const visibleSources = sources.slice(0, 4);
  const hiddenCount = Math.max(sources.length - visibleSources.length, 0);

  if (visibleSources.length === 1) {
    return (
      <View className="overflow-hidden bg-[#F3F4F6]">
        <Image
          source={visibleSources[0]}
          contentFit="cover"
          transition={180}
          cachePolicy="memory-disk"
          style={{
            aspectRatio: 1.08,
            width: "100%",
          }}
        />
      </View>
    );
  }

  return (
    <View className="flex-row gap-0">
      {visibleSources.map((source, index) => {
        const isLastVisibleItem = index === visibleSources.length - 1;

        return (
          <View
            key={`${source}-${index}`}
            className="min-w-0 flex-1 overflow-hidden bg-[#F3F4F6]"
            style={{ height: 238 }}
          >
            <Image
              source={source}
              contentFit="cover"
              transition={180}
              cachePolicy="memory-disk"
              style={{ height: "100%", width: "100%" }}
            />

            {hiddenCount > 0 && isLastVisibleItem ? (
              <View className="absolute inset-0 items-center justify-center bg-black/35">
                <Text className="text-[28px] font-black text-white">
                  +{hiddenCount}
                </Text>
              </View>
            ) : null}
          </View>
        );
      })}
    </View>
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
          className="text-[16px] font-semibold leading-5"
          style={{ color: labelColor }}
        >
          {item.label}
        </Text>
        {item.description ? (
          <Text
            className="mt-0.5 text-[13px] leading-[17px]"
            style={{ color: descriptionColor }}
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
  pageGutter,
  profileAvatar,
  profileName,
  profileUsername,
}: {
  post: ProfilePost;
  isLast: boolean;
  pageGutter: number;
  profileAvatar: string | null;
  profileName: string;
  profileUsername: string;
}) {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const [isPostMenuVisible, setIsPostMenuVisible] = useState(false);
  const authorName =
    post.displayName.trim() || profileName.trim() || fallbackPostAuthorName;
  const authorUsername = post.username.trim() || profileUsername.trim();
  const postContent = post.text.trim() || "Chuyến đi hôm nay rất đáng nhớ.";
  const postMediaSources = resolvePostMediaUris(post);
  const visibilityIcon = getPostVisibilityIcon(post.visibility);
  const visibilityLabel = getPostVisibilityLabel(post.visibility);
  const statusLabel = getProfilePostStatusLabel(post.status);
  const statusTone = getProfilePostStatusTone(post.status);
  const normalizedStatus = normalizeProfilePostStatus(post.status);
  const normalizedVisibility = post.visibility.trim().toUpperCase();
  const canHighlightLikeState =
    normalizedStatus === "APPROVED" && normalizedVisibility === "PUBLIC";
  const isLiked = canHighlightLikeState && post.isLiked === true;
  const likeCount = post.likeCount ?? 0;
  const commentCount = post.commentCount ?? 0;
  const shareCount = post.shareCount ?? 0;

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
    <View className={`px-3 py-3 ${isLast ? "" : "border-b border-[#DEE3EA]"}`}>
      <View className="flex-row items-start justify-between gap-2">
        <View className="min-w-0 flex-1 flex-row items-center gap-2.5">
          <PostAuthorAvatar
            avatar={profileAvatar}
            name={authorName}
            username={authorUsername}
          />

          <View className="min-w-0 flex-1 gap-0">
            <Text
              className="text-[17px] font-extrabold leading-5 text-[#202124]"
              numberOfLines={1}
            >
              {authorName}
            </Text>

            <View className="flex-row flex-wrap items-center gap-1.5">
              <Text className="text-[12px] leading-[14px] text-[#6B7280]">
                {formatPostTimestamp(post.createdAt)}
              </Text>
              <Text className="text-[12px] text-[#6B7280]">·</Text>
              <SymbolView name={visibilityIcon} size={11} tintColor="#6B7280" />
              <Text className="text-[12px] leading-[14px] text-[#6B7280]">
                {visibilityLabel}
              </Text>
              <View
                className="rounded-full border px-2 py-0.5"
                style={{
                  backgroundColor: statusTone.backgroundColor,
                  borderColor: statusTone.borderColor,
                }}
              >
                <Text
                  className="text-[11px] font-extrabold"
                  style={{ color: statusTone.textColor }}
                >
                  {statusLabel}
                </Text>
              </View>
            </View>
          </View>
        </View>

        <Pressable
          className="h-8 w-8 items-center justify-center rounded-full"
          onPress={() => setIsPostMenuVisible(true)}
        >
          <SymbolView
            name={{ ios: "ellipsis", android: "more_horiz", web: "more_horiz" }}
            size={18}
            tintColor="#7D7382"
          />
        </Pressable>
      </View>

      <Text
        className="text-[15px] leading-[17px] text-[#202124]"
        style={{ textAlign: "justify" }}
      >
        {postContent}
      </Text>

      <View className="mt-1" style={{ marginHorizontal: -(pageGutter + 12) }}>
        <PostMediaGallery sources={postMediaSources} />
      </View>

      <View className="mt-2 flex-row items-center gap-5">
        <PostAction
          active={isLiked}
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
          tintColor="#F43F5E"
          value={likeCount}
        />
        <PostAction
          icon={{
            ios: "bubble.left",
            android: "chat_bubble_outline",
            web: "chat_bubble_outline",
          }}
          onPress={handleOpenComments}
          value={commentCount}
        />
        <PostAction
          icon={{
            ios: "arrowshape.turn.up.right",
            android: "reply",
            web: "reply",
          }}
          value={shareCount}
        />
      </View>

      {post.reason ? (
        <Text className="mt-3 text-[12px] font-semibold text-[#C24F3B]">
          Lý do: {post.reason}
        </Text>
      ) : null}

      <PostOptionsSheet
        bottomInset={insets.bottom}
        visible={isPostMenuVisible}
        onClose={() => setIsPostMenuVisible(false)}
      />
    </View>
  );
}

function RouteCard({
  route,
  onPress,
}: {
  route: RouteItem;
  onPress: () => void;
}) {
  return (
    <Pressable
      onPress={onPress}
      className="flex-row gap-3 rounded-2xl bg-white p-2"
      style={cardShadow}
    >
      <Image
        source={route.cover}
        contentFit="cover"
        transition={180}
        cachePolicy="memory-disk"
        style={{ width: 64, height: 64, borderRadius: 12 }}
      />
      <View className="min-w-0 flex-1 justify-center">
        <Text
          className="text-[14px] font-semibold text-[#2B2233]"
          numberOfLines={1}
        >
          {route.title}
        </Text>
        <Text className="text-[11px] text-[#8E869A]">
          {route.distance} · {route.duration}
        </Text>
        <Text className="mt-0.5 text-[11px] font-extrabold text-[#F58752]">
          +{route.xp} XP
        </Text>
      </View>
    </Pressable>
  );
}

function LikedHotspotCard({
  hotspot,
  onPress,
}: {
  hotspot: HotspotDetail;
  onPress: () => void;
}) {
  return (
    <Pressable
      onPress={onPress}
      className="flex-row gap-3 rounded-2xl bg-white p-2.5"
      style={cardShadow}
    >
      <Image
        source={hotspot.imageUri}
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
            {hotspot.title}
          </Text>
          <SymbolView
            name={{ ios: "heart.fill", android: "favorite", web: "favorite" }}
            size={14}
            tintColor="#EB489B"
          />
        </View>
        <Text className="mt-0.5 text-[11px] text-[#8E869A]">
          {hotspot.category} · {hotspot.district}
        </Text>
        <Text className="mt-1 text-[11px] text-[#8E869A]">
          {hotspot.distance} · {hotspot.reviews} reviews
        </Text>
        <Text className="mt-1 text-[11px] font-extrabold text-[#F58752]">
          {hotspot.reward}
        </Text>
      </View>
    </Pressable>
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
          ? "Bạn chưa có bài viết nào đang chờ duyệt"
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
        Chưa có tuyến cộng đồng nào
      </Text>
    </View>
  );
}

function EmptyLikedHotspots() {
  return (
    <View className="items-center py-12">
      <SymbolView
        name={{
          ios: "heart",
          android: "favorite_border",
          web: "favorite_border",
        }}
        size={30}
        tintColor="#AA9FB0"
      />
      <Text className="mt-2 text-[13px] text-[#8E869A]">
        Chưa có hotspot đã thích nào
      </Text>
    </View>
  );
}
