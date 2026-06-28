import { Platform } from "react-native";

import { PublicEnv, buildApiUrl } from "@/constants/env";

export type VerifyOtpRequest = {
  email: string;
  otpCode: string;
};

export type VerifyOtpResponse = {
  message: string;
};

function resolveVerifyOtpUrl() {
  if (PublicEnv.apiBaseUrl.trim()) {
    return buildApiUrl("/api/auth/verify-otp");
  }

  return "http://13.158.40.56:8080/api/auth/verify-otp";
}

function isObject(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}

function isVerifyOtpResponse(value: unknown): value is VerifyOtpResponse {
  return isObject(value) && typeof value.message === "string";
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
  if (status === 400) {
    return "Mã OTP không chính xác. Vui lòng thử lại.";
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

  return `Xác thực OTP thất bại (${status}).`;
}

function getConnectionErrorMessage(verifyOtpUrl: string) {
  if (Platform.OS === "android" && verifyOtpUrl.startsWith("http://")) {
    return "Android đang chặn kết nối HTTP tới API. Hãy dùng HTTPS hoặc rebuild Android dev client sau khi bật cleartext traffic.";
  }

  return "Không thể kết nối đến máy chủ xác thực OTP.";
}

export async function verifyOtp({
  email,
  otpCode,
}: VerifyOtpRequest): Promise<VerifyOtpResponse> {
  const verifyOtpUrl = resolveVerifyOtpUrl();
  let response: Response;

  console.info("[auth] verify otp request started", {
    email,
    otpLength: otpCode.length,
    platform: Platform.OS,
    url: verifyOtpUrl,
  });

  try {
    response = await fetch(verifyOtpUrl, {
      body: JSON.stringify({
        email,
        otpCode,
      }),
      headers: {
        Accept: "application/json",
        "Content-Type": "application/json",
      },
      method: "POST",
    });
  } catch (error) {
    console.warn("[auth] verify otp network failure", {
      error: serializeError(error),
      platform: Platform.OS,
      url: verifyOtpUrl,
    });
    throw new Error(getConnectionErrorMessage(verifyOtpUrl));
  }

  const responseBody = await parseResponseBody(response);

  console.info("[auth] verify otp response received", {
    ok: response.ok,
    status: response.status,
    url: verifyOtpUrl,
  });

  if (!response.ok) {
    console.warn("[auth] verify otp rejected", {
      body: summarizeBody(responseBody),
      status: response.status,
      url: verifyOtpUrl,
    });
    throw new Error(getErrorMessage(responseBody, response.status));
  }

  if (!isVerifyOtpResponse(responseBody)) {
    console.warn("[auth] verify otp invalid payload", {
      body: summarizeBody(responseBody),
      url: verifyOtpUrl,
    });
    throw new Error("API xác thực OTP trả về dữ liệu không đúng định dạng.");
  }

  console.info("[auth] verify otp succeeded", {
    message: responseBody.message,
    url: verifyOtpUrl,
  });

  return responseBody;
}
