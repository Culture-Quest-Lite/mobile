import * as Clipboard from "expo-clipboard";
import { useLocalSearchParams, useRouter } from "expo-router";
import { StatusBar } from "expo-status-bar";
import { useMemo, useState } from "react";
import { useTranslation } from "react-i18next";
import { Alert, ScrollView, Share, Text, View } from "react-native";
import {
  SafeAreaView,
  useSafeAreaInsets,
} from "react-native-safe-area-context";

import { getCachedCommunityGroupSession } from "../data/community-group-session-store";
import { buildCommunityInviteShareMessage } from "../lib/community-group-invite-links";
import {
  CommunityGroupInviteLinkCard,
  CommunityGroupMetricCard,
  CommunityGroupStateCard,
  CommunityGroupTopBar,
} from "../components/community-group-ui";
import { bodyLineHeightFor, lineHeightFor } from "@/lib/text-scale";

export default function CommunityGroupInviteMembersScreen() {
  const router = useRouter();
  const { t } = useTranslation();
  const insets = useSafeAreaInsets();
  const { shareToken } = useLocalSearchParams<{ shareToken?: string }>();
  const resolvedShareToken =
    typeof shareToken === "string" ? decodeURIComponent(shareToken) : null;
  const groupSession = getCachedCommunityGroupSession(resolvedShareToken);
  const [copied, setCopied] = useState(false);
  const [isSharePending, setIsSharePending] = useState(false);

  const shareMessage = useMemo(() => {
    if (!groupSession) {
      return null;
    }

    return buildCommunityInviteShareMessage({
      appInviteUrl: groupSession.inviteAppUrl,
      groupName: groupSession.groupName,
      webInviteUrl: groupSession.inviteWebUrl,
    });
  }, [groupSession]);

  const handleCopy = async () => {
    if (!groupSession) {
      return;
    }

    await Clipboard.setStringAsync(groupSession.inviteWebUrl);
    setCopied(true);
  };

  const handleShare = async () => {
    if (!shareMessage) {
      return;
    }

    setIsSharePending(true);

    try {
      await Share.share({
        message: shareMessage,
        title: t("community.groupInvite.headerTitle"),
      });
    } catch (error) {
      Alert.alert(
        t("community.feed.shareErrorTitle"),
        error instanceof Error
          ? error.message
          : t("community.groupInvite.shareErrorFallback"),
      );
    } finally {
      setIsSharePending(false);
    }
  };

  return (
    <SafeAreaView className="flex-1 bg-[#F8F6F1]" edges={["top", "left", "right"]}>
      <StatusBar style="dark" />

      <CommunityGroupTopBar
        onBack={() => {
          router.back();
        }}
        title={t("community.groupInvite.headerTitle")}
      />

      {!resolvedShareToken ? (
        <View className="flex-1 px-4 pt-6">
          <CommunityGroupStateCard
            description={t("community.groupInvite.invalidTokenDescription")}
            icon="link_off"
            title={t("community.groupInvite.invalidTokenTitle")}
            variant="empty"
          />
        </View>
      ) : !groupSession ? (
        <View className="flex-1 px-4 pt-6">
          <CommunityGroupStateCard
            description={t("community.groupInvite.missingSessionDescription")}
            icon="groups"
            title={t("community.groupInvite.missingSessionTitle")}
            variant="empty"
          />
        </View>
      ) : (
        <ScrollView
          contentContainerStyle={{
            paddingBottom: Math.max(insets.bottom + 24, 32),
            paddingHorizontal: 16,
            paddingTop: 18,
          }}
          showsVerticalScrollIndicator={false}
        >
          <View className="rounded-[28px] border border-[#E5E7EB] bg-white px-4 py-4">
            <Text
              className="text-[12px] font-semibold uppercase tracking-[0.3px] text-[#8A94A3]"
              style={{ includeFontPadding: false, lineHeight: bodyLineHeightFor(12) }}
            >
              {t("community.groupInvite.headerTitle")}
            </Text>
            <Text
              className="mt-2 text-[24px] font-black text-[#1F2933]"
              style={{ includeFontPadding: false, lineHeight: lineHeightFor(24) }}
            >
              {groupSession.groupName ??
                t("community.groupInvite.defaultGroupName")}
            </Text>
            <Text
              className="mt-2 text-[14px] text-[#68737D]"
              style={{ includeFontPadding: false, lineHeight: bodyLineHeightFor(14) }}
            >
              {t("community.groupInvite.screenDescription")}
            </Text>
          </View>

          <View className="mt-4 flex-row gap-3">
            <CommunityGroupMetricCard
              label={t("community.groupInvite.totalMembersLabel")}
              value={
                groupSession.totalMembers !== null
                  ? `${groupSession.totalMembers}`
                  : t("home.stats.updating")
              }
            />
            <CommunityGroupMetricCard
              label={t("community.groupInvite.shareTokenLabel")}
              value={groupSession.shareToken}
            />
          </View>

          <View className="mt-4">
            <CommunityGroupInviteLinkCard
              appInviteUrl={groupSession.inviteAppUrl}
              copied={copied}
              inviteUrl={groupSession.inviteWebUrl}
              onCopy={() => {
                void handleCopy();
              }}
              onShare={() => {
                void handleShare();
              }}
              sharePending={isSharePending}
            />
          </View>
        </ScrollView>
      )}
    </SafeAreaView>
  );
}
