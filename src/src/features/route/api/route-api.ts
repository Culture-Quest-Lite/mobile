import { Platform } from "react-native";

import { PublicEnv, buildApiUrl } from "@/constants/env";

export type RouteDifficulty = "EASY" | "MEDIUM" | "HARD" | string;
export type RouteStatus = "DRAFT" | "PENDING" | "PUBLISHED" | "APPROVED" | "REJECTED" | "DELETED" | string;

export type RouteTagDto = {
  createdAt?: string;
  hotspotCount?: number | null;
  tagId: number;
  tagName: string;
  tagStatus?: string;
  updatedAt?: string;
};

export type RouteMediaDto = {
  createdAt?: string;
  displayOrder?: number | null;
  fileName?: string;
  fileSize?: number | null;
  fileUrl: string;
  mediaId: number;
  mediaType?: string;
  mimeType?: string;
  updatedAt?: string;
};

export type RouteHotspotDto = {
  distanceToNext?: number | null;
  hotspotId: number;
  hotspotName?: string;
  latitude?: number | null;
  longitude?: number | null;
  orderIndex?: number | null;
  sequenceNumber?: number | null;
  index?: number | null;
  address?: string;
  description?: string;
  xp?: number | null;
  point?: number | null;
  medias?: RouteMediaDto[];
};

export type RouteDto = {
  routeId: number;
  routeName: string;
  description: string;
  difficulty: RouteDifficulty;
  estimateTime: number;
  totalDistance: number;
  status: RouteStatus;
  xp: number;
  point: number;
  tags: RouteTagDto[];
  hotspots: RouteHotspotDto[];
  medias: RouteMediaDto[];
};

export type RoutePageDto = {
  content: RouteDto[];
  number: number;
  size: number;
  totalElements: number;
  totalPages: number;
};

type SearchRoutesRequest = {
  accessToken?: string | null;
  page?: number;
  size?: number;
  sortBy?: string;
  sortDirection?: "ASC" | "DESC";
  status?: string;
  tokenType?: string | null;
};

type RouteDetailRequest = {
  accessToken?: string | null;
  routeId: number | string;
  tokenType?: string | null;
};

function resolveRouteUrl(path: string) {
  return PublicEnv.apiBaseUrl.trim()
    ? buildApiUrl(path)
    : `http://13.158.40.56:8080${path}`;
}

function isObject(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}

function isNonNull<T>(value: T | null): value is T {
  return value !== null;
}

function readNumber(value: unknown, fallback = 0) {
  if (typeof value === "number" && Number.isFinite(value)) return value;
  if (typeof value === "string" && value.trim()) {
    const parsed = Number(value);
    if (Number.isFinite(parsed)) return parsed;
  }
  return fallback;
}

function readNullableNumber(value: unknown) {
  if (typeof value === "number" && Number.isFinite(value)) return value;
  if (typeof value === "string" && value.trim()) {
    const parsed = Number(value);
    if (Number.isFinite(parsed)) return parsed;
  }
  return null;
}

function readString(value: unknown, fallback = "") {
  return typeof value === "string" ? value : fallback;
}


function normalizeLatitudeLongitude(latitudeValue: unknown, longitudeValue: unknown) {
  let latitude = readNullableNumber(latitudeValue);
  let longitude = readNullableNumber(longitudeValue);

  // Một số API trả nhầm thứ tự longitude/latitude. Ví dụ latitude=105, longitude=21.
  // MapView cần latitude nằm trong [-90, 90] và longitude nằm trong [-180, 180].
  if (latitude !== null && longitude !== null && Math.abs(latitude) > 90 && Math.abs(longitude) <= 90) {
    [latitude, longitude] = [longitude, latitude];
  }

  if (latitude !== null && (latitude < -90 || latitude > 90)) latitude = null;
  if (longitude !== null && (longitude < -180 || longitude > 180)) longitude = null;

  return { latitude, longitude };
}

function parseMedia(value: unknown): RouteMediaDto | null {
  if (!isObject(value)) return null;

  const mediaId = readNumber(value.mediaId, -1);
  const fileUrl = readString(value.fileUrl) || readString(value.mediaUrl) || readString(value.url);

  if (mediaId < 0 || !fileUrl.trim()) return null;

  return {
    createdAt: readString(value.createdAt),
    displayOrder: readNullableNumber(value.displayOrder),
    fileName: readString(value.fileName),
    fileSize: readNullableNumber(value.fileSize),
    fileUrl,
    mediaId,
    mediaType: readString(value.mediaType),
    mimeType: readString(value.mimeType),
    updatedAt: readString(value.updatedAt),
  };
}

function parseTag(value: unknown): RouteTagDto | null {
  if (!isObject(value)) return null;

  const tagId = readNumber(value.tagId, -1);
  const tagName = readString(value.tagName);

  if (tagId < 0 || !tagName.trim()) return null;

  return {
    createdAt: readString(value.createdAt),
    hotspotCount: readNullableNumber(value.hotspotCount),
    tagId,
    tagName,
    tagStatus: readString(value.tagStatus),
    updatedAt: readString(value.updatedAt),
  };
}

function parseHotspot(value: unknown): RouteHotspotDto | null {
  if (!isObject(value)) return null;

  const hotspotId = readNumber(value.hotspotId, -1);

  if (hotspotId < 0) return null;

  const { latitude, longitude } = normalizeLatitudeLongitude(value.latitude, value.longitude);

  return {
    address: readString(value.address),
    description: readString(value.description),
    distanceToNext: readNullableNumber(value.distanceToNext),
    hotspotId,
    hotspotName: readString(value.hotspotName) || readString(value.name),
    index: readNullableNumber(value.index),
    latitude,
    longitude,
    medias: Array.isArray(value.medias) ? value.medias.map(parseMedia).filter(isNonNull) : [],
    orderIndex: readNullableNumber(value.orderIndex),
    point: readNullableNumber(value.point),
    sequenceNumber: readNullableNumber(value.sequenceNumber),
    xp: readNullableNumber(value.xp),
  };
}

export function parseRoute(value: unknown): RouteDto | null {
  if (!isObject(value)) return null;

  const routeId = readNumber(value.routeId, -1);
  const routeName = readString(value.routeName);

  if (routeId < 0 || !routeName.trim()) return null;

  return {
    description: readString(value.description),
    difficulty: readString(value.difficulty, "EASY"),
    estimateTime: readNumber(value.estimateTime),
    hotspots: Array.isArray(value.hotspots) ? value.hotspots.map(parseHotspot).filter(isNonNull) : [],
    medias: Array.isArray(value.medias) ? value.medias.map(parseMedia).filter(isNonNull) : [],
    point: readNumber(value.point),
    routeId,
    routeName,
    status: readString(value.status, "DRAFT"),
    tags: Array.isArray(value.tags) ? value.tags.map(parseTag).filter(isNonNull) : [],
    totalDistance: readNumber(value.totalDistance),
    xp: readNumber(value.xp),
  };
}

function getRouteImageMedia(route: Pick<RouteDto, "medias">) {
  return (
    route.medias.find((media) => {
      const kind = `${media.mediaType ?? ""} ${media.mimeType ?? ""}`.toLowerCase();
      return kind.includes("image");
    }) ?? route.medias[0]
  );
}

export function getRouteCoverUrl(route: Pick<RouteDto, "medias">) {
  return getRouteImageMedia(route)?.fileUrl || null;
}

export function getRouteStopCount(route: Pick<RouteDto, "hotspots">) {
  return route.hotspots.length;
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

function getErrorMessage(body: unknown, status: number, fallback: string) {
  if (isObject(body)) {
    for (const key of ["message", "error", "detail", "title"]) {
      const candidate = body[key];
      if (typeof candidate === "string" && candidate.trim()) return candidate.trim();
    }
  }

  if (typeof body === "string" && body.trim()) return body.trim();

  return `${fallback} (${status}).`;
}

function getConnectionErrorMessage(url: string) {
  if (Platform.OS === "android" && url.startsWith("http://")) {
    return "Android đang chặn kết nối HTTP tới Route API. Hãy dùng HTTPS hoặc rebuild Android dev client sau khi bật cleartext traffic.";
  }

  return "Không thể kết nối đến máy chủ Route.";
}

async function fetchRouteJson(url: string, accessToken?: string | null, tokenType?: string | null) {
  let response: Response;

  try {
    response = await fetch(url, {
      headers: {
        Accept: "application/json",
        ...(accessToken ? { Authorization: `${tokenType ?? "Bearer"} ${accessToken}` } : {}),
        "Content-Type": "application/json",
        "X-Client-Type": "mobile",
      },
      method: "GET",
    });
  } catch (error) {
    console.warn("[route] network failure", { error, url });
    throw new Error(getConnectionErrorMessage(url));
  }

  const responseBody = await parseResponseBody(response);

  if (!response.ok) {
    console.warn("[route] rejected", { body: responseBody, status: response.status, url });
    throw new Error(getErrorMessage(responseBody, response.status, "Không thể tải dữ liệu tuyến"));
  }

  return responseBody;
}

export async function searchRoutes({
  accessToken,
  page = 0,
  size = 10,
  sortBy = "routeId",
  sortDirection = "DESC",
  status,
  tokenType,
}: SearchRoutesRequest = {}): Promise<RoutePageDto> {
  const params = new URLSearchParams({
    page: String(page),
    size: String(size),
    sortBy,
    sortDirection,
  });

  // Backend SearchRequest có thể hỗ trợ filter động. Nếu BE chưa nhận filter này,
  // mobile vẫn lọc status ở client sau khi nhận content.
  if (status) {
    params.set("status", status);
    params.set("filters[0].field", "status");
    params.set("filters[0].operator", "EQUALS");
    params.set("filters[0].value", status);
  }

  const url = `${resolveRouteUrl("/api/v1/routes/search")}?${params.toString()}`;
  const body = await fetchRouteJson(url, accessToken, tokenType);

  const rawContent = isObject(body) && Array.isArray(body.content) ? body.content : [];
  const content = rawContent.map(parseRoute).filter(isNonNull);

  return {
    content,
    number: isObject(body) ? readNumber(body.number, page) : page,
    size: isObject(body) ? readNumber(body.size, size) : size,
    totalElements: isObject(body) ? readNumber(body.totalElements, content.length) : content.length,
    totalPages: isObject(body) ? readNumber(body.totalPages, 1) : 1,
  };
}

export async function getRouteById({ accessToken, routeId, tokenType }: RouteDetailRequest) {
  const url = resolveRouteUrl(`/api/v1/routes/${routeId}`);
  const body = await fetchRouteJson(url, accessToken, tokenType);
  const route = parseRoute(body);

  if (!route) {
    throw new Error("API Route detail trả về dữ liệu không đúng định dạng.");
  }

  return route;
}

function getDifficultyLabel(difficulty?: string) {
  switch (difficulty?.toUpperCase()) {
    case "EASY":
      return "Dễ";
    case "MEDIUM":
      return "Vừa";
    case "HARD":
      return "Khó";
    default:
      return difficulty || "Dễ";
  }
}

export function mapRouteToRouteItem(route: RouteDto) {
  const firstTag = route.tags[0]?.tagName || "Di sản";
  const cover =
    getRouteCoverUrl(route) ||
    "https://i.pinimg.com/1200x/80/69/f9/8069f9581583a196f9f39bda000b9312.jpg";

  return {
    connection:
      route.hotspots.length > 1
        ? `Kết nối ${route.hotspots.length} điểm dừng thành một hành trình khám phá liên tục.`
        : "Khám phá điểm đến nổi bật trong tuyến này.",
    cover,
    difficulty: getDifficultyLabel(route.difficulty),
    distance: `${route.totalDistance || 0} km`,
    duration: `${route.estimateTime || 0} phút`,
    era: firstTag,
    hotspotIds: route.hotspots.map((hotspot) => String(hotspot.hotspotId)),
    id: String(route.routeId),
    meaning: route.description || "Tuyến tham quan được lấy trực tiếp từ hệ thống CultureQuest Lite.",
    rating: 4.8,
    story: route.description || "Mỗi điểm dừng trong tuyến mở ra một lớp câu chuyện văn hoá khác nhau.",
    subtitle: route.description || `${route.hotspots.length} điểm dừng · ${route.totalDistance || 0} km`,
    theme: route.description || firstTag,
    title: route.routeName,
    xp: route.xp || route.point || 0,
  };
}

export async function getRoutes(request: SearchRoutesRequest = {}) {
  return searchRoutes(request);
}
