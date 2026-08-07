import { useSyncExternalStore } from "react";

import { loginWithPassword } from "@/features/auth/api/login";
import { refreshAccessToken } from "@/features/auth/api/refresh-token";
import {
  loginWithSocialViaKeycloak,
  refreshSocialAccessToken,
  type SocialProvider,
} from "@/features/auth/api/social-login";
import { syncSocialAccount } from "@/features/auth/api/social-sync";
import { resetCheckins } from "@/lib/checkin-store";
import { readStoredJson, writeStoredJson } from "@/lib/persistent-json-storage";

export type AuthRole = "guest" | "explorer";

export type AuthProvider = "password" | SocialProvider;

function isSocialProvider(
  provider: AuthProvider | null,
): provider is SocialProvider {
  return provider === "google" || provider === "facebook";
}

export type AuthSession = {
  accessToken: string | null;
  authProvider: AuthProvider | null;
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
  authProvider: null,
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
  const didIdentityChange =
    authSession.isAuthenticated !== nextSession.isAuthenticated ||
    authSession.username !== nextSession.username;

  authSession = nextSession;
  writeStoredJson(AUTH_SESSION_STORAGE_KEY, nextSession);

  if (didIdentityChange) {
    resetCheckins();
  }

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
  authProvider = "password",
  expiresAt = null,
  name,
  refreshExpiresAt = null,
  refreshToken = null,
  tokenType = null,
  username,
}: {
  accessToken?: string | null;
  authProvider?: AuthProvider;
  expiresAt?: number | null;
  name?: string;
  refreshExpiresAt?: number | null;
  refreshToken?: string | null;
  tokenType?: string | null;
  username?: string;
}): AuthSession {
  const normalizedName = name?.trim();
  const normalizedUsername = username?.trim();

  return {
    accessToken,
    authProvider,
    displayName: getGreetingName(normalizedName),
    expiresAt,
    isAuthenticated: true,
    level: 12,
    refreshExpiresAt,
    refreshToken,
    role: "explorer",
    tokenType,
    username: normalizedUsername || normalizedName || null,
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
    // Refresh token Keycloak bị bind theo client: token cấp cho mobile qua
    // Google/Facebook không refresh được qua backend nên phải gọi thẳng Keycloak.
    const response = isSocialProvider(currentSession.authProvider)
      ? await refreshSocialAccessToken(currentSession.refreshToken)
      : await refreshAccessToken({
          refreshToken: currentSession.refreshToken,
        });
    const now = Date.now();
    const refreshedSession = createExplorerSession({
      accessToken: response.accessToken,
      authProvider: currentSession.authProvider ?? "password",
      expiresAt: now + response.expiresIn * 1000,
      // displayName đã ở dạng tên gọi ngắn, username có thể là email nên phải
      // giữ riêng hai giá trị, nếu không sau mỗi lần refresh app sẽ chào bằng email.
      name: currentSession.displayName,
      refreshExpiresAt: now + response.refreshExpiresIn * 1000,
      refreshToken: response.refreshToken,
      tokenType: response.tokenType,
      username: currentSession.username ?? undefined,
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

export async function signInWithSocial(provider: SocialProvider) {
  const response = await loginWithSocialViaKeycloak(provider);

  // Backend chỉ biết tới người dùng này khi được sync: bỏ qua bước dưới thì user
  // mới sẽ không có row trong bảng users và mọi màn hình sau đó đều lỗi.
  let syncedAccount;
  try {
    syncedAccount = await syncSocialAccount({
      accessToken: response.accessToken,
      provider,
      tokenType: response.tokenType,
    });
  } catch (error) {
    resetAuthSessionToGuest();
    throw error;
  }

  const now = Date.now();

  setAuthSession(
    createExplorerSession({
      accessToken: response.accessToken,
      authProvider: provider,
      expiresAt: now + response.expiresIn * 1000,
      name: syncedAccount.displayName || (response.displayName ?? undefined),
      refreshExpiresAt: now + response.refreshExpiresIn * 1000,
      refreshToken: response.refreshToken,
      tokenType: response.tokenType,
      username: syncedAccount.username,
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
