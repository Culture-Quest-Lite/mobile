import { SymbolView } from "@/components/ui/symbol-view";
import {
  getCommunityPostVisibility,
  setCommunityPostVisibility,
} from "@/features/community/data/community-post-visibility-store";
import {
  getPostVisibilityDescription,
  getPostVisibilityIcon,
  getPostVisibilityLabel,
  postVisibilityOptions,
  type PostVisibilityValue,
} from "@/lib/post-visibility";
import { useRouter } from "expo-router";
import { StatusBar } from "expo-status-bar";
import { useState } from "react";
import { Pressable, Text, View } from "react-native";
import { SafeAreaView, useSafeAreaInsets } from "react-native-safe-area-context";

const footerShadowStyle = {
  elevation: 14,
  shadowColor: "rgba(24, 24, 27, 0.12)",
  shadowOffset: { width: 0, height: -6 },
  shadowOpacity: 1,
  shadowRadius: 16,
} as const;

function SelectionIndicator({ selected }: { selected: boolean }) {
  return (
    <View
      className="h-[22px] w-[22px] items-center justify-center rounded-full"
      style={{
        borderColor: selected ? "#2563EB" : "#D1D5DB",
        borderWidth: 2,
      }}
    >
      {selected ? (
        <View className="h-[10px] w-[10px] rounded-full bg-[#2563EB]" />
      ) : null}
    </View>
  );
}

function VisibilityOptionRow({
  isSelected,
  onPress,
  value,
}: {
  isSelected: boolean;
  onPress: () => void;
  value: PostVisibilityValue;
}) {
  return (
    <Pressable
      accessibilityRole="radio"
      accessibilityState={{ selected: isSelected }}
      className="flex-row items-center rounded-[16px] border px-3.5 py-3"
      onPress={onPress}
      style={{
        backgroundColor: isSelected ? "#EFF6FF" : "#FFFFFF",
        borderColor: isSelected ? "#BFDBFE" : "#E5E7EB",
      }}
    >
      <View className="h-10 w-10 items-center justify-center rounded-full bg-[#F8FAFC]">
        <SymbolView
          name={getPostVisibilityIcon(value)}
          size={18}
          tintColor={isSelected ? "#2563EB" : "#111827"}
        />
      </View>

      <View className="ml-3 flex-1">
        <Text
          className="text-[15px] font-semibold text-[#111827]"
          style={{ lineHeight: 18 }}
        >
          {getPostVisibilityLabel(value)}
        </Text>
        <Text className="mt-1 text-[13px] text-[#6B7280]" style={{ lineHeight: 18 }}>
          {getPostVisibilityDescription(value)}
        </Text>
      </View>

      <SelectionIndicator selected={isSelected} />
    </Pressable>
  );
}

export default function CommunityPostVisibilityScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const [selectedVisibility, setSelectedVisibility] = useState<PostVisibilityValue>(
    () => getCommunityPostVisibility(),
  );

  function handleSubmit() {
    setCommunityPostVisibility(selectedVisibility);
    router.back();
  }

  return (
    <View className="flex-1 bg-white">
      <StatusBar style="dark" />

      <SafeAreaView
        className="flex-1 bg-white"
        edges={["top", "left", "right"]}
      >
        <View className="border-b border-[#F2F4F7] px-4 py-2.5">
          <View className="flex-row items-center justify-between">
            <Pressable
              className="h-9 w-9 items-center justify-center rounded-full"
              hitSlop={8}
              onPress={() => {
                router.back();
              }}
            >
              <SymbolView
                name={{
                  ios: "chevron.left",
                  android: "arrow_back",
                  web: "arrow_back",
                }}
                size={18}
                tintColor="#111827"
              />
            </Pressable>

            <View className="h-9 w-9" />
          </View>
        </View>

        <View className="flex-1">
          <View className="px-5 pb-3 pt-4">
            <Text
              className="text-[22px] font-semibold text-[#2B2233]"
              style={{ lineHeight: 26 }}
            >
              Ai có thể xem bài viết của bạn?
            </Text>
            <Text
              className="mt-2 text-[15px] text-[#6F657A]"
              style={{ lineHeight: 19 }}
            >
              Chọn đối tượng có thể xem bài viết bạn đang soạn trên cộng đồng.
            </Text>
          </View>

          <View className="gap-2.5 px-4">
            {postVisibilityOptions.map((option) => (
              <VisibilityOptionRow
                key={option}
                isSelected={selectedVisibility === option}
                onPress={() => {
                  setSelectedVisibility(option);
                }}
                value={option}
              />
            ))}
          </View>
        </View>

        <View
          className="border-t border-[#F2F4F7] bg-white px-4 pt-3"
          style={[
            footerShadowStyle,
            {
              paddingBottom: Math.max(insets.bottom + 10, 16),
            },
          ]}
        >
          <Text className="mb-3 text-[12px] font-medium text-[#9CA3AF]">
            Thiết lập này áp dụng cho bài viết bạn đang soạn.
          </Text>

          <Pressable
            className="h-11 items-center justify-center rounded-[12px] bg-[#2563EB]"
            onPress={handleSubmit}
          >
            <Text className="text-[15px] font-black text-white">Xong</Text>
          </Pressable>
        </View>
      </SafeAreaView>
    </View>
  );
}
