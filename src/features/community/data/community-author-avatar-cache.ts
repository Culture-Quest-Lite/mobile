import { useSyncExternalStore } from "react";

/**
 * Ảnh đại diện của tác giả bài viết trên bảng tin cộng đồng.
 *
 * Vì sao phải có module này: `PostResponse` bên backend KHÔNG trả ảnh đại diện
 * của người đăng — chỉ có `userId`, `username`, `displayName`. Bảng tin vì thế
 * không có cách nào biết ảnh nếu không hỏi thêm `GET /api/users/{id}`.
 *
 * Khi backend bổ sung `avatarUrl` vào `PostResponse` thì đọc thẳng từ bài viết
 * và xoá được toàn bộ file này cùng effect gọi API ở màn cộng đồng.
 *
 * Cache sống theo vòng đời app: mỗi tác giả chỉ hỏi ĐÚNG MỘT LẦN dù cuộn bao
 * nhiêu trang hay quay qua lại giữa các màn. `null` nghĩa là đã hỏi xong và
 * người đó không có ảnh — vẫn lưu để khỏi hỏi lại.
 */

const avatarByAuthorId = new Map<string, string | null>();
/** Các id đang bay giữa đường, giữ để hai lần render không cùng gọi một người. */
const pendingAuthorIds = new Set<string>();
const listeners = new Set<() => void>();

function emitChange() {
  listeners.forEach((listener) => {
    listener();
  });
}

function subscribe(listener: () => void) {
  listeners.add(listener);

  return () => {
    listeners.delete(listener);
  };
}

/** Chỉ id toàn chữ số mới gọi được `/api/users/{id}`; bài demo dùng slug chữ. */
export function isResolvableCommunityAuthorId(
  authorId?: string | null,
): authorId is string {
  return typeof authorId === "string" && /^\d+$/.test(authorId.trim());
}

/**
 * Lọc ra những tác giả CHƯA có ảnh và CHƯA đang gọi, đồng thời đánh dấu chúng
 * là đang gọi. Gọi hàm này ngay trước khi bắn request.
 */
export function takeUnresolvedCommunityAuthorIds(authorIds: readonly string[]) {
  const unresolvedIds: string[] = [];

  for (const authorId of authorIds) {
    const normalizedId = authorId.trim();

    if (
      !isResolvableCommunityAuthorId(normalizedId) ||
      avatarByAuthorId.has(normalizedId) ||
      pendingAuthorIds.has(normalizedId)
    ) {
      continue;
    }

    pendingAuthorIds.add(normalizedId);
    unresolvedIds.push(normalizedId);
  }

  return unresolvedIds;
}

export function setCommunityAuthorAvatar(
  authorId: string,
  avatarUri: string | null,
) {
  const normalizedId = authorId.trim();
  pendingAuthorIds.delete(normalizedId);

  if (avatarByAuthorId.get(normalizedId) === avatarUri) {
    return;
  }

  avatarByAuthorId.set(normalizedId, avatarUri);
  emitChange();
}

/**
 * Bỏ đánh dấu đang gọi mà KHÔNG ghi giá trị — dùng khi request hỏng, để lần
 * bảng tin đổi sau còn thử lại thay vì kẹt vĩnh viễn ở chữ cái đầu.
 */
export function releaseCommunityAuthorIds(authorIds: readonly string[]) {
  for (const authorId of authorIds) {
    pendingAuthorIds.delete(authorId.trim());
  }
}

export function useCommunityAuthorAvatar(authorId?: string | null) {
  const normalizedId = authorId?.trim() ?? "";

  return useSyncExternalStore(
    subscribe,
    () => (normalizedId ? (avatarByAuthorId.get(normalizedId) ?? null) : null),
    () => null,
  );
}
