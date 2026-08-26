import { useSyncExternalStore } from "react";

import type { Profile } from "../types";

let currentProfile: Profile | null = null;
const listeners = new Set<() => void>();
type CurrentProfileCountKey = "followers" | "following" | "totalPosts";

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

function normalizeCount(value: number) {
  if (!Number.isFinite(value)) {
    return 0;
  }

  return Math.max(0, Math.round(value));
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

function updateCurrentProfile(updater: (profile: Profile) => Profile) {
  if (currentProfile === null) {
    return null;
  }

  const nextProfile = updater(currentProfile);

  if (nextProfile === currentProfile) {
    return currentProfile;
  }

  currentProfile = nextProfile;
  emitChange();

  return currentProfile;
}

export function adjustCurrentProfileCount(
  key: CurrentProfileCountKey,
  delta: number,
) {
  if (!Number.isFinite(delta) || delta === 0) {
    return currentProfile;
  }

  return updateCurrentProfile((profile) => {
    const nextValue = normalizeCount(profile[key] + delta);

    if (profile[key] === nextValue) {
      return profile;
    }

    const nextProfile: Profile = {
      ...profile,
      [key]: nextValue,
    };

    return nextProfile;
  });
}
