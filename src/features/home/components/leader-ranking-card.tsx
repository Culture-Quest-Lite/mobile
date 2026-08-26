import { LinearGradient } from "expo-linear-gradient";
import { UserAvatar } from "@/components/ui/user-avatar";
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
  topEntries?: LeaderRankingTopEntry[];
};

export type LeaderRankingTopEntry = {
  avatarUri: string | null;
  isCurrentUser?: boolean;
  name: string;
  points: string;
  rank: number;
  subtitle?: string;
};

/** Ngưỡng coi là màn hình nhỏ để thu nhỏ cúp và cỡ chữ */
const SMALL_SCREEN_WIDTH = 360;
/** Chiều cao thẻ */
const CARD_HEIGHT = 164;
/** Tỉ lệ ngang/dọc của file cup.png (ảnh dọc 2:3) */
const TROPHY_ASPECT_RATIO = 2 / 3;
const podiumOrder = [2, 1, 3] as const;

function isTopRank(rank: number) {
  return rank >= 1 && rank <= 3;
}

function getPodiumRingColor(rank: number) {
  switch (rank) {
    case 1:
      return "#F7B500";
    case 2:
      return "#B8C5D9";
    case 3:
      return "#FF9B5A";
    default:
      return "#D7DCE4";
  }
}

function getPodiumBadgeColor(rank: number) {
  switch (rank) {
    case 1:
      return "#F7B500";
    case 2:
      return "#AAB9CD";
    case 3:
      return "#FF934F";
    default:
      return "#D7DCE4";
  }
}

function getPodiumColumnMetrics(rank: number, isSmallScreen: boolean) {
  const compactScale = isSmallScreen ? 0.88 : 1;

  switch (rank) {
    case 1:
      return {
        avatarSize: 50 * compactScale,
        badgeSize: 24,
        offsetY: -22 * compactScale,
      };
    case 2:
      return {
        avatarSize: 39 * compactScale,
        badgeSize: 21,
        offsetY: 18 * compactScale,
      };
    case 3:
      return {
        avatarSize: 39 * compactScale,
        badgeSize: 21,
        offsetY: 20 * compactScale,
      };
    default:
      return {
        avatarSize: 39 * compactScale,
        badgeSize: 21,
        offsetY: 20 * compactScale,
      };
  }
}

/** 6500 -> "6.500 XP" */
function formatXp(xp: number) {
  return `${Math.max(0, Math.round(xp)).toLocaleString("vi-VN")} XP`;
}

export function LeaderRankingCard({
  xp = 6500,
  title = "Bạn đang dẫn đầu bảng xếp hạng",
  description = "Tiếp tục giữ phong độ hôm nay!",
  topEntries,
}: LeaderRankingCardProps) {
  const { width } = useWindowDimensions();
  const isSmallScreen = width < SMALL_SCREEN_WIDTH;
  const hasTopEntries = Array.isArray(topEntries) && topEntries.length > 0;
  const podiumEntries = podiumOrder
    .map((rank) => topEntries?.find((entry) => entry.rank === rank) ?? null)
    .filter((entry): entry is LeaderRankingTopEntry => entry !== null);

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

        {hasTopEntries ? (
          <>
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

            <View style={styles.topEntriesContent}>
              <View style={styles.podiumRow}>
                {podiumEntries.map((entry) => {
                  const metrics = getPodiumColumnMetrics(
                    entry.rank,
                    isSmallScreen,
                  );
                  const badgeColor = getPodiumBadgeColor(entry.rank);

                  return (
                    <View
                      key={`${entry.rank}-${entry.name}`}
                      style={[
                        styles.podiumItem,
                        {
                          marginTop: metrics.offsetY,
                          transform:
                            entry.rank === 1
                              ? [{ translateY: -20 * (isSmallScreen ? 0.9 : 1) }]
                              : undefined,
                        },
                        entry.rank === 1
                          ? styles.podiumChampionItem
                          : styles.podiumSideItem,
                      ]}
                    >
                      <View style={styles.podiumAvatarWrap}>
                        <View
                          style={[
                            styles.rankBadge,
                            {
                              backgroundColor: badgeColor,
                              height: metrics.badgeSize,
                              width: metrics.badgeSize,
                            },
                          ]}
                        >
                          <Text style={styles.rankBadgeText}>{entry.rank}</Text>
                        </View>

                        <UserAvatar
                          borderColor={getPodiumRingColor(entry.rank)}
                          borderWidth={isTopRank(entry.rank) ? 2 : 1.5}
                          containerStyle={styles.podiumAvatar}
                          displayName={entry.name}
                          size={metrics.avatarSize}
                          textSize={entry.rank === 1 ? 15 : 12}
                          uri={entry.avatarUri}
                        />
                      </View>

                      <View style={styles.podiumPointsPill}>
                        <Text style={styles.podiumPointsStar}>★</Text>
                        <Text style={styles.podiumPointsText}>{entry.points}</Text>
                      </View>
                    </View>
                  );
                })}
              </View>
            </View>
          </>
        ) : (
          <>
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
          </>
        )}
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
  topEntriesContent: {
    flex: 1,
    justifyContent: "flex-end",
    maxWidth: "68%",
    paddingBottom: 16,
    paddingLeft: 14,
    paddingRight: 8,
    paddingTop: 12,
  },
  podiumRow: {
    alignItems: "flex-end",
    flexDirection: "row",
    justifyContent: "space-around",
  },
  podiumItem: {
    alignItems: "center",
    flex: 1,
    maxWidth: "33%",
  },
  podiumChampionItem: {
    marginHorizontal: 8,
  },
  podiumSideItem: {
    marginHorizontal: 2,
  },
  podiumAvatarWrap: {
    alignItems: "center",
    marginBottom: 6,
  },
  podiumAvatar: {
    backgroundColor: "#FFFFFF",
  },
  rankBadge: {
    alignItems: "center",
    borderColor: "#FFFFFF",
    borderRadius: 999,
    borderWidth: 2,
    justifyContent: "center",
    marginBottom: 5,
  },
  rankBadgeText: {
    color: "#FFFFFF",
    fontSize: 10,
    fontWeight: "800",
    lineHeight: lineHeightFor(10),
  },
  podiumPointsPill: {
    alignItems: "center",
    backgroundColor: "rgba(255,255,255,0.94)",
    borderRadius: 999,
    flexDirection: "row",
    paddingHorizontal: 7,
    paddingVertical: 3,
  },
  podiumPointsStar: {
    color: "#FF5F87",
    fontSize: 8,
    marginRight: 3,
  },
  podiumPointsText: {
    color: "#F44378",
    fontSize: 9,
    fontWeight: "800",
    lineHeight: lineHeightFor(9),
  },
});
