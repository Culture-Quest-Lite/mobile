import { useSyncExternalStore } from "react";

import { loginWithPassword } from "@/features/auth/api/login";

export type AuthRole = "guest" | "explorer";

export type AuthSession = {
  accessToken: string | null;
  displayName: string;
  expiresAt: number | null;
  isAuthenticated: boolean;
  level: number | null;
  refreshExpiresAt: number | null;
  refreshToken: string | null;
  role: AuthRole;
  tokenType: string | null;
  username: string | null;
};

const guestSession: AuthSession = {
  accessToken: null,
  displayName: "bạn",
  expiresAt: null,
  isAuthenticated: false,
  level: null,
  refreshExpiresAt: null,
  refreshToken: null,
  role: "guest",
  tokenType: null,
  username: null,
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

function createExplorerSession({
  accessToken = null,
  expiresAt = null,
  name,
  refreshExpiresAt = null,
  refreshToken = null,
  tokenType = null,
}: {
  accessToken?: string | null;
  expiresAt?: number | null;
  name?: string;
  refreshExpiresAt?: number | null;
  refreshToken?: string | null;
  tokenType?: string | null;
}): AuthSession {
  const normalizedName = name?.trim();

  return {
    accessToken,
    displayName: getGreetingName(normalizedName),
    expiresAt,
    isAuthenticated: true,
    level: 12,
    refreshExpiresAt,
    refreshToken,
    role: "explorer",
    tokenType,
    username: normalizedName || null,
  };
}

export function useAuthSession() {
  return useSyncExternalStore(subscribe, getSnapshot, getSnapshot);
}

export async function signInWithPassword(username: string, password: string) {
  const normalizedUsername = username.trim();
  const response = await loginWithPassword({
    password,
    username: normalizedUsername,
  });
  const now = Date.now();

  setAuthSession(
    createExplorerSession({
      accessToken: response.accessToken,
      expiresAt: now + response.expiresIn * 1000,
      name: normalizedUsername,
      refreshExpiresAt: now + response.refreshExpiresIn * 1000,
      refreshToken: response.refreshToken,
      tokenType: response.tokenType,
    }),
  );

  return response;
}

export function signInAsExplorer(name?: string) {
  setAuthSession(
    createExplorerSession({
      name,
    }),
  );
}

export function getAccessToken() {
  return authSession.accessToken;
}

export function resetAuthSessionToGuest() {
  setAuthSession(guestSession);
}
