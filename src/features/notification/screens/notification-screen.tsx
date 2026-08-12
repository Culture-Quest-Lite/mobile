import { SymbolView } from "@/components/ui/symbol-view";
import {
  getMyNotifications,
  markNotificationAsRead,
  type AppNotification,
} from "@/features/notification/api/notification-api";
import {
  getValidAccessToken,
  useAuthSession,
} from "@/features/auth/hooks/use-auth-session";
import { useFocusEffect, useRouter } from "expo-router";
import { useCallback, useState } from "react";
import {
  Pressable,
  RefreshControl,
  ScrollView,
  Text,
  View,
} from "react-native";
import { SafeAreaView, useSafeAreaInsets } from "react-native-safe-area-context";

import { AppLoadingScreen } from "@/components/ui/app-loading-screen";
import { lineHeightFor } from "@/lib/text-scale";

const unreadNotificationCardShadow = {
  shadowColor: "rgba(30, 50, 78, 0.10)",
  shadowOpacity: 1,
  shadowRadius: 18,
  shadowOffset: { width: 0, height: 8 },
  elevation: 5,
} as const;
const meaninglessNotificationValues = new Set([
  "",
  "string",
  "null",
  "undefined",
]);

function normalizeNotificationText(value: string) {
  return value.replace(/\s+/g, " ").trim();
}

function replaceAdminLabel(value: string) {
  return value.replace(/\badmin\b/giu, "Quản trị viên");
}

function stripNotificationReferenceIds(value: string) {
  return value
    .replace(
      /\b(đánh giá|bài viết|tuyến đường|bình luận|check[- ]?in)\s*#\d+\b/giu,
      "$1",
    )
    .replace(/\b(?:mã|id)\s*#?\d+\b/giu, "")
    .replace(/\s+#\d+\b/gu, "");
}

function removeMeaninglessReason(value: string) {
  return value
    .replace(
      /\s*(?:với\s+)?lý do:\s*(string|null|undefined)\b\.?/giu,
      ".",
    )
    .replace(/\s*lý do:\s*(?:string|null|undefined)\b\.?/giu, ".");
}

function humanizeNotificationCopy(value: string) {
  let nextValue = normalizeNotificationText(value);

  if (!nextValue) {
    return "";
  }

  nextValue = replaceAdminLabel(nextValue);
  nextValue = stripNotificationReferenceIds(nextValue);
  nextValue = removeMeaninglessReason(nextValue);
  nextValue = nextValue.replace(
    /\b(đánh giá|bài viết|tuyến đường|bình luận)\s+mà\s+bạn\b/giu,
    "$1 bạn đã",
  );
  nextValue = nextValue.replace(
    /\bđã bị Quản trị viên xử lý\b/giu,
    "đã được Quản trị viên xử lý",
  );
  nextValue = nextValue.replace(
    /\bđã bị hệ thống xử lý\b/giu,
    "đã được hệ thống xử lý",
  );
  nextValue = nextValue.replace(/\s+([,.:;!?])/g, "$1");
  nextValue = nextValue.replace(/([.!?])\s*\./g, "$1");
  nextValue = normalizeNotificationText(nextValue);

  if (/^[.!?]+$/.test(nextValue)) {
    return "";
  }

  return meaninglessNotificationValues.has(nextValue.toLowerCase())
    ? ""
    : nextValue;
}

function ensureNotificationSentence(value: string) {
  const normalizedValue = humanizeNotificationCopy(value);

  if (!normalizedValue) {
    return "";
  }

  return /[.!?]$/.test(normalizedValue)
    ? normalizedValue
    : `${normalizedValue}.`;
}

function getFormattedNotificationTitle(notification: AppNotification) {
  const normalizedTitle = humanizeNotificationCopy(notification.title);

  if (normalizedTitle) {
    return normalizedTitle;
  }

  return "Thông báo mới";
}

function getFormattedNotificationMessage(notification: AppNotification) {
  const normalizedMessage = ensureNotificationSentence(notification.message);

  if (normalizedMessage) {
    return normalizedMessage;
  }

  return "Bạn có một thông báo mới.";
}

function formatNotificationTime(value: string) {
  const date = new Date(value);

  if (Number.isNaN(date.getTime())) {
    return "";
  }

  return new Intl.DateTimeFormat("vi-VN", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  }).format(date);
}

function getNotificationIcon(type?: string | null) {
  const normalizedType = typeof type === "string" ? type.trim().toUpperCase() : "";

  if (normalizedType.includes("SUBSCRIPTION")) {
    return { ios: "crown.fill", android: "workspace_premium", web: "workspace_premium" } as const;
  }

  if (normalizedType.includes("ROUTE")) {
    return { ios: "map.fill", android: "route", web: "route" } as const;
  }

  if (normalizedType.includes("CHECK")) {
    return { ios: "mappin.circle.fill", android: "location_on", web: "location_on" } as const;
  }

  if (normalizedType.includes("EARN")) {
    return { ios: "star.fill", android: "stars", web: "stars" } as const;
  }

  return { ios: "bell.fill", android: "notifications", web: "notifications" } as const;
}

export default function NotificationScreen() {
  const router = useRouter();
  const authSession = useAuthSession();
  const insets = useSafeAreaInsets();
  const [notifications, setNotifications] = useState<AppNotification[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const loadNotifications = useCallback(async (refresh = false) => {
    if (!authSession.isAuthenticated) {
      setNotifications([]);
      setErrorMessage("Vui lòng đăng nhập để xem thông báo.");
      setIsLoading(false);
      setIsRefreshing(false);
      return;
    }

    if (refresh) {
      setIsRefreshing(true);
    } else {
      setIsLoading(true);
    }
    setErrorMessage(null);

    try {
      const accessToken = await getValidAccessToken();

      if (!accessToken) {
        throw new Error("Phiên đăng nhập đã hết hạn. Vui lòng đăng nhập lại.");
      }

      const response = await getMyNotifications(accessToken);
      setNotifications(Array.isArray(response.content) ? response.content : []);
    } catch (error) {
      setErrorMessage(
        error instanceof Error ? error.message : "Không thể tải thông báo.",
      );
    } finally {
      setIsLoading(false);
      setIsRefreshing(false);
    }
  }, [authSession.isAuthenticated]);

  useFocusEffect(
    useCallback(() => {
      void loadNotifications();
    }, [loadNotifications]),
  );

  const handleBack = () => {
    if (router.canGoBack()) {
      router.back();
      return;
    }

    router.replace("/home");
  };

  const handleNotificationPress = async (notification: AppNotification) => {
    if (notification.isRead) {
      return;
    }

    setNotifications((current) =>
      current.map((item) =>
        item.id === notification.id ? { ...item, isRead: true } : item,
      ),
    );

    try {
      const accessToken = await getValidAccessToken();

      if (!accessToken) {
        throw new Error("Phiên đăng nhập đã hết hạn.");
      }

      await markNotificationAsRead(notification.id, accessToken);
    } catch (error) {
      setNotifications((current) =>
        current.map((item) =>
          item.id === notification.id ? { ...item, isRead: false } : item,
        ),
      );
      setErrorMessage(
        error instanceof Error
          ? error.message
          : "Không thể đánh dấu thông báo đã đọc.",
      );
    }
  };

  return (
    <SafeAreaView className="flex-1 bg-[#F7F8FC]" edges={["left", "right"]}>
      <View
        className="flex-row items-center border-b border-[#ECE8F2] bg-white px-4 pb-4"
        style={{ paddingTop: insets.top + 10 }}
      >
        <Pressable
          accessibilityLabel="Quay lại"
          className="h-10 w-10 items-center justify-center rounded-full bg-[#F5F1F7]"
          onPress={handleBack}
        >
          <SymbolView
            name={{ ios: "chevron.left", android: "arrow_back", web: "arrow_back" }}
            size={18}
            tintColor="#2B2233"
          />
        </Pressable>

        <Text
          className="flex-1 text-center text-[20px] font-extrabold text-[#2B2233]"
          style={{ lineHeight: lineHeightFor(20) }}
        >
          Thông báo
        </Text>
        <View className="h-10 w-10" />
      </View>

      {isLoading ? (
        <AppLoadingScreen mode="embedded" message="Đang tải thông báo..." />
      ) : (
        <ScrollView
          className="flex-1"
          contentContainerStyle={{ padding: 16, paddingBottom: Math.max(insets.bottom, 20) + 20 }}
          refreshControl={
            <RefreshControl
              refreshing={isRefreshing}
              tintColor="#EB489B"
              onRefresh={() => void loadNotifications(true)}
            />
          }
          showsVerticalScrollIndicator={false}
        >
          {errorMessage ? (
            <View className="mb-4 rounded-2xl border border-[#FFD6E7] bg-[#FFF3F8] px-4 py-3">
              <Text className="text-[13px] leading-5 text-[#B72D6B]">{errorMessage}</Text>
            </View>
          ) : null}

          {notifications.length === 0 ? (
            <View className="items-center rounded-[28px] bg-white px-6 py-12">
              <View className="h-16 w-16 items-center justify-center rounded-full bg-[#FFF0F7]">
                <SymbolView
                  name={{ ios: "bell.slash", android: "notifications_off", web: "notifications_off" }}
                  size={28}
                  tintColor="#EB489B"
                />
              </View>
              <Text
                className="mt-4 text-[16px] font-semibold text-[#2B2233]"
                style={{ lineHeight: lineHeightFor(16) }}
              >
                Chưa có thông báo
              </Text>
              <Text
                className="mt-2 text-center text-[15px] text-[#8E869A]"
                style={{ lineHeight: lineHeightFor(15) }}
              >
                Những cập nhật về hành trình, điểm thưởng và đăng ký sẽ xuất hiện tại đây.
              </Text>
            </View>
          ) : (
            <View className="gap-3">
              {notifications.map((notification) => {
                const displayTitle = getFormattedNotificationTitle(notification);
                const displayMessage = getFormattedNotificationMessage(notification);

                return (
                  <Pressable
                    key={notification.id}
                    className="flex-row gap-3 rounded-[22px] border border-[#EEEAF2] bg-white p-4"
                    onPress={() => void handleNotificationPress(notification)}
                    style={
                      notification.isRead ? undefined : unreadNotificationCardShadow
                    }
                  >
                    <View className="h-11 w-11 items-center justify-center rounded-full bg-[#FFF0F7]">
                      <SymbolView
                        name={getNotificationIcon(notification.notificationType)}
                        size={20}
                        tintColor="#EB489B"
                      />
                    </View>

                    <View className="min-w-0 flex-1">
                      <View className="flex-row items-start gap-2">
                        <Text
                          className={`min-w-0 flex-1 text-[15px] ${
                            notification.isRead
                              ? "font-medium text-[#4A4251]"
                              : "font-semibold text-[#2B2233]"
                          }`}
                          numberOfLines={2}
                          style={{ lineHeight: lineHeightFor(15) }}
                        >
                          {displayTitle}
                        </Text>
                      </View>
                      <Text
                        className={`mt-1 text-[15px] ${
                          notification.isRead
                            ? "text-[#7A7282]"
                            : "text-[#665D70]"
                        }`}
                        style={{ lineHeight: lineHeightFor(15) }}
                      >
                        {displayMessage}
                      </Text>
                      <Text
                        className={`mt-2 text-[12px] ${
                          notification.isRead
                            ? "text-[#B1A9BA]"
                            : "text-[#A198AA]"
                        }`}
                        style={{ lineHeight: lineHeightFor(12) }}
                      >
                        {formatNotificationTime(notification.createdAt)}
                      </Text>
                    </View>
                  </Pressable>
                );
              })}
            </View>
          )}
        </ScrollView>
      )}
    </SafeAreaView>
  );
}
