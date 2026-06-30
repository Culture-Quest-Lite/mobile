import { Image } from "expo-image";
import { LinearGradient } from "expo-linear-gradient";
import { useLocalSearchParams, useRouter, type Href } from "expo-router";
import { StatusBar } from "expo-status-bar";
import { SymbolView } from "@/components/ui/symbol-view";
import { useMemo, useState, type ComponentProps, type ReactNode } from "react";
import { Pressable, ScrollView, Text, View } from "react-native";
import {
  SafeAreaView,
  useSafeAreaInsets,
} from "react-native-safe-area-context";

import { routes, type RouteItem } from "@/lib/demo-data";
import {
  getCommunityExplorerProfileById,
  getCommunityPostsByAuthorId,
  type CommunityExplorerProfile,
  type CommunityPost,
} from "../data/community-demo";

type SymbolName = ComponentProps<typeof SymbolView>["name"];
type ProfileTabKey = "posts" | "routes" | "badges";

const PROFILE_TABS: readonly { key: ProfileTabKey; label: string }[] = [
  { key: "posts", label: "Bài viết" },
  { key: "routes", label: "Tuyến đường" },
  { key: "badges", label: "Thành tựu" },
] as const;

const gradientColors = ["#EB489B", "#F58752", "#FFC93C"] as const;
const shellGradientColors = ["#FFF5FB", "#FFF7F0", "#FFFFFF"] as const;

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

const avatarGlowStyle = {
  shadowColor: "rgba(235, 72, 155, 0.24)",
  shadowOpacity: 1,
  shadowRadius: 22,
  shadowOffset: {
    width: 0,
    height: 10,
  },
  elevation: 12,
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

const statsPanelShadowStyle = {
  shadowColor: "rgba(245, 135, 82, 0.10)",
  shadowOpacity: 1,
  shadowRadius: 22,
  shadowOffset: {
    width: 0,
    height: 10,
  },
  elevation: 8,
} as const;

const badgeGradients = [
  ["#EB489B", "#F58752"],
  ["#4F7AF0", "#6D96FF"],
  ["#F3BE3A", "#D89A08"],
] as const;

export default function CommunityExplorerProfileScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { id } = useLocalSearchParams<{ id?: string | string[] }>();
  const [activeTab, setActiveTab] = useState<ProfileTabKey>("posts");

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

  if (!profile) {
    return (
      <SafeAreaView className="flex-1 bg-[#FFF8F5]" edges={["top"]}>
        <StatusBar style="dark" />
        <View className="flex-1 items-center justify-center px-5">
          <View
            className="w-full max-w-[360px] rounded-[30px] border border-[#F3DDD5] bg-white px-6 py-7"
            style={cardShadowStyle}
          >
            <Text className="text-center text-[21px] font-black text-[#2F2337]">
              Không tìm thấy explorer
            </Text>
            <Text className="mt-2 text-center text-[14px] leading-6 text-[#8E869A]">
              Hồ sơ cộng đồng này không còn khả dụng hoặc dữ liệu demo chưa được
              tạo.
            </Text>
            <Pressable
              onPress={() => router.replace("/bookings")}
              className="mt-5 overflow-hidden rounded-[18px]"
              style={pillShadowStyle}
            >
              <LinearGradient
                colors={gradientColors}
                start={{ x: 0, y: 0.5 }}
                end={{ x: 1, y: 0.5 }}
                className="items-center py-3.5"
              >
                <Text className="text-[15px] font-black text-white">
                  Quay lại cộng đồng
                </Text>
              </LinearGradient>
            </Pressable>
          </View>
        </View>
      </SafeAreaView>
    );
  }

  const shortBio = truncateText(profile.bio, 140);
  const profileMetaItems = getProfileMetaItems(profile);

  return (
    <SafeAreaView className="flex-1 bg-[#FFF8F5]" edges={["left", "right"]}>
      <StatusBar style="light" />

      <View className="absolute inset-0 bg-[#FFF8F5]" />
      <LinearGradient
        colors={shellGradientColors}
        start={{ x: 0.08, y: 0 }}
        end={{ x: 1, y: 1 }}
        style={{ position: "absolute", inset: 0 }}
      />
      <View
        className="absolute -left-12 top-14 h-44 w-44 rounded-full"
        style={{ backgroundColor: "rgba(235, 72, 155, 0.09)" }}
      />
      <View
        className="absolute right-[-26px] top-28 h-36 w-36 rounded-full"
        style={{ backgroundColor: "rgba(245, 135, 82, 0.08)" }}
      />

      <ScrollView
        className="flex-1"
        contentContainerStyle={{ paddingBottom: 36 }}
        showsVerticalScrollIndicator={false}
      >
        <View className="relative">
          <View className="h-[336px] overflow-hidden rounded-t-[28px]">
            <Image
              source={profile.cover}
              contentFit="cover"
              transition={180}
              cachePolicy="memory-disk"
              style={{ width: "100%", height: "100%" }}
            />

            <LinearGradient
              colors={[
                "rgba(47, 35, 55, 0.28)",
                "rgba(47, 35, 55, 0.12)",
                "rgba(47, 35, 55, 0.56)",
              ]}
              locations={[0, 0.46, 1]}
              style={{ position: "absolute", inset: 0 }}
            />

            <View
              className="absolute left-4 right-4 flex-row items-center justify-between"
              style={{ top: insets.top + 8 }}
            >
              <OverlayIconButton
                icon={{
                  ios: "chevron.left",
                  android: "arrow_back",
                  web: "arrow_back",
                }}
                onPress={() => router.replace("/bookings")}
              />
              <OverlayIconButton
                icon={{
                  ios: "ellipsis",
                  android: "more_horiz",
                  web: "more_horiz",
                }}
              />
            </View>
          </View>

          <View
            className="absolute bottom-[-60px] left-0 right-0 items-center"
            style={{ zIndex: 2 }}
          >
            <ProfileAvatar profile={profile} />
          </View>
        </View>

        <View
          className="-mt-8 w-full rounded-t-[34px] bg-white px-5 pb-8 pt-24"
          style={cardShadowStyle}
        >
          <View className="items-center">
            <Text className="text-center text-[31px] font-black tracking-[-1px] text-[#2F2337]">
              {profile.name}
            </Text>
            {profile.isPremium ? (
              <View className="mt-3">
                <PremiumBadge
                  label="Premium"
                  icon={{
                    ios: "crown.fill",
                    android: "workspace_premium",
                    web: "workspace_premium",
                  }}
                />
              </View>
            ) : null}
            <Text className="mt-3 text-[17px] font-black text-[#F06297]">
              {profile.username}
            </Text>
            <View className="mt-3 flex-row flex-wrap items-center justify-center gap-2">
              {profileMetaItems.map((item) => (
                <ProfileMetaChip key={`${profile.id}-${item}`} label={item} />
              ))}
            </View>
            <Text className="mt-3 max-w-[320px] text-center text-[15px] leading-6 text-[#5A4C63]">
              {shortBio}
            </Text>
          </View>

          <View className="mt-7 gap-6">
            <View>
              <StatsSectionHeader
                title="Thống kê xã hội"
                icon={{
                  ios: "person.2.fill",
                  android: "group",
                  web: "group",
                }}
              />
              <StatsPanel>
                <View className="flex-row items-start justify-between">
                  <StatIconMetric
                    label="Bài viết"
                    value={posts.length.toString()}
                    icon={{
                      ios: "doc.text.image.fill",
                      android: "feed",
                      web: "feed",
                    }}
                  />
                  <StatIconMetric
                    label="Đang theo dõi"
                    value={formatCompactValue(profile.following)}
                    icon={{
                      ios: "person.2.fill",
                      android: "group",
                      web: "group",
                    }}
                    withDivider
                  />
                  <StatIconMetric
                    label="Người theo dõi"
                    value={formatCompactValue(profile.followers)}
                    icon={{
                      ios: "person.crop.circle.badge.plus",
                      android: "person_add",
                      web: "person_add",
                    }}
                    withDivider
                  />
                </View>
              </StatsPanel>
            </View>

            <View>
              <StatsSectionHeader
                title="Thống kê khám phá"
                icon={{
                  ios: "mappin.and.ellipse",
                  android: "location_on",
                  web: "location_on",
                }}
              />
              <StatsPanel>
                <View className="flex-row items-start justify-between">
                  <StatIconMetric
                    compact
                    label="Check-ins"
                    value={formatCompactValue(profile.checkIns)}
                    icon={{
                      ios: "mappin.and.ellipse",
                      android: "location_on",
                      web: "location_on",
                    }}
                  />
                  <StatIconMetric
                    compact
                    label="Tuyến"
                    value={profile.routesCompleted.toString()}
                    icon={{
                      ios: "map.fill",
                      android: "route",
                      web: "route",
                    }}
                    backgroundColor="#FFF5E7"
                    iconTintColor="#D69228"
                    withDivider
                  />
                  <StatIconMetric
                    compact
                    label="Huy hiệu"
                    value={profile.badgeCount.toString()}
                    icon={{
                      ios: "rosette",
                      android: "military_tech",
                      web: "military_tech",
                    }}
                    backgroundColor="#F3EAF4"
                    iconTintColor="#9A4A78"
                    withDivider
                  />
                  <StatIconMetric
                    compact
                    label="Streak"
                    value={profile.streakDays.toString()}
                    icon={{
                      ios: "flame.fill",
                      android: "local_fire_department",
                      web: "local_fire_department",
                    }}
                    withDivider
                  />
                </View>
              </StatsPanel>
            </View>

            <SectionCard>
              <SectionHeader
                title="Nội dung công khai"
                actionLabel="Chia sẻ công khai"
              />
              <View className="mt-4 flex-row rounded-[20px] bg-[#FFF3F8] p-1">
                {PROFILE_TABS.map((tab) => {
                  const selected = activeTab === tab.key;

                  return (
                    <Pressable
                      key={tab.key}
                      onPress={() => setActiveTab(tab.key)}
                      className="flex-1 overflow-hidden rounded-[16px]"
                    >
                      {selected ? (
                        <LinearGradient
                          colors={gradientColors}
                          start={{ x: 0, y: 0.5 }}
                          end={{ x: 1, y: 0.5 }}
                          className="items-center py-3"
                        >
                          <Text className="text-[13px] font-black text-white">
                            {tab.label}
                          </Text>
                        </LinearGradient>
                      ) : (
                        <View className="items-center py-3">
                          <Text className="text-[13px] font-black text-[#8E869A]">
                            {tab.label}
                          </Text>
                        </View>
                      )}
                    </Pressable>
                  );
                })}
              </View>

              <View className="mt-5">
                {activeTab === "posts" ? (
                  <PostsTabContent posts={posts} />
                ) : activeTab === "routes" ? (
                  <RoutesTabContent
                    completedRoutes={completedRoutes}
                    favoriteRoutes={favoriteRoutes}
                    onOpenRoute={(routeId) =>
                      router.push(`/route/${routeId}` as Href)
                    }
                  />
                ) : (
                  <BadgesTabContent
                    badgeCount={profile.badgeCount}
                    badges={profile.badges}
                    isPremium={profile.isPremium}
                  />
                )}
              </View>
            </SectionCard>
          </View>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

function OverlayIconButton({
  icon,
  onPress,
}: {
  icon: SymbolName;
  onPress?: () => void;
}) {
  return (
    <Pressable
      onPress={onPress}
      className="h-10 w-10 items-center justify-center rounded-full border border-white/20 bg-[#2F2337]/35"
    >
      <SymbolView name={icon} size={17} tintColor="#FFFFFF" />
    </Pressable>
  );
}

function ProfileAvatar({ profile }: { profile: CommunityExplorerProfile }) {
  return (
    <LinearGradient
      colors={gradientColors}
      start={{ x: 0, y: 0.5 }}
      end={{ x: 1, y: 0.5 }}
      style={[
        {
          alignItems: "center",
          justifyContent: "center",
          width: 120,
          height: 120,
          borderRadius: 60,
          padding: 4,
        },
        avatarGlowStyle,
      ]}
    >
      <View
        className="items-center justify-center rounded-full bg-white"
        style={{ width: 112, height: 112 }}
      >
        {profile.avatar ? (
          <Image
            source={profile.avatar}
            contentFit="cover"
            transition={180}
            cachePolicy="memory-disk"
            style={{ width: 100, height: 100, borderRadius: 50 }}
          />
        ) : (
          <LinearGradient
            colors={profile.avatarColors}
            start={{ x: 0, y: 0.5 }}
            end={{ x: 1, y: 0.5 }}
            style={{
              alignItems: "center",
              justifyContent: "center",
              width: 100,
              height: 100,
              borderRadius: 50,
            }}
          >
            <Text className="text-[28px] font-black text-white">
              {profile.initials}
            </Text>
          </LinearGradient>
        )}
      </View>
    </LinearGradient>
  );
}

function SectionCard({ children }: { children: ReactNode }) {
  return (
    <View
      className="rounded-[28px] border border-[#F2E0D7] bg-white p-4"
      style={cardShadowStyle}
    >
      {children}
    </View>
  );
}

function StatsPanel({ children }: { children: ReactNode }) {
  return (
    <View
      className="mt-3 overflow-hidden rounded-[30px] bg-white px-2 py-5"
      style={statsPanelShadowStyle}
    >
      {children}
    </View>
  );
}

function StatsSectionHeader({
  icon,
  title,
}: {
  icon: SymbolName;
  title: string;
}) {
  return (
    <View className="flex-row items-center gap-2.5">
      <View className="h-7 w-7 items-center justify-center rounded-full bg-[#FFF1F6]">
        <SymbolView name={icon} size={12} tintColor="#EB489B" />
      </View>
      <Text className="text-[12px] font-black uppercase tracking-[1px] text-[#E06294]">
        {title}
      </Text>
    </View>
  );
}

function PremiumBadge({ icon, label }: { icon: SymbolName; label: string }) {
  return (
    <LinearGradient
      colors={["#FF6EA9", "#FFC24A"]}
      start={{ x: 0, y: 0.5 }}
      end={{ x: 1, y: 0.5 }}
      className="flex-row items-center gap-1.5 rounded-full px-3.5 py-2"
      style={pillShadowStyle}
    >
      <SymbolView name={icon} size={11} tintColor="#FFFFFF" />
      <Text className="text-[12px] font-black text-white">{label}</Text>
    </LinearGradient>
  );
}

function ProfileMetaChip({ label }: { label: string }) {
  return (
    <View className="rounded-full border border-[#F7DCE7] bg-[#FFF6FB] px-3 py-1.5">
      <Text className="text-[13px] font-bold text-[#6C5A75]">{label}</Text>
    </View>
  );
}

function TagChip({ label }: { label: string }) {
  return (
    <View className="rounded-full border border-[#F3DCE7] bg-[#FFF7FA] px-3 py-2">
      <Text className="text-[12px] font-semibold text-[#7B7182]">{label}</Text>
    </View>
  );
}

function StatIconMetric({
  backgroundColor = "#FFF1F6",
  compact = false,
  icon,
  iconTintColor = "#EB489B",
  label,
  value,
  withDivider = false,
}: {
  backgroundColor?: string;
  compact?: boolean;
  icon: SymbolName;
  iconTintColor?: string;
  label: string;
  value: string;
  withDivider?: boolean;
}) {
  return (
    <View
      className={`flex-1 items-center px-1.5 ${
        withDivider ? "border-l border-[#F3E6DF]" : ""
      }`}
    >
      <View
        className={`items-center justify-center rounded-full bg-[#FFF1F6] ${
          compact ? "h-10 w-10" : "h-11 w-11"
        }`}
        style={{ backgroundColor }}
      >
        <SymbolView
          name={icon}
          size={compact ? 14 : 15}
          tintColor={iconTintColor}
        />
      </View>
      <Text
        className={`mt-3 font-black text-[#2F2337] ${
          compact ? "text-[17px]" : "text-[19px]"
        }`}
      >
        {value}
      </Text>
      <Text
        className={`mt-1 text-center font-medium text-[#73657B] ${
          compact ? "text-[11px]" : "text-[12px]"
        }`}
      >
        {label}
      </Text>
    </View>
  );
}

function PostsTabContent({ posts }: { posts: CommunityPost[] }) {
  if (!posts.length) {
    return (
      <EmptyContent message="Explorer này chưa có bài viết công khai nào." />
    );
  }

  return (
    <View className="gap-4">
      {posts.map((post, index) => (
        <PublicPostCard key={post.id} post={post} index={index} />
      ))}
    </View>
  );
}

function PublicPostCard({
  index,
  post,
}: {
  index: number;
  post: CommunityPost;
}) {
  const postType = getPostTypeLabel(post, index);

  return (
    <View
      className="overflow-hidden rounded-[28px] border border-[#F2E0D7] bg-white"
      style={cardShadowStyle}
    >
      <Image
        source={post.image}
        contentFit="cover"
        transition={180}
        cachePolicy="memory-disk"
        style={{ width: "100%", height: 188 }}
      />

      <View className="p-4">
        <View className="flex-row items-center justify-between gap-3">
          <View className="rounded-full bg-[#FFF2F8] px-3 py-2">
            <Text className="text-[12px] font-black text-[#D55E8E]">
              {postType}
            </Text>
          </View>
          <Text className="text-[12px] font-medium text-[#A095A6]">
            {post.time}
          </Text>
        </View>

        <Text className="mt-3 text-[17px] font-black text-[#2F2337]">
          {post.location}
        </Text>
        <Text className="mt-1 text-[14px] leading-6 text-[#5E5168]">
          {post.caption}
        </Text>

        <View className="mt-3 flex-row flex-wrap gap-2">
          {post.tags.map((tag) => (
            <TagChip key={`${post.id}-${tag}`} label={tag} />
          ))}
        </View>

        <View className="mt-4 flex-row items-center justify-between">
          <InlineMetric
            icon={{
              ios: "heart.fill",
              android: "favorite",
              web: "favorite",
            }}
            value={post.likes}
          />
          <InlineMetric
            icon={{
              ios: "bubble.left.fill",
              android: "chat",
              web: "chat",
            }}
            value={post.comments}
          />
          <InlineMetric
            icon={{
              ios: "arrowshape.turn.up.right.fill",
              android: "ios_share",
              web: "ios_share",
            }}
            value={post.shares}
          />
        </View>
      </View>
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
      <EmptyContent message="Explorer này chưa chia sẻ route công khai nào." />
    );
  }

  return (
    <View className="gap-5">
      <RouteCollectionSection
        title="Route đã hoàn thành"
        actionLabel={`${completedRoutes.length} route`}
        routes={completedRoutes}
        emptyMessage="Chưa có route hoàn thành được chia sẻ công khai."
        statusLabel="Hoàn thành"
        statusIcon={{
          ios: "checkmark.circle.fill",
          android: "task_alt",
          web: "task_alt",
        }}
        onOpenRoute={onOpenRoute}
      />
      <RouteCollectionSection
        title="Route yêu thích"
        actionLabel={`${favoriteRoutes.length} route`}
        routes={favoriteRoutes}
        emptyMessage="Chưa có route yêu thích được đánh dấu công khai."
        statusLabel="Yêu thích"
        statusIcon={{
          ios: "star.fill",
          android: "star",
          web: "star",
        }}
        onOpenRoute={onOpenRoute}
      />
    </View>
  );
}

function RouteCollectionSection({
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
      <SectionHeader title={title} actionLabel={actionLabel} />
      {routes.length ? (
        <View className="mt-4 gap-3">
          {routes.map((route) => (
            <PublicRouteCard
              key={`${title}-${route.id}`}
              onPress={() => onOpenRoute(route.id)}
              route={route}
              statusIcon={statusIcon}
              statusLabel={statusLabel}
            />
          ))}
        </View>
      ) : (
        <View className="mt-4">
          <EmptyContent message={emptyMessage} />
        </View>
      )}
    </View>
  );
}

function PublicRouteCard({
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
      className="flex-row overflow-hidden rounded-[28px] border border-[#F2E0D7] bg-white"
      style={cardShadowStyle}
    >
      <Image
        source={route.cover}
        contentFit="cover"
        transition={180}
        cachePolicy="memory-disk"
        style={{ width: 104, height: 124 }}
      />

      <View className="min-w-0 flex-1 px-4 py-3.5">
        <View className="flex-row items-start justify-between gap-2">
          <Text
            className="min-w-0 flex-1 text-[15px] font-black text-[#2F2337]"
            numberOfLines={1}
          >
            {route.title}
          </Text>
          <View className="flex-row items-center gap-1 rounded-full bg-[#FFF2F8] px-2.5 py-1.5">
            <SymbolView name={statusIcon} size={11} tintColor="#D55E8E" />
            <Text className="text-[11px] font-black text-[#D55E8E]">
              {statusLabel}
            </Text>
          </View>
        </View>

        <Text
          className="mt-1 text-[12px] leading-5 text-[#7B7182]"
          numberOfLines={2}
        >
          {route.subtitle}
        </Text>

        <View className="mt-3 flex-row flex-wrap items-center gap-3">
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
    return <EmptyContent message="Explorer này chưa công khai badge nào." />;
  }

  return (
    <View>
      <LinearGradient
        colors={gradientColors}
        start={{ x: 0, y: 0.5 }}
        end={{ x: 1, y: 0.5 }}
        className="rounded-[28px] px-4 py-4"
        style={pillShadowStyle}
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

function SectionHeader({
  actionLabel,
  title,
}: {
  actionLabel: string;
  title: string;
}) {
  return (
    <View className="flex-row items-center justify-between">
      <Text className="text-[22px] font-black tracking-[-0.4px] text-[#2F2337]">
        {title}
      </Text>
      <Text className="text-[13px] font-semibold text-[#8E869A]">
        {actionLabel}
      </Text>
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
        style={cardShadowStyle}
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

function RouteMeta({ icon, value }: { icon: SymbolName; value: string }) {
  return (
    <View className="flex-row items-center gap-1.5">
      <SymbolView name={icon} size={12} tintColor="#EB489B" />
      <Text className="text-[12px] font-semibold text-[#5E5168]">{value}</Text>
    </View>
  );
}

function InlineMetric({ icon, value }: { icon: SymbolName; value: string }) {
  return (
    <View className="flex-row items-center gap-1.5">
      <SymbolView name={icon} size={12} tintColor="#EB489B" />
      <Text className="text-[12px] font-semibold text-[#5E5168]">{value}</Text>
    </View>
  );
}

function EmptyContent({ message }: { message: string }) {
  return (
    <View
      className="rounded-[28px] border border-[#F2E0D7] bg-white px-4 py-6"
      style={cardShadowStyle}
    >
      <Text className="text-center text-[14px] leading-6 text-[#6D6276]">
        {message}
      </Text>
    </View>
  );
}

function getPostTypeLabel(post: CommunityPost, index: number): string {
  const typeByTopic: Record<CommunityPost["topic"], string> = {
    culture: "Ảnh hành trình",
    art: "Review địa điểm",
    cuisine: "Chia sẻ trải nghiệm",
    history: "Chia sẻ trải nghiệm",
  };

  return (
    typeByTopic[post.topic] ??
    ["Ảnh hành trình", "Review địa điểm", "Chia sẻ trải nghiệm"][index % 3]
  );
}

function formatCompactValue(value: number): string {
  if (value >= 1000) {
    return `${Math.round(value / 100) / 10}K`;
  }

  return value.toString();
}

function truncateText(value: string, maxLength: number): string {
  if (value.length <= maxLength) {
    return value;
  }

  return `${value.slice(0, maxLength - 1).trimEnd()}…`;
}

function getProfileMetaItems(profile: CommunityExplorerProfile): string[] {
  const normalizedRole = profile.role.replace(/\s*level\s*\d+/i, "").trim();

  return [normalizedRole, `Level ${profile.level}`, profile.city].filter(Boolean);
}
