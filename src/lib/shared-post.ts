import type {
  ProfilePostMedia,
  ProfilePostTag,
} from "@/features/profile/types";

/**
 * Bài viết gốc được nhúng trong một bài chia sẻ (`sharedPost` của API bài viết).
 * API trả về nguyên object bài gốc chứ không phải chuỗi nội dung.
 */
export type SharedPostSummary = {
  commentCount: number | null;
  content: string;
  createdAt: string | null;
  displayName: string;
  hotspotIds: number[];
  isLiked: boolean;
  isTaggedHotspot: boolean;
  isTaggedRoute: boolean;
  likeCount: number | null;
  medias: ProfilePostMedia[];
  pointRemaining: number | null;
  postId: number;
  routeIds: number[];
  shareCount: number | null;
  status: string;
  tags: ProfilePostTag[];
  userId: string;
  username: string;
  visibility: string;
};

function isObject(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
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

function readBoolean(value: unknown) {
  return typeof value === "boolean" ? value : false;
}

function isNonNull<T>(value: T | null): value is T {
  return value !== null;
}

function parseSharedPostTag(value: unknown): ProfilePostTag | null {
  if (!isObject(value)) {
    return null;
  }

  const tagId = readNumber(value.tagId);

  if (tagId === null) {
    return null;
  }

  return {
    id: tagId,
    name: readString(value.tagName),
  };
}

function parseSharedPostMedia(value: unknown): ProfilePostMedia | null {
  if (!isObject(value)) {
    return null;
  }

  const mediaId = readNumber(value.mediaId);

  if (mediaId === null) {
    return null;
  }

  return {
    id: mediaId,
    type: readString(value.mediaType),
    mimeType: readString(value.mimeType),
    url: readString(value.fileUrl),
    fileName: readString(value.fileName),
    fileSize: readNumber(value.fileSize),
    displayOrder: readNumber(value.displayOrder),
    createdAt: typeof value.createdAt === "string" ? value.createdAt : null,
    updatedAt: typeof value.updatedAt === "string" ? value.updatedAt : null,
  };
}

function sortSharedPostMedias(left: ProfilePostMedia, right: ProfilePostMedia) {
  const leftOrder = left.displayOrder ?? Number.MAX_SAFE_INTEGER;
  const rightOrder = right.displayOrder ?? Number.MAX_SAFE_INTEGER;

  if (leftOrder !== rightOrder) {
    return leftOrder - rightOrder;
  }

  return left.id - right.id;
}

export function parseSharedPost(value: unknown): SharedPostSummary | null {
  if (!isObject(value)) {
    return null;
  }

  const postId = readNumber(value.postId);
  const userId = readNumber(value.userId);

  if (postId === null || userId === null) {
    return null;
  }

  const medias = (
    Array.isArray(value.medias)
      ? value.medias.map(parseSharedPostMedia).filter(isNonNull)
      : []
  ).sort(sortSharedPostMedias);

  return {
    commentCount: readNullableNumber(value.commentCount),
    content: readString(value.content),
    createdAt: typeof value.createdAt === "string" ? value.createdAt : null,
    displayName: readString(value.displayName),
    hotspotIds: Array.isArray(value.hotspotIds)
      ? value.hotspotIds.map(readNumber).filter(isNonNull)
      : [],
    isLiked: readBoolean(value.isLiked),
    isTaggedHotspot: readBoolean(value.isTaggedHotspot),
    isTaggedRoute: readBoolean(value.isTaggedRoute),
    likeCount: readNullableNumber(value.likeCount),
    medias,
    pointRemaining: readNullableNumber(value.pointRemaining),
    postId,
    routeIds: Array.isArray(value.routeIds)
      ? value.routeIds.map(readNumber).filter(isNonNull)
      : [],
    shareCount: readNullableNumber(value.shareCount),
    status: readString(value.status),
    tags: Array.isArray(value.tags)
      ? value.tags.map(parseSharedPostTag).filter(isNonNull)
      : [],
    userId: `${userId}`,
    username: readString(value.username),
    visibility: readString(value.visibility),
  };
}
