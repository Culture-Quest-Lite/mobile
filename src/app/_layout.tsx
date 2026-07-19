import '../global.css';

import { DarkTheme, DefaultTheme, Stack, ThemeProvider } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { useEffect } from 'react';
import {
  AppState,
  InteractionManager,
  Text,
  TextInput,
} from 'react-native';
import { SafeAreaProvider } from 'react-native-safe-area-context';

import { warnForInvalidPublicEnv } from '@/constants/env';
import '@/lib/nativewind';
import { requestForegroundLocationPermissionOnAppLaunch } from '@/lib/location';
import { useColorScheme } from '@/hooks/use-color-scheme';

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
    let interactionTask: ReturnType<typeof InteractionManager.runAfterInteractions> | null =
      null;

    const scheduleLocationPermissionRequest = () => {
      interactionTask?.cancel();
      interactionTask = InteractionManager.runAfterInteractions(() => {
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
      interactionTask?.cancel();
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
          <Stack.Screen name="community/post/[id]" />
          <Stack.Screen name="community/profile/[id]" />
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
      </ThemeProvider>
    </SafeAreaProvider>
  );
}
