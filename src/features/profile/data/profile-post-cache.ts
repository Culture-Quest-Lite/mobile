import { useSyncExternalStore } from "react";

import type { ProfilePost, ProfilePostStatus } from "../types";

export type CachedProfilePostEntry = {
  post: ProfilePost;
  postId: number;
  updatedAt: number;
};

type UseCachedProfilePostsOptions = {
  ownerId?: string | null;
  status?: ProfilePostStatus | null;
  username?: string | null;
};

const postsById = new Map<number, CachedProfilePostEntry>();
const listeners = new Set<() => void>();
let snapshot: CachedProfilePostEntry[] = [];

function normalizePostId(postId?: number | string | null) {
  const resolvedPostId =
    typeof postId === "string" ? Number(postId) : postId ?? null;

  return typeof resolvedPostId === "number" &&
    Number.isInteger(resolvedPostId) &&
    Number.isFinite(resolvedPostId) &&
    resolvedPostId > 0
    ? resolvedPostId
    : null;
}

function normalizeProfilePostStatus(value?: string | null): ProfilePostStatus | null {
  const normalizedValue = value?.trim().toUpperCase();

  switch (normalizedValue) {
    case "APPROVED":
    case "PENDING":
    case "REJECTED":
    case "DELETED":
      return normalizedValue;
    default:
      return null;
  }
}

function subscribe(listener: () => void) {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

function getSnapshot() {
  return snapshot;
}

function emit() {
  snapshot = Array.from(postsById.values());
  listeners.forEach((listener) => listener());
}

function resolvePostTimestamp(post: ProfilePost, updatedAt: number) {
  const createdAtTimestamp = Date.parse(post.createdAt ?? "");

  return Number.isFinite(createdAtTimestamp) ? createdAtTimestamp : updatedAt;
}

function compareCachedEntries(
  left: CachedProfilePostEntry,
  right: CachedProfilePostEntry,
) {
  const leftTimestamp = resolvePostTimestamp(left.post, left.updatedAt);
  const rightTimestamp = resolvePostTimestamp(right.post, right.updatedAt);

  if (leftTimestamp !== rightTimestamp) {
    return rightTimestamp - leftTimestamp;
  }

  return right.updatedAt - left.updatedAt;
}

function matchesOwner(
  post: ProfilePost,
  {
    ownerId,
    username,
  }: Pick<UseCachedProfilePostsOptions, "ownerId" | "username">,
) {
  const normalizedOwnerId = ownerId?.trim() ?? "";
  const normalizedUsername = username?.trim().toLowerCase() ?? "";
  const normalizedPostUserId = post.userId.trim();
  const normalizedPostUsername = post.username.trim().toLowerCase();

  return (
    (normalizedOwnerId.length > 0 && normalizedPostUserId === normalizedOwnerId) ||
    (normalizedUsername.length > 0 && normalizedPostUsername === normalizedUsername)
  );
}

function matchesStatus(post: ProfilePost, status?: ProfilePostStatus | null) {
  return status === null || status === undefined
    ? true
    : normalizeProfilePostStatus(post.status) === status;
}

export function cacheProfilePost(post: ProfilePost) {
  const resolvedPostId = normalizePostId(post.id);

  if (resolvedPostId === null) {
    return null;
  }

  const cachedEntry: CachedProfilePostEntry = {
    post,
    postId: resolvedPostId,
    updatedAt: Date.now(),
  };

  postsById.set(resolvedPostId, cachedEntry);
  emit();

  return cachedEntry;
}

export function useCachedProfilePosts(options?: UseCachedProfilePostsOptions) {
  const cachedEntries = useSyncExternalStore(subscribe, getSnapshot, getSnapshot);

  return cachedEntries
    .filter((entry) => matchesOwner(entry.post, options ?? {}))
    .filter((entry) => matchesStatus(entry.post, options?.status ?? null))
    .sort(compareCachedEntries)
    .map((entry) => entry.post);
}
