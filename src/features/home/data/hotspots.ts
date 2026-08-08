import type { Href } from "expo-router";
import {
  nearbyPlaces,
  type NearbyPlaceCard,
  type SymbolName,
} from "./home-screen.mock";

export type HotspotDetail = NearbyPlaceCard & {
  address: string;
  bestTimeLabel: string;
  checkinMode?: "always-ready" | "gps";
  coordinate?: HotspotCoordinate | null;
  /** Bán kính vùng check-in (mét) do curator đặt riêng cho hotspot này. */
  checkInRadius?: number | null;
  /** Ranh giới GeoJSON Polygon; nếu có thì được ưu tiên hơn bán kính. */
  boundaryGeoJson?: string | null;
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

export type HotspotCoordinate = {
  latitude: number;
  longitude: number;
};

const nearbyPlaceLookup = new Map(
  nearbyPlaces.map((place) => [place.slug, place] as const),
);

const hotspotCoordinatesBySlug: Record<string, HotspotCoordinate> = {
  "bao-tang-my-thuat": { latitude: 10.7694, longitude: 106.6981 },
  "buu-dien-sai-gon": { latitude: 10.78012, longitude: 106.69901 },
  "cho-dam": { latitude: 12.25136, longitude: 109.19063 },
  "demo-checkin-story": { latitude: 10.77712, longitude: 106.69531 },
  "dinh-doc-lap": { latitude: 10.77712, longitude: 106.69531 },
  "duong-sach-nguyen-van-binh": { latitude: 10.78039, longitude: 106.69957 },
  "nha-hat-thanh-pho": { latitude: 10.77656, longitude: 106.70335 },
  "nha-tho-duc-ba": { latitude: 10.77972, longitude: 106.69903 },
  "pho-di-bo-nguyen-hue": { latitude: 10.77274, longitude: 106.70322 },
};

function toRadians(value: number) {
  return (value * Math.PI) / 180;
}

function getDistanceMeters(from: HotspotCoordinate, to: HotspotCoordinate) {
  const earthRadius = 6_371_000;
  const latitudeDelta = toRadians(to.latitude - from.latitude);
  const longitudeDelta = toRadians(to.longitude - from.longitude);
  const fromLatitude = toRadians(from.latitude);
  const toLatitude = toRadians(to.latitude);

  const a =
    Math.sin(latitudeDelta / 2) * Math.sin(latitudeDelta / 2) +
    Math.cos(fromLatitude) *
      Math.cos(toLatitude) *
      Math.sin(longitudeDelta / 2) *
      Math.sin(longitudeDelta / 2);

  return earthRadius * (2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a)));
}

function normalizeLookupText(value: string) {
  return value
    .trim()
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9]+/g, " ")
    .trim();
}

function getRequiredNearbyPlace(slug: string) {
  const place = nearbyPlaceLookup.get(slug);

  if (!place) {
    throw new Error(`Missing nearby place seed for hotspot slug: ${slug}`);
  }

  return place;
}

export const hotspotCollection: HotspotDetail[] = [
  {
    ...getRequiredNearbyPlace("demo-checkin-story"),
    address: "Đường Hạnh Phúc, Đồng Văn, Hà Giang",
    bestTimeLabel:
      "Tháng 9 - 11 (mùa lúa chín) và tháng 10 - 12 (mùa hoa tam giác mạch)",
    checkinMode: "always-ready",
    district: "Đồng Văn",
    gallery: [
      "https://i.pinimg.com/736x/24/a2/bc/24a2bc1a4690d4418269ab82feb64415.jpg",
      "https://i.pinimg.com/736x/3c/3f/8f/3c3f8fe464fa9b0bea4f2d3fc0dffe68.jpg",
      "https://i.pinimg.com/736x/66/ee/9d/66ee9de813ce7fecd5d159cad2c5b701.jpg",
    ],
    highlights: [
      "Một trong những cung đường đèo đẹp nhất Việt Nam.",
      "Ngắm toàn cảnh sông Nho Quế xanh ngọc từ trên cao.",
      "Khung cảnh núi đá hùng vĩ đặc trưng của Cao nguyên đá Đồng Văn.",
    ],
    overview:
      "Đèo Mã Pí Lèng là biểu tượng du lịch của Hà Giang, nằm trên tuyến đường Hạnh Phúc nối Đồng Văn và Mèo Vạc.",
    routePairing:
      "Kết hợp tham quan sông Nho Quế, hẻm Tu Sản, phố cổ Đồng Văn và cột cờ Lũng Cú.",
    scheduleLabel: "Mở cửa cả ngày",
    story:
      "Đèo Mã Pí Lèng được mệnh danh là 'vua của các con đèo Việt Nam'. Con đèo dài khoảng 20 km uốn lượn giữa những dãy núi đá tai mèo hùng vĩ của Công viên Địa chất Toàn cầu Cao nguyên đá Đồng Văn. Từ các điểm dừng chân trên đèo, du khách có thể phóng tầm mắt xuống dòng sông Nho Quế xanh biếc và hẻm vực Tu Sản sâu hàng trăm mét – một trong những kỳ quan thiên nhiên nổi bật nhất miền Bắc.",
    ticketLabel: "Miễn phí tham quan",
    tips: [
      "Nên đi vào sáng sớm hoặc chiều muộn để có ánh sáng đẹp.",
      "Mang áo khoác vì thời tiết trên đèo thường khá lạnh.",
      "Dừng chân tại các điểm lookout để ngắm sông Nho Quế.",
    ],
    vibeTags: ["Hà Giang", "Thiên nhiên", "Phượt", "Check-in", "Núi non"],
  },
  {
    ...getRequiredNearbyPlace("buu-dien-sai-gon"),
    address: "02 Cong xa Paris, Ben Nghe, Quan 1, TP. HCM",
    bestTimeLabel: "08:00 - 10:30 de chup anh dep va it dong",
    district: "Quan 1",
    gallery: [
      "https://i.pinimg.com/1200x/10/84/64/108464cf80cab6840c4957557fbe9513.jpg",
      "https://i.pinimg.com/1200x/41/4e/5d/414e5d896f699ec3819f793f04bdb949.jpg",
      "https://i.pinimg.com/1200x/3b/e6/c7/3be6c7ce77d44c3dfb6723169f24f8d7.jpg",
    ],
    highlights: [
      "Kiến trúc Pháp cổ điển kết hợp không gian bưu chính còn hoạt động.",
      "Trần vòm cao, sàn gạch có và quầy gỗ tạo cảm giác như một nhà ga lịch sử.",
      "ất hợp để bắt đầu route trung tâm vì gần Nhà thờ Đức Bà và đường Sách.",
    ],
    overview:
      "Icon kiến trúc của Sài Gòn, nơi du khách có thể ngắm không gian cổ điển.",
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
    ...getRequiredNearbyPlace("nha-tho-duc-ba"),
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
      "Nhà thờ Đức Bà mang đến một điểm dừng yên bình ngay giữa trung tâm.",
    routePairing:
      "ết hợp với Bưu điện Sài Gòn và công viên 30/4 cho một route 75 phút.",
    scheduleLabel: "Khung vien mo ca ngay, gio le tuy lich nha tho",
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
    ...getRequiredNearbyPlace("bao-tang-my-thuat"),
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
    overview: "Bảo tàng Mỹ thuật là điểm dừng cho những ai muốn xem tác phẩm.",
    routePairing:
      "Nối tiếp rất hợp với Bến Thành và các quán cà phê có ở Nguyễn Thái Bình.",
    scheduleLabel: "Mở cửa 08:00 - 17:00",
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
    title: "Phố đi bộ Nguyễn Huệ",
    address: "Nguyễn Huệ, Bến Nghé, Quận 1, TP. HCM",
    bestTimeLabel: "18:00 - 20:00 để xem thành phố lên đèn",
    district: "Quận 1",
    gallery: [
      "https://i.pinimg.com/1200x/1d/52/c1/1d52c1214361f0cd45c9b89d5a2804b9.jpg",
      "https://i.pinimg.com/1200x/44/85/48/4485485aa286ec2089b6d265211d659a.jpg",
      "https://i.pinimg.com/1200x/c7/e0/4c/c7e04c5e13bc7c8606f68356de303648.jpg",
    ],
    highlights: [
      "Góc nhìn rộng, hợp cho check-in ban đêm và ngắm mặt tiền toà nhà.",
      "Không khí mở, nhiều nhóm bạn trẻ và hoạt động cuối tuần.",
      "Tốt cho route nhẹ nhàng sau bữa tối hoặc sau khi tham quan trung tâm.",
    ],
    overview:
      "Phố đi bộ Nguyễn Huệ là điểm dừng để ngắm nhịp sống hiện đại của thành phố.",
    routePairing:
      "Có thể kết hợp với Bến Bạch Đằng hoặc các quán cà phê view cao quanh khu vực.",
    scheduleLabel: "Không gian cong cong mở cửa mỗi ngày",
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
    title: "Nhà hát Thành phố",
    address: "07 Cong truong Lam Son, Ben Nghe, Quan 1, TP. HCM",
    bestTimeLabel: "17:00 - 19:00 de ngam mat tien khi len den",
    district: "Quan 1",
    gallery: [
      "https://i.pinimg.com/1200x/97/22/ab/9722ab09477d59286d9ff0f9d4fcf452.jpg",
      "https://i.pinimg.com/1200x/59/95/5b/59955b2b785c7bc861c8b267d17b02e6.jpg",
      "https://i.pinimg.com/1200x/e2/7d/91/e27d9157f8c0fe1a8eb9358b5e4eac01.jpg",
    ],
    highlights: [
      "Mặt tiền kiến trúc cổ điển tạo điểm nhấn mạnh trên trục Đông Khởi.",
      "ợp cho check-in nhanh hoặc kết hợp trước một buổi xem biểu diễn.",
      "Không gian xung quanh nhiều khách sạn, cà phê và nhà hàng.",
    ],
    overview:
      "Nhà hát Thành phố là điểm dừng ngắn gọn nhưng đầy chất thị giác.",
    routePairing: "ối tiếp Nguyễn Huệ, Đông Khởi và Bến Bạch Đằng rất hợp.",
    scheduleLabel: "Khung viên ngoài trời mở cửa mỗi ngày",
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
    title: "Dinh Độc Lập",
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
    overview: "Dinh Độc Lập mang den trai nghiem lich su ro rang hon.",
    routePairing:
      "Ket hop Nha tho Duc Ba, Buu dien va cong vien 30/4 thanh route lich su trung tam.",
    scheduleLabel: "Mo cua 08:00 - 15:30",
    story:
      "Khong gian Dinh Độc Lập giu lai nhieu dau moc quan trong cua lich su hien dai. O day, trai nghiem khong chi den tu kien truc ma con den tu cach khong gian duoc giu gin va ke chuyen qua tung tang, tung phong.",
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
  {
    category: "Lịch sử",
    distance: "0.4 km",
    imageUri:
      "https://i.pinimg.com/1200x/b3/07/e7/b307e7540a1d2c91f96933794c0b681c.jpg",
    rating: 4.8,
    reviews: "1.2k",
    reward: "+80",
    slug: "ben-thanh",
    title: "Chợ Bến Thành",
    address: "Lê Lợi, Phường Bến Thành, Quận 1, TP.HCM",
    bestTimeLabel: "07:00 - 09:00 để tránh đông và có ánh sáng đẹp",
    district: "Quận 1",
    gallery: [
      "https://i.pinimg.com/1200x/b3/07/e7/b307e7540a1d2c91f96933794c0b681c.jpg",
      "https://i.pinimg.com/736x/00/17/04/001704938bb7cf0b964b07a6b2eeffc4.jpg",
      "https://i.pinimg.com/1200x/80/69/f9/8069f9581583a196f9f39bda000b9312.jpg",
    ],
    highlights: [
      "Biểu tượng thương mại Sài Gòn từ thế kỷ 19.",
      "Giao thoa giữa nhịp sống hiện đại và ký ức chợ truyền thống.",
      "Điểm bắt đầu lý tưởng cho các tuyến khám phá trung tâm.",
    ],
    overview:
      "Chợ Bến Thành là biểu tượng buôn bán của Sài Gòn, nơi mỗi gian hàng và ô cửa gỗ đều mang một lớp ký ức.",
    routePairing: "Kết hợp Bưu điện, Nhà thờ Đức Bà và Dinh Độc Lập trong một buổi sáng.",
    scheduleLabel: "Mở cửa 06:00 - 18:00",
    story:
      "Nghe đồn hồ đồng trên mái chợ vang lên, người bán hàng xưa biết giờ đóng cửa. Tiếng rao vẫn vọng trong những ô cửa gỗ — như lời nhắc rằng Sài Gòn luôn bắt đầu từ một góc chợ.",
    ticketLabel: "Miễn phí vào cổng",
    tips: [
      "Đi sáng sớm để tránh nắng và đông người.",
      "Mang tiền mặt nếu muốn thử đặc sản trong chợ.",
      "Dừng lại góc chụp ảnh trước tháp đồng hồ.",
    ],
    vibeTags: ["Lịch sử", "Ẩm thực", "Check-in"],
  },
  {
    category: "Văn hoá",
    distance: "3.2 km",
    imageUri:
      "https://i.pinimg.com/736x/25/c7/c1/25c7c1671263058c274374435c142b4f.jpg",
    rating: 4.8,
    reviews: "654",
    reward: "+85",
    slug: "thien-hau",
    title: "Chùa Bà Thiên Hậu",
    address: "710 Nguyễn Trãi, Phường 11, Quận 5, TP.HCM",
    bestTimeLabel: "07:00 - 09:00 hoặc mùng 1, rằm",
    district: "Quận 5",
    gallery: [
      "https://i.pinimg.com/736x/25/c7/c1/25c7c1671263058c274374435c142b4f.jpg",
    ],
    highlights: [
      "Chùa cổ của người Hoa tại Chợ Lớn với kiến trúc tam quan đặc trưng.",
      "Không gian tâm linh giữa nhịp sống ồn ào của khu phố người Hoa.",
      "Phù hợp cho tuyến khám phá văn hoá Chợ Lớn.",
    ],
    overview:
      "Ngôi chùa cổ nổi bật với hương khói quanh năm và kiến trúc mang đậm dấu ấn người Hoa.",
    routePairing: "Kết hợp Chợ Lớn và các hẻm ẩm thực Quận 5 trong 90 phút.",
    scheduleLabel: "Mở cửa 06:00 - 18:00",
    story:
      "Khói hương bay qua mái cong, mang theo lời cầu của người xa xứ. Chùa vẫn đứng im giữa Chợ Lớn ồn ào — như một mảnh ký ức không đổi.",
    ticketLabel: "Miễn phí",
    tips: [
      "Mặc trang phục lịch sự khi vào khuôn viên chùa.",
      "Nên ghé sáng mùng 1 hoặc rằm để cảm nhận không khí lễ hội.",
      "Kết hợp thử ẩm thực đường phố xung quanh.",
    ],
    vibeTags: ["Chợ Lớn", "Tâm linh", "Văn hoá"],
  },
  {
    category: "Ẩm thực",
    distance: "3.5 km",
    imageUri:
      "https://i.pinimg.com/1200x/b3/07/e7/b307e7540a1d2c91f96933794c0b681c.jpg",
    rating: 4.7,
    reviews: "1.1k",
    reward: "+100",
    slug: "cho-lon",
    title: "Chợ Lớn – Khu phố người Hoa",
    address: "Khu vực Quận 5 & Quận 6, TP.HCM",
    bestTimeLabel: "16:00 - 20:00 để thưởng thức ẩm thực và chợ đêm",
    district: "Quận 5",
    gallery: [
      "https://i.pinimg.com/1200x/b3/07/e7/b307e7540a1d2c91f96933794c0b681c.jpg",
      "https://i.pinimg.com/736x/25/c7/c1/25c7c1671263058c274374435c142b4f.jpg",
    ],
    highlights: [
      "Khu phố sầm uất với hội quán, tiệm vàng và ẩm thực đường phố.",
      "Trải nghiệm văn hoá người Hoa giữa lòng Sài Gòn.",
      "Nhiều checkpoint ẩm thực và câu chuyện di cư.",
    ],
    overview:
      "Chợ Lớn là thế giới riêng — ẩm thực, tín ngưỡng và thương mại hòa quyện trong từng con hẻm.",
    routePairing: "Kết hợp Chùa Bà Thiên Hậu và các tuyến săn dấu ấn Chợ Lớn.",
    scheduleLabel: "Hoạt động cả ngày, sầm uất nhất buổi chiều tối",
    story:
      "Tiếng Quảng vang trong hẻm nhỏ, mùi bánh bao nóng hổi từ lò hấm. Chợ Lớn không chỉ là nơi mua bán — mà là cả một thế giới ký ức di cư.",
    ticketLabel: "Miễn phí",
    tips: [
      "Thử bánh bao, hủ tiếu và các món đặc trưng người Hoa.",
      "Đi bộ chậm trong hẻm để không bỏ lỡ góc chụp đẹp.",
      "Mang tiền mặt cho các quán nhỏ.",
    ],
    vibeTags: ["Chợ Lớn", "Ẩm thực", "Văn hoá"],
  },
];

export function getHotspotCoordinateBySlug(slug: string) {
  return hotspotCoordinatesBySlug[slug] ?? null;
}

export function getNearbyHotspotsFromCoordinate(
  coordinate: HotspotCoordinate,
  limit = hotspotCollection.length,
) {
  return hotspotCollection
    .map((hotspot, index) => {
      const hotspotCoordinate = getHotspotCoordinateBySlug(hotspot.slug);

      return {
        distanceMeters: hotspotCoordinate
          ? getDistanceMeters(coordinate, hotspotCoordinate)
          : null,
        hotspot,
        index,
      };
    })
    .sort((left, right) => {
      if (left.distanceMeters === null && right.distanceMeters === null) {
        return left.index - right.index;
      }

      if (left.distanceMeters === null) {
        return 1;
      }

      if (right.distanceMeters === null) {
        return -1;
      }

      return left.distanceMeters - right.distanceMeters;
    })
    .slice(0, limit)
    .map(({ hotspot }) => hotspot);
}

export function findMatchingHotspotByNameOrCoordinate({
  hotspotName,
  latitude,
  longitude,
}: {
  hotspotName: string;
  latitude: number;
  longitude: number;
}) {
  const normalizedTargetName = normalizeLookupText(hotspotName);
  const exactTitleMatch = hotspotCollection.find(
    (hotspot) => normalizeLookupText(hotspot.title) === normalizedTargetName,
  );

  if (exactTitleMatch) {
    return exactTitleMatch;
  }

  const partialTitleMatch = hotspotCollection.find((hotspot) => {
    const normalizedTitle = normalizeLookupText(hotspot.title);

    return (
      normalizedTargetName.includes(normalizedTitle) ||
      normalizedTitle.includes(normalizedTargetName)
    );
  });

  if (partialTitleMatch) {
    return partialTitleMatch;
  }

  let closestHotspot: HotspotDetail | null = null;
  let closestDistanceMeters = Number.POSITIVE_INFINITY;

  hotspotCollection.forEach((hotspot) => {
    const hotspotCoordinate = getHotspotCoordinateBySlug(hotspot.slug);

    if (!hotspotCoordinate) {
      return;
    }

    const distanceMeters = getDistanceMeters(
      {
        latitude,
        longitude,
      },
      hotspotCoordinate,
    );

    if (distanceMeters <= 180 && distanceMeters < closestDistanceMeters) {
      closestDistanceMeters = distanceMeters;
      closestHotspot = hotspot;
    }
  });

  return closestHotspot;
}

export function getHotspotBySlug(slug?: string | string[]) {
  const resolvedSlug = Array.isArray(slug) ? slug[0] : slug;

  return hotspotCollection.find((item) => item.slug === resolvedSlug);
}

export function getApiHotspotRouteSlug(hotspotId: number) {
  return `api-hotspot-${hotspotId}`;
}

function normalizeRouteHrefValue(routeId?: number | string | null) {
  const parsedRouteId =
    typeof routeId === "number" ? routeId : Number(routeId ?? NaN);

  return Number.isInteger(parsedRouteId) && parsedRouteId > 0
    ? parsedRouteId
    : null;
}

export function getHotspotHref(
  slug: string,
  hotspotId?: number | null,
  routeId?: number | string | null,
) {
  const normalizedHotspotId =
    typeof hotspotId === "number" && Number.isInteger(hotspotId) && hotspotId > 0
      ? hotspotId
      : null;
  const normalizedRouteId = normalizeRouteHrefValue(routeId);

  if (
    normalizedHotspotId === null &&
    normalizedRouteId === null
  ) {
    return `/hotspot/${slug}` as unknown as Href;
  }

  return {
    params: {
      ...(normalizedHotspotId !== null
        ? { hotspotId: `${normalizedHotspotId}` }
        : {}),
      ...(normalizedRouteId !== null
        ? { routeId: `${normalizedRouteId}` }
        : {}),
      slug,
    },
    pathname: "/hotspot/[slug]",
  } as Href;
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
