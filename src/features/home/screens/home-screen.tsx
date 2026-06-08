import { StyleSheet, View } from 'react-native';

import { AppScreen } from '@/components/ui/app-screen';
import { SectionCard } from '@/components/ui/section-card';
import { ThemedText } from '@/components/themed-text';
import { Radius, Spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';

const STRUCTURE_ITEMS = [
  'src/app only contains Expo Router files',
  'src/features groups domain screens and feature logic',
  'src/components stores shared UI primitives',
  'src/services, src/store, src/types, src/utils are ready for expansion',
];

export default function HomeScreen() {
  const theme = useTheme();

  return (
    <AppScreen>
      <View style={styles.hero}>
        <ThemedText type="title" style={styles.title}>
          Culture Quest Lite
        </ThemedText>
        <ThemedText themeColor="textSecondary" style={styles.subtitle}>
          Expo Router scaffold refactored from the default starter into a feature-based project
          structure.
        </ThemedText>
      </View>

      <SectionCard
        title="Current foundation"
        description="This screen confirms the project now follows a clean Expo layout that is easier to grow.">
        {STRUCTURE_ITEMS.map((item) => (
          <View
            key={item}
            style={[
              styles.pill,
              {
                backgroundColor: theme.backgroundSelected,
              },
            ]}>
            <ThemedText>{item}</ThemedText>
          </View>
        ))}
      </SectionCard>

      <SectionCard
        title="Recommended next modules"
        description="For this game-oriented app, these are the first domains worth implementing.">
        <ThemedText>1. Authentication and player onboarding</ThemedText>
        <ThemedText>2. Quest catalog, challenge detail, and progress tracking</ThemedText>
        <ThemedText>3. Rewards, leaderboard, and profile progression</ThemedText>
      </SectionCard>
    </AppScreen>
  );
}

const styles = StyleSheet.create({
  hero: {
    gap: Spacing.two,
  },
  title: {
    fontSize: 40,
    lineHeight: 44,
  },
  subtitle: {
    fontSize: 16,
    lineHeight: 24,
  },
  pill: {
    borderRadius: Radius.medium,
    paddingHorizontal: Spacing.three,
    paddingVertical: Spacing.two,
  },
});
