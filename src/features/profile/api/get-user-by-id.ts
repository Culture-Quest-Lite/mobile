import { Platform } from "react-native";

import { PublicEnv, buildApiUrl } from "@/constants/env";

import type { Profile } from "../types";

type GetUserProfileByIdRequest = {
  accessToken?: string | null;
  tokenType?: string | null;
  userId: number | string;
};

type GetUserProfileByIdResponse = {
  userId: number;
  username: string;
  email: string;
  displayName: string;
  avatarUrl: string | null;
  backgroundUrl: string | null;
  totalXp: number;
  totalPoints: number;
  autoPlayAudio: boolean;
  isPremium: boolean;
  status: string;
  levelName: string | null;
  role: string;
  createdAt: string;
  totalFollowers: number;
  totalFollowing: number;
  totalPosts: number;
};

const meaninglessTextValues = new Set(["", "string", "null", "undefined"]);

function resolveGetUserProfileByIdUrl(userId: number | string) {
  const normalizedPath = `/api/users/${encodeURIComponent(`${userId}`)}`;

  if (PublicEnv.apiBaseUrl.trim()) {
    return buildApiUrl(normalizedPath);
  }

  return `https://api.culturequestlite.com${normalizedPath}`;
}

function isObject(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}

function isNullableString(value: unknown): value is string | null {
  return typeof value === "string" || value === null;
}

function readMeaningfulText(value: string | null) {
  if (typeof value !== "string") {
    return null;
  }

  const trimmedValue = value.trim();

  if (!trimmedValue) {
    return null;
  }

  return meaninglessTextValues.has(trimmedValue.toLowerCase())
    ? null
    : trimmedValue;
}

function isGetUserProfileByIdResponse(
  value: unknown,
): value is GetUserProfileByIdResponse {
  if (!isObject(value)) {
    return false;
  }

  return (
    typeof value.userId === "number" &&
    typeof value.username === "string" &&
    typeof value.email === "string" &&
    typeof value.displayName === "string" &&
    isNullableString(value.avatarUrl) &&
    isNullableString(value.backgroundUrl) &&
    typeof value.totalXp === "number" &&
    typeof value.totalPoints === "number" &&
    typeof value.autoPlayAudio === "boolean" &&
    typeof value.isPremium === "boolean" &&
    typeof value.status === "string" &&
    isNullableString(value.levelName) &&
    typeof value.role === "string" &&
    typeof value.createdAt === "string" &&
    typeof value.totalFollowers === "number" &&
    typeof value.totalFollowing === "number" &&
    typeof value.totalPosts === "number"
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

  if (status === 404) {
    return "Không tìm thấy hồ sơ explorer.";
  }

  if (status === 401 || status === 403) {
    return "Phiên đăng nhập không hợp lệ. Vui lòng đăng nhập lại.";
  }

  return `Không thể tải hồ sơ (${status}).`;
}

function getConnectionErrorMessage(url: string) {
  if (Platform.OS === "android" && url.startsWith("http://")) {
    return "Android đang chặn kết nối HTTP tới API. Hãy dùng HTTPS hoặc rebuild Android dev client sau khi bật cleartext traffic.";
  }

  return "Không thể kết nối đến máy chủ hồ sơ.";
}

function extractLevel(levelName: string | null) {
  const meaningfulLevelName = readMeaningfulText(levelName);
  const match = meaningfulLevelName?.match(/(\d+)/);

  if (!match) {
    return null;
  }

  const parsedLevel = Number(match[1]);
  return Number.isFinite(parsedLevel) ? parsedLevel : null;
}

function mapGetUserProfileByIdResponseToProfile(
  response: GetUserProfileByIdResponse,
  requestedUserId: number | string,
): Profile {
  const normalizedUsername =
    readMeaningfulText(response.username)?.replace(/^@+/, "") ?? "explorer";
  const normalizedDisplayName =
    readMeaningfulText(response.displayName) ?? normalizedUsername;

  return {
    autoPlayAudio: response.autoPlayAudio,
    avatar: readMeaningfulText(response.avatarUrl),
    cover: readMeaningfulText(response.backgroundUrl),
    createdAt: readMeaningfulText(response.createdAt),
    currentLevelRequiredXp: null,
    currentLevelXp: null,
    email: readMeaningfulText(response.email),
    followers: response.totalFollowers,
    following: response.totalFollowing,
    hasExactLevelProgress: false,
    id: `${requestedUserId}`,
    isPremium: response.isPremium,
    isMaxLevel: false,
    level: extractLevel(response.levelName),
    levelName: readMeaningfulText(response.levelName),
    levelProgressPercent: null,
    name: normalizedDisplayName,
    nextLevelName: null,
    nextLevelNumber: null,
    nextLevelRequiredXp: null,
    points: response.totalPoints,
    remainingXpToNextLevel: null,
    role: readMeaningfulText(response.role),
    routeIds: [],
    savedHotspotSlugs: [],
    status: readMeaningfulText(response.status),
    totalXp: response.totalXp,
    totalPosts: response.totalPosts,
    username: normalizedUsername,
    xpToNext: null,
  };
}

export async function getUserProfileById({
  accessToken,
  tokenType,
  userId,
}: GetUserProfileByIdRequest): Promise<Profile> {
  const getUserProfileByIdUrl = resolveGetUserProfileByIdUrl(userId);
  let response: Response;

  try {
    response = await fetch(getUserProfileByIdUrl, {
      headers: {
        Accept: "application/json",
        ...(accessToken
          ? { Authorization: `${tokenType ?? "Bearer"} ${accessToken}` }
          : {}),
        "Content-Type": "application/json",
        "X-Client-Type": "mobile",
      },
      method: "GET",
    });
  } catch (error) {
    console.warn("[profile] get user by id network failure", {
      error: serializeError(error),
      platform: Platform.OS,
      url: getUserProfileByIdUrl,
      userId,
    });
    throw new Error(getConnectionErrorMessage(getUserProfileByIdUrl));
  }

  const responseBody = await parseResponseBody(response);

  if (!response.ok) {
    console.warn("[profile] get user by id rejected", {
      body: summarizeBody(responseBody),
      status: response.status,
      url: getUserProfileByIdUrl,
      userId,
    });
    throw new Error(getErrorMessage(responseBody, response.status));
  }

  if (!isGetUserProfileByIdResponse(responseBody)) {
    console.warn("[profile] get user by id invalid payload", {
      body: summarizeBody(responseBody),
      url: getUserProfileByIdUrl,
      userId,
    });
    throw new Error("API hồ sơ trả về dữ liệu không đúng định dạng.");
  }

  return mapGetUserProfileByIdResponseToProfile(responseBody, userId);
}
