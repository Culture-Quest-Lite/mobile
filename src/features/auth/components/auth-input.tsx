import { Platform, Text, TextInput, View, type TextInputProps } from 'react-native';

type AuthInputProps = TextInputProps & {
  className?: string;
  inputClassName?: string;
  label: string;
};

const webInputStyle = Platform.select({
  web: { paddingVertical: 14 },
  default: undefined,
});

export function AuthInput({ className, inputClassName, label, style, ...props }: AuthInputProps) {
  return (
    <View className={`gap-2 ${className ?? ''}`.trim()}>
      <Text className="text-[13px] font-semibold text-[#625B71]">{label}</Text>
      <TextInput
        {...props}
        className={`h-[52px] rounded-2xl border border-white/90 bg-[#F7F5FA] px-4 text-[15px] text-[#322A3D] focus:border-[#FF679A]/50 ${inputClassName ?? ''}`.trim()}
        placeholderTextColor="#C1BDCB"
        selectionColor="#EB489B"
        style={[webInputStyle, style]}
      />
    </View>
  );
}
