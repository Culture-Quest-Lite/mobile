import { PublicEnv, buildApiUrl } from "@/constants/env";

type ReportPostRequest = {
  accessToken: string;
  /** Lý do báo cáo. Backend validate @NotBlank nên không được rỗng. */
  comment: string;
  postId: number;
  tokenType?: string | null;
};

/** Khớp `ReportPostResponse` của backend. */
export type ReportPostResult = {
  comment: string | null;
  createdAt: string | null;
  createdDisplayName: string | null;
  createdUserId: number | null;
  postActionId: number | null;
  postId: number;
};

function resolveReportPostUrl(postId: number) {
  const normalizedPath = `/api/posts/${postId}/reports`;

  if (PublicEnv.apiBaseUrl.trim()) {
    return buildApiUrl(normalizedPath);
  }

  return `http://3.113.215.65:8080${normalizedPath}`;
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

function getErrorMessage(body: unknown, postId: number, status: number) {
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

  return `Không thể gửi báo cáo bài viết #${postId} (HTTP ${status}).`;
}

export async function reportPost({
  accessToken,
  comment,
  postId,
  tokenType,
}: ReportPostRequest): Promise<ReportPostResult> {
  const reportPostUrl = resolveReportPostUrl(postId);
  let response: Response;

  try {
    response = await fetch(reportPostUrl, {
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

  if (!response.ok) {
    throw new Error(getErrorMessage(body, postId, response.status));
  }

  return {
    comment: isObject(body) ? readText(body.comment) : null,
    createdAt: isObject(body) ? readText(body.createdAt) : null,
    createdDisplayName: isObject(body) ? readText(body.createdDisplayName) : null,
    createdUserId: isObject(body) ? readNumber(body.createdUserId) : null,
    postActionId: isObject(body) ? readNumber(body.postActionId) : null,
    postId: (isObject(body) ? readNumber(body.postId) : null) ?? postId,
  };
}
