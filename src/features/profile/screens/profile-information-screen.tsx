import { LinearGradient } from "expo-linear-gradient";
import { useRouter } from "expo-router";
import { SymbolView } from "@/components/ui/symbol-view";
import { ScreenHorizontalPadding } from "@/constants/theme";
import { type ReactNode, useEffect, useState } from "react";
import {
  ActivityIndicator,
  Pressable,
  ScrollView,
  Switch,
  Text as RNText,
  TextInput,
  View,
  type TextProps,
} from "react-native";
import {
  SafeAreaView,
  useSafeAreaInsets,
} from "react-native-safe-area-context";

import {
  getValidAccessToken,
  useAuthSession,
} from "@/features/auth/hooks/use-auth-session";
import { bodyLineHeightFor, lineHeightFor } from "@/lib/text-scale";

import { getMyProfile } from "../api/get-me";
import { updateMyProfile } from "../api/update-me";
import { setCurrentProfile } from "../data/current-profile-store";
import { setPremiumStatusFromProfile } from "../hooks/use-premium-status";
import type { Profile } from "../types";

const gradientColors = ["#EB489B", "#F58752", "#FFC93C"] as const;
const detailTextMaxFontSizeMultiplier = 1.05;

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

type InformationRow = {
  helperText?: string;
  key:
    | "autoPlayAudio"
    | "createdAt"
    | "displayName"
    | "email"
    | "points"
    | "premium"
    | "totalXp"
    | "username";
  label: string;
  valueTone?: "default" | "free" | "premium";
  value: string;
};

function formatUsername(username: string) {
  const normalizedUsername = username.replace(/^@+/, "").trim();
  return normalizedUsername ? `@${normalizedUsername}` : "Chưa cập nhật";
}

function formatBoolean(value: boolean | null | undefined) {
  if (typeof value !== "boolean") {
    return "Chưa cập nhật";
  }

  return value ? "Tự động" : "Tắt";
}

function formatPremium(value: boolean) {
  return value ? "Premium" : "Miễn phí";
}

function formatDate(dateString: string | null) {
  if (!dateString) {
    return "Chưa cập nhật";
  }

  const match = dateString.match(/^(\d{4})-(\d{2})-(\d{2})/);

  if (!match) {
    return dateString;
  }

  return `${match[3]}/${match[2]}/${match[1]}`;
}

function formatNumber(value: number) {
  return value.toLocaleString("vi-VN");
}

function buildInformationRows(profile: Profile): InformationRow[] {
  return [
    {
      key: "displayName",
      label: "Tên hiển thị",
      value: profile.name.trim() || "Chưa cập nhật",
    },
    {
      key: "username",
      label: "Tên đăng nhập",
      value: formatUsername(profile.username),
    },
    {
      key: "email",
      label: "Email",
      value: profile.email?.trim() || "Chưa cập nhật",
    },

    {
      key: "createdAt",
      label: "Ngày tham gia",
      value: formatDate(profile.createdAt),
    },
    {
      key: "totalXp",
      label: "Tổng XP",
      value: formatNumber(profile.totalXp),
    },
    {
      key: "points",
      label: "Tổng điểm",
      value: formatNumber(profile.points),
    },
    {
      key: "autoPlayAudio",
      label: "Tự động phát audio",
      value: formatBoolean(profile.autoPlayAudio),
    },
    {
      helperText: profile.isPremium
        ? "Tài khoản đang có quyền lợi premium."
        : "Tài khoản hiện chưa bật premium.",
      key: "premium",
      label: "Gói đăng ký",
      valueTone: profile.isPremium ? "premium" : "free",
      value: formatPremium(profile.isPremium),
    },
  ];
}

function getErrorMessage(error: unknown) {
  if (error instanceof Error && error.message.trim()) {
    return error.message;
  }

  return "Không thể tải thông tin cá nhân.";
}

export default function ProfileInformationScreen() {
  const router = useRouter();
  const authSession = useAuthSession();
  const insets = useSafeAreaInsets();
  const [profile, setProfile] = useState<Profile | null>(null);
  const [draftDisplayName, setDraftDisplayName] = useState("");
  const [draftAutoPlayAudio, setDraftAutoPlayAudio] = useState(false);
  const [isEditing, setIsEditing] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [submitMessage, setSubmitMessage] = useState<string | null>(null);
  const [requestVersion, setRequestVersion] = useState(0);

  const syncDraftFields = (nextProfile: Profile) => {
    setDraftDisplayName(nextProfile.name.trim());
    setDraftAutoPlayAudio(nextProfile.autoPlayAudio ?? false);
  };

  useEffect(() => {
    let isActive = true;

    const loadProfile = async () => {
      if (!authSession.isAuthenticated) {
        if (!isActive) {
          return;
        }

        setProfile(null);
        setErrorMessage("Bạn cần đăng nhập để xem thông tin cá nhân.");
        setIsLoading(false);
        return;
      }

      setIsLoading(true);
      setErrorMessage(null);
      setSubmitMessage(null);

      try {
        const accessToken = await getValidAccessToken();

        if (!accessToken) {
          throw new Error(
            "Phiên đăng nhập không hợp lệ. Vui lòng đăng nhập lại.",
          );
        }

        const nextProfile = await getMyProfile({
          accessToken,
          tokenType: authSession.tokenType,
        });

        if (!isActive) {
          return;
        }

        setProfile(nextProfile);
        syncDraftFields(nextProfile);
      } catch (error) {
        if (!isActive) {
          return;
        }

        setErrorMessage(getErrorMessage(error));
      } finally {
        if (isActive) {
          setIsLoading(false);
        }
      }
    };

    void loadProfile();

    return () => {
      isActive = false;
    };
  }, [authSession.isAuthenticated, authSession.tokenType, requestVersion]);

  const handleBack = () => {
    if (router.canGoBack()) {
      router.back();
      return;
    }

    router.replace("/profile/menu");
  };

  const handleSubmitProfile = async () => {
    if (!profile || isSubmitting) {
      return;
    }

    if (!isEditing) {
      syncDraftFields(profile);
      setSubmitMessage(null);
      setIsEditing(true);
      return;
    }

    setIsSubmitting(true);
    setSubmitMessage(null);

    try {
      const accessToken = await getValidAccessToken();
      const normalizedDisplayName =
        draftDisplayName.trim() || profile.username.trim();

      if (!accessToken) {
        throw new Error(
          "Phiên đăng nhập không hợp lệ. Vui lòng đăng nhập lại.",
        );
      }

      const updatedProfile = await updateMyProfile({
        accessToken,
        autoPlayAudio: draftAutoPlayAudio,
        displayName: normalizedDisplayName,
        tokenType: authSession.tokenType,
      });

      if (updatedProfile) {
        setProfile(updatedProfile);
        syncDraftFields(updatedProfile);
        setCurrentProfile(updatedProfile);
        setPremiumStatusFromProfile(updatedProfile.isPremium);
      } else {
        const nextProfile = {
          ...profile,
          autoPlayAudio: draftAutoPlayAudio,
          name: normalizedDisplayName,
        };
        setProfile(nextProfile);
        syncDraftFields(nextProfile);
        setCurrentProfile(nextProfile);
        setPremiumStatusFromProfile(nextProfile.isPremium);
      }

      setIsEditing(false);
      setSubmitMessage(null);
    } catch (error) {
      setSubmitMessage(getErrorMessage(error));
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleCancelEdit = () => {
    if (!profile || isSubmitting) {
      return;
    }

    syncDraftFields(profile);
    setIsEditing(false);
    setSubmitMessage(null);
  };

  const informationRows = profile ? buildInformationRows(profile) : [];

  return (
    <SafeAreaView
      className="flex-1 bg-white"
      edges={["left", "right", "bottom"]}
    >
      <ScrollView
        className="flex-1"
        contentContainerStyle={{
          paddingBottom: Math.max(insets.bottom, 24) + 24,
        }}
        showsVerticalScrollIndicator={false}
      >
        <LinearGradient
          colors={gradientColors}
          end={{ x: 1, y: 0.5 }}
          start={{ x: 0, y: 0.5 }}
          style={{
            paddingBottom: 18,
            paddingHorizontal: ScreenHorizontalPadding,
            paddingTop: insets.top + 12,
          }}
        >
          <View className="flex-row items-center justify-between">
            <Pressable
              accessibilityLabel="Quay lại menu hồ sơ"
              className="h-10 w-10 items-center justify-center rounded-full border border-white/25 bg-white/15"
              onPress={handleBack}
            >
              <SymbolView
                name={{
                  ios: "chevron.left",
                  android: "arrow_back",
                  web: "arrow_back",
                }}
                size={18}
                tintColor="#FFF7F0"
              />
            </Pressable>

            <Text
              className="flex-1 px-3 text-center text-[18px] font-semibold text-white"
              numberOfLines={1}
              style={{ lineHeight: lineHeightFor(18) }}
            >
              Thông tin cá nhân
            </Text>

            <View className="h-10 w-10" />
          </View>
        </LinearGradient>

        <View className="">
          {isLoading && !profile ? (
            <View className="px-4">
              <StateCard>
                <ActivityIndicator color="#F58752" size="large" />
              </StateCard>
            </View>
          ) : null}

          {!isLoading && !profile && errorMessage ? (
            <View className="px-4">
              <StateCard
                actionLabel={
                  authSession.isAuthenticated ? "Tải lại" : "Đăng nhập"
                }
                description={errorMessage}
                onPress={
                  authSession.isAuthenticated
                    ? () => setRequestVersion((value) => value + 1)
                    : () => router.push("/login")
                }
                title="Không thể hiển thị thông tin"
              />
            </View>
          ) : null}

          {profile ? (
            <>
              {errorMessage ? (
                <View className="px-4">
                  <InlineNotice message={errorMessage} tone="error" />
                </View>
              ) : null}

              <View className="bg-white">
                <View className="bg-white">
                  {informationRows.map((row, index) => (
                    <InformationDetailRow
                      draftAutoPlayAudio={draftAutoPlayAudio}
                      draftDisplayName={draftDisplayName}
                      isEditing={isEditing}
                      key={row.label}
                      onChangeAutoPlayAudio={setDraftAutoPlayAudio}
                      onChangeDisplayName={setDraftDisplayName}
                      row={row}
                      showDivider={index < informationRows.length - 1}
                    />
                  ))}
                </View>

                {submitMessage ? (
                  <View className="px-4 pb-1 pt-4">
                    <InlineNotice message={submitMessage} />
                  </View>
                ) : null}

                <View className="border-t border-[#ECE8F2] px-4 py-4">
                  <View className="flex-row gap-3">
                    {isEditing ? (
                      <Pressable
                        accessibilityLabel="Hủy chỉnh sửa"
                        className="flex-1 items-center justify-center rounded-full border border-[#D8DDE3] bg-white px-4 py-3"
                        disabled={isSubmitting}
                        onPress={handleCancelEdit}
                        style={{ opacity: isSubmitting ? 0.72 : 1 }}
                      >
                        <Text
                          className="text-[14px] font-semibold text-[#6E667C]"
                          style={{ lineHeight: lineHeightFor(14) }}
                        >
                          Hủy
                        </Text>
                      </Pressable>
                    ) : null}

                    <Pressable
                      accessibilityLabel={
                        isEditing
                          ? "Lưu thay đổi thông tin cá nhân"
                          : "Bật chế độ chỉnh sửa thông tin cá nhân"
                      }
                      className="flex-1 flex-row items-center justify-center gap-2 rounded-full bg-[#E9EEF1] px-4 py-3"
                      disabled={isSubmitting}
                      onPress={() => {
                        void handleSubmitProfile();
                      }}
                      style={{ opacity: isSubmitting ? 0.72 : 1 }}
                    >
                      {isSubmitting ? (
                        <ActivityIndicator color="#2B2233" size="small" />
                      ) : (
                        <SymbolView
                          name={
                            isEditing
                              ? {
                                  ios: "checkmark",
                                  android: "check",
                                  web: "check",
                                }
                              : {
                                  ios: "pencil",
                                  android: "edit",
                                  web: "edit",
                                }
                          }
                          size={15}
                          tintColor="#2B2233"
                        />
                      )}
                      <Text
                        className="text-[14px] font-semibold text-[#2B2233]"
                        style={{ lineHeight: lineHeightFor(14) }}
                      >
                        {isSubmitting
                          ? "Đang lưu..."
                          : isEditing
                            ? "Lưu thay đổi"
                            : "Chỉnh sửa"}
                      </Text>
                    </Pressable>
                  </View>
                </View>
              </View>
            </>
          ) : null}
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

function StateCard({
  actionLabel,
  children,
  description,
  onPress,
  title,
}: {
  actionLabel?: string;
  children?: ReactNode;
  description?: string;
  onPress?: () => void;
  title?: string;
}) {
  return (
    <View className="rounded-[28px] bg-white px-5 py-6">
      <View className="items-center">
        {children}
        {title ? (
          <Text
            className="mt-3 text-center text-[16px] font-semibold text-[#27233A]"
            style={{ lineHeight: lineHeightFor(16) }}
          >
            {title}
          </Text>
        ) : null}
        {description ? (
          <Text
            className="mt-2 text-center text-[13px] text-[#8E869A]"
            style={{ lineHeight: bodyLineHeightFor(13) }}
          >
            {description}
          </Text>
        ) : null}
      </View>

      {actionLabel && onPress ? (
        <Pressable
          className="mt-5 items-center justify-center rounded-full bg-[#F3F5F7] px-4 py-3.5"
          onPress={onPress}
        >
          <Text
            className="text-[14px] font-semibold text-[#2B2233]"
            style={{ lineHeight: lineHeightFor(14) }}
          >
            {actionLabel}
          </Text>
        </Pressable>
      ) : null}
    </View>
  );
}

function InlineNotice({
  message,
  tone = "error",
}: {
  message: string;
  tone?: "error";
}) {
  const palette =
    tone === "error"
      ? {
          backgroundColor: "#FFF4F1",
          borderColor: "#F6C9C0",
          textColor: "#B54D3A",
        }
      : {
          backgroundColor: "#FFF4F1",
          borderColor: "#F6C9C0",
          textColor: "#B54D3A",
        };

  return (
    <View
      className="mb-4 rounded-[22px] border px-4 py-3"
      style={{
        backgroundColor: palette.backgroundColor,
        borderColor: palette.borderColor,
      }}
    >
      <Text
        className="text-[12px] font-semibold"
        style={{ color: palette.textColor, lineHeight: bodyLineHeightFor(12) }}
      >
        {message}
      </Text>
    </View>
  );
}

function InformationDetailRow({
  draftAutoPlayAudio,
  draftDisplayName,
  isEditing,
  onChangeAutoPlayAudio,
  onChangeDisplayName,
  row,
  showDivider,
}: {
  draftAutoPlayAudio: boolean;
  draftDisplayName: string;
  isEditing: boolean;
  onChangeAutoPlayAudio: (value: boolean) => void;
  onChangeDisplayName: (value: string) => void;
  row: InformationRow;
  showDivider: boolean;
}) {
  const isPremiumValue = row.valueTone === "premium";
  const isFreeValue = row.valueTone === "free";
  const isDisplayNameEditable = isEditing && row.key === "displayName";
  const isAutoPlayAudioEditable = isEditing && row.key === "autoPlayAudio";

  const planPalette = isPremiumValue
    ? { backgroundColor: "#FFF3D6", textColor: "#9A6B00" }
    : { backgroundColor: "#F0F1F5", textColor: "#6E667C" };

  return (
    <View
      className="flex-row items-start gap-4 px-5 py-5"
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
        className="pt-0.5 text-[14px] font-medium text-[#8E869A]"
        style={{ lineHeight: lineHeightFor(14), width: 110 }}
      >
        {row.label}
      </Text>

      <View className="min-w-0 flex-1">
        {isDisplayNameEditable ? (
          <TextInput
            className="rounded-[20px] border border-[#E2E7EC] bg-[#F7F9FB] px-4 py-3 text-[15px] text-[#27233A]"
            onChangeText={onChangeDisplayName}
            placeholder="Nhập tên hiển thị"
            placeholderTextColor="#A39CAF"
            selectionColor="#EB489B"
            style={{ lineHeight: lineHeightFor(15) }}
            value={draftDisplayName}
          />
        ) : isAutoPlayAudioEditable ? (
          <View className="flex-row items-center justify-between rounded-[20px] border border-[#E2E7EC] bg-[#F7F9FB] px-4 py-3">
            <Text
              className="pr-3 text-[15px] text-[#27233A]"
              style={{ lineHeight: lineHeightFor(15) }}
            >
              {draftAutoPlayAudio ? "Tự động" : "Tắt"}
            </Text>
            <Switch
              onValueChange={onChangeAutoPlayAudio}
              thumbColor="#FFFFFF"
              trackColor={{ false: "#D5DAE0", true: "#6BCB8B" }}
              value={draftAutoPlayAudio}
            />
          </View>
        ) : isPremiumValue || isFreeValue ? (
          <View
            className="flex-row items-center gap-1.5 self-start rounded-full px-3 py-1.5"
            style={{ backgroundColor: planPalette.backgroundColor }}
          >
            {isPremiumValue ? (
              <SymbolView
                name={{
                  ios: "crown.fill",
                  android: "workspace_premium",
                  web: "workspace_premium",
                }}
                size={13}
                tintColor={planPalette.textColor}
              />
            ) : null}
            <Text
              className="text-[13px] font-semibold"
              style={{
                color: planPalette.textColor,
                lineHeight: lineHeightFor(13),
              }}
            >
              {row.value}
            </Text>
          </View>
        ) : (
          <Text
            className="text-[15px] text-[#27233A]"
            style={{ lineHeight: bodyLineHeightFor(15) }}
          >
            {row.value}
          </Text>
        )}

        {row.helperText ? (
          <Text
            className="mt-1.5 text-[12px] text-[#8E869A]"
            style={{ lineHeight: bodyLineHeightFor(12) }}
          >
            {row.helperText}
          </Text>
        ) : null}
      </View>
    </View>
  );
}
