import { Platform } from "react-native";

import { PublicEnv, buildApiUrl } from "@/constants/env";

export type ForgotPasswordRequest = {
  email: string;
};

export type ForgotPasswordResponse = {
  message: string | null;
};

function resolveForgotPasswordUrl() {
  if (PublicEnv.apiBaseUrl.trim()) {
    return buildApiUrl("/api/auth/forgot-password");
  }

  return "https://api.culturequestlite.com/api/auth/forgot-password";
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
    return "Máy chủ khôi phục mật khẩu đang gặp lỗi. Vui lòng thử lại sau.";
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

  if (status === 404) {
    return "Email không tồn tại trong hệ thống.";
  }

  if (status === 400) {
    return "Không thể gửi email khôi phục.";
  }

  return `Gửi email khôi phục thất bại (${status}).`;
}

function getConnectionErrorMessage(forgotPasswordUrl: string) {
  if (Platform.OS === "android" && forgotPasswordUrl.startsWith("http://")) {
    return "Android đang chặn kết nối HTTP tới API. Hãy dùng HTTPS hoặc rebuild Android dev client sau khi bật cleartext traffic.";
  }

  return "Không thể kết nối đến máy chủ khôi phục mật khẩu.";
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

export async function forgotPassword({
  email,
}: ForgotPasswordRequest): Promise<ForgotPasswordResponse> {
  const forgotPasswordUrl = resolveForgotPasswordUrl();
  let response: Response;

  console.info("[auth] forgot password request started", {
    email,
    platform: Platform.OS,
    url: forgotPasswordUrl,
  });

  try {
    response = await fetch(forgotPasswordUrl, {
      // platform MOBILE để backend gửi link mở app thay vì link web đổi mật khẩu.
      body: JSON.stringify({
        email,
        platform: "MOBILE",
      }),
      headers: {
        Accept: "application/json, text/plain, */*",
        "Content-Type": "application/json",
      },
      method: "POST",
    });
  } catch (error) {
    console.warn("[auth] forgot password network failure", {
      error: serializeError(error),
      platform: Platform.OS,
      url: forgotPasswordUrl,
    });
    throw new Error(getConnectionErrorMessage(forgotPasswordUrl));
  }

  const responseBody = await parseResponseBody(response);

  console.info("[auth] forgot password response received", {
    ok: response.ok,
    status: response.status,
    url: forgotPasswordUrl,
  });

  if (!response.ok) {
    console.info("[auth] forgot password rejected", {
      body: summarizeBody(responseBody),
      status: response.status,
      url: forgotPasswordUrl,
    });
    throw new Error(getErrorMessage(responseBody, response.status));
  }

  const message = getSuccessMessage(responseBody);

  console.info("[auth] forgot password succeeded", {
    message,
    url: forgotPasswordUrl,
  });

  return {
    message,
  };
}
