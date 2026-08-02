import { Platform } from "react-native";

import { PublicEnv, buildApiUrl } from "@/constants/env";

import type { ReviewTargetType } from "./create-review";

export type HotspotReviewsSortDirection = "asc" | "desc";

type GetHotspotReviewsRequest = {
  accessToken?: string | null;
  page?: number;
  size?: number;
  sortBy?: string;
  sortDir?: HotspotReviewsSortDirection;
  status?: string | null;
  targetId: number;
  targetType?: ReviewTargetType;
  tokenType?: string | null;
};

/** Chỉ giữ các field mà UI "Xếp hạng và đánh giá" thực sự cần. */
export type HotspotReviewMedia = {
  createdAt: string | null;
  displayOrder: number | null;
  fileName: string;
  fileSize: number | null;
  mediaId: number;
  mediaType: string;
  mimeType: string;
  updatedAt: string | null;
  url: string;
};

export type HotspotReview = {
  avatarUrl: string;
  comment: string;
  createdAt: string;
  displayName: string;
  isOwner: boolean;
  medias: HotspotReviewMedia[];
  rating: number;
  reviewId: number;
  status: string;
  targetId: number;
  targetType: string;
  updatedAt: string | null;
  userId: number;
  username: string;
};

export type HotspotReviewsPage = {
  content: HotspotReview[];
  number: number;
  size: number;
  totalElements: number;
  totalPages: number;
};

export const defaultHotspotReviewsSortBy = "createdAt";
export const defaultHotspotReviewsSortDir: HotspotReviewsSortDirection = "desc";

function resolveHotspotReviewsUrl(query: URLSearchParams) {
  const normalizedPath = `/api/v1/reviews?${query.toString()}`;

  if (PublicEnv.apiBaseUrl.trim()) {
    return buildApiUrl(normalizedPath);
  }

  return `https://api.culturequestlite.com${normalizedPath}`;
}

function buildReviewsQuery({
  page,
  size,
  sortBy,
  sortDir,
  status,
  targetId,
  targetType,
}: {
  page: number;
  size: number;
  sortBy: string;
  sortDir: HotspotReviewsSortDirection;
  status: string | null;
  targetId: number;
  targetType: ReviewTargetType;
}) {
  const query = new URLSearchParams({
    page: `${page}`,
    size: `${size}`,
    sortBy,
    sortDir,
    targetId: `${targetId}`,
    targetType,
  });

  if (status) {
    query.set("status", status);
  }

  return query;
}

function isObject(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
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

function readNullableString(value: unknown) {
  return typeof value === "string" ? value : null;
}

function readBoolean(value: unknown) {
  return typeof value === "boolean" ? value : false;
}

function isNonNull<T>(value: T | null): value is T {
  return value !== null;
}

function parseReviewMedia(value: unknown): HotspotReviewMedia | null {
  if (!isObject(value)) {
    return null;
  }

  const mediaId = readNumber(value.mediaId);
  const url = readString(value.fileUrl).trim();

  if (mediaId === null || !url) {
    return null;
  }

  return {
    createdAt: readNullableString(value.createdAt),
    displayOrder: readNullableNumber(value.displayOrder),
    fileName: readString(value.fileName),
    fileSize: readNullableNumber(value.fileSize),
    mediaId,
    mediaType: readString(value.mediaType),
    mimeType: readString(value.mimeType),
    updatedAt: readNullableString(value.updatedAt),
    url,
  };
}

function parseReview(value: unknown): HotspotReview | null {
  if (!isObject(value)) {
    return null;
  }

  const reviewId = readNumber(value.reviewId);

  if (reviewId === null) {
    return null;
  }

  const medias = (
    Array.isArray(value.medias)
      ? value.medias.map(parseReviewMedia).filter(isNonNull)
      : []
  ).sort((left, right) => {
    const leftOrder = left.displayOrder ?? Number.MAX_SAFE_INTEGER;
    const rightOrder = right.displayOrder ?? Number.MAX_SAFE_INTEGER;

    if (leftOrder !== rightOrder) {
      return leftOrder - rightOrder;
    }

    return left.mediaId - right.mediaId;
  });

  return {
    avatarUrl: readString(value.avatarUrl),
    comment: readString(value.comment),
    createdAt: readString(value.createdAt),
    displayName: readString(value.displayName),
    isOwner: readBoolean(value.isOwner),
    medias,
    rating: readNumber(value.rating) ?? 0,
    reviewId,
    status: readString(value.status),
    targetId: readNumber(value.targetId) ?? 0,
    targetType: readString(value.targetType),
    updatedAt: readNullableString(value.updatedAt),
    userId: readNumber(value.userId) ?? 0,
    username: readString(value.username),
  };
}

/** BE có thể trả thẳng page hoặc bọc trong `data`/`result`. */
function unwrapReviewsBody(value: unknown) {
  if (!isObject(value)) {
    return value;
  }

  if (Array.isArray(value.content)) {
    return value;
  }

  for (const key of ["data", "result"]) {
    const candidate = value[key];

    if (isObject(candidate) && Array.isArray(candidate.content)) {
      return candidate;
    }
  }

  return value;
}

function parseReviewsResponse(value: unknown): HotspotReviewsPage | null {
  const unwrappedValue = unwrapReviewsBody(value);

  if (!isObject(unwrappedValue) || !Array.isArray(unwrappedValue.content)) {
    return null;
  }

  const reviews = unwrappedValue.content.map(parseReview).filter(isNonNull);
  // Response mới dùng `page: { size, number, totalElements, totalPages }`,
  // response Spring cũ để phẳng các field này ở ngoài.
  const pageMetadata = isObject(unwrappedValue.page)
    ? unwrappedValue.page
    : unwrappedValue;

  return {
    content: reviews,
    number: readNumber(pageMetadata.number) ?? 0,
    size: readNumber(pageMetadata.size) ?? reviews.length,
    totalElements: readNumber(pageMetadata.totalElements) ?? reviews.length,
    totalPages: readNumber(pageMetadata.totalPages) ?? 1,
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

function getErrorMessage(body: unknown, targetId: number, status: number) {
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

  return `Không thể tải đánh giá của hotspot #${targetId} (${status}).`;
}

function getConnectionErrorMessage(url: string) {
  if (Platform.OS === "android" && url.startsWith("http://")) {
    return "Android đang chặn kết nối HTTP tới API. Hãy dùng HTTPS hoặc rebuild Android dev client sau khi bật cleartext traffic.";
  }

  return "Không thể kết nối đến máy chủ đánh giá.";
}

export function getReviewCreatedAtTime(review: Pick<HotspotReview, "createdAt">) {
  const parsedTime = new Date(review.createdAt).getTime();

  return Number.isNaN(parsedTime) ? 0 : parsedTime;
}

/** Sắp xếp mới nhất lên đầu, phòng khi BE bỏ qua `sortBy`/`sortDir`. */
export function sortHotspotReviewsByNewest(reviews: HotspotReview[]) {
  return [...reviews].sort((left, right) => {
    const createdAtDelta =
      getReviewCreatedAtTime(right) - getReviewCreatedAtTime(left);

    if (createdAtDelta !== 0) {
      return createdAtDelta;
    }

    return right.reviewId - left.reviewId;
  });
}

export async function getHotspotReviews({
  accessToken,
  page = 0,
  size = 20,
  sortBy = defaultHotspotReviewsSortBy,
  sortDir = defaultHotspotReviewsSortDir,
  status = "ACTIVE",
  targetId,
  targetType = "HOTSPOT",
  tokenType,
}: GetHotspotReviewsRequest): Promise<HotspotReviewsPage> {
  const hotspotReviewsUrl = resolveHotspotReviewsUrl(
    buildReviewsQuery({ page, size, sortBy, sortDir, status, targetId, targetType }),
  );
  let response: Response;

  try {
    response = await fetch(hotspotReviewsUrl, {
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
    console.warn("[hotspot-reviews] get reviews network failure", {
      error: serializeError(error),
      platform: Platform.OS,
      targetId,
      url: hotspotReviewsUrl,
    });
    throw new Error(getConnectionErrorMessage(hotspotReviewsUrl));
  }

  const responseBody = await parseResponseBody(response);

  if (!response.ok) {
    console.warn("[hotspot-reviews] get reviews rejected", {
      body: summarizeBody(responseBody),
      status: response.status,
      targetId,
      url: hotspotReviewsUrl,
    });
    throw new Error(getErrorMessage(responseBody, targetId, response.status));
  }

  const parsedResponse = parseReviewsResponse(responseBody);

  if (!parsedResponse) {
    console.warn("[hotspot-reviews] get reviews invalid payload", {
      body: summarizeBody(responseBody),
      targetId,
      url: hotspotReviewsUrl,
    });
    throw new Error("API đánh giá hotspot trả về dữ liệu không đúng định dạng.");
  }

  return {
    ...parsedResponse,
    content: sortHotspotReviewsByNewest(parsedResponse.content),
  };
}
