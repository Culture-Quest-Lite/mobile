import { View } from 'react-native';

const largeSailStyle = {
  width: 0,
  height: 0,
  borderRightWidth: 64,
  borderBottomWidth: 84,
  borderRightColor: 'transparent',
  borderBottomColor: 'rgba(255,255,255,0.92)',
} as const;

const smallSailStyle = {
  width: 0,
  height: 0,
  borderLeftWidth: 26,
  borderBottomWidth: 58,
  borderLeftColor: 'transparent',
  borderBottomColor: 'rgba(255,255,255,0.72)',
} as const;

export function AuthHeaderArt() {
  return (
    <View className="h-[180px] w-full items-center justify-center overflow-hidden">
      <View className="absolute left-[-40px] top-[-24px] h-[132px] w-[132px] rounded-full bg-white/20" />
      <View className="absolute left-[18px] top-[-56px] h-[88px] w-[88px] rounded-full bg-white/80" />

      <View className="relative h-[112px] w-[180px] items-center justify-end">
        <View className="absolute top-[6px] h-14 w-1 rounded-full bg-white" />
        <View className="absolute left-[36px] top-3" style={largeSailStyle} />
        <View className="absolute left-[91px] top-[18px]" style={smallSailStyle} />
        <View className="h-[14px] w-32 rounded-full bg-white" />
        <View className="absolute bottom-[14px] h-2 w-[94px] rounded-full bg-white/90" />
        <View className="absolute bottom-[-6px] h-[3px] w-[146px] rounded-full bg-white/40" />
        <View className="absolute bottom-[-14px] h-[3px] w-[92px] rounded-full bg-white/30" />
      </View>
    </View>
  );
}
