import { useSyncExternalStore } from "react";

export type AuthRole = "guest" | "explorer";

export type AuthSession = {
  displayName: string;
  isAuthenticated: boolean;
  level: number | null;
  role: AuthRole;
};

const guestSession: AuthSession = {
  displayName: "bạn",
  isAuthenticated: false,
  level: null,
  role: "guest",
};

let authSession = guestSession;
const listeners = new Set<() => void>();

function emitChange() {
  listeners.forEach((listener) => {
    listener();
  });
}

function setAuthSession(nextSession: AuthSession) {
  authSession = nextSession;
  emitChange();
}

function subscribe(listener: () => void) {
  listeners.add(listener);

  return () => {
    listeners.delete(listener);
  };
}

function getSnapshot() {
  return authSession;
}

function getGreetingName(name?: string) {
  const normalizedName = name?.trim();

  if (!normalizedName) {
    return "Ngọc";
  }

  return normalizedName.split(/\s+/).at(-1) ?? normalizedName;
}

export function useAuthSession() {
  return useSyncExternalStore(subscribe, getSnapshot, getSnapshot);
}

export function signInAsExplorer(name?: string) {
  setAuthSession({
    displayName: getGreetingName(name),
    isAuthenticated: true,
    level: 12,
    role: "explorer",
  });
}

export function resetAuthSessionToGuest() {
  setAuthSession(guestSession);
}
