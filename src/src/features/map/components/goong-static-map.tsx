import { Image } from "expo-image";
import { LinearGradient } from "expo-linear-gradient";
import { SymbolView } from "expo-symbols";
import { useMemo } from "react";
import { Pressable, Text, View } from "react-native";

import { PublicEnv } from "@/constants/env";

type MapPoint = {
  id: string | number;
  title?: string;
  latitude?: number | null;
  longitude?: number | null;
};

type GoongStaticMapProps = {
  height?: number;
  points: MapPoint[];
  title?: string;
  subtitle?: string;
  onPress?: () => void;
};

const fallbackGradient = ["#DCEBFF", "#F6E9FF", "#FFF5E8"] as const;

function isValidCoordinate(point: MapPoint) {
  return (
    typeof point.latitude === "number" &&
    Number.isFinite(point.latitude) &&
    typeof point.longitude === "number" &&
    Number.isFinite(point.longitude)
  );
}

function buildGoongStaticRouteUrl(points: MapPoint[]) {
  const apiKey = PublicEnv.goongApiKey;
  const validPoints = points.filter(isValidCoordinate);

  if (!apiKey || validPoints.length < 2) return null;

  const origin = `${validPoints[0].latitude},${validPoints[0].longitude}`;
  const destination = `${validPoints[validPoints.length - 1].latitude},${validPoints[validPoints.length - 1].longitude}`;
  const params = new URLSearchParams({
    api_key: apiKey,
    color: "#EB489B",
    destination,
    height: "420",
    origin,
    type: "fastest",
    vehicle: "bike",
    width: "720",
  });

  return `https://rsapi.goong.io/staticmap/route?${params.toString()}`;
}

export function GoongStaticMap({
  height = 230,
  onPress,
  points,
  subtitle,
  title = "Bản đồ Goong",
}: GoongStaticMapProps) {
  const validPoints = useMemo(() => points.filter(isValidCoordinate), [points]);
  const mapUrl = useMemo(() => buildGoongStaticRouteUrl(points), [points]);
  const Wrapper = onPress ? Pressable : View;

  return (
    <Wrapper
      onPress={onPress}
      className="overflow-hidden rounded-[28px] bg-[#E8F0FE]"
      style={{ height }}
    >
      {mapUrl ? (
        <Image source={mapUrl} contentFit="cover" style={{ height: "100%", width: "100%" }} />
      ) : (
        <LinearGradient
          colors={fallbackGradient}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 1 }}
          className="absolute inset-0"
        />
      )}

      {!mapUrl ? (
        <>
          <View className="absolute left-8 right-10 top-20 h-1 rotate-[-10deg] rounded-full bg-[#4A80F5]/30" />
          <View className="absolute left-20 right-8 top-32 h-1 rotate-[15deg] rounded-full bg-[#EB489B]/25" />
          <View className="absolute bottom-16 left-10 right-20 h-1 rotate-[-18deg] rounded-full bg-[#F58752]/25" />
        </>
      ) : null}

      {validPoints.slice(0, 8).map((point, index) => {
        const left = `${14 + ((index * 31) % 66)}%`;
        const top = `${20 + ((index * 19) % 54)}%`;

        return (
          <View key={`${point.id}-${index}`} className="absolute items-center" style={{ left, top }}>
            <View className="h-8 w-8 items-center justify-center rounded-full border-2 border-white bg-[#EB489B] shadow">
              <Text className="text-[11px] font-extrabold text-white">{index + 1}</Text>
            </View>
            {index < 2 && point.title ? (
              <View className="mt-1 max-w-[110px] rounded-full bg-white/95 px-2 py-1 shadow">
                <Text className="text-[10px] font-bold text-[#2B2233]" numberOfLines={1}>
                  {point.title}
                </Text>
              </View>
            ) : null}
          </View>
        );
      })}

      <View className="absolute left-3 top-3 rounded-full bg-white/95 px-3 py-1.5 shadow">
        <Text className="text-[12px] font-bold text-[#2B2233]">{title}</Text>
        {subtitle ? <Text className="text-[10px] text-[#8A7D6D]">{subtitle}</Text> : null}
      </View>

      <View className="absolute bottom-3 right-3 h-10 w-10 items-center justify-center rounded-full bg-white shadow">
        <SymbolView
          name={{ ios: "location.fill", android: "my_location", web: "my_location" }}
          size={18}
          tintColor="#4A80F5"
        />
      </View>
    </Wrapper>
  );
}
