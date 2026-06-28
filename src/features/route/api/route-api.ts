import { Platform } from "react-native";

import { PublicEnv, buildApiUrl } from "@/constants/env";
import type { RouteItem } from "@/lib/demo-data";

export type RouteDifficulty = "EASY" | "MEDIUM" | "HARD" | string;
export type RouteStatus =
  | "DRAFT"
  | "PENDING"
  | "PUBLISHED"
  | "APPROVED"
  | "REJECTED"
  | "DELETED"
  | string;

export type RouteTagDto = {
  createdAt: string;
  hotspotCount: number | null;
  tagId: number;
  tagName: string;
  tagStatus: string;
  updatedAt: string;
};

export type RouteMediaDto = {
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

export type RouteHotspotDto = {
  address: string;
  distanceToNext: number | null;
  hotspotId: number;
  hotspotName: string;
  index: number | null;
  routeHotspotId: number;
  routeId: number;
  xp: number | null;
};

export type RouteDto = {
  description: string;
  difficulty: RouteDifficulty;
  estimateTime: number;
  hotspots: RouteHotspotDto[];
  medias: RouteMediaDto[];
  point: number;
  routeId: number;
  routeName: string;
  status: RouteStatus;
  tags: RouteTagDto[];
  totalDistance: number;
  xp: number;
};

export type RoutePageDto = {
  content: RouteDto[];
  number: number;
  size: number;
  totalElements: number;
  totalPages: number;
};

type GetRoutesRequest = {
  accessToken?: string | null;
  page?: number;
  size?: number;
  sortBy?: string;
  sortDirection?: "ASC" | "DESC";
  status?: RouteStatus;
  tokenType?: string | null;
};

type GetRouteByIdRequest = {
  accessToken?: string | null;
  routeId: number | string;
  tokenType?: string | null;
};

const FALLBACK_API_BASE_URL = "http://13.158.40.56:8080";
const FALLBACK_COVER =
  "https://i.pinimg.com/1200x/80/69/f9/8069f9581583a196f9f39bda000b9312.jpg";

function resolveApiUrl(path: string) {
  return PublicEnv.apiBaseUrl.trim()
    ? buildApiUrl(path)
    : `${FALLBACK_API_BASE_URL}${path}`;
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

function parseTag(value: unknown): RouteTagDto | null {
  if (!isObject(value)) return null;
  const tagId = readNumber(value.tagId);
  if (tagId === null) return null;

  return {
    createdAt: readString(value.createdAt),
    hotspotCount: readNumber(value.hotspotCount),
    tagId,
    tagName: readString(value.tagName),
    tagStatus: readString(value.tagStatus),
    updatedAt: readString(value.updatedAt),
  };
}

function parseMedia(value: unknown): RouteMediaDto | null {
  if (!isObject(value)) return null;
  const mediaId = readNumber(value.mediaId);
  if (mediaId === null) return null;

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

function parseHotspot(value: unknown): RouteHotspotDto | null {
  if (!isObject(value)) return null;
  const routeHotspotId = readNumber(value.routeHotspotId) ?? 0;
  const routeId = readNumber(value.routeId) ?? 0;
  const hotspotId = readNumber(value.hotspotId);
  if (hotspotId === null) return null;

  return {
    address: readString(value.address),
    distanceToNext: readNumber(value.distanceToNext),
    hotspotId,
    hotspotName: readString(value.hotspotName),
    index: readNumber(value.index),
    routeHotspotId,
    routeId,
    xp: readNumber(value.xp),
  };
}

function parseRoute(value: unknown): RouteDto | null {
  if (!isObject(value)) return null;
  const routeId = readNumber(value.routeId);
  const routeName = readString(value.routeName);
  if (routeId === null || !routeName.trim()) return null;

  return {
    description: readString(value.description),
    difficulty: readString(value.difficulty),
    estimateTime: readNumber(value.estimateTime) ?? 0,
    hotspots: Array.isArray(value.hotspots)
      ? value.hotspots.map(parseHotspot).filter(isNonNull)
      : [],
    medias: Array.isArray(value.medias)
      ? value.medias.map(parseMedia).filter(isNonNull)
      : [],
    point: readNumber(value.point) ?? 0,
    routeId,
    routeName,
    status: readString(value.status),
    tags: Array.isArray(value.tags)
      ? value.tags.map(parseTag).filter(isNonNull)
      : [],
    totalDistance: readNumber(value.totalDistance) ?? 0,
    xp: readNumber(value.xp) ?? 0,
  };
}

function parsePage(value: unknown): RoutePageDto {
  if (!isObject(value)) {
    throw new Error("API route trả về dữ liệu không đúng định dạng.");
  }

  const content = Array.isArray(value.content)
    ? value.content.map(parseRoute).filter(isNonNull)
    : [];

  return {
    content,
    number: readNumber(value.number) ?? 0,
    size: readNumber(value.size) ?? content.length,
    totalElements: readNumber(value.totalElements) ?? content.length,
    totalPages: readNumber(value.totalPages) ?? 1,
  };
}

async function parseResponseBody(response: Response) {
  const rawBody = await response.text();
  if (!rawBody) return null;

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
      if (typeof candidate === "string" && candidate.trim())
        return candidate.trim();
    }
  }

  if (typeof body === "string" && body.trim()) return body.trim();
  return `Không thể tải route (${status}).`;
}

function getConnectionErrorMessage(url: string) {
  if (Platform.OS === "android" && url.startsWith("http://")) {
    return "Android đang chặn kết nối HTTP tới API. Hãy dùng HTTPS hoặc rebuild Android dev client sau khi bật cleartext traffic.";
  }

  return "Không thể kết nối đến máy chủ route.";
}

async function requestJson(
  url: string,
  accessToken?: string | null,
  tokenType?: string | null,
) {
  let response: Response;

  try {
    response = await fetch(url, {
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
    console.warn("[route] network failure", {
      error,
      platform: Platform.OS,
      url,
    });
    throw new Error(getConnectionErrorMessage(url));
  }

  const body = await parseResponseBody(response);

  if (!response.ok) {
    console.warn("[route] request rejected", {
      body,
      status: response.status,
      url,
    });
    throw new Error(getErrorMessage(body, response.status));
  }

  return body;
}

export function getFirstRouteImage(route: RouteDto) {
  const imageMedia =
    route.medias.find((item) => {
      const type = `${item.mediaType} ${item.mimeType}`.toLowerCase();
      return type.includes("image");
    }) ?? route.medias[0];

  return imageMedia?.fileUrl || FALLBACK_COVER;
}

function getDifficultyLabel(difficulty: string) {
  switch (difficulty.toUpperCase()) {
    case "EASY":
      return "Dễ";
    case "MEDIUM":
      return "Trung bình";
    case "HARD":
      return "Khó";
    default:
      return difficulty || "Chưa rõ";
  }
}

export function mapRouteToRouteItem(route: RouteDto): RouteItem {
  const sortedHotspots = [...route.hotspots].sort(
    (a, b) => (a.index ?? 0) - (b.index ?? 0),
  );
  const tagNames = route.tags.map((tag) => tag.tagName).filter(Boolean);

  return {
    id: String(route.routeId),
    title: route.routeName,
    subtitle: route.description || "Chưa có mô tả cho tuyến này.",
    cover: getFirstRouteImage(route),
    era: tagNames[0] || "Tuyến chính thức",
    difficulty: getDifficultyLabel(route.difficulty),
    distance: `${route.totalDistance || 0} km`,
    duration: `${Math.round(route.estimateTime || 0)} phút`,
    hotspotIds: sortedHotspots.map((hotspot) => String(hotspot.hotspotId)),
    xp: route.xp || 0,
    rating: 4.8,
    theme: route.description || "Tuyến khám phá được xây dựng bởi Curator.",
    meaning: tagNames.length
      ? `Chủ đề: ${tagNames.join(", ")}.`
      : "Tuyến giúp Explorer khám phá các điểm văn hoá theo thứ tự gợi ý.",
    story:
      route.description ||
      "Bắt đầu hành trình, đi qua từng điểm dừng và mở khoá trải nghiệm tại mỗi hotspot.",
    connection: sortedHotspots.length
      ? `Tuyến gồm ${sortedHotspots.length} điểm dừng, được sắp xếp theo thứ tự khám phá.`
      : "Tuyến chưa có danh sách hotspot chi tiết.",
  };
}

export async function getRoutes({
  accessToken,
  page = 0,
  size = 20,
  sortBy = "routeId",
  sortDirection = "DESC",
  status = "PUBLISHED",
  tokenType,
}: GetRoutesRequest = {}): Promise<RoutePageDto> {
  const params = new URLSearchParams({
    page: String(page),
    size: String(size),
    sortBy,
    sortDirection,
  });

  if (status) {
    params.append("filters[0].field", "status");
    params.append("filters[0].operator", "EQUALS");
    params.append("filters[0].value", status);
  }

  const body = await requestJson(
    resolveApiUrl(`/api/v1/routes/search?${params.toString()}`),
    accessToken,
    tokenType,
  );
  return parsePage(body);
}

export async function getRouteById({
  accessToken,
  routeId,
  tokenType,
}: GetRouteByIdRequest): Promise<RouteDto> {
  const numericRouteId = Number(routeId);
  if (!Number.isFinite(numericRouteId)) {
    throw new Error("Route id không hợp lệ.");
  }

  const body = await requestJson(
    resolveApiUrl(`/api/v1/routes/${numericRouteId}`),
    accessToken,
    tokenType,
  );
  const route = parseRoute(body);

  if (!route) {
    throw new Error("API route detail trả về dữ liệu không hợp lệ.");
  }

  return route;
}
