import { LinearGradient } from "expo-linear-gradient";
import { useLocalSearchParams, useRouter } from "expo-router";
import { SymbolView } from "expo-symbols";
import { useEffect, useState } from "react";
import {
  Image,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  Text,
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

import { forgotPassword } from "@/features/auth/api/forgot-password";
import { AuthInput } from "@/features/auth/components/auth-input";
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
  const insets = useSafeAreaInsets();
  const { height } = useWindowDimensions();
  const logoFloat = useSharedValue(0);
  const [email, setEmail] = useState(emailParam?.trim() ?? "");
  const [didAttemptSubmit, setDidAttemptSubmit] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [touchedEmail, setTouchedEmail] = useState(false);
  const isCompactScreen = height <= 760;
  const heroHeight = isCompactScreen ? 208 : 255;
  const heroTopPadding = insets.top + (isCompactScreen ? 16 : 24);
  const heroBottomPadding = isCompactScreen ? 28 : 56;
  const logoSize = isCompactScreen ? 132 : 176;
  const cardTopPadding = isCompactScreen ? 20 : 28;
  const cardBottomPadding = Math.max(
    insets.bottom + (isCompactScreen ? 16 : 20),
    isCompactScreen ? 20 : 28,
  );
  const titleSize = isCompactScreen ? 27 : 31;
  const sectionTopMargin = isCompactScreen ? 20 : 28;
  const fieldHeightClassName = isCompactScreen
    ? "h-11 rounded-xl"
    : "h-12 rounded-xl";
  const buttonHeightClassName = isCompactScreen ? "h-12" : "h-[52px]";
  const formGapClassName = isCompactScreen ? "gap-3" : "gap-4";
  const backButtonTop = insets.top + (isCompactScreen ? 10 : 12);
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
              onPress={goBackToLogin}
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

            <Animated.View style={animatedLogoStyle}>
              <Image
                source={require("../../../../assets/images/logo2.png")}
                style={{ height: logoSize, width: logoSize }}
                resizeMode="contain"
              />
            </Animated.View>
          </LinearGradient>

          <View
            className="-mt-8 flex-1 rounded-t-[34px] bg-white px-6"
            style={cardShadowStyle}
          >
            <View
              className="w-full max-w-[390px] self-center"
              style={{
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
                <Text className="text-center text-[12px] leading-5 text-[#8E869A]">
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
                      <Text className="text-[15px] font-extrabold text-white">
                        {isSubmitting ? "Đang gửi email..." : "Gửi email khôi phục"}
                      </Text>
                    </LinearGradient>
                  </Pressable>

                  {errorMessage ? (
                    <Text className="text-[12px] font-medium leading-5 text-[#D6456C]">
                      {errorMessage}
                    </Text>
                  ) : null}
                </View>
              </View>
            </View>
          </View>
        </View>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}
