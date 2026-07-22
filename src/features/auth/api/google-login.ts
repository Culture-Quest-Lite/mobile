import { AuthRequest, ResponseType, makeRedirectUri } from "expo-auth-session";
import { Platform } from "react-native";

import { PublicEnv } from "@/constants/env";
import type { LoginResponse } from "@/features/auth/api/login";
import { readExpoScheme } from "@/lib/expo-scheme";

const GOOGLE_AUTH_CALLBACK_PATH = "auth/callback/google";
const DEFAULT_EXPO_SCHEME = "culturequestlitemobile";

export type GoogleLoginResult = LoginResponse & {
  displayName: string | null;
};

export class GoogleSignInCancelledError extends Error {
  constructor() {
    super("Đăng nhập Google đã bị hủy.");
    this.name = "GoogleSignInCancelledError";
  }
}

type KeycloakDiscovery = {
  authorizationEndpoint: string;
  endSessionEndpoint: string;
  tokenEndpoint: string;
};

function normalizeUrlPart(value: string) {
  return value.endsWith("/") ? value.slice(0, -1) : value;
}

function buildKeycloakDiscovery(): KeycloakDiscovery {
  if (!PublicEnv.keycloakUrl || !PublicEnv.keycloakRealm) {
    throw new Error(
      "Thiếu EXPO_PUBLIC_KEYCLOAK_URL hoặc EXPO_PUBLIC_KEYCLOAK_REALM trong file .env của mobile.",
    );
  }

  const realmBase = `${normalizeUrlPart(PublicEnv.keycloakUrl)}/realms/${PublicEnv.keycloakRealm}/protocol/openid-connect`;

  return {
    authorizationEndpoint: `${realmBase}/auth`,
    endSessionEndpoint: `${realmBase}/logout`,
    tokenEndpoint: `${realmBase}/token`,
  };
}

function resolveRedirectUri() {
  if (PublicEnv.googleRedirectUri) {
    return PublicEnv.googleRedirectUri;
  }

  return makeRedirectUri({
    path: GOOGLE_AUTH_CALLBACK_PATH,
    scheme: readExpoScheme() || DEFAULT_EXPO_SCHEME,
  });
}

function isObject(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}

type KeycloakTokenResponse = {
  access_token: string;
  expires_in: number;
  id_token?: string;
  refresh_expires_in: number;
  refresh_token: string;
  token_type: string;
};

function isKeycloakTokenResponse(
  value: unknown,
): value is KeycloakTokenResponse {
  if (!isObject(value)) {
    return false;
  }

  return (
    typeof value.access_token === "string" &&
    typeof value.refresh_token === "string" &&
    typeof value.token_type === "string" &&
    typeof value.expires_in === "number" &&
    typeof value.refresh_expires_in === "number"
  );
}

function serializeError(error: unknown) {
  if (error instanceof Error) {
    return {
      message: error.message,
      name: error.name,
      stack: error.stack,
    };
  }

  return {
    value: error,
  };
}

function summarizeBody(body: unknown) {
  if (typeof body === "string") {
    return body.slice(0, 300);
  }

  if (isObject(body)) {
    return body;
  }

  return body;
}

async function parseResponseBody(response: Response) {
  const rawBody = await response.text();

  if (!rawBody) {
    return null;
  }

  try {
    return JSON.parse(rawBody) as unknown;
  } catch {
    return rawBody;
  }
}

function getErrorMessage(body: unknown, status: number) {
  if (isObject(body)) {
    for (const key of ["error_description", "message", "error", "detail"]) {
      const candidate = body[key];

      if (typeof candidate === "string" && candidate.trim()) {
        return candidate.trim();
      }
    }
  }

  if (typeof body === "string" && body.trim()) {
    return body.trim();
  }

  return `Đăng nhập Google thất bại (${status}).`;
}

function getConnectionErrorMessage(tokenUrl: string) {
  if (Platform.OS === "android" && tokenUrl.startsWith("http://")) {
    return "Android đang chặn kết nối HTTP tới Keycloak. Hãy dùng HTTPS hoặc rebuild Android dev client sau khi bật cleartext traffic.";
  }

  return "Không thể kết nối đến máy chủ xác thực.";
}

function decodeBase64(value: string) {
  if (typeof atob === "function") {
    return atob(value);
  }

  return null;
}

function decodeJwtPayload(token: string): Record<string, unknown> | null {
  try {
    const payloadSegment = token.split(".")[1];

    if (!payloadSegment) {
      return null;
    }

    const normalizedSegment = payloadSegment
      .replace(/-/g, "+")
      .replace(/_/g, "/");
    const paddedSegment = normalizedSegment.padEnd(
      normalizedSegment.length + ((4 - (normalizedSegment.length % 4)) % 4),
      "=",
    );
    const decodedPayload = decodeBase64(paddedSegment);

    if (!decodedPayload) {
      return null;
    }

    const parsedPayload = JSON.parse(decodedPayload) as unknown;
    return isObject(parsedPayload) ? parsedPayload : null;
  } catch {
    return null;
  }
}

function extractDisplayName(idToken: string | undefined) {
  if (!idToken) {
    return null;
  }

  const payload = decodeJwtPayload(idToken);

  if (!payload) {
    return null;
  }

  for (const key of ["name", "preferred_username", "email"]) {
    const candidate = payload[key];

    if (typeof candidate === "string" && candidate.trim()) {
      return candidate.trim();
    }
  }

  return null;
}

async function requestKeycloakToken(
  body: Record<string, string>,
  context: "login" | "refresh",
): Promise<KeycloakTokenResponse> {
  const discovery = buildKeycloakDiscovery();
  const tokenUrl = discovery.tokenEndpoint;
  let response: Response;

  try {
    response = await fetch(tokenUrl, {
      body: new URLSearchParams(body).toString(),
      headers: {
        Accept: "application/json",
        "Content-Type": "application/x-www-form-urlencoded",
      },
      method: "POST",
    });
  } catch (error) {
    console.warn(`[auth] google ${context} network failure`, {
      error: serializeError(error),
      platform: Platform.OS,
      url: tokenUrl,
    });
    throw new Error(getConnectionErrorMessage(tokenUrl));
  }

  const responseBody = await parseResponseBody(response);

  console.info(`[auth] google ${context} token response received`, {
    ok: response.ok,
    status: response.status,
    url: tokenUrl,
  });

  if (!response.ok) {
    console.warn(`[auth] google ${context} token rejected`, {
      body: summarizeBody(responseBody),
      status: response.status,
      url: tokenUrl,
    });
    throw new Error(getErrorMessage(responseBody, response.status));
  }

  if (!isKeycloakTokenResponse(responseBody)) {
    console.warn(`[auth] google ${context} invalid payload`, {
      body: summarizeBody(responseBody),
      url: tokenUrl,
    });
    throw new Error("Keycloak trả về dữ liệu không đúng định dạng.");
  }

  return responseBody;
}

function toLoginResponse(tokenResponse: KeycloakTokenResponse): LoginResponse {
  return {
    accessToken: tokenResponse.access_token,
    expiresIn: tokenResponse.expires_in,
    refreshExpiresIn: tokenResponse.refresh_expires_in,
    refreshToken: tokenResponse.refresh_token,
    tokenType: tokenResponse.token_type,
  };
}

export async function loginWithGoogleViaKeycloak(): Promise<GoogleLoginResult> {
  const discovery = buildKeycloakDiscovery();
  const redirectUri = resolveRedirectUri();

  if (!PublicEnv.keycloakClientId) {
    throw new Error(
      "Thiếu EXPO_PUBLIC_KEYCLOAK_CLIENT_ID trong file .env của mobile.",
    );
  }

  console.info("[auth] google login started", {
    authorizationEndpoint: discovery.authorizationEndpoint,
    platform: Platform.OS,
    redirectUri,
  });

  const request = new AuthRequest({
    clientId: PublicEnv.keycloakClientId,
    extraParams: {
      kc_idp_hint: "google",
    },
    redirectUri,
    responseType: ResponseType.Code,
    scopes: ["openid", "profile", "email"],
    usePKCE: true,
  });

  const result = await request.promptAsync(discovery);

  if (result.type !== "success") {
    if (result.type === "error") {
      console.warn("[auth] google login browser error", {
        error: serializeError(result.error),
        params: result.params,
      });
      throw new Error(
        result.params?.error_description?.trim() ||
          result.error?.message ||
          "Đăng nhập Google thất bại.",
      );
    }

    console.info("[auth] google login dismissed", { type: result.type });
    throw new GoogleSignInCancelledError();
  }

  const code = result.params.code;

  if (!code) {
    throw new Error("Keycloak không trả về authorization code.");
  }

  const tokenResponse = await requestKeycloakToken(
    {
      client_id: PublicEnv.keycloakClientId,
      code,
      code_verifier: request.codeVerifier ?? "",
      grant_type: "authorization_code",
      redirect_uri: redirectUri,
    },
    "login",
  );

  console.info("[auth] google login succeeded", {
    expiresIn: tokenResponse.expires_in,
    refreshExpiresIn: tokenResponse.refresh_expires_in,
    tokenType: tokenResponse.token_type,
  });

  return {
    ...toLoginResponse(tokenResponse),
    displayName: extractDisplayName(tokenResponse.id_token),
  };
}

export async function refreshGoogleAccessToken(
  refreshToken: string,
): Promise<LoginResponse> {
  if (!PublicEnv.keycloakClientId) {
    throw new Error(
      "Thiếu EXPO_PUBLIC_KEYCLOAK_CLIENT_ID trong file .env của mobile.",
    );
  }

  const tokenResponse = await requestKeycloakToken(
    {
      client_id: PublicEnv.keycloakClientId,
      grant_type: "refresh_token",
      refresh_token: refreshToken,
    },
    "refresh",
  );

  return toLoginResponse(tokenResponse);
}
