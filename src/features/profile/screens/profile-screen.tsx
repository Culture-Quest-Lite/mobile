import { Image } from 'expo-image';
import { LinearGradient } from 'expo-linear-gradient';
import { type Href, useRouter } from 'expo-router';
import { SymbolView } from 'expo-symbols';
import { type ComponentProps, useState } from 'react';
import { Pressable, ScrollView, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { useProfile } from '../hooks/use-profile';
import type { ProfileBadge, ProfilePost } from '../types';
import {
  resetAuthSessionToGuest,
  useAuthSession,
} from '@/features/auth/hooks/use-auth-session';
import type { RouteItem } from '@/lib/demo-data';

type Tab = 'posts' | 'routes';
type SymbolName = ComponentProps<typeof SymbolView>['name'];

const sunsetColors = ['#EB489B', '#F58752', '#FFC93C'] as const;

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

const TAB_ITEMS: { key: Tab; label: string; icon: SymbolName }[] = [
  {
    key: 'posts',
    label: 'Bài viết',
    icon: { ios: 'doc.text', android: 'article', web: 'article' },
  },
  {
    key: 'routes',
    label: 'Tuyến cộng đồng',
    icon: { ios: 'safari', android: 'explore', web: 'explore' },
  },
];

const BADGE_EMOJI: Record<ProfileBadge, string> = {
  'heritage-master': '🏛️',
  storyteller: '📖',
  'early-bird': '🌅',
  photographer: '📸',
  explorer: '🧭',
};

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

export default function ProfileScreen() {
  const router = useRouter();
  const authSession = useAuthSession();
  const { profile, posts, userRoutes } = useProfile();
  const [tab, setTab] = useState<Tab>('posts');
  const isAuthenticated = authSession.isAuthenticated;

  const handleLogout = () => {
    resetAuthSessionToGuest();
    router.replace('/home');
  };

  if (!profile) {
    return (
      <SafeAreaView className="flex-1 items-center justify-center bg-[#F7F8FC]">
        <Text className="text-[14px] text-[#8E869A]">Không tìm thấy hồ sơ</Text>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView className="flex-1 bg-[#F7F8FC]" edges={['top', 'left', 'right']}>
      <ScrollView
        className="flex-1"
        contentContainerStyle={{ paddingBottom: 32 }}
        showsVerticalScrollIndicator={false}
      >
        <View className="relative h-44">
          <Image
            source={profile.cover}
            contentFit="cover"
            transition={180}
            cachePolicy="memory-disk"
            style={{ width: '100%', height: '100%' }}
          />
          <LinearGradient
            colors={['rgba(0,0,0,0.4)', 'rgba(247,248,252,0.3)', '#F7F8FC']}
            locations={[0, 0.55, 1]}
            style={{ position: 'absolute', inset: 0 }}
          />
          <View className="absolute left-3 right-3 top-3 flex-row items-center justify-between">
            <View className="w-10" />
            <Text className="text-[14px] font-extrabold text-white drop-shadow">
              Hồ sơ Explorer
            </Text>
            <Pressable className="h-10 w-10 items-center justify-center rounded-full bg-black/30">
              <SymbolView
                name={{ ios: 'square.and.arrow.up', android: 'share', web: 'share' }}
                size={15}
                tintColor="#FFFFFF"
              />
            </Pressable>
          </View>
        </View>

        <View className="-mt-14 px-4">
          <View className="flex-row items-end gap-3">
            <View className="relative">
              <Image
                source={profile.avatar}
                contentFit="cover"
                transition={180}
                cachePolicy="memory-disk"
                style={{
                  width: 96,
                  height: 96,
                  borderRadius: 24,
                  borderWidth: 4,
                  borderColor: '#F7F8FC',
                }}
              />
              <LinearGradient
                colors={['#FFE566', '#FFB400']}
                start={{ x: 0, y: 0 }}
                end={{ x: 1, y: 1 }}
                style={{
                  position: 'absolute',
                  bottom: -4,
                  right: -4,
                  borderRadius: 12,
                  paddingHorizontal: 8,
                  paddingVertical: 2,
                  ...cardShadow,
                }}
              >
                <Text className="text-[11px] font-extrabold text-[#5C3D00]">
                  Lv {profile.level}
                </Text>
              </LinearGradient>
            </View>

            <View className="min-w-0 flex-1 pb-1">
              <Text className="text-[20px] font-extrabold leading-tight text-[#2B2233]">
                {profile.name}
              </Text>
              <Text className="text-[12px] text-[#8E869A]">
                {profile.username} · {profile.title}
              </Text>
            </View>
          </View>

          <Pressable
            className="mt-4 flex-row items-center justify-center gap-2 rounded-2xl py-3"
            style={glowShadow}
          >
            <LinearGradient
              colors={sunsetColors}
              start={{ x: 0, y: 0.5 }}
              end={{ x: 1, y: 0.5 }}
              style={{
                position: 'absolute',
                inset: 0,
                borderRadius: 16,
              }}
            />
            <SymbolView
              name={{ ios: 'pencil', android: 'edit', web: 'edit' }}
              size={16}
              tintColor="#FFFFFF"
            />
            <Text className="text-[14px] font-extrabold text-white">Chỉnh sửa hồ sơ</Text>
          </Pressable>

          <View className="mt-3 rounded-2xl bg-white p-3" style={cardShadow}>
            <View className="mb-1.5 flex-row items-center justify-between">
              <Text className="text-[11px] font-extrabold text-[#2B2233]">
                {profile.xp.toLocaleString()} XP
              </Text>
              <Text className="text-[11px] text-[#8E869A]">Cấp {profile.level}</Text>
            </View>
            <XPBar value={profile.xp} max={profile.xpToNext} />
            <Text className="mt-1.5 text-[10px] text-[#8E869A]">
              Còn {profile.xpToNext - profile.xp} XP để lên cấp {profile.level + 1}
            </Text>
          </View>

          <View className="mt-3 flex-row gap-2">
            <ProfileStat n={profile.followers} label="Người theo dõi" />
            <ProfileStat n={profile.following} label="Đang theo dõi" />
            <ProfileStat n={posts.length} label="Bài viết" />
          </View>

          <View className="mt-4">
            <View className="mb-2 flex-row items-center gap-1.5">
              <SymbolView
                name={{ ios: 'medal.fill', android: 'military_tech', web: 'military_tech' }}
                size={14}
                tintColor="#EB489B"
              />
              <Text className="text-[14px] font-extrabold text-[#2B2233]">Huy hiệu</Text>
            </View>
            <ScrollView
              horizontal
              showsHorizontalScrollIndicator={false}
              contentContainerStyle={{ gap: 8 }}
            >
              {profile.badges.map((badge) => (
                <View
                  key={badge}
                  className="h-16 w-16 items-center justify-center rounded-2xl border border-[#EB489B]/30 bg-[#FFF4EF]"
                >
                  <Text className="text-2xl">{BADGE_EMOJI[badge] ?? '🧭'}</Text>
                </View>
              ))}
            </ScrollView>
          </View>

          <View className="mt-5 flex-row rounded-2xl bg-[#ECEEF4] p-1">
            {TAB_ITEMS.map((item) => {
              const selected = tab === item.key;
              return (
                <Pressable
                  key={item.key}
                  onPress={() => setTab(item.key)}
                  className={`flex-1 flex-row items-center justify-center gap-1.5 rounded-xl py-2 ${
                    selected ? 'bg-white' : ''
                  }`}
                  style={selected ? cardShadow : undefined}
                >
                  <SymbolView
                    name={item.icon}
                    size={12}
                    tintColor={selected ? '#2B2233' : '#8E869A'}
                  />
                  <Text
                    className={`text-[12px] font-extrabold ${
                      selected ? 'text-[#2B2233]' : 'text-[#8E869A]'
                    }`}
                  >
                    {item.label}
                  </Text>
                </Pressable>
              );
            })}
          </View>

          <View className="mt-4">
            {tab === 'posts' ? (
              posts.length === 0 ? (
                <EmptyPosts />
              ) : (
                <View className="gap-3">
                  {posts.map((post) => (
                    <PostCard key={post.id} post={post} />
                  ))}
                </View>
              )
            ) : userRoutes.length === 0 ? (
              <EmptyRoutes />
            ) : (
              <View className="gap-2">
                {userRoutes.map((route) => (
                  <RouteCard
                    key={route.id}
                    route={route}
                    onPress={() => router.push(`/route/${route.id}` as Href)}
                  />
                ))}
              </View>
            )}
          </View>

          {isAuthenticated ? (
            <View className="mt-8 border-t border-[#F1E3E8] pb-2 pt-5">
              <Pressable
                onPress={handleLogout}
                className="flex-row items-center justify-center gap-2 py-2"
              >
                <SymbolView
                  name={{
                    ios: 'rectangle.portrait.and.arrow.right',
                    android: 'logout',
                    web: 'logout',
                  }}
                  size={16}
                  tintColor="#FF6B57"
                />
                <Text className="text-[16px] font-extrabold text-[#FF6B57]">
                  Đăng xuất
                </Text>
              </Pressable>
            </View>
          ) : null}
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

function ProfileStat({ n, label }: { n: number; label: string }) {
  return (
    <View className="flex-1 rounded-2xl bg-white py-2.5" style={cardShadow}>
      <Text className="text-center text-[15px] font-extrabold text-[#2B2233]">
        {n.toLocaleString()}
      </Text>
      <Text className="mt-0.5 text-center text-[9px] leading-tight text-[#8E869A]">
        {label}
      </Text>
    </View>
  );
}

function PostCard({ post }: { post: ProfilePost }) {
  return (
    <View className="rounded-2xl bg-white p-3" style={cardShadow}>
      <Text className="text-[12px] leading-relaxed text-[#2B2233]">{post.text}</Text>
      {post.image ? (
        <Image
          source={post.image}
          contentFit="cover"
          transition={180}
          cachePolicy="memory-disk"
          style={{
            marginTop: 8,
            width: '100%',
            aspectRatio: 4 / 3,
            borderRadius: 12,
          }}
        />
      ) : null}
      <Text className="mt-2 text-[10px] text-[#8E869A]">
        {post.time} · {post.likes} thích · {post.comments} bình luận
      </Text>
    </View>
  );
}

function RouteCard({ route, onPress }: { route: RouteItem; onPress: () => void }) {
  return (
    <Pressable onPress={onPress} className="flex-row gap-3 rounded-2xl bg-white p-2" style={cardShadow}>
      <Image
        source={route.cover}
        contentFit="cover"
        transition={180}
        cachePolicy="memory-disk"
        style={{ width: 64, height: 64, borderRadius: 12 }}
      />
      <View className="min-w-0 flex-1 justify-center">
        <Text className="text-[13px] font-semibold text-[#2B2233]" numberOfLines={1}>
          {route.title}
        </Text>
        <Text className="text-[10px] text-[#8E869A]">
          {route.distance} · {route.duration}
        </Text>
        <Text className="mt-0.5 text-[10px] font-extrabold text-[#F58752]">+{route.xp} XP</Text>
      </View>
    </Pressable>
  );
}

function EmptyPosts() {
  return (
    <View className="items-center py-12">
      <SymbolView
        name={{ ios: 'photo', android: 'image', web: 'image' }}
        size={36}
        tintColor="#AA9FB0"
      />
      <Text className="mt-2 text-[12px] text-[#8E869A]">Bạn chưa có bài đăng nào</Text>
    </View>
  );
}

function EmptyRoutes() {
  return (
    <View className="items-center py-12">
      <SymbolView
        name={{ ios: 'map', android: 'map', web: 'map' }}
        size={36}
        tintColor="#AA9FB0"
      />
      <Text className="mt-2 text-[12px] text-[#8E869A]">Chưa có tuyến cộng đồng nào</Text>
    </View>
  );
}
