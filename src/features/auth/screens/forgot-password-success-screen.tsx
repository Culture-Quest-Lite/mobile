import { LinearGradient } from "expo-linear-gradient";
import { useLocalSearchParams, useRouter } from "expo-router";
import { SymbolView } from "expo-symbols";
import { useEffect } from "react";
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
  const insets = useSafeAreaInsets();
  const { height } = useWindowDimensions();
  const logoFloat = useSharedValue(0);
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
  const buttonHeightClassName = isCompactScreen ? "h-12" : "h-[52px]";
  const secondaryButtonHeightClassName = isCompactScreen ? "h-11" : "h-12";
  const footerGapClassName = isCompactScreen ? "gap-3 pt-4" : "gap-4 pt-6";
  const backButtonTop = insets.top + (isCompactScreen ? 10 : 12);
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
              <View className="items-center">
                <View className="h-20 w-20 items-center justify-center rounded-full bg-[#FFF4EF]">
                  <View className="h-14 w-14 items-center justify-center rounded-full bg-[#EB489B]">
                    <SymbolView
                      name={{
                        ios: "envelope.badge.fill",
                        android: "mark_email_read",
                        web: "mark_email_read",
                      }}
                      size={28}
                      tintColor="#FFFFFF"
                    />
                  </View>
                </View>
              </View>

              <View className="items-center gap-2" style={{ marginTop: sectionTopMargin }}>
                <Text
                  className="text-center font-extrabold text-[#EB489B]"
                  style={{ fontSize: titleSize }}
                >
                  Kiểm tra email
                </Text>
                <Text className="text-center text-[12px] leading-5 text-[#8E869A]">
                  Chúng tôi đã gửi email khôi phục mật khẩu tới{" "}
                  <Text className="font-bold text-[#322A3D]">{maskedEmail}</Text>.
                </Text>
                <Text className="text-center text-[12px] leading-5 text-[#625B71]">
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
                    <Text className="text-[15px] font-extrabold text-white">
                      Về đăng nhập
                    </Text>
                  </LinearGradient>
                </Pressable>

                <Pressable
                  onPress={goBackToForgotPassword}
                  className={`${secondaryButtonHeightClassName} items-center justify-center rounded-[18px] border border-[#F2E4EB] bg-[#FFF9FC]`}
                >
                  <Text className="text-[14px] font-bold text-[#F58752]">
                    Gửi lại email khác
                  </Text>
                </Pressable>
              </View>
            </View>
          </View>
        </View>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}
