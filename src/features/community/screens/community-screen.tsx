import { type Href, useRouter } from "expo-router";
import { LinearGradient } from "expo-linear-gradient";
import { StatusBar } from "expo-status-bar";
import { SymbolView } from "@/components/ui/symbol-view";
import { useMemo, useState, type ComponentProps } from "react";
import {
  Image,
  Pressable,
  ScrollView,
  Text,
  View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

import { useScreenLayout } from "@/hooks/use-screen-layout";
import {
  communityPosts,
  type CommunityPost,
  type CommunityPostTopic,
} from "../data/community-demo";

const COMPOSER_AVATAR_URI =
  "https://i.pinimg.com/1200x/02/4a/12/024a1239d1eaac70f5ac7b43a1adb5ea.jpg";
const PROJECT_WORDMARK = "Culture Quest Lite";

const gradientColors = ["#EB489B", "#F58752", "#FFC93C"] as const;
const shellGradientColors = ["#FFF5FB", "#FFF7F0", "#FFFFFF"] as const;

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
type CommunityTabKey = "community" | "following";
type TopicKey = "all" | CommunityPostTopic;

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

type TopicFilter = {
  key: TopicKey;
  label: string;
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

const topicFilters: readonly TopicFilter[] = [
  { key: "all", label: "Tất cả" },
  { key: "culture", label: "Văn hóa" },
  { key: "art", label: "Nghệ thuật" },
  { key: "cuisine", label: "Ẩm thực" },
  { key: "history", label: "Lịch sử" },
] as const;

const topicTagPalettes: Record<TopicKey, TagPalette> = {
  all: {
    backgroundColor: "#F4EFF8",
    borderColor: "#E1D6EA",
    textColor: "#6E6177",
  },
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

export default function CommunityScreen() {
  const router = useRouter();
  const { gutter } = useScreenLayout({ maxContentWidth: 640 });
  const [activeTab, setActiveTab] = useState<CommunityTabKey>("community");
  const [activeTopic, setActiveTopic] = useState<TopicKey>("all");
  const activeTopicLabel = useMemo(
    () =>
      topicFilters.find((item) => item.key === activeTopic)?.label ?? "Tất cả",
    [activeTopic],
  );
  const filteredPosts = useMemo(() => {
    const tabPosts =
      activeTab === "community"
        ? communityPosts
        : communityPosts.filter((post) => post.isFollowing);

    return activeTopic === "all"
      ? tabPosts
      : tabPosts.filter((post) => post.topic === activeTopic);
  }, [activeTab, activeTopic]);
  const openExplorerProfile = (authorId: string) => {
    router.push(`/community/profile/${authorId}` as Href);
  };

  return (
    <SafeAreaView
      className="flex-1 bg-[#FFF8F5]"
      edges={["top", "left", "right"]}
    >
      <StatusBar style="dark" />

      <View className="flex-1 bg-[#FFF8F5]">
        <LinearGradient
          colors={shellGradientColors}
          end={{ x: 1, y: 1 }}
          start={{ x: 0.08, y: 0 }}
          className="absolute left-0 right-0 top-0 h-[260px]"
        />

        <View
          className="absolute -left-10 top-10 h-44 w-44 rounded-full"
          style={{ backgroundColor: "rgba(235, 72, 155, 0.09)" }}
        />
        <View
          className="absolute right-[-32px] top-28 h-36 w-36 rounded-full"
          style={{ backgroundColor: "rgba(245, 135, 82, 0.08)" }}
        />

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
                className="flex-row items-center rounded-[24px] bg-white px-3.5 py-3.5"
                style={composerShadowStyle}
              >
                <ComposerAvatar uri={COMPOSER_AVATAR_URI} />

                <Pressable className="ml-3 flex-1 px-1 py-2">
                  <Text className="text-[13px] font-medium text-[#B1A2AB]">
                    Chia sẻ trải nghiệm của bạn...
                  </Text>
                </Pressable>

                <Pressable className="ml-3 overflow-hidden rounded-full">
                  <LinearGradient
                    colors={gradientColors}
                    end={{ x: 1, y: 0.5 }}
                    locations={[0, 0.58, 1]}
                    start={{ x: 0, y: 0.5 }}
                    className="h-10 w-10 items-center justify-center rounded-full"
                  >
                    <SymbolView
                      name={{
                        ios: "photo.on.rectangle.angled",
                        android: "image",
                        web: "image",
                      }}
                      size={16}
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

              <View>
                <ScrollView
                  horizontal
                  nestedScrollEnabled
                  showsHorizontalScrollIndicator={false}
                  contentContainerStyle={{ gap: 10, paddingTop: 12 }}
                >
                  {topicFilters.map((topic) => (
                    <TopicFilterChip
                      key={topic.key}
                      topic={topic}
                      active={activeTopic === topic.key}
                      onPress={() => {
                        setActiveTopic(topic.key);
                      }}
                    />
                  ))}
                </ScrollView>
              </View>
            </View>

            <View className="mt-5 gap-4">
              {filteredPosts.length ? (
                filteredPosts.map((post) => (
                  <CommunityPostCard
                    key={post.id}
                    post={post}
                    onOpenProfile={openExplorerProfile}
                  />
                ))
              ) : (
                <View className="rounded-[28px] border border-[#F4E0D5] bg-white px-5 py-6">
                  <Text className="text-[18px] font-black text-[#2E2336]">
                    Chưa có cập nhật mới
                  </Text>
                  <Text className="mt-2 text-[14px] leading-5 text-[#8E869A]">
                    {activeTopic !== "all"
                      ? `Chưa có bài thuộc chủ đề ${activeTopicLabel.toLowerCase()} trong mục này. Hãy thử đổi chủ đề khác để xem thêm nội dung.`
                      : activeTab === "following"
                        ? "Danh sách bạn đang theo dõi hiện chưa có cập nhật mới. Chuyển sang Cộng đồng để xem thêm hoạt động nổi bật."
                        : "Feed cộng đồng hiện chưa có bài mới. Hãy quay lại sau để xem thêm hoạt động từ các explorer."}
                  </Text>
                </View>
              )}
            </View>
          </View>
        </ScrollView>
      </View>
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

function CommunityPostCard({
  post,
  onOpenProfile,
}: {
  post: CommunityPost;
  onOpenProfile: (authorId: string) => void;
}) {
  return (
    <View
      className="overflow-hidden rounded-[32px] border border-[#F5E4EB] bg-white px-4 pb-4 pt-4"
      style={cardShadowStyle}
    >
      <Pressable
        onPress={() => {
          onOpenProfile(post.authorId);
        }}
        className="flex-row items-start"
      >
        <View className="rounded-[20px]">
          <AvatarMonogram
            colors={post.avatarColors}
            initials={post.initials}
            size={52}
          />
        </View>

        <View className="ml-3.5 flex-1 pr-3">
          <View className="flex-row items-center gap-1.5">
            <Text className="text-[17px] font-black text-[#2F2337]">
              {post.author}
            </Text>
            <View className="h-5 w-5 items-center justify-center rounded-full bg-[#E7FFF2]">
              <SymbolView
                name={{
                  ios: "checkmark.seal.fill",
                  android: "verified",
                  web: "verified",
                }}
                size={12}
                tintColor="#24A868"
              />
            </View>
          </View>

          <Text className="mt-0.5 text-[13px] font-medium text-[#8E869A]">
            {post.role}
          </Text>
          <Text className="mt-1 text-[12px] font-medium text-[#B3A9B6]">
            {post.time}
          </Text>
        </View>

        <View className="h-10 w-10 items-center justify-center rounded-full bg-[#FFF5F8]">
          <SymbolView
            name={{
              ios: "ellipsis",
              android: "more_horiz",
              web: "more_horiz",
            }}
            size={16}
            tintColor="#B15F82"
          />
        </View>
      </Pressable>

      <Text className="mt-4 text-[16px] leading-6 text-[#33293A]">
        {post.caption}
      </Text>

      <View className="mt-3 flex-row flex-wrap gap-2">
        {post.tags.map((tag) => (
          <TagPill key={`${post.id}-${tag}`} label={tag} />
        ))}
      </View>

      <View className="mt-4 overflow-hidden rounded-[28px]">
        <Image
          source={post.image}
          resizeMode="cover"
          style={{ height: 248, width: "100%" }}
        />

        <LinearGradient
          colors={["rgba(47, 35, 55, 0)", "rgba(47, 35, 55, 0.72)"]}
          end={{ x: 0.5, y: 1 }}
          start={{ x: 0.5, y: 0 }}
          style={{
            position: "absolute",
            bottom: 0,
            left: 0,
            right: 0,
            paddingHorizontal: 16,
            paddingBottom: 16,
            paddingTop: 42,
          }}
        >
          <Text className="text-[15px] font-extrabold text-white">
            {post.location}
          </Text>
          <Text className="mt-1 text-[12px] text-white/80">{post.mood}</Text>
        </LinearGradient>

        <View className="absolute left-4 top-4 rounded-full bg-white px-3 py-2">
          <View className="flex-row items-center gap-1.5">
            <SymbolView
              name={{
                ios: "flame.fill",
                android: "local_fire_department",
                web: "local_fire_department",
              }}
              size={12}
              tintColor="#F58752"
            />
            <Text className="text-[12px] font-black text-[#2F2337]">
              {post.hotScore}
            </Text>
          </View>
        </View>
      </View>

      <View className="mt-4 flex-row items-center justify-between">
        <View className="flex-1 flex-row items-center pr-3">
          <View className="mr-2.5 h-9 w-9 items-center justify-center rounded-full bg-[#FFF1F6]">
            <SymbolView
              name={{
                ios: "mappin.and.ellipse",
                android: "location_on",
                web: "location_on",
              }}
              size={16}
              tintColor="#EB489B"
            />
          </View>

          <View className="flex-1">
            <Text
              className="text-[13px] font-bold text-[#43354C]"
              numberOfLines={1}
            >
              {post.location}
            </Text>
            <Text className="mt-0.5 text-[11px] text-[#9E93A4]">
              {post.mood}
            </Text>
          </View>
        </View>
      </View>

      <View className="mt-4 flex-row items-center justify-between gap-3">
        <View className="flex-1 flex-row flex-wrap items-center gap-5">
          <CompactEngagementItem
            icon={{
              ios: "hand.thumbsup",
              android: "thumb_up_off_alt",
              web: "thumb_up_off_alt",
            }}
            value={post.likes}
          />
          <CompactEngagementItem
            icon={{
              ios: "bubble.left",
              android: "chat_bubble_outline",
              web: "chat_bubble_outline",
            }}
            value={post.comments}
          />
          <CompactEngagementItem
            icon={{
              ios: "bookmark",
              android: "bookmark_border",
              web: "bookmark_border",
            }}
            value={post.shares}
          />
        </View>

        <View className="ml-3 flex-row items-center">
          <ReactionBubble
            backgroundColor="#2F80ED"
            icon={{
              ios: "hand.thumbsup.fill",
              android: "thumb_up",
              web: "thumb_up",
            }}
          />
          <View className="-ml-1.5">
            <ReactionBubble
              backgroundColor="#FF5F8F"
              icon={{
                ios: "heart.fill",
                android: "favorite",
                web: "favorite",
              }}
            />
          </View>
        </View>
      </View>
    </View>
  );
}

function TopicFilterChip({
  active,
  onPress,
  topic,
}: {
  active: boolean;
  onPress: () => void;
  topic: TopicFilter;
}) {
  const selectedPalette = topicTagPalettes.culture;

  return (
    <Pressable
      onPress={onPress}
      className="rounded-full px-4 py-2.5"
      style={
        active
          ? {
              backgroundColor: selectedPalette.backgroundColor,
              borderColor: selectedPalette.borderColor,
              borderWidth: 1,
            }
          : undefined
      }
    >
      <Text
        className="text-[12px] font-extrabold"
        style={{
          color: active ? selectedPalette.textColor : "#8E869A",
        }}
      >
        {topic.label}
      </Text>
    </Pressable>
  );
}

function TagPill({ label }: { label: string }) {
  const palette = getTagPalette(label);

  return (
    <View
      className="rounded-full border px-3 py-1.5"
      style={{
        backgroundColor: palette.backgroundColor,
        borderColor: palette.borderColor,
      }}
    >
      <Text
        className="text-[11px] font-bold uppercase tracking-[0.5px]"
        style={{ color: palette.textColor }}
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

function ComposerAvatar({ uri }: { uri: string }) {
  const [hasError, setHasError] = useState(!uri);

  if (hasError) {
    return (
      <View className="rounded-full bg-white">
        <AvatarMonogram
          colors={["#EB489B", "#F58752"]}
          initials="NT"
          size={28}
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
          setHasError(true);
        }}
      />
    </View>
  );
}

function CompactEngagementItem({
  icon,
  value,
}: {
  icon: SymbolName;
  value: string;
}) {
  return (
    <View className="flex-row items-center">
      <SymbolView name={icon} size={16} tintColor="#8C8096" />
      <Text className="ml-1.5 text-[13px] font-bold text-[#6E6177]">
        {value}
      </Text>
    </View>
  );
}

function ReactionBubble({
  backgroundColor,
  icon,
}: {
  backgroundColor: string;
  icon: SymbolName;
}) {
  return (
    <View
      className="h-5 w-5 items-center justify-center rounded-full border border-white"
      style={{ backgroundColor }}
    >
      <SymbolView name={icon} size={10} tintColor="#FFFFFF" />
    </View>
  );
}
