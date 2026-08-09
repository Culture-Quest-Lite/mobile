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
import {
  ActivityIndicator,
  Alert,
  BackHandler,
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
  cacheCommunityGroupSession,
  getCachedCommunityGroupSession,
  removeCachedCommunityGroupSession,
} from "../data/community-group-session-store";
import { buildCommunityInviteWebUrl } from "../lib/community-group-invite-links";

const HERO_IMAGE = require("../../../../assets/images/hero.jpg");
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

function parseGroupDateValue(value: string) {
  const normalized = value.replace(" ", "T");
  const hasTimezone = /(?:Z|[+-]\d{2}:?\d{2})$/i.test(normalized);

  // Backend tra ve timestamp UTC nhung khong kem timezone, neu parse truc
  // tiep se bi hieu nham la gio local va lech theo UTC offset cua may.
  return new Date(hasTimezone ? normalized : `${normalized}Z`);
}

function formatGroupDate(value?: string | null) {
  const normalizedDateValue = normalizeDateValue(value);

  if (!normalizedDateValue) {
    return "Chưa cập nhật";
  }

  const date = parseGroupDateValue(normalizedDateValue);

  if (Number.isNaN(date.getTime())) {
    return normalizedDateValue.replace("T", " ");
  }

  return `${padDatePart(date.getDate())}/${padDatePart(
    date.getMonth() + 1,
  )}/${date.getFullYear()} ${padDatePart(date.getHours())}:${padDatePart(
    date.getMinutes(),
  )}:${padDatePart(date.getSeconds())}`;
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
        className="text-[14px] font-extrabold"
        style={{ color: palette.primaryText, lineHeight: lineHeightFor(14) }}
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
          className="text-[12px]"
          style={{
            color: palette.mutedText,
            lineHeight: bodyLineHeightFor(12),
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
            className="text-right text-[12.5px] font-semibold"
            style={{ color: badgeTone.text, lineHeight: lineHeightFor(12.5) }}
          >
            {value}
          </Text>
        </View>
      ) : (
        <Text
          className="ml-3 text-right text-[12.5px] font-semibold"
          style={{
            color: palette.primaryText,
            lineHeight: lineHeightFor(12.5),
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
          Mời thành viên tham gia
        </Text>
        {onRefresh ? (
          <Pressable
            accessibilityLabel="Làm mới liên kết tham gia"
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
                className="text-[12px] font-extrabold"
                style={{
                  color: palette.accentStrong,
                  lineHeight: bodyLineHeightFor(12),
                }}
              >
                Làm mới liên kết
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
            className="text-[12px]"
            selectable
            style={{ color: "#4B5563", lineHeight: bodyLineHeightFor(12) }}
          >
            {link}
          </Text>
        </View>
      </View>

      <Pressable
        accessibilityLabel="Sao chép liên kết tham gia"
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
          className="ml-1.5 text-[13px] font-extrabold"
          style={{
            color: palette.accentStrong,
            lineHeight: bodyLineHeightFor(13),
          }}
        >
          {copied ? "Đã sao chép liên kết" : "Sao chép liên kết"}
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
          accessibilityLabel="Đóng menu nhóm"
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
          setErrorMessage(
            "Không đọc được thông tin nhóm từ đường dẫn hiện tại.",
          );
          setStatus("error");
          return;
        }

        if (!resolvedGroupId) {
          setErrorMessage("Không xác định được ID nhóm để tải chi tiết.");
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
              : "Không tải được chi tiết nhóm cộng đồng.",
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
    ]),
  );

  const displayGroup = groupDetail ?? cachedGroupSession;
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
      appToast.error("Không xác định được nhóm để mở danh sách thành viên.");
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

  const handleLeaveGroup = async () => {
    if (isLeavePending) {
      return;
    }

    if (!effectiveGroupId) {
      appToast.error("Không xác định được ID nhóm để rời nhóm.");
      return;
    }

    if (!authSession.isAuthenticated) {
      appToast.error("Bạn cần đăng nhập để rời nhóm.");
      return;
    }

    const accessToken = await getValidAccessToken();

    if (!accessToken) {
      appToast.error("Phiên đăng nhập đã hết hạn. Vui lòng đăng nhập lại.");
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
      setIsGroupMenuVisible(false);
      appToast.success("Đã rời nhóm.");
      router.replace("/bookings" as Href);
    } catch (error) {
      appToast.error(
        error instanceof Error ? error.message : "Không thể rời nhóm lúc này.",
      );
    } finally {
      setIsLeavePending(false);
    }
  };

  const handleConfirmLeaveGroup = () => {
    Alert.alert("Rời nhóm", "Bạn có chắc muốn rời khỏi nhóm này không?", [
      {
        style: "cancel",
        text: "Ở lại",
      },
      {
        onPress: () => {
          void handleLeaveGroup();
        },
        style: "destructive",
        text: "Rời nhóm",
      },
    ]);
  };

  const handleRefreshInviteLink = async () => {
    if (!effectiveGroupId) {
      appToast.error("Không xác định được ID nhóm để làm mới link mời.");
      return;
    }

    if (!isLeader) {
      appToast.info("Chỉ leader mới có thể làm mới link mời.");
      return;
    }

    const accessToken = authSession.isAuthenticated
      ? await getValidAccessToken()
      : null;

    if (!accessToken) {
      appToast.error("Bạn cần đăng nhập để làm mới link mời.");
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
      appToast.success("Đã làm mới link mời.");

      if (refreshedGroup.shareToken !== resolvedRouteValue) {
        router.replace(
          `/community/group/${encodeURIComponent(refreshedGroup.shareToken)}` as Href,
        );
      }
    } catch (error) {
      appToast.error(
        error instanceof Error
          ? error.message
          : "Không thể làm mới link mời lúc này.",
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
            description="Không đọc được tham số nhóm từ đường dẫn hiện tại."
            icon="link_off"
            title="Link nhóm không hợp lệ"
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
            actionLabel="Thử lại"
            description={
              errorMessage ??
              "Không có dữ liệu chi tiết để hiển thị cho nhóm này."
            }
            icon="error"
            onPress={() => {
              setRetryNonce((currentValue) => currentValue + 1);
            }}
            title="Không tải được nhóm"
            variant="error"
          />
        </View>
      </SafeAreaView>
    );
  }

  const creatorLabel = creatorDisplayName
    ? creatorDisplayName
    : displayGroup.createdBy
      ? `Explorer #${displayGroup.createdBy}`
      : "Chưa cập nhật";
  const totalMembersLabel =
    typeof displayGroup.totalMembers === "number"
      ? `${displayGroup.totalMembers} thành viên`
      : "Chưa có dữ liệu";
  const requiredApprovalLabel =
    displayGroup.requiredApproval === null
      ? "Chưa cập nhật"
      : displayGroup.requiredApproval
        ? "Cần duyệt để tham gia"
        : "Tham gia tự do";
  const groupMenuActions = [
    {
      icon: "groups" as SymbolName,
      key: "view-members",
      label: "Xem thành viên nhóm",
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
      label: isLeavePending ? "Đang rời nhóm..." : "Rời nhóm",
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
            <View className="flex-row items-center gap-2">
              <Text
                className="flex-1 text-[17px] font-extrabold"
                numberOfLines={2}
                style={{
                  color: palette.primaryText,
                  lineHeight: lineHeightFor(17),
                }}
              >
                {displayGroup.groupName ?? "Nhóm cộng đồng"}
              </Text>
            </View>

            <View className="mt-1.5 flex-row items-center">
              <SymbolView
                name={{
                  ios: "person.2.fill",
                  android: "groups",
                  web: "groups",
                }}
                size={14}
                tintColor={palette.mutedText}
              />
              <Text
                className="ml-1.5 text-[13px]"
                style={{
                  color: palette.mutedText,
                  lineHeight: bodyLineHeightFor(13),
                }}
              >
                {totalMembersLabel}
              </Text>
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
                className="text-[12px]"
                style={{
                  color: palette.warmText,
                  lineHeight: bodyLineHeightFor(12),
                }}
              >
                {errorMessage}
              </Text>
            </View>
          ) : null}

          <View className="mt-3.5">
            <GroupSection title="Thông tin nhóm">
              <GroupInfoRow
                icon="person"
                label="Người tạo"
                value={creatorLabel}
              />
              <GroupInfoRow
                icon="groups"
                label="Tổng số thành viên"
                value={
                  displayGroup.totalMembers !== null
                    ? `${displayGroup.totalMembers}`
                    : "Chưa cập nhật"
                }
              />
              <GroupInfoRow
                icon="badge"
                label="Vai trò của bạn"
                value={isLeader ? "Nhóm trưởng" : "Thành viên"}
              />
              <GroupInfoRow
                icon="shield"
                label="Yêu cầu duyệt tham gia"
                tone={
                  requiredApprovalLabel === "Tham gia tự do"
                    ? "success"
                    : requiredApprovalLabel === "Cần duyệt để tham gia"
                      ? "pending"
                      : undefined
                }
                value={requiredApprovalLabel}
              />
              <GroupInfoRow
                hideDivider
                icon="event"
                label="Ngày tạo"
                value={formatGroupDate(displayGroup.createdAt)}
              />
            </GroupSection>
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
