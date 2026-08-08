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
import { useEffect, useState } from "react";
import {
  ActivityIndicator,
  Alert,
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

const footerShadowStyle = {
  elevation: 14,
  shadowColor: "rgba(24, 24, 27, 0.12)",
  shadowOffset: { width: 0, height: -6 },
  shadowOpacity: 1,
  shadowRadius: 16,
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
        borderColor: selected ? "#2563EB" : "#D1D5DB",
        borderWidth: 2,
      }}
    >
      {selected ? (
        <View className="h-[10px] w-[10px] rounded-full bg-[#2563EB]" />
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
        backgroundColor: isSelected ? "#EFF6FF" : "#FFFFFF",
        borderColor: isSelected ? "#BFDBFE" : "#E5E7EB",
      }}
    >
      <View className="h-10 w-10 items-center justify-center rounded-full bg-[#F8FAFC]">
        <SymbolView
          name={getPostVisibilityIcon(value)}
          size={18}
          tintColor={isSelected ? "#2563EB" : "#111827"}
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
  const [editingPostContent, setEditingPostContent] = useState<string | null>(
    null,
  );
  const [isLoadingPost, setIsLoadingPost] = useState(isEditMode);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

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

        setLoadError("Không xác định được bài viết cần cập nhật quyền riêng tư.");
        setIsLoadingPost(false);
        return;
      }

      const accessToken = await getValidAccessToken();

      if (!accessToken) {
        if (!isActive) {
          return;
        }

        setLoadError(
          "Phiên đăng nhập hết hạn. Vui lòng đăng nhập lại trước khi chỉnh sửa quyền riêng tư.",
        );
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

        setEditingPostContent(readMeaningfulText(post.content) ?? "");
        setSelectedVisibility(normalizePostVisibilityValue(post.visibility));
      } catch (error) {
        if (!isActive) {
          return;
        }

        setLoadError(
          error instanceof Error
            ? error.message
            : "Không thể tải bài viết để cập nhật quyền riêng tư.",
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
  }, [authSession.tokenType, isEditMode, resolvedPostId]);

  async function handleSubmit() {
    if (!isEditMode) {
      setCommunityPostVisibility(selectedVisibility);
      router.back();
      return;
    }

    if (!authSession.isAuthenticated) {
      Alert.alert(
        "Cần đăng nhập",
        "Bạn cần đăng nhập để chỉnh sửa quyền riêng tư bài viết.",
      );
      return;
    }

    if (!Number.isInteger(resolvedPostId) || resolvedPostId <= 0) {
      Alert.alert(
        "Không thể cập nhật",
        "Không xác định được bài viết cần chỉnh sửa quyền riêng tư.",
      );
      return;
    }

    if (editingPostContent === null) {
      Alert.alert(
        "Không thể cập nhật",
        "Dữ liệu bài viết chưa sẵn sàng. Vui lòng thử lại.",
      );
      return;
    }

    const accessToken = await getValidAccessToken();

    if (!accessToken) {
      Alert.alert(
        "Phiên đăng nhập hết hạn",
        "Vui lòng đăng nhập lại trước khi chỉnh sửa quyền riêng tư bài viết.",
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
      router.back();
    } catch (error) {
      Alert.alert(
        "Không thể cập nhật",
        error instanceof Error
          ? error.message
          : "Đã có lỗi xảy ra khi cập nhật quyền riêng tư bài viết.",
      );
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <View className="flex-1 bg-white">
      <StatusBar style="dark" />

      <SafeAreaView
        className="flex-1 bg-white"
        edges={["top", "left", "right"]}
      >
        <View className="border-b border-[#F2F4F7] px-4 py-2.5">
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
              className="text-[16px] font-semibold text-[#2B2233]"
              style={{ lineHeight: lineHeightFor(16) }}
            >
              {isEditMode
                ? "Ai có thể xem bài viết này?"
                : "Ai có thể xem bài viết của bạn?"}
            </Text>
            <Text
              className="mt-1 text-[13px] text-[#6F657A]"
              style={{ lineHeight: bodyLineHeightFor(13) }}
            >
              {isEditMode
                ? "Chọn đối tượng có thể xem bài viết này."
                : "Chọn đối tượng có thể xem bài viết bạn đang soạn trên cộng đồng."}
            </Text>
          </View>

          {isEditMode && isLoadingPost ? (
            <View className="mt-8 items-center justify-center px-5">
              <ActivityIndicator color="#2563EB" size="small" />
              <Text className="mt-3 text-[13px] font-normal text-[#6B7280]">
                Đang tải quyền riêng tư bài viết...
              </Text>
            </View>
          ) : loadError ? (
            <View className="mx-4 mt-4 rounded-[16px] border border-[#F5D0D6] bg-[#FFF7F7] px-4 py-4">
              <Text className="text-[13px] font-medium text-[#B42318]">
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
          className="border-t border-[#F2F4F7] bg-white px-4 pt-3"
          style={[
            footerShadowStyle,
            {
              paddingBottom: Math.max(insets.bottom + 10, 16),
            },
          ]}
        >
          <Text className="mb-3 text-[10px] text-[#9CA3AF]">
            {isEditMode
              ? "Thiết lập này sẽ cập nhật ngay cho bài viết."
              : "Thiết lập này áp dụng cho bài viết bạn đang soạn."}
          </Text>

          <Pressable
            className="h-11 items-center justify-center rounded-[12px] bg-[#2563EB]"
            disabled={isSubmitting || (isEditMode && (isLoadingPost || !!loadError))}
            onPress={() => {
              void handleSubmit();
            }}
            style={({ pressed }) => ({
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
              <Text className="text-[13px] font-semibold text-white">Xong</Text>
            )}
          </Pressable>
        </View>
      </SafeAreaView>
    </View>
  );
}
