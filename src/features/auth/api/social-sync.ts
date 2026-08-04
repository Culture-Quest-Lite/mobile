import { Platform } from "react-native";

import { PublicEnv, buildApiUrl } from "@/constants/env";
import type { SocialProvider } from "@/features/auth/api/social-login";

// Mobile đổi authorization code trực tiếp với Keycloak nên backend không hề biết
// có người vừa đăng nhập. Không gọi endpoint này thì user mới sẽ có tài khoản
// Keycloak mà không có row trong bảng users, và mọi API sau đó đều lỗi.

type SyncSocialAccountRequest = {
  accessToken: string;
  provider: SocialProvider;
  tokenType?: string | null;
};

export type SocialSyncResult = {
  displayName: string;
  email: string;
  levelName: string | null;
  userId: number;
  username: string;
};

function resolveSocialSyncUrl() {
  if (PublicEnv.apiBaseUrl.trim()) {
    return buildApiUrl("/api/auth/social-sync");
  }

  return "http://13.158.40.56:8080/api/auth/social-sync";
}

function isObject(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}

function isSocialSyncResult(value: unknown): value is SocialSyncResult {
  if (!isObject(value)) {
    return false;
  }

  return (
    typeof value.userId === "number" &&
    typeof value.username === "string" &&
    typeof value.email === "string" &&
    typeof value.displayName === "string"
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

  return `Không thể đồng bộ tài khoản (${status}).`;
}

function getConnectionErrorMessage(url: string) {
  if (Platform.OS === "android" && url.startsWith("http://")) {
    return "Android đang chặn kết nối HTTP tới API. Hãy dùng HTTPS hoặc rebuild Android dev client sau khi bật cleartext traffic.";
  }

  return "Không thể kết nối đến máy chủ để đồng bộ tài khoản.";
}

export async function syncSocialAccount({
  accessToken,
  provider,
  tokenType,
}: SyncSocialAccountRequest): Promise<SocialSyncResult> {
  const syncUrl = resolveSocialSyncUrl();
  let response: Response;

  try {
    response = await fetch(syncUrl, {
      body: JSON.stringify({ provider }),
      headers: {
        Accept: "application/json",
        Authorization: `${tokenType ?? "Bearer"} ${accessToken}`,
        "Content-Type": "application/json",
        "X-Client-Type": "mobile",
      },
      method: "POST",
    });
  } catch (error) {
    console.warn("[auth] social sync network failure", {
      error: serializeError(error),
      platform: Platform.OS,
      provider,
      url: syncUrl,
    });
    throw new Error(getConnectionErrorMessage(syncUrl));
  }

  const responseBody = await parseResponseBody(response);

  if (!response.ok) {
    console.warn("[auth] social sync rejected", {
      body: summarizeBody(responseBody),
      provider,
      status: response.status,
      url: syncUrl,
    });
    throw new Error(getErrorMessage(responseBody, response.status));
  }

  if (!isSocialSyncResult(responseBody)) {
    console.warn("[auth] social sync invalid payload", {
      body: summarizeBody(responseBody),
      provider,
      url: syncUrl,
    });
    throw new Error("API đồng bộ tài khoản trả về dữ liệu không đúng định dạng.");
  }

  return responseBody;
}
