import { Pressable, Text } from 'react-native';

type SocialAuthButtonProps = {
  accentColor: string;
  label: string;
};

export function SocialAuthButton({ accentColor, label }: SocialAuthButtonProps) {
  return (
    <Pressable className="h-[40px] w-[40px] items-center justify-center rounded-full border border-[#F1EAF4] bg-white/90 active:opacity-80">
      <Text className="text-[16px] font-extrabold" style={{ color: accentColor }}>
        {label}
      </Text>
    </Pressable>
  );
}
