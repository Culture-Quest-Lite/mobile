import { SymbolView } from "@/components/ui/symbol-view";
import { Image } from "expo-image";
import { LinearGradient } from "expo-linear-gradient";
import { type ComponentProps } from "react";
import { Pressable, Text, View } from "react-native";

type SymbolName = ComponentProps<typeof SymbolView>["name"];

const hiddenStoryUnlockedImage = require("../../../../assets/images/review_post.png");

export const hiddenStoryActionGradientColors = [
  "#F19AC5",
  "#F4AA7F",
  "#F6D16D",
] as const;
export const hiddenStoryActionForegroundColor = "#7F2E55";

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
  shadowColor: "rgba(215, 74, 143, 0.2)",
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
  onListenStories,
}: {
  audioStoryDurationLabel: string;
  onListenStories: () => void;
}) {
  return (
    <LinearGradient
      colors={["#FFF5FA", "#FFF9F2"]}
      start={{ x: 0, y: 0 }}
      end={{ x: 1, y: 1 }}
      className="items-center rounded-[20px] px-5 py-4"
      style={cardShadowStyle}
    >
      <View
        className="w-[224px] overflow-hidden rounded-[14px] bg-[#FFF4F8]"
        style={{ aspectRatio: 14 / 11, maxWidth: "100%" }}
      >
        <Image
          source={hiddenStoryUnlockedImage}
          contentFit="cover"
          contentPosition="center"
          style={{ height: "100%", width: "100%" }}
        />
      </View>

      <Text className="mt-1 text-center text-[17px] font-black text-[#3B2A32]">
        Câu chuyện đã mở khóa
      </Text>

      <Text
        className="mt-0.5 max-w-[320px] text-center text-[13px] text-[#6A5964]"
        style={{ lineHeight: 16 }}
      >
        {`Bạn đã check-in tại địa điểm này. Câu chuyện địa điểm và nội dung độc quyền đã sẵn sàng chờ bạn khám phá.`}
      </Text>

      <Pressable
        className="mt-3 w-full overflow-hidden rounded-full"
        onPress={onListenStories}
        style={buttonShadowStyle}
      >
        <LinearGradient
          colors={hiddenStoryActionGradientColors}
          end={{ x: 1, y: 0.5 }}
          locations={[0, 0.58, 1]}
          start={{ x: 0, y: 0.5 }}
          className="flex-row items-center justify-center px-5 py-3"
        >
          <SymbolView
            name={
              {
                ios: "speaker.wave.2.fill",
                android: "volume_up",
                web: "volume_up",
              } as SymbolName
            }
            size={15}
            tintColor={hiddenStoryActionForegroundColor}
          />
          <Text
            className="ml-2 text-[13px] font-black"
            style={{ color: hiddenStoryActionForegroundColor }}
          >
            Xem câu chuyện
          </Text>
        </LinearGradient>
      </Pressable>
    </LinearGradient>
  );
}
