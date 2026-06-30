import { Pressable, Text } from 'react-native';

type SocialAuthButtonProps = {
  accentColor: string;
  label: string;
};

export function SocialAuthButton({ accentColor, label }: SocialAuthButtonProps) {
  return (
    <Pressable className="h-[46px] w-[46px] items-center justify-center rounded-full border border-[#F1EAF4] bg-white/90 active:opacity-80">
      <Text className="text-[18px] font-extrabold" style={{ color: accentColor }}>
        {label}
      </Text>
    </Pressable>
  );
}
