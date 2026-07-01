import { Platform, Text, type TextProps, type TextStyle } from 'react-native';

import { Fonts, ThemeColor } from '@/constants/theme';

export type ThemedTextProps = TextProps & {
  type?: 'default' | 'title' | 'small' | 'smallBold' | 'subtitle' | 'link' | 'linkPrimary' | 'code';
  themeColor?: ThemeColor;
};

const themeColorClassNames: Record<ThemeColor, string> = {
  text: 'text-[#1B1D1F] dark:text-[#F6EFE2]',
  background: 'text-[#F7F3EA] dark:text-[#171A17]',
  surface: 'text-white dark:text-[#20241F]',
  backgroundElement: 'text-[#EFE6D7] dark:text-[#2A3029]',
  backgroundSelected: 'text-[#E9DCC5] dark:text-[#353E34]',
  border: 'text-[#D7C6A8] dark:text-[#465143]',
  textSecondary: 'text-[#5D625C] dark:text-[#B5B9AF]',
  primary: 'text-[#A25B24] dark:text-[#F0A35C]',
};

const typeClassNames: Record<NonNullable<ThemedTextProps['type']>, string> = {
  default: 'text-base font-medium leading-6',
  title: 'text-5xl font-semibold leading-[52px]',
  small: 'text-sm font-medium leading-5',
  smallBold: 'text-sm font-bold leading-5',
  subtitle: 'text-[32px] font-semibold leading-11',
  link: 'text-sm leading-[30px]',
  linkPrimary: 'text-sm leading-[30px] text-[#3C87F7]',
  code: 'text-xs font-medium',
};

const codeStyle = {
  fontFamily: Fonts.mono,
  fontWeight: (Platform.select({ android: '700', default: '500' }) ?? '500') as TextStyle['fontWeight'],
} satisfies TextStyle;

export function ThemedText({ className, style, type = 'default', themeColor, ...rest }: ThemedTextProps) {
  return (
    <Text
      className={`${themeColorClassNames[themeColor ?? 'text']} ${typeClassNames[type]} ${className ?? ''}`.trim()}
      style={[type === 'code' ? codeStyle : undefined, style]}
      {...rest}
    />
  );
}
