import { Platform, Text, TextInput, View, type TextInputProps } from 'react-native';

type AuthInputProps = TextInputProps & {
  className?: string;
  errorMessage?: string | null;
  inputClassName?: string;
  label: string;
};

const webInputStyle = Platform.select({
  web: { paddingVertical: 14 },
  default: undefined,
});

export function AuthInput({
  className,
  errorMessage,
  inputClassName,
  label,
  style,
  ...props
}: AuthInputProps) {
  return (
    <View className={`gap-2 ${className ?? ''}`.trim()}>
      <Text className="text-[15px] font-semibold text-[#625B71]">{label}</Text>
      <TextInput
        {...props}
        className={`h-12 rounded-2xl border px-3.5 text-[16px] text-[#322A3D] focus:border-[#FF679A]/50 ${
          errorMessage
            ? 'border-[#D6456C] bg-[#FFF6F9]'
            : 'border-white/90 bg-[#F7F5FA]'
        } ${inputClassName ?? ''}`.trim()}
        placeholderTextColor="#C1BDCB"
        selectionColor="#EB489B"
        style={[webInputStyle, style]}
      />
      {errorMessage ? (
        <Text className="text-[14px] font-medium text-[#D6456C]">{errorMessage}</Text>
      ) : null}
    </View>
  );
}
