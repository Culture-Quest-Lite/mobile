import { PublicEnv, buildApiUrl } from "@/constants/env";

type CommentPostRequest = {
  accessToken: string;
  comment: string;
  parentActionId?: number | null;
  postId: number;
  tokenType?: string | null;
};

export type CommentPostResult = {
  commentCount: number | null;
  likeCount: number | null;
  parentActionId: number | null;
  postActionId: number | null;
  replyCount: number | null;
  shareCount: number | null;
};

function resolveCommentPostUrl(postId: number) {
  const normalizedPath = `/api/posts/${postId}/comment`;

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

function readNullableNumber(value: unknown) {
  return value === null ? null : readNumber(value);
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

  return `Không thể bình luận bài viết #${postId} (HTTP ${status}).`;
}

function parseCommentCount(body: unknown) {
  if (!isObject(body)) {
    return null;
  }

  for (const key of ["commentCount", "count", "totalComments"]) {
    const value = readNumber(body[key]);

    if (value !== null) {
      return Math.max(0, Math.round(value));
    }
  }

  return null;
}

function parseCount(body: unknown, keys: readonly string[]) {
  if (!isObject(body)) {
    return null;
  }

  for (const key of keys) {
    const value = readNumber(body[key]);

    if (value !== null) {
      return Math.max(0, Math.round(value));
    }
  }

  return null;
}

export async function commentPost({
  accessToken,
  comment,
  parentActionId,
  postId,
  tokenType,
}: CommentPostRequest): Promise<CommentPostResult> {
  const commentPostUrl = resolveCommentPostUrl(postId);
  let response: Response;

  try {
    response = await fetch(commentPostUrl, {
      method: "POST",
      headers: {
        Accept: "application/json",
        Authorization: `${tokenType ?? "Bearer"} ${accessToken}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        comment,
        ...(typeof parentActionId === "number" && parentActionId > 0
          ? { parentActionId }
          : {}),
      }),
    });
  } catch {
    throw new Error("Không thể kết nối đến hệ thống để gửi bình luận.");
  }

  const body = await parseResponseBody(response);

  if (!response.ok) {
    throw new Error(getErrorMessage(body, postId, response.status));
  }

  return {
    commentCount: parseCommentCount(body),
    likeCount: parseCount(body, ["likeCount", "totalLikes"]),
    parentActionId: isObject(body) ? readNullableNumber(body.parentActionId) : null,
    postActionId: isObject(body) ? readNullableNumber(body.postActionId) : null,
    replyCount: parseCount(body, ["replyCount", "totalReplies"]),
    shareCount: parseCount(body, ["shareCount", "totalShares"]),
  };
}
