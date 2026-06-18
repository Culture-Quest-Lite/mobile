import { Image } from 'expo-image';
import { LinearGradient } from 'expo-linear-gradient';
import { SymbolView } from 'expo-symbols';
import { useMemo, useState } from 'react';
import { Pressable, ScrollView, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { useProfile } from '../hooks/use-profile';

const cardShadow = {
  shadowColor: 'rgba(15, 23, 42, 0.12)',
  shadowOpacity: 1,
  shadowRadius: 20,
  shadowOffset: { width: 0, height: 10 },
  elevation: 10,
} as const;

const buttonShadow = {
  shadowColor: 'rgba(15, 23, 42, 0.16)',
  shadowOpacity: 1,
  shadowRadius: 12,
  shadowOffset: { width: 0, height: 5 },
  elevation: 7,
} as const;

type TabKey = 'posts' | 'activity';

const TAB_ITEMS: { key: TabKey; label: string }[] = [
  { key: 'posts', label: 'Bài đăng' },
  { key: 'activity', label: 'Hoạt động' },
];

const vouchers = [
  { id: 'v1', title: 'Giảm 10% tour di sản', cost: 500 },
  { id: 'v2', title: 'Voucher cà phê miễn phí', cost: 1200 },
  { id: 'v3', title: 'Giảm giá 20% quà lưu niệm', cost: 1800 },
];

export default function ProfileScreen() {
  const { profile, posts, userRoutes } = useProfile();
  const [activeTab, setActiveTab] = useState<TabKey>('posts');

  const galleryImages = useMemo(
    () =>
      posts
        .map((post) => post.image)
        .filter((image): image is string => Boolean(image))
        .slice(0, 4),
    [posts],
  );

  const xpProgress = profile ? Math.min((profile.xp / profile.xpToNext) * 100, 100) : 0;

  if (!profile) {
    return (
      <SafeAreaView className="flex-1 items-center justify-center bg-[#EBEFF5]">
        <Text className="text-base text-[#667085]">Không tìm thấy hồ sơ</Text>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView className="flex-1 bg-[#EBEFF5]" edges={['top', 'left', 'right']}>
      <ScrollView
        className="flex-1"
        contentContainerStyle={{ paddingBottom: 32 }}
        showsVerticalScrollIndicator={false}
      >
        <View className="relative h-64 bg-slate-100">
          <Image
            source={profile.cover}
            contentFit="cover"
            transition={180}
            cachePolicy="memory-disk"
            style={{ width: '100%', height: '100%' }}
          />
          <LinearGradient
            colors={['rgba(15, 23, 42, 0.35)', 'rgba(255, 255, 255, 0.95)']}
            locations={[0, 0.75]}
            style={{ position: 'absolute', inset: 0 }}
          />
          <View className="absolute inset-x-0 top-4 px-4 flex-row items-center justify-between">
            <View style={{ width: 40 }} />
            <Text className="text-sm font-extrabold text-white drop-shadow">Hồ sơ Explorer</Text>
            <Pressable className="h-10 w-10 items-center justify-center rounded-full bg-black/25">
              <SymbolView
                name={{ ios: 'square.and.arrow.up', android: 'share', web: 'share' }}
                size={16}
                tintColor="#FFFFFF"
              />
            </Pressable>
          </View>
          <View className="absolute left-4 bottom-0 flex-row items-end gap-4 pb-4">
            <View
              style={{
                width: 100,
                height: 100,
                borderRadius: 28,
                overflow: 'hidden',
                borderWidth: 4,
                borderColor: '#EBEFF5',
              }}
            >
              <Image
                source={profile.avatar}
                contentFit="cover"
                transition={180}
                cachePolicy="memory-disk"
                style={{ width: '100%', height: '100%' }}
              />
            </View>
            <View
              className="rounded-3xl bg-white px-4 py-2"
              style={buttonShadow}
            >
              <Text className="text-[11px] font-extrabold uppercase tracking-[0.18em] text-[#0F172A]">
                Lv {profile.level}
              </Text>
            </View>
          </View>
        </View>

        <View className="-mt-10 px-4">
          <View className="flex-row items-start justify-between gap-3">
            <View className="flex-1">
              <Text className="text-2xl font-extrabold text-[#0F172A]">{profile.name}</Text>
              <Text className="mt-2 text-sm text-[#334155]">{profile.username}</Text>
            </View>
            <View className="flex-row items-center gap-2">
              <Pressable
                className="rounded-2xl bg-[#0F172A] px-5 py-3"
                style={buttonShadow}
              >
                <Text className="text-sm font-extrabold text-white">Follow</Text>
              </Pressable>
              <Pressable
                className="rounded-2xl bg-white p-3"
                style={buttonShadow}
              >
                <SymbolView
                  name={{ ios: 'envelope', android: 'email', web: 'email' }}
                  size={18}
                  tintColor="#0F172A"
                />
              </Pressable>
            </View>
          </View>

          <View className="mt-5 rounded-[32px] bg-white p-5" style={cardShadow}>
            <View className="flex-row items-center justify-between gap-3">
              <ProfileStat n={profile.following} label="Following" />
              <ProfileStat n={profile.followers} label="Followers" />
              <ProfileStat n={posts.length} label="Posts" />
            </View>

            <Text className="mt-5 text-sm leading-6 text-[#475569]">
              Tôi là {profile.name.split(' ')[0]}, một {profile.title} với sở thích khám phá các địa điểm lịch sử, chụp ảnh và ghi lại câu chuyện trong mỗi tuyến đi.
            </Text>

            <View className="mt-5 rounded-[32px] bg-[#F8FAFC] p-4">
              <Text className="text-sm font-extrabold text-[#0F172A]">Tiến trình XP</Text>
              <View className="mt-3 h-3 overflow-hidden rounded-full bg-[#E2E8F0]">
                <View
                  style={{
                    width: `${xpProgress}%`,
                    height: '100%',
                    backgroundColor: '#0F172A',
                  }}
                />
              </View>
              <Text className="mt-3 text-[13px] text-[#334155]">
                {profile.xp.toLocaleString()} XP / {profile.xpToNext.toLocaleString()} XP
              </Text>
            </View>

            <View className="mt-5 rounded-[32px] bg-[#F8FAFC] p-4">
              <Text className="text-sm font-extrabold text-[#0F172A]">Voucher có thể đổi</Text>
              <View className="mt-4 space-y-3">
                {vouchers.map((voucher) => (
                  <View
                    key={voucher.id}
                    className="rounded-3xl bg-white p-4"
                    style={cardShadow}
                  >
                    <Text className="text-sm font-semibold text-[#0F172A]">{voucher.title}</Text>
                    <Text className="mt-1 text-[12px] text-[#64748B]">
                      Đổi với {voucher.cost.toLocaleString()} XP
                    </Text>
                  </View>
                ))}
              </View>
            </View>
          </View>

          <View className="mt-5 rounded-[32px] bg-white p-4" style={cardShadow}>
            <View className="flex-row items-center justify-between">
              <Text className="text-base font-extrabold text-[#0F172A]">Nội dung</Text>
              <View className="flex-row rounded-full bg-[#F8FAFC] p-1">
                {TAB_ITEMS.map((item) => (
                  <Pressable
                    key={item.key}
                    onPress={() => setActiveTab(item.key)}
                    className={`rounded-full px-4 py-2 ${
                      activeTab === item.key ? 'bg-[#0F172A]' : 'bg-transparent'
                    }`}
                  >
                    <Text
                      className={`text-sm font-semibold ${
                        activeTab === item.key ? 'text-white' : 'text-[#64748B]'
                      }`}
                    >
                      {item.label}
                    </Text>
                  </Pressable>
                ))}
              </View>
            </View>

            {activeTab === 'posts' ? (
              <View className="mt-4 space-y-4">
                {posts.length === 0 ? (
                  <Text className="text-sm text-[#64748B]">Chưa có bài đăng nào.</Text>
                ) : (
                  posts.map((post) => (
                    <View
                      key={post.id}
                      className="rounded-3xl bg-[#F8FAFC] p-4"
                    >
                      <Text className="text-sm text-[#0F172A]">{post.text}</Text>
                      {post.image ? (
                        <Image
                          source={post.image}
                          contentFit="cover"
                          transition={180}
                          cachePolicy="memory-disk"
                          style={{
                            marginTop: 12,
                            width: '100%',
                            borderRadius: 20,
                            aspectRatio: 4 / 3,
                          }}
                        />
                      ) : null}
                      <Text className="mt-3 text-[12px] text-[#64748B]">
                        {post.time} · {post.likes} thích · {post.comments} bình luận
                      </Text>
                    </View>
                  ))
                )}
              </View>
            ) : (
              <View className="mt-4 space-y-4">
                <View className="rounded-3xl bg-[#F8FAFC] p-4">
                  <Text className="text-sm font-semibold text-[#0F172A]">Level hiện tại</Text>
                  <Text className="mt-2 text-[12px] text-[#64748B]">Cấp độ {profile.level}, {profile.xp.toLocaleString()} XP</Text>
                </View>
                <View className="rounded-3xl bg-[#F8FAFC] p-4">
                  <Text className="text-sm font-semibold text-[#0F172A]">XP để lên cấp</Text>
                  <Text className="mt-2 text-[12px] text-[#64748B]">
                    Còn {profile.xpToNext - profile.xp} XP để đạt cấp {profile.level + 1}
                  </Text>
                </View>
                <View className="rounded-3xl bg-[#F8FAFC] p-4">
                  <Text className="text-sm font-semibold text-[#0F172A]">Route đã tham gia</Text>
                  <Text className="mt-2 text-[12px] text-[#64748B]">
                    {userRoutes.length} tuyến đã khám phá.
                  </Text>
                </View>
              </View>
            )}
          </View>
        </View>
      </ScrollView>
    </SafeAreaView>

  );
}

function ProfileStat({ n, label }: { n: number; label: string }) {
  return (
    <View className="flex-1 items-center justify-center rounded-3xl bg-[#F8FAFC] px-3 py-4">
      <Text className="text-lg font-extrabold text-[#0F172A]">{n.toLocaleString()}</Text>
      <Text className="mt-1 text-[10px] uppercase tracking-[0.18em] text-[#94A3B8]">
        {label}
      </Text>
    </View>
  );
}
