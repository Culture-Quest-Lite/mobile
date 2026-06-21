import { LinearGradient } from "expo-linear-gradient";
import { useLocalSearchParams, useRouter } from "expo-router";
import { SymbolView } from "expo-symbols";
import { useEffect, useState } from "react";
import {
  Image,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  Text,
  View,
  useWindowDimensions,
} from "react-native";
import {
  SafeAreaView,
  useSafeAreaInsets,
} from "react-native-safe-area-context";
import Animated, {
  Easing,
  ReduceMotion,
  cancelAnimation,
  useAnimatedStyle,
  useSharedValue,
  withRepeat,
  withTiming,
} from "react-native-reanimated";

import { registerWithPassword } from "@/features/auth/api/register";
import { AuthInput } from "@/features/auth/components/auth-input";
import { SocialAuthButton } from "@/features/auth/components/social-auth-button";
import {
  hasAnyFieldError,
  validateRegisterForm,
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

export default function RegisterScreen() {
  const router = useRouter();
  const params = useLocalSearchParams<{
    displayName?: string;
    email?: string;
    entry?: string;
    username?: string;
  }>();
  const { entry } = params;
  const insets = useSafeAreaInsets();
  const { height } = useWindowDimensions();
  const logoFloat = useSharedValue(0);
  const [username, setUsername] = useState(params.username?.trim() ?? "");
  const [displayName, setDisplayName] = useState(
    params.displayName?.trim() ?? "",
  );
  const [email, setEmail] = useState(params.email?.trim() ?? "");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [didAttemptSubmit, setDidAttemptSubmit] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [touchedFields, setTouchedFields] = useState({
    confirmPassword: false,
    displayName: false,
    email: false,
    password: false,
    username: false,
  });
  const isCompactScreen = height <= 820;
  const heroHeight = isCompactScreen ? 190 : 235;
  const heroTopPadding = insets.top + (isCompactScreen ? 14 : 20);
  const heroBottomPadding = isCompactScreen ? 24 : 48;
  const logoSize = isCompactScreen ? 124 : 160;
  const cardTopPadding = isCompactScreen ? 18 : 28;
  const cardBottomPadding = Math.max(
    insets.bottom + (isCompactScreen ? 14 : 18),
    isCompactScreen ? 18 : 24,
  );
  const titleSize = isCompactScreen ? 27 : 31;
  const sectionTopMargin = isCompactScreen ? 16 : 24;
  const fieldHeightClassName = isCompactScreen
    ? "h-10 rounded-xl"
    : "h-11 rounded-xl";
  const buttonHeightClassName = isCompactScreen ? "h-12" : "h-[52px]";
  const formGapClassName = isCompactScreen ? "gap-3" : "gap-3.5";
  const footerGapClassName = isCompactScreen ? "gap-3 pt-4" : "gap-4 pt-5";
  const buttonTopPaddingClassName = isCompactScreen ? "pt-0" : "pt-1";
  const backButtonTop = insets.top + (isCompactScreen ? 10 : 12);
  const registerErrors = validateRegisterForm({
    confirmPassword,
    displayName,
    email,
    password,
    username,
  });
  const usernameError =
    touchedFields.username || didAttemptSubmit ? registerErrors.username ?? null : null;
  const displayNameError =
    touchedFields.displayName || didAttemptSubmit
      ? registerErrors.displayName ?? null
      : null;
  const emailError =
    touchedFields.email || didAttemptSubmit ? registerErrors.email ?? null : null;
  const passwordError =
    touchedFields.password || didAttemptSubmit ? registerErrors.password ?? null : null;
  const confirmPasswordError =
    touchedFields.confirmPassword || didAttemptSubmit
      ? registerErrors.confirmPassword ?? null
      : null;
  const isSubmitDisabled = isSubmitting || hasAnyFieldError(registerErrors);

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

  const handleClearError = () => {
    if (errorMessage) {
      setErrorMessage(null);
    }
  };

  const handleRegister = async () => {
    setDidAttemptSubmit(true);

    if (hasAnyFieldError(registerErrors)) {
      console.warn("[auth] register blocked by client validation", {
        errors: registerErrors,
      });
      return;
    }

    const normalizedUsername = username.trim();
    const normalizedDisplayName = displayName.trim();
    const normalizedEmail = email.trim().toLowerCase();

    setErrorMessage(null);
    setIsSubmitting(true);

    try {
      const registeredUser = await registerWithPassword({
        displayName: normalizedDisplayName,
        email: normalizedEmail,
        password,
        username: normalizedUsername,
      });

      router.push({
        pathname: "./verify-otp",
        params: {
          displayName: registeredUser.displayName,
          email: registeredUser.email,
          entry: "home",
          name: (registeredUser.displayName || registeredUser.username).trim(),
          username: registeredUser.username,
        },
      });
    } catch (error) {
      setErrorMessage(
        error instanceof Error
          ? error.message
          : "Không thể đăng ký. Vui lòng thử lại.",
      );
    } finally {
      setIsSubmitting(false);
    }
  };

  const markFieldTouched = (
    field: "confirmPassword" | "displayName" | "email" | "password" | "username",
  ) => {
    setTouchedFields((currentValue) => {
      if (currentValue[field]) {
        return currentValue;
      }

      return {
        ...currentValue,
        [field]: true,
      };
    });
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
          contentContainerStyle={{ minHeight: height + insets.top }}
          keyboardDismissMode="on-drag"
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}
        >
          <View className="bg-white">
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
                onPress={() => router.replace("/home")}
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
              className="-mt-8 rounded-t-[34px] bg-white px-6"
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
                    Đăng ký
                  </Text>
                  <Text className="text-[12px] text-[#8E869A]">
                    Tạo tài khoản để bắt đầu hành trình
                  </Text>
                </View>

                <View style={{ marginTop: sectionTopMargin }}>
                  <View className={formGapClassName}>
                    <AuthInput
                      autoCapitalize="none"
                      autoComplete="username"
                      autoCorrect={false}
                      className="gap-1.5"
                      editable={!isSubmitting}
                      errorMessage={usernameError}
                      inputClassName={fieldHeightClassName}
                      label="Username"
                      placeholder="Chọn username"
                      textContentType="username"
                      value={username}
                      onBlur={() => markFieldTouched("username")}
                      onChangeText={(value) => {
                        setUsername(value);
                        handleClearError();
                      }}
                    />
                    <AuthInput
                      autoCapitalize="none"
                      autoCorrect={false}
                      className="gap-1.5"
                      editable={!isSubmitting}
                      errorMessage={displayNameError}
                      inputClassName={fieldHeightClassName}
                      label="Tên hiển thị"
                      placeholder="Chọn tên hiển thị"
                      textContentType="nickname"
                      value={displayName}
                      onBlur={() => markFieldTouched("displayName")}
                      onChangeText={(value) => {
                        setDisplayName(value);
                        handleClearError();
                      }}
                    />
                    <AuthInput
                      autoCapitalize="none"
                      autoComplete="email"
                      className="gap-1.5"
                      editable={!isSubmitting}
                      errorMessage={emailError}
                      inputClassName={fieldHeightClassName}
                      keyboardType="email-address"
                      label="Email"
                      placeholder="Nhập địa chỉ email"
                      textContentType="emailAddress"
                      value={email}
                      onBlur={() => markFieldTouched("email")}
                      onChangeText={(value) => {
                        setEmail(value);
                        handleClearError();
                      }}
                    />
                    <AuthInput
                      autoCapitalize="none"
                      autoComplete="password"
                      className="gap-1.5"
                      editable={!isSubmitting}
                      errorMessage={passwordError}
                      inputClassName={fieldHeightClassName}
                      label="Mật khẩu"
                      placeholder="Nhập mật khẩu"
                      secureTextEntry
                      textContentType="newPassword"
                      value={password}
                      onBlur={() => markFieldTouched("password")}
                      onChangeText={(value) => {
                        setPassword(value);
                        handleClearError();
                      }}
                    />
                    <AuthInput
                      autoCapitalize="none"
                      autoComplete="password-new"
                      className="gap-1.5"
                      editable={!isSubmitting}
                      errorMessage={confirmPasswordError}
                      inputClassName={fieldHeightClassName}
                      label="Nhập lại mật khẩu"
                      onSubmitEditing={() => {
                        void handleRegister();
                      }}
                      placeholder="Nhập lại mật khẩu"
                      returnKeyType="done"
                      secureTextEntry
                      textContentType="password"
                      value={confirmPassword}
                      onBlur={() => markFieldTouched("confirmPassword")}
                      onChangeText={(value) => {
                        setConfirmPassword(value);
                        handleClearError();
                      }}
                    />

                    <Pressable
                      disabled={isSubmitDisabled}
                      onPress={() => {
                        void handleRegister();
                      }}
                      className={`${buttonTopPaddingClassName} rounded-[18px]`}
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
                          {isSubmitting ? "Đang tạo tài khoản..." : "Tạo tài khoản"}
                        </Text>
                      </LinearGradient>
                    </Pressable>

                    {errorMessage ? (
                      <Text className="text-[12px] font-medium text-[#D6456C]">
                        {errorMessage}
                      </Text>
                    ) : null}
                  </View>

                  <View className={footerGapClassName}>
                    <View className="flex-row items-center justify-center gap-3">
                      <View className="h-px flex-1 bg-[#F0E8F4]" />
                      <Text className="text-[11px] font-medium text-[#AA9FB0]">
                        Hoặc đăng ký với
                      </Text>
                      <View className="h-px flex-1 bg-[#F0E8F4]" />
                    </View>

                    <View className="flex-row justify-center gap-3.5">
                      <SocialAuthButton accentColor="#EA4335" label="G" />
                      <SocialAuthButton accentColor="#1877F2" label="f" />
                    </View>

                    <View className="flex-row items-center justify-center gap-1.5">
                      <Text className="text-[12px] text-[#8E869A]">
                        Bạn đã có tài khoản?
                      </Text>
                      <Pressable onPress={() => router.push("/login?entry=home")}>
                        <Text className="text-[12px] font-extrabold text-[#F58752]">
                          Đăng nhập
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
