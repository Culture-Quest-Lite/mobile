import { Platform } from "react-native";

import { PublicEnv, buildApiUrl } from "@/constants/env";

type ToggleUserFollowRequest = {
  accessToken: string;
  tokenType?: string | null;
  userId: number | string;
};

function resolveToggleUserFollowUrl(userId: number | string) {
  const normalizedPath = `/api/users/${encodeURIComponent(`${userId}`)}/follow`;

  if (PublicEnv.apiBaseUrl.trim()) {
    return buildApiUrl(normalizedPath);
  }

  return `https://api.culturequestlite.com${normalizedPath}`;
}

function isObject(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}

function serializeError(error: unknown) {
  if (error instanceof Error) {
    return {
      message: error.message,
      name: error.name,
      stack: error.stack,
    };
  }

  return { value: error };
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

  return `Không thể cập nhật theo dõi (${status}).`;
}

function getConnectionErrorMessage(url: string) {
  if (Platform.OS === "android" && url.startsWith("http://")) {
    return "Android đang chặn kết nối HTTP tới API. Hãy dùng HTTPS hoặc rebuild Android dev client sau khi bật cleartext traffic.";
  }

  return "Không thể kết nối đến máy chủ theo dõi.";
}

async function requestToggleUserFollow(
  method: "DELETE" | "POST",
  { accessToken, tokenType, userId }: ToggleUserFollowRequest,
) {
  const url = resolveToggleUserFollowUrl(userId);
  let response: Response;

  try {
    response = await fetch(url, {
      headers: {
        Accept: "*/*",
        Authorization: `${tokenType ?? "Bearer"} ${accessToken}`,
        "Content-Type": "application/json",
        "X-Client-Type": "mobile",
      },
      method,
    });
  } catch (error) {
    console.warn("[community] toggle follow network failure", {
      error: serializeError(error),
      method,
      platform: Platform.OS,
      url,
      userId,
    });
    throw new Error(getConnectionErrorMessage(url));
  }

  const responseBody = await parseResponseBody(response);

  if (!response.ok) {
    console.warn("[community] toggle follow rejected", {
      body: responseBody,
      method,
      status: response.status,
      url,
      userId,
    });
    throw new Error(getErrorMessage(responseBody, response.status));
  }
}

export function followUser(request: ToggleUserFollowRequest) {
  return requestToggleUserFollow("POST", request);
}

export function unfollowUser(request: ToggleUserFollowRequest) {
  return requestToggleUserFollow("DELETE", request);
}
