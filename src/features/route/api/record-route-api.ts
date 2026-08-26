import { PublicEnv, buildApiUrl } from "@/constants/env";

export type RecordRouteStatus =
  | "RECORDING"
  | "DRAFT"
  | "PUBLISHED"
  | "TRIAL"
  | string;

/**
 * Khớp `HotspotResponse` của backend. BE trả nguyên hotspot đầy đủ (kèm
 * stories/medias) chứ không phải bản rút gọn, và KHÔNG có `orderIndex` —
 * thứ tự điểm dừng chính là thứ tự phần tử trong mảng `hotspots`.
 */
export type RecordRouteHotspotDto = {
  hotspotId: number;
  hotspotName?: string;
  address?: string;
  latitude?: number | null;
  longitude?: number | null;
  openingTime?: string | null;
  closingTime?: string | null;
  isCheckIn?: boolean | null;
};

/** Khớp `RouteResponse` của backend (module content). */
export type RecordRouteDto = {
  routeId: number;
  routeName?: string;
  description?: string;
  imageUrl?: string | null;
  status: RecordRouteStatus;
  difficulty?: string | null;
  estimateTime?: number | null;
  totalDistance?: number | null;
  xp?: number | null;
  point?: number | null;
  tag?: {
    tagId: number;
    tagName: string;
  } | null;
  hotspots?: RecordRouteHotspotDto[];
  averageRating?: number | null;
  totalReviews?: number | null;
};

/**
 * `finishRecordJourney` phía backend chặn cứng route có dưới 4 story:
 * "Hành trình cá nhân phải có ít nhất 4 điểm dừng (Hotspot)".
 * Client chặn trước bằng cùng ngưỡng để user không bấm rồi ăn lỗi 400.
 */
export const MIN_RECORD_HOTSPOTS = 4;

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

/** Error kèm HTTP status để nơi gọi phân biệt được "rỗng" với "hỏng thật". */
export class RecordRouteApiError extends Error {
  readonly status: number;
  readonly path: string;

  constructor(message: string, status: number, path: string) {
    super(message);
    this.name = "RecordRouteApiError";
    this.status = status;
    this.path = path;
  }
}

/**
 * KHÔNG suy diễn 500 thành lỗi phiên đăng nhập.
 *
 * Bản trước quy mọi 500 "Đã xảy ra lỗi hệ thống" về "token không tới được
 * server". Thực tế nguyên nhân là path cũ `/api/v1/routes/record*` rơi trúng
 * `GET/PUT /api/v1/routes/{id}` (id = "record"/"my-journey" không parse được
 * thành Long) -> 500 generic. Thông báo đó khiến user có token hợp lệ tưởng
 * mình bị đăng xuất và đi đăng nhập lại mãi không hết lỗi. Chỉ 401/403 mới là
 * tín hiệu auth thật (endpoint `/api/v1/custom-routes/**` trả đúng 401).
 */
function describeFailure(body: unknown, status: number) {
  const raw = getErrorMessage(body, status);

  if (status === 401 || status === 403) {
    return "Phiên đăng nhập đã hết hạn hoặc không đủ quyền. Vui lòng đăng nhập lại.";
  }

  return raw;
}

function throwRequestFailure(body: unknown, status: number, path: string): never {
  console.warn("[record-route] request failed", { body, path, status });
  throw new RecordRouteApiError(describeFailure(body, status), status, path);
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
  if (!response.ok) {
    throwRequestFailure(body, response.status, path);
  }
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

  if (!response.ok) {
    throwRequestFailure(body, response.status, path);
  }

  const payload = unwrapPayload(body);
  if (!parseRecordRoute(payload)) {
    throw new Error("API ghi hành trình trả về dữ liệu không hợp lệ.");
  }

  return payload as RecordRouteDto;
}

/**
 * Base path của toàn bộ nhóm endpoint record.
 *
 * Backend đã tách `CustomRouteController` ra khỏi `RouteController`:
 * `/api/v1/routes/record*` và `/api/v1/routes/my-journey` KHÔNG còn tồn tại,
 * gọi vào đó sẽ khớp nhầm `/api/v1/routes/{id}` và trả 500 generic. Giữ base
 * path ở một hằng số để lần đổi sau chỉ phải sửa một chỗ.
 */
const RECORD_BASE_PATH = "/api/v1/custom-routes";

/** B1: tạo route CUSTOM/RECORDING. Explorer chỉ được có một route RECORDING. */
export function startRecordRoute(auth: AuthRequest) {
  return requestRecordRoute(`${RECORD_BASE_PATH}/record`, auth, "POST");
}

/**
 * B3: kết thúc route RECORDING hiện tại và chuyển sang DRAFT.
 * Backend từ chối nếu route có ít hơn {@link MIN_RECORD_HOTSPOTS} điểm dừng.
 */
export function finishRecordRoute(auth: AuthRequest) {
  return requestRecordRoute(`${RECORD_BASE_PATH}/record/finish`, auth, "PUT");
}

/**
 * B4: submit một route DRAFT cụ thể và chuyển sang PUBLISHED.
 *
 * LƯU Ý: Backend (CustomRouteController#finalizeRecordJourney) mapping là
 * `PUT /api/v1/custom-routes/record/finalize` (KHÔNG có routeId trên path) và
 * nhận `FinalizeCustomRouteRequest { routeId, description }` qua JSON body.
 * Bản cũ gọi `PUT /record/finalize/{routeId}` không kèm body -> luôn 404 vì
 * sai path, đồng thời không có cách nào set được description.
 */
export function finalizeRecordRoute({ accessToken, routeId, description, tokenType }: FinalizeRecordRouteRequest) {
  return requestRecordRoute(
    `${RECORD_BASE_PATH}/record/finalize`,
    { accessToken, tokenType },
    "PUT",
    { routeId: Number(routeId), description: description ?? "" },
  );
}


/**
 * Lấy hành trình CUSTOM của Explorer (RECORDING, DRAFT, PUBLISHED, TRIAL...).
 *
 * LƯU Ý: `RouteServiceImpl#getMyJourney` KHÔNG trả mảng rỗng mà ném
 * BusinessException 400 "Không tìm thấy hành trình cá nhân nào" khi user chưa
 * có route nào. Nếu để lỗi đó nổi lên, mọi user mới vào màn record đều ăn alert
 * "Không thể tải hành trình" dù chẳng có gì sai. Vì vậy quy 400-rỗng về `[]`,
 * chỉ ném tiếp các lỗi thật (401, 5xx, mất mạng...).
 */
export async function getMyRecordJourneys(
  auth: AuthRequest,
  routeStatus?: RecordRouteStatus,
): Promise<RecordRouteDto[]> {
  const path = routeStatus
    ? `${RECORD_BASE_PATH}/my-journey?routeStatus=${encodeURIComponent(routeStatus)}`
    : `${RECORD_BASE_PATH}/my-journey`;

  let payload: unknown;
  try {
    payload = await requestJson(path, auth);
  } catch (error) {
    // BusinessException của BE hiện map sang 400, nhưng đừng phụ thuộc vào đúng
    // một status: dấu hiệu thật là nội dung "không tìm thấy hành trình cá nhân".
    // 404 cũng coi là rỗng. Các lỗi khác (401, 5xx, mất mạng) vẫn ném tiếp.
    if (error instanceof RecordRouteApiError) {
      if (/không tìm thấy hành trình cá nhân/i.test(error.message)) return [];
      if (error.status === 404) return [];
    }
    throw error;
  }

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
