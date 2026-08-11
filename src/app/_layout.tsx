import "../global.css";

import {
  DarkTheme,
  DefaultTheme,
  Stack,
  ThemeProvider,
  useRouter,
} from "expo-router";
import * as Notifications from "expo-notifications";
import { StatusBar } from "expo-status-bar";
import { useEffect, useState } from 'react';
import { AppState, Text, TextInput } from 'react-native';
import { KeyboardProvider } from 'react-native-keyboard-controller';
import { SafeAreaProvider } from 'react-native-safe-area-context';

import { warnForInvalidPublicEnv } from '@/constants/env';
import '@/lib/nativewind';
import { requestStartupPermissions } from '@/lib/startup-permissions';
import { initI18n } from '@/lib/i18n';
import { useColorScheme } from '@/hooks/use-color-scheme';
import { AppToastHost } from '@/components/ui/app-toast';
import { RouteSystemAlertHost } from '@/features/route/components/route-system-alert';
import { usePushTokenRegistration } from '@/features/notification/hooks/use-push-token-registration';

/**
 * Trả về route tương ứng dựa trên data payload của FCM notification.
 * Backend gửi `notificationType` và `referenceId` trong data field.
 */
function resolveNotificationRoute(data: Record<string, unknown>): string {
  const type =
    typeof data.notificationType === "string"
      ? data.notificationType.trim().toUpperCase()
      : "";
  const refId = data.referenceId;

  if (type.includes("ROUTE") && refId) {
    return `/route/${refId}`;
  }

  if (type.includes("POST") && refId) {
    return `/community/post/${refId}`;
  }

  if (type.includes("SUBSCRIPTION")) {
    return "/subscription";
  }

  return "/notifications";
}

const PERMISSION_PROMPT_DELAY_MS = 800;

const AppText = Text as typeof Text & {
  defaultProps?: {
    allowFontScaling?: boolean;
    maxFontSizeMultiplier?: number;
  };
};

const AppTextInput = TextInput as typeof TextInput & {
  defaultProps?: {
    allowFontScaling?: boolean;
    maxFontSizeMultiplier?: number;
  };
};

AppText.defaultProps = AppText.defaultProps ?? {};
AppText.defaultProps.allowFontScaling = true;
AppText.defaultProps.maxFontSizeMultiplier = 1.15;

AppTextInput.defaultProps = AppTextInput.defaultProps ?? {};
AppTextInput.defaultProps.allowFontScaling = true;
AppTextInput.defaultProps.maxFontSizeMultiplier = 1.15;

export default function RootLayout() {
  warnForInvalidPublicEnv();

  const colorScheme = useColorScheme();
  const router = useRouter();
  const lastNotificationResponse = Notifications.useLastNotificationResponse();
  const [i18nInitialized, setI18nInitialized] = useState(false);

  // Initialize i18n
  useEffect(() => {
    initI18n().then(() => {
      setI18nInitialized(true);
    }).catch((error) => {
      console.error('Failed to initialize i18n:', error);
      setI18nInitialized(true); // Continue anyway
    });
  }, []);

  // Đăng ký FCM token với backend mỗi khi user đăng nhập
  usePushTokenRegistration();

  // Xử lý tap vào notification (kể cả khi app đang background / bị kill)
  useEffect(() => {
    if (!lastNotificationResponse) {
      return;
    }

    const data =
      (lastNotificationResponse.notification.request.content.data as Record<
        string,
        unknown
      >) ?? {};
    const route = resolveNotificationRoute(data);

    router.push(route as Parameters<typeof router.push>[0]);
  }, [lastNotificationResponse, router]);

  useEffect(() => {
    let isCancelled = false;
    let permissionTimer: ReturnType<typeof setTimeout> | null = null;
    let hasRequested = false;

    // Give the splash screen time to hand over to the first screen, otherwise
    // the OS dialog can be dismissed together with the splash.
    const schedulePermissionRequests = () => {
      if (permissionTimer || hasRequested) {
        return;
      }

      permissionTimer = setTimeout(() => {
        permissionTimer = null;

        if (isCancelled || AppState.currentState !== 'active') {
          return;
        }

        hasRequested = true;
        void requestStartupPermissions();
      }, PERMISSION_PROMPT_DELAY_MS);
    };

    if (AppState.currentState === 'active') {
      schedulePermissionRequests();
    }

    const appStateSubscription = AppState.addEventListener('change', (nextState) => {
      if (nextState === 'active') {
        schedulePermissionRequests();
      }
    });

    return () => {
      isCancelled = true;

      if (permissionTimer) {
        clearTimeout(permissionTimer);
        permissionTimer = null;
      }

      appStateSubscription.remove();
    };
  }, []);

  if (!i18nInitialized) {
    return null;
  }

  return (
    <SafeAreaProvider>
      <KeyboardProvider>
        <ThemeProvider value={colorScheme === 'dark' ? DarkTheme : DefaultTheme}>
          <StatusBar style={colorScheme === 'dark' ? 'light' : 'dark'} />
          <Stack screenOptions={{ headerShown: false }}>
            <Stack.Screen name="(auth)" />
            <Stack.Screen name="(tabs)" />
            <Stack.Screen name="community/create" />
            <Stack.Screen name="community/group-create" />
            <Stack.Screen name="community/group-created/[shareToken]" />
            <Stack.Screen name="community/groups" />
            <Stack.Screen name="community/group/[shareToken]" />
            <Stack.Screen name="community/group/[shareToken]/journey" />
            <Stack.Screen name="community/group/[shareToken]/manage" />
            <Stack.Screen name="community/group/[shareToken]/members" />
            <Stack.Screen name="community/group/[shareToken]/settings" />
            <Stack.Screen name="community/group/[shareToken]/invite" />
            <Stack.Screen name="community/leaderboard" />
            <Stack.Screen name="community/post-visibility" />
            <Stack.Screen name="community/post/[id]" />
            <Stack.Screen name="community/profile/[id]" />
            <Stack.Screen name="join/[shareToken]" />
            <Stack.Screen name="profile/information" />
            <Stack.Screen name="profile/menu" />
            <Stack.Screen name="settings/language" />
            <Stack.Screen name="notifications" />
            <Stack.Screen name="vouchers/index" />
            <Stack.Screen name="vouchers/[id]" />
            <Stack.Screen name="subscription" />
            <Stack.Screen name="route/[id]" />
            <Stack.Screen
              name="route/[id]/review-compose"
              options={{ presentation: "modal" }}
            />
            <Stack.Screen name="route/[id]/group-quest" />
            <Stack.Screen name="route/custom/plan" />
            <Stack.Screen name="route/custom/plan/[id]" />
            <Stack.Screen name="route/custom/record" />
            <Stack.Screen name="theme/index" />
            <Stack.Screen name="theme/[slug]" />
            <Stack.Screen name="checkin/[id]" />
            <Stack.Screen name="hotspot/[slug]" />
            <Stack.Screen name="hotspot/[slug]/review-compose" />
            <Stack.Screen name="hotspot/[slug]/stories" />
            <Stack.Screen name="hotspots" />
            <Stack.Screen name="hotspots/search" />
            <Stack.Screen name="+not-found" />
          </Stack>
          <AppToastHost />
          <RouteSystemAlertHost />
        </ThemeProvider>
      </KeyboardProvider>
    </SafeAreaProvider>
  );
}
