import { Platform } from "react-native";

import { PublicEnv, buildApiUrl } from "@/constants/env";
import type { LoginResponse } from "@/features/auth/api/login";

export type RefreshTokenRequest = {
  refreshToken: string;
};

export type RefreshTokenResponse = LoginResponse;

function resolveRefreshTokenUrl() {
  if (PublicEnv.apiBaseUrl.trim()) {
    return buildApiUrl("/api/auth/refresh-token");
  }

  return "http://13.158.40.56:8080/api/auth/refresh-token";
}

function isObject(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}

function isRefreshTokenResponse(value: unknown): value is RefreshTokenResponse {
  if (!isObject(value)) {
    return false;
  }

  return (
    typeof value.accessToken === "string" &&
    typeof value.refreshToken === "string" &&
    typeof value.tokenType === "string" &&
    typeof value.expiresIn === "number" &&
    typeof value.refreshExpiresIn === "number"
  );
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

  if (isObject(body)) {
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

  if (status === 401) {
    return "Phiên đăng nhập đã hết hạn. Vui lòng đăng nhập lại.";
  }

  return `Làm mới phiên đăng nhập thất bại (${status}).`;
}

function getConnectionErrorMessage(refreshTokenUrl: string) {
  if (Platform.OS === "android" && refreshTokenUrl.startsWith("http://")) {
    return "Android đang chặn kết nối HTTP tới API. Hãy dùng HTTPS hoặc rebuild Android dev client sau khi bật cleartext traffic.";
  }

  return "Không thể kết nối đến máy chủ làm mới phiên đăng nhập.";
}

export async function refreshAccessToken({
  refreshToken,
}: RefreshTokenRequest): Promise<RefreshTokenResponse> {
  const refreshTokenUrl = resolveRefreshTokenUrl();
  let response: Response;

  console.info("[auth] refresh token request started", {
    platform: Platform.OS,
    url: refreshTokenUrl,
  });

  try {
    response = await fetch(refreshTokenUrl, {
      body: JSON.stringify({
        refreshToken,
      }),
      headers: {
        Accept: "application/json",
        Cookie: `refresh_token=${refreshToken}`,
        "Content-Type": "application/json",
        "X-Client-Type": "mobile",
      },
      method: "POST",
    });
  } catch (error) {
    console.warn("[auth] refresh token network failure", {
      error: serializeError(error),
      platform: Platform.OS,
      url: refreshTokenUrl,
    });
    throw new Error(getConnectionErrorMessage(refreshTokenUrl));
  }

  const responseBody = await parseResponseBody(response);

  console.info("[auth] refresh token response received", {
    ok: response.ok,
    status: response.status,
    url: refreshTokenUrl,
  });

  if (!response.ok) {
    console.warn("[auth] refresh token rejected", {
      body: summarizeBody(responseBody),
      status: response.status,
      url: refreshTokenUrl,
    });
    throw new Error(getErrorMessage(responseBody, response.status));
  }

  if (!isRefreshTokenResponse(responseBody)) {
    console.warn("[auth] refresh token invalid payload", {
      body: summarizeBody(responseBody),
      url: refreshTokenUrl,
    });
    throw new Error("API refresh token trả về dữ liệu không đúng định dạng.");
  }

  console.info("[auth] refresh token succeeded", {
    expiresIn: responseBody.expiresIn,
    refreshExpiresIn: responseBody.refreshExpiresIn,
    tokenType: responseBody.tokenType,
    url: refreshTokenUrl,
  });

  return responseBody;
}
