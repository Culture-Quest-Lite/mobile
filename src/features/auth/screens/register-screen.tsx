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
import {
  SafeAreaView,
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

import {
  SocialSignInCancelledError,
  type SocialProvider,
} from "@/features/auth/api/social-login";
import { registerWithPassword } from "@/features/auth/api/register";
import { AuthInput } from "@/features/auth/components/auth-input";
import { SocialAuthButton } from "@/features/auth/components/social-auth-button";
import { useAuthScreenLayout } from "@/features/auth/hooks/use-auth-screen-layout";
import { signInWithSocial } from "@/features/auth/hooks/use-auth-session";
import {
  hasAnyFieldError,
  validateRegisterForm,
} from "@/features/auth/utils/validation";

const gradientColors = ["#EB489B", "#F58752", "#FFC93C"] as const;
const authLogoSource = require("../../../../assets/images/logo2-cropped.png");

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
  const { t } = useTranslation();
  const router = useRouter();
  const params = useLocalSearchParams<{
    displayName?: string;
    email?: string;
    entry?: string;
    username?: string;
  }>();
  const { entry } = params;
  const {
    backButtonTop,
    cardMaxWidth,
    horizontalPadding,
    insets,
    isCompactScreen,
    scrollContentMinHeight,
  } = useAuthScreenLayout(820);
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
  const [pendingSocialProvider, setPendingSocialProvider] =
    useState<SocialProvider | null>(null);
  const [touchedFields, setTouchedFields] = useState({
    confirmPassword: false,
    displayName: false,
    email: false,
    password: false,
    username: false,
  });
  const heroTopPadding = insets.top + (isCompactScreen ? 12 : 20);
  const heroBottomPadding = isCompactScreen ? 22 : 36;
  const logoScale = 1.5;
  const logoSize = (isCompactScreen ? 106 : 140) * logoScale;
  const heroHeight = logoSize + heroTopPadding + heroBottomPadding;
  const cardOverlapClassName = isCompactScreen ? "-mt-4" : "-mt-6";
  const cardTopPadding = isCompactScreen ? 22 : 28;
  const cardBottomPadding = Math.max(
    insets.bottom + (isCompactScreen ? 16 : 20),
    isCompactScreen ? 20 : 26,
  );
  const scrollBottomPadding = Math.max(insets.bottom + 20, 28);
  const titleSize = isCompactScreen ? 25 : 29;
  const sectionTopMargin = isCompactScreen ? 18 : 24;
  const fieldHeightClassName = isCompactScreen
    ? "h-11 rounded-2xl"
    : "h-12 rounded-2xl";
  const buttonHeightClassName = isCompactScreen ? "h-12" : "h-14";
  const formGapClassName = isCompactScreen ? "gap-4" : "gap-5";
  const footerGapClassName = isCompactScreen ? "gap-5 pt-5" : "gap-5 pt-6";
  const buttonTopPaddingClassName = isCompactScreen ? "pt-0" : "pt-1";
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
  const isSocialSubmitting = pendingSocialProvider !== null;
  const isSubmitDisabled =
    isSubmitting || isSocialSubmitting || hasAnyFieldError(registerErrors);

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
          : t("auth.register.errorCannotRegister"),
      );
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleSocialSignUp = async (provider: SocialProvider) => {
    setErrorMessage(null);
    setPendingSocialProvider(provider);

    try {
      await signInWithSocial(provider);
      console.info("[auth] social sign-up navigation to /home", { provider });
      router.replace("/home");
    } catch (error) {
      if (error instanceof SocialSignInCancelledError) {
        console.info("[auth] social sign-up cancelled by user", { provider });
        return;
      }

      console.warn("[auth] social sign-up screen caught error", {
        error:
          error instanceof Error
            ? { message: error.message, name: error.name, stack: error.stack }
            : error,
        provider,
      });
      setErrorMessage(
        error instanceof Error
          ? error.message
          : t("auth.register.errorCannotRegisterWithProvider", {
              provider: provider === "facebook" ? "Facebook" : "Google",
            }),
      );
    } finally {
      setPendingSocialProvider(null);
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
        behavior={Platform.OS === "ios" ? "padding" : "height"}
        className="flex-1"
      >
        <ScrollView
          className="flex-1 bg-white"
          contentContainerStyle={{
            minHeight: scrollContentMinHeight,
            paddingBottom: scrollBottomPadding,
          }}
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
              className="relative w-full items-center justify-center overflow-hidden"
              style={{
                minHeight: heroHeight,
                paddingBottom: heroBottomPadding,
                paddingHorizontal: horizontalPadding,
                paddingTop: heroTopPadding,
              }}
            >
              <Pressable
                onPress={() => router.replace("/home")}
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
                  source={authLogoSource}
                  style={{ height: logoSize, width: logoSize }}
                  resizeMode="contain"
                />
              </Animated.View>
            </LinearGradient>

            <View
              className={`${cardOverlapClassName} rounded-t-[34px] bg-white`}
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
                    {t("auth.register.title")}
                  </Text>
                  <Text className="text-[14px] text-[#8E869A]">
                    {t("auth.register.subtitle")}
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
                      label={t("auth.register.username")}
                      placeholder={t("auth.register.usernamePlaceholder")}
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
                      label={t("auth.register.displayName")}
                      placeholder={t("auth.register.displayNamePlaceholder")}
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
                      label={t("auth.register.email")}
                      placeholder={t("auth.register.emailPlaceholder")}
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
                      label={t("auth.register.password")}
                      placeholder={t("auth.register.passwordPlaceholder")}
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
                      label={t("auth.register.confirmPassword")}
                      onSubmitEditing={() => {
                        void handleRegister();
                      }}
                      placeholder={t("auth.register.confirmPasswordPlaceholder")}
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
                        <Text className="text-[16px] font-extrabold text-white">
                          {isSubmitting
                            ? t("auth.register.creatingAccount")
                            : t("auth.register.createAccountButton")}
                        </Text>
                      </LinearGradient>
                    </Pressable>

                    {errorMessage ? (
                      <Text className="text-[14px] font-medium text-[#D6456C]">
                        {errorMessage}
                      </Text>
                    ) : null}
                  </View>

                  <View className={footerGapClassName}>
                    <View className="flex-row items-center justify-center gap-3">
                      <View className="h-px flex-1 bg-[#F0E8F4]" />
                      <Text className="text-[13px] font-medium text-[#AA9FB0]">
                        {t("auth.register.orSignUpWith")}
                      </Text>
                      <View className="h-px flex-1 bg-[#F0E8F4]" />
                    </View>

                    <View className="flex-row justify-center gap-3.5">
                      <SocialAuthButton
                        accentColor="#EA4335"
                        disabled={isSubmitting || isSocialSubmitting}
                        label="G"
                        onPress={() => {
                          void handleSocialSignUp("google");
                        }}
                      />
                      <SocialAuthButton
                        accentColor="#1877F2"
                        disabled={isSubmitting || isSocialSubmitting}
                        label="f"
                        onPress={() => {
                          void handleSocialSignUp("facebook");
                        }}
                      />
                    </View>

                    <View className="flex-row items-center justify-center gap-1.5">
                      <Text className="text-[14px] text-[#8E869A]">
                        {t("auth.register.haveAccount")}
                      </Text>
                      <Pressable onPress={() => router.push("/login?entry=home")}>
                        <Text className="text-[14px] font-extrabold text-[#F58752]">
                          {t("auth.register.signIn")}
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
