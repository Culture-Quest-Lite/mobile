import { Platform } from "react-native";

import { PublicEnv, buildApiUrl } from "@/constants/env";

export type ResendOtpRequest = {
  email: string;
};

export type ResendOtpResponse = {
  message: string | null;
};

function resolveResendOtpUrl() {
  if (PublicEnv.apiBaseUrl.trim()) {
    return buildApiUrl("/api/auth/resend-otp");
  }

  return "http://13.158.40.56:8080/api/auth/resend-otp";
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
    return "Không thể gửi lại mã OTP.";
  }

  return `Gửi lại mã OTP thất bại (${status}).`;
}

function getConnectionErrorMessage(resendOtpUrl: string) {
  if (Platform.OS === "android" && resendOtpUrl.startsWith("http://")) {
    return "Android đang chặn kết nối HTTP tới API. Hãy dùng HTTPS hoặc rebuild Android dev client sau khi bật cleartext traffic.";
  }

  return "Không thể kết nối đến máy chủ gửi lại OTP.";
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

export async function resendOtp({
  email,
}: ResendOtpRequest): Promise<ResendOtpResponse> {
  const resendOtpUrl = resolveResendOtpUrl();
  let response: Response;

  console.info("[auth] resend otp request started", {
    email,
    platform: Platform.OS,
    url: resendOtpUrl,
  });

  try {
    response = await fetch(resendOtpUrl, {
      body: JSON.stringify({
        email,
      }),
      headers: {
        Accept: "application/json",
        "Content-Type": "application/json",
      },
      method: "POST",
    });
  } catch (error) {
    console.warn("[auth] resend otp network failure", {
      error: serializeError(error),
      platform: Platform.OS,
      url: resendOtpUrl,
    });
    throw new Error(getConnectionErrorMessage(resendOtpUrl));
  }

  const responseBody = await parseResponseBody(response);

  console.info("[auth] resend otp response received", {
    ok: response.ok,
    status: response.status,
    url: resendOtpUrl,
  });

  if (!response.ok) {
    console.warn("[auth] resend otp rejected", {
      body: summarizeBody(responseBody),
      status: response.status,
      url: resendOtpUrl,
    });
    throw new Error(getErrorMessage(responseBody, response.status));
  }

  const message = getSuccessMessage(responseBody);

  console.info("[auth] resend otp succeeded", {
    message,
    url: resendOtpUrl,
  });

  return {
    message,
  };
}
