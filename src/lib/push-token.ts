import * as Notifications from "expo-notifications";
import { Platform } from "react-native";

import { registerNotificationDeviceToken } from "@/features/notification/api/notification-api";

// Cache token trong session để tránh gọi API nhiều lần với cùng token
let registeredToken: string | null = null;

/**
 * Lấy native device push token — FCM registration token trên Android,
 * APNs device token trên iOS. Trả về null trên web hoặc khi thất bại.
 *
 * Yêu cầu `google-services.json` (Android) / `GoogleService-Info.plist` (iOS)
 * đã được cấu hình trong app.json.
 */
export async function getDevicePushToken(): Promise<string | null> {
  if (Platform.OS === "web") {
    return null;
  }

  try {
    const result = await Notifications.getDevicePushTokenAsync();
    return result.data;
  } catch (error) {
    console.warn("[push-token] getDevicePushTokenAsync failed", {
      error: error instanceof Error ? error.message : error,
    });
    return null;
  }
}

/**
 * Lấy device push token và đăng ký với backend.
 * Bỏ qua API call nếu cùng token đã được đăng ký trong session hiện tại.
 */
export async function registerDevicePushToken(accessToken: string): Promise<void> {
  const token = await getDevicePushToken();

  if (!token) {
    return;
  }

  if (token === registeredToken) {
    return;
  }

  try {
    await registerNotificationDeviceToken(token, accessToken);
    registeredToken = token;
    console.log("[push-token] registered successfully");
  } catch (error) {
    console.warn("[push-token] registerDevicePushToken failed", {
      error: error instanceof Error ? error.message : error,
    });
  }
}

/**
 * Reset cache khi user đăng xuất, để lần đăng nhập tiếp theo
 * sẽ đăng ký lại token với đúng tài khoản.
 */
export function clearRegisteredPushToken() {
  registeredToken = null;
}
