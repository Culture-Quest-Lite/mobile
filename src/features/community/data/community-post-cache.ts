import type { ImageSourcePropType } from "react-native";

import type { CommunityPost } from "./community-demo";

export type CommunityFeedMediaItem = {
  key: string;
  source: ImageSourcePropType;
};

export type CommunityFeedPost = Omit<CommunityPost, "image"> & {
  canComment?: boolean;
  canLike?: boolean;
  canOpenProfile?: boolean;
  commentCountValue?: number | null;
  hotspotIds?: number[];
  image?: ImageSourcePropType | null;
  isLiked?: boolean;
  likeCountValue?: number | null;
  mediaItems?: CommunityFeedMediaItem[];
  postNumericId?: number | null;
  replies?: string;
  replyCountValue?: number | null;
  shareCountValue?: number | null;
};

export type CachedCommunityPostEntry = {
  post: CommunityFeedPost;
  postId: number;
  updatedAt: number;
};

const postsById = new Map<number, CachedCommunityPostEntry>();

function normalizePostId(postId?: number | null) {
  return typeof postId === "number" && Number.isInteger(postId) && postId > 0
    ? postId
    : null;
}

export function cacheCommunityPost(post: CommunityFeedPost) {
  const resolvedPostId = normalizePostId(post.postNumericId);

  if (resolvedPostId === null) {
    return null;
  }

  const cachedEntry: CachedCommunityPostEntry = {
    post,
    postId: resolvedPostId,
    updatedAt: Date.now(),
  };

  postsById.set(resolvedPostId, cachedEntry);

  return cachedEntry;
}

export function getCachedCommunityPost(postId?: number | null) {
  const resolvedPostId = normalizePostId(postId);

  if (resolvedPostId === null) {
    return null;
  }

  return postsById.get(resolvedPostId) ?? null;
}

export function getCachedCommunityPosts() {
  return Array.from(postsById.values());
}

export function updateCachedCommunityPost(
  postId: number,
  updater: (post: CommunityFeedPost) => CommunityFeedPost,
) {
  const currentEntry = getCachedCommunityPost(postId);

  if (!currentEntry) {
    return null;
  }

  return cacheCommunityPost(updater(currentEntry.post));
}
