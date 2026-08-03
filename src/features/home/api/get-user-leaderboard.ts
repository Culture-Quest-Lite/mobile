import { Platform } from "react-native";

import { PublicEnv, buildApiUrl } from "@/constants/env";

type GetUserLeaderboardRequest = {
  accessToken?: string | null;
  tokenType?: string | null;
};

export type UserLeaderboardEntryDto = {
  avatarUrl: string | null;
  displayName: string;
  isCurrentUser: boolean;
  levelName: string | null;
  rank: number;
  totalXp: number;
  userId: number;
  username: string;
};

type UserLeaderboardPageDto = {
  number: number;
  size: number;
  totalElements: number;
  totalPages: number;
};

type GetUserLeaderboardResponse = {
  content: UserLeaderboardEntryDto[];
  page: UserLeaderboardPageDto;
};

function resolveGetUserLeaderboardUrl() {
  if (PublicEnv.apiBaseUrl.trim()) {
    return buildApiUrl("/api/users/leaderboard");
  }

  return "https://api.culturequestlite.com/api/users/leaderboard";
}

function isObject(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}

function isNullableString(value: unknown): value is string | null {
  return typeof value === "string" || value === null;
}

function isLeaderboardEntryDto(value: unknown): value is UserLeaderboardEntryDto {
  if (!isObject(value)) {
    return false;
  }

  return (
    typeof value.rank === "number" &&
    typeof value.userId === "number" &&
    typeof value.username === "string" &&
    typeof value.displayName === "string" &&
    isNullableString(value.avatarUrl) &&
    typeof value.totalXp === "number" &&
    isNullableString(value.levelName) &&
    typeof value.isCurrentUser === "boolean"
  );
}

function isLeaderboardPageDto(value: unknown): value is UserLeaderboardPageDto {
  if (!isObject(value)) {
    return false;
  }

  return (
    typeof value.size === "number" &&
    typeof value.number === "number" &&
    typeof value.totalElements === "number" &&
    typeof value.totalPages === "number"
  );
}

function isGetUserLeaderboardResponse(
  value: unknown,
): value is GetUserLeaderboardResponse {
  if (!isObject(value) || !Array.isArray(value.content)) {
    return false;
  }

  return value.content.every(isLeaderboardEntryDto) && isLeaderboardPageDto(value.page);
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
    return "Phiên đăng nhập không hợp lệ để tải bảng xếp hạng.";
  }

  return `Không thể tải bảng xếp hạng (${status}).`;
}

function getConnectionErrorMessage(url: string) {
  if (Platform.OS === "android" && url.startsWith("http://")) {
    return "Android đang chặn kết nối HTTP tới API. Hãy dùng HTTPS hoặc rebuild Android dev client sau khi bật cleartext traffic.";
  }

  return "Không thể kết nối đến máy chủ bảng xếp hạng.";
}

function normalizeLeaderboardEntry(
  entry: UserLeaderboardEntryDto,
): UserLeaderboardEntryDto | null {
  const normalizedUsername = entry.username.trim();
  const normalizedDisplayName = entry.displayName.trim();

  if (!normalizedUsername || !normalizedDisplayName || entry.rank <= 0 || entry.userId <= 0) {
    return null;
  }

  return {
    ...entry,
    avatarUrl: entry.avatarUrl?.trim() || null,
    displayName: normalizedDisplayName,
    levelName: entry.levelName?.trim() || null,
    totalXp: Math.max(0, Math.round(entry.totalXp)),
    username: normalizedUsername,
  };
}

export async function getUserLeaderboard({
  accessToken,
  tokenType,
}: GetUserLeaderboardRequest = {}): Promise<GetUserLeaderboardResponse> {
  const getUserLeaderboardUrl = resolveGetUserLeaderboardUrl();
  const resolvedAccessToken = accessToken?.trim();
  let response: Response;

  try {
    response = await fetch(getUserLeaderboardUrl, {
      headers: {
        Accept: "application/json",
        "Content-Type": "application/json",
        "X-Client-Type": "mobile",
        ...(resolvedAccessToken
          ? {
              Authorization: `${tokenType ?? "Bearer"} ${resolvedAccessToken}`,
            }
          : {}),
      },
      method: "GET",
    });
  } catch (error) {
    console.warn("[home] get leaderboard network failure", {
      error: serializeError(error),
      platform: Platform.OS,
      url: getUserLeaderboardUrl,
    });
    throw new Error(getConnectionErrorMessage(getUserLeaderboardUrl));
  }

  const responseBody = await parseResponseBody(response);

  if (!response.ok) {
    console.warn("[home] get leaderboard rejected", {
      body: summarizeBody(responseBody),
      status: response.status,
      url: getUserLeaderboardUrl,
    });
    throw new Error(getErrorMessage(responseBody, response.status));
  }

  if (!isGetUserLeaderboardResponse(responseBody)) {
    console.warn("[home] get leaderboard invalid payload", {
      body: summarizeBody(responseBody),
      url: getUserLeaderboardUrl,
    });
    throw new Error("API bảng xếp hạng trả về dữ liệu không đúng định dạng.");
  }

  return {
    ...responseBody,
    content: responseBody.content
      .map(normalizeLeaderboardEntry)
      .filter((entry): entry is UserLeaderboardEntryDto => Boolean(entry)),
  };
}
