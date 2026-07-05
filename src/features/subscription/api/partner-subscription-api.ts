import { Platform } from "react-native";

import { PublicEnv, buildApiUrl } from "@/constants/env";

export type BillingCycle = "MONTHLY" | "YEARLY";
export type PaymentGateway = "MOMO" | "PAYOS";
export type PartnerSubscriptionStatus =
  | "PAYMENT_PENDING"
  | "PAYMENT_FAILED"
  | "PENDING"
  | "ACTIVE"
  | "REJECTED"
  | "REFUND"
  | "EXPIRED";

export type UploadFile = {
  name: string;
  type: string;
  uri: string;
};

export type SubscriptionPlan = {
  configLimit?: Record<string, unknown> | null;
  createdAt?: string | null;
  priceMonthly?: number | null;
  priceYearly?: number | null;
  status?: string | null;
  subscriptionPlanDescription?: string | null;
  subscriptionPlanId: number;
  subscriptionPlanName: string;
  updatedAt?: string | null;
};

export type SubscriptionPlanPage = {
  content: SubscriptionPlan[];
  number?: number;
  size?: number;
  totalElements?: number;
  totalPages?: number;
};

export type PartnerSubscription = {
  address: string;
  billingCycle?: BillingCycle | null;
  documentUrl?: string | null;
  endDate?: string | null;
  id: number;
  isVerified?: boolean | null;
  latitude: number;
  longitude: number;
  partnerId?: number | null;
  partnerName?: string | null;
  shopName: string;
  startDate?: string | null;
  status: PartnerSubscriptionStatus;
  subscriptionPlanId: number;
  subscriptionPlanName?: string | null;
};

export type PaymentInitResponse = {
  amount?: number | null;
  checkoutUrl?: string | null;
  deeplink?: string | null;
  gateway: PaymentGateway;
  orderInfo?: string | null;
  payUrl?: string | null;
  qrCode?: string | null;
  qrCodeUrl?: string | null;
  subscriptionId: number;
};

export type RegisterPartnerSubscriptionRequest = {
  accessToken: string;
  address: string;
  billingCycle: BillingCycle;
  documentFile: UploadFile;
  files?: UploadFile[];
  latitude: number;
  longitude: number;
  shopEmail: string;
  shopName: string;
  subscriptionPlanId: number;
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

  if (!rawBody) {
    return null;
  }

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

  if (typeof body === "string" && body.trim()) {
    return body.trim();
  }

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
  return {
    Authorization: `Bearer ${accessToken}`,
  };
}

function appendFile(formData: FormData, fieldName: string, file: UploadFile) {
  formData.append(fieldName, {
    name: file.name,
    type: file.type,
    uri: Platform.OS === "ios" ? file.uri.replace("file://", "") : file.uri,
  } as unknown as Blob);
}

export async function getSubscriptionPlans(accessToken: string) {
  const response = await fetch(resolveApiUrl("/api/admin/subscription-plans?status=ACTIVE"), {
    headers: getAuthHeaders(accessToken),
  });

  return ensureOk<SubscriptionPlanPage>(response, "Không lấy được danh sách gói đăng ký");
}

export async function getSubscriptionPlanDetail(planId: number, accessToken: string) {
  const response = await fetch(resolveApiUrl(`/api/partner/subscriptions/${planId}`), {
    headers: getAuthHeaders(accessToken),
  });

  return ensureOk<SubscriptionPlan>(response, "Không lấy được chi tiết gói đăng ký");
}

export async function registerPartnerSubscription(request: RegisterPartnerSubscriptionRequest) {
  const formData = new FormData();

  formData.append("subscriptionPlanId", String(request.subscriptionPlanId));
  formData.append("shopName", request.shopName.trim());
  formData.append("shopEmail", request.shopEmail.trim());
  formData.append("address", request.address.trim());
  formData.append("longitude", String(request.longitude));
  formData.append("latitude", String(request.latitude));
  formData.append("billingCycle", request.billingCycle);
  appendFile(formData, "documentFile", request.documentFile);
  request.files?.forEach((file) => appendFile(formData, "files", file));

  const response = await fetch(resolveApiUrl("/api/partner/subscriptions/register"), {
    body: formData,
    headers: getAuthHeaders(request.accessToken),
    method: "POST",
  });

  return ensureOk<PartnerSubscription>(response, "Đăng ký gói Partner thất bại");
}

export async function initiateMomoPayment({
  accessToken,
  redirectUrl,
  subscriptionId,
}: {
  accessToken: string;
  redirectUrl?: string;
  subscriptionId: number;
}) {
  const searchParams = new URLSearchParams({ gateway: "MOMO" });

  if (redirectUrl?.trim()) {
    searchParams.set("redirectUrl", redirectUrl.trim());
  }

  const response = await fetch(
    resolveApiUrl(`/api/partner/subscriptions/${subscriptionId}/initiate-payment?${searchParams.toString()}`),
    {
      headers: getAuthHeaders(accessToken),
      method: "POST",
    },
  );

  return ensureOk<PaymentInitResponse>(response, "Không khởi tạo được thanh toán MoMo");
}

export async function getMyPartnerSubscriptions(accessToken: string) {
  const response = await fetch(resolveApiUrl("/api/partner/subscriptions/my"), {
    headers: getAuthHeaders(accessToken),
  });

  return ensureOk<PartnerSubscription[]>(response, "Không lấy được trạng thái đăng ký Partner");
}
