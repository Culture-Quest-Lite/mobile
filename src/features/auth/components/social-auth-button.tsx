import { Pressable, Text } from 'react-native';

type SocialAuthButtonProps = {
  accentColor: string;
  disabled?: boolean;
  label: string;
  onPress?: () => void;
};

export function SocialAuthButton({
  accentColor,
  disabled,
  label,
  onPress,
}: SocialAuthButtonProps) {
  return (
    <Pressable
      className="h-[46px] w-[46px] items-center justify-center rounded-full border border-[#F1EAF4] bg-white/90 active:opacity-80 disabled:opacity-50"
      disabled={disabled}
      onPress={onPress}
    >
      <Text className="text-[18px] font-extrabold" style={{ color: accentColor }}>
        {label}
      </Text>
    </Pressable>
  );
}
