import { Platform } from "react-native";

import { PublicEnv, buildApiUrl } from "@/constants/env";

import {
  parseCreatedPostResponse,
  type CreatedPostResponse,
} from "./create-post";

type GetPostByIdRequest = {
  accessToken: string;
  postId: number;
  tokenType?: string | null;
};

function resolvePostByIdUrl(postId: number) {
  const normalizedPath = `/api/posts/${postId}`;

  if (PublicEnv.apiBaseUrl.trim()) {
    return buildApiUrl(normalizedPath);
  }

  return `https://api.culturequestlite.com${normalizedPath}`;
}

function validatePostId(postId: number) {
  if (!Number.isInteger(postId) || postId <= 0) {
    throw new Error("Không xác định được bài viết cần thao tác.");
  }
}

function isObject(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
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
    return "Bạn không có quyền xem bài viết này.";
  }

  if (status === 404) {
    return "Bài viết không còn tồn tại.";
  }

  return `Không thể tải bài viết (${status}).`;
}

function getConnectionErrorMessage(url: string) {
  if (Platform.OS === "android" && url.startsWith("http://")) {
    return "Android đang chặn kết nối HTTP tới API. Hãy dùng HTTPS rồi thử lại.";
  }

  return "Không thể kết nối đến máy chủ bài viết.";
}

export async function getPostById({
  accessToken,
  postId,
  tokenType,
}: GetPostByIdRequest): Promise<CreatedPostResponse> {
  validatePostId(postId);

  const postByIdUrl = resolvePostByIdUrl(postId);
  let response: Response;

  try {
    response = await fetch(postByIdUrl, {
      headers: {
        Accept: "application/json",
        Authorization: `${tokenType ?? "Bearer"} ${accessToken}`,
        "X-Client-Type": "mobile",
      },
      method: "GET",
    });
  } catch (error) {
    console.warn("[posts] get post by id network failure", {
      error: error instanceof Error ? error.message : error,
      platform: Platform.OS,
      postId,
      url: postByIdUrl,
    });
    throw new Error(getConnectionErrorMessage(postByIdUrl));
  }

  const responseBody = await parseResponseBody(response);

  if (!response.ok) {
    console.warn("[posts] get post by id rejected", {
      body: responseBody,
      postId,
      status: response.status,
      url: postByIdUrl,
    });
    throw new Error(getErrorMessage(responseBody, response.status));
  }

  const parsedResponse = parseCreatedPostResponse(responseBody);

  if (!parsedResponse) {
    throw new Error("API bài viết trả về dữ liệu không đúng định dạng.");
  }

  return parsedResponse;
}
