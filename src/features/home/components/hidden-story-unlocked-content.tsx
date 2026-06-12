import { LinearGradient } from "expo-linear-gradient";
import { SymbolView } from "expo-symbols";
import { type ComponentProps } from "react";
import { Text, View } from "react-native";

type SymbolName = ComponentProps<typeof SymbolView>["name"];

const cardShadowStyle = {
  shadowColor: "rgba(235, 72, 155, 0.08)",
  shadowOpacity: 1,
  shadowRadius: 14,
  shadowOffset: {
    width: 0,
    height: 10,
  },
  elevation: 4,
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

export function HiddenStoryUnlockedContent({
  audioStoryDurationLabel,
}: {
  audioStoryDurationLabel: string;
}) {
  return (
    <LinearGradient
      colors={["#FFF3F7", "#FFF7EE"]}
      start={{ x: 0, y: 0 }}
      end={{ x: 1, y: 1 }}
      className="items-center rounded-[30px] px-5 py-8"
      style={cardShadowStyle}
    >
      <LinearGradient
        colors={["#34D399", "#16A34A"]}
        end={{ x: 1, y: 1 }}
        start={{ x: 0, y: 0 }}
        className="h-16 w-16 items-center justify-center rounded-full"
      >
        <SymbolView
          name={
            {
              ios: "checkmark",
              android: "check",
              web: "check",
            } as SymbolName
          }
          size={22}
          tintColor="#FFFFFF"
        />
      </LinearGradient>

      <Text className="mt-5 text-center text-[20px] font-black text-[#3B2A32]">
        Câu chuyện đã mở khóa
      </Text>

      <Text className="mt-3 max-w-[320px] text-center text-[14px] leading-6 text-[#6A5964]">
        {`Bạn đã check-in tại hotspot này. Audio story ${audioStoryDurationLabel} và bạn kể chuyện độc quyền đã sẵn sàng.`}
      </Text>

      <View className="mt-6 overflow-hidden rounded-full" style={buttonShadowStyle}>
        <LinearGradient
          colors={["#34D399", "#16A34A"]}
          end={{ x: 1, y: 0.5 }}
          locations={[0, 1]}
          start={{ x: 0, y: 0.5 }}
          className="flex-row items-center px-5 py-3.5"
          style={{ opacity: 0.9 }}
        >
          <SymbolView
            name={
              {
                ios: "checkmark.circle.fill",
                android: "check_circle",
                web: "check_circle",
              } as SymbolName
            }
            size={15}
            tintColor="#FFFFFF"
          />
          <Text className="ml-2 text-[15px] font-black text-white">
            Đã check-in
          </Text>
        </LinearGradient>
      </View>
    </LinearGradient>
  );
}
