import { useCallback, useSyncExternalStore } from "react";
import { type Href, useRouter } from "expo-router";

import { getValidAccessToken, useAuthSession } from "@/features/auth/hooks/use-auth-session";
import { getMyProfile } from "@/features/profile/api/get-me";
import { routeSystemAlert } from "@/features/route/components/route-system-alert";

/**
 * Nguồn "isPremium" DÙNG CHUNG cho cả app.
 *
 * Trước đây mỗi màn hình (home, explore, record-journey...) tự gọi
 * `getMyProfile()` rồi tự giữ một biến `isPremium` cục bộ -> vừa gọi API
 * trùng lặp, vừa dễ bị lệch dữ liệu giữa các màn (VD: user vừa mua Premium ở
 * màn subscription nhưng màn record vẫn tưởng chưa Premium vì chưa refetch).
 *
 * File này tạo 1 store singleton (giống pattern của `useAuthSession`,
 * dùng `useSyncExternalStore`) để toàn bộ app đọc chung 1 giá trị isPremium,
 * và cung cấp sẵn `requirePremium()` để chặn nhanh mọi hành động/màn hình
 * Premium sau này mà không phải viết lại logic alert + điều hướng.
 *
 * Cách dùng khi thêm 1 tính năng Premium mới:
 *
 *   const { isPremium, ensureLoaded, requirePremium } = usePremiumStatus();
 *   useEffect(() => { void ensureLoaded(); }, [ensureLoaded]);
 *   ...
 *   onPress={() => { if (!requirePremium("Tên tính năng")) return; ...; }}
 */

export type PremiumStatusState = {
  isPremium: boolean;
  isLoading: boolean;
  /** Đã fetch thành công ít nhất 1 lần cho phiên đăng nhập hiện tại chưa. */
  isLoaded: boolean;
};

const initialState: PremiumStatusState = {
  isPremium: false,
  isLoading: false,
  isLoaded: false,
};

let state: PremiumStatusState = initialState;
const listeners = new Set<() => void>();
let inflightPromise: Promise<boolean> | null = null;

function emitChange() {
  listeners.forEach((listener) => listener());
}

function setState(next: Partial<PremiumStatusState>) {
  state = { ...state, ...next };
  emitChange();
}

function subscribe(listener: () => void) {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}

function getSnapshot() {
  return state;
}

/** Reset cache dùng chung, gọi khi user logout hoặc phiên đăng nhập hết hạn. */
export function resetPremiumStatus() {
  inflightPromise = null;
  state = initialState;
  emitChange();
}

/**
 * Đẩy isPremium mới nhất (đã biết từ 1 API khác, VD màn hình home/explore đã
 * tự gọi getMyProfile() cho mục đích riêng) vào cache dùng chung, để các
 * màn/hành động Premium khác trong app đồng bộ theo mà không cần gọi lại API.
 */
export function setPremiumStatusFromProfile(isPremium: boolean) {
  setState({ isPremium, isLoading: false, isLoaded: true });
}

async function fetchPremiumStatusInternal(
  accessToken: string,
  tokenType: string | null,
): Promise<boolean> {
  setState({ isLoading: true });
  try {
    const profile = await getMyProfile({ accessToken, tokenType });
    setState({ isPremium: profile.isPremium, isLoading: false, isLoaded: true });
    return profile.isPremium;
  } catch (error) {
    setState({ isLoading: false });
    throw error;
  }
}

/**
 * Chủ động refetch isPremium từ server (bỏ qua cache), dùng ngay sau khi user
 * vừa mua/kích hoạt gói Premium thành công để mở khoá tính năng ngay lập tức.
 */
export async function refreshPremiumStatus(): Promise<boolean> {
  const accessToken = await getValidAccessToken();
  if (!accessToken) {
    resetPremiumStatus();
    return false;
  }

  if (!inflightPromise) {
    inflightPromise = fetchPremiumStatusInternal(accessToken, null).finally(() => {
      inflightPromise = null;
    });
  }

  return inflightPromise;
}

export function usePremiumStatus() {
  const session = useAuthSession();
  const router = useRouter();
  const snapshot = useSyncExternalStore(subscribe, getSnapshot, getSnapshot);

  /**
   * Đảm bảo cache đã có dữ liệu cho phiên đăng nhập hiện tại. Gọi trong
   * useEffect khi mount màn hình cần biết isPremium. Nếu cache đã "isLoaded"
   * (do chính màn này hoặc màn khác load trước đó) thì KHÔNG gọi lại API.
   */
  const ensureLoaded = useCallback(async () => {
    if (!session.isAuthenticated) {
      if (state.isLoaded || state.isPremium) resetPremiumStatus();
      return false;
    }
    if (state.isLoaded || state.isLoading) return state.isPremium;

    try {
      return await refreshPremiumStatus();
    } catch (error) {
      console.warn("[premium-status] load thất bại", error);
      return state.isPremium;
    }
  }, [session.isAuthenticated]);

  /**
   * Gọi trước khi thực hiện 1 hành động Premium. Trả về `true` nếu được phép
   * đi tiếp; nếu chưa Premium, tự alert + điều hướng sang trang gói đăng ký
   * rồi trả về `false` để nơi gọi `return` sớm.
   */
  const requirePremium = useCallback(
    (featureLabel = "Tính năng này") => {
      if (snapshot.isPremium) return true;
      routeSystemAlert.alert(
        "Tính năng dành cho Premium",
        `${featureLabel} chỉ dành cho tài khoản Premium. Hãy nâng cấp để mở khoá.`,
      );
      router.push("/subscription/premium" as Href);
      return false;
    },
    [router, snapshot.isPremium],
  );

  return {
    isPremium: snapshot.isPremium,
    isLoading: snapshot.isLoading,
    isLoaded: snapshot.isLoaded,
    ensureLoaded,
    requirePremium,
  };
}
