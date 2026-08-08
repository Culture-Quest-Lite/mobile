import { LinearGradient } from "expo-linear-gradient";
import { lineHeightFor } from "@/lib/text-scale";

import { useLocalSearchParams, useRouter } from "expo-router";
import { SymbolView } from "@/components/ui/symbol-view";
import { useEffect } from "react";
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

import { useAuthScreenLayout } from "@/features/auth/hooks/use-auth-screen-layout";

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

function maskEmailAddress(email: string) {
  const normalizedEmail = email.trim().toLowerCase();

  if (!normalizedEmail) {
    return "email của bạn";
  }

  const [localPart, domain] = normalizedEmail.split("@");

  if (!localPart || !domain) {
    return normalizedEmail;
  }

  const visiblePrefixLength = localPart.length <= 2 ? 1 : Math.min(4, localPart.length - 1);
  const visiblePrefix = localPart.slice(0, visiblePrefixLength);

  return `${visiblePrefix}****@${domain}`;
}

export default function ForgotPasswordSuccessScreen() {
  const router = useRouter();
  const { email, entry, message } = useLocalSearchParams<{
    email?: string;
    entry?: string;
    message?: string;
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
  const heroHeight = isCompactScreen ? 208 : 248;
  const heroTopPadding = insets.top + (isCompactScreen ? 18 : 28);
  const heroBottomPadding = isCompactScreen ? 28 : 48;
  const logoSize = isCompactScreen ? 120 : 156;
  const cardTopPadding = isCompactScreen ? 20 : 28;
  const cardBottomPadding = Math.max(
    insets.bottom + (isCompactScreen ? 18 : 22),
    isCompactScreen ? 20 : 26,
  );
  const titleSize = isCompactScreen ? 21 : 24;
  const titleLineHeight = lineHeightFor(titleSize);
  const sectionTopMargin = isCompactScreen ? 14 : 18;
  const buttonHeightClassName = isCompactScreen ? "h-12" : "h-14";
  const secondaryButtonHeightClassName = isCompactScreen ? "h-11" : "h-12";
  const footerGapClassName = isCompactScreen ? "gap-4 pt-5" : "gap-5 pt-6";
  const emailValue = email?.trim() ?? "";
  const maskedEmail = maskEmailAddress(emailValue);
  const successMessage = message?.trim() || "Chúng tôi đã gửi hướng dẫn khôi phục mật khẩu tới email của bạn.";

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

  const goBackToForgotPassword = () => {
    router.replace({
      params: {
        email: emailValue || undefined,
        entry: "home",
      },
      pathname: "/forgot-password",
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
                <View className="items-center">
                  <View className="h-20 w-20 items-center justify-center rounded-full bg-[#FFF4EF]">
                    <View className="h-14 w-14 items-center justify-center rounded-full bg-[#EB489B]">
                      <SymbolView
                        name={{
                          ios: "envelope.badge.fill",
                          android: "mark_email_read",
                          web: "mark_email_read",
                        }}
                        size={24}
                        tintColor="#FFFFFF"
                      />
                    </View>
                  </View>
                </View>

                <View
                  className="items-center gap-1"
                  style={{ marginTop: sectionTopMargin }}
                >
                  <Text
                    className="text-center font-semibold text-[#EB489B]"
                    style={{ fontSize: titleSize, lineHeight: titleLineHeight }}
                  >
                    Kiểm tra email
                  </Text>
                  <Text className="text-center text-[14px] leading-[18px] text-[#8E869A]">
                    Chúng tôi đã gửi email khôi phục mật khẩu tới{" "}
                    <Text className="font-semibold text-[#322A3D]">
                      {maskedEmail}
                    </Text>
                    .
                  </Text>
                  <Text className="text-center text-[14px] leading-[18px] text-[#625B71]">
                    {successMessage}
                  </Text>
                </View>

                <View className={footerGapClassName}>
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
                      <Text className="text-[16px] font-semibold text-white">
                        Về đăng nhập
                      </Text>
                    </LinearGradient>
                  </Pressable>

                  <Pressable
                    onPress={goBackToForgotPassword}
                    className={`${secondaryButtonHeightClassName} items-center justify-center rounded-[18px] border border-[#F2E4EB] bg-[#FFF9FC]`}
                  >
                    <Text className="text-[15px] font-medium text-[#F58752]">
                      Gửi lại email khác
                    </Text>
                  </Pressable>
                </View>
              </View>
            </View>
          </View>
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}
