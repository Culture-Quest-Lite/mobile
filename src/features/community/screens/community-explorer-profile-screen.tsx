import { Image } from "expo-image";
import { LinearGradient } from "expo-linear-gradient";
import { useLocalSearchParams, useRouter, type Href } from "expo-router";
import { StatusBar } from "expo-status-bar";
import { SymbolView } from "expo-symbols";
import { useMemo, useState, type ComponentProps } from "react";
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
type ProfileTabKey = "home" | "about" | "routes" | "likes";

const PROFILE_TABS: readonly { key: ProfileTabKey; label: string }[] = [
  { key: "home", label: "Home" },
  { key: "about", label: "About" },
  { key: "routes", label: "Route" },
  { key: "likes", label: "Likes" },
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

const interestGradients = [
  ["#EB489B", "#F58752"],
  ["#4F7AF0", "#6D96FF"],
  ["#F3BE3A", "#D89A08"],
] as const;

export default function CommunityExplorerProfileScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { id } = useLocalSearchParams<{ id?: string | string[] }>();
  const [activeTab, setActiveTab] = useState<ProfileTabKey>("home");

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
  const recommendedRoutes = useMemo<RouteItem[]>(
    () =>
      profile
        ? profile.routeIds
            .map((routeId) => routes.find((route) => route.id === routeId))
            .filter((route): route is RouteItem => Boolean(route))
        : [],
    [profile],
  );

  const featuredTags = useMemo(
    () => Array.from(new Set(posts.flatMap((post) => post.tags))).slice(0, 6),
    [posts],
  );
  const topPosts = useMemo(
    () =>
      [...posts]
        .sort(
          (left, right) =>
            parseMetricValue(right.likes) - parseMetricValue(left.likes),
        )
        .slice(0, 3),
    [posts],
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
            <Text className="text-center text-[20px] font-black text-[#2F2337]">
              Không tìm thấy explorer
            </Text>
            <Text className="mt-2 text-center text-[13px] leading-6 text-[#8E869A]">
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
                <Text className="text-[14px] font-black text-white">
                  Quay lại cộng đồng
                </Text>
              </LinearGradient>
            </Pressable>
          </View>
        </View>
      </SafeAreaView>
    );
  }

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
            <Text className="text-center text-[32px] font-black tracking-[-0.8px] text-[#2F2337]">
              {profile.name}
            </Text>
            <Text className="mt-1 text-[15px] font-bold text-[#D55E8E]">
              {profile.username}
            </Text>
            <Text className="mt-1 text-[13px] font-medium text-[#8E869A]">
              {profile.role} · {profile.city}
            </Text>
            <Text className="mt-3 text-center text-[13px] leading-6 text-[#5A4C63]">
              {profile.headline}
            </Text>
          </View>

          <View className="mt-5 flex-row items-center justify-center gap-2">
            {profile.interests.slice(0, 3).map((interest, index) => (
              <InterestChip
                key={`${profile.id}-${interest}`}
                label={interest}
                colors={interestGradients[index % interestGradients.length]}
              />
            ))}
          </View>

          <View
            className="mt-5 flex-row rounded-[28px] bg-white px-2 py-4"
            style={cardShadowStyle}
          >
            <StatColumn label="Posts" value={posts.length.toString()} />
            <StatColumn
              label="Followers"
              value={formatCompactValue(profile.followers)}
              withDivider
            />
            <StatColumn
              label="Following"
              value={formatCompactValue(profile.following)}
              withDivider
            />
          </View>

          <View className="mt-6 flex-row items-center justify-between border-b border-[#F0DEE8] pb-3">
            {PROFILE_TABS.map((tab) => {
              const selected = activeTab === tab.key;

              return (
                <Pressable
                  key={tab.key}
                  onPress={() => setActiveTab(tab.key)}
                  className="flex-1 items-center"
                >
                  <Text
                    className={`text-[12px] font-black ${
                      selected ? "text-[#2F2337]" : "text-[#9D92A4]"
                    }`}
                  >
                    {tab.label}
                  </Text>
                  <View className="mt-2 h-[3px] w-10 overflow-hidden rounded-full">
                    {selected ? (
                      <LinearGradient
                        colors={gradientColors}
                        start={{ x: 0, y: 0.5 }}
                        end={{ x: 1, y: 0.5 }}
                        style={{ width: "100%", height: "100%" }}
                      />
                    ) : (
                      <View className="h-full w-full bg-transparent" />
                    )}
                  </View>
                </Pressable>
              );
            })}
          </View>

          <View className="mt-6">
            {activeTab === "home" ? (
              <HomeTabContent posts={posts} />
            ) : activeTab === "about" ? (
              <AboutTabContent
                profile={profile}
                featuredTags={featuredTags}
                postsCount={posts.length}
              />
            ) : activeTab === "routes" ? (
              <RoutesTabContent
                routes={recommendedRoutes}
                onOpenRoute={(routeId) =>
                  router.push(`/route/${routeId}` as Href)
                }
              />
            ) : (
              <LikesTabContent posts={topPosts} />
            )}
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

function InterestChip({
  colors,
  label,
}: {
  colors: readonly [string, string];
  label: string;
}) {
  return (
    <LinearGradient
      colors={colors}
      start={{ x: 0, y: 0.5 }}
      end={{ x: 1, y: 0.5 }}
      className="rounded-full px-4 py-2"
      style={pillShadowStyle}
    >
      <Text className="text-[11px] font-black text-white">{label}</Text>
    </LinearGradient>
  );
}

function StatColumn({
  label,
  value,
  withDivider = false,
}: {
  label: string;
  value: string;
  withDivider?: boolean;
}) {
  return (
    <View
      className={`flex-1 items-center justify-center ${
        withDivider ? "border-l border-[#F0DEE8]" : ""
      }`}
    >
      <Text className="text-[22px] font-black text-[#2F2337]">{value}</Text>
      <Text className="mt-1 text-[11px] font-medium text-[#8E869A]">
        {label}
      </Text>
    </View>
  );
}

function HomeTabContent({ posts }: { posts: CommunityPost[] }) {
  if (!posts.length) {
    return (
      <EmptyContent message="Explorer này chưa có hoạt động công khai nào." />
    );
  }

  return (
    <View>
      <SectionHeader title="Recent Stories" actionLabel="See all" />
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={{ gap: 14, paddingTop: 14, paddingRight: 4 }}
      >
        {posts.map((post) => (
          <StoryPreviewCard key={post.id} post={post} />
        ))}
      </ScrollView>

      <View
        className="mt-5 rounded-[28px] border border-[#F2E0D7] bg-white p-4"
        style={cardShadowStyle}
      >
        <Text className="text-[12px] font-black uppercase tracking-[0.5px] text-[#D55E8E]">
          Spotlight
        </Text>
        <Text className="mt-2 text-[16px] font-black leading-6 text-[#2F2337]">
          {posts[0]?.location}
        </Text>
        <Text className="mt-1 text-[13px] leading-6 text-[#5E5168]">
          {posts[0]?.caption}
        </Text>
      </View>
    </View>
  );
}

function AboutTabContent({
  featuredTags,
  postsCount,
  profile,
}: {
  featuredTags: string[];
  postsCount: number;
  profile: CommunityExplorerProfile;
}) {
  return (
    <View className="gap-4">
      <View
        className="rounded-[28px] border border-[#F2E0D7] bg-white p-4"
        style={cardShadowStyle}
      >
        <Text className="text-[12px] font-black uppercase tracking-[0.5px] text-[#D55E8E]">
          About Explorer
        </Text>
        <Text className="mt-2 text-[13px] leading-6 text-[#5E5168]">
          {profile.bio}
        </Text>
      </View>

      <View className="flex-row gap-3">
        <AboutMetricCard
          label="Streak"
          value={`${profile.streakDays} ngày`}
          icon={{
            ios: "flame.fill",
            android: "local_fire_department",
            web: "local_fire_department",
          }}
        />
        <AboutMetricCard
          label="Bài đăng"
          value={postsCount.toString()}
          icon={{
            ios: "doc.text.image",
            android: "feed",
            web: "feed",
          }}
        />
      </View>

      <View
        className="rounded-[28px] border border-[#F2E0D7] bg-white p-4"
        style={cardShadowStyle}
      >
        <Text className="text-[12px] font-black uppercase tracking-[0.5px] text-[#D55E8E]">
          Explorer Tags
        </Text>
        <View className="mt-3 flex-row flex-wrap gap-2">
          {featuredTags.length ? (
            featuredTags.map((tag, index) => (
              <InterestChip
                key={`${profile.id}-${tag}`}
                label={tag}
                colors={interestGradients[index % interestGradients.length]}
              />
            ))
          ) : (
            <Text className="text-[12px] text-[#8E869A]">
              Chưa có tag nổi bật.
            </Text>
          )}
        </View>
      </View>
    </View>
  );
}

function RoutesTabContent({
  onOpenRoute,
  routes,
}: {
  onOpenRoute: (routeId: string) => void;
  routes: RouteItem[];
}) {
  if (!routes.length) {
    return (
      <EmptyContent message="Explorer này chưa chia sẻ route cộng đồng nào." />
    );
  }

  return (
    <View>
      <SectionHeader
        title="Community Routes"
        actionLabel={`${routes.length}`}
      />
      <View className="mt-4 gap-3">
        {routes.map((route) => (
          <Pressable
            key={route.id}
            onPress={() => onOpenRoute(route.id)}
            className="flex-row overflow-hidden rounded-[28px] border border-[#F2E0D7] bg-white"
            style={cardShadowStyle}
          >
            <Image
              source={route.cover}
              contentFit="cover"
              transition={180}
              cachePolicy="memory-disk"
              style={{ width: 108, height: 116 }}
            />
            <View className="min-w-0 flex-1 px-4 py-3.5">
              <Text
                className="text-[14px] font-black text-[#2F2337]"
                numberOfLines={1}
              >
                {route.title}
              </Text>
              <Text
                className="mt-1 text-[11px] leading-5 text-[#7B7182]"
                numberOfLines={2}
              >
                {route.subtitle}
              </Text>
              <View className="mt-3 flex-row items-center gap-3">
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
        ))}
      </View>
    </View>
  );
}

function LikesTabContent({ posts }: { posts: CommunityPost[] }) {
  if (!posts.length) {
    return <EmptyContent message="Chưa có nội dung nổi bật theo lượt thích." />;
  }

  return (
    <View>
      <SectionHeader title="Top Highlights" actionLabel="Most liked" />
      <View className="mt-4 gap-3">
        {posts.map((post) => (
          <View
            key={post.id}
            className="rounded-[28px] border border-[#F2E0D7] bg-white p-4"
            style={cardShadowStyle}
          >
            <View className="flex-row items-center justify-between">
              <Text className="text-[12px] font-black uppercase tracking-[0.5px] text-[#D55E8E]">
                {post.badge}
              </Text>
              <View className="flex-row items-center gap-1.5">
                <SymbolView
                  name={{
                    ios: "heart.fill",
                    android: "favorite",
                    web: "favorite",
                  }}
                  size={12}
                  tintColor="#EB489B"
                />
                <Text className="text-[11px] font-bold text-[#43354C]">
                  {post.likes}
                </Text>
              </View>
            </View>
            <Text className="mt-2 text-[14px] font-black leading-6 text-[#2F2337]">
              {post.location}
            </Text>
            <Text className="mt-1 text-[12px] leading-5 text-[#5E5168]">
              {post.caption}
            </Text>
          </View>
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
      <Text className="text-[12px] font-semibold text-[#8E869A]">
        {actionLabel}
      </Text>
    </View>
  );
}

function StoryPreviewCard({ post }: { post: CommunityPost }) {
  return (
    <View
      className="w-[248px] overflow-hidden rounded-[28px] border border-[#F2E0D7] bg-white"
      style={cardShadowStyle}
    >
      <View className="relative h-[164px]">
        <Image
          source={post.image}
          contentFit="cover"
          transition={180}
          cachePolicy="memory-disk"
          style={{ width: "100%", height: "100%" }}
        />
        <LinearGradient
          colors={["rgba(47, 35, 55, 0.06)", "rgba(47, 35, 55, 0.72)"]}
          start={{ x: 0.5, y: 0 }}
          end={{ x: 0.5, y: 1 }}
          style={{ position: "absolute", inset: 0 }}
        />

        <View className="absolute left-3 right-3 top-3 flex-row items-center justify-between">
          <View className="rounded-full bg-black/35 px-2.5 py-1">
            <Text className="text-[10px] font-bold text-white">
              {post.time}
            </Text>
          </View>
          <View className="h-7 w-7 items-center justify-center rounded-full bg-[#FF6DAE]">
            <SymbolView
              name={{
                ios: "heart.fill",
                android: "favorite",
                web: "favorite",
              }}
              size={12}
              tintColor="#FFFFFF"
            />
          </View>
        </View>

        <View className="absolute bottom-3 left-3 right-3">
          <Text className="text-[13px] font-black text-white" numberOfLines={1}>
            {post.location}
          </Text>
          <Text
            className="mt-1 text-[11px] leading-4 text-white/88"
            numberOfLines={2}
          >
            {post.caption}
          </Text>
        </View>
      </View>
    </View>
  );
}

function AboutMetricCard({
  icon,
  label,
  value,
}: {
  icon: SymbolName;
  label: string;
  value: string;
}) {
  return (
    <View
      className="flex-1 rounded-[28px] border border-[#F2E0D7] bg-white p-4"
      style={cardShadowStyle}
    >
      <View className="h-10 w-10 items-center justify-center rounded-full bg-[#FFF1F6]">
        <SymbolView name={icon} size={16} tintColor="#EB489B" />
      </View>
      <Text className="mt-3 text-[11px] font-bold uppercase tracking-[0.4px] text-[#D55E8E]">
        {label}
      </Text>
      <Text className="mt-1 text-[15px] font-black text-[#2F2337]">
        {value}
      </Text>
    </View>
  );
}

function RouteMeta({ icon, value }: { icon: SymbolName; value: string }) {
  return (
    <View className="flex-row items-center gap-1.5">
      <SymbolView name={icon} size={12} tintColor="#EB489B" />
      <Text className="text-[11px] font-semibold text-[#5E5168]">{value}</Text>
    </View>
  );
}

function EmptyContent({ message }: { message: string }) {
  return (
    <View
      className="rounded-[28px] border border-[#F2E0D7] bg-white px-4 py-6"
      style={cardShadowStyle}
    >
      <Text className="text-center text-[13px] leading-6 text-[#6D6276]">
        {message}
      </Text>
    </View>
  );
}

function parseMetricValue(metric: string): number {
  const normalized = metric.trim().toLowerCase();

  if (normalized.endsWith("k")) {
    return Number.parseFloat(normalized.slice(0, -1)) * 1000;
  }

  return Number.parseFloat(normalized) || 0;
}

function formatCompactValue(value: number): string {
  if (value >= 1000) {
    return `${Math.round(value / 100) / 10}K`;
  }

  return value.toString();
}
