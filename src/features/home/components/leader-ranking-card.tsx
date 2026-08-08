import { LinearGradient } from "expo-linear-gradient";
import {
  Image,
  Platform,
  StyleSheet,
  Text,
  useWindowDimensions,
  View,
} from "react-native";
import { lineHeightFor } from "@/lib/text-scale";

/** Ảnh cúp vàng (PNG nền trong suốt) */
const trophyImage = require("../../../../assets/images/cup.png");
/** Ảnh pháo hoa / confetti trang trí (PNG nền trong suốt) */
const fireworksImage = require("../../../../assets/images/phaohoa.png");

export type LeaderRankingCardProps = {
  xp: number;
  title?: string;
  description?: string;
};

/** Ngưỡng coi là màn hình nhỏ để thu nhỏ cúp và cỡ chữ */
const SMALL_SCREEN_WIDTH = 360;
/** Chiều cao thẻ */
const CARD_HEIGHT = 164;
/** Tỉ lệ ngang/dọc của file cup.png (ảnh dọc 2:3) */
const TROPHY_ASPECT_RATIO = 2 / 3;

/** 6500 -> "6.500 XP" */
function formatXp(xp: number) {
  return `${Math.max(0, Math.round(xp)).toLocaleString("vi-VN")} XP`;
}

export function LeaderRankingCard({
  xp = 6500,
  title = "Bạn đang dẫn đầu bảng xếp hạng",
  description = "Tiếp tục giữ phong độ hôm nay!",
}: LeaderRankingCardProps) {
  const { width } = useWindowDimensions();
  const isSmallScreen = width < SMALL_SCREEN_WIDTH;

  // Kích thước co giãn theo bề ngang màn hình
  // Cỡ chữ tối đa mà tiêu đề mặc định vẫn gói gọn trên một hàng
  const titleFontSize = isSmallScreen ? 11.5 : 13;
  const titleLineHeight = lineHeightFor(titleFontSize);
  const descriptionFontSize = isSmallScreen ? 9.5 : 10.5;
  const xpFontSize = isSmallScreen ? 12 : 13;

  // Ảnh cúp là ảnh dọc có nhiều vùng trong suốt trên/dưới, nên vẽ theo đúng
  // tỉ lệ gốc rồi canh giữa theo chiều dọc: phần tràn ra ngoài thẻ chỉ là
  // vùng trong suốt, thân cúp vẫn hiển thị trọn vẹn và to hơn nhiều so với
  // khi ép ảnh vào khung vuông.
  const trophyHeight = isSmallScreen ? 258 : 296;
  const trophyWidth = Math.round(trophyHeight * TROPHY_ASPECT_RATIO);
  const trophyTop = -Math.round((trophyHeight - CARD_HEIGHT) / 2);
  const trophyRight = -Math.round(trophyWidth * 0.14);

  return (
    // Padding 16px hai bên màn hình
    <View style={styles.wrapper}>
      <LinearGradient
        colors={["#FFF7F9", "#FFDCE7"]}
        start={{ x: 0, y: 0.5 }}
        end={{ x: 1, y: 0.5 }}
        style={styles.card}
      >
        {/* Lớp pháo hoa trang trí - phủ toàn thẻ, không chặn thao tác */}
        <Image
          source={fireworksImage}
          style={styles.fireworks}
          resizeMode="cover"
        />

        {/* Cúp vàng - bên phải thẻ */}
        <Image
          source={trophyImage}
          style={[
            styles.trophy,
            {
              height: trophyHeight,
              right: trophyRight,
              top: trophyTop,
              width: trophyWidth,
            },
          ]}
          resizeMode="contain"
        />

        {/* Nội dung chữ bên trái - mỗi dòng gói gọn trên một hàng,
            cả cụm canh giữa theo chiều cao thẻ */}
        <View style={styles.content}>
          <Text
            adjustsFontSizeToFit
            style={[
              styles.title,
              { fontSize: titleFontSize, lineHeight: titleLineHeight },
            ]}
            numberOfLines={1}
          >
            {title}
          </Text>

          <Text
            adjustsFontSizeToFit
            style={[
              styles.description,
              {
                fontSize: descriptionFontSize,
                lineHeight: lineHeightFor(descriptionFontSize),
              },
            ]}
            numberOfLines={1}
          >
            {description}
          </Text>

          <Text style={styles.heart}>♡</Text>
        </View>

        {/* Khung điểm XP - dưới bên phải, chồng một phần lên cúp */}
        <View style={styles.xpPill}>
          <Text style={[styles.xpStar, { fontSize: xpFontSize }]}>★</Text>
          <Text style={[styles.xpValue, { fontSize: xpFontSize }]}>
            {formatXp(xp)}
          </Text>
        </View>
      </LinearGradient>
    </View>
  );
}

export default LeaderRankingCard;

const styles = StyleSheet.create({
  wrapper: {
    paddingHorizontal: 16,
    width: "100%",
  },

  // Thẻ nền gradient
  card: {
    borderRadius: 22,
    height: CARD_HEIGHT,
    overflow: "hidden",
    width: "100%",
    ...Platform.select({
      android: {
        elevation: 4,
      },
      default: {
        shadowColor: "#F0779F",
        shadowOffset: { height: 6, width: 0 },
        shadowOpacity: 0.28,
        shadowRadius: 14,
      },
    }),
  },

  // Pháo hoa trang trí
  fireworks: {
    bottom: 0,
    height: "100%",
    left: 0,
    opacity: 0.6,
    pointerEvents: "none",
    position: "absolute",
    right: 0,
    top: 0,
    width: "100%",
  },

  // Cúp vàng
  trophy: {
    pointerEvents: "none",
    position: "absolute",
  },

  // Cột nội dung bên trái
  content: {
    flex: 1,
    // Cụm chữ canh giữa theo chiều cao thẻ
    justifyContent: "center",
    maxWidth: "66%",
    paddingLeft: 16,
    paddingRight: 2,
    paddingVertical: 12,
  },
  title: {
    color: "#502036",
    fontWeight: "800",
  },
  description: {
    color: "#A84D72",
    fontWeight: "500",
    marginTop: 6,
  },
  heart: {
    color: "#F58BAF",
    fontSize: 13,
    lineHeight: lineHeightFor(13),
    marginTop: 6,
  },

  // Viên thuốc hiển thị điểm XP
  xpPill: {
    alignItems: "center",
    backgroundColor: "#FFFFFF",
    borderRadius: 999,
    bottom: 12,
    flexDirection: "row",
    height: 34,
    paddingHorizontal: 12,
    position: "absolute",
    right: 16,
    ...Platform.select({
      android: {
        elevation: 3,
      },
      default: {
        shadowColor: "#C9455F",
        shadowOffset: { height: 4, width: 0 },
        shadowOpacity: 0.18,
        shadowRadius: 10,
      },
    }),
  },
  xpStar: {
    color: "#F44378",
    marginRight: 6,
  },
  xpValue: {
    color: "#F03F75",
    fontWeight: "800",
  },
});
