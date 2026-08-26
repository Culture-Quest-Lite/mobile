import { PublicEnv, buildApiUrl } from "@/constants/env";

type ReportReviewRequest = {
  accessToken: string;
  comment: string;
  reviewId: number;
  tokenType?: string | null;
};

export type ReportReviewErrorCode =
  | "duplicate"
  | "network"
  | "rejected"
  | "unauthorized";

export class ReportReviewError extends Error {
  body?: unknown;
  code: ReportReviewErrorCode;
  status?: number;

  constructor(
    message: string,
    {
      body,
      code,
      status,
    }: {
      body?: unknown;
      code: ReportReviewErrorCode;
      status?: number;
    },
  ) {
    super(message);
    this.name = "ReportReviewError";
    this.body = body;
    this.code = code;
    this.status = status;
  }
}

export function isDuplicateReportReviewError(
  error: unknown,
): error is ReportReviewError {
  return error instanceof ReportReviewError && error.code === "duplicate";
}

export type ReportReviewResult = {
  comment: string | null;
  createdAt: string | null;
  createdDisplayName: string | null;
  createdUserId: number | null;
  reviewActionId: number | null;
  reviewId: number;
};

function resolveReportReviewUrls(reviewId: number) {
  const normalizedPaths = [
    `/api/v1/reviews/${reviewId}/report`,
    `/api/v1/reviews/${reviewId}/reports`,
  ];

  if (PublicEnv.apiBaseUrl.trim()) {
    return normalizedPaths.map((path) => buildApiUrl(path));
  }

  return normalizedPaths.map((path) => `https://api.culturequestlite.com${path}`);
}

function isObject(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}

function readNumber(value: unknown) {
  return typeof value === "number" && Number.isFinite(value) ? value : null;
}

function readText(value: unknown) {
  return typeof value === "string" && value.trim() ? value.trim() : null;
}

function unwrapReportReviewBody(body: unknown) {
  if (!isObject(body)) {
    return body;
  }

  if (body.reviewId !== undefined || body.reviewActionId !== undefined) {
    return body;
  }

  for (const key of ["data", "result", "payload", "response"]) {
    const candidate = body[key];

    if (isObject(candidate)) {
      return candidate;
    }
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

function getErrorMessage(body: unknown, reviewId: number, status: number) {
  const candidates = [body, unwrapReportReviewBody(body)];

  for (const candidateBody of candidates) {
    if (isObject(candidateBody)) {
      for (const key of ["message", "error", "detail", "title"]) {
        const candidate = candidateBody[key];

        if (typeof candidate === "string" && candidate.trim()) {
          return candidate.trim();
        }
      }
    }

    if (typeof candidateBody === "string" && candidateBody.trim()) {
      return candidateBody.trim();
    }
  }

  return `Không thể gửi báo cáo bài đánh giá #${reviewId} (HTTP ${status}).`;
}

function isDuplicateReportMessage(message: string) {
  const normalizedMessage = message
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase();

  return (
    (normalizedMessage.includes("bao cao") &&
      (normalizedMessage.includes("truoc do") ||
        normalizedMessage.includes("da duoc ban") ||
        normalizedMessage.includes("da gui"))) ||
    normalizedMessage.includes("already reported") ||
    normalizedMessage.includes("already been reported") ||
    normalizedMessage.includes("reported before") ||
    normalizedMessage.includes("duplicate report")
  );
}

function resolveReportReviewErrorCode(
  message: string,
  status: number,
): ReportReviewErrorCode {
  if (status === 409 || isDuplicateReportMessage(message)) {
    return "duplicate";
  }

  if (status === 401 || status === 403) {
    return "unauthorized";
  }

  return "rejected";
}

function shouldRetryWithAlternateUrl(status: number) {
  return status === 404 || status === 405;
}

export async function reportReview({
  accessToken,
  comment,
  reviewId,
  tokenType,
}: ReportReviewRequest): Promise<ReportReviewResult> {
  const reportReviewUrls = resolveReportReviewUrls(reviewId);
  let lastError: Error | null = null;

  for (let index = 0; index < reportReviewUrls.length; index += 1) {
    const reportReviewUrl = reportReviewUrls[index];
    let response: Response;

    try {
      response = await fetch(reportReviewUrl, {
        method: "POST",
        headers: {
          Accept: "application/json",
          Authorization: `${tokenType ?? "Bearer"} ${accessToken}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ comment }),
      });
    } catch {
      throw new ReportReviewError(
        "Không thể kết nối đến hệ thống để gửi báo cáo.",
        { code: "network" },
      );
    }

    const body = await parseResponseBody(response);
    const unwrappedBody = unwrapReportReviewBody(body);

    if (response.ok) {
      return {
        comment: isObject(unwrappedBody) ? readText(unwrappedBody.comment) : null,
        createdAt: isObject(unwrappedBody) ? readText(unwrappedBody.createdAt) : null,
        createdDisplayName: isObject(unwrappedBody)
          ? readText(unwrappedBody.createdDisplayName)
          : null,
        createdUserId: isObject(unwrappedBody)
          ? readNumber(unwrappedBody.createdUserId)
          : null,
        reviewActionId: isObject(unwrappedBody)
          ? readNumber(unwrappedBody.reviewActionId)
          : null,
        reviewId:
          (isObject(unwrappedBody) ? readNumber(unwrappedBody.reviewId) : null) ??
          reviewId,
      };
    }

    if (
      index < reportReviewUrls.length - 1 &&
      shouldRetryWithAlternateUrl(response.status)
    ) {
      continue;
    }

    const message = getErrorMessage(body, reviewId, response.status);
    lastError = new ReportReviewError(message, {
      body,
      code: resolveReportReviewErrorCode(message, response.status),
      status: response.status,
    });
    break;
  }

  throw (
    lastError ??
    new ReportReviewError("Không thể gửi báo cáo bài đánh giá.", {
      code: "rejected",
    })
  );
}
