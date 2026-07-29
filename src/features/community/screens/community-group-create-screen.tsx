import { SymbolView } from "@/components/ui/symbol-view";
import { useRouter, type Href } from "expo-router";
import { StatusBar } from "expo-status-bar";
import { useState } from "react";
import {
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  Text,
  TextInput,
  View,
} from "react-native";
import {
  SafeAreaView,
  useSafeAreaInsets,
} from "react-native-safe-area-context";

import {
  getValidAccessToken,
  useAuthSession,
} from "@/features/auth/hooks/use-auth-session";
import {
  createCommunityGroup,
  type CommunityGroupPayload,
} from "@/features/community/api/group-api";
import { cacheCommunityGroupSession } from "../data/community-group-session-store";

function buildCreatedGroupSession(
  groupName: string,
  payload: CommunityGroupPayload,
) {
  return cacheCommunityGroupSession({
    ...payload,
    groupName,
    source: "created",
  });
}

export default function CommunityGroupCreateScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const authSession = useAuthSession();
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [groupName, setGroupName] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);

  const trimmedGroupName = groupName.trim();
  const isSubmitDisabled = isSubmitting || trimmedGroupName.length === 0;

  const closeScreen = () => {
    router.back();
  };

  const openLogin = () => {
    router.push("/login?entry=home" as Href);
  };

  const handleSubmit = async () => {
    if (isSubmitDisabled) {
      return;
    }

    if (!authSession.isAuthenticated) {
      setErrorMessage("Ban can dang nhap de tao nhom moi.");
      return;
    }

    setErrorMessage(null);
    setIsSubmitting(true);

    try {
      const accessToken = await getValidAccessToken();

      if (!accessToken) {
        throw new Error("Phien dang nhap da het han. Vui long dang nhap lai.");
      }

      const createdGroup = await createCommunityGroup({
        accessToken,
        groupName: trimmedGroupName,
        tokenType: authSession.tokenType,
      });

      const cachedSession = buildCreatedGroupSession(
        trimmedGroupName,
        createdGroup,
      );

      if (!cachedSession) {
        throw new Error("Khong the luu du lieu nhom vua tao.");
      }

      router.replace(
        `/community/group-created/${encodeURIComponent(cachedSession.shareToken)}` as Href,
      );
    } catch (error) {
      setErrorMessage(
        error instanceof Error
          ? error.message
          : "Khong the tao nhom luc nay. Vui long thu lai.",
      );
    } finally {
      setIsSubmitting(false);
    }
  };

  const screenContent = (
    <>
      <View className="flex-row items-center justify-between border-b border-[#EEF2F5] bg-white pl-1 pr-3">
        <Pressable
          className="h-11 w-11 items-center justify-center rounded-full"
          hitSlop={8}
          onPress={closeScreen}
        >
          <SymbolView
            name={{
              ios: "xmark",
              android: "close",
              web: "close",
            }}
            size={21}
            tintColor="#111827"
          />
        </Pressable>

        <Text
          className="text-[17px] font-black text-[#111827]"
          style={{ includeFontPadding: false, lineHeight: 20 }}
        >
          Tạo nhóm tham gia
        </Text>

        <View className="h-11 w-11" />
      </View>

      <View
        className="flex-1"
        style={{
          paddingBottom: Math.max(insets.bottom + 24, 28),
          paddingHorizontal: 18,
          paddingTop: 12,
        }}
      >
        <View>
          <Text
            className="text-[15px] font-black text-[#111827]"
            style={{ includeFontPadding: false, lineHeight: 26 }}
          >
            Tên nhóm
          </Text>

          <TextInput
            autoCapitalize="sentences"
            autoCorrect={false}
            className="mt-2.5 rounded-[14px] border border-[#D9DEE4] bg-white px-4 text-[17px] text-[#111827]"
            editable={!isSubmitting}
            onChangeText={setGroupName}
            placeholder="Đặt tên nhóm"
            placeholderTextColor="#8E98A3"
            selectionColor="#111827"
            style={{
              height: 58,
              includeFontPadding: false,
              lineHeight: 22,
              paddingVertical: 0,
            }}
            value={groupName}
          />

          <Pressable
            className="mt-4 items-center justify-center rounded-[10px]"
            disabled={isSubmitDisabled}
            onPress={() => {
              void handleSubmit();
            }}
            style={({ pressed }) => ({
              backgroundColor: isSubmitDisabled ? "#E5E7EB" : "#111827",
              borderColor: isSubmitDisabled ? "#CBD5E1" : "#111827",
              borderWidth: 1,
              height: 56,
              opacity: pressed && !isSubmitDisabled ? 0.88 : 1,
              shadowColor: "#111827",
              shadowOffset: { width: 0, height: 6 },
              shadowOpacity: isSubmitDisabled ? 0.05 : 0.12,
              shadowRadius: 12,
              elevation: isSubmitDisabled ? 1 : 4,
            })}
          >
            {isSubmitting ? (
              <ActivityIndicator
                color={isSubmitDisabled ? "#AAB2BB" : "#FFFFFF"}
                size="small"
              />
            ) : (
              <Text
                className="text-[16px] font-black"
                style={{
                  color: isSubmitDisabled ? "#475569" : "#FFFFFF",
                  includeFontPadding: false,
                  lineHeight: 18,
                }}
              >
                Tạo
              </Text>
            )}
          </Pressable>
        </View>

        {errorMessage ? (
          <View className="mt-4 rounded-[14px] border border-[#F3CDD6] bg-[#FFF6F8] px-4 py-3">
            <Text
              className="text-[14px] font-semibold text-[#B4234D]"
              style={{ includeFontPadding: false, lineHeight: 19 }}
            >
              {errorMessage}
            </Text>
            {!authSession.isAuthenticated ? (
              <Pressable
                className="mt-2 self-start rounded-full bg-white px-4 py-2"
                onPress={openLogin}
              >
                <Text
                  className="text-[13px] font-bold text-[#B4234D]"
                  style={{ includeFontPadding: false, lineHeight: 15 }}
                >
                  Đăng nhập
                </Text>
              </Pressable>
            ) : null}
          </View>
        ) : null}
      </View>
    </>
  );

  return (
    <SafeAreaView className="flex-1 bg-white" edges={["top", "left", "right"]}>
      <StatusBar style="dark" />

      {Platform.OS === "ios" ? (
        <KeyboardAvoidingView
          behavior="padding"
          className="flex-1"
          keyboardVerticalOffset={0}
        >
          {screenContent}
        </KeyboardAvoidingView>
      ) : (
        <View className="flex-1">{screenContent}</View>
      )}
    </SafeAreaView>
  );
}
