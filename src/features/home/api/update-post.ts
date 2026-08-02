import { File as ExpoFile } from "expo-file-system";
import { Platform } from "react-native";

import { PublicEnv, buildApiUrl } from "@/constants/env";
import {
  normalizePostVisibilityValue,
  type PostVisibilityValue,
} from "@/lib/post-visibility";

import {
  parseCreatedPostResponse,
  type CreatePostUploadFile,
  type CreatedPostResponse,
} from "./create-post";

type UpdatePostRequest = {
  accessToken: string;
  content: string;
  files?: CreatePostUploadFile[];
  postId: number;
  removedMediaIds?: number[];
  tokenType?: string | null;
  visibility?: PostVisibilityValue | string | null;
};

function resolveUpdatePostUrl(postId: number) {
  const normalizedPath = `/api/posts/${postId}`;

  if (PublicEnv.apiBaseUrl.trim()) {
    return buildApiUrl(normalizedPath);
  }

  return `https://api.culturequestlite.com${normalizedPath}`;
}

function validatePostId(postId: number) {
  if (!Number.isInteger(postId) || postId <= 0) {
    throw new Error("Không xác định được bài viết cần cập nhật.");
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
    return "Bạn không có quyền cập nhật bài viết này.";
  }

  if (status === 404) {
    return "Bài viết không còn tồn tại.";
  }

  return `Không thể cập nhật bài viết (${status}).`;
}

function getConnectionErrorMessage(url: string) {
  if (Platform.OS === "android" && url.startsWith("http://")) {
    return "Android đang chặn kết nối HTTP tới API. Hãy dùng HTTPS rồi thử lại.";
  }

  return "Không thể kết nối đến máy chủ bài viết.";
}

export async function updatePost({
  accessToken,
  content,
  files = [],
  postId,
  removedMediaIds = [],
  tokenType,
  visibility = "PUBLIC",
}: UpdatePostRequest): Promise<CreatedPostResponse> {
  validatePostId(postId);

  const normalizedContent = content.trim();
  const normalizedVisibility = normalizePostVisibilityValue(visibility);
  const updatePostUrl = resolveUpdatePostUrl(postId);
  const formData = new FormData();
  let response: Response;

  if (!normalizedContent) {
    throw new Error("Nội dung bài viết không được để trống.");
  }

  formData.append("content", normalizedContent);
  formData.append("visibility", normalizedVisibility);

  for (const mediaId of Array.from(new Set(removedMediaIds))) {
    if (Number.isInteger(mediaId) && mediaId > 0) {
      formData.append("removedMediaIds", `${mediaId}`);
    }
  }

  for (const file of files) {
    formData.append("files", new ExpoFile(file.uri), file.fileName);
  }

  try {
    response = await fetch(updatePostUrl, {
      body: formData,
      headers: {
        Accept: "application/json",
        Authorization: `${tokenType ?? "Bearer"} ${accessToken}`,
        "X-Client-Type": "mobile",
      },
      method: "PUT",
    });
  } catch (error) {
    console.warn("[posts] update post network failure", {
      error: error instanceof Error ? error.message : error,
      filesCount: files.length,
      platform: Platform.OS,
      postId,
      removedMediaCount: removedMediaIds.length,
      url: updatePostUrl,
      visibility: normalizedVisibility,
    });
    throw new Error(getConnectionErrorMessage(updatePostUrl));
  }

  const responseBody = await parseResponseBody(response);

  if (!response.ok) {
    console.warn("[posts] update post rejected", {
      body: responseBody,
      filesCount: files.length,
      postId,
      removedMediaCount: removedMediaIds.length,
      status: response.status,
      url: updatePostUrl,
      visibility: normalizedVisibility,
    });
    throw new Error(getErrorMessage(responseBody, response.status));
  }

  const parsedResponse = parseCreatedPostResponse(responseBody);

  if (!parsedResponse) {
    throw new Error("API cập nhật bài viết trả về dữ liệu không đúng định dạng.");
  }

  return parsedResponse;
}
