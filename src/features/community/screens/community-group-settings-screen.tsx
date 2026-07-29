import { useFocusEffect, useLocalSearchParams, useRouter } from "expo-router";
import { StatusBar } from "expo-status-bar";
import { useCallback, useState, type ReactNode } from "react";
import {
  ActivityIndicator,
  Pressable,
  Text as RNText,
  ScrollView,
  TextInput,
  View,
  type TextProps,
} from "react-native";
import {
  SafeAreaView,
  useSafeAreaInsets,
} from "react-native-safe-area-context";

import { appToast } from "@/components/ui/app-toast";
import { SymbolView } from "@/components/ui/symbol-view";
import {
  getValidAccessToken,
  useAuthSession,
} from "@/features/auth/hooks/use-auth-session";
import {
  getCommunityGroupById,
  updateCommunityGroup,
  type CommunityGroupPayload,
} from "../api/group-api";
import { CommunityGroupStateCard } from "../components/community-group-ui";
import {
  cacheCommunityGroupSession,
  getCachedCommunityGroupSession,
} from "../data/community-group-session-store";

const detailTextMaxFontSizeMultiplier = 1.05;

const palette = {
  accent: "#EB489B",
  accentStrong: "#D95B8D",
  accentSoft: "#FFE8F0",
  background: "#FFFFFF",
  border: "#E3E7ED",
  mutedText: "#8E869A",
  primaryText: "#2B2233",
  subtleSurface: "#FBFBFD",
  subtleText: "#676071",
  surface: "#FFFFFF",
};

type GroupSettingsStatus = "error" | "idle" | "loading" | "ready";

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

function FieldShell({ children }: { children: ReactNode }) {
  return (
    <View
      className="rounded-[16px] border px-3 py-2.5"
      style={{
        backgroundColor: palette.surface,
        borderColor: palette.border,
      }}
    >
      {children}
    </View>
  );
}

function ApprovalChip({
  active,
  label,
  onPress,
}: {
  active: boolean;
  label: string;
  onPress: () => void;
}) {
  return (
    <Pressable
      className="flex-1 items-center rounded-[14px] px-3 py-2.5"
      onPress={onPress}
      style={{
        backgroundColor: active ? palette.accentSoft : palette.subtleSurface,
        borderColor: active ? "#F7B8CE" : palette.border,
        borderWidth: 1,
      }}
    >
      <Text
        className="text-[13px] font-bold"
        style={{
          color: active ? palette.accentStrong : palette.subtleText,
          lineHeight: 15,
        }}
      >
        {label}
      </Text>
    </Pressable>
  );
}

export default function CommunityGroupSettingsScreen() {
  const authSession = useAuthSession();
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
  const [editableGroupName, setEditableGroupName] = useState(
    readMeaningfulText(cachedGroupSession?.groupName) ?? "",
  );
  const [editableRequiredApproval, setEditableRequiredApproval] = useState<
    boolean | null
  >(cachedGroupSession?.requiredApproval ?? null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [groupDetail, setGroupDetail] = useState<CommunityGroupPayload | null>(
    null,
  );
  const [isSaving, setIsSaving] = useState(false);
  const [retryNonce, setRetryNonce] = useState(0);
  const [status, setStatus] = useState<GroupSettingsStatus>(
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
          setErrorMessage("Không xác định được ID nhóm để tải cài đặt.");
          setStatus("error");
          return;
        }

        setStatus("loading");
        setErrorMessage(null);

        try {
          const accessToken = authSession.isAuthenticated
            ? await getValidAccessToken()
            : null;
          const nextGroupDetail = await getCommunityGroupById({
            accessToken: accessToken ?? undefined,
            groupId: resolvedGroupId,
            tokenType: authSession.tokenType ?? undefined,
          });

          if (!isActive) {
            return;
          }

          const cachedGroup = cacheCommunityGroupSession({
            ...nextGroupDetail,
            source: cachedGroupSession?.source ?? "listed",
          });

          setGroupDetail(cachedGroup ?? nextGroupDetail);
          setEditableGroupName(
            readMeaningfulText(nextGroupDetail.groupName) ?? "",
          );
          setEditableRequiredApproval(nextGroupDetail.requiredApproval);
          setStatus("ready");
        } catch (error) {
          if (!isActive) {
            return;
          }

          setErrorMessage(
            error instanceof Error
              ? error.message
              : "Không tải được cài đặt nhóm.",
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
  const normalizedEditableGroupName = editableGroupName.trim();
  const effectiveGroupId = displayGroup?.groupId ?? resolvedGroupId;
  const canSave =
    Boolean(effectiveGroupId) &&
    normalizedEditableGroupName.length > 0 &&
    editableRequiredApproval !== null &&
    !isSaving;

  const handleSave = async () => {
    if (!effectiveGroupId) {
      appToast.error("Không tìm thấy ID nhóm hợp lệ để cập nhật.");
      return;
    }

    if (!normalizedEditableGroupName) {
      appToast.info("Vui lòng nhập tên nhóm trước khi lưu.");
      return;
    }

    if (editableRequiredApproval === null) {
      appToast.info("Vui lòng chọn yêu cầu quyền tham gia trước khi lưu.");
      return;
    }

    const accessToken = authSession.isAuthenticated
      ? await getValidAccessToken()
      : null;

    if (!accessToken) {
      appToast.error("Bạn cần đăng nhập để cập nhật cài đặt nhóm.");
      return;
    }

    setIsSaving(true);
    setErrorMessage(null);

    try {
      const updatedGroup = await updateCommunityGroup({
        accessToken,
        groupId: effectiveGroupId,
        groupName: normalizedEditableGroupName,
        requiredApproval: editableRequiredApproval,
        tokenType: authSession.tokenType ?? undefined,
      });

      const cachedUpdatedGroup = cacheCommunityGroupSession({
        ...updatedGroup,
        source: cachedGroupSession?.source ?? "listed",
      });

      setGroupDetail(cachedUpdatedGroup ?? updatedGroup);
      setErrorMessage(null);
      appToast.success("Cài đặt nhóm đã được cập nhật.");
      router.back();
    } catch (error) {
      const nextErrorMessage =
        error instanceof Error
          ? error.message
          : "Không thể cập nhật cài đặt nhóm.";

      appToast.error(nextErrorMessage);
      setErrorMessage(
        nextErrorMessage,
      );
    } finally {
      setIsSaving(false);
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

  if (status === "loading" && !displayGroup) {
    return (
      <SafeAreaView
        className="flex-1"
        edges={["left", "right"]}
        style={{ backgroundColor: palette.background }}
      >
        <StatusBar style="dark" />
        <View className="flex-1 items-center justify-center px-5">
          <View
            className="w-full max-w-[360px] rounded-[28px] border bg-white px-5 py-6"
            style={{ borderColor: palette.border }}
          >
            <View className="items-center">
              <ActivityIndicator color={palette.accent} size="small" />
            </View>
            <Text
              className="mt-4 text-center text-[19px] font-bold"
              style={{ color: palette.primaryText, lineHeight: 21 }}
            >
              Đang tải cài đặt nhóm
            </Text>
            <Text
              className="mt-2 text-center text-[13px]"
              style={{ color: palette.mutedText, lineHeight: 16 }}
            >
              Đang chuẩn bị biểu mẫu chỉnh sửa nhóm từ dữ liệu hiện tại.
            </Text>
          </View>
        </View>
      </SafeAreaView>
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
            actionLabel="Thử lại"
            description={
              errorMessage ?? "Không có dữ liệu để hiển thị cài đặt nhóm."
            }
            icon="error"
            onPress={() => {
              setRetryNonce((currentValue) => currentValue + 1);
            }}
            title="Không tải được cài đặt"
            variant="error"
          />
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView
      className="flex-1"
      edges={["left", "right"]}
      style={{ backgroundColor: palette.background }}
    >
      <StatusBar style="dark" />

      <View
        className="border-b px-4"
        style={{
          borderBottomColor: palette.border,
          paddingTop: insets.top + 8,
          paddingBottom: 10,
        }}
      >
        <View className="flex-row items-center justify-between">
          <Pressable
            className="h-10 w-10 items-center justify-center"
            hitSlop={8}
            onPress={() => {
              router.back();
            }}
          >
            <SymbolView
              name={{
                ios: "chevron.left",
                android: "arrow-back",
                web: "arrow-back",
              }}
              size={20}
              tintColor={palette.primaryText}
            />
          </Pressable>

          <Text
            className="text-[18px] font-bold"
            style={{ color: palette.primaryText, lineHeight: 21 }}
          >
            Chỉnh sửa nhóm
          </Text>

          <Pressable
            className="h-10 items-end justify-center px-1"
            disabled={!canSave}
            hitSlop={8}
            onPress={() => {
              void handleSave();
            }}
            style={({ pressed }) => ({
              opacity: !canSave ? 0.45 : pressed ? 0.72 : 1,
            })}
          >
            {isSaving ? (
              <ActivityIndicator color={palette.accent} size="small" />
            ) : (
              <Text
                className="text-[16px] font-medium"
                style={{ color: palette.accentStrong, lineHeight: 18 }}
              >
                Lưu
              </Text>
            )}
          </Pressable>
        </View>
      </View>

      <ScrollView
        contentContainerStyle={{
          paddingBottom: Math.max(insets.bottom + 28, 32),
          paddingHorizontal: 16,
          paddingTop: 12,
        }}
        showsVerticalScrollIndicator={false}
      >
        {errorMessage ? (
          <View
            className="mb-3 rounded-[16px] border px-4 py-3"
            style={{
              backgroundColor: "#FFF4EF",
              borderColor: "#F5D2C0",
            }}
          >
            <Text
              className="text-[12px]"
              style={{ color: "#D97A55", lineHeight: 15 }}
            >
              {errorMessage}
            </Text>
          </View>
        ) : null}

        <FieldShell>
          <Text
            className="text-[12px]"
            style={{ color: palette.mutedText, lineHeight: 14 }}
          >
            Tên nhóm
          </Text>
          <TextInput
            className="mt-1 px-0 py-0 text-[16px] font-medium"
            onChangeText={setEditableGroupName}
            placeholder="Nhập tên nhóm"
            placeholderTextColor="#AAA3B2"
            style={{
              color: palette.primaryText,
              minHeight: 30,
            }}
            value={editableGroupName}
          />
        </FieldShell>

        <Text
          className="mt-2 px-1 text-[12px]"
          style={{ color: palette.mutedText, lineHeight: 16 }}
        >
          Bạn chỉ có thể thay đổi tên nhóm khi cần thiết để giữ liên kết và nhận
          diện nhóm ổn định.
        </Text>

        <View className="mt-4">
          <FieldShell>
            <Text
              className="text-[12px]"
              style={{ color: palette.mutedText, lineHeight: 14 }}
            >
              Yêu cầu quyền tham gia
            </Text>
            <View className="mt-3 flex-row gap-2">
              <ApprovalChip
                active={editableRequiredApproval === true}
                label="Bật duyệt"
                onPress={() => {
                  setEditableRequiredApproval(true);
                }}
              />
              <ApprovalChip
                active={editableRequiredApproval === false}
                label="Tắt duyệt"
                onPress={() => {
                  setEditableRequiredApproval(false);
                }}
              />
            </View>
          </FieldShell>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}
