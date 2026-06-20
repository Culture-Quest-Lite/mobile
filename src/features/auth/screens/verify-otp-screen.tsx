import { LinearGradient } from "expo-linear-gradient";
import { useLocalSearchParams, useRouter } from "expo-router";
import { SymbolView } from "expo-symbols";
import { useEffect, useRef, useState } from "react";
import {
  Image,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  View,
  useWindowDimensions,
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
  useSafeAreaInsets,
} from "react-native-safe-area-context";

import { verifyOtp } from "@/features/auth/api/verify-otp";

const gradientColors = ["#EB489B", "#F58752", "#FFC93C"] as const;
const successGradientColors = ["#22C55E", "#16A34A", "#4ADE80"] as const;

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

  return `${minutes}:${seconds.toString().padStart(2, "0")}`;
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
  const router = useRouter();
  const { displayName, email, entry, username } = useLocalSearchParams<{
    displayName?: string;
    email?: string;
    entry?: string;
    username?: string;
  }>();
  const insets = useSafeAreaInsets();
  const { height } = useWindowDimensions();
  const inputRef = useRef<TextInput>(null);
  const redirectTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const logoFloat = useSharedValue(0);
  const [otpCode, setOtpCode] = useState("");
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [isOtpFocused, setIsOtpFocused] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [resendCountdown, setResendCountdown] = useState(90);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);

  const emailValue = email?.trim() ?? "";
  const normalizedEmail = emailValue || "Email của bạn";
  const isCompactScreen = height <= 820;
  const heroHeight = isCompactScreen ? 236 : 296;
  const heroTopPadding = insets.top + (isCompactScreen ? 16 : 24);
  const heroBottomPadding = isCompactScreen ? 36 : 66;
  const logoSize = isCompactScreen ? 154 : 206;
  const cardTopPadding = isCompactScreen ? 22 : 30;
  const cardBottomPadding = Math.max(
    insets.bottom + (isCompactScreen ? 8 : 10),
    isCompactScreen ? 10 : 12,
  );
  const sectionTopMargin = isCompactScreen ? 20 : 28;
  const titleSize = isCompactScreen ? 29 : 33;
  const backButtonTop = insets.top + (isCompactScreen ? 10 : 12);
  const otpBoxSize = isCompactScreen ? 46 : 52;
  const otpBoxRadius = isCompactScreen ? 18 : 20;
  const otpBoxGap = isCompactScreen ? 10 : 12;
  const otpRowWidth = otpBoxSize * 6 + otpBoxGap * 5;
  const buttonHeightClassName = isCompactScreen ? "h-12" : "h-[54px]";
  const helperTopMargin = isCompactScreen ? 10 : 12;
  const otpBlockTopPadding = isCompactScreen ? 16 : 22;
  const actionGroupTopMargin = isCompactScreen ? 20 : 24;
  const contentBottomLift = isCompactScreen ? 8 : 10;
  const isCodeComplete = otpCode.length === 6;
  const canResendCode = resendCountdown === 0;

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
    };
  }, []);

  const animatedLogoStyle = useAnimatedStyle(() => {
    return {
      transform: [{ translateY: logoFloat.get() }],
    };
  });

  const handleResendCode = () => {
    if (!canResendCode || isSubmitting || successMessage) {
      return;
    }

    console.info("[auth] resend otp requested", {
      email: normalizedEmail,
      username,
    });
    setResendCountdown(90);
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

    if (errorMessage) {
      setErrorMessage(null);
    }
  };

  const handleVerifyOtp = async () => {
    const normalizedOtpCode = otpCode.trim();

    if (!emailValue) {
      setErrorMessage("Thiếu email để xác thực OTP.");
      return;
    }

    if (normalizedOtpCode.length !== 6) {
      setErrorMessage("Vui lòng nhập đầy đủ 6 số OTP.");
      return;
    }

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
      setErrorMessage(
        error instanceof Error
          ? error.message
          : "Không thể xác thực OTP. Vui lòng thử lại.",
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
            <Text className="absolute left-12 top-24 text-[22px] font-black text-[#EB489B]/65">
              ×
            </Text>
            <Text className="absolute right-14 top-28 text-[18px] font-black text-[#F58752]/70">
              +
            </Text>
            <View className="absolute left-8 top-40 h-2.5 w-2.5 rounded-full bg-[#FFC93C]/45" />
            <View className="absolute right-10 top-48 h-3 w-3 rounded-full bg-[#EB489B]/20" />
            <Text className="absolute left-14 top-64 text-[18px] font-black text-[#F58752]/55">
              ○
            </Text>
            <Text className="absolute right-16 top-72 text-[20px] font-black text-[#EB489B]/60">
              ×
            </Text>
            <View className="absolute bottom-36 left-10 h-3 w-3 rounded-full border border-[#EB489B]/35" />
            <View className="absolute bottom-44 right-8 h-4 w-4 rounded-full bg-[#F58752]/18" />
            <Text className="absolute bottom-28 left-20 text-[18px] font-black text-[#FFC93C]/55">
              +
            </Text>
            <Text className="absolute bottom-24 right-14 text-[20px] font-black text-[#F58752]/60">
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
                      size={52}
                      tintColor="#FFFFFF"
                    />
                  </LinearGradient>
                </View>
              </View>

              <Text className="mt-10 text-center text-[34px] font-black leading-[42px] text-[#322A3D]">
                Đăng ký thành công!
              </Text>
              <Text className="mt-4 text-center text-[16px] leading-7 text-[#8E869A]">
                {successMessage}
              </Text>
              <Text className="mt-5 text-center text-[15px] font-bold text-[#F58752]">
                Đang chuyển đến trang đăng nhập...
              </Text>

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
        <View className="flex-1 bg-white">
          <LinearGradient
            colors={gradientColors}
            end={{ x: 1, y: 0.5 }}
            locations={[0, 0.58, 1]}
            start={{ x: 0, y: 0.5 }}
            className="relative w-full items-center justify-center overflow-hidden px-6"
            style={{
              minHeight: heroHeight,
              paddingBottom: heroBottomPadding,
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
              className="absolute left-6 h-11 w-11 items-center justify-center rounded-full bg-white/18"
              style={{ top: backButtonTop }}
            >
              <SymbolView
                name={{
                  ios: "chevron.left",
                  android: "arrow_back",
                  web: "arrow_back",
                }}
                size={18}
                tintColor="#FFFFFF"
              />
            </Pressable>

            <View className="items-center gap-3">
              <View className="rounded-full bg-white/18 px-4 py-1.5">
                <Text className="text-[11px] font-extrabold uppercase tracking-[1.8px] text-white">
                  Bước 2 / 2
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
            className="-mt-8 flex-1 rounded-t-[34px] bg-white px-6"
            style={cardShadowStyle}
          >
            <View
              className="w-full max-w-[390px] flex-1 self-center"
              style={{
                paddingBottom: cardBottomPadding,
                paddingTop: cardTopPadding,
              }}
            >
              <View className="items-center gap-2">
                <Text
                  className="font-extrabold text-[#EB489B]"
                  style={{ fontSize: titleSize }}
                >
                  Xác thực OTP
                </Text>
                <Text className="text-center text-[15px] leading-6 text-[#8E869A]">
                  Nhập mã gồm 6 số được gửi tới
                </Text>
                <Text className="text-center text-[17px] font-bold text-[#322A3D]">
                  {normalizedEmail}
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
                      contextMenuHidden
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

                        return (
                          <View
                            key={index}
                            className="items-center justify-center border bg-[#FAF7FC]"
                            style={{
                              borderColor: isActiveSlot
                                ? "#EB489B"
                                : isFilled
                                  ? "#F7B0C9"
                                  : "#ECE4F1",
                              borderRadius: otpBoxRadius,
                              height: otpBoxSize,
                              width: otpBoxSize,
                            }}
                          >
                            <Text className="text-[20px] font-extrabold text-[#322A3D]">
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
                    disabled={!isCodeComplete || isSubmitting}
                    onPress={() => {
                      void handleVerifyOtp();
                    }}
                    className="rounded-[18px]"
                    style={[
                      buttonShadowStyle,
                      isSubmitting ? { opacity: 0.82 } : null,
                    ]}
                  >
                    <LinearGradient
                      colors={
                        isCodeComplete && !isSubmitting
                          ? gradientColors
                          : (["#F5D6E4", "#EECFB5", "#F3E0A4"] as const)
                      }
                      end={{ x: 1, y: 0.5 }}
                      locations={[0, 0.58, 1]}
                      start={{ x: 0, y: 0.5 }}
                      className={`${buttonHeightClassName} items-center justify-center rounded-[18px]`}
                    >
                      <Text className="text-[15px] font-extrabold text-white">
                        {isSubmitting ? "Đang xác thực..." : "Xác nhận OTP"}
                      </Text>
                    </LinearGradient>
                  </Pressable>

                  {errorMessage ? (
                    <Text className="mt-3 text-center text-[14px] font-semibold leading-6 text-[#D6456C]">
                      {errorMessage}
                    </Text>
                  ) : null}

                  <View
                    className="items-center gap-2"
                    style={{ marginTop: helperTopMargin }}
                  >
                    <View className="flex-row items-center justify-center gap-1.5">
                      <Text className="text-[15px] text-[#8E869A]">
                        Chưa nhận được?
                      </Text>
                      <Pressable
                        disabled={!canResendCode}
                        onPress={handleResendCode}
                      >
                        <Text
                          className={`text-[15px] font-extrabold ${
                            canResendCode ? "text-[#EB489B]" : "text-[#C6B6C6]"
                          }`}
                        >
                          {canResendCode
                            ? "Gửi lại mã"
                            : `Gửi lại mã sau ${formatCountdown(resendCountdown)}`}
                        </Text>
                      </Pressable>
                    </View>

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
                      <Text className="text-[15px] font-extrabold text-[#F58752]">
                        Quay lại đăng ký
                      </Text>
                    </Pressable>
                  </View>
                </View>
              </View>
            </View>
          </View>
        </View>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}
