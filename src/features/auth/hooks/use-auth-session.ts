import { useSyncExternalStore } from "react";

import { loginWithPassword } from "@/features/auth/api/login";
import { refreshAccessToken } from "@/features/auth/api/refresh-token";
import { readStoredJson, writeStoredJson } from "@/lib/persistent-json-storage";

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

const ACCESS_TOKEN_REFRESH_BUFFER_MS = 30 * 1000;
const AUTH_SESSION_STORAGE_KEY = "auth-session";

function readInitialAuthSession(): AuthSession {
  const storedSession = readStoredJson<AuthSession | null>(
    AUTH_SESSION_STORAGE_KEY,
    null,
  );

  if (!storedSession?.isAuthenticated) {
    return guestSession;
  }

  if (
    storedSession.refreshExpiresAt !== null &&
    Date.now() >= storedSession.refreshExpiresAt
  ) {
    writeStoredJson(AUTH_SESSION_STORAGE_KEY, guestSession);
    return guestSession;
  }

  return {
    ...guestSession,
    ...storedSession,
    isAuthenticated: true,
    role: "explorer",
  };
}

let authSession = readInitialAuthSession();
const listeners = new Set<() => void>();
let refreshSessionPromise: Promise<AuthSession> | null = null;

function emitChange() {
  listeners.forEach((listener) => {
    listener();
  });
}

function setAuthSession(nextSession: AuthSession) {
  authSession = nextSession;
  writeStoredJson(AUTH_SESSION_STORAGE_KEY, nextSession);
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

function hasExpired(timestamp: number | null, bufferMs = 0) {
  return timestamp !== null && Date.now() >= timestamp - bufferMs;
}

function getRefreshSessionErrorMessage() {
  return "Phiên đăng nhập đã hết hạn. Vui lòng đăng nhập lại.";
}

async function refreshAuthSessionInternal() {
  const currentSession = authSession;

  if (!currentSession.isAuthenticated || !currentSession.refreshToken) {
    throw new Error(getRefreshSessionErrorMessage());
  }

  if (hasExpired(currentSession.refreshExpiresAt)) {
    resetAuthSessionToGuest();
    throw new Error(getRefreshSessionErrorMessage());
  }

  try {
    const response = await refreshAccessToken({
      refreshToken: currentSession.refreshToken,
    });
    const now = Date.now();
    const refreshedSession = createExplorerSession({
      accessToken: response.accessToken,
      expiresAt: now + response.expiresIn * 1000,
      name: currentSession.username ?? currentSession.displayName,
      refreshExpiresAt: now + response.refreshExpiresIn * 1000,
      refreshToken: response.refreshToken,
      tokenType: response.tokenType,
    });

    if (
      authSession.refreshToken !== currentSession.refreshToken ||
      authSession.username !== currentSession.username
    ) {
      return authSession;
    }

    setAuthSession(refreshedSession);
    return refreshedSession;
  } catch (error) {
    if (
      authSession.refreshToken === currentSession.refreshToken &&
      authSession.username === currentSession.username
    ) {
      resetAuthSessionToGuest();
    }

    throw error;
  }
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

export async function refreshAuthSession() {
  if (!refreshSessionPromise) {
    refreshSessionPromise = refreshAuthSessionInternal()
      .catch((error) => {
        console.warn("[auth] refresh session failed", {
          error:
            error instanceof Error
              ? { message: error.message, name: error.name, stack: error.stack }
              : error,
        });
        throw error;
      })
      .finally(() => {
        refreshSessionPromise = null;
      });
  }

  return refreshSessionPromise;
}

export function getAccessToken() {
  return authSession.accessToken;
}

export async function getValidAccessToken() {
  if (!authSession.isAuthenticated) {
    return null;
  }

  if (
    authSession.accessToken &&
    !hasExpired(authSession.expiresAt, ACCESS_TOKEN_REFRESH_BUFFER_MS)
  ) {
    return authSession.accessToken;
  }

  if (!authSession.refreshToken) {
    return hasExpired(authSession.expiresAt) ? null : authSession.accessToken;
  }

  const refreshedSession = await refreshAuthSession();
  return refreshedSession.accessToken;
}

export function resetAuthSessionToGuest() {
  setAuthSession(guestSession);
}
