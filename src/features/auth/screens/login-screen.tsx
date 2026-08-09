import { SymbolView } from "@/components/ui/symbol-view";
import { LinearGradient } from "expo-linear-gradient";
import { useLocalSearchParams, useRouter, type Href } from "expo-router";
import * as WebBrowser from "expo-web-browser";
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
import { SafeAreaView } from "react-native-safe-area-context";

import {
  SocialSignInCancelledError,
  type SocialProvider,
} from "@/features/auth/api/social-login";
import { AuthInput } from "@/features/auth/components/auth-input";
import { SocialAuthButton } from "@/features/auth/components/social-auth-button";
import { useAuthScreenLayout } from "@/features/auth/hooks/use-auth-screen-layout";
import {
  signInWithPassword,
  signInWithSocial,
} from "@/features/auth/hooks/use-auth-session";
import {
  hasAnyFieldError,
  validateLoginForm,
} from "@/features/auth/utils/validation";

WebBrowser.maybeCompleteAuthSession();

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

export default function LoginScreen() {
  const router = useRouter();
  const { entry, redirectTo } = useLocalSearchParams<{
    entry?: string;
    redirectTo?: string;
  }>();
  const resolvedRedirectTo =
    typeof redirectTo === "string" ? decodeURIComponent(redirectTo) : null;
  const isSupportedEntry =
    entry === "home" || (entry === "invite" && Boolean(resolvedRedirectTo));
  // Redirect đến từ query param nên chỉ biết được lúc runtime -> không thể để
  // TS suy ra literal route type, phải ép kiểu Href.
  const postLoginRedirect = (resolvedRedirectTo ?? "/home") as Href;
  const {
    backButtonTop,
    cardMaxWidth,
    horizontalPadding,
    insets,
    isCompactScreen,
    scrollContentMinHeight,
  } = useAuthScreenLayout(760);
  const logoFloat = useSharedValue(0);
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [isPasswordVisible, setIsPasswordVisible] = useState(false);
  const [didAttemptSubmit, setDidAttemptSubmit] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [pendingSocialProvider, setPendingSocialProvider] =
    useState<SocialProvider | null>(null);
  const [touchedFields, setTouchedFields] = useState({
    password: false,
    username: false,
  });
  const heroHeight = isCompactScreen ? 208 : 248;
  const heroTopPadding = insets.top + (isCompactScreen ? 18 : 28);
  const heroBottomPadding = isCompactScreen ? 28 : 48;
  const logoSize = isCompactScreen ? 120 : 156;
  const cardTopPadding = isCompactScreen ? 20 : 28;
  const cardBottomPadding = Math.max(
    insets.bottom + (isCompactScreen ? 18 : 22),
    isCompactScreen ? 20 : 26,
  );
  const titleSize = isCompactScreen ? 25 : 29;
  const sectionTopMargin = isCompactScreen ? 18 : 24;
  const fieldHeightClassName = isCompactScreen
    ? "h-11 rounded-2xl"
    : "h-12 rounded-2xl";
  const buttonHeightClassName = isCompactScreen ? "h-12" : "h-14";
  const formGapClassName = isCompactScreen ? "gap-4" : "gap-5";
  const footerGapClassName = isCompactScreen ? "gap-4 pt-5" : "gap-5 pt-6";
  const loginErrors = validateLoginForm({
    password,
    username,
  });
  const usernameError =
    touchedFields.username || didAttemptSubmit
      ? (loginErrors.username ?? null)
      : null;
  const passwordError =
    touchedFields.password || didAttemptSubmit
      ? (loginErrors.password ?? null)
      : null;
  const isSocialSubmitting = pendingSocialProvider !== null;
  const isSubmitDisabled =
    isSubmitting || isSocialSubmitting || hasAnyFieldError(loginErrors);

  useEffect(() => {
    if (!isSupportedEntry) {
      router.replace("/home");
    }
  }, [isSupportedEntry, router]);

  useEffect(() => {
    void WebBrowser.warmUpAsync();

    return () => {
      void WebBrowser.coolDownAsync();
    };
  }, []);

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

  const handleLogin = async () => {
    setDidAttemptSubmit(true);

    if (hasAnyFieldError(loginErrors)) {
      console.warn("[auth] login blocked by client validation", {
        errors: loginErrors,
      });
      return;
    }

    const normalizedUsername = username.trim();

    console.info("[auth] login submitted from screen", {
      username:
        normalizedUsername.length <= 2
          ? normalizedUsername
          : `${normalizedUsername.slice(0, 2)}***${normalizedUsername.slice(-2)}`,
    });
    setErrorMessage(null);
    setIsSubmitting(true);

    try {
      await signInWithPassword(normalizedUsername, password);
      console.info("[auth] login navigation after success", {
        redirectTo: postLoginRedirect,
      });
      router.replace(postLoginRedirect);
    } catch (error) {
      console.warn("[auth] login screen caught error", {
        error:
          error instanceof Error
            ? { message: error.message, name: error.name, stack: error.stack }
            : error,
      });
      setErrorMessage(
        error instanceof Error
          ? error.message
          : "Không thể đăng nhập. Vui lòng thử lại.",
      );
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleSocialLogin = async (provider: SocialProvider) => {
    setErrorMessage(null);
    setPendingSocialProvider(provider);

    try {
      await signInWithSocial(provider);
      console.info("[auth] social login navigation after success", {
        provider,
        redirectTo: postLoginRedirect,
      });
      router.replace(postLoginRedirect);
    } catch (error) {
      if (error instanceof SocialSignInCancelledError) {
        console.info("[auth] social login cancelled by user", { provider });
        return;
      }

      console.warn("[auth] social login screen caught error", {
        error:
          error instanceof Error
            ? { message: error.message, name: error.name, stack: error.stack }
            : error,
        provider,
      });
      setErrorMessage(
        error instanceof Error
          ? error.message
          : `Không thể đăng nhập với ${provider === "facebook" ? "Facebook" : "Google"}. Vui lòng thử lại.`,
      );
    } finally {
      setPendingSocialProvider(null);
    }
  };

  const markFieldTouched = (field: "password" | "username") => {
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

  if (!isSupportedEntry) {
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
          contentContainerStyle={{
            flexGrow: 1,
            minHeight: scrollContentMinHeight,
          }}
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
                onPress={() => router.replace(postLoginRedirect)}
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
              className="-mt-8 flex-1 rounded-t-[34px] bg-white"
              style={[
                cardShadowStyle,
                { paddingHorizontal: horizontalPadding },
              ]}
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
                    Đăng nhập
                  </Text>
                  <Text className="text-[14px] text-[#8E869A]">
                    Nhập tài khoản của bạn để đăng nhập
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
                      label="Tên đăng nhập"
                      placeholder="Nhập tên đăng nhập"
                      textContentType="username"
                      value={username}
                      onBlur={() => markFieldTouched("username")}
                      onChangeText={(value) => {
                        setUsername(value);
                        if (errorMessage) {
                          setErrorMessage(null);
                        }
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
                      onSubmitEditing={() => {
                        void handleLogin();
                      }}
                      placeholder="Nhập mật khẩu"
                      rightAccessory={
                        <Pressable
                          accessibilityLabel={
                            isPasswordVisible ? "Ẩn mật khẩu" : "Hiện mật khẩu"
                          }
                          className="h-9 w-9 items-center justify-center"
                          disabled={isSubmitting}
                          hitSlop={8}
                          onPress={() => {
                            setIsPasswordVisible(
                              (currentValue) => !currentValue,
                            );
                          }}
                        >
                          <SymbolView
                            name={{
                              ios: isPasswordVisible ? "eye.slash" : "eye",
                              android: isPasswordVisible
                                ? "visibility_off"
                                : "visibility",
                              web: isPasswordVisible
                                ? "visibility_off"
                                : "visibility",
                            }}
                            size={18}
                            tintColor="#8E869A"
                          />
                        </Pressable>
                      }
                      returnKeyType="done"
                      secureTextEntry={!isPasswordVisible}
                      textContentType="password"
                      value={password}
                      onBlur={() => markFieldTouched("password")}
                      onChangeText={(value) => {
                        setPassword(value);
                        if (errorMessage) {
                          setErrorMessage(null);
                        }
                      }}
                    />

                    <Pressable
                      className="self-end"
                      onPress={() => router.push("/forgot-password?entry=home")}
                    >
                      <Text className="text-[14px] font-medium text-[#8E869A]">
                        Bạn quên mật khẩu?
                      </Text>
                    </Pressable>

                    <Pressable
                      disabled={isSubmitDisabled}
                      onPress={() => {
                        void handleLogin();
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
                          {isSubmitting ? "Đang đăng nhập..." : "Đăng nhập"}
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
                        Hoặc đăng nhập với
                      </Text>
                      <View className="h-px flex-1 bg-[#F0E8F4]" />
                    </View>

                    <View className="flex-row justify-center gap-3.5">
                      <SocialAuthButton
                        accentColor="#EA4335"
                        disabled={isSubmitting || isSocialSubmitting}
                        label="G"
                        onPress={() => {
                          void handleSocialLogin("google");
                        }}
                      />

                      <SocialAuthButton
                        accentColor="#1877F2"
                        disabled={isSubmitting || isSocialSubmitting}
                        label="f"
                        onPress={() => {
                          void handleSocialLogin("facebook");
                        }}
                      />
                    </View>

                    <View className="flex-row items-center justify-center gap-1.5">
                      <Text className="text-[14px] text-[#8E869A]">
                        Bạn chưa có tài khoản?
                      </Text>
                      <Pressable
                        onPress={() => router.push("/register?entry=home")}
                      >
                        <Text className="text-[14px] font-extrabold text-[#F58752]">
                          Đăng ký
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
