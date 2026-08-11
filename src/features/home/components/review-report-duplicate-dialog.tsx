import { SymbolView } from "@/components/ui/symbol-view";
import { Image } from "expo-image";
import { LinearGradient } from "expo-linear-gradient";
import { type ComponentProps } from "react";
import { Modal, Pressable, Text as RNText, View } from "react-native";

import { bodyLineHeightFor, lineHeightFor } from "@/lib/text-scale";

type TextProps = ComponentProps<typeof RNText>;

const duplicateReviewImage = require("../../../../assets/images/not_review.png");
const textMaxFontSizeMultiplier = 1.05;
const bodyColor = "#6B7280";
const successGradient = ["#F7BDD7", "#F09EC3", "#E786B1"] as const;

function Text({
  maxFontSizeMultiplier = textMaxFontSizeMultiplier,
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

export function ReviewReportDuplicateDialog({
  onClose,
  visible,
}: {
  onClose: () => void;
  visible: boolean;
}) {
  return (
    <Modal
      animationType="fade"
      onRequestClose={onClose}
      statusBarTranslucent
      transparent
      visible={visible}
    >
      <View className="flex-1 items-center justify-center px-5 py-6">
        <Pressable
          accessibilityLabel="Đóng thông báo"
          className="absolute inset-0 bg-black/50"
          onPress={onClose}
        />

        <View
          className="w-full overflow-hidden bg-white"
          style={{
            borderRadius: 12,
            elevation: 16,
            maxWidth: 310,
            shadowColor: "rgba(43, 32, 38, 0.30)",
            shadowOffset: { width: 0, height: 18 },
            shadowOpacity: 1,
            shadowRadius: 30,
          }}
        >
          <Image
            source={duplicateReviewImage}
            contentFit="contain"
            transition={140}
            style={{ height: 130, width: "100%" }}
          />

          <View className="px-4 pb-4 pt-3">
            <Text
              className="text-center text-[17px] font-normal text-[#241D22]"
              style={{ lineHeight: lineHeightFor(17) }}
            >
              Đánh giá này đã được báo cáo trước đó
            </Text>

            <Text
              className="mt-1 text-center text-[12px]"
              style={{ color: bodyColor, lineHeight: bodyLineHeightFor(12) }}
            >
              Bạn đã gửi báo cáo cho bài đánh giá này rồi. Hệ thống đã ghi nhận
              và sẽ chuyển tới đội ngũ kiểm duyệt để xem xét.
            </Text>

            <Pressable
              accessibilityRole="button"
              className="mt-3 overflow-hidden rounded-[8px]"
              onPress={onClose}
              style={({ pressed }) => ({
                elevation: 5,
                opacity: pressed ? 0.9 : 1,
                shadowColor: "rgba(216, 62, 104, 0.24)",
                shadowOffset: { width: 0, height: 8 },
                shadowOpacity: 1,
                shadowRadius: 14,
              })}
            >
              <LinearGradient
                colors={successGradient}
                end={{ x: 1, y: 0.5 }}
                start={{ x: 0, y: 0.5 }}
                style={{
                  alignItems: "center",
                  flexDirection: "row",
                  height: 42,
                  justifyContent: "center",
                }}
              >
                <SymbolView
                  name={{
                    ios: "checkmark.circle.fill",
                    android: "check_circle",
                    web: "check_circle",
                  }}
                  size={16}
                  tintColor="#FFFFFF"
                />
                <Text className="ml-1.5 text-[13px] font-normal text-white">
                  Đã hiểu
                </Text>
              </LinearGradient>
            </Pressable>
          </View>
        </View>
      </View>
    </Modal>
  );
}
