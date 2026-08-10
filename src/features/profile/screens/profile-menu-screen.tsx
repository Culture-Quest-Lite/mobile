import { SymbolView } from "@/components/ui/symbol-view";
import { ScreenHorizontalPadding } from "@/constants/theme";
import * as ImagePicker from "expo-image-picker";
import { LinearGradient } from "expo-linear-gradient";
import { useRouter, type Href } from "expo-router";
import { useState } from "react";
import {
  ActivityIndicator,
  Alert,
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
import { useTranslation } from "react-i18next";

import {
  getValidAccessToken,
  resetAuthSessionToGuest,
  useAuthSession,
} from "@/features/auth/hooks/use-auth-session";
import { bodyLineHeightFor, lineHeightFor } from "@/lib/text-scale";
import { updateMyProfile } from "../api/update-me";
import { resetPremiumStatus } from "../hooks/use-premium-status";
import { useProfile } from "../hooks/use-profile";

function getUpdateProfileErrorMessage(error: unknown) {
  if (error instanceof Error && error.message.trim()) {
    return error.message;
  }

  return "Không thể cập nhật ảnh đại diện.";
}

function getUpdateCoverErrorMessage(error: unknown) {
  if (error instanceof Error && error.message.trim()) {
    return error.message;
  }

  return "Không thể cập nhật ảnh bìa.";
}

const gradientColors = ["#EB489B", "#F58752", "#FFC93C"] as const;
const detailTextMaxFontSizeMultiplier = 1.05;

type MenuRowConfig = {
  isDestructive?: boolean;
  isLoading?: boolean;
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

function getProfileTitle(name: string | undefined, fallbackName: string, t: (key: string) => string) {
  const normalizedName = name?.trim();

  if (normalizedName) {
    return normalizedName;
  }

  const resolvedFallbackName = fallbackName.trim();
  return resolvedFallbackName || t('profile.title');
}

export default function ProfileMenuScreen() {
  const router = useRouter();
  const authSession = useAuthSession();
  const { profile, reloadProfile } = useProfile();
  const insets = useSafeAreaInsets();
  const [isChangingAvatar, setIsChangingAvatar] = useState(false);
  const [isChangingCover, setIsChangingCover] = useState(false);
  const { t, i18n } = useTranslation();

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

  const handleChangeAvatar = async () => {
    if (!profile || isChangingAvatar) {
      return;
    }

    const permissionResult =
      await ImagePicker.requestMediaLibraryPermissionsAsync();

    if (!permissionResult.granted) {
      Alert.alert(
        "Cần cấp quyền",
        "Hãy cho phép truy cập thư viện để đổi ảnh đại diện.",
      );
      return;
    }

    const pickerResult = await ImagePicker.launchImageLibraryAsync({
      allowsEditing: true,
      aspect: [1, 1],
      mediaTypes: ["images"],
      quality: 0.85,
    });

    if (pickerResult.canceled || pickerResult.assets.length === 0) {
      return;
    }

    const pickedAvatarAsset = pickerResult.assets[0];

    if (!pickedAvatarAsset?.uri) {
      return;
    }

    setIsChangingAvatar(true);

    try {
      const accessToken = await getValidAccessToken();

      if (!accessToken) {
        throw new Error(
          "Phiên đăng nhập không hợp lệ. Vui lòng đăng nhập lại.",
        );
      }

      await updateMyProfile({
        accessToken,
        autoPlayAudio: profile.autoPlayAudio ?? false,
        avatarFile: {
          mimeType: pickedAvatarAsset.mimeType,
          name: pickedAvatarAsset.fileName,
          uri: pickedAvatarAsset.uri,
        },
        displayName: profile.name,
        tokenType: authSession.tokenType,
      });

      await reloadProfile();
    } catch (error) {
      Alert.alert("Không thể đổi ảnh đại diện", getUpdateProfileErrorMessage(error));
    } finally {
      setIsChangingAvatar(false);
    }
  };

  const handleChangeCover = async () => {
    if (!profile || isChangingCover) {
      return;
    }

    const permissionResult =
      await ImagePicker.requestMediaLibraryPermissionsAsync();

    if (!permissionResult.granted) {
      Alert.alert(
        "Cần cấp quyền",
        "Hãy cho phép truy cập thư viện để đổi ảnh bìa.",
      );
      return;
    }

    const pickerResult = await ImagePicker.launchImageLibraryAsync({
      allowsEditing: true,
      aspect: [16, 9],
      mediaTypes: ["images"],
      quality: 0.85,
    });

    if (pickerResult.canceled || pickerResult.assets.length === 0) {
      return;
    }

    const pickedCoverAsset = pickerResult.assets[0];

    if (!pickedCoverAsset?.uri) {
      return;
    }

    setIsChangingCover(true);

    try {
      const accessToken = await getValidAccessToken();

      if (!accessToken) {
        throw new Error(
          "Phiên đăng nhập không hợp lệ. Vui lòng đăng nhập lại.",
        );
      }

      await updateMyProfile({
        accessToken,
        autoPlayAudio: profile.autoPlayAudio ?? false,
        backgroundFile: {
          mimeType: pickedCoverAsset.mimeType,
          name: pickedCoverAsset.fileName,
          uri: pickedCoverAsset.uri,
        },
        displayName: profile.name,
        tokenType: authSession.tokenType,
      });

      await reloadProfile();
    } catch (error) {
      Alert.alert("Không thể đổi ảnh bìa", getUpdateCoverErrorMessage(error));
    } finally {
      setIsChangingCover(false);
    }
  };

  const displayName = getProfileTitle(profile?.name, authSession.displayName, t);

  const currentLanguage = i18n.language === 'en' ? t('settings.language.english') : t('settings.language.vietnamese');

  const informationRows: MenuRowConfig[] = [
    {
      label: t('profile.menu.information'),
      onPress: () => {
        router.push("/profile/information" as Href);
      },
    },
    {
      isLoading: isChangingAvatar,
      label: "Đổi ảnh đại diện",
      onPress: () => {
        void handleChangeAvatar();
      },
    },
    {
      isLoading: isChangingCover,
      label: "Đổi ảnh bìa",
      onPress: () => {
        void handleChangeCover();
      },
    },
    {
      label: t('profile.menu.updateBio'),
      onPress: () => {},
    },
    {
      label: t('profile.menu.vouchers'),
      onPress: () => {
        router.push("/vouchers" as Href);
      },
    },
  ];

  const settingsRows: MenuRowConfig[] = [
    {
      label: t('profile.menu.notifications'),
      onPress: () => {
        router.push("/notifications" as Href);
      },
    },
    {
      label: t('profile.menu.subscription'),
      onPress: () => {
        router.push("/subscription" as Href);
      },
    },
    {
      label: t('profile.menu.myQRCode'),
      onPress: () => {},
    },
    {
      label: t('profile.menu.privacy'),
      onPress: () => {},
    },
    {
      label: t('profile.menu.accountManagement'),
      onPress: () => {},
    },
    {
      label: t('profile.menu.language'),
      value: currentLanguage,
      onPress: () => {
        router.push("/settings/language" as Href);
      },
    },
    {
      label: t('profile.menu.generalSettings'),
      onPress: () => {},
    },
    {
      label: "Kho lưu trữ",
      onPress: () => {
        router.push("/community/trash" as Href);
      },
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
              accessibilityLabel={t('common.back')}
              className="h-9 w-9 items-center justify-center rounded-full border border-white/25 bg-white/15"
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
            {t('profile.menu.settings')}
          </Text>

          <MenuList rows={settingsRows} />

          {authSession.isAuthenticated ? (
            <>
              <View className="h-2 bg-[#F5F5F8]" />

              <LogoutButton onPress={handleLogout} />
            </>
          ) : (
            <View className="border-t border-[#ECE8F2] px-4 py-3">
              <Text className="text-[13px] text-[#9A94A8]" style={{ lineHeight: 18 }}>
                {t('profile.menu.guestMode')}
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
  const { t } = useTranslation();

  return (
    <View className="px-4 py-3">
      <Pressable
        accessibilityLabel={t('profile.menu.logout')}
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
          {t('profile.menu.logout')}
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
      disabled={row.isLoading}
      onPress={row.onPress}
      style={[
        showDivider
          ? {
              borderBottomColor: "#ECE8F2",
              borderBottomWidth: 1,
            }
          : undefined,
        row.isLoading ? { opacity: 0.6 } : undefined,
      ]}
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

        {row.isLoading ? (
          <ActivityIndicator color={valueColor} size="small" />
        ) : (
          <SymbolView
            name={{
              ios: "chevron.right",
              android: "chevron_right",
              web: "chevron_right",
            }}
            size={16}
            tintColor={valueColor}
          />
        )}
      </View>
    </Pressable>
  );
}
