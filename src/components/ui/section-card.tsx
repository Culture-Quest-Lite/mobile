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
      className={`gap-4 rounded-[22px] border border-[#D7C6A8] bg-white p-6 dark:border-[#465143] dark:bg-[#20241F] ${className ?? ''}`.trim()}>
      <View className="gap-1">
        <ThemedText className="text-2xl font-semibold leading-[30px]">
          {title}
        </ThemedText>
        {description ? (
          <ThemedText themeColor="textSecondary" className="leading-[22px]">
            {description}
          </ThemedText>
        ) : null}
      </View>
      <View className={`gap-2 ${contentClassName ?? ''}`.trim()}>{children}</View>
    </View>
  );
}
