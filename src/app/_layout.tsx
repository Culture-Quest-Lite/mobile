import '../global.css';

import { DarkTheme, DefaultTheme, Stack, ThemeProvider } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { useEffect } from 'react';
import { AppState, Text, TextInput } from 'react-native';
import { SafeAreaProvider } from 'react-native-safe-area-context';

import { warnForInvalidPublicEnv } from '@/constants/env';
import '@/lib/nativewind';
import { requestForegroundLocationPermissionOnAppLaunch } from '@/lib/location';
import { useColorScheme } from '@/hooks/use-color-scheme';
import { AppToastHost } from '@/components/ui/app-toast';
import { RouteSystemAlertHost } from '@/features/route/components/route-system-alert';

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

type DeferredTask = {
  cancel: () => void;
};

function scheduleDeferredTask(callback: () => void): DeferredTask {
  if (typeof globalThis.requestIdleCallback === 'function') {
    const idleCallbackId = globalThis.requestIdleCallback(() => {
      callback();
    });

    return {
      cancel: () => {
        if (typeof globalThis.cancelIdleCallback === 'function') {
          globalThis.cancelIdleCallback(idleCallbackId);
        }
      },
    };
  }

  const timeoutId = setTimeout(callback, 0);

  return {
    cancel: () => {
      clearTimeout(timeoutId);
    },
  };
}

export default function RootLayout() {
  warnForInvalidPublicEnv();

  const colorScheme = useColorScheme();

  useEffect(() => {
    let isCancelled = false;
    let deferredTask: DeferredTask | null = null;

    const scheduleLocationPermissionRequest = () => {
      deferredTask?.cancel();
      deferredTask = scheduleDeferredTask(() => {
        if (isCancelled || AppState.currentState !== 'active') {
          return;
        }

        void requestForegroundLocationPermissionOnAppLaunch();
      });
    };

    if (AppState.currentState === 'active') {
      scheduleLocationPermissionRequest();
    }

    const appStateSubscription = AppState.addEventListener('change', (nextState) => {
      if (nextState === 'active') {
        scheduleLocationPermissionRequest();
      }
    });

    return () => {
      isCancelled = true;
      deferredTask?.cancel();
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
          <Stack.Screen name="community/post-visibility" />
          <Stack.Screen name="community/post/[id]" />
          <Stack.Screen name="community/profile/[id]" />
          <Stack.Screen name="join/[shareToken]" />
          <Stack.Screen name="profile/information" />
          <Stack.Screen name="profile/menu" />
          <Stack.Screen name="route/[id]" />
          <Stack.Screen name="route/custom/plan" />
          <Stack.Screen name="route/custom/plan/[id]" />
          <Stack.Screen name="route/custom/record" />
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
