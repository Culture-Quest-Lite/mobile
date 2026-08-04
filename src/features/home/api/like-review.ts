import { Platform } from "react-native";

import { PublicEnv, buildApiUrl } from "@/constants/env";

import { parseHotspotReview, type HotspotReview } from "./get-hotspot-reviews";

type LikeReviewRequest = {
  accessToken: string;
  reviewId: number;
  tokenType?: string | null;
};

export type LikeReviewResult = {
  isLiked: boolean | null;
  likeCount: number | null;
  /** Review đầy đủ do API trả về, dùng để đồng bộ lại card. */
  review: HotspotReview | null;
};

function resolveLikeReviewUrl(reviewId: number) {
  const normalizedPath = `/api/v1/reviews/${reviewId}/like`;

  if (PublicEnv.apiBaseUrl.trim()) {
    return buildApiUrl(normalizedPath);
  }

  return `https://api.culturequestlite.com${normalizedPath}`;
}

function isObject(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}

function readNumber(value: unknown) {
  return typeof value === "number" && Number.isFinite(value) ? value : null;
}

function readBoolean(value: unknown) {
  return typeof value === "boolean" ? value : null;
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

/** BE có thể trả thẳng review hoặc bọc trong `data`/`result`. */
function unwrapLikeBody(body: unknown) {
  if (!isObject(body)) {
    return body;
  }

  if (body.reviewId !== undefined) {
    return body;
  }

  for (const key of ["data", "result"]) {
    const candidate = body[key];

    if (isObject(candidate)) {
      return candidate;
    }
  }

  return body;
}

function parseLikeCount(body: unknown) {
  if (!isObject(body)) {
    return null;
  }

  for (const key of ["likeCount", "count", "totalLikes"]) {
    const value = readNumber(body[key]);

    if (value !== null) {
      return Math.max(0, Math.round(value));
    }
  }

  return null;
}

function parseIsLiked(body: unknown) {
  if (!isObject(body)) {
    return null;
  }

  for (const key of ["isLiked", "liked"]) {
    const value = readBoolean(body[key]);

    if (value !== null) {
      return value;
    }
  }

  return null;
}

function getErrorMessage(body: unknown, reviewId: number, status: number) {
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

  if (status === 404) {
    return "Bài đánh giá không còn tồn tại.";
  }

  return `Không thể thả tim bài đánh giá #${reviewId} (HTTP ${status}).`;
}

function getConnectionErrorMessage(url: string) {
  if (Platform.OS === "android" && url.startsWith("http://")) {
    return "Android đang chặn kết nối HTTP tới API. Hãy dùng HTTPS rồi thử lại.";
  }

  return "Không thể kết nối đến máy chủ đánh giá.";
}

export async function likeReview({
  accessToken,
  reviewId,
  tokenType,
}: LikeReviewRequest): Promise<LikeReviewResult> {
  if (!Number.isInteger(reviewId) || reviewId <= 0) {
    throw new Error("Không xác định được bài đánh giá cần thả tim.");
  }

  const likeReviewUrl = resolveLikeReviewUrl(reviewId);
  let response: Response;

  try {
    response = await fetch(likeReviewUrl, {
      headers: {
        Accept: "*/*",
        Authorization: `${tokenType ?? "Bearer"} ${accessToken}`,
        "X-Client-Type": "mobile",
      },
      method: "POST",
    });
  } catch (error) {
    console.warn("[reviews] like review network failure", {
      error: error instanceof Error ? error.message : error,
      platform: Platform.OS,
      reviewId,
      url: likeReviewUrl,
    });
    throw new Error(getConnectionErrorMessage(likeReviewUrl));
  }

  const responseBody = await parseResponseBody(response);

  if (!response.ok) {
    console.warn("[reviews] like review rejected", {
      body: responseBody,
      reviewId,
      status: response.status,
      url: likeReviewUrl,
    });
    throw new Error(getErrorMessage(responseBody, reviewId, response.status));
  }

  const unwrappedBody = unwrapLikeBody(responseBody);
  const review = parseHotspotReview(unwrappedBody);

  return {
    isLiked: review?.isLiked ?? parseIsLiked(unwrappedBody),
    likeCount: review ? review.likeCount : parseLikeCount(unwrappedBody),
    review,
  };
}
