import { SymbolView } from "@/components/ui/symbol-view";
import { Image } from "expo-image";
import { LinearGradient } from "expo-linear-gradient";
import { type ComponentProps } from "react";
import {
  ActivityIndicator,
  Modal,
  Pressable,
  Text as RNText,
  View,
} from "react-native";
import { bodyLineHeightFor, lineHeightFor } from "@/lib/text-scale";

type TextProps = ComponentProps<typeof RNText>;
type SymbolName = ComponentProps<typeof SymbolView>["name"];

const deleteReviewImage = require("../../../../assets/images/delete1.png");
const textMaxFontSizeMultiplier = 1.05;
const bodyColor = "#6B7280";
const destructiveGradient = ["#F06B8E", "#E84F79", "#D83E68"] as const;
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

export function ReviewDeleteDialog({
  borderlessButtons = false,
  confirmIcon = {
    ios: "trash",
    android: "delete_outline",
    web: "delete_outline",
  },
  confirmLabel = "Xóa bài",
  description = "Bài đánh giá và toàn bộ ảnh, video đính kèm sẽ bị xóa khỏi Culture Quest Lite.",
  isDeleting,
  onCancel,
  onConfirm,
  title = "Xóa bài đánh giá?",
  visible,
}: {
  borderlessButtons?: boolean;
  confirmIcon?: SymbolName;
  confirmLabel?: string;
  description?: string;
  isDeleting: boolean;
  onCancel: () => void;
  onConfirm: () => void;
  title?: string;
  visible: boolean;
}) {
  const handleClose = () => {
    if (!isDeleting) {
      onCancel();
    }
  };

  return (
    <Modal
      animationType="fade"
      onRequestClose={handleClose}
      statusBarTranslucent
      transparent
      visible={visible}
    >
      <View className="flex-1 items-center justify-center px-5 py-6">
        <Pressable
          accessibilityLabel="Đóng xác nhận xóa"
          className="absolute inset-0 bg-black/50"
          disabled={isDeleting}
          onPress={handleClose}
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
            source={deleteReviewImage}
            contentFit="cover"
            transition={140}
            style={{ height: 130, width: "100%" }}
          />

          <View className="px-4 pb-4 pt-3">
            <Text
              className="text-center text-[17px] font-normal text-[#241D22]"
              style={{ lineHeight: lineHeightFor(17) }}
            >
              {title}
            </Text>

            <Text
              className="mt-1 text-center text-[12px]"
              style={{ color: bodyColor, lineHeight: lineHeightFor(12) }}
            >
              {description}
            </Text>

            <View className="mt-3 flex-row gap-2">
              <Pressable
                accessibilityRole="button"
                className="h-[42px] flex-1 items-center justify-center rounded-[8px]"
                disabled={isDeleting}
                onPress={handleClose}
                style={({ pressed }) => ({
                  backgroundColor: borderlessButtons ? "#D1D5DB" : "#F1F0F4",
                  borderColor: "#DDD7DC",
                  borderWidth: borderlessButtons ? 0 : 1,
                  opacity: isDeleting ? 0.55 : pressed ? 0.78 : 1,
                })}
              >
                <Text className="text-[13px] font-normal text-[#4F454C]">
                  Hủy
                </Text>
              </Pressable>

              <Pressable
                accessibilityRole="button"
                accessibilityState={{ busy: isDeleting }}
                className="flex-1 overflow-hidden rounded-[8px]"
                disabled={isDeleting}
                onPress={onConfirm}
                style={({ pressed }) => ({
                  elevation: borderlessButtons ? 0 : 5,
                  opacity: pressed ? 0.9 : 1,
                  shadowColor: borderlessButtons
                    ? "transparent"
                    : "rgba(216, 62, 104, 0.34)",
                  shadowOffset: { width: 0, height: 8 },
                  shadowOpacity: borderlessButtons ? 0 : 1,
                  shadowRadius: borderlessButtons ? 0 : 14,
                })}
              >
                <LinearGradient
                  colors={destructiveGradient}
                  end={{ x: 1, y: 0.5 }}
                  start={{ x: 0, y: 0.5 }}
                  style={{
                    alignItems: "center",
                    flexDirection: "row",
                    height: 42,
                    justifyContent: "center",
                  }}
                >
                  {isDeleting ? (
                    <ActivityIndicator color="#FFFFFF" size="small" />
                  ) : (
                    <>
                      <SymbolView
                        name={confirmIcon}
                        size={15}
                        tintColor="#FFFFFF"
                      />
                      <Text className="ml-1.5 text-[13px] font-bold text-white">
                        {confirmLabel}
                      </Text>
                    </>
                  )}
                </LinearGradient>
              </Pressable>
            </View>
          </View>
        </View>
      </View>
    </Modal>
  );
}

export function DeleteSuccessDialog({
  buttonLabel = "Đóng",
  description = "Nội dung đã được chuyển thành công.",
  onClose,
  title = "Thành công",
  visible,
}: {
  buttonLabel?: string;
  description?: string;
  onClose: () => void;
  title?: string;
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
          accessibilityLabel="Đóng thông báo thành công"
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
            source={deleteReviewImage}
            contentFit="cover"
            transition={140}
            style={{ height: 130, width: "100%" }}
          />

          <View className="px-4 pb-4 pt-3">
            <Text
              className="text-center text-[17px] font-normal text-[#241D22]"
              style={{ lineHeight: lineHeightFor(17) }}
            >
              {title}
            </Text>

            <Text
              className="mt-1 text-center text-[12px]"
              style={{ color: bodyColor, lineHeight: bodyLineHeightFor(12) }}
            >
              {description}
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
                  {buttonLabel}
                </Text>
              </LinearGradient>
            </Pressable>
          </View>
        </View>
      </View>
    </Modal>
  );
}
