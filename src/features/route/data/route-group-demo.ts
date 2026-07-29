import type { RouteDto } from "@/features/route/api/route-api";
import {
  communityExplorerProfiles,
  type CommunityExplorerProfile,
} from "@/features/community/data/community-demo";
import { routes } from "@/lib/demo-data";

export type RouteGroupStatus = "INVITED" | "SCHEDULED" | "LIVE";
export type RouteGroupVisibility = "FOLLOWING" | "LINK";

export type RouteGroupMember = {
  id: string;
  avatarUri: string;
  name: string;
  role: string;
  username: string;
  isHost?: boolean;
};

export type RouteGroupDemo = {
  id: string;
  routeId?: number | null;
  routeName: string;
  coverUri: string;
  members: RouteGroupMember[];
  invitedFriends: RouteGroupMember[];
  host: RouteGroupMember;
  meetupAtLabel: string;
  durationLabel: string;
  meetingPoint: string;
  note: string;
  vibeLabel: string;
  capacity: number;
  visibility: RouteGroupVisibility;
  status: RouteGroupStatus;
};

const fallbackCoverUri =
  "https://i.pinimg.com/1200x/80/69/f9/8069f9581583a196f9f39bda000b9312.jpg";

function readProfile(profileId: string) {
  return communityExplorerProfiles.find((profile) => profile.id === profileId) ?? null;
}

function toMember(
  profile: CommunityExplorerProfile,
  overrides?: Partial<RouteGroupMember>,
): RouteGroupMember {
  return {
    id: profile.id,
    avatarUri: profile.avatar ?? fallbackCoverUri,
    name: profile.name,
    role: profile.role,
    username: profile.username,
    ...overrides,
  };
}

const khaAnProfile = readProfile("khanh-an");
const haVyProfile = readProfile("ha-vy");
const tuanKietProfile = readProfile("tuan-kiet");
const maiLinhProfile = readProfile("mai-linh");

const hostKhanhAn = khaAnProfile
  ? toMember(khaAnProfile, { isHost: true })
  : {
      id: "khanh-an",
      avatarUri: fallbackCoverUri,
      name: "Khánh An",
      role: "Meetup host",
      username: "@khanhan.meetup",
      isHost: true,
    };

const hostHaVy = haVyProfile
  ? toMember(haVyProfile, { isHost: true })
  : {
      id: "ha-vy",
      avatarUri: fallbackCoverUri,
      name: "Hà Vy",
      role: "Culture guide",
      username: "@havy.notes",
      isHost: true,
    };

const followings: RouteGroupMember[] = [
  hostKhanhAn,
  haVyProfile
    ? toMember(haVyProfile)
    : {
        id: "ha-vy",
        avatarUri: fallbackCoverUri,
        name: "Hà Vy",
        role: "Culture guide",
        username: "@havy.notes",
      },
  tuanKietProfile
    ? toMember(tuanKietProfile)
    : {
        id: "tuan-kiet",
        avatarUri: fallbackCoverUri,
        name: "Tuấn Kiệt",
        role: "Explorer level 9",
        username: "@tkiet.sunset",
      },
  maiLinhProfile
    ? toMember(maiLinhProfile)
    : {
        id: "mai-linh",
        avatarUri: fallbackCoverUri,
        name: "Mai Linh",
        role: "Story hunter",
        username: "@nguyenngocdh.story",
      },
];

function readRouteCover(routeName: string) {
  const matchedRoute = routes.find((item) => item.title === routeName);
  return matchedRoute?.cover ?? fallbackCoverUri;
}

export const followingRouteInviteMembers = followings;

export const followingRouteInvitesDemo: RouteGroupDemo[] = [
  {
    id: "following-group-1",
    routeName: "Phố cổ về đêm",
    coverUri: readRouteCover("Phố cổ về đêm"),
    members: [hostKhanhAn, followings[1], followings[2]],
    invitedFriends: [followings[1], followings[2], followings[3]],
    host: hostKhanhAn,
    meetupAtLabel: "Thứ 7, 19:30",
    durationLabel: "90 phút",
    meetingPoint: "Bưu điện Thành phố",
    note:
      "Nhóm nhỏ thiên về kể chuyện và chụp ảnh đêm, phù hợp nếu muốn đi chậm và có nhiều lúc dừng lại.",
    vibeLabel: "Nhóm 3-5 người",
    capacity: 5,
    visibility: "FOLLOWING",
    status: "INVITED",
  },
  {
    id: "following-group-2",
    routeName: "Săn dấu ấn Chợ Lớn",
    coverUri: readRouteCover("Săn dấu ấn Chợ Lớn"),
    members: [hostHaVy, followings[0], followings[2], followings[3]],
    invitedFriends: [followings[0], followings[2]],
    host: hostHaVy,
    meetupAtLabel: "Chủ nhật, 07:15",
    durationLabel: "2 giờ",
    meetingPoint: "Chùa Bà Thiên Hậu",
    note:
      "Đi sớm để tránh nắng, có checklist note nhanh cho từng điểm để ai mới đi cũng bắt nhịp được.",
    vibeLabel: "Route học nhanh",
    capacity: 6,
    visibility: "LINK",
    status: "SCHEDULED",
  },
];

export const myRouteGroupsDemo: RouteGroupDemo[] = [
  {
    id: "my-group-1",
    routeName: "Phố cổ về đêm",
    coverUri: readRouteCover("Phố cổ về đêm"),
    members: [hostKhanhAn, followings[1], followings[3]],
    invitedFriends: [followings[2]],
    host: hostKhanhAn,
    meetupAtLabel: "Hôm nay, 19:30",
    durationLabel: "90 phút",
    meetingPoint: "Nhà hát Thành phố",
    note: "Bạn đã nhận lời. Nhóm đang chờ thêm 1 bạn xác nhận để chốt lịch đi.",
    vibeLabel: "Còn 1 chỗ trống",
    capacity: 4,
    visibility: "FOLLOWING",
    status: "INVITED",
  },
  {
    id: "my-group-2",
    routeName: "Kiến trúc Pháp giữa lòng Sài Gòn",
    coverUri: readRouteCover("Vịnh Hạ Long"),
    members: [followings[3], followings[1], followings[2], followings[0]],
    invitedFriends: [],
    host: followings[3],
    meetupAtLabel: "Thứ 7, 08:00",
    durationLabel: "95 phút",
    meetingPoint: "Bưu điện Thành phố",
    note:
      "Nhóm do bạn tạo để rủ bạn đang follow tham gia cùng tuyến này. Hiện đã đủ thành viên để bắt đầu.",
    vibeLabel: "Đã đủ 4/4 người",
    capacity: 4,
    visibility: "LINK",
    status: "SCHEDULED",
  },
  {
    id: "my-group-3",
    routeName: "Săn dấu ấn Chợ Lớn",
    coverUri: readRouteCover("Săn dấu ấn Chợ Lớn"),
    members: [hostHaVy, followings[2], followings[0]],
    invitedFriends: [],
    host: hostHaVy,
    meetupAtLabel: "Đang diễn ra",
    durationLabel: "2 giờ",
    meetingPoint: "Chợ Bình Tây",
    note:
      "Nhóm đang đi thực tế, mục tiêu là hoàn thành đủ checkpoint và gom ảnh/story cho cả team.",
    vibeLabel: "Đã check-in 2/5 điểm",
    capacity: 5,
    visibility: "FOLLOWING",
    status: "LIVE",
  },
];

export function buildRouteDetailGroupPreview(route: RouteDto): RouteGroupDemo {
  const routeTheme = route.tags[0]?.tagName?.trim() || "Văn hóa";
  const meetingPoint =
    route.hotspots[0]?.hotspotName?.trim() || "Điểm đầu tiên của tuyến";
  const coverUri = route.medias[0]?.fileUrl?.trim() || fallbackCoverUri;

  return {
    id: `route-detail-group-${route.routeId}`,
    routeId: route.routeId,
    routeName: route.routeName,
    coverUri,
    members: [hostKhanhAn, followings[1], followings[2]],
    invitedFriends: followings,
    host: hostKhanhAn,
    meetupAtLabel: "Thứ 7 này, 18:30",
    durationLabel: `${route.estimateTime || 90} phút`,
    meetingPoint,
    note: `Một nhóm nhỏ từ mạng lưới bạn theo dõi đang rất hợp với tuyến ${routeTheme.toLowerCase()} này.`,
    vibeLabel: "Ưu tiên bạn đang follow",
    capacity: 5,
    visibility: "FOLLOWING",
    status: "INVITED",
  };
}
