import { PublicEnv, buildApiUrl } from "@/constants/env";

type DeletePostPermanentRequest = {
  accessToken: string;
  postId: number;
  tokenType?: string | null;
};

function resolveDeletePostPermanentUrl(postId: number) {
  const normalizedPath = `/api/posts/${postId}/permanent`;

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

  return `Không thể xóa vĩnh viễn bài viết #${postId} (HTTP ${status}).`;
}

export async function deletePostPermanent({
  accessToken,
  postId,
  tokenType,
}: DeletePostPermanentRequest): Promise<void> {
  const deletePostUrl = resolveDeletePostPermanentUrl(postId);
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
    throw new Error("Không thể kết nối đến hệ thống để xóa vĩnh viễn bài viết.");
  }

  const body = await parseResponseBody(response);

  if (!response.ok) {
    throw new Error(getErrorMessage(body, postId, response.status));
  }
}
