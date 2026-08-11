import { appToast, type AppToastTone } from "@/components/ui/app-toast";
import { SymbolView } from "@/components/ui/symbol-view";
import { ScreenHorizontalPadding } from "@/constants/theme";
import {
  getValidAccessToken,
  useAuthSession,
} from "@/features/auth/hooks/use-auth-session";
import {
  getCommunityPostVisibility,
  setCommunityPostVisibility,
} from "@/features/community/data/community-post-visibility-store";
import { getPostById } from "@/features/home/api/get-post-by-id";
import { updatePost } from "@/features/home/api/update-post";
import { cacheProfilePost } from "@/features/profile/data/profile-post-cache";
import { mapCreatedPostToProfilePost } from "@/features/profile/lib/map-created-post-to-profile-post";
import {
  getPostVisibilityDescription,
  getPostVisibilityIcon,
  getPostVisibilityLabel,
  normalizePostVisibilityValue,
  postVisibilityOptions,
  type PostVisibilityValue,
} from "@/lib/post-visibility";
import {
  useLocalSearchParams,
  useRouter,
} from "expo-router";
import { StatusBar } from "expo-status-bar";
import { useEffect, useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import {
  ActivityIndicator,
  Alert,
  Keyboard,
  Pressable,
  Text,
  View,
} from "react-native";
import { SafeAreaView, useSafeAreaInsets } from "react-native-safe-area-context";
import { bodyLineHeightFor, lineHeightFor } from "@/lib/text-scale";

type CommunityPostVisibilityParams = {
  mode?: string | string[];
  postId?: string | string[];
};

type DeferredVisibilityToast = {
  message: string;
  tone: AppToastTone;
};

const footerShadowStyle = {
  elevation: 14,
  shadowColor: "rgba(24, 24, 27, 0.12)",
  shadowOffset: { width: 0, height: -6 },
  shadowOpacity: 1,
  shadowRadius: 16,
} as const;

const palette = {
  accent: "#EB489B",
  accentStrong: "#D95B8D",
  accentSoft: "#FFE8F0",
  border: "#E3E7ED",
  errorBorder: "#F7C2D0",
  errorSoft: "#FFF4F6",
  errorText: "#C2416C",
  iconSoft: "#FFF1F6",
  primaryText: "#2B2233",
} as const;

function readMeaningfulText(value?: string | null) {
  if (typeof value !== "string") {
    return null;
  }

  const trimmedValue = value.trim();

  if (!trimmedValue) {
    return null;
  }

  return ["string", "null", "undefined"].includes(trimmedValue.toLowerCase())
    ? null
    : trimmedValue;
}

function readSearchParamValue(
  value?: string | string[] | null,
): string | null {
  if (Array.isArray(value)) {
    return readSearchParamValue(value[0] ?? null);
  }

  return readMeaningfulText(value);
}

function SelectionIndicator({ selected }: { selected: boolean }) {
  return (
    <View
      className="h-[22px] w-[22px] items-center justify-center rounded-full"
      style={{
        borderColor: selected ? palette.accent : "#D1D5DB",
        borderWidth: 2,
      }}
    >
      {selected ? (
        <View
          className="h-[10px] w-[10px] rounded-full"
          style={{ backgroundColor: palette.accent }}
        />
      ) : null}
    </View>
  );
}

function VisibilityOptionRow({
  isSelected,
  onPress,
  value,
}: {
  isSelected: boolean;
  onPress: () => void;
  value: PostVisibilityValue;
}) {
  return (
    <Pressable
      accessibilityRole="radio"
      accessibilityState={{ selected: isSelected }}
      className="flex-row items-center rounded-[16px] border px-3.5 py-2.5"
      onPress={onPress}
      style={{
        backgroundColor: isSelected ? palette.accentSoft : "#FFFFFF",
        borderColor: isSelected ? "#F5B5CB" : palette.border,
      }}
    >
      <View
        className="h-10 w-10 items-center justify-center rounded-full"
        style={{ backgroundColor: palette.iconSoft }}
      >
        <SymbolView
          name={getPostVisibilityIcon(value)}
          size={18}
          tintColor={isSelected ? palette.accent : "#111827"}
        />
      </View>

      <View className="ml-3 flex-1">
        <Text
          className="text-[13px] font-medium text-[#111827]"
          style={{ lineHeight: lineHeightFor(13) }}
        >
          {getPostVisibilityLabel(value)}
        </Text>
        <Text className="mt-0.5 text-[11px] text-[#6B7280]" style={{ lineHeight: bodyLineHeightFor(11) }}>
          {getPostVisibilityDescription(value)}
        </Text>
      </View>

      <SelectionIndicator selected={isSelected} />
    </Pressable>
  );
}

export default function CommunityPostVisibilityScreen() {
  const { t } = useTranslation();
  const router = useRouter();
  const params = useLocalSearchParams<CommunityPostVisibilityParams>();
  const authSession = useAuthSession();
  const insets = useSafeAreaInsets();
  const isEditMode = readSearchParamValue(params.mode)?.toLowerCase() === "edit";
  const resolvedPostId = Number.parseInt(
    readSearchParamValue(params.postId) ?? "",
    10,
  );
  const [selectedVisibility, setSelectedVisibility] = useState<PostVisibilityValue>(
    () => getCommunityPostVisibility(),
  );
  // Lưu quyền riêng tư ban đầu để biết bài có thực sự đổi sang công khai hay
  // không — public giữ nguyên public thì không cần chờ duyệt lại.
  const [initialVisibility, setInitialVisibility] =
    useState<PostVisibilityValue | null>(null);
  const [editingPostContent, setEditingPostContent] = useState<string | null>(
    null,
  );
  const [isLoadingPost, setIsLoadingPost] = useState(isEditMode);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const isLeavingScreenRef = useRef(false);
  const pendingToastRef = useRef<DeferredVisibilityToast | null>(null);

  function showDeferredToast(toast: DeferredVisibilityToast) {
    if (toast.tone === "error") {
      appToast.error(toast.message);
      return;
    }

    if (toast.tone === "success") {
      appToast.success(toast.message);
      return;
    }

    appToast.info(toast.message);
  }

  function leaveScreen(options?: { toast?: DeferredVisibilityToast | null }) {
    if (options?.toast) {
      pendingToastRef.current = options.toast;
    }

    if (isLeavingScreenRef.current) {
      return;
    }

    isLeavingScreenRef.current = true;
    Keyboard.dismiss();

    requestAnimationFrame(() => {
      requestAnimationFrame(() => {
        if (router.canGoBack()) {
          router.back();
        } else {
          router.replace("/bookings");
        }

        const pendingToast = pendingToastRef.current;
        pendingToastRef.current = null;

        setTimeout(() => {
          isLeavingScreenRef.current = false;

          if (pendingToast) {
            showDeferredToast(pendingToast);
          }
        }, 40);
      });
    });
  }

  useEffect(() => {
    if (!isEditMode) {
      return;
    }

    let isActive = true;

    async function loadPost() {
      if (!Number.isInteger(resolvedPostId) || resolvedPostId <= 0) {
        if (!isActive) {
          return;
        }

        setLoadError(t("community.postVisibility.missingPostIdError"));
        setIsLoadingPost(false);
        return;
      }

      const accessToken = await getValidAccessToken();

      if (!accessToken) {
        if (!isActive) {
          return;
        }

        setLoadError(t("community.postVisibility.sessionExpiredLoadError"));
        setIsLoadingPost(false);
        return;
      }

      setIsLoadingPost(true);
      setLoadError(null);

      try {
        const post = await getPostById({
          accessToken,
          postId: resolvedPostId,
          tokenType: authSession.tokenType,
        });

        if (!isActive) {
          return;
        }

        const loadedVisibility = normalizePostVisibilityValue(post.visibility);

        setEditingPostContent(readMeaningfulText(post.content) ?? "");
        setSelectedVisibility(loadedVisibility);
        setInitialVisibility(loadedVisibility);
      } catch (error) {
        if (!isActive) {
          return;
        }

        setLoadError(
          error instanceof Error
            ? error.message
            : t("community.postVisibility.loadErrorFallback"),
        );
      } finally {
        if (isActive) {
          setIsLoadingPost(false);
        }
      }
    }

    void loadPost();

    return () => {
      isActive = false;
    };
  }, [authSession.tokenType, isEditMode, resolvedPostId, t]);

  async function handleSubmit() {
    if (!isEditMode) {
      setCommunityPostVisibility(selectedVisibility);
      router.back();
      return;
    }

    if (!authSession.isAuthenticated) {
      Alert.alert(
        t("community.feed.loginRequiredTitle"),
        t("community.postVisibility.loginRequiredMessage"),
      );
      return;
    }

    if (!Number.isInteger(resolvedPostId) || resolvedPostId <= 0) {
      Alert.alert(
        t("community.postVisibility.cannotUpdateTitle"),
        t("community.postVisibility.missingPostIdSubmitError"),
      );
      return;
    }

    if (editingPostContent === null) {
      Alert.alert(
        t("community.postVisibility.cannotUpdateTitle"),
        t("community.postVisibility.postDataNotReadyError"),
      );
      return;
    }

    const accessToken = await getValidAccessToken();

    if (!accessToken) {
      Alert.alert(
        t("community.feed.sessionExpiredTitle"),
        t("community.postVisibility.sessionExpiredSubmitMessage"),
      );
      return;
    }

    setIsSubmitting(true);

    try {
      const updatedPost = await updatePost({
        accessToken,
        content: editingPostContent,
        postId: resolvedPostId,
        tokenType: authSession.tokenType,
        visibility: selectedVisibility,
      });

      cacheProfilePost(mapCreatedPostToProfilePost(updatedPost));

      const updatedVisibility = normalizePostVisibilityValue(
        updatedPost.visibility,
      );
      const updatedStatus =
        readMeaningfulText(updatedPost.status)?.toUpperCase() ?? "";
      const wasAlreadyPublic = initialVisibility === "PUBLIC";
      // Riêng tư/bạn bè và public giữ nguyên public: không cần duyệt lại.
      // Chỉ chờ duyệt khi thực sự chuyển sang công khai và server báo PENDING.
      const needsApproval =
        updatedVisibility === "PUBLIC" &&
        !wasAlreadyPublic &&
        updatedStatus === "PENDING";

      leaveScreen({
        toast: {
          message: needsApproval
            ? "Đã cập nhật quyền riêng tư. Bài viết công khai đang chờ quản trị viên duyệt trước khi hiển thị."
            : "Đã cập nhật quyền riêng tư bài viết.",
          tone: needsApproval ? "info" : "success",
        },
      });
    } catch (error) {
      Alert.alert(
        t("community.postVisibility.cannotUpdateTitle"),
        error instanceof Error
          ? error.message
          : t("community.postVisibility.updateErrorFallback"),
      );
    } finally {
      if (!isLeavingScreenRef.current) {
        setIsSubmitting(false);
      }
    }
  }

  return (
    <View className="flex-1 bg-white">
      <StatusBar style="dark" />

      <SafeAreaView
        className="flex-1 bg-white"
        edges={["top", "left", "right"]}
      >
        <View
          className="border-b px-4 py-2.5"
          style={{ borderColor: palette.border }}
        >
          <View className="flex-row items-center justify-between">
            <Pressable
              className="h-9 w-9 items-center justify-center rounded-full"
              hitSlop={8}
              onPress={() => {
                router.back();
              }}
            >
              <SymbolView
                name={{
                  ios: "chevron.left",
                  android: "arrow_back",
                  web: "arrow_back",
                }}
                size={18}
                tintColor="#111827"
              />
            </Pressable>

            <View className="h-9 w-9" />
          </View>
        </View>

        <View className="flex-1">
          <View
            className="pb-2 pt-3"
            style={{ paddingHorizontal: ScreenHorizontalPadding }}
          >
            <Text
              className="text-[16px] font-semibold"
              style={{ color: palette.primaryText, lineHeight: lineHeightFor(16) }}
            >
              {isEditMode
                ? t("community.postVisibility.titleEdit")
                : t("community.postVisibility.titleCreate")}
            </Text>
            <Text
              className="mt-1 text-[13px] text-[#6F657A]"
              style={{ lineHeight: bodyLineHeightFor(13) }}
            >
              {isEditMode
                ? t("community.postVisibility.subtitleEdit")
                : t("community.postVisibility.subtitleCreate")}
            </Text>
          </View>

          {isEditMode && isLoadingPost ? (
            <View className="mt-8 items-center justify-center px-5">
              <ActivityIndicator color={palette.accent} size="small" />
              <Text className="mt-3 text-[13px] font-normal text-[#6B7280]">
                {t("community.postVisibility.loadingLabel")}
              </Text>
            </View>
          ) : loadError ? (
            <View
              className="mx-4 mt-4 rounded-[16px] border px-4 py-4"
              style={{ backgroundColor: palette.errorSoft, borderColor: palette.errorBorder }}
            >
              <Text
                className="text-[13px] font-medium"
                style={{ color: palette.errorText }}
              >
                {loadError}
              </Text>
            </View>
          ) : (
            <View className="gap-2 px-4">
              {postVisibilityOptions.map((option) => (
                <VisibilityOptionRow
                  key={option}
                  isSelected={selectedVisibility === option}
                  onPress={() => {
                    setSelectedVisibility(option);
                  }}
                  value={option}
                />
              ))}
            </View>
          )}
        </View>

        <View
          className="border-t bg-white px-4 pt-3"
          style={[
            footerShadowStyle,
            {
              borderColor: palette.border,
              paddingBottom: Math.max(insets.bottom + 10, 16),
            },
          ]}
        >
          <Text className="mb-3 text-[10px] text-[#9CA3AF]">
            {isEditMode
              ? t("community.postVisibility.footerNoteEdit")
              : t("community.postVisibility.footerNoteCreate")}
          </Text>

          <Pressable
            className="h-11 items-center justify-center rounded-[12px]"
            disabled={isSubmitting || (isEditMode && (isLoadingPost || !!loadError))}
            onPress={() => {
              void handleSubmit();
            }}
            style={({ pressed }) => ({
              backgroundColor: palette.accentStrong,
              opacity:
                isSubmitting || (isEditMode && (isLoadingPost || !!loadError))
                  ? 0.7
                  : pressed
                    ? 0.82
                    : 1,
            })}
          >
            {isSubmitting ? (
              <ActivityIndicator color="#FFFFFF" size="small" />
            ) : (
              <Text className="text-[13px] font-semibold text-white">
                {t("common.done")}
              </Text>
            )}
          </Pressable>
        </View>
      </SafeAreaView>
    </View>
  );
}
