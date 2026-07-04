import { Platform } from "react-native";
import { File as ExpoFile } from "expo-file-system";

import { PublicEnv, buildApiUrl } from "@/constants/env";

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
  id: number;
  name: string;
};

export type CreatedPostResponse = {
  content: string;
  createdAt: string;
  displayName: string;
  hotspotIds: number[];
  isTaggedHotspot: boolean;
  isTaggedRoute: boolean;
  medias: CreatedPostMedia[];
  pointRemaining: number | null;
  postId: number;
  reason: string | null;
  routeIds: number[];
  status: string;
  tags: CreatedPostTag[];
  userId: number;
  username: string;
  visibility: string;
};

type CreatePostRequest = {
  accessToken: string;
  content: string;
  files: CreatePostUploadFile[];
  hotspotId: number;
  tokenType?: string | null;
  visibility?: string;
};

function resolveCreatePostUrl() {
  if (PublicEnv.apiBaseUrl.trim()) {
    return buildApiUrl("/api/posts");
  }

  return "http://13.158.40.56:8080/api/posts";
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
    id: tagId,
    name: readString(value.tagName),
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

function parseCreatedPostResponse(value: unknown): CreatedPostResponse | null {
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
    content: readString(value.content),
    createdAt,
    displayName: readString(value.displayName),
    hotspotIds,
    isTaggedHotspot: readBoolean(value.isTaggedHotspot),
    isTaggedRoute: readBoolean(value.isTaggedRoute),
    medias,
    pointRemaining: readNullableNumber(value.pointRemaining),
    postId,
    reason: readNullableString(value.reason),
    routeIds,
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
  hotspotId,
  tokenType,
  visibility = "PUBLIC",
}: CreatePostRequest): Promise<CreatedPostResponse> {
  const createPostUrl = resolveCreatePostUrl();
  const formData = new FormData();
  let response: Response;

  formData.append("content", content.trim());
  formData.append("visibility", visibility);
  formData.append("hotspotIds", `${hotspotId}`);

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
      hotspotId,
      platform: Platform.OS,
      url: createPostUrl,
    });
    throw new Error(getConnectionErrorMessage(createPostUrl, error));
  }

  const responseBody = await parseResponseBody(response);

  if (!response.ok) {
    console.warn("[posts] create post rejected", {
      body: summarizeBody(responseBody),
      filesCount: files.length,
      hotspotId,
      status: response.status,
      url: createPostUrl,
    });
    throw new Error(getErrorMessage(responseBody, response.status));
  }

  const parsedResponse = parseCreatedPostResponse(responseBody);

  if (!parsedResponse) {
    console.warn("[posts] create post invalid payload", {
      body: summarizeBody(responseBody),
      filesCount: files.length,
      hotspotId,
      url: createPostUrl,
    });
    throw new Error("API bài viết trả về dữ liệu không đúng định dạng.");
  }

  return parsedResponse;
}
