import { Platform } from "react-native";

import { PublicEnv, buildApiUrl } from "@/constants/env";

type GetPostCommentsRequest = {
  accessToken?: string | null;
  page?: number;
  postId: number;
  size?: number;
  tokenType?: string | null;
};

export type PostCommentSortState = {
  empty: boolean;
  sorted: boolean;
  unsorted: boolean;
};

export type PostCommentsPageable = {
  offset: number;
  pageNumber: number;
  pageSize: number;
  paged: boolean;
  sort: PostCommentSortState | null;
  unpaged: boolean;
};

export type PostComment = {
  comment: string;
  commentCount: number | null;
  createdAt: string;
  displayName: string;
  isLiked: boolean;
  likeCount: number | null;
  parentActionId: number | null;
  postActionId: number;
  postId: number;
  replyCount: number | null;
  shareCount: number | null;
  userId: number;
  username: string;
};

export type PostCommentsPage = {
  content: PostComment[];
  empty: boolean;
  first: boolean;
  isLast: boolean;
  last: boolean;
  number: number;
  numberOfElements: number;
  page: number;
  pageable: PostCommentsPageable | null;
  size: number;
  sort: PostCommentSortState | null;
};

function resolvePostCommentsUrl(postId: number, query: URLSearchParams) {
  const normalizedPath = `/api/posts/${postId}/comments?${query.toString()}`;

  if (PublicEnv.apiBaseUrl.trim()) {
    return buildApiUrl(normalizedPath);
  }

  return `http://3.113.215.65:8080${normalizedPath}`;
}

function buildPostCommentsQuery({
  page = 0,
  size = 10,
}: Pick<GetPostCommentsRequest, "page" | "size">) {
  return new URLSearchParams({
    page: `${page}`,
    size: `${size}`,
  });
}

function isObject(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}

function readBoolean(value: unknown) {
  return typeof value === "boolean" ? value : false;
}

function readNumber(value: unknown) {
  return typeof value === "number" && Number.isFinite(value) ? value : null;
}

function readNullableNumber(value: unknown) {
  return value === null ? null : readNumber(value);
}

function readString(value: unknown) {
  return typeof value === "string" ? value : "";
}

function isNonNull<T>(value: T | null): value is T {
  return value !== null;
}

function parseSortState(value: unknown): PostCommentSortState | null {
  if (!isObject(value)) {
    return null;
  }

  return {
    empty: readBoolean(value.empty),
    sorted: readBoolean(value.sorted),
    unsorted: readBoolean(value.unsorted),
  };
}

function parsePageable(value: unknown): PostCommentsPageable | null {
  if (!isObject(value)) {
    return null;
  }

  return {
    offset: readNumber(value.offset) ?? 0,
    pageNumber: readNumber(value.pageNumber) ?? 0,
    pageSize: readNumber(value.pageSize) ?? 0,
    paged: readBoolean(value.paged),
    sort: parseSortState(value.sort),
    unpaged: readBoolean(value.unpaged),
  };
}

function parseComment(value: unknown): PostComment | null {
  return parseCommentEntry(value, null);
}

function parseCommentEntry(
  value: unknown,
  parentActionId: number | null,
): PostComment | null {
  if (!isObject(value)) {
    return null;
  }

  const postActionId = readNumber(value.postActionId);
  const postId = readNumber(value.postId);
  const userId = readNumber(value.userId);
  const createdAt = readString(value.createdAt);

  if (
    postActionId === null ||
    postId === null ||
    userId === null ||
    !createdAt
  ) {
    return null;
  }

  const replyEntries = Array.isArray(value.replies)
    ? value.replies
        .map((reply) => parseCommentEntry(reply, postActionId))
        .filter(isNonNull)
    : [];

  if (Array.isArray(value.replies) && replyEntries.length !== value.replies.length) {
    return null;
  }

  return {
    comment: readString(value.comment),
    commentCount: readNullableNumber(value.commentCount),
    createdAt,
    displayName: readString(value.displayName),
    isLiked: readBoolean(value.isLiked),
    likeCount: readNullableNumber(value.likeCount),
    parentActionId: readNullableNumber(value.parentActionId) ?? parentActionId,
    postActionId,
    postId,
    replyCount: readNullableNumber(value.replyCount) ?? replyEntries.length,
    shareCount: readNullableNumber(value.shareCount),
    userId,
    username: readString(value.username),
  };
}

function flattenCommentReplies(
  comment: PostComment,
  nestedSource: unknown,
): PostComment[] {
  if (!isObject(nestedSource) || !Array.isArray(nestedSource.replies)) {
    return [comment];
  }

  const flattenedReplies: PostComment[] = nestedSource.replies.flatMap((reply) => {
    const parsedReply = parseCommentEntry(reply, comment.postActionId);

    if (!parsedReply) {
      return [];
    }

    return flattenCommentReplies(parsedReply, reply);
  });

  return [comment, ...flattenedReplies];
}

function parseCommentsResponse(value: unknown): PostCommentsPage | null {
  if (!isObject(value) || !Array.isArray(value.content)) {
    return null;
  }

  const parsedCommentTrees = value.content.map((entry) => {
    const parsedComment = parseComment(entry);

    if (!parsedComment) {
      return null;
    }

    return flattenCommentReplies(parsedComment, entry);
  });

  if (parsedCommentTrees.some((entry) => entry === null)) {
    return null;
  }

  const comments = parsedCommentTrees.flatMap((entry) => entry ?? []);

  return {
    content: comments,
    empty: readBoolean(value.empty),
    first: readBoolean(value.first),
    isLast: readBoolean(value.last),
    last: readBoolean(value.last),
    number: readNumber(value.number) ?? 0,
    numberOfElements: readNumber(value.numberOfElements) ?? comments.length,
    page: readNumber(value.number) ?? 0,
    pageable: parsePageable(value.pageable),
    size: readNumber(value.size) ?? comments.length,
    sort: parseSortState(value.sort),
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

  return {
    value: error,
  };
}

function summarizeBody(body: unknown) {
  if (typeof body === "string") {
    return body.slice(0, 300);
  }

  if (isObject(body) || Array.isArray(body)) {
    return body;
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

  if (status === 401 || status === 403) {
    return "Phiên đăng nhập không hợp lệ. Vui lòng đăng nhập lại.";
  }

  return `Không thể tải bình luận bài viết #${postId} (${status}).`;
}

function getConnectionErrorMessage(url: string) {
  if (Platform.OS === "android" && url.startsWith("http://")) {
    return "Android đang chặn kết nối HTTP tới API. Hãy dùng HTTPS hoặc rebuild Android dev client sau khi bật cleartext traffic.";
  }

  return "Không thể kết nối đến máy chủ bình luận.";
}

export async function getPostComments({
  accessToken,
  page = 0,
  postId,
  size = 10,
  tokenType,
}: GetPostCommentsRequest): Promise<PostCommentsPage> {
  const postCommentsUrl = resolvePostCommentsUrl(
    postId,
    buildPostCommentsQuery({ page, size }),
  );
  let response: Response;

  try {
    response = await fetch(postCommentsUrl, {
      headers: {
        Accept: "application/json",
        ...(accessToken
          ? { Authorization: `${tokenType ?? "Bearer"} ${accessToken}` }
          : {}),
        "Content-Type": "application/json",
        "X-Client-Type": "mobile",
      },
      method: "GET",
    });
  } catch (error) {
    console.warn("[post-comments] get comments network failure", {
      error: serializeError(error),
      platform: Platform.OS,
      postId,
      url: postCommentsUrl,
    });
    throw new Error(getConnectionErrorMessage(postCommentsUrl));
  }

  const responseBody = await parseResponseBody(response);

  if (!response.ok) {
    console.warn("[post-comments] get comments rejected", {
      body: summarizeBody(responseBody),
      postId,
      status: response.status,
      url: postCommentsUrl,
    });
    throw new Error(getErrorMessage(responseBody, postId, response.status));
  }

  const parsedResponse = parseCommentsResponse(responseBody);

  if (!parsedResponse) {
    console.warn("[post-comments] get comments invalid payload", {
      body: summarizeBody(responseBody),
      postId,
      url: postCommentsUrl,
    });
    throw new Error("API bình luận bài viết trả về dữ liệu không đúng định dạng.");
  }

  return parsedResponse;
}
