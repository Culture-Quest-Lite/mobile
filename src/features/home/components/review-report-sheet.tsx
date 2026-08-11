import { SymbolView } from "@/components/ui/symbol-view";
import { textStyle } from "@/lib/text-scale";
import type { ComponentProps } from "react";
import {
  ActivityIndicator,
  KeyboardAvoidingView,
  Modal,
  Platform,
  Pressable,
  Text as RNText,
  TextInput,
  View,
  type TextProps,
} from "react-native";

type SymbolName = ComponentProps<typeof SymbolView>["name"];

export type ReviewReportMenuRowItem = {
  description?: string;
  icon: SymbolName;
  isDestructive?: boolean;
  label: string;
};

export type ReviewReportReasonItem = ReviewReportMenuRowItem & {
  key: string;
  isFreeText?: boolean;
};

export const reviewReportReasonMaxLength = 300;
const detailTextMaxFontSizeMultiplier = 1.05;

function Text({
  maxFontSizeMultiplier = detailTextMaxFontSizeMultiplier,
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

export function buildReviewReportReasonItems(): readonly ReviewReportReasonItem[] {
  return [
    {
      key: "Spam hoặc quảng cáo",
      label: "Spam hoặc quảng cáo",
      icon: {
        ios: "exclamationmark.triangle",
        android: "report_problem",
        web: "report_problem",
      },
    },
    {
      key: "Quấy rối hoặc xúc phạm",
      label: "Quấy rối hoặc xúc phạm",
      icon: {
        ios: "exclamationmark.triangle",
        android: "report_problem",
        web: "report_problem",
      },
    },
    {
      key: "Thông tin sai lệch",
      label: "Thông tin sai lệch",
      icon: {
        ios: "exclamationmark.triangle",
        android: "report_problem",
        web: "report_problem",
      },
    },
    {
      key: "Bạo lực hoặc thù ghét",
      label: "Bạo lực hoặc thù ghét",
      icon: {
        ios: "exclamationmark.triangle",
        android: "report_problem",
        web: "report_problem",
      },
    },
    {
      key: "Nội dung nhạy cảm",
      label: "Nội dung nhạy cảm",
      icon: {
        ios: "exclamationmark.triangle",
        android: "report_problem",
        web: "report_problem",
      },
    },
    {
      key: "",
      label: "Lý do khác",
      icon: { ios: "square.and.pencil", android: "edit", web: "edit" },
      isFreeText: true,
    },
  ];
}

export function ReviewReportOptionsSheet({
  bottomInset,
  isSubmitting = false,
  items,
  onClose,
  onSelectItem,
  title = "Chọn lý do báo cáo",
  visible,
}: {
  bottomInset: number;
  isSubmitting?: boolean;
  items: readonly ReviewReportReasonItem[];
  onClose: () => void;
  onSelectItem: (item: ReviewReportReasonItem) => void;
  title?: string;
  visible: boolean;
}) {
  return (
    <Modal
      animationType="slide"
      onRequestClose={onClose}
      statusBarTranslucent
      transparent
      visible={visible}
    >
      <View className="flex-1 bg-black/35">
        <Pressable className="flex-1" onPress={onClose} />

        <View
          className="rounded-t-[28px] bg-white px-3 pt-3"
          style={{ paddingBottom: Math.max(bottomInset, 14) }}
        >
          <View className="items-center pb-2">
            <View className="h-1.5 w-14 rounded-full bg-[#D3D2DC]" />
          </View>

          <View className="flex-row items-center justify-between px-2 pb-2">
            <Text
              className="text-[15px] font-bold text-[#2F2432]"
              style={textStyle(15)}
            >
              {title}
            </Text>
            {isSubmitting ? (
              <ActivityIndicator color="#D4578F" size="small" />
            ) : null}
          </View>

          <View className="rounded-[22px] bg-[#F7F6FB] px-4 py-0.5">
            {items.map((item, index) => (
              <ReviewReportMenuRow
                key={`${item.label}-${index}`}
                isLast={index === items.length - 1}
                item={item}
                onPress={() => {
                  if (isSubmitting) {
                    return;
                  }

                  onSelectItem(item);
                }}
              />
            ))}
          </View>
        </View>
      </View>
    </Modal>
  );
}

export function ReviewReportReasonComposer({
  bottomInset,
  draft,
  isSubmitting,
  onBack,
  onChangeDraft,
  onClose,
  onSubmit,
  visible,
}: {
  bottomInset: number;
  draft: string;
  isSubmitting: boolean;
  onBack: () => void;
  onChangeDraft: (value: string) => void;
  onClose: () => void;
  onSubmit: () => void;
  visible: boolean;
}) {
  const canSubmit = draft.trim().length > 0 && !isSubmitting;

  return (
    <Modal
      animationType="slide"
      onRequestClose={onClose}
      statusBarTranslucent
      transparent
      visible={visible}
    >
      <KeyboardAvoidingView
        behavior={Platform.OS === "ios" ? "padding" : undefined}
        className="flex-1"
      >
        <View className="flex-1 bg-black/35">
          <Pressable className="flex-1" onPress={onClose} />

          <View
            className="rounded-t-[28px] bg-white px-4 pt-3"
            style={{ paddingBottom: Math.max(bottomInset, 14) }}
          >
            <View className="items-center pb-2">
              <View className="h-1.5 w-14 rounded-full bg-[#D3D2DC]" />
            </View>

            <View className="flex-row items-center gap-2 pb-2">
              <Pressable hitSlop={8} onPress={onBack}>
                <SymbolView
                  name={{
                    ios: "chevron.left",
                    android: "arrow_back",
                    web: "arrow_back",
                  }}
                  size={18}
                  tintColor="#554C56"
                />
              </Pressable>
              <Text
                className="text-[15px] font-bold text-[#2F2432]"
                style={textStyle(15)}
              >
                Lý do khác
              </Text>
            </View>

            <TextInput
              autoFocus
              className="min-h-[96px] rounded-[18px] bg-[#F7F6FB] px-4 py-3 text-[15px] text-[#2B232D]"
              editable={!isSubmitting}
              maxLength={reviewReportReasonMaxLength}
              multiline
              onChangeText={onChangeDraft}
              placeholder="Mô tả ngắn lý do bạn muốn báo cáo bài đánh giá này"
              placeholderTextColor="#A79FAE"
              style={textStyle(15)}
              textAlignVertical="top"
              value={draft}
            />

            <View className="mt-3 flex-row items-center justify-between">
              <Text
                className="text-[12px] text-[#8E869A]"
                style={textStyle(12)}
              >
                {draft.trim().length}/{reviewReportReasonMaxLength}
              </Text>

              <Pressable
                className={`rounded-full px-5 py-2.5 ${canSubmit ? "bg-[#D4578F]" : "bg-[#E7E5EF]"}`}
                disabled={!canSubmit}
                onPress={onSubmit}
              >
                {isSubmitting ? (
                  <ActivityIndicator color="#FFFFFF" size="small" />
                ) : (
                  <Text
                    className={`text-[14px] font-bold ${canSubmit ? "text-white" : "text-[#A79FAE]"}`}
                    style={textStyle(14)}
                  >
                    Gửi báo cáo
                  </Text>
                )}
              </Pressable>
            </View>
          </View>
        </View>
      </KeyboardAvoidingView>
    </Modal>
  );
}

function ReviewReportMenuRow({
  isLast,
  item,
  onPress,
}: {
  isLast: boolean;
  item: ReviewReportMenuRowItem;
  onPress: () => void;
}) {
  const labelColor = item.isDestructive ? "#C24F3B" : "#202124";
  const descriptionColor = item.isDestructive ? "#B46A5F" : "#8E869A";

  return (
    <Pressable
      className={`flex-row items-start gap-2.5 py-2.5 ${isLast ? "" : "border-b border-[#E7E5EF]"}`}
      onPress={onPress}
    >
      <View className="w-6 items-center pt-px">
        <SymbolView name={item.icon} size={19} tintColor={labelColor} />
      </View>
      <View className="min-w-0 flex-1">
        <Text
          className="text-[15px] font-normal"
          style={[textStyle(15), { color: labelColor }]}
        >
          {item.label}
        </Text>
        {item.description ? (
          <Text
            className="mt-0.5 text-[12px]"
            style={[textStyle(12), { color: descriptionColor }]}
          >
            {item.description}
          </Text>
        ) : null}
      </View>
    </Pressable>
  );
}
