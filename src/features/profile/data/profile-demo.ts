import type { Profile, ProfilePost } from "../types";

export const CURRENT_USER_ID = "ngoc-tran";

const profiles: Profile[] = [
  {
    autoPlayAudio: true,
    id: CURRENT_USER_ID,
    email: "ngoc.tran@example.com",
    name: "Ngọc Trần",
    username: "ngoc.tran",
    points: 778,
    totalXp: 2840,
    level: 12,
    levelName: "Level 12",
    currentLevelXp: 2840,
    xpToNext: 3200,
    avatar:
      "https://i.pinimg.com/736x/4a/c2/3c/4ac23cc90bf76e56e8f38d1c57756957.jpg",
    cover:
      "https://i.pinimg.com/1200x/b1/da/c9/b1dac92314cfefc98a973bb101ff05d9.jpg",
    createdAt: "2026-01-15T09:00:00.000Z",
    followers: 342,
    following: 128,
    isPremium: true,
    role: "EXPLORER",
    routeIds: ["vinh-ha-long", "pho-co-dem"],
    savedHotspotSlugs: ["buu-dien-sai-gon", "cho-lon", "nha-tho-duc-ba"],
    status: "ACTIVE",
  },
];

const profilePosts: ProfilePost[] = [
  {
    id: "post-1",
    userId: CURRENT_USER_ID,
    text: "Hoàn thành tuyến Phố cổ về đêm — phố đi bộ Nguyễn Huệ lúc hoàng hôn thật sự đẹp không thể tả! 🌅",
    image:
      "https://i.pinimg.com/1200x/6d/cd/14/6dcd140b80b210ac445a0eddfc40784a.jpg",
    time: "2 ngày trước",
    likes: 48,
    comments: 12,
  },
  {
    id: "post-2",
    userId: CURRENT_USER_ID,
    text: "Check-in Chợ Lớn hôm nay, thu được +100 XP và mở khoá câu chuyện ẩn tại Chùa Bà Thiên Hậu.",
    image:
      "https://i.pinimg.com/736x/f5/dc/de/f5dcde257dc627bfdb51acfed2d8b111.jpg",
    time: "5 ngày trước",
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
