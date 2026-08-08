import { SymbolView } from "@/components/ui/symbol-view";
import { ScreenHorizontalPadding } from "@/constants/theme";
import { LinearGradient } from "expo-linear-gradient";
import { useRouter, type Href } from "expo-router";
import {
  Pressable,
  Text as RNText,
  ScrollView,
  View,
  type TextProps,
} from "react-native";
import {
  SafeAreaView,
  useSafeAreaInsets,
} from "react-native-safe-area-context";

import {
  resetAuthSessionToGuest,
  useAuthSession,
} from "@/features/auth/hooks/use-auth-session";
import { bodyLineHeightFor, lineHeightFor } from "@/lib/text-scale";
import { resetPremiumStatus } from "../hooks/use-premium-status";
import { useProfile } from "../hooks/use-profile";

const gradientColors = ["#F8B1C8", "#EB489B", "#F58752"] as const;
const detailTextMaxFontSizeMultiplier = 1.05;

type MenuRowConfig = {
  isDestructive?: boolean;
  label: string;
  onPress: () => void;
  value?: string;
};

function Text({
  maxFontSizeMultiplier = detailTextMaxFontSizeMultiplier,
  style,
  ...props
}: TextProps) {
  return (
    <RNText
      maxFontSizeMultiplier={maxFontSizeMultiplier}
      style={[{ includeFontPadding: false }, style]}
      {...props}
    />
  );
}

function getProfileTitle(name: string | undefined, fallbackName: string) {
  const normalizedName = name?.trim();

  if (normalizedName) {
    return normalizedName;
  }

  const resolvedFallbackName = fallbackName.trim();
  return resolvedFallbackName || "Hồ sơ";
}

export default function ProfileMenuScreen() {
  const router = useRouter();
  const authSession = useAuthSession();
  const { profile } = useProfile();
  const insets = useSafeAreaInsets();

  const handleBackToProfile = () => {
    if (router.canGoBack()) {
      router.back();
      return;
    }

    router.replace("/profile");
  };

  const handleLogout = () => {
    resetAuthSessionToGuest();
    // Store isPremium là singleton dùng chung cho cả app -> phải xoá khi logout,
    // nếu không tài khoản đăng nhập kế tiếp sẽ thừa hưởng isPremium của user cũ.
    resetPremiumStatus();
    router.replace("/home");
  };

  const displayName = getProfileTitle(profile?.name, authSession.displayName);

  const informationRows: MenuRowConfig[] = [
    {
      label: "Thông tin",
      onPress: () => {
        router.push("/profile/information" as Href);
      },
    },
    {
      label: "Đổi ảnh đại diện",
      onPress: () => {},
    },
    {
      label: "Đổi ảnh bìa",
      onPress: () => {},
    },
    {
      label: "Kho voucher",
      onPress: () => {
        router.push("/vouchers" as Href);
      },
    },
  ];

  const settingsRows: MenuRowConfig[] = [
    {
      label: "Thông báo",
      onPress: () => {
        router.push("/notifications" as Href);
      },
    },
    {
      label: "Gói đăng ký",
      onPress: () => {
        router.push("/subscription" as Href);
      },
    },
    {
      label: "Quản lý tài khoản",
      onPress: () => {},
    },
    {
      label: "Cài đặt chung",
      onPress: () => {},
    },
  ];

  return (
    <SafeAreaView
      className="flex-1 bg-white"
      edges={["left", "right", "bottom"]}
    >
      <ScrollView
        className="flex-1 bg-white"
        contentContainerStyle={{
          paddingBottom: Math.max(insets.bottom, 12) + 12,
        }}
        showsVerticalScrollIndicator={false}
      >
        <LinearGradient
          colors={gradientColors}
          end={{ x: 1, y: 0.5 }}
          start={{ x: 0, y: 0.5 }}
          style={{
            paddingBottom: 12,
            paddingHorizontal: ScreenHorizontalPadding,
            paddingTop: insets.top + 8,
          }}
        >
          <View className="flex-row items-center justify-between">
            <Pressable
              accessibilityLabel="Quay lại hồ sơ"
              className="h-9 w-9 items-center justify-center rounded-full border border-[#F6C9D9] bg-white/70"
              onPress={handleBackToProfile}
            >
              <SymbolView
                name={{
                  ios: "chevron.left",
                  android: "arrow_back",
                  web: "arrow_back",
                }}
                size={18}
                tintColor="#C53D6C"
              />
            </Pressable>

            <Text
              className="flex-1 px-3 text-center text-[19px] font-semibold text-white"
              numberOfLines={1}
              style={{ lineHeight: lineHeightFor(19) }}
            >
              {displayName}
            </Text>

            <View className="h-9 w-9" />
          </View>
        </LinearGradient>

        <View className="bg-white">
          <MenuList rows={informationRows} />

          <View className="h-2 bg-[#F5F5F8]" />

          <Text
            className="px-4 py-2.5 text-[14px] font-semibold text-[#EB489B]"
            style={{ lineHeight: lineHeightFor(14) }}
          >
            Cài đặt
          </Text>

          <MenuList rows={settingsRows} />

          {authSession.isAuthenticated ? (
            <>
              <View className="h-2 bg-[#F5F5F8]" />

              <LogoutButton onPress={handleLogout} />
            </>
          ) : (
            <View className="border-t border-[#ECE8F2] px-4 py-3">
              <Text
                className="text-[13px] text-[#9A94A8]"
                style={{ lineHeight: bodyLineHeightFor(13) }}
              >
                Bạn đang ở chế độ khách. Một số mục sẽ cần đăng nhập để sử dụng.
              </Text>
            </View>
          )}
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

function MenuList({ rows }: { rows: MenuRowConfig[] }) {
  return (
    <View className="bg-white">
      {rows.map((row, index) => (
        <MenuRow
          key={row.label}
          row={row}
          showDivider={index < rows.length - 1}
        />
      ))}
    </View>
  );
}

function LogoutButton({ onPress }: { onPress: () => void }) {
  return (
    <View className="px-4 py-3">
      <Pressable
        accessibilityLabel="Đăng xuất"
        className="flex-row items-center justify-center gap-2 rounded-full bg-[#E9EEF1] px-4 py-3"
        onPress={onPress}
      >
        <SymbolView
          name={{
            ios: "rectangle.portrait.and.arrow.right",
            android: "logout",
            web: "logout",
          }}
          size={18}
          tintColor="#E54572"
        />
        <Text
          className="text-[15px] text-[#E54572]"
          style={{ lineHeight: bodyLineHeightFor(15) }}
        >
          Đăng xuất
        </Text>
      </Pressable>
    </View>
  );
}

function MenuRow({
  row,
  showDivider,
}: {
  row: MenuRowConfig;
  showDivider: boolean;
}) {
  const labelColor = row.isDestructive ? "#E54572" : "#27233A";
  const valueColor = row.isDestructive ? "#E54572" : "#A39CAF";

  return (
    <Pressable
      className="flex-row items-center gap-3 px-4 py-3"
      onPress={row.onPress}
      style={
        showDivider
          ? {
              borderBottomColor: "#ECE8F2",
              borderBottomWidth: 1,
            }
          : undefined
      }
    >
      <Text
        className="min-w-0 flex-1 text-[15px]"
        style={{ color: labelColor, lineHeight: bodyLineHeightFor(15) }}
      >
        {row.label}
      </Text>

      <View className="flex-row items-center gap-2" style={{ maxWidth: "56%" }}>
        {row.value ? (
          <Text
            className="text-right text-[13px]"
            numberOfLines={2}
            style={{ color: valueColor, lineHeight: lineHeightFor(13) }}
          >
            {row.value}
          </Text>
        ) : null}

        <SymbolView
          name={{
            ios: "chevron.right",
            android: "chevron_right",
            web: "chevron_right",
          }}
          size={16}
          tintColor={valueColor}
        />
      </View>
    </Pressable>
  );
}
