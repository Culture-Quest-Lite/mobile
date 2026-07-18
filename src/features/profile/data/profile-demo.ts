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
    currentLevelXp: 240,
    xpToNext: 600,
    avatar:
      "https://i.pinimg.com/736x/4a/c2/3c/4ac23cc90bf76e56e8f38d1c57756957.jpg",
    cover:
      "https://i.pinimg.com/1200x/b1/da/c9/b1dac92314cfefc98a973bb101ff05d9.jpg",
    createdAt: "2026-01-15T09:00:00.000Z",
    followers: 342,
    following: 128,
    isMaxLevel: false,
    totalPosts: 2,
    isPremium: true,
    role: "EXPLORER",
    routeIds: ["vinh-ha-long", "pho-co-dem"],
    savedHotspotSlugs: ["buu-dien-sai-gon", "cho-lon", "nha-tho-duc-ba"],
    status: "ACTIVE",
  },
];

const profilePosts: ProfilePost[] = [
  {
    commentCount: 14,
    id: "post-1",
    userId: CURRENT_USER_ID,
    username: "ngoc.tran",
    displayName: "Ngọc Trần",
    text: "Hoàn thành tuyến Phố cổ về đêm — phố đi bộ Nguyễn Huệ lúc hoàng hôn thật sự đẹp không thể tả! 🌅",
    image:
      "https://i.pinimg.com/1200x/6d/cd/14/6dcd140b80b210ac445a0eddfc40784a.jpg",
    visibility: "PUBLIC",
    status: "APPROVED",
    reason: null,
    isTaggedHotspot: false,
    isTaggedRoute: true,
    hotspotIds: [],
    routeIds: [9],
    tags: [{ id: 1, name: "Thiên nhiên" }],
    medias: [
      {
        id: 1,
        type: "IMAGE",
        mimeType: "image/jpeg",
        url: "https://i.pinimg.com/1200x/6d/cd/14/6dcd140b80b210ac445a0eddfc40784a.jpg",
        fileName: "pho-co-dem.jpg",
        fileSize: null,
        displayOrder: 1,
        createdAt: "2026-06-30T12:00:00.000Z",
        updatedAt: "2026-06-30T12:00:00.000Z",
      },
    ],
    createdAt: "2026-06-30T12:00:00.000Z",
    likeCount: 128,
    pointRemaining: 778,
    shareCount: 2,
  },
  {
    commentCount: 7,
    id: "post-2",
    userId: CURRENT_USER_ID,
    username: "ngoc.tran",
    displayName: "Ngọc Trần",
    text: "Check-in Chợ Lớn hôm nay, thu được +100 XP và mở khoá câu chuyện ẩn tại Chùa Bà Thiên Hậu.",
    image:
      "https://i.pinimg.com/736x/f5/dc/de/f5dcde257dc627bfdb51acfed2d8b111.jpg",
    visibility: "PUBLIC",
    status: "PENDING",
    reason: null,
    isTaggedHotspot: true,
    isTaggedRoute: false,
    hotspotIds: [13],
    routeIds: [],
    tags: [{ id: 2, name: "Di sản" }],
    medias: [
      {
        id: 2,
        type: "IMAGE",
        mimeType: "image/jpeg",
        url: "https://i.pinimg.com/736x/f5/dc/de/f5dcde257dc627bfdb51acfed2d8b111.jpg",
        fileName: "cho-lon.jpg",
        fileSize: null,
        displayOrder: 1,
        createdAt: "2026-06-27T10:00:00.000Z",
        updatedAt: "2026-06-27T10:00:00.000Z",
      },
    ],
    createdAt: "2026-06-27T10:00:00.000Z",
    likeCount: 64,
    pointRemaining: 678,
    shareCount: 1,
  },
];

export function getProfileById(userId: string): Profile | undefined {
  return profiles.find((p) => p.id === userId);
}

export function getProfilePosts(userId: string): ProfilePost[] {
  return profilePosts.filter((p) => p.userId === userId);
}
