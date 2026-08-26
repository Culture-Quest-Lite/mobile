import { Platform } from "react-native";

import { PublicEnv, buildApiUrl } from "@/constants/env";

export type ResetPasswordRequest = {
  confirmPassword: string;
  newPassword: string;
  token: string;
};

export type ResetPasswordResponse = {
  message: string | null;
};

function resolveResetPasswordUrl() {
  if (PublicEnv.apiBaseUrl.trim()) {
    return buildApiUrl("/api/auth/reset-password");
  }

  return "http://13.158.40.56:8080/api/auth/reset-password";
}

function isObject(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
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
  if (status === 500) {
    return "Máy chủ đổi mật khẩu đang gặp lỗi. Vui lòng thử lại sau.";
  }

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

  if (status === 400) {
    return "Liên kết đổi mật khẩu không hợp lệ hoặc đã hết hạn.";
  }

  return `Đổi mật khẩu thất bại (${status}).`;
}

function getConnectionErrorMessage(resetPasswordUrl: string) {
  if (Platform.OS === "android" && resetPasswordUrl.startsWith("http://")) {
    return "Android đang chặn kết nối HTTP tới API. Hãy dùng HTTPS hoặc rebuild Android dev client sau khi bật cleartext traffic.";
  }

  return "Không thể kết nối đến máy chủ đổi mật khẩu.";
}

function getSuccessMessage(body: unknown) {
  if (isObject(body) && typeof body.message === "string" && body.message.trim()) {
    return body.message.trim();
  }

  if (typeof body === "string" && body.trim()) {
    return body.trim();
  }

  return null;
}

export async function resetPassword({
  confirmPassword,
  newPassword,
  token,
}: ResetPasswordRequest): Promise<ResetPasswordResponse> {
  const resetPasswordUrl = resolveResetPasswordUrl();
  let response: Response;

  console.info("[auth] reset password request started", {
    platform: Platform.OS,
    url: resetPasswordUrl,
  });

  try {
    response = await fetch(resetPasswordUrl, {
      body: JSON.stringify({
        confirmPassword,
        newPassword,
        token,
      }),
      headers: {
        Accept: "application/json",
        "Content-Type": "application/json",
      },
      method: "POST",
    });
  } catch (error) {
    console.warn("[auth] reset password network failure", {
      error: serializeError(error),
      platform: Platform.OS,
      url: resetPasswordUrl,
    });
    throw new Error(getConnectionErrorMessage(resetPasswordUrl));
  }

  const responseBody = await parseResponseBody(response);

  console.info("[auth] reset password response received", {
    ok: response.ok,
    status: response.status,
    url: resetPasswordUrl,
  });

  if (!response.ok) {
    console.info("[auth] reset password rejected", {
      body: summarizeBody(responseBody),
      status: response.status,
      url: resetPasswordUrl,
    });
    throw new Error(getErrorMessage(responseBody, response.status));
  }

  const message = getSuccessMessage(responseBody);

  console.info("[auth] reset password succeeded", {
    message,
    url: resetPasswordUrl,
  });

  return {
    message,
  };
}
