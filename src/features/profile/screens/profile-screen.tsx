import { Image } from "expo-image";
import { LinearGradient } from "expo-linear-gradient";
import { type Href, useRouter } from "expo-router";
import { SymbolView } from "expo-symbols";
import { type ComponentProps, useState } from "react";
import {
  ActivityIndicator,
  Pressable,
  ScrollView,
  Text,
  useWindowDimensions,
  View,
} from "react-native";
import {
  SafeAreaView,
  useSafeAreaInsets,
} from "react-native-safe-area-context";

import { useAuthSession } from "@/features/auth/hooks/use-auth-session";
import {
  getHotspotHref,
  type HotspotDetail,
} from "@/features/home/data/hotspots";
import type { RouteItem } from "@/lib/demo-data";
import { useProfile } from "../hooks/use-profile";
import type { ProfilePost } from "../types";

type Tab = "posts" | "routes" | "liked-hotspots";
type SymbolName = ComponentProps<typeof SymbolView>["name"];

const cardShadow = {
  shadowColor: "rgba(28, 45, 80, 0.10)",
  shadowOpacity: 1,
  shadowRadius: 16,
  shadowOffset: { width: 0, height: 8 },
  elevation: 5,
} as const;

const heroGradientColors = ["#20476B", "#4F87B2", "#F7F8FC"] as const;
const avatarFallbackColors = ["#EB489B", "#F58752"] as const;

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

function XPBar({
  value,
  max,
  trackColor = "rgba(255,255,255,0.65)",
  height = 8,
}: {
  value: number;
  max: number;
  trackColor?: string;
  height?: number;
}) {
  const percent = Math.min(Math.max((value / max) * 100, 0), 100);

  return (
    <View
      style={{
        backgroundColor: trackColor,
        borderRadius: 999,
        height,
        overflow: "hidden",
      }}
    >
      <LinearGradient
        colors={["#F58752", "#FF6B2C", "#EB489B"]}
        start={{ x: 0, y: 0.5 }}
        end={{ x: 1, y: 0.5 }}
        style={{ borderRadius: 999, height: "100%", width: `${percent}%` }}
      />
    </View>
  );
}

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

export default function ProfileScreen() {
  const router = useRouter();
  const authSession = useAuthSession();
  const { likedHotspots, profile, posts, userRoutes, isLoading, error } =
    useProfile();
  const [tab, setTab] = useState<Tab>("posts");
  const insets = useSafeAreaInsets();
  const { width } = useWindowDimensions();
  const heroHeight = Math.max(Math.min(width * 0.88, 320), 280);
  const avatarSize = 126;
  const profileOverlap = avatarSize * 0.52;

  if (isLoading && !profile) {
    return (
      <SafeAreaView className="flex-1 items-center justify-center bg-[#F7F8FC]">
        <ActivityIndicator color="#F58752" size="large" />
        <Text className="mt-3 text-[14px] text-[#8E869A]">
          Đang tải hồ sơ...
        </Text>
      </SafeAreaView>
    );
  }

  if (error && !profile) {
    return (
      <SafeAreaView className="flex-1 items-center justify-center bg-[#F7F8FC] px-6">
        <Text className="text-center text-[16px] font-extrabold text-[#2B2233]">
          Không thể tải hồ sơ
        </Text>
        <Text className="mt-2 text-center text-[13px] leading-5 text-[#8E869A]">
          {error.message}
        </Text>
      </SafeAreaView>
    );
  }

  if (!profile) {
    return (
      <SafeAreaView className="flex-1 items-center justify-center bg-[#F7F8FC]">
        <Text className="text-[14px] text-[#8E869A]">Không tìm thấy hồ sơ</Text>
      </SafeAreaView>
    );
  }

  const levelNumber =
    typeof profile.level === "number" ? profile.level : authSession.level;
  const currentLevelXp =
    typeof profile.currentLevelXp === "number" ? profile.currentLevelXp : null;
  const xpToNext =
    typeof profile.xpToNext === "number" ? profile.xpToNext : null;
  const canShowLevelProgress =
    levelNumber !== null &&
    currentLevelXp !== null &&
    xpToNext !== null &&
    xpToNext > 0;
  const levelProgressPercent = canShowLevelProgress
    ? Math.min(Math.max((currentLevelXp / xpToNext) * 100, 0), 100)
    : 0;
  const remainingXp = canShowLevelProgress
    ? Math.max(xpToNext - currentLevelXp, 0)
    : 0;
  const showAudienceStats = profile.followers > 0 || profile.following > 0;
  const statItems = showAudienceStats
    ? [
        { label: "Người theo dõi", value: profile.followers },
        { label: "Đang theo dõi", value: profile.following },
        { label: "Bài viết", value: posts.length },
      ]
    : [
        { label: "Tổng điểm", value: profile.points },
        { label: "Tổng XP", value: profile.totalXp },
        { label: "Bài viết", value: posts.length },
      ];
  const badgeLabel =
    levelNumber !== null
      ? levelNumber.toString()
      : profile.isPremium
        ? "PRO"
        : null;

  return (
    <SafeAreaView
      className="flex-1 bg-[#F7F8FC]"
      edges={["left", "right", "bottom"]}
    >
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
            className="absolute left-4 right-4 flex-row items-center justify-between"
            style={{ paddingTop: insets.top + 10 }}
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
                <Text className="text-[12px] font-extrabold text-white">
                  {profile.points.toLocaleString()}
                </Text>
              </View>
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

        <View className="px-4" style={{ marginTop: -profileOverlap }}>
          <View className="flex-row items-start gap-4">
            <AccountAvatar
              avatar={profile.avatar}
              badgeLabel={badgeLabel}
              name={profile.name}
              size={avatarSize}
              username={profile.username}
            />

            <View className="min-w-0 flex-1 pt-10">
              <View className="flex-row items-center">
                <Text
                  className="text-[22px] font-extrabold leading-tight text-[#2B2233]"
                  numberOfLines={1}
                >
                  {profile.name}
                </Text>
              </View>

              {canShowLevelProgress ? (
                <View className="mt-3">
                  <View className="mb-1.5 flex-row items-center justify-between gap-3">
                    <Text className="text-[13px] font-extrabold text-[#2B2233]">
                      Level
                    </Text>
                    <View className="flex-row items-center gap-1 rounded-full bg-[#FFF4EF] px-2.5 py-1">
                      <SymbolView
                        name={{
                          ios: "sparkles",
                          android: "auto_awesome",
                          web: "auto_awesome",
                        }}
                        size={13}
                        tintColor="#F58752"
                      />
                      <Text className="text-[11px] font-extrabold text-[#F58752]">
                        Cấp {levelNumber}
                      </Text>
                    </View>
                  </View>
                  <XPBar
                    value={currentLevelXp}
                    max={xpToNext}
                    height={10}
                    trackColor="#F4EAF0"
                  />
                  <View className="mt-1.5 flex-row items-center justify-between">
                    <Text className="flex-1 pr-3 text-[10px] text-[#8E869A]">
                      Còn {remainingXp} XP để lên cấp {levelNumber + 1}
                    </Text>
                    <Text className="text-[10px] font-extrabold text-[#F58752]">
                      {Math.round(levelProgressPercent)}%
                    </Text>
                  </View>
                </View>
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
                    size={18}
                    tintColor={selected ? "#F58752" : "#AA9FB0"}
                  />
                </Pressable>
              );
            })}
          </View>

          <View className="mt-4">
            {tab === "posts" ? (
              posts.length === 0 ? (
                <EmptyPosts />
              ) : (
                <View className="gap-3">
                  {posts.map((post) => (
                    <PostCard key={post.id} post={post} />
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
                    onPress={() => router.push(getHotspotHref(hotspot.slug))}
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
            bottom: -6,
            right: -6,
            width: 54,
            height: 54,
            borderRadius: 27,
            alignItems: "center",
            justifyContent: "center",
            borderWidth: 4,
            borderColor: "#F7F8FC",
            ...cardShadow,
          }}
        >
          <Text
            className="font-extrabold text-white"
            style={{ fontSize: badgeLabel.length > 2 ? 14 : 24 }}
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
      <Text className="text-center text-[15px] font-extrabold text-[#2B2233]">
        {n.toLocaleString()}
      </Text>
      <Text className="mt-0.5 text-center text-[9px] leading-tight text-[#8E869A]">
        {label}
      </Text>
    </View>
  );
}

function InlineNotice({ message }: { message: string }) {
  return (
    <View className="mt-5 rounded-2xl border border-[#F6C9C0] bg-[#FFF4F1] px-4 py-3">
      <Text className="text-[12px] font-semibold leading-5 text-[#B54D3A]">
        {message}
      </Text>
    </View>
  );
}

function PostCard({ post }: { post: ProfilePost }) {
  return (
    <View className="rounded-2xl bg-white p-3" style={cardShadow}>
      <Text className="text-[12px] leading-relaxed text-[#2B2233]">
        {post.text}
      </Text>
      {post.image ? (
        <Image
          source={post.image}
          contentFit="cover"
          transition={180}
          cachePolicy="memory-disk"
          style={{
            marginTop: 8,
            width: "100%",
            aspectRatio: 4 / 3,
            borderRadius: 12,
          }}
        />
      ) : null}
      <Text className="mt-2 text-[10px] text-[#8E869A]">
        {post.time} · {post.likes} thích · {post.comments} bình luận
      </Text>
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
          className="text-[13px] font-semibold text-[#2B2233]"
          numberOfLines={1}
        >
          {route.title}
        </Text>
        <Text className="text-[10px] text-[#8E869A]">
          {route.distance} · {route.duration}
        </Text>
        <Text className="mt-0.5 text-[10px] font-extrabold text-[#F58752]">
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
            className="flex-1 text-[13px] font-semibold text-[#2B2233]"
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
        <Text className="mt-0.5 text-[10px] text-[#8E869A]">
          {hotspot.category} · {hotspot.district}
        </Text>
        <Text className="mt-1 text-[10px] text-[#8E869A]">
          {hotspot.distance} · {hotspot.reviews} reviews
        </Text>
        <Text className="mt-1 text-[10px] font-extrabold text-[#F58752]">
          {hotspot.reward}
        </Text>
      </View>
    </Pressable>
  );
}

function EmptyPosts() {
  return (
    <View className="items-center py-12">
      <SymbolView
        name={{ ios: "photo", android: "image", web: "image" }}
        size={36}
        tintColor="#AA9FB0"
      />
      <Text className="mt-2 text-[12px] text-[#8E869A]">
        Bạn chưa có bài đăng nào
      </Text>
    </View>
  );
}

function EmptyRoutes() {
  return (
    <View className="items-center py-12">
      <SymbolView
        name={{ ios: "map", android: "map", web: "map" }}
        size={36}
        tintColor="#AA9FB0"
      />
      <Text className="mt-2 text-[12px] text-[#8E869A]">
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
        size={36}
        tintColor="#AA9FB0"
      />
      <Text className="mt-2 text-[12px] text-[#8E869A]">
        Chưa có hotspot đã thích nào
      </Text>
    </View>
  );
}
