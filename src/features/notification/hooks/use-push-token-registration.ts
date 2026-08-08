import { useEffect } from "react";
import { Platform } from "react-native";

import {
  getValidAccessToken,
  useAuthSession,
} from "@/features/auth/hooks/use-auth-session";
import { registerDevicePushToken } from "@/lib/push-token";

/**
 * Đăng ký device FCM token với backend mỗi khi user đăng nhập
 * (hoặc khi mount lần đầu nếu user đã đăng nhập sẵn).
 *
 * No-op trên web.
 */
export function usePushTokenRegistration() {
  const { isAuthenticated, username } = useAuthSession();

  useEffect(() => {
    if (Platform.OS === "web" || !isAuthenticated) {
      return;
    }

    void (async () => {
      const accessToken = await getValidAccessToken();

      if (!accessToken) {
        return;
      }

      await registerDevicePushToken(accessToken);
    })();
    // username làm dependency để re-register khi đổi tài khoản
  }, [isAuthenticated, username]);
}
