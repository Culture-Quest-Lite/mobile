import { Image } from "expo-image";
import * as ImagePicker from "expo-image-picker";
import { useFocusEffect, useLocalSearchParams, useRouter } from "expo-router";
import { StatusBar } from "expo-status-bar";
import { useCallback, useState, type ReactNode } from "react";
import { useTranslation } from "react-i18next";
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

import { appAlert } from "@/components/ui/app-dialog";
import { AppLoadingScreen } from "@/components/ui/app-loading-screen";
import { appToast } from "@/components/ui/app-toast";
import { SymbolView } from "@/components/ui/symbol-view";
import {
  getValidAccessToken,
  useAuthSession,
} from "@/features/auth/hooks/use-auth-session";
import {
  getCommunityGroupById,
  updateCommunityGroup,
  type CommunityGroupImageFile,
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
        className="text-[13px] font-semibold"
        style={{
          color: active ? palette.accentStrong : palette.subtleText,
          lineHeight: bodyLineHeightFor(13),
        }}
      >
        {label}
      </Text>
    </Pressable>
  );
}

export default function CommunityGroupSettingsScreen() {
  const { t } = useTranslation();
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
  const [groupImageFile, setGroupImageFile] =
    useState<CommunityGroupImageFile | null>(null);
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
          setErrorMessage(t("community.groupDetail.missingRouteError"));
          setStatus("error");
          return;
        }

        if (!resolvedGroupId) {
          setErrorMessage(t("community.groupSettings.missingGroupIdError"));
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
              : t("community.groupSettings.loadError"),
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

  const handleSelectGroupImage = async () => {
    const permissionResult =
      await ImagePicker.requestMediaLibraryPermissionsAsync();

    if (!permissionResult.granted) {
      appAlert.alert(
        "Cần cấp quyền",
        "Hãy cho phép truy cập thư viện ảnh để chọn ảnh nhóm.",
      );
      return;
    }

    const result = await ImagePicker.launchImageLibraryAsync({
      allowsEditing: true,
      aspect: [1, 1],
      mediaTypes: ["images"],
      quality: 0.8,
    });

    if (result.canceled || result.assets.length === 0) {
      return;
    }

    const selectedAsset = result.assets[0];

    if (selectedAsset.uri) {
      setGroupImageFile({
        mimeType: selectedAsset.mimeType,
        name: selectedAsset.fileName,
        uri: selectedAsset.uri,
      });
    }
  };

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
      appToast.error(t("community.groupSettings.missingGroupIdSaveError"));
      return;
    }

    if (!normalizedEditableGroupName) {
      appToast.info(t("community.groupSettings.nameRequiredInfo"));
      return;
    }

    if (editableRequiredApproval === null) {
      appToast.info(t("community.groupSettings.approvalRequiredInfo"));
      return;
    }

    const accessToken = authSession.isAuthenticated
      ? await getValidAccessToken()
      : null;

    if (!accessToken) {
      appToast.error(t("community.groupSettings.loginRequiredSave"));
      return;
    }

    setIsSaving(true);
    setErrorMessage(null);

    try {
      const updatedGroup = await updateCommunityGroup({
        accessToken,
        groupId: effectiveGroupId,
        groupName: normalizedEditableGroupName,
        imageFile: groupImageFile,
        requiredApproval: editableRequiredApproval,
        tokenType: authSession.tokenType ?? undefined,
      });

      const cachedUpdatedGroup = cacheCommunityGroupSession({
        ...updatedGroup,
        source: cachedGroupSession?.source ?? "listed",
      });

      setGroupDetail(cachedUpdatedGroup ?? updatedGroup);
      setErrorMessage(null);
      appToast.success(t("community.groupSettings.saveSuccessToast"));
      router.back();
    } catch (error) {
      const nextErrorMessage =
        error instanceof Error
          ? error.message
          : t("community.groupSettings.saveErrorFallback");

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
        message={t("community.groupSettings.loadingMessage")}
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
              errorMessage ?? t("community.groupSettings.noDataErrorDescription")
            }
            icon="error"
            onPress={() => {
              setRetryNonce((currentValue) => currentValue + 1);
            }}
            title={t("community.groupSettings.loadErrorTitle")}
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
            className="text-[16px] font-bold"
            style={{ color: palette.primaryText, lineHeight: lineHeightFor(16) }}
          >
            {t("community.groupSettings.headerTitle")}
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
                className="text-[13px] font-semibold"
                style={{ color: palette.accentStrong, lineHeight: lineHeightFor(13) }}
              >
                {t("common.save")}
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
              style={{ color: "#D97A55", lineHeight: bodyLineHeightFor(12) }}
            >
              {errorMessage}
            </Text>
          </View>
        ) : null}

        <View className="flex-row items-center">
          <Pressable
            className="h-20 w-20 items-center justify-center overflow-hidden rounded-[22px]"
            onPress={() => {
              void handleSelectGroupImage();
            }}
            style={({ pressed }) => ({
              backgroundColor: palette.accentSoft,
              opacity: pressed ? 0.85 : 1,
            })}
          >
            {groupImageFile?.uri || readMeaningfulText(displayGroup.imageUrl) ? (
              <Image
                contentFit="cover"
                source={{
                  uri: groupImageFile?.uri ?? (displayGroup.imageUrl as string),
                }}
                style={{ height: "100%", width: "100%" }}
              />
            ) : (
              <SymbolView
                name={{
                  android: "image",
                  ios: "photo.fill",
                  web: "image",
                }}
                size={26}
                tintColor={palette.accentStrong}
              />
            )}

            <View
              className="absolute bottom-1 right-1 h-6 w-6 items-center justify-center rounded-full border-2 border-white"
              style={{ backgroundColor: palette.accentStrong }}
            >
              <SymbolView
                name={{
                  android: "edit",
                  ios: "pencil",
                  web: "edit",
                }}
                size={11}
                tintColor="#FFFFFF"
              />
            </View>
          </Pressable>

          <View className="ml-3 flex-1">
            <Text
              className="px-1 text-[16px] font-semibold"
              style={{ color: palette.mutedText, lineHeight: bodyLineHeightFor(16) }}
            >
              Tên nhóm
            </Text>

            <View className="mt-1.5">
              <FieldShell>
                <TextInput
                  className="px-0 py-0 text-[14px] font-normal"
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
            </View>
          </View>
        </View>

        <Text
          className="mt-2 px-1 text-[12px]"
          style={{ color: palette.mutedText, lineHeight: bodyLineHeightFor(12) }}
        >
          {t("community.groupSettings.groupNameHelperText")}
        </Text>

        <View className="mt-4">
          <Text
            className="px-1 text-[16px] font-semibold"
            style={{ color: palette.mutedText, lineHeight: bodyLineHeightFor(16) }}
          >
            Yêu cầu quyền tham gia
          </Text>
          <View className="mt-1.5 flex-row gap-2">
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
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}
