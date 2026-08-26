import { LinearGradient } from "expo-linear-gradient";
import { useRouter } from "expo-router";
import { Pressable, ScrollView, StyleSheet, Text, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

import { ScreenHorizontalPadding } from "@/constants/theme";
import { SymbolView } from "@/components/ui/symbol-view";

/** Cùng hệ màu hồng/cam của app (không dùng tông tím). */
const brandPink = "#EB489B";
const brandOrange = "#F58752";
const premiumCardGradient = ["#FF6A8E", "#EB489B", "#F58752"] as const;

const PREMIUM_FEATURES = [
  "Lập kế hoạch lịch trình bằng AI",
  "Ghi hành trình real-time",
  "Audio Guide thuyết minh di sản",
  "Voucher ưu đãi từ đối tác",
];

const PARTNER_FEATURES = [
  "Hiển thị shop lên bản đồ du lịch",
  "Tạo & quản lý voucher ưu đãi",
  "Tích xanh Xác minh đối tác",
];

export default function SubscriptionScreen() {
  const router = useRouter();

  const handleClose = () => {
    if (router.canGoBack()) {
      router.back();
      return;
    }

    router.replace("/home");
  };

  return (
    <SafeAreaView className="flex-1 bg-[#F7F8FC]" edges={["top", "bottom"]}>
      <ScrollView
        contentContainerStyle={{
          paddingBottom: 40,
          paddingHorizontal: ScreenHorizontalPadding,
          paddingTop: 20,
        }}
      >
        {/* Header */}
        <View className="mb-6 flex-row items-center justify-between">
          <View className="flex-1 pr-3">
            <Text className="text-[24px] font-semibold text-[#2B2233]">
              Gói Đăng ký
            </Text>
            <Text className="mt-1 text-[13px] text-[#6F657A]">
              Chọn gói phù hợp với bạn để bắt đầu
            </Text>
          </View>
          <Pressable
            onPress={handleClose}
            className="h-10 w-10 items-center justify-center rounded-full bg-white"
          >
            <SymbolView
              name={{ ios: "xmark", android: "close", web: "close" }}
              size={16}
              tintColor="#8E869A"
            />
          </Pressable>
        </View>

        {/* Guidance Card */}
        <View className="mb-6 rounded-2xl border border-[#F7E5EB] bg-white p-4">
          <Text className="text-[14px] font-semibold text-[#2B2233]">
            Chọn gói phù hợp với bạn
          </Text>
          <View className="mt-2 gap-1.5">
            <Text className="text-[12px] leading-5 text-[#6F657A]">
              •{" "}
              <Text className="font-semibold" style={{ color: brandPink }}>
                Gói Premium (Explorer)
              </Text>
              : Dành cho du khách muốn nâng cấp trải nghiệm khám phá di sản
              với AI, ghi hành trình & thuyết minh âm thanh.
            </Text>
            <Text className="text-[12px] leading-5 text-[#6F657A]">
              •{" "}
              <Text className="font-semibold" style={{ color: brandOrange }}>
                Gói Đối tác (Shop)
              </Text>
              : Dành cho chủ cửa hàng muốn đưa shop lên bản đồ CultureQuest &
              phát hành voucher ưu đãi.
            </Text>
          </View>
        </View>

        {/* Premium Card */}
        <Pressable
          onPress={() => router.push("/subscription/premium" as any)}
          className="mb-4 overflow-hidden rounded-3xl"
          style={{ elevation: 4 }}
        >
          <LinearGradient
            colors={premiumCardGradient}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 1 }}
            style={StyleSheet.absoluteFill}
          />
          {/* Decorative top accent */}
          <View className="absolute right-0 top-0 h-32 w-32 rounded-bl-full bg-white/10" />
          <View className="absolute right-8 top-4 h-16 w-16 rounded-full bg-white/10" />

          <View className="p-6">
            <View className="mb-3 flex-row items-center gap-3">
              <View className="h-12 w-12 items-center justify-center rounded-2xl bg-white/20">
                <SymbolView
                  name={{
                    ios: "crown.fill",
                    android: "workspace_premium",
                    web: "workspace_premium",
                  }}
                  size={24}
                  tintColor="#FFD700"
                />
              </View>
              <View>
                <View className="mb-1 self-start rounded-full bg-white/85 px-2 py-0.5">
                  <Text className="text-[9px]" style={{ color: brandPink }}>
                    Dành cho Explorer
                  </Text>
                </View>
                <Text className="text-[20px] font-semibold text-white">
                  Gói Premium
                </Text>
              </View>
            </View>

            <Text className="mb-4 text-[13px] leading-5 text-white/80">
              Mở khoá toàn bộ tính năng khám phá thông minh dành cho người dùng CultureQuest.
            </Text>

            <View className="mb-5 gap-2">
              {PREMIUM_FEATURES.map((feature, i) => (
                <View key={i} className="flex-row items-center gap-2">
                  <View className="h-5 w-5 items-center justify-center rounded-full bg-white/20">
                    <SymbolView
                      name={{ ios: "checkmark", android: "check", web: "check" }}
                      size={11}
                      tintColor="white"
                    />
                  </View>
                  <Text className="text-[12px] text-white/90">{feature}</Text>
                </View>
              ))}
            </View>

            <View className="flex-row items-center justify-between">
              <View>
                <Text className="text-[12px] text-white/70">Nhiều lựa chọn</Text>
                <Text className="text-[20px] font-semibold text-white">
                  Giá gói linh hoạt
                </Text>
              </View>
              <View className="flex-row items-center gap-2 rounded-2xl bg-white px-4 py-3">
                <Text
                  className="text-[13px] font-semibold"
                  style={{ color: brandPink }}
                >
                  Xem gói
                </Text>
                <SymbolView
                  name={{
                    ios: "chevron.right",
                    android: "chevron_right",
                    web: "chevron_right",
                  }}
                  size={14}
                  tintColor={brandPink}
                />
              </View>
            </View>
          </View>
        </Pressable>

        {/* Partner Card */}
        <Pressable
          onPress={() => router.push("/subscription/partner" as any)}
          className="overflow-hidden rounded-3xl"
          style={{ backgroundColor: brandOrange, elevation: 4 }}
        >
          {/* Decorative */}
          <View className="absolute right-0 top-0 h-32 w-32 rounded-bl-full bg-white/10" />
          <View className="absolute right-8 top-4 h-16 w-16 rounded-full bg-white/10" />

          <View className="p-6">
            <View className="mb-3 flex-row items-center gap-3">
              <View className="h-12 w-12 items-center justify-center rounded-2xl bg-white/20">
                <SymbolView
                  name={{
                    ios: "storefront.fill",
                    android: "store",
                    web: "store",
                  }}
                  size={24}
                  tintColor="white"
                />
              </View>
              <View>
                <View className="mb-1 self-start rounded-full bg-white/30 px-2 py-0.5">
                  <Text className="text-[9px] text-white">
                    Dành cho chủ shop
                  </Text>
                </View>
                <Text className="text-[20px] font-semibold text-white">
                  Gói Đối tác
                </Text>
              </View>
            </View>

            <Text className="mb-4 text-[13px] leading-5 text-white/80">
              Hiển thị cửa hàng / địa điểm kinh doanh lên bản đồ CultureQuest và thu hút hàng ngàn khách du lịch.
            </Text>

            <View className="mb-5 gap-2">
              {PARTNER_FEATURES.map((feature, i) => (
                <View key={i} className="flex-row items-center gap-2">
                  <View className="h-5 w-5 items-center justify-center rounded-full bg-white/20">
                    <SymbolView
                      name={{ ios: "checkmark", android: "check", web: "check" }}
                      size={11}
                      tintColor="white"
                    />
                  </View>
                  <Text className="text-[12px] text-white/90">{feature}</Text>
                </View>
              ))}
            </View>

            <View className="flex-row items-center justify-between">
              <View>
                <Text className="text-[12px] text-white/70">Nhiều lựa chọn</Text>
                <Text className="text-[20px] font-semibold text-white">
                  Giá gói linh hoạt
                </Text>
              </View>
              <View className="flex-row items-center gap-2 rounded-2xl bg-white px-4 py-3">
                <Text
                  className="text-[13px] font-semibold"
                  style={{ color: brandOrange }}
                >
                  Đăng ký ngay
                </Text>
                <SymbolView
                  name={{
                    ios: "chevron.right",
                    android: "chevron_right",
                    web: "chevron_right",
                  }}
                  size={14}
                  tintColor={brandOrange}
                />
              </View>
            </View>
          </View>
        </Pressable>

        {/* Footer note */}
        <Text className="mt-6 text-center text-[11px] leading-5 text-[#A49BAA]">
          Bằng cách đăng ký, bạn đồng ý với Điều khoản dịch vụ và Chính sách
          bảo mật của CultureQuest.
        </Text>
      </ScrollView>
    </SafeAreaView>
  );
}
