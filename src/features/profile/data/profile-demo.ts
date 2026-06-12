import type { Profile, ProfilePost } from '../types';

export const CURRENT_USER_ID = 'ngoc-tran';

const profiles: Profile[] = [
  {
    id: CURRENT_USER_ID,
    name: 'Ngọc Trần',
    username: '@ngoc.tran',
    title: 'Explorer',
    level: 12,
    xp: 2840,
    xpToNext: 3200,
    avatar:
      'https://i.pinimg.com/736x/25/c7/c1/25c7c1671263058c274374435c142b4f.jpg',
    cover:
      'https://i.pinimg.com/1200x/80/69/f9/8069f9581583a196f9f39bda000b9312.jpg',
    followers: 342,
    following: 128,
    badges: ['heritage-master', 'storyteller', 'early-bird', 'photographer'],
    routeIds: ['vinh-ha-long', 'pho-co-dem'],
  },
];

const profilePosts: ProfilePost[] = [
  {
    id: 'post-1',
    userId: CURRENT_USER_ID,
    text: 'Hoàn thành tuyến Phố cổ về đêm — phố đi bộ Nguyễn Huệ lúc hoàng hôn thật sự đẹp không thể tả! 🌅',
    image:
      'https://i.pinimg.com/736x/f3/0f/e8/f30fe84218790e6ffd25f987d434eb13.jpg',
    time: '2 ngày trước',
    likes: 48,
    comments: 12,
  },
  {
    id: 'post-2',
    userId: CURRENT_USER_ID,
    text: 'Check-in Chợ Lớn hôm nay, thu được +100 XP và mở khoá câu chuyện ẩn tại Chùa Bà Thiên Hậu.',
    time: '5 ngày trước',
    likes: 31,
    comments: 7,
  },
];

export function getProfileById(userId: string): Profile | undefined {
  return profiles.find((p) => p.id === userId);
}

export function getProfilePosts(userId: string): ProfilePost[] {
  return profilePosts.filter((p) => p.userId === userId);
}
