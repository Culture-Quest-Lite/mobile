import { useRouter } from "expo-router";
import { SymbolView } from "expo-symbols";
import { type ComponentProps } from "react";
import { Pressable, ScrollView, Text, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

import {
  resetAuthSessionToGuest,
  useAuthSession,
} from "@/features/auth/hooks/use-auth-session";
import { useProfile } from "../hooks/use-profile";

type SymbolName = ComponentProps<typeof SymbolView>["name"];

const cardShadow = {
  shadowColor: "rgba(28, 45, 80, 0.10)",
  shadowOpacity: 1,
  shadowRadius: 16,
  shadowOffset: { width: 0, height: 8 },
  elevation: 5,
} as const;

type MenuItemConfig = {
  description?: string;
  icon: SymbolName;
  isDestructive?: boolean;
  label: string;
  onPress: () => void;
  value?: string;
};

function formatUsername(username: string) {
  const normalizedUsername = username.replace(/^@+/, "").trim();

  if (!normalizedUsername) {
    return null;
  }

  return `@${normalizedUsername}`;
}

export default function ProfileMenuScreen() {
  const router = useRouter();
  const authSession = useAuthSession();
  const { profile } = useProfile();

  const handleLogout = () => {
    resetAuthSessionToGuest();
    router.replace("/home");
  };

  const informationItems: MenuItemConfig[] = [
    {
      description: profile?.email ?? "Xem thông tin cơ bản của tài khoản.",
      icon: {
        ios: "person.text.rectangle",
        android: "badge",
        web: "badge",
      },
      label: "Thông tin",
      onPress: () => {},
      value: formatUsername(profile?.username ?? "") ?? undefined,
    },
    {
      description: "Cập nhật ảnh đại diện hiển thị công khai.",
      icon: { ios: "camera", android: "photo_camera", web: "photo_camera" },
      label: "Đổi ảnh đại diện",
      onPress: () => {},
    },
    {
      description: "Thay đổi ảnh bìa phía trên hồ sơ của bạn.",
      icon: { ios: "photo.stack", android: "image", web: "image" },
      label: "Đổi ảnh bìa",
      onPress: () => {},
    },
    {
      description: "Theo dõi tổng điểm và tiến độ hiện tại.",
      icon: {
        ios: "star.circle",
        android: "stars",
        web: "stars",
      },
      label: "Điểm của tôi",
      onPress: () => {},
      value: profile ? profile.points.toLocaleString() : undefined,
    },
  ];

  const settingsItems: MenuItemConfig[] = [
    {
      description: "Điều chỉnh ai có thể xem và tương tác với hồ sơ.",
      icon: { ios: "lock.shield", android: "privacy_tip", web: "privacy_tip" },
      label: "Quyền riêng tư",
      onPress: () => {},
    },
    {
      description: "Quản lý thông tin đăng nhập và dữ liệu tài khoản.",
      icon: {
        ios: "person.crop.circle",
        android: "manage_accounts",
        web: "manage_accounts",
      },
      label: "Quản lý tài khoản",
      onPress: () => {},
    },
    {
      description: "Thiết lập tuỳ chọn chung của ứng dụng.",
      icon: { ios: "gearshape", android: "settings", web: "settings" },
      label: "Cài đặt chung",
      onPress: () => {},
    },
    {
      description: "Thoát khỏi phiên đăng nhập hiện tại.",
      icon: {
        ios: "rectangle.portrait.and.arrow.right",
        android: "logout",
        web: "logout",
      },
      isDestructive: true,
      label: "Đăng xuất",
      onPress: handleLogout,
    },
  ];

  return (
    <SafeAreaView className="flex-1 bg-[#F7F8FC]">
      <ScrollView
        className="flex-1"
        contentContainerStyle={{ paddingBottom: 32 }}
        showsVerticalScrollIndicator={false}
      >
        <View className="px-4 pb-4 pt-3">
          <View className="flex-row items-center justify-between">
            <Pressable
              accessibilityLabel="Quay lại"
              className="h-11 w-11 items-center justify-center rounded-full bg-white"
              onPress={() => router.back()}
              style={cardShadow}
            >
              <SymbolView
                name={{ ios: "chevron.left", android: "arrow_back", web: "arrow_back" }}
                size={18}
                tintColor="#2B2233"
              />
            </Pressable>

            <Text className="text-[20px] font-black text-[#2B2233]">Menu hồ sơ</Text>

            <View className="h-11 w-11" />
          </View>

          <MenuSection
            items={informationItems}
            subtitle="Các mục liên quan đến hồ sơ công khai và hình ảnh."
            title="Thông tin"
          />

          <MenuSection
            items={settingsItems}
            subtitle="Các cài đặt bảo mật, tài khoản và tuỳ chọn chung."
            title="Cài đặt"
          />

          {!authSession.isAuthenticated ? (
            <View className="mt-5 rounded-[24px] border border-[#F1E3E8] bg-white px-4 py-3">
              <Text className="text-[12px] leading-5 text-[#8E869A]">
                Bạn đang ở chế độ khách. Một số mục sẽ cần đăng nhập để sử dụng.
              </Text>
            </View>
          ) : null}
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

function MenuSection({
  items,
  subtitle,
  title,
}: {
  items: MenuItemConfig[];
  subtitle: string;
  title: string;
}) {
  return (
    <View className="mt-5">
      <Text className="text-[17px] font-black text-[#2B2233]">{title}</Text>
      <Text className="mt-1 text-[12px] leading-5 text-[#8E869A]">{subtitle}</Text>

      <View className="mt-3 rounded-[28px] bg-white px-3 py-2" style={cardShadow}>
        {items.map((item, index) => (
          <MenuItem
            key={item.label}
            item={item}
            showBorder={index < items.length - 1}
          />
        ))}
      </View>
    </View>
  );
}

function MenuItem({
  item,
  showBorder,
}: {
  item: MenuItemConfig;
  showBorder: boolean;
}) {
  const tintColor = item.isDestructive ? "#D95C4F" : "#2B2233";
  const secondaryColor = item.isDestructive ? "#D95C4F" : "#8E869A";

  return (
    <Pressable
      className="flex-row items-center gap-3 rounded-[22px] px-2 py-3"
      onPress={item.onPress}
      style={{
        borderBottomColor: showBorder ? "#F1EEF5" : "transparent",
        borderBottomWidth: showBorder ? 1 : 0,
      }}
    >
      <View
        className="h-12 w-12 items-center justify-center rounded-2xl"
        style={{ backgroundColor: item.isDestructive ? "#FFF3F0" : "#FFF4EF" }}
      >
        <SymbolView name={item.icon} size={20} tintColor={tintColor} />
      </View>

      <View className="min-w-0 flex-1">
        <Text
          className="text-[15px] font-extrabold"
          style={{ color: tintColor }}
          numberOfLines={1}
        >
          {item.label}
        </Text>
        {item.description ? (
          <Text className="mt-1 text-[12px] leading-5" style={{ color: secondaryColor }}>
            {item.description}
          </Text>
        ) : null}
      </View>

      <View className="items-end">
        {item.value ? (
          <Text className="mb-1 text-[12px] font-extrabold text-[#F58752]">
            {item.value}
          </Text>
        ) : null}
        <SymbolView
          name={{ ios: "chevron.right", android: "chevron_right", web: "chevron_right" }}
          size={16}
          tintColor={secondaryColor}
        />
      </View>
    </Pressable>
  );
}
