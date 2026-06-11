import { useSyncExternalStore } from 'react';

const checkedInIds = new Set<string>(['ben-thanh']);
const listeners = new Set<() => void>();
let snapshot: string[] = Array.from(checkedInIds);

function emit() {
  snapshot = Array.from(checkedInIds);
  listeners.forEach((listener) => listener());
}

function getSnapshot(): string[] {
  return snapshot;
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

export function addCheckin(hotspotId: string) {
  if (checkedInIds.has(hotspotId)) return;
  checkedInIds.add(hotspotId);
  emit();
}
