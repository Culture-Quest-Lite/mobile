import { SymbolView } from "@/components/ui/symbol-view";
import { useScreenLayout } from "@/hooks/use-screen-layout";
import { routes, type RouteItem } from "@/lib/demo-data";
import { Image } from "expo-image";
import { LinearGradient } from "expo-linear-gradient";
import { type Href, useLocalSearchParams, useRouter } from "expo-router";
import { StatusBar } from "expo-status-bar";
import { useMemo, useState, type ComponentProps } from "react";
import { Pressable, ScrollView, Text, View } from "react-native";
import {
  SafeAreaView,
  useSafeAreaInsets,
} from "react-native-safe-area-context";

import {
  getCommunityExplorerProfileById,
  getCommunityPostsByAuthorId,
  type CommunityExplorerProfile,
  type CommunityPost,
} from "../data/community-demo";

type SymbolName = ComponentProps<typeof SymbolView>["name"];
type ProfileTabKey = "posts" | "routes" | "badges";

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
    key: "badges",
    label: "Thành tựu",
    icon: { ios: "rosette", android: "military_tech", web: "military_tech" },
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
const badgeGradients = [
  ["#EB489B", "#F58752"],
  ["#4F7AF0", "#6D96FF"],
  ["#F3BE3A", "#D89A08"],
] as const;

export default function CommunityExplorerProfileScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { gutter, safeWidth } = useScreenLayout({ maxContentWidth: 640 });
  const { id } = useLocalSearchParams<{ id?: string | string[] }>();

  const explorerId = Array.isArray(id) ? id[0] : id;
  const profile = useMemo(
    () =>
      explorerId ? getCommunityExplorerProfileById(explorerId) : undefined,
    [explorerId],
  );
  const posts = useMemo(
    () => (explorerId ? getCommunityPostsByAuthorId(explorerId) : []),
    [explorerId],
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

  if (!profile) {
    return (
      <SafeAreaView className="flex-1 items-center justify-center bg-[#F7F8FC] px-6">
        <StatusBar style="dark" />
        <Text className="text-center text-[18px] font-extrabold text-[#2B2233]">
          Không tìm thấy explorer
        </Text>
        <Text className="mt-2 text-center text-[14px] leading-5 text-[#8E869A]">
          Hồ sơ cộng đồng này không còn khả dụng hoặc dữ liệu demo chưa được tạo.
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
  const isFollowingProfile = explorerId
    ? (followOverrides[explorerId] ?? initialIsFollowing)
    : initialIsFollowing;
  const socialStats = [
    { label: "Đang theo dõi", value: profile.following },
    { label: "Follower", value: profile.followers },
    { label: "Check-ins", value: profile.checkIns },
  ];

  return (
    <SafeAreaView className="flex-1 bg-[#F7F8FC]" edges={["left", "right"]}>
      <StatusBar style="light" />

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
                  isFollowingProfile ? "Bỏ theo dõi explorer" : "Theo dõi explorer"
                }
                className={`min-w-[128px] rounded-full px-5 py-2.5 ${
                  isFollowingProfile
                    ? "bg-[#EDEFF4]"
                    : "bg-[#FF4D73]"
                }`}
                onPress={() => {
                  if (!explorerId) {
                    return;
                  }

                  setFollowOverrides((current) => ({
                    ...current,
                    [explorerId]:
                      !(current[explorerId] ?? initialIsFollowing),
                  }));
                }}
                style={cardShadow}
              >
                <Text
                  className={`text-center text-[14px] font-extrabold ${
                    isFollowingProfile ? "text-[#2B2233]" : "text-white"
                  }`}
                >
                  {isFollowingProfile ? "Đang theo dõi" : "Follow"}
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

          <View className="mt-2.5 gap-2.5">
            <PersonalInfoCard profile={profile} />
            <AchievementCard profile={profile} />
          </View>

          <View className="mt-3 flex-row border-y border-[#E9EAF0] bg-white">
            {PROFILE_TABS.map((tab) => {
              const selected = activeTab === tab.key;

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

          <View className="mt-4">
            {activeTab === "posts" ? (
              <PostsTabContent
                pageGutter={gutter}
                posts={posts}
                profile={profile}
              />
            ) : activeTab === "routes" ? (
              <RoutesTabContent
                completedRoutes={completedRoutes}
                favoriteRoutes={favoriteRoutes}
                onOpenRoute={(routeId) => router.push(`/route/${routeId}` as Href)}
              />
            ) : (
              <BadgesTabContent
                badgeCount={profile.badgeCount}
                badges={profile.badges}
                isPremium={profile.isPremium}
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
  avatarColors,
  initials,
  size,
}: {
  avatar?: string;
  avatarColors: readonly [string, string];
  initials: string;
  size: number;
}) {
  const [hasError, setHasError] = useState(!avatar);

  return (
    <View className="relative">
      <View
        className="overflow-hidden rounded-full"
        style={{
          width: size,
          height: size,
          borderRadius: size / 2,
          shadowColor: "rgba(32, 71, 107, 0.16)",
          shadowOpacity: 1,
          shadowRadius: 14,
          shadowOffset: { width: 0, height: 6 },
          elevation: 8,
        }}
      >
        {hasError || !avatar ? (
          <LinearGradient
            colors={avatarColors}
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
            style={{ width: "100%", height: "100%" }}
          />
        )}
      </View>
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
  profile,
}: {
  profile: CommunityExplorerProfile;
}) {
  const introText = profile.bio.trim() || profile.headline.trim();

  return (
    <View className="rounded-[24px] bg-white px-4 py-4" style={cardShadow}>
      <View className="flex-row items-center justify-between">
        <Text className="text-[17px] font-extrabold text-[#202124]">
          Thông tin cá nhân
        </Text>
        <Pressable
          accessibilityLabel="Chỉnh sửa thông tin cá nhân"
          className="h-7 w-7 items-center justify-center rounded-full bg-[#F8F8FA]"
        >
          <SymbolView
            name={{ ios: "pencil", android: "edit", web: "edit" }}
            size={13}
            tintColor="#7D7382"
          />
        </Pressable>
      </View>

      <View className="mt-3 gap-3">
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

function AchievementCard({
  profile,
}: {
  profile: CommunityExplorerProfile;
}) {
  const achievementItems = [
    {
      label: "Level",
      value: profile.level.toString(),
      iconTintColor: "#F58752",
      icon: {
        ios: "sparkles",
        android: "auto_awesome",
        web: "auto_awesome",
      } satisfies SymbolName,
    },
    {
      label: "Huy hiệu",
      value: profile.badgeCount.toString(),
      iconTintColor: "#EB489B",
      icon: {
        ios: "rosette",
        android: "military_tech",
        web: "military_tech",
      } satisfies SymbolName,
    },
    {
      label: "Tuyến",
      value: profile.routesCompleted.toString(),
      iconTintColor: "#4F87B2",
      icon: { ios: "map", android: "route", web: "route" } satisfies SymbolName,
    },
    {
      label: "Streak",
      value: profile.streakDays.toString(),
      iconTintColor: "#D69228",
      icon: {
        ios: "flame.fill",
        android: "local_fire_department",
        web: "local_fire_department",
      } satisfies SymbolName,
    },
  ];

  return (
    <View>
      <View className="flex-row items-center justify-between gap-2">
        <Text className="text-[11px] font-semibold uppercase tracking-[3px] text-[#8E869A]">
          Thành tựu
        </Text>
        {profile.isPremium ? (
          <View className="flex-row items-center gap-1">
            <SymbolView
              name={{
                ios: "trophy",
                android: "workspace_premium",
                web: "workspace_premium",
              }}
              size={11}
              tintColor="#B57B4B"
            />
            <Text className="text-[11px] font-semibold text-[#B57B4B]">
              Premium
            </Text>
          </View>
        ) : null}
      </View>

      <View className="mt-2.5 flex-row gap-1.5">
        {achievementItems.map((item) => (
          <AchievementMetric key={item.label} item={item} />
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
    <View className="flex-row items-center gap-2.5">
      <View
        className="h-8 w-8 items-center justify-center rounded-full"
        style={{ backgroundColor: `${accentColor}14` }}
      >
        <SymbolView name={icon} size={15} tintColor={accentColor} />
      </View>
      <Text
        className="min-w-0 flex-1 text-[13px] font-normal leading-[18px] text-[#202124]"
      >
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
    <View className="flex-row items-start gap-2.5">
      <View
        className="h-8 w-8 items-center justify-center rounded-full"
        style={{ backgroundColor: `${accentColor}14` }}
      >
        <SymbolView name={icon} size={15} tintColor={accentColor} />
      </View>
      <Text className="min-w-0 flex-1 text-[13px] font-normal leading-[18px] text-[#202124]">
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

function AchievementMetric({
  item,
}: {
  item: {
    icon: SymbolName;
    iconTintColor: string;
    label: string;
    value: string;
  };
}) {
  return (
    <View className="min-w-0 flex-1 items-center rounded-[15px] border border-[#F5EFEA] bg-white px-1.5 py-2">
      <View
        className="h-5 w-5 items-center justify-center rounded-full"
        style={{ backgroundColor: `${item.iconTintColor}12` }}
      >
        <SymbolView name={item.icon} size={10} tintColor={item.iconTintColor} />
      </View>
      <Text className="mt-1 text-[16px] font-medium text-[#2B2233]">
        {item.value}
      </Text>
      <Text className="mt-0.5 text-[8px] font-semibold uppercase tracking-[0.8px] text-[#8E869A]">
        {item.label}
      </Text>
    </View>
  );
}

function PostsTabContent({
  pageGutter,
  posts,
  profile,
}: {
  pageGutter: number;
  posts: CommunityPost[];
  profile: CommunityExplorerProfile;
}) {
  if (!posts.length) {
    return (
      <EmptyState
        icon={{ ios: "photo", android: "image", web: "image" }}
        message="Explorer này chưa có bài viết công khai nào."
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
  post: CommunityPost;
  profile: CommunityExplorerProfile;
}) {
  return (
    <View className={`px-3 py-3 ${isLast ? "" : "border-b border-[#DEE3EA]"}`}>
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
              <Text className="text-[12px] text-[#6B7280]">·</Text>
              <Text
                className="min-w-0 flex-1 text-[12px] leading-[14px] text-[#6B7280]"
                numberOfLines={1}
              >
                {post.location}
              </Text>
            </View>
          </View>
        </View>

        <View className="rounded-full bg-[#FFF3F8] px-2.5 py-1">
          <Text className="text-[11px] font-extrabold text-[#D55E8E]">
            {post.badge}
          </Text>
        </View>
      </View>

      <Text className="mt-3 text-[15px] leading-[22px] text-[#202124]">
        {post.caption}
      </Text>

      <Text className="mt-2 text-[12px] font-semibold text-[#F58752]">
        Gợi ý: {post.mood}
      </Text>

      <View className="mt-2 flex-row flex-wrap gap-2">
        {post.tags.map((tag) => (
          <PostTag key={`${post.id}-${tag}`} label={tag} />
        ))}
      </View>

      <View className="mt-3" style={{ marginHorizontal: -(pageGutter + 12) }}>
        <Image
          source={post.image}
          contentFit="cover"
          transition={180}
          cachePolicy="memory-disk"
          style={{
            aspectRatio: 1.08,
            width: "100%",
          }}
        />
      </View>

      <View className="mt-3 flex-row items-center gap-5">
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

      <View className="mt-3 flex-row flex-wrap items-center gap-3">
        <PostSupplementalMeta
          icon={{
            ios: "flame.fill",
            android: "local_fire_department",
            web: "local_fire_department",
          }}
          value={post.hotScore}
        />
        <PostSupplementalMeta
          icon={{ ios: "eye.fill", android: "visibility", web: "visibility" }}
          value={post.views}
        />
      </View>
    </View>
  );
}

function CommunityPostAuthorAvatar({
  avatar,
  avatarColors,
  initials,
}: {
  avatar?: string;
  avatarColors: readonly [string, string];
  initials: string;
}) {
  const [hasError, setHasError] = useState(!avatar);

  return (
    <View className="h-11 w-11 overflow-hidden rounded-full bg-[#F3F4F6]">
      {hasError || !avatar ? (
        <LinearGradient
          colors={avatarColors}
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

function PostSupplementalMeta({
  icon,
  value,
}: {
  icon: SymbolName;
  value: string;
}) {
  return (
    <View className="flex-row items-center gap-1.5">
      <SymbolView name={icon} size={13} tintColor="#F58752" />
      <Text className="text-[12px] font-semibold text-[#6B6173]">{value}</Text>
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
    <View className="gap-4">
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
      <View className="mb-3 flex-row items-center justify-between">
        <Text className="text-[15px] font-extrabold text-[#2B2233]">{title}</Text>
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

function BadgesTabContent({
  badgeCount,
  badges,
  isPremium = false,
}: {
  badgeCount: number;
  badges: readonly string[];
  isPremium?: boolean;
}) {
  if (!badges.length) {
    return (
      <EmptyState
        icon={{ ios: "rosette", android: "military_tech", web: "military_tech" }}
        message="Explorer này chưa công khai badge nào."
      />
    );
  }

  return (
    <View>
      <LinearGradient
        colors={["#F58752", "#EB489B"]}
        start={{ x: 0, y: 0.5 }}
        end={{ x: 1, y: 0.5 }}
        className="rounded-[28px] px-4 py-4"
        style={cardShadow}
      >
        <Text className="text-[24px] font-black text-white">
          {badgeCount} huy hiệu
        </Text>
        <Text className="mt-1 text-[13px] leading-5 text-white/88">
          Mở khoá từ check-in, route hoàn thành và hoạt động chia sẻ công khai
          {isPremium ? " trong gói Premium." : "."}
        </Text>
      </LinearGradient>

      <View className="mt-4 flex-row flex-wrap justify-between gap-y-3">
        {badges.map((badge, index) => (
          <BadgeCard
            key={`${badge}-${index}`}
            badge={badge}
            colors={badgeGradients[index % badgeGradients.length]}
            index={index}
          />
        ))}
      </View>
    </View>
  );
}

function BadgeCard({
  badge,
  colors,
  index,
}: {
  badge: string;
  colors: readonly [string, string];
  index: number;
}) {
  return (
    <View className="overflow-hidden rounded-[24px]" style={{ width: "48%" }}>
      <LinearGradient
        colors={colors}
        start={{ x: 0, y: 0.5 }}
        end={{ x: 1, y: 0.5 }}
        className="rounded-[24px] p-4"
        style={cardShadow}
      >
        <View className="h-10 w-10 items-center justify-center rounded-full bg-white/20">
          <SymbolView
            name={{
              ios: "rosette",
              android: "military_tech",
              web: "military_tech",
            }}
            size={16}
            tintColor="#FFFFFF"
          />
        </View>
        <Text className="mt-3 text-[12px] font-bold uppercase tracking-[0.4px] text-white/80">
          Badge #{index + 1}
        </Text>
        <Text className="mt-1 text-[16px] font-black leading-6 text-white">
          {badge}
        </Text>
      </LinearGradient>
    </View>
  );
}

function EmptyState({
  icon,
  message,
}: {
  icon: SymbolName;
  message: string;
}) {
  return (
    <View className="items-center rounded-2xl bg-white py-12" style={cardShadow}>
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
