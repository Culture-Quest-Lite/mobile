import { useSyncExternalStore } from "react";

import { readStoredJson, writeStoredJson } from "@/lib/persistent-json-storage";

type PersistedCheckinState = {
  checkedInApiHotspotIds: number[];
  checkedInIds: string[];
};

const STORAGE_KEY = "checkins";
const defaultCheckedInIds = ["ben-thanh"];
const listeners = new Set<() => void>();

function isValidSlug(value: unknown): value is string {
  return typeof value === "string" && value.trim().length > 0;
}

function isValidApiHotspotId(value: unknown): value is number {
  return typeof value === "number" && Number.isInteger(value) && value > 0;
}

function loadPersistedCheckins() {
  const storedValue = readStoredJson<PersistedCheckinState>(STORAGE_KEY, {
    checkedInApiHotspotIds: [],
    checkedInIds: [],
  });

  const checkedInIds = storedValue.checkedInIds.filter(isValidSlug);
  const checkedInApiHotspotIds =
    storedValue.checkedInApiHotspotIds.filter(isValidApiHotspotId);

  return {
    checkedInApiHotspotIds,
    checkedInIds,
  };
}

const persistedCheckins = loadPersistedCheckins();
const checkedInIds = new Set<string>([
  ...defaultCheckedInIds,
  ...persistedCheckins.checkedInIds,
]);
const checkedInApiHotspotIds = new Set<number>(
  persistedCheckins.checkedInApiHotspotIds,
);
let snapshot: string[] = Array.from(checkedInIds);
let apiSnapshot: number[] = Array.from(checkedInApiHotspotIds);

function persist() {
  writeStoredJson(STORAGE_KEY, {
    checkedInApiHotspotIds: Array.from(checkedInApiHotspotIds),
    checkedInIds: Array.from(checkedInIds),
  } satisfies PersistedCheckinState);
}

function emit() {
  snapshot = Array.from(checkedInIds);
  apiSnapshot = Array.from(checkedInApiHotspotIds);
  persist();
  listeners.forEach((listener) => listener());
}

function getSnapshot(): string[] {
  return snapshot;
}

function getApiSnapshot(): number[] {
  return apiSnapshot;
}

export function useCheckins(): string[] {
  return useSyncExternalStore(
    (listener) => {
      listeners.add(listener);
      return () => listeners.delete(listener);
    },
    getSnapshot,
    getSnapshot,
  );
}

export function useCheckedInApiHotspots(): number[] {
  return useSyncExternalStore(
    (listener) => {
      listeners.add(listener);
      return () => listeners.delete(listener);
    },
    getApiSnapshot,
    getApiSnapshot,
  );
}

export function addCheckin(hotspotId: string) {
  if (checkedInIds.has(hotspotId)) return;
  checkedInIds.add(hotspotId);
  emit();
}

export function addApiCheckin(hotspotId: number) {
  if (!Number.isInteger(hotspotId) || hotspotId <= 0) return;
  if (checkedInApiHotspotIds.has(hotspotId)) return;
  checkedInApiHotspotIds.add(hotspotId);
  emit();
}

export function mergeApiCheckins(hotspotIds: Iterable<number>) {
  let didChange = false;

  for (const hotspotId of hotspotIds) {
    if (!Number.isInteger(hotspotId) || hotspotId <= 0) {
      continue;
    }

    if (checkedInApiHotspotIds.has(hotspotId)) {
      continue;
    }

    checkedInApiHotspotIds.add(hotspotId);
    didChange = true;
  }

  if (didChange) {
    emit();
  }
}
