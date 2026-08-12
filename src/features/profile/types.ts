import type { SharedPostSummary } from "@/lib/shared-post";

export type Profile = {
  id: string;
  name: string;
  username: string;
  email: string | null;
  points: number;
  totalXp: number;
  level: number | null;
  levelName: string | null;
  isMaxLevel: boolean;
  currentLevelXp: number | null;
  currentLevelRequiredXp: number | null;
  nextLevelNumber: number | null;
  nextLevelName: string | null;
  nextLevelRequiredXp: number | null;
  remainingXpToNextLevel: number | null;
  levelProgressPercent: number | null;
  hasExactLevelProgress: boolean;
  xpToNext: number | null;
  avatar: string | null;
  cover: string | null;
  followers: number;
  following: number;
  totalPosts: number;
  isFollowing?: boolean | null;
  routeIds: string[];
  savedHotspotSlugs: string[];
  role: string | null;
  status: string | null;
  isPremium: boolean;
  autoPlayAudio: boolean | null;
  createdAt: string | null;
};

export type ProfilePostTag = {
  id: number;
  name: string;
};

export type ProfilePostMedia = {
  id: number;
  type: string;
  mimeType: string;
  url: string;
  fileName: string;
  fileSize: number | null;
  displayOrder: number | null;
  createdAt: string | null;
  updatedAt: string | null;
};

export type ProfilePostStatus =
  | "APPROVED"
  | "PENDING"
  | "REPORTED"
  | "REJECTED"
  | "DELETED";
export type ProfilePostStatusFilter = ProfilePostStatus | "ALL";

export type ProfilePost = {
  commentCount: number | null;
  id: string;
  userId: string;
  username: string;
  displayName: string;
  text: string;
  image: string | null;
  visibility: string;
  status: string;
  reason: string | null;
  isTaggedHotspot: boolean;
  isTaggedRoute: boolean;
  hotspotIds: number[];
  routeIds: number[];
  tags: ProfilePostTag[];
  medias: ProfilePostMedia[];
  createdAt: string | null;
  isLiked?: boolean;
  likeCount: number | null;
  pointRemaining: number | null;
  replyCount?: number | null;
  shareCount: number | null;
  sharedPost: SharedPostSummary | null;
};
