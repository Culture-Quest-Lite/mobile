import { Image } from "expo-image";
import { LinearGradient } from "expo-linear-gradient";
import { useEffect, useState } from "react";
import { Text, View, type ImageSourcePropType } from "react-native";
import Animated, {
  Easing,
  ReduceMotion,
  useAnimatedStyle,
  useSharedValue,
  withTiming,
} from "react-native-reanimated";

export type LevelProgressCardProps = {
  currentXp: number;
  hasExactProgress: boolean;
  markerSource?: ImageSourcePropType | null;
  nextLevelRequiredXp?: number | null;
  progressPercent?: number | null;
};

function clampNumber(value: number, minimum: number, maximum: number) {
  return Math.min(Math.max(value, minimum), maximum);
}

function formatNumber(value: number) {
  return new Intl.NumberFormat("vi-VN").format(Math.max(0, Math.round(value)));
}

function AnimatedLevelProgressTrack({
  markerSource,
  progress,
}: {
  markerSource?: ImageSourcePropType | null;
  progress: number;
}) {
  const [trackWidth, setTrackWidth] = useState(0);
  const animatedProgress = useSharedValue(0);
  const markerSize = 38;
  const markerTrackOverlap = 10;
  const markerLeft =
    trackWidth > 0
      ? clampNumber(
          trackWidth * progress - markerSize / 2,
          0,
          Math.max(trackWidth - markerSize, 0),
        )
      : 0;

  useEffect(() => {
    if (trackWidth <= 0) {
      return;
    }

    animatedProgress.set(
      withTiming(progress, {
        duration: 850,
        easing: Easing.out(Easing.cubic),
        reduceMotion: ReduceMotion.System,
      }),
    );
  }, [animatedProgress, progress, trackWidth]);

  const fillStyle = useAnimatedStyle(() => ({
    width: trackWidth * animatedProgress.get(),
  }));

  return (
    <View
      className="mt-[-2px]"
      style={{
        paddingTop: markerSource ? markerSize - markerTrackOverlap : 0,
      }}
    >
      {markerSource ? (
        <View
          pointerEvents="none"
          style={{
            left: markerLeft,
            position: "absolute",
            top: 0,
          }}
        >
          <Image
            source={markerSource}
            contentFit="contain"
            transition={180}
            style={{ height: markerSize, width: markerSize }}
          />
        </View>
      ) : null}

      <View
        className="overflow-hidden rounded-full bg-[#F4EAF0]"
        onLayout={(event) => {
          const nextWidth = event.nativeEvent.layout.width;

          if (Math.abs(nextWidth - trackWidth) > 1) {
            setTrackWidth(nextWidth);
          }
        }}
        style={{ height: 8 }}
      >
        <Animated.View
          className="absolute bottom-0 left-0 top-0 overflow-hidden rounded-full"
          style={fillStyle}
        >
          <LinearGradient
            colors={["#FFD34D", "#F58752", "#EB489B"]}
            locations={[0, 0.52, 1]}
            start={{ x: 0, y: 0.5 }}
            end={{ x: 1, y: 0.5 }}
            style={{ height: "100%", width: "100%" }}
          />
        </Animated.View>
      </View>
    </View>
  );
}

export function LevelProgressCard({
  currentXp,
  hasExactProgress,
  markerSource,
  nextLevelRequiredXp,
  progressPercent,
}: LevelProgressCardProps) {
  const normalizedCurrentXp = Math.max(0, Math.round(currentXp));
  const normalizedProgress = hasExactProgress
    ? clampNumber((progressPercent ?? 0) / 100, 0, 1)
    : 0;
  const xpSummary =
    hasExactProgress && typeof nextLevelRequiredXp === "number"
      ? `${formatNumber(normalizedCurrentXp)} / ${formatNumber(nextLevelRequiredXp)} XP`
      : `${formatNumber(normalizedCurrentXp)} XP hiện tại`;

  return (
    <View className="mt-0">
      <AnimatedLevelProgressTrack
        markerSource={markerSource}
        progress={normalizedProgress}
      />
      <Text className="mt-1 text-[11px] text-[#8E869A]">{xpSummary}</Text>
    </View>
  );
}
