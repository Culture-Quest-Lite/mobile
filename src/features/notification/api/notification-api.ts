import { PublicEnv, buildApiUrl } from "@/constants/env";

export type NotificationType =
  | "EARN"
  | "SYSTEM"
  | "SUBSCRIPTION"
  | "CHECK_IN"
  | "ROUTE"
  | "POST"
  | string;

export type AppNotification = {
  id: number;
  title: string;
  message: string;
  isRead: boolean;
  createdAt: string;
  notificationType: NotificationType;
  referenceId?: number | null;
};

export type NotificationPage = {
  content: AppNotification[];
  number: number;
  size: number;
  totalElements: number;
  totalPages: number;
  first?: boolean;
  last?: boolean;
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

export async function getMyNotifications(
  accessToken: string,
  page = 0,
  size = 20,
): Promise<NotificationPage> {
  const response = await fetch(
    resolveApiUrl(`/api/notifications?page=${page}&size=${size}&sort=createdAt,desc`),
    { headers: getAuthHeaders(accessToken) },
  );

  return ensureOk<NotificationPage>(response, "Không lấy được danh sách thông báo");
}

export async function getUnreadNotificationCount(accessToken: string) {
  const response = await fetch(resolveApiUrl("/api/notifications/unread-count"), {
    headers: getAuthHeaders(accessToken),
  });

  return ensureOk<number>(response, "Không lấy được số thông báo chưa đọc");
}

export async function markNotificationAsRead(
  notificationId: number,
  accessToken: string,
) {
  const response = await fetch(
    resolveApiUrl(`/api/notifications/${notificationId}/read`),
    {
      headers: getAuthHeaders(accessToken),
      method: "PATCH",
    },
  );

  return ensureOk<string>(response, "Không thể đánh dấu thông báo đã đọc");
}

export async function registerNotificationDeviceToken(
  token: string,
  accessToken: string,
) {
  const response = await fetch(resolveApiUrl("/api/notifications/token"), {
    method: "POST",
    headers: {
      ...getAuthHeaders(accessToken),
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ token: token.trim() }),
  });

  return ensureOk<string>(response, "Không thể đăng ký thiết bị nhận thông báo");
}
