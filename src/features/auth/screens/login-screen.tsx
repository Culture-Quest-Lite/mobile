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

export default function LoginScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");

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
            className="relative w-full items-center justify-center overflow-hidden px-6 pb-14"
            style={{ minHeight: 255, paddingTop: insets.top + 24 }}
          >
            <View className="absolute left-[-36px] top-[-20px] h-[108px] w-[108px] rounded-full bg-white/65" />
            <View className="absolute left-[-8px] top-[16px] h-[80px] w-[80px] rounded-full bg-white/25" />
            <Image
              source={require("../../../../assets/images/logo2.png")}
              className="h-[176px] w-[176px]"
              resizeMode="contain"
            />
          </LinearGradient>

          <View
            className="-mt-8 flex-1 rounded-t-[34px] bg-white px-6 pb-8 pt-7"
            style={cardShadowStyle}
          >
            <View className="w-full max-w-[390px] flex-1 self-center">
              <View className="items-center gap-1.5">
                <Text className="text-[31px] font-extrabold text-[#EB489B]">
                  Đăng nhập
                </Text>
                <Text className="text-[12px] text-[#8E869A]">
                  Nhập tài khoản của bạn để đăng nhập
                </Text>
              </View>

              <View className="mt-7 flex-1 justify-between">
                <View className="gap-4">
                  <AuthInput
                    autoCapitalize="none"
                    autoComplete="email"
                    className="gap-1.5"
                    inputClassName="h-12 rounded-xl"
                    keyboardType="email-address"
                    label="Username"
                    placeholder="nguyenvana@gmail.com"
                    textContentType="emailAddress"
                    value={email}
                    onChangeText={setEmail}
                  />
                  <AuthInput
                    autoCapitalize="none"
                    autoComplete="password"
                    className="gap-1.5"
                    inputClassName="h-12 rounded-xl"
                    label="Password"
                    placeholder="........"
                    secureTextEntry
                    textContentType="password"
                    value={password}
                    onChangeText={setPassword}
                  />

                  <Pressable>
                    <Text className="text-[12px] font-medium text-[#8E869A]">
                      Bạn quên mật khẩu?
                    </Text>
                  </Pressable>

                  <Pressable
                    onPress={() => router.replace("/home")}
                    className="rounded-[18px]"
                    style={buttonShadowStyle}
                  >
                    <LinearGradient
                      colors={gradientColors}
                      end={{ x: 1, y: 0.5 }}
                      locations={[0, 0.58, 1]}
                      start={{ x: 0, y: 0.5 }}
                      className="h-[52px] items-center justify-center rounded-[18px]"
                    >
                      <Text className="text-[15px] font-extrabold text-white">
                        Đăng nhập
                      </Text>
                    </LinearGradient>
                  </Pressable>
                </View>

                <View className="gap-4 pt-6">
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
                </View>
              </View>
            </View>
          </View>
        </View>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}
