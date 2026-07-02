import type { ReactNode } from "react";
import { Platform, Text, TextInput, View, type TextInputProps } from "react-native";

type AuthInputProps = TextInputProps & {
  className?: string;
  errorMessage?: string | null;
  inputClassName?: string;
  label: string;
  rightAccessory?: ReactNode;
};

const webInputStyle = Platform.select({
  web: { paddingVertical: 16 },
  default: undefined,
});

export function AuthInput({
  className,
  errorMessage,
  inputClassName,
  label,
  rightAccessory,
  style,
  ...props
}: AuthInputProps) {
  return (
    <View className={`gap-2.5 ${className ?? ""}`.trim()}>
      <Text className="text-[16px] font-semibold text-[#625B71]">{label}</Text>
      <View className="relative">
        <TextInput
          {...props}
          className={`h-14 rounded-[20px] border px-4 text-[17px] text-[#322A3D] focus:border-[#FF679A]/50 ${
            errorMessage
              ? "border-[#D6456C] bg-[#FFF6F9]"
              : "border-white/90 bg-[#F7F5FA]"
          } ${rightAccessory ? "pr-14" : ""} ${inputClassName ?? ""}`.trim()}
          placeholderTextColor="#C1BDCB"
          selectionColor="#EB489B"
          style={[webInputStyle, style]}
        />
        {rightAccessory ? (
          <View className="absolute bottom-0 right-4 top-0 justify-center">
            {rightAccessory}
          </View>
        ) : null}
      </View>
      {errorMessage ? (
        <Text className="text-[15px] font-medium text-[#D6456C]">{errorMessage}</Text>
      ) : null}
    </View>
  );
}
