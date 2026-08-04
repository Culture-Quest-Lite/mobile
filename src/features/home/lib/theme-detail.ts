import type { Href } from "expo-router";

import {
  getRouteCoverUrl,
  type RouteDto,
} from "@/features/route/api/route-api";

import type { StoryDto } from "../api/get-story-by-id";
import type { TagDetailDto } from "../api/get-tag-by-id";
import { getApiHotspotRouteSlug } from "../data/hotspots";
import { type SymbolName } from "../data/home-screen.mock";

type ThemePreset = {
  accent: string;
  background: string;
  icon: SymbolName;
  softBackground: string;
  summary: string;
};

export type ThemeDetailRouteItem = {
  cover: string | null;
  description: string;
  distance: string;
  duration: string;
  href: Href;
  routeId: number;
  stopCount: number;
  tagName: string;
  title: string;
};

export type ThemeDetailStoryItem = {
  category: string | null;
  content: string;
  hotspotName: string;
  href: Href | null;
  imageUri: string | null;
  storyId: number;
  title: string;
};

export type ThemeDetailModel = ThemePreset & {
  heroImageUrl: string | null;
  hotspotCount: number;
  routeCount: number;
  storyCount: number;
  title: string;
};

const defaultThemePreset: ThemePreset = {
  accent: "#D95B8D",
  background: "#FFF3F8",
  icon: {
    ios: "sparkles",
    android: "auto_awesome",
    web: "auto_awesome",
  },
  softBackground: "#FFF9FC",
  summary: "Khám phá các địa điểm, tuyến đường và câu chuyện nổi bật theo chủ đề này.",
};

const themePresets: Record<string, ThemePreset> = {
  "am thuc": {
    accent: "#C96A00",
    background: "#FFF2DF",
    icon: { ios: "fork.knife", android: "restaurant", web: "restaurant" },
    softBackground: "#FFF8F0",
    summary: "Khám phá các điểm dừng mang nhịp sống ẩm thực, chợ địa phương và những câu chuyện quanh món ăn.",
  },
  "check in": {
    accent: "#2563EB",
    background: "#E8F1FF",
    icon: { ios: "camera.fill", android: "photo_camera", web: "photo_camera" },
    softBackground: "#F6F9FF",
    summary: "Các điểm dừng giàu chất thị giác, dễ ghé nhanh và phù hợp để lưu lại khoảnh khắc đẹp.",
  },
  "di san": {
    accent: "#7C3AED",
    background: "#F1E9FF",
    icon: {
      ios: "building.columns.fill",
      android: "account_balance",
      web: "account_balance",
    },
    softBackground: "#FAF7FF",
    summary: "Những công trình và địa điểm mang dấu ấn di sản, giúp bạn đọc lại các lớp ký ức đô thị.",
  },
  "giao duc": {
    accent: "#2563EB",
    background: "#E4F0FF",
    icon: { ios: "book.closed.fill", android: "menu_book", web: "menu_book" },
    softBackground: "#F7FAFF",
    summary: "Các điểm đến giàu thông tin, phù hợp để vừa tham quan vừa tiếp cận thêm bối cảnh và tri thức địa phương.",
  },
  "kien truc": {
    accent: "#B83280",
    background: "#FFE5F0",
    icon: {
      ios: "building.2.fill",
      android: "architecture",
      web: "architecture",
    },
    softBackground: "#FFF8FB",
    summary: "Khám phá những địa điểm và lộ trình mang dấu ấn kiến trúc, từ công trình biểu tượng đến các lớp không gian đô thị.",
  },
  "lich su": {
    accent: "#D95C22",
    background: "#FFEBDD",
    icon: { ios: "clock.arrow.circlepath", android: "history", web: "history" },
    softBackground: "#FFF9F5",
    summary: "Đi qua các mốc thời gian, di tích và lớp ký ức giúp hành trình có chiều sâu hơn.",
  },
  "nghe thuat": {
    accent: "#0D8C7D",
    background: "#E3FAF4",
    icon: { ios: "paintpalette.fill", android: "palette", web: "palette" },
    softBackground: "#F6FCFA",
    summary: "Các không gian giàu chất thị giác, triển lãm và trải nghiệm sáng tạo để đi chậm và cảm nhận kỹ hơn.",
  },
  "thien nhien": {
    accent: "#2F855A",
    background: "#E7F9EC",
    icon: { ios: "leaf.fill", android: "park", web: "park" },
    softBackground: "#F6FCF8",
    summary: "Những điểm dừng thoáng hơn, xanh hơn và hợp cho các hành trình ưu tiên cảnh quan, không khí và trải nghiệm ngoài trời.",
  },
  "van hoa": {
    accent: "#B45309",
    background: "#FFF3DE",
    icon: {
      ios: "theatermasks.fill",
      android: "theater_comedy",
      web: "theater_comedy",
    },
    softBackground: "#FFF9F1",
    summary: "Các địa điểm gắn với cộng đồng, tín ngưỡng và nhịp sống bản địa, phù hợp cho hành trình giàu câu chuyện văn hóa.",
  },
};

function readMeaningfulText(value?: string | null) {
  const trimmedValue = value?.trim();
  return trimmedValue ? trimmedValue : null;
}

export function normalizeThemeKey(value: string) {
  return value
    .trim()
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9]+/g, " ")
    .trim();
}

export function createThemeSlug(value: string) {
  return normalizeThemeKey(value).replace(/\s+/g, "-");
}

export function getThemeDetailHref({
  accent,
  background,
  imageUrl,
  tagId,
  title,
}: {
  accent: string;
  background: string;
  imageUrl?: string | null;
  tagId?: number | null;
  title: string;
}) {
  const params: Record<string, string> = {
    accent,
    background,
    slug: createThemeSlug(title),
    title,
  };

  const resolvedImageUrl = readMeaningfulText(imageUrl);

  if (resolvedImageUrl) {
    params.imageUrl = resolvedImageUrl;
  }

  if (typeof tagId === "number" && Number.isInteger(tagId) && tagId > 0) {
    params.tagId = `${tagId}`;
  }

  return {
    params,
    pathname: "/theme/[slug]",
  } as unknown as Href;
}

function resolveThemePreset(themeTitle: string) {
  const normalizedThemeTitle = normalizeThemeKey(themeTitle);

  for (const [groupKey, preset] of Object.entries(themePresets)) {
    if (normalizedThemeTitle.includes(groupKey) || groupKey.includes(normalizedThemeTitle)) {
      return preset;
    }
  }

  return defaultThemePreset;
}

export function mapRouteDtoToThemeDetailRouteItem(
  route: RouteDto,
): ThemeDetailRouteItem {
  return {
    cover: readMeaningfulText(getRouteCoverUrl(route)),
    description: route.description.trim(),
    distance: route.totalDistance ? `${route.totalDistance} km` : "",
    duration: route.estimateTime ? `${route.estimateTime} phút` : "",
    href: `/route/${route.routeId}` as Href,
    routeId: route.routeId,
    stopCount: route.hotspots.length,
    tagName: readMeaningfulText(route.tags[0]?.tagName) ?? "",
    title: route.routeName,
  };
}

export function mapStoryDtoToThemeDetailStoryItem(
  story: StoryDto,
): ThemeDetailStoryItem {
  const imageUri =
    story.medias
      .filter((media) => !media.mediaType.toUpperCase().includes("AUDIO"))
      .map((media) => readMeaningfulText(media.fileUrl))
      .find(Boolean) ?? null;
  const href =
    story.hotspotId !== null
      ? ({
          params: {
            hotspotId: `${story.hotspotId}`,
            slug: getApiHotspotRouteSlug(story.hotspotId),
            storyId: `${story.storyId}`,
          },
          pathname: "/hotspot/[slug]/stories/[storyId]",
        } as Href)
      : null;

  return {
    category: readMeaningfulText(story.tag?.tagName),
    content: story.content.trim(),
    hotspotName: story.hotspotName.trim(),
    href,
    imageUri,
    storyId: story.storyId,
    title: story.title.trim(),
  };
}

export function resolveThemeDetailModel({
  accent,
  background,
  imageUrl,
  tag,
  title,
}: {
  accent?: string | null;
  background?: string | null;
  imageUrl?: string | null;
  tag?: TagDetailDto | null;
  title: string;
}): ThemeDetailModel {
  const resolvedTitle = readMeaningfulText(tag?.tagName) ?? title;
  const preset = resolveThemePreset(resolvedTitle);

  return {
    accent: readMeaningfulText(accent) ?? preset.accent,
    background: readMeaningfulText(background) ?? preset.background,
    heroImageUrl: readMeaningfulText(tag?.imageUrl) ?? readMeaningfulText(imageUrl),
    hotspotCount: tag?.hotspotCount ?? 0,
    icon: preset.icon,
    routeCount: tag?.routeCount ?? 0,
    softBackground: preset.softBackground,
    storyCount: tag?.storyCount ?? 0,
    summary: preset.summary,
    title: resolvedTitle,
  };
}
