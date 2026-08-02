import { PublicEnv, buildApiUrl } from "@/constants/env";

export type RecordRouteStatus = "RECORDING" | "DRAFT" | "TRIAL" | string;

export type RecordRouteHotspotDto = {
  hotspotId: number;
  hotspotName?: string;
  address?: string;
  latitude?: number | null;
  longitude?: number | null;
  orderIndex?: number | null;
};

export type RecordRouteDto = {
  routeId: number;
  routeName?: string;
  description?: string;
  status: RecordRouteStatus;
  type?: "CUSTOM" | string;
  tag?: {
    tagId: number;
    tagName: string;
  } | null;
  hotspots?: RecordRouteHotspotDto[];
  medias?: unknown[];
};

export type AuthRequest = {
  accessToken: string;
  tokenType?: string | null;
};

type FinalizeRecordRouteRequest = AuthRequest & {
  routeId: number | string;
  description?: string;
};

function resolveUrl(path: string) {
  return PublicEnv.apiBaseUrl.trim()
    ? buildApiUrl(path)
    : `http://13.158.40.56:8080${path}`;
}

function isObject(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}

function getErrorMessage(body: unknown, status: number) {
  if (isObject(body)) {
    for (const key of ["message", "error", "detail", "title"]) {
      const value = body[key];
      if (typeof value === "string" && value.trim()) return value.trim();
    }
  }
  if (typeof body === "string" && body.trim()) return body.trim();
  return `API ghi hành trình lỗi ${status}.`;
}


function parseRecordRoute(value: unknown): RecordRouteDto | null {
  if (!isObject(value)) return null;
  const routeId = value.routeId;
  if (typeof routeId !== "number") return null;
  return value as RecordRouteDto;
}

function unwrapPayload(body: unknown): unknown {
  return isObject(body) && "data" in body ? body.data : body;
}

async function requestJson(path: string, { accessToken, tokenType }: AuthRequest): Promise<unknown> {
  if (!accessToken.trim()) {
    throw new Error("Bạn cần đăng nhập để sử dụng chức năng ghi hành trình.");
  }

  const response = await fetch(resolveUrl(path), {
    method: "GET",
    headers: {
      Accept: "application/json",
      Authorization: `${tokenType || "Bearer"} ${accessToken}`,
      "X-Client-Type": "mobile",
    },
  });

  const text = await response.text();
  let body: unknown = null;
  if (text) {
    try { body = JSON.parse(text) as unknown; } catch { body = text; }
  }
  if (!response.ok) throw new Error(getErrorMessage(body, response.status));
  return unwrapPayload(body);
}

async function requestRecordRoute(
  path: string,
  { accessToken, tokenType }: AuthRequest,
  method: "POST" | "PUT",
  requestBody?: Record<string, unknown>,
): Promise<RecordRouteDto> {
  if (!accessToken.trim()) {
    throw new Error("Bạn cần đăng nhập để sử dụng chức năng ghi hành trình.");
  }

  const response = await fetch(resolveUrl(path), {
    method,
    headers: {
      Accept: "application/json",
      Authorization: `${tokenType || "Bearer"} ${accessToken}`,
      "X-Client-Type": "mobile",
      ...(requestBody ? { "Content-Type": "application/json" } : {}),
    },
    ...(requestBody ? { body: JSON.stringify(requestBody) } : {}),
  });

  const text = await response.text();
  let body: unknown = null;
  if (text) {
    try {
      body = JSON.parse(text) as unknown;
    } catch {
      body = text;
    }
  }

  if (!response.ok) throw new Error(getErrorMessage(body, response.status));

  const payload = unwrapPayload(body);
  if (!parseRecordRoute(payload)) {
    throw new Error("API ghi hành trình trả về dữ liệu không hợp lệ.");
  }

  return payload as RecordRouteDto;
}

/** B1: tạo route CUSTOM/RECORDING. Explorer chỉ được có một route RECORDING. */
export function startRecordRoute(auth: AuthRequest) {
  return requestRecordRoute("/api/v1/routes/record", auth, "POST");
}

/** B3: kết thúc route RECORDING hiện tại và chuyển sang DRAFT. */
export function finishRecordRoute(auth: AuthRequest) {
  return requestRecordRoute("/api/v1/routes/record/finish", auth, "PUT");
}

/**
 * B4: submit một route DRAFT cụ thể và chuyển sang PUBLISHED.
 *
 * LƯU Ý: Backend (RouteController#finalizeRecordJourney) mapping là
 * `PUT /api/v1/routes/record/finalize` (KHÔNG có routeId trên path) và nhận
 * `FinalizeCustomRouteRequest { routeId, description }` qua JSON body.
 * Bản cũ gọi `PUT /record/finalize/{routeId}` không kèm body -> luôn 404 vì
 * sai path, đồng thời không có cách nào set được description.
 */
export function finalizeRecordRoute({ accessToken, routeId, description, tokenType }: FinalizeRecordRouteRequest) {
  return requestRecordRoute(
    "/api/v1/routes/record/finalize",
    { accessToken, tokenType },
    "PUT",
    { routeId: Number(routeId), description: description ?? "" },
  );
}


/** Lấy toàn bộ hành trình CUSTOM của Explorer, gồm RECORDING, DRAFT, TRIAL... */
export async function getMyRecordJourneys(auth: AuthRequest): Promise<RecordRouteDto[]> {
  const payload = await requestJson("/api/v1/routes/my-journey", auth);

  const candidates = Array.isArray(payload)
    ? payload
    : isObject(payload) && Array.isArray(payload.content)
      ? payload.content
      : isObject(payload) && Array.isArray(payload.items)
        ? payload.items
        : [];

  return candidates
    .map(parseRecordRoute)
    .filter((route): route is RecordRouteDto => route !== null);
}
