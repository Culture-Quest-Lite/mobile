import { PublicEnv, buildApiUrl } from "@/constants/env";

export type RecordRouteStatus = "RECORDING" | "DRAFT" | "TRIAL" | string;

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
  hotspotIds?: number[];
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
    },
  });

  const text = await response.text();
  const body = text ? JSON.parse(text) : null;

  if (!response.ok) {
    throw new Error(
      body?.message || body?.error || `API ghi hành trình lỗi ${response.status}.`,
    );
  }

  return (body?.data ?? body) as RecordRouteDto;
}

/** B1: Tạo route CUSTOM với status RECORDING và tagDefault. */
export function startRecordRoute(auth: AuthRequest) {
  return requestRecordRoute("/api/v1/routes/record", auth, "POST");
}

/** B3: Kết thúc route đang record của explorer, chuyển RECORDING -> DRAFT. */
export function finishRecordRoute(auth: AuthRequest) {
  return requestRecordRoute("/api/v1/routes/record/finish", auth, "PUT");
}

/** B4: Submit một route nháp cụ thể, chuyển DRAFT -> TRIAL. */
export function finalizeRecordRoute({
  accessToken,
  routeId,
  tokenType,
}: FinalizeRecordRouteRequest) {
  return requestRecordRoute(
    `/api/v1/routes/record/finalize/${routeId}`,
    { accessToken, tokenType },
    "PUT",
  );
}
