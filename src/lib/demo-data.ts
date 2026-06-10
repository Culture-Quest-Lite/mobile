export type RouteItem = {
  id: string;
  title: string;
  cover: string;
  era: string;
  difficulty: string;
  distance: string;
  duration: string;
  hotspotIds: string[];
  xp: number;
  rating: number;
};

export type CommunityJourney = {
  id: string;
  title: string;
  cover: string;
  distance: string;
  duration: string;
  hotspotIds: string[];
  participants: number;
  maxParticipants?: number;
  visibility: 'public' | 'link';
  avgRating: number;
  creator: {
    name: string;
    avatar: string;
  };
};

export type LeaderboardEntry = {
  rank: number;
  name: string;
  avatar: string;
  level: number;
  xp: number;
  change: number;
};

export const routes: RouteItem[] = [
  {
    id: 'vinh-ha-long',
    title: 'Vịnh Hạ Long',
    cover:
      'https://i.pinimg.com/1200x/80/69/f9/8069f9581583a196f9f39bda000b9312.jpg',
    era: 'Di sản',
    difficulty: 'Dễ',
    distance: '2.4 km',
    duration: '95 phút',
    hotspotIds: ['h1', 'h2', 'h3', 'h4', 'h5', 'h6'],
    xp: 120,
    rating: 4.8,
  },
  {
    id: 'mui-ne',
    title: 'Dấu ấn Mũi Né',
    cover:
      'https://i.pinimg.com/1200x/6d/cd/14/6dcd140b80b210ac445a0eddfc40784a.jpg',
    era: 'Văn hoá',
    difficulty: 'Trung bình',
    distance: '3.1 km',
    duration: '110 phút',
    hotspotIds: ['h1', 'h2', 'h3', 'h4', 'h5', 'h6', 'h7', 'h8'],
    xp: 150,
    rating: 4.7,
  },
  {
    id: 'pho-co-dem',
    title: 'Phố cổ về đêm',
    cover:
      'https://i.pinimg.com/736x/00/17/04/001704938bb7cf0b964b07a6b2eeffc4.jpg',
    era: 'Đô thị',
    difficulty: 'Dễ',
    distance: '2.8 km',
    duration: '88 phút',
    hotspotIds: ['h1', 'h2', 'h3', 'h4', 'h5'],
    xp: 110,
    rating: 4.6,
  },
  {
    id: 'cho-lon',
    title: 'Săn dấu ấn Chợ Lớn',
    cover:
      'https://i.pinimg.com/1200x/b3/07/e7/b307e7540a1d2c91f96933794c0b681c.jpg',
    era: 'Lịch sử',
    difficulty: 'Trung bình',
    distance: '3.5 km',
    duration: '120 phút',
    hotspotIds: ['h1', 'h2', 'h3', 'h4', 'h5', 'h6', 'h7'],
    xp: 180,
    rating: 4.9,
  },
];

export const currentUser = {
  name: 'Ngọc Trần',
  level: 12,
  title: 'Explorer',
  xp: 2840,
  xpToNext: 3200,
};

export const leaderboard: LeaderboardEntry[] = [
  {
    rank: 1,
    name: 'Minh Anh',
    avatar:
      'https://i.pinimg.com/736x/25/c7/c1/25c7c1671263058c274374435c142b4f.jpg',
    level: 18,
    xp: 12480,
    change: 120,
  },
  {
    rank: 2,
    name: 'Hoàng Long',
    avatar:
      'https://i.pinimg.com/736x/f3/0f/e8/f30fe84218790e6ffd25f987d434eb13.jpg',
    level: 16,
    xp: 10920,
    change: 45,
  },
  {
    rank: 3,
    name: 'Thu Hà',
    avatar:
      'https://i.pinimg.com/1200x/9a/d1/dd/9ad1dd8c33e939d6fa4731f72e6095fa.jpg',
    level: 15,
    xp: 9870,
    change: -12,
  },
  {
    rank: 4,
    name: 'Ngọc Trần',
    avatar:
      'https://i.pinimg.com/736x/25/c7/c1/25c7c1671263058c274374435c142b4f.jpg',
    level: 12,
    xp: 2840,
    change: 80,
  },
  {
    rank: 5,
    name: 'Đức Phú',
    avatar:
      'https://i.pinimg.com/1200x/6d/cd/14/6dcd140b80b210ac445a0eddfc40784a.jpg',
    level: 11,
    xp: 2650,
    change: 0,
  },
];

export const myRoutes = {
  active: ['vinh-ha-long'],
  completed: ['pho-co-dem'],
  saved: ['mui-ne', 'cho-lon'],
};

export const activeRouteState = {
  progress: 42,
};

export const communityJourneys: CommunityJourney[] = [
  {
    id: 'cj-1',
    title: 'Sáng sớm bên kênh Nhiêu Lộc',
    cover:
      'https://i.pinimg.com/736x/00/17/04/001704938bb7cf0b964b07a6b2eeffc4.jpg',
    distance: '1.8 km',
    duration: '55 phút',
    hotspotIds: ['h1', 'h2', 'h3', 'h4'],
    participants: 1284,
    visibility: 'public',
    avgRating: 4.8,
    creator: {
      name: 'Lan Chi',
      avatar:
        'https://i.pinimg.com/1200x/9a/d1/dd/9ad1dd8c33e939d6fa4731f72e6095fa.jpg',
    },
  },
  {
    id: 'cj-2',
    title: 'Ẩm thực hẻm nhỏ Q.3',
    cover:
      'https://i.pinimg.com/1200x/b3/07/e7/b307e7540a1d2c91f96933794c0b681c.jpg',
    distance: '2.2 km',
    duration: '70 phút',
    hotspotIds: ['h1', 'h2', 'h3', 'h4', 'h5'],
    participants: 956,
    visibility: 'public',
    avgRating: 4.7,
    creator: {
      name: 'Bảo Khang',
      avatar:
        'https://i.pinimg.com/736x/f3/0f/e8/f30fe84218790e6ffd25f987d434eb13.jpg',
    },
  },
  {
    id: 'cj-3',
    title: 'Đêm nhạc dân gian ven sông',
    cover:
      'https://i.pinimg.com/1200x/6d/cd/14/6dcd140b80b210ac445a0eddfc40784a.jpg',
    distance: '2.6 km',
    duration: '80 phút',
    hotspotIds: ['h1', 'h2', 'h3'],
    participants: 412,
    maxParticipants: 500,
    visibility: 'link',
    avgRating: 4.5,
    creator: {
      name: 'Mai Vy',
      avatar:
        'https://i.pinimg.com/736x/25/c7/c1/25c7c1671263058c274374435c142b4f.jpg',
    },
  },
  {
    id: 'cj-4',
    title: 'Kiến trúc Pháp giữa lòng Sài Gòn',
    cover:
      'https://i.pinimg.com/1200x/80/69/f9/8069f9581583a196f9f39bda000b9312.jpg',
    distance: '3.0 km',
    duration: '90 phút',
    hotspotIds: ['h1', 'h2', 'h3', 'h4', 'h5', 'h6'],
    participants: 678,
    visibility: 'public',
    avgRating: 4.6,
    creator: {
      name: 'Quốc Huy',
      avatar:
        'https://i.pinimg.com/1200x/6d/cd/14/6dcd140b80b210ac445a0eddfc40784a.jpg',
    },
  },
];

const routeMap = new Map(routes.map((route) => [route.id, route]));

export function getRoute(id: string): RouteItem | undefined {
  return routeMap.get(id);
}
