import { View } from 'react-native';

import { AppScreen } from '@/components/ui/app-screen';
import { SectionCard } from '@/components/ui/section-card';
import { ThemedText } from '@/components/themed-text';

const STRUCTURE_ITEMS = [
  'src/app only contains Expo Router files',
  'src/features groups domain screens and feature logic',
  'src/components stores shared UI primitives',
  'src/services, src/store, src/types, src/utils are ready for expansion',
];

export default function HomeScreen() {
  return (
    <AppScreen>
      <View className="gap-2">
        <ThemedText className="text-[40px] font-semibold leading-[44px]">
          Culture Quest Lite
        </ThemedText>
        <ThemedText themeColor="textSecondary" className="text-base leading-6">
          Expo Router scaffold refactored from the default starter into a feature-based project
          structure.
        </ThemedText>
      </View>

      <SectionCard
        title="Current foundation"
        description="This screen confirms the project now follows a clean Expo layout that is easier to grow.">
        {STRUCTURE_ITEMS.map((item) => (
          <View key={item} className="rounded-[14px] bg-[#E9DCC5] px-4 py-2 dark:bg-[#353E34]">
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
