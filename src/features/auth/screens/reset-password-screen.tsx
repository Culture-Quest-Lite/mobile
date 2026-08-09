import { LinearGradient } from "expo-linear-gradient";
import { useLocalSearchParams, useRouter } from "expo-router";
import { SymbolView } from "@/components/ui/symbol-view";
import { useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import {
  Image,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  Text,
  View,
} from "react-native";
import Animated, {
  Easing,
  ReduceMotion,
  cancelAnimation,
  useAnimatedStyle,
  useSharedValue,
  withRepeat,
  withTiming,
} from "react-native-reanimated";
import { SafeAreaView } from "react-native-safe-area-context";

import { resetPassword } from "@/features/auth/api/reset-password";
import { AuthInput } from "@/features/auth/components/auth-input";
import { useAuthScreenLayout } from "@/features/auth/hooks/use-auth-screen-layout";
import {
  hasAnyFieldError,
  validateResetPasswordForm,
} from "@/features/auth/utils/validation";

const gradientColors = ["#EB489B", "#F58752", "#FFC93C"] as const;

const cardShadowStyle = {
  shadowColor: "rgba(235, 72, 155, 0.22)",
  shadowOpacity: 1,
  shadowRadius: 26,
  shadowOffset: {
    width: 0,
    height: 20,
  },
  elevation: 12,
} as const;

const buttonShadowStyle = {
  shadowColor: "rgba(235, 72, 155, 0.22)",
  shadowOpacity: 1,
  shadowRadius: 18,
  shadowOffset: {
    width: 0,
    height: 10,
  },
  elevation: 6,
} as const;

export default function ResetPasswordScreen() {
  const { t } = useTranslation();
  const router = useRouter();
  const { token: tokenParam } = useLocalSearchParams<{ token?: string }>();
  const {
    backButtonTop,
    cardMaxWidth,
    horizontalPadding,
    insets,
    isCompactScreen,
    scrollContentMinHeight,
  } = useAuthScreenLayout(760);
  const logoFloat = useSharedValue(0);
  const [confirmPassword, setConfirmPassword] = useState("");
  const [didAttemptSubmit, setDidAttemptSubmit] = useState(false);
  const [didResetSucceed, setDidResetSucceed] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [newPassword, setNewPassword] = useState("");
  const [touchedFields, setTouchedFields] = useState<{
    confirmPassword: boolean;
    newPassword: boolean;
  }>({ confirmPassword: false, newPassword: false });
  const [isNewPasswordVisible, setIsNewPasswordVisible] = useState(false);
  const [isConfirmPasswordVisible, setIsConfirmPasswordVisible] = useState(false);
  const token = tokenParam?.trim() ?? "";
  const heroHeight = isCompactScreen ? 220 : 266;
  const heroTopPadding = insets.top + (isCompactScreen ? 18 : 28);
  const heroBottomPadding = isCompactScreen ? 32 : 60;
  const logoSize = isCompactScreen ? 140 : 184;
  const cardTopPadding = isCompactScreen ? 22 : 30;
  const cardBottomPadding = Math.max(
    insets.bottom + (isCompactScreen ? 18 : 24),
    isCompactScreen ? 22 : 30,
  );
  const titleSize = isCompactScreen ? 25 : 29;
  const sectionTopMargin = isCompactScreen ? 22 : 30;
  const fieldHeightClassName = isCompactScreen
    ? "h-12 rounded-2xl"
    : "h-14 rounded-2xl";
  const buttonHeightClassName = isCompactScreen ? "h-12" : "h-14";
  const secondaryButtonHeightClassName = isCompactScreen ? "h-11" : "h-12";
  const formGapClassName = isCompactScreen ? "gap-4" : "gap-5";
  const resetPasswordErrors = validateResetPasswordForm({
    confirmPassword,
    newPassword,
  });
  const newPasswordError =
    touchedFields.newPassword || didAttemptSubmit
      ? (resetPasswordErrors.newPassword ?? null)
      : null;
  const confirmPasswordError =
    touchedFields.confirmPassword || didAttemptSubmit
      ? (resetPasswordErrors.confirmPassword ?? null)
      : null;
  const isSubmitDisabled =
    isSubmitting || !token || hasAnyFieldError(resetPasswordErrors);

  useEffect(() => {
    logoFloat.set(
      withRepeat(
        withTiming(-6, {
          duration: 1250,
          easing: Easing.inOut(Easing.quad),
          reduceMotion: ReduceMotion.System,
        }),
        -1,
        true,
        undefined,
        ReduceMotion.System,
      ),
    );

    return () => {
      cancelAnimation(logoFloat);
      logoFloat.set(0);
    };
  }, [logoFloat]);

  const animatedLogoStyle = useAnimatedStyle(() => {
    return {
      transform: [{ translateY: logoFloat.get() }],
    };
  });

  const goBackToLogin = () => {
    router.replace("/login?entry=home");
  };

  const goToForgotPassword = () => {
    router.replace("/forgot-password?entry=home");
  };

  const markFieldTouched = (field: "confirmPassword" | "newPassword") => {
    setTouchedFields((previous) => ({ ...previous, [field]: true }));
  };

  const handleSubmit = async () => {
    setDidAttemptSubmit(true);

    if (!token || hasAnyFieldError(resetPasswordErrors)) {
      return;
    }

    setErrorMessage(null);
    setIsSubmitting(true);

    try {
      await resetPassword({
        confirmPassword,
        newPassword,
        token,
      });

      setDidResetSucceed(true);
    } catch (error) {
      setErrorMessage(
        error instanceof Error
          ? error.message
          : t("auth.resetPassword.errorCannotReset"),
      );
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <SafeAreaView className="flex-1 bg-white" edges={["left", "right", "bottom"]}>
      <KeyboardAvoidingView
        behavior={Platform.OS === "ios" ? "padding" : undefined}
        className="flex-1"
      >
        <ScrollView
          className="flex-1 bg-white"
          contentContainerStyle={{ flexGrow: 1, minHeight: scrollContentMinHeight }}
          keyboardDismissMode="on-drag"
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}
        >
          <View className="flex-1 bg-white">
            <LinearGradient
              colors={gradientColors}
              end={{ x: 1, y: 0.5 }}
              locations={[0, 0.58, 1]}
              start={{ x: 0, y: 0.5 }}
              className="relative w-full items-center justify-center overflow-hidden"
              style={{
                minHeight: heroHeight,
                paddingBottom: heroBottomPadding,
                paddingHorizontal: horizontalPadding,
                paddingTop: heroTopPadding,
              }}
            >
              <Pressable
                onPress={goBackToLogin}
                className="absolute h-12 w-12 items-center justify-center rounded-full bg-white/18"
                style={{ left: horizontalPadding, top: backButtonTop }}
              >
                <SymbolView
                  name={{
                    ios: "chevron.left",
                    android: "arrow_back",
                    web: "arrow_back",
                  }}
                  size={16}
                  tintColor="#FFFFFF"
                />
              </Pressable>

              <Animated.View style={animatedLogoStyle}>
                <Image
                  source={require("../../../../assets/images/logo2.png")}
                  style={{ height: logoSize, width: logoSize }}
                  resizeMode="contain"
                />
              </Animated.View>
            </LinearGradient>

            <View
              className="-mt-8 flex-1 rounded-t-[34px] bg-white"
              style={[cardShadowStyle, { paddingHorizontal: horizontalPadding }]}
            >
              <View
                className="w-full self-center"
                style={{
                  maxWidth: cardMaxWidth,
                  paddingBottom: cardBottomPadding,
                  paddingTop: cardTopPadding,
                }}
              >
                {didResetSucceed ? (
                  <>
                    <View className="items-center">
                      <View className="h-20 w-20 items-center justify-center rounded-full bg-[#FFF4EF]">
                        <View className="h-14 w-14 items-center justify-center rounded-full bg-[#EB489B]">
                          <SymbolView
                            name={{
                              ios: "checkmark",
                              android: "check",
                              web: "check",
                            }}
                            size={24}
                            tintColor="#FFFFFF"
                          />
                        </View>
                      </View>
                    </View>

                    <View
                      className="items-center gap-2"
                      style={{ marginTop: sectionTopMargin }}
                    >
                      <Text
                        className="text-center font-extrabold text-[#EB489B]"
                        style={{ fontSize: titleSize }}
                      >
                        {t("auth.resetPassword.successTitle")}
                      </Text>
                      <Text className="text-center text-[14px] leading-6 text-[#8E869A]">
                        {t("auth.resetPassword.successSubtitle")}
                      </Text>
                    </View>

                    <View className={isCompactScreen ? "pt-5" : "pt-6"}>
                      <Pressable
                        onPress={goBackToLogin}
                        className="rounded-[18px]"
                        style={buttonShadowStyle}
                      >
                        <LinearGradient
                          colors={gradientColors}
                          end={{ x: 1, y: 0.5 }}
                          locations={[0, 0.58, 1]}
                          start={{ x: 0, y: 0.5 }}
                          className={`${buttonHeightClassName} items-center justify-center rounded-[18px]`}
                        >
                          <Text className="text-[16px] font-extrabold text-white">
                            {t("auth.resetPassword.backToLogin")}
                          </Text>
                        </LinearGradient>
                      </Pressable>
                    </View>
                  </>
                ) : (
                  <>
                    <View className="items-center gap-1.5">
                      <Text
                        className="font-extrabold text-[#EB489B]"
                        style={{ fontSize: titleSize }}
                      >
                        {t("auth.resetPassword.title")}
                      </Text>
                      <Text className="text-center text-[14px] leading-6 text-[#8E869A]">
                        {token
                          ? t("auth.resetPassword.subtitle")
                          : t("auth.resetPassword.invalidTokenSubtitle")}
                      </Text>
                    </View>

                    <View style={{ marginTop: sectionTopMargin }}>
                      {token ? (
                        <View className={formGapClassName}>
                          <AuthInput
                            autoCapitalize="none"
                            autoComplete="password-new"
                            className="gap-1.5"
                            editable={!isSubmitting}
                            errorMessage={newPasswordError}
                            inputClassName={fieldHeightClassName}
                            label={t("auth.resetPassword.newPassword")}
                            placeholder={t("auth.resetPassword.newPasswordPlaceholder")}
                            rightAccessory={
                              <Pressable
                                accessibilityLabel={
                                  isNewPasswordVisible
                                    ? t("auth.login.hidePassword")
                                    : t("auth.login.showPassword")
                                }
                                className="h-9 w-9 items-center justify-center"
                                disabled={isSubmitting}
                                hitSlop={8}
                                onPress={() => {
                                  setIsNewPasswordVisible((v) => !v);
                                }}
                              >
                                <SymbolView
                                  name={{
                                    ios: isNewPasswordVisible ? "eye.slash" : "eye",
                                    android: isNewPasswordVisible
                                      ? "visibility_off"
                                      : "visibility",
                                    web: isNewPasswordVisible ? "visibility_off" : "visibility",
                                  }}
                                  size={18}
                                  tintColor="#8E869A"
                                />
                              </Pressable>
                            }
                            secureTextEntry={!isNewPasswordVisible}
                            textContentType="newPassword"
                            value={newPassword}
                            onBlur={() => markFieldTouched("newPassword")}
                            onChangeText={(value) => {
                              setNewPassword(value);
                              if (errorMessage) {
                                setErrorMessage(null);
                              }
                            }}
                          />

                          <AuthInput
                            autoCapitalize="none"
                            autoComplete="password-new"
                            className="gap-1.5"
                            editable={!isSubmitting}
                            errorMessage={confirmPasswordError}
                            inputClassName={fieldHeightClassName}
                            label={t("auth.resetPassword.confirmPassword")}
                            onSubmitEditing={() => {
                              void handleSubmit();
                            }}
                            placeholder={t("auth.resetPassword.confirmPasswordPlaceholder")}
                            returnKeyType="done"
                            rightAccessory={
                              <Pressable
                                accessibilityLabel={
                                  isConfirmPasswordVisible
                                    ? t("auth.login.hidePassword")
                                    : t("auth.login.showPassword")
                                }
                                className="h-9 w-9 items-center justify-center"
                                disabled={isSubmitting}
                                hitSlop={8}
                                onPress={() => {
                                  setIsConfirmPasswordVisible((v) => !v);
                                }}
                              >
                                <SymbolView
                                  name={{
                                    ios: isConfirmPasswordVisible ? "eye.slash" : "eye",
                                    android: isConfirmPasswordVisible
                                      ? "visibility_off"
                                      : "visibility",
                                    web: isConfirmPasswordVisible ? "visibility_off" : "visibility",
                                  }}
                                  size={18}
                                  tintColor="#8E869A"
                                />
                              </Pressable>
                            }
                            secureTextEntry={!isConfirmPasswordVisible}
                            textContentType="password"
                            value={confirmPassword}
                            onBlur={() => markFieldTouched("confirmPassword")}
                            onChangeText={(value) => {
                              setConfirmPassword(value);
                              if (errorMessage) {
                                setErrorMessage(null);
                              }
                            }}
                          />

                          <Pressable
                            disabled={isSubmitDisabled}
                            onPress={() => {
                              void handleSubmit();
                            }}
                            className="rounded-[18px]"
                            style={[
                              isSubmitDisabled ? null : buttonShadowStyle,
                              isSubmitDisabled ? { opacity: 0.72 } : null,
                            ]}
                          >
                            <LinearGradient
                              colors={gradientColors}
                              end={{ x: 1, y: 0.5 }}
                              locations={[0, 0.58, 1]}
                              start={{ x: 0, y: 0.5 }}
                              className={`${buttonHeightClassName} items-center justify-center rounded-[18px]`}
                            >
                              <Text className="text-[16px] font-extrabold text-white">
                                {isSubmitting
                                  ? t("auth.resetPassword.submitting")
                                  : t("auth.resetPassword.submitButton")}
                              </Text>
                            </LinearGradient>
                          </Pressable>

                          {errorMessage ? (
                            <Text className="text-[14px] font-medium leading-6 text-[#D6456C]">
                              {errorMessage}
                            </Text>
                          ) : null}
                        </View>
                      ) : (
                        <Pressable
                          onPress={goToForgotPassword}
                          className={`${secondaryButtonHeightClassName} items-center justify-center rounded-[18px] border border-[#F2E4EB] bg-[#FFF9FC]`}
                        >
                          <Text className="text-[15px] font-bold text-[#F58752]">
                            {t("auth.resetPassword.resendRecoveryEmail")}
                          </Text>
                        </Pressable>
                      )}
                    </View>
                  </>
                )}
              </View>
            </View>
          </View>
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}
