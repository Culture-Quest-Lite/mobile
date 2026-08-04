import { Platform } from "react-native";

import { PublicEnv, buildApiUrl } from "@/constants/env";
import {
  normalizePostVisibilityValue,
  type PostVisibilityValue,
} from "@/lib/post-visibility";

import {
  parseCreatedPostResponse,
  type CreatedPostResponse,
} from "./create-post";

export type SharedPostResponse = CreatedPostResponse;

type SharePostRequest = {
  accessToken: string;
  content?: string;
  postId: number;
  tokenType?: string | null;
  visibility?: PostVisibilityValue;
};

function resolveSharePostUrl(postId: number) {
  const normalizedPath = `/api/posts/${postId}/share`;

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

function getErrorMessage(body: unknown, postId: number, status: number) {
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

  return `Không thể chia sẻ bài viết #${postId} (HTTP ${status}).`;
}

function getConnectionErrorMessage(url: string) {
  if (Platform.OS === "android" && url.startsWith("http://")) {
    return "Android đang chặn kết nối HTTP tới API. Hãy dùng HTTPS hoặc rebuild Android dev client sau khi bật cleartext traffic.";
  }

  return "Không thể kết nối đến máy chủ bài viết để chia sẻ.";
}

export async function sharePost({
  accessToken,
  content = "",
  postId,
  tokenType,
  visibility = "PUBLIC",
}: SharePostRequest): Promise<SharedPostResponse> {
  const sharePostUrl = resolveSharePostUrl(postId);
  const normalizedContent = content.trim();
  const normalizedVisibility = normalizePostVisibilityValue(visibility);
  let response: Response;

  try {
    response = await fetch(sharePostUrl, {
      body: JSON.stringify({
        content: normalizedContent,
        visibility: normalizedVisibility,
      }),
      headers: {
        Accept: "application/json",
        Authorization: `${tokenType ?? "Bearer"} ${accessToken}`,
        "Content-Type": "application/json",
        "X-Client-Type": "mobile",
      },
      method: "POST",
    });
  } catch (error) {
    console.warn("[posts] share post network failure", {
      error: serializeError(error),
      platform: Platform.OS,
      postId,
      url: sharePostUrl,
      visibility: normalizedVisibility,
    });
    throw new Error(getConnectionErrorMessage(sharePostUrl));
  }

  const responseBody = await parseResponseBody(response);

  if (!response.ok) {
    console.warn("[posts] share post rejected", {
      body: summarizeBody(responseBody),
      postId,
      status: response.status,
      url: sharePostUrl,
      visibility: normalizedVisibility,
    });
    throw new Error(getErrorMessage(responseBody, postId, response.status));
  }

  const parsedResponse = parseCreatedPostResponse(responseBody);

  if (!parsedResponse) {
    console.warn("[posts] share post invalid payload", {
      body: summarizeBody(responseBody),
      postId,
      url: sharePostUrl,
      visibility: normalizedVisibility,
    });
    throw new Error("API chia sẻ bài viết trả về dữ liệu không đúng định dạng.");
  }

  return parsedResponse;
}
