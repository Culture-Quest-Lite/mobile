import { useSyncExternalStore } from "react";

import type { Profile } from "../types";

let currentProfile: Profile | null = null;
const listeners = new Set<() => void>();

function emitChange() {
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
  return currentProfile;
}

export function useCurrentProfile() {
  return useSyncExternalStore(subscribe, getSnapshot, getSnapshot);
}

export function setCurrentProfile(nextProfile: Profile | null) {
  currentProfile = nextProfile;
  emitChange();
}

export function resetCurrentProfile() {
  if (currentProfile === null) {
    return;
  }

  currentProfile = null;
  emitChange();
}
