import { Platform } from "react-native";

import { PublicEnv, buildApiUrl } from "@/constants/env";

type GetHotspotStoriesRequest = {
  accessToken?: string | null;
  hotspotId: number;
  routeId?: number | null;
  tokenType?: string | null;
};

type GetUnlockedHotspotStoriesRequest = GetHotspotStoriesRequest;

export type HotspotStoryTagDto = {
  createdAt: string;
  hotspotCount: number | null;
  imageUrl?: string | null;
  tagId: number;
  tagName: string;
  tagStatus: string;
  updatedAt: string;
};

export type HotspotStoryMediaDto = {
  createdAt: string;
  displayOrder: number | null;
  fileName: string;
  fileSize: number | null;
  fileUrl: string;
  mediaId: number;
  mediaType: string;
  mimeType: string;
  updatedAt: string;
};

export type HotspotStoryDto = {
  audioScript: string;
  content: string;
  hotspotId: number;
  imageUrls: string[];
  medias: HotspotStoryMediaDto[];
  orderIndex: number | null;
  status: string;
  storyId: number;
  tag: HotspotStoryTagDto | null;
  title: string;
};

type GetHotspotStoriesResponse = {
  content: HotspotStoryDto[];
};

function isValidId(value: unknown): value is number {
  return typeof value === "number" && Number.isInteger(value) && value > 0;
}

function resolveGetHotspotStoriesUrl({
  hotspotId,
  routeId,
}: {
  hotspotId?: number | null;
  routeId?: number | null;
}) {
  const query = new URLSearchParams();

  if (isValidId(hotspotId)) {
    query.set("hotspotId", `${hotspotId}`);
  }

  if (isValidId(routeId)) {
    query.set("routeId", `${routeId}`);
  }

  const path = `/api/v1/stories/hotspot?${query.toString()}`;

  if (PublicEnv.apiBaseUrl.trim()) {
    return buildApiUrl(path);
  }

  return `http://13.158.40.56:8080${path}`;
}

function isObject(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}

function readNumber(value: unknown) {
  return typeof value === "number" && Number.isFinite(value) ? value : null;
}

function readString(value: unknown) {
  return typeof value === "string" ? value : "";
}

function readNullableString(value: unknown) {
  return typeof value === "string" ? value : null;
}

function readImageUrlList(value: unknown): string[] {
  const imageUrls: string[] = [];

  const appendImageUrl = (candidate: unknown) => {
    if (typeof candidate === "string") {
      const normalizedValue = candidate.trim();

      if (normalizedValue) {
        imageUrls.push(normalizedValue);
      }

      return;
    }

    if (Array.isArray(candidate)) {
      candidate.forEach(appendImageUrl);
      return;
    }

    if (!isObject(candidate)) {
      return;
    }

    for (const key of ["fileUrl", "url", "imageUrl", "image", "src"]) {
      const nestedValue = candidate[key];

      if (typeof nestedValue === "string" && nestedValue.trim()) {
        imageUrls.push(nestedValue.trim());
        return;
      }
    }
  };

  appendImageUrl(value);

  return imageUrls.filter(
    (imageUrl, index, collection) => collection.indexOf(imageUrl) === index,
  );
}

function parseTag(value: unknown): HotspotStoryTagDto | null {
  if (!isObject(value)) {
    return null;
  }

  const tagId = readNumber(value.tagId);

  if (tagId === null) {
    return null;
  }

  return {
    createdAt: readString(value.createdAt),
    hotspotCount: readNumber(value.hotspotCount),
    imageUrl: readNullableString(value.imageUrl)?.trim() || null,
    tagId,
    tagName: readString(value.tagName),
    tagStatus: readString(value.tagStatus),
    updatedAt: readString(value.updatedAt),
  };
}

function parseMedia(value: unknown): HotspotStoryMediaDto | null {
  if (!isObject(value)) {
    return null;
  }

  const mediaId = readNumber(value.mediaId);

  if (mediaId === null) {
    return null;
  }

  return {
    createdAt: readString(value.createdAt),
    displayOrder: readNumber(value.displayOrder),
    fileName: readString(value.fileName),
    fileSize: readNumber(value.fileSize),
    fileUrl: readString(value.fileUrl),
    mediaId,
    mediaType: readString(value.mediaType),
    mimeType: readString(value.mimeType),
    updatedAt: readString(value.updatedAt),
  };
}

function isNonNull<T>(value: T | null): value is T {
  return value !== null;
}

function parseStory(value: unknown): HotspotStoryDto | null {
  if (!isObject(value)) {
    return null;
  }

  const storyId = readNumber(value.storyId);
  const hotspotId = readNumber(value.hotspotId);

  if (storyId === null || hotspotId === null) {
    return null;
  }

  const imageUrls = [
    ...readImageUrlList(value.image),
    ...readImageUrlList(value.images),
    ...readImageUrlList(value.imageUrl),
  ].filter((imageUrl, index, collection) => collection.indexOf(imageUrl) === index);

  return {
    audioScript: readString(value.audioScript) || readString(value.audio_script),
    content: readString(value.content),
    hotspotId,
    imageUrls,
    medias: Array.isArray(value.medias)
      ? value.medias.map(parseMedia).filter(isNonNull)
      : [],
    orderIndex: readNumber(value.orderIndex),
    status: readString(value.status),
    storyId,
    tag: parseTag(value.tag),
    title: readString(value.title),
  };
}

function parseStoriesResponse(value: unknown): GetHotspotStoriesResponse | null {
  const rawStories = Array.isArray(value)
    ? value
    : isObject(value) && Array.isArray(value.content)
      ? value.content
      : isObject(value) && Array.isArray(value.data)
        ? value.data
        : isObject(value) && Array.isArray(value.items)
          ? value.items
          : null;

  if (!rawStories) {
    return null;
  }

  const stories = rawStories.map(parseStory).filter(isNonNull);

  if (stories.length !== rawStories.length) {
    return null;
  }

  return {
    content: stories,
  };
}

function serializeError(error: unknown) {
  if (error instanceof Error) {
    return {
      message: error.message,
      name: error.name,
      stack: error.stack,
    };
  }

  return {
    value: error,
  };
}

function summarizeBody(body: unknown) {
  if (typeof body === "string") {
    return body.slice(0, 300);
  }

  if (isObject(body) || Array.isArray(body)) {
    return body;
  }

  return body;
}

async function parseResponseBody(response: Response) {
  const rawBody = await response.text();

  if (!rawBody) {
    return null;
  }

  try {
    return JSON.parse(rawBody) as unknown;
  } catch {
    return rawBody;
  }
}

function getErrorMessage(
  body: unknown,
  hotspotId: number | null | undefined,
  status: number,
) {
  if (isObject(body)) {
    for (const key of ["message", "error", "detail", "title"]) {
      const candidate = body[key];

      if (typeof candidate === "string" && candidate.trim()) {
        return candidate.trim();
      }
    }
  }

  if (typeof body === "string" && body.trim()) {
    return body.trim();
  }

  if (!isValidId(hotspotId)) {
    return `Không thể tải story (${status}).`;
  }

  return `Không thể tải story cho hotspot #${hotspotId} (${status}).`;
}

function getConnectionErrorMessage(url: string) {
  if (Platform.OS === "android" && url.startsWith("http://")) {
    return "Android đang chặn kết nối HTTP tới API. Hãy dùng HTTPS hoặc rebuild Android dev client sau khi bật cleartext traffic.";
  }

  return "Không thể kết nối đến máy chủ story.";
}

/** Gọi `/api/v1/stories/hotspot` và trả về danh sách đã parse, CHƯA sắp xếp. */
async function fetchStories({
  accessToken,
  hotspotId,
  routeId,
  tokenType,
}: {
  accessToken?: string | null;
  hotspotId?: number | null;
  routeId?: number | null;
  tokenType?: string | null;
}): Promise<HotspotStoryDto[]> {
  const getHotspotStoriesUrl = resolveGetHotspotStoriesUrl({
    hotspotId,
    routeId,
  });
  let response: Response;

  try {
    response = await fetch(getHotspotStoriesUrl, {
      headers: {
        Accept: "application/json",
        ...(accessToken
          ? { Authorization: `${tokenType ?? "Bearer"} ${accessToken}` }
          : {}),
        "Content-Type": "application/json",
        "X-Client-Type": "mobile",
      },
      method: "GET",
    });
  } catch (error) {
    console.warn("[stories] get hotspot stories network failure", {
      error: serializeError(error),
      hotspotId,
      platform: Platform.OS,
      routeId,
      url: getHotspotStoriesUrl,
    });
    throw new Error(getConnectionErrorMessage(getHotspotStoriesUrl));
  }

  const responseBody = await parseResponseBody(response);

  if (!response.ok) {
    console.warn("[stories] get hotspot stories rejected", {
      body: summarizeBody(responseBody),
      hotspotId,
      statusCode: response.status,
      routeId,
      url: getHotspotStoriesUrl,
    });
    throw new Error(getErrorMessage(responseBody, hotspotId, response.status));
  }

  const parsedResponse = parseStoriesResponse(responseBody);

  if (!parsedResponse) {
    console.warn("[stories] get hotspot stories invalid payload", {
      body: summarizeBody(responseBody),
      hotspotId,
      routeId,
      url: getHotspotStoriesUrl,
    });
    throw new Error("API story trả về dữ liệu không đúng định dạng.");
  }

  return parsedResponse.content;
}

function compareByOrderIndex(left: HotspotStoryDto, right: HotspotStoryDto) {
  const leftOrder = left.orderIndex ?? Number.MAX_SAFE_INTEGER;
  const rightOrder = right.orderIndex ?? Number.MAX_SAFE_INTEGER;

  if (leftOrder !== rightOrder) {
    return leftOrder - rightOrder;
  }

  return left.storyId - right.storyId;
}

/**
 * Tập tag của các story thuộc một tuyến — bản sao phía client của
 * `StoryRepository.findTagIdsByRouteId` bên backend.
 */
async function getRouteStoryTagIds({
  accessToken,
  routeId,
  tokenType,
}: {
  accessToken?: string | null;
  routeId: number;
  tokenType?: string | null;
}): Promise<Set<number>> {
  const routeStories = await fetchStories({
    accessToken,
    routeId,
    tokenType,
  });
  const tagIds = new Set<number>();

  for (const story of routeStories) {
    if (story.tag && isValidId(story.tag.tagId)) {
      tagIds.add(story.tag.tagId);
    }
  }

  return tagIds;
}

/**
 * Story của một hotspot.
 *
 * Khi đang đi theo tuyến (`routeId`), CỐ Ý không gửi `routeId` lên endpoint
 * story: `StoryServiceImpl.getByHotspot` bên backend nhận đủ cả hai tham số thì
 * chuyển sang LỌC (`findByRoute_RouteIdAndHotspot_HotspotIdAndStatus`), làm biến
 * mất những story khác của hotspot. Thay vào đó lấy hết story của hotspot rồi tự
 * đẩy story có tag trùng tuyến lên đầu — đúng hành vi của
 * `findByHotspotOrderedByRouteTag` mà commit `30c33be` đã comment lại:
 *
 *     ORDER BY (CASE WHEN tag.tagId IN :routeTagIds THEN 0 ELSE 1) ASC,
 *              orderIndex ASC
 *
 * Ưu tiên theo TAG chứ không phải theo `routeId` của story: story của hotspot
 * không thuộc tuyến nào nhưng cùng chủ đề với tuyến vẫn được lên đầu.
 */
export async function getHotspotStories({
  accessToken,
  hotspotId,
  routeId,
  tokenType,
}: GetHotspotStoriesRequest): Promise<HotspotStoryDto[]> {
  const [storiesResult, routeTagIdsResult] = await Promise.allSettled([
    fetchStories({ accessToken, hotspotId, tokenType }),
    isValidId(routeId)
      ? getRouteStoryTagIds({ accessToken, routeId, tokenType })
      : Promise.resolve(new Set<number>()),
  ]);

  if (storiesResult.status !== "fulfilled") {
    throw storiesResult.reason;
  }

  const stories = storiesResult.value;

  // Hỏng phần tag của tuyến thì vẫn hiện đủ story, chỉ mất thứ tự ưu tiên.
  if (routeTagIdsResult.status !== "fulfilled") {
    console.warn("[stories] load route tag ids failed", {
      error: serializeError(routeTagIdsResult.reason),
      hotspotId,
      routeId,
    });

    return [...stories].sort(compareByOrderIndex);
  }

  const routeTagIds = routeTagIdsResult.value;

  if (routeTagIds.size === 0) {
    return [...stories].sort(compareByOrderIndex);
  }

  const matchesRouteTag = (story: HotspotStoryDto) =>
    story.tag !== null && routeTagIds.has(story.tag.tagId);

  return [...stories].sort((left, right) => {
    const leftPriority = matchesRouteTag(left) ? 0 : 1;
    const rightPriority = matchesRouteTag(right) ? 0 : 1;

    if (leftPriority !== rightPriority) {
      return leftPriority - rightPriority;
    }

    return compareByOrderIndex(left, right);
  });
}

export async function getUnlockedHotspotStories({
  accessToken,
  hotspotId,
  routeId,
  tokenType,
}: GetUnlockedHotspotStoriesRequest): Promise<HotspotStoryDto[]> {
  return getHotspotStories({
    accessToken,
    hotspotId,
    routeId,
    tokenType,
  });
}
