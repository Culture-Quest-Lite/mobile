import { SymbolView } from "expo-symbols";
import { type ComponentProps } from "react";

import type { HotspotDetail } from "./hotspots";

type SymbolName = ComponentProps<typeof SymbolView>["name"];

export type HotspotStoryFilterId = "all" | "audio" | "history" | "tips" | "route";
export type HotspotStoryItem = {
  body: string;
  filterId: Exclude<HotspotStoryFilterId, "all">;
  icon: SymbolName;
  id: string;
  imageUri: string;
  metaLabel: string;
  pillLabel: string;
  title: string;
};

export const hotspotStoryFilters: {
  id: HotspotStoryFilterId;
  label: string;
}[] = [
  { id: "all", label: "Tất cả" },
  { id: "audio", label: "Audio" },
  { id: "history", label: "Lịch sử" },
  { id: "tips", label: "Mẹo" },
  { id: "route", label: "Route" },
];

export function getHotspotStoryPreview(text: string, maxLength = 148) {
  const trimmed = text.trim();

  if (trimmed.length <= maxLength) {
    return trimmed;
  }

  return `${trimmed.slice(0, maxLength).trimEnd()}...`;
}

export function getHotspotStoryAccent(filterId: HotspotStoryItem["filterId"]) {
  switch (filterId) {
    case "audio":
      return {
        badgeBackground: "#FFF0F6",
        badgeText: "#EB489B",
        iconBackground: "#FFE4F1",
        iconTint: "#EB489B",
      };
    case "history":
      return {
        badgeBackground: "#FFF5EA",
        badgeText: "#F58752",
        iconBackground: "#FFE8D5",
        iconTint: "#F58752",
      };
    case "tips":
      return {
        badgeBackground: "#ECFDF3",
        badgeText: "#16A34A",
        iconBackground: "#DCFCE7",
        iconTint: "#16A34A",
      };
    case "route":
      return {
        badgeBackground: "#EEF6FF",
        badgeText: "#2563EB",
        iconBackground: "#DBEAFE",
        iconTint: "#2563EB",
      };
  }
}

export function buildHotspotStoryItems(
  hotspot: HotspotDetail,
  audioStoryDurationLabel: string,
): HotspotStoryItem[] {
  const gallery = hotspot.gallery.length > 0 ? hotspot.gallery : [hotspot.imageUri];
  const items: HotspotStoryItem[] = [
    {
      body: hotspot.story,
      filterId: "audio",
      icon: {
        ios: "waveform",
        android: "graphic_eq",
        web: "graphic_eq",
      } as SymbolName,
      id: `${hotspot.slug}-story-audio`,
      imageUri: gallery[0] ?? hotspot.imageUri,
      metaLabel: `${audioStoryDurationLabel} • Đã mở khóa sau check-in`,
      pillLabel: "Audio story",
      title: `Nghe câu chuyện về ${hotspot.title}`,
    },
    {
      body: hotspot.overview,
      filterId: "history",
      icon: {
        ios: "book.closed.fill",
        android: "menu_book",
        web: "menu_book",
      } as SymbolName,
      id: `${hotspot.slug}-story-overview`,
      imageUri: gallery[1] ?? gallery[0] ?? hotspot.imageUri,
      metaLabel: `${hotspot.category} • ${hotspot.district}`,
      pillLabel: "Bối cảnh",
      title: `Dấu ấn của ${hotspot.title}`,
    },
  ];

  if (hotspot.highlights[0]) {
    items.push({
      body: hotspot.highlights[0],
      filterId: "history",
      icon: {
        ios: "building.columns.fill",
        android: "account_balance",
        web: "account_balance",
      } as SymbolName,
      id: `${hotspot.slug}-story-highlight`,
      imageUri: gallery[2] ?? gallery[0] ?? hotspot.imageUri,
      metaLabel: "Điểm nổi bật tại hotspot",
      pillLabel: "Điểm nhấn",
      title: "Chi tiết đáng nhớ tại điểm dừng này",
    });
  }

  hotspot.tips.slice(0, 2).forEach((tip, index) => {
    items.push({
      body: tip,
      filterId: "tips",
      icon: {
        ios: "lightbulb.fill",
        android: "tips_and_updates",
        web: "tips_and_updates",
      } as SymbolName,
      id: `${hotspot.slug}-story-tip-${index}`,
      imageUri: gallery[(index + 1) % gallery.length] ?? hotspot.imageUri,
      metaLabel: `Mẹo ${index + 1} • Khám phá thuận hơn`,
      pillLabel: "Mẹo khám phá",
      title:
        index === 0
          ? "Gợi ý để trải nghiệm trọn vẹn hơn"
          : "Một lưu ý nhỏ trước khi đi tiếp",
    });
  });

  items.push({
    body: hotspot.routePairing,
    filterId: "route",
    icon: {
      ios: "map.fill",
      android: "map",
      web: "map",
    } as SymbolName,
    id: `${hotspot.slug}-story-route`,
    imageUri: gallery[0] ?? hotspot.imageUri,
    metaLabel: `${hotspot.distance} • Route gợi ý sau check-in`,
    pillLabel: "Đi tiếp ở đâu",
    title: "Kết hợp hotspot này với các điểm lân cận",
  });

  return items;
}
