import { Image } from "expo-image";
import { LinearGradient } from "expo-linear-gradient";
import { useLocalSearchParams, useRouter, type Href } from "expo-router";
import { StatusBar } from "expo-status-bar";
import { SymbolView } from "expo-symbols";
import { useEffect, useState } from "react";
import { Pressable, ScrollView, Text, View } from "react-native";
import {
  SafeAreaView,
  useSafeAreaInsets,
} from "react-native-safe-area-context";

import {
  getValidAccessToken,
  useAuthSession,
} from "@/features/auth/hooks/use-auth-session";

import { getHotspotStories } from "../api/get-hotspot-stories";
import { getCachedHotspotDetail } from "../data/hotspot-detail-cache";
import {
  cacheHotspotStories,
  getCachedHotspotStories,
} from "../data/hotspot-story-cache";
import {
  buildHotspotThemeStories,
  buildHotspotThemeStoriesFromApi,
  tagImageByTag,
  type HotspotThemeStory,
  type StoryThemeTag,
} from "../data/hotspot-theme-stories";
import { getHotspotBySlug } from "../data/hotspots";

const cardShadowStyle = {
  shadowColor: "rgba(235, 72, 155, 0.16)",
  shadowOpacity: 1,
  shadowRadius: 22,
  shadowOffset: {
    width: 0,
    height: 14,
  },
  elevation: 8,
} as const;

type StoryThemeTabItem = {
  id: string;
  imageSource: number;
  label: string;
  tagId: number | null;
};

const fallbackStoryThemeOrder: StoryThemeTag[] = [
  "history",
  "culture",
  "food",
  "education",
];

function getFallbackStoryThemeTag(index: number) {
  return fallbackStoryThemeOrder[index % fallbackStoryThemeOrder.length] ?? "history";
}

function resolveHotspotIdParam(value?: string | string[]) {
  const rawValue = Array.isArray(value) ? value[0] : value;
  const parsedValue = Number(rawValue);

  return Number.isInteger(parsedValue) && parsedValue > 0 ? parsedValue : null;
}

function normalizeApiTagId(value?: number | null) {
  return typeof value === "number" && Number.isInteger(value) && value > 0
    ? value
    : null;
}

function buildStoryThemeTabsFromStories(stories: HotspotThemeStory[]) {
  const tabsById = new Map<string, StoryThemeTabItem>();

  stories.forEach((story, index) => {
    const label = story.tagLabel.trim();

    if (!label) {
      return;
    }

    const tagId = normalizeApiTagId(story.tagId);
    const resolvedTag = story.tag ?? getFallbackStoryThemeTag(index);
    const tabId =
      tagId !== null
        ? `tag-${tagId}`
        : `label-${label.trim().toLowerCase()}`;

    if (tabsById.has(tabId)) {
      return;
    }

    tabsById.set(tabId, {
      id: tabId,
      imageSource: tagImageByTag[resolvedTag],
      label,
      tagId,
    });
  });

  return Array.from(tabsById.values());
}

function ThemeTagChip({
  imageSource,
  isActive,
  label,
  onPress,
}: {
  imageSource: number;
  isActive: boolean;
  label: string;
  onPress: () => void;
}) {
  return (
    <Pressable className="items-center" onPress={onPress}>
      <View
        className="rounded-full p-1.5"
        style={{
          backgroundColor: isActive ? "#FFF1F7" : "transparent",
          borderColor: isActive ? "#F8CADC" : "transparent",
          borderWidth: 1,
        }}
      >
        <Image
          source={imageSource}
          contentFit="cover"
          transition={120}
          cachePolicy="memory-disk"
          style={{ borderRadius: 999, height: 58, width: 58 }}
        />
      </View>
      <Text
        className="mt-2 text-[14px] font-black"
        style={{ color: isActive ? "#EB489B" : "#A897B2" }}
      >
        {label}
      </Text>
      <View
        className="mt-2 rounded-full"
        style={{
          backgroundColor: isActive ? "#F58752" : "transparent",
          height: 3,
          width: 42,
        }}
      />
    </Pressable>
  );
}

function StoryCard({
  item,
  onPress,
}: {
  item: HotspotThemeStory;
  onPress: () => void;
}) {
  return (
    <Pressable className="pb-5 pr-9 pt-6" onPress={onPress}>
      <LinearGradient
        colors={[item.cardColors[0], item.cardColors[1]]}
        end={{ x: 1, y: 0.5 }}
        start={{ x: 0, y: 0.5 }}
        className="overflow-hidden rounded-[30px] px-5 py-4"
        style={[cardShadowStyle, { minHeight: item.cardHeight }]}
      >
        <View
          className="absolute rounded-full"
          style={{
            backgroundColor: "rgba(255,255,255,0.18)",
            height: 136,
            right: -24,
            top: -18,
            width: 136,
          }}
        />
        <View
          className="absolute rounded-full"
          style={{
            backgroundColor: "rgba(255,255,255,0.10)",
            bottom: -44,
            height: 110,
            right: 36,
            width: 110,
          }}
        />

        <View style={{ maxWidth: `${item.textWidth}%` }}>
          <Text
            className="text-[19px] font-black leading-6 text-white"
            style={{
              textShadowColor: "rgba(76, 53, 76, 0.12)",
              textShadowOffset: { width: 0, height: 1 },
              textShadowRadius: 8,
            }}
          >
            {item.title}
          </Text>
        </View>
      </LinearGradient>

      <Image
        source={item.imageSource}
        contentFit="contain"
        transition={120}
        cachePolicy="memory-disk"
        style={{
          borderRadius: 26,
          bottom: item.imageBottom,
          height: item.imageHeight,
          position: "absolute",
          right: item.imageRight,
          width: item.imageWidth,
        }}
      />
    </Pressable>
  );
}

function NotFoundState() {
  const router = useRouter();

  return (
    <View className="flex-1 bg-white">
      <SafeAreaView
        className="flex-1"
        edges={["top", "left", "right", "bottom"]}
      >
        <View className="flex-1 items-center justify-center px-6">
          <View
            className="w-full rounded-[32px] border bg-[#FFF9FD] px-6 py-8"
            style={[cardShadowStyle, { borderColor: "#F4DCE6", maxWidth: 360 }]}
          >
            <Text className="text-center text-[24px] font-black text-[#2B2233]">
              Không tìm thấy story
            </Text>
            <Text className="mt-3 text-center text-[14px] leading-6 text-[#6F657A]">
              Hotspot này không còn trong dữ liệu hiện tại hoặc slug chưa hợp
              lệ.
            </Text>
            <Pressable
              className="mt-6 items-center rounded-full bg-[#FFF0F6] px-5 py-3.5"
              onPress={() => router.back()}
            >
              <Text className="text-[14px] font-black text-[#EB489B]">
                Quay lại hotspot
              </Text>
            </Pressable>
          </View>
        </View>
      </SafeAreaView>
    </View>
  );
}

function EmptyStoriesState({ message }: { message: string }) {
  return (
    <View
      className="rounded-[28px] border border-[#F4DCE6] bg-[#FFF9FD] px-5 py-6"
      style={cardShadowStyle}
    >
      <Text className="text-[18px] font-black text-[#2B2233]">
        Chưa có story phù hợp
      </Text>
      <Text className="mt-2 text-[14px] leading-6 text-[#6F657A]">
        {message}
      </Text>
    </View>
  );
}

export default function HotspotStoriesScreen() {
  const router = useRouter();
  const authSession = useAuthSession();
  const insets = useSafeAreaInsets();
  const { hotspotId, slug } = useLocalSearchParams<{
    hotspotId?: string;
    slug: string;
  }>();
  const resolvedSlug = Array.isArray(slug) ? (slug[0] ?? "") : (slug ?? "");
  const resolvedHotspotId = resolveHotspotIdParam(hotspotId);
  const cachedHotspotEntry = getCachedHotspotDetail({
    hotspotId: resolvedHotspotId,
    slug: resolvedSlug,
  });
  const hotspot = cachedHotspotEntry?.hotspot ?? getHotspotBySlug(resolvedSlug);
  const cachedStoriesEntry = getCachedHotspotStories({
    hotspotId: resolvedHotspotId,
    slug: resolvedSlug,
  });
  const [activeTabId, setActiveTabId] = useState("");
  const [apiStoryCards, setApiStoryCards] = useState<
    HotspotThemeStory[] | null
  >(() => cachedStoriesEntry?.stories ?? null);
  const [isStoriesLoading, setIsStoriesLoading] = useState(
    () => cachedStoriesEntry === null && resolvedHotspotId !== null,
  );
  const [storiesError, setStoriesError] = useState<string | null>(null);
  const fallbackStoryCards =
    hotspot && resolvedHotspotId === null ? buildHotspotThemeStories(hotspot) : [];
  const storyCards = apiStoryCards ?? fallbackStoryCards;
  const storyDrivenThemeTabs = buildStoryThemeTabsFromStories(storyCards);
  const resolvedThemeTabs =
    storyDrivenThemeTabs;
  const resolvedActiveTab =
    resolvedThemeTabs.find((tab) => tab.id === activeTabId) ??
    resolvedThemeTabs[0] ??
    null;
  const selectedTagId = resolvedActiveTab?.tagId ?? null;

  useEffect(() => {
    if (!hotspot) {
      return;
    }

    const resolvedHotspot = hotspot;
    let isActive = true;

    const loadHotspotStories = async () => {
      const nextCachedStoriesEntry = getCachedHotspotStories({
        hotspotId: resolvedHotspotId,
        slug: resolvedSlug,
      });

      if (nextCachedStoriesEntry) {
        if (!isActive) {
          return;
        }

        setApiStoryCards(nextCachedStoriesEntry.stories);
        setStoriesError(null);
      }

      if (resolvedHotspotId === null) {
        if (!isActive) {
          return;
        }

        setApiStoryCards(null);
        setIsStoriesLoading(false);
        setStoriesError(null);
        return;
      }

      setIsStoriesLoading(nextCachedStoriesEntry === null);
      setStoriesError(null);

      if (nextCachedStoriesEntry === null) {
        setApiStoryCards(null);
      }

      try {
        const accessToken = authSession.isAuthenticated
          ? await getValidAccessToken()
          : null;
        const stories = await getHotspotStories({
          accessToken,
          hotspotId: resolvedHotspotId,
          status: "DRAFT",
          tokenType: authSession.tokenType,
        });
        const mappedStories = buildHotspotThemeStoriesFromApi(
          resolvedHotspot,
          stories,
        );

        cacheHotspotStories({
          hotspotId: resolvedHotspotId,
          slug: resolvedSlug,
          stories: mappedStories,
        });

        if (!isActive) {
          return;
        }

        setApiStoryCards(mappedStories);
      } catch (error) {
        console.warn("[hotspot-stories] load hotspot stories failed", {
          error: error instanceof Error ? error.message : error,
          hotspotId: resolvedHotspotId,
          slug: resolvedSlug,
        });

        if (!isActive) {
          return;
        }

        if (nextCachedStoriesEntry === null) {
          setApiStoryCards(null);
        }
        setStoriesError(
          error instanceof Error
            ? error.message
            : "Không tải được story từ API cho hotspot này.",
        );
      } finally {
        if (isActive) {
          setIsStoriesLoading(false);
        }
      }
    };

    void loadHotspotStories();

    return () => {
      isActive = false;
    };
  }, [
    authSession.isAuthenticated,
    authSession.tokenType,
    hotspot,
    resolvedHotspotId,
    resolvedSlug,
  ]);

  if (!hotspot) {
    return <NotFoundState />;
  }

  const visibleStories =
    selectedTagId === null
      ? storyCards
      : storyCards.filter(
          (item) => normalizeApiTagId(item.tagId) === selectedTagId,
        );

  return (
    <View className="flex-1 bg-white">
      <StatusBar style="dark" />

      <SafeAreaView
        className="flex-1 bg-white"
        edges={["left", "right", "bottom"]}
      >
        <View
          className="border-b border-[#F2E8F7] bg-white px-5"
          style={{ paddingTop: insets.top + 6 }}
        >
          <View className="flex-row items-center justify-between pb-3">
            <Pressable
              className="h-11 w-11 items-center justify-center rounded-full bg-[#FFF5FA]"
              hitSlop={8}
              onPress={() => router.back()}
            >
              <SymbolView
                name={{
                  ios: "chevron.left",
                  android: "arrow_back",
                  web: "arrow_back",
                }}
                size={18}
                tintColor="#EB489B"
              />
            </Pressable>

            <Text className="text-[15px] font-black text-[#EB489B]">
              Story hotspot
            </Text>

            <View className="h-11 w-11" />
          </View>

          <ScrollView
            horizontal
            contentContainerStyle={{
              columnGap: 18,
              paddingBottom: 4,
              paddingTop: 4,
            }}
            showsHorizontalScrollIndicator={false}
          >
            {resolvedThemeTabs.map((tab) => (
              <ThemeTagChip
                key={tab.id}
                imageSource={tab.imageSource}
                isActive={tab.id === resolvedActiveTab?.id}
                label={tab.label}
                onPress={() => setActiveTabId(tab.id)}
              />
            ))}
          </ScrollView>

          {isStoriesLoading ? (
            <Text className="pb-3 pt-2 text-[12px] font-medium text-[#A897B2]">
              Đang tải story của hotspot...
            </Text>
          ) : null}

          {storiesError ? (
            <Text className="pb-3 pt-2 text-[12px] font-medium text-[#D97706]">
              {storiesError}
            </Text>
          ) : null}
        </View>

        <ScrollView
          className="flex-1"
          contentContainerStyle={{
            paddingBottom: Math.max(insets.bottom + 30, 34),
            paddingHorizontal: 20,
            paddingTop: 18,
            rowGap: 18,
          }}
          showsVerticalScrollIndicator={false}
        >
          {visibleStories.length > 0 ? (
            visibleStories.map((story) => (
              <StoryCard
                key={story.id}
                item={story}
                onPress={() =>
                  router.push(
                    resolvedHotspotId !== null
                      ? (`/hotspot/${hotspot.slug}/stories/${story.id}?hotspotId=${resolvedHotspotId}` as Href)
                      : (`/hotspot/${hotspot.slug}/stories/${story.id}` as Href),
                  )
                }
              />
            ))
          ) : (
            <EmptyStoriesState
              message={
                selectedTagId !== null
                  ? `Hotspot này chưa có story DRAFT cho tag "${resolvedActiveTab?.label ?? ""}".`
                  : apiStoryCards !== null
                    ? "Hotspot này chưa có story DRAFT để hiển thị."
                    : "Chưa có story phù hợp cho bộ lọc đang chọn."
              }
            />
          )}
        </ScrollView>
      </SafeAreaView>
    </View>
  );
}
