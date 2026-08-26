import { PublicEnv, buildApiUrl } from "@/constants/env";

type DeletePostRequest = {
  accessToken: string;
  postId: number;
  tokenType?: string | null;
};

function resolveDeletePostUrl(postId: number) {
  const normalizedPath = `/api/posts/${postId}`;

  if (PublicEnv.apiBaseUrl.trim()) {
    return buildApiUrl(normalizedPath);
  }

  return `https://api.culturequestlite.com${normalizedPath}`;
}

function isObject(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
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

  return `Không thể chuyển bài viết #${postId} vào thùng rác (HTTP ${status}).`;
}

export async function deletePost({
  accessToken,
  postId,
  tokenType,
}: DeletePostRequest): Promise<void> {
  const deletePostUrl = resolveDeletePostUrl(postId);
  let response: Response;

  try {
    response = await fetch(deletePostUrl, {
      headers: {
        Accept: "application/json",
        Authorization: `${tokenType ?? "Bearer"} ${accessToken}`,
        "X-Client-Type": "mobile",
      },
      method: "DELETE",
    });
  } catch {
    throw new Error("Không thể kết nối đến hệ thống để chuyển bài viết vào thùng rác.");
  }

  const body = await parseResponseBody(response);

  if (!response.ok) {
    throw new Error(getErrorMessage(body, postId, response.status));
  }
}
