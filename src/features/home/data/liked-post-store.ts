import { useSyncExternalStore } from "react";

import { readStoredJson, writeStoredJson } from "@/lib/persistent-json-storage";

const STORAGE_KEY = "liked-posts-by-account";
const listeners = new Set<() => void>();

type LikedPostsByAccount = Record<string, number[]>;

function isObject(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}

function normalizeAccountKey(accountKey?: string | null) {
  return accountKey?.trim().toLowerCase() ?? "";
}

function normalizePostId(postId: number) {
  return Number.isFinite(postId) && postId > 0 ? Math.round(postId) : null;
}

function sanitizePostIds(value: unknown) {
  if (!Array.isArray(value)) {
    return [];
  }

  return Array.from(
    new Set(
      value
        .map((item) =>
          typeof item === "number" && Number.isFinite(item) && item > 0
            ? Math.round(item)
            : null,
        )
        .filter((item): item is number => item !== null),
    ),
  ).sort((left, right) => left - right);
}

function loadStoredLikedPosts() {
  const storedValue = readStoredJson<unknown>(STORAGE_KEY, {});

  if (!isObject(storedValue)) {
    return {} satisfies LikedPostsByAccount;
  }

  return Object.fromEntries(
    Object.entries(storedValue)
      .map(([accountKey, postIds]) => [normalizeAccountKey(accountKey), sanitizePostIds(postIds)] as const)
      .filter(([accountKey, postIds]) => accountKey.length > 0 && postIds.length > 0),
  ) satisfies LikedPostsByAccount;
}

let likedPostsByAccount = loadStoredLikedPosts();
let snapshot = likedPostsByAccount;

function emitChange() {
  snapshot = likedPostsByAccount;
  writeStoredJson(STORAGE_KEY, likedPostsByAccount);
  listeners.forEach((listener) => {
    listener();
  });
}

function subscribe(listener: () => void) {
  listeners.add(listener);

  return () => {
    listeners.delete(listener);
  };
}

function getSnapshot() {
  return snapshot;
}

export function useLikedPostIds(accountKey?: string | null) {
  const likedPostsStore = useSyncExternalStore(subscribe, getSnapshot, getSnapshot);
  const normalizedAccountKey = normalizeAccountKey(accountKey);

  return normalizedAccountKey ? (likedPostsStore[normalizedAccountKey] ?? []) : [];
}

export function addLikedPostId(accountKey: string, postId: number) {
  const normalizedAccountKey = normalizeAccountKey(accountKey);
  const normalizedPostId = normalizePostId(postId);

  if (!normalizedAccountKey || normalizedPostId === null) {
    return false;
  }

  const currentPostIds = likedPostsByAccount[normalizedAccountKey] ?? [];

  if (currentPostIds.includes(normalizedPostId)) {
    return false;
  }

  likedPostsByAccount = {
    ...likedPostsByAccount,
    [normalizedAccountKey]: [...currentPostIds, normalizedPostId].sort(
      (left, right) => left - right,
    ),
  };
  emitChange();

  return true;
}

export function removeLikedPostId(accountKey: string, postId: number) {
  const normalizedAccountKey = normalizeAccountKey(accountKey);
  const normalizedPostId = normalizePostId(postId);

  if (!normalizedAccountKey || normalizedPostId === null) {
    return false;
  }

  const currentPostIds = likedPostsByAccount[normalizedAccountKey] ?? [];

  if (!currentPostIds.includes(normalizedPostId)) {
    return false;
  }

  const nextPostIds = currentPostIds.filter((currentPostId) => currentPostId !== normalizedPostId);

  likedPostsByAccount = nextPostIds.length
    ? {
        ...likedPostsByAccount,
        [normalizedAccountKey]: nextPostIds,
      }
    : Object.fromEntries(
        Object.entries(likedPostsByAccount).filter(([key]) => key !== normalizedAccountKey),
      );
  emitChange();

  return true;
}
