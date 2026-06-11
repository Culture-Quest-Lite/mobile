export type ProfileBadge =
  | 'heritage-master'
  | 'storyteller'
  | 'early-bird'
  | 'photographer'
  | 'explorer';

export type Profile = {
  id: string;
  name: string;
  username: string;
  title: string;
  level: number;
  xp: number;
  xpToNext: number;
  avatar: string;
  cover: string;
  followers: number;
  following: number;
  badges: ProfileBadge[];
  routeIds: string[];
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
