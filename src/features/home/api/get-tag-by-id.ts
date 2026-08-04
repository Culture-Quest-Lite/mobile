import { Platform } from "react-native";

import { PublicEnv, buildApiUrl } from "@/constants/env";

type GetTagByIdRequest = {
  accessToken?: string | null;
  tagId: number;
  tokenType?: string | null;
};

export type TagUsageType = "ROUTE" | "HOTSPOT" | "STORY" | string;

export type TagUsageDto = {
  refId: number;
  type: TagUsageType;
};

export type TagDetailDto = {
  createdAt: string;
  hotspotCount: number;
  imageUrl: string | null;
  routeCount: number;
  storyCount: number;
  tagId: number;
  tagName: string;
  tagStatus: string;
  updatedAt: string;
  usages: TagUsageDto[];
};

function resolveGetTagByIdUrl(tagId: number) {
  if (PublicEnv.apiBaseUrl.trim()) {
    return buildApiUrl(`/api/tags/${tagId}`);
  }

  return `http://13.158.40.56:8080/api/tags/${tagId}`;
}

function isObject(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}

function readNumber(value: unknown, fallback = 0) {
  return typeof value === "number" && Number.isFinite(value) ? value : fallback;
}

function readString(value: unknown) {
  return typeof value === "string" ? value : "";
}

function readNullableString(value: unknown) {
  const resolvedValue = typeof value === "string" ? value.trim() : "";
  return resolvedValue ? resolvedValue : null;
}

function parseUsage(value: unknown): TagUsageDto | null {
  if (!isObject(value)) {
    return null;
  }

  const refId = readNumber(value.refId, Number.NaN);
  const type = readString(value.type).trim().toUpperCase();

  if (!Number.isInteger(refId) || refId <= 0 || !type) {
    return null;
  }

  return {
    refId,
    type,
  };
}

function isNonNull<T>(value: T | null): value is T {
  return value !== null;
}

function parseTagDetail(value: unknown): TagDetailDto | null {
  if (!isObject(value)) {
    return null;
  }

  const tagId = readNumber(value.tagId, Number.NaN);
  const tagName = readString(value.tagName).trim();

  if (!Number.isInteger(tagId) || !tagName) {
    return null;
  }

  return {
    createdAt: readString(value.createdAt),
    hotspotCount: readNumber(value.hotspotCount),
    imageUrl: readNullableString(value.imageUrl),
    routeCount: readNumber(value.routeCount),
    storyCount: readNumber(value.storyCount),
    tagId,
    tagName,
    tagStatus: readString(value.tagStatus),
    updatedAt: readString(value.updatedAt),
    usages: Array.isArray(value.usages)
      ? value.usages.map(parseUsage).filter(isNonNull)
      : [],
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

function getErrorMessage(body: unknown, tagId: number, status: number) {
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

  return `Không thể tải chủ đề #${tagId} (${status}).`;
}

function getConnectionErrorMessage(url: string) {
  if (Platform.OS === "android" && url.startsWith("http://")) {
    return "Android đang chặn kết nối HTTP tới API. Hãy dùng HTTPS hoặc rebuild Android dev client sau khi bật cleartext traffic.";
  }

  return "Không thể kết nối đến máy chủ chủ đề.";
}

export function getTagUsageRefIds(tag: TagDetailDto, type: TagUsageType) {
  const normalizedType = type.trim().toUpperCase();
  const refIds = new Set<number>();

  tag.usages.forEach((usage) => {
    if (usage.type === normalizedType) {
      refIds.add(usage.refId);
    }
  });

  return Array.from(refIds);
}

export async function getTagById({
  accessToken,
  tagId,
  tokenType,
}: GetTagByIdRequest): Promise<TagDetailDto> {
  const getTagByIdUrl = resolveGetTagByIdUrl(tagId);
  const resolvedAccessToken = accessToken?.trim();
  let response: Response;

  try {
    response = await fetch(getTagByIdUrl, {
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
    console.warn("[home] get tag by id network failure", {
      error: serializeError(error),
      platform: Platform.OS,
      tagId,
      url: getTagByIdUrl,
    });
    throw new Error(getConnectionErrorMessage(getTagByIdUrl));
  }

  const responseBody = await parseResponseBody(response);

  if (!response.ok) {
    console.warn("[home] get tag by id rejected", {
      body: summarizeBody(responseBody),
      status: response.status,
      tagId,
      url: getTagByIdUrl,
    });
    throw new Error(getErrorMessage(responseBody, tagId, response.status));
  }

  const parsedTag = parseTagDetail(
    isObject(responseBody) && isObject(responseBody.data)
      ? responseBody.data
      : responseBody,
  );

  if (!parsedTag) {
    console.warn("[home] get tag by id invalid payload", {
      body: summarizeBody(responseBody),
      tagId,
      url: getTagByIdUrl,
    });
    throw new Error("API chi tiết chủ đề trả về dữ liệu không đúng định dạng.");
  }

  return parsedTag;
}
