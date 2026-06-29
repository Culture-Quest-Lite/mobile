import { useSyncExternalStore } from 'react';

const checkedInIds = new Set<string>(['ben-thanh']);
const checkedInApiHotspotIds = new Set<number>();
const listeners = new Set<() => void>();
let snapshot: string[] = Array.from(checkedInIds);
let apiSnapshot: number[] = Array.from(checkedInApiHotspotIds);

function emit() {
  snapshot = Array.from(checkedInIds);
  apiSnapshot = Array.from(checkedInApiHotspotIds);
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
