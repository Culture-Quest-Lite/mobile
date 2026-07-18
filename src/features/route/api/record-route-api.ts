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

type AuthRequest = {
  accessToken: string;
  tokenType?: string | null;
};

type FinalizeRecordRouteRequest = AuthRequest & {
  routeId: number | string;
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

async function requestRecordRoute(
  path: string,
  { accessToken, tokenType }: AuthRequest,
  method: "POST" | "PUT",
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
    },
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

  const payload = isObject(body) && isObject(body.data) ? body.data : body;
  if (!isObject(payload) || typeof payload.routeId !== "number") {
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

/** B4: submit một route DRAFT cụ thể và chuyển sang TRIAL. */
export function finalizeRecordRoute({ accessToken, routeId, tokenType }: FinalizeRecordRouteRequest) {
  return requestRecordRoute(
    `/api/v1/routes/record/finalize/${routeId}`,
    { accessToken, tokenType },
    "PUT",
  );
}
