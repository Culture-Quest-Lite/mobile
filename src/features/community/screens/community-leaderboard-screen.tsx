import { AppLoadingScreen } from "@/components/ui/app-loading-screen";
import { SymbolView } from "@/components/ui/symbol-view";
import { UserAvatar } from "@/components/ui/user-avatar";
import {
  getValidAccessToken,
  useAuthSession,
} from "@/features/auth/hooks/use-auth-session";
import {
  getUserLeaderboard,
  type UserLeaderboardEntryDto,
} from "@/features/home/api/get-user-leaderboard";
import { LeaderRankingCard } from "@/features/home/components/leader-ranking-card";
import { textStyle } from "@/lib/text-scale";
import { type Href, useFocusEffect, useRouter } from "expo-router";
import { useCallback, useMemo, useState } from "react";
import { useTranslation } from "react-i18next";
import { Pressable, ScrollView, Text, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

type LeaderboardStatus = "error" | "loading" | "ready";

const leaderboardCardShadow = {
  shadowColor: "rgba(15, 23, 42, 0.10)",
  shadowOpacity: 1,
  shadowRadius: 14,
  shadowOffset: { width: 0, height: 6 },
  elevation: 3,
} as const;

const leaderboardRankRingColors = ["#F7B500", "#C9D4E5", "#FF8A00"] as const;
const leaderboardRankBadgeColors = ["#F7B500", "#9AACBF", "#FF8A00"] as const;

function readMeaningfulText(value?: string | null) {
  const trimmedValue = value?.trim();
  return trimmedValue ? trimmedValue : null;
}

function formatCommunityXp(value: number) {
  return new Intl.NumberFormat("vi-VN").format(Math.max(0, Math.round(value)));
}

function getCommunityLeaderboardDisplayName(entry: UserLeaderboardEntryDto) {
  return (
    readMeaningfulText(entry.displayName) ??
    readMeaningfulText(entry.username) ??
    `Explorer #${entry.userId}`
  );
}

function getCommunityLeaderboardSubtitle(entry: UserLeaderboardEntryDto) {
  return `@${entry.username}`;
}

function isTopCommunityLeaderboardRank(rank: number) {
  return rank >= 1 && rank <= 3;
}

function getCommunityLeaderboardRingColor(rank: number) {
  return isTopCommunityLeaderboardRank(rank)
    ? leaderboardRankRingColors[rank - 1]
    : "#D7DCE4";
}

function getCommunityLeaderboardBadgeColor(rank: number) {
  return isTopCommunityLeaderboardRank(rank)
    ? leaderboardRankBadgeColors[rank - 1]
    : "#C7D1DE";
}

function getCommunityLeaderboardBadgeTextColor(rank: number) {
  return isTopCommunityLeaderboardRank(rank) ? "#FFFFFF" : "#667085";
}

function buildSummaryContent(
  entries: UserLeaderboardEntryDto[],
  t: (key: string, options?: Record<string, unknown>) => string,
) {
  if (entries.length === 0) {
    return {
      note: t("community.leaderboard.emptyNote"),
      rankLabel: "#--",
      title: t("community.leaderboard.emptyTitle"),
      totalXp: 0,
      totalXpLabel: t("community.leaderboard.xpLabel", { value: 0 }),
    };
  }

  const sortedEntries = [...entries].sort(
    (left, right) => left.rank - right.rank,
  );
  const currentUserEntry =
    sortedEntries.find((entry) => entry.isCurrentUser) ?? null;
  const summaryEntry = currentUserEntry ?? sortedEntries[0];
  const totalXpLabel = t("community.leaderboard.xpLabel", {
    value: formatCommunityXp(summaryEntry.totalXp),
  });

  if (currentUserEntry) {
    if (currentUserEntry.rank === 1) {
      return {
        note: t("community.leaderboard.rankOneNote"),
        rankLabel: `#${currentUserEntry.rank}`,
        title: t("community.leaderboard.rankOneTitle"),
        totalXp: summaryEntry.totalXp,
        totalXpLabel,
      };
    }

    const previousRankEntry = sortedEntries.find(
      (entry) => entry.rank === currentUserEntry.rank - 1,
    );
    const gapLabel = previousRankEntry
      ? t("community.leaderboard.xpLabel", {
          value: formatCommunityXp(
            Math.max(previousRankEntry.totalXp - currentUserEntry.totalXp, 0),
          ),
        })
      : totalXpLabel;

    return {
      note: previousRankEntry
        ? t("community.leaderboard.gapNote", {
            gap: gapLabel,
            rank: previousRankEntry.rank,
          })
        : t("community.leaderboard.currentXpNote", { xp: totalXpLabel }),
      rankLabel: `#${currentUserEntry.rank}`,
      title: t("community.leaderboard.currentRankTitle"),
      totalXp: summaryEntry.totalXp,
      totalXpLabel,
    };
  }

  return {
    note: t("community.leaderboard.leaderNote", {
      name: getCommunityLeaderboardDisplayName(summaryEntry),
      xp: totalXpLabel,
    }),
    rankLabel: `#${summaryEntry.rank}`,
    title: t("community.leaderboard.leaderTitle"),
    totalXp: summaryEntry.totalXp,
    totalXpLabel,
  };
}

export default function CommunityLeaderboardScreen() {
  const { t } = useTranslation();
  const authSession = useAuthSession();
  const router = useRouter();
  const [entries, setEntries] = useState<UserLeaderboardEntryDto[]>([]);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [retryNonce, setRetryNonce] = useState(0);
  const [status, setStatus] = useState<LeaderboardStatus>("loading");

  useFocusEffect(
    useCallback(() => {
      let isActive = true;
      const retrySeed = retryNonce;

      async function loadLeaderboard() {
        setStatus("loading");
        setErrorMessage(null);

        try {
          const accessToken = authSession.isAuthenticated
            ? await getValidAccessToken()
            : null;
          const leaderboardResponse = await getUserLeaderboard({
            accessToken,
            tokenType: authSession.tokenType,
          });

          if (!isActive) {
            return;
          }

          setEntries(
            [...leaderboardResponse.content].sort(
              (left, right) => left.rank - right.rank,
            ),
          );
          setStatus("ready");
        } catch (error) {
          if (!isActive) {
            return;
          }

          setEntries([]);
          setErrorMessage(
            error instanceof Error
              ? error.message
              : t("community.leaderboard.loadError"),
          );
          setStatus("error");
        }
      }

      void retrySeed;
      void loadLeaderboard();

      return () => {
        isActive = false;
      };
    }, [authSession.isAuthenticated, authSession.tokenType, retryNonce, t]),
  );

  const summaryContent = useMemo(
    () => buildSummaryContent(entries, t),
    [entries, t],
  );

  if (status === "loading" && entries.length === 0) {
    return <AppLoadingScreen />;
  }

  return (
    <SafeAreaView
      className="flex-1 bg-[#FCF7FA]"
      edges={["top", "left", "right"]}
    >
      <View className="flex-row items-center justify-between px-4 pb-3 pt-2">
        <Pressable
          className="h-10 w-10 items-center justify-center rounded-full bg-white"
          onPress={() => {
            if (router.canGoBack()) {
              router.back();
              return;
            }

            router.replace("/home" as Href);
          }}
          style={leaderboardCardShadow}
        >
          <SymbolView
            name={{
              ios: "chevron.left",
              android: "arrow_back_ios_new",
              web: "arrow_back",
            }}
            size={18}
            tintColor="#FF5F87"
          />
        </Pressable>

        <Text className="text-[16px] font-semibold text-[#1F2940]">
          {t("community.leaderboard.header")}
        </Text>

        <View className="h-10 w-10" />
      </View>

      {status === "error" && entries.length === 0 ? (
        <View className="flex-1 px-4 pt-6">
          <View
            className="rounded-[24px] border border-[#F6D8E5] bg-white px-5 py-6"
            style={leaderboardCardShadow}
          >
            <Text className="text-[17px] font-semibold text-[#1F2940]">
              {t("community.leaderboard.errorTitle")}
            </Text>
            <Text className="mt-2 text-[13px] leading-5 text-[#8F8290]">
              {errorMessage ?? t("community.leaderboard.errorFallback")}
            </Text>

            <Pressable
              className="mt-5 rounded-full bg-[#FF5F87] px-4 py-3"
              onPress={() => {
                setRetryNonce((currentValue) => currentValue + 1);
              }}
            >
              <Text className="text-center text-[13px] font-semibold text-white">
                {t("common.retry")}
              </Text>
            </Pressable>
          </View>
        </View>
      ) : (
        <ScrollView
          className="flex-1"
          contentContainerStyle={{ paddingBottom: 28, paddingHorizontal: 16 }}
          showsVerticalScrollIndicator={false}
        >
          {/* LeaderRankingCard tự chứa padding 16px hai bên nên bù lại bằng
              margin âm để khớp với padding của ScrollView */}
          <View style={{ marginHorizontal: -16, marginTop: 14 }}>
            <LeaderRankingCard
              topEntries={entries
                .filter((entry) => entry.rank >= 1 && entry.rank <= 3)
                .map((entry) => ({
                  avatarUri: readMeaningfulText(entry.avatarUrl) ?? null,
                  isCurrentUser: entry.isCurrentUser,
                  name: getCommunityLeaderboardDisplayName(entry),
                  points: `${formatCommunityXp(entry.totalXp)} XP`,
                  rank: entry.rank,
                  subtitle: getCommunityLeaderboardSubtitle(entry),
                }))}
              xp={summaryContent.totalXp}
            />
          </View>

          <View className="mt-4 gap-2.5">
            {entries.map((entry) => {
              const isCurrentUserEntry = entry.isCurrentUser;
              const isChampion = entry.rank === 1;
              const badgeColor = getCommunityLeaderboardBadgeColor(entry.rank);

              return (
                <Pressable
                  key={`entry-${entry.userId}`}
                  className="flex-row items-center rounded-[18px] px-3 py-2.5"
                  onPress={() => {
                    router.push(
                      `/community/profile/${encodeURIComponent(String(entry.userId))}` as Href,
                    );
                  }}
                  style={[
                    leaderboardCardShadow,
                    {
                      backgroundColor: isCurrentUserEntry
                        ? "#FFF7FA"
                        : "#FFFFFF",
                      borderColor: isCurrentUserEntry
                        ? "#F8D8E3"
                        : "#EEF1F4",
                        borderWidth: 1,
                      },
                  ]}
                >
                  <View className="mr-2.5 w-7 items-center justify-center">
                    {isChampion ? (
                      <View className="absolute -top-3">
                        <SymbolView
                          name={{
                            ios: "crown.fill",
                            android: "workspace_premium",
                            web: "workspace_premium",
                          }}
                          size={14}
                          tintColor="#F7B500"
                        />
                      </View>
                    ) : null}

                    {entry.rank === 2 || entry.rank === 3 ? (
                      <View className="absolute -bottom-1 flex-row gap-[3px]">
                        <View
                          style={{
                            backgroundColor: badgeColor,
                            borderBottomLeftRadius: 2,
                            borderBottomRightRadius: 2,
                            height: 10,
                            transform: [{ rotate: "10deg" }],
                            width: 5,
                          }}
                        />
                        <View
                          style={{
                            backgroundColor: badgeColor,
                            borderBottomLeftRadius: 2,
                            borderBottomRightRadius: 2,
                            height: 10,
                            transform: [{ rotate: "-10deg" }],
                            width: 5,
                          }}
                        />
                      </View>
                    ) : null}

                    <View
                      className="h-6 w-6 items-center justify-center rounded-full"
                      style={{
                        backgroundColor: isTopCommunityLeaderboardRank(
                          entry.rank,
                        )
                          ? badgeColor
                          : "#EEF2F7",
                        borderColor: "#FFFFFF",
                        borderWidth: 2,
                      }}
                    >
                      <Text
                        className="text-[11px] text-[#2F2337]"
                        style={[
                          textStyle(11),
                          {
                            color: getCommunityLeaderboardBadgeTextColor(
                              entry.rank,
                            ),
                          },
                        ]}
                      >
                        {entry.rank}
                      </Text>
                    </View>
                  </View>

                  <View className="mr-2.5 h-10 w-10 items-center justify-center">
                    <UserAvatar
                      borderColor={getCommunityLeaderboardRingColor(entry.rank)}
                      borderWidth={
                        isTopCommunityLeaderboardRank(entry.rank) ? 2 : 1.5
                      }
                      displayName={getCommunityLeaderboardDisplayName(entry)}
                      size={38}
                      textSize={12}
                      uri={readMeaningfulText(entry.avatarUrl) ?? null}
                      username={entry.username}
                    />
                  </View>

                  <View className="flex-1 pr-2">
                    <Text
                      className="text-[14px] text-[#2F2337]"
                      style={textStyle(14)}
                      numberOfLines={1}
                    >
                      {getCommunityLeaderboardDisplayName(entry)}
                    </Text>
                    <Text
                      className="text-[12px] text-[#8F8298]"
                      style={textStyle(12)}
                      numberOfLines={1}
                    >
                      {getCommunityLeaderboardSubtitle(entry)}
                    </Text>
                  </View>

                  <View className="flex-row items-center rounded-full bg-[#FFF0F5] px-2.5 py-1.5">
                    <SymbolView
                      name={{
                        ios: "star.fill",
                        android: "star",
                        web: "star",
                      }}
                      size={10}
                      tintColor="#FF5F87"
                    />
                    <Text className="ml-1 text-[10px] font-medium leading-[13px] text-[#2B2233]">
                      {t("community.leaderboard.xpLabel", {
                        value: formatCommunityXp(entry.totalXp),
                      })}
                    </Text>
                  </View>
                </Pressable>
              );
            })}
          </View>
        </ScrollView>
      )}
    </SafeAreaView>
  );
}
