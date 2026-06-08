import { Link, Stack } from 'expo-router';
import { StyleSheet } from 'react-native';

import { AppScreen } from '@/components/ui/app-screen';
import { SectionCard } from '@/components/ui/section-card';
import { ThemedText } from '@/components/themed-text';
import { Spacing } from '@/constants/theme';

export default function NotFoundScreen() {
  return (
    <>
      <Stack.Screen options={{ title: 'Not found' }} />
      <AppScreen>
        <SectionCard title="Route not found" description="The requested screen does not exist in this Expo Router tree.">
          <ThemedText style={styles.body}>
            Check the file name inside <ThemedText type="code">src/app</ThemedText> or return to the
            main navigation.
          </ThemedText>
          <Link href="/" style={styles.link}>
            <ThemedText type="linkPrimary">Go to home tab</ThemedText>
          </Link>
        </SectionCard>
      </AppScreen>
    </>
  );
}

const styles = StyleSheet.create({
  body: {
    marginBottom: Spacing.three,
  },
  link: {
    alignSelf: 'flex-start',
  },
});
