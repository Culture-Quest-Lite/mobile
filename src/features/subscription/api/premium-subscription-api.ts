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

export type PremiumPaymentInitResponse = {
  subscriptionId: number;
  gateway: string;
  checkoutUrl?: string | null;
  qrCode?: string | null;
  payUrl?: string | null;
  deeplink?: string | null;
  qrCodeUrl?: string | null;
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

function resolveApiUrl(path: string) {
  if (PublicEnv.apiBaseUrl.trim()) {
    return buildApiUrl(path);
  }
  return `http://13.158.40.56:8080${path.startsWith("/") ? path : `/${path}`}`;
}

function isObject(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}

async function parseResponseBody(response: Response) {
  const rawBody = await response.text();
  if (!rawBody) return null;
  try {
    return JSON.parse(rawBody) as unknown;
  } catch {
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

async function ensureOk<T>(response: Response, fallback: string): Promise<T> {
  const body = await parseResponseBody(response);
  if (!response.ok) {
    throw new Error(getErrorMessage(body, response.status, fallback));
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
  const response = await fetch(resolveApiUrl("/api/user/premium/plans"), {
    headers: getAuthHeaders(accessToken),
  });
  return ensureOk<PremiumPlan[]>(
    response,
    "Không lấy được danh sách gói Premium",
  );
}

/**
 * POST /api/user/premium/subscribe
 * Đăng ký gói Premium — trả về PaymentInitResponse để mở PayOS
 */
export async function subscribePremium(
  request: PremiumSubscribeRequest,
): Promise<PremiumPaymentInitResponse> {
  const body = {
    subscriptionPlanId: request.subscriptionPlanId,
    billingCycle: request.billingCycle,
    ...(request.redirectUrl ? { redirectUrl: request.redirectUrl } : {}),
  };

  const response = await fetch(resolveApiUrl("/api/user/premium/subscribe"), {
    method: "POST",
    headers: {
      ...getAuthHeaders(request.accessToken),
      "Content-Type": "application/json",
    },
    body: JSON.stringify(body),
  });
  return ensureOk<PremiumPaymentInitResponse>(
    response,
    "Đăng ký gói Premium thất bại",
  );
}

/**
 * GET /api/user/premium/my
 * Lấy lịch sử đăng ký Premium của user hiện tại
 */
export async function getMyPremiumSubscriptions(
  accessToken: string,
): Promise<PremiumSubscriptionRecord[]> {
  const response = await fetch(resolveApiUrl("/api/user/premium/my"), {
    headers: getAuthHeaders(accessToken),
  });
  return ensureOk<PremiumSubscriptionRecord[]>(
    response,
    "Không lấy được lịch sử Premium",
  );
}
