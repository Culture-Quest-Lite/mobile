import '../global.css';

import { DarkTheme, DefaultTheme, Stack, ThemeProvider } from 'expo-router';
import { StatusBar } from 'expo-status-bar';

import '@/lib/nativewind';
import { useColorScheme } from '@/hooks/use-color-scheme';

export default function RootLayout() {
  const colorScheme = useColorScheme();

  return (
    <ThemeProvider value={colorScheme === 'dark' ? DarkTheme : DefaultTheme}>
      <StatusBar style={colorScheme === 'dark' ? 'light' : 'dark'} />
      <Stack screenOptions={{ headerShown: false }}>
        <Stack.Screen name="(auth)" />
        <Stack.Screen name="(tabs)" />
        <Stack.Screen name="community/profile/[id]" />
        <Stack.Screen name="route/[id]" />
        <Stack.Screen name="checkin/[id]" />
        <Stack.Screen name="hotspot/[slug]" />
        <Stack.Screen name="hotspot/[slug]/stories" />
        <Stack.Screen name="hotspots" />
        <Stack.Screen name="+not-found" />
      </Stack>
    </ThemeProvider>
  );
}
