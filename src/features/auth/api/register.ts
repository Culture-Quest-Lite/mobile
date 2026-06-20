import { Platform } from "react-native";

import { PublicEnv, buildApiUrl } from "@/constants/env";

export type RegisterRequest = {
  displayName: string;
  email: string;
  password: string;
  username: string;
};

export type RegisterResponse = {
  avatarUrl: string | null;
  autoPlayAudio: boolean;
  createdAt: string;
  displayName: string;
  email: string;
  isPremium: boolean;
  levelName: string | null;
  role: string;
  status: string;
  totalPoints: number;
  totalXp: number;
  userId: number;
  username: string;
};

function resolveRegisterUrl() {
  if (PublicEnv.apiBaseUrl.trim()) {
    return buildApiUrl("/api/auth/register");
  }

  return "http://13.158.40.56:8080/api/auth/register";
}

function isObject(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}

function isRegisterResponse(value: unknown): value is RegisterResponse {
  if (!isObject(value)) {
    return false;
  }

  return (
    typeof value.userId === "number" &&
    typeof value.username === "string" &&
    typeof value.email === "string" &&
    typeof value.displayName === "string" &&
    typeof value.autoPlayAudio === "boolean" &&
    typeof value.isPremium === "boolean" &&
    typeof value.status === "string" &&
    typeof value.role === "string" &&
    typeof value.totalXp === "number" &&
    typeof value.totalPoints === "number" &&
    typeof value.createdAt === "string"
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

  if (status === 409) {
    return "Username hoặc email đã tồn tại.";
  }

  return `Đăng ký thất bại (${status}).`;
}

function getConnectionErrorMessage(registerUrl: string) {
  if (Platform.OS === "android" && registerUrl.startsWith("http://")) {
    return "Android đang chặn kết nối HTTP tới API. Hãy dùng HTTPS hoặc rebuild Android dev client sau khi bật cleartext traffic.";
  }

  return "Không thể kết nối đến máy chủ đăng ký.";
}

export async function registerWithPassword({
  displayName,
  email,
  password,
  username,
}: RegisterRequest): Promise<RegisterResponse> {
  const registerUrl = resolveRegisterUrl();
  let response: Response;

  console.info("[auth] register request started", {
    email,
    platform: Platform.OS,
    url: registerUrl,
    username: maskUsername(username),
  });

  try {
    response = await fetch(registerUrl, {
      body: JSON.stringify({
        displayName,
        email,
        password,
        username,
      }),
      headers: {
        Accept: "application/json",
        "Content-Type": "application/json",
      },
      method: "POST",
    });
  } catch (error) {
    console.warn("[auth] register network failure", {
      error: serializeError(error),
      platform: Platform.OS,
      url: registerUrl,
      username: maskUsername(username),
    });
    throw new Error(getConnectionErrorMessage(registerUrl));
  }

  const responseBody = await parseResponseBody(response);

  console.info("[auth] register response received", {
    ok: response.ok,
    status: response.status,
    url: registerUrl,
  });

  if (!response.ok) {
    console.warn("[auth] register rejected", {
      body: summarizeBody(responseBody),
      status: response.status,
      url: registerUrl,
    });
    throw new Error(getErrorMessage(responseBody, response.status));
  }

  if (!isRegisterResponse(responseBody)) {
    console.warn("[auth] register invalid payload", {
      body: summarizeBody(responseBody),
      url: registerUrl,
    });
    throw new Error("API đăng ký trả về dữ liệu không đúng định dạng.");
  }

  console.info("[auth] register succeeded", {
    status: responseBody.status,
    url: registerUrl,
    userId: responseBody.userId,
    username: responseBody.username,
  });

  return responseBody;
}
