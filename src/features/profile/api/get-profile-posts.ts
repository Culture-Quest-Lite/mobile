import { Platform } from "react-native";

import { PublicEnv, buildApiUrl } from "@/constants/env";

import type {
  ProfilePost,
  ProfilePostMedia,
  ProfilePostStatus,
  ProfilePostTag,
} from "../types";

type FetchProfilePostsRequest = {
  accessToken?: string | null;
  page?: number;
  size?: number;
  status?: ProfilePostStatus | null;
  sort?: string[];
  tokenType?: string | null;
};

type GetMyProfilePostsRequest = FetchProfilePostsRequest & {
  accessToken: string;
};

type GetUserProfilePostsRequest = FetchProfilePostsRequest & {
  userId: number;
};

type ParsedPostsResponse = {
  content: ProfilePost[];
  isLast: boolean;
  size: number;
};

function resolveProfilePostsUrl(path: string, query: URLSearchParams) {
  const normalizedPath = `${path}?${query.toString()}`;

  if (PublicEnv.apiBaseUrl.trim()) {
    return buildApiUrl(normalizedPath);
  }

  return `https://api.culturequestlite.com${normalizedPath}`;
}

function buildPostsQuery({
  page = 0,
  size = 10,
  sort = [],
  status,
}: FetchProfilePostsRequest) {
  const query = new URLSearchParams({
    page: `${page}`,
    size: `${size}`,
  });

  if (typeof status === "string" && status.trim()) {
    query.set("status", status.trim().toUpperCase());
  }

  for (const value of sort) {
    if (value.trim()) {
      query.append("sort", value);
    }
  }

  return query;
}

function isObject(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}

function isNullableString(value: unknown): value is string | null {
  return typeof value === "string" || value === null;
}

function readNumber(value: unknown) {
  return typeof value === "number" && Number.isFinite(value) ? value : null;
}

function readNullableNumber(value: unknown) {
  return value === null ? null : readNumber(value);
}

function readString(value: unknown) {
  return typeof value === "string" ? value : "";
}

function readBoolean(value: unknown) {
  return typeof value === "boolean" ? value : false;
}

function isNonNull<T>(value: T | null): value is T {
  return value !== null;
}

function parsePostTag(value: unknown): ProfilePostTag | null {
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

function parsePostMedia(value: unknown): ProfilePostMedia | null {
  if (!isObject(value)) {
    return null;
  }

  const mediaId = readNumber(value.mediaId);

  if (mediaId === null) {
    return null;
  }

  return {
    id: mediaId,
    type: readString(value.mediaType),
    mimeType: readString(value.mimeType),
    url: readString(value.fileUrl),
    fileName: readString(value.fileName),
    fileSize: readNumber(value.fileSize),
    displayOrder: readNumber(value.displayOrder),
    createdAt: typeof value.createdAt === "string" ? value.createdAt : null,
    updatedAt: typeof value.updatedAt === "string" ? value.updatedAt : null,
  };
}

function parsePost(value: unknown): ProfilePost | null {
  if (!isObject(value)) {
    return null;
  }

  const postId = readNumber(value.postId);
  const userId = readNumber(value.userId);
  const createdAt = readString(value.createdAt);

  if (postId === null || userId === null || !createdAt) {
    return null;
  }

  const medias = Array.isArray(value.medias)
    ? value.medias.map(parsePostMedia).filter(isNonNull)
    : [];
  const tags = Array.isArray(value.tags)
    ? value.tags.map(parsePostTag).filter(isNonNull)
    : [];
  const sortedMedias = [...medias].sort((left, right) => {
    const leftOrder = left.displayOrder ?? Number.MAX_SAFE_INTEGER;
    const rightOrder = right.displayOrder ?? Number.MAX_SAFE_INTEGER;

    if (leftOrder !== rightOrder) {
      return leftOrder - rightOrder;
    }

    return left.id - right.id;
  });
  const firstImage =
    sortedMedias.find((media) => media.type.toUpperCase() === "IMAGE") ??
    sortedMedias[0] ??
    null;

  return {
    commentCount: readNullableNumber(value.commentCount),
    id: `${postId}`,
    userId: `${userId}`,
    username: readString(value.username),
    displayName: readString(value.displayName),
    text: readString(value.content),
    image: firstImage?.url ?? null,
    visibility: readString(value.visibility),
    status: readString(value.status),
    reason: isNullableString(value.reason) ? value.reason : null,
    isLiked: readBoolean(value.isLiked),
    isTaggedHotspot: readBoolean(value.isTaggedHotspot),
    isTaggedRoute: readBoolean(value.isTaggedRoute),
    hotspotIds: Array.isArray(value.hotspotIds)
      ? value.hotspotIds.map(readNumber).filter(isNonNull)
      : [],
    routeIds: Array.isArray(value.routeIds)
      ? value.routeIds.map(readNumber).filter(isNonNull)
      : [],
    tags,
    medias: sortedMedias,
    createdAt,
    likeCount: readNullableNumber(value.likeCount),
    pointRemaining: readNumber(value.pointRemaining),
    shareCount: readNullableNumber(value.shareCount),
    sharedPost: isNullableString(value.sharedPost) ? value.sharedPost : null,
  };
}

function parsePostsResponse(value: unknown): ParsedPostsResponse | null {
  if (!isObject(value) || !Array.isArray(value.content)) {
    return null;
  }

  const posts = value.content.map(parsePost).filter(isNonNull);
  const size = readNumber(value.size) ?? posts.length;

  if (posts.length !== value.content.length) {
    return null;
  }

  return {
    content: posts,
    isLast: readBoolean(value.last),
    size,
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

  return {
    value: error,
  };
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

  return `Không thể tải bài viết (${status}).`;
}

function getConnectionErrorMessage(url: string) {
  if (Platform.OS === "android" && url.startsWith("http://")) {
    return "Android đang chặn kết nối HTTP tới API. Hãy dùng HTTPS hoặc rebuild Android dev client sau khi bật cleartext traffic.";
  }

  return "Không thể kết nối đến máy chủ bài viết.";
}

async function fetchProfilePostsPage({
  accessToken,
  tokenType,
  url,
}: {
  accessToken?: string | null;
  tokenType?: string | null;
  url: string;
}): Promise<ParsedPostsResponse> {
  let response: Response;

  try {
    response = await fetch(url, {
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
    console.warn("[profile] get posts network failure", {
      error: serializeError(error),
      platform: Platform.OS,
      url,
    });
    throw new Error(getConnectionErrorMessage(url));
  }

  const responseBody = await parseResponseBody(response);

  if (!response.ok) {
    console.warn("[profile] get posts rejected", {
      body: summarizeBody(responseBody),
      status: response.status,
      url,
    });
    throw new Error(getErrorMessage(responseBody, response.status));
  }

  const parsedResponse = parsePostsResponse(responseBody);

  if (!parsedResponse) {
    console.warn("[profile] get posts invalid payload", {
      body: summarizeBody(responseBody),
      url,
    });
    throw new Error("API bài viết trả về dữ liệu không đúng định dạng.");
  }

  return parsedResponse;
}

async function getAllProfilePosts({
  accessToken,
  page = 0,
  resolvePageUrl,
  size = 20,
  tokenType,
}: FetchProfilePostsRequest & {
  resolvePageUrl: (nextPage: number) => string;
}): Promise<ProfilePost[]> {
  const posts: ProfilePost[] = [];
  let nextPage = page;

  for (let attempt = 0; attempt < 20; attempt += 1) {
    const response = await fetchProfilePostsPage({
      accessToken,
      tokenType,
      url: resolvePageUrl(nextPage),
    });

    posts.push(...response.content);

    if (
      response.isLast ||
      response.content.length === 0 ||
      response.content.length < (response.size || size)
    ) {
      break;
    }

    nextPage += 1;
  }

  return posts;
}

export async function getMyProfilePosts({
  accessToken,
  page,
  size,
  status,
  sort,
  tokenType,
}: GetMyProfilePostsRequest): Promise<ProfilePost[]> {
  return getAllProfilePosts({
    accessToken,
    page,
    resolvePageUrl: (nextPage) =>
      resolveProfilePostsUrl(
        "/api/posts",
        buildPostsQuery({ page: nextPage, size, sort, status }),
      ),
    size,
    tokenType,
  });
}

export async function getUserProfilePosts({
  accessToken,
  page,
  size,
  sort,
  tokenType,
  userId,
}: GetUserProfilePostsRequest): Promise<ProfilePost[]> {
  return getAllProfilePosts({
    accessToken,
    page,
    resolvePageUrl: (nextPage) =>
      resolveProfilePostsUrl(
        `/api/users/user/${userId}/posts`,
        buildPostsQuery({ page: nextPage, size, sort }),
      ),
    size,
    tokenType,
  });
}
