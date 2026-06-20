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

import { AuthInput } from "@/features/auth/components/auth-input";
import { SocialAuthButton } from "@/features/auth/components/social-auth-button";
import { signInWithPassword } from "@/features/auth/hooks/use-auth-session";

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

export default function LoginScreen() {
  const router = useRouter();
  const { entry } = useLocalSearchParams<{ entry?: string }>();
  const insets = useSafeAreaInsets();
  const { height } = useWindowDimensions();
  const logoFloat = useSharedValue(0);
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
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
  const footerGapClassName = isCompactScreen ? "gap-3 pt-4" : "gap-4 pt-6";
  const backButtonTop = insets.top + (isCompactScreen ? 10 : 12);

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

  const handleLogin = async () => {
    const normalizedUsername = username.trim();
    const normalizedPassword = password.trim();

    if (!normalizedUsername || !normalizedPassword) {
      console.warn("[auth] login blocked by client validation", {
        hasPassword: Boolean(normalizedPassword),
        hasUsername: Boolean(normalizedUsername),
      });
      setErrorMessage("Vui lòng nhập username và mật khẩu.");
      return;
    }

    console.info("[auth] login submitted from screen", {
      username: normalizedUsername.length <= 2
        ? normalizedUsername
        : `${normalizedUsername.slice(0, 2)}***${normalizedUsername.slice(-2)}`,
    });
    setErrorMessage(null);
    setIsSubmitting(true);

    try {
      await signInWithPassword(normalizedUsername, password);
      console.info("[auth] login navigation to /home");
      router.replace("/home");
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
                  Đăng nhập
                </Text>
                <Text className="text-[12px] text-[#8E869A]">
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
                    inputClassName={fieldHeightClassName}
                    label="Username"
                    placeholder="hongngoc123"
                    textContentType="username"
                    value={username}
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
                    inputClassName={fieldHeightClassName}
                    label="Password"
                    onSubmitEditing={() => {
                      void handleLogin();
                    }}
                    placeholder="........"
                    returnKeyType="done"
                    secureTextEntry
                    textContentType="password"
                    value={password}
                    onChangeText={(value) => {
                      setPassword(value);
                      if (errorMessage) {
                        setErrorMessage(null);
                      }
                    }}
                  />

                  <Pressable>
                    <Text className="text-[12px] font-medium text-[#8E869A]">
                      Bạn quên mật khẩu?
                    </Text>
                  </Pressable>

                  <Pressable
                    disabled={isSubmitting}
                    onPress={() => {
                      void handleLogin();
                    }}
                    className="rounded-[18px]"
                    style={[buttonShadowStyle, isSubmitting ? { opacity: 0.78 } : null]}
                  >
                    <LinearGradient
                      colors={gradientColors}
                      end={{ x: 1, y: 0.5 }}
                      locations={[0, 0.58, 1]}
                      start={{ x: 0, y: 0.5 }}
                      className={`${buttonHeightClassName} items-center justify-center rounded-[18px]`}
                    >
                      <Text className="text-[15px] font-extrabold text-white">
                        {isSubmitting ? "Đang đăng nhập..." : "Đăng nhập"}
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
                      Hoặc đăng nhập với
                    </Text>
                    <View className="h-px flex-1 bg-[#F0E8F4]" />
                  </View>

                  <View className="flex-row justify-center gap-3.5">
                    <SocialAuthButton accentColor="#EA4335" label="G" />

                    <SocialAuthButton accentColor="#1877F2" label="f" />
                  </View>

                  <View className="flex-row items-center justify-center gap-1.5">
                    <Text className="text-[12px] text-[#8E869A]">
                      Bạn chưa có tài khoản?
                    </Text>
                    <Pressable onPress={() => router.push("/register?entry=home")}>
                      <Text className="text-[12px] font-extrabold text-[#F58752]">
                        Đăng ký
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
