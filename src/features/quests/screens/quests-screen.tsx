import { StyleSheet } from 'react-native';

import { AppScreen } from '@/components/ui/app-screen';
import { SectionCard } from '@/components/ui/section-card';
import { ThemedText } from '@/components/themed-text';
import { Spacing } from '@/constants/theme';

export default function QuestsScreen() {
  return (
    <AppScreen>
      <SectionCard
        title="Quest module"
        description="Use this feature area for listings, filters, quest detail, claim flow, and local progress state.">
        <ThemedText style={styles.item}>Main route: src/app/(tabs)/quests.tsx</ThemedText>
        <ThemedText style={styles.item}>Feature screen: src/features/quests/screens/quests-screen.tsx</ThemedText>
        <ThemedText style={styles.item}>Add API calls inside src/services when backend integration starts.</ThemedText>
      </SectionCard>
    </AppScreen>
  );
}

const styles = StyleSheet.create({
  item: {
    lineHeight: 24,
    marginBottom: Spacing.one,
  },
});
