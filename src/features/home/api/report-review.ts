import { PublicEnv, buildApiUrl } from "@/constants/env";

type ReportReviewRequest = {
  accessToken: string;
  comment: string;
  reviewId: number;
  tokenType?: string | null;
};

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
    `/api/v1/reviews/${reviewId}/reports`,
    `/api/v1/reviews/${reviewId}/report`,
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

  return `Không thể gửi báo cáo bài đánh giá #${reviewId} (HTTP ${status}).`;
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
      throw new Error("Không thể kết nối đến hệ thống để gửi báo cáo.");
    }

    const body = await parseResponseBody(response);

    if (response.ok) {
      return {
        comment: isObject(body) ? readText(body.comment) : null,
        createdAt: isObject(body) ? readText(body.createdAt) : null,
        createdDisplayName: isObject(body)
          ? readText(body.createdDisplayName)
          : null,
        createdUserId: isObject(body) ? readNumber(body.createdUserId) : null,
        reviewActionId: isObject(body) ? readNumber(body.reviewActionId) : null,
        reviewId: (isObject(body) ? readNumber(body.reviewId) : null) ?? reviewId,
      };
    }

    if (
      index < reportReviewUrls.length - 1 &&
      shouldRetryWithAlternateUrl(response.status)
    ) {
      continue;
    }

    lastError = new Error(getErrorMessage(body, reviewId, response.status));
    break;
  }

  throw lastError ?? new Error("Không thể gửi báo cáo bài đánh giá.");
}
