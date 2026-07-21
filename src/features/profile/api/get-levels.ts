import { Platform } from "react-native";

import { PublicEnv, buildApiUrl } from "@/constants/env";

type GetLevelsRequest = {
  accessToken: string;
  tokenType?: string | null;
};

type GetLevelsResponseItem = {
  levelProgressId: number | null;
  levelId: number;
  userId: number | null;
  levelName: string;
  requiredXp: number;
  xpAtUnlock: number | null;
  unlockedAt: string | null;
};

export type GamificationLevel = {
  id: number;
  levelId: number;
  levelNumber: number;
  levelProgressId: number | null;
  name: string;
  levelName: string;
  requiredXp: number;
  unlockedAt: string | null;
  userId: number | null;
  xpAtUnlock: number | null;
};

function resolveGetLevelsUrl() {
  if (PublicEnv.apiBaseUrl.trim()) {
    return buildApiUrl("/api/gamification/levels/progress/me");
  }

  return "https://api.culturequestlite.com/api/gamification/levels/progress/me";
}

function isObject(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}

function isNullableNumber(value: unknown): value is number | null | undefined {
  return typeof value === "number" || value === null || value === undefined;
}

function isNullableString(value: unknown): value is string | null | undefined {
  return typeof value === "string" || value === null || value === undefined;
}

function isGetLevelsResponseItem(value: unknown): value is GetLevelsResponseItem {
  if (!isObject(value)) {
    return false;
  }

  return (
    typeof value.levelId === "number" &&
    typeof value.levelName === "string" &&
    typeof value.requiredXp === "number" &&
    isNullableNumber(value.levelProgressId) &&
    isNullableString(value.unlockedAt) &&
    isNullableNumber(value.userId) &&
    isNullableNumber(value.xpAtUnlock)
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

  if (Array.isArray(body)) {
    return body.slice(0, 5);
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

  return `Không thể tải tiến độ cấp độ (${status}).`;
}

function getConnectionErrorMessage(url: string) {
  if (Platform.OS === "android" && url.startsWith("http://")) {
    return "Android đang chặn kết nối HTTP tới API. Hãy dùng HTTPS hoặc rebuild Android dev client sau khi bật cleartext traffic.";
  }

  return "Không thể kết nối đến máy chủ tiến độ cấp độ.";
}

function extractLevelNumber(name: string) {
  const match = name.match(/(\d+)/);

  if (!match) {
    return null;
  }

  const parsedLevel = Number(match[1]);
  return Number.isFinite(parsedLevel) ? parsedLevel : null;
}

function mapResponseItemToLevel(
  response: GetLevelsResponseItem,
  index: number,
): GamificationLevel {
  return {
    levelId: response.levelId,
    levelName: response.levelName.trim(),
    id: response.levelId,
    levelNumber: extractLevelNumber(response.levelName) ?? index + 1,
    levelProgressId: response.levelProgressId ?? null,
    name: response.levelName.trim(),
    requiredXp: response.requiredXp,
    unlockedAt: response.unlockedAt ?? null,
    userId: response.userId ?? null,
    xpAtUnlock: response.xpAtUnlock ?? null,
  };
}

export async function getGamificationLevels({
  accessToken,
  tokenType,
}: GetLevelsRequest): Promise<GamificationLevel[]> {
  const getLevelsUrl = resolveGetLevelsUrl();
  let response: Response;

  try {
    response = await fetch(getLevelsUrl, {
      headers: {
        Accept: "application/json",
        Authorization: `${tokenType ?? "Bearer"} ${accessToken}`,
        "Content-Type": "application/json",
        "X-Client-Type": "mobile",
      },
      method: "GET",
    });
  } catch (error) {
    console.warn("[profile] get level progress network failure", {
      error: serializeError(error),
      platform: Platform.OS,
      url: getLevelsUrl,
    });
    throw new Error(getConnectionErrorMessage(getLevelsUrl));
  }

  const responseBody = await parseResponseBody(response);

  if (!response.ok) {
    console.warn("[profile] get level progress rejected", {
      body: summarizeBody(responseBody),
      status: response.status,
      url: getLevelsUrl,
    });
    throw new Error(getErrorMessage(responseBody, response.status));
  }

  if (!Array.isArray(responseBody) || !responseBody.every(isGetLevelsResponseItem)) {
    console.warn("[profile] get level progress invalid payload", {
      body: summarizeBody(responseBody),
      url: getLevelsUrl,
    });
    throw new Error("API tiến độ cấp độ trả về dữ liệu không đúng định dạng.");
  }

  const sortedLevels = [...responseBody].sort(
    (left, right) =>
      left.requiredXp - right.requiredXp || left.levelId - right.levelId,
  );

  return sortedLevels.map(mapResponseItemToLevel);
}
