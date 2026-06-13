import { Image } from 'expo-image';
import { LinearGradient } from 'expo-linear-gradient';
import { type Href, useLocalSearchParams, useRouter } from 'expo-router';
import { SymbolView } from 'expo-symbols';
import { type ReactNode } from 'react';
import { Pressable, ScrollView, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { useCheckins } from '@/lib/checkin-store';
import {
  type RouteReview,
  type RouteStop,
  getRoute,
  getRouteHotspots,
  getRouteRating,
  getRouteReviews,
} from '@/lib/demo-data';
import { getHotspotDetailHref } from '@/lib/hotspot-navigation';

const cardShadow = {
  shadowColor: 'rgba(28, 45, 80, 0.10)',
  shadowOpacity: 1,
  shadowRadius: 16,
  shadowOffset: { width: 0, height: 8 },
  elevation: 5,
} as const;

const glowShadow = {
  shadowColor: 'rgba(235, 72, 155, 0.32)',
  shadowOpacity: 1,
  shadowRadius: 18,
  shadowOffset: { width: 0, height: 8 },
  elevation: 10,
} as const;

const stopMarkerPositions = [
  { x: '22%', y: '38%' },
  { x: '38%', y: '52%' },
  { x: '52%', y: '42%' },
  { x: '64%', y: '58%' },
  { x: '48%', y: '68%' },
  { x: '72%', y: '44%' },
  { x: '30%', y: '62%' },
  { x: '58%', y: '30%' },
] as const;

const ratingDist = [
  { star: 5, pct: 72 },
  { star: 4, pct: 21 },
  { star: 3, pct: 5 },
  { star: 2, pct: 1 },
  { star: 1, pct: 1 },
];

const feedbackTags = ['Đáng đi', 'Storytelling hay', 'Đi bộ thoải mái', 'Chụp ảnh đẹp', 'Đi sáng sớm'];

function XPBar({
  value,
  max,
  trackColor = '#ECEEF4',
  height = 8,
}: {
  value: number;
  max: number;
  trackColor?: string;
  height?: number;
}) {
  const percent = max > 0 ? Math.min(Math.max((value / max) * 100, 0), 100) : 0;

  return (
    <View className="flex-1 overflow-hidden rounded-full" style={{ backgroundColor: trackColor, height }}>
      <LinearGradient
        colors={['#FFE566', '#FFB400']}
        start={{ x: 0, y: 0.5 }}
        end={{ x: 1, y: 0.5 }}
        style={{ borderRadius: 999, height: '100%', width: `${percent}%` }}
      />
    </View>
  );
}

function RouteMapHero({
  stops,
  routeHotspotIds,
  checkedInIds,
}: {
  stops: RouteStop[];
  routeHotspotIds: string[];
  checkedInIds: string[];
}) {
  return (
    <View className="relative h-72 overflow-hidden bg-[#E8F0FE]">
      <Image
        source={stops[0]?.image}
        contentFit="cover"
        style={{ position: 'absolute', inset: 0, opacity: 0.35 }}
      />
      <View className="absolute inset-0 bg-[#4A80F5]/10" />

      {routeHotspotIds.map((id, index) => {
        const pos = stopMarkerPositions[index % stopMarkerPositions.length];
        const done = checkedInIds.includes(id);
        return (
          <View
            key={id}
            className="absolute h-7 w-7 items-center justify-center rounded-full border-2 border-white"
            style={{
              left: pos.x,
              top: pos.y,
              backgroundColor: done ? '#F58752' : '#EB489B',
            }}
          >
            {done ? (
              <SymbolView
                name={{ ios: 'checkmark', android: 'check', web: 'check' }}
                size={12}
                tintColor="#fff"
              />
            ) : (
              <Text className="text-[10px] font-bold text-white">{index + 1}</Text>
            )}
          </View>
        );
      })}

      <LinearGradient
        colors={['rgba(0,0,0,0.6)', 'transparent']}
        className="absolute inset-x-0 top-0 h-32"
        pointerEvents="none"
      />
      <LinearGradient
        colors={['transparent', '#FFFFFF']}
        className="absolute inset-x-0 bottom-0 h-20"
        pointerEvents="none"
      />
    </View>
  );
}

function Stat({
  icon,
  label,
  hint,
  highlight,
}: {
  icon: ReactNode;
  label: string;
  hint: string;
  highlight?: boolean;
}) {
  return (
    <View className={`flex-1 rounded-2xl p-2 ${highlight ? 'bg-[#FFF5E8]' : 'bg-[#F4EFF8]'}`}>
      <View className="mb-0.5 items-center">{icon}</View>
      <Text
        className={`text-center text-[12px] font-bold leading-tight ${highlight ? 'text-[#B86D2A]' : 'text-[#2B2233]'}`}
      >
        {label}
      </Text>
      <Text
        className={`text-center text-[9px] ${highlight ? 'text-[#B86D2A]/80' : 'text-[#8E869A]'}`}
      >
        {hint}
      </Text>
    </View>
  );
}

function StoryCard({
  title,
  body,
  emoji,
  tone = 'default',
}: {
  title: string;
  body: string;
  emoji: string;
  tone?: 'default' | 'jade' | 'sunset';
}) {
  const bgClass =
    tone === 'jade'
      ? 'border-[#F58752]/20 bg-[#FFF4EF]'
      : tone === 'sunset'
        ? 'border-[#EB489B]/20 bg-[#FFF8FC]'
        : 'border-[#E8EDF4] bg-white';

  return (
    <View className={`rounded-2xl border p-4 ${bgClass}`}>
      <View className="mb-1.5 flex-row items-center gap-2">
        <Text className="text-lg">{emoji}</Text>
        <Text className="text-[14px] font-bold text-[#2B2233]">{title}</Text>
      </View>
      <Text className="text-[12.5px] leading-5 text-[#3D3446]/85">{body}</Text>
    </View>
  );
}

function Stars({ rating, size = 11 }: { rating: number; size?: number }) {
  return (
    <View className="flex-row gap-0.5">
      {Array.from({ length: 5 }).map((_, i) => (
        <Text
          key={i}
          style={{ fontSize: size, color: i < rating ? '#EB489B' : '#D4C8DE' }}
        >
          ★
        </Text>
      ))}
    </View>
  );
}

function RouteReviewCard({ review }: { review: RouteReview }) {
  return (
    <View className="rounded-2xl bg-white p-3.5" style={cardShadow}>
      <View className="flex-row items-center gap-2.5">
        <Image
          source={review.avatar}
          contentFit="cover"
          style={{ width: 40, height: 40, borderRadius: 20 }}
        />
        <View className="min-w-0 flex-1">
          <View className="flex-row items-center gap-1.5">
            <Text className="text-[13px] font-semibold text-[#2B2233]">{review.user}</Text>
            <View className="rounded-full bg-[#FFF4EF] px-1.5 py-0.5">
              <Text className="text-[9px] font-bold text-[#F58752]">Đã hoàn thành</Text>
            </View>
          </View>
          <View className="mt-0.5 flex-row items-center gap-1">
            <SymbolView
              name={{ ios: 'clock', android: 'schedule', web: 'schedule' }}
              size={9}
              tintColor="#8E869A"
            />
            <Text className="text-[10px] text-[#8E869A]">
              {review.completedIn} · {review.date}
            </Text>
          </View>
        </View>
        <Stars rating={review.rating} size={10} />
      </View>

      <Text className="mt-2 text-[12.5px] font-bold text-[#EB489B]">
        &ldquo;{review.highlight}&rdquo;
      </Text>
      <Text className="mt-1 text-[12px] leading-5 text-[#3D3446]/85">{review.text}</Text>

      <View className="mt-2 flex-row flex-wrap gap-1.5">
        {review.tags.map((tag) => (
          <View key={tag} className="rounded-full bg-[#F4EFF8] px-2 py-0.5">
            <Text className="text-[9.5px] font-semibold text-[#3D3446]/75">#{tag}</Text>
          </View>
        ))}
      </View>

      <View className="mt-2.5 flex-row items-center justify-between border-t border-[#E8EDF4]/60 pt-2.5">
        <Pressable className="flex-row items-center gap-1.5">
          <SymbolView
            name={{ ios: 'hand.thumbsup', android: 'thumb_up', web: 'thumb_up' }}
            size={12}
            tintColor="#8E869A"
          />
          <Text className="text-[11px] font-semibold text-[#8E869A]">
            Hữu ích · {review.helpful}
          </Text>
        </Pressable>
        <Text className="text-[10px] text-[#8E869A]">Trả lời</Text>
      </View>
    </View>
  );
}

export default function RouteDetailScreen() {
  const { id: routeId } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const checkins = useCheckins();

  const route = getRoute(routeId ?? '');

  if (!route) {
    return (
      <SafeAreaView className="flex-1 items-center justify-center bg-white">
        <Text className="text-[16px] text-[#8E869A]">Tuyến không tồn tại</Text>
        <Pressable onPress={() => router.back()} className="mt-4">
          <Text className="text-[14px] font-bold text-[#EB489B]">Quay lại</Text>
        </Pressable>
      </SafeAreaView>
    );
  }

  const stops = getRouteHotspots(routeId ?? '');
  const completed = stops.filter((s) => checkins.includes(s.id)).length;
  const progress = stops.length > 0 ? (completed / stops.length) * 100 : 0;
  const reviews = getRouteReviews(routeId ?? '');
  const rating = getRouteRating(routeId ?? '');
  const isFinished = completed === stops.length && stops.length > 0;

  return (
    <View className="flex-1 bg-white">
      <ScrollView className="flex-1" contentContainerStyle={{ paddingBottom: 120 }} showsVerticalScrollIndicator={false}>
        <View className="relative">
          <RouteMapHero
            stops={stops}
            routeHotspotIds={route.hotspotIds}
            checkedInIds={checkins}
          />

          <SafeAreaView edges={['top']} className="absolute inset-x-0 top-0">
            <View className="flex-row items-center justify-between px-3 pt-2">
              <Pressable
                onPress={() => router.back()}
                className="h-10 w-10 items-center justify-center rounded-full bg-black/30"
              >
                <SymbolView
                  name={{ ios: 'chevron.left', android: 'arrow_back', web: 'arrow_back' }}
                  size={18}
                  tintColor="#fff"
                />
              </Pressable>
              <View className="flex-row gap-2">
                <Pressable className="h-10 w-10 items-center justify-center rounded-full bg-black/30">
                  <SymbolView
                    name={{ ios: 'arrow.down.circle', android: 'download', web: 'download' }}
                    size={16}
                    tintColor="#fff"
                  />
                </Pressable>
                <Pressable className="h-10 w-10 items-center justify-center rounded-full bg-black/30">
                  <SymbolView
                    name={{ ios: 'square.and.arrow.up', android: 'share', web: 'share' }}
                    size={16}
                    tintColor="#fff"
                  />
                </Pressable>
              </View>
            </View>
          </SafeAreaView>
        </View>

        <View className="relative -mt-8 px-4">
          <View className="rounded-3xl bg-white p-5" style={cardShadow}>
            <View className="flex-row items-center gap-2">
              <SymbolView
                name={{ ios: 'sparkles', android: 'auto_awesome', web: 'auto_awesome' }}
                size={12}
                tintColor="#EB489B"
              />
              <Text className="text-[10px] font-semibold uppercase tracking-wider text-[#EB489B]">
                Tuyến chủ đề · {route.era}
              </Text>
            </View>
            <Text className="mt-1 text-[24px] font-extrabold leading-tight text-[#2B2233]">
              {route.title}
            </Text>
            <Text className="mt-1 text-[13px] text-[#8E869A]">{route.subtitle}</Text>

            <View className="mt-4 flex-row gap-2">
              <Stat
                icon={
                  <SymbolView
                    name={{ ios: 'figure.walk', android: 'directions_walk', web: 'directions_walk' }}
                    size={14}
                    tintColor="#8E869A"
                  />
                }
                label={route.distance}
                hint="Quãng đường"
              />
              <Stat
                icon={
                  <SymbolView
                    name={{ ios: 'clock', android: 'schedule', web: 'schedule' }}
                    size={14}
                    tintColor="#8E869A"
                  />
                }
                label={route.duration}
                hint="Thời lượng"
              />
              <Stat
                icon={
                  <SymbolView
                    name={{ ios: 'mountain.2', android: 'terrain', web: 'terrain' }}
                    size={14}
                    tintColor="#8E869A"
                  />
                }
                label={route.difficulty}
                hint="Độ khó"
              />
              <Stat
                icon={<Text className="text-[11px] font-bold text-[#B86D2A]">XP</Text>}
                label={`+${route.xp}`}
                hint="Phần thưởng"
                highlight
              />
            </View>

            <View className="mt-4 flex-row items-center gap-2">
              <XPBar value={completed} max={stops.length} />
              <Text className="text-[11px] font-bold text-[#2B2233]">
                {completed}/{stops.length}
              </Text>
            </View>
            <Text className="mt-1 text-[10px] text-[#8E869A]">
              Tiến độ {Math.round(progress)}% · check-in theo bất kỳ thứ tự nào
            </Text>
          </View>

          <View className="mt-4 gap-3">
            <StoryCard title="Chủ đề tuyến đường" body={route.theme} emoji="🎭" />
            <StoryCard title="Ý nghĩa lịch sử" body={route.meaning} emoji="🏛️" tone="jade" />
            <StoryCard title="Câu chuyện hành trình" body={route.story} emoji="📖" tone="sunset" />
            <StoryCard title="Vì sao kết nối với nhau?" body={route.connection} emoji="🧭" />
          </View>

          <View className="mt-6">
            <Text className="mb-3 text-[18px] font-bold text-[#2B2233]">Hành trình của bạn</Text>
            <View className="pl-7">
              <View className="absolute bottom-2 left-3 top-2 w-px bg-[#EB489B]/40" />
              {stops.map((stop, index) => {
                const done = checkins.includes(stop.id);
                return (
                  <Pressable
                    key={stop.id}
                    onPress={() => {
                      const href = getHotspotDetailHref(stop.id);
                      if (href) router.push(href);
                    }}
                    className="relative flex-row gap-3 pb-4"
                  >
                    <View
                      className={`absolute -left-7 top-2 h-6 w-6 items-center justify-center rounded-full border-2 border-white ${
                        done ? 'bg-[#F58752]' : 'bg-[#EB489B]'
                      }`}
                    >
                      {done ? (
                        <SymbolView
                          name={{ ios: 'checkmark.circle.fill', android: 'check_circle', web: 'check_circle' }}
                          size={12}
                          tintColor="#fff"
                        />
                      ) : (
                        <Text className="text-[10px] font-bold text-white">{index + 1}</Text>
                      )}
                    </View>
                    <Image
                      source={stop.image}
                      contentFit="cover"
                      style={{ width: 64, height: 64, borderRadius: 16 }}
                    />
                    <View className="min-w-0 flex-1">
                      <Text className="text-[14px] font-semibold text-[#2B2233]" numberOfLines={1}>
                        {stop.name}
                      </Text>
                      <Text className="text-[11px] text-[#8E869A]" numberOfLines={1}>
                        {stop.address}
                      </Text>
                      <View className="mt-1.5 flex-row items-center gap-2">
                        <View className="rounded-full bg-[#F4EFF8] px-2 py-0.5">
                          <Text className="text-[10px] text-[#2B2233]">{stop.distance}</Text>
                        </View>
                        <View className="rounded-full bg-[#F4EFF8] px-2 py-0.5">
                          <Text className="text-[10px] text-[#2B2233]">{stop.duration}</Text>
                        </View>
                        <Text className="ml-auto text-[10px] font-bold text-[#EB489B]">
                          +{stop.xp} XP
                        </Text>
                      </View>
                    </View>
                  </Pressable>
                );
              })}
            </View>
          </View>

          <View className="mt-5 rounded-3xl border border-[#EB489B]/20 bg-[#FFF8FC] p-4">
            <View className="flex-row items-center gap-2">
              <View className="h-8 w-8 items-center justify-center rounded-xl bg-[#241C2C]">
                <SymbolView
                  name={{ ios: 'sparkles', android: 'auto_awesome', web: 'auto_awesome' }}
                  size={14}
                  tintColor="#FFC93C"
                />
              </View>
              <View>
                <Text className="text-[10px] font-bold uppercase tracking-wider text-[#F58752]">
                  AI Gợi ý
                </Text>
                <Text className="text-[13px] font-semibold text-[#2B2233]">
                  Tuyến này hợp với bạn 94%
                </Text>
              </View>
            </View>
            <Text className="mt-2 text-[12px] leading-5 text-[#3D3446]/80">
              Dựa trên 7 tuyến bạn đã hoàn thành, bạn yêu kiến trúc Pháp thuộc. Tuyến này có 3/4 điểm
              khớp sở thích — và thời tiết sáng mai lý tưởng để đi bộ ☀️ 26°C.
            </Text>
          </View>

          <Pressable className="mt-3 flex-row items-center justify-between rounded-2xl bg-[#F4EFF8] p-3.5">
            <View className="flex-row items-center gap-2.5">
              <SymbolView
                name={{ ios: 'arrow.down.circle', android: 'download', web: 'download' }}
                size={16}
                tintColor="#F58752"
              />
              <View>
                <Text className="text-[13px] font-semibold text-[#2B2233]">
                  Tải về để dùng offline
                </Text>
                <Text className="text-[10px] text-[#8E869A]">Bản đồ + story · 12.4 MB</Text>
              </View>
            </View>
            <Text className="text-[11px] font-bold text-[#F58752]">Tải xuống</Text>
          </Pressable>

          <View className="mt-6">
            <View className="mb-3 flex-row items-center justify-between">
              <Text className="text-[18px] font-bold text-[#2B2233]">Phản hồi về tuyến</Text>
              <Text className="text-[10px] text-[#8E869A]">{rating.count} đánh giá</Text>
            </View>

            <View className="rounded-3xl bg-white p-4" style={cardShadow}>
              <View className="flex-row items-center gap-4">
                <View className="items-center">
                  <Text className="text-[36px] font-extrabold leading-none text-[#2B2233]">
                    {rating.avg}
                  </Text>
                  <Stars rating={Math.round(rating.avg)} />
                  <Text className="mt-0.5 text-[10px] text-[#8E869A]">{rating.count} người</Text>
                </View>
                <View className="flex-1 gap-1">
                  {ratingDist.map((d) => (
                    <View key={d.star} className="flex-row items-center gap-2">
                      <Text className="w-3 text-[10px] text-[#8E869A]">{d.star}</Text>
                      <Text style={{ fontSize: 9, color: '#EB489B' }}>★</Text>
                      <View className="h-1.5 flex-1 overflow-hidden rounded-full bg-[#F4EFF8]">
                        <LinearGradient
                          colors={['#EB489B', '#F58752']}
                          start={{ x: 0, y: 0.5 }}
                          end={{ x: 1, y: 0.5 }}
                          style={{ height: '100%', width: `${d.pct}%`, borderRadius: 999 }}
                        />
                      </View>
                      <Text className="w-7 text-right text-[10px] text-[#8E869A]">{d.pct}%</Text>
                    </View>
                  ))}
                </View>
              </View>

              <View className="mt-3 flex-row flex-wrap gap-1.5">
                {feedbackTags.map((tag) => (
                  <View key={tag} className="rounded-full bg-[#F4EFF8] px-2.5 py-1">
                    <Text className="text-[10px] font-semibold text-[#3D3446]/80">{tag}</Text>
                  </View>
                ))}
              </View>
            </View>

            <Pressable
              disabled={!isFinished}
              className={`mt-3 flex-row items-center gap-3 rounded-2xl p-3.5 ${
                isFinished ? 'border border-[#EB489B]/30 bg-[#FFF8FC]' : 'bg-[#F4EFF8] opacity-80'
              }`}
            >
              <View className="h-10 w-10 items-center justify-center rounded-xl bg-[#EB489B]">
                <SymbolView
                  name={{ ios: 'pencil', android: 'edit', web: 'edit' }}
                  size={16}
                  tintColor="#fff"
                />
              </View>
              <View className="flex-1">
                <Text className="text-[13px] font-bold text-[#2B2233]">
                  {isFinished ? 'Chia sẻ trải nghiệm tuyến này' : 'Hoàn thành tuyến để viết feedback'}
                </Text>
                <Text className="text-[10px] text-[#8E869A]">
                  {isFinished
                    ? '+50 XP cho đánh giá có ảnh'
                    : `Còn ${stops.length - completed} điểm check-in`}
                </Text>
              </View>
              {isFinished && (
                <Text className="text-[11px] font-bold text-[#EB489B]">Viết ngay</Text>
              )}
            </Pressable>

            <View className="mt-3 gap-3">
              {reviews.map((review) => (
                <RouteReviewCard key={review.id} review={review} />
              ))}
            </View>
          </View>
        </View>
      </ScrollView>

      <View className="absolute inset-x-0 bottom-0 px-4 pb-6 pt-2">
        <View
          className="flex-row gap-2 rounded-2xl bg-white/95 p-2.5"
          style={cardShadow}
        >
          <Pressable className="h-12 w-12 items-center justify-center rounded-xl bg-[#F4EFF8]">
            <SymbolView
              name={{ ios: 'lock.fill', android: 'lock', web: 'lock' }}
              size={16}
              tintColor="#8E869A"
            />
          </Pressable>
          <Pressable
            onPress={() =>
              router.push(`/checkin/${stops[0]?.id}?routeId=${routeId}` as Href)
            }
            className="flex-1 overflow-hidden rounded-xl"
            style={glowShadow}
          >
            <LinearGradient
              colors={['#EB489B', '#F58752']}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 0 }}
              className="flex-row items-center justify-center gap-2 py-3.5"
            >
              <SymbolView
                name={{ ios: 'play.fill', android: 'play_arrow', web: 'play_arrow' }}
                size={16}
                tintColor="#fff"
              />
              <Text className="text-[14px] font-bold text-white">Bắt đầu hành trình</Text>
            </LinearGradient>
          </Pressable>
        </View>
      </View>
    </View>
  );
}
