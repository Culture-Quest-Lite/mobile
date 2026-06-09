import { TabPlaceholderScreen } from '@/features/navigation/components/tab-placeholder-screen';

export default function BookingsTab() {
  return (
    <TabPlaceholderScreen
      title="Đặt chỗ của tôi"
      description="Khu vực tổng hợp các booking, vé, và lịch trình đã xác nhận của người dùng."
      routeFile="src/app/(tabs)/bookings.tsx"
    />
  );
}
