import { Platform } from "react-native";

import { PublicEnv, buildApiUrl } from "@/constants/env";

import type { Profile } from "../types";

type UpdateMyProfileRequest = {
  accessToken: string;
  avatarUrl: string | null;
  displayName: string;
  autoPlayAudio: boolean;
  tokenType?: string | null;
};

type GetMeResponse = {
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

function resolveUpdateMeUrl() {
  if (PublicEnv.apiBaseUrl.trim()) {
    return buildApiUrl("/api/users/me");
  }

  return "http://13.158.40.56:8080/api/users/me";
}

function isObject(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}

function isNullableString(value: unknown): value is string | null {
  return typeof value === "string" || value === null;
}

function isGetMeResponse(value: unknown): value is GetMeResponse {
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

  if (status === 401 || status === 403) {
    return "Phiên đăng nhập không hợp lệ. Vui lòng đăng nhập lại.";
  }

  return `Không thể cập nhật hồ sơ (${status}).`;
}

function getConnectionErrorMessage(url: string) {
  if (Platform.OS === "android" && url.startsWith("http://")) {
    return "Android đang chặn kết nối HTTP tới API. Hãy dùng HTTPS hoặc rebuild Android dev client sau khi bật cleartext traffic.";
  }

  return "Không thể kết nối đến máy chủ hồ sơ.";
}

function extractLevel(levelName: string | null) {
  const match = levelName?.match(/(\d+)/);

  if (!match) {
    return null;
  }

  const parsedLevel = Number(match[1]);
  return Number.isFinite(parsedLevel) ? parsedLevel : null;
}

function mapGetMeResponseToProfile(response: GetMeResponse): Profile {
  const normalizedDisplayName = response.displayName.trim();
  const normalizedUsername = response.username.trim();

  return {
    autoPlayAudio: response.autoPlayAudio,
    avatar: response.avatarUrl,
    cover: response.backgroundUrl,
    createdAt: response.createdAt,
    currentLevelXp: null,
    email: response.email,
    followers: response.totalFollowers,
    following: response.totalFollowing,
    id: response.userId.toString(),
    isPremium: response.isPremium,
    isMaxLevel: false,
    level: extractLevel(response.levelName),
    levelName: response.levelName,
    name: normalizedDisplayName || normalizedUsername,
    points: response.totalPoints,
    role: response.role,
    routeIds: [],
    savedHotspotSlugs: [],
    status: response.status,
    totalXp: response.totalXp,
    totalPosts: response.totalPosts,
    username: normalizedUsername,
    xpToNext: null,
  };
}

export async function updateMyProfile({
  accessToken,
  avatarUrl,
  displayName,
  autoPlayAudio,
  tokenType,
}: UpdateMyProfileRequest): Promise<Profile | null> {
  const updateMeUrl = resolveUpdateMeUrl();
  let response: Response;

  try {
    response = await fetch(updateMeUrl, {
      body: JSON.stringify({
        avatarUrl,
        autoPlayAudio,
        displayName,
      }),
      headers: {
        Accept: "application/json",
        Authorization: `${tokenType ?? "Bearer"} ${accessToken}`,
        "Content-Type": "application/json",
        "X-Client-Type": "mobile",
      },
      method: "PUT",
    });
  } catch (error) {
    console.warn("[profile] update me network failure", {
      error: serializeError(error),
      platform: Platform.OS,
      url: updateMeUrl,
    });
    throw new Error(getConnectionErrorMessage(updateMeUrl));
  }

  const responseBody = await parseResponseBody(response);

  if (!response.ok) {
    console.warn("[profile] update me rejected", {
      body: summarizeBody(responseBody),
      status: response.status,
      url: updateMeUrl,
    });
    throw new Error(getErrorMessage(responseBody, response.status));
  }

  if (responseBody === null) {
    return null;
  }

  if (!isGetMeResponse(responseBody)) {
    console.warn("[profile] update me unexpected payload", {
      body: summarizeBody(responseBody),
      url: updateMeUrl,
    });
    return null;
  }

  return mapGetMeResponseToProfile(responseBody);
}
