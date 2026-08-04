import "../global.css";

import {
  DarkTheme,
  DefaultTheme,
  Stack,
  ThemeProvider,
} from "expo-router";
import { StatusBar } from "expo-status-bar";
import { useEffect } from 'react';
import { AppState, Text, TextInput } from 'react-native';
import { SafeAreaProvider } from 'react-native-safe-area-context';

import { warnForInvalidPublicEnv } from '@/constants/env';
import '@/lib/nativewind';
import { requestStartupPermissions } from '@/lib/startup-permissions';
import { useColorScheme } from '@/hooks/use-color-scheme';
import { AppToastHost } from '@/components/ui/app-toast';
import { RouteSystemAlertHost } from '@/features/route/components/route-system-alert';

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

  return (
    <SafeAreaProvider>
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
          <Stack.Screen name="notifications" />
          <Stack.Screen name="vouchers/index" />
          <Stack.Screen name="vouchers/[id]" />
          <Stack.Screen name="subscription" />
          <Stack.Screen name="route/[id]" />
          <Stack.Screen name="route/[id]/group-quest" />
          <Stack.Screen name="route/custom/plan" />
          <Stack.Screen name="route/custom/plan/[id]" />
          <Stack.Screen name="route/custom/record" />
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
    </SafeAreaProvider>
  );
}
