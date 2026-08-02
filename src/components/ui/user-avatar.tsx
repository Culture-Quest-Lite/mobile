import { Image } from "expo-image";
import { LinearGradient } from "expo-linear-gradient";
import { useState } from "react";
import {
  Text,
  View,
  type ImageStyle,
  type StyleProp,
  type TextStyle,
  type ViewStyle,
} from "react-native";

export const defaultUserAvatarGradientColors = ["#EB489B", "#F58752"] as const;

function readMeaningfulText(value?: string | null) {
  if (typeof value !== "string") {
    return null;
  }

  const trimmedValue = value.trim();
  return trimmedValue ? trimmedValue : null;
}

export function resolveUserAvatarLabel(
  displayName?: string | null,
  username?: string | null,
) {
  return (
    readMeaningfulText(displayName) ??
    readMeaningfulText(username)?.replace(/^@/, "") ??
    "Culture Quest"
  );
}

export function resolveUserAvatarInitials(
  displayName?: string | null,
  username?: string | null,
) {
  const resolvedLabel = resolveUserAvatarLabel(displayName, username);
  const tokens = resolvedLabel.split(/\s+/).filter(Boolean);

  if (tokens.length === 0) {
    return "CQ";
  }

  if (tokens.length === 1) {
    return tokens[0].slice(0, 2).toUpperCase();
  }

  return `${tokens[0]?.[0] ?? ""}${tokens.at(-1)?.[0] ?? ""}`.toUpperCase();
}

type SharedAvatarProps = {
  borderColor?: string;
  borderWidth?: number;
  colors?: readonly [string, string];
  containerStyle?: StyleProp<ViewStyle>;
  displayName?: string | null;
  imageStyle?: StyleProp<ImageStyle>;
  size: number;
  textSize?: number;
  textStyle?: StyleProp<TextStyle>;
  username?: string | null;
};

export function UserAvatarFallback({
  borderColor = "transparent",
  borderWidth = 0,
  colors = defaultUserAvatarGradientColors,
  containerStyle,
  displayName,
  size,
  textSize,
  textStyle,
  username,
}: SharedAvatarProps) {
  const resolvedTextSize = textSize ?? Math.max(14, size * 0.34);

  return (
    <View
      className="overflow-hidden bg-white"
      style={[
        {
          borderColor,
          borderRadius: size / 2,
          borderWidth,
          height: size,
          width: size,
        },
        containerStyle,
      ]}
    >
      <LinearGradient
        colors={colors}
        end={{ x: 1, y: 0.5 }}
        start={{ x: 0, y: 0.5 }}
        style={{
          alignItems: "center",
          borderRadius: size / 2,
          height: "100%",
          justifyContent: "center",
          width: "100%",
        }}
      >
        <Text
          className="font-black text-white"
          style={[
            {
              fontSize: resolvedTextSize,
              lineHeight: Math.round(resolvedTextSize * 1.08),
            },
            textStyle,
          ]}
        >
          {resolveUserAvatarInitials(displayName, username)}
        </Text>
      </LinearGradient>
    </View>
  );
}

export function UserAvatar({
  borderColor = "transparent",
  borderWidth = 0,
  colors = defaultUserAvatarGradientColors,
  containerStyle,
  displayName,
  imageStyle,
  size,
  textSize,
  textStyle,
  uri,
  username,
}: SharedAvatarProps & {
  uri?: string | null;
}) {
  const normalizedUri = readMeaningfulText(uri);
  const [failedUri, setFailedUri] = useState<string | null>(null);
  const shouldShowFallback = !normalizedUri || failedUri === normalizedUri;

  if (shouldShowFallback) {
    return (
      <UserAvatarFallback
        borderColor={borderColor}
        borderWidth={borderWidth}
        colors={colors}
        containerStyle={containerStyle}
        displayName={displayName}
        size={size}
        textSize={textSize}
        textStyle={textStyle}
        username={username}
      />
    );
  }

  return (
    <View
      className="overflow-hidden bg-white"
      style={[
        {
          borderColor,
          borderRadius: size / 2,
          borderWidth,
          height: size,
          width: size,
        },
        containerStyle,
      ]}
    >
      <Image
        cachePolicy="memory-disk"
        contentFit="cover"
        onError={() => {
          setFailedUri(normalizedUri);
        }}
        source={{ uri: normalizedUri }}
        style={[
          {
            borderRadius: Math.max(0, size / 2 - borderWidth),
            height: "100%",
            width: "100%",
          },
          imageStyle,
        ]}
        transition={180}
      />
    </View>
  );
}
