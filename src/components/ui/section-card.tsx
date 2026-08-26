import { type PropsWithChildren } from 'react';
import { View } from 'react-native';

import { ThemedText } from '@/components/themed-text';

type SectionCardProps = PropsWithChildren<{
  className?: string;
  contentClassName?: string;
  description?: string;
  title: string;
}>;

export function SectionCard({
  children,
  className,
  contentClassName,
  description,
  title,
}: SectionCardProps) {
  return (
    <View
      className={`gap-5 rounded-[26px] border border-[#D7C6A8] bg-white p-6 dark:border-[#465143] dark:bg-[#20241F] ${className ?? ''}`.trim()}>
      <View className="gap-2">
        <ThemedText className="text-[28px] font-semibold leading-[34px]">
          {title}
        </ThemedText>
        {description ? (
          <ThemedText themeColor="textSecondary" className="leading-6">
            {description}
          </ThemedText>
        ) : null}
      </View>
      <View className={`gap-3 ${contentClassName ?? ''}`.trim()}>{children}</View>
    </View>
  );
}
