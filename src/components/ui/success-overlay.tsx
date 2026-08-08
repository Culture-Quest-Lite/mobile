import { SymbolView } from "@/components/ui/symbol-view";
import { UserAvatar } from "@/components/ui/user-avatar";
import { LinearGradient } from "expo-linear-gradient";
import { useEffect, type ComponentProps } from "react";
import {
  Pressable,
  Text as RNText,
  useWindowDimensions,
  View,
} from "react-native";
import Animated, {
  Easing,
  ReduceMotion,
  cancelAnimation,
  interpolate,
  useAnimatedStyle,
  useSharedValue,
  withDelay,
  withTiming,
} from "react-native-reanimated";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { lineHeightFor } from "@/lib/text-scale";

type TextProps = ComponentProps<typeof RNText>;
type SymbolName = ComponentProps<typeof SymbolView>["name"];
type ConfettiKind = "bar" | "dot" | "sparkle" | "star";
type ConfettiPieceConfig = {
  color: string;
  kind: ConfettiKind;
  left: number;
  rotate: number;
  size: number;
  top: number;
  travel: number;
};

const successTextMaxFontSizeMultiplier = 1.05;
const accentColor = "#EB489B";
const accentDeepColor = "#D6367F";
const titleColor = "#E4508F";
const bodyColor = "#6B7280";
const subtleTextColor = "#9CA3AF";
const closeBorderColor = "#F0E3EB";
const secondaryBorderColor = "#F6D9E7";
const primaryButtonColor = "#F062A6";
const pageGradientColors = ["#FFF1F7", "#FFF8FB", "#FFFFFF"] as const;
const haloGradientColors = [
  "rgba(247,189,215,0.55)",
  "rgba(251,211,229,0.28)",
  "rgba(255,255,255,0)",
] as const;
const confettiAreaHeight = 372;
const avatarSize = 126;
const avatarHaloExtra = 52;
const confettiPieces: ConfettiPieceConfig[] = [
  { color: "#FFC9DE", kind: "bar", left: 0.07, rotate: -22, size: 12, top: 34, travel: 26 },
  { color: "#F7BDD7", kind: "dot", left: 0.19, rotate: 0, size: 8, top: 12, travel: 22 },
  { color: "#FFC93C", kind: "sparkle", left: 0.29, rotate: 0, size: 17, top: 66, travel: 30 },
  { color: "#F58FBD", kind: "bar", left: 0.1, rotate: 38, size: 13, top: 108, travel: 24 },
  { color: "#F58752", kind: "star", left: 0.05, rotate: 0, size: 13, top: 182, travel: 28 },
  { color: "#FBD3E5", kind: "bar", left: 0.14, rotate: 14, size: 12, top: 248, travel: 20 },
  { color: "#EB489B", kind: "dot", left: 0.24, rotate: 0, size: 7, top: 308, travel: 18 },
  { color: "#F7BDD7", kind: "sparkle", left: 0.41, rotate: 0, size: 15, top: 16, travel: 26 },
  { color: "#FFC93C", kind: "star", left: 0.55, rotate: 0, size: 12, top: 40, travel: 24 },
  { color: "#F58FBD", kind: "bar", left: 0.71, rotate: -30, size: 13, top: 18, travel: 26 },
  { color: "#FFC9DE", kind: "dot", left: 0.86, rotate: 0, size: 8, top: 48, travel: 22 },
  { color: "#EB489B", kind: "sparkle", left: 0.79, rotate: 0, size: 19, top: 104, travel: 30 },
  { color: "#FFC93C", kind: "bar", left: 0.91, rotate: 24, size: 12, top: 168, travel: 24 },
  { color: "#F58FBD", kind: "star", left: 0.85, rotate: 0, size: 14, top: 236, travel: 26 },
  { color: "#FBD3E5", kind: "bar", left: 0.72, rotate: -16, size: 12, top: 296, travel: 20 },
  { color: "#F7BDD7", kind: "dot", left: 0.63, rotate: 0, size: 7, top: 336, travel: 18 },
];
const defaultPrimaryActionIcon: SymbolName = {
  ios: "chevron.right",
  android: "chevron_right",
  web: "chevron_right",
};
const defaultSecondaryActionIcon: SymbolName = {
  ios: "safari",
  android: "explore",
  web: "explore",
};

function Text({
  maxFontSizeMultiplier = successTextMaxFontSizeMultiplier,
  style,
  ...props
}: TextProps) {
  return (
    <RNText
      maxFontSizeMultiplier={maxFontSizeMultiplier}
      style={[{ includeFontPadding: false }, style]}
      {...props}
    />
  );
}

function ConfettiPiece({
  index,
  piece,
  width,
}: {
  index: number;
  piece: ConfettiPieceConfig;
  width: number;
}) {
  const progress = useSharedValue(0);

  useEffect(() => {
    progress.set(
      withDelay(
        70 + index * 42,
        withTiming(1, {
          duration: 620,
          easing: Easing.out(Easing.cubic),
          reduceMotion: ReduceMotion.System,
        }),
      ),
    );

    return () => {
      cancelAnimation(progress);
    };
  }, [index, progress]);

  const animatedStyle = useAnimatedStyle(() => {
    const value = progress.get();

    return {
      opacity: interpolate(value, [0, 0.4, 1], [0, 1, 0.92]),
      transform: [
        { translateY: piece.travel * (1 - value) },
        { scale: 0.55 + 0.45 * value },
        { rotate: `${piece.rotate}deg` },
      ],
    };
  });

  return (
    <Animated.View
      pointerEvents="none"
      style={[
        {
          left: Math.round(piece.left * width),
          position: "absolute",
          top: piece.top,
        },
        animatedStyle,
      ]}
    >
      {piece.kind === "bar" ? (
        <View
          style={{
            backgroundColor: piece.color,
            borderRadius: 3,
            height: 5,
            width: piece.size,
          }}
        />
      ) : piece.kind === "dot" ? (
        <View
          style={{
            backgroundColor: piece.color,
            borderRadius: 999,
            height: piece.size,
            width: piece.size,
          }}
        />
      ) : (
        <SymbolView
          name={
            piece.kind === "sparkle"
              ? {
                  ios: "sparkles",
                  android: "auto_awesome",
                  web: "auto_awesome",
                }
              : {
                  ios: "star.fill",
                  android: "star",
                  web: "star",
                }
          }
          size={piece.size}
          tintColor={piece.color}
        />
      )}
    </Animated.View>
  );
}

function SuccessHeroAvatar({
  avatarFallbackLabel,
  avatarUri,
}: {
  avatarFallbackLabel?: string;
  avatarUri?: string | null;
}) {
  const haloSize = avatarSize + avatarHaloExtra;

  return (
    <View className="items-center justify-center" style={{ height: haloSize }}>
      <LinearGradient
        colors={haloGradientColors}
        end={{ x: 1, y: 1 }}
        start={{ x: 0, y: 0 }}
        pointerEvents="none"
        style={{
          borderRadius: 999,
          height: haloSize,
          position: "absolute",
          width: haloSize,
        }}
      />

      <View>
        <View
          className="bg-white"
          style={{
            alignItems: "center",
            borderRadius: 999,
            elevation: 8,
            height: avatarSize,
            justifyContent: "center",
            overflow: "hidden",
            shadowColor: "rgba(228,80,143,0.30)",
            shadowOffset: { width: 0, height: 12 },
            shadowOpacity: 1,
            shadowRadius: 20,
            width: avatarSize,
          }}
        >
          <UserAvatar
            borderColor="#FFFFFF"
            borderWidth={2}
            displayName={avatarFallbackLabel}
            size={avatarSize}
            textSize={32}
            uri={avatarUri}
          />
        </View>

        <LinearGradient
          colors={[accentColor, accentDeepColor]}
          end={{ x: 1, y: 1 }}
          start={{ x: 0, y: 0 }}
          style={{
            alignItems: "center",
            borderColor: "#FFFFFF",
            borderRadius: 999,
            borderWidth: 3,
            bottom: 2,
            height: 42,
            justifyContent: "center",
            position: "absolute",
            right: -2,
            width: 42,
          }}
        >
          <SymbolView
            name={{
              ios: "checkmark",
              android: "check",
              web: "check",
            }}
            size={20}
            tintColor="#FFFFFF"
          />
        </LinearGradient>
      </View>
    </View>
  );
}

export function SuccessOverlay({
  avatarFallbackLabel,
  avatarUri,
  description,
  note,
  onClose,
  onPrimaryAction,
  onSecondaryAction,
  primaryActionIconName = defaultPrimaryActionIcon,
  primaryActionLabel,
  rewardText,
  secondaryActionIconName = defaultSecondaryActionIcon,
  secondaryActionLabel,
  title,
}: {
  avatarFallbackLabel?: string;
  avatarUri?: string | null;
  description: string;
  note?: string | null;
  onClose: () => void;
  onPrimaryAction: () => void;
  onSecondaryAction?: () => void;
  primaryActionIconName?: SymbolName | null;
  primaryActionLabel: string;
  rewardText?: string | null;
  secondaryActionIconName?: SymbolName | null;
  secondaryActionLabel?: string | null;
  title: string;
}) {
  const insets = useSafeAreaInsets();
  const { width } = useWindowDimensions();
  const content = useSharedValue(0);
  const showSecondaryAction =
    Boolean(onSecondaryAction) && Boolean(secondaryActionLabel?.trim());

  useEffect(() => {
    content.set(
      withDelay(
        130,
        withTiming(1, {
          duration: 430,
          easing: Easing.out(Easing.cubic),
          reduceMotion: ReduceMotion.System,
        }),
      ),
    );

    return () => {
      cancelAnimation(content);
    };
  }, [content]);

  const animatedContentStyle = useAnimatedStyle(() => {
    const value = Math.min(Math.max(content.get(), 0), 1);

    return {
      transform: [{ translateY: 14 * (1 - value) }],
    };
  });

  return (
    <View className="absolute inset-0 bg-white">
      <LinearGradient
        colors={pageGradientColors}
        end={{ x: 0.5, y: 1 }}
        locations={[0, 0.55, 1]}
        start={{ x: 0.5, y: 0 }}
        pointerEvents="none"
        style={{
          height: 460,
          left: 0,
          position: "absolute",
          right: 0,
          top: 0,
        }}
      />

      <View
        pointerEvents="none"
        style={{
          height: confettiAreaHeight,
          left: 0,
          position: "absolute",
          right: 0,
          top: insets.top + 56,
        }}
      >
        {confettiPieces.map((piece, index) => (
          <ConfettiPiece
            key={`success-confetti-${index}`}
            index={index}
            piece={piece}
            width={width}
          />
        ))}
      </View>

      <View
        className="z-20 flex-row items-center justify-start px-5"
        style={{ paddingBottom: 4, paddingTop: insets.top + 14 }}
      >
        <Pressable
          accessibilityLabel="Đóng thông báo thành công"
          accessibilityRole="button"
          className="h-11 w-11 items-center justify-center rounded-full bg-white"
          hitSlop={12}
          onPress={onClose}
          style={({ pressed }) => ({
            borderColor: closeBorderColor,
            borderWidth: 1,
            elevation: 4,
            opacity: pressed ? 0.85 : 1,
            shadowColor: "rgba(228,80,143,0.18)",
            shadowOffset: { width: 0, height: 8 },
            shadowOpacity: 1,
            shadowRadius: 14,
          })}
        >
          <SymbolView
            name={{
              ios: "xmark",
              android: "close",
              web: "close",
            }}
            size={19}
            tintColor={bodyColor}
          />
        </Pressable>
      </View>

      <Animated.View
        style={[
          {
            alignItems: "center",
            flex: 1,
            justifyContent: "center",
            paddingHorizontal: 28,
          },
          animatedContentStyle,
        ]}
      >
        <SuccessHeroAvatar
          avatarFallbackLabel={avatarFallbackLabel}
          avatarUri={avatarUri}
        />

        <Text
          className="mt-2 text-center text-[25px] font-black"
          style={{ color: titleColor, lineHeight: lineHeightFor(25) }}
        >
          {title}
        </Text>

        <Text
          className="mt-1 text-center text-[14px]"
          style={{ color: bodyColor, lineHeight: lineHeightFor(14), maxWidth: 290 }}
        >
          {description}
        </Text>

        {rewardText ? (
          <Text
            className="mt-3 text-center text-[30px] font-black"
            style={{ color: "#F97316", lineHeight: lineHeightFor(30) }}
          >
            {rewardText}
          </Text>
        ) : null}

        {note ? (
          <View className="mt-1.5 flex-row items-center">
            <SymbolView
              name={{
                ios: "heart.fill",
                android: "favorite",
                web: "favorite",
              }}
              size={13}
              tintColor="#F7A8CB"
            />
            <Text
              className="ml-1.5 text-center text-[12px]"
              style={{ color: subtleTextColor, lineHeight: lineHeightFor(12) }}
            >
              {note}
            </Text>
          </View>
        ) : null}
      </Animated.View>

      <View
        className="px-7"
        style={{ paddingBottom: Math.max(insets.bottom + 10, 18) }}
      >
        <Pressable
          accessibilityRole="button"
          className="overflow-hidden rounded-[20px]"
          onPress={onPrimaryAction}
          style={({ pressed }) => ({
            elevation: 3,
            opacity: pressed ? 0.92 : 1,
            shadowColor: "rgba(240,98,166,0.16)",
            shadowOffset: { width: 0, height: 6 },
            shadowOpacity: 1,
            shadowRadius: 12,
          })}
        >
          <View
            style={{
              alignItems: "center",
              backgroundColor: primaryButtonColor,
              height: 50,
              justifyContent: "center",
            }}
          >
            <Text
              className="text-[16px] font-black text-white"
              style={{ lineHeight: lineHeightFor(16) }}
            >
              {primaryActionLabel}
            </Text>

            {primaryActionIconName ? (
              <View className="absolute bottom-0 right-4 top-0 justify-center">
                <SymbolView
                  name={primaryActionIconName}
                  size={19}
                  tintColor="#FFFFFF"
                />
              </View>
            ) : null}
          </View>
        </Pressable>

        {showSecondaryAction ? (
          <Pressable
            accessibilityRole="button"
            className="mt-2 flex-row items-center justify-center rounded-[20px] bg-white"
            onPress={onSecondaryAction}
            style={({ pressed }) => ({
              borderColor: secondaryBorderColor,
              borderWidth: 1,
              height: 48,
              opacity: pressed ? 0.88 : 1,
            })}
          >
            <Text
              className="text-[15px] font-black"
              style={{ color: titleColor, lineHeight: lineHeightFor(15) }}
            >
              {secondaryActionLabel}
            </Text>

            {secondaryActionIconName ? (
              <View className="absolute bottom-0 right-4 top-0 justify-center">
                <SymbolView
                  name={secondaryActionIconName}
                  size={19}
                  tintColor={titleColor}
                />
              </View>
            ) : null}
          </Pressable>
        ) : null}
      </View>
    </View>
  );
}
