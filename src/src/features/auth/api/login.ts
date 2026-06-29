import { Platform } from "react-native";

import { PublicEnv, buildApiUrl } from "@/constants/env";

export type LoginRequest = {
  password: string;
  username: string;
};

export type LoginResponse = {
  accessToken: string;
  expiresIn: number;
  refreshExpiresIn: number;
  refreshToken: string;
  tokenType: string;
};

function resolveLoginUrl() {
  if (PublicEnv.apiBaseUrl.trim()) {
    return buildApiUrl("/api/auth/login");
  }

  return "http://13.158.40.56:8080/api/auth/login";
}

function isObject(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}

function isLoginResponse(value: unknown): value is LoginResponse {
  if (!isObject(value)) {
    return false;
  }

  return (
    typeof value.accessToken === "string" &&
    typeof value.refreshToken === "string" &&
    typeof value.tokenType === "string" &&
    typeof value.expiresIn === "number" &&
    typeof value.refreshExpiresIn === "number"
  );
}

function maskUsername(username: string) {
  const normalizedUsername = username.trim();

  if (normalizedUsername.length <= 2) {
    return normalizedUsername;
  }

  return `${normalizedUsername.slice(0, 2)}***${normalizedUsername.slice(-2)}`;
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
    for (const key of ["message", "error", "detail", "title"]) {
      const candidate = body[key];

      if (typeof candidate === "string" && candidate.trim()) {
        return candidate.trim();
      }
    }
  }

  if (typeof body === "string" && body.trim()) {
    return body.trim();
  }

  if (status === 401) {
    return "Username hoặc mật khẩu không đúng.";
  }

  return `Đăng nhập thất bại (${status}).`;
}

function getConnectionErrorMessage(loginUrl: string) {
  if (Platform.OS === "android" && loginUrl.startsWith("http://")) {
    return "Android đang chặn kết nối HTTP tới API. Hãy dùng HTTPS hoặc rebuild Android dev client sau khi bật cleartext traffic.";
  }

  return "Không thể kết nối đến máy chủ đăng nhập.";
}

export async function loginWithPassword({
  password,
  username,
}: LoginRequest): Promise<LoginResponse> {
  const loginUrl = resolveLoginUrl();
  let response: Response;

  console.info("[auth] login request started", {
    platform: Platform.OS,
    url: loginUrl,
    username: maskUsername(username),
  });

  try {
    response = await fetch(loginUrl, {
      body: JSON.stringify({
        password,
        username,
      }),
      headers: {
        Accept: "application/json",
        "Content-Type": "application/json",
        "X-Client-Type": "mobile",
      },
      method: "POST",
    });
  } catch (error) {
    console.warn("[auth] login network failure", {
      error: serializeError(error),
      platform: Platform.OS,
      url: loginUrl,
      username: maskUsername(username),
    });
    throw new Error(getConnectionErrorMessage(loginUrl));
  }

  const responseBody = await parseResponseBody(response);

  console.info("[auth] login response received", {
    ok: response.ok,
    status: response.status,
    url: loginUrl,
  });

  if (!response.ok) {
    console.warn("[auth] login rejected", {
      body: summarizeBody(responseBody),
      status: response.status,
      url: loginUrl,
    });
    throw new Error(getErrorMessage(responseBody, response.status));
  }

  if (!isLoginResponse(responseBody)) {
    console.warn("[auth] login invalid payload", {
      body: summarizeBody(responseBody),
      url: loginUrl,
    });
    throw new Error("API đăng nhập trả về dữ liệu không đúng định dạng.");
  }

  console.info("[auth] login succeeded", {
    expiresIn: responseBody.expiresIn,
    refreshExpiresIn: responseBody.refreshExpiresIn,
    tokenType: responseBody.tokenType,
    url: loginUrl,
  });

  return responseBody;
}
