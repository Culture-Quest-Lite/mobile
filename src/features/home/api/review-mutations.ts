import { File as ExpoFile } from "expo-file-system";
import { Platform } from "react-native";

import { PublicEnv, buildApiUrl } from "@/constants/env";

import {
  maxReviewRating,
  minReviewRating,
  parseCreatedReviewResponse,
  type CreatedReviewResponse,
  type CreateReviewUploadFile,
} from "./create-review";

type AuthenticatedReviewRequest = {
  accessToken: string;
  reviewId: number;
  tokenType?: string | null;
};

type UpdateReviewRequest = AuthenticatedReviewRequest & {
  comment?: string;
  files?: CreateReviewUploadFile[];
  rating: number;
  removedMediaIds?: number[];
};

function resolveReviewUrl(reviewId: number) {
  const path = `/api/v1/reviews/${reviewId}`;

  if (PublicEnv.apiBaseUrl.trim()) {
    return buildApiUrl(path);
  }

  return `https://api.culturequestlite.com${path}`;
}

function isObject(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}

function validateReviewId(reviewId: number) {
  if (!Number.isInteger(reviewId) || reviewId <= 0) {
    throw new Error("Không xác định được bài đánh giá cần thao tác.");
  }
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

function getErrorMessage(body: unknown, status: number, action: string) {
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
    return "Bạn không có quyền thao tác với bài đánh giá này.";
  }

  if (status === 404) {
    return "Bài đánh giá không còn tồn tại.";
  }

  return `Không thể ${action} bài đánh giá (${status}).`;
}

function getConnectionErrorMessage(url: string) {
  if (Platform.OS === "android" && url.startsWith("http://")) {
    return "Android đang chặn kết nối HTTP tới API. Hãy dùng HTTPS rồi thử lại.";
  }

  return "Không thể kết nối đến máy chủ đánh giá.";
}

export async function updateReview({
  accessToken,
  comment,
  files = [],
  rating,
  removedMediaIds = [],
  reviewId,
  tokenType,
}: UpdateReviewRequest): Promise<CreatedReviewResponse> {
  validateReviewId(reviewId);

  const normalizedRating = Math.round(rating);

  if (
    !Number.isFinite(normalizedRating) ||
    normalizedRating < minReviewRating ||
    normalizedRating > maxReviewRating
  ) {
    throw new Error(
      `Số sao đánh giá phải nằm trong khoảng ${minReviewRating}-${maxReviewRating}.`,
    );
  }

  const reviewUrl = resolveReviewUrl(reviewId);
  const formData = new FormData();
  let response: Response;

  formData.append("rating", `${normalizedRating}`);
  formData.append("comment", comment?.trim() ?? "");

  for (const mediaId of Array.from(new Set(removedMediaIds))) {
    if (Number.isInteger(mediaId) && mediaId > 0) {
      formData.append("removedMediaIds", `${mediaId}`);
    }
  }

  for (const file of files) {
    formData.append("files", new ExpoFile(file.uri), file.fileName);
  }

  try {
    response = await fetch(reviewUrl, {
      body: formData,
      headers: {
        Accept: "application/json",
        Authorization: `${tokenType ?? "Bearer"} ${accessToken}`,
        "X-Client-Type": "mobile",
      },
      method: "PUT",
    });
  } catch (error) {
    console.warn("[reviews] update review network failure", {
      error: error instanceof Error ? error.message : error,
      filesCount: files.length,
      platform: Platform.OS,
      removedMediaCount: removedMediaIds.length,
      reviewId,
      url: reviewUrl,
    });
    throw new Error(getConnectionErrorMessage(reviewUrl));
  }

  const responseBody = await parseResponseBody(response);

  if (!response.ok) {
    console.warn("[reviews] update review rejected", {
      body: responseBody,
      reviewId,
      status: response.status,
      url: reviewUrl,
    });
    throw new Error(
      getErrorMessage(responseBody, response.status, "cập nhật"),
    );
  }

  const parsedResponse = parseCreatedReviewResponse(responseBody);

  if (!parsedResponse) {
    throw new Error("API cập nhật đánh giá trả về dữ liệu không đúng định dạng.");
  }

  return parsedResponse;
}

export async function deleteReview({
  accessToken,
  reviewId,
  tokenType,
}: AuthenticatedReviewRequest): Promise<void> {
  validateReviewId(reviewId);

  const reviewUrl = resolveReviewUrl(reviewId);
  let response: Response;

  try {
    response = await fetch(reviewUrl, {
      headers: {
        Accept: "application/json",
        Authorization: `${tokenType ?? "Bearer"} ${accessToken}`,
        "X-Client-Type": "mobile",
      },
      method: "DELETE",
    });
  } catch (error) {
    console.warn("[reviews] delete review network failure", {
      error: error instanceof Error ? error.message : error,
      platform: Platform.OS,
      reviewId,
      url: reviewUrl,
    });
    throw new Error(getConnectionErrorMessage(reviewUrl));
  }

  const responseBody = await parseResponseBody(response);

  if (!response.ok) {
    console.warn("[reviews] delete review rejected", {
      body: responseBody,
      reviewId,
      status: response.status,
      url: reviewUrl,
    });
    throw new Error(getErrorMessage(responseBody, response.status, "xóa"));
  }
}
