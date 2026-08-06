import type { ActiveTagDto } from "../api/get-tags";
import {
  type NearbyCategoryCard,
  nearbyCategories,
} from "../data/home-screen.mock";

type ThemeCategoryPreset = Omit<ThemeCategoryCard, "imageUrl" | "label" | "tagId"> & {
  summary: string;
};

export type ThemeCategoryCardModel = NearbyCategoryCard & {
  summary: string;
};

const themeCategoryPresets: Record<string, ThemeCategoryPreset> = {
  am_thuc: {
    accent: "#C96A00",
    background: "#FFE7CC",
    icon: { ios: "fork.knife", android: "restaurant", web: "restaurant" },
    summary: "Khám phá hương vị địa phương, chợ truyền thống và những món ăn đặc sắc.",
  },
  check_in: {
    accent: "#2563EB",
    background: "#DCEBFF",
    icon: { ios: "camera.fill", android: "photo_camera", web: "photo_camera" },
    summary: "Những điểm dừng nổi bật để lưu lại khoảnh khắc đẹp và trải nghiệm nhanh.",
  },
  di_san: {
    accent: "#7C3AED",
    background: "#EEE4FF",
    icon: {
      ios: "building.columns.fill",
      android: "account_balance",
      web: "account_balance",
    },
    summary: "Đi qua các công trình và địa danh giàu dấu ấn di sản và ký ức đô thị.",
  },
  giao_duc: {
    accent: "#2563EB",
    background: "#DCEBFF",
    icon: { ios: "book.closed.fill", android: "menu_book", web: "menu_book" },
    summary: "Các điểm đến giàu thông tin, phù hợp để vừa tham quan vừa học hỏi thêm.",
  },
  kien_truc: {
    accent: "#B83280",
    background: "#FFD7EA",
    icon: {
      ios: "building.2.fill",
      android: "architecture",
      web: "architecture",
    },
    summary: "Chiêm ngưỡng những công trình kiến trúc độc đáo qua nhiều thời kỳ khác nhau.",
  },
  lich_su: {
    accent: "#D95C22",
    background: "#FFE4D3",
    icon: { ios: "clock.arrow.circlepath", android: "history", web: "history" },
    summary: "Tìm hiểu các mốc thời gian, di tích và những câu chuyện làm nên lịch sử.",
  },
  nghe_thuat: {
    accent: "#0D8C7D",
    background: "#D9F7F1",
    icon: { ios: "paintpalette.fill", android: "palette", web: "palette" },
    summary: "Không gian triển lãm, sáng tạo và trải nghiệm nghệ thuật đáng khám phá.",
  },
  thien_nhien: {
    accent: "#2F855A",
    background: "#DCFCE7",
    icon: { ios: "leaf.fill", android: "park", web: "park" },
    summary: "Những hành trình ưu tiên cảnh quan xanh, không khí thoáng và trải nghiệm ngoài trời.",
  },
  van_hoa: {
    accent: "#B45309",
    background: "#FFF1D6",
    icon: {
      ios: "theatermasks.fill",
      android: "theater_comedy",
      web: "theater_comedy",
    },
    summary: "Khám phá cộng đồng bản địa, phong tục, tín ngưỡng và nhịp sống văn hóa.",
  },
};

export function normalizeThemeLookupText(value: string) {
  return value
    .trim()
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "");
}

function readMeaningfulThemeImageUrl(value?: string | null) {
  const trimmedValue = value?.trim();
  return trimmedValue ? trimmedValue : null;
}

function resolveThemeCategoryPreset(
  tagName: string,
  index: number,
): ThemeCategoryPreset {
  const normalizedTagName = normalizeThemeLookupText(tagName);

  if (normalizedTagName.includes("di san")) {
    return themeCategoryPresets.di_san;
  }

  if (normalizedTagName.includes("van hoa")) {
    return themeCategoryPresets.van_hoa;
  }

  if (normalizedTagName.includes("lich su")) {
    return themeCategoryPresets.lich_su;
  }

  if (normalizedTagName.includes("kien truc")) {
    return themeCategoryPresets.kien_truc;
  }

  if (normalizedTagName.includes("thien nhien")) {
    return themeCategoryPresets.thien_nhien;
  }

  if (normalizedTagName.includes("nghe thuat")) {
    return themeCategoryPresets.nghe_thuat;
  }

  if (normalizedTagName.includes("am thuc")) {
    return themeCategoryPresets.am_thuc;
  }

  if (normalizedTagName.includes("giao duc")) {
    return themeCategoryPresets.giao_duc;
  }

  if (normalizedTagName.includes("check in")) {
    return themeCategoryPresets.check_in;
  }

  const fallbackCategory = nearbyCategories[index % nearbyCategories.length];

  return {
    accent: fallbackCategory.accent,
    background: fallbackCategory.background,
    icon: fallbackCategory.icon,
    summary: "Khám phá thêm các điểm đến, câu chuyện và lộ trình theo chủ đề này.",
  };
}

export function mapActiveTagsToThemeCategories(
  tags: ActiveTagDto[],
): ThemeCategoryCardModel[] {
  return tags.map((tag, index) => {
    const preset = resolveThemeCategoryPreset(tag.tagName, index);

    return {
      ...preset,
      imageUrl: readMeaningfulThemeImageUrl(tag.imageUrl),
      label: tag.tagName,
      tagId: tag.tagId,
    };
  });
}
