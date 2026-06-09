import { Link, Stack } from 'expo-router';
import { Pressable } from 'react-native';

import { AppScreen } from '@/components/ui/app-screen';
import { SectionCard } from '@/components/ui/section-card';
import { ThemedText } from '@/components/themed-text';

export default function NotFoundScreen() {
  return (
    <>
      <Stack.Screen options={{ title: 'Not found' }} />
      <AppScreen>
        <SectionCard title="Route not found" description="The requested screen does not exist in this Expo Router tree.">
          <ThemedText className="mb-4">
            Check the file name inside <ThemedText type="code">src/app</ThemedText> or return to the
            main navigation.
          </ThemedText>
          <Link href="/login" asChild>
            <Pressable className="self-start">
              <ThemedText type="linkPrimary">Go to login</ThemedText>
            </Pressable>
          </Link>
        </SectionCard>
      </AppScreen>
    </>
  );
}
