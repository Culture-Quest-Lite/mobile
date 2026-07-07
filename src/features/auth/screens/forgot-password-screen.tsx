import { LinearGradient } from "expo-linear-gradient";
import { useLocalSearchParams, useRouter } from "expo-router";
import { SymbolView } from "@/components/ui/symbol-view";
import { useEffect, useState } from "react";
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
import {
  SafeAreaView,
} from "react-native-safe-area-context";

import { forgotPassword } from "@/features/auth/api/forgot-password";
import { AuthInput } from "@/features/auth/components/auth-input";
import { useAuthScreenLayout } from "@/features/auth/hooks/use-auth-screen-layout";
import { hasAnyFieldError } from "@/features/auth/utils/validation";

const gradientColors = ["#EB489B", "#F58752", "#FFC93C"] as const;
const emailPattern = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

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

function validateForgotPasswordForm(email: string) {
  const errors: { email?: string } = {};
  const normalizedEmail = email.trim().toLowerCase();

  if (!normalizedEmail) {
    errors.email = "Vui lòng nhập email.";
  } else if (!emailPattern.test(normalizedEmail)) {
    errors.email = "Email không đúng định dạng.";
  }

  return errors;
}

export default function ForgotPasswordScreen() {
  const router = useRouter();
  const { email: emailParam, entry } = useLocalSearchParams<{
    email?: string;
    entry?: string;
  }>();
  const {
    backButtonTop,
    cardMaxWidth,
    horizontalPadding,
    insets,
    isCompactScreen,
    scrollContentMinHeight,
  } = useAuthScreenLayout(760);
  const logoFloat = useSharedValue(0);
  const [email, setEmail] = useState(emailParam?.trim() ?? "");
  const [didAttemptSubmit, setDidAttemptSubmit] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [touchedEmail, setTouchedEmail] = useState(false);
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
  const formGapClassName = isCompactScreen ? "gap-4" : "gap-5";
  const forgotPasswordErrors = validateForgotPasswordForm(email);
  const emailError =
    touchedEmail || didAttemptSubmit
      ? (forgotPasswordErrors.email ?? null)
      : null;
  const isSubmitDisabled =
    isSubmitting || hasAnyFieldError(forgotPasswordErrors);

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

  const animatedLogoStyle = useAnimatedStyle(() => {
    return {
      transform: [{ translateY: logoFloat.get() }],
    };
  });

  const goBackToLogin = () => {
    router.replace("/login?entry=home");
  };

  const handleSubmit = async () => {
    setDidAttemptSubmit(true);

    if (hasAnyFieldError(forgotPasswordErrors)) {
      return;
    }

    const normalizedEmail = email.trim().toLowerCase();

    setErrorMessage(null);
    setIsSubmitting(true);

    try {
      const response = await forgotPassword({
        email: normalizedEmail,
      });

      router.replace({
        pathname: "./forgot-password-success",
        params: {
          email: normalizedEmail,
          entry: "home",
          message: response.message ?? undefined,
        },
      });
    } catch (error) {
      setErrorMessage(
        error instanceof Error
          ? error.message
          : "Không thể gửi email khôi phục. Vui lòng thử lại.",
      );
    } finally {
      setIsSubmitting(false);
    }
  };

  if (entry !== "home") {
    return null;
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
                <View className="items-center gap-1.5">
                  <Text
                    className="font-extrabold text-[#EB489B]"
                    style={{ fontSize: titleSize }}
                  >
                    Quên mật khẩu
                  </Text>
                  <Text className="text-center text-[14px] leading-6 text-[#8E869A]">
                    Nhập email bạn đã dùng để đăng ký để tiếp tục khôi phục mật
                    khẩu
                  </Text>
                </View>

                <View style={{ marginTop: sectionTopMargin }}>
                  <View className={formGapClassName}>
                    <AuthInput
                      autoCapitalize="none"
                      autoComplete="email"
                      autoCorrect={false}
                      className="gap-1.5"
                      errorMessage={emailError}
                      inputClassName={fieldHeightClassName}
                      keyboardType="email-address"
                      label="Email"
                      placeholder="Nhập địa chỉ email"
                      textContentType="emailAddress"
                      value={email}
                      onBlur={() => setTouchedEmail(true)}
                      onChangeText={(value) => {
                        setEmail(value);
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
                          {isSubmitting ? "Đang gửi email..." : "Gửi email khôi phục"}
                        </Text>
                      </LinearGradient>
                    </Pressable>

                    {errorMessage ? (
                      <Text className="text-[14px] font-medium leading-6 text-[#D6456C]">
                        {errorMessage}
                      </Text>
                    ) : null}
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
