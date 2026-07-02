import { SymbolView } from '@/components/ui/symbol-view';
import { useRouter } from 'expo-router';
import { Alert, Pressable, ScrollView, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

const subscriptionPlans = [
  {
    id: 'premium',
    title: 'Premium',
    price: '₫49.000 / tháng',
    description: 'Truy cập bản đồ offline, hướng dẫn chi tiết và nội dung đặc sắc.',
    benefits: ['Bản đồ offline đầy đủ', 'Hướng dẫn ưu tiên', 'Nội dung đặc sắc'],
  },
  {
    id: 'explorer',
    title: 'Explorer',
    price: '₫29.000 / tháng',
    description: 'Gói khám phá linh hoạt với các tính năng chính và giá tốt.',
    benefits: ['Bản đồ offline cơ bản', 'Hỗ trợ điều hướng', 'Tiết kiệm chi phí'],
  },
  {
    id: 'starter',
    title: 'Starter',
    price: '₫9.000 / tháng',
    description: 'Dùng thử nhanh với các chức năng cơ bản của ứng dụng.',
    benefits: ['Bản đồ online', 'Hỗ trợ cơ bản', 'Không cam kết'],
  },
];

export default function SubscriptionScreen() {
  const router = useRouter();

  async function handleSubscribe(planTitle: string) {
    Alert.alert(`Đăng ký ${planTitle} thành công`, 'Cảm ơn bạn đã đăng ký gói.');
  }

  return (
    <SafeAreaView className="flex-1 bg-white" edges={['top', 'bottom']}>
      <ScrollView contentContainerStyle={{ padding: 16 }}>
        <View className="mb-4 flex-row items-center justify-between">
          <Text className="text-[20px] font-extrabold text-[#2B2233]">Đăng ký gói Premium</Text>
          <Pressable onPress={() => router.back()} className="h-10 w-10 items-center justify-center rounded-full bg-[#F4EFF8]">
            <SymbolView name={{ ios: 'xmark', android: 'close', web: 'close' }} size={16} tintColor="#8E869A" />
          </Pressable>
        </View>

        <View className="space-y-4">
          {subscriptionPlans.map((plan) => (
            <View key={plan.id} className="rounded-2xl border border-[#F4EFF8] bg-[#FFF8FC] p-4 shadow-sm">
              <View className="flex-row items-center justify-between">
                <Text className="text-[16px] font-bold text-[#2B2233]">{plan.title}</Text>
                <Text className="text-[12px] text-[#8E869A]">Hủy bất cứ lúc nào</Text>
              </View>

              <Text className="mt-2 text-[14px] text-[#8E869A]">{plan.description}</Text>

              <Text className="mt-4 text-[18px] font-extrabold text-[#2B2233]">{plan.price}</Text>

              <View className="mt-3 space-y-2">
                {plan.benefits.map((benefit) => (
                  <View key={benefit} className="flex-row items-start gap-2">
                    <SymbolView name={{ ios: 'sparkles', android: 'auto_awesome', web: 'auto_awesome' }} size={14} tintColor="#F58752" />
                    <Text className="text-[13px] text-[#3D3446]">{benefit}</Text>
                  </View>
                ))}
              </View>

              <Pressable onPress={() => handleSubscribe(plan.title)} className="mt-4 rounded-xl bg-[#EB489B] px-4 py-3">
                <Text className="text-white font-extrabold text-center">Đăng ký {plan.title}</Text>
              </Pressable>
            </View>
          ))}
        </View>

        <View className="mt-6 rounded-2xl bg-[#F4EFF8] p-4">
          <Text className="text-[13px] font-bold text-[#2B2233]">Lợi ích chung</Text>
          <View className="mt-3 space-y-2">
            <View className="flex-row items-start gap-2">
              <SymbolView name={{ ios: 'sparkles', android: 'auto_awesome', web: 'auto_awesome' }} size={16} tintColor="#F58752" />
              <Text className="text-[13px] text-[#3D3446]">Giao diện tối ưu cho vùng notch/camera</Text>
            </View>
            <View className="flex-row items-start gap-2">
              <SymbolView name={{ ios: 'clock', android: 'schedule', web: 'schedule' }} size={16} tintColor="#8E869A" />
              <Text className="text-[13px] text-[#3D3446]">Hiển thị nội dung an toàn, không che camera</Text>
            </View>
          </View>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}
