import { Platform } from "react-native";

import { PublicEnv, buildApiUrl } from "@/constants/env";

import type { NearbyHotspotDto } from "./get-nearby-hotspots";

export type HotspotSearchOperator =
  | "EQUALS"
  | "NOT_EQUALS"
  | "LIKE"
  | "GREATER_THAN"
  | "LESS_THAN"
  | "GREATER_THAN_OR_EQUAL"
  | "LESS_THAN_OR_EQUAL"
  | "IN";

export type HotspotSearchSortDirection = "ASC" | "DESC";

export type HotspotSearchFilterPayload = {
  field: string;
  operator: HotspotSearchOperator;
  value?: number | string;
  values?: (number | string)[];
};

export type SearchHotspotsPayload = {
  filters: HotspotSearchFilterPayload[];
  page: number;
  size: number;
  sortBy: string;
  sortDirection: HotspotSearchSortDirection;
};

export type SearchHotspotsPage = {
  content: NearbyHotspotDto[];
  page: {
    number: number;
    size: number;
    totalElements: number;
    totalPages: number;
  };
};

type BaseHotspotRequest = {
  accessToken?: string | null;
  signal?: AbortSignal;
  tokenType?: string | null;
};

function resolveHotspotsUrl() {
  if (PublicEnv.apiBaseUrl.trim()) {
    return buildApiUrl("/api/v1/hotspots");
  }

  return "http://3.113.215.65:8080/api/v1/hotspots";
}

function resolveSearchHotspotsUrl() {
  if (PublicEnv.apiBaseUrl.trim()) {
    return buildApiUrl("/api/v1/hotspots/search");
  }

  return "http://3.113.215.65:8080/api/v1/hotspots/search";
}

function isObject(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}

function isNonNull<T>(value: T | null): value is T {
  return value !== null;
}

function readNumber(value: unknown) {
  return typeof value === "number" && Number.isFinite(value) ? value : null;
}

function readString(value: unknown) {
  return typeof value === "string" ? value : "";
}

function readNullableBoolean(value: unknown) {
  if (typeof value === "boolean") {
    return value;
  }

  return null;
}

function parseTag(value: unknown) {
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

function parseMedia(value: unknown) {
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

function parseStoryTag(value: unknown) {
  if (!isObject(value)) {
    return null;
  }

  const tagId = readNumber(value.tagId);

  if (tagId === null) {
    return null;
  }

  return {
    createdAt: readString(value.createdAt),
    tagId,
    tagName: readString(value.tagName),
    tagStatus: readString(value.tagStatus),
    updatedAt: readString(value.updatedAt),
  };
}

function parseStory(value: unknown) {
  if (!isObject(value)) {
    return null;
  }

  const storyId = readNumber(value.storyId);

  if (storyId === null) {
    return null;
  }

  return {
    content: readString(value.content),
    distanceToNext: readNumber(value.distanceToNext),
    medias: Array.isArray(value.medias)
      ? value.medias.map(parseMedia).filter(isNonNull)
      : [],
    orderIndex: readNumber(value.orderIndex),
    status: readString(value.status),
    storyId,
    tag: parseStoryTag(value.tag),
    title: readString(value.title),
  };
}

function parseHotspot(value: unknown): NearbyHotspotDto | null {
  if (!isObject(value)) {
    return null;
  }

  const hotspotId = readNumber(value.hotspotId);
  const latitude = readNumber(value.latitude);
  const longitude = readNumber(value.longitude);
  const hotspotName = readString(value.hotspotName);

  if (
    hotspotId === null ||
    latitude === null ||
    longitude === null ||
    !hotspotName.trim()
  ) {
    return null;
  }

  return {
    address: readString(value.address),
    closingTime: readString(value.closingTime),
    createByUserId: readNumber(value.createByUserId),
    createdAt: readString(value.createdAt),
    description: readString(value.description),
    endTime: readString(value.endTime),
    estimatedDurationMax: readNumber(value.estimatedDurationMax),
    estimatedDurationMin: readNumber(value.estimatedDurationMin),
    historyInformation: readString(value.historyInformation),
    hotspotId,
    hotspotName,
    isCheckedIn: readNullableBoolean(value.isCheckedIn ?? value.isCheckIn),
    latitude,
    longitude,
    medias: Array.isArray(value.medias)
      ? value.medias.map(parseMedia).filter(isNonNull)
      : [],
    openingTime: readString(value.openingTime),
    point: readNumber(value.point),
    startTime: readString(value.startTime),
    status: readString(value.status),
    stories: Array.isArray(value.stories)
      ? value.stories.map(parseStory).filter(isNonNull)
      : [],
    tags: Array.isArray(value.tags)
      ? value.tags.map(parseTag).filter(isNonNull)
      : [],
    updatedAt: readString(value.updatedAt),
    xp: readNumber(value.xp),
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

function getErrorMessage(body: unknown, status: number, fallback: string) {
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

  return `${fallback} (${status}).`;
}

function getConnectionErrorMessage(url: string, fallback: string) {
  if (Platform.OS === "android" && url.startsWith("http://")) {
    return "Android đang chặn kết nối HTTP tới API. Hãy dùng HTTPS hoặc rebuild Android dev client sau khi bật cleartext traffic.";
  }

  return fallback;
}

function buildAuthHeaders(accessToken?: string | null, tokenType?: string | null) {
  return {
    Accept: "application/json",
    "Content-Type": "application/json",
    "X-Client-Type": "mobile",
    ...(accessToken
      ? { Authorization: `${tokenType ?? "Bearer"} ${accessToken}` }
      : {}),
  };
}

function buildSearchParams(payload: SearchHotspotsPayload) {
  const params = new URLSearchParams({
    page: String(payload.page),
    size: String(payload.size),
    sortBy: payload.sortBy,
    sortDirection: payload.sortDirection,
  });

  payload.filters.forEach((filter, filterIndex) => {
    params.set(`filters[${filterIndex}].field`, filter.field);
    params.set(`filters[${filterIndex}].operator`, filter.operator);

    if (filter.value !== undefined) {
      params.set(`filters[${filterIndex}].value`, String(filter.value));
    }

    filter.values?.forEach((value, valueIndex) => {
      params.set(`filters[${filterIndex}].values[${valueIndex}]`, String(value));
    });
  });

  return params;
}

export async function getHotspots({
  accessToken,
  signal,
  tokenType,
}: BaseHotspotRequest = {}): Promise<NearbyHotspotDto[]> {
  const url = resolveHotspotsUrl();
  let response: Response;

  try {
    response = await fetch(url, {
      headers: buildAuthHeaders(accessToken, tokenType),
      method: "GET",
      signal,
    });
  } catch (error) {
    if (signal?.aborted) {
      throw error;
    }

    console.warn("[home] get hotspots network failure", {
      error: serializeError(error),
      platform: Platform.OS,
      url,
    });
    throw new Error(getConnectionErrorMessage(url, "Không thể kết nối đến máy chủ hotspot."));
  }

  const responseBody = await parseResponseBody(response);

  if (!response.ok) {
    console.warn("[home] get hotspots rejected", {
      body: summarizeBody(responseBody),
      status: response.status,
      url,
    });
    throw new Error(getErrorMessage(responseBody, response.status, "Không thể tải danh sách hotspot"));
  }

  if (!Array.isArray(responseBody)) {
    console.warn("[home] get hotspots invalid payload", {
      body: summarizeBody(responseBody),
      url,
    });
    throw new Error("API hotspot trả về dữ liệu không đúng định dạng.");
  }

  const parsedHotspots = responseBody.map(parseHotspot);

  if (parsedHotspots.some((item) => item === null)) {
    console.warn("[home] get hotspots invalid item", {
      body: summarizeBody(responseBody),
      url,
    });
    throw new Error("API hotspot có phần tử dữ liệu không hợp lệ.");
  }

  return parsedHotspots.filter(isNonNull);
}

export async function searchHotspots({
  accessToken,
  payload,
  signal,
  tokenType,
}: BaseHotspotRequest & {
  payload: SearchHotspotsPayload;
}): Promise<SearchHotspotsPage> {
  const params = buildSearchParams(payload);
  const url = `${resolveSearchHotspotsUrl()}?${params.toString()}`;
  let response: Response;

  try {
    response = await fetch(url, {
      headers: buildAuthHeaders(accessToken, tokenType),
      method: "GET",
      signal,
    });
  } catch (error) {
    if (signal?.aborted) {
      throw error;
    }

    console.warn("[home] search hotspots network failure", {
      error: serializeError(error),
      platform: Platform.OS,
      url,
    });
    throw new Error(
      getConnectionErrorMessage(url, "Không thể kết nối đến máy chủ tìm kiếm hotspot."),
    );
  }

  const responseBody = await parseResponseBody(response);

  if (!response.ok) {
    console.warn("[home] search hotspots rejected", {
      body: summarizeBody(responseBody),
      status: response.status,
      url,
    });
    throw new Error(
      getErrorMessage(responseBody, response.status, "Không thể tìm kiếm hotspot"),
    );
  }

  if (!isObject(responseBody) || !Array.isArray(responseBody.content)) {
    console.warn("[home] search hotspots invalid payload", {
      body: summarizeBody(responseBody),
      url,
    });
    throw new Error("API search hotspot trả về dữ liệu không đúng định dạng.");
  }

  const parsedContent = responseBody.content.map(parseHotspot);

  if (parsedContent.some((item) => item === null)) {
    console.warn("[home] search hotspots invalid item", {
      body: summarizeBody(responseBody),
      url,
    });
    throw new Error("API search hotspot có phần tử dữ liệu không hợp lệ.");
  }

  const pageMetadata = isObject(responseBody.page) ? responseBody.page : {};

  return {
    content: parsedContent.filter(isNonNull),
    page: {
      number: readNumber(pageMetadata.number) ?? payload.page,
      size: readNumber(pageMetadata.size) ?? payload.size,
      totalElements:
        readNumber(pageMetadata.totalElements) ?? parsedContent.filter(isNonNull).length,
      totalPages: readNumber(pageMetadata.totalPages) ?? 1,
    },
  };
}
