import { Platform } from "react-native";

import { PublicEnv, buildApiUrl } from "@/constants/env";

type GetStoryByIdRequest = {
  accessToken?: string | null;
  storyId: number;
  tokenType?: string | null;
};

export type StoryMediaDto = {
  displayOrder: number | null;
  fileName: string;
  fileUrl: string;
  mediaId: number;
  mediaType: string;
};

export type StoryTagDto = {
  tagId: number;
  tagName: string;
};

export type StoryDto = {
  audioScript: string;
  content: string;
  hotspotId: number | null;
  hotspotName: string;
  medias: StoryMediaDto[];
  orderIndex: number | null;
  status: string;
  storyId: number;
  tag: StoryTagDto | null;
  title: string;
};

function resolveGetStoryByIdUrl(storyId: number) {
  const path = `/api/v1/stories/${storyId}`;

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

function isNonNull<T>(value: T | null): value is T {
  return value !== null;
}

function parseMedia(value: unknown): StoryMediaDto | null {
  if (!isObject(value)) {
    return null;
  }

  const mediaId = readNumber(value.mediaId);

  if (mediaId === null) {
    return null;
  }

  return {
    displayOrder: readNumber(value.displayOrder),
    fileName: readString(value.fileName),
    fileUrl: readString(value.fileUrl),
    mediaId,
    mediaType: readString(value.mediaType),
  };
}

function parseTag(value: unknown): StoryTagDto | null {
  if (!isObject(value)) {
    return null;
  }

  const tagId = readNumber(value.tagId);
  const tagName = readString(value.tagName).trim();

  if (tagId === null || !tagName) {
    return null;
  }

  return {
    tagId,
    tagName,
  };
}

function parseStory(value: unknown): StoryDto | null {
  if (!isObject(value)) {
    return null;
  }

  const storyId = readNumber(value.storyId);

  if (storyId === null) {
    return null;
  }

  const hotspot = isObject(value.hotspot) ? value.hotspot : null;

  return {
    audioScript: readString(value.audioScript) || readString(value.audio_script),
    content: readString(value.content),
    hotspotId: readNumber(value.hotspotId ?? hotspot?.hotspotId),
    hotspotName: readString(value.hotspotName ?? hotspot?.hotspotName),
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

function getErrorMessage(body: unknown, storyId: number, status: number) {
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

  return `Không thể tải story #${storyId} (${status}).`;
}

function getConnectionErrorMessage(url: string) {
  if (Platform.OS === "android" && url.startsWith("http://")) {
    return "Android đang chặn kết nối HTTP tới API. Hãy dùng HTTPS hoặc rebuild Android dev client sau khi bật cleartext traffic.";
  }

  return "Không thể kết nối đến máy chủ story.";
}

export async function getStoryById({
  accessToken,
  storyId,
  tokenType,
}: GetStoryByIdRequest): Promise<StoryDto> {
  const getStoryByIdUrl = resolveGetStoryByIdUrl(storyId);
  const resolvedAccessToken = accessToken?.trim();
  let response: Response;

  try {
    response = await fetch(getStoryByIdUrl, {
      headers: {
        Accept: "application/json",
        "Content-Type": "application/json",
        "X-Client-Type": "mobile",
        ...(resolvedAccessToken
          ? {
              Authorization: `${tokenType ?? "Bearer"} ${resolvedAccessToken}`,
            }
          : {}),
      },
      method: "GET",
    });
  } catch (error) {
    console.warn("[home] get story by id network failure", {
      error: serializeError(error),
      platform: Platform.OS,
      storyId,
      url: getStoryByIdUrl,
    });
    throw new Error(getConnectionErrorMessage(getStoryByIdUrl));
  }

  const responseBody = await parseResponseBody(response);

  if (!response.ok) {
    console.warn("[home] get story by id rejected", {
      body: summarizeBody(responseBody),
      status: response.status,
      storyId,
      url: getStoryByIdUrl,
    });
    throw new Error(getErrorMessage(responseBody, storyId, response.status));
  }

  const parsedStory = parseStory(
    isObject(responseBody) && isObject(responseBody.data)
      ? responseBody.data
      : responseBody,
  );

  if (!parsedStory) {
    console.warn("[home] get story by id invalid payload", {
      body: summarizeBody(responseBody),
      storyId,
      url: getStoryByIdUrl,
    });
    throw new Error("API chi tiết story trả về dữ liệu không đúng định dạng.");
  }

  return parsedStory;
}
