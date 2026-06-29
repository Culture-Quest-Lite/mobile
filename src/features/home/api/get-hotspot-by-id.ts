import { Platform } from "react-native";

import { PublicEnv, buildApiUrl } from "@/constants/env";

import type { NearbyHotspotDto } from "./get-nearby-hotspots";

type GetHotspotByIdRequest = {
  accessToken?: string | null;
  hotspotId: number;
  tokenType?: string | null;
};

function resolveGetHotspotByIdUrl(hotspotId: number) {
  const baseUrl = PublicEnv.apiBaseUrl.trim()
    ? buildApiUrl(`/api/v1/hotspots/${hotspotId}`)
    : `http://13.158.40.56:8080/api/v1/hotspots/${hotspotId}`;

  return baseUrl;
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

function readNullableBoolean(value: unknown) {
  if (typeof value === "boolean") {
    return value;
  }

  return null;
}

function hasPublishedStatus(status: string) {
  return status.trim().toLowerCase() === "publish";
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

function isNonNull<T>(value: T | null): value is T {
  return value !== null;
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
    isCheckedIn: readNullableBoolean(value.isCheckedIn),
    latitude,
    longitude,
    medias: Array.isArray(value.medias)
      ? value.medias.map(parseMedia).filter(isNonNull)
      : [],
    openingTime: readString(value.openingTime),
    point: readNumber(value.point),
    startTime: readString(value.startTime),
    status: readString(value.status),
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

  return `Không thể tải hotspot #${hotspotId} (${status}).`;
}

function getConnectionErrorMessage(url: string) {
  if (Platform.OS === "android" && url.startsWith("http://")) {
    return "Android đang chặn kết nối HTTP tới API. Hãy dùng HTTPS hoặc rebuild Android dev client sau khi bật cleartext traffic.";
  }

  return "Không thể kết nối đến máy chủ chi tiết hotspot.";
}

export async function getHotspotById({
  accessToken,
  hotspotId,
  tokenType,
}: GetHotspotByIdRequest): Promise<NearbyHotspotDto> {
  const getHotspotByIdUrl = resolveGetHotspotByIdUrl(hotspotId);
  let response: Response;

  try {
    response = await fetch(getHotspotByIdUrl, {
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
    console.warn("[hotspot] get hotspot by id network failure", {
      error: serializeError(error),
      hotspotId,
      platform: Platform.OS,
      url: getHotspotByIdUrl,
    });
    throw new Error(getConnectionErrorMessage(getHotspotByIdUrl));
  }

  const responseBody = await parseResponseBody(response);

  if (!response.ok) {
    console.warn("[hotspot] get hotspot by id rejected", {
      body: summarizeBody(responseBody),
      hotspotId,
      status: response.status,
      url: getHotspotByIdUrl,
    });
    throw new Error(getErrorMessage(responseBody, hotspotId, response.status));
  }

  const parsedHotspot = parseHotspot(responseBody);

  if (!parsedHotspot) {
    console.warn("[hotspot] get hotspot by id invalid payload", {
      body: summarizeBody(responseBody),
      hotspotId,
      url: getHotspotByIdUrl,
    });
    throw new Error("API chi tiết hotspot trả về dữ liệu không đúng định dạng.");
  }

  if (!hasPublishedStatus(parsedHotspot.status)) {
    console.warn("[hotspot] get hotspot by id filtered non-publish hotspot", {
      hotspotId,
      status: parsedHotspot.status,
      url: getHotspotByIdUrl,
    });
    throw new Error("Hotspot này chưa ở trạng thái publish.");
  }

  return parsedHotspot;
}
