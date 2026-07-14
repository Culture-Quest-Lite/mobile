import { Platform } from "react-native";

import { PublicEnv, buildApiUrl } from "@/constants/env";

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

export type ProgressStatus =
  "IN_PROGRESS" | "COMPLETED" | "ABANDONED" | "ON_HOLD" | string;

export type HotspotProgressDto = {
  userProgressId?: number | null;
  userId?: number | null;
  hotspotId: number;
  hotspotName?: string;
  isCheckedIn: boolean;
  index?: number | null;
  latitude?: number | null;
  longitude?: number | null;
  totalPointEarned?: number | null;
  totalXpEarned?: number | null;
  firstVisitedAt?: string | null;
};

export type UserRouteProgressDto = {
  completedAt?: string | null;
  completedStops: number;
  progressPercentage: number;
  route?: RouteDto | null;
  routeId: number;
  startedAt?: string | null;
  status: ProgressStatus;
  totalStops: number;
  userRouteProgressId: number;
  hotspotProgressList: HotspotProgressDto[];
};

export type UserRouteProgressPageDto = {
  content: UserRouteProgressDto[];
  number: number;
  size: number;
  totalElements: number;
  totalPages: number;
};

export type SavedRouteDto = {
  route?: RouteDto | null;
  routeId: number;
  savedAt?: string | null;
  savedRouteId: number;
};

export type CheckInResponseDto = {
  checkInAt: string;
  checkInId: number;
  hotspotId: number;
  pointEarned: number;
  userRouteProgressId: number | null;
  xpEarned: number;
  latitude?: number | null;
  longitude?: number | null;
  isCheckedIn?: boolean;
  userId?: number | null;
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

type RoutesByHotspotRequest = {
  accessToken?: string | null;
  hotspotId: number | string;
  routeStatus?: RouteStatus;
  tokenType?: string | null;
};

type AuthenticatedRouteRequest = {
  accessToken?: string | null;
  tokenType?: string | null;
};

type RouteIdRequest = AuthenticatedRouteRequest & {
  routeId: number | string;
};

type UserRouteProgressListRequest = AuthenticatedRouteRequest & {
  page?: number;
  size?: number;
  sortBy?: string;
  sortDirection?: "ASC" | "DESC";
  status?: ProgressStatus;
};

type CheckInRequest = AuthenticatedRouteRequest & {
  hotspotId: number;
  latitude: number;
  longitude: number;
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

function normalizeLatitudeLongitude(
  latitudeValue: unknown,
  longitudeValue: unknown,
) {
  let latitude = readNullableNumber(latitudeValue);
  let longitude = readNullableNumber(longitudeValue);

  // Một số API trả nhầm thứ tự longitude/latitude. Ví dụ latitude=105, longitude=21.
  // MapView cần latitude nằm trong [-90, 90] và longitude nằm trong [-180, 180].
  if (
    latitude !== null &&
    longitude !== null &&
    Math.abs(latitude) > 90 &&
    Math.abs(longitude) <= 90
  ) {
    [latitude, longitude] = [longitude, latitude];
  }

  if (latitude !== null && (latitude < -90 || latitude > 90)) latitude = null;
  if (longitude !== null && (longitude < -180 || longitude > 180))
    longitude = null;

  return { latitude, longitude };
}

function parseMedia(value: unknown): RouteMediaDto | null {
  if (!isObject(value)) return null;

  const mediaId = readNumber(value.mediaId, -1);
  const fileUrl =
    readString(value.fileUrl) ||
    readString(value.mediaUrl) ||
    readString(value.url);

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

  const { latitude, longitude } = normalizeLatitudeLongitude(
    value.latitude,
    value.longitude,
  );

  return {
    address: readString(value.address),
    description: readString(value.description),
    distanceToNext: readNullableNumber(value.distanceToNext),
    hotspotId,
    hotspotName: readString(value.hotspotName) || readString(value.name),
    index: readNullableNumber(value.index),
    latitude,
    longitude,
    medias: Array.isArray(value.medias)
      ? value.medias.map(parseMedia).filter(isNonNull)
      : [],
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
    hotspots: Array.isArray(value.hotspots)
      ? value.hotspots.map(parseHotspot).filter(isNonNull)
      : [],
    medias: Array.isArray(value.medias)
      ? value.medias.map(parseMedia).filter(isNonNull)
      : [],
    point: readNumber(value.point),
    routeId,
    routeName,
    status: readString(value.status, "DRAFT"),
    tags: Array.isArray(value.tags)
      ? value.tags.map(parseTag).filter(isNonNull)
      : (() => {
          const singleTag = parseTag(value.tag);
          return singleTag ? [singleTag] : [];
        })(),
    totalDistance: readNumber(value.totalDistance),
    xp: readNumber(value.xp),
  };
}

function parseHotspotProgress(value: unknown): HotspotProgressDto | null {
  if (!isObject(value)) return null;
  const hotspotId = readNumber(value.hotspotId, -1);
  if (hotspotId < 0) return null;

  const { latitude, longitude } = normalizeLatitudeLongitude(
    value.latitude,
    value.longitude,
  );

  return {
    userProgressId: readNullableNumber(value.userProgressId ?? value.id),
    userId: readNullableNumber(value.userId),
    hotspotId,
    hotspotName: readString(value.hotspotName) || readString(value.name),
    index: readNullableNumber(value.index),
    isCheckedIn: Boolean(value.isCheckedIn ?? value.checkedIn),
    latitude,
    longitude,
    totalPointEarned: readNullableNumber(value.totalPointEarned),
    totalXpEarned: readNullableNumber(value.totalXpEarned),
    firstVisitedAt: readString(value.firstVisitedAt) || null,
  };
}

export function parseUserRouteProgress(
  value: unknown,
): UserRouteProgressDto | null {
  if (!isObject(value)) return null;

  const userRouteProgressId = readNumber(
    value.userRouteProgressId ?? value.routeParticipantId ?? value.id,
    -1,
  );
  const routeFromBody = parseRoute(
    value.route ?? value.routeResponse ?? value.routeDto,
  );
  const routeId = readNumber(value.routeId ?? routeFromBody?.routeId, -1);

  if (userRouteProgressId < 0 || routeId < 0) return null;

  return {
    completedAt: readString(value.completedAt) || null,
    completedStops: readNumber(value.completedStops),
    hotspotProgressList: Array.isArray(value.hotspotProgressList)
      ? value.hotspotProgressList.map(parseHotspotProgress).filter(isNonNull)
      : [],
    progressPercentage: readNumber(value.progressPercentage),
    route: routeFromBody,
    routeId,
    startedAt: readString(value.startedAt) || null,
    status: readString(value.status, "IN_PROGRESS"),
    totalStops: readNumber(value.totalStops),
    userRouteProgressId,
  };
}

function parseSavedRoute(value: unknown): SavedRouteDto | null {
  if (!isObject(value)) return null;

  const route = parseRoute(
    value.route ?? value.routeResponse ?? value.routeDto,
  );
  const savedRouteId = readNumber(value.savedRouteId ?? value.id, -1);
  const routeId = readNumber(value.routeId ?? route?.routeId, -1);

  if (savedRouteId < 0 || routeId < 0) return null;

  return {
    route,
    routeId,
    savedAt: readString(value.savedAt ?? value.createdAt) || null,
    savedRouteId,
  };
}

function parseCheckInResponse(value: unknown): CheckInResponseDto | null {
  if (!isObject(value)) return null;

  // UserHotspotProgressController trả userProgressId/firstVisitedAt/
  // totalPointEarned/totalXpEarned. Vẫn hỗ trợ response check-in cũ để
  // các màn hình hiện tại không phải đổi interface.
  const checkInId = readNumber(value.checkInId ?? value.userProgressId ?? value.id, -1);
  const hotspotId = readNumber(value.hotspotId, -1);
  const userRouteProgressId =
    value.userRouteProgressId == null
      ? null
      : readNumber(value.userRouteProgressId, -1);
  const { latitude, longitude } = normalizeLatitudeLongitude(
    value.latitude,
    value.longitude,
  );

  if (checkInId < 0 || hotspotId < 0 || userRouteProgressId === -1) return null;

  return {
    checkInAt: readString(value.checkInAt ?? value.firstVisitedAt),
    checkInId,
    hotspotId,
    pointEarned: readNumber(value.pointEarned ?? value.totalPointEarned),
    userRouteProgressId,
    xpEarned: readNumber(value.xpEarned ?? value.totalXpEarned),
    latitude,
    longitude,
    isCheckedIn: Boolean(value.isCheckedIn ?? true),
    userId: readNullableNumber(value.userId),
  };
}

function getImageMedia(medias?: RouteMediaDto[] | null) {
  if (!Array.isArray(medias) || medias.length === 0) {
    return null;
  }

  return (
    medias.find((media) => {
      const kind = `${media.mediaType ?? ""} ${media.mimeType ?? ""}`.toLowerCase();
      return kind.includes("image");
    }) ?? medias[0]
  );
}

function getRouteImageMedia(route: Pick<RouteDto, "hotspots" | "medias">) {
  const routeImageMedia = getImageMedia(route.medias);

  if (routeImageMedia) {
    return routeImageMedia;
  }

  for (const hotspot of route.hotspots) {
    const hotspotImageMedia = getImageMedia(hotspot.medias);

    if (hotspotImageMedia) {
      return hotspotImageMedia;
    }
  }

  return null;
}

export function getRouteCoverUrl(route: Pick<RouteDto, "hotspots" | "medias">) {
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

function unwrapApiBody(body: unknown): unknown {
  if (!isObject(body)) return body;

  for (const key of ["data", "result", "payload", "response"]) {
    const candidate = body[key];
    if (candidate !== undefined && candidate !== null) return candidate;
  }

  return body;
}

function readPageContent(body: unknown): unknown[] {
  const unwrapped = unwrapApiBody(body);

  if (Array.isArray(unwrapped)) return unwrapped;

  if (isObject(unwrapped)) {
    for (const key of ["content", "items", "data", "result", "records"]) {
      const candidate = unwrapped[key];
      if (Array.isArray(candidate)) return candidate;
    }
  }

  return [];
}

function getErrorMessage(body: unknown, status: number, fallback: string) {
  if (isObject(body)) {
    for (const key of ["message", "error", "detail", "title"]) {
      const candidate = body[key];
      if (typeof candidate === "string" && candidate.trim())
        return candidate.trim();
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

async function fetchRouteJson(
  url: string,
  accessToken?: string | null,
  tokenType?: string | null,
  options: { body?: unknown; method?: "GET" | "POST" | "PUT" | "DELETE" } = {},
) {
  let response: Response;

  try {
    response = await fetch(url, {
      body:
        options.body === undefined ? undefined : JSON.stringify(options.body),
      headers: {
        Accept: "application/json",
        ...(accessToken
          ? { Authorization: `${tokenType ?? "Bearer"} ${accessToken}` }
          : {}),
        "Content-Type": "application/json",
        "X-Client-Type": "mobile",
      },
      method: options.method ?? "GET",
    });
  } catch (error) {
    console.warn("[route] network failure", { error, url });
    throw new Error(getConnectionErrorMessage(url));
  }

  const responseBody = await parseResponseBody(response);

  if (!response.ok) {
    console.warn("[route] rejected", {
      body: responseBody,
      status: response.status,
      url,
    });
    throw new Error(
      getErrorMessage(
        responseBody,
        response.status,
        "Không thể tải dữ liệu tuyến",
      ),
    );
  }

  return responseBody;
}

function requireAccessToken(accessToken?: string | null) {
  if (!accessToken) {
    throw new Error("Bạn cần đăng nhập để dùng chức năng này.");
  }
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

  const unwrappedBody = unwrapApiBody(body);
  const rawContent = readPageContent(body);
  const content = rawContent.map(parseRoute).filter(isNonNull);

  return {
    content,
    number: isObject(unwrappedBody) ? readNumber(unwrappedBody.number, page) : page,
    size: isObject(unwrappedBody) ? readNumber(unwrappedBody.size, size) : size,
    totalElements: isObject(unwrappedBody)
      ? readNumber(unwrappedBody.totalElements, content.length)
      : content.length,
    totalPages: isObject(unwrappedBody) ? readNumber(unwrappedBody.totalPages, 1) : 1,
  };
}

export async function getRouteById({
  accessToken,
  routeId,
  tokenType,
}: RouteDetailRequest) {
  const url = resolveRouteUrl(`/api/v1/routes/${routeId}`);
  const body = await fetchRouteJson(url, accessToken, tokenType);
  const route = parseRoute(unwrapApiBody(body));

  if (!route) {
    throw new Error("API Route detail trả về dữ liệu không đúng định dạng.");
  }

  return route;
}

export async function getRoutesByHotspot({
  accessToken,
  hotspotId,
  routeStatus,
  tokenType,
}: RoutesByHotspotRequest): Promise<RouteDto[]> {
  const params = new URLSearchParams();

  if (routeStatus?.trim()) {
    params.set("routeStatus", routeStatus);
  }

  const query = params.toString();
  const url = `${resolveRouteUrl(`/api/v1/routes/hotspot/${hotspotId}`)}${
    query ? `?${query}` : ""
  }`;
  const body = await fetchRouteJson(url, accessToken, tokenType);

  const rawRoutes = readPageContent(body);
  if (rawRoutes.length === 0 && !Array.isArray(unwrapApiBody(body))) {
    throw new Error("API route theo hotspot trả về dữ liệu không đúng định dạng.");
  }

  return rawRoutes.map(parseRoute).filter(isNonNull);
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
    meaning:
      route.description ||
      "Tuyến tham quan được lấy trực tiếp từ hệ thống CultureQuest Lite.",
    rating: 4.8,
    story:
      route.description ||
      "Mỗi điểm dừng trong tuyến mở ra một lớp câu chuyện văn hoá khác nhau.",
    subtitle:
      route.description ||
      `${route.hotspots.length} điểm dừng · ${route.totalDistance || 0} km`,
    theme: route.description || firstTag,
    title: route.routeName,
    xp: route.xp || route.point || 0,
  };
}

export async function startRouteProgress({
  accessToken,
  routeId,
  tokenType,
}: RouteIdRequest) {
  requireAccessToken(accessToken);
  const url = resolveRouteUrl(`/api/v1/route-participants/start/${routeId}`);
  const body = await fetchRouteJson(url, accessToken, tokenType, {
    method: "POST",
  });
  const progress = parseUserRouteProgress(unwrapApiBody(body));

  if (!progress) {
    throw new Error("API bắt đầu tuyến trả về dữ liệu không đúng định dạng.");
  }

  return progress;
}

export async function abandonRouteProgress({
  accessToken,
  routeId,
  tokenType,
}: RouteIdRequest) {
  requireAccessToken(accessToken);
  const url = resolveRouteUrl(`/api/v1/route-participants/abandon/${routeId}`);
  const body = await fetchRouteJson(url, accessToken, tokenType, {
    method: "PUT",
  });
  return parseUserRouteProgress(unwrapApiBody(body)) ?? body;
}

export async function getUserRouteProgressList({
  accessToken,
  page = 0,
  size = 10,
  sortBy = "startedAt",
  sortDirection = "DESC",
  status,
  tokenType,
}: UserRouteProgressListRequest = {}): Promise<UserRouteProgressPageDto> {
  requireAccessToken(accessToken);
  const params = new URLSearchParams({
    page: String(page),
    size: String(size),
    sortBy,
    sortDirection,
  });

  if (status) params.set("status", status);

  const url = `${resolveRouteUrl("/api/v1/route-participants")}?${params.toString()}`;
  const body = await fetchRouteJson(url, accessToken, tokenType);
  const unwrappedBody = unwrapApiBody(body);
  const rawContent = readPageContent(body);
  const content = rawContent.map(parseUserRouteProgress).filter(isNonNull);

  return {
    content,
    number: isObject(unwrappedBody)
      ? readNumber(unwrappedBody.number, page)
      : page,
    size: isObject(unwrappedBody) ? readNumber(unwrappedBody.size, size) : size,
    totalElements: isObject(unwrappedBody)
      ? readNumber(unwrappedBody.totalElements, content.length)
      : content.length,
    totalPages: isObject(unwrappedBody)
      ? readNumber(unwrappedBody.totalPages, 1)
      : 1,
  };
}

export async function getUserRouteProgressById({
  accessToken,
  progressId,
  tokenType,
}: AuthenticatedRouteRequest & { progressId: number | string }) {
  requireAccessToken(accessToken);
  const url = resolveRouteUrl(`/api/v1/route-participants/${progressId}`);
  const body = await fetchRouteJson(url, accessToken, tokenType);
  const progress = parseUserRouteProgress(unwrapApiBody(body));

  if (!progress) {
    throw new Error(
      "API chi tiết tiến độ tuyến trả về dữ liệu không đúng định dạng.",
    );
  }

  return progress;
}

export async function saveRoute({
  accessToken,
  routeId,
  tokenType,
}: RouteIdRequest) {
  requireAccessToken(accessToken);
  const url = resolveRouteUrl(`/api/v1/saved-routes/save/${routeId}`);
  const body = await fetchRouteJson(url, accessToken, tokenType, {
    method: "POST",
  });
  return parseSavedRoute(unwrapApiBody(body)) ?? unwrapApiBody(body);
}

export async function unSaveRoute({
  accessToken,
  savedRouteId,
  tokenType,
}: AuthenticatedRouteRequest & { savedRouteId: number | string }) {
  requireAccessToken(accessToken);
  const url = resolveRouteUrl(`/api/v1/saved-routes/un-save/${savedRouteId}`);
  return fetchRouteJson(url, accessToken, tokenType, { method: "DELETE" });
}

export async function getSavedRoutes({
  accessToken,
  tokenType,
}: AuthenticatedRouteRequest = {}) {
  requireAccessToken(accessToken);
  const url = resolveRouteUrl("/api/v1/saved-routes");
  const body = await fetchRouteJson(url, accessToken, tokenType);
  const rawList = readPageContent(body);
  return rawList.map(parseSavedRoute).filter(isNonNull);
}

export async function createRouteCheckIn({
  accessToken,
  hotspotId,
  latitude,
  longitude,
  tokenType,
}: CheckInRequest) {
  requireAccessToken(accessToken);
  const url = resolveRouteUrl("/api/v1/user-hotspot-progress");
  const body = await fetchRouteJson(url, accessToken, tokenType, {
    body: { hotspotId, latitude, longitude },
    method: "POST",
  });
  const checkIn = parseCheckInResponse(body);

  if (!checkIn) {
    throw new Error("API check-in trả về dữ liệu không đúng định dạng.");
  }

  return checkIn;
}

// Tên alias bám theo RouteParticipantController của backend.
// Các tên cũ vẫn được giữ để không làm hỏng màn hình hiện tại.
export const startRouteParticipant = startRouteProgress;
export const abandonRouteParticipant = abandonRouteProgress;
export const getRouteParticipants = getUserRouteProgressList;
export const getRouteParticipantById = getUserRouteProgressById;
export const checkInHotspotProgress = createRouteCheckIn;

export async function getRoutes(request: SearchRoutesRequest = {}) {
  return searchRoutes(request);
}