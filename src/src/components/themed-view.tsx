import { View, type ViewProps } from 'react-native';

import { ThemeColor } from '@/constants/theme';

export type ThemedViewProps = ViewProps & {
  lightColor?: string;
  darkColor?: string;
  type?: ThemeColor;
};

const backgroundClassNames: Record<ThemeColor, string> = {
  text: 'bg-[#1B1D1F] dark:bg-[#F6EFE2]',
  background: 'bg-[#F7F3EA] dark:bg-[#171A17]',
  surface: 'bg-white dark:bg-[#20241F]',
  backgroundElement: 'bg-[#EFE6D7] dark:bg-[#2A3029]',
  backgroundSelected: 'bg-[#E9DCC5] dark:bg-[#353E34]',
  border: 'bg-[#D7C6A8] dark:bg-[#465143]',
  textSecondary: 'bg-[#5D625C] dark:bg-[#B5B9AF]',
  primary: 'bg-[#A25B24] dark:bg-[#F0A35C]',
};

export function ThemedView({
  className,
  style,
  lightColor,
  darkColor,
  type,
  ...otherProps
}: ThemedViewProps) {
  return (
    <View
      className={`${backgroundClassNames[type ?? 'background']} ${className ?? ''}`.trim()}
      style={style}
      {...otherProps}
    />
  );
}
