import { Text, View, type StyleProp, type ViewStyle } from "react-native";

import { SymbolView } from "@/components/ui/symbol-view";
import { bodyLineHeightFor } from "@/lib/text-scale";

/**
 * Bảng màu dùng chung cho trạng thái lỗi của form.
 *
 * Vì sao cần: các màn tạo bài viết / tạo nhóm / viết đánh giá trước đây báo lỗi
 * bằng `Alert.alert`, tức là chặn thao tác và không chỉ ra ô nào sai. Trên mobile
 * người dùng cần thấy lỗi ngay dưới ô nhập, kèm viền đỏ, để sửa mà không mất
 * ngữ cảnh bàn phím.
 */
export const fieldErrorColor = "#D84C3E";
export const fieldErrorBorderColor = "#F0A79D";
export const fieldErrorSurfaceColor = "#FFF6F5";
export const fieldWarningColor = "#DD8C1C";

export function FieldError({
  message,
  style,
}: {
  message: string | null;
  style?: StyleProp<ViewStyle>;
}) {
  if (!message) {
    return null;
  }

  return (
    <View
      accessibilityLiveRegion="polite"
      accessibilityRole="alert"
      className="mt-1.5 flex-row items-start"
      style={style}
    >
      <View style={{ marginTop: 1 }}>
        <SymbolView
          name={{
            ios: "exclamationmark.circle.fill",
            android: "error",
            web: "error",
          }}
          size={13}
          tintColor={fieldErrorColor}
        />
      </View>

      <Text
        className="ml-1.5 flex-1 text-[12px] font-normal"
        style={{
          color: fieldErrorColor,
          includeFontPadding: false,
          lineHeight: bodyLineHeightFor(12),
        }}
      >
        {message}
      </Text>
    </View>
  );
}
