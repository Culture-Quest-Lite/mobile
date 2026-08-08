import { useLocalSearchParams, useRouter, type Href } from "expo-router";
import { StatusBar } from "expo-status-bar";
import { useEffect, useState } from "react";
import { ActivityIndicator, Image, Pressable, Text, View } from "react-native";
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
  getValidAccessToken,
  useAuthSession,
} from "@/features/auth/hooks/use-auth-session";
import { joinCommunityGroup } from "../api/group-api";
import { cacheCommunityGroupSession } from "../data/community-group-session-store";
import { bodyLineHeightFor, lineHeightFor } from "@/lib/text-scale";

type JoinScreenStatus = "empty" | "error" | "loading" | "pending";
type JoinFailureAction = "community" | "login" | "retry";

type JoinFailurePresentation = {
  action: JoinFailureAction;
  actionLabel: string;
  description: string;
  descriptionAccent?: string;
  descriptionSuffix?: string;
  hint: string;
  title: string;
};

const loadingCardShadowStyle = {
  shadowColor: "rgba(15, 23, 42, 0.12)",
  shadowOpacity: 1,
  shadowRadius: 28,
  shadowOffset: {
    width: 0,
    height: 18,
  },
  elevation: 10,
} as const;

const pendingApprovalImage = require("../../../../assets/images/tachnen1.png");

function normalizeLookupText(value: string) {
  return value
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase();
}

function isJoinPendingApprovalMessage(message: string) {
  const normalizedMessage = normalizeLookupText(message);

  return (
    normalizedMessage.includes("duyet") ||
    normalizedMessage.includes("pending") ||
    normalizedMessage.includes("approval")
  );
}

function resolveJoinFailurePresentation({
  isAuthenticated,
  message,
}: {
  isAuthenticated: boolean;
  message: string;
}): JoinFailurePresentation {
  const normalizedMessage = normalizeLookupText(message);

  if (
    !isAuthenticated ||
    normalizedMessage.includes("dang nhap") ||
    normalizedMessage.includes("het han phien") ||
    normalizedMessage.includes("token")
  ) {
    return {
      action: "login",
      actionLabel: "Dang nhap",
      description: "Ban can dang nhap de tham gia nhom tu invite link nay.",
      hint: "Sau khi dang nhap xong, he thong se tu thu tham gia nhom lai.",
      title: "Can dang nhap",
    };
  }

  if (
    normalizedMessage.includes("da tham gia") ||
    normalizedMessage.includes("already") ||
    normalizedMessage.includes("joined")
  ) {
    return {
      action: "community",
      actionLabel: "Ve cong dong",
      description: "Tai khoan nay da la thanh vien cua nhom roi.",
      hint: "Mo muc Cong dong de xem lai nhom hien tai.",
      title: "Ban da o trong nhom",
    };
  }

  if (
    normalizedMessage.includes("het han") ||
    normalizedMessage.includes("expired")
  ) {
    return {
      action: "retry",
      actionLabel: "Thu lai",
      description: "Invite link nay da het han va khong con hieu luc.",
      hint: "Hay xin leader mot link moi roi thu tham gia lai.",
      title: "Link da het han",
    };
  }

  if (
    normalizedMessage.includes("khong hop le") ||
    normalizedMessage.includes("invalid") ||
    normalizedMessage.includes("not found")
  ) {
    return {
      action: "retry",
      actionLabel: "Thu lai",
      description: "Invite link nay khong hop le hoac da bi thay doi.",
      hint: "Kiem tra lai link duoc chia se, sau do thu lai.",
      title: "Link khong hop le",
    };
  }

  return {
    action: "retry",
    actionLabel: "Thu lai",
    description: message,
    hint: "Vui long thu lai sau hoac lien he quan tri vien de duoc ho tro.",
    title: "Khong the tham gia nhom",
  };
}

function JoinFailureCard({
  onPress,
  presentation,
}: {
  onPress: () => void;
  presentation: JoinFailurePresentation;
}) {
  return (
    <View
      className="w-full max-w-[360px] rounded-[30px] border border-[#F6E7E8] bg-white px-5 py-6"
      style={{
        shadowColor: "#F47280",
        shadowOffset: { width: 0, height: 14 },
        shadowOpacity: 0.14,
        shadowRadius: 28,
        elevation: 9,
      }}
    >
      <View className="items-center">
        <View
          className="items-center justify-center rounded-full bg-[#FFF0F2]"
          style={{ height: 108, width: 108 }}
        >
          <View
            className="items-center justify-center rounded-full bg-[#FF6B7D]"
            style={{
              height: 56,
              width: 56,
              shadowColor: "#FF6678",
              shadowOffset: { width: 0, height: 12 },
              shadowOpacity: 0.24,
              shadowRadius: 22,
              elevation: 7,
            }}
          >
            <Text
              className="text-[30px] font-black text-white"
              style={{ includeFontPadding: false, lineHeight: lineHeightFor(30) }}
            >
              !
            </Text>
          </View>
        </View>

        <Text
          className="mt-5 text-center text-[28px] font-black text-[#1F2430]"
          style={{ includeFontPadding: false, lineHeight: lineHeightFor(28) }}
        >
          {presentation.title}
        </Text>

        <Text
          className="mt-4 px-2 text-center text-[16px] font-semibold text-[#6D7280]"
          style={{ includeFontPadding: false, lineHeight: bodyLineHeightFor(16) }}
        >
          {presentation.description}
          {presentation.descriptionAccent ? (
            <Text className="font-bold text-[#F2566C]">
              {presentation.descriptionAccent}
            </Text>
          ) : null}
          {presentation.descriptionSuffix ?? ""}
        </Text>

        <View className="mt-5 w-full rounded-[22px] border border-[#FFE6E9] bg-[#FFF6F7] px-4 py-4">
          <Text
            className="text-center text-[14px] font-medium text-[#7D8491]"
            style={{ includeFontPadding: false, lineHeight: bodyLineHeightFor(14) }}
          >
            {presentation.hint}
          </Text>
        </View>

        <Pressable
          className="mt-5 w-full items-center justify-center rounded-[18px] bg-[#F55369] px-4 py-4"
          onPress={onPress}
          style={{
            shadowColor: "#FF6A79",
            shadowOffset: { width: 0, height: 10 },
            shadowOpacity: 0.18,
            shadowRadius: 20,
            elevation: 6,
          }}
        >
          <Text
            className="text-[16px] font-black text-white"
            style={{ includeFontPadding: false, lineHeight: lineHeightFor(16) }}
          >
            {presentation.actionLabel}
          </Text>
        </Pressable>
      </View>
    </View>
  );
}

function JoinPendingApprovalCard({
  onPress,
}: {
  onPress: () => void;
}) {
  const heroFloat = useSharedValue(0);
  const heroScale = useSharedValue(1);

  useEffect(() => {
    heroFloat.set(
      withRepeat(
        withTiming(-10, {
          duration: 1800,
          easing: Easing.inOut(Easing.quad),
          reduceMotion: ReduceMotion.System,
        }),
        -1,
        true,
        undefined,
        ReduceMotion.System,
      ),
    );

    heroScale.set(
      withRepeat(
        withTiming(1.035, {
          duration: 1800,
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
      cancelAnimation(heroFloat);
      cancelAnimation(heroScale);
      heroFloat.set(0);
      heroScale.set(1);
    };
  }, [heroFloat, heroScale]);

  const animatedHeroStyle = useAnimatedStyle(() => ({
    transform: [{ translateY: heroFloat.get() }, { scale: heroScale.get() }],
  }));

  return (
    <View className="w-full max-w-[328px]">
      <View className="items-center">
        <Animated.View style={animatedHeroStyle}>
          <Image
            resizeMode="contain"
            source={pendingApprovalImage}
            style={{ height: 320, width: 320 }}
          />
        </Animated.View>
      </View>

      <Text
        className="mt-0.5 text-center text-[18px] font-semibold text-[#2A2433]"
        style={{ includeFontPadding: false, lineHeight: lineHeightFor(18) }}
      >
        Đã gửi yêu cầu tham gia!
      </Text>

      <Text
        className="mt-2 text-center text-[13px] text-[#6F657A]"
        style={{ includeFontPadding: false, lineHeight: bodyLineHeightFor(13) }}
      >
        Yêu cầu của bạn đã được gửi thành công.{"\n"}
        Vui lòng chờ leader duyệt để tham gia nhóm.
      </Text>

      <View
        className="mt-4 rounded-[20px] border border-[#F6E2E9] bg-[#FFF9FC] px-3.5 py-3.5"
        style={{
          shadowColor: "#F47280",
          shadowOffset: { width: 0, height: 10 },
          shadowOpacity: 0.06,
          shadowRadius: 18,
          elevation: 4,
        }}
      >
        <View className="flex-row items-start">
          <View
            className="mr-2.5 items-center justify-center rounded-full bg-[#FFF0F4]"
            style={{ height: 38, width: 38 }}
          >
            <Text
              className="text-[17px] font-black text-[#F4728B]"
              style={{ includeFontPadding: false, lineHeight: lineHeightFor(17) }}
            >
              !
            </Text>
          </View>

          <View className="flex-1">
            <Text
              className="text-[14px] text-[#FF6D8D]"
              style={{ includeFontPadding: false, lineHeight: lineHeightFor(14) }}
            >
              Đang chờ duyệt
            </Text>
            <Text
              className="mt-1 text-[12.5px] text-[#6F657A]"
              style={{ includeFontPadding: false, lineHeight: bodyLineHeightFor(12.5) }}
            >
              Leader sẽ xem xét yêu cầu của bạn và phản hồi sớm nhất có thể.
            </Text>
          </View>
        </View>
      </View>

      <Pressable
        className="mt-5 items-center justify-center rounded-[16px] bg-[#F87298] px-5 py-3"
        onPress={onPress}
        style={{
          shadowColor: "#F47280",
          shadowOffset: { width: 0, height: 10 },
          shadowOpacity: 0.16,
          shadowRadius: 18,
          elevation: 6,
        }}
      >
        <Text
          className="text-[14px] text-white"
          style={{ includeFontPadding: false, lineHeight: bodyLineHeightFor(14) }}
        >
          Quay lại trang chủ
        </Text>
      </Pressable>
    </View>
  );
}

export default function CommunityJoinGroupScreen() {
  const router = useRouter();
  const authSession = useAuthSession();
  const { shareToken } = useLocalSearchParams<{ shareToken?: string }>();
  const resolvedShareToken =
    typeof shareToken === "string" ? decodeURIComponent(shareToken) : null;
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [retryNonce, setRetryNonce] = useState(0);
  const [status, setStatus] = useState<JoinScreenStatus>(
    resolvedShareToken ? "loading" : "empty",
  );
  const invalidLinkPresentation = resolveJoinFailurePresentation({
    isAuthenticated: authSession.isAuthenticated,
    message: "Link khong hop le.",
  });
  const errorPresentation = errorMessage
    ? resolveJoinFailurePresentation({
        isAuthenticated: authSession.isAuthenticated,
        message: errorMessage,
      })
    : null;

  function handleJoinFailureAction(action: JoinFailureAction) {
    if (action === "community") {
      router.replace("/bookings" as Href);
      return;
    }

    if (action === "login") {
      const redirectTo = resolvedShareToken
        ? `/join/${encodeURIComponent(resolvedShareToken)}`
        : "/home";

      router.push(
        `/login?entry=invite&redirectTo=${encodeURIComponent(redirectTo)}` as Href,
      );
      return;
    }

    setStatus("loading");
    setErrorMessage(null);
    setRetryNonce((current) => current + 1);
  }

  useEffect(() => {
    let isActive = true;

    async function handleJoinGroup() {
      if (!resolvedShareToken) {
        if (isActive) {
          setStatus("empty");
        }
        return;
      }

      if (!authSession.isAuthenticated) {
        if (isActive) {
          const redirectTo = `/join/${encodeURIComponent(resolvedShareToken)}`;

          router.replace(
            `/login?entry=invite&redirectTo=${encodeURIComponent(redirectTo)}` as Href,
          );
        }
        return;
      }

      if (isActive) {
        setStatus("loading");
        setErrorMessage(null);
      }

      try {
        const accessToken = await getValidAccessToken();

        if (!accessToken) {
          throw new Error("Phien dang nhap da het han. Vui long dang nhap lai.");
        }

        const joinedGroup = await joinCommunityGroup({
          accessToken,
          shareToken: resolvedShareToken,
          tokenType: authSession.tokenType,
        });

        const cachedGroup = cacheCommunityGroupSession({
          ...joinedGroup,
          source: "joined",
        });

        if (!cachedGroup) {
          throw new Error("Khong the luu du lieu nhom vua tham gia.");
        }

        if (!isActive) {
          return;
        }

        const detailRouteKey = cachedGroup.groupId ?? cachedGroup.shareToken;

        router.replace(
          `/community/group/${encodeURIComponent(detailRouteKey)}` as Href,
        );
      } catch (error) {
        if (!isActive) {
          return;
        }

        const resolvedErrorMessage =
          error instanceof Error
            ? error.message
            : "Khong the tham gia nhom tu invite link nay.";

        if (isJoinPendingApprovalMessage(resolvedErrorMessage)) {
          setErrorMessage(null);
          setStatus("pending");
          return;
        }

        setErrorMessage(resolvedErrorMessage);
        setStatus("error");
      }
    }

    void handleJoinGroup();

    return () => {
      isActive = false;
    };
  }, [
    authSession.isAuthenticated,
    authSession.tokenType,
    resolvedShareToken,
    retryNonce,
    router,
  ]);

  return (
    <SafeAreaView
      className={`flex-1 ${status === "pending" ? "bg-white" : "bg-[#FFF9FD]"}`}
      edges={["top", "left", "right", "bottom"]}
    >
      <StatusBar style="dark" />

      <View
        className="flex-1 items-center justify-center"
        style={{ paddingHorizontal: status === "pending" ? 14 : 20 }}
      >
        {status === "loading" ? (
          <View
            className="w-full max-w-[360px] rounded-[32px] border border-[#F4DCE6] bg-white px-6 py-8"
            style={loadingCardShadowStyle}
          >
            <View className="items-center">
              <ActivityIndicator color="#EB489B" size="large" />
            </View>
          </View>
        ) : null}

        {status === "empty" ? (
          <JoinFailureCard
            onPress={() => handleJoinFailureAction(invalidLinkPresentation.action)}
            presentation={invalidLinkPresentation}
          />
        ) : null}

        {status === "error" && errorPresentation ? (
          <JoinFailureCard
            onPress={() => handleJoinFailureAction(errorPresentation.action)}
            presentation={errorPresentation}
          />
        ) : null}

        {status === "pending" ? (
          <JoinPendingApprovalCard
            onPress={() => {
              router.replace("/home" as Href);
            }}
          />
        ) : null}
      </View>
    </SafeAreaView>
  );
}
