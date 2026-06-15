import type { ImageSourcePropType } from "react-native";

const CULTURE_IMAGE = require("../../../../assets/images/vanhoa.png");
const CUISINE_IMAGE = require("../../../../assets/images/tachnen3.png");
const HERITAGE_IMAGE = require("../../../../assets/images/tachnen2.png");
const LEARNING_IMAGE = require("../../../../assets/images/giaoduc.png");

export type CommunityPostTopic = "culture" | "art" | "cuisine" | "history";

export type CommunityPost = {
  id: string;
  authorId: string;
  author: string;
  avatarColors: readonly [string, string];
  badge: string;
  caption: string;
  comments: string;
  hotScore: string;
  image: ImageSourcePropType;
  initials: string;
  likes: string;
  location: string;
  mood: string;
  topic: CommunityPostTopic;
  role: string;
  shares: string;
  isFollowing: boolean;
  tags: readonly string[];
  time: string;
  views: string;
};

export type CommunityExplorerProfile = {
  id: string;
  name: string;
  username: string;
  role: string;
  headline: string;
  bio: string;
  city: string;
  level: number;
  followers: number;
  following: number;
  routesCompleted: number;
  streakDays: number;
  responseTime: string;
  avatar?: string;
  cover: string;
  initials: string;
  avatarColors: readonly [string, string];
  interests: readonly string[];
  badges: readonly string[];
  routeIds: readonly string[];
};

export const communityExplorerProfiles: readonly CommunityExplorerProfile[] = [
  {
    id: "mai-linh",
    name: "Nguyễn Ngọc",
    username: "@nguyenngocdh.story",
    role: "Story hunter",
    headline: "Săn góc kể chuyện đẹp ở các bảo tàng và sân khấu truyền thống.",
    bio: "Thích ghép những điểm dừng văn hóa thành hành trình ngắn, dễ đi và nhiều góc ảnh kể được câu chuyện của địa điểm.",
    city: "TP. Hồ Chí Minh",
    level: 14,
    followers: 1284,
    following: 196,
    routesCompleted: 28,
    streakDays: 16,
    responseTime: "Phản hồi trong 1 giờ",
    avatar:
      "https://i.pinimg.com/1200x/30/ea/d0/30ead0739541c7f214f91b37560e038c.jpg",
    cover:
      "https://i.pinimg.com/1200x/06/d5/37/06d537ece4a0f1ab8e9a2cef23c8252d.jpg",
    initials: "ML",
    avatarColors: ["#EB489B", "#F58752"],
    interests: ["Văn hóa", "Check-in", "Bảo tàng"],
    badges: ["Story curator", "Photo spot hunter", "Weekend route"],
    routeIds: ["vinh-ha-long", "pho-co-dem"],
  },
  {
    id: "ha-vy",
    name: "Hà Vy",
    username: "@havy.notes",
    role: "Culture guide",
    headline:
      "Gom note nhanh cho các route học thuật, triển lãm và nhóm sinh viên.",
    bio: "Ưu tiên những route dễ phối hợp theo nhóm 3-5 người, có checklist rõ ràng và nội dung súc tích để ai mới tham gia cũng theo được.",
    city: "Thủ Đức",
    level: 11,
    followers: 842,
    following: 152,
    routesCompleted: 19,
    streakDays: 9,
    responseTime: "Phản hồi trong ngày",
    avatar: "https://i.pravatar.cc/160?img=58",
    cover:
      "https://i.pinimg.com/1200x/6d/cd/14/6dcd140b80b210ac445a0eddfc40784a.jpg",
    initials: "HV",
    avatarColors: ["#F58752", "#FFC93C"],
    interests: ["Nghệ thuật", "Triển lãm", "Sinh viên"],
    badges: ["Campus planner", "Exhibit note", "Quick briefing"],
    routeIds: ["mui-ne", "vinh-ha-long"],
  },
  {
    id: "khanh-an",
    name: "Khánh An",
    username: "@khanhan.meetup",
    role: "Meetup host",
    headline: "Tổ chức meetup nhỏ cho người mới, ưu tiên route dễ nhập cuộc.",
    bio: "Mình hay lên lịch route buổi tối với quãng đi bộ nhẹ, có nhiều điểm dừng kể chuyện và chỗ để cả nhóm ngồi trao đổi nhanh.",
    city: "Quận 1",
    level: 10,
    followers: 697,
    following: 233,
    routesCompleted: 17,
    streakDays: 11,
    responseTime: "Phản hồi trong 30 phút",
    avatar: "https://i.pravatar.cc/160?img=5",
    cover:
      "https://i.pinimg.com/736x/00/17/04/001704938bb7cf0b964b07a6b2eeffc4.jpg",
    initials: "KA",
    avatarColors: ["#F58752", "#EB489B"],
    interests: ["Ẩm thực", "Meetup", "Đi bộ nhẹ"],
    badges: ["Warm host", "Night route", "Newbie friendly"],
    routeIds: ["pho-co-dem", "cho-lon"],
  },
  {
    id: "tuan-kiet",
    name: "Tuấn Kiệt",
    username: "@tkiet.sunset",
    role: "Explorer level 9",
    headline: "Ưu tiên các cung kiến trúc cổ và điểm ngắm hoàng hôn dễ đi bộ.",
    bio: "Hay ghép route lịch sử với các điểm chụp silhouette lúc chiều muộn, phù hợp cho nhóm 2-3 người thích đi chậm và chụp nhiều.",
    city: "Quận 5",
    level: 9,
    followers: 514,
    following: 188,
    routesCompleted: 13,
    streakDays: 7,
    responseTime: "Thường online buổi tối",
    avatar: "https://i.pravatar.cc/160?img=20",
    cover:
      "https://i.pinimg.com/1200x/b3/07/e7/b307e7540a1d2c91f96933794c0b681c.jpg",
    initials: "TK",
    avatarColors: ["#FFC93C", "#F58752"],
    interests: ["Lịch sử", "Kiến trúc", "Hoàng hôn"],
    badges: ["Sunset scout", "Architecture walk", "Slow explorer"],
    routeIds: ["cho-lon", "mui-ne"],
  },
] as const;

export const communityPosts: readonly CommunityPost[] = [
  {
    id: "community-post-1",
    authorId: "mai-linh",
    author: "Mai Linh",
    initials: "ML",
    role: "Story hunter",
    time: "14 phút trước",
    caption:
      "Vừa hoàn thành route Bảo tàng và sân khấu truyền thống. Góc trưng bày mặt nạ tuồng lên ảnh rất đẹp, ánh đèn vàng khiến cả không gian trông ấm hơn hẳn.",
    location: "Bảo tàng & sân khấu truyền thống",
    mood: "Chụp đẹp nhất lúc 16:30 - 17:30",
    badge: "Xu hướng",
    hotScore: "59k",
    views: "30.8k",
    likes: "10.4k",
    comments: "234",
    shares: "14",
    topic: "culture",
    isFollowing: true,
    tags: ["Văn hóa", "Check-in", "Góc đẹp"],
    image: CULTURE_IMAGE,
    avatarColors: ["#EB489B", "#F58752"],
  },
  {
    id: "community-post-2",
    authorId: "ha-vy",
    author: "Hà Vy",
    initials: "HV",
    role: "Culture guide",
    time: "1 giờ trước",
    caption:
      "Team mình vừa gom một bộ note ngắn về các biểu tượng học thuật và không gian triển lãm. Nếu ai đang làm route dành cho sinh viên thì post này sẽ khá hữu ích.",
    location: "Không gian triển lãm học thuật",
    mood: "Phù hợp route nhóm 3-5 người",
    badge: "Mới cập nhật",
    hotScore: "18k",
    views: "12.2k",
    likes: "3.6k",
    comments: "86",
    shares: "09",
    topic: "art",
    isFollowing: true,
    tags: ["Nghệ thuật", "Triển lãm", "Sinh viên"],
    image: LEARNING_IMAGE,
    avatarColors: ["#F58752", "#FFC93C"],
  },
  {
    id: "community-post-3",
    authorId: "khanh-an",
    author: "Khánh An",
    initials: "KA",
    role: "Meetup host",
    time: "Hôm nay, 19:30",
    caption:
      "Tối nay mình mở meetup ẩm thực và kể chuyện chợ đêm. Route ngắn, đi bộ nhẹ, ưu tiên người mới để cùng mở khoá badge đầu tiên.",
    location: "Chợ đêm ẩm thực",
    mood: "Còn 6 chỗ trống trong nhóm",
    badge: "Meetup nóng",
    hotScore: "26k",
    views: "8.7k",
    likes: "2.4k",
    comments: "41",
    shares: "12",
    topic: "cuisine",
    isFollowing: false,
    tags: ["Ẩm thực", "Meetup", "Đi bộ nhẹ"],
    image: CUISINE_IMAGE,
    avatarColors: ["#F58752", "#EB489B"],
  },
  {
    id: "community-post-4",
    authorId: "tuan-kiet",
    author: "Tuấn Kiệt",
    initials: "TK",
    role: "Explorer level 9",
    time: "2 giờ trước",
    caption:
      "Cuối tuần này ai có route tham quan kiến trúc Chăm và chụp silhouette đẹp thì cho mình xin lịch trình với. Mình muốn ghép thêm một điểm hoàng hôn gần đó.",
    location: "Cụm di tích kiến trúc cổ",
    mood: "Tìm thêm 1-2 người đi cùng",
    badge: "Cần tư vấn",
    hotScore: "9.8k",
    views: "5.4k",
    likes: "980",
    comments: "57",
    shares: "06",
    topic: "history",
    isFollowing: false,
    tags: ["Lịch sử", "Kiến trúc", "Hoàng hôn"],
    image: HERITAGE_IMAGE,
    avatarColors: ["#FFC93C", "#F58752"],
  },
] as const;

export function getCommunityExplorerProfileById(
  explorerId: string,
): CommunityExplorerProfile | undefined {
  return communityExplorerProfiles.find((profile) => profile.id === explorerId);
}

export function getCommunityPostsByAuthorId(authorId: string): CommunityPost[] {
  return communityPosts.filter((post) => post.authorId === authorId);
}
