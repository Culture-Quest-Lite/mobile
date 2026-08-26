
import { PublicEnv, buildApiUrl } from "@/constants/env";
import axios from "axios";
export type BillingCycle = "MONTHLY" | "YEARLY";
export type PaymentGateway = "PAYOS";
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
  planType?: string | null;
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

/** `PartnerSubscriptionResponse.MediaDto` — ảnh shop đã upload lên S3. */
export type PartnerSubscriptionMedia = {
  fileName?: string | null;
  fileUrl: string;
  mediaId: number;
  mediaType?: string | null;
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
  /** Chỉ có trong response của bước đăng ký (khi có gửi kèm ảnh shop). */
  medias?: PartnerSubscriptionMedia[] | null;
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
  paymentUrl?: string | null;
  deeplink?: string | null;
  gateway: PaymentGateway;
  orderInfo?: string | null;
  payUrl?: string | null;
  qrCode?: string | null;
  qrCodeUrl?: string | null;
  subscriptionId?: number | null;
  invoiceId?: number | null;
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
    uri: file.uri,
    name: file.name,
    type: file.type,
  } as any);
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

export async function registerPartnerSubscription(
  request: RegisterPartnerSubscriptionRequest,
) {
  const formData = new FormData();

  formData.append("subscriptionPlanId", String(request.subscriptionPlanId));
  formData.append("shopName", request.shopName.trim());
  formData.append("shopEmail", request.shopEmail.trim());
  formData.append("address", request.address.trim());
  formData.append("longitude", String(request.longitude));
  formData.append("latitude", String(request.latitude));
  formData.append("billingCycle", request.billingCycle);

  appendFile(formData, "documentFile", request.documentFile);
  // Tên field PHẢI là `files`: `PartnerSubscriptionRequest` bên BE khai báo
  // `MultipartFile[] files` và bind bằng @ModelAttribute, nên mọi tên khác
  // (trước đây gửi "shopFiles") bị bỏ qua âm thầm -> ảnh shop không được upload.
  request.files?.forEach((file) => appendFile(formData, "files", file));

  try {
    console.log("========== REGISTER PARTNER ==========");
    console.log("URL:", resolveApiUrl("/api/partner/subscriptions/register"));
    console.log("subscriptionPlanId:", request.subscriptionPlanId);
    console.log("shopName:", request.shopName);
    console.log("shopEmail:", request.shopEmail);
    console.log("address:", request.address);
    console.log("billingCycle:", request.billingCycle);
    console.log("longitude:", request.longitude);
    console.log("latitude:", request.latitude);

    console.log("documentFile:", request.documentFile);

    console.log("files:", request.files);

    const response = await axios.post<PartnerSubscription>(
      resolveApiUrl("/api/partner/subscriptions/register"),
      formData,
      {
        headers: {
          Authorization: `Bearer ${request.accessToken}`,
          // bỏ Content-Type
        },
        transformRequest: (data) => data,
      },
    );

    console.log("REGISTER SUCCESS");
    console.log(response.status);
    console.log(response.data);

    return response.data;
  } catch (error: any) {
    console.log("========== REGISTER FAILED ==========");

    console.log("status:", error?.response?.status);

    console.log("headers:");
    console.log(error?.response?.headers);

    console.log("response data:");
    console.log(error?.response?.data);

    console.log("request:");
    console.log(error?.config);

    console.log("message:");
    console.log(error?.message);

    throw new Error(
      error?.response?.data?.message ||
      error?.response?.data?.error ||
      error?.message ||
      "Đăng ký gói Partner thất bại",
    );
  }
}

export async function initiatePayOsPayment({
  accessToken,
  redirectUrl,
  subscriptionId,
}: {
  accessToken: string;
  redirectUrl?: string;
  subscriptionId?: number | null;
  invoiceId?: number | null;
}) {
  const searchParams = new URLSearchParams({ gateway: "PAYOS" });

  if (redirectUrl?.trim()) {
    searchParams.set("redirectUrl", redirectUrl.trim());
  }

  const url = resolveApiUrl(
    `/api/partner/subscriptions/${subscriptionId}/initiate-payment?${searchParams.toString()}`,
  );

  // Bước này trước đây không log gì cả, nên khi đăng ký xong mà không ra được
  // link thanh toán thì log chỉ dừng ở "REGISTER SUCCESS" — không biết hỏng ở
  // đâu. Endpoint yêu cầu role PARTNER nên 403 là lỗi rất dễ gặp.
  console.log("========== INITIATE PAYOS (PARTNER) ==========");
  console.log("URL:", url);
  console.log("subscriptionId:", subscriptionId);

  const response = await fetch(url, {
    headers: getAuthHeaders(accessToken),
    method: "POST",
  });

  console.log("status:", response.status);

  return ensureOk<PaymentInitResponse>(response, "Không khởi tạo được thanh toán PayOS");
}

/**
 * GET /api/partner/subscriptions/my — `@PreAuthorize("hasRole('PARTNER')")`.
 *
 * LƯU Ý: tài khoản Explorer vừa đăng ký gói ở app KHÔNG gọi được API này (403).
 * Khi admin duyệt hồ sơ, backend tạo một tài khoản Partner RIÊNG theo
 * `shopEmail` (`PartnerSubscriptionServiceImpl#createPartnerSubAccount`) —
 * quyền PARTNER nằm ở tài khoản đó, không phải tài khoản đang đăng nhập trên
 * mobile.
 */
export async function getMyPartnerSubscriptions(accessToken: string) {
  const response = await fetch(resolveApiUrl("/api/partner/subscriptions/my"), {
    headers: getAuthHeaders(accessToken),
  });

  return ensureOk<PartnerSubscription[]>(response, "Không lấy được trạng thái đăng ký Partner");
}

/**
 * POST /api/partner/subscriptions/{id}/cancel — hủy GIA HẠN gói Partner.
 *
 * Giống Premium: backend chỉ set `willCancelAtEnd` + `canceledAt` trên invoice,
 * shop và quyền lợi Partner vẫn chạy tới hết `endDate` rồi
 * `PartnerExpiryScheduler` mới tắt.
 *
 * Cũng yêu cầu role PARTNER nên chỉ dùng được từ tài khoản shop (xem ghi chú ở
 * `getMyPartnerSubscriptions`), vì vậy chưa có màn hình nào trong app gọi tới.
 * Giữ ở đây để lớp API khớp với backend khi mobile mở luồng cho tài khoản shop.
 */
export async function cancelPartnerSubscription({
  accessToken,
  reason,
  subscriptionId,
}: {
  accessToken: string;
  reason?: string;
  subscriptionId: number;
}) {
  const response = await fetch(
    resolveApiUrl(`/api/partner/subscriptions/${subscriptionId}/cancel`),
    {
      body: JSON.stringify({ reason: reason?.trim() ?? "" }),
      headers: {
        ...getAuthHeaders(accessToken),
        "Content-Type": "application/json",
      },
      method: "POST",
    },
  );

  return ensureOk<PartnerSubscription>(response, "Không hủy được gia hạn gói Đối tác");
}
