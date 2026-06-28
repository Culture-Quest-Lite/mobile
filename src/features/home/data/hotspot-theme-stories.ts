import type {
  HotspotStoryDto,
  HotspotStoryMediaDto,
} from "../api/get-hotspot-stories";
import type { HotspotDetail } from "./hotspots";

const storyHistoryImage = require("../../../../assets/images/tachnenl.png");
const storyCultureImage = require("../../../../assets/images/tachnen2.png");
const storyFoodImage = require("../../../../assets/images/tachnen3.png");
const historyTagImage = require("../../../../assets/images/Jun 13, 2026, 07_55_06 PM.png");
const cultureTagImage = require("../../../../assets/images/vanhoa.png");
const foodTagImage = require("../../../../assets/images/amthuc.png");
const educationTagImage = require("../../../../assets/images/giaoduc.png");

export type StoryThemeTag = "history" | "culture" | "food" | "education";

export type HotspotThemeStory = {
  audioDescription: string;
  audioDurationLabel: string;
  audioTitle: string;
  audioUrl?: string | null;
  cardColors: readonly [string, string];
  cardHeight: number;
  gallery: string[];
  heroGallery: string[];
  id: string;
  imageBottom: number;
  imageHeight: number;
  imageRight: number;
  imageSource: number;
  imageWidth: number;
  scriptParagraphs: string[];
  summary: string;
  tagId?: number | null;
  tag: StoryThemeTag;
  tagImageSource: number;
  tagLabel: string;
  textWidth: number;
  title: string;
  videoDescription: string;
  videoDurationLabel: string;
  videoPoster: string;
  videoTitle: string;
  videoUrl?: string | null;
};

export const storyThemeTabs: {
  id: StoryThemeTag;
  label: string;
}[] = [
  { id: "history", label: "Lịch sử" },
  { id: "culture", label: "Văn hóa" },
  { id: "food", label: "Ẩm thực" },
  { id: "education", label: "Giáo dục" },
];

const storyCardBaseLayout = {
  cardHeight: 138,
  imageBottom: -50,
  imageHeight: 246,
  imageRight: -18,
  imageWidth: 182,
  textWidth: 43,
} as const;

const storyImageByTag: Record<StoryThemeTag, number> = {
  culture: storyCultureImage,
  education: storyHistoryImage,
  food: storyFoodImage,
  history: storyHistoryImage,
};

export const tagImageByTag: Record<StoryThemeTag, number> = {
  culture: cultureTagImage,
  education: educationTagImage,
  food: foodTagImage,
  history: historyTagImage,
};

function normalizeLookupText(value: string) {
  return value
    .trim()
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "");
}

export function resolveStoryThemeTag(tagName: string): StoryThemeTag | null {
  const normalizedTagName = normalizeLookupText(tagName);

  if (normalizedTagName.includes("am thuc")) {
    return "food";
  }

  if (normalizedTagName.includes("giao duc")) {
    return "education";
  }

  if (
    normalizedTagName.includes("lich su") ||
    normalizedTagName.includes("di san")
  ) {
    return "history";
  }

  if (
    normalizedTagName.includes("van hoa") ||
    normalizedTagName.includes("nghe thuat") ||
    normalizedTagName.includes("kien truc") ||
    normalizedTagName.includes("thien nhien") ||
    normalizedTagName.includes("check in")
  ) {
    return "culture";
  }

  return null;
}

type StoryHeroGalleryOverrides = Partial<
  Record<string, Partial<Record<StoryThemeTag, readonly string[]>>>
>;

// Change story detail hero images here.
export const storyHeroGalleryOverrides: StoryHeroGalleryOverrides = {
  "demo-checkin-story": {
    culture: [
      "https://i.pinimg.com/1200x/40/98/86/409886462a3dcbb93d307ee05b7cb9f9.jpg",
      "https://i.pinimg.com/1200x/27/6e/d3/276ed3e768b441a29939818c1c2763c2.jpg",
      "https://i.pinimg.com/1200x/bd/41/cd/bd41cd3cc69bf73a67566f50d9c8b41c.jpg",
    ],
    education: [
      "https://i.pinimg.com/1200x/9d/b9/77/9db977d882a0921af574e895a1b0a0e7.jpg",
      "https://i.pinimg.com/1200x/a3/db/4a/a3db4ae476348262d9b00b5608ceb2c2.jpg",
      "https://i.pinimg.com/736x/e2/d7/4d/e2d74d0bbef101f908084581b9ed4f04.jpg",
    ],
    food: [
      "https://i.pinimg.com/1200x/89/e2/83/89e2835624d9b5924a7d257483a8024b.jpg",
      "https://i.pinimg.com/1200x/a9/60/4b/a9604b1be52e6d79fb647b1c33ad3fe3.jpg",
      "https://i.pinimg.com/1200x/41/fa/c8/41fac81f07e7f1342a8da1c58506a9db.jpg",
    ],
    history: [
      "https://i.pinimg.com/736x/9d/9c/05/9d9c0581e5e485b5f52f25103ab536c1.jpg",
      "https://i.pinimg.com/736x/ed/f4/84/edf48441b8ff1f013e5122bc810da382.jpg",
      "https://i.pinimg.com/1200x/ce/d4/ae/ced4aee648e6568f3d8734d675d95124.jpg",
    ],
  },
};

function getAudioStoryDurationLabel(story: string) {
  const wordCount = story.trim().split(/\s+/).filter(Boolean).length;
  const minutes = Math.max(1, Math.ceil(wordCount / 110));

  return `${minutes} min nghe`;
}

function getTagLabel(tag: StoryThemeTag) {
  return storyThemeTabs.find((tab) => tab.id === tag)?.label ?? "Story";
}

function rotateGallery(gallery: string[], offset: number) {
  if (gallery.length === 0) {
    return [];
  }

  return gallery.map(
    (_, index) => gallery[(index + offset) % gallery.length] ?? gallery[0]!,
  );
}

function buildHeroGallery(primaryImage: string, gallery: string[]) {
  return [primaryImage, ...gallery].filter((imageUri, index, collection) => {
    return Boolean(imageUri) && collection.indexOf(imageUri) === index;
  });
}

function getStoryHeroGallery(
  hotspot: HotspotDetail,
  tag: StoryThemeTag,
  fallbackGallery: string[],
) {
  const overrideGallery = storyHeroGalleryOverrides[hotspot.slug]?.[tag];

  if (overrideGallery && overrideGallery.length > 0) {
    return [...overrideGallery];
  }

  return buildHeroGallery(hotspot.imageUri, fallbackGallery);
}

function buildScriptParagraphs(hotspot: HotspotDetail, tag: StoryThemeTag) {
  switch (tag) {
    case "history":
      return [
        hotspot.story,
        hotspot.overview,
        hotspot.highlights[0]
          ? `Điểm nhấn lịch sử nổi bật: ${hotspot.highlights[0]}`
          : `Điểm dừng này gắn với nhiều lát cắt đáng nhớ của ${hotspot.district}.`,
      ];
    case "culture":
      return [
        `${hotspot.title} cho thấy một nhịp sống rất riêng của ${hotspot.district}, nơi kiến trúc, con người và thói quen địa phương gặp nhau trong cùng một trải nghiệm.`,
        hotspot.highlights[1]
          ? `Chi tiết văn hóa dễ cảm nhận nhất là ${hotspot.highlights[1].toLowerCase()}`
          : hotspot.overview,
        `Vibe chính của điểm dừng này là ${hotspot.vibeTags.join(", ")}.`,
      ];
    case "food":
      return [
        `Sau khi check-in ${hotspot.title}, trải nghiệm ẩm thực là cách tốt nhất để nối tiếp hành trình và giữ năng lượng cho route tiếp theo.`,
        hotspot.routePairing,
        hotspot.tips[0]
          ? `Gợi ý nhanh: ${hotspot.tips[0]}`
          : `Ưu tiên một điểm ăn uống gần ${hotspot.address} để route không bị đứt mạch.`,
      ];
    case "education":
      return [
        `Đây là phần ghi chú nhanh để bạn đi tiếp mượt hơn sau khi đã check-in tại ${hotspot.title}.`,
        hotspot.tips[1] ?? hotspot.tips[0] ?? hotspot.overview,
        `Khung giờ nên ưu tiên: ${hotspot.bestTimeLabel}. Lịch mở cửa hiện tại: ${hotspot.scheduleLabel}.`,
      ];
  }
}

function buildSummaryFromContent(content: string) {
  const normalizedContent = content.replace(/\s+/g, " ").trim();

  if (!normalizedContent) {
    return null;
  }

  return normalizedContent.length > 150
    ? `${normalizedContent.slice(0, 147).trimEnd()}...`
    : normalizedContent;
}

function splitApiStoryParagraphs(content: string) {
  const paragraphs = content
    .split(/\n\s*\n+/)
    .map((paragraph) => paragraph.replace(/\s+/g, " ").trim())
    .filter(Boolean);

  if (paragraphs.length > 0) {
    return paragraphs;
  }

  const normalizedContent = content.replace(/\s+/g, " ").trim();

  return normalizedContent ? [normalizedContent] : [];
}

type StoryMediaKind = "image" | "audio" | "video";

const mediaExtensionPatterns: Record<StoryMediaKind, RegExp> = {
  audio: /\.(aac|flac|m4a|mp3|oga|ogg|wav)(?:$|[?#])/i,
  image: /\.(avif|bmp|gif|heic|jpeg|jpg|png|svg|webp)(?:$|[?#])/i,
  video: /\.(m3u8|mov|mp4|m4v|webm)(?:$|[?#])/i,
};

function resolveStoryMediaKind(media: HotspotStoryMediaDto): StoryMediaKind | null {
  const normalizedMediaType = media.mediaType.trim().toLowerCase();
  const normalizedMimeType = media.mimeType.trim().toLowerCase();
  const normalizedFileName = media.fileName.trim().toLowerCase();
  const normalizedFileUrl = media.fileUrl.trim().toLowerCase();

  if (
    normalizedMediaType === "audio" ||
    normalizedMediaType.startsWith("audio/") ||
    normalizedMimeType.startsWith("audio/") ||
    mediaExtensionPatterns.audio.test(normalizedFileName) ||
    mediaExtensionPatterns.audio.test(normalizedFileUrl)
  ) {
    return "audio";
  }

  if (
    normalizedMediaType === "video" ||
    normalizedMediaType.startsWith("video/") ||
    normalizedMimeType.startsWith("video/") ||
    mediaExtensionPatterns.video.test(normalizedFileName) ||
    mediaExtensionPatterns.video.test(normalizedFileUrl)
  ) {
    return "video";
  }

  if (
    normalizedMediaType === "image" ||
    normalizedMediaType.startsWith("image/") ||
    normalizedMimeType.startsWith("image/") ||
    mediaExtensionPatterns.image.test(normalizedFileName) ||
    mediaExtensionPatterns.image.test(normalizedFileUrl)
  ) {
    return "image";
  }

  return null;
}

function getSortedMediaUrlsByKind(story: HotspotStoryDto, mediaKind: StoryMediaKind) {
  return [...story.medias]
    .filter(
      (media) =>
        resolveStoryMediaKind(media) === mediaKind &&
        media.fileUrl.trim(),
    )
    .sort((left, right) => {
      const leftOrder = left.displayOrder ?? Number.MAX_SAFE_INTEGER;
      const rightOrder = right.displayOrder ?? Number.MAX_SAFE_INTEGER;

      if (leftOrder !== rightOrder) {
        return leftOrder - rightOrder;
      }

      return left.mediaId - right.mediaId;
    })
    .map((media) => media.fileUrl.trim());
}

export function buildHotspotThemeStories(
  hotspot: HotspotDetail,
): HotspotThemeStory[] {
  const gallerySeed =
    hotspot.gallery.length > 0 ? hotspot.gallery : [hotspot.imageUri];
  const historyGallery = rotateGallery(gallerySeed, 0);
  const cultureGallery = rotateGallery(gallerySeed, 1);
  const foodGallery = rotateGallery(gallerySeed, 2);
  const educationGallery = rotateGallery(gallerySeed, 0).reverse();
  const audioDurationLabel = getAudioStoryDurationLabel(hotspot.story);

  return [
    {
      audioDescription:
        "Một track kể chuyện ngắn giúp bạn nắm nhanh bối cảnh và cảm xúc chính của địa điểm.",
      audioDurationLabel,
      audioTitle: `Audio mở khóa về ${hotspot.title}`,
      cardColors: ["#D8E8FF", "#C8DCFF"],
      gallery: historyGallery,
      heroGallery: getStoryHeroGallery(hotspot, "history", historyGallery),
      id: "history",
      imageSource: storyImageByTag.history,
      scriptParagraphs: buildScriptParagraphs(hotspot, "history"),
      summary: "Tập trung vào lớp bối cảnh, dấu ấn và ký ức của điểm dừng này.",
      tag: "history",
      tagImageSource: tagImageByTag.history,
      tagLabel: getTagLabel("history"),
      title: `Lịch sử của ${hotspot.title}`,
      videoDescription:
        "Một đoạn visual ngắn cho thấy khung cảnh tổng thể và các góc nhìn đặc trưng của hotspot.",
      videoDurationLabel: "45s video",
      videoPoster: historyGallery[0] ?? hotspot.imageUri,
      videoTitle: `Visual story tại ${hotspot.title}`,
      ...storyCardBaseLayout,
    },
    {
      audioDescription:
        "Nghe nhanh về không khí địa phương, vibe xung quanh và cách người ta trải nghiệm nơi này.",
      audioDurationLabel: "1 min khám phá",
      audioTitle: "Audio về không khí và văn hóa",
      cardColors: ["#F8D1DE", "#F2C2D3"],
      gallery: cultureGallery,
      heroGallery: getStoryHeroGallery(hotspot, "culture", cultureGallery),
      id: "culture",
      imageSource: storyImageByTag.culture,
      scriptParagraphs: buildScriptParagraphs(hotspot, "culture"),
      summary:
        "Khám phá không khí, nhịp sống và sắc thái văn hóa quanh hotspot.",
      tag: "culture",
      tagImageSource: tagImageByTag.culture,
      tagLabel: getTagLabel("culture"),
      title: `Văn hóa quanh ${hotspot.title}`,
      videoDescription:
        "Một đoạn dựng nhanh để nhìn ra cách hotspot hòa vào bối cảnh khu vực và cộng đồng xung quanh.",
      videoDurationLabel: "52s video",
      videoPoster: cultureGallery[0] ?? hotspot.imageUri,
      videoTitle: "Khoảnh khắc văn hóa",
      ...storyCardBaseLayout,
    },
    {
      audioDescription:
        "Track ngắn gợi ý mạch trải nghiệm ăn uống sau check-in, phù hợp để bạn lên route tiếp.",
      audioDurationLabel: "58s audio",
      audioTitle: "Gợi ý ẩm thực sau check-in",
      cardColors: ["#F8D5C0", "#F3C2A4"],
      gallery: foodGallery,
      heroGallery: getStoryHeroGallery(hotspot, "food", foodGallery),
      id: "food",
      imageSource: storyImageByTag.food,
      scriptParagraphs: buildScriptParagraphs(hotspot, "food"),
      summary:
        "Nối hotspot với mạch trải nghiệm ăn uống, nghỉ chân và khám phá lân cận.",
      tag: "food",
      tagImageSource: tagImageByTag.food,
      tagLabel: getTagLabel("food"),
      title: "Ẩm thực nên thử sau khi ghé",
      videoDescription:
        "Video teaser ngắn để hình dung mạch di chuyển và những điểm dừng ẩm thực phù hợp sau khi rời hotspot.",
      videoDurationLabel: "41s video",
      videoPoster: foodGallery[0] ?? hotspot.imageUri,
      videoTitle: "Route ăn uống gợi ý",
      ...storyCardBaseLayout,
    },
    {
      audioDescription:
        "Một đoạn audio tóm tắt lưu ý, thời điểm phù hợp và mẹo nhỏ để bạn tiếp tục route hiệu quả hơn.",
      audioDurationLabel: "47s audio",
      audioTitle: "Ghi chú nhanh trước khi đi tiếp",
      cardColors: ["#DDD6FF", "#CEC6FF"],
      gallery: educationGallery,
      heroGallery: getStoryHeroGallery(hotspot, "education", educationGallery),
      id: "education",
      imageSource: storyImageByTag.education,
      scriptParagraphs: buildScriptParagraphs(hotspot, "education"),
      summary:
        "Tập trung vào các ghi chú thực tế, mẹo đi tiếp và cách tối ưu hành trình.",
      tag: "education",
      tagImageSource: tagImageByTag.education,
      tagLabel: getTagLabel("education"),
      title: "Ghi chú nhanh trước khi đi tiếp",
      videoDescription:
        "Một recap video ngắn để bạn chốt lại thông tin quan trọng trước khi sang điểm tiếp theo.",
      videoDurationLabel: "36s video",
      videoPoster: educationGallery[0] ?? hotspot.imageUri,
      videoTitle: "Recap trước khi đi tiếp",
      ...storyCardBaseLayout,
    },
  ];
}

export function buildHotspotThemeStoriesFromApi(
  hotspot: HotspotDetail,
  stories: HotspotStoryDto[],
): HotspotThemeStory[] {
  const fallbackStoriesByTag = new Map(
    buildHotspotThemeStories(hotspot).map((story) => [story.tag, story] as const),
  );

  return [...stories].map((story, index) => {
    const resolvedTag =
      resolveStoryThemeTag(story.tag?.tagName ?? "") ??
      (index % 4 === 0
        ? "history"
        : index % 4 === 1
          ? "culture"
          : index % 4 === 2
            ? "food"
            : "education");
    const fallbackStory =
      fallbackStoriesByTag.get(resolvedTag) ??
      fallbackStoriesByTag.get("history")!;
    const imageGallery = getSortedMediaUrlsByKind(story, "image");
    const audioUrl = getSortedMediaUrlsByKind(story, "audio")[0] ?? null;
    const videoUrl = getSortedMediaUrlsByKind(story, "video")[0] ?? null;
    const nextGallery =
      imageGallery.length > 0 ? imageGallery : fallbackStory.heroGallery;
    const nextParagraphs = splitApiStoryParagraphs(story.content);
    const nextTitle = story.title.trim() || fallbackStory.title;
    const nextTagLabel = story.tag?.tagName.trim() || fallbackStory.tagLabel;
    const nextSummary =
      buildSummaryFromContent(story.content) ?? fallbackStory.summary;

    return {
      ...fallbackStory,
      audioDescription: audioUrl
        ? "Audio gốc của story này đã được lấy từ hệ thống."
        : fallbackStory.audioDescription,
      audioDurationLabel: audioUrl
        ? "Audio API"
        : getAudioStoryDurationLabel(story.content || hotspot.story),
      audioTitle: audioUrl ? nextTitle : fallbackStory.audioTitle,
      audioUrl,
      gallery: nextGallery,
      heroGallery: nextGallery,
      id: String(story.storyId),
      scriptParagraphs:
        nextParagraphs.length > 0 ? nextParagraphs : fallbackStory.scriptParagraphs,
      summary: nextSummary,
      tagId: story.tag?.tagId ?? null,
      tag: resolvedTag,
      tagLabel: nextTagLabel,
      title: nextTitle,
      videoDescription: videoUrl
        ? "Video của story này đã sẵn sàng từ API."
        : fallbackStory.videoDescription,
      videoDurationLabel: videoUrl ? "Video API" : fallbackStory.videoDurationLabel,
      videoPoster: nextGallery[0] ?? fallbackStory.videoPoster,
      videoTitle: videoUrl ? nextTitle : fallbackStory.videoTitle,
      videoUrl,
    };
  });
}

export function getHotspotThemeStory(hotspot: HotspotDetail, storyId: string) {
  return buildHotspotThemeStories(hotspot).find(
    (story) => story.id === storyId,
  );
}
