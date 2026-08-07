import { SymbolView } from "@/components/ui/symbol-view";
import {
  getValidAccessToken,
  useAuthSession,
} from "@/features/auth/hooks/use-auth-session";
import { useScreenLayout } from "@/hooks/use-screen-layout";
import { Image } from "expo-image";
import { type Href, useRouter } from "expo-router";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  ActivityIndicator,
  Pressable,
  RefreshControl,
  ScrollView,
  Text,
  TextInput,
  View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

import { AppLoadingScreen } from "@/components/ui/app-loading-screen";
import { getActiveTags } from "../api/get-tags";
import { getTagById } from "../api/get-tag-by-id";
import {
  mapActiveTagsToThemeCategories,
  normalizeThemeLookupText,
  type ThemeCategoryCardModel,
} from "../lib/theme-categories";
import { getThemeDetailHref } from "../lib/theme-detail";

const themeListBackgroundImage = require("../../../../assets/images/nenan.png");

type ThemeListItem = ThemeCategoryCardModel & {
  hotspotCount: number | null;
  routeCount: number | null;
  storyCount: number | null;
};

const cardShadowStyle = {
  shadowColor: "rgba(31, 41, 64, 0.08)",
  shadowOpacity: 1,
  shadowRadius: 16,
  shadowOffset: {
    width: 0,
    height: 8,
  },
  elevation: 4,
} as const;

const softShadowStyle = {
  shadowColor: "rgba(217, 91, 141, 0.08)",
  shadowOpacity: 1,
  shadowRadius: 12,
  shadowOffset: {
    width: 0,
    height: 6,
  },
  elevation: 2,
} as const;

function buildThemeListItems(themeCards: ThemeCategoryCardModel[]): ThemeListItem[] {
  return themeCards.map((item) => ({
    ...item,
    hotspotCount: null,
    routeCount: null,
    storyCount: null,
  }));
}

function formatThemeCount(value: number | null, label: string) {
  if (typeof value !== "number" || !Number.isFinite(value)) {
    return null;
  }

  return `${Math.max(0, Math.round(value))} ${label}`;
}

function buildThemeMetaLabel(item: ThemeListItem) {
  const pieces = [
    formatThemeCount(item.hotspotCount, "địa điểm"),
    formatThemeCount(item.routeCount, "lộ trình"),
    formatThemeCount(item.storyCount, "câu chuyện"),
  ].filter((value): value is string => Boolean(value));

  return pieces.join(" • ");
}

function SearchEmptyState({ query }: { query: string }) {
  return (
    <View
      className="items-center rounded-[28px] border border-dashed border-[#EEDAE4] bg-white px-5 py-10"
      style={softShadowStyle}
    >
      <View className="h-14 w-14 items-center justify-center rounded-full bg-[#FFF2F7]">
        <SymbolView
          name={{ ios: "magnifyingglass", android: "search", web: "search" }}
          size={22}
          tintColor="#D95B8D"
        />
      </View>
      <Text className="mt-4 text-center text-[15px] font-semibold leading-[18px] text-[#2B2233]">
        Không tìm thấy chủ đề phù hợp
      </Text>
      <Text className="mt-2 max-w-[280px] text-center text-[12px] leading-[17px] text-[#7E7482]">
        Không có tag nào khớp với từ khóa{" "}
        <Text className="font-semibold text-[#5C5163]">{query.trim()}</Text>.
        Hãy thử một tên chủ đề khác.
      </Text>
    </View>
  );
}

function ThemeListCard({
  item,
  onPress,
}: {
  item: ThemeListItem;
  onPress: () => void;
}) {
  const metaLabel = buildThemeMetaLabel(item);

  return (
    <Pressable onPress={onPress}>
      <View
        className="rounded-[22px] border border-[#F3E7EC] bg-white px-3.5 py-3"
        style={cardShadowStyle}
      >
        <View className="flex-row items-center gap-2.5">
          <View
            className="h-[72px] w-[72px] items-center justify-center overflow-hidden rounded-full border border-[#F5ECF1] bg-[#FFFCFD]"
            style={softShadowStyle}
          >
            {item.imageUrl ? (
              <Image
                source={item.imageUrl}
                contentFit="cover"
                transition={180}
                style={{ height: "100%", width: "100%" }}
              />
            ) : (
              <View
                className="items-center justify-center rounded-full"
                style={{
                  backgroundColor: item.background,
                  height: 54,
                  width: 54,
                }}
              >
                <SymbolView name={item.icon} size={24} tintColor={item.accent} />
              </View>
            )}
          </View>

          <View className="min-w-0 flex-1 pr-1">
            <Text
              className="text-[14px] font-normal leading-[15px] text-[#2B2233]"
              numberOfLines={1}
            >
              {item.label}
            </Text>
            {metaLabel ? (
              <Text
                className="mt-0.5 text-[11px] font-normal leading-[11px] text-[#7F7380]"
                numberOfLines={1}
              >
                {metaLabel}
              </Text>
            ) : null}
          </View>
        </View>
      </View>
    </Pressable>
  );
}

export default function ThemeListScreen() {
  const router = useRouter();
  const authSession = useAuthSession();
  const { gutter, insets } = useScreenLayout({ maxContentWidth: 640 });
  const [themeItems, setThemeItems] = useState<ThemeListItem[]>([]);
  const [searchQuery, setSearchQuery] = useState("");
  const [isLoading, setIsLoading] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [loadError, setLoadError] = useState<string | null>(null);
  const requestRef = useRef(0);

  const loadThemes = useCallback(
    async (options?: { refresh?: boolean }) => {
      const requestId = requestRef.current + 1;
      requestRef.current = requestId;
      const isActive = () => requestRef.current === requestId;

      if (options?.refresh) {
        setIsRefreshing(true);
      } else {
        setIsLoading(true);
      }

      setLoadError(null);

      try {
        const accessToken = authSession.isAuthenticated
          ? await getValidAccessToken()
          : null;

        if (!isActive()) {
          return;
        }

        const tags = await getActiveTags({
          accessToken,
          tokenType: authSession.tokenType,
        });

        if (!isActive()) {
          return;
        }

        const baseItems = buildThemeListItems(mapActiveTagsToThemeCategories(tags));

        const detailResults = await Promise.allSettled(
          baseItems.map((item) =>
            typeof item.tagId === "number" && item.tagId > 0
              ? getTagById({
                  accessToken,
                  tagId: item.tagId,
                  tokenType: authSession.tokenType,
                })
              : Promise.resolve(null),
          ),
        );

        if (!isActive()) {
          return;
        }

        const detailById = new Map<
          number,
          {
            hotspotCount: number;
            imageUrl: string | null;
            routeCount: number;
            storyCount: number;
            tagName: string;
          }
        >();

        detailResults.forEach((result, index) => {
          const tagId = baseItems[index]?.tagId;

          if (
            result.status !== "fulfilled" ||
            typeof tagId !== "number" ||
            tagId <= 0 ||
            !result.value
          ) {
            return;
          }

          detailById.set(tagId, {
            hotspotCount: result.value.hotspotCount,
            imageUrl: result.value.imageUrl,
            routeCount: result.value.routeCount,
            storyCount: result.value.storyCount,
            tagName: result.value.tagName,
          });
        });

        if (detailById.size === 0) {
          setThemeItems(baseItems);
          return;
        }

        setThemeItems(
          baseItems.map((item) => {
            if (typeof item.tagId !== "number" || item.tagId <= 0) {
              return item;
            }

            const detail = detailById.get(item.tagId);

            if (!detail) {
              return item;
            }

            return {
              ...item,
              hotspotCount: detail.hotspotCount,
              imageUrl: detail.imageUrl ?? item.imageUrl,
              label: detail.tagName || item.label,
              routeCount: detail.routeCount,
              storyCount: detail.storyCount,
            };
          }),
        );
      } catch (error) {
        console.warn("[home] load theme list failed", {
          error: error instanceof Error ? error.message : error,
        });

        if (!isActive()) {
          return;
        }

        setLoadError(
          error instanceof Error
            ? error.message
            : "Không thể tải danh sách chủ đề.",
        );
        setThemeItems([]);
      } finally {
        if (!isActive()) {
          return;
        }

        setIsLoading(false);
        setIsRefreshing(false);
      }
    },
    [authSession.isAuthenticated, authSession.tokenType],
  );

  useEffect(() => {
    async function runThemeLoad() {
      await loadThemes();
    }

    void runThemeLoad();
  }, [loadThemes]);

  const filteredThemes = useMemo(() => {
    const normalizedQuery = normalizeThemeLookupText(searchQuery);

    if (!normalizedQuery) {
      return themeItems;
    }

    return themeItems.filter((item) => {
      const searchTarget = normalizeThemeLookupText(item.label);

      return searchTarget.includes(normalizedQuery);
    });
  }, [searchQuery, themeItems]);

  const hasSearchQuery = searchQuery.trim().length > 0;

  if (isLoading && themeItems.length === 0 && !loadError) {
    return (
      <AppLoadingScreen
        edges={["left", "right", "bottom"]}
        message="Đang tải danh sách chủ đề..."
      />
    );
  }

  return (
    <SafeAreaView
      className="flex-1"
      edges={["left", "right", "bottom"]}
    >
      <View className="flex-1">
        <Image
          source={themeListBackgroundImage}
          contentFit="cover"
          style={{ height: "100%", left: 0, position: "absolute", top: 0, width: "100%" }}
        />

        <ScrollView
          className="flex-1"
          contentContainerStyle={{ paddingBottom: 28 }}
          keyboardShouldPersistTaps="handled"
          refreshControl={
            <RefreshControl
              colors={["#EB489B", "#F58752", "#FFC93C"]}
              onRefresh={() => void loadThemes({ refresh: true })}
              progressBackgroundColor="#FFFFFF"
              refreshing={isRefreshing}
              tintColor="#D95B8D"
              title="Đang cập nhật..."
              titleColor="#8E869A"
            />
          }
          showsVerticalScrollIndicator={false}
        >
          <View
            className="overflow-hidden px-4 pb-3"
            style={{ paddingTop: insets.top + 2 }}
          >
            <View className="flex-row items-center justify-between">
              <Pressable
                className="h-11 w-11 items-center justify-center rounded-full bg-transparent"
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
                  tintColor="#2B2233"
                />
              </Pressable>

              <Text className="px-4 text-[18px] font-medium leading-[19px] text-[#2B2233]">
                Chủ đề
              </Text>

              <View className="h-11 w-11" />
            </View>

            <View className="mt-0.5 items-center">
              <Text
                className="max-w-[250px] text-center text-[12px] font-normal leading-[12px] text-[#7E7482]"
                numberOfLines={2}
              >
                Khám phá các chủ đề đa dạng về văn hóa, lịch sử và trải nghiệm
              </Text>
            </View>

            <View
              className="mt-4 flex-row items-center rounded-[18px] border border-[#F1DCE5] bg-[#FFF1F6] px-3.5"
              style={[softShadowStyle, { height: 48 }]}
            >
              <SymbolView
                name={{ ios: "magnifyingglass", android: "search", web: "search" }}
                size={16}
                tintColor="#9A91A1"
              />
              <TextInput
                className="ml-2.5 flex-1 py-0 text-[14px] leading-[16px] text-[#2B2233]"
                onChangeText={setSearchQuery}
                placeholder="Tìm chủ đề hoặc tag"
                placeholderTextColor="#A59BA8"
                returnKeyType="search"
                value={searchQuery}
              />
              {hasSearchQuery ? (
                <Pressable hitSlop={8} onPress={() => setSearchQuery("")}>
                  <SymbolView
                    name={{ ios: "xmark.circle.fill", android: "close", web: "close" }}
                    size={16}
                    tintColor="#B5AAB7"
                  />
                </Pressable>
              ) : null}
            </View>
          </View>

          <View
            className="px-4 pt-4"
            style={{ paddingHorizontal: gutter }}
          >
            <Text className="text-[16px] font-medium leading-[17px] text-[#2B2233]">
              Tất cả chủ đề ({themeItems.length})
            </Text>
          </View>

          <View
            className="gap-3.5 px-4 pt-4"
            style={{ paddingHorizontal: gutter }}
          >
            {isLoading ? (
              <View
                className="items-center rounded-[28px] border border-[#F2E7EC] bg-white/96 px-5 py-10"
                style={softShadowStyle}
              >
                <ActivityIndicator color="#D95B8D" />
                <Text className="mt-3 text-[12px] font-medium leading-[15px] text-[#7E7482]">
                  Đang tải danh sách chủ đề...
                </Text>
              </View>
            ) : null}

            {!isLoading && loadError ? (
              <Pressable onPress={() => void loadThemes()}>
                <View
                  className="items-center rounded-[28px] border border-[#F2D9E2] bg-white/96 px-5 py-8"
                  style={softShadowStyle}
                >
                  <Text className="text-[14px] font-semibold leading-[18px] text-[#2B2233]">
                    Không tải được danh sách chủ đề
                  </Text>
                  <Text className="mt-2 text-center text-[12px] leading-[17px] text-[#7E7482]">
                    {loadError}
                  </Text>
                  <Text className="mt-3 text-[12px] font-semibold leading-[15px] text-[#D95B8D]">
                    Thử lại
                  </Text>
                </View>
              </Pressable>
            ) : null}

            {!isLoading && !loadError && filteredThemes.length === 0 ? (
              <SearchEmptyState query={searchQuery} />
            ) : null}

            {!isLoading && !loadError && filteredThemes.length > 0
              ? filteredThemes.map((item) => (
                  <ThemeListCard
                    key={`${item.tagId ?? item.label}-${item.label}`}
                    item={item}
                    onPress={() =>
                      router.push(
                        getThemeDetailHref({
                          accent: item.accent,
                          background: item.background,
                          imageUrl: item.imageUrl,
                          tagId: item.tagId,
                          title: item.label,
                        }),
                      )
                    }
                  />
                ))
              : null}
          </View>

          <Pressable
            className="mx-4 mt-5 items-center rounded-full border border-[#F0DCE5] bg-white/96 px-4 py-3"
            onPress={() => router.replace("/home" as Href)}
            style={[softShadowStyle, { marginHorizontal: gutter }]}
          >
            <Text className="text-[12px] font-semibold leading-[15px] text-[#D95B8D]">
              Quay lại trang chủ
            </Text>
          </Pressable>
        </ScrollView>
      </View>
    </SafeAreaView>
  );
}
