import {
  useFocusEffect,
  useLocalSearchParams,
  useRouter,
  type Href,
} from "expo-router";
import { StatusBar } from "expo-status-bar";
import { useCallback, useState, type ReactNode } from "react";
import { useTranslation } from "react-i18next";
import {
  Pressable,
  Text as RNText,
  ScrollView,
  View,
  type TextProps,
} from "react-native";
import {
  SafeAreaView,
  useSafeAreaInsets,
} from "react-native-safe-area-context";

import { AppLoadingScreen } from "@/components/ui/app-loading-screen";
import { appToast } from "@/components/ui/app-toast";
import { SymbolView } from "@/components/ui/symbol-view";
import {
  getValidAccessToken,
  useAuthSession,
} from "@/features/auth/hooks/use-auth-session";
import {
  getCommunityGroupById,
  getCommunityGroupMembers,
  type CommunityGroupPayload,
} from "../api/group-api";
import { CommunityGroupStateCard } from "../components/community-group-ui";
import {
  cacheCommunityGroupSession,
  getCachedCommunityGroupSession,
} from "../data/community-group-session-store";
import { bodyLineHeightFor, lineHeightFor } from "@/lib/text-scale";

const detailTextMaxFontSizeMultiplier = 1.05;

const palette = {
  accent: "#EB489B",
  accentStrong: "#D95B8D",
  accentSoft: "#FFE8F0",
  background: "#F6F7FB",
  border: "#E3E7ED",
  mutedText: "#8E869A",
  primaryText: "#2B2233",
  surface: "#FFFFFF",
  subtleText: "#676071",
  successBg: "#EAF8EE",
  successText: "#21A453",
};

type GroupManageStatus = "error" | "idle" | "loading" | "ready";

function Text({
  maxFontSizeMultiplier = detailTextMaxFontSizeMultiplier,
  style,
  ...props
}: TextProps) {
  return (
    <RNText
      maxFontSizeMultiplier={maxFontSizeMultiplier}
      style={[{ includeFontPadding: false }, style]}
      {...props}
    />
  );
}

function normalizeRouteValue(value?: string | null) {
  if (typeof value !== "string") {
    return null;
  }

  const trimmedValue = value.trim();
  return trimmedValue ? trimmedValue : null;
}

function readMeaningfulText(value?: string | null) {
  if (typeof value !== "string") {
    return null;
  }

  const trimmedValue = value.trim();
  return trimmedValue ? trimmedValue : null;
}

function isNumericIdentifier(value?: string | null) {
  return typeof value === "string" && /^\d+$/.test(value.trim());
}

function getLocalizedStatusLabel(
  status: string | null | undefined,
  t: (key: string) => string,
) {
  switch ((status ?? "").trim().toUpperCase()) {
    case "ACTIVE":
      return t("community.groupDetail.statusActive");
    default:
      return t("community.groupDetail.notUpdated");
  }
}

function getInitials(name?: string | null) {
  const normalizedName = readMeaningfulText(name) ?? "CQ";
  const parts = normalizedName.split(/\s+/).filter(Boolean);

  if (parts.length === 1) {
    return parts[0].slice(0, 2).toUpperCase();
  }

  return `${parts[0]?.[0] ?? ""}${parts[1]?.[0] ?? ""}`.toUpperCase();
}

function SectionCard({
  actionLabel,
  children,
  onActionPress,
  title,
}: {
  actionLabel?: string;
  children: ReactNode;
  onActionPress?: () => void;
  title: string;
}) {
  return (
    <View
      className="rounded-[24px] border px-4 py-2.5"
      style={{
        backgroundColor: palette.surface,
        borderColor: palette.border,
      }}
    >
      <View className="flex-row items-center justify-between gap-3">
        <Text
          className="text-[16px] font-semibold"
          style={{ color: palette.primaryText, lineHeight: lineHeightFor(16) }}
        >
          {title}
        </Text>

        {actionLabel && onActionPress ? (
          <Pressable hitSlop={8} onPress={onActionPress}>
            <Text
              className="text-[13px] font-medium"
              style={{ color: palette.accent, lineHeight: lineHeightFor(13) }}
            >
              {actionLabel}
            </Text>
          </Pressable>
        ) : null}
      </View>

      <View className="mt-2">{children}</View>
    </View>
  );
}

function SettingsEntryRow({
  description,
  expanded = false,
  hideDivider = false,
  icon,
  label,
  onPress,
}: {
  description: string;
  expanded?: boolean;
  hideDivider?: boolean;
  icon: string;
  label: string;
  onPress: () => void;
}) {
  return (
    <Pressable
      className="flex-row items-center py-2"
      onPress={onPress}
      style={({ pressed }) => ({
        borderBottomColor: palette.border,
        borderBottomWidth: hideDivider ? 0 : 1,
        opacity: pressed ? 0.85 : 1,
      })}
    >
      <View
        className="mr-2.5 h-8.5 w-8.5 items-center justify-center rounded-2xl"
        style={{ backgroundColor: "#FFF8FA" }}
      >
        <SymbolView name={icon} size={16} tintColor={palette.primaryText} />
      </View>

      <View className="min-w-0 flex-1 pr-2">
        <Text
          className="text-[15px] font-medium"
          style={{ color: palette.primaryText, lineHeight: lineHeightFor(15) }}
        >
          {label}
        </Text>
        <Text
          className="mt-0.5 text-[12px]"
          style={{ color: palette.subtleText, lineHeight: bodyLineHeightFor(12) }}
        >
          {description}
        </Text>
      </View>

      <SymbolView
        name={{
          ios: expanded ? "chevron.down" : "chevron.right",
          android: expanded ? "expand-more" : "chevron-right",
          web: expanded ? "expand-more" : "chevron-right",
        }}
        size={16}
        tintColor={palette.mutedText}
      />
    </Pressable>
  );
}

function ManagementActionRow({
  badge,
  description,
  hideDivider = false,
  icon,
  label,
  onPress,
}: {
  badge?: string;
  description: string;
  hideDivider?: boolean;
  icon: string;
  label: string;
  onPress: () => void;
}) {
  return (
    <Pressable
      className="flex-row items-center py-2"
      onPress={onPress}
      style={({ pressed }) => ({
        borderBottomColor: palette.border,
        borderBottomWidth: hideDivider ? 0 : 1,
        opacity: pressed ? 0.85 : 1,
      })}
    >
      <View
        className="mr-2.5 h-8.5 w-8.5 items-center justify-center rounded-2xl"
        style={{ backgroundColor: "#FFF8FA" }}
      >
        <SymbolView name={icon} size={16} tintColor={palette.accentStrong} />
      </View>

      <View className="min-w-0 flex-1 pr-2">
        <Text
          className="text-[15px] font-medium"
          style={{ color: palette.primaryText, lineHeight: lineHeightFor(15) }}
        >
          {label}
        </Text>
        <Text
          className="mt-0.5 text-[12px]"
          style={{ color: palette.subtleText, lineHeight: bodyLineHeightFor(12) }}
        >
          {description}
        </Text>
      </View>

      <View className="flex-row items-center gap-2">
        {badge ? (
          <View
            className="rounded-full px-2 py-1"
            style={{ backgroundColor: "#F4F5F7" }}
          >
            <Text
              className="text-[11px] font-semibold"
              style={{ color: palette.mutedText, lineHeight: lineHeightFor(11) }}
            >
              {badge}
            </Text>
          </View>
        ) : null}
        <SymbolView
          name={{
            ios: "chevron.right",
            android: "chevron-right",
            web: "chevron-right",
          }}
          size={15}
          tintColor={palette.mutedText}
        />
      </View>
    </Pressable>
  );
}

export default function CommunityGroupManageScreen() {
  const authSession = useAuthSession();
  const { t } = useTranslation();
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const { shareToken } = useLocalSearchParams<{ shareToken?: string }>();
  const resolvedRouteValue =
    typeof shareToken === "string"
      ? normalizeRouteValue(decodeURIComponent(shareToken))
      : null;
  const cachedGroupSession = getCachedCommunityGroupSession(resolvedRouteValue);
  const resolvedGroupId = isNumericIdentifier(resolvedRouteValue)
    ? resolvedRouteValue
    : normalizeRouteValue(cachedGroupSession?.groupId);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [groupDetail, setGroupDetail] = useState<CommunityGroupPayload | null>(
    null,
  );
  const [kickedMembersCount, setKickedMembersCount] = useState<number | null>(
    null,
  );
  const [retryNonce, setRetryNonce] = useState(0);
  const [status, setStatus] = useState<GroupManageStatus>(
    resolvedRouteValue ? "loading" : "idle",
  );

  useFocusEffect(
    useCallback(() => {
      let isActive = true;
      const retrySeed = retryNonce;

      async function loadGroupDetail() {
        if (!resolvedRouteValue) {
          setErrorMessage(t("community.groupDetail.missingRouteError"));
          setKickedMembersCount(null);
          setStatus("error");
          return;
        }

        if (!resolvedGroupId) {
          setErrorMessage(t("community.groupManage.missingGroupIdError"));
          setKickedMembersCount(null);
          setStatus("error");
          return;
        }

        setStatus("loading");
        setErrorMessage(null);
        setKickedMembersCount(null);

        try {
          const accessToken = authSession.isAuthenticated
            ? await getValidAccessToken()
            : null;
          const [nextGroupDetail, kickedMembers] = await Promise.all([
            getCommunityGroupById({
              accessToken: accessToken ?? undefined,
              groupId: resolvedGroupId,
              tokenType: authSession.tokenType ?? undefined,
            }),
            getCommunityGroupMembers({
              accessToken: accessToken ?? undefined,
              action: "KICKED",
              groupId: resolvedGroupId,
              tokenType: authSession.tokenType ?? undefined,
            }).catch((error) => {
              console.warn("[community] load kicked members failed", {
                error: error instanceof Error ? error.message : error,
                groupId: resolvedGroupId,
              });
              return null;
            }),
          ]);

          if (!isActive) {
            return;
          }

          const cachedGroup = cacheCommunityGroupSession({
            ...nextGroupDetail,
            source: cachedGroupSession?.source ?? "listed",
          });

          setGroupDetail(cachedGroup ?? nextGroupDetail);
          setKickedMembersCount(kickedMembers?.length ?? null);
          setStatus("ready");
        } catch (error) {
          if (!isActive) {
            return;
          }

          setErrorMessage(
            error instanceof Error
              ? error.message
              : t("community.groupManage.loadError"),
          );
          setKickedMembersCount(null);
          setStatus("error");
        }
      }

      void retrySeed;
      void loadGroupDetail();

      return () => {
        isActive = false;
      };
    }, [
      authSession.isAuthenticated,
      authSession.tokenType,
      cachedGroupSession?.source,
      resolvedGroupId,
      resolvedRouteValue,
      retryNonce,
      t,
    ]),
  );

  const displayGroup = groupDetail ?? cachedGroupSession;

  const handleOpenGroupSettings = () => {
    if (!displayGroup?.shareToken) {
      return;
    }

    router.push(
      `/community/group/${encodeURIComponent(displayGroup.shareToken)}/settings` as Href,
    );
  };

  const handleOpenGroupMembers = () => {
    const nextShareToken = displayGroup?.shareToken ?? resolvedRouteValue;
    const nextGroupId = displayGroup?.groupId ?? resolvedGroupId;

    if (!nextShareToken || !nextGroupId) {
      appToast.error(t("community.groupDetail.missingGroupForMembers"));
      return;
    }

    router.push(
      `/community/group/${encodeURIComponent(nextShareToken)}/members?groupId=${encodeURIComponent(nextGroupId)}` as Href,
    );
  };

  const handleOpenPendingMembers = () => {
    const nextShareToken = displayGroup?.shareToken ?? resolvedRouteValue;
    const nextGroupId = displayGroup?.groupId ?? resolvedGroupId;

    if (!nextShareToken || !nextGroupId) {
      appToast.error(t("community.groupManage.missingGroupForPending"));
      return;
    }

    router.push(
      `/community/group/${encodeURIComponent(nextShareToken)}/members?groupId=${encodeURIComponent(nextGroupId)}&action=PENDING&screenTitle=${encodeURIComponent(t("community.groupManage.pendingRequestsScreenTitle"))}` as Href,
    );
  };

  const handleOpenKickedMembers = () => {
    const nextShareToken = displayGroup?.shareToken ?? resolvedRouteValue;
    const nextGroupId = displayGroup?.groupId ?? resolvedGroupId;

    if (!nextShareToken || !nextGroupId) {
      appToast.error(t("community.groupManage.missingGroupForKicked"));
      return;
    }

    router.push(
      `/community/group/${encodeURIComponent(nextShareToken)}/members?groupId=${encodeURIComponent(nextGroupId)}&action=KICKED&screenTitle=${encodeURIComponent(t("community.groupManage.kickedMembersLabel"))}` as Href,
    );
  };

  if (!resolvedRouteValue) {
    return (
      <SafeAreaView
        className="flex-1"
        edges={["left", "right"]}
        style={{ backgroundColor: palette.background }}
      >
        <StatusBar style="dark" />
        <View className="flex-1 px-4" style={{ paddingTop: insets.top + 24 }}>
          <CommunityGroupStateCard
            description={t("community.groupDetail.routeInvalidDescription")}
            icon="link_off"
            title={t("community.groupDetail.routeInvalidTitle")}
            variant="empty"
          />
        </View>
      </SafeAreaView>
    );
  }

  if (status === "loading" && !displayGroup) {
    return (
      <AppLoadingScreen
        edges={["left", "right"]}
        message={t("community.groupManage.loadingMessage")}
      />
    );
  }

  if (!displayGroup) {
    return (
      <SafeAreaView
        className="flex-1"
        edges={["left", "right"]}
        style={{ backgroundColor: palette.background }}
      >
        <StatusBar style="dark" />
        <View className="flex-1 px-4" style={{ paddingTop: insets.top + 24 }}>
          <CommunityGroupStateCard
            actionLabel={t("common.retry")}
            description={
              errorMessage ??
              t("community.groupManage.loadErrorFallbackDescription")
            }
            icon="error"
            onPress={() => {
              setRetryNonce((currentValue) => currentValue + 1);
            }}
            title={t("community.groupManage.loadErrorTitle")}
            variant="error"
          />
        </View>
      </SafeAreaView>
    );
  }

  const totalMembersValue = displayGroup.totalMembers ?? 0;
  const totalMembersLabel = t("community.groupsScreen.memberCountLabel", {
    count: totalMembersValue,
  });
  const statusLabel = getLocalizedStatusLabel(displayGroup.status, t);

  return (
    <SafeAreaView
      className="flex-1"
      edges={["left", "right"]}
      style={{ backgroundColor: palette.background }}
    >
      <StatusBar style="dark" />

      <ScrollView
        contentContainerStyle={{
          paddingBottom: Math.max(insets.bottom + 32, 36),
          paddingTop: insets.top + 8,
        }}
        showsVerticalScrollIndicator={false}
      >
        <View className="px-4">
          <View className="flex-row items-center justify-between">
            <Pressable
              className="h-10 w-10 items-center justify-center rounded-full bg-white"
              hitSlop={8}
              onPress={() => {
                router.back();
              }}
              style={{ borderColor: palette.border, borderWidth: 1 }}
            >
              <SymbolView
                name={{
                  ios: "chevron.left",
                  android: "arrow-back",
                  web: "arrow-back",
                }}
                size={18}
                tintColor={palette.primaryText}
              />
            </Pressable>

            <Text
              className="text-[17px] font-semibold"
              style={{ color: palette.primaryText, lineHeight: lineHeightFor(17) }}
            >
              {t("community.groupManage.headerTitle")}
            </Text>

            <View className="h-10 w-10" />
          </View>

          <View
            className="mt-3.5 rounded-[24px] border px-4 py-2.5"
            style={{
              backgroundColor: palette.surface,
              borderColor: palette.border,
            }}
          >
            <View className="flex-row items-center">
              <View
                className="mr-3 h-12 w-12 items-center justify-center rounded-[16px]"
                style={{ backgroundColor: palette.accentSoft }}
              >
                <Text
                  className="text-[17px] font-bold"
                  style={{ color: palette.accentStrong, lineHeight: lineHeightFor(17) }}
                >
                  {getInitials(displayGroup.groupName)}
                </Text>
              </View>

              <View className="min-w-0 flex-1">
                <Text
                  className="text-[19px] font-semibold"
                  numberOfLines={2}
                  style={{ color: palette.primaryText, lineHeight: lineHeightFor(19) }}
                >
                  {displayGroup.groupName ??
                    t("community.groupsScreen.status.default")}
                </Text>

                <Text
                  className="mt-0.5 text-[12px]"
                  style={{ color: palette.subtleText, lineHeight: bodyLineHeightFor(12) }}
                >
                  {t("community.groupsScreen.status.default")} •{" "}
                  {totalMembersLabel}
                </Text>

                <View
                  className="mt-1 self-start rounded-full px-2 py-1"
                  style={{ backgroundColor: palette.successBg }}
                >
                  <Text
                    className="text-[11px] font-bold"
                    style={{ color: palette.successText, lineHeight: lineHeightFor(11) }}
                  >
                    {statusLabel}
                  </Text>
                </View>
              </View>
            </View>
          </View>

          {status === "error" && errorMessage ? (
            <View
              className="mt-3.5 rounded-[18px] border px-4 py-3"
              style={{
                backgroundColor: "#FFF4EF",
                borderColor: "#F5D2C0",
              }}
            >
              <Text
                className="text-[12px]"
                style={{ color: "#D97A55", lineHeight: bodyLineHeightFor(12) }}
              >
                {errorMessage}
              </Text>
            </View>
          ) : null}

          <View className="mt-3">
            <SectionCard title={t("community.groupManage.memberManagementTitle")}>
              <ManagementActionRow
                badge={
                  displayGroup.requiredApproval
                    ? t("community.groupManage.pendingBadgeZero")
                    : t("community.groupManage.pendingBadgeOff")
                }
                description={t(
                  "community.groupManage.pendingRequestsDescription",
                )}
                icon="person-add-alt-1"
                label={t("community.groupManage.pendingRequestsScreenTitle")}
                onPress={handleOpenPendingMembers}
              />
              <ManagementActionRow
                badge={`${totalMembersValue}`}
                description={t("community.groupManage.membersListDescription")}
                icon="groups"
                label={t("community.groupManage.membersListLabel")}
                onPress={handleOpenGroupMembers}
              />
              <ManagementActionRow
                badge={
                  kickedMembersCount === null
                    ? undefined
                    : `${kickedMembersCount}`
                }
                description={t(
                  "community.groupManage.kickedMembersDescription",
                )}
                hideDivider
                icon="person-remove"
                label={t("community.groupManage.kickedMembersLabel")}
                onPress={handleOpenKickedMembers}
              />
            </SectionCard>
          </View>

          <View className="mt-3">
            <SectionCard title={t("community.groupManage.settingsTitle")}>
              <SettingsEntryRow
                description={t(
                  "community.groupManage.groupSettingsDescription",
                )}
                icon="settings"
                label={t("community.groupManage.groupSettingsLabel")}
                onPress={handleOpenGroupSettings}
              />
            </SectionCard>
          </View>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}
