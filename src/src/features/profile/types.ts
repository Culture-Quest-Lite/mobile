export type Profile = {
  id: string;
  name: string;
  username: string;
  email: string | null;
  points: number;
  totalXp: number;
  level: number | null;
  levelName: string | null;
  currentLevelXp: number | null;
  xpToNext: number | null;
  avatar: string | null;
  cover: string | null;
  followers: number;
  following: number;
  totalPosts: number;
  routeIds: string[];
  savedHotspotSlugs: string[];
  role: string | null;
  status: string | null;
  isPremium: boolean;
  autoPlayAudio: boolean | null;
  createdAt: string | null;
};

export type ProfilePost = {
  id: string;
  userId: string;
  text: string;
  image?: string;
  time: string;
  likes: number;
  comments: number;
};
