import { LinearGradient } from "expo-linear-gradient";
import { useEffect, useState, type ComponentProps } from "react";
import {
  Modal,
  Pressable,
  Text as RNText,
  View,
  type AlertButton,
} from "react-native";

import { SymbolView, type SymbolName } from "@/components/ui/symbol-view";
import { bodyLineHeightFor, lineHeightFor } from "@/lib/text-scale";

/**
 * Popup dùng chung cho toàn app.
 *
 * Vì sao cần: trước đây mỗi màn tự gọi `Alert.alert` của React Native, nên trên
 * Android người dùng thấy hộp thoại Material xám xịt của hệ điều hành, còn vài
 * màn khác lại có popup riêng theo brand. Cùng một hành động (xóa bài, rời nhóm)
 * lại hiện hai kiểu popup khác nhau tùy màn. `appAlert` giữ nguyên chữ ký của
 * `Alert.alert` để mọi nơi gọi được, nhưng render bằng modal của app.
 */

export type AppDialogTone = "danger" | "info" | "success" | "warning";

export type AppDialogOptions = {
  /** Cho phép chạm nền / nút back để đóng. Mặc định `true`. */
  cancelable?: boolean;
  /** Icon tùy chọn, mặc định suy ra từ `tone`. */
  icon?: SymbolName;
  /** Gọi khi popup bị đóng mà không bấm nút nào. */
  onDismiss?: () => void;
  /** Màu sắc / icon theo ngữ cảnh. Mặc định suy ra từ tiêu đề và nhóm nút. */
  tone?: AppDialogTone;
};

type DialogRequest = {
  buttons?: AlertButton[];
  id: number;
  message?: string;
  options?: AppDialogOptions;
  title: string;
};

type Listener = (request: DialogRequest) => void;

type TextProps = ComponentProps<typeof RNText>;

let activeListener: Listener | null = null;
let nextDialogId = 1;
let pendingRequests: DialogRequest[] = [];

const dialogTextMaxFontSizeMultiplier = 1.05;
const backdropColor = "rgba(43, 32, 38, 0.45)";
const titleColor = "#241D22";
const bodyColor = "#6B7280";
const cancelBackgroundColor = "#F1F0F4";
const cancelBorderColor = "#DDD7DC";
const cancelTextColor = "#4F454C";
const primaryGradient = ["#FB8FA5", "#F2647F", "#EB4F76"] as const;
const destructiveGradient = ["#F06B8E", "#E84F79", "#D83E68"] as const;

const toneConfig: Record<
  AppDialogTone,
  { color: string; icon: SymbolName; surface: string }
> = {
  danger: {
    color: "#D84C3E",
    icon: { android: "error", ios: "exclamationmark.triangle.fill", web: "error" },
    surface: "#FDECEA",
  },
  info: {
    color: "#EB4F76",
    icon: { android: "info", ios: "info.circle.fill", web: "info" },
    surface: "#FFF0F5",
  },
  success: {
    color: "#2A8A52",
    icon: { android: "check_circle", ios: "checkmark.circle.fill", web: "check_circle" },
    surface: "#EAF7EF",
  },
  warning: {
    color: "#DD8C1C",
    icon: { android: "warning", ios: "exclamationmark.triangle.fill", web: "warning" },
    surface: "#FFF6E8",
  },
};

/** Tiêu đề báo thành công thường ở thể hoàn thành ("Đã xóa", "Thành công"). */
const successTitlePattern =
  /(thành công|hoàn tất|đã (gửi|lưu|xóa|tạo|cập nhật|đăng|rời|tham gia|bắt đầu|check-?in)|bản nháp)/i;
const dangerTitlePattern =
  /(lỗi|thất bại|không thể|không được|hết hạn|từ chối|cảnh báo)/i;

function resolveTone(request: DialogRequest): AppDialogTone {
  if (request.options?.tone) {
    return request.options.tone;
  }

  if (request.buttons?.some((button) => button.style === "destructive")) {
    return "warning";
  }

  if (successTitlePattern.test(request.title)) {
    return "success";
  }

  if (dangerTitlePattern.test(request.title)) {
    return "danger";
  }

  return "info";
}

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

function enqueue(request: DialogRequest) {
  if (activeListener) {
    activeListener(request);
    return;
  }

  // Host chưa mount (ví dụ alert bắn ngay lúc khởi động app) - giữ lại để hiện sau.
  pendingRequests = [...pendingRequests, request];
}

export const appAlert = {
  /**
   * Cùng chữ ký với `Alert.alert` của React Native để thay thế trực tiếp,
   * nhưng hiển thị bằng popup của app trên mọi nền tảng.
   */
  alert(
    title: string,
    message?: string,
    buttons?: AlertButton[],
    options?: AppDialogOptions,
  ) {
    enqueue({ buttons, id: nextDialogId++, message, options, title });
  },
  /** Popup xác nhận 2 nút, trả về `true` khi người dùng đồng ý. */
  confirm({
    cancelLabel = "Hủy",
    confirmLabel = "Đồng ý",
    destructive = false,
    message,
    title,
    tone,
  }: {
    cancelLabel?: string;
    confirmLabel?: string;
    destructive?: boolean;
    message?: string;
    title: string;
    tone?: AppDialogTone;
  }) {
    return new Promise<boolean>((resolve) => {
      enqueue({
        buttons: [
          { onPress: () => resolve(false), style: "cancel", text: cancelLabel },
          {
            onPress: () => resolve(true),
            style: destructive ? "destructive" : "default",
            text: confirmLabel,
          },
        ],
        id: nextDialogId++,
        message,
        options: { onDismiss: () => resolve(false), tone },
        title,
      });
    });
  },
};

function DialogButton({
  button,
  fullWidth,
  onPress,
}: {
  button: AlertButton;
  fullWidth: boolean;
  onPress: () => void;
}) {
  const isCancel = button.style === "cancel";
  const isDestructive = button.style === "destructive";
  const label = button.text || (isCancel ? "Hủy" : "Đồng ý");

  if (isCancel) {
    return (
      <Pressable
        accessibilityRole="button"
        className={`${fullWidth ? "w-full" : "flex-1"} h-[46px] items-center justify-center rounded-[14px]`}
        onPress={onPress}
        style={({ pressed }) => ({
          backgroundColor: cancelBackgroundColor,
          borderColor: cancelBorderColor,
          borderWidth: 1,
          opacity: pressed ? 0.78 : 1,
        })}
      >
        <Text
          className="text-[14px] font-bold"
          style={{ color: cancelTextColor, lineHeight: lineHeightFor(14) }}
        >
          {label}
        </Text>
      </Pressable>
    );
  }

  return (
    <Pressable
      accessibilityRole="button"
      className={`${fullWidth ? "w-full" : "flex-1"} overflow-hidden rounded-[14px]`}
      onPress={onPress}
      style={({ pressed }) => ({
        elevation: 5,
        opacity: pressed ? 0.9 : 1,
        shadowColor: isDestructive
          ? "rgba(216, 62, 104, 0.34)"
          : "rgba(235, 79, 118, 0.34)",
        shadowOffset: { height: 8, width: 0 },
        shadowOpacity: 1,
        shadowRadius: 14,
      })}
    >
      <LinearGradient
        colors={isDestructive ? destructiveGradient : primaryGradient}
        end={{ x: 1, y: 0.5 }}
        start={{ x: 0, y: 0.5 }}
        style={{
          alignItems: "center",
          height: 46,
          justifyContent: "center",
        }}
      >
        <Text
          className="text-[14px] font-bold text-white"
          style={{ lineHeight: lineHeightFor(14) }}
        >
          {label}
        </Text>
      </LinearGradient>
    </Pressable>
  );
}

export function AppDialogHost() {
  const [queue, setQueue] = useState<DialogRequest[]>([]);

  useEffect(() => {
    const listener: Listener = (request) => {
      setQueue((current) => [...current, request]);
    };

    activeListener = listener;

    // Alert bắn trước khi host mount (root layout còn chờ i18n khởi tạo) được
    // phát lại ở microtask kế tiếp, thay vì setState thẳng trong effect.
    if (pendingRequests.length) {
      queueMicrotask(() => {
        const buffered = pendingRequests;
        pendingRequests = [];
        buffered.forEach(listener);
      });
    }

    return () => {
      activeListener = null;
    };
  }, []);

  const request = queue[0] ?? null;

  if (!request) {
    return null;
  }

  const buttons = request.buttons?.length
    ? request.buttons
    : [{ style: "default" as const, text: "Đã hiểu" }];
  const isStacked = buttons.length > 2;
  const cancelable = request.options?.cancelable !== false;
  const tone = toneConfig[resolveTone(request)];
  const icon = request.options?.icon ?? tone.icon;

  const close = () => {
    setQueue((current) => current.filter((item) => item.id !== request.id));
  };

  const dismiss = () => {
    if (!cancelable) {
      return;
    }

    close();
    request.options?.onDismiss?.();
  };

  return (
    <Modal
      animationType="fade"
      onRequestClose={dismiss}
      statusBarTranslucent
      transparent
      visible
    >
      <View className="flex-1 items-center justify-center px-6 py-6">
        <Pressable
          accessibilityLabel="Đóng thông báo"
          accessibilityRole="button"
          className="absolute inset-0"
          onPress={dismiss}
          style={{ backgroundColor: backdropColor }}
        />

        <View
          accessibilityRole="alert"
          className="w-full items-center rounded-[24px] bg-white px-5 pb-5 pt-6"
          style={{
            elevation: 16,
            maxWidth: 340,
            shadowColor: "rgba(43, 32, 38, 0.28)",
            shadowOffset: { height: 16, width: 0 },
            shadowOpacity: 1,
            shadowRadius: 30,
          }}
        >
          <View
            className="h-14 w-14 items-center justify-center rounded-full"
            style={{ backgroundColor: tone.surface }}
          >
            <SymbolView name={icon} size={27} tintColor={tone.color} />
          </View>

          <Text
            className="mt-3.5 text-center text-[17px] font-black"
            style={{ color: titleColor, lineHeight: lineHeightFor(17) }}
          >
            {request.title}
          </Text>

          {!!request.message && (
            <Text
              className="mt-1.5 text-center text-[13px]"
              style={{ color: bodyColor, lineHeight: bodyLineHeightFor(13) }}
            >
              {request.message}
            </Text>
          )}

          <View
            className={`mt-5 w-full ${isStacked ? "gap-2" : "flex-row gap-2.5"}`}
          >
            {buttons.map((button, index) => (
              <DialogButton
                button={button}
                fullWidth={isStacked || buttons.length === 1}
                key={`${button.text ?? "button"}-${index}`}
                onPress={() => {
                  close();
                  button.onPress?.();
                }}
              />
            ))}
          </View>
        </View>
      </View>
    </Modal>
  );
}
