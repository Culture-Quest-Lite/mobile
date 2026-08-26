import { Platform } from "react-native";

import { PublicEnv, buildApiUrl } from "@/constants/env";

type GetTagsRequest = {
  accessToken?: string | null;
  tokenType?: string | null;
};

export type ActiveTagDto = {
  createdAt: string;
  imageUrl?: string | null;
  tagId: number;
  tagName: string;
  tagStatus: string;
  updatedAt: string;
};

type GetTagsResponse = {
  content: ActiveTagDto[];
};

function resolveGetTagsUrl() {
  if (PublicEnv.apiBaseUrl.trim()) {
    return buildApiUrl("/api/tags?status=ACTIVE");
  }

  return "http://13.158.40.56:8080/api/tags?status=ACTIVE";
}

function isObject(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}

function isNullableString(value: unknown) {
  return value === null || value === undefined || typeof value === "string";
}

function readNullableString(value: unknown) {
  return typeof value === "string" ? value : null;
}

function isTagDto(value: unknown): value is ActiveTagDto {
  if (!isObject(value)) {
    return false;
  }

  return (
    typeof value.tagId === "number" &&
    typeof value.tagName === "string" &&
    typeof value.tagStatus === "string" &&
    isNullableString(value.imageUrl) &&
    typeof value.createdAt === "string" &&
    typeof value.updatedAt === "string"
  );
}

function isGetTagsResponse(value: unknown): value is GetTagsResponse {
  if (!isObject(value) || !Array.isArray(value.content)) {
    return false;
  }

  return value.content.every(isTagDto);
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

  return `Không thể tải danh sách chủ đề (${status}).`;
}

function getConnectionErrorMessage(url: string) {
  if (Platform.OS === "android" && url.startsWith("http://")) {
    return "Android đang chặn kết nối HTTP tới API. Hãy dùng HTTPS hoặc rebuild Android dev client sau khi bật cleartext traffic.";
  }

  return "Không thể kết nối đến máy chủ chủ đề.";
}

export async function getActiveTagNames({
  accessToken,
  tokenType,
}: GetTagsRequest): Promise<string[]> {
  const tags = await getActiveTags({
    accessToken,
    tokenType,
  });

  return tags.map((item) => item.tagName);
}

export async function getActiveTags({
  accessToken,
  tokenType,
}: GetTagsRequest): Promise<ActiveTagDto[]> {
  const getTagsUrl = resolveGetTagsUrl();
  const resolvedAccessToken = accessToken?.trim();
  let response: Response;

  try {
    response = await fetch(getTagsUrl, {
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
    console.warn("[home] get tags network failure", {
      error: serializeError(error),
      platform: Platform.OS,
      url: getTagsUrl,
    });
    throw new Error(getConnectionErrorMessage(getTagsUrl));
  }

  const responseBody = await parseResponseBody(response);

  if (!response.ok) {
    console.warn("[home] get tags rejected", {
      body: summarizeBody(responseBody),
      status: response.status,
      url: getTagsUrl,
    });
    throw new Error(getErrorMessage(responseBody, response.status));
  }

  if (!isGetTagsResponse(responseBody)) {
    console.warn("[home] get tags invalid payload", {
      body: summarizeBody(responseBody),
      url: getTagsUrl,
    });
    throw new Error("API chủ đề trả về dữ liệu không đúng định dạng.");
  }

  const tagsById = new Map<number, ActiveTagDto>();

  responseBody.content.forEach((item) => {
    const normalizedTagName = item.tagName.trim();

    if (!normalizedTagName || tagsById.has(item.tagId)) {
      return;
    }

    tagsById.set(item.tagId, {
      ...item,
      imageUrl: readNullableString(item.imageUrl)?.trim() || null,
      tagName: normalizedTagName,
    });
  });

  return Array.from(tagsById.values());
}
