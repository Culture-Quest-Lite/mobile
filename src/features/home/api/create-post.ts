import { Platform } from "react-native";
import { File as ExpoFile } from "expo-file-system";

import { PublicEnv, buildApiUrl } from "@/constants/env";
import {
  normalizePostVisibilityValue,
  type PostVisibilityValue,
} from "@/lib/post-visibility";
import { parseSharedPost, type SharedPostSummary } from "@/lib/shared-post";

export type PostVisibility = PostVisibilityValue;

export type CreatePostUploadFile = {
  fileName: string;
  mimeType: string;
  uri: string;
};

export type CreatedPostMedia = {
  createdAt: string | null;
  displayOrder: number | null;
  fileName: string;
  fileSize: number | null;
  fileUrl: string;
  mediaId: number;
  mediaType: string;
  mimeType: string;
  updatedAt: string | null;
};

export type CreatedPostTag = {
  imageUrl?: string | null;
  tagId: number;
  tagName: string;
};

export type CreatedPostResponse = {
  commentCount: number | null;
  content: string;
  createdAt: string;
  displayName: string;
  hotspotIds: number[];
  isLiked: boolean;
  isTaggedHotspot: boolean;
  isTaggedRoute: boolean;
  likeCount: number | null;
  medias: CreatedPostMedia[];
  pointEarned: number | null;
  pointRemaining: number | null;
  postId: number;
  reason: string | null;
  routeIds: number[];
  shareCount: number | null;
  sharedPost: SharedPostSummary | null;
  status: string;
  tags: CreatedPostTag[];
  userId: number;
  username: string;
  visibility: PostVisibility | string;
};

type CreatePostRequest = {
  accessToken: string;
  content: string;
  files: CreatePostUploadFile[];
  hotspotIds?: number[];
  routeIds?: number[];
  tagIds?: number[];
  tokenType?: string | null;
  visibility?: PostVisibility;
};

function resolveCreatePostUrl() {
  if (PublicEnv.apiBaseUrl.trim()) {
    return buildApiUrl("/api/posts");
  }

  return "https://api.culturequestlite.com/api/posts";
}

function isObject(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}

function readNumber(value: unknown) {
  return typeof value === "number" && Number.isFinite(value) ? value : null;
}

function readString(value: unknown) {
  return typeof value === "string" ? value : "";
}

function readBoolean(value: unknown) {
  return typeof value === "boolean" ? value : false;
}

function readNullableNumber(value: unknown) {
  return value === null ? null : readNumber(value);
}

function readNullableString(value: unknown) {
  return typeof value === "string" ? value : value === null ? null : null;
}

function isNonNull<T>(value: T | null): value is T {
  return value !== null;
}

function parseCreatedPostTag(value: unknown): CreatedPostTag | null {
  if (!isObject(value)) {
    return null;
  }

  const tagId = readNumber(value.tagId);

  if (tagId === null) {
    return null;
  }

  return {
    imageUrl: readNullableString(value.imageUrl),
    tagId,
    tagName: readString(value.tagName),
  };
}

function parseCreatedPostMedia(value: unknown): CreatedPostMedia | null {
  if (!isObject(value)) {
    return null;
  }

  const mediaId = readNumber(value.mediaId);

  if (mediaId === null) {
    return null;
  }

  return {
    createdAt: readNullableString(value.createdAt),
    displayOrder: readNullableNumber(value.displayOrder),
    fileName: readString(value.fileName),
    fileSize: readNullableNumber(value.fileSize),
    fileUrl: readString(value.fileUrl),
    mediaId,
    mediaType: readString(value.mediaType),
    mimeType: readString(value.mimeType),
    updatedAt: readNullableString(value.updatedAt),
  };
}

export function parseCreatedPostResponse(
  value: unknown,
): CreatedPostResponse | null {
  if (!isObject(value)) {
    return null;
  }

  const postId = readNumber(value.postId);
  const userId = readNumber(value.userId);
  const createdAt = readString(value.createdAt);

  if (postId === null || userId === null || !createdAt.trim()) {
    return null;
  }

  const medias = Array.isArray(value.medias)
    ? value.medias.map(parseCreatedPostMedia).filter(isNonNull)
    : [];
  const tags = Array.isArray(value.tags)
    ? value.tags.map(parseCreatedPostTag).filter(isNonNull)
    : [];
  const hotspotIds = Array.isArray(value.hotspotIds)
    ? value.hotspotIds.map(readNumber).filter(isNonNull)
    : [];
  const routeIds = Array.isArray(value.routeIds)
    ? value.routeIds.map(readNumber).filter(isNonNull)
    : [];

  return {
    commentCount: readNullableNumber(value.commentCount),
    content: readString(value.content),
    createdAt,
    displayName: readString(value.displayName),
    hotspotIds,
    isLiked: readBoolean(value.isLiked),
    isTaggedHotspot: readBoolean(value.isTaggedHotspot),
    isTaggedRoute: readBoolean(value.isTaggedRoute),
    likeCount: readNullableNumber(value.likeCount),
    medias,
    pointEarned: readNullableNumber(value.pointEarned),
    pointRemaining: readNullableNumber(value.pointRemaining),
    postId,
    reason: readNullableString(value.reason),
    routeIds,
    shareCount: readNullableNumber(value.shareCount),
    sharedPost: parseSharedPost(value.sharedPost),
    status: readString(value.status),
    tags,
    userId,
    username: readString(value.username),
    visibility: readString(value.visibility),
  };
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

  if (isObject(body) || Array.isArray(body)) {
    return body;
  }

  return body;
}

function isExpoFormDataFileError(error: unknown) {
  return (
    error instanceof Error &&
    error.message.includes("Unsupported FormDataPart implementation")
  );
}

function isCleartextTrafficError(error: unknown) {
  return (
    error instanceof Error &&
    /cleartext|CLEARTEXT|Cleartext/i.test(error.message)
  );
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

  return `Không thể đăng bài viết (${status}).`;
}

function getConnectionErrorMessage(url: string, error: unknown) {
  if (isExpoFormDataFileError(error)) {
    return "Ảnh hoặc video đang được gửi sai định dạng multipart. Vui lòng cập nhật app rồi thử lại.";
  }

  if (
    Platform.OS === "android" &&
    url.startsWith("http://") &&
    isCleartextTrafficError(error)
  ) {
    return "Android đang chặn kết nối HTTP tới API. Hãy dùng HTTPS hoặc rebuild Android dev client sau khi bật cleartext traffic.";
  }

  return "Không thể kết nối đến máy chủ bài viết.";
}

export async function createPost({
  accessToken,
  content,
  files,
  hotspotIds,
  routeIds,
  tagIds,
  tokenType,
  visibility = "PUBLIC",
}: CreatePostRequest): Promise<CreatedPostResponse> {
  const createPostUrl = resolveCreatePostUrl();
  const normalizedContent = content.trim();
  const normalizedHotspotIds = (hotspotIds ?? []).filter(
    (hotspotId) =>
      Number.isInteger(hotspotId) && Number.isFinite(hotspotId) && hotspotId > 0,
  );
  const normalizedRouteIds = (routeIds ?? []).filter(
    (routeId) =>
      Number.isInteger(routeId) && Number.isFinite(routeId) && routeId > 0,
  );
  const normalizedTagIds = (tagIds ?? []).filter(
    (tagId) => Number.isInteger(tagId) && Number.isFinite(tagId) && tagId > 0,
  );
  const normalizedVisibility = normalizePostVisibilityValue(visibility);
  const formData = new FormData();
  let response: Response;

  if (!normalizedContent) {
    throw new Error("Nội dung bài viết không được để trống.");
  }

  formData.append("content", normalizedContent);
  formData.append("visibility", normalizedVisibility);

  for (const hotspotId of normalizedHotspotIds) {
    formData.append("hotspotIds", `${hotspotId}`);
  }

  for (const routeId of normalizedRouteIds) {
    formData.append("routeIds", `${routeId}`);
  }

  for (const tagId of normalizedTagIds) {
    formData.append("tagIds", `${tagId}`);
  }

  for (const file of files) {
    const uploadFile = new ExpoFile(file.uri);

    formData.append("files", uploadFile, file.fileName);
  }

  try {
    response = await fetch(createPostUrl, {
      body: formData,
      headers: {
        Accept: "application/json",
        Authorization: `${tokenType ?? "Bearer"} ${accessToken}`,
        "X-Client-Type": "mobile",
      },
      method: "POST",
    });
  } catch (error) {
    console.warn("[posts] create post network failure", {
      error: serializeError(error),
      filesCount: files.length,
      hotspotIds: normalizedHotspotIds,
      platform: Platform.OS,
      routeIds: normalizedRouteIds,
      tagIds: normalizedTagIds,
      url: createPostUrl,
      visibility: normalizedVisibility,
    });
    throw new Error(getConnectionErrorMessage(createPostUrl, error));
  }

  const responseBody = await parseResponseBody(response);

  if (!response.ok) {
    console.warn("[posts] create post rejected", {
      body: summarizeBody(responseBody),
      filesCount: files.length,
      hotspotIds: normalizedHotspotIds,
      routeIds: normalizedRouteIds,
      status: response.status,
      tagIds: normalizedTagIds,
      url: createPostUrl,
      visibility: normalizedVisibility,
    });
    throw new Error(getErrorMessage(responseBody, response.status));
  }

  const parsedResponse = parseCreatedPostResponse(responseBody);

  if (!parsedResponse) {
    console.warn("[posts] create post invalid payload", {
      body: summarizeBody(responseBody),
      filesCount: files.length,
      hotspotIds: normalizedHotspotIds,
      routeIds: normalizedRouteIds,
      tagIds: normalizedTagIds,
      url: createPostUrl,
      visibility: normalizedVisibility,
    });
    throw new Error("API bài viết trả về dữ liệu không đúng định dạng.");
  }

  return parsedResponse;
}
