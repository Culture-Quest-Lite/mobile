import { type PropsWithChildren } from 'react';
import { ScrollView, View, type StyleProp, type ViewStyle } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

type AppScreenProps = PropsWithChildren<{
  className?: string;
  contentClassName?: string;
  contentStyle?: StyleProp<ViewStyle>;
  scroll?: boolean;
  style?: StyleProp<ViewStyle>;
}>;

const rootClassName = 'flex-1 bg-[#F7F3EA] dark:bg-[#171A17]';
const contentClassName = 'flex-1 gap-4 p-6';

export function AppScreen({
  children,
  className,
  contentClassName: innerClassName,
  contentStyle,
  scroll = true,
  style,
}: AppScreenProps) {
  const mergedRootClassName = `${rootClassName} ${className ?? ''}`.trim();
  const mergedContentClassName = `${contentClassName} ${innerClassName ?? ''}`.trim();

  if (!scroll) {
    return (
      <SafeAreaView className={mergedRootClassName} style={style}>
        <View className={mergedContentClassName} style={contentStyle}>
          {children}
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView className={mergedRootClassName} style={style}>
      <ScrollView className="flex-1" contentContainerStyle={{ flexGrow: 1 }}>
        <View className={mergedContentClassName} style={contentStyle}>
          {children}
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}
