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

function resolveGetHotspotStoriesUrl({
  hotspotId,
  routeId,
}: {
  hotspotId: number;
  routeId?: number | null;
}) {
  const query = new URLSearchParams({ hotspotId: `${hotspotId}` });

  if (typeof routeId === "number" && Number.isInteger(routeId) && routeId > 0) {
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

  return {
    audioScript: readString(value.audioScript) || readString(value.audio_script),
    content: readString(value.content),
    hotspotId,
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

function getErrorMessage(body: unknown, hotspotId: number, status: number) {
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

  return `Không thể tải story cho hotspot #${hotspotId} (${status}).`;
}

function getConnectionErrorMessage(url: string) {
  if (Platform.OS === "android" && url.startsWith("http://")) {
    return "Android đang chặn kết nối HTTP tới API. Hãy dùng HTTPS hoặc rebuild Android dev client sau khi bật cleartext traffic.";
  }

  return "Không thể kết nối đến máy chủ story.";
}

export async function getHotspotStories({
  accessToken,
  hotspotId,
  routeId,
  tokenType,
}: GetHotspotStoriesRequest): Promise<HotspotStoryDto[]> {
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

  return [...parsedResponse.content].sort((left, right) => {
    const leftOrder = left.orderIndex ?? Number.MAX_SAFE_INTEGER;
    const rightOrder = right.orderIndex ?? Number.MAX_SAFE_INTEGER;

    if (leftOrder !== rightOrder) {
      return leftOrder - rightOrder;
    }

    return left.storyId - right.storyId;
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
