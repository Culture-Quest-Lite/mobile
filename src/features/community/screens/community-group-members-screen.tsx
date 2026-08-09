import * as Clipboard from "expo-clipboard";
import { LinearGradient } from "expo-linear-gradient";
import {
  useFocusEffect,
  useLocalSearchParams,
  useRouter,
  type Href,
} from "expo-router";
import { StatusBar } from "expo-status-bar";
import { useCallback, useState } from "react";
import {
  ActivityIndicator,
  Image,
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
import { SymbolView } from "@/components/ui/symbol-view";
import { UserAvatar } from "@/components/ui/user-avatar";
import {
  getValidAccessToken,
  useAuthSession,
} from "@/features/auth/hooks/use-auth-session";
import { getMyProfile } from "@/features/profile/api/get-me";
import { getUserProfileById } from "@/features/profile/api/get-user-by-id";
import {
  getCommunityGroupMembers,
  kickCommunityGroupMember,
  type CommunityGroupMemberPayload,
  updateCommunityGroupParticipant,
} from "../api/group-api";
import { CommunityGroupStateCard } from "../components/community-group-ui";
import { getCachedCommunityGroupSession } from "../data/community-group-session-store";
import { buildCommunityInviteWebUrl } from "../lib/community-group-invite-links";
import { bodyLineHeightFor, lineHeightFor } from "@/lib/text-scale";

const detailTextMaxFontSizeMultiplier = 1.05;
const communityGroupsHeroImage = require("../../../../assets/images/tachnengroup.png");

const palette = {
  accent: "#EB489B",
  accentSoft: "#FFE8F0",
  background: "#F6F7FB",
  border: "#E8ECF2",
  mutedText: "#8E869A",
  primaryText: "#2B2233",
  subtleText: "#676071",
  surface: "#FFFFFF",
  warningBg: "#FFF4EF",
  warningText: "#D97A55",
};

type GroupMembersStatus = "error" | "idle" | "loading" | "ready";

type MemberProfileSummary = {
  avatarUri: string | null;
  displayName: string;
  userId: string;
};

type PendingParticipantAction = {
  action: "DENIED" | "JOIN";
  participantId: string;
};

type KickConfirmTarget = {
  displayName: string;
  userId: string;
};

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
  const trimmedValue = readMeaningfulText(value);

  if (!trimmedValue) {
    return null;
  }

  return trimmedValue.replace(/(\.\d{3})\d+$/, "$1");
}

function padDatePart(value: number) {
  return `${value}`.padStart(2, "0");
}

function formatGroupCreatedDate(value?: string | null) {
  const normalizedDateValue = normalizeDateValue(value);

  if (!normalizedDateValue) {
    return "Chưa cập nhật";
  }

  const date = new Date(normalizedDateValue);

  if (Number.isNaN(date.getTime())) {
    return normalizedDateValue.slice(0, 10).replace(/-/g, "/");
  }

  return `${padDatePart(date.getDate())}/${padDatePart(date.getMonth() + 1)}/${date.getFullYear()}`;
}

function formatRequestElapsedTime(value?: string | null) {
  const normalizedDateValue = normalizeDateValue(value);

  if (!normalizedDateValue) {
    return "Vừa gửi yêu cầu";
  }

  const date = new Date(normalizedDateValue);
  const timestamp = date.getTime();

  if (Number.isNaN(timestamp)) {
    return "Vừa gửi yêu cầu";
  }

  const elapsedMilliseconds = Math.max(0, Date.now() - timestamp);

  if (elapsedMilliseconds < 60 * 1000) {
    return "Vừa gửi yêu cầu";
  }

  const elapsedMinutes = Math.floor(elapsedMilliseconds / (60 * 1000));

  if (elapsedMinutes < 60) {
    return `${elapsedMinutes} phút trước`;
  }

  const elapsedHours = Math.floor(elapsedMinutes / 60);

  if (elapsedHours < 24) {
    return `${elapsedHours} giờ trước`;
  }

  const elapsedDays = Math.floor(elapsedHours / 24);

  if (elapsedDays < 7) {
    return `${elapsedDays} ngày trước`;
  }

  return formatGroupCreatedDate(normalizedDateValue);
}

function getRoleLabel(role?: string | null) {
  switch ((role ?? "").trim().toUpperCase()) {
    case "LEADER":
      return "Trưởng nhóm";
    case "MEMBER":
      return "Thành viên";
    default:
      return "Explorer";
  }
}

function ProfileAvatar({
  avatarUri,
  displayName,
}: {
  avatarUri: string | null;
  displayName: string;
}) {
  return <UserAvatar displayName={displayName} size={46} uri={avatarUri} />;
}

function MemberRow({
  actionPending = false,
  avatarUri,
  displayName,
  hideDivider = false,
  onActionPress,
  onPress,
  roleLabel,
}: {
  actionPending?: boolean;
  avatarUri: string | null;
  displayName: string;
  hideDivider?: boolean;
  onActionPress?: (() => void) | undefined;
  onPress: () => void;
  roleLabel: string;
}) {
  return (
    <View
      className="flex-row items-center gap-2.5 py-2.5"
      style={{
        borderBottomColor: palette.border,
        borderBottomWidth: hideDivider ? 0 : 1,
      }}
    >
      <Pressable
        className="flex-1 flex-row items-center gap-2.5"
        onPress={onPress}
        style={({ pressed }) => ({
          opacity: pressed ? 0.82 : 1,
        })}
      >
        <ProfileAvatar avatarUri={avatarUri} displayName={displayName} />

        <View className="min-w-0 flex-1">
          <Text
            className="text-[15px]"
            numberOfLines={1}
            style={{ color: palette.primaryText, lineHeight: lineHeightFor(15) }}
          >
            {displayName}
          </Text>
          <Text
            className="mt-[2px] text-[12px]"
            style={{ color: palette.subtleText, lineHeight: lineHeightFor(12) }}
          >
            {roleLabel}
          </Text>
        </View>

        {!onActionPress ? (
          <SymbolView
            name={{
              ios: "chevron.right",
              android: "chevron-right",
              web: "chevron-right",
            }}
            size={16}
            tintColor={palette.mutedText}
          />
        ) : null}
      </Pressable>

      {onActionPress ? (
        <Pressable
          accessibilityLabel={`Tùy chọn cho ${displayName}`}
          className="ml-2 h-9 w-9 items-center justify-center rounded-full"
          disabled={actionPending}
          hitSlop={8}
          onPress={onActionPress}
          style={({ pressed }) => ({
            backgroundColor: "#F4F5F7",
            opacity: actionPending ? 0.6 : pressed ? 0.82 : 1,
          })}
        >
          {actionPending ? (
            <ActivityIndicator color={palette.mutedText} size="small" />
          ) : (
            <SymbolView
              name={{
                ios: "ellipsis",
                android: "more-horiz",
                web: "more-horiz",
              }}
              size={18}
              tintColor={palette.primaryText}
            />
          )}
        </Pressable>
      ) : null}
    </View>
  );
}

function PendingRequestActionButton({
  action,
  disabled = false,
  isPending = false,
  onPress,
}: {
  action: "DENIED" | "JOIN";
  disabled?: boolean;
  isPending?: boolean;
  onPress?: (() => void) | undefined;
}) {
  const isApproveAction = action === "JOIN";
  const iconColor = isApproveAction ? "#22C55E" : "#FF5A72";
  const backgroundColor = isApproveAction ? "#ECFDF3" : "#FFF2F4";

  return (
    <Pressable
      className="h-11 w-11 items-center justify-center rounded-full"
      disabled={disabled || !onPress}
      hitSlop={8}
      onPress={onPress}
      style={({ pressed }) => ({
        backgroundColor,
        opacity: disabled || !onPress ? 0.55 : pressed ? 0.84 : 1,
      })}
    >
      {isPending ? (
        <ActivityIndicator color={iconColor} size="small" />
      ) : (
        <SymbolView
          name={
            isApproveAction
              ? {
                  ios: "checkmark",
                  android: "check",
                  web: "check",
                }
              : {
                  ios: "xmark",
                  android: "close",
                  web: "close",
                }
          }
          size={18}
          tintColor={iconColor}
        />
      )}
    </Pressable>
  );
}

function PendingRequestRow({
  approvePending = false,
  avatarUri,
  denyPending = false,
  displayName,
  hideDivider = false,
  onApprovePress,
  onPress,
  onRejectPress,
  submittedAtLabel,
}: {
  approvePending?: boolean;
  avatarUri: string | null;
  denyPending?: boolean;
  displayName: string;
  hideDivider?: boolean;
  onApprovePress?: (() => void) | undefined;
  onPress: () => void;
  onRejectPress?: (() => void) | undefined;
  submittedAtLabel: string;
}) {
  const isActionPending = approvePending || denyPending;

  return (
    <View
      className="flex-row items-center gap-2.5 py-2.5"
      style={{
        borderBottomColor: palette.border,
        borderBottomWidth: hideDivider ? 0 : 1,
      }}
    >
      <Pressable
        className="flex-1 flex-row items-center gap-2.5"
        onPress={onPress}
        style={({ pressed }) => ({
          opacity: pressed ? 0.82 : 1,
        })}
      >
        <ProfileAvatar avatarUri={avatarUri} displayName={displayName} />

        <View className="min-w-0 flex-1">
          <Text
            className="text-[15px]"
            numberOfLines={1}
            style={{ color: palette.primaryText, lineHeight: lineHeightFor(15) }}
          >
            {displayName}
          </Text>
          <Text
            className="mt-[2px] text-[12px]"
            style={{ color: palette.subtleText, lineHeight: lineHeightFor(12) }}
          >
            {submittedAtLabel}
          </Text>
        </View>
      </Pressable>

      <View className="ml-2 flex-row items-center gap-2.5">
        <PendingRequestActionButton
          action="DENIED"
          disabled={isActionPending || !onRejectPress}
          isPending={denyPending}
          onPress={onRejectPress}
        />
        <PendingRequestActionButton
          action="JOIN"
          disabled={isActionPending || !onApprovePress}
          isPending={approvePending}
          onPress={onApprovePress}
        />
      </View>
    </View>
  );
}

function PendingRequestsEmptyState() {
  return (
    <View className="items-center px-2 py-5">
      <Image
        source={communityGroupsHeroImage}
        resizeMode="contain"
        style={{
          height: 138,
          width: 168,
        }}
      />

      <Text
        className="mt-2 text-center text-[17px]"
        style={{ color: palette.primaryText, lineHeight: lineHeightFor(17) }}
      >
        Chưa có yêu cầu tham gia
      </Text>

      <Text
        className="mt-1 text-center text-[13px]"
        style={{ color: palette.mutedText, lineHeight: bodyLineHeightFor(13), maxWidth: 240 }}
      >
        Khi có người gửi yêu cầu tham gia, danh sách sẽ hiện ở đây.
      </Text>
    </View>
  );
}

function KickedMembersEmptyState() {
  return (
    <View className="items-center px-2 py-5">
      <Image
        source={communityGroupsHeroImage}
        resizeMode="contain"
        style={{
          height: 138,
          width: 168,
        }}
      />

      <Text
        className="mt-2 text-center text-[17px]"
        style={{ color: palette.primaryText, lineHeight: lineHeightFor(17) }}
      >
        Chưa có thành viên nào bị kích
      </Text>

      <Text
        className="mt-1 text-center text-[13px]"
        style={{ color: palette.mutedText, lineHeight: bodyLineHeightFor(13), maxWidth: 260 }}
      >
        Khi leader mời thành viên ra khỏi nhóm, danh sách sẽ hiển thị tại đây.
      </Text>
    </View>
  );
}

function KickMemberConfirmModal({
  isSubmitting = false,
  memberName,
  onCancel,
  onConfirm,
  visible,
}: {
  isSubmitting?: boolean;
  memberName: string | null;
  onCancel: () => void;
  onConfirm: () => void;
  visible: boolean;
}) {
  return (
    <Modal
      animationType="fade"
      onRequestClose={isSubmitting ? undefined : onCancel}
      transparent
      visible={visible}
    >
      <View
        className="flex-1 items-center justify-center px-5"
        style={{ backgroundColor: "rgba(41, 24, 31, 0.24)" }}
      >
        <Pressable
          className="absolute inset-0"
          disabled={isSubmitting}
          onPress={onCancel}
        />

        <View
          className="w-full max-w-[320px] rounded-[26px] bg-white px-4 pb-4 pt-3.5"
          style={{
            shadowColor: "rgba(255, 90, 114, 0.14)",
            shadowOpacity: 1,
            shadowRadius: 22,
            shadowOffset: {
              width: 0,
              height: 12,
            },
            elevation: 7,
          }}
        >
          <View className="items-center">
            <View
              className="h-[82px] w-[82px] items-center justify-center rounded-full"
              style={{ backgroundColor: "#FFF2F3" }}
            >
              <View
                className="h-[50px] w-[50px] items-center justify-center rounded-full"
                style={{ backgroundColor: "#FFE1E6" }}
              >
                <SymbolView
                  name={{
                    ios: "person.3.fill",
                    android: "groups",
                    web: "groups",
                  }}
                  size={25}
                  tintColor="#F35B72"
                />
              </View>

              <View
                className="absolute bottom-2 h-7 w-7 items-center justify-center rounded-full border-2 border-white"
                style={{ backgroundColor: "#FF5A72" }}
              >
                <SymbolView
                  name={{
                    ios: "xmark",
                    android: "close",
                    web: "close",
                  }}
                  size={13}
                  tintColor="#FFFFFF"
                />
              </View>
            </View>

            <Text
              className="mt-3 text-center text-[17px] font-black"
              style={{ color: palette.primaryText, lineHeight: lineHeightFor(17) }}
            >
              Mời ra khỏi nhóm
            </Text>

            <Text
              className="mt-2 text-center text-[12px]"
              style={{ color: palette.subtleText, lineHeight: bodyLineHeightFor(12) }}
            >
              Bạn có chắc chắn muốn mời{" "}
              <Text
                className="text-[12px] font-bold"
                style={{ color: palette.primaryText, lineHeight: bodyLineHeightFor(12) }}
              >
                {memberName ?? "thành viên này"}
              </Text>{" "}
              ra khỏi nhóm không?
            </Text>
          </View>

          <View
            className="mt-3.5 flex-row rounded-[16px] border px-3 py-2.5"
            style={{
              backgroundColor: "#FFF7F8",
              borderColor: "#F9D8DE",
              columnGap: 8,
            }}
          >
            <View
              className="mt-0.5 h-6 w-6 items-center justify-center rounded-full"
              style={{ backgroundColor: "#FFECEE" }}
            >
              <SymbolView
                name={{
                  ios: "exclamationmark.circle",
                  android: "info",
                  web: "info",
                }}
                size={14}
                tintColor="#F35B72"
              />
            </View>

            <Text
              className="flex-1 text-[12px]"
              style={{ color: palette.subtleText, lineHeight: bodyLineHeightFor(12) }}
            >
              Thành viên bị mời ra khỏi nhóm sẽ không còn truy cập được nhóm và
              nội dung liên quan.
            </Text>
          </View>

          <View className="mt-4 flex-row" style={{ columnGap: 10 }}>
            <Pressable
              className="flex-1 items-center justify-center rounded-[14px] px-3 py-2.5"
              disabled={isSubmitting}
              onPress={onCancel}
              style={({ pressed }) => ({
                backgroundColor: "#EEF1F4",
                borderColor: "#C7CED8",
                borderWidth: 1.5,
                opacity: isSubmitting ? 0.6 : pressed ? 0.84 : 1,
                shadowColor: "rgba(60, 34, 47, 0.08)",
                shadowOpacity: 1,
                shadowRadius: 12,
                shadowOffset: {
                  width: 0,
                  height: 5,
                },
                elevation: 2,
              })}
            >
              <Text
                className="text-[13px] font-black"
                numberOfLines={1}
                style={{ color: "#8F8698", lineHeight: lineHeightFor(13) }}
              >
                Hủy
              </Text>
            </Pressable>

            <Pressable
              className="flex-1 overflow-hidden rounded-[14px]"
              disabled={isSubmitting}
              onPress={onConfirm}
              style={({ pressed }) => ({
                backgroundColor: "#FF6170",
                opacity: isSubmitting ? 0.72 : pressed ? 0.88 : 1,
              })}
            >
              <LinearGradient
                colors={["#FF7A87", "#FF5568"]}
                end={{ x: 1, y: 0.5 }}
                start={{ x: 0, y: 0.5 }}
                className="w-full items-center justify-center rounded-[14px] px-2 py-2.5"
                style={{ minHeight: 42 }}
              >
                {isSubmitting ? (
                  <ActivityIndicator color="#FFFFFF" size="small" />
                ) : (
                  <Text
                    adjustsFontSizeToFit
                    className="text-center text-[13px] font-black text-white"
                    minimumFontScale={0.8}
                    numberOfLines={2}
                    style={{ lineHeight: lineHeightFor(13) }}
                  >
                    Mời ra khỏi nhóm
                  </Text>
                )}
              </LinearGradient>
            </Pressable>
          </View>
        </View>
      </View>
    </Modal>
  );
}

function MemberActionSheet({
  bottomInset,
  onClose,
  onRequestKick,
  visible,
}: {
  bottomInset: number;
  onClose: () => void;
  onRequestKick: () => void;
  visible: boolean;
}) {
  return (
    <Modal
      animationType="slide"
      onRequestClose={onClose}
      statusBarTranslucent
      transparent
      visible={visible}
    >
      <View className="flex-1 bg-black/35">
        <Pressable className="flex-1" onPress={onClose} />

        <View
          className="rounded-t-[28px] bg-white px-3 pt-3"
          style={{ paddingBottom: Math.max(bottomInset, 14) }}
        >
          <View className="items-center pb-2">
            <View className="h-1.5 w-14 rounded-full bg-[#D3D2DC]" />
          </View>

          <View className="rounded-[22px] bg-[#F7F6FB] px-4 py-0.5">
            <Pressable
              className="flex-row items-start gap-2.5 py-2.5"
              onPress={onRequestKick}
            >
              <View className="w-6 items-center pt-px">
                <SymbolView
                  name={{
                    ios: "person.fill.xmark",
                    android: "person-remove",
                    web: "person-remove",
                  }}
                  size={19}
                  tintColor="#C24F3B"
                />
              </View>
              <View className="min-w-0 flex-1">
                <Text
                  className="text-[15px] font-normal"
                  style={{ color: "#C24F3B", lineHeight: lineHeightFor(15) }}
                >
                  Mời ra khỏi nhóm
                </Text>
              </View>
            </Pressable>
          </View>
        </View>
      </View>
    </Modal>
  );
}

export default function CommunityGroupMembersScreen() {
  const authSession = useAuthSession();
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const {
    action: routeAction,
    groupId: routeGroupId,
    screenTitle: routeScreenTitle,
    shareToken,
  } = useLocalSearchParams<{
    action?: string;
    groupId?: string;
    screenTitle?: string;
    shareToken?: string;
  }>();
  const resolvedRouteValue =
    typeof shareToken === "string"
      ? normalizeRouteValue(decodeURIComponent(shareToken))
      : null;
  const resolvedMemberAction =
    typeof routeAction === "string"
      ? (normalizeRouteValue(routeAction)?.toUpperCase() ?? null)
      : null;
  const resolvedScreenTitle =
    typeof routeScreenTitle === "string"
      ? normalizeRouteValue(routeScreenTitle)
      : null;
  const isPendingRequestsView = resolvedMemberAction === "PENDING";
  const isKickedMembersView = resolvedMemberAction === "KICKED";
  const cachedGroupSession = getCachedCommunityGroupSession(resolvedRouteValue);
  const resolvedParamGroupId =
    typeof routeGroupId === "string" ? normalizeRouteValue(routeGroupId) : null;
  const resolvedGroupId = isNumericIdentifier(resolvedParamGroupId)
    ? resolvedParamGroupId
    : isNumericIdentifier(resolvedRouteValue)
      ? resolvedRouteValue
      : normalizeRouteValue(cachedGroupSession?.groupId);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [groupMembers, setGroupMembers] = useState<
    CommunityGroupMemberPayload[]
  >([]);
  const [kickingUserId, setKickingUserId] = useState<string | null>(null);
  const [kickConfirmTarget, setKickConfirmTarget] =
    useState<KickConfirmTarget | null>(null);
  const [memberActionSheetTarget, setMemberActionSheetTarget] =
    useState<KickConfirmTarget | null>(null);
  const [pendingParticipantAction, setPendingParticipantAction] =
    useState<PendingParticipantAction | null>(null);
  const [currentUserId, setCurrentUserId] = useState<string | null>(null);
  const [memberProfiles, setMemberProfiles] = useState<
    Record<string, MemberProfileSummary>
  >({});
  const [copiedInviteLink, setCopiedInviteLink] = useState(false);
  const [retryNonce, setRetryNonce] = useState(0);
  const [status, setStatus] = useState<GroupMembersStatus>(
    resolvedRouteValue ? "loading" : "idle",
  );

  useFocusEffect(
    useCallback(() => {
      let isActive = true;
      const retrySeed = retryNonce;

      async function loadGroupMembers() {
        if (!resolvedRouteValue) {
          setErrorMessage(
            "Không đọc được thông tin nhóm từ đường dẫn hiện tại.",
          );
          setCurrentUserId(null);
          setGroupMembers([]);
          setMemberProfiles({});
          setStatus("error");
          return;
        }

        if (!resolvedGroupId) {
          setErrorMessage(
            isPendingRequestsView
              ? "Không xác định được ID nhóm để tải yêu cầu tham gia."
              : isKickedMembersView
                ? "Không xác định được ID nhóm để tải danh sách đã bị kích."
                : "Không xác định được ID nhóm để tải thành viên.",
          );
          setCurrentUserId(null);
          setGroupMembers([]);
          setMemberProfiles({});
          setStatus("error");
          return;
        }

        setStatus("loading");
        setErrorMessage(null);

        try {
          const accessToken = authSession.isAuthenticated
            ? await getValidAccessToken()
            : null;
          const nextMembers = await getCommunityGroupMembers({
            accessToken: accessToken ?? undefined,
            action: resolvedMemberAction ?? undefined,
            groupId: resolvedGroupId,
            tokenType: authSession.tokenType ?? undefined,
          });
          const currentProfilePromise = accessToken
            ? getMyProfile({
                accessToken,
                tokenType: authSession.tokenType ?? undefined,
              }).catch(() => null)
            : Promise.resolve(null);
          const uniqueUserIds = Array.from(
            new Set(
              nextMembers
                .map((member) => normalizeRouteValue(member.userId))
                .filter((userId): userId is string => Boolean(userId)),
            ),
          );

          const [profileResults, currentProfile] = await Promise.all([
            Promise.allSettled(
              uniqueUserIds.map(async (userId) => {
                const profile = await getUserProfileById({
                  accessToken: accessToken ?? undefined,
                  tokenType: authSession.tokenType ?? undefined,
                  userId,
                });

                return [
                  userId,
                  {
                    avatarUri: readMeaningfulText(profile.avatar),
                    displayName:
                      readMeaningfulText(profile.name) ?? `Explorer #${userId}`,
                    userId,
                  } satisfies MemberProfileSummary,
                ] as const;
              }),
            ),
            currentProfilePromise,
          ]);

          if (!isActive) {
            return;
          }

          setCurrentUserId(normalizeRouteValue(currentProfile?.id) ?? null);

          const nextMemberProfiles: Record<string, MemberProfileSummary> = {};

          for (const result of profileResults) {
            if (result.status === "fulfilled") {
              const [userId, summary] = result.value;
              nextMemberProfiles[userId] = summary;
            }
          }

          setGroupMembers(nextMembers);
          setMemberProfiles(nextMemberProfiles);
          setStatus("ready");
        } catch (error) {
          if (!isActive) {
            return;
          }

          setErrorMessage(
            error instanceof Error
              ? error.message
              : isPendingRequestsView
                ? "Không tải được danh sách chờ duyệt."
                : isKickedMembersView
                  ? "Không tải được danh sách đã bị kích."
                  : "Không tải được danh sách thành viên.",
          );
          setCurrentUserId(null);
          setGroupMembers([]);
          setMemberProfiles({});
          setStatus("error");
        }
      }

      void retrySeed;
      void loadGroupMembers();

      return () => {
        isActive = false;
      };
    }, [
      authSession.isAuthenticated,
      authSession.tokenType,
      isKickedMembersView,
      isPendingRequestsView,
      resolvedMemberAction,
      resolvedGroupId,
      resolvedRouteValue,
      retryNonce,
    ]),
  );

  const handleOpenMemberProfile = (userId?: string | null) => {
    const normalizedUserId = normalizeRouteValue(userId);

    if (!normalizedUserId) {
      return;
    }

    if (currentUserId && normalizedUserId === currentUserId) {
      router.push("/profile" as Href);
      return;
    }

    router.push(
      `/community/profile/${encodeURIComponent(normalizedUserId)}` as Href,
    );
  };

  const handleKickMember = async (userId: string, displayName: string) => {
    if (kickingUserId) {
      return;
    }

    if (!resolvedGroupId) {
      appToast.error("Không xác định được ID nhóm để mời thành viên ra khỏi nhóm.");
      return;
    }

    if (!authSession.isAuthenticated) {
      appToast.error("Bạn cần đăng nhập để mời thành viên ra khỏi nhóm.");
      return;
    }

    const accessToken = await getValidAccessToken();

    if (!accessToken) {
      appToast.error("Phiên đăng nhập đã hết hạn. Vui lòng đăng nhập lại.");
      return;
    }

    setKickingUserId(userId);

    try {
      await kickCommunityGroupMember({
        accessToken,
        groupId: resolvedGroupId,
        tokenType: authSession.tokenType ?? undefined,
        userId,
      });
      setGroupMembers((currentMembers) =>
        currentMembers.filter(
          (member) => normalizeRouteValue(member.userId) !== userId,
        ),
      );
      setMemberProfiles((currentProfiles) => {
        const nextProfiles = { ...currentProfiles };
        delete nextProfiles[userId];
        return nextProfiles;
      });
      setKickConfirmTarget(null);
      appToast.success(`Đã mời ${displayName} ra khỏi nhóm.`);
    } catch (error) {
      appToast.error(
        error instanceof Error
          ? error.message
          : "Không thể mời thành viên ra khỏi nhóm lúc này.",
      );
    } finally {
      setKickingUserId(null);
    }
  };

  const handleConfirmKickMember = (userId: string, displayName: string) => {
    setKickConfirmTarget({
      displayName,
      userId,
    });
  };

  const handleCloseKickConfirmModal = () => {
    if (kickingUserId) {
      return;
    }

    setKickConfirmTarget(null);
  };

  const handleOpenMemberActionSheet = (userId: string, displayName: string) => {
    setMemberActionSheetTarget({
      displayName,
      userId,
    });
  };

  const handleCloseMemberActionSheet = () => {
    setMemberActionSheetTarget(null);
  };

  const handleRequestKickFromActionSheet = () => {
    if (!memberActionSheetTarget) {
      return;
    }

    const { displayName, userId } = memberActionSheetTarget;

    setMemberActionSheetTarget(null);
    handleConfirmKickMember(userId, displayName);
  };

  const handleReviewPendingParticipant = async ({
    action,
    displayName,
    participantId,
    userId,
  }: {
    action: "DENIED" | "JOIN";
    displayName: string;
    participantId: string;
    userId: string | null;
  }) => {
    if (pendingParticipantAction) {
      return;
    }

    if (!authSession.isAuthenticated) {
      appToast.error("Bạn cần đăng nhập để duyệt yêu cầu tham gia.");
      return;
    }

    const accessToken = await getValidAccessToken();

    if (!accessToken) {
      appToast.error("Phiên đăng nhập đã hết hạn. Vui lòng đăng nhập lại.");
      return;
    }

    setPendingParticipantAction({
      action,
      participantId,
    });

    try {
      await updateCommunityGroupParticipant({
        accessToken,
        action,
        participantId,
        tokenType: authSession.tokenType ?? undefined,
      });
      setGroupMembers((currentMembers) =>
        currentMembers.filter(
          (member) =>
            normalizeRouteValue(member.groupParticipantId) !== participantId,
        ),
      );
      if (userId) {
        setMemberProfiles((currentProfiles) => {
          const nextProfiles = { ...currentProfiles };
          delete nextProfiles[userId];
          return nextProfiles;
        });
      }
      appToast.success(
        action === "JOIN"
          ? `Đã duyệt ${displayName} tham gia nhóm.`
          : `Đã từ chối yêu cầu của ${displayName}.`,
      );
    } catch (error) {
      appToast.error(
        error instanceof Error
          ? error.message
          : action === "JOIN"
            ? "Không thể duyệt yêu cầu lúc này."
            : "Không thể từ chối yêu cầu lúc này.",
      );
    } finally {
      setPendingParticipantAction(null);
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

  if (status === "loading" && groupMembers.length === 0) {
    return <AppLoadingScreen edges={["left", "right"]} />;
  }

  const groupName = cachedGroupSession?.groupName ?? "Nhóm cộng đồng";
  const screenTitle =
    resolvedScreenTitle ??
    (isPendingRequestsView
      ? "Duyệt yêu cầu tham gia"
      : isKickedMembersView
        ? "Thành viên đã bị kích"
        : "Danh sách thành viên");
  const sectionTitle = isPendingRequestsView
    ? "Yêu cầu đang chờ"
    : isKickedMembersView
      ? "Danh sách đã bị kích"
      : "Thành viên hiện tại";
  const isCurrentUserLeader = groupMembers.some((member) => {
    if (!currentUserId) {
      return false;
    }

    return (
      normalizeRouteValue(member.userId) === currentUserId &&
      readMeaningfulText(member.role)?.toUpperCase() === "LEADER"
    );
  });
  const isGroupLeader =
    currentUserId !== null &&
    (normalizeRouteValue(cachedGroupSession?.leaderId) === currentUserId ||
      isCurrentUserLeader);
  const totalGroupMembersLabel = isPendingRequestsView
    ? `${groupMembers.length} chờ duyệt`
    : isKickedMembersView
      ? `${groupMembers.length} đã bị kích`
      : `${groupMembers.length} thành viên`;
  const createdDateLabel = formatGroupCreatedDate(
    cachedGroupSession?.createdAt,
  );
  const inviteLink = cachedGroupSession?.inviteWebUrl
    ? cachedGroupSession.inviteWebUrl
    : resolvedRouteValue && !isNumericIdentifier(resolvedRouteValue)
      ? buildCommunityInviteWebUrl(resolvedRouteValue)
      : null;

  const handleCopyInviteLink = async () => {
    if (!inviteLink) {
      appToast.info("Nhóm này chưa có link mời.");
      return;
    }

    try {
      await Clipboard.setStringAsync(inviteLink);
      setCopiedInviteLink(true);
      appToast.success("Đã sao chép link mời.");

      setTimeout(() => {
        setCopiedInviteLink(false);
      }, 1600);
    } catch (error) {
      appToast.error(
        error instanceof Error
          ? error.message
          : "Không sao chép được link mời.",
      );
    }
  };

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
              className="text-[19px] font-bold"
              style={{ color: palette.primaryText, lineHeight: lineHeightFor(19) }}
            >
              {screenTitle}
            </Text>

            <View className="h-10 w-10" />
          </View>

          <View
            className="mt-3 rounded-[24px] border bg-white px-3 py-3"
            style={{
              borderColor: "#F2E9EE",
              shadowColor: "rgba(63, 28, 47, 0.06)",
              shadowOpacity: 1,
              shadowRadius: 16,
              shadowOffset: {
                width: 0,
                height: 8,
              },
              elevation: 3,
            }}
          >
            <View className="flex-row items-start gap-3">
              <View
                className="overflow-hidden rounded-[18px] border bg-[#FFF9FB]"
                style={{
                  borderColor: "#F8E5ED",
                  height: 86,
                  width: 86,
                }}
              >
                <Image
                  source={communityGroupsHeroImage}
                  resizeMode="contain"
                  style={{
                    height: 86,
                    width: 86,
                  }}
                />
              </View>

              <View className="min-w-0 flex-1 pt-0.5">
                <Text
                  className="text-[16px] font-semibold"
                  numberOfLines={2}
                  style={{ color: palette.primaryText, lineHeight: lineHeightFor(16) }}
                >
                  {groupName}
                </Text>

                <View className="mt-1 flex-row flex-wrap items-center">
                  <View className="mr-3 flex-row items-center">
                    <SymbolView
                      name={{
                        ios: "person.2",
                        android: "groups",
                        web: "groups",
                      }}
                      size={12}
                      tintColor={palette.mutedText}
                    />
                    <Text
                      className="ml-1 text-[12px]"
                      style={{ color: palette.subtleText, lineHeight: bodyLineHeightFor(12) }}
                    >
                      {totalGroupMembersLabel}
                    </Text>
                  </View>

                  <View className="flex-row items-center">
                    <SymbolView
                      name={{ ios: "calendar", android: "event", web: "event" }}
                      size={12}
                      tintColor={palette.mutedText}
                    />
                    <Text
                      className="ml-1 text-[12px]"
                      style={{ color: palette.subtleText, lineHeight: bodyLineHeightFor(12) }}
                    >
                      {`Tạo ngày ${createdDateLabel}`}
                    </Text>
                  </View>
                </View>
              </View>
            </View>

            {inviteLink ? (
              <View
                className="mt-3 flex-row items-center rounded-[16px] border px-3 py-2.5"
                style={{
                  backgroundColor: "#FFF9FB",
                  borderColor: "#F7E8EF",
                }}
              >
                <View
                  className="mr-2.5 h-8.5 w-8.5 items-center justify-center rounded-full"
                  style={{ backgroundColor: "#FFF0F5" }}
                >
                  <SymbolView
                    name={{ ios: "link", android: "link", web: "link" }}
                    size={15}
                    tintColor="#8E869A"
                  />
                </View>

                <View className="min-w-0 flex-1 pr-2">
                  <Text
                    className="text-[13px] font-semibold"
                    style={{ color: palette.primaryText, lineHeight: bodyLineHeightFor(13) }}
                  >
                    Link mời tham gia
                  </Text>
                  <Text
                    className="mt-1 text-[12px]"
                    numberOfLines={1}
                    style={{ color: "#8E869A", lineHeight: lineHeightFor(12) }}
                  >
                    {inviteLink}
                  </Text>
                </View>

                <Pressable
                  className="h-9 w-9 items-center justify-center rounded-[12px]"
                  onPress={() => {
                    void handleCopyInviteLink();
                  }}
                  style={({ pressed }) => ({
                    backgroundColor: copiedInviteLink
                      ? "#FFF0F5"
                      : "transparent",
                    opacity: pressed ? 0.84 : 1,
                  })}
                >
                  <SymbolView
                    name={{
                      ios: "doc.on.doc",
                      android: "content_copy",
                      web: "content_copy",
                    }}
                    size={15}
                    tintColor={copiedInviteLink ? "#FF5A87" : "#8E869A"}
                  />
                </Pressable>
              </View>
            ) : null}
          </View>

          {status === "error" && errorMessage ? (
            <View
              className="mt-3 rounded-[18px] border px-4 py-3"
              style={{
                backgroundColor: palette.warningBg,
                borderColor: "#F5D2C0",
              }}
            >
              <Text
                className="text-[12px]"
                style={{ color: palette.warningText, lineHeight: bodyLineHeightFor(12) }}
              >
                {errorMessage}
              </Text>
            </View>
          ) : null}

          <View
            className="mt-3 rounded-[24px] border bg-white px-4 py-2.5"
            style={{ borderColor: palette.border }}
          >
            <View className="flex-row items-center justify-between gap-3">
              <Text
                className="text-[16px]"
                style={{ color: palette.primaryText, lineHeight: lineHeightFor(16) }}
              >
                {sectionTitle}
              </Text>
            </View>

            <View className="mt-2">
              {groupMembers.length > 0 ? (
                groupMembers.map((member, index) => {
                  const normalizedUserId = normalizeRouteValue(member.userId);
                  const normalizedParticipantId = normalizeRouteValue(
                    member.groupParticipantId,
                  );
                  const normalizedRole = readMeaningfulText(
                    member.role,
                  )?.toUpperCase();
                  const memberProfile =
                    (normalizedUserId
                      ? memberProfiles[normalizedUserId]
                      : undefined) ?? null;
                  const displayName =
                    memberProfile?.displayName ??
                    (normalizedUserId
                      ? `Explorer #${normalizedUserId}`
                      : "Explorer");
                  const avatarUri = memberProfile?.avatarUri ?? null;
                  const canReviewPendingRequest =
                    isPendingRequestsView &&
                    isGroupLeader &&
                    Boolean(normalizedParticipantId);
                  const canKickMember =
                    !isPendingRequestsView &&
                    !isKickedMembersView &&
                    isGroupLeader &&
                    Boolean(normalizedUserId) &&
                    normalizedUserId !== currentUserId &&
                    normalizedRole !== "LEADER";
                  const isParticipantActionPending =
                    normalizedParticipantId !== null &&
                    pendingParticipantAction?.participantId ===
                      normalizedParticipantId;
                  const isApprovePending =
                    isParticipantActionPending &&
                    pendingParticipantAction?.action === "JOIN";
                  const isDenyPending =
                    isParticipantActionPending &&
                    pendingParticipantAction?.action === "DENIED";

                  if (isPendingRequestsView) {
                    return (
                      <PendingRequestRow
                        approvePending={Boolean(isApprovePending)}
                        key={
                          member.groupParticipantId ??
                          `${normalizedUserId ?? "member"}-${index}`
                        }
                        avatarUri={avatarUri}
                        denyPending={Boolean(isDenyPending)}
                        displayName={displayName}
                        hideDivider={index === groupMembers.length - 1}
                        onApprovePress={
                          canReviewPendingRequest &&
                          normalizedParticipantId !== null
                            ? () => {
                                void handleReviewPendingParticipant({
                                  action: "JOIN",
                                  displayName,
                                  participantId: normalizedParticipantId,
                                  userId: normalizedUserId,
                                });
                              }
                            : undefined
                        }
                        onPress={() => {
                          handleOpenMemberProfile(normalizedUserId);
                        }}
                        onRejectPress={
                          canReviewPendingRequest &&
                          normalizedParticipantId !== null
                            ? () => {
                                void handleReviewPendingParticipant({
                                  action: "DENIED",
                                  displayName,
                                  participantId: normalizedParticipantId,
                                  userId: normalizedUserId,
                                });
                              }
                            : undefined
                        }
                        submittedAtLabel={formatRequestElapsedTime(
                          member.createdAt,
                        )}
                      />
                    );
                  }

                  return (
                    <MemberRow
                      actionPending={normalizedUserId === kickingUserId}
                      key={
                        member.groupParticipantId ??
                        `${normalizedUserId ?? "member"}-${index}`
                      }
                      avatarUri={avatarUri}
                      displayName={displayName}
                      hideDivider={index === groupMembers.length - 1}
                      onActionPress={
                        canKickMember && normalizedUserId
                          ? () => {
                              handleOpenMemberActionSheet(
                                normalizedUserId,
                                displayName,
                              );
                            }
                          : undefined
                      }
                      onPress={() => {
                        handleOpenMemberProfile(normalizedUserId);
                      }}
                      roleLabel={getRoleLabel(member.role)}
                    />
                  );
                })
              ) : status === "ready" ? (
                isPendingRequestsView ? (
                  <PendingRequestsEmptyState />
                ) : isKickedMembersView ? (
                  <KickedMembersEmptyState />
                ) : (
                  <CommunityGroupStateCard
                    description="Nhóm này chưa có thành viên nào để hiển thị."
                    icon="groups"
                    title="Chưa có thành viên"
                    variant="empty"
                  />
                )
              ) : (
                <CommunityGroupStateCard
                  actionLabel="Thử lại"
                  description={
                    errorMessage ??
                    (isPendingRequestsView
                      ? "Không tải được danh sách yêu cầu tham gia của nhóm."
                      : isKickedMembersView
                        ? "Không tải được danh sách thành viên đã bị kích của nhóm."
                        : "Không tải được danh sách thành viên của nhóm.")
                  }
                  icon="error"
                  onPress={() => {
                    setRetryNonce((currentValue) => currentValue + 1);
                  }}
                  title={
                    isPendingRequestsView
                      ? "Không tải được yêu cầu tham gia"
                      : isKickedMembersView
                        ? "Không tải được danh sách đã bị kích"
                        : "Không tải được thành viên"
                  }
                  variant="error"
                />
              )}
            </View>
          </View>
        </View>
      </ScrollView>

      <MemberActionSheet
        bottomInset={insets.bottom}
        onClose={handleCloseMemberActionSheet}
        onRequestKick={handleRequestKickFromActionSheet}
        visible={memberActionSheetTarget !== null}
      />

      <KickMemberConfirmModal
        isSubmitting={
          kickConfirmTarget !== null &&
          kickingUserId === kickConfirmTarget.userId
        }
        memberName={kickConfirmTarget?.displayName ?? null}
        onCancel={handleCloseKickConfirmModal}
        onConfirm={() => {
          if (!kickConfirmTarget) {
            return;
          }

          void handleKickMember(
            kickConfirmTarget.userId,
            kickConfirmTarget.displayName,
          );
        }}
        visible={kickConfirmTarget !== null}
      />
    </SafeAreaView>
  );
}
