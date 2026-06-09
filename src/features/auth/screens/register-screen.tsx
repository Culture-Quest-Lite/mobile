import { LinearGradient } from "expo-linear-gradient";
import { useRouter } from "expo-router";
import { useState } from "react";
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

import { AuthInput } from "@/features/auth/components/auth-input";
import { SocialAuthButton } from "@/features/auth/components/social-auth-button";

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
  const insets = useSafeAreaInsets();
  const { height } = useWindowDimensions();
  const [fullName, setFullName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
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
            <Image
              source={require("../../../../assets/images/logo2.png")}
              style={{ height: logoSize, width: logoSize }}
              resizeMode="contain"
            />
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
                  Đăng ký
                </Text>
                <Text className="text-[12px] text-[#8E869A]">
                  Tạo tài khoản để bắt đầu hành trình
                </Text>
              </View>

              <View style={{ marginTop: sectionTopMargin }}>
                <View className={formGapClassName}>
                  <AuthInput
                    autoCapitalize="words"
                    autoComplete="name"
                    className="gap-1.5"
                    inputClassName={fieldHeightClassName}
                    label="Họ và tên"
                    placeholder="Nguyễn Văn A"
                    textContentType="name"
                    value={fullName}
                    onChangeText={setFullName}
                  />
                  <AuthInput
                    autoCapitalize="none"
                    autoComplete="email"
                    className="gap-1.5"
                    inputClassName={fieldHeightClassName}
                    keyboardType="email-address"
                    label="Email"
                    placeholder="nguyenvana@gmail.com"
                    textContentType="emailAddress"
                    value={email}
                    onChangeText={setEmail}
                  />
                  <AuthInput
                    autoCapitalize="none"
                    autoComplete="password"
                    className="gap-1.5"
                    inputClassName={fieldHeightClassName}
                    label="Password"
                    placeholder="........"
                    secureTextEntry
                    textContentType="newPassword"
                    value={password}
                    onChangeText={setPassword}
                  />
                  <AuthInput
                    autoCapitalize="none"
                    autoComplete="password-new"
                    className="gap-1.5"
                    inputClassName={fieldHeightClassName}
                    label="Nhập lại password"
                    placeholder="........"
                    secureTextEntry
                    textContentType="password"
                    value={confirmPassword}
                    onChangeText={setConfirmPassword}
                  />

                  <Pressable
                    onPress={() => router.replace("/home")}
                    className={`${buttonTopPaddingClassName} rounded-[18px]`}
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
                        Tạo tài khoản
                      </Text>
                    </LinearGradient>
                  </Pressable>
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
                    <Pressable onPress={() => router.push("/login")}>
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
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}
