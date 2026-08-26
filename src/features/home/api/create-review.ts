import { Platform } from "react-native";
import { File as ExpoFile } from "expo-file-system";

import { PublicEnv, buildApiUrl } from "@/constants/env";

export type ReviewTargetType = "HOTSPOT" | "ROUTE";

export type CreateReviewErrorCode =
  | "duplicate"
  | "invalid-payload"
  | "network"
  | "rejected"
  | "unauthorized";

export const minReviewRating = 1;
export const maxReviewRating = 5;

export class CreateReviewError extends Error {
  body?: unknown;
  code: CreateReviewErrorCode;
  status?: number;

  constructor(
    message: string,
    {
      body,
      code,
      status,
    }: {
      body?: unknown;
      code: CreateReviewErrorCode;
      status?: number;
    },
  ) {
    super(message);
    this.name = "CreateReviewError";
    this.body = body;
    this.code = code;
    this.status = status;
  }
}

export function isDuplicateReviewError(
  error: unknown,
): error is CreateReviewError {
  return error instanceof CreateReviewError && error.code === "duplicate";
}

export type CreateReviewUploadFile = {
  fileName: string;
  mimeType: string;
  uri: string;
};

export type CreatedReviewMedia = {
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

export type CreatedReviewResponse = {
  avatarUrl: string;
  comment: string;
  createdAt: string;
  displayName: string;
  isLiked: boolean;
  isOwner: boolean;
  likeCount: number;
  medias: CreatedReviewMedia[];
  rating: number;
  reviewId: number;
  status: string;
  targetId: number;
  targetType: ReviewTargetType | string;
  updatedAt: string | null;
  userId: number;
  username: string;
};

type CreateReviewRequest = {
  accessToken: string;
  comment?: string;
  files?: CreateReviewUploadFile[];
  rating: number;
  targetId: number;
  targetType?: ReviewTargetType;
  tokenType?: string | null;
};

function resolveCreateReviewUrl() {
  if (PublicEnv.apiBaseUrl.trim()) {
    return buildApiUrl("/api/v1/reviews");
  }

  return "https://api.culturequestlite.com/api/v1/reviews";
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
  return typeof value === "string" ? value : null;
}

function isNonNull<T>(value: T | null): value is T {
  return value !== null;
}

function parseCreatedReviewMedia(value: unknown): CreatedReviewMedia | null {
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

function unwrapCreatedReviewBody(value: unknown) {
  if (!isObject(value)) {
    return value;
  }

  if (value.reviewId !== undefined) {
    return value;
  }

  for (const key of ["data", "result"]) {
    const candidate = value[key];

    if (isObject(candidate) && candidate.reviewId !== undefined) {
      return candidate;
    }
  }

  return value;
}

export function parseCreatedReviewResponse(
  value: unknown,
): CreatedReviewResponse | null {
  const unwrappedValue = unwrapCreatedReviewBody(value);

  if (!isObject(unwrappedValue)) {
    return null;
  }

  const reviewId = readNumber(unwrappedValue.reviewId);
  const userId = readNumber(unwrappedValue.userId);

  if (reviewId === null || userId === null) {
    return null;
  }

  const medias = Array.isArray(unwrappedValue.medias)
    ? unwrappedValue.medias.map(parseCreatedReviewMedia).filter(isNonNull)
    : [];

  return {
    avatarUrl: readString(unwrappedValue.avatarUrl),
    comment: readString(unwrappedValue.comment),
    createdAt: readString(unwrappedValue.createdAt),
    displayName: readString(unwrappedValue.displayName),
    isLiked: readBoolean(unwrappedValue.isLiked),
    isOwner: readBoolean(unwrappedValue.isOwner),
    likeCount: Math.max(0, Math.round(readNumber(unwrappedValue.likeCount) ?? 0)),
    medias,
    rating: readNumber(unwrappedValue.rating) ?? 0,
    reviewId,
    status: readString(unwrappedValue.status),
    targetId: readNumber(unwrappedValue.targetId) ?? 0,
    targetType: readString(unwrappedValue.targetType),
    updatedAt: readNullableString(unwrappedValue.updatedAt),
    userId,
    username: readString(unwrappedValue.username),
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

  if (status === 409) {
    return "Bạn đã đánh giá điểm đến này rồi.";
  }

  return `Không thể gửi bài đánh giá (${status}).`;
}

function isAlreadyReviewedMessage(message: string) {
  const normalizedMessage = message.toLowerCase();

  return (
    normalizedMessage.includes("đã đánh giá") ||
    normalizedMessage.includes("da danh gia") ||
    normalizedMessage.includes("already review") ||
    normalizedMessage.includes("duplicate review")
  );
}

function resolveCreateReviewErrorCode(
  message: string,
  status: number,
): CreateReviewErrorCode {
  if (status === 409 || isAlreadyReviewedMessage(message)) {
    return "duplicate";
  }

  if (status === 401 || status === 403) {
    return "unauthorized";
  }

  return "rejected";
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

  return "Không thể kết nối đến máy chủ đánh giá.";
}

export async function createReview({
  accessToken,
  comment,
  files = [],
  rating,
  targetId,
  targetType = "HOTSPOT",
  tokenType,
}: CreateReviewRequest): Promise<CreatedReviewResponse> {
  const createReviewUrl = resolveCreateReviewUrl();
  const normalizedComment = comment?.trim() ?? "";
  const normalizedRating = Math.round(rating);
  const formData = new FormData();
  let response: Response;

  if (!Number.isInteger(targetId) || targetId <= 0) {
    throw new Error("Không xác định được điểm đến để gửi bài đánh giá.");
  }

  if (
    !Number.isFinite(normalizedRating) ||
    normalizedRating < minReviewRating ||
    normalizedRating > maxReviewRating
  ) {
    throw new Error(
      `Số sao đánh giá phải nằm trong khoảng ${minReviewRating}-${maxReviewRating}.`,
    );
  }

  formData.append("targetType", targetType);
  formData.append("targetId", `${targetId}`);
  formData.append("rating", `${normalizedRating}`);

  if (normalizedComment) {
    formData.append("comment", normalizedComment);
  }

  for (const file of files) {
    const uploadFile = new ExpoFile(file.uri);

    formData.append("files", uploadFile, file.fileName);
  }

  try {
    response = await fetch(createReviewUrl, {
      body: formData,
      headers: {
        Accept: "application/json",
        Authorization: `${tokenType ?? "Bearer"} ${accessToken}`,
        "X-Client-Type": "mobile",
      },
      method: "POST",
    });
  } catch (error) {
    console.warn("[reviews] create review network failure", {
      error: serializeError(error),
      filesCount: files.length,
      platform: Platform.OS,
      rating: normalizedRating,
      targetId,
      targetType,
      url: createReviewUrl,
    });
    throw new CreateReviewError(
      getConnectionErrorMessage(createReviewUrl, error),
      { code: "network" },
    );
  }

  const responseBody = await parseResponseBody(response);

  if (!response.ok) {
    console.warn("[reviews] create review rejected", {
      body: summarizeBody(responseBody),
      filesCount: files.length,
      rating: normalizedRating,
      status: response.status,
      targetId,
      targetType,
      url: createReviewUrl,
    });

    const errorMessage = getErrorMessage(responseBody, response.status);

    throw new CreateReviewError(errorMessage, {
      body: responseBody,
      code: resolveCreateReviewErrorCode(errorMessage, response.status),
      status: response.status,
    });
  }

  const parsedResponse = parseCreatedReviewResponse(responseBody);

  if (!parsedResponse) {
    console.warn("[reviews] create review invalid payload", {
      body: summarizeBody(responseBody),
      filesCount: files.length,
      rating: normalizedRating,
      targetId,
      targetType,
      url: createReviewUrl,
    });
    throw new CreateReviewError(
      "API đánh giá trả về dữ liệu không đúng định dạng.",
      { body: responseBody, code: "invalid-payload", status: response.status },
    );
  }

  return parsedResponse;
}
