import { AppScreen } from '@/components/ui/app-screen';
import { SectionCard } from '@/components/ui/section-card';
import { ThemedText } from '@/components/themed-text';

export default function QuestsScreen() {
  return (
    <AppScreen>
      <SectionCard
        title="Quest module"
        description="Use this feature area for listings, filters, quest detail, claim flow, and local progress state.">
        <ThemedText className="leading-6">Main route: src/app/(tabs)/quests.tsx</ThemedText>
        <ThemedText className="leading-6">
          Feature screen: src/features/quests/screens/quests-screen.tsx
        </ThemedText>
        <ThemedText className="leading-6">
          Add API calls inside src/services when backend integration starts.
        </ThemedText>
      </SectionCard>
    </AppScreen>
  );
}
