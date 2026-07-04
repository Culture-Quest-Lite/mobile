import { Platform } from "react-native";

import { PublicEnv, buildApiUrl } from "@/constants/env";

type GetHotspotStoriesRequest = {
  accessToken?: string | null;
  hotspotId: number;
  status?: string;
  tagId?: number | null;
  tokenType?: string | null;
};

type GetUnlockedHotspotStoriesRequest = Omit<GetHotspotStoriesRequest, "status">;

export type HotspotStoryTagDto = {
  createdAt: string;
  hotspotCount: number | null;
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
  status,
  tagId,
}: {
  hotspotId: number;
  status: string;
  tagId?: number | null;
}) {
  const query = new URLSearchParams({
    hotspotId: `${hotspotId}`,
    status,
  });

  if (typeof tagId === "number" && Number.isInteger(tagId) && tagId > 0) {
    query.set("tagId", `${tagId}`);
  }

  const path = `/api/v1/stories?${query.toString()}`;

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
  if (!isObject(value) || !Array.isArray(value.content)) {
    return null;
  }

  const stories = value.content.map(parseStory).filter(isNonNull);

  if (stories.length !== value.content.length) {
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
  status = "DRAFT",
  tagId,
  tokenType,
}: GetHotspotStoriesRequest): Promise<HotspotStoryDto[]> {
  const getHotspotStoriesUrl = resolveGetHotspotStoriesUrl({
    hotspotId,
    status,
    tagId,
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
      status,
      tagId,
      url: getHotspotStoriesUrl,
    });
    throw new Error(getConnectionErrorMessage(getHotspotStoriesUrl));
  }

  const responseBody = await parseResponseBody(response);

  if (!response.ok) {
    console.warn("[stories] get hotspot stories rejected", {
      body: summarizeBody(responseBody),
      hotspotId,
      status,
      statusCode: response.status,
      tagId,
      url: getHotspotStoriesUrl,
    });
    throw new Error(getErrorMessage(responseBody, hotspotId, response.status));
  }

  const parsedResponse = parseStoriesResponse(responseBody);

  if (!parsedResponse) {
    console.warn("[stories] get hotspot stories invalid payload", {
      body: summarizeBody(responseBody),
      hotspotId,
      status,
      tagId,
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
  tagId,
  tokenType,
}: GetUnlockedHotspotStoriesRequest): Promise<HotspotStoryDto[]> {
  try {
    const publishedStories = await getHotspotStories({
      accessToken,
      hotspotId,
      status: "PUBLISHED",
      tagId,
      tokenType,
    });

    if (publishedStories.length > 0) {
      return publishedStories;
    }

    try {
      const draftStories = await getHotspotStories({
        accessToken,
        hotspotId,
        status: "DRAFT",
        tagId,
        tokenType,
      });

      return draftStories.length > 0 ? draftStories : publishedStories;
    } catch (draftError) {
      console.info("[stories] draft fallback failed after empty published result", {
        error: serializeError(draftError),
        hotspotId,
        tagId,
      });

      return publishedStories;
    }
  } catch (publishedError) {
    console.warn("[stories] published stories load failed, trying draft fallback", {
      error: serializeError(publishedError),
      hotspotId,
      tagId,
    });

    return getHotspotStories({
      accessToken,
      hotspotId,
      status: "DRAFT",
      tagId,
      tokenType,
    });
  }
}
