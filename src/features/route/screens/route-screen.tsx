import {
  activeRouteState,
  communityJourneys,
  currentUser,
  getRoute,
  leaderboard,
  myRoutes,
  routes,
  type CommunityJourney,
  type RouteItem,
} from '@/lib/demo-data';
import { Image } from 'expo-image';
import { LinearGradient } from 'expo-linear-gradient';
import { SymbolView } from 'expo-symbols';
import { type ComponentProps, useMemo, useState } from 'react';
import {
  Modal,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

type Tab = 'official' | 'active' | 'completed' | 'bookmarked' | 'community';
type RouteVariant = 'official' | 'active' | 'completed' | 'bookmarked' | 'community';

type SymbolName = ComponentProps<typeof SymbolView>['name'];

const sunsetColors = ['#EB489B', '#F58752', '#FFC93C'] as const;

const cardShadowStyle = {
  shadowColor: 'rgba(28, 45, 80, 0.12)',
  shadowOpacity: 1,
  shadowRadius: 14,
  shadowOffset: { width: 0, height: 8 },
  elevation: 6,
} as const;

const TAB_ITEMS: { key: Tab; label: string }[] = [
  { key: 'official', label: 'Chính thức' },
  { key: 'active', label: 'Đang đi' },
  { key: 'completed', label: 'Đã xong' },
  { key: 'bookmarked', label: 'Đã lưu' },
  { key: 'community', label: 'Cộng đồng' },
];

function XPBar({
  value,
  max,
  trackColor = 'rgba(255,255,255,0.2)',
  height = 8,
}: {
  value: number;
  max: number;
  trackColor?: string;
  height?: number;
}) {
  const percent = Math.min(Math.max((value / max) * 100, 0), 100);

  return (
    <View
      style={{
        backgroundColor: trackColor,
        borderRadius: 999,
        height,
        overflow: 'hidden',
      }}
    >
      <LinearGradient
        colors={['#FFE566', '#FFB400']}
        start={{ x: 0, y: 0.5 }}
        end={{ x: 1, y: 0.5 }}
        style={{ borderRadius: 999, height: '100%', width: `${percent}%` }}
      />
    </View>
  );
}

export default function RouteScreen() {
  const [tab, setTab] = useState<Tab>('official');
  const [showLeaderboard, setShowLeaderboard] = useState(false);

  const activeList = useMemo(
    () => myRoutes.active.map((id) => getRoute(id)).filter(Boolean) as RouteItem[],
    [],
  );
  const completedList = useMemo(
    () => myRoutes.completed.map((id) => getRoute(id)).filter(Boolean) as RouteItem[],
    [],
  );
  const savedList = useMemo(
    () => myRoutes.saved.map((id) => getRoute(id)).filter(Boolean) as RouteItem[],
    [],
  );

  return (
    <SafeAreaView className="flex-1 bg-[#F7F8FC]" edges={['top', 'left', 'right']}>
      <ScrollView
        className="flex-1"
        contentContainerStyle={{ paddingBottom: 24 }}
        nestedScrollEnabled
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator={false}
      >
        <LinearGradient
          colors={sunsetColors}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 1 }}
          className="rounded-b-[40px] px-4 pb-4 pt-3"
          style={cardShadowStyle}
        >
          <View className="flex-row items-center justify-between">
            <View>
              <Text className="text-[10px] font-bold uppercase tracking-wider text-white/80">
                Hành trình
              </Text>
              <Text className="text-[24px] font-extrabold text-white">
                Khám phá kế tiếp
              </Text>
            </View>

            <Pressable
              onPress={() => setShowLeaderboard(true)}
              className="flex-row items-center gap-2 rounded-2xl bg-black/20 px-3 py-2"
            >
              <SymbolView
                name={{ ios: 'trophy.fill', android: 'emoji_events', web: 'emoji_events' }}
                size={14}
                tintColor="#FFE566"
              />
              <Text className="text-[13px] font-bold text-white">BXH</Text>
            </Pressable>
          </View>

          <View className="mt-3 rounded-2xl bg-black/20 p-3">
            <View className="mb-1.5 flex-row items-center justify-between">
              <Text className="text-[11px] font-bold text-white">
                Cấp {currentUser.level} · {currentUser.title}
              </Text>
              <Text className="text-[11px] text-white/80">
                {currentUser.xp} / {currentUser.xpToNext}
              </Text>
            </View>
            <XPBar value={currentUser.xp} max={currentUser.xpToNext} />
            <Text className="mt-1.5 text-[10px] text-white/75">
              Còn {currentUser.xpToNext - currentUser.xp} XP để lên cấp{' '}
              {currentUser.level + 1}
            </Text>
          </View>
        </LinearGradient>

        <View className="px-4 pt-4">
          <ScrollView
            horizontal
            nestedScrollEnabled
            showsHorizontalScrollIndicator={false}
            contentContainerStyle={styles.tabRow}
          >
            {TAB_ITEMS.map((item) => {
              const selected = tab === item.key;
              return (
                <Pressable
                  key={item.key}
                  onPress={() => setTab(item.key)}
                  style={[styles.tabButton, selected && styles.tabButtonSelected]}
                >
                  <Text
                    style={[styles.tabLabel, selected && styles.tabLabelSelected]}
                  >
                    {item.label}
                  </Text>
                </Pressable>
              );
            })}
          </ScrollView>
        </View>

        <View key={tab} className="gap-3 px-4 pt-4">
          {tab === 'official' && <RouteList list={routes} variant="official" />}
          {tab === 'active' &&
            (activeList.length ? (
              <RouteList
                list={activeList}
                variant="active"
                progress={activeRouteState.progress}
              />
            ) : (
              <EmptyState text="Bạn chưa tham gia tuyến nào" />
            ))}
          {tab === 'completed' &&
            (completedList.length ? (
              <RouteList list={completedList} variant="completed" />
            ) : (
              <EmptyState text="Chưa hoàn thành tuyến nào" />
            ))}
          {tab === 'bookmarked' &&
            (savedList.length ? (
              <RouteList list={savedList} variant="bookmarked" />
            ) : (
              <EmptyState text="Bạn chưa lưu tuyến nào" />
            ))}
          {tab === 'community' && <CommunityTab />}
        </View>
      </ScrollView>

      {showLeaderboard && (
        <LeaderboardSheet onClose={() => setShowLeaderboard(false)} />
      )}
    </SafeAreaView>
  );
}

function CommunityTab() {
  const popular = useMemo(
    () => [...communityJourneys].sort((a, b) => b.participants - a.participants),
    [],
  );
  const top3 = popular.slice(0, 3);
  const rest = popular.slice(3);

  return (
    <View className="gap-5">
      <Pressable className="overflow-hidden rounded-3xl">
        <LinearGradient
          colors={['#E84D6A', '#EB489B', '#F58752']}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 1 }}
          className="p-4"
        >
          <View className="flex-row items-center gap-3">
            <View className="h-14 w-14 items-center justify-center rounded-2xl bg-black/20">
              <SymbolView
                name={{ ios: 'record.circle', android: 'fiber_manual_record', web: 'fiber_manual_record' }}
                size={18}
                tintColor="#FECACA"
              />
            </View>
            <View className="flex-1">
              <Text className="text-[10px] font-bold uppercase tracking-wider text-white/90">
                Mới · Journey Recording
              </Text>
              <Text className="text-[16px] font-extrabold leading-tight text-white">
                Ghi hành trình của bạn
              </Text>
              <Text className="mt-0.5 text-[11px] text-white/90">
                Đi tự do, app tự tạo tuyến chia sẻ
              </Text>
            </View>
            <SymbolView
              name={{ ios: 'sparkles', android: 'auto_awesome', web: 'auto_awesome' }}
              size={16}
              tintColor="#FFFFFF"
            />
          </View>
        </LinearGradient>
      </Pressable>

      <View>
        <View className="mb-2 flex-row items-center justify-between">
          <View className="flex-row items-center gap-1.5">
            <SymbolView
              name={{ ios: 'trophy.fill', android: 'emoji_events', web: 'emoji_events' }}
              size={14}
              tintColor="#EB489B"
            />
            <Text className="text-[14px] font-extrabold text-[#2B2233]">
              Tuyến được quan tâm nhiều nhất
            </Text>
          </View>
        </View>

        <View className="gap-2">
          {top3.map((journey, index) => (
            <CommunityRankCard key={journey.id} journey={journey} rank={index + 1} />
          ))}
        </View>
      </View>

      <View>
        <View className="mb-2 flex-row items-center gap-1.5">
          <SymbolView
            name={{ ios: 'globe', android: 'public', web: 'public' }}
            size={14}
            tintColor="#F58752"
          />
          <Text className="text-[14px] font-extrabold text-[#2B2233]">
            Tuyến từ cộng đồng
          </Text>
        </View>

        <View className="gap-2.5">
          {rest.map((journey) => (
            <CommunityJourneyCard key={journey.id} journey={journey} />
          ))}
        </View>
      </View>
    </View>
  );
}

function CommunityRankCard({
  journey,
  rank,
}: {
  journey: CommunityJourney;
  rank: number;
}) {
  const rankStyle =
    rank === 1
      ? 'bg-[#F58752] text-white'
      : rank === 2
        ? 'bg-[#E9F5FF] text-[#1F8FFF]'
        : 'bg-[#FFF4EF] text-[#F58752]';

  return (
    <Pressable
      className="flex-row items-center gap-3 rounded-2xl border border-[#E8EDF4] bg-white p-2.5"
      style={cardShadowStyle}
    >
      <View className={`h-8 w-8 items-center justify-center rounded-xl ${rankStyle}`}>
        <Text className="text-[12px] font-extrabold">#{rank}</Text>
      </View>
      <Image
        source={journey.cover}
        contentFit="cover"
        style={{ height: 56, width: 56, borderRadius: 12 }}
      />
      <View className="min-w-0 flex-1">
        <Text className="text-[13px] font-extrabold leading-tight text-[#2B2233]" numberOfLines={1}>
          {journey.title}
        </Text>
        <View className="mt-0.5 flex-row items-center gap-1.5">
          <SymbolView
            name={{ ios: 'person.2.fill', android: 'groups', web: 'groups' }}
            size={10}
            tintColor="#8E869A"
          />
          <Text className="text-[10px] text-[#8E869A]">
            {journey.participants.toLocaleString()} lượt tham gia
          </Text>
        </View>
        <View className="mt-0.5 flex-row items-center gap-1">
          <Image
            source={journey.creator.avatar}
            contentFit="cover"
            style={{ height: 12, width: 12, borderRadius: 999 }}
          />
          <Text className="text-[10px] text-[#8E869A]">{journey.creator.name}</Text>
        </View>
      </View>
    </Pressable>
  );
}

function CommunityJourneyCard({ journey }: { journey: CommunityJourney }) {
  return (
    <Pressable
      className="overflow-hidden rounded-3xl border border-[#E8EDF4] bg-white"
      style={cardShadowStyle}
    >
      <View style={styles.cardImageWrap}>
        <Image
          source={journey.cover}
          contentFit="cover"
          style={styles.cardImage}
        />
        <LinearGradient
          colors={['transparent', 'rgba(0,0,0,0.8)']}
          pointerEvents="none"
          style={StyleSheet.absoluteFill}
        />
        {journey.visibility === 'link' && (
          <View className="absolute left-2 top-2 rounded-full bg-black/40 px-2 py-0.5">
            <Text className="text-[10px] font-bold text-white">
              Link · còn {(journey.maxParticipants ?? 20) - journey.participants} suất
            </Text>
          </View>
        )}
        <View className="absolute bottom-2 left-2 right-2">
          <Text className="text-[14px] font-extrabold leading-tight text-white" numberOfLines={1}>
            {journey.title}
          </Text>
          <Text className="text-[10px] text-white/90">
            {journey.distance} · {journey.duration} · {journey.hotspotIds.length} điểm
          </Text>
        </View>
      </View>

      <View className="flex-row items-center gap-2 p-2.5">
        <Image
          source={journey.creator.avatar}
          contentFit="cover"
          style={{ height: 20, width: 20, borderRadius: 999 }}
        />
        <Text className="flex-1 text-[11px] font-semibold text-[#2B2233]" numberOfLines={1}>
          {journey.creator.name}
        </Text>
        <View className="flex-row items-center gap-1">
          <SymbolView
            name={{ ios: 'star.fill', android: 'star', web: 'star' }}
            size={10}
            tintColor="#FFB400"
          />
          <Text className="text-[11px] text-[#8E869A]">{journey.avgRating}</Text>
        </View>
        <View className="flex-row items-center gap-1">
          <SymbolView
            name={{ ios: 'person.2.fill', android: 'groups', web: 'groups' }}
            size={10}
            tintColor="#8E869A"
          />
          <Text className="text-[11px] text-[#8E869A]">{journey.participants}</Text>
        </View>
      </View>
    </Pressable>
  );
}

function RouteList({
  list,
  variant,
  progress,
}: {
  list: RouteItem[];
  variant: RouteVariant;
  progress?: number;
}) {
  return (
    <View className="gap-3">
      {list.map((route) => (
        <RouteCard key={route.id} route={route} variant={variant} progress={progress} />
      ))}
    </View>
  );
}

function RouteCard({
  route,
  variant,
  progress,
}: {
  route: RouteItem;
  variant: RouteVariant;
  progress?: number;
}) {
  return (
    <View
      className="overflow-hidden rounded-3xl border border-[#E8EDF4] bg-white"
      style={cardShadowStyle}
    >
      <Pressable>
        <View style={styles.cardImageWrapLarge}>
          <Image
            source={route.cover}
            contentFit="cover"
            style={styles.cardImage}
          />
          <LinearGradient
            colors={['transparent', 'rgba(0,0,0,0.8)']}
            pointerEvents="none"
            style={StyleSheet.absoluteFill}
          />

          <View style={styles.cardBadgeRow}>
            <Badge text={route.era} />
            <Badge text={route.difficulty} />
            {variant === 'completed' && (
              <View style={styles.completedBadge}>
                <SymbolView
                  name={{ ios: 'checkmark', android: 'check', web: 'check' }}
                  size={10}
                  tintColor="#FFFFFF"
                />
                <Text style={styles.completedBadgeText}>Hoàn thành</Text>
              </View>
            )}
          </View>

          <View style={styles.cardTitleWrap}>
            <Text className="text-[15px] font-extrabold leading-tight text-white">
              {route.title}
            </Text>
            <View className="mt-0.5 flex-row items-center gap-1">
              <SymbolView
                name={{ ios: 'star.fill', android: 'star', web: 'star' }}
                size={10}
                tintColor="#FFE566"
              />
              <Text className="text-[10px] text-white">{route.rating}</Text>
            </View>
          </View>
        </View>

        <View className="p-3">
          <View className="flex-row items-center gap-2">
            <Text className="text-[11px] text-[#8E869A]">{route.distance}</Text>
            <Text className="text-[11px] text-[#8E869A]">·</Text>
            <Text className="text-[11px] text-[#8E869A]">{route.duration}</Text>
            <Text className="text-[11px] text-[#8E869A]">·</Text>
            <Text className="text-[11px] text-[#8E869A]">
              {route.hotspotIds.length} điểm
            </Text>
            <View className="ml-auto rounded-full bg-[#FFF4EF] px-2 py-0.5">
              <Text className="text-[11px] font-bold text-[#F58752]">+{route.xp} XP</Text>
            </View>
          </View>
        </View>
      </Pressable>

      {variant === 'active' && progress !== undefined && (
        <View className="px-3 pb-3">
          <Text className="mb-1 text-[10px] font-bold text-[#2B2233]">
            Tiến độ {progress}%
          </Text>
          <XPBar value={progress} max={100} trackColor="#ECEEF4" height={6} />
          <Pressable className="mt-2 rounded-xl bg-[#F58752] py-2">
            <Text className="text-center text-[12px] font-bold text-white">Tiếp tục</Text>
          </Pressable>
        </View>
      )}
    </View>
  );
}

function Badge({ text }: { text: string }) {
  return (
    <View className="rounded-full bg-black/35 px-2 py-0.5">
      <Text className="text-[10px] font-bold text-white">{text}</Text>
    </View>
  );
}

function EmptyState({ text }: { text: string }) {
  return (
    <View className="items-center py-16">
      <SymbolView
        name={{ ios: 'sparkles', android: 'auto_awesome', web: 'auto_awesome' }}
        size={32}
        tintColor="#C9C3CF"
      />
      <Text className="mt-2 text-[12px] text-[#8E869A]">{text}</Text>
    </View>
  );
}

function LeaderboardSheet({ onClose }: { onClose: () => void }) {
  const [scope, setScope] = useState<'city' | 'national'>('city');
  const podium = [
    { user: leaderboard[1], rank: 2 },
    { user: leaderboard[0], rank: 1 },
    { user: leaderboard[2], rank: 3 },
  ];

  return (
    <Modal visible animationType="slide" transparent onRequestClose={onClose}>
      <View className="flex-1 justify-end bg-black/60">
        <Pressable style={StyleSheet.absoluteFill} onPress={onClose} />
        <View className="max-h-[85%] rounded-t-[32px] bg-[#F7F8FC]">
          <View className="rounded-t-[32px] bg-[#1E2433] p-4">
            <View className="mb-3 flex-row items-center justify-between">
              <View className="flex-row items-center gap-1.5">
                <SymbolView
                  name={{ ios: 'trophy.fill', android: 'emoji_events', web: 'emoji_events' }}
                  size={15}
                  tintColor="#FFE566"
                />
                <Text className="text-[16px] font-extrabold text-white">Bảng xếp hạng</Text>
              </View>
              <Pressable
                onPress={onClose}
                className="h-8 w-8 items-center justify-center rounded-full bg-white/10"
              >
                <SymbolView
                  name={{ ios: 'xmark', android: 'close', web: 'close' }}
                  size={14}
                  tintColor="#FFFFFF"
                />
              </Pressable>
            </View>

            <View className="flex-row rounded-xl bg-white/10 p-1">
              {[
                { key: 'city' as const, label: 'TP.HCM' },
                { key: 'national' as const, label: 'Toàn quốc' },
              ].map((item) => (
                <Pressable
                  key={item.key}
                  onPress={() => setScope(item.key)}
                  className={`flex-1 rounded-lg py-1.5 ${
                    scope === item.key ? 'bg-white' : ''
                  }`}
                >
                  <Text
                    className={`text-center text-[11px] font-bold ${
                      scope === item.key ? 'text-[#1E2433]' : 'text-white/80'
                    }`}
                  >
                    {item.label}
                  </Text>
                </Pressable>
              ))}
            </View>

            <View className="mt-3 flex-row items-end justify-center gap-2">
              {podium.map(({ user, rank }) => {
                const isFirst = rank === 1;

                return (
                  <View key={user.name} className="flex-1 items-center">
                    {isFirst && (
                      <SymbolView
                        name={{ ios: 'crown.fill', android: 'workspace_premium', web: 'workspace_premium' }}
                        size={18}
                        tintColor="#FFE566"
                      />
                    )}
                    <Image
                      source={user.avatar}
                      contentFit="cover"
                      style={{
                        height: isFirst ? 64 : 48,
                        width: isFirst ? 64 : 48,
                        borderRadius: 999,
                        borderWidth: 2,
                        borderColor: isFirst ? '#FFE566' : 'rgba(255,255,255,0.3)',
                        marginTop: isFirst ? 4 : 8,
                      }}
                    />
                    <Text className="mt-1 text-[10px] font-bold text-white" numberOfLines={1}>
                      {user.name.split(' ').slice(-1)}
                    </Text>
                    <View
                      className={`mt-1 w-full items-center justify-center rounded-t-xl ${
                        rank === 1
                          ? 'h-16 bg-[#F58752]'
                          : rank === 2
                            ? 'h-12 bg-[#1F8FFF]'
                            : 'h-10 bg-[#EB489B]'
                      }`}
                    >
                      <Text className="text-[10px] font-bold text-white">#{rank}</Text>
                      <Text className="text-[10px] text-white/90">
                        {user.xp.toLocaleString()}
                      </Text>
                    </View>
                  </View>
                );
              })}
            </View>
          </View>

          <ScrollView className="mx-4 my-4 max-h-80 rounded-3xl bg-white" style={cardShadowStyle}>
            {leaderboard.map((user) => (
              <View
                key={user.rank}
                className={`flex-row items-center gap-3 border-b border-[#ECEEF4] p-3 ${
                  user.name === currentUser.name ? 'bg-[#FFF4EF]' : ''
                }`}
              >
                <Text className="w-6 text-center text-[13px] font-bold text-[#8E869A]">
                  {user.rank}
                </Text>
                <Image
                  source={user.avatar}
                  contentFit="cover"
                  style={{ height: 40, width: 40, borderRadius: 999 }}
                />
                <View className="min-w-0 flex-1">
                  <Text className="text-[13px] font-semibold text-[#2B2233]" numberOfLines={1}>
                    {user.name}
                  </Text>
                  <Text className="text-[10px] text-[#8E869A]">Cấp {user.level}</Text>
                </View>
                <View className="items-end">
                  <Text className="text-[13px] font-bold text-[#2B2233]">
                    {user.xp.toLocaleString()}
                  </Text>
                  <TrendChange value={user.change} />
                </View>
              </View>
            ))}
          </ScrollView>
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  tabRow: {
    backgroundColor: '#ECEEF4',
    borderRadius: 16,
    flexDirection: 'row',
    gap: 4,
    padding: 4,
  },
  tabButton: {
    borderRadius: 12,
    paddingHorizontal: 12,
    paddingVertical: 8,
  },
  tabButtonSelected: {
    backgroundColor: '#FFFFFF',
  },
  tabLabel: {
    color: '#8E869A',
    fontSize: 12,
    fontWeight: '700',
  },
  tabLabelSelected: {
    color: '#2B2233',
  },
  cardImageWrap: {
    height: 112,
    overflow: 'hidden',
    position: 'relative',
  },
  cardImageWrapLarge: {
    height: 128,
    overflow: 'hidden',
    position: 'relative',
  },
  cardImage: {
    height: '100%',
    width: '100%',
  },
  cardBadgeRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 4,
    left: 8,
    position: 'absolute',
    top: 8,
  },
  cardTitleWrap: {
    bottom: 8,
    left: 8,
    position: 'absolute',
    right: 8,
  },
  completedBadge: {
    alignItems: 'center',
    backgroundColor: '#34C759',
    borderRadius: 999,
    flexDirection: 'row',
    gap: 2,
    paddingHorizontal: 8,
    paddingVertical: 2,
  },
  completedBadgeText: {
    color: '#FFFFFF',
    fontSize: 10,
    fontWeight: '700',
  },
});

function TrendChange({ value }: { value: number }) {
  const color =
    value > 0 ? 'text-[#34C759]' : value < 0 ? 'text-[#E84D6A]' : 'text-[#8E869A]';
  const icon: SymbolName =
    value > 0
      ? { ios: 'arrow.up.right', android: 'trending_up', web: 'trending_up' }
      : value < 0
        ? { ios: 'arrow.down.right', android: 'trending_down', web: 'trending_down' }
        : { ios: 'minus', android: 'remove', web: 'remove' };

  return (
    <View className="flex-row items-center gap-0.5">
      <SymbolView name={icon} size={9} tintColor={value > 0 ? '#34C759' : value < 0 ? '#E84D6A' : '#8E869A'} />
      <Text className={`text-[10px] ${color}`}>{Math.abs(value) || '-'}</Text>
    </View>
  );
}
