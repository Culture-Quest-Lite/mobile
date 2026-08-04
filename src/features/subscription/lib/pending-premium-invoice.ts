import { readStoredJson, writeStoredJson } from "@/lib/persistent-json-storage";

/**
 * Ghi nhớ invoice Premium đang chờ PayOS xác nhận.
 *
 * App KHÔNG nhận được webhook (PayOS bắn thẳng vào backend qua
 * `POST /api/payment/payos/webhook`), nên để biết "đăng ký thành công chưa" app
 * phải gọi `POST /api/user/premium/{invoiceId}/confirm` — backend sẽ hỏi thẳng
 * PayOS rồi kích hoạt/huỷ invoice. Muốn gọi được API đó thì phải nhớ invoiceId.
 *
 * Phải lưu xuống ổ đĩa chứ không giữ trong ref: khi user rời app sang trình
 * duyệt/app ngân hàng để thanh toán, Android rất hay kill app ở nền. Lúc quay
 * lại là cold start -> mọi state trong RAM mất sạch -> app không còn biết phải
 * đối soát invoice nào -> user thanh toán xong mà màn hình vẫn im lặng.
 */

const STORAGE_KEY = "premium-pending-invoice";

/**
 * Quá thời hạn này mà PayOS vẫn báo chưa thanh toán thì coi như giao dịch bị bỏ
 * dở (user đóng trang thanh toán, hết hạn link PayOS...) và ngừng đối soát,
 * tránh banner "đang chờ xác nhận" treo vĩnh viễn ở các phiên sau.
 */
const PENDING_INVOICE_TTL_MS = 30 * 60 * 1000;

type StoredPendingInvoice = {
  invoiceId: number;
  /** Epoch ms lúc tạo invoice, dùng để tính TTL. */
  createdAt: number;
};

export function readPendingPremiumInvoiceId(): number | null {
  const stored = readStoredJson<StoredPendingInvoice | null>(STORAGE_KEY, null);

  if (!stored || typeof stored.invoiceId !== "number") return null;

  if (Date.now() - stored.createdAt > PENDING_INVOICE_TTL_MS) {
    clearPendingPremiumInvoice();
    return null;
  }

  return stored.invoiceId;
}

export function savePendingPremiumInvoice(invoiceId: number) {
  writeStoredJson(STORAGE_KEY, {
    createdAt: Date.now(),
    invoiceId,
  } satisfies StoredPendingInvoice);
}

export function clearPendingPremiumInvoice() {
  writeStoredJson(STORAGE_KEY, null);
}
