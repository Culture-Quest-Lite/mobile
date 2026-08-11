import * as Clipboard from "expo-clipboard";
import { LinearGradient } from "expo-linear-gradient";
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
  ActivityIndicator,
  BackHandler,
  Image,
  ImageBackground,
  Modal,
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

import { appAlert } from "@/components/ui/app-dialog";
import { AppLoadingScreen } from "@/components/ui/app-loading-screen";
import { appToast } from "@/components/ui/app-toast";
import { SymbolView, type SymbolName } from "@/components/ui/symbol-view";
import {
  getValidAccessToken,
  useAuthSession,
} from "@/features/auth/hooks/use-auth-session";
import { getMyProfile } from "@/features/profile/api/get-me";
import { getUserProfileById } from "@/features/profile/api/get-user-by-id";
import { bodyLineHeightFor, lineHeightFor } from "@/lib/text-scale";
import {
  getCommunityGroupById,
  getCommunityGroupMembers,
  leaveCommunityGroup,
  refreshCommunityGroupToken,
  type CommunityGroupPayload,
} from "../api/group-api";
import { CommunityGroupStateCard } from "../components/community-group-ui";
import {
  getCachedCommunityGroupJourneySession,
  removeCachedCommunityGroupJourneySession,
} from "../data/community-group-journey-store";
import {
  cacheCommunityGroupSession,
  getCachedCommunityGroupSession,
  removeCachedCommunityGroupSession,
} from "../data/community-group-session-store";
import { buildCommunityInviteWebUrl } from "../lib/community-group-invite-links";

const HERO_IMAGE = require("../../../../assets/images/hero.jpg");
const GROUP_JOURNEY_EMPTY_IMAGE = require("../../../../assets/images/continnueroute.png");
const detailTextMaxFontSizeMultiplier = 1.05;

const palette = {
  accent: "#EB489B",
  accentStrong: "#D95B8D",
  background: "#FCF6F8",
  border: "#E3E7ED",
  mutedText: "#8E869A",
  primaryText: "#2B2233",
  softAccent: "#FFF7FA",
  softOrange: "#FFF4EF",
  surface: "#FFFFFF",
  surfaceMuted: "#FFF8FB",
  warmAccent: "#F58752",
  warmText: "#D97A55",
};

type GroupDetailStatus = "error" | "idle" | "loading" | "ready";

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

function normalizeDateValue(value?: string | null) {
  if (typeof value !== "string") {
    return null;
  }

  const trimmedValue = value.trim();

  if (!trimmedValue) {
    return null;
  }

  return trimmedValue.replace(/(\.\d{3})\d+$/, "$1");
}

function padDatePart(value: number) {
  return `${value}`.padStart(2, "0");
}

function formatGroupDate(
  value: string | null | undefined,
  t: (key: string) => string,
) {
  const normalizedDateValue = normalizeDateValue(value);

  if (!normalizedDateValue) {
    return t("community.groupDetail.notUpdated");
  }

  const date = new Date(normalizedDateValue);

  if (Number.isNaN(date.getTime())) {
    return normalizedDateValue.slice(0, 10).replace(/-/g, "/");
  }

  return `${padDatePart(date.getDate())}/${padDatePart(
    date.getMonth() + 1,
  )}/${date.getFullYear()}`;
}

function formatJourneyStartedLabel(value?: number | null) {
  if (typeof value !== "number" || !Number.isFinite(value)) {
    return "Vừa bắt đầu";
  }

  const date = new Date(value);

  if (Number.isNaN(date.getTime())) {
    return "Vừa bắt đầu";
  }

  return `${`${date.getHours()}`.padStart(2, "0")}:${`${date.getMinutes()}`.padStart(2, "0")} · ${`${date.getDate()}`.padStart(2, "0")}/${`${date.getMonth() + 1}`.padStart(2, "0")}`;
}

function GroupSection({
  children,
  title,
}: {
  children: ReactNode;
  title: string;
}) {
  return (
    <View
      className="rounded-[22px] border px-4 py-3"
      style={{
        backgroundColor: palette.surface,
        borderColor: palette.border,
      }}
    >
      <Text
        className="text-[15px] font-extrabold"
        style={{ color: palette.primaryText, lineHeight: lineHeightFor(15) }}
      >
        {title}
      </Text>
      <View className="mt-2.5">{children}</View>
    </View>
  );
}

function GroupInfoRow({
  hideDivider = false,
  icon,
  label,
  tone,
  value,
}: {
  hideDivider?: boolean;
  icon: string;
  label: string;
  tone?: "pending" | "success";
  value: string;
}) {
  const badgeTone =
    tone === "success"
      ? { background: "#EAF8EE", text: "#25B45B" }
      : tone === "pending"
        ? { background: "#FDEAF2", text: palette.accentStrong }
        : null;
  return (
    <View
      className="flex-row items-center py-2.5"
      style={{
        borderBottomColor: palette.border,
        borderBottomWidth: hideDivider ? 0 : 1,
      }}
    >
      <View
        className="mr-2.5 h-7 w-7 items-center justify-center rounded-xl"
        style={{ backgroundColor: "#FFF8FA" }}
      >
        <SymbolView name={icon} size={15} tintColor="#A09AAE" />
      </View>

      <View className="flex-1">
        <Text
          className="text-[14px]"
          style={{
            color: palette.mutedText,
            lineHeight: bodyLineHeightFor(14),
          }}
        >
          {label}
        </Text>
      </View>

      {badgeTone ? (
        <View
          className="ml-3 rounded-full px-2 py-1"
          style={{ backgroundColor: badgeTone.background }}
        >
          <Text
            className="text-right text-[14px]"
            style={{ color: badgeTone.text, lineHeight: bodyLineHeightFor(14) }}
          >
            {value}
          </Text>
        </View>
      ) : (
        <Text
          className="ml-3 text-right text-[14px]"
          style={{
            color: palette.primaryText,
            lineHeight: bodyLineHeightFor(14),
          }}
        >
          {value}
        </Text>
      )}
    </View>
  );
}

function GroupInviteSection({
  copied,
  isRefreshing = false,
  link,
  onCopy,
  onRefresh,
}: {
  copied: boolean;
  isRefreshing?: boolean;
  link: string;
  onCopy: () => void;
  onRefresh?: (() => void) | undefined;
}) {
  const { t } = useTranslation();

  return (
    <View
      className="rounded-[22px] border px-4 py-3"
      style={{
        backgroundColor: palette.surface,
        borderColor: palette.border,
      }}
    >
      <View className="flex-row items-center justify-between gap-3">
        <Text
          className="flex-1 text-[15px] font-extrabold"
          style={{ color: palette.primaryText, lineHeight: lineHeightFor(15) }}
        >
          {t("community.groupDetail.inviteSectionTitle")}
        </Text>
        {onRefresh ? (
          <Pressable
            accessibilityLabel={t("community.groupDetail.refreshLinkA11y")}
            disabled={isRefreshing}
            hitSlop={8}
            onPress={onRefresh}
            style={({ pressed }) => ({
              opacity: isRefreshing ? 0.6 : pressed ? 0.72 : 1,
            })}
          >
            {isRefreshing ? (
              <ActivityIndicator color={palette.accentStrong} size="small" />
            ) : (
              <Text
                className="text-[13px]"
                style={{
                  color: palette.accentStrong,
                  lineHeight: bodyLineHeightFor(13),
                }}
              >
                {t("community.groupDetail.refreshLinkAction")}
              </Text>
            )}
          </Pressable>
        ) : null}
      </View>

      <View
        className="mt-1.5 flex-row items-center rounded-[16px] border px-2.5 py-1.5"
        style={{
          backgroundColor: "#FFF6F8",
          borderColor: palette.border,
        }}
      >
        <View
          className="mr-2 h-7 w-7 items-center justify-center rounded-full"
          style={{ backgroundColor: "#FFF4EF" }}
        >
          <SymbolView
            name={{ ios: "paperplane.fill", android: "link", web: "link" }}
            size={15}
            tintColor={palette.warmAccent}
          />
        </View>

        <View className="flex-1">
          <Text
            className="text-[14px]"
            selectable
            style={{ color: "#4B5563", lineHeight: bodyLineHeightFor(14) }}
          >
            {link}
          </Text>
        </View>
      </View>

      <Pressable
        accessibilityLabel={t("community.groupDetail.copyLinkA11y")}
        className="mt-1.5 flex-row items-center justify-center rounded-[16px] px-3 py-2.5"
        hitSlop={8}
        onPress={onCopy}
        style={({ pressed }) => ({
          backgroundColor: copied ? "#FAD5E4" : "#FFE8F0",
          opacity: pressed ? 0.84 : 1,
          transform: [{ scale: copied ? 1.02 : 1 }],
        })}
      >
        <SymbolView
          name={{
            ios: "doc.on.doc",
            android: "content-copy",
            web: "content-copy",
          }}
          size={16}
          tintColor={palette.accentStrong}
        />
        <Text
          className="ml-1.5 text-[14px]"
          style={{
            color: palette.accentStrong,
            lineHeight: bodyLineHeightFor(14),
          }}
        >
          {copied
            ? t("community.groupDetail.linkCopied")
            : t("community.groupDetail.copyLink")}
        </Text>
      </Pressable>
    </View>
  );
}

function GroupJourneySection({
  hasActiveJourney,
  onPress,
  routeName,
  startedAtLabel,
}: {
  hasActiveJourney: boolean;
  onPress?: (() => void) | undefined;
  routeName?: string | null;
  startedAtLabel?: string | null;
}) {
  if (!hasActiveJourney) {
    return (
      <View
        className="rounded-[22px] border px-4 py-3"
        style={{
          backgroundColor: palette.surface,
          borderColor: "#F5E6DA",
        }}
      >
        <View className="flex-row items-start justify-between gap-3">
          <Text
            className="text-[15px] font-extrabold"
            style={{
              color: palette.primaryText,
              lineHeight: lineHeightFor(15),
            }}
          >
            Hành trình nhóm
          </Text>

          <View
            className="rounded-full px-2.5 py-1"
            style={{ backgroundColor: "#FFF1E8" }}
          >
            <Text
              className="text-[10px]"
              style={{ color: "#F47D52", lineHeight: lineHeightFor(10) }}
            >
              Chưa bắt đầu
            </Text>
          </View>
        </View>

        <View className="mt-3 flex-row items-center gap-3">
          <Image
            source={GROUP_JOURNEY_EMPTY_IMAGE}
            resizeMode="contain"
            style={{ height: 132, width: 150 }}
          />

          <View className="min-w-0 flex-1">
            <Text
              className="text-[14px]"
              style={{
                color: palette.primaryText,
                lineHeight: lineHeightFor(14),
              }}
            >
              Chưa có hành trình đang diễn ra
            </Text>
            <Text
              className="mt-1 text-[13px]"
              style={{
                color: palette.mutedText,
                lineHeight: bodyLineHeightFor(13),
              }}
            >
              Sau khi bắt đầu hành trình cùng nhóm, vị trí live sẽ hiển thị tại
              đây.
            </Text>

            <Pressable
              className="mt-2.5 self-start rounded-[14px] px-3.5 py-2.5"
              disabled={!onPress}
              onPress={onPress}
              style={({ pressed }) => ({
                backgroundColor: "#FF7FA5",
                opacity: !onPress ? 0.6 : pressed ? 0.84 : 1,
              })}
            >
              <View className="flex-row items-center">
                <SymbolView
                  name={{
                    android: "location_on",
                    ios: "location.fill",
                    web: "location_on",
                  }}
                  size={15}
                  tintColor="#FFFFFF"
                />
                <Text
                  className="ml-1.5 text-[14px]"
                  style={{
                    color: "#FFFFFF",
                    lineHeight: bodyLineHeightFor(14),
                  }}
                >
                  Bắt đầu hành trình
                </Text>
              </View>
            </Pressable>
          </View>
        </View>
      </View>
    );
  }

  return (
    <View
      className="rounded-[22px] border px-4 py-3"
      style={{
        backgroundColor: palette.surface,
        borderColor: "#F5D7E2",
      }}
    >
      <View className="flex-row items-start justify-between gap-3">
        <Text
          className="text-[15px] font-extrabold"
          style={{ color: palette.primaryText, lineHeight: lineHeightFor(15) }}
        >
          Hành trình nhóm
        </Text>

        <View
          className="flex-row items-center rounded-full px-2.5 py-1"
          style={{
            backgroundColor: "#EAF8EE",
          }}
        >
          <View
            className="mr-1.5 h-2 w-2 rounded-full"
            style={{ backgroundColor: "#2FB861" }}
          />
          <Text
            className="text-[11px]"
            style={{
              color: "#21A453",
              lineHeight: lineHeightFor(11),
            }}
          >
            Đang diễn ra
          </Text>
        </View>
      </View>

      <View className="mt-3 flex-row items-center">
        <SymbolView
          name={{
            android: "route",
            ios: "map.fill",
            web: "route",
          }}
          size={14}
          tintColor={palette.mutedText}
        />
        <Text
          className="ml-1.5 text-[14px]"
          style={{
            color: palette.mutedText,
            lineHeight: lineHeightFor(14),
          }}
        >
          {`Nhóm đang đi route ${routeName ?? "Hành trình nhóm"}`}
        </Text>
      </View>

      <View className="mt-2 flex-row items-center">
        <SymbolView
          name={{
            android: "schedule",
            ios: "clock.fill",
            web: "schedule",
          }}
          size={14}
          tintColor="#F37E8E"
        />
        <Text
          className="ml-1.5 text-[14px]"
          style={{
            color: palette.mutedText,
            lineHeight: bodyLineHeightFor(14),
          }}
        >
          {`Bắt đầu tham gia:  ${startedAtLabel ?? "vừa bắt đầu"}`}
        </Text>
      </View>

      <Pressable
        className="mt-4 flex-row items-center justify-center rounded-[14px] px-3 py-3"
        disabled={!onPress}
        onPress={onPress}
        style={({ pressed }) => ({
          backgroundColor: "#FFF5F8",
          opacity: !onPress ? 0.72 : pressed ? 0.84 : 1,
        })}
      >
        <SymbolView
          name={{
            android: "location_on",
            ios: "location.fill",
            web: "location_on",
          }}
          size={16}
          tintColor={palette.accentStrong}
        />
        <Text
          className="ml-1.5 text-[14px]"
          style={{
            color: palette.accentStrong,
            lineHeight: bodyLineHeightFor(14),
          }}
        >
          Theo dõi live vị trí thành viên
        </Text>
      </Pressable>
    </View>
  );
}

function GroupOverflowActionRow({
  destructive = false,
  disabled = false,
  icon,
  label,
  onPress,
}: {
  destructive?: boolean;
  disabled?: boolean;
  icon: SymbolName;
  label: string;
  onPress: () => void;
}) {
  const accentColor = destructive ? "#D95B8D" : palette.primaryText;

  return (
    <Pressable
      accessibilityRole="button"
      disabled={disabled}
      className="flex-row items-center px-1 py-3"
      onPress={onPress}
      style={({ pressed }) => ({
        opacity: disabled ? 0.45 : pressed ? 0.76 : 1,
      })}
    >
      <View
        className="mr-3 h-11 w-11 items-center justify-center rounded-full"
        style={{
          backgroundColor: destructive ? "#FFF2F6" : "#F3F5F8",
        }}
      >
        <SymbolView name={icon} size={19} tintColor={accentColor} />
      </View>
      <Text
        className="flex-1 text-[15px] font-bold"
        style={{ color: accentColor, lineHeight: lineHeightFor(15) }}
      >
        {label}
      </Text>
    </Pressable>
  );
}

function GroupOverflowSheet({
  actions,
  bottomInset,
  onClose,
  visible,
}: {
  actions: {
    destructive?: boolean;
    disabled?: boolean;
    icon: SymbolName;
    key: string;
    label: string;
    onPress: () => void;
  }[];
  bottomInset: number;
  onClose: () => void;
  visible: boolean;
}) {
  const { t } = useTranslation();

  return (
    <Modal
      animationType="fade"
      onRequestClose={onClose}
      statusBarTranslucent
      transparent
      visible={visible}
    >
      <View
        style={{
          backgroundColor: "rgba(27, 21, 34, 0.28)",
          flex: 1,
          justifyContent: "flex-end",
        }}
      >
        <Pressable
          accessibilityLabel={t("community.groupDetail.closeMenuA11y")}
          onPress={onClose}
          style={{
            bottom: 0,
            left: 0,
            position: "absolute",
            right: 0,
            top: 0,
          }}
        />

        <View
          className="rounded-t-[30px] bg-white px-4 pb-3 pt-2"
          style={{
            paddingBottom: Math.max(bottomInset, 14),
            shadowColor: "#120E19",
            shadowOffset: { width: 0, height: -10 },
            shadowOpacity: 0.12,
            shadowRadius: 18,
          }}
        >
          <View className="items-center pb-1.5">
            <View
              className="h-1.5 w-14 rounded-full"
              style={{ backgroundColor: "#D7DCE4" }}
            />
          </View>

          <View className="pt-1">
            {actions.map((action) => (
              <GroupOverflowActionRow
                key={action.key}
                destructive={action.destructive}
                disabled={action.disabled}
                icon={action.icon}
                label={action.label}
                onPress={action.onPress}
              />
            ))}
          </View>
        </View>
      </View>
    </Modal>
  );
}

export default function CommunityGroupDetailScreen() {
  const authSession = useAuthSession();
  const router = useRouter();
  const { t } = useTranslation();
  const insets = useSafeAreaInsets();
  const { shareToken } = useLocalSearchParams<{ shareToken?: string }>();
  const resolvedRouteValue =
    typeof shareToken === "string"
      ? normalizeRouteValue(decodeURIComponent(shareToken))
      : null;
  const cachedGroupSession = getCachedCommunityGroupSession(resolvedRouteValue);
  const resolvedGroupId = isNumericIdentifier(resolvedRouteValue)
    ? resolvedRouteValue
    : normalizeRouteValue(cachedGroupSession?.groupId);
  const [copiedInviteLink, setCopiedInviteLink] = useState(false);
  const [creatorDisplayName, setCreatorDisplayName] = useState<string | null>(
    null,
  );
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [groupDetail, setGroupDetail] = useState<CommunityGroupPayload | null>(
    null,
  );
  const [isGroupMenuVisible, setIsGroupMenuVisible] = useState(false);
  const [isLeader, setIsLeader] = useState(false);
  const [isLeavePending, setIsLeavePending] = useState(false);
  const [isRefreshPending, setIsRefreshPending] = useState(false);
  const [retryNonce, setRetryNonce] = useState(0);
  const [status, setStatus] = useState<GroupDetailStatus>(
    resolvedRouteValue ? "loading" : "idle",
  );

  useFocusEffect(
    useCallback(() => {
      let isActive = true;
      const retrySeed = retryNonce;

      async function loadGroupDetail() {
        if (!resolvedRouteValue) {
          setErrorMessage(t("community.groupDetail.missingRouteError"));
          setStatus("error");
          return;
        }

        if (!resolvedGroupId) {
          setErrorMessage(t("community.groupDetail.missingGroupIdError"));
          setStatus("error");
          return;
        }

        setStatus("loading");
        setErrorMessage(null);
        setCopiedInviteLink(false);
        setCreatorDisplayName(null);
        setIsLeader(false);

        try {
          const accessToken = authSession.isAuthenticated
            ? await getValidAccessToken()
            : null;
          const nextGroupDetail = await getCommunityGroupById({
            accessToken: accessToken ?? undefined,
            groupId: resolvedGroupId,
            tokenType: authSession.tokenType ?? undefined,
          });

          let resolvedCreatorName: string | null = null;
          let resolvedIsLeader = false;

          if (nextGroupDetail.createdBy) {
            try {
              const creatorProfile = await getUserProfileById({
                accessToken,
                tokenType: authSession.tokenType ?? undefined,
                userId: nextGroupDetail.createdBy,
              });
              resolvedCreatorName =
                readMeaningfulText(creatorProfile.name) ??
                readMeaningfulText(creatorProfile.username);
            } catch (creatorError) {
              console.warn("[community] load group creator failed", {
                createdBy: nextGroupDetail.createdBy,
                error:
                  creatorError instanceof Error
                    ? creatorError.message
                    : creatorError,
              });
            }
          }

          if (accessToken) {
            try {
              const currentProfile = await getMyProfile({
                accessToken,
                tokenType: authSession.tokenType ?? undefined,
              });
              const currentUserId = readMeaningfulText(currentProfile.id);

              resolvedIsLeader =
                Boolean(currentUserId) &&
                readMeaningfulText(nextGroupDetail.createdBy) === currentUserId;

              if (
                !resolvedIsLeader &&
                currentUserId &&
                nextGroupDetail.groupId
              ) {
                const groupMembers = await getCommunityGroupMembers({
                  accessToken,
                  groupId: nextGroupDetail.groupId,
                  tokenType: authSession.tokenType ?? undefined,
                });
                const currentMember = groupMembers.find(
                  (member) =>
                    readMeaningfulText(member.userId) === currentUserId,
                );

                resolvedIsLeader =
                  readMeaningfulText(currentMember?.role)?.toUpperCase() ===
                  "LEADER";
              }
            } catch (leaderError) {
              console.warn("[community] load group leader permission failed", {
                error:
                  leaderError instanceof Error
                    ? leaderError.message
                    : leaderError,
                groupId: nextGroupDetail.groupId,
              });
            }
          }

          if (!isActive) {
            return;
          }

          const cachedGroup = cacheCommunityGroupSession({
            ...nextGroupDetail,
            source: cachedGroupSession?.source ?? "listed",
          });

          setGroupDetail(cachedGroup ?? nextGroupDetail);
          setCreatorDisplayName(resolvedCreatorName);
          setIsLeader(resolvedIsLeader);
          setStatus("ready");
        } catch (error) {
          if (!isActive) {
            return;
          }

          setErrorMessage(
            error instanceof Error
              ? error.message
              : t("community.groupDetail.loadError"),
          );
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
  const cachedJourneySession =
    getCachedCommunityGroupJourneySession(resolvedRouteValue) ??
    getCachedCommunityGroupJourneySession(resolvedGroupId);
  const inviteWebUrl = !displayGroup?.shareToken
    ? null
    : (cachedGroupSession?.inviteWebUrl ??
      buildCommunityInviteWebUrl(displayGroup.shareToken));
  const effectiveGroupId =
    readMeaningfulText(displayGroup?.groupId) ?? resolvedGroupId;
  const heroImageSource = readMeaningfulText(displayGroup?.imageUrl)
    ? { uri: displayGroup?.imageUrl as string }
    : HERO_IMAGE;
  const closeGroupMenu = () => {
    setIsGroupMenuVisible(false);
  };
  const handleBack = useCallback(() => {
    if (router.canGoBack()) {
      router.back();
      return;
    }

    router.replace("/home" as Href);
  }, [router]);
  const runAfterClosingGroupMenu = (action: () => void) => {
    closeGroupMenu();
    requestAnimationFrame(action);
  };

  useFocusEffect(
    useCallback(() => {
      const subscription = BackHandler.addEventListener(
        "hardwareBackPress",
        () => {
          handleBack();
          return true;
        },
      );

      return () => {
        subscription.remove();
      };
    }, [handleBack]),
  );

  const handleCopyInviteLink = async () => {
    if (!inviteWebUrl) {
      return;
    }

    await Clipboard.setStringAsync(inviteWebUrl);
    setCopiedInviteLink(true);
  };

  const handleOpenGroupMembers = () => {
    const nextShareToken = displayGroup?.shareToken ?? resolvedRouteValue;

    if (!nextShareToken || !effectiveGroupId) {
      appToast.error(t("community.groupDetail.missingGroupForMembers"));
      return;
    }

    router.push(
      `/community/group/${encodeURIComponent(nextShareToken)}/members?groupId=${encodeURIComponent(effectiveGroupId)}` as Href,
    );
  };

  const handleOpenGroupManage = () => {
    const nextShareToken = displayGroup?.shareToken ?? resolvedRouteValue;

    if (!nextShareToken) {
      return;
    }

    router.push(
      `/community/group/${encodeURIComponent(nextShareToken)}/manage` as Href,
    );
  };

  const handleOpenGroupJourney = () => {
    const nextShareToken = displayGroup?.shareToken ?? resolvedRouteValue;

    if (!nextShareToken) {
      appToast.error("Không xác định được nhóm để mở hành trình.");
      return;
    }

    const routeName = readMeaningfulText(cachedJourneySession?.routeName);
    const routeId = readMeaningfulText(cachedJourneySession?.routeId);
    const query = routeId
      ? `?routeId=${encodeURIComponent(routeId)}&routeName=${encodeURIComponent(routeName ?? "Hành trình nhóm")}`
      : routeName
        ? `?routeName=${encodeURIComponent(routeName)}`
        : "";

    router.push(
      `/community/group/${encodeURIComponent(nextShareToken)}/journey${query}` as Href,
    );
  };

  const handleLeaveGroup = async () => {
    if (isLeavePending) {
      return;
    }

    if (!effectiveGroupId) {
      appToast.error(t("community.groupDetail.missingGroupIdForLeave"));
      return;
    }

    if (!authSession.isAuthenticated) {
      appToast.error(t("community.groupDetail.loginRequiredLeave"));
      return;
    }

    const accessToken = await getValidAccessToken();

    if (!accessToken) {
      appToast.error(t("community.joinGroup.sessionExpiredError"));
      return;
    }

    setIsLeavePending(true);

    try {
      const leftGroup = await leaveCommunityGroup({
        accessToken,
        groupId: effectiveGroupId,
        tokenType: authSession.tokenType ?? undefined,
      });

      removeCachedCommunityGroupSession(displayGroup?.shareToken);
      removeCachedCommunityGroupSession(leftGroup.shareToken);
      removeCachedCommunityGroupJourneySession(displayGroup?.shareToken);
      removeCachedCommunityGroupJourneySession(leftGroup.shareToken);
      removeCachedCommunityGroupJourneySession(effectiveGroupId);
      setIsGroupMenuVisible(false);
      appToast.success(t("community.groupDetail.leaveSuccess"));
      router.replace("/bookings" as Href);
    } catch (error) {
      appToast.error(
        error instanceof Error
          ? error.message
          : t("community.groupDetail.leaveError"),
      );
    } finally {
      setIsLeavePending(false);
    }
  };

  const handleConfirmLeaveGroup = () => {
    appAlert.alert(
      t("community.groupDetail.leaveConfirmTitle"),
      t("community.groupDetail.leaveConfirmDescription"),
      [
        {
          style: "cancel",
          text: t("community.groupDetail.stayAction"),
        },
        {
          onPress: () => {
            void handleLeaveGroup();
          },
          style: "destructive",
          text: t("community.groupDetail.leaveConfirmTitle"),
        },
      ],
    );
  };

  const handleRefreshInviteLink = async () => {
    if (!effectiveGroupId) {
      appToast.error(t("community.groupDetail.missingGroupIdForRefresh"));
      return;
    }

    if (!isLeader) {
      appToast.info(t("community.groupDetail.leaderOnlyRefresh"));
      return;
    }

    const accessToken = authSession.isAuthenticated
      ? await getValidAccessToken()
      : null;

    if (!accessToken) {
      appToast.error(t("community.groupDetail.loginRequiredRefresh"));
      return;
    }

    setIsRefreshPending(true);

    try {
      const refreshedGroup = await refreshCommunityGroupToken({
        accessToken,
        groupId: effectiveGroupId,
        tokenType: authSession.tokenType ?? undefined,
      });
      const cachedRefreshedGroup = cacheCommunityGroupSession({
        ...refreshedGroup,
        source: cachedGroupSession?.source ?? "listed",
      });

      setGroupDetail(cachedRefreshedGroup ?? refreshedGroup);
      setCopiedInviteLink(false);
      appToast.success(t("community.groupDetail.refreshSuccess"));

      if (refreshedGroup.shareToken !== resolvedRouteValue) {
        router.replace(
          `/community/group/${encodeURIComponent(refreshedGroup.shareToken)}` as Href,
        );
      }
    } catch (error) {
      appToast.error(
        error instanceof Error
          ? error.message
          : t("community.groupDetail.refreshError"),
      );
    } finally {
      setIsRefreshPending(false);
    }
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

  if (status === "loading" && !groupDetail) {
    return <AppLoadingScreen edges={["left", "right"]} />;
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
              t("community.groupDetail.loadErrorFallbackDescription")
            }
            icon="error"
            onPress={() => {
              setRetryNonce((currentValue) => currentValue + 1);
            }}
            title={t("community.groupDetail.loadErrorTitle")}
            variant="error"
          />
        </View>
      </SafeAreaView>
    );
  }

  const creatorLabel = creatorDisplayName
    ? creatorDisplayName
    : displayGroup.createdBy
      ? t("community.groupDetail.creatorFallback", {
          id: displayGroup.createdBy,
        })
      : t("community.groupDetail.notUpdated");
  const totalMembersLabel =
    typeof displayGroup.totalMembers === "number"
      ? t("community.groupsScreen.memberCountLabel", {
          count: displayGroup.totalMembers,
        })
      : t("community.groupDetail.noDataYet");
  const roleLabel = isLeader
    ? t("community.groupMembers.roleLeader")
    : t("community.groupMembers.roleMember");
  const requiredApprovalLabel =
    displayGroup.requiredApproval === null
      ? t("community.groupDetail.notUpdated")
      : displayGroup.requiredApproval
        ? t("community.groupsScreen.access.approvalRequired")
        : t("community.groupsScreen.access.openJoin");
  const groupMenuActions = [
    {
      icon: "groups" as SymbolName,
      key: "view-members",
      label: t("community.groupDetail.viewMembersAction"),
      onPress: () => {
        runAfterClosingGroupMenu(handleOpenGroupMembers);
      },
    },
    {
      destructive: true,
      disabled: isLeavePending,
      icon: {
        android: "logout",
        ios: "rectangle.portrait.and.arrow.right",
        web: "logout",
      } as SymbolName,
      key: "leave-group",
      label: isLeavePending
        ? t("community.groupDetail.leavingAction")
        : t("community.groupDetail.leaveConfirmTitle"),
      onPress: () => {
        runAfterClosingGroupMenu(handleConfirmLeaveGroup);
      },
    },
  ];

  return (
    <SafeAreaView
      className="flex-1"
      edges={["left", "right"]}
      style={{ backgroundColor: palette.background }}
    >
      <StatusBar style="dark" />

      <ScrollView
        contentContainerStyle={{
          paddingBottom: Math.max(insets.bottom + 24, 32),
        }}
        showsVerticalScrollIndicator={false}
      >
        <View>
          <ImageBackground
            source={heroImageSource}
            style={{ height: 230 + insets.top }}
          >
            <LinearGradient
              colors={["rgba(255,250,252,0.18)", "rgba(252,246,248,0.96)"]}
              locations={[0, 1]}
              style={{
                flex: 1,
                justifyContent: "space-between",
                paddingBottom: 42,
              }}
            >
              <View
                className="flex-row items-center justify-between px-4"
                style={{ paddingTop: insets.top + 12 }}
              >
                <Pressable
                  className="h-9 w-9 items-center justify-center rounded-full bg-white/92"
                  hitSlop={8}
                  onPress={handleBack}
                >
                  <SymbolView
                    name={{
                      ios: "chevron.left",
                      android: "arrow-back",
                      web: "arrow-back",
                    }}
                    size={17}
                    tintColor={palette.primaryText}
                  />
                </Pressable>

                <Pressable
                  className="h-9 w-9 items-center justify-center rounded-full bg-white/92"
                  hitSlop={8}
                  onPress={() => {
                    if (isLeader) {
                      handleOpenGroupManage();
                      return;
                    }

                    setIsGroupMenuVisible(true);
                  }}
                >
                  <SymbolView
                    name={{
                      ios: "ellipsis",
                      android: "more-horiz",
                      web: "more-horiz",
                    }}
                    size={17}
                    tintColor={palette.primaryText}
                  />
                </Pressable>
              </View>
            </LinearGradient>
          </ImageBackground>
        </View>

        <View className="-mt-14 px-4">
          <View
            className="rounded-[24px] border px-4 py-2.5"
            style={{
              backgroundColor: palette.surface,
              borderColor: palette.border,
            }}
          >
            <View className="flex-row items-center">
              <View
                className="mr-3 h-14 w-14 items-center justify-center rounded-[18px]"
                style={{ backgroundColor: "#FFF3F7" }}
              >
                <SymbolView
                  name={{
                    ios: "person.3.fill",
                    android: "groups",
                    web: "groups",
                  }}
                  size={26}
                  tintColor={palette.accentStrong}
                />
              </View>

              <View className="min-w-0 flex-1">
                <Text
                  className="text-[21px] font-semibold"
                  numberOfLines={2}
                  style={{
                    color: palette.primaryText,
                    lineHeight: lineHeightFor(21),
                  }}
                >
                  {displayGroup.groupName ??
                    t("community.groupDetail.defaultGroupName")}
                </Text>

                <View className="mt-1.5 flex-row items-center">
                  <SymbolView
                    name={{
                      ios: "person.2.fill",
                      android: "groups",
                      web: "groups",
                    }}
                    size={15}
                    tintColor={palette.mutedText}
                  />
                  <Text
                    className="ml-1.5 text-[15px]"
                    style={{
                      color: palette.mutedText,
                      lineHeight: bodyLineHeightFor(15),
                    }}
                  >
                    {totalMembersLabel}
                  </Text>
                </View>
              </View>
            </View>
          </View>

          {status === "error" && errorMessage ? (
            <View
              className="mt-3.5 rounded-[18px] border px-4 py-3"
              style={{
                backgroundColor: palette.softOrange,
                borderColor: "#F8D8C8",
              }}
            >
              <Text
                className="text-[13px]"
                style={{
                  color: palette.warmText,
                  lineHeight: bodyLineHeightFor(13),
                }}
              >
                {errorMessage}
              </Text>
            </View>
          ) : null}

          <View className="mt-3.5">
            <GroupSection title={t("community.groupDetail.infoSectionTitle")}>
              <GroupInfoRow
                icon="person"
                label={t("community.groupDetail.creatorLabel")}
                value={creatorLabel}
              />
              <GroupInfoRow
                icon="groups"
                label={t("community.groupDetail.totalMembersLabel")}
                value={
                  displayGroup.totalMembers !== null
                    ? `${displayGroup.totalMembers}`
                    : t("community.groupDetail.notUpdated")
                }
              />
              <GroupInfoRow icon="badge" label="Vai trò" value={roleLabel} />
              <GroupInfoRow
                icon="shield"
                label={t("community.groupDetail.requiredApprovalLabel")}
                tone={
                  displayGroup.requiredApproval === false
                    ? "success"
                    : undefined
                }
                value={requiredApprovalLabel}
              />
              <GroupInfoRow
                hideDivider
                icon="event"
                label={t("community.groupDetail.createdAtLabel")}
                value={formatGroupDate(displayGroup.createdAt, t)}
              />
            </GroupSection>
          </View>

          <View className="mt-3.5">
            <GroupJourneySection
              hasActiveJourney={Boolean(cachedJourneySession)}
              onPress={handleOpenGroupJourney}
              routeName={readMeaningfulText(cachedJourneySession?.routeName)}
              startedAtLabel={formatJourneyStartedLabel(
                cachedJourneySession?.startedAt,
              )}
            />
          </View>

          {inviteWebUrl ? (
            <View className="mt-3.5">
              <GroupInviteSection
                copied={copiedInviteLink}
                isRefreshing={isRefreshPending}
                link={inviteWebUrl}
                onCopy={() => {
                  void handleCopyInviteLink();
                }}
                onRefresh={
                  isLeader
                    ? () => {
                        void handleRefreshInviteLink();
                      }
                    : undefined
                }
              />
            </View>
          ) : null}

          <Text
            className="mt-4 text-center text-[12px]"
            style={{
              color: palette.mutedText,
              lineHeight: bodyLineHeightFor(12),
            }}
          >
            {t("community.groupDetail.footerNote")}
          </Text>
        </View>
      </ScrollView>

      {!isLeader ? (
        <GroupOverflowSheet
          actions={groupMenuActions}
          bottomInset={insets.bottom}
          onClose={closeGroupMenu}
          visible={isGroupMenuVisible}
        />
      ) : null}
    </SafeAreaView>
  );
}
