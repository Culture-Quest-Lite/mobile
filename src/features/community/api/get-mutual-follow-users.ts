import { Platform } from "react-native";

import { PublicEnv, buildApiUrl } from "@/constants/env";

type GetMutualFollowUsersRequest = {
  accessToken: string;
  displayName?: string | null;
  tokenType?: string | null;
};

type MutualFollowUserDto = {
  avatarUrl: string | null;
  displayName: string;
  isFollowing: boolean | null;
  levelName: string | null;
  userId: number;
  username: string;
};

export type MutualFollowUser = {
  avatarUrl: string | null;
  displayName: string;
  isFollowing: boolean | null;
  levelName: string | null;
  userId: number;
  username: string;
};

function resolveGetMutualFollowUsersUrl(displayName?: string | null) {
  const baseUrl = PublicEnv.apiBaseUrl.trim()
    ? buildApiUrl("/api/users/mutual-follow")
    : "https://api.culturequestlite.com/api/users/mutual-follow";

  const trimmedDisplayName = displayName?.trim();

  if (!trimmedDisplayName) {
    return baseUrl;
  }

  const encodedDisplayName = encodeURIComponent(trimmedDisplayName);
  return `${baseUrl}?display_name=${encodedDisplayName}`;
}

function isObject(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}

function isNullableString(value: unknown): value is string | null {
  return typeof value === "string" || value === null;
}

function isNullableBoolean(value: unknown): value is boolean | null {
  return typeof value === "boolean" || value === null;
}

function readMeaningfulText(value: string | null) {
  if (typeof value !== "string") {
    return null;
  }

  const trimmedValue = value.trim();
  return trimmedValue ? trimmedValue : null;
}

function isMutualFollowUserDto(value: unknown): value is MutualFollowUserDto {
  if (!isObject(value)) {
    return false;
  }

  return (
    typeof value.userId === "number" &&
    typeof value.username === "string" &&
    typeof value.displayName === "string" &&
    isNullableString(value.avatarUrl) &&
    isNullableString(value.levelName) &&
    isNullableBoolean(value.isFollowing)
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

  if (status === 401 || status === 403) {
    return "Phiên đăng nhập không hợp lệ. Vui lòng đăng nhập lại.";
  }

  return `Không thể tải danh sách bạn bè (${status}).`;
}

function getConnectionErrorMessage(url: string) {
  if (Platform.OS === "android" && url.startsWith("http://")) {
    return "Android đang chặn kết nối HTTP tới API. Hãy dùng HTTPS hoặc rebuild Android dev client sau khi bật cleartext traffic.";
  }

  return "Không thể kết nối đến máy chủ danh sách bạn bè.";
}

function normalizeMutualFollowUser(
  user: MutualFollowUserDto,
): MutualFollowUser | null {
  const normalizedUsername = readMeaningfulText(user.username)?.replace(
    /^@+/,
    "",
  );
  const normalizedDisplayName =
    readMeaningfulText(user.displayName) ?? normalizedUsername;

  if (!normalizedUsername || !normalizedDisplayName || user.userId <= 0) {
    return null;
  }

  return {
    avatarUrl: readMeaningfulText(user.avatarUrl),
    displayName: normalizedDisplayName,
    isFollowing: user.isFollowing,
    levelName: readMeaningfulText(user.levelName),
    userId: user.userId,
    username: normalizedUsername,
  };
}

export async function getMutualFollowUsers({
  accessToken,
  displayName,
  tokenType,
}: GetMutualFollowUsersRequest): Promise<MutualFollowUser[]> {
  const url = resolveGetMutualFollowUsersUrl(displayName);
  let response: Response;

  try {
    response = await fetch(url, {
      headers: {
        Accept: "application/json",
        Authorization: `${tokenType ?? "Bearer"} ${accessToken}`,
        "Content-Type": "application/json",
        "X-Client-Type": "mobile",
      },
      method: "GET",
    });
  } catch (error) {
    console.warn("[community] get mutual-follow users network failure", {
      error: serializeError(error),
      platform: Platform.OS,
      url,
    });
    throw new Error(getConnectionErrorMessage(url));
  }

  const responseBody = await parseResponseBody(response);

  if (!response.ok) {
    console.warn("[community] get mutual-follow users rejected", {
      body: summarizeBody(responseBody),
      status: response.status,
      url,
    });
    throw new Error(getErrorMessage(responseBody, response.status));
  }

  if (!Array.isArray(responseBody)) {
    console.warn("[community] get mutual-follow users invalid payload", {
      body: summarizeBody(responseBody),
      url,
    });
    throw new Error(
      "API danh sách bạn bè trả về dữ liệu không đúng định dạng.",
    );
  }

  return responseBody.flatMap((entry) => {
    if (!isMutualFollowUserDto(entry)) {
      console.warn("[community] skip invalid mutual-follow user entry", {
        entry,
        url,
      });
      return [];
    }

    const normalizedUser = normalizeMutualFollowUser(entry);
    return normalizedUser ? [normalizedUser] : [];
  });
}
