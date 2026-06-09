import { TabPlaceholderScreen } from '@/features/navigation/components/tab-placeholder-screen';

export default function SavedTab() {
  return (
    <TabPlaceholderScreen
      title="Đã lưu"
      description="Khu vực chứa địa điểm, chuyến đi và nội dung người dùng đã lưu lại để xem sau."
      routeFile="src/app/(tabs)/saved.tsx"
    />
  );
}
