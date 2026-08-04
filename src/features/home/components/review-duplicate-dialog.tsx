import { SymbolView } from "@/components/ui/symbol-view";
import { Image } from "expo-image";
import { LinearGradient } from "expo-linear-gradient";
import { type ComponentProps } from "react";
import { Pressable, Text as RNText, View } from "react-native";

type TextProps = ComponentProps<typeof RNText>;

const duplicateReviewImage = require("../../../../assets/images/not_review.png");
const dialogTextMaxFontSizeMultiplier = 1.05;
const backdropColor = "rgba(43, 32, 38, 0.42)";
const titleColor = "#1B1B1F";
const bodyColor = "#6B7280";
const accentColor = "#EA4E7C";
const noteBackgroundColor = "#FFF3F7";
const noteBorderColor = "#FBD3E5";
const buttonGradientColors = ["#FB8FA5", "#F2647F", "#EB4F76"] as const;
// Ảnh có nhiều vùng trong suốt quanh bong bóng nên bù lại bằng margin âm.
const illustrationWidth = 234;
const illustrationHeight = 156;
const illustrationTopTrim = -20;
const illustrationBottomTrim = -32;

function Text({
  maxFontSizeMultiplier = dialogTextMaxFontSizeMultiplier,
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

function DuplicateReviewIllustration() {
  return (
    <Image
      source={duplicateReviewImage}
      contentFit="contain"
      transition={140}
      style={{
        height: illustrationHeight,
        marginBottom: illustrationBottomTrim,
        marginTop: illustrationTopTrim,
        width: illustrationWidth,
      }}
    />
  );
}

export function ReviewDuplicateDialog({
  onClose,
  onEditReview,
}: {
  onClose: () => void;
  onEditReview: () => void;
}) {
  return (
    <View className="absolute inset-0 items-center justify-center px-6">
      <Pressable
        accessibilityLabel="Đóng thông báo"
        accessibilityRole="button"
        className="absolute inset-0"
        onPress={onClose}
        style={{ backgroundColor: backdropColor }}
      />

      <View
        className="w-full items-center rounded-[24px] bg-white px-5 pb-2 pt-4"
        style={{
          elevation: 12,
          maxWidth: 330,
          shadowColor: "rgba(43, 32, 38, 0.24)",
          shadowOffset: { width: 0, height: 16 },
          shadowOpacity: 1,
          shadowRadius: 28,
        }}
      >
        <DuplicateReviewIllustration />

        <Text
          className="text-center text-[19px] font-black"
          style={{ color: titleColor, lineHeight: 23 }}
        >
          Không thể đăng bài
        </Text>

        <Text
          className="mt-0.5 text-center text-[13px]"
          style={{ color: bodyColor, lineHeight: 17 }}
        >
          Bạn đã đánh giá địa điểm này trước đó. Vui lòng chỉnh sửa bài đánh giá
          cũ thay vì tạo bài đăng mới.
        </Text>

        <View
          className="mt-1.5 w-full flex-row items-start rounded-[14px] border px-3 py-1.5"
          style={{
            backgroundColor: noteBackgroundColor,
            borderColor: noteBorderColor,
          }}
        >
          <SymbolView
            name={{
              ios: "info.circle",
              android: "info_outline",
              web: "info_outline",
            }}
            size={15}
            tintColor={accentColor}
          />
          <Text
            className="ml-2 flex-1 text-[12px]"
            style={{ color: bodyColor, lineHeight: 14 }}
          >
            Điều này giúp giữ cho thông tin trên hệ thống luôn chính xác và nhất
            quán.
          </Text>
        </View>

        <Pressable
          accessibilityRole="button"
          className="mt-4 w-full overflow-hidden rounded-full"
          onPress={onEditReview}
          style={({ pressed }) => ({
            elevation: 6,
            opacity: pressed ? 0.92 : 1,
            shadowColor: "rgba(235, 79, 118, 0.38)",
            shadowOffset: { width: 0, height: 10 },
            shadowOpacity: 1,
            shadowRadius: 18,
          })}
        >
          <LinearGradient
            colors={buttonGradientColors}
            end={{ x: 1, y: 0.5 }}
            start={{ x: 0, y: 0.5 }}
            style={{
              alignItems: "center",
              flexDirection: "row",
              height: 46,
              justifyContent: "center",
            }}
          >
            <SymbolView
              name={{
                ios: "pencil",
                android: "edit",
                web: "edit",
              }}
              size={17}
              tintColor="#FFFFFF"
            />
            <Text
              className="ml-2 text-[15px] font-black text-white"
              style={{ lineHeight: 19 }}
            >
              Chỉnh sửa đánh giá
            </Text>
          </LinearGradient>
        </Pressable>

        <Pressable
          accessibilityRole="button"
          className="w-full items-center py-2"
          hitSlop={6}
          onPress={onClose}
          style={({ pressed }) => ({ opacity: pressed ? 0.7 : 1 })}
        >
          <Text
            className="text-[14px] font-bold"
            style={{ color: accentColor, lineHeight: 18 }}
          >
            Đóng
          </Text>
        </Pressable>
      </View>
    </View>
  );
}
