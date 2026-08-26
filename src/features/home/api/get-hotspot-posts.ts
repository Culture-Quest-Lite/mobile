import { Platform } from "react-native";

import { PublicEnv, buildApiUrl } from "@/constants/env";
import type {
  ProfilePost,
  ProfilePostMedia,
  ProfilePostTag,
} from "@/features/profile/types";
import { parseSharedPost } from "@/lib/shared-post";

type GetHotspotPostsRequest = {
  accessToken?: string | null;
  hotspotId: number;
  page?: number;
  size?: number;
  sort?: string[];
  tokenType?: string | null;
};

export type HotspotPostsSortState = {
  empty: boolean;
  sorted: boolean;
  unsorted: boolean;
};

export type HotspotPostsPageable = {
  offset: number;
  pageNumber: number;
  pageSize: number;
  paged: boolean;
  sort: HotspotPostsSortState | null;
  unpaged: boolean;
};

export type HotspotPost = ProfilePost & {
  commentCount: number | null;
  likeCount: number | null;
  postId: number;
  shareCount: number | null;
  userNumericId: number;
};

export type HotspotPostsPage = {
  content: HotspotPost[];
  empty: boolean;
  first: boolean;
  isLast: boolean;
  last: boolean;
  number: number;
  numberOfElements: number;
  page: number;
  pageable: HotspotPostsPageable | null;
  size: number;
  sort: HotspotPostsSortState | null;
};

function resolveHotspotPostsUrl(hotspotId: number, query: URLSearchParams) {
  const normalizedPath = `/api/posts/hotspot/${hotspotId}?${query.toString()}`;

  if (PublicEnv.apiBaseUrl.trim()) {
    return buildApiUrl(normalizedPath);
  }

  return `https://api.culturequestlite.com${normalizedPath}`;
}

function buildPostsQuery({
  page = 0,
  size = 10,
  sort = ["createdAt,DESC"],
}: Pick<GetHotspotPostsRequest, "page" | "size" | "sort">) {
  const query = new URLSearchParams({
    page: `${page}`,
    size: `${size}`,
  });

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

function parseSortState(value: unknown): HotspotPostsSortState | null {
  if (!isObject(value)) {
    return null;
  }

  return {
    empty: readBoolean(value.empty),
    sorted: readBoolean(value.sorted),
    unsorted: readBoolean(value.unsorted),
  };
}

function parsePageable(value: unknown): HotspotPostsPageable | null {
  if (!isObject(value)) {
    return null;
  }

  return {
    offset: readNumber(value.offset) ?? 0,
    pageNumber: readNumber(value.pageNumber) ?? 0,
    pageSize: readNumber(value.pageSize) ?? 0,
    paged: readBoolean(value.paged),
    sort: parseSortState(value.sort),
    unpaged: readBoolean(value.unpaged),
  };
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

function parsePost(value: unknown): HotspotPost | null {
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
    id: `${postId}`,
    postId,
    userId: `${userId}`,
    userNumericId: userId,
    username: readString(value.username),
    displayName: readString(value.displayName),
    text: readString(value.content),
    image: firstImage?.url ?? null,
    visibility: readString(value.visibility),
    status: readString(value.status),
    reason: isNullableString(value.reason) ? value.reason : null,
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
    isLiked: readBoolean(value.isLiked),
    pointRemaining: readNumber(value.pointRemaining),
    likeCount: readNullableNumber(value.likeCount),
    commentCount: readNullableNumber(value.commentCount),
    shareCount: readNullableNumber(value.shareCount),
    sharedPost: parseSharedPost(value.sharedPost),
  };
}

function parsePostsResponse(value: unknown): HotspotPostsPage | null {
  if (!isObject(value) || !Array.isArray(value.content)) {
    return null;
  }

  const posts = value.content.map(parsePost).filter(isNonNull);

  if (posts.length !== value.content.length) {
    return null;
  }

  return {
    content: posts,
    empty: readBoolean(value.empty),
    first: readBoolean(value.first),
    isLast: readBoolean(value.last),
    last: readBoolean(value.last),
    number: readNumber(value.number) ?? 0,
    numberOfElements: readNumber(value.numberOfElements) ?? posts.length,
    page: readNumber(value.number) ?? 0,
    pageable: parsePageable(value.pageable),
    size: readNumber(value.size) ?? posts.length,
    sort: parseSortState(value.sort),
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

function getErrorMessage(body: unknown, hotspotId: number, status: number) {
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

  return `Không thể tải bài viết của hotspot #${hotspotId} (${status}).`;
}

function getConnectionErrorMessage(url: string) {
  if (Platform.OS === "android" && url.startsWith("http://")) {
    return "Android đang chặn kết nối HTTP tới API. Hãy dùng HTTPS hoặc rebuild Android dev client sau khi bật cleartext traffic.";
  }

  return "Không thể kết nối đến máy chủ bài viết.";
}

export async function getHotspotPosts({
  accessToken,
  hotspotId,
  page = 0,
  size = 10,
  sort,
  tokenType,
}: GetHotspotPostsRequest): Promise<HotspotPostsPage> {
  const hotspotPostsUrl = resolveHotspotPostsUrl(
    hotspotId,
    buildPostsQuery({ page, size, sort }),
  );
  let response: Response;

  try {
    response = await fetch(hotspotPostsUrl, {
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
    console.warn("[hotspot-posts] get posts network failure", {
      error: serializeError(error),
      hotspotId,
      platform: Platform.OS,
      url: hotspotPostsUrl,
    });
    throw new Error(getConnectionErrorMessage(hotspotPostsUrl));
  }

  const responseBody = await parseResponseBody(response);

  if (!response.ok) {
    console.warn("[hotspot-posts] get posts rejected", {
      body: summarizeBody(responseBody),
      hotspotId,
      status: response.status,
      url: hotspotPostsUrl,
    });
    throw new Error(getErrorMessage(responseBody, hotspotId, response.status));
  }

  const parsedResponse = parsePostsResponse(responseBody);

  if (!parsedResponse) {
    console.warn("[hotspot-posts] get posts invalid payload", {
      body: summarizeBody(responseBody),
      hotspotId,
      url: hotspotPostsUrl,
    });
    throw new Error("API bài viết hotspot trả về dữ liệu không đúng định dạng.");
  }

  return parsedResponse;
}
