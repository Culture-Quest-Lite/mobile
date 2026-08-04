import { SymbolView } from "@/components/ui/symbol-view";
import {
  getValidAccessToken,
  useAuthSession,
} from "@/features/auth/hooks/use-auth-session";
import { getRouteById } from "@/features/route/api/route-api";
import { useScreenLayout } from "@/hooks/use-screen-layout";
import { Image } from "expo-image";
import { LinearGradient } from "expo-linear-gradient";
import { useLocalSearchParams, useRouter } from "expo-router";
import { useCallback, useEffect, useMemo, useState } from "react";
import {
  ActivityIndicator,
  Pressable,
  ScrollView,
  Text,
  View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

import { getStoryById } from "../api/get-story-by-id";
import { getTagById, getTagUsageRefIds, type TagDetailDto } from "../api/get-tag-by-id";
import {
  mapRouteDtoToThemeDetailRouteItem,
  mapStoryDtoToThemeDetailStoryItem,
  resolveThemeDetailModel,
  type ThemeDetailRouteItem,
  type ThemeDetailStoryItem,
} from "../lib/theme-detail";

type ThemeTab = "stories" | "routes";

const cardShadowStyle = {
  shadowColor: "rgba(193, 83, 124, 0.14)",
  shadowOpacity: 1,
  shadowRadius: 18,
  shadowOffset: {
    width: 0,
    height: 12,
  },
  elevation: 5,
} as const;

const softShadowStyle = {
  shadowColor: "rgba(31, 41, 64, 0.08)",
  shadowOpacity: 1,
  shadowRadius: 12,
  shadowOffset: {
    width: 0,
    height: 6,
  },
  elevation: 2,
} as const;

function StatChip({
  icon,
  label,
  value,
}: {
  icon: Parameters<typeof SymbolView>[0]["name"];
  label: string;
  value: string;
}) {
  return (
    <View className="shrink flex-row items-center justify-center gap-1 rounded-full border border-[#F6DCE8] bg-white px-2 py-1.5">
      <View className="h-[18px] w-[18px] items-center justify-center rounded-full bg-[#FFF1F6]">
        <SymbolView name={icon} size={10} tintColor="#E35C90" />
      </View>
      <View className="shrink flex-row items-center gap-1">
        <Text className="text-[10px] font-semibold leading-[11px] text-[#2B2233]">
          {value}
        </Text>
        <Text
          className="shrink text-[9px] font-medium leading-[11px] text-[#8E869A]"
          numberOfLines={1}
        >
          {label}
        </Text>
      </View>
    </View>
  );
}

function SegmentButton({
  active,
  label,
  onPress,
}: {
  active: boolean;
  label: string;
  onPress: () => void;
}) {
  return (
    <Pressable className="flex-1" onPress={onPress}>
      <View
        className="items-center px-2.5 py-2"
        style={{
          backgroundColor: active ? "#F8DDE9" : "transparent",
          borderRadius: 999,
          overflow: "hidden",
        }}
      >
        <Text
          className="text-[10px] leading-[11px]"
          style={{
            color: active ? "#D94F84" : "#7E7482",
            fontWeight: active ? "600" : "500",
          }}
        >
          {label}
        </Text>
      </View>
    </Pressable>
  );
}

function SectionHeader({
  icon,
  title,
}: {
  icon: Parameters<typeof SymbolView>[0]["name"];
  title: string;
}) {
  return (
    <View className="flex-row items-center gap-2">
      <View className="h-7 w-7 items-center justify-center rounded-full bg-[#FFF1F6]">
        <SymbolView name={icon} size={12} tintColor="#D95B8D" />
      </View>
      <Text className="text-[13px] font-semibold leading-[15px] text-[#2B2233]">
        {title}
      </Text>
    </View>
  );
}

function EmptySection({
  description,
  title,
}: {
  description: string;
  title: string;
}) {
  return (
    <View
      className="items-center rounded-[24px] border border-dashed border-[#F1DDE6] bg-[#FFF9FC] px-5 py-8"
      style={softShadowStyle}
    >
      <Text className="text-[15px] font-medium leading-[18px] text-[#2B2233]">
        {title}
      </Text>
      <Text className="mt-2 max-w-[280px] text-center text-[12px] font-medium leading-[16px] text-[#8E869A]">
        {description}
      </Text>
    </View>
  );
}

function RouteMetaChip({
  icon,
  label,
}: {
  icon: Parameters<typeof SymbolView>[0]["name"];
  label: string;
}) {
  return (
    <View className="flex-row items-center gap-1">
      <SymbolView name={icon} size={10} tintColor="#E5845E" />
      <Text className="text-[9px] font-medium leading-[10px] text-[#8E869A]">
        {label}
      </Text>
    </View>
  );
}

function FeaturedRouteCard({
  accent,
  item,
  onPress,
}: {
  accent: string;
  item: ThemeDetailRouteItem;
  onPress: () => void;
}) {
  return (
    <View
      className="overflow-hidden rounded-[22px] border border-[#F4E7EE] bg-white"
      style={cardShadowStyle}
    >
      {item.cover ? (
        <Image
          source={item.cover}
          contentFit="cover"
          style={{ height: 166, width: "100%" }}
          transition={180}
        />
      ) : null}

      <View className="min-w-0 px-2.5 pb-2.5 pt-2">
        <Text
          className="text-[13px] font-semibold leading-[15px] text-[#2B2233]"
          numberOfLines={2}
        >
          {item.title}
        </Text>
        {item.description ? (
          <Text
            className="mt-1 text-[11px] font-medium leading-[12px] text-[#807683]"
            numberOfLines={3}
          >
            {item.description}
          </Text>
        ) : null}

        <View className="mt-2 mb-2 flex-row flex-wrap items-center gap-x-2 gap-y-1">
          {item.tagName ? (
            <RouteMetaChip
              icon={{
                ios: "tag.fill",
                android: "sell",
                web: "sell",
              }}
              label={item.tagName}
            />
          ) : null}

          {item.duration ? (
            <RouteMetaChip
              icon={{
                ios: "clock.fill",
                android: "schedule",
                web: "schedule",
              }}
              label={item.duration}
            />
          ) : null}

          {item.distance ? (
            <RouteMetaChip
              icon={{
                ios: "figure.walk",
                android: "directions_walk",
                web: "directions_walk",
              }}
              label={item.distance}
            />
          ) : null}

          {item.stopCount > 0 ? (
            <RouteMetaChip
              icon={{
                ios: "mappin.and.ellipse",
                android: "place",
                web: "place",
              }}
              label={`${item.stopCount} địa điểm`}
            />
          ) : null}
        </View>

        <View className="items-end">
          <Pressable onPress={onPress}>
            <View
              className="items-center rounded-full px-4 py-2.5"
              style={{ backgroundColor: accent }}
            >
              <View className="flex-row items-center gap-2">
                <Text className="text-[11px] font-semibold leading-[12px] text-white">
                  Xem tuyến đường
                </Text>
                <SymbolView
                  name={{
                    ios: "chevron.right",
                    android: "chevron_right",
                    web: "chevron_right",
                  }}
                  size={11}
                  tintColor="#FFFFFF"
                />
              </View>
            </View>
          </Pressable>
        </View>
      </View>
    </View>
  );
}

function RelatedStoryCard({
  item,
  onPress,
}: {
  item: ThemeDetailStoryItem;
  onPress: () => void;
}) {
  return (
    <Pressable onPress={onPress}>
      <View
        className="flex-row items-stretch overflow-hidden rounded-[18px] border border-[#F4E7EE] bg-white"
        style={[softShadowStyle, { minHeight: 90 }]}
      >
        {item.imageUri ? (
          <Image
            source={item.imageUri}
            contentFit="cover"
            style={{ height: "100%", width: 138 }}
            transition={180}
          />
        ) : null}

        <View className="min-w-0 flex-1 justify-center px-2.5 py-2">
          <View className="mb-0.5 flex-row items-start justify-between gap-2">
            <Text
              className="flex-1 text-[12px] font-semibold leading-[13px] text-[#2B2233]"
              numberOfLines={1}
            >
              {item.title}
            </Text>

            {item.category ? (
              <View className="rounded-full bg-[#FFF1F6] px-2 py-1">
                <Text className="text-[8px] font-medium leading-[9px] text-[#D95B8D]">
                  {item.category}
                </Text>
              </View>
            ) : null}
          </View>

          {item.hotspotName ? (
            <View className="mb-0.5 flex-row items-center gap-1">
              <SymbolView
                name={{
                  ios: "mappin.and.ellipse",
                  android: "place",
                  web: "place",
                }}
                size={10}
                tintColor="#E28A4A"
              />
              <Text
                className="flex-1 text-[9px] font-medium leading-[10px] text-[#8E869A]"
                numberOfLines={1}
              >
                {item.hotspotName}
              </Text>
            </View>
          ) : null}

          {item.content ? (
            <Text
              className="text-[10px] font-medium leading-[11px] text-[#7B7287]"
              numberOfLines={2}
            >
              {item.content}
            </Text>
          ) : null}
        </View>
      </View>
    </Pressable>
  );
}

export default function ThemeDetailScreen() {
  const router = useRouter();
  const authSession = useAuthSession();
  const { gutter, safeWidth } = useScreenLayout();
  const [activeTab, setActiveTab] = useState<ThemeTab>("stories");
  const [tagDetail, setTagDetail] = useState<TagDetailDto | null>(null);
  const [routeItems, setRouteItems] = useState<ThemeDetailRouteItem[]>([]);
  const [storyItems, setStoryItems] = useState<ThemeDetailStoryItem[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [loadError, setLoadError] = useState<string | null>(null);
  const params = useLocalSearchParams<{
    accent?: string;
    background?: string;
    imageUrl?: string;
    slug?: string;
    tagId?: string;
    title?: string;
  }>();

  const resolvedTagId = useMemo(() => {
    const parsedTagId = Number(params.tagId ?? Number.NaN);

    return Number.isInteger(parsedTagId) && parsedTagId > 0 ? parsedTagId : null;
  }, [params.tagId]);

  const themeTitle = useMemo(() => {
    const explicitTitle = params.title?.trim();

    if (explicitTitle) {
      return explicitTitle;
    }

    return params.slug?.replace(/-/g, " ").trim() || "Chủ đề";
  }, [params.slug, params.title]);

  const loadThemeDetail = useCallback(async () => {
    if (resolvedTagId === null) {
      setLoadError("Không xác định được chủ đề cần xem.");
      return;
    }

    setIsLoading(true);
    setLoadError(null);

    try {
      const accessToken = authSession.isAuthenticated
        ? await getValidAccessToken()
        : null;
      const tokenType = authSession.tokenType;
      const tag = await getTagById({
        accessToken,
        tagId: resolvedTagId,
        tokenType,
      });

      setTagDetail(tag);

      const [routeResults, storyResults] = await Promise.all([
        Promise.allSettled(
          getTagUsageRefIds(tag, "ROUTE").map((routeId) =>
            getRouteById({ accessToken, routeId, tokenType }),
          ),
        ),
        Promise.allSettled(
          getTagUsageRefIds(tag, "STORY").map((storyId) =>
            getStoryById({ accessToken, storyId, tokenType }),
          ),
        ),
      ]);

      setRouteItems(
        routeResults
          .filter((result) => result.status === "fulfilled")
          .map((result) => mapRouteDtoToThemeDetailRouteItem(result.value)),
      );
      setStoryItems(
        storyResults
          .filter((result) => result.status === "fulfilled")
          .map((result) => mapStoryDtoToThemeDetailStoryItem(result.value)),
      );
    } catch (error) {
      console.warn("[home] load theme detail failed", {
        error: error instanceof Error ? error.message : error,
        tagId: resolvedTagId,
      });
      setTagDetail(null);
      setRouteItems([]);
      setStoryItems([]);
      setLoadError(
        error instanceof Error
          ? error.message
          : "Không thể tải dữ liệu chủ đề này.",
      );
    } finally {
      setIsLoading(false);
    }
  }, [authSession.isAuthenticated, authSession.tokenType, resolvedTagId]);

  useEffect(() => {
    let isActive = true;

    void (async () => {
      await loadThemeDetail();

      if (!isActive) {
        return;
      }
    })();

    return () => {
      isActive = false;
    };
  }, [loadThemeDetail]);

  const themeModel = useMemo(
    () =>
      resolveThemeDetailModel({
        accent: params.accent,
        background: params.background,
        imageUrl: params.imageUrl,
        tag: tagDetail,
        title: themeTitle,
      }),
    [params.accent, params.background, params.imageUrl, tagDetail, themeTitle],
  );

  const featuredRoute = routeItems[0] ?? null;
  const visibleStories = storyItems.slice(0, 4);
  const shouldShowRoutes = activeTab === "routes";
  const shouldShowStories = activeTab === "stories";
  const heroCardWidth = Math.min(safeWidth - gutter * 2, 540);

  return (
    <SafeAreaView
      className="flex-1 bg-[#FFFCFD]"
      edges={["top", "left", "right", "bottom"]}
    >
      <ScrollView
        className="flex-1"
        contentContainerStyle={{ paddingBottom: 28 }}
        showsVerticalScrollIndicator={false}
      >
        <View className="px-4 pt-2">
          <View className="flex-row items-center justify-between">
            <Pressable
              className="h-11 w-11 items-center justify-center rounded-full bg-white"
              hitSlop={8}
              onPress={() => router.back()}
              style={softShadowStyle}
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

            <Text className="px-4 text-[17px] font-medium leading-[20px] text-[#2B2233]">
              {themeTitle}
            </Text>

            <View className="h-11 w-11" />
          </View>
        </View>

        <View className="mt-4 px-4">
          <LinearGradient
            colors={["#FFFFFF", themeModel.background]}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 1 }}
            className="overflow-hidden rounded-[26px] border border-[#F7E7EE] px-3 py-3.5"
            style={[cardShadowStyle, { alignSelf: "center", width: heroCardWidth }]}
          >
            {themeModel.heroImageUrl ? (
              <Image
                source={themeModel.heroImageUrl}
                contentFit="cover"
                style={{
                  height: 138,
                  opacity: 0.08,
                  position: "absolute",
                  right: -12,
                  top: 10,
                  width: 138,
                }}
                transition={180}
              />
            ) : null}

            <View className="flex-row items-center gap-3">
              <View
                className="h-[92px] w-[92px] items-center justify-center overflow-hidden rounded-full border-2 border-white bg-white"
                style={softShadowStyle}
              >
                {themeModel.heroImageUrl ? (
                  <Image
                    source={themeModel.heroImageUrl}
                    contentFit="cover"
                    style={{ height: "100%", width: "100%" }}
                    transition={180}
                  />
                ) : (
                  <View
                    className="h-full w-full items-center justify-center rounded-full"
                    style={{
                      backgroundColor: themeModel.background,
                    }}
                  >
                    <SymbolView
                      name={themeModel.icon}
                      size={34}
                      tintColor={themeModel.accent}
                    />
                  </View>
                )}
              </View>

              <View className="min-w-0 flex-1 items-center pr-1">
                <Text className="text-[21px] font-semibold leading-[23px] text-[#3A2230]">
                  {themeModel.title}
                </Text>
                <View className="mt-[11px] w-full flex-row items-center justify-center gap-1.5">
                  <StatChip
                    icon={{
                      ios: "map",
                      android: "map",
                      web: "map",
                    }}
                    label="Tuyến đường"
                    value={`${themeModel.routeCount}`}
                  />
                  <StatChip
                    icon={{
                      ios: "mappin.and.ellipse",
                      android: "place",
                      web: "place",
                    }}
                    label="Câu chuyện"
                    value={`${themeModel.storyCount}`}
                  />
                </View>
              </View>
            </View>
          </LinearGradient>
        </View>

        <View className="mt-4 px-4">
          <View
            className="flex-row border border-[#F2E6EC] bg-white p-1"
            style={[softShadowStyle, { borderRadius: 999, overflow: "hidden" }]}
          >
            <SegmentButton
              active={activeTab === "stories"}
              label="Câu chuyện"
              onPress={() => setActiveTab("stories")}
            />
            <SegmentButton
              active={activeTab === "routes"}
              label="Tuyến đường"
              onPress={() => setActiveTab("routes")}
            />
          </View>
        </View>

        <View className="mt-5 gap-5 px-4">
          {isLoading ? (
            <View
              className="items-center rounded-[24px] border border-[#F4E7EE] bg-white px-5 py-8"
              style={softShadowStyle}
            >
              <ActivityIndicator color={themeModel.accent} />
              <Text className="mt-3 text-[12px] font-medium leading-[14px] text-[#8E869A]">
                Đang tải dữ liệu chủ đề...
              </Text>
            </View>
          ) : null}

          {!isLoading && loadError ? (
            <Pressable onPress={() => void loadThemeDetail()}>
              <View
                className="items-center rounded-[24px] border border-[#F4D5E1] bg-white px-5 py-8"
                style={softShadowStyle}
              >
                <Text className="text-[13px] font-semibold leading-[16px] text-[#2B2233]">
                  Không tải được chủ đề
                </Text>
                <Text className="mt-2 max-w-[280px] text-center text-[12px] font-medium leading-[16px] text-[#8E869A]">
                  {loadError}
                </Text>
                <Text className="mt-3 text-[12px] font-semibold leading-[14px] text-[#EB5D8F]">
                  Thử lại
                </Text>
              </View>
            </Pressable>
          ) : null}

          {!isLoading && !loadError && shouldShowRoutes ? (
            <View className="gap-3">
              <SectionHeader
                icon={{
                  ios: "map",
                  android: "map",
                  web: "map",
                }}
                title="Tuyến đường nổi bật"
              />

              {featuredRoute ? (
                <FeaturedRouteCard
                  accent={themeModel.accent}
                  item={featuredRoute}
                  onPress={() => router.push(featuredRoute.href)}
                />
              ) : (
                <EmptySection
                  description="Hiện chưa có tuyến đường phù hợp cho chủ đề này."
                  title="Chưa có tuyến đường phù hợp"
                />
              )}
            </View>
          ) : null}

          {!isLoading && !loadError && shouldShowStories ? (
            <View className="gap-3">
              <SectionHeader
                icon={{
                  ios: "book.closed.fill",
                  android: "menu_book",
                  web: "menu_book",
                }}
                title="Câu chuyện liên quan"
              />

              {visibleStories.length > 0 ? (
                <View className="gap-2.5">
                  {visibleStories.map((item) => (
                    <RelatedStoryCard
                      key={item.storyId}
                      item={item}
                      onPress={() => {
                        if (item.href) {
                          router.push(item.href);
                        }
                      }}
                    />
                  ))}
                </View>
              ) : (
                <EmptySection
                  description="Chưa tìm thấy câu chuyện khớp với chủ đề này. Bạn có thể quay lại trang chính để chọn chủ đề khác."
                  title="Chưa có câu chuyện phù hợp"
                />
              )}
            </View>
          ) : null}
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}
