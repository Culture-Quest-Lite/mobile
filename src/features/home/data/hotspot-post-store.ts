import { useSyncExternalStore } from "react";

import { readStoredJson, writeStoredJson } from "@/lib/persistent-json-storage";

export type HotspotPersonalPost = {
  authorAvatarUri: string;
  authorName: string;
  createdAt: string;
  hotspotId: number | null;
  hotspotSlug: string;
  id: string;
  rating: number;
  text: string;
};

type AddHotspotPersonalPostInput = {
  authorAvatarUri?: string | null;
  authorName?: string | null;
  hotspotId?: number | null;
  hotspotSlug: string;
  rating?: number;
  text: string;
};

const STORAGE_KEY = "hotspot-personal-posts";
const listeners = new Set<() => void>();

function isObject(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}

function isNonNull<T>(value: T | null): value is T {
  return value !== null;
}

function readString(value: unknown) {
  return typeof value === "string" ? value.trim() : "";
}

function readNullableNumber(value: unknown) {
  return typeof value === "number" && Number.isFinite(value) ? value : null;
}

function clampRating(value: number) {
  return Math.min(Math.max(Math.round(value), 1), 5);
}

function parseStoredPost(value: unknown): HotspotPersonalPost | null {
  if (!isObject(value)) {
    return null;
  }

  const id = readString(value.id);
  const hotspotSlug = readString(value.hotspotSlug);
  const text = readString(value.text);
  const createdAt = readString(value.createdAt);

  if (!id || !hotspotSlug || !text || !createdAt) {
    return null;
  }

  return {
    authorAvatarUri: readString(value.authorAvatarUri),
    authorName: readString(value.authorName) || "Bạn",
    createdAt,
    hotspotId: readNullableNumber(value.hotspotId),
    hotspotSlug,
    id,
    rating: clampRating(readNullableNumber(value.rating) ?? 5),
    text,
  };
}

function loadStoredPosts() {
  const storedValue = readStoredJson<unknown[]>(STORAGE_KEY, []);

  return Array.isArray(storedValue)
    ? storedValue.map(parseStoredPost).filter(isNonNull)
    : [];
}

let posts: HotspotPersonalPost[] = loadStoredPosts();
let snapshot: HotspotPersonalPost[] = posts;

function emit() {
  snapshot = posts;
  writeStoredJson(STORAGE_KEY, posts);
  listeners.forEach((listener) => listener());
}

function subscribe(listener: () => void) {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

function getSnapshot() {
  return snapshot;
}

export function useHotspotPersonalPosts(hotspotSlug: string) {
  const normalizedHotspotSlug = hotspotSlug.trim();
  const storedPosts = useSyncExternalStore(subscribe, getSnapshot, getSnapshot);

  return storedPosts.filter((post) => post.hotspotSlug === normalizedHotspotSlug);
}

export function addHotspotPersonalPost({
  authorAvatarUri,
  authorName,
  hotspotId = null,
  hotspotSlug,
  rating = 5,
  text,
}: AddHotspotPersonalPostInput) {
  const normalizedHotspotSlug = hotspotSlug.trim();
  const normalizedText = text.trim();

  if (!normalizedHotspotSlug || !normalizedText) {
    return null;
  }

  const nextPost: HotspotPersonalPost = {
    authorAvatarUri: authorAvatarUri?.trim() ?? "",
    authorName: authorName?.trim() || "Bạn",
    createdAt: new Date().toISOString(),
    hotspotId:
      typeof hotspotId === "number" && Number.isFinite(hotspotId) && hotspotId > 0
        ? hotspotId
        : null,
    hotspotSlug: normalizedHotspotSlug,
    id: `${Date.now()}-${Math.random().toString(36).slice(2, 10)}`,
    rating: clampRating(rating),
    text: normalizedText,
  };

  posts = [nextPost, ...posts];
  emit();

  return nextPost;
}
