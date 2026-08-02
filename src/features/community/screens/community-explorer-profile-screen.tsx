import { SymbolView } from "@/components/ui/symbol-view";
import { UserAvatar } from "@/components/ui/user-avatar";
import {
  getValidAccessToken,
  useAuthSession,
} from "@/features/auth/hooks/use-auth-session";
import {
  followUser,
  unfollowUser,
} from "@/features/community/api/toggle-user-follow";
import { getUserProfilePosts } from "@/features/profile/api/get-profile-posts";
import { getUserProfileById } from "@/features/profile/api/get-user-by-id";
import type { Profile, ProfilePost } from "@/features/profile/types";
import { useScreenLayout } from "@/hooks/use-screen-layout";
import { routes, type RouteItem } from "@/lib/demo-data";
import { Image } from "expo-image";
import { LinearGradient } from "expo-linear-gradient";
import { useLocalSearchParams, useRouter, type Href } from "expo-router";
import { StatusBar } from "expo-status-bar";
import { useEffect, useMemo, useState, type ComponentProps } from "react";
import {
  ActivityIndicator,
  Alert,
  Pressable,
  ScrollView,
  Text,
  View,
} from "react-native";
import {
  SafeAreaView,
  useSafeAreaInsets,
} from "react-native-safe-area-context";

import {
  getCommunityExplorerProfileById,
  getCommunityPostsByAuthorId,
  type CommunityExplorerProfile,
} from "../data/community-demo";
import { getCachedCommunityExplorerProfile } from "../data/community-explorer-profile-cache";
import type { CommunityFeedPost } from "../data/community-post-cache";

type SymbolName = ComponentProps<typeof SymbolView>["name"];
type ProfileTabKey = "posts" | "routes" | "shared";
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
  {
    key: "shared",
    label: "Chia sẻ",
    icon: { ios: "arrowshape.turn.up.right", android: "reply", web: "reply" },
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
const avatarPalettes = [
  ["#EB489B", "#F58752"],
  ["#F58752", "#FFC93C"],
  ["#4F46E5", "#38BDF8"],
  ["#10B981", "#2DD4BF"],
  ["#9333EA", "#EC4899"],
] as const;
const meaninglessTextValues = new Set(["", "string", "null", "undefined"]);

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

function formatCountLabel(value?: number | null) {
  const resolvedValue =
    typeof value === "number" && Number.isFinite(value)
      ? Math.max(0, Math.round(value))
      : 0;

  return formatCompactValue(resolvedValue);
}

function hasSharedProfilePost(post: ProfilePost) {
  return Boolean(readMeaningfulText(post.sharedPost));
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
  const sharedText = readMeaningfulText(post.sharedPost);
  const caption =
    readMeaningfulText(post.text) ?? sharedText ?? "Bài viết mới từ cộng đồng.";

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
    badge: sharedText ? "Chia sẻ" : "",
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
    sharedText,
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
          getUserProfilePosts({
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
            posts: nextPostsResult.value,
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
  const posts = useMemo(
    () =>
      explorerId
        ? demoProfile
          ? getCommunityPostsByAuthorId(explorerId)
          : usesApiProfileLayout
            ? (remotePosts ?? [])
                .filter((post) => !hasSharedProfilePost(post))
                .map(mapProfilePostToCommunityFeedPost)
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
  const sharedPosts = useMemo(
    () =>
      usesApiProfileLayout
        ? (remotePosts ?? [])
            .filter(hasSharedProfilePost)
            .map(mapProfilePostToCommunityFeedPost)
        : [],
    [remotePosts, usesApiProfileLayout],
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
  const initialIsFollowing = useMemo(
    () => posts.some((post) => post.isFollowing),
    [posts],
  );
  const [activeTab, setActiveTab] = useState<ProfileTabKey>("posts");
  const [followOverrides, setFollowOverrides] = useState<
    Record<string, boolean>
  >({});
  const [isFollowRequestPending, setIsFollowRequestPending] = useState(false);

  if (!profile && isRemoteProfileLoading) {
    return (
      <SafeAreaView className="flex-1 items-center justify-center bg-[#F7F8FC] px-6">
        <StatusBar style="dark" />
        <ActivityIndicator color="#F58752" size="large" />
      </SafeAreaView>
    );
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
  const canCallFollowApi = Number.isFinite(numericExplorerId);
  const isFollowingProfile = explorerId
    ? (followOverrides[explorerId] ?? initialIsFollowing)
    : initialIsFollowing;
  const followerCount =
    isFollowingProfile === initialIsFollowing
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
      if (isFollowingProfile) {
        await unfollowUser({
          accessToken,
          tokenType: authSession.tokenType,
          userId: numericExplorerId,
        });
      } else {
        await followUser({
          accessToken,
          tokenType: authSession.tokenType,
          userId: numericExplorerId,
        });
      }

      setFollowOverrides((current) => ({
        ...current,
        [explorerId]: !isFollowingProfile,
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
        contentContainerStyle={{ paddingBottom: 28 }}
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
              const shouldShowLabel = tab.key !== "shared";

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
                  {shouldShowLabel ? (
                    <Text
                      className={`text-[11px] font-bold ${
                        selected ? "text-[#F58752]" : "text-[#AA9FB0]"
                      }`}
                    >
                      {tab.label}
                    </Text>
                  ) : null}
                </Pressable>
              );
            })}
          </View>

          <View className="mt-3">
            {resolvedActiveTab === "posts" ? (
              <PostsTabContent
                emptyMessage="Explorer này chưa có bài viết công khai nào."
                errorMessage={usesApiProfileLayout ? remotePostsError : null}
                pageGutter={gutter}
                posts={posts}
                profile={profile}
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
            ) : (
              <PostsTabContent
                emptyMessage="Explorer này chưa có bài viết chia sẻ nào."
                errorMessage={usesApiProfileLayout ? remotePostsError : null}
                pageGutter={gutter}
                posts={sharedPosts}
                profile={profile}
              />
            )}
          </View>
        </View>
      </ScrollView>
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
  pageGutter,
  posts,
  profile,
}: {
  emptyMessage: string;
  errorMessage?: string | null;
  pageGutter: number;
  posts: CommunityFeedPost[];
  profile: CommunityExplorerProfile;
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
      {posts.map((post, index) => (
        <CommunityPostCard
          key={post.id}
          isLast={index === posts.length - 1}
          pageGutter={pageGutter}
          post={post}
          profile={profile}
        />
      ))}
    </View>
  );
}

function CommunityPostCard({
  isLast,
  pageGutter,
  post,
  profile,
}: {
  isLast: boolean;
  pageGutter: number;
  post: CommunityFeedPost;
  profile: CommunityExplorerProfile;
}) {
  const mediaSource = post.image ?? null;
  const badgeLabel = readMeaningfulText(post.badge);
  const locationLabel = readMeaningfulText(post.location);
  const moodLabel = readMeaningfulText(post.mood);
  const sharedText = readMeaningfulText(post.sharedText);

  return (
    <View className={`px-3 py-2.5 ${isLast ? "" : "border-b border-[#DEE3EA]"}`}>
      <View className="flex-row items-start justify-between gap-2">
        <View className="min-w-0 flex-1 flex-row items-center gap-2.5">
          <CommunityPostAuthorAvatar
            avatar={profile.avatar}
            avatarColors={profile.avatarColors}
            initials={getProfileInitials(profile.name, profile.username)}
          />

          <View className="min-w-0 flex-1 gap-0.5">
            <Text
              className="text-[17px] font-extrabold leading-5 text-[#202124]"
              numberOfLines={1}
            >
              {profile.name}
            </Text>

            <View className="flex-row items-center gap-1">
              <Text className="text-[12px] leading-[14px] text-[#6B7280]">
                {post.time}
              </Text>
              {locationLabel ? (
                <>
                  <Text className="text-[12px] text-[#6B7280]">·</Text>
                  <Text
                    className="min-w-0 flex-1 text-[12px] leading-[14px] text-[#6B7280]"
                    numberOfLines={1}
                  >
                    {locationLabel}
                  </Text>
                </>
              ) : null}
            </View>
          </View>
        </View>

        {badgeLabel ? (
          <View className="rounded-full bg-[#FFF3F8] px-2.5 py-1">
            <Text className="text-[11px] font-extrabold text-[#D55E8E]">
              {badgeLabel}
            </Text>
          </View>
        ) : null}
      </View>

      <Text className="mt-2 text-[15px] leading-[20px] text-[#202124]">
        {post.caption}
      </Text>

      {sharedText && sharedText !== post.caption ? (
        <View className="mt-2 rounded-[18px] border border-[#E5E7EB] bg-[#FCFCFD] px-3 py-2.5">
          <Text className="text-[11px] font-extrabold uppercase tracking-[0.6px] text-[#8E869A]">
            Bài viết chia sẻ
          </Text>
          <Text className="mt-0.5 text-[13px] leading-[18px] text-[#4B5563]">
            {sharedText}
          </Text>
        </View>
      ) : null}

      {moodLabel ? (
        <Text className="mt-1.5 text-[12px] font-semibold text-[#F58752]">
          {moodLabel}
        </Text>
      ) : null}

      {post.tags.length ? (
        <View className="mt-1.5 flex-row flex-wrap gap-1.5">
          {post.tags.map((tag) => (
            <PostTag key={`${post.id}-${tag}`} label={tag} />
          ))}
        </View>
      ) : null}

      {mediaSource ? (
        <View className="mt-2" style={{ marginHorizontal: -(pageGutter + 12) }}>
          <Image
            source={mediaSource}
            contentFit="cover"
            transition={180}
            cachePolicy="memory-disk"
            style={{
              aspectRatio: 1.08,
              width: "100%",
            }}
          />
        </View>
      ) : null}

      <View className="mt-2.5 flex-row items-center gap-4">
        <PostAction
          icon={{ ios: "heart.fill", android: "favorite", web: "favorite" }}
          tintColor="#F43F5E"
          value={post.likes}
        />
        <PostAction
          icon={{
            ios: "bubble.left",
            android: "chat_bubble_outline",
            web: "chat_bubble_outline",
          }}
          value={post.comments}
        />
        <PostAction
          icon={{
            ios: "arrowshape.turn.up.right",
            android: "reply",
            web: "reply",
          }}
          value={post.shares}
        />
      </View>
    </View>
  );
}

function CommunityPostAuthorAvatar({
  avatar,
  initials,
}: {
  avatar?: string;
  avatarColors: readonly [string, string];
  initials: string;
}) {
  return <UserAvatar displayName={initials} size={44} uri={avatar} />;
}

function PostTag({ label }: { label: string }) {
  return (
    <View className="rounded-full border border-[#F4E7DF] bg-[#FFF9F6] px-3 py-1.5">
      <Text className="text-[11px] font-semibold text-[#7B7182]">{label}</Text>
    </View>
  );
}

function PostAction({
  icon,
  tintColor = "#6B7280",
  value,
}: {
  icon: SymbolName;
  tintColor?: string;
  value?: string;
}) {
  return (
    <View className="flex-row items-center gap-1.5">
      <SymbolView name={icon} size={17} tintColor={tintColor} />
      {value ? (
        <Text className="text-[14px] font-medium text-[#4B5563]">{value}</Text>
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
