import { SymbolView } from "@/components/ui/symbol-view";
import { type ComponentProps } from "react";

export type SymbolName = ComponentProps<typeof SymbolView>["name"];

export type FeaturedRoute = {
  description: string;
  distance: string;
  duration: string;
  imageUri: string;
  stops: string;
  summary: string;
  title: string;
};

export type NearbyPlaceCard = {
  category: string;
  distance: string;
  imageUri: string;
  rating: number;
  reviews: string;
  reward: string;
  slug: string;
  title: string;
};

export type CommunityBoardTab = "community" | "friends";

export type CommunityBoardEntry = {
  avatarUri: string;
  name: string;
  points: string;
  subtitle: string;
};

export type CommunityBoard = {
  entries: CommunityBoardEntry[];
  summaryLabel: string;
  summaryNote: string;
  totalPoints: string;
};

export type NearbyCategoryCard = {
  accent: string;
  background: string;
  imageUrl?: string | null;
  icon: SymbolName;
  label: string;
};

export type RouteDifficulty = "Dễ" | "Trung bình" | "Khó";

export type NearbyRouteCard = {
  difficulty: RouteDifficulty;
  distance: string;
  duration: string;
  imageUri: string;
  stops: string;
  subtitle: string;
  title: string;
  xp: string;
};

export type ActiveJourneyCard = {
  rewardLabel: string;
  completed: boolean;
  currentCheckpoint: number;
  distanceToNext: string;
  imageUri: string;
  nextStop: string;
  progress: number;
  remainingStopsLabel: string;
  remainingTimeLabel: string;
  subtitle: string;
  totalCheckpoints: number;
  title: string;
};

export type VoucherMerchant = {
  label: string;
  logoUri: string;
  logoScale: number;
};

export const avatarImageUri =
  "https://i.pinimg.com/736x/25/c7/c1/25c7c1671263058c274374435c142b4f.jpg";

export const featuredRoutes: FeaturedRoute[] = [
  {
    title: "Vịnh Hạ Long",
    description:
      "Lộ trình ghé Chợ Bến Thành, Bưu điện Thành phố và những góc kể chuyện văn hóa giữa trung tâm.",
    distance: "2.4 km",
    duration: "95 phút",
    stops: "06 điểm dừng",
    summary: "Hành trình đô thị dành cho người mới bắt đầu khám phá trung tâm.",
    imageUri:
      "https://i.pinimg.com/1200x/80/69/f9/8069f9581583a196f9f39bda000b9312.jpg",
  },
  {
    title: "Dấu ấn Mũi né",
    description:
      "Khám phá kiến trúc hội quán, chợ cổ và những lớp ký ức người Hoa giữa lòng thành phố.",
    distance: "3.1 km",
    duration: "110 phút",
    stops: "08 điểm dừng",
    summary:
      "Tuyến route giàu câu chuyện cộng đồng, ẩm thực và tín ngưỡng đô thị.",
    imageUri:
      "https://i.pinimg.com/1200x/6d/cd/14/6dcd140b80b210ac445a0eddfc40784a.jpg",
  },
  {
    title: "Phố cổ về đêm",
    description:
      "Đi qua các sân khấu, phố đi bộ và không gian âm nhạc để cảm nhận nhịp sống buổi tối.",
    distance: "2.8 km",
    duration: "88 phút",
    stops: "05 điểm dừng",
    summary:
      "Phù hợp cho người thích ánh sáng thành phố và trải nghiệm văn hóa đương đại.",
    imageUri:
      "https://i.pinimg.com/736x/00/17/04/001704938bb7cf0b964b07a6b2eeffc4.jpg",
  },
];

export const nearbyPlaces: NearbyPlaceCard[] = [
  {
    category: "Check-in",
    distance: "0m",
    imageUri:
      "https://i.pinimg.com/736x/5d/bc/7c/5dbc7cf464caf8658403d494664c7dcf.jpg",
    rating: 5.0,
    reviews: "12",
    reward: "+250",
    slug: "demo-checkin-story",
    title: "Hà Giang",
  },
  {
    category: "Kiến trúc",
    distance: "320m",
    imageUri:
      "https://i.pinimg.com/736x/f3/0f/e8/f30fe84218790e6ffd25f987d434eb13.jpg",
    rating: 4.8,
    reviews: "284",
    reward: "+120",
    slug: "buu-dien-sai-gon",
    title: "Bưu điện Sài Gòn",
  },
  {
    category: "Lịch sử",
    distance: "540m",
    imageUri:
      "https://i.pinimg.com/1200x/b3/07/e7/b307e7540a1d2c91f96933794c0b681c.jpg",
    rating: 4.9,
    reviews: "198",
    reward: "+95",
    slug: "nha-tho-duc-ba",
    title: "Nhà thờ Đức Bà",
  },
  {
    category: "Nghệ thuật",
    distance: "850m",
    imageUri:
      "https://i.pinimg.com/1200x/9a/d1/dd/9ad1dd8c33e939d6fa4731f72e6095fa.jpg",
    rating: 4.7,
    reviews: "312",
    reward: "+140",
    slug: "bao-tang-my-thuat",
    title: "Bảo tàng Mỹ thuật",
  },
];

export const nearbyCategories: NearbyCategoryCard[] = [
  {
    accent: "#B83280",
    background: "#FFD7EA",
    icon: {
      ios: "building.columns",
      android: "account_balance",
      web: "account_balance",
    },
    label: "Kiến trúc",
  },
  {
    accent: "#D95C22",
    background: "#FFE4D3",
    icon: { ios: "clock.arrow.circlepath", android: "history", web: "history" },
    label: "Lịch sử",
  },
  {
    accent: "#0D8C7D",
    background: "#D9F7F1",
    icon: { ios: "paintpalette", android: "palette", web: "palette" },
    label: "Nghệ thuật",
  },
  {
    accent: "#6D28D9",
    background: "#EDE4FF",
    icon: { ios: "fork.knife", android: "restaurant", web: "restaurant" },
    label: "Ẩm thực",
  },
  {
    accent: "#2563EB",
    background: "#DCEBFF",
    icon: { ios: "camera", android: "photo_camera", web: "photo_camera" },
    label: "Check-in",
  },
];

export const nearbyRoutes: NearbyRouteCard[] = [
  {
    difficulty: "Dễ",
    distance: "1.2 km",
    duration: "1.5 giờ",
    imageUri:
      "https://i.pinimg.com/1200x/b9/05/dd/b905ddb3d6e87ba4f85692125c1eec2a.jpg",
    stops: "05 điểm",
    subtitle: "Route ngắn cho buổi chiều quanh trung tâm",
    title: "Dấu ấn Sài Gòn cổ",
    xp: "+120 XP",
  },
  {
    difficulty: "Trung bình",
    distance: "2.4 km",
    duration: "2.5 giờ",
    imageUri:
      "https://i.pinimg.com/736x/26/c4/1e/26c41e38a3d34e4c88d8fdf8de32a5d3.jpg",
    stops: "07 điểm",
    subtitle: "Hành trình kết hợp kiến trúc, bảo tàng và phố đi bộ",
    title: "Lộ trình văn hóa quận 1",
    xp: "+180 XP",
  },
  {
    difficulty: "Khó",
    distance: "1.8 km",
    duration: "3 giờ",
    imageUri:
      "https://i.pinimg.com/736x/15/00/10/1500103a9ce1a16aed3cb6b35fe19aa8.jpg",
    stops: "04 điểm",
    subtitle: "Đi bộ nhẹ, nhiều góc check-in gần bạn",
    title: "Tuyến đêm thành phố",
    xp: "+220 XP",
  },
];

export const activeJourney: ActiveJourneyCard | null = {
  completed: false,
  currentCheckpoint: 2,
  distanceToNext: "320m",
  imageUri:
    "https://i.pinimg.com/736x/42/b0/19/42b019d4a97b9f363534a8e2784c3b6a.jpg",
  nextStop: "Chùa Cầu",
  progress: 70,
  remainingStopsLabel: "Còn 2 điểm dừng",
  remainingTimeLabel: "25 phút nữa",
  rewardLabel: "+180 XP",
  subtitle: "Còn 2 điểm để hoàn thành tuyến và nhận thưởng.",
  totalCheckpoints: 5,
  title: "Phố cổ Hội An",
};

export const voucherMerchants: VoucherMerchant[] = [
  {
    label: "Starbucks",
    logoUri:
      "https://i.pinimg.com/1200x/55/4b/62/554b62cd21881bd0143923b21231cd6f.jpg",
    logoScale: 0.92,
  },
  {
    label: "McDonald's",
    logoUri:
      "https://i.pinimg.com/736x/87/69/4b/87694b29884c0d0db10c0f27d2795e9e.jpg",
    logoScale: 0.94,
  },
  {
    label: "Burger King",
    logoUri:
      "https://i.pinimg.com/736x/59/93/c4/5993c45ee0410544471f909835b8516c.jpg",
    logoScale: 0.94,
  },
  {
    label: "KFC",
    logoUri:
      "https://i.pinimg.com/1200x/aa/92/89/aa9289de1ed2865bccd7c7457f246482.jpg",
    logoScale: 0.94,
  },
  {
    label: "Highlands",
    logoUri:
      "https://i.pinimg.com/1200x/9e/d3/65/9ed3653a9eb6cad4d9eef5d1999a1e25.jpg",
    logoScale: 0.94,
  },
];

export const communityTabs = [
  { key: "community", label: "Cộng đồng" },
  { key: "friends", label: "Bạn bè" },
] as const satisfies readonly { key: CommunityBoardTab; label: string }[];

export const communityBoards: Record<CommunityBoardTab, CommunityBoard> = {
  community: {
    totalPoints: "1250",
    summaryLabel: "Bạn đang xếp hạng 24",
    summaryNote: "Còn 80 XP để vượt hạng 23",
    entries: [
      {
        avatarUri: "https://i.pravatar.cc/120?img=12",
        name: "Minh",
        points: "+980",
        subtitle: "Hoàn thành 3 route",
      },
      {
        avatarUri:
          "https://i.pinimg.com/1200x/90/49/99/904999c3351c262c0f1265677effaecc.jpg",
        name: "Lan",
        points: "+760",
        subtitle: "Check-in 15 hotspot",
      },
      {
        avatarUri:
          "https://i.pinimg.com/736x/16/8a/09/168a0975cc55e880883cbf95a22e04a5.jpg",
        name: "Huy",
        points: "+500",
        subtitle: "Nhận 500 XP",
      },
    ],
  },
  friends: {
    totalPoints: "910",
    summaryLabel: "Bạn đang đứng đầu nhóm bạn",
    summaryNote: "Giữ thêm 40 XP để không bị vượt",
    entries: [
      {
        avatarUri:
          "https://i.pinimg.com/736x/c7/47/c4/c747c4b1178ff71cf7bebad4c7b06cef.jpg",
        name: "Trâm",
        points: "+860",
        subtitle: "Hoàn thành 2 tuyến di sản",
      },
      {
        avatarUri: "https://i.pravatar.cc/120?img=58",
        name: "Khoa",
        points: "+690",
        subtitle: "Mở 11 câu chuyện văn hóa",
      },
      {
        avatarUri: "https://i.pravatar.cc/120?img=5",
        name: "An",
        points: "+540",
        subtitle: "Check-in 4 điểm mới hôm nay",
      },
    ],
  },
};
