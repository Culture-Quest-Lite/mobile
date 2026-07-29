import * as Clipboard from "expo-clipboard";
import { useLocalSearchParams, useRouter } from "expo-router";
import { StatusBar } from "expo-status-bar";
import { useMemo, useState } from "react";
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

export default function CommunityGroupInviteMembersScreen() {
  const router = useRouter();
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
        title: "Invite Members",
      });
    } catch (error) {
      Alert.alert(
        "Khong the share",
        error instanceof Error
          ? error.message
          : "Khong the mo native share luc nay.",
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
        title="Invite Members"
      />

      {!resolvedShareToken ? (
        <View className="flex-1 px-4 pt-6">
          <CommunityGroupStateCard
            description="Khong doc duoc shareToken de hien thi link moi thanh vien."
            icon="link_off"
            title="Link moi khong hop le"
            variant="empty"
          />
        </View>
      ) : !groupSession ? (
        <View className="flex-1 px-4 pt-6">
          <CommunityGroupStateCard
            description="Khong tim thay du lieu nhom trong phien hien tai. Hay quay lai Group Detail hoac tao/join nhom lai."
            icon="groups"
            title="Chua co du lieu nhom"
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
              style={{ includeFontPadding: false, lineHeight: 14 }}
            >
              Invite Members
            </Text>
            <Text
              className="mt-2 text-[24px] font-black text-[#1F2933]"
              style={{ includeFontPadding: false, lineHeight: 30 }}
            >
              {groupSession.groupName ?? "Nhom du lich"}
            </Text>
            <Text
              className="mt-2 text-[14px] text-[#68737D]"
              style={{ includeFontPadding: false, lineHeight: 20 }}
            >
              Man nay khong tu tao them API. Toan bo link moi thanh vien duoc
              suy ra truc tiep tu shareToken backend tra ve.
            </Text>
          </View>

          <View className="mt-4 flex-row gap-3">
            <CommunityGroupMetricCard
              label="Total Members"
              value={
                groupSession.totalMembers !== null
                  ? `${groupSession.totalMembers}`
                  : "Dang cap nhat"
              }
            />
            <CommunityGroupMetricCard
              label="Share Token"
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
