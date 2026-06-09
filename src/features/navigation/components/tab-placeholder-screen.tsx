import { AppScreen } from '@/components/ui/app-screen';
import { SectionCard } from '@/components/ui/section-card';
import { ThemedText } from '@/components/themed-text';

type TabPlaceholderScreenProps = {
  description: string;
  routeFile: string;
  title: string;
};

export function TabPlaceholderScreen({
  description,
  routeFile,
  title,
}: TabPlaceholderScreenProps) {
  return (
    <AppScreen>
      <SectionCard
        title={title}
        description={description}
      >
        <ThemedText className="leading-6">
          Route file: <ThemedText type="code">{routeFile}</ThemedText>
        </ThemedText>
        <ThemedText className="leading-6">
          Màn hình này đang là scaffold để hoàn thiện luồng điều hướng 5 mục.
        </ThemedText>
      </SectionCard>
    </AppScreen>
  );
}
