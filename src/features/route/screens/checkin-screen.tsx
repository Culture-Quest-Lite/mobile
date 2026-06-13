import { Image } from 'expo-image';
import { LinearGradient } from 'expo-linear-gradient';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { SymbolView } from 'expo-symbols';
import { type ReactNode, useEffect, useMemo, useRef, useState } from 'react';
import {
  Animated,
  Easing,
  Pressable,
  Text,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { addCheckin, useCheckins } from '@/lib/checkin-store';
import { getHotspot, getRouteHotspots } from '@/lib/demo-data';
import { getHotspotDetailHref, getHotspotStoriesHref } from '@/lib/hotspot-navigation';

// ─── Types ────────────────────────────────────────────────────────────────────
type Stage = 'idle' | 'scanning' | 'success';

// ─── Shadow styles ────────────────────────────────────────────────────────────
const glowShadow = {
  shadowColor: 'rgba(235, 72, 155, 0.45)',
  shadowOpacity: 1,
  shadowRadius: 20,
  shadowOffset: { width: 0, height: 8 },
  elevation: 12,
} as const;

const cardShadow = {
  shadowColor: 'rgba(0,0,0,0.3)',
  shadowOpacity: 1,
  shadowRadius: 16,
  shadowOffset: { width: 0, height: 8 },
  elevation: 8,
} as const;

// ─── Spinner animation ────────────────────────────────────────────────────────
function SpinnerRing() {
  const rotation = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    Animated.loop(
      Animated.timing(rotation, {
        toValue: 1,
        duration: 1000,
        easing: Easing.linear,
        useNativeDriver: true,
      }),
    ).start();
  }, [rotation]);

  const spin = rotation.interpolate({
    inputRange: [0, 1],
    outputRange: ['0deg', '360deg'],
  });

  return (
    <Animated.View
      style={{
        width: 120,
        height: 120,
        borderRadius: 60,
        borderWidth: 4,
        borderColor: '#EB489B',
        borderTopColor: 'transparent',
        transform: [{ rotate: spin }],
      }}
    />
  );
}

// ─── Slow spin ring (idle deco) ───────────────────────────────────────────────
function SlowSpinRing() {
  const rotation = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    Animated.loop(
      Animated.timing(rotation, {
        toValue: 1,
        duration: 30000,
        easing: Easing.linear,
        useNativeDriver: true,
      }),
    ).start();
  }, [rotation]);

  const spin = rotation.interpolate({
    inputRange: [0, 1],
    outputRange: ['0deg', '360deg'],
  });

  return (
    <Animated.View
      style={{
        position: 'absolute',
        width: 192,
        height: 192,
        borderRadius: 96,
        borderWidth: 2,
        borderColor: 'rgba(235,72,155,0.4)',
        borderStyle: 'dashed',
        transform: [{ rotate: spin }],
      }}
    />
  );
}

// ─── Ripple pulse ─────────────────────────────────────────────────────────────
function RipplePulse() {
  const scale = useRef(new Animated.Value(0.8)).current;
  const opacity = useRef(new Animated.Value(0.4)).current;

  useEffect(() => {
    Animated.loop(
      Animated.parallel([
        Animated.timing(scale, {
          toValue: 1.4,
          duration: 2500,
          easing: Easing.out(Easing.ease),
          useNativeDriver: true,
        }),
        Animated.timing(opacity, {
          toValue: 0,
          duration: 2500,
          easing: Easing.out(Easing.ease),
          useNativeDriver: true,
        }),
      ]),
    ).start();
  }, [scale, opacity]);

  return (
    <Animated.View
      style={{
        position: 'absolute',
        width: 192,
        height: 192,
        borderRadius: 96,
        backgroundColor: 'rgba(235,72,155,0.2)',
        transform: [{ scale }],
        opacity,
      }}
    />
  );
}

// ─── Confetti dots (success) ──────────────────────────────────────────────────
function ConfettiDots() {
  const anims = useRef(
    Array.from({ length: 12 }, () => new Animated.Value(0)),
  ).current;

  useEffect(() => {
    Animated.stagger(
      60,
      anims.map((a) =>
        Animated.spring(a, {
          toValue: 1,
          useNativeDriver: true,
          tension: 80,
          friction: 6,
        }),
      ),
    ).start();
  }, [anims]);

  return (
    <>
      {anims.map((a, i) => {
        const angle = (i / 12) * 2 * Math.PI;
        const tx = Math.cos(angle) * 80;
        const ty = Math.sin(angle) * 80;
        const colors = ['#EB489B', '#F58752', '#FFC93C', '#22C55E', '#60A5FA'];
        return (
          <Animated.View
            key={i}
            style={{
              position: 'absolute',
              width: 8,
              height: 8,
              borderRadius: 4,
              backgroundColor: colors[i % colors.length],
              transform: [
                { translateX: a.interpolate({ inputRange: [0, 1], outputRange: [0, tx] }) },
                { translateY: a.interpolate({ inputRange: [0, 1], outputRange: [0, ty] }) },
              ],
              opacity: a,
            }}
          />
        );
      })}
    </>
  );
}

// ─── Reward row ───────────────────────────────────────────────────────────────
function RewardRow({
  icon,
  iconBg,
  label,
  value,
  badge,
}: {
  icon: ReactNode;
  iconBg: string[];
  label: string;
  value: string;
  badge?: string;
}) {
  return (
    <View className="flex-row items-center gap-3">
      <LinearGradient
        colors={iconBg as [string, string]}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 1 }}
        className="h-10 w-10 items-center justify-center rounded-[14px]"
      >
        {icon}
      </LinearGradient>
      <View className="flex-1">
        <Text className="text-[10px] font-bold uppercase tracking-wider text-white/60">
          {label}
        </Text>
        <Text className="text-[14px] font-bold text-white">{value}</Text>
      </View>
      {badge && (
        <Text className="text-[14px] font-bold text-[#22C55E]">{badge}</Text>
      )}
    </View>
  );
}

// ─── Main screen ──────────────────────────────────────────────────────────────
export default function CheckinScreen() {
  const { id, routeId } = useLocalSearchParams<{ id: string; routeId?: string }>();
  const router = useRouter();
  const checkins = useCheckins();
  const [stage, setStage] = useState<Stage>('idle');

  const hotspotId = Array.isArray(id) ? id[0] : id;
  const activeRouteId = Array.isArray(routeId) ? routeId[0] : routeId;
  const h = hotspotId ? getHotspot(hotspotId) : undefined;

  const routeProgress = useMemo(() => {
    if (!activeRouteId) return null;
    const stops = getRouteHotspots(activeRouteId);
    const completed = stops.filter(
      (stop) => checkins.includes(stop.id) || (stage === 'success' && stop.id === hotspotId),
    ).length;
    return { completed, total: stops.length };
  }, [activeRouteId, checkins, hotspotId, stage]);

  // Giả lập scan GPS 1.8 giây
  useEffect(() => {
    if (stage === 'scanning' && hotspotId) {
      const t = setTimeout(() => {
        addCheckin(hotspotId);
        setStage('success');
      }, 1800);
      return () => clearTimeout(t);
    }
  }, [stage, hotspotId]);

  // Fallback
  if (!h) {
    return (
      <SafeAreaView className="flex-1 items-center justify-center bg-[#1A1525]">
        <Text className="text-white">Không tìm thấy địa điểm</Text>
        <Pressable onPress={() => router.back()} className="mt-4">
          <Text className="text-[#EB489B] font-bold">Quay lại</Text>
        </Pressable>
      </SafeAreaView>
    );
  }

  return (
    <View className="flex-1 bg-[#1A1525]">
      {/* Ambient background image */}
      <Image
        source={h.image}
        contentFit="cover"
        style={{ position: 'absolute', inset: 0, width: '100%', height: '100%', opacity: 0.22 }}
      />
      <LinearGradient
        colors={['rgba(26,21,37,0.6)', 'rgba(26,21,37,0.82)', '#1A1525']}
        locations={[0, 0.5, 1]}
        style={{ position: 'absolute', inset: 0 }}
      />

      <SafeAreaView className="flex-1" edges={['top', 'bottom']}>
        <View className="flex-1 px-4 pt-2">

          {/* Top bar */}
          <View className="flex-row items-center justify-between">
            <Pressable
              onPress={() => router.back()}
              className="h-10 w-10 items-center justify-center rounded-full bg-white/10"
            >
              <SymbolView
                name={{ ios: 'xmark', android: 'close', web: 'close' }}
                size={18}
                tintColor="#fff"
              />
            </Pressable>
            <Text className="text-[11px] font-semibold uppercase tracking-wider text-white/70">
              Check-in
            </Text>
            <View className="w-10" />
          </View>

          {/* ── Stage: IDLE ── */}
          {stage === 'idle' && (
            <View className="flex-1 items-center justify-center gap-0 px-6">
              {/* GPS visual */}
              <View className="mb-8 items-center justify-center" style={{ width: 200, height: 200 }}>
                <RipplePulse />
                <SlowSpinRing />
                {/* Inner ring */}
                <View
                  className="absolute items-center justify-center rounded-full border border-[rgba(235,72,155,0.25)]"
                  style={{ width: 140, height: 140 }}
                />
                {/* Center gradient circle */}
                <LinearGradient
                  colors={['#EB489B', '#F58752']}
                  start={{ x: 0, y: 0 }}
                  end={{ x: 1, y: 1 }}
                  className="absolute items-center justify-center rounded-full"
                  style={[{ width: 96, height: 96 }, glowShadow]}
                >
                  <SymbolView
                    name={{ ios: 'mappin.circle.fill', android: 'place', web: 'place' }}
                    size={44}
                    tintColor="#fff"
                  />
                </LinearGradient>
              </View>

              {/* Name + address */}
              <Text className="text-center text-[24px] font-extrabold text-white">
                {h.name}
              </Text>
              <Text className="mt-1 text-center text-[13px] text-white/70">{h.address}</Text>

              {/* GPS status card */}
              <View className="mt-5 w-full flex-row items-center gap-3 rounded-[20px] bg-white/10 px-4 py-3.5">
                <View className="h-2 w-2 rounded-full bg-[#22C55E]" />
                <View className="flex-1">
                  <Text className="text-[10px] font-bold uppercase tracking-wider text-white/60">
                    GPS xác minh
                  </Text>
                  <Text className="text-[12px] font-semibold text-white">
                    Bạn cách 12m · trong bán kính 50m ✓
                  </Text>
                </View>
              </View>

              {/* CTA button */}
              <Pressable
                onPress={() => setStage('scanning')}
                className="mt-8 overflow-hidden rounded-[20px]"
                style={glowShadow}
              >
                <LinearGradient
                  colors={['#EB489B', '#F58752']}
                  start={{ x: 0, y: 0 }}
                  end={{ x: 1, y: 0 }}
                  className="flex-row items-center gap-2 px-10 py-4"
                >
                  <SymbolView
                    name={{ ios: 'sparkles', android: 'auto_awesome', web: 'auto_awesome' }}
                    size={16}
                    tintColor="#fff"
                  />
                  <Text className="text-[15px] font-extrabold text-white">Check-in ngay</Text>
                </LinearGradient>
              </Pressable>

              <Text className="mt-3 max-w-[260px] text-center text-[10px] text-white/50">
                Mở khoá +{h.xp} XP, audio story và đánh giá địa điểm
              </Text>
            </View>
          )}

          {/* ── Stage: SCANNING ── */}
          {stage === 'scanning' && (
            <View className="flex-1 items-center justify-center gap-5 px-6">
              <SpinnerRing />
              <Text className="text-[20px] font-bold text-white">
                Đang xác minh vị trí...
              </Text>
              <Text className="text-[12px] text-white/60">
                GPS · Wi-Fi triangulation · Hotspot fingerprint
              </Text>
            </View>
          )}

          {/* ── Stage: SUCCESS ── */}
          {stage === 'success' && (
            <View className="flex-1 items-center justify-center px-6 gap-0">
              {/* Success icon + confetti */}
              <View className="mb-6 items-center justify-center" style={{ width: 160, height: 160 }}>
                <LinearGradient
                  colors={['#22C55E', '#16A34A']}
                  start={{ x: 0, y: 0 }}
                  end={{ x: 1, y: 1 }}
                  className="h-32 w-32 items-center justify-center rounded-full"
                  style={glowShadow}
                >
                  <SymbolView
                    name={{ ios: 'checkmark.circle.fill', android: 'check_circle', web: 'check_circle' }}
                    size={64}
                    tintColor="#fff"
                  />
                </LinearGradient>
                <ConfettiDots />
              </View>

              {/* Title */}
              <Text className="text-[30px] font-extrabold text-white">
                Check-in thành công!
              </Text>
              <Text className="mt-1 text-[13px] text-white/80">{h.name}</Text>

              {/* Reward card */}
              <View
                className="mt-6 w-full max-w-xs gap-4 rounded-[28px] bg-white/10 p-4"
                style={cardShadow}
              >
                <RewardRow
                  iconBg={['#EB489B', '#F58752']}
                  icon={
                    <Text className="text-[12px] font-extrabold text-white">XP</Text>
                  }
                  label="Phần thưởng"
                  value={`+${h.xp} XP`}
                  badge="+1"
                />
                <View className="h-px bg-white/10" />
                <RewardRow
                  iconBg={['#F58752', '#FFC93C']}
                  icon={
                    <SymbolView
                      name={{ ios: 'speaker.wave.2.fill', android: 'volume_up', web: 'volume_up' }}
                      size={16}
                      tintColor="#fff"
                    />
                  }
                  label="Mở khoá"
                  value="Audio story 2:14"
                  badge="✓"
                />
                <View className="h-px bg-white/10" />
                <RewardRow
                  iconBg={['#EB489B', '#F58752']}
                  icon={
                    <SymbolView
                      name={{ ios: 'trophy.fill', android: 'emoji_events', web: 'emoji_events' }}
                      size={16}
                      tintColor="#fff"
                    />
                  }
                  label="Tiến độ tuyến"
                  value={
                    routeProgress
                      ? `${routeProgress.completed}/${routeProgress.total} chặng đã ghé`
                      : 'Đã mở khoá điểm dừng'
                  }
                />
              </View>

              {/* Action buttons */}
              <View className="mt-8 w-full max-w-xs gap-3">
                <Pressable
                  onPress={() => {
                    const href = hotspotId ? getHotspotStoriesHref(hotspotId) : undefined;
                    if (href) router.push(href);
                  }}
                  className="overflow-hidden rounded-[18px]"
                  style={glowShadow}
                >
                  <LinearGradient
                    colors={['#EB489B', '#F58752']}
                    start={{ x: 0, y: 0 }}
                    end={{ x: 1, y: 0 }}
                    className="flex-row items-center justify-center gap-2 py-4"
                  >
                    <SymbolView
                      name={{ ios: 'sparkles', android: 'auto_awesome', web: 'auto_awesome' }}
                      size={15}
                      tintColor="#fff"
                    />
                    <Text className="text-[14px] font-extrabold text-white">
                      Nghe câu chuyện
                    </Text>
                  </LinearGradient>
                </Pressable>

                <Pressable
                  onPress={() => {
                    if (activeRouteId) {
                      router.push(`/route/${activeRouteId}`);
                      return;
                    }
                    const href = hotspotId ? getHotspotDetailHref(hotspotId) : undefined;
                    if (href) {
                      router.push(href);
                      return;
                    }
                    router.back();
                  }}
                  className="items-center rounded-[18px] bg-white/10 py-4"
                >
                  <Text className="text-[13px] font-semibold text-white">
                    Tiếp tục khám phá
                  </Text>
                </Pressable>
              </View>
            </View>
          )}

        </View>
      </SafeAreaView>
    </View>
  );
}