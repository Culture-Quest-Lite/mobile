import { TabPlaceholderScreen } from '@/features/navigation/components/tab-placeholder-screen';

export default function ExploreTab() {
  return (
    <TabPlaceholderScreen
      title="Explore"
      description="Khu vực dành cho khám phá địa điểm, gợi ý hành trình và nội dung đề xuất."
      routeFile="src/app/(tabs)/explore.tsx"
    />
  );
}
