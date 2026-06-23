import { Platform } from "react-native";

import { PublicEnv, buildApiUrl } from "@/constants/env";

type GetTagsRequest = {
  accessToken: string;
  tokenType?: string | null;
};

type TagDto = {
  createdAt: string;
  tagId: number;
  tagName: string;
  tagStatus: string;
  updatedAt: string;
};

type GetTagsResponse = {
  content: TagDto[];
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

function isTagDto(value: unknown): value is TagDto {
  if (!isObject(value)) {
    return false;
  }

  return (
    typeof value.tagId === "number" &&
    typeof value.tagName === "string" &&
    typeof value.tagStatus === "string" &&
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
  const getTagsUrl = resolveGetTagsUrl();
  let response: Response;

  try {
    response = await fetch(getTagsUrl, {
      headers: {
        Accept: "application/json",
        Authorization: `${tokenType ?? "Bearer"} ${accessToken}`,
        "Content-Type": "application/json",
        "X-Client-Type": "mobile",
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

  return Array.from(
    new Set(
      responseBody.content
        .map((item) => item.tagName.trim())
        .filter(Boolean),
    ),
  );
}
