import { Platform } from "react-native";

import { PublicEnv, buildApiUrl } from "@/constants/env";

export type CreateCheckInRequest = {
  accessToken: string;
  hotspotId: number;
  latitude: number;
  longitude: number;
  tokenType?: string | null;
};

export type CheckInResponse = {
  firstVisitedAt: string;
  hotspotId: number;
  isCheckedIn: boolean;
  latitude: number;
  longitude: number;
  totalPointEarned: number;
  totalXpEarned: number;
  userId: number;
  userProgressId: number;
};

type CreateCheckInErrorCode =
  | "duplicate"
  | "invalid-payload"
  | "network"
  | "request";

export class CreateCheckInError extends Error {
  body?: unknown;
  code: CreateCheckInErrorCode;
  status?: number;

  constructor(
    message: string,
    {
      body,
      code,
      status,
    }: {
      body?: unknown;
      code: CreateCheckInErrorCode;
      status?: number;
    },
  ) {
    super(message);
    this.name = "CreateCheckInError";
    this.body = body;
    this.code = code;
    this.status = status;
  }
}

function resolveCreateCheckInUrl() {
  if (PublicEnv.apiBaseUrl.trim()) {
    return buildApiUrl("/api/v1/user-hotspot-progress");
  }

  return "https://api.culturequestlite.com/api/v1/user-hotspot-progress";
}

function isObject(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}

function readNumber(value: unknown) {
  return typeof value === "number" && Number.isFinite(value) ? value : null;
}

function normalizeLookupText(value: string) {
  return value
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase();
}

function readString(value: unknown) {
  return typeof value === "string" ? value : "";
}

function readBoolean(value: unknown) {
  return typeof value === "boolean" ? value : null;
}

function parseCheckInResponse(value: unknown): CheckInResponse | null {
  if (!isObject(value)) {
    return null;
  }

  const userProgressId = readNumber(value.userProgressId);
  const userId = readNumber(value.userId);
  const hotspotId = readNumber(value.hotspotId);
  const isCheckedIn = readBoolean(value.isCheckedIn ?? value.isCheckIn);
  const latitude = readNumber(value.latitude);
  const longitude = readNumber(value.longitude);
  const totalPointEarned = readNumber(value.totalPointEarned);
  const totalXpEarned = readNumber(value.totalXpEarned);
  const firstVisitedAt = readString(value.firstVisitedAt);

  if (
    userProgressId === null ||
    userId === null ||
    hotspotId === null ||
    isCheckedIn === null ||
    latitude === null ||
    longitude === null ||
    totalPointEarned === null ||
    totalXpEarned === null ||
    !firstVisitedAt.trim()
  ) {
    return null;
  }

  return {
    firstVisitedAt,
    hotspotId,
    isCheckedIn,
    latitude,
    longitude,
    totalPointEarned,
    totalXpEarned,
    userId,
    userProgressId,
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

  if (status === 401 || status === 403) {
    return "Phiên đăng nhập không hợp lệ. Vui lòng đăng nhập lại.";
  }

  return `Check-in thất bại (${status}).`;
}

function isDuplicateCheckInResponse(body: unknown, status: number) {
  if (status !== 400 && status !== 409) {
    return false;
  }

  const message = getErrorMessage(body, status);
  const normalizedMessage = normalizeLookupText(message);

  return (
    normalizedMessage.includes("already checked in") ||
    normalizedMessage.includes("da check-in") ||
    normalizedMessage.includes("da check in") ||
    (normalizedMessage.includes("check-in") &&
      normalizedMessage.includes("truoc do")) ||
    (normalizedMessage.includes("check in") &&
      normalizedMessage.includes("truoc do"))
  );
}

function getConnectionErrorMessage(url: string) {
  if (Platform.OS === "android" && url.startsWith("http://")) {
    return "Android đang chặn kết nối HTTP tới API. Hãy dùng HTTPS hoặc rebuild Android dev client sau khi bật cleartext traffic.";
  }

  return "Không thể kết nối đến máy chủ check-in.";
}

export async function createCheckIn({
  accessToken,
  hotspotId,
  latitude,
  longitude,
  tokenType,
}: CreateCheckInRequest): Promise<CheckInResponse> {
  const createCheckInUrl = resolveCreateCheckInUrl();
  let response: Response;

  try {
    response = await fetch(createCheckInUrl, {
      body: JSON.stringify({
        hotspotId,
        latitude,
        longitude,
      }),
      headers: {
        Accept: "application/json",
        Authorization: `${tokenType ?? "Bearer"} ${accessToken}`,
        "Content-Type": "application/json",
        "X-Client-Type": "mobile",
      },
      method: "POST",
    });
  } catch (error) {
    console.warn("[checkin] create check-in network failure", {
      error: serializeError(error),
      hotspotId,
      latitude,
      longitude,
      platform: Platform.OS,
      url: createCheckInUrl,
    });
    throw new CreateCheckInError(getConnectionErrorMessage(createCheckInUrl), {
      code: "network",
    });
  }

  const responseBody = await parseResponseBody(response);

  if (!response.ok) {
    const errorMessage = getErrorMessage(responseBody, response.status);

    if (isDuplicateCheckInResponse(responseBody, response.status)) {
      console.info("[checkin] create check-in duplicate", {
        body: summarizeBody(responseBody),
        hotspotId,
        latitude,
        longitude,
        status: response.status,
        url: createCheckInUrl,
      });
      throw new CreateCheckInError(errorMessage, {
        body: summarizeBody(responseBody),
        code: "duplicate",
        status: response.status,
      });
    }

    console.warn("[checkin] create check-in rejected", {
      body: summarizeBody(responseBody),
      hotspotId,
      latitude,
      longitude,
      status: response.status,
      url: createCheckInUrl,
    });
    throw new CreateCheckInError(errorMessage, {
      body: summarizeBody(responseBody),
      code: "request",
      status: response.status,
    });
  }

  const parsedResponse = parseCheckInResponse(responseBody);

  if (!parsedResponse) {
    console.warn("[checkin] create check-in invalid payload", {
      body: summarizeBody(responseBody),
      hotspotId,
      latitude,
      longitude,
      url: createCheckInUrl,
    });
    throw new CreateCheckInError(
      "API check-in trả về dữ liệu không đúng định dạng.",
      {
        body: summarizeBody(responseBody),
        code: "invalid-payload",
      },
    );
  }

  return parsedResponse;
}

export function isDuplicateCheckInError(error: unknown): error is CreateCheckInError {
  return error instanceof CreateCheckInError && error.code === "duplicate";
}
