import { PublicEnv, buildApiUrl } from "@/constants/env";

export type VoucherDiscountType = "PERCENTAGE" | "FIXED_AMOUNT" | string;
export type VoucherStatus =
  | "ACTIVE"
  | "PENDING"
  | "INACTIVE"
  | "EXPIRED"
  | "DELETED"
  | string;

/** Khớp `VoucherResponse.java`. */
export type Voucher = {
  voucherId: number;
  /** Backend trả về MỘT ảnh ở `imageUrl`, không có mảng `medias`. */
  imageUrl?: string | null;
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

/** Khớp `VoucherUsageResponse.java`. */
export type VoucherUsage = {
  voucherUsageId: number;
  voucherId: number;
  /** Mã chung của chiến dịch voucher — MỌI người đổi đều có mã này. */
  voucherCode: string;
  /**
   * Mã riêng của từng lượt đổi (base62, 10 ký tự) do backend sinh ở
   * `VoucherUsageUtils.generateToken`. Đây mới là mã người dùng đưa cho đối tác.
   */
  voucherUsageCode?: string | null;
  voucherName: string;
  description?: string | null;
  pointsRequired: number;
  redeemedAt: string;
  usedAt?: string | null;
  expiredAt?: string | null;
  isUsed: boolean;
};

export type VoucherUsagePage = {
  content: VoucherUsage[];
  number: number;
  size: number;
  totalElements: number;
  totalPages: number;
  first?: boolean;
  last?: boolean;
};

/** Khớp `VoucherFilter.java`. */
export type AvailableVoucherParams = {
  search?: string;
  status?: VoucherStatus;
  partnerId?: number;
  page?: number;
  size?: number;
  sortBy?: string;
  sortDir?: "asc" | "desc";
};

/**
 * Khớp `AdvanceVoucherFilter.java` — dùng cho `GET /api/vouchers/filter`.
 *
 * Backend gom toạ độ của các hotspot (từ `routeId` và/hoặc `hotspotIds`) rồi
 * tìm `partner_info` nằm trong bán kính `distanceMeters` quanh BẤT KỲ điểm nào,
 * sau đó trả voucher của các đối tác đó.
 *
 * Ba điều kiện bắt buộc phải biết khi gọi:
 *
 * 1. `distanceMeters` và `status` có `@NotNull` — thiếu là 400.
 * 2. `latitude`/`longitude` HIỆN KHÔNG có tác dụng. `VoucherServiceImpl#getByFilter`
 *    viết `if (longitude == null && latitude == null)` (đúng ra phải là `!=`), nên
 *    toạ độ người dùng bị bỏ qua, còn khi không gửi toạ độ thì backend lại nhét
 *    một `Point` null vào danh sách → `cb.literal(null)` → 500.
 *    ⇒ Client BẮT BUỘC phải gửi `routeId` hoặc `hotspotIds`, và tự quy đổi
 *    "gần tôi" thành danh sách hotspot gần tôi (xem `use-nearby-vouchers.ts`).
 * 3. Endpoint này KHÔNG lọc số lượng còn lại và hạn dùng như `/available`,
 *    nên phải lọc lại bằng `filterRedeemableVouchers`.
 */
export type NearbyVoucherParams = {
  routeId?: number | null;
  hotspotIds?: number[];
  distanceMeters: number;
  status?: VoucherStatus;
  page?: number;
  size?: number;
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
  // Lưu ý: `/api/vouchers/available` bên backend tự dựng specification riêng
  // (ACTIVE + còn số lượng + trong thời gian hiệu lực) và BỎ QUA search/
  // partnerId/status — chỉ page/size/sortBy/sortDir là có tác dụng. Vẫn gửi
  // lên để khi backend hỗ trợ thì không phải sửa lại client.
  // `GET /api/vouchers/**` nằm trong `PUBLIC_GET_ENDPOINTS` nên `accessToken`
  // là tuỳ chọn — khách chưa đăng nhập vẫn xem được danh sách.
  if (params.search?.trim()) query.set("search", params.search.trim());
  if (params.status) query.set("status", params.status);
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

/**
 * Voucher người dùng đã đổi — `GET /api/users/my-vouchers`.
 * Backend đổi `sortBy=createdAt` thành `redeemedAt`, nên để mặc định là được.
 */
export async function getMyRedeemedVouchers(
  params: AvailableVoucherParams = {},
  accessToken: string,
) {
  const query = new URLSearchParams();
  query.set("page", String(params.page ?? 0));
  query.set("size", String(params.size ?? 20));
  query.set("sortBy", params.sortBy ?? "redeemedAt");
  query.set("sortDir", params.sortDir ?? "desc");

  const response = await fetch(
    resolveApiUrl(`/api/users/my-vouchers?${query.toString()}`),
    { headers: { Authorization: `Bearer ${accessToken}` } },
  );
  return ensureOk<VoucherUsagePage>(
    response,
    "Không lấy được voucher của bạn",
  );
}

/**
 * Voucher của các đối tác nằm gần một tuyến / một nhóm hotspot.
 * Đọc kỹ ghi chú ở `NearbyVoucherParams` trước khi đổi tham số.
 */
export async function getNearbyVouchers(
  params: NearbyVoucherParams,
  accessToken?: string | null,
) {
  const hotspotIds = params.hotspotIds?.filter((id) => Number.isFinite(id)) ?? [];

  if (params.routeId == null && hotspotIds.length === 0) {
    // Gọi mà không có mốc nào thì backend ném 500 (xem ghi chú (2) ở trên),
    // nên chặn ngay tại client cho thông báo dễ hiểu.
    throw new Error("Cần ít nhất một tuyến hoặc một địa điểm để tìm ưu đãi.");
  }

  const query = new URLSearchParams();
  if (params.routeId != null) query.set("routeId", String(params.routeId));
  for (const hotspotId of hotspotIds) {
    query.append("hotspotIds", String(hotspotId));
  }
  query.set("distanceMeters", String(params.distanceMeters));
  query.set("status", params.status ?? "ACTIVE");
  query.set("page", String(params.page ?? 0));
  query.set("size", String(params.size ?? 20));

  const response = await fetch(
    resolveApiUrl(`/api/vouchers/filter?${query.toString()}`),
    {
      headers: accessToken
        ? { Authorization: `Bearer ${accessToken}` }
        : undefined,
    },
  );
  return ensureOk<VoucherPage>(response, "Không lấy được ưu đãi gần đây");
}

/**
 * `/api/vouchers/filter` chỉ lọc theo `status`, không kiểm tra số lượng còn lại
 * và khoảng thời gian hiệu lực như `/api/vouchers/available`. Lọc lại ở client
 * để không hiển thị voucher đã hết hoặc chưa/hết hạn.
 */
export function filterRedeemableVouchers(vouchers: Voucher[]) {
  const now = Date.now();

  return vouchers.filter((voucher) => {
    if (voucher.status !== "ACTIVE" || voucher.quantityRemaining <= 0) {
      return false;
    }

    const startAt = new Date(voucher.startDate).getTime();
    const endAt = new Date(voucher.endDate).getTime();

    if (Number.isFinite(startAt) && startAt > now) return false;
    if (Number.isFinite(endAt) && endAt < now) return false;

    return true;
  });
}

export function getVoucherImage(voucher: Voucher) {
  return voucher.imageUrl?.trim() ? voucher.imageUrl : null;
}

/**
 * Mã đưa cho đối tác quét/nhập. Ưu tiên `voucherUsageCode` (mã riêng từng lượt
 * đổi); `voucherCode` chỉ là fallback cho bản backend cũ chưa có trường này.
 */
export function getVoucherRedeemCode(usage: VoucherUsage) {
  return usage.voucherUsageCode?.trim() || usage.voucherCode;
}

export function isVoucherUsageExpired(usage: VoucherUsage) {
  if (usage.isUsed || !usage.expiredAt) return false;
  return new Date(usage.expiredAt).getTime() < Date.now();
}

export type VoucherPartnerGroup = {
  partnerId: number;
  partnerName: string;
  count: number;
};

/**
 * Gom voucher theo đối tác để dựng bộ lọc "quán".
 *
 * Đây là thứ duy nhất liên quan tới "địa điểm" mà client làm được lúc này:
 * `VoucherResponse` chỉ có `partnerId`/`partnerName`, KHÔNG có `address` hay
 * toạ độ (`partner_info.location` chỉ lộ qua endpoint dành cho PARTNER/ADMIN).
 * Muốn lọc theo khoảng cách hoặc theo tuyến thì bắt buộc backend phải trả thêm
 * toạ độ quán — xem ghi chú ở `getAvailableVouchers`.
 */
export function groupVouchersByPartner(
  vouchers: Voucher[],
): VoucherPartnerGroup[] {
  const groups = new Map<number, VoucherPartnerGroup>();

  for (const voucher of vouchers) {
    const existing = groups.get(voucher.partnerId);
    if (existing) {
      existing.count += 1;
      continue;
    }
    groups.set(voucher.partnerId, {
      partnerId: voucher.partnerId,
      partnerName: voucher.partnerName,
      count: 1,
    });
  }

  return [...groups.values()].sort((a, b) =>
    b.count - a.count || a.partnerName.localeCompare(b.partnerName, "vi"),
  );
}

/** Backend chưa lọc theo từ khoá ở `/available`, nên lọc tại client. */
export function filterVouchersByKeyword(vouchers: Voucher[], keyword: string) {
  const normalized = keyword.trim().toLowerCase();

  if (!normalized) {
    return vouchers;
  }

  return vouchers.filter((voucher) =>
    [voucher.voucherName, voucher.partnerName, voucher.description]
      .filter((value): value is string => Boolean(value))
      .some((value) => value.toLowerCase().includes(normalized)),
  );
}
