import { PublicEnv, buildApiUrl } from "@/constants/env";

type LikePostRequest = {
  accessToken: string;
  postId: number;
  tokenType?: string | null;
};

export type LikePostResult = {
  isLiked: boolean | null;
  likeCount: number | null;
};

function resolveLikePostUrl(postId: number) {
  const normalizedPath = `/api/posts/${postId}/like`;

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

function getErrorMessage(body: unknown, postId: number, status: number) {
  if (isObject(body)) {
    for (const key of ["message", "error", "detail", "title"]) {
      const candidate = body[key];

      if (typeof candidate === "string" && candidate.trim()) {
        return candidate.trim();
      }
    }
  }

  return `Không thể thả tim bài viết #${postId} (HTTP ${status}).`;
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

export async function likePost({
  accessToken,
  postId,
  tokenType,
}: LikePostRequest): Promise<LikePostResult> {
  const likePostUrl = resolveLikePostUrl(postId);
  let response: Response;

  try {
    response = await fetch(likePostUrl, {
      method: "POST",
      headers: {
        Authorization: `${tokenType ?? "Bearer"} ${accessToken}`,
      },
    });
  } catch {
    throw new Error("Không thể kết nối đến hệ thống để thả tim bài viết.");
  }

  const body = await parseResponseBody(response);

  if (!response.ok) {
    throw new Error(getErrorMessage(body, postId, response.status));
  }

  return {
    isLiked: parseIsLiked(body),
    likeCount: parseLikeCount(body),
  };
}
