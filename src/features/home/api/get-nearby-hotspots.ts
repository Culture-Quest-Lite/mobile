import { Platform } from "react-native";

import { PublicEnv, buildApiUrl } from "@/constants/env";

import { isPublishedHotspotStatus } from "./hotspot-status";

export type NearbyHotspotTagDto = {
  createdAt: string;
  hotspotCount: number | null;
  imageUrl?: string | null;
  tagId: number;
  tagName: string;
  tagStatus: string;
  updatedAt: string;
};

export type NearbyHotspotMediaDto = {
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

export type NearbyHotspotStoryTagDto = {
  createdAt: string;
  imageUrl?: string | null;
  tagId: number;
  tagName: string;
  tagStatus: string;
  updatedAt: string;
};

export type NearbyHotspotStoryDto = {
  audioScript: string;
  content: string;
  distanceToNext: number | null;
  medias: NearbyHotspotMediaDto[];
  orderIndex: number | null;
  status: string;
  storyId: number;
  tag: NearbyHotspotStoryTagDto | null;
  title: string;
};

export type NearbyHotspotDto = {
  address: string;
  averageRating: number | null;
  closingTime: string;
  totalReviews: number | null;
  createByUserId: number | null;
  createdAt: string;
  description: string;
  endTime: string;
  estimatedDurationMax: number | null;
  estimatedDurationMin: number | null;
  historyInformation: string;
  hotspotId: number;
  hotspotName: string;
  isCheckedIn: boolean | null;
  latitude: number;
  longitude: number;
  medias: NearbyHotspotMediaDto[];
  openingTime: string;
  point: number | null;
  startTime: string;
  status: string;
  stories: NearbyHotspotStoryDto[];
  tags: NearbyHotspotTagDto[];
  updatedAt: string;
  xp: number | null;
};

type GetNearbyHotspotsRequest = {
  accessToken?: string | null;
  distance: number;
  latitude: number;
  longitude: number;
  tokenType?: string | null;
};

function resolveGetNearbyHotspotsUrl({
  distance,
  latitude,
  longitude,
}: Pick<GetNearbyHotspotsRequest, "distance" | "latitude" | "longitude">) {
  const baseUrl = PublicEnv.apiBaseUrl.trim()
    ? buildApiUrl("/api/v1/hotspots/nearby")
    : "http://13.158.40.56:8080/api/v1/hotspots/nearby";

  return `${baseUrl}?latitude=${latitude}&longitude=${longitude}&distance=${distance}`;
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

function readNullableString(value: unknown) {
  return typeof value === "string" ? value : null;
}

function readNullableBoolean(value: unknown) {
  if (typeof value === "boolean") {
    return value;
  }

  return null;
}

function parseTag(value: unknown): NearbyHotspotTagDto | null {
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

function parseMedia(value: unknown): NearbyHotspotMediaDto | null {
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

function parseStoryTag(value: unknown): NearbyHotspotStoryTagDto | null {
  if (!isObject(value)) {
    return null;
  }

  const tagId = readNumber(value.tagId);

  if (tagId === null) {
    return null;
  }

  return {
    createdAt: readString(value.createdAt),
    imageUrl: readNullableString(value.imageUrl)?.trim() || null,
    tagId,
    tagName: readString(value.tagName),
    tagStatus: readString(value.tagStatus),
    updatedAt: readString(value.updatedAt),
  };
}

function parseStory(value: unknown): NearbyHotspotStoryDto | null {
  if (!isObject(value)) {
    return null;
  }

  const storyId = readNumber(value.storyId);

  if (storyId === null) {
    return null;
  }

  return {
    audioScript:
      readString(value.audioScript) || readString(value.audio_script),
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

function parseNearbyHotspot(value: unknown): NearbyHotspotDto | null {
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
    averageRating: readNumber(value.averageRating),
    closingTime: readString(value.closingTime),
    totalReviews: readNumber(
      value.totalReviews ?? value.totalReview ?? value.total_reviews,
    ),
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

function getErrorMessage(body: unknown, status: number) {
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

  return `Không thể tải hotspot gần bạn (${status}).`;
}

function getConnectionErrorMessage(url: string) {
  if (Platform.OS === "android" && url.startsWith("http://")) {
    return "Android đang chặn kết nối HTTP tới API. Hãy dùng HTTPS hoặc rebuild Android dev client sau khi bật cleartext traffic.";
  }

  return "Không thể kết nối đến máy chủ hotspot gần bạn.";
}

export async function getNearbyHotspots({
  accessToken,
  distance,
  latitude,
  longitude,
  tokenType,
}: GetNearbyHotspotsRequest): Promise<NearbyHotspotDto[]> {
  const getNearbyHotspotsUrl = resolveGetNearbyHotspotsUrl({
    distance,
    latitude,
    longitude,
  });
  let response: Response;

  try {
    response = await fetch(getNearbyHotspotsUrl, {
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
    console.warn("[home] get nearby hotspots network failure", {
      error: serializeError(error),
      platform: Platform.OS,
      url: getNearbyHotspotsUrl,
    });
    throw new Error(getConnectionErrorMessage(getNearbyHotspotsUrl));
  }

  const responseBody = await parseResponseBody(response);

  if (!response.ok) {
    console.warn("[home] get nearby hotspots rejected", {
      body: summarizeBody(responseBody),
      status: response.status,
      url: getNearbyHotspotsUrl,
    });
    throw new Error(getErrorMessage(responseBody, response.status));
  }

  if (!Array.isArray(responseBody)) {
    console.warn("[home] get nearby hotspots invalid payload", {
      body: summarizeBody(responseBody),
      url: getNearbyHotspotsUrl,
    });
    throw new Error("API nearby hotspot trả về dữ liệu không đúng định dạng.");
  }

  const parsedHotspots = responseBody.map(parseNearbyHotspot);

  if (parsedHotspots.some((item) => item === null)) {
    console.warn("[home] get nearby hotspots invalid item", {
      body: summarizeBody(responseBody),
      url: getNearbyHotspotsUrl,
    });
    throw new Error("API nearby hotspot có phần tử dữ liệu không hợp lệ.");
  }

  const validHotspots = parsedHotspots.filter(isNonNull);
  const publishedHotspots = validHotspots.filter((hotspot) =>
    isPublishedHotspotStatus(hotspot.status),
  );

  if (publishedHotspots.length !== validHotspots.length) {
    console.info("[home] filtered non-publish nearby hotspots", {
      filteredCount: validHotspots.length - publishedHotspots.length,
      filteredStatuses: validHotspots
        .filter((hotspot) => !isPublishedHotspotStatus(hotspot.status))
        .map((hotspot) => hotspot.status),
      url: getNearbyHotspotsUrl,
    });
  }

  return publishedHotspots;
}
