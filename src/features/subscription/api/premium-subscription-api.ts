import { PublicEnv, buildApiUrl } from "@/constants/env";

export type BillingCycle = "MONTHLY" | "YEARLY";

export type PremiumPlan = {
  subscriptionPlanId: number;
  subscriptionPlanName: string;
  subscriptionPlanDescription?: string | null;
  priceMonthly?: number | null;
  priceYearly?: number | null;
  planType?: string | null;
  status?: string | null;
  configLimit?: Record<string, unknown> | null;
  createdAt?: string | null;
  updatedAt?: string | null;
};

/**
 * Khớp `PaymentInitResponse` của backend.
 *
 * LƯU Ý hai điểm dễ sai:
 * - KHÔNG có field `invoiceId`. Backend nhét invoiceId vào `subscriptionId`
 *   (xem `PayOsInvoicePaymentServiceImpl#initiatePayOsPayment`), và đó chính là
 *   id phải truyền vào `POST /api/user/premium/{invoiceId}/confirm`.
 * - Chỉ có `checkoutUrl` để mở trang thanh toán; không có `paymentUrl`,
 *   `payUrl`, `deeplink` hay `qrCodeUrl`. `qrCode` là chuỗi VietQR thô do PayOS
 *   trả về (không phải URL ảnh), nên không hiển thị trực tiếp bằng <Image>.
 */
export type PremiumPaymentInitResponse = {
  subscriptionId?: number | null;
  gateway: string;
  checkoutUrl?: string | null;
  qrCode?: string | null;
  amount?: number | null;
  orderInfo?: string | null;
};

export type PremiumSubscribeRequest = {
  accessToken: string;
  subscriptionPlanId: number;
  billingCycle: BillingCycle;
  redirectUrl?: string;
};

export type PremiumSubscriptionRecord = {
  invoiceId: number;
  planName: string;
  billingCycle: BillingCycle;
  status: string;
  paymentStatus: string;
  startDate?: string | null;
  endDate?: string | null;
  paidAmount?: number | null;
};

const PREMIUM_LOG_PREFIX = "[PREMIUM API]";

function maskAccessToken(accessToken: string) {
  if (!accessToken) return "(empty)";
  if (accessToken.length <= 16) return "***";
  return `${accessToken.slice(0, 8)}...${accessToken.slice(-6)}`;
}

function logRequest(
  name: string,
  details: {
    method: string;
    url: string;
    accessToken?: string;
    body?: unknown;
  },
) {
  console.group(`${PREMIUM_LOG_PREFIX} ${name} - REQUEST`);
  console.log("Method:", details.method);
  console.log("URL:", details.url);
  console.log(
    "Authorization:",
    details.accessToken
      ? `Bearer ${maskAccessToken(details.accessToken)}`
      : "(none)",
  );

  if (details.body !== undefined) {
    console.log("Body:", details.body);
  }

  console.groupEnd();
}

function logResponse(
  name: string,
  response: Response,
  body: unknown,
  durationMs: number,
) {
  console.group(`${PREMIUM_LOG_PREFIX} ${name} - RESPONSE`);
  console.log("Status:", response.status);
  console.log("Status text:", response.statusText);
  console.log("OK:", response.ok);
  console.log("Duration:", `${durationMs} ms`);
  console.log("Content-Type:", response.headers.get("content-type"));
  console.log("Body:", body);
  console.groupEnd();
}

function logApiError(name: string, error: unknown) {
  console.group(`${PREMIUM_LOG_PREFIX} ${name} - ERROR`);
  console.error(error);

  if (error instanceof Error) {
    console.error("Message:", error.message);
    console.error("Stack:", error.stack);
  }

  console.groupEnd();
}

function resolveApiUrl(path: string) {
  const resolvedUrl = PublicEnv.apiBaseUrl.trim()
    ? buildApiUrl(path)
    : `http://13.158.40.56:8080${path.startsWith("/") ? path : `/${path}`}`;

  console.log(`${PREMIUM_LOG_PREFIX} Resolved URL:`, resolvedUrl);
  return resolvedUrl;
}

function isObject(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}

async function parseResponseBody(response: Response) {
  const rawBody = await response.text();

  console.log(`${PREMIUM_LOG_PREFIX} Raw response body:`, rawBody || "(empty)");

  if (!rawBody) return null;

  try {
    const parsedBody = JSON.parse(rawBody) as unknown;
    console.log(`${PREMIUM_LOG_PREFIX} Parsed response body:`, parsedBody);
    return parsedBody;
  } catch {
    console.warn(
      `${PREMIUM_LOG_PREFIX} Response body is not valid JSON. Returning raw text.`,
    );
    return rawBody;
  }
}

function getErrorMessage(body: unknown, status: number, fallback: string) {
  if (isObject(body)) {
    for (const key of ["message", "error", "detail", "title"]) {
      const candidate = body[key];
      if (typeof candidate === "string" && candidate.trim()) {
        return candidate.trim();
      }
    }
  }

  if (typeof body === "string" && body.trim()) return body.trim();

  return `${fallback} (${status}).`;
}

async function ensureOk<T>(
  response: Response,
  fallback: string,
  requestName: string,
  startedAt: number,
): Promise<T> {
  const body = await parseResponseBody(response);
  const durationMs = Date.now() - startedAt;

  logResponse(requestName, response, body, durationMs);

  if (!response.ok) {
    const message = getErrorMessage(body, response.status, fallback);

    console.error(`${PREMIUM_LOG_PREFIX} ${requestName} failed:`, {
      status: response.status,
      statusText: response.statusText,
      message,
      body,
    });

    throw new Error(message);
  }

  return body as T;
}

function getAuthHeaders(accessToken: string) {
  return { Authorization: `Bearer ${accessToken}` };
}

/**
 * GET /api/user/premium/plans
 * Trả về danh sách gói Premium dành cho Explorer (PlanType.PREMIUM)
 */
export async function getPremiumPlans(
  accessToken: string,
): Promise<PremiumPlan[]> {
  const requestName = "GET PREMIUM PLANS";
  const url = resolveApiUrl("/api/user/premium/plans");
  const startedAt = Date.now();

  logRequest(requestName, {
    method: "GET",
    url,
    accessToken,
  });

  try {
    const response = await fetch(url, {
      headers: getAuthHeaders(accessToken),
    });

    const body = await ensureOk<
      PremiumPlan[] | { content?: PremiumPlan[]; data?: PremiumPlan[] }
    >(
      response,
      "Không lấy được danh sách gói Premium",
      requestName,
      startedAt,
    );

    const plans = Array.isArray(body)
      ? body
      : Array.isArray(body.content)
        ? body.content
        : Array.isArray(body.data)
          ? body.data
          : [];

    console.log(`${PREMIUM_LOG_PREFIX} Raw plans count:`, plans.length);
    console.table(
      plans.map((plan) => ({
        id: plan.subscriptionPlanId,
        name: plan.subscriptionPlanName,
        planType: plan.planType,
        status: plan.status,
        monthly: plan.priceMonthly,
        yearly: plan.priceYearly,
      })),
    );

    const filteredPlans = plans.filter((plan) => {
      const legacyPlanType =
        isObject(plan.configLimit) &&
        typeof plan.configLimit.planType === "string"
          ? plan.configLimit.planType
          : null;

      const planType = (plan.planType ?? legacyPlanType ?? "").toUpperCase();

      const isAccepted =
        plan.status !== "DELETED" &&
        plan.status !== "INACTIVE" &&
        (planType === "" || planType === "PREMIUM");

      console.log(`${PREMIUM_LOG_PREFIX} Plan filter:`, {
        id: plan.subscriptionPlanId,
        name: plan.subscriptionPlanName,
        planType,
        status: plan.status,
        accepted: isAccepted,
      });

      return isAccepted;
    });

    console.log(
      `${PREMIUM_LOG_PREFIX} Filtered Premium plans count:`,
      filteredPlans.length,
    );

    return filteredPlans;
  } catch (error) {
    logApiError(requestName, error);
    throw error;
  }
}

/**
 * POST /api/user/premium/subscribe
 * Đăng ký gói Premium — trả về PaymentInitResponse để mở PayOS
 */
export async function subscribePremium(
  request: PremiumSubscribeRequest,
): Promise<PremiumPaymentInitResponse> {
  const requestName = "SUBSCRIBE PREMIUM";
  const url = resolveApiUrl("/api/user/premium/subscribe");
  const startedAt = Date.now();

  const body = {
    subscriptionPlanId: request.subscriptionPlanId,
    billingCycle: request.billingCycle,
    ...(request.redirectUrl ? { redirectUrl: request.redirectUrl } : {}),
  };

  logRequest(requestName, {
    method: "POST",
    url,
    accessToken: request.accessToken,
    body,
  });

  try {
    const response = await fetch(url, {
      method: "POST",
      headers: {
        ...getAuthHeaders(request.accessToken),
        "Content-Type": "application/json",
      },
      body: JSON.stringify(body),
    });

    const result = await ensureOk<PremiumPaymentInitResponse>(
      response,
      "Đăng ký gói Premium thất bại",
      requestName,
      startedAt,
    );

    console.group(`${PREMIUM_LOG_PREFIX} PAYOS PAYMENT RESULT`);
    console.log("subscriptionId (= invoiceId):", result.subscriptionId);
    console.log("gateway:", result.gateway);
    console.log("amount:", result.amount);
    console.log("checkoutUrl:", result.checkoutUrl);
    console.log("Has qrCode:", Boolean(result.qrCode));
    console.log("orderInfo:", result.orderInfo);
    console.groupEnd();

    return result;
  } catch (error) {
    logApiError(requestName, error);
    throw error;
  }
}

/**
 * GET /api/user/premium/my
 * Lấy lịch sử đăng ký Premium của user hiện tại
 */
export async function getMyPremiumSubscriptions(
  accessToken: string,
): Promise<PremiumSubscriptionRecord[]> {
  const requestName = "GET MY PREMIUM SUBSCRIPTIONS";
  const url = resolveApiUrl("/api/user/premium/my");
  const startedAt = Date.now();

  logRequest(requestName, {
    method: "GET",
    url,
    accessToken,
  });

  try {
    const result = await ensureOk<PremiumSubscriptionRecord[]>(
      await fetch(url, {
        headers: getAuthHeaders(accessToken),
      }),
      "Không lấy được lịch sử Premium",
      requestName,
      startedAt,
    );

    console.log(
      `${PREMIUM_LOG_PREFIX} Subscription history count:`,
      result.length,
    );

    console.table(
      result.map((item) => ({
        invoiceId: item.invoiceId,
        planName: item.planName,
        billingCycle: item.billingCycle,
        status: item.status,
        paymentStatus: item.paymentStatus,
        paidAmount: item.paidAmount,
        startDate: item.startDate,
        endDate: item.endDate,
      })),
    );

    return result;
  } catch (error) {
    logApiError(requestName, error);
    throw error;
  }
}

/**
 * POST /api/user/premium/{invoiceId}/confirm
 *
 * API mới của backend (`PremiumSubscriptionController#confirmPayment`). Khác
 * hẳn việc poll `GET /my`: ở đây backend CHỦ ĐỘNG gọi sang PayOS
 * (`paymentRequests().get(orderCode)`) để đối soát, rồi tự
 * - PAID -> đánh dấu invoice ACTIVE + set `user.isPremium = true`
 * - CANCELLED / EXPIRED / FAILED -> đánh dấu invoice FAILED
 * và trả về invoice sau đối soát.
 *
 * Nhờ vậy app không còn phụ thuộc vào việc webhook PayOS có về kịp hay không —
 * vốn là lý do màn hình phải poll `/my` cả phút mà vẫn hay lỡ.
 *
 * Chỉ dùng được cho invoice của chính user đang đăng nhập và đã khởi tạo thanh
 * toán; BE ném 400 "Hóa đơn chưa được khởi tạo thanh toán" nếu chưa có
 * payosOrderCode, và 400 "Hóa đơn không tồn tại" nếu invoice không thuộc user.
 */
export async function confirmPremiumPayment(
  accessToken: string,
  invoiceId: number,
): Promise<PremiumSubscriptionRecord> {
  const requestName = "CONFIRM PREMIUM PAYMENT";
  const url = resolveApiUrl(`/api/user/premium/${invoiceId}/confirm`);
  const startedAt = Date.now();

  logRequest(requestName, { method: "POST", url, accessToken });

  try {
    const result = await ensureOk<PremiumSubscriptionRecord>(
      await fetch(url, {
        method: "POST",
        headers: getAuthHeaders(accessToken),
      }),
      "Không xác nhận được thanh toán Premium",
      requestName,
      startedAt,
    );

    console.log(`${PREMIUM_LOG_PREFIX} Confirm result:`, {
      endDate: result.endDate,
      invoiceId: result.invoiceId,
      paymentStatus: result.paymentStatus,
      status: result.status,
    });

    return result;
  } catch (error) {
    logApiError(requestName, error);
    throw error;
  }
}