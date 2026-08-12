import { AppLoadingScreen } from "@/components/ui/app-loading-screen";
import { appAlert } from "@/components/ui/app-dialog";
import { UserAvatar } from "@/components/ui/user-avatar";
import { SymbolView } from "@/components/ui/symbol-view";
import { getValidAccessToken, useAuthSession } from "@/features/auth/hooks/use-auth-session";
import { deletePostPermanent } from "@/features/home/api/delete-post-permanent";
import { restorePost } from "@/features/home/api/restore-post";
import { ReviewDeleteDialog } from "@/features/home/components/review-delete-dialog";
import { getMyProfile } from "@/features/profile/api/get-me";
import { adjustCurrentProfileCount } from "@/features/profile/data/current-profile-store";
import { getMyProfilePostsPage } from "@/features/profile/api/get-profile-posts";
import type { ProfilePost } from "@/features/profile/types";
import { bodyTextStyle, textStyle } from "@/lib/text-scale";
import { useFocusEffect, useRouter } from "expo-router";
import { useCallback, useRef, useState } from "react";
import {
  Modal,
  Pressable,
  RefreshControl,
  ScrollView,
  Text,
  View,
} from "react-native";
import {
  SafeAreaView,
  useSafeAreaInsets,
} from "react-native-safe-area-context";

const restoreDialogImage = require("../../../../assets/images/restore.png");
const restoreConfirmGradient = ["#F29AC0", "#EA6BA3", "#DF4E91"] as const;

export default function CommunityTrashScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const authSession = useAuthSession();
  const [deletedPosts, setDeletedPosts] = useState<ProfilePost[]>([]);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [currentUserAvatarUri, setCurrentUserAvatarUri] = useState<string | null>(null);
  const [menuPost, setMenuPost] = useState<ProfilePost | null>(null);
  const [postPendingRestore, setPostPendingRestore] = useState<ProfilePost | null>(null);
  const [postPendingPermanentDeletion, setPostPendingPermanentDeletion] =
    useState<ProfilePost | null>(null);
  const [isDeletingPermanently, setIsDeletingPermanently] = useState(false);
  const [isRestoringPostId, setIsRestoringPostId] = useState<string | null>(null);
  const [selectedPostIds, setSelectedPostIds] = useState<string[]>([]);
  const activeRequestIdRef = useRef(0);

  const handleBack = () => {
    if (router.canGoBack()) {
      router.back();
      return;
    }

    router.replace("/bookings");
  };

  const loadDeletedPosts = useCallback(
    async (options?: { isRefreshing?: boolean }) => {
      const refreshing = options?.isRefreshing === true;
      const requestId = activeRequestIdRef.current + 1;
      activeRequestIdRef.current = requestId;

      if (refreshing) {
        setIsRefreshing(true);
      } else {
        setIsLoading(true);
      }

      try {
        if (!authSession.isAuthenticated) {
          if (requestId !== activeRequestIdRef.current) {
            return;
          }

          setDeletedPosts([]);
          setErrorMessage("Bạn cần đăng nhập để xem các bài viết đã xóa.");
          return;
        }

        const accessToken = await getValidAccessToken();

        if (!accessToken) {
          if (requestId !== activeRequestIdRef.current) {
            return;
          }

          setDeletedPosts([]);
          setErrorMessage("Phiên đăng nhập đã hết hạn. Vui lòng đăng nhập lại.");
          return;
        }

        const [postsResult, profileResult] = await Promise.allSettled([
          getMyProfilePostsPage({
            accessToken,
            page: 0,
            size: 10,
            sort: ["createdAt,DESC"],
            status: "DELETED",
            tokenType: authSession.tokenType,
          }),
          getMyProfile({
            accessToken,
            tokenType: authSession.tokenType,
          }),
        ]);

        if (postsResult.status !== "fulfilled") {
          throw postsResult.reason;
        }

        if (requestId !== activeRequestIdRef.current) {
          return;
        }

        setDeletedPosts(postsResult.value.content);
        setSelectedPostIds([]);
        setCurrentUserAvatarUri(
          profileResult.status === "fulfilled" ? profileResult.value.avatar : null,
        );
        setErrorMessage(null);
      } catch (error) {
        if (requestId !== activeRequestIdRef.current) {
          return;
        }

        setDeletedPosts([]);
        setErrorMessage(
          error instanceof Error
            ? error.message
            : "Không thể tải thùng rác lúc này.",
        );
      } finally {
        if (requestId !== activeRequestIdRef.current) {
          return;
        }

        if (refreshing) {
          setIsRefreshing(false);
        } else {
          setIsLoading(false);
        }
      }
    },
    [authSession.isAuthenticated, authSession.tokenType],
  );

  useFocusEffect(
    useCallback(() => {
      void loadDeletedPosts();

      return () => {
        activeRequestIdRef.current += 1;
      };
    }, [loadDeletedPosts]),
  );

  const handleRefresh = useCallback(() => {
    void loadDeletedPosts({ isRefreshing: true });
  }, [loadDeletedPosts]);

  const groupedDeletedPosts = groupDeletedPostsByDate(deletedPosts);
  const isAllSelected =
    deletedPosts.length > 0 && selectedPostIds.length === deletedPosts.length;

  const togglePostSelection = useCallback((postId: string) => {
    setSelectedPostIds((current) =>
      current.includes(postId)
        ? current.filter((id) => id !== postId)
        : [...current, postId],
    );
  }, []);

  const toggleSelectAll = useCallback(() => {
    setSelectedPostIds((current) =>
      current.length === deletedPosts.length ? [] : deletedPosts.map((post) => post.id),
    );
  }, [deletedPosts]);

  const handleRestorePost = useCallback((post: ProfilePost) => {
    setMenuPost(null);
    setPostPendingRestore(post);
  }, []);

  const handleCancelRestorePost = useCallback(() => {
    if (isRestoringPostId) {
      return;
    }

    setPostPendingRestore(null);
  }, [isRestoringPostId]);

  const confirmRestorePost = useCallback(
    async (post: ProfilePost) => {
      const postId = Number(post.id);

      if (!Number.isInteger(postId) || postId <= 0) {
        setMenuPost(null);
        appAlert.alert(
          "Không thể khôi phục",
          "Không xác định được bài viết cần khôi phục.",
        );
        return;
      }

      if (isRestoringPostId === post.id) {
        return;
      }

      if (!authSession.isAuthenticated) {
        setMenuPost(null);
        appAlert.alert(
          "Cần đăng nhập",
          "Bạn cần đăng nhập để khôi phục bài viết.",
        );
        return;
      }

      const accessToken = await getValidAccessToken();

      if (!accessToken) {
        setMenuPost(null);
        appAlert.alert(
          "Phiên đăng nhập hết hạn",
          "Vui lòng đăng nhập lại trước khi khôi phục bài viết.",
        );
        return;
      }

      setIsRestoringPostId(post.id);

      try {
        await restorePost({
          accessToken,
          postId,
          tokenType: authSession.tokenType,
        });
        adjustCurrentProfileCount("totalPosts", 1);
        setPostPendingRestore(null);
        await loadDeletedPosts({ isRefreshing: true });
      } catch (error) {
        appAlert.alert(
          "Không thể khôi phục bài viết",
          error instanceof Error
            ? error.message
            : "Đã có lỗi xảy ra khi khôi phục bài viết.",
        );
      } finally {
        setIsRestoringPostId(null);
      }
    },
    [
      authSession.isAuthenticated,
      authSession.tokenType,
      isRestoringPostId,
      loadDeletedPosts,
    ],
  );

  const handleDeletePost = useCallback((post: ProfilePost) => {
    setMenuPost(null);
    setPostPendingPermanentDeletion(post);
  }, []);

  const handleCancelPermanentDelete = useCallback(() => {
    if (isDeletingPermanently) {
      return;
    }

    setPostPendingPermanentDeletion(null);
  }, [isDeletingPermanently]);

  const confirmPermanentDelete = useCallback(async () => {
    const post = postPendingPermanentDeletion;
    const postId = Number(post?.id ?? "");

    if (!post || !Number.isInteger(postId) || postId <= 0) {
      setPostPendingPermanentDeletion(null);
      appAlert.alert("Không thể xóa", "Không xác định được bài viết cần xóa.");
      return;
    }

    if (!authSession.isAuthenticated) {
      appAlert.alert(
        "Cần đăng nhập",
        "Bạn cần đăng nhập để xóa vĩnh viễn bài viết.",
      );
      return;
    }

    const accessToken = await getValidAccessToken();

    if (!accessToken) {
      appAlert.alert(
        "Phiên đăng nhập hết hạn",
        "Vui lòng đăng nhập lại trước khi xóa vĩnh viễn bài viết.",
      );
      return;
    }

    setIsDeletingPermanently(true);

    try {
      await deletePostPermanent({
        accessToken,
        postId,
        tokenType: authSession.tokenType,
      });
      setPostPendingPermanentDeletion(null);
      await loadDeletedPosts();
    } catch (error) {
      appAlert.alert(
        "Không thể xóa bài viết",
        error instanceof Error
          ? error.message
          : "Đã có lỗi xảy ra khi xóa vĩnh viễn bài viết.",
      );
    } finally {
      setIsDeletingPermanently(false);
    }
  }, [
    authSession.isAuthenticated,
    authSession.tokenType,
    loadDeletedPosts,
    postPendingPermanentDeletion,
  ]);

  if (isLoading) {
    return <AppLoadingScreen />;
  }

  return (
    <SafeAreaView className="flex-1 bg-white" edges={["left", "right"]}>
      <View
        className="flex-row items-center bg-white px-4 pb-3"
        style={{ paddingTop: insets.top + 10 }}
      >
        <Pressable
          accessibilityLabel="Quay lại"
          className="h-10 w-10 items-center justify-center"
          onPress={handleBack}
        >
          <SymbolView
            name={{
              ios: "chevron.left",
              android: "arrow_back",
              web: "arrow_back",
            }}
            size={18}
            tintColor="#2B2233"
          />
        </Pressable>

        <Text className="flex-1 text-center text-[17px] font-bold text-[#2B2233]">
          Thùng rác
        </Text>
        <View className="h-10 w-10" />
      </View>

      <ScrollView
        className="flex-1"
        contentContainerStyle={{
          paddingBottom: Math.max(insets.bottom, 20) + 20,
        }}
        refreshControl={
          <RefreshControl
            colors={["#EB489B"]}
            refreshing={isRefreshing}
            tintColor="#EB489B"
            onRefresh={handleRefresh}
          />
        }
        showsVerticalScrollIndicator={false}
      >
        {errorMessage ? (
          <View className="mt-4 bg-white px-6 py-8">
            <Text className="text-center text-[15px] font-bold text-[#2B2233]" style={textStyle(15)}>
              Không tải được thùng rác
            </Text>
            <Text
              className="mt-2 text-center text-[13px] text-[#8E869A]"
              style={bodyTextStyle(13)}
            >
              {errorMessage}
            </Text>
            <Pressable
              className="mt-5 self-center rounded-full bg-[#EB489B] px-5 py-3"
              onPress={() => {
                void loadDeletedPosts();
              }}
            >
              <Text className="text-[13px] font-bold text-white" style={textStyle(13)}>
                Thử lại
              </Text>
            </Pressable>
          </View>
        ) : deletedPosts.length === 0 ? (
          <View
            className="flex-1 items-center justify-center px-4"
            style={{ minHeight: 320 }}
          >
            <Text
              className="text-center text-[15px] text-[#7B7384]"
              style={textStyle(15)}
            >
              Không có mục nào
            </Text>
          </View>
        ) : (
          <View>
            <Pressable
              className="flex-row items-center gap-3 border-b border-[#E9E6ED] px-4 py-3"
              onPress={toggleSelectAll}
            >
              <SelectionCheckbox checked={isAllSelected} />
              <Text className="text-[15px] font-semibold text-[#5F5867]" style={textStyle(15)}>
                Tất cả
              </Text>
            </Pressable>

            {groupedDeletedPosts.map((group) => (
              <View key={group.label}>
                <Text
                  className="px-4 pb-2 pt-4 text-[16px] font-black text-[#2B2233]"
                  style={textStyle(16)}
                >
                  {group.label}
                </Text>

                {group.posts.map((post) => {
                  const mediaCount = post.medias.length;
                  const previewText = post.text.trim() || "Bài viết không có nội dung văn bản.";
                  const isSelected = selectedPostIds.includes(post.id);
                  const remainingDays = getTrashRemainingDays(post.createdAt);
                  const summaryText =
                    mediaCount > 0
                      ? `${post.displayName || post.username} đã thêm ${mediaCount} ảnh mới.`
                      : `${post.displayName || post.username} đã thêm bài viết mới.`;

                  return (
                    <View key={post.id} className="flex-row gap-3 px-4 py-3">
                      <Pressable
                        className="pt-1"
                        onPress={() => {
                          togglePostSelection(post.id);
                        }}
                      >
                        <SelectionCheckbox checked={isSelected} />
                      </Pressable>

                      <View className="flex-1 border-b border-[#EFEAF3] pb-3">
                        <View className="flex-row items-start">
                          <View className="mr-3">
                            <UserAvatar
                              displayName={post.displayName || post.username}
                              size={48}
                              uri={currentUserAvatarUri}
                              username={post.username}
                            />
                          </View>

                          <View className="flex-1 pr-3">
                            <Text
                              className="text-[15px] font-semibold text-[#2B2233]"
                              style={textStyle(15)}
                            >
                              {summaryText}
                            </Text>
                            <Text
                              className="mt-1 text-[14px] text-[#5F5867]"
                              numberOfLines={3}
                              style={bodyTextStyle(14)}
                            >
                              {previewText}
                            </Text>
                            <View className="mt-1 flex-row items-center">
                              <SymbolView
                                name={{
                                  ios: "trash",
                                  android: "delete_outline",
                                  web: "delete_outline",
                                }}
                                size={12}
                                tintColor="#8C8594"
                              />
                              <Text
                                className="ml-1 text-[12px] text-[#8C8594]"
                                style={textStyle(12)}
                              >
                                {`Còn ${remainingDays} ngày`}
                              </Text>
                            </View>
                          </View>

                          <View className="items-end">
                            <Pressable
                              className="h-7 w-7 items-center justify-center"
                              onPress={() => {
                                setMenuPost(post);
                              }}
                            >
                              <SymbolView
                                name={{
                                  ios: "ellipsis",
                                  android: "more_horiz",
                                  web: "more_horiz",
                                }}
                                size={16}
                                tintColor="#8C8594"
                              />
                            </Pressable>
                          </View>
                        </View>
                      </View>
                    </View>
                  );
                })}
              </View>
            ))}
          </View>
        )}
      </ScrollView>

      <TrashPostOptionsSheet
        bottomInset={insets.bottom}
        onClose={() => {
          setMenuPost(null);
        }}
        onDelete={handleDeletePost}
        onRestore={handleRestorePost}
        post={menuPost}
        visible={menuPost !== null}
      />

      <ReviewDeleteDialog
        borderlessButtons
        confirmGradient={restoreConfirmGradient}
        confirmIcon={{
          ios: "arrow.uturn.backward",
          android: "restore",
          web: "restore",
        }}
        confirmLabel="Khôi phục"
        description="Bài viết này sẽ được khôi phục và hiển thị lại trong danh sách bài viết của bạn."
        dismissAccessibilityLabel="Đóng xác nhận khôi phục"
        imageContentFit="contain"
        imageSource={restoreDialogImage}
        imageStyle={{
          alignSelf: "center",
          height: 96,
          marginTop: 14,
          width: 112,
        }}
        isDeleting={isRestoringPostId === postPendingRestore?.id}
        onCancel={handleCancelRestorePost}
        onConfirm={() => {
          if (postPendingRestore) {
            void confirmRestorePost(postPendingRestore);
          }
        }}
        title="Khôi phục bài viết?"
        visible={postPendingRestore !== null}
      />

      <ReviewDeleteDialog
        borderlessButtons
        confirmLabel="Xóa vĩnh viễn"
        description="Bài viết này sẽ bị xóa vĩnh viễn và không thể khôi phục lại."
        isDeleting={isDeletingPermanently}
        onCancel={handleCancelPermanentDelete}
        onConfirm={() => {
          void confirmPermanentDelete();
        }}
        title="Xóa bài viết vĩnh viễn?"
        visible={postPendingPermanentDeletion !== null}
      />
    </SafeAreaView>
  );
}

function SelectionCheckbox({ checked }: { checked: boolean }) {
  return (
    <View
      className={`h-5 w-5 items-center justify-center rounded-[6px] border ${
        checked ? "border-[#EB489B] bg-[#EB489B]" : "border-[#B8B1C0] bg-white"
      }`}
    >
      {checked ? (
        <SymbolView
          name={{
            ios: "checkmark",
            android: "check",
            web: "check",
          }}
          size={12}
          tintColor="#FFFFFF"
        />
      ) : null}
    </View>
  );
}

function groupDeletedPostsByDate(posts: ProfilePost[]) {
  const groups = new Map<string, ProfilePost[]>();

  for (const post of posts) {
    const label = formatTrashGroupDate(post.createdAt);
    const currentGroup = groups.get(label) ?? [];
    currentGroup.push(post);
    groups.set(label, currentGroup);
  }

  return Array.from(groups.entries()).map(([label, groupedPosts]) => ({
    label,
    posts: groupedPosts,
  }));
}

function parseTrashDate(value: string | null) {
  const parsedDate = value ? new Date(value) : null;

  if (!parsedDate || Number.isNaN(parsedDate.getTime())) {
    return null;
  }

  return parsedDate;
}

function formatTrashGroupDate(value: string | null) {
  const parsedDate = parseTrashDate(value);

  if (!parsedDate) {
    return "Không rõ ngày";
  }

  const monthNames = [
    "Tháng 1",
    "Tháng 2",
    "Tháng 3",
    "Tháng 4",
    "Tháng 5",
    "Tháng 6",
    "Tháng 7",
    "Tháng 8",
    "Tháng 9",
    "Tháng 10",
    "Tháng 11",
    "Tháng 12",
  ];

  return `${parsedDate.getDate()} ${monthNames[parsedDate.getMonth()] ?? ""} ${parsedDate.getFullYear()}`;
}

function getTrashRemainingDays(value: string | null) {
  const parsedDate = parseTrashDate(value);

  if (!parsedDate) {
    return 30;
  }

  const expiresAt = parsedDate.getTime() + 30 * 24 * 60 * 60 * 1000;
  const remainingMs = expiresAt - Date.now();
  const remainingDays = Math.ceil(remainingMs / (24 * 60 * 60 * 1000));

  return Math.max(0, remainingDays);
}

function TrashPostOptionsSheet({
  bottomInset,
  onClose,
  onDelete,
  onRestore,
  post,
  visible,
}: {
  bottomInset: number;
  onClose: () => void;
  onDelete: (post: ProfilePost) => void;
  onRestore: (post: ProfilePost) => void;
  post: ProfilePost | null;
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
            <TrashPostMenuRow
              isLast={false}
              icon={{
                ios: "arrow.uturn.backward",
                android: "restore",
                web: "restore",
              }}
              label="Khôi phục bài viết"
              onPress={() => {
                if (post) {
                  void onRestore(post);
                }
              }}
            />
            <TrashPostMenuRow
              destructive
              isLast
              icon={{
                ios: "trash",
                android: "delete_outline",
                web: "delete_outline",
              }}
              label="Xóa"
              onPress={() => {
                if (post) {
                  onDelete(post);
                }
              }}
            />
          </View>
        </View>
      </View>
    </Modal>
  );
}

function TrashPostMenuRow({
  destructive = false,
  icon,
  isLast,
  label,
  onPress,
}: {
  destructive?: boolean;
  icon: {
    android: string;
    ios: string;
    web: string;
  };
  isLast: boolean;
  label: string;
  onPress: () => void;
}) {
  const labelColor = destructive ? "#C24F3B" : "#202124";

  return (
    <Pressable
      className={`flex-row items-start gap-2.5 py-2.5 ${isLast ? "" : "border-b border-[#E7E5EF]"}`}
      onPress={onPress}
    >
      <View className="w-6 items-center pt-px">
        <SymbolView name={icon} size={19} tintColor={labelColor} />
      </View>
      <View className="min-w-0 flex-1">
        <Text
          className="text-[15px] font-normal"
          style={[textStyle(15), { color: labelColor }]}
        >
          {label}
        </Text>
      </View>
    </Pressable>
  );
}
