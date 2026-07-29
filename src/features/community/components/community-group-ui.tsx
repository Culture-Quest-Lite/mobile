import { SymbolView } from "@/components/ui/symbol-view";
import { LinearGradient } from "expo-linear-gradient";
import { useEffect, useRef, type ReactNode } from "react";
import {
  ActivityIndicator,
  Animated,
  Pressable,
  Text,
  View,
} from "react-native";

type GroupStateVariant = "empty" | "error" | "info";

function resolveStatusColors(status?: string | null) {
  switch ((status ?? "").trim().toUpperCase()) {
    case "ACTIVE":
      return {
        backgroundColor: "#E8F5E9",
        textColor: "#2E7D32",
      };
    default:
      return {
        backgroundColor: "#ECEFF1",
        textColor: "#546E7A",
      };
  }
}

export function CommunityGroupTopBar({
  backgroundColor = "#F8F6F1",
  onBack,
  title,
  trailing,
}: {
  backgroundColor?: string;
  onBack: () => void;
  title: string;
  trailing?: ReactNode;
}) {
  return (
    <View
      className="flex-row items-center justify-between border-b border-[#E8ECEF] px-2 pr-4"
      style={{ backgroundColor }}
    >
      <Pressable
        className="h-12 w-12 items-center justify-center rounded-full"
        hitSlop={8}
        onPress={onBack}
      >
        <SymbolView
          name={{
            ios: "xmark",
            android: "close",
            web: "close",
          }}
          size={22}
          tintColor="#1F2933"
        />
      </Pressable>

      <Text
        className="text-[18px] font-black text-[#1F2933]"
        style={{ includeFontPadding: false, lineHeight: 22 }}
      >
        {title}
      </Text>

      <View className="min-h-12 min-w-12 items-center justify-center">
        {trailing ?? <View className="h-12 w-12" />}
      </View>
    </View>
  );
}

export function CommunityGroupStatusChip({
  status,
}: {
  status?: string | null;
}) {
  const resolvedStatus = (status ?? "UNKNOWN").trim() || "UNKNOWN";
  const statusColors = resolveStatusColors(resolvedStatus);

  return (
    <View
      className="self-start rounded-full px-3 py-1"
      style={{ backgroundColor: statusColors.backgroundColor }}
    >
      <Text
        className="text-[11px] font-bold uppercase tracking-[0.5px]"
        style={{
          color: statusColors.textColor,
          includeFontPadding: false,
          lineHeight: 12,
        }}
      >
        {resolvedStatus}
      </Text>
    </View>
  );
}

export function CommunityGroupStateCard({
  actionLabel,
  description,
  icon,
  onPress,
  title,
  variant = "info",
}: {
  actionLabel?: string;
  description: string;
  icon: "error" | "groups" | "link_off";
  onPress?: (() => void) | undefined;
  title: string;
  variant?: GroupStateVariant;
}) {
  const palette =
    variant === "error"
      ? {
          backgroundColor: "#FFF1F2",
          borderColor: "#FBCFE8",
          textColor: "#9D174D",
        }
      : variant === "empty"
        ? {
            backgroundColor: "#F8FAFC",
            borderColor: "#E2E8F0",
            textColor: "#475569",
          }
        : {
            backgroundColor: "#FFF9E8",
            borderColor: "#F7D78C",
            textColor: "#8A5A00",
          };

  return (
    <View
      className="rounded-[24px] border px-4 py-4"
      style={{
        backgroundColor: palette.backgroundColor,
        borderColor: palette.borderColor,
      }}
    >
      <View className="flex-row items-start gap-3">
        <View
          className="h-10 w-10 items-center justify-center rounded-full"
          style={{ backgroundColor: "#FFFFFF" }}
        >
          <SymbolView name={icon} size={18} tintColor={palette.textColor} />
        </View>

        <View className="flex-1">
          <Text
            className="text-[16px] font-black"
            style={{
              color: "#1F2933",
              includeFontPadding: false,
              lineHeight: 20,
            }}
          >
            {title}
          </Text>
          <Text
            className="mt-1 text-[14px]"
            style={{
              color: palette.textColor,
              includeFontPadding: false,
              lineHeight: 19,
            }}
          >
            {description}
          </Text>

          {actionLabel && onPress ? (
            <Pressable
              className="mt-3 self-start rounded-full bg-white px-4 py-2.5"
              onPress={onPress}
            >
              <Text
                className="text-[13px] font-bold"
                style={{
                  color: palette.textColor,
                  includeFontPadding: false,
                  lineHeight: 15,
                }}
              >
                {actionLabel}
              </Text>
            </Pressable>
          ) : null}
        </View>
      </View>
    </View>
  );
}

export function CommunityGroupMetricCard({
  label,
  value,
}: {
  label: string;
  value: string;
}) {
  return (
    <View className="min-h-[84px] flex-1 rounded-[22px] border border-[#E5E7EB] bg-white px-4 py-3.5">
      <Text
        className="text-[12px] font-semibold uppercase tracking-[0.3px] text-[#8A94A3]"
        style={{ includeFontPadding: false, lineHeight: 14 }}
      >
        {label}
      </Text>
      <Text
        className="mt-2 text-[18px] font-black text-[#1F2933]"
        style={{ includeFontPadding: false, lineHeight: 22 }}
      >
        {value}
      </Text>
    </View>
  );
}

export function CommunityGroupInviteLinkCard({
  appInviteUrl,
  copied,
  inviteUrl,
  onCopy,
  onShare,
  sharePending = false,
}: {
  appInviteUrl: string;
  copied: boolean;
  inviteUrl: string;
  onCopy: () => void;
  onShare: () => void;
  sharePending?: boolean;
}) {
  return (
    <View className="rounded-[28px] border border-[#E5E7EB] bg-white px-4 py-4">
      <View className="flex-row items-start justify-between gap-3">
        <View className="flex-1">
          <Text
            className="text-[12px] font-semibold uppercase tracking-[0.3px] text-[#8A94A3]"
            style={{ includeFontPadding: false, lineHeight: 14 }}
          >
            Invite Link
          </Text>
          <Text
            className="mt-2 text-[15px] font-semibold text-[#1F2933]"
            selectable
            style={{ includeFontPadding: false, lineHeight: 21 }}
          >
            {inviteUrl}
          </Text>
          <Text
            className="mt-2 text-[12px] text-[#68737D]"
            selectable
            style={{ includeFontPadding: false, lineHeight: 17 }}
          >
            {`App deep link: ${appInviteUrl}`}
          </Text>
        </View>

        <View
          className="h-11 w-11 items-center justify-center rounded-full"
          style={{ backgroundColor: "#FFF6DE" }}
        >
          <SymbolView
            name={{
              ios: "paperplane.fill",
              android: "send",
              web: "send",
            }}
            size={18}
            tintColor="#B26A00"
          />
        </View>
      </View>

      <View className="mt-4 flex-row gap-3">
        <Pressable
          className="flex-1 flex-row items-center justify-center rounded-[18px] border border-[#D5DBE1] bg-white px-4 py-3"
          onPress={onCopy}
        >
          <SymbolView
            name={{
              ios: "doc.on.doc",
              android: "content_copy",
              web: "content_copy",
            }}
            size={17}
            tintColor="#334155"
          />
          <Text
            className="ml-2 text-[14px] font-bold text-[#334155]"
            style={{ includeFontPadding: false, lineHeight: 16 }}
          >
            {copied ? "Da sao chep" : "Copy Link"}
          </Text>
        </Pressable>

        <Pressable
          className="flex-1 flex-row items-center justify-center rounded-[18px] bg-[#1F2933] px-4 py-3"
          disabled={sharePending}
          onPress={onShare}
          style={({ pressed }) => ({
            opacity: sharePending ? 0.72 : pressed ? 0.86 : 1,
          })}
        >
          {sharePending ? (
            <ActivityIndicator color="#FFFFFF" size="small" />
          ) : (
            <>
              <SymbolView
                name={{
                  ios: "square.and.arrow.up",
                  android: "share",
                  web: "share",
                }}
                size={17}
                tintColor="#FFFFFF"
              />
              <Text
                className="ml-2 text-[14px] font-black text-white"
                style={{ includeFontPadding: false, lineHeight: 16 }}
              >
                Share
              </Text>
            </>
          )}
        </Pressable>
      </View>
    </View>
  );
}

export function CommunityGroupSuccessIllustration() {
  const floatValue = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    const animation = Animated.loop(
      Animated.sequence([
        Animated.timing(floatValue, {
          duration: 1800,
          toValue: 1,
          useNativeDriver: true,
        }),
        Animated.timing(floatValue, {
          duration: 1800,
          toValue: 0,
          useNativeDriver: true,
        }),
      ]),
    );

    animation.start();

    return () => {
      animation.stop();
    };
  }, [floatValue]);

  const translateY = floatValue.interpolate({
    inputRange: [0, 1],
    outputRange: [0, -8],
  });
  const scale = floatValue.interpolate({
    inputRange: [0, 1],
    outputRange: [1, 1.04],
  });

  return (
    <View className="items-center">
      <Animated.View
        style={{
          transform: [{ scale }, { translateY }],
        }}
      >
        <LinearGradient
          colors={["#F7D46B", "#EF8D32", "#E35D79"]}
          end={{ x: 1, y: 0 }}
          start={{ x: 0, y: 1 }}
          style={{
            alignItems: "center",
            borderRadius: 44,
            height: 96,
            justifyContent: "center",
            width: 96,
          }}
        >
          <View
            className="items-center justify-center rounded-full bg-white/88"
            style={{ height: 58, width: 58 }}
          >
            <SymbolView
              name={{
                ios: "checkmark.seal.fill",
                android: "verified",
                web: "verified",
              }}
              size={30}
              tintColor="#D65A3A"
            />
          </View>
        </LinearGradient>
      </Animated.View>

      <View className="mt-4 flex-row items-center gap-3">
        <View className="rounded-full bg-[#FFF7E0] px-3 py-1.5">
          <Text
            className="text-[12px] font-bold uppercase tracking-[0.3px] text-[#8A5A00]"
            style={{ includeFontPadding: false, lineHeight: 14 }}
          >
            Nhom da san sang
          </Text>
        </View>
      </View>
    </View>
  );
}
