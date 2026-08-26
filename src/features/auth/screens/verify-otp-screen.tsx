import { LinearGradient } from "expo-linear-gradient";
import { useLocalSearchParams, useRouter } from "expo-router";
import { SymbolView } from "@/components/ui/symbol-view";
import { useEffect, useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import type { TFunction } from "i18next";
import {
  ActivityIndicator,
  Image,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
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
import {
  SafeAreaView,
} from "react-native-safe-area-context";

import { resendOtp } from "@/features/auth/api/resend-otp";
import { verifyOtp } from "@/features/auth/api/verify-otp";
import { useAuthScreenLayout } from "@/features/auth/hooks/use-auth-screen-layout";
import {
  hasAnyFieldError,
  validateVerifyOtpForm,
} from "@/features/auth/utils/validation";

const gradientColors = ["#EB489B", "#F58752", "#FFC93C"] as const;
const successGradientColors = ["#22C55E", "#16A34A", "#4ADE80"] as const;
const disabledButtonColors = ["#E8E2EA", "#E8E2EA", "#E8E2EA"] as const;
const resendCountdownSeconds = 60;

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

function formatCountdown(totalSeconds: number) {
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = totalSeconds % 60;

  return `${minutes.toString().padStart(2, "0")}:${seconds.toString().padStart(2, "0")}`;
}

function maskEmailAddress(email: string, t: TFunction) {
  const normalizedEmail = email.trim().toLowerCase();

  if (!normalizedEmail) {
    return t("auth.verifyOtp.emailFallback");
  }

  const [localPart, domain] = normalizedEmail.split("@");

  if (!localPart || !domain) {
    return normalizedEmail;
  }

  const visiblePrefixLength = localPart.length <= 2 ? 1 : Math.min(4, localPart.length - 1);
  const visiblePrefix = localPart.slice(0, visiblePrefixLength);

  return `${visiblePrefix}****@${domain}`;
}

const hiddenOtpInputStyle = StyleSheet.create({
  inputOverlay: {
    color: "transparent",
    height: "100%",
    left: 0,
    opacity: 0.02,
    position: "absolute",
    right: 0,
    top: 0,
    width: "100%",
  },
});

export default function VerifyOtpScreen() {
  const { t } = useTranslation();
  const router = useRouter();
  const { displayName, email, entry, username } = useLocalSearchParams<{
    displayName?: string;
    email?: string;
    entry?: string;
    username?: string;
  }>();
  const {
    cardMaxWidth,
    horizontalPadding,
    insets,
    isCompactScreen,
    scrollContentMinHeight,
  } = useAuthScreenLayout(820);
  const inputRef = useRef<TextInput>(null);
  const redirectTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const toastTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const logoFloat = useSharedValue(0);
  const [otpCode, setOtpCode] = useState("");
  const [didAttemptVerify, setDidAttemptVerify] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [isOtpFocused, setIsOtpFocused] = useState(false);
  const [isOtpInvalid, setIsOtpInvalid] = useState(false);
  const [isResending, setIsResending] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [resendCountdown, setResendCountdown] = useState(resendCountdownSeconds);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);
  const [toastMessage, setToastMessage] = useState<string | null>(null);

  const emailValue = email?.trim() ?? "";
  const maskedEmail = maskEmailAddress(emailValue, t);
  const heroHeight = isCompactScreen ? 232 : 284;
  const heroTopPadding = insets.top + (isCompactScreen ? 18 : 28);
  const heroBottomPadding = isCompactScreen ? 34 : 56;
  const logoSize = isCompactScreen ? 142 : 186;
  const cardTopPadding = isCompactScreen ? 22 : 28;
  const cardBottomPadding = Math.max(
    insets.bottom + (isCompactScreen ? 12 : 14),
    isCompactScreen ? 14 : 18,
  );
  const sectionTopMargin = isCompactScreen ? 18 : 24;
  const titleSize = isCompactScreen ? 25 : 29;
  const backButtonTop = insets.top + (isCompactScreen ? 12 : 14);
  const otpBoxSize = isCompactScreen ? 46 : 54;
  const otpBoxRadius = isCompactScreen ? 18 : 20;
  const otpBoxGap = isCompactScreen ? 10 : 12;
  const otpRowWidth = otpBoxSize * 6 + otpBoxGap * 5;
  const buttonHeightClassName = isCompactScreen ? "h-12" : "h-14";
  const helperTopMargin = isCompactScreen ? 12 : 14;
  const otpBlockTopPadding = isCompactScreen ? 18 : 24;
  const actionGroupTopMargin = isCompactScreen ? 22 : 28;
  const contentBottomLift = isCompactScreen ? 12 : 14;
  const verifyErrors = validateVerifyOtpForm({
    email: emailValue,
    otpCode,
  });
  const isCodeComplete = otpCode.length === 6;
  const canResendCode = resendCountdown === 0;
  const clientValidationMessage =
    didAttemptVerify
      ? verifyErrors.otpCode ?? verifyErrors.email ?? null
      : null;
  const isConfirmDisabled = isSubmitting || hasAnyFieldError(verifyErrors);

  useEffect(() => {
    if (entry !== "home") {
      router.replace("/home");
    }
  }, [entry, router]);

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

  useEffect(() => {
    if (resendCountdown === 0) {
      return;
    }

    const timer = setInterval(() => {
      setResendCountdown((currentValue) => {
        if (currentValue <= 1) {
          return 0;
        }

        return currentValue - 1;
      });
    }, 1000);

    return () => {
      clearInterval(timer);
    };
  }, [resendCountdown]);

  useEffect(() => {
    return () => {
      if (redirectTimeoutRef.current) {
        clearTimeout(redirectTimeoutRef.current);
      }

      if (toastTimeoutRef.current) {
        clearTimeout(toastTimeoutRef.current);
      }
    };
  }, []);

  const animatedLogoStyle = useAnimatedStyle(() => {
    return {
      transform: [{ translateY: logoFloat.get() }],
    };
  });

  const showToast = (message: string) => {
    setToastMessage(message);

    if (toastTimeoutRef.current) {
      clearTimeout(toastTimeoutRef.current);
    }

    toastTimeoutRef.current = setTimeout(() => {
      setToastMessage(null);
      toastTimeoutRef.current = null;
    }, 2600);
  };

  const handleResendCode = async () => {
    if (!canResendCode || isResending || isSubmitting || successMessage) {
      return;
    }

    if (verifyErrors.email) {
      setErrorMessage(verifyErrors.email);
      return;
    }

    console.info("[auth] resend otp requested", {
      email: emailValue,
      username,
    });
    setErrorMessage(null);
    setIsResending(true);

    try {
      const response = await resendOtp({
        email: emailValue,
      });

      setResendCountdown(resendCountdownSeconds);
      showToast(response.message ?? t("auth.verifyOtp.resendSuccessMessage"));
    } catch (error) {
      setErrorMessage(
        error instanceof Error
          ? error.message
          : t("auth.verifyOtp.errorCannotResend"),
      );
    } finally {
      setIsResending(false);
    }
  };

  const handleFocusOtpInput = () => {
    if (successMessage) {
      return;
    }

    requestAnimationFrame(() => {
      inputRef.current?.focus();
    });
  };

  const handleOtpCodeChange = (value: string) => {
    setOtpCode(value.replace(/\D/g, "").slice(0, 6));
    setIsOtpInvalid(false);

    if (errorMessage) {
      setErrorMessage(null);
    }
  };

  const handleVerifyOtp = async () => {
    setDidAttemptVerify(true);

    if (hasAnyFieldError(verifyErrors)) {
      setIsOtpInvalid(Boolean(verifyErrors.otpCode));
      setErrorMessage(
        verifyErrors.otpCode ?? verifyErrors.email ?? t("auth.verifyOtp.errorCheckCode"),
      );
      return;
    }

    const normalizedOtpCode = otpCode.trim();

    setIsOtpInvalid(false);
    setErrorMessage(null);
    setIsSubmitting(true);

    try {
      const response = await verifyOtp({
        email: emailValue,
        otpCode: normalizedOtpCode,
      });

      setSuccessMessage(response.message);
      inputRef.current?.blur();
      redirectTimeoutRef.current = setTimeout(() => {
        router.replace("/login?entry=home");
      }, 2000);
    } catch (error) {
      setIsOtpInvalid(true);
      setErrorMessage(
        error instanceof Error
          ? error.message
          : t("auth.verifyOtp.errorCannotVerify"),
      );
    } finally {
      setIsSubmitting(false);
    }
  };

  if (entry !== "home") {
    return null;
  }

  if (successMessage) {
    return (
      <SafeAreaView className="flex-1 bg-white" edges={["top", "left", "right", "bottom"]}>
        <View className="flex-1 bg-white">
          <View className="absolute inset-0">
            <View className="absolute left-6 top-10 h-3 w-3 rounded-full bg-[#EB489B]/18" />
            <View className="absolute right-8 top-14 h-4 w-4 rounded-full border border-[#F58752]/35" />
            <Text className="absolute left-12 top-24 text-[19px] font-black text-[#EB489B]/65">
              ×
            </Text>
            <Text className="absolute right-14 top-28 text-[19px] font-black text-[#F58752]/70">
              +
            </Text>
            <View className="absolute left-8 top-40 h-2.5 w-2.5 rounded-full bg-[#FFC93C]/45" />
            <View className="absolute right-10 top-48 h-3 w-3 rounded-full bg-[#EB489B]/20" />
            <Text className="absolute left-14 top-64 text-[19px] font-black text-[#F58752]/55">
              ○
            </Text>
            <Text className="absolute right-16 top-72 text-[17px] font-black text-[#EB489B]/60">
              ×
            </Text>
            <View className="absolute bottom-36 left-10 h-3 w-3 rounded-full border border-[#EB489B]/35" />
            <View className="absolute bottom-44 right-8 h-4 w-4 rounded-full bg-[#F58752]/18" />
            <Text className="absolute bottom-28 left-20 text-[17px] font-black text-[#FFC93C]/55">
              +
            </Text>
            <Text className="absolute bottom-24 right-14 text-[17px] font-black text-[#F58752]/60">
              ○
            </Text>
          </View>

          <View className="flex-1 items-center justify-center px-8">
            <View className="items-center">
              <View className="h-[186px] w-[186px] items-center justify-center rounded-full bg-[#EAFBF1]">
                <View className="h-[148px] w-[148px] items-center justify-center rounded-full bg-[#F5FFF8]">
                  <LinearGradient
                    colors={successGradientColors}
                    start={{ x: 0, y: 0 }}
                    end={{ x: 1, y: 1 }}
                    className="h-[116px] w-[116px] items-center justify-center rounded-full"
                    style={{
                      shadowColor: "rgba(34, 197, 94, 0.28)",
                      shadowOpacity: 1,
                      shadowRadius: 18,
                      shadowOffset: { width: 0, height: 10 },
                      elevation: 9,
                    }}
                  >
                    <SymbolView
                      name={{ ios: "checkmark", android: "check", web: "check" }}
                      size={38}
                      tintColor="#FFFFFF"
                    />
                  </LinearGradient>
                </View>
              </View>

              <Text className="mt-8 text-center text-[24px] font-black leading-[30px] text-[#322A3D]">
                {t("auth.verifyOtp.registerSuccessTitle")}
              </Text>
              <Text className="mt-4 text-center text-[15px] leading-6 text-[#8E869A]">
                {successMessage}
              </Text>
              <View className="mt-5 items-center">
                <ActivityIndicator color="#F58752" size="small" />
              </View>

              <View className="mt-7 h-1.5 w-44 overflow-hidden rounded-full bg-[#F7E5EF]">
                <LinearGradient
                  colors={gradientColors}
                  start={{ x: 0, y: 0.5 }}
                  end={{ x: 1, y: 0.5 }}
                  className="h-full w-full rounded-full"
                />
              </View>
            </View>
          </View>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView
      className="flex-1 bg-white"
      edges={["left", "right", "bottom"]}
    >
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
            {toastMessage ? (
              <View
                pointerEvents="none"
                className="absolute z-20 rounded-2xl bg-[#102A1B] px-4 py-3"
                style={{
                  left: horizontalPadding,
                  right: horizontalPadding,
                  shadowColor: "rgba(16, 42, 27, 0.22)",
                  shadowOpacity: 1,
                  shadowRadius: 16,
                  shadowOffset: { width: 0, height: 10 },
                  elevation: 10,
                  top: insets.top + 12,
                }}
              >
                <View className="flex-row items-center gap-3">
                  <View className="h-8 w-8 items-center justify-center rounded-full bg-[#1D7A46]">
                    <SymbolView
                      name={{ ios: "checkmark", android: "check", web: "check" }}
                      size={16}
                      tintColor="#FFFFFF"
                    />
                  </View>
                  <Text className="flex-1 text-[13px] font-semibold leading-5 text-white">
                    {toastMessage}
                  </Text>
                </View>
              </View>
            ) : null}

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
                onPress={() =>
                  router.replace({
                    pathname: "/register",
                    params: {
                      displayName,
                      email: emailValue,
                      entry: "home",
                      username,
                    },
                  })
                }
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

              <View className="items-center gap-3">
                <View className="rounded-full bg-white/18 px-4 py-1.5">
                  <Text className="text-[12px] font-extrabold uppercase tracking-[1.8px] text-white">
                    {t("auth.verifyOtp.step")}
                  </Text>
                </View>

                <Animated.View style={animatedLogoStyle}>
                  <Image
                    source={require("../../../../assets/images/logo2.png")}
                    style={{ height: logoSize, width: logoSize }}
                    resizeMode="contain"
                  />
                </Animated.View>
              </View>
            </LinearGradient>

            <View
              className="-mt-8 flex-1 rounded-t-[34px] bg-white"
              style={[cardShadowStyle, { paddingHorizontal: horizontalPadding }]}
            >
              <View
                className="w-full flex-1 self-center"
                style={{
                  maxWidth: cardMaxWidth,
                  paddingBottom: cardBottomPadding,
                  paddingTop: cardTopPadding,
                }}
              >
                <View className="items-center gap-1.5">
                  <Text
                    className="font-extrabold text-[#EB489B]"
                    style={{ fontSize: titleSize }}
                  >
                    {t("auth.verifyOtp.title")}
                  </Text>
                  <Text className="text-center text-[14px] leading-6 text-[#8E869A]">
                    {t("auth.verifyOtp.codeSentTo")}
                  </Text>
                  <Text className="text-center text-[15px] font-bold text-[#322A3D]">
                    {maskedEmail}
                  </Text>
                </View>

                <View
                  className="flex-1 justify-center"
                  style={{
                    marginTop: sectionTopMargin,
                    paddingBottom: contentBottomLift,
                  }}
                >
                  <View style={{ paddingTop: otpBlockTopPadding }}>
                    <View
                      className="relative self-center"
                      style={{ height: otpBoxSize, width: otpRowWidth }}
                    >
                      <TextInput
                        ref={inputRef}
                        autoComplete="one-time-code"
                        blurOnSubmit={false}
                        caretHidden
                        editable={!isSubmitting}
                        inputMode="numeric"
                        keyboardType="number-pad"
                        maxLength={6}
                        onPressIn={handleFocusOtpInput}
                        selectionColor="#EB489B"
                        showSoftInputOnFocus
                        style={hiddenOtpInputStyle.inputOverlay}
                        textContentType="oneTimeCode"
                        value={otpCode}
                        onBlur={() => setIsOtpFocused(false)}
                        onChangeText={handleOtpCodeChange}
                        onFocus={() => setIsOtpFocused(true)}
                      />

                      <View
                        pointerEvents="none"
                        className="flex-row items-center justify-center"
                        style={{ columnGap: otpBoxGap }}
                      >
                        {Array.from({ length: 6 }).map((_, index) => {
                          const digit = otpCode[index];
                          const isActiveSlot =
                            (isOtpFocused && index === otpCode.length) ||
                            (isCodeComplete && index === otpCode.length - 1);
                          const isFilled = Boolean(digit);
                          const slotShadowStyle = isActiveSlot
                            ? {
                                shadowColor: "rgba(235, 72, 155, 0.24)",
                                shadowOpacity: 1,
                                shadowRadius: 14,
                                shadowOffset: { width: 0, height: 8 },
                                elevation: 5,
                              }
                            : null;

                          return (
                            <View
                              key={index}
                              className="items-center justify-center border bg-[#FAF7FC]"
                              style={{
                                backgroundColor: isActiveSlot ? "#FFFFFF" : "#FAF7FC",
                                borderColor: isOtpInvalid
                                  ? "#D6456C"
                                  : isActiveSlot
                                    ? "#EB489B"
                                    : isFilled
                                      ? "#F7B0C9"
                                      : "#ECE4F1",
                                borderRadius: otpBoxRadius,
                                height: otpBoxSize,
                                width: otpBoxSize,
                                ...(slotShadowStyle ?? {}),
                              }}
                            >
                              <Text className="text-[21px] font-extrabold text-[#322A3D]">
                                {digit || ""}
                              </Text>
                            </View>
                          );
                        })}
                      </View>
                    </View>
                  </View>

                  <View className="pb-1" style={{ marginTop: actionGroupTopMargin }}>
                    <Pressable
                      disabled={isConfirmDisabled}
                      onPress={() => {
                        void handleVerifyOtp();
                      }}
                      className="rounded-[18px]"
                      style={[
                        isConfirmDisabled ? null : buttonShadowStyle,
                        isSubmitting ? { opacity: 0.9 } : null,
                      ]}
                    >
                      <LinearGradient
                        colors={
                          isConfirmDisabled
                            ? disabledButtonColors
                            : gradientColors
                        }
                        end={{ x: 1, y: 0.5 }}
                        locations={[0, 0.58, 1]}
                        start={{ x: 0, y: 0.5 }}
                        className={`${buttonHeightClassName} flex-row items-center justify-center gap-2 rounded-[18px]`}
                      >
                        {isSubmitting ? (
                          <ActivityIndicator color="#FFFFFF" size="small" />
                        ) : null}
                        <Text
                          className={`text-[16px] font-extrabold ${
                            isConfirmDisabled ? "text-[#9F95A7]" : "text-white"
                          }`}
                        >
                          {isSubmitting
                            ? t("auth.verifyOtp.verifying")
                            : t("auth.verifyOtp.confirmButton")}
                        </Text>
                      </LinearGradient>
                    </Pressable>

                    {errorMessage || clientValidationMessage ? (
                      <Text className="mt-3 text-center text-[14px] font-medium leading-6 text-[#D6456C]">
                        {errorMessage ?? clientValidationMessage}
                      </Text>
                    ) : null}

                    <View
                      className="items-center gap-2"
                      style={{ marginTop: helperTopMargin }}
                    >
                      {canResendCode ? (
                        <View className="flex-row items-center justify-center gap-1.5">
                          <Text className="text-[14px] text-[#8E869A]">
                            {t("auth.verifyOtp.noCodeReceived")}
                          </Text>
                          <Pressable
                            disabled={isResending || isSubmitting}
                            onPress={() => {
                              void handleResendCode();
                            }}
                          >
                            <Text
                              className={`text-[14px] font-extrabold ${
                                isResending || isSubmitting
                                  ? "text-[#C6B6C6]"
                                  : "text-[#EB489B]"
                              }`}
                            >
                              {isResending
                                ? t("auth.verifyOtp.resending")
                                : t("auth.verifyOtp.resendCode")}
                            </Text>
                          </Pressable>
                        </View>
                      ) : (
                        <Text className="text-[14px] font-medium text-[#8E869A]">
                          {t("auth.verifyOtp.resendAfter", {
                            time: formatCountdown(resendCountdown),
                          })}
                        </Text>
                      )}

                      <Pressable
                        onPress={() =>
                          router.replace({
                            pathname: "/register",
                            params: {
                              displayName,
                              email: emailValue,
                              entry: "home",
                              username,
                            },
                          })
                        }
                      >
                        <Text className="text-[14px] font-extrabold text-[#F58752]">
                          {t("auth.verifyOtp.backToRegister")}
                        </Text>
                      </Pressable>
                    </View>
                  </View>
                </View>
              </View>
            </View>
          </View>
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}
