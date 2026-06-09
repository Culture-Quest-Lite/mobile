import { AppScreen } from '@/components/ui/app-screen';
import { SectionCard } from '@/components/ui/section-card';
import { ThemedText } from '@/components/themed-text';

export default function ProfileScreen() {
  return (
    <AppScreen>
      <SectionCard
        title="Profile module"
        description="Keep player identity, progression, badges, and preferences isolated in one feature folder.">
        <ThemedText className="leading-6">
          Route file: <ThemedText type="code">src/app/(tabs)/profile.tsx</ThemedText>
        </ThemedText>
        <ThemedText className="leading-6">
          Screen file: <ThemedText type="code">src/features/profile/screens/profile-screen.tsx</ThemedText>
        </ThemedText>
        <ThemedText>Suggested future folders: components, hooks, services, types.</ThemedText>
      </SectionCard>
    </AppScreen>
  );
}
