export type MediaItem = {
  type: 'image' | 'video';
  url: string;
  thumb?: string;
  duration?: string;
};

export type Review = {
  id: string;
  user: string;
  avatar: string;
  date: string;
  rating: number;
  text: string;
  media?: MediaItem[];
};

export type Hotspot = {
  id: string;
  name: string;
  image: string;
  gallery: string[];
  category: string;
  tags: string[];
  address: string;
  rating: number;
  reviewCount: number;
  xp: number;
  description: string;
  history: string;
  story: string;
  reviews: Review[];
};

export type NearbyHotspot = Hotspot & {
  distance: string;
  duration: string;
};

export type RouteItem = {
  id: string;
  title: string;
  subtitle: string;
  cover: string;
  era: string;
  difficulty: string;
  distance: string;
  duration: string;
  hotspotIds: string[];
  xp: number;
  rating: number;
  theme: string;
  meaning: string;
  story: string;
  connection: string;
};

export type RouteStop = Hotspot & {
  distance: string;
  duration: string;
};

export type RouteReview = {
  id: string;
  user: string;
  avatar: string;
  date: string;
  rating: number;
  highlight: string;
  text: string;
  completedIn: string;
  tags: string[];
  helpful: number;
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
    subtitle:
      'Lộ trình ghé Chợ Bến Thành, Bưu điện Thành phố và những góc kể chuyện văn hóa giữa trung tâm.',
    cover:
      'https://i.pinimg.com/1200x/80/69/f9/8069f9581583a196f9f39bda000b9312.jpg',
    era: 'Di sản',
    difficulty: 'Dễ',
    distance: '2.4 km',
    duration: '95 phút',
    hotspotIds: ['ben-thanh', 'buu-dien', 'nha-tho-duc-ba', 'dinh-doc-lap', 'bao-tang', 'pho-di-bo'],
    xp: 120,
    rating: 4.8,
    theme:
      'Hành trình khám phá các biểu tượng kiến trúc và thương mại của Sài Gòn — nơi mỗi điểm dừng là một lớp ký ức chồng lên nhau.',
    meaning:
      'Tuyến này kết nối những công trình mang dấu ấn thuộc địa Pháp với nhịp sống hiện đại, giúp bạn hiểu vì sao trung tâm TP.HCM được hình thành như ngày nay.',
    story:
      'Bắt đầu từ chợ cổ, bạn sẽ đi qua những mái vòm đá, tháp chuông và phố đi bộ — như đọc một cuốn sách mở về thành phố.',
    connection:
      'Các điểm dừng nằm trong bán kính đi bộ, được sắp xếp theo trục lịch sử từ thương mại → hành chính → văn hoá → giải trí.',
  },
  {
    id: 'mui-ne',
    title: 'Dấu ấn Mũi Né',
    subtitle:
      'Khám phá kiến trúc hội quán, chợ cổ và những lớp ký ức người Hoa giữa lòng thành phố.',
    cover:
      'https://i.pinimg.com/1200x/6d/cd/14/6dcd140b80b210ac445a0eddfc40784a.jpg',
    era: 'Văn hoá',
    difficulty: 'Trung bình',
    distance: '3.1 km',
    duration: '110 phút',
    hotspotIds: [
      'ben-thanh',
      'buu-dien',
      'nha-tho-duc-ba',
      'dinh-doc-lap',
      'bao-tang',
      'pho-di-bo',
      'thien-hau',
      'cho-lon',
    ],
    xp: 150,
    rating: 4.7,
    theme:
      'Đa văn hoá Sài Gòn — từ kiến trúc Pháp đến khu phố người Hoa, mỗi điểm dừng là một cộng đồng kể chuyện.',
    meaning:
      'Tuyến phản ánh sự giao thoa văn hoá trong lịch sử hình thành đô thị miền Nam — nơi di cư, thương mại và tín ngưỡng cùng tồn tại.',
    story:
      'Từ trung tâm hào nhoáng, bạn sẽ bước dần vào những con hẻm Chợ Lớn — nơi mùi hương và ngôn ngữ đổi màu theo từng bước chân.',
    connection:
      '8 điểm dừng được nối bằng câu chuyện về người đến và người ở lại — tạo nên bức tranh đa sắc của thành phố.',
  },
  {
    id: 'pho-co-dem',
    title: 'Phố cổ về đêm',
    subtitle:
      'Đi qua các sân khấu, phố đi bộ và không gian âm nhạc để cảm nhận nhịp sống buổi tối.',
    cover:
      'https://i.pinimg.com/736x/00/17/04/001704938bb7cf0b964b07a6b2eeffc4.jpg',
    era: 'Đô thị',
    difficulty: 'Dễ',
    distance: '2.8 km',
    duration: '88 phút',
    hotspotIds: ['ben-thanh', 'buu-dien', 'nha-tho-duc-ba', 'dinh-doc-lap', 'pho-di-bo'],
    xp: 110,
    rating: 4.6,
    theme:
      'Sài Gòn khi mặt trời lặn — ánh đèn, âm nhạc đường phố và không gian công cộng sống động.',
    meaning:
      'Buổi tối là lúc thành phố bộc lộ nhịp sống thật: lao động ban ngày chuyển thành giải trí, gặp gỡ và khám phá.',
    story:
      'Bạn sẽ thấy cùng một địa điểm nhưng khác hẳn về đêm — phố đi bộ rực sáng, nhà thờ đổ bóng lung linh trên lòng đường.',
    connection:
      'Các điểm dừng tạo thành vòng khép kín quanh trung tâm, lý tưởng cho hành trình 1 buổi tối cuối tuần.',
  },
  {
    id: 'cho-lon',
    title: 'Săn dấu ấn Chợ Lớn',
    subtitle:
      'Săn checkpoint ẩm thực, hội quán và chùa chiền trong khu phố người Hoa sầm uất.',
    cover:
      'https://i.pinimg.com/1200x/b3/07/e7/b307e7540a1d2c91f96933794c0b681c.jpg',
    era: 'Lịch sử',
    difficulty: 'Trung bình',
    distance: '3.5 km',
    duration: '120 phút',
    hotspotIds: [
      'ben-thanh',
      'buu-dien',
      'nha-tho-duc-ba',
      'dinh-doc-lap',
      'bao-tang',
      'pho-di-bo',
      'thien-hau',
    ],
    xp: 180,
    rating: 4.9,
    theme:
      'Chợ Lớn như một thế giới riêng — ẩm thực, tín ngưỡng và thương mại hòa quyện trong từng con hẻm.',
    meaning:
      'Khu vực này là chứng nhân của làn sóng di cư Hoa kiều, định hình nên một phần bản sắc ẩm thực và văn hoá Sài Gòn.',
    story:
      'Mỗi checkpoint là một dấu ấn: từ chùa cổ đến chợ đêm, bạn sẽ thu thập XP và mở khoá câu chuyện ẩn tại từng điểm.',
    connection:
      'Tuyến dẫn từ trung tâm Quận 1 sang Quận 5, kết thúc tại Chùa Bà Thiên Hậu — biểu tượng tâm linh của cộng đồng.',
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
    hotspotIds: ['ben-thanh', 'buu-dien', 'nha-tho-duc-ba', 'dinh-doc-lap'],
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
    hotspotIds: ['ben-thanh', 'buu-dien', 'nha-tho-duc-ba', 'dinh-doc-lap', 'pho-di-bo'],
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
    hotspotIds: ['ben-thanh', 'buu-dien', 'nha-tho-duc-ba'],
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
    hotspotIds: ['ben-thanh', 'buu-dien', 'nha-tho-duc-ba', 'dinh-doc-lap', 'bao-tang', 'pho-di-bo'],
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

const avatarSamples = {
  lanChi:
    'https://i.pinimg.com/1200x/9a/d1/dd/9ad1dd8c33e939d6fa4731f72e6095fa.jpg',
  baoKhang:
    'https://i.pinimg.com/736x/f3/0f/e8/f30fe84218790e6ffd25f987d434eb13.jpg',
  minhAnh:
    'https://i.pinimg.com/736x/25/c7/c1/25c7c1671263058c274374435c142b4f.jpg',
  hoangLong:
    'https://i.pinimg.com/1200x/6d/cd/14/6dcd140b80b210ac445a0eddfc40784a.jpg',
} as const;

export const hotspots: Hotspot[] = [
  {
    id: 'ben-thanh',
    name: 'Chợ Bến Thành',
    image:
      'https://i.pinimg.com/1200x/b3/07/e7/b307e7540a1d2c91f96933794c0b681c.jpg',
    gallery: [
      'https://i.pinimg.com/1200x/b3/07/e7/b307e7540a1d2c91f96933794c0b681c.jpg',
      'https://i.pinimg.com/736x/00/17/04/001704938bb7cf0b964b07a6b2eeffc4.jpg',
      'https://i.pinimg.com/1200x/80/69/f9/8069f9581583a196f9f39bda000b9312.jpg',
    ],
    category: 'Lịch sử',
    tags: ['Chợ cổ', 'Biểu tượng'],
    address: 'Lê Lợi, Phường Bến Thành, Quận 1, TP.HCM',
    rating: 4.8,
    reviewCount: 1240,
    xp: 80,
    description:
      'Biểu tượng thương mại Sài Gòn từ thế kỷ 19, nơi giao thoa giữa nhịp sống hiện đại và ký ức chợ truyền thống.',
    history:
      'Chợ Bến Thành được hình thành từ chợ tạm ven sông thế kỷ 17, sau nhiều lần di dời và tái thiết đã trở thành trung tâm buôn bán lớn nhất miền Nam vào đầu thế kỷ 20.',
    story:
      'Nghe đồn hồ đồng trên mái chợ vang lên, người bán hàng xưa biết giờ đóng cửa. Tiếng rao vẫn vọng trong những ô cửa gỗ — như lời nhắc rằng Sài Gòn luôn bắt đầu từ một góc chợ.',
    reviews: [
      {
        id: 'r-bt-1',
        user: 'Lan Chi',
        avatar: avatarSamples.lanChi,
        date: '2 ngày trước',
        rating: 5,
        text: 'Check-in sáng sớm ít đông, chụp được góc chợ rất đẹp. Audio kể chuyện hay và ngắn gọn.',
        media: [
          {
            type: 'image',
            url: 'https://i.pinimg.com/736x/00/17/04/001704938bb7cf0b964b07a6b2eeffc4.jpg',
          },
          {
            type: 'video',
            url: 'https://i.pinimg.com/1200x/b3/07/e7/b307e7540a1d2c91f96933794c0b681c.jpg',
            thumb:
              'https://i.pinimg.com/1200x/b3/07/e7/b307e7540a1d2c91f96933794c0b681c.jpg',
            duration: '0:42',
          },
        ],
      },
      {
        id: 'r-bt-2',
        user: 'Minh Anh',
        avatar: avatarSamples.minhAnh,
        date: '1 tuần trước',
        rating: 4,
        text: 'Đông nhưng vui, nên đi sớm để tránh nắng. Phần lịch sử trên app rất chi tiết.',
      },
    ],
  },
  {
    id: 'buu-dien',
    name: 'Bưu điện Trung tâm Sài Gòn',
    image:
      'https://i.pinimg.com/1200x/80/69/f9/8069f9581583a196f9f39bda000b9312.jpg',
    gallery: [
      'https://i.pinimg.com/1200x/80/69/f9/8069f9581583a196f9f39bda000b9312.jpg',
      'https://i.pinimg.com/736x/f3/0f/e8/f30fe84218790e6ffd25f987d434eb13.jpg',
    ],
    category: 'Kiến trúc',
    tags: ['Pháp cổ', 'Di sản'],
    address: '2 Công xã Paris, Bến Nghé, Quận 1, TP.HCM',
    rating: 4.9,
    reviewCount: 986,
    xp: 70,
    description:
      'Công trình Gothic Pháp mang tính biểu tượng, từng là điểm hẹn gửi thư và ký ức của cả thế hệ người Sài Gòn.',
    history:
      'Khánh thành năm 1891 theo thiết kế của Gustave Eiffel, tòa bưu điện là một trong những công trình kiến trúc Pháp tiêu biểu nhất còn tồn tại tại Việt Nam.',
    story:
      'Mỗi lá thư từng đi qua đây mang theo hy vọng của người xa quê. Tiếng máy đóng dấu giờ chỉ còn trong ký ức — nhưng mái vòm vẫn đứng im giữa phố.',
    reviews: [
      {
        id: 'r-bd-1',
        user: 'Bảo Khang',
        avatar: avatarSamples.baoKhang,
        date: '3 ngày trước',
        rating: 5,
        text: 'Kiến trúc đẹp nhất khu trung tâm. Nên ghé buổi chiều khi ánh nắng chiếu vào mặt tiền.',
        media: [
          {
            type: 'image',
            url: 'https://i.pinimg.com/1200x/80/69/f9/8069f9581583a196f9f39bda000b9312.jpg',
          },
        ],
      },
    ],
  },
  {
    id: 'nha-tho-duc-ba',
    name: 'Nhà thờ Đức Bà Sài Gòn',
    image:
      'https://i.pinimg.com/736x/00/17/04/001704938bb7cf0b964b07a6b2eeffc4.jpg',
    gallery: [
      'https://i.pinimg.com/736x/00/17/04/001704938bb7cf0b964b07a6b2eeffc4.jpg',
      'https://i.pinimg.com/1200x/9a/d1/dd/9ad1dd8c33e939d6fa4731f72e6095fa.jpg',
    ],
    category: 'Kiến trúc',
    tags: ['Nhà thờ', 'Biểu tượng'],
    address: '01 Công xã Paris, Bến Nghé, Quận 1, TP.HCM',
    rating: 4.7,
    reviewCount: 2105,
    xp: 75,
    description:
      'Nhà thờ Công giáo lớn nhất thành phố với hai tháp chuông đặc trưng, điểm check-in không thể bỏ qua khi khám phá trung tâm.',
    history:
      'Xây dựng từ năm 1877 đến 1880, toàn bộ vật liệu được nhập từ Pháp. Đây là một trong những công trình tôn giáo cổ nhất và nổi tiếng nhất Sài Gòn.',
    story:
      'Hai tháp chuông im lặng nhìn phố đổi màu theo mùa. Người Sài Gòn quen gọi đây là điểm hẹn — dù chỉ là ghé ngang để chụp một tấm ảnh.',
    reviews: [
      {
        id: 'r-nt-1',
        user: 'Thu Hà',
        avatar: avatarSamples.lanChi,
        date: '5 ngày trước',
        rating: 5,
        text: 'Đẹp nhất lúc hoàng hôn. Câu chuyện ẩn sau khi check-in rất cảm xúc.',
      },
    ],
  },
  {
    id: 'dinh-doc-lap',
    name: 'Dinh Độc Lập',
    image:
      'https://i.pinimg.com/1200x/6d/cd/14/6dcd140b80b210ac445a0eddfc40784a.jpg',
    gallery: [
      'https://i.pinimg.com/1200x/6d/cd/14/6dcd140b80b210ac445a0eddfc40784a.jpg',
    ],
    category: 'Lịch sử',
    tags: ['Di tích', 'Quốc gia'],
    address: '135 Nam Kỳ Khởi Nghĩa, Bến Thành, Quận 1, TP.HCM',
    rating: 4.9,
    reviewCount: 1580,
    xp: 90,
    description:
      'Di tích lịch sử cấp quốc gia, nơi diễn ra sự kiện bước ngoặt 30/4/1975 và lưu giữ không gian chính trị Sài Gòn xưa.',
    history:
      'Từng là dinh thự Toàn quyền Đông Dương, sau là dinh Tổng thống Việt Nam Cộng hòa. Ngày nay là bảo tàng mở cửa cho công chúng tham quan.',
    story:
      'Trong phòng làm việc tổng thống, thời gian như đứng lại. Mỗi hiện vật là một mảnh ghép của ngày 30 tháng Tư — ngày thống nhất.',
    reviews: [
      {
        id: 'r-dd-1',
        user: 'Hoàng Long',
        avatar: avatarSamples.hoangLong,
        date: '1 tuần trước',
        rating: 5,
        text: 'Nên dành ít nhất 2 giờ để tham quan. Phần audio guide trong app bổ sung rất hay.',
      },
    ],
  },
  {
    id: 'bao-tang',
    name: 'Bảo tàng Mỹ thuật TP.HCM',
    image:
      'https://i.pinimg.com/1200x/9a/d1/dd/9ad1dd8c33e939d6fa4731f72e6095fa.jpg',
    gallery: [
      'https://i.pinimg.com/1200x/9a/d1/dd/9ad1dd8c33e939d6fa4731f72e6095fa.jpg',
      'https://i.pinimg.com/736x/25/c7/c1/25c7c1671263058c274374435c142b4f.jpg',
    ],
    category: 'Văn hoá',
    tags: ['Nghệ thuật', 'Bảo tàng'],
    address: '97A Phó Đức Chính, Nguyễn Thái Bình, Quận 1, TP.HCM',
    rating: 4.6,
    reviewCount: 412,
    xp: 65,
    description:
      'Không gian trưng bày hội họa và điêu khắc Việt Nam hiện đại trong tòa biệt thự Pháp cổ giữa trung tâm thành phố.',
    history:
      'Công trình ban đầu là biệt thự của gia đình Hui Bon Hoa, sau chuyển thành bảo tàng từ năm 1987 với bộ sưu tập nghệ thuật phong phú.',
    story:
      'Từng là nơi hội họp của một thương gia giàu có, nay tường trắng treo những bức tranh kể chuyện đất nước qua từng nét cọ.',
    reviews: [
      {
        id: 'r-btmg-1',
        user: 'Mai Vy',
        avatar: avatarSamples.minhAnh,
        date: '4 ngày trước',
        rating: 4,
        text: 'Yên tĩnh, thích hợp đi cuối tuần. Kiến trúc Pháp bên trong rất đáng xem.',
      },
    ],
  },
  {
    id: 'pho-di-bo',
    name: 'Phố đi bộ Nguyễn Huệ',
    image:
      'https://i.pinimg.com/736x/f3/0f/e8/f30fe84218790e6ffd25f987d434eb13.jpg',
    gallery: [
      'https://i.pinimg.com/736x/f3/0f/e8/f30fe84218790e6ffd25f987d434eb13.jpg',
      'https://i.pinimg.com/1200x/b3/07/e7/b307e7540a1d2c91f96933794c0b681c.jpg',
    ],
    category: 'Đô thị',
    tags: ['Phố đi bộ', 'Về đêm'],
    address: 'Đường Nguyễn Huệ, Bến Nghé, Quận 1, TP.HCM',
    rating: 4.5,
    reviewCount: 890,
    xp: 55,
    description:
      'Trục phố trung tâm với đài phun nước, sự kiện nghệ thuật và không khí nhộn nhịp về đêm — điểm hẹn của giới trẻ Sài Gòn.',
    history:
      'Khai trương năm 2015 sau khi lấn sông Bến Nghé, phố đi bộ Nguyễn Huệ trở thành không gian công cộng lớn nhất trung tâm thành phố.',
    story:
      'Khi đèn bật sáng, cả con phố như sân khấu. Người ta đến đây không chỉ để đi bộ — mà để cảm nhận nhịp thở của Sài Gòn về đêm.',
    reviews: [
      {
        id: 'r-pdb-1',
        user: 'Quốc Huy',
        avatar: avatarSamples.hoangLong,
        date: 'Hôm qua',
        rating: 5,
        text: 'Tối cuối tuần có nhạc sống rất vui. Check-in để mở câu chuyện về lịch sử lấn sông.',
        media: [
          {
            type: 'image',
            url: 'https://i.pinimg.com/736x/f3/0f/e8/f30fe84218790e6ffd25f987d434eb13.jpg',
          },
          {
            type: 'image',
            url: 'https://i.pinimg.com/1200x/b3/07/e7/b307e7540a1d2c91f96933794c0b681c.jpg',
          },
          {
            type: 'image',
            url: 'https://i.pinimg.com/736x/00/17/04/001704938bb7cf0b964b07a6b2eeffc4.jpg',
          },
          {
            type: 'image',
            url: 'https://i.pinimg.com/1200x/80/69/f9/8069f9581583a196f9f39bda000b9312.jpg',
          },
        ],
      },
    ],
  },
  {
    id: 'thien-hau',
    name: 'Chùa Bà Thiên Hậu',
    image:
      'https://i.pinimg.com/736x/25/c7/c1/25c7c1671263058c274374435c142b4f.jpg',
    gallery: [
      'https://i.pinimg.com/736x/25/c7/c1/25c7c1671263058c274374435c142b4f.jpg',
    ],
    category: 'Văn hoá',
    tags: ['Chợ Lớn', 'Tâm linh'],
    address: '710 Nguyễn Trãi, Phường 11, Quận 5, TP.HCM',
    rating: 4.8,
    reviewCount: 654,
    xp: 85,
    description:
      'Ngôi chùa cổ của người Hoa tại Chợ Lớn, nổi bật với kiến trúc tam quan và hương khói quanh năm.',
    history:
      'Xây dựng từ năm 1760, chùa thờ Bà Thiên Hậu — vị thần bảo hộ cho ngư dân và thương nhân trên hành trình vượt biển.',
    story:
      'Khói hương bay qua mái cong, mang theo lời cầu của người xa xứ. Chùa vẫn đứng im giữa Chợ Lớn ồn ào — như một mảnh ký ức không đổi.',
    reviews: [
      {
        id: 'r-th-1',
        user: 'Đức Phú',
        avatar: avatarSamples.baoKhang,
        date: '2 tuần trước',
        rating: 5,
        text: 'Không gian rất đặc biệt, nên đi sáng mùng 1 hoặc rằm để cảm nhận không khí lễ hội.',
      },
    ],
  },
  {
    id: 'cho-lon',
    name: 'Chợ Lớn – Khu phố người Hoa',
    image:
      'https://i.pinimg.com/1200x/b3/07/e7/b307e7540a1d2c91f96933794c0b681c.jpg',
    gallery: [
      'https://i.pinimg.com/1200x/b3/07/e7/b307e7540a1d2c91f96933794c0b681c.jpg',
      'https://i.pinimg.com/736x/25/c7/c1/25c7c1671263058c274374435c142b4f.jpg',
    ],
    category: 'Ẩm thực',
    tags: ['Chợ Lớn', 'Ẩm thực'],
    address: 'Khu vực Quận 5 & Quận 6, TP.HCM',
    rating: 4.7,
    reviewCount: 1120,
    xp: 100,
    description:
      'Khu phố sầm uất với hội quán, tiệm vàng và ẩm thực đường phố — trải nghiệm văn hoá người Hoa giữa lòng Sài Gòn.',
    history:
      'Hình thành từ thế kỷ 17–18 khi cộng đồng người Hoa di cư đến Nam Kỳ, Chợ Lớn trở thành trung tâm thương mại và văn hoá Hoa kiều lớn nhất Việt Nam.',
    story:
      'Tiếng Quảng vang trong hẻm nhỏ, mùi bánh bao nóng hổi từ lò hấm. Chợ Lớn không chỉ là nơi mua bán — mà là cả một thế giới ký ức di cư.',
    reviews: [
      {
        id: 'r-cl-1',
        user: 'Ngọc Trần',
        avatar: avatarSamples.minhAnh,
        date: '3 ngày trước',
        rating: 5,
        text: 'Ăn uống tuyệt vời, nên đi theo tuyến săn dấu ấn Chợ Lớn trên app.',
      },
    ],
  },
];

const hotspotMap = new Map(hotspots.map((hotspot) => [hotspot.id, hotspot]));
const routeMap = new Map(routes.map((route) => [route.id, route]));

const nearbyDistancePresets = ['320m', '480m', '650m', '820m'] as const;
const nearbyDurationPresets = ['4 phút', '6 phút', '8 phút', '10 phút'] as const;

export function getHotspot(id: string): Hotspot | undefined {
  return hotspotMap.get(id);
}

export function getRoute(id: string): RouteItem | undefined {
  return routeMap.get(id);
}

export function getRoutesForHotspot(hotspotId: string): RouteItem[] {
  return routes.filter((route) => route.hotspotIds.includes(hotspotId));
}

export function getNearbyHotspots(hotspotId: string, limit = 3): NearbyHotspot[] {
  return hotspots
    .filter((hotspot) => hotspot.id !== hotspotId)
    .slice(0, limit)
    .map((hotspot, index) => ({
      ...hotspot,
      distance: nearbyDistancePresets[index % nearbyDistancePresets.length],
      duration: nearbyDurationPresets[index % nearbyDurationPresets.length],
    }));
}

const stopDistancePresets = ['Bắt đầu', '320 m', '480 m', '650 m', '820 m', '1.1 km', '1.4 km', '1.8 km'] as const;
const stopDurationPresets = ['—', '4 phút', '6 phút', '8 phút', '10 phút', '12 phút', '15 phút', '18 phút'] as const;

export function getRouteHotspots(routeId: string): RouteStop[] {
  const route = getRoute(routeId);
  if (!route) return [];

  return route.hotspotIds.flatMap((hotspotId, index) => {
    const hotspot = getHotspot(hotspotId);
    if (!hotspot) return [];

    return [
      {
        ...hotspot,
        distance: stopDistancePresets[index] ?? '500 m',
        duration: stopDurationPresets[index] ?? '5 phút',
      },
    ];
  });
}

export const routeReviews: Record<string, RouteReview[]> = {
  'vinh-ha-long': [
    {
      id: 'rr-vhl-1',
      user: 'Minh Anh',
      avatar:
        'https://i.pinimg.com/736x/25/c7/c1/25c7c1671263058c274374435c142b4f.jpg',
      date: '3 ngày trước',
      rating: 5,
      highlight: 'Storytelling rất cuốn',
      text: 'Đi sáng sớm ít đông, audio tại từng điểm hay và ngắn. Hoàn thành trong 1 buổi sáng.',
      completedIn: '1h 32 phút',
      tags: ['Đáng đi', 'Storytelling hay', 'Đi sáng sớm'],
      helpful: 24,
    },
    {
      id: 'rr-vhl-2',
      user: 'Lan Chi',
      avatar:
        'https://i.pinimg.com/1200x/9a/d1/dd/9ad1dd8c33e939d6fa4731f72e6095fa.jpg',
      date: '1 tuần trước',
      rating: 4,
      highlight: 'Phù hợp người mới',
      text: 'Độ khó dễ, bản đồ rõ. Nên mang nước vì đi bộ khá nhiều giữa các điểm.',
      completedIn: '1h 48 phút',
      tags: ['Đi bộ thoải mái', 'Chụp ảnh đẹp'],
      helpful: 11,
    },
  ],
  'mui-ne': [
    {
      id: 'rr-mn-1',
      user: 'Hoàng Long',
      avatar:
        'https://i.pinimg.com/1200x/6d/cd/14/6dcd140b80b210ac445a0eddfc40784a.jpg',
      date: '5 ngày trước',
      rating: 5,
      highlight: 'Chợ Lớn buổi chiều tuyệt vời',
      text: 'Tuyến dài nhưng mỗi điểm đều có câu chuyện riêng. Phần Chợ Lớn là highlight.',
      completedIn: '2h 05 phút',
      tags: ['Đáng đi', 'Ẩm thực', 'Storytelling hay'],
      helpful: 18,
    },
  ],
  'pho-co-dem': [
    {
      id: 'rr-pcd-1',
      user: 'Thu Hà',
      avatar:
        'https://i.pinimg.com/1200x/9a/d1/dd/9ad1dd8c33e939d6fa4731f72e6095fa.jpg',
      date: '2 ngày trước',
      rating: 5,
      highlight: 'Đi tối cuối tuần rất vibe',
      text: 'Phố đi bộ Nguyễn Huệ về đêm đẹp nhất. Nên bắt đầu lúc 17h để thấy cả hoàng hôn.',
      completedIn: '1h 20 phút',
      tags: ['Về đêm', 'Chụp ảnh đẹp'],
      helpful: 31,
    },
  ],
  'cho-lon': [
    {
      id: 'rr-cl-1',
      user: 'Bảo Khang',
      avatar:
        'https://i.pinimg.com/736x/f3/0f/e8/f30fe84218790e6ffd25f987d434eb13.jpg',
      date: '4 ngày trước',
      rating: 5,
      highlight: 'XP cao, điểm dừng đa dạng',
      text: 'Thử được nhiều món ở Chợ Lớn. Check-in đủ 7 điểm nhận huy hiệu — rất đã!',
      completedIn: '2h 10 phút',
      tags: ['Đáng đi', 'Ẩm thực', 'Đi bộ thoải mái'],
      helpful: 27,
    },
  ],
};

export function getRouteReviews(routeId: string): RouteReview[] {
  return routeReviews[routeId] ?? [];
}

export function getRouteRating(routeId: string): { avg: number; count: number } {
  const reviews = getRouteReviews(routeId);
  if (reviews.length === 0) {
    const route = getRoute(routeId);
    return { avg: route?.rating ?? 0, count: 0 };
  }
  const avg = reviews.reduce((sum, r) => sum + r.rating, 0) / reviews.length;
  return { avg: Math.round(avg * 10) / 10, count: reviews.length };
}
