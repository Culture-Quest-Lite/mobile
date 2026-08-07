import { SymbolView } from "@/components/ui/symbol-view";
import { ScreenHorizontalPadding } from "@/constants/theme";
import { Image } from "expo-image";
import { useLocalSearchParams, useRouter, type Href } from "expo-router";
import { StatusBar } from "expo-status-bar";
import { useEffect, useState, type ComponentProps } from "react";
import { ActivityIndicator, Pressable, ScrollView, Text, View } from "react-native";
import {
  SafeAreaView,
  useSafeAreaInsets,
} from "react-native-safe-area-context";

import { AppLoadingScreen } from "@/components/ui/app-loading-screen";
import {
  getValidAccessToken,
  useAuthSession,
} from "@/features/auth/hooks/use-auth-session";
import { useCheckedInApiHotspots, useCheckins } from "@/lib/checkin-store";

import { getActiveTags, type ActiveTagDto } from "../api/get-tags";
import { getUnlockedHotspotStories } from "../api/get-hotspot-stories";
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
import {
  resolveRouteIdParam,
  resolveSelectedHotspotId,
} from "../utils/resolve-selected-hotspot-id";

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

const pageBackground = "#FFFFFF";

type StoryImageSource = ComponentProps<typeof Image>["source"];

type StoryThemeTabItem = {
  id: string;
  imageSource: StoryImageSource;
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
  return (
    fallbackStoryThemeOrder[index % fallbackStoryThemeOrder.length] ?? "history"
  );
}

function normalizeApiTagId(value?: number | null) {
  return typeof value === "number" && Number.isInteger(value) && value > 0
    ? value
    : null;
}

function normalizeLookupText(value: string) {
  return value
    .trim()
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "");
}

function readMeaningfulImageUrl(value?: string | null) {
  const trimmedValue = value?.trim();

  return trimmedValue ? trimmedValue : null;
}

function buildStoryThemeLookupKey({
  label,
  tagId,
}: {
  label: string;
  tagId?: number | null;
}) {
  const normalizedTagId = normalizeApiTagId(tagId);

  if (normalizedTagId !== null) {
    return `tag-${normalizedTagId}`;
  }

  return `label-${label
    .trim()
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")}`;
}

function buildStoryThemeTabsFromStories(
  stories: HotspotThemeStory[],
  activeTags: ActiveTagDto[],
) {
  const tabsById = new Map<string, StoryThemeTabItem>();
  const activeTagsById = new Map<number, ActiveTagDto>();
  const activeTagsByName = new Map<string, ActiveTagDto>();

  activeTags.forEach((tag) => {
    const normalizedTagId = normalizeApiTagId(tag.tagId);
    const normalizedTagName = normalizeLookupText(tag.tagName);

    if (normalizedTagId !== null && !activeTagsById.has(normalizedTagId)) {
      activeTagsById.set(normalizedTagId, tag);
    }

    if (normalizedTagName && !activeTagsByName.has(normalizedTagName)) {
      activeTagsByName.set(normalizedTagName, tag);
    }
  });

  stories.forEach((story, index) => {
    const label = story.tagLabel.trim();

    if (!label) {
      return;
    }

    const tagId = normalizeApiTagId(story.tagId);
    const resolvedTag = story.tag ?? getFallbackStoryThemeTag(index);
    const tabId = buildStoryThemeLookupKey({
      label,
      tagId,
    });
    const matchedTag =
      (tagId !== null ? activeTagsById.get(tagId) : null) ??
      activeTagsByName.get(normalizeLookupText(label));
    const imageSource =
      readMeaningfulImageUrl(matchedTag?.imageUrl) ??
      story.tagImageSource ??
      tagImageByTag[resolvedTag];

    if (tabsById.has(tabId)) {
      return;
    }

    tabsById.set(tabId, {
      id: tabId,
      imageSource,
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
  imageSource: StoryImageSource;
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
        className="mt-2 text-[15px] font-black"
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

function getStoryCardAccent(tag: StoryThemeTag) {
  switch (tag) {
    case "history":
      return {
        dot: "#EB489B",
        dotInactive: "rgba(255, 255, 255, 0.52)",
      };
    case "culture":
      return {
        dot: "#10B981",
        dotInactive: "rgba(255, 255, 255, 0.52)",
      };
    case "food":
      return {
        dot: "#F97316",
        dotInactive: "rgba(255, 255, 255, 0.52)",
      };
    case "education":
      return {
        dot: "#8B5CF6",
        dotInactive: "rgba(255, 255, 255, 0.52)",
      };
  }
}

function getStoryPreviewImages(item: HotspotThemeStory): StoryImageSource[] {
  const previewImages = [
    ...(item.heroGallery.length > 0
      ? item.heroGallery
      : item.gallery.length > 0
        ? item.gallery
        : [item.imageSource]),
  ];

  return [...new Set(previewImages)];
}

function buildStoryPreviewDescription(item: HotspotThemeStory) {
  const summary = item.summary.trim();
  const previewSegments = [
    summary,
    ...item.scriptParagraphs
      .map((paragraph) => paragraph.trim())
      .filter(Boolean),
  ].filter(Boolean);
  const previewText = [...new Set(previewSegments)].join(" ");

  if (!previewText) {
    return "Story này đang được cập nhật nội dung.";
  }

  return previewText.length > 340
    ? `${previewText.slice(0, 337).trimEnd()}...`
    : previewText;
}

function StoryCard({
  item,
  onPress,
}: {
  item: HotspotThemeStory;
  onPress: () => void;
}) {
  const previewImages = getStoryPreviewImages(item);
  const accent = getStoryCardAccent(item.tag);
  const previewDescription = buildStoryPreviewDescription(item);
  const [activeImageIndex, setActiveImageIndex] = useState(0);

  useEffect(() => {
    if (previewImages.length <= 1) {
      return;
    }

    const interval = setInterval(() => {
      setActiveImageIndex((currentIndex) => {
        return (currentIndex + 1) % previewImages.length;
      });
    }, 3200);

    return () => {
      clearInterval(interval);
    };
  }, [previewImages.length]);

  const activeImage =
    previewImages[activeImageIndex] ?? previewImages[0] ?? item.imageSource;

  return (
    <Pressable
      className="rounded-[22px]"
      onPress={onPress}
    >
      <View className="overflow-hidden rounded-[8px]">
        <Image
          source={activeImage}
          contentFit="cover"
          transition={420}
          cachePolicy="memory-disk"
          style={{
            backgroundColor: "#F6EFF8",
            height: 188,
            width: "100%",
          }}
        />

        {previewImages.length > 1 ? (
          <View className="absolute right-3 top-3 rounded-full bg-black/30 px-2.5 py-1">
            <Text className="text-[11px] font-medium text-white">
              {activeImageIndex + 1}/{previewImages.length}
            </Text>
          </View>
        ) : null}

        {previewImages.length > 1 ? (
          <View className="absolute bottom-3 left-0 right-0 flex-row items-center justify-center">
            {previewImages.map((_, index) => (
              <View
                key={`${item.id}-preview-dot-${index}`}
                className={index === previewImages.length - 1 ? "" : "mr-1.5"}
                style={{
                  backgroundColor:
                    index === activeImageIndex ? accent.dot : accent.dotInactive,
                  borderRadius: 999,
                  height: 6,
                  width: index === activeImageIndex ? 18 : 6,
                }}
              />
            ))}
          </View>
        ) : null}
      </View>

      <View
        style={{
          paddingTop: 12,
        }}
      >
        <Text
          className="text-[16px] font-semibold text-[#2B2233]"
          numberOfLines={2}
          style={{
            includeFontPadding: false,
            lineHeight: 16,
          }}
        >
          {item.title}
        </Text>

        <View className="mt-1">
          <Text
            className="text-[13px] text-[#6F657A]"
            numberOfLines={6}
            style={{
              includeFontPadding: false,
              lineHeight: 15,
              minHeight: 90,
            }}
          >
            {previewDescription}
          </Text>

          <Pressable
            className="mt-1 self-end"
            hitSlop={8}
            onPress={(event) => {
              event.stopPropagation();
              onPress();
            }}
          >
            <Text
              className="text-[12px] font-semibold"
              style={{
                color: "#EB489B",
                includeFontPadding: false,
                lineHeight: 13,
              }}
            >
              Xem thêm
            </Text>
          </Pressable>
        </View>

      </View>
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
            <Text className="mt-3 text-center text-[15px] leading-6 text-[#6F657A]">
              Hotspot này không còn trong dữ liệu hiện tại hoặc slug chưa hợp
              lệ.
            </Text>
            <Pressable
              className="mt-6 items-center rounded-full bg-[#FFF0F6] px-5 py-3.5"
              onPress={() => router.back()}
            >
              <Text className="text-[15px] font-black text-[#EB489B]">
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
      <Text className="text-[19px] font-black text-[#2B2233]">
        Chưa có story phù hợp
      </Text>
      <Text className="mt-2 text-[15px] leading-6 text-[#6F657A]">
        {message}
      </Text>
    </View>
  );
}

function LockedStoriesState({ onBack }: { onBack: () => void }) {
  return (
    <View
      className="rounded-[28px] border border-[#F4DCE6] bg-[#FFF9FD] px-5 py-6"
      style={cardShadowStyle}
    >
      <Text className="text-[19px] font-black text-[#2B2233]">
        Story đang khóa
      </Text>
      <Text className="mt-2 text-[15px] leading-6 text-[#6F657A]">
        Check-in tại hotspot trước, sau đó story từ API mới được hiển thị trên
        màn này.
      </Text>
      <Pressable
        className="mt-5 self-start rounded-full bg-[#FFF0F6] px-4 py-3"
        onPress={onBack}
      >
        <Text className="text-[14px] font-black text-[#EB489B]">
          Quay lại hotspot
        </Text>
      </Pressable>
    </View>
  );
}

export default function HotspotStoriesScreen() {
  const router = useRouter();
  const authSession = useAuthSession();
  const insets = useSafeAreaInsets();
  const checkedInHotspotSlugs = useCheckins();
  const checkedInApiHotspots = useCheckedInApiHotspots();
  const { hotspotId, routeId, slug } = useLocalSearchParams<{
    hotspotId?: string;
    routeId?: string;
    slug: string;
  }>();
  const resolvedSlug = Array.isArray(slug) ? (slug[0] ?? "") : (slug ?? "");
  const resolvedHotspotId = resolveSelectedHotspotId({
    hotspotId,
    slug: resolvedSlug,
  });
  const resolvedRouteId = resolveRouteIdParam(routeId);
  const cachedHotspotEntry = getCachedHotspotDetail({
    hotspotId: resolvedHotspotId,
    slug: resolvedSlug,
  });
  const hotspot = cachedHotspotEntry?.hotspot ?? getHotspotBySlug(resolvedSlug);
  const cachedStoriesEntry = getCachedHotspotStories({
    hotspotId: resolvedHotspotId,
    routeId: resolvedRouteId,
    slug: resolvedSlug,
  });
  const isCheckedIn =
    resolvedHotspotId === null
      ? true
      : checkedInApiHotspots.includes(resolvedHotspotId) ||
        checkedInHotspotSlugs.includes(resolvedSlug);
  const [activeTabId, setActiveTabId] = useState("");
  const [apiStoryCards, setApiStoryCards] = useState<
    HotspotThemeStory[] | null
  >(() => (isCheckedIn ? (cachedStoriesEntry?.stories ?? null) : null));
  const [isStoriesLoading, setIsStoriesLoading] = useState(
    () =>
      isCheckedIn && cachedStoriesEntry === null && resolvedHotspotId !== null,
  );
  const [storiesError, setStoriesError] = useState<string | null>(null);
  const [activeTags, setActiveTags] = useState<ActiveTagDto[]>([]);
  const fallbackStoryCards =
    hotspot && resolvedHotspotId === null
      ? buildHotspotThemeStories(hotspot)
      : [];
  const storyCards = apiStoryCards ?? fallbackStoryCards;
  const resolvedThemeTabs = buildStoryThemeTabsFromStories(storyCards, activeTags);
  const resolvedActiveTab =
    resolvedThemeTabs.find((tab) => tab.id === activeTabId) ??
    resolvedThemeTabs[0] ??
    null;

  useEffect(() => {
    let isActive = true;

    const loadActiveTags = async () => {
      try {
        const accessToken = authSession.isAuthenticated
          ? await getValidAccessToken()
          : null;
        const tags = await getActiveTags({
          accessToken,
          tokenType: authSession.tokenType,
        });

        if (!isActive) {
          return;
        }

        setActiveTags(tags);
      } catch (error) {
        console.warn("[hotspot-stories] load active tags failed", {
          error: error instanceof Error ? error.message : error,
          slug: resolvedSlug,
        });

        if (!isActive) {
          return;
        }

        setActiveTags([]);
      }
    };

    void loadActiveTags();

    return () => {
      isActive = false;
    };
  }, [authSession.isAuthenticated, authSession.tokenType, resolvedSlug]);

  useEffect(() => {
    if (!hotspot) {
      return;
    }

    const resolvedHotspot = hotspot;
    let isActive = true;

    const loadHotspotStories = async () => {
      const nextCachedStoriesEntry = getCachedHotspotStories({
        hotspotId: resolvedHotspotId,
        routeId: resolvedRouteId,
        slug: resolvedSlug,
      });

      if (!isCheckedIn && resolvedHotspotId !== null) {
        if (!isActive) {
          return;
        }

        setApiStoryCards(null);
        setIsStoriesLoading(false);
        setStoriesError(null);
        return;
      }

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
        const stories = await getUnlockedHotspotStories({
          accessToken,
          hotspotId: resolvedHotspotId,
          routeId: resolvedRouteId,
          tokenType: authSession.tokenType,
        });
        const mappedStories = buildHotspotThemeStoriesFromApi(
          resolvedHotspot,
          stories,
        );

        cacheHotspotStories({
          hotspotId: resolvedHotspotId,
          routeId: resolvedRouteId,
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
          routeId: resolvedRouteId,
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
            : "Không tải được story từ dữ liệu hotspot này.",
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
    isCheckedIn,
    resolvedHotspotId,
    resolvedRouteId,
    resolvedSlug,
  ]);

  if (!hotspot) {
    return <NotFoundState />;
  }

  const visibleStories =
    resolvedActiveTab === null
      ? storyCards
      : storyCards.filter(
          (item) =>
            buildStoryThemeLookupKey({
              label: item.tagLabel,
              tagId: item.tagId,
            }) === resolvedActiveTab.id,
        );
  const shouldShowLoadingState =
    isCheckedIn &&
    resolvedHotspotId !== null &&
    isStoriesLoading &&
    visibleStories.length === 0;

  if (shouldShowLoadingState) {
    return <AppLoadingScreen edges={["left", "right", "bottom"]} />;
  }

  return (
    <View className="flex-1" style={{ backgroundColor: pageBackground }}>
      <StatusBar style="dark" />

      <SafeAreaView
        className="flex-1"
        style={{ backgroundColor: pageBackground }}
        edges={["left", "right", "bottom"]}
      >
        <View
          className="border-b border-[#F2E8F7]"
          style={{
            backgroundColor: pageBackground,
            paddingHorizontal: ScreenHorizontalPadding,
            paddingTop: insets.top + 6,
          }}
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

            <Text className="text-[16px] font-black text-[#EB489B]">
              Câu chuyện
            </Text>

            <View className="h-11 w-11" />
          </View>

          {isCheckedIn || resolvedHotspotId === null ? (
            <>
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
                <View className="items-center pb-3 pt-2">
                  <ActivityIndicator color="#EB489B" size="small" />
                </View>
              ) : null}

              {storiesError ? (
                <Text className="pb-3 pt-2 text-[13px] font-medium text-[#D97706]">
                  {storiesError}
                </Text>
              ) : null}
            </>
          ) : (
            <Text className="pb-3 pt-2 text-[13px] font-medium text-[#A897B2]">
              Story sẽ mở sau khi bạn check-in hotspot này.
            </Text>
          )}
        </View>

        <ScrollView
          className="flex-1"
          contentContainerStyle={{
            paddingBottom: Math.max(insets.bottom + 30, 34),
            paddingHorizontal: ScreenHorizontalPadding,
            paddingTop: 18,
            rowGap: 18,
          }}
          showsVerticalScrollIndicator={false}
        >
          {!isCheckedIn && resolvedHotspotId !== null ? (
            <LockedStoriesState onBack={() => router.back()} />
          ) : visibleStories.length > 0 ? (
            visibleStories.map((story) => (
              <StoryCard
                key={story.id}
                item={story}
                onPress={() =>
                  router.push(
                    resolvedHotspotId !== null || resolvedRouteId !== null
                      ? ({
                          params: {
                            ...(resolvedHotspotId !== null
                              ? { hotspotId: `${resolvedHotspotId}` }
                              : {}),
                            ...(resolvedRouteId !== null
                              ? { routeId: `${resolvedRouteId}` }
                              : {}),
                            slug: hotspot.slug,
                            storyId: story.id,
                          },
                          pathname: "/hotspot/[slug]/stories/[storyId]",
                        } as Href)
                      : (`/hotspot/${hotspot.slug}/stories/${story.id}` as Href),
                  )
                }
              />
            ))
          ) : (
            <EmptyStoriesState
              message={
                resolvedActiveTab !== null
                  ? `Hotspot này chưa có story cho tag "${resolvedActiveTab.label}".`
                  : apiStoryCards !== null
                    ? "Hotspot này chưa có story để hiển thị."
                    : "Chưa có story phù hợp cho bộ lọc đang chọn."
              }
            />
          )}
        </ScrollView>
      </SafeAreaView>
    </View>
  );
}
