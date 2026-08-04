import { PublicEnv, buildApiUrl } from "@/constants/env";

export type VoucherDiscountType = "PERCENTAGE" | "FIXED_AMOUNT" | string;
export type VoucherStatus = "ACTIVE" | "PENDING" | "INACTIVE" | "DELETED" | string;

export type VoucherMedia = {
  mediaId?: number;
  url?: string;
  mediaUrl?: string;
  fileUrl?: string;
  type?: string;
};

export type Voucher = {
  voucherId: number;
  medias?: VoucherMedia[];
  partnerId: number;
  partnerName: string;
  voucherCode: string;
  voucherName: string;
  description?: string | null;
  discountType: VoucherDiscountType;
  discountValue: number;
  maxDiscountAmount?: number | null;
  minOrderAmount?: number | null;
  pointsRequired: number;
  quantityTotal: number;
  quantityRemaining: number;
  status: VoucherStatus;
  startDate: string;
  endDate: string;
  createdAt?: string;
  updatedAt?: string | null;
};

export type VoucherPage = {
  content: Voucher[];
  number: number;
  size: number;
  totalElements: number;
  totalPages: number;
  first?: boolean;
  last?: boolean;
};

export type VoucherUsage = {
  voucherUsageId: number;
  voucherId: number;
  voucherCode: string;
  voucherName: string;
  description?: string | null;
  pointsRequired: number;
  redeemedAt: string;
  usedAt?: string | null;
  expiredAt: string;
  isUsed: boolean;
};

export type AvailableVoucherParams = {
  search?: string;
  partnerId?: number;
  page?: number;
  size?: number;
  sortBy?: string;
  sortDir?: "asc" | "desc";
};

function resolveApiUrl(path: string) {
  if (PublicEnv.apiBaseUrl.trim()) return buildApiUrl(path);
  return `http://13.158.40.56:8080${path.startsWith("/") ? path : `/${path}`}`;
}

async function parseBody(response: Response) {
  const text = await response.text();
  if (!text) return null;
  try { return JSON.parse(text) as unknown; } catch { return text; }
}

function errorMessage(body: unknown, status: number, fallback: string) {
  if (body && typeof body === "object") {
    const object = body as Record<string, unknown>;
    for (const key of ["message", "error", "detail", "title"]) {
      if (typeof object[key] === "string" && object[key]) return object[key] as string;
    }
  }
  return typeof body === "string" && body.trim() ? body : `${fallback} (${status}).`;
}

async function ensureOk<T>(response: Response, fallback: string): Promise<T> {
  const body = await parseBody(response);
  if (!response.ok) throw new Error(errorMessage(body, response.status, fallback));
  return body as T;
}

export async function getAvailableVouchers(
  params: AvailableVoucherParams = {},
  accessToken?: string | null,
) {
  const query = new URLSearchParams();
  if (params.search?.trim()) query.set("search", params.search.trim());
  if (params.partnerId) query.set("partnerId", String(params.partnerId));
  query.set("page", String(params.page ?? 0));
  query.set("size", String(params.size ?? 20));
  query.set("sortBy", params.sortBy ?? "createdAt");
  query.set("sortDir", params.sortDir ?? "desc");

  const response = await fetch(
    resolveApiUrl(`/api/vouchers/available?${query.toString()}`),
    {
      headers: accessToken
        ? { Authorization: `Bearer ${accessToken}` }
        : undefined,
    },
  );
  return ensureOk<VoucherPage>(response, "Không lấy được danh sách voucher");
}

export async function getVoucherById(
  voucherId: number,
  accessToken?: string | null,
) {
  const response = await fetch(resolveApiUrl(`/api/vouchers/${voucherId}`), {
    headers: accessToken
      ? { Authorization: `Bearer ${accessToken}` }
      : undefined,
  });
  return ensureOk<Voucher>(response, "Không lấy được thông tin voucher");
}

export async function redeemVoucher(voucherId: number, accessToken: string) {
  const response = await fetch(resolveApiUrl(`/api/vouchers/${voucherId}/redeem`), {
    method: "POST",
    headers: { Authorization: `Bearer ${accessToken}` },
  });
  return ensureOk<VoucherUsage>(response, "Không thể đổi voucher");
}

export function getVoucherImage(voucher: Voucher) {
  const media = voucher.medias?.[0];
  return media?.url ?? media?.mediaUrl ?? media?.fileUrl ?? null;
}
