import type { Href } from "expo-router";
import {
  nearbyPlaces,
  type NearbyPlaceCard,
  type SymbolName,
} from "./home-screen.mock";

export type HotspotDetail = NearbyPlaceCard & {
  address: string;
  bestTimeLabel: string;
  district: string;
  gallery: string[];
  highlights: string[];
  overview: string;
  routePairing: string;
  scheduleLabel: string;
  story: string;
  ticketLabel: string;
  tips: string[];
  vibeTags: string[];
};

export const hotspotCollection: HotspotDetail[] = [
  {
    ...nearbyPlaces[0],
    address: "02 Cong xa Paris, Ben Nghe, Quan 1, TP. HCM",
    bestTimeLabel: "08:00 - 10:30 de chup anh dep va it dong",
    district: "Quan 1",
    gallery: [
      "https://i.pinimg.com/1200x/10/84/64/108464cf80cab6840c4957557fbe9513.jpg",
      "https://i.pinimg.com/1200x/41/4e/5d/414e5d896f699ec3819f793f04bdb949.jpg",
      "https://i.pinimg.com/1200x/3b/e6/c7/3be6c7ce77d44c3dfb6723169f24f8d7.jpg",
    ],
    highlights: [
      "Kien truc Phap co dien ket hop khong gian buu chinh con hoat dong.",
      "Tran vom cao, san gach co va quay go tao cam giac nhu mot nha ga lich su.",
      "Rat hop de bat dau route trung tam vi gan Nha tho Duc Ba va duong sach.",
    ],
    overview:
      "Icon kien truc cua Sai Gon, noi du khach co the ngam khong gian co dien va bat dau hanh trinh van hoa ngay giua trung tam.",
    routePairing:
      "Ket hop cung Nha tho Duc Ba va Duong sach Nguyen Van Binh trong 90 phut.",
    scheduleLabel: "Mo cua 07:30 - 18:00",
    story:
      "Buu dien Trung tam Sai Gon duoc xem la mot trong nhung cong trinh de nhan ra nhat cua thanh pho. Ben trong la nhung duong net cong mem, khung thep lon va mau vang co dien giu lai cam giac cua mot Sai Gon xua nhung van song dong den hom nay.",
    ticketLabel: "Mien phi vao cong",
    tips: [
      "Den som de tranh dong va chup duoc mat tien thong thoang.",
      "Di bo them 3 phut la den Nha tho Duc Ba va duong sach.",
      "Mang tai nghe neu ban muon nghe audio story khi tham quan.",
    ],
    vibeTags: ["Kien truc", "Lich su", "Check-in"],
  },
  {
    ...nearbyPlaces[1],
    address: "01 Cong xa Paris, Ben Nghe, Quan 1, TP. HCM",
    bestTimeLabel: "07:00 - 09:00 de co anh dep va khong khi diu",
    district: "Quan 1",
    gallery: [
      "https://i.pinimg.com/1200x/96/59/5b/96595b208df548a0b2342b0ed10ddaea.jpg",
      "https://i.pinimg.com/1200x/37/6a/8f/376a8fcf9f7324df4b4f2ea362c26bcc.jpg",
      "https://i.pinimg.com/1200x/a0/3d/53/a03d53907a86a287793bc499a0406154.jpg",
    ],
    highlights: [
      "Mat do cong dong dep, khong gian rong va de nhan dien tu xa.",
      "Noi giao nhau giua di san ton giao, kien truc va du lich trung tam.",
      "Rat hop cho route buoi sang ket hop chup anh va ghe quan cafe gan do.",
    ],
    overview:
      "Nha tho Duc Ba mang den mot diem dung yen binh ngay giua trung tam, noi nhieu du khach tim den de ngam kien truc va cam nhan nhip song thanh pho.",
    routePairing:
      "Ket hop voi Buu dien Sai Gon va cong vien 30/4 cho mot route 75 phut.",
    scheduleLabel: "Khuon vien mo ca ngay, gio le tuy lich nha tho",
    story:
      "Cong trinh nay la mot trong nhung bieu tuong lau doi cua Sai Gon. Dung giua quang truong rong, nha tho tao nen mot nhan trung tam ve thi giac, noi du khach co the cham lai mot chut truoc khi tiep tuc route thanh pho.",
    ticketLabel: "Mien phi khuon vien",
    tips: [
      "Dung ben phia cong vien 30/4 de chup duoc toan canh mat tien.",
      "Nen den vao sang som de anh sang len dep va de di bo tiep.",
      "Kiem tra lich le neu muon vao khong gian ben trong.",
    ],
    vibeTags: ["Lich su", "Kien truc", "Thu gian"],
  },
  {
    ...nearbyPlaces[2],
    address: "97A Pho Duc Chinh, Nguyen Thai Binh, Quan 1, TP. HCM",
    bestTimeLabel: "09:30 - 11:00 de xem tranh va it nhom doan",
    district: "Quan 1",
    gallery: [
      "https://i.pinimg.com/736x/b3/ba/e4/b3bae4f18bd01e9d80df049017791854.jpg",
      "https://i.pinimg.com/736x/89/ff/12/89ff12e4efe8892043e13329fe6369bd.jpg",
      "https://i.pinimg.com/736x/ed/bc/93/edbc932706541d1bee09f080f898c5c2.jpg",
    ],
    highlights: [
      "Khong gian trien lam va cau thang co rat hop de chup anh noi that.",
      "Noi quy tu hoi hoa, dieu khac va chat lieu thi giac cua Viet Nam.",
      "Phu hop cho route nghe thuat va nhung ai muon tham quan cham.",
    ],
    overview:
      "Bao tang My thuat la diem dung cho nhung ai muon xem tac pham, ngam khong gian co va doi nhip route thanh mot trai nghiem sau hon.",
    routePairing:
      "Noi tiep rat hop voi Ben Thanh va cac quan cafe co o Nguyen Thai Binh.",
    scheduleLabel: "Mo cua 08:00 - 17:00",
    story:
      "Khong chi la noi trung bay, bao tang con la mot khong gian kien truc dep va day chat lieu thi giac. Nhung hanh lang, cua so va cau thang o day giup trai nghiem nghe thuat tro nen gan gui va rat de nho.",
    ticketLabel: "Ve tham quan tu 30.000d",
    tips: [
      "Di giay de de len nhieu tang trien lam.",
      "Tranh khung gio trua neu ban muon chup cau thang dep.",
      "Danh 60 - 90 phut neu muon di het cac phong.",
    ],
    vibeTags: ["Nghe thuat", "Trong nha", "Check-in"],
  },
  {
    category: "Ẩm thực",
    distance: "0.8 km",
    imageUri: "https://images.unsplash.com/photo-1555400038-63f5ba517a47",
    rating: 4.7,
    reviews: "382",
    reward: "+150",
    slug: "cho-dam",
    title: "Chợ Đầm",
    address: "Bến Chợ, Vạn Thạnh, Nha Trang, Khánh Hòa",
    bestTimeLabel:
      "16:00 - 18:00 để thưởng thức đặc sản và không khí nhộn nhịp",
    district: "TP. Nha Trang",
    gallery: [
      "https://i.pinimg.com/736x/9e/bb/8e/9ebb8e836fd78c2540459b528738614e.jpg",
      "https://i.pinimg.com/736x/de/94/37/de94370b294b61ad7717c6caad300fe8.jpg",
      "https://i.pinimg.com/736x/50/8f/23/508f23b107ffd6ed6d01bd036c15fdfc.jpg",
    ],
    highlights: [
      "Khu chợ nổi tiếng nhất Nha Trang với kiến trúc hình hoa sen đặc trưng.",
      "Thiên đường đặc sản Khánh Hòa như bánh xoài, mực rim, hải sản khô.",
      "Điểm dừng chân lý tưởng để khám phá đời sống địa phương.",
    ],
    overview:
      "Chợ Đầm là trung tâm mua sắm và giao thương lâu đời của Nha Trang.",
    routePairing:
      "Phù hợp kết hợp với tuyến Tháp Bà Ponagar → Chợ Đầm → Quảng trường 2/4 → Tháp Trầm Hương.",
    scheduleLabel: "Mở cửa 05:00 - 18:30",
    story:
      "Từ nhiều thập kỷ qua, Chợ Đầm đã trở thành biểu tượng thương mại của Nha Trang. Không chỉ là nơi mua bán, khu chợ còn phản ánh nét văn hóa sinh hoạt của người dân phố biển qua từng gian hàng, món ăn và câu chuyện địa phương.",
    ticketLabel: "Miễn phí vào cổng",
    tips: [
      "Nên ghé vào buổi sáng để trải nghiệm không khí chợ truyền thống.",
      "Mua đặc sản tại các gian hàng có niêm yết giá rõ ràng.",
      "Đừng bỏ qua món bánh căn và nem nướng gần khu vực chợ.",
    ],
    vibeTags: ["Ẩm thực", "Địa phương", "Nhộn nhịp"],
  },
  {
    category: "Check-in",
    distance: "1.4 km",
    imageUri:
      "https://i.pinimg.com/1200x/0c/72/58/0c7258fd2a86a061f8aee4e9a260b75a.jpg",
    rating: 4.8,
    reviews: "368",
    reward: "+150",
    slug: "pho-di-bo-nguyen-hue",
    title: "Pho di bo Nguyen Hue",
    address: "Nguyen Hue, Ben Nghe, Quan 1, TP. HCM",
    bestTimeLabel: "18:00 - 20:00 de xem thanh pho len den",
    district: "Quan 1",
    gallery: [
      "https://i.pinimg.com/1200x/1d/52/c1/1d52c1214361f0cd45c9b89d5a2804b9.jpg",
      "https://i.pinimg.com/1200x/44/85/48/4485485aa286ec2089b6d265211d659a.jpg",
      "https://i.pinimg.com/1200x/c7/e0/4c/c7e04c5e13bc7c8606f68356de303648.jpg",
    ],
    highlights: [
      "Goc nhin rong, hop cho check-in ban dem va ngam mat tien toa nha.",
      "Khong khi mo, nhieu nhom ban tre va hoat dong cuoi tuan.",
      "Tot cho route nhe nhang sau bua toi hay sau khi tham quan trung tam.",
    ],
    overview:
      "Pho di bo Nguyen Hue la diem dung de ngam nhip song hien dai cua thanh pho, nhat la khi anh den va dong nguoi bat dau day len.",
    routePairing:
      "Co the ket hop voi Ben Bach Dang hoac cac quan cafe view cao quanh khu vuc.",
    scheduleLabel: "Khong gian cong cong mo ca ngay",
    story:
      "Khong gian dai va mo cua pho di bo tao ra mot san khau tu nhien cho thanh pho. Moi khung gio se cho cam giac khac nhau, tu sang som thong thoang den toi muon day anh den va am nhac.",
    ticketLabel: "Mien phi",
    tips: [
      "Den luc chieu toi de thay su chuyen canh cua anh sang.",
      "Mang nuoc va di giay de vi se di bo kha nhieu.",
      "Cuoi tuan dong hon nhung cung nhieu nang luong hon.",
    ],
    vibeTags: ["Check-in", "Ngoai troi", "Hien dai"],
  },
  {
    category: "Kien truc",
    distance: "1.8 km",
    imageUri:
      "https://i.pinimg.com/1200x/df/9c/0e/df9c0efa4280be655cf065cd82dbf8ad.jpg",
    rating: 4.7,
    reviews: "241",
    reward: "+135",
    slug: "nha-hat-thanh-pho",
    title: "Nha hat Thanh pho",
    address: "07 Cong truong Lam Son, Ben Nghe, Quan 1, TP. HCM",
    bestTimeLabel: "17:00 - 19:00 de ngam mat tien khi len den",
    district: "Quan 1",
    gallery: [
      "https://i.pinimg.com/1200x/97/22/ab/9722ab09477d59286d9ff0f9d4fcf452.jpg",
      "https://i.pinimg.com/1200x/59/95/5b/59955b2b785c7bc861c8b267d17b02e6.jpg",
      "https://i.pinimg.com/1200x/e2/7d/91/e27d9157f8c0fe1a8eb9358b5e4eac01.jpg",
    ],
    highlights: [
      "Mat tien kien truc co dien tao diem nhan manh tren truc Dong Khoi.",
      "Hop cho check-in nhanh hoac ket hop truoc mot buoi xem bieu dien.",
      "Khong gian xung quanh nhieu khach san, cafe va nha hang.",
    ],
    overview:
      "Nha hat Thanh pho la diem dung ngan gon nhung day chat thi giac, phu hop cho route can mot diem nhan kien truc thanh lich.",
    routePairing: "Noi tiep Nguyen Hue, Dong Khoi va Ben Bach Dang rat hop.",
    scheduleLabel: "Khuon vien ngoai troi mo ca ngay",
    story:
      "Voi mat tien sang trong va vi tri noi bat, Nha hat Thanh pho thuong xuyen xuat hien trong route du lich trung tam. Du chi dung lai ngan, ban van cam duoc tinh nhac tinh va khong khi thi thanh co dien quanh khu vuc nay.",
    ticketLabel: "Mien phi khuon vien, xem show tuy lich",
    tips: [
      "Check lich dien neu muon ket hop trai nghiem buoi toi.",
      "Dung ben doi dien de lay duoc toan bo mat tien vao khung anh.",
      "Rat hop cho mot stop 15 - 20 phut trong route.",
    ],
    vibeTags: ["Kien truc", "Sang trong", "Buoi toi"],
  },
  {
    category: "Lich su",
    distance: "2.1 km",
    imageUri:
      "https://i.pinimg.com/1200x/55/b8/30/55b830aff03459603cb9a6d06d99248a.jpg",
    rating: 4.8,
    reviews: "295",
    reward: "+170",
    slug: "dinh-doc-lap",
    title: "Dinh Doc Lap",
    address: "135 Nam Ky Khoi Nghia, Ben Thanh, Quan 1, TP. HCM",
    bestTimeLabel: "08:00 - 10:00 de di tham quan thong thoang",
    district: "Quan 1",
    gallery: [
      "https://i.pinimg.com/1200x/54/ec/4b/54ec4b02f47a18f8adf8668f24163d76.jpg",
      "https://i.pinimg.com/1200x/81/55/3f/81553f5b0a2eeea837f61bb64abd0c4a.jpg",
      "https://i.pinimg.com/1200x/1f/61/0f/1f610f377988929c76f076cbaf6d2adc.jpg",
    ],
    highlights: [
      "Khong gian rong, co nhieu phong tham quan va san vuon thoang.",
      "Noi dung lich su ro net, hop cho nguoi muon trai nghiem sau hon.",
      "Diem dung rat tot neu ban muon mot stop co tinh ke chuyen manh.",
    ],
    overview:
      "Dinh Doc Lap mang den trai nghiem lich su ro rang hon, phu hop cho nhung route can mot diem dung co chieu sau va noi dung tham quan cu the.",
    routePairing:
      "Ket hop Nha tho Duc Ba, Buu dien va cong vien 30/4 thanh route lich su trung tam.",
    scheduleLabel: "Mo cua 08:00 - 15:30",
    story:
      "Khong gian Dinh Doc Lap giu lai nhieu dau moc quan trong cua lich su hien dai. O day, trai nghiem khong chi den tu kien truc ma con den tu cach khong gian duoc giu gin va ke chuyen qua tung tang, tung phong.",
    ticketLabel: "Ve tham quan tu 65.000d",
    tips: [
      "Danh it nhat 75 phut neu muon tham quan ky.",
      "Mang theo non hoac o vi co doan di ngoai troi.",
      "Di som de de chup khuon vien va mat tien.",
    ],
    vibeTags: ["Lich su", "Rong rai", "Ke chuyen"],
  },
  {
    category: "Nghệ thuật",
    distance: "2.6 km",
    imageUri:
      "https://i.pinimg.com/1200x/d4/89/93/d48993dc5aa53a2224607b4f3925f441.jpg",
    rating: 4.9,
    reviews: "187",
    reward: "+145",
    slug: "duong-sach-nguyen-van-binh",
    title: "Biển Nha trang",
    address: "Nguyen Van Binh, Ben Nghe, Quan 1, TP. HCM",
    bestTimeLabel: "08:30 - 10:30 de di bo va ghe sach thoai mai",
    district: "Quan 1",
    gallery: [
      "https://i.pinimg.com/736x/30/03/55/300355f49106ebcd72f41e8759ed3268.jpg",
      "https://i.pinimg.com/1200x/ee/61/81/ee6181d71ad2998cbd46b760ccc833aa.jpg",
      "https://i.pinimg.com/1200x/68/bb/b6/68bbb6e9fc39da2edad07465f82d2822.jpg",
    ],
    highlights: [
      "Khong gian xanh, nhe va hop cho stop thu gian giua route.",
      "Nhieu quios sach, phu kien va cac goc ngoi doc de thu lai nhop route.",
      "Rat gan Buu dien va Nha tho Duc Ba nen ket hop de dang.",
    ],
    overview:
      "Biển Nha Trang là một điểm dừng nhẹ, đẹp và có nhiều chất liệu thị giác.",
    routePairing:
      "Ket hop voi Buu dien va Nha tho Duc Ba trong mot route 60 phut rat gon.",
    scheduleLabel: "Mo ca ngay, dong vui nhat tu 09:00 - 21:00",
    story:
      "Con duong ngan nhung tao duoc mot khong khi rieng, tach bot tieng xe va nhiet do cua pho lon. Day la diem dung ly tuong de doi nhip hanh trinh, ngoi lai mot chut va nhin thanh pho cham hon.",
    ticketLabel: "Mien phi",
    tips: [
      "Hop de ghe vao sau khi tham quan khu Buu dien - Nha tho.",
      "Buoi sang de di, buoi toi de ngam anh den va dong nguoi.",
      "Co the ngoi lai uong nuoc hoac mua sach nho.",
    ],
    vibeTags: ["Nghe thuat", "Thu gian", "Sach"],
  },
];

export function getHotspotBySlug(slug?: string | string[]) {
  const resolvedSlug = Array.isArray(slug) ? slug[0] : slug;

  return hotspotCollection.find((item) => item.slug === resolvedSlug);
}

export function getHotspotHref(slug: string) {
  return `/hotspot/${slug}` as unknown as Href;
}

export function getHotspotFactItems(hotspot: HotspotDetail): {
  icon: SymbolName;
  label: string;
  value: string;
}[] {
  return [
    {
      icon: {
        ios: "mappin.and.ellipse",
        android: "place",
        web: "place",
      },
      label: "Khoang cach",
      value: hotspot.distance,
    },
    {
      icon: {
        ios: "clock.fill",
        android: "schedule",
        web: "schedule",
      },
      label: "Khung gio dep",
      value: hotspot.bestTimeLabel,
    },
    {
      icon: {
        ios: "ticket.fill",
        android: "confirmation_number",
        web: "confirmation_number",
      },
      label: "Thong tin ve",
      value: hotspot.ticketLabel,
    },
    {
      icon: {
        ios: "sparkles",
        android: "auto_awesome",
        web: "auto_awesome",
      },
      label: "Thuong",
      value: `${hotspot.reward} XP`,
    },
  ];
}
