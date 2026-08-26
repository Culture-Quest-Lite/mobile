import {
  useFocusEffect,
  useLocalSearchParams,
  useRouter,
  type Href,
} from "expo-router";
import { StatusBar } from "expo-status-bar";
import { useCallback, useMemo, useState } from "react";
import {
  ActivityIndicator,
  Image,
  ImageBackground,
  Modal,
  Pressable,
  Text as RNText,
  ScrollView,
  useWindowDimensions,
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
import { UserAvatar } from "@/components/ui/user-avatar";
import { PublicEnv } from "@/constants/env";
import {
  getValidAccessToken,
  useAuthSession,
} from "@/features/auth/hooks/use-auth-session";
import {
  getCommunityGroupMembers,
  type CommunityGroupMemberPayload,
} from "@/features/community/api/group-api";
import { CommunityGroupStateCard } from "@/features/community/components/community-group-ui";
import {
  getCachedCommunityGroupJourneySession,
  removeCachedCommunityGroupJourneySession,
} from "@/features/community/data/community-group-journey-store";
import { getCachedCommunityGroupSession } from "@/features/community/data/community-group-session-store";
import { useGroupLiveLocation } from "@/features/community/hooks/use-group-live-location";
import { AppMap, type AppMapPoint } from "@/features/map/components/app-map";
import { getMyProfile } from "@/features/profile/api/get-me";
import { getUserProfileById } from "@/features/profile/api/get-user-by-id";
import {
  abandonRouteProgress,
  getRouteById,
  type RouteDto,
} from "@/features/route/api/route-api";
import { bodyLineHeightFor, lineHeightFor } from "@/lib/text-scale";
import { LinearGradient } from "expo-linear-gradient";

const palette = {
  background: "#F3F6FA",
  blue: "#4D9BFF",
  blueSoft: "#EDF5FF",
  border: "#E5EBF3",
  borderStrong: "#D8E1ED",
  danger: "#F45D6B",
  dangerSoft: "#FFF0F2",
  primaryText: "#162033",
  secondaryText: "#6E7B90",
  success: "#2FB861",
  successSoft: "#EAF8EF",
  surface: "#FFFFFF",
  warning: "#F2A63B",
  warningSoft: "#FFF4DE",
};

const memberAccentPalette: string[] = [
  "#5AA7FF",
  "#B67BFF",
  "#FFB34D",
  "#FF7BA5",
  "#58C97A",
];
const popupBackgroundImage = require("../../../../assets/images/nenan.png");
const popupStopRouteImage = require("../../../../assets/images/stoproute.png");
const popupStopShareImage = require("../../../../assets/images/stopshare.png");

type JourneyScreenStatus = "error" | "idle" | "loading" | "ready";
type JourneyMemberStatus =
  | "offline"
  | "paused"
  | "sharing"
  | "stopped"
  | "waiting";

type UserProfileSummary = {
  avatarUri: string | null;
  displayName: string;
};

type JourneyMember = {
  avatarUri: string | null;
  coordinate: { latitude: number; longitude: number } | null;
  displayName: string;
  isCurrentUser: boolean;
  lastUpdatedLabel: string;
  status: JourneyMemberStatus;
  userId: string;
};

type DecoratedJourneyMember = JourneyMember & {
  accentColor: string;
  distanceLabel: string;
  statusColor: string;
  statusLabel: string;
};

type DecoratedJourneyMemberWithCoordinate = DecoratedJourneyMember & {
  coordinate: { latitude: number; longitude: number };
};
type JourneyStopDialogVariant = "stop-route" | "stop-sharing";

function Text({ maxFontSizeMultiplier = 1.05, style, ...props }: TextProps) {
  return (
    <RNText
      maxFontSizeMultiplier={maxFontSizeMultiplier}
      style={[{ includeFontPadding: false }, style]}
      {...props}
    />
  );
}

function normalizeValue(value?: string | null) {
  if (typeof value !== "string") {
    return null;
  }

  const trimmedValue = value.trim();
  return trimmedValue ? trimmedValue : null;
}

function resolveAvatarUri(value?: string | null) {
  const normalizedValue = normalizeValue(value);

  if (!normalizedValue) {
    return null;
  }

  if (/^[a-z][a-z0-9+.-]*:/i.test(normalizedValue)) {
    return normalizedValue;
  }

  if (normalizedValue.startsWith("//")) {
    return `https:${normalizedValue}`;
  }

  const apiBaseUrl = normalizeValue(PublicEnv.apiBaseUrl);

  if (!apiBaseUrl) {
    return normalizedValue;
  }

  try {
    const apiOrigin = new URL(apiBaseUrl).origin;
    const normalizedPath = normalizedValue.startsWith("/")
      ? normalizedValue
      : `/${normalizedValue}`;

    return `${apiOrigin}${normalizedPath}`;
  } catch {
    return normalizedValue;
  }
}

function getRoutePolyline(routeDetail: RouteDto | null) {
  const points =
    routeDetail?.hotspots?.reduce<{ latitude: number; longitude: number }[]>(
      (accumulator, item) => {
        if (
          typeof item.latitude === "number" &&
          typeof item.longitude === "number" &&
          Number.isFinite(item.latitude) &&
          Number.isFinite(item.longitude)
        ) {
          accumulator.push({
            latitude: item.latitude,
            longitude: item.longitude,
          });
        }

        return accumulator;
      },
      [],
    ) ?? [];

  if (points.length > 0) {
    return points;
  }

  return [];
}

function toRadians(value: number) {
  return (value * Math.PI) / 180;
}

function getDistanceBetweenCoordinates(
  from: { latitude: number; longitude: number } | null,
  to: { latitude: number; longitude: number } | null,
) {
  if (!from || !to) {
    return null;
  }

  const earthRadiusInMeters = 6371000;
  const deltaLatitude = toRadians(to.latitude - from.latitude);
  const deltaLongitude = toRadians(to.longitude - from.longitude);
  const fromLatitude = toRadians(from.latitude);
  const toLatitude = toRadians(to.latitude);
  const haversineValue =
    Math.sin(deltaLatitude / 2) * Math.sin(deltaLatitude / 2) +
    Math.cos(fromLatitude) *
      Math.cos(toLatitude) *
      Math.sin(deltaLongitude / 2) *
      Math.sin(deltaLongitude / 2);

  return (
    2 *
    earthRadiusInMeters *
    Math.atan2(Math.sqrt(haversineValue), Math.sqrt(1 - haversineValue))
  );
}

function formatDistanceLabel(distanceInMeters: number | null) {
  if (
    typeof distanceInMeters !== "number" ||
    !Number.isFinite(distanceInMeters)
  ) {
    return "Cách bạn --";
  }

  if (distanceInMeters < 1000) {
    return `Cách bạn ${Math.round(distanceInMeters)} m`;
  }

  const distanceInKilometers = distanceInMeters / 1000;
  const precision = distanceInKilometers < 10 ? 2 : 1;
  return `Cách bạn ${distanceInKilometers.toFixed(precision)} km`;
}

function getMemberAccentColor(member: JourneyMember, index: number) {
  if (member.isCurrentUser) {
    return "#58C97A";
  }

  return memberAccentPalette[index % memberAccentPalette.length];
}

function formatRelativeTimestamp(timestamp?: number | null) {
  if (typeof timestamp !== "number" || !Number.isFinite(timestamp)) {
    return "Chưa có dữ liệu vị trí";
  }

  const elapsedSeconds = Math.max(
    0,
    Math.floor((Date.now() - timestamp) / 1000),
  );

  if (elapsedSeconds < 10) {
    return "Vừa cập nhật";
  }

  if (elapsedSeconds < 60) {
    return `${elapsedSeconds} giây trước`;
  }

  const elapsedMinutes = Math.floor(elapsedSeconds / 60);

  if (elapsedMinutes < 60) {
    return `${elapsedMinutes} phút trước`;
  }

  const elapsedHours = Math.floor(elapsedMinutes / 60);
  return `${elapsedHours} giờ trước`;
}

function getMemberStatusMeta(status: JourneyMemberStatus) {
  switch (status) {
    case "sharing":
      return {
        backgroundColor: palette.successSoft,
        icon: {
          android: "location_on",
          ios: "location.fill",
          web: "location_on",
        },
        label: "Đang chia sẻ",
        textColor: palette.success,
      };
    case "paused":
      return {
        backgroundColor: palette.warningSoft,
        icon: {
          android: "pause_circle",
          ios: "pause.circle.fill",
          web: "pause_circle",
        },
        label: "Đã tạm dừng",
        textColor: palette.warning,
      };
    case "stopped":
      return {
        backgroundColor: "#FDECEE",
        icon: {
          android: "stop_circle",
          ios: "stop.circle.fill",
          web: "stop_circle",
        },
        label: "Đã dừng",
        textColor: palette.danger,
      };
    case "offline":
      return {
        backgroundColor: "#EEF2F6",
        icon: {
          android: "wifi_off",
          ios: "wifi.slash",
          web: "wifi_off",
        },
        label: "Mất kết nối",
        textColor: "#657181",
      };
    default:
      return {
        backgroundColor: "#F4F5F7",
        icon: {
          android: "hourglass_empty",
          ios: "clock",
          web: "hourglass_empty",
        },
        label: "Chưa gửi vị trí",
        textColor: "#8E869A",
      };
  }
}

function getStatusLineMeta(status: JourneyMemberStatus) {
  const statusMeta = getMemberStatusMeta(status);

  return {
    color: statusMeta.textColor,
    label: statusMeta.label,
  };
}

function getShareCardMeta({
  connectionState,
  shareMode,
  updatedLabel,
}: {
  connectionState: "connected" | "connecting" | "disconnected" | "idle";
  shareMode: "group_forced_stop" | "paused" | "route_stopped" | "sharing";
  updatedLabel: string;
}) {
  if (shareMode === "group_forced_stop" || shareMode === "route_stopped") {
    return {
      bars: 1,
      detail: "Phiên chia sẻ đã kết thúc",
      dotColor: palette.danger,
      title: "Đã dừng chia sẻ",
    };
  }

  if (shareMode === "paused") {
    return {
      bars: 2,
      detail: "Bạn đang tạm dừng",
      dotColor: palette.warning,
      title: "Tạm dừng chia sẻ",
    };
  }

  if (connectionState === "idle") {
    return {
      bars: 2,
      detail: "Đang chuẩn bị",
      dotColor: palette.warning,
      title: "Sắp bắt đầu chia sẻ",
    };
  }

  if (connectionState === "connecting") {
    return {
      bars: 3,
      detail: "Đang kết nối lại",
      dotColor: palette.warning,
      title: "Đang đồng bộ vị trí",
    };
  }

  if (connectionState === "disconnected") {
    return {
      bars: 1,
      detail: "Mất kết nối tạm thời",
      dotColor: "#92A0B4",
      title: "Chưa chia sẻ ổn định",
    };
  }

  return {
    bars: 4,
    detail:
      updatedLabel === "Vừa cập nhật"
        ? "Cập nhật mới vừa xong"
        : `Cập nhật mới ${updatedLabel}`,
    dotColor: palette.success,
    title: "Đang chia sẻ vị trí",
  };
}

function getPrimaryShareActionMeta(
  shareMode: "group_forced_stop" | "paused" | "route_stopped" | "sharing",
) {
  if (shareMode === "paused") {
    return {
      backgroundColor: "#DDF6E5",
      borderColor: "#A9DEBA",
      icon: {
        android: "play_arrow",
        ios: "play.fill",
        web: "play_arrow",
      } satisfies SymbolName,
      label: "Bật lại chia sẻ",
      textColor: palette.success,
    };
  }

  if (shareMode === "group_forced_stop" || shareMode === "route_stopped") {
    return {
      backgroundColor: "#EEF2F6",
      borderColor: "#D0D8E3",
      icon: {
        android: "block",
        ios: "xmark",
        web: "block",
      } satisfies SymbolName,
      label: "Đã kết thúc",
      textColor: "#97A3B6",
    };
  }

  return {
    backgroundColor: "#FFDDE3",
    borderColor: "#F2B6C1",
    icon: {
      android: "stop_circle",
      ios: "stop.circle.fill",
      web: "stop_circle",
    } satisfies SymbolName,
    label: "Dừng chia sẻ",
    textColor: palette.danger,
  };
}

function getMemberPrimaryLabel(member: JourneyMember, isLeader: boolean) {
  if (!member.isCurrentUser) {
    return member.displayName;
  }

  return isLeader ? "Bạn (Trưởng nhóm)" : "Bạn";
}

function getCurrentUserStatus({
  connectionState,
  hasLocation,
  shareMode,
}: {
  connectionState: "connected" | "connecting" | "disconnected" | "idle";
  hasLocation: boolean;
  shareMode: "group_forced_stop" | "paused" | "route_stopped" | "sharing";
}): JourneyMemberStatus {
  if (shareMode === "group_forced_stop" || shareMode === "route_stopped") {
    return "stopped";
  }

  if (shareMode === "paused") {
    return "paused";
  }

  if (connectionState === "connected" || hasLocation) {
    return "sharing";
  }

  // Chưa thử kết nối lần nào thì là "đang chờ", không phải "mất kết nối".
  if (connectionState === "idle" || connectionState === "connecting") {
    return "waiting";
  }

  return "offline";
}

function buildJourneyMembers({
  connectionState,
  currentUserId,
  groupMembers,
  locationsByUserId,
  shareMode,
  userProfiles,
}: {
  connectionState: "connected" | "connecting" | "disconnected" | "idle";
  currentUserId: string | null;
  groupMembers: CommunityGroupMemberPayload[];
  locationsByUserId: Record<
    string,
    {
      latitude: number;
      longitude: number;
      timestamp: number;
      userId: string;
      username: string | null;
    }
  >;
  shareMode: "group_forced_stop" | "paused" | "route_stopped" | "sharing";
  userProfiles: Record<string, UserProfileSummary>;
}) {
  const uniqueMemberIds = Array.from(
    new Set(
      groupMembers
        .map((member) => normalizeValue(member.userId))
        .filter((value): value is string => Boolean(value)),
    ),
  );

  if (currentUserId && !uniqueMemberIds.includes(currentUserId)) {
    uniqueMemberIds.unshift(currentUserId);
  }

  if (uniqueMemberIds.length === 0) {
    const fallbackCurrentUserId = currentUserId ?? "me";
    uniqueMemberIds.push(fallbackCurrentUserId);
  }

  return uniqueMemberIds.map((userId) => {
    const profile = userProfiles[userId];
    const liveLocation = locationsByUserId[userId] ?? null;
    const isCurrentUser = currentUserId === userId;
    const timestamp = liveLocation?.timestamp ?? null;
    const lastUpdatedLabel = isCurrentUser
      ? shareMode === "paused"
        ? "Bạn đã tạm dừng chia sẻ vị trí"
        : shareMode === "route_stopped"
          ? "Bạn đã dừng tuyến đường của mình"
          : shareMode === "group_forced_stop"
            ? "Leader đã kết thúc phiên chia sẻ"
            : formatRelativeTimestamp(timestamp)
      : formatRelativeTimestamp(timestamp);
    const status = isCurrentUser
      ? getCurrentUserStatus({
          connectionState,
          hasLocation: Boolean(liveLocation),
          shareMode,
        })
      : liveLocation
        ? Date.now() - liveLocation.timestamp <= 15000
          ? "sharing"
          : "offline"
        : "waiting";

    return {
      avatarUri: profile?.avatarUri ?? null,
      coordinate: liveLocation
        ? {
            latitude: liveLocation.latitude,
            longitude: liveLocation.longitude,
          }
        : null,
      displayName:
        profile?.displayName ??
        liveLocation?.username ??
        (isCurrentUser ? "Bạn" : `Explorer #${userId}`),
      isCurrentUser,
      lastUpdatedLabel,
      status,
      userId,
    } satisfies JourneyMember;
  });
}

function SignalBars({
  activeBars,
  color,
}: {
  activeBars: number;
  color: string;
}) {
  return (
    <View className="flex-row items-end">
      {[0, 1, 2, 3].map((barIndex) => (
        <View
          key={barIndex}
          className="ml-0.5 rounded-full"
          style={{
            backgroundColor: barIndex < activeBars ? color : "#D7DEE9",
            height: 6 + barIndex * 3,
            width: 4,
          }}
        />
      ))}
    </View>
  );
}

function FloatingMapButton({
  active = false,
  icon,
  onPress,
}: {
  active?: boolean;
  icon: SymbolName;
  onPress: () => void;
}) {
  return (
    <Pressable
      className="h-12 w-12 items-center justify-center rounded-full"
      onPress={onPress}
      style={({ pressed }) => ({
        backgroundColor: active ? "#EFF6FF" : "rgba(255, 255, 255, 0.96)",
        borderColor: active ? "#CFE1FF" : "#E8EEF6",
        borderWidth: 1,
        opacity: pressed ? 0.82 : 1,
        shadowColor: "#162033",
        shadowOffset: { width: 0, height: 8 },
        shadowOpacity: 0.1,
        shadowRadius: 14,
      })}
    >
      <SymbolView
        name={icon}
        size={18}
        tintColor={active ? palette.blue : palette.primaryText}
      />
    </Pressable>
  );
}

function SheetActionButton({
  active = false,
  disabled = false,
  icon,
  isLoading = false,
  label,
  onPress,
  tone = "neutral",
}: {
  active?: boolean;
  disabled?: boolean;
  icon: SymbolName;
  isLoading?: boolean;
  label: string;
  onPress: () => void;
  tone?: "danger" | "neutral";
}) {
  const backgroundColor =
    tone === "danger" ? "#FFF0F2" : active ? "#EEF5FF" : "#FFFFFF";
  const borderColor =
    tone === "danger" ? "#FFD5DC" : active ? "#CFE0FF" : "#E6EDF6";
  const tintColor =
    tone === "danger" ? palette.danger : active ? palette.blue : "#5E6B80";

  return (
    <Pressable
      className="min-h-[46px] flex-1 flex-row items-center justify-center rounded-[14px] px-3 py-3"
      disabled={disabled || isLoading}
      onPress={onPress}
      style={({ pressed }) => ({
        backgroundColor,
        borderColor,
        borderWidth: 1,
        opacity: disabled || isLoading ? 0.52 : pressed ? 0.84 : 1,
      })}
    >
      {isLoading ? (
        <ActivityIndicator color={tintColor} size="small" />
      ) : (
        <SymbolView name={icon} size={15} tintColor={tintColor} />
      )}
      <Text
        className="ml-1.5 text-[13px] font-semibold"
        style={{
          color: tintColor,
          lineHeight: lineHeightFor(13),
        }}
      >
        {label}
      </Text>
    </Pressable>
  );
}

function MemberRow({
  isLeader,
  isSelected,
  member,
  onPress,
}: {
  isLeader: boolean;
  isSelected: boolean;
  member: DecoratedJourneyMember;
  onPress: () => void;
}) {
  const primaryLabel = getMemberPrimaryLabel(member, isLeader);
  const titleColor = member.isCurrentUser
    ? member.accentColor
    : palette.primaryText;

  return (
    <Pressable
      className="rounded-[18px] px-3 py-3"
      onPress={onPress}
      style={({ pressed }) => ({
        backgroundColor: isSelected
          ? "#F4F9FF"
          : pressed
            ? "#F9FBFE"
            : "#FFFFFF",
        borderColor: isSelected ? "#D9E9FF" : "transparent",
        borderWidth: 1,
      })}
    >
      <View className="flex-row items-center">
        <UserAvatar
          borderColor={member.accentColor}
          borderWidth={2.5}
          displayName={member.displayName}
          size={48}
          uri={member.avatarUri}
        />

        <View className="ml-3 min-w-0 flex-1">
          <Text
            className="text-[14px] font-semibold"
            numberOfLines={1}
            style={{
              color: titleColor,
              lineHeight: lineHeightFor(14),
            }}
          >
            {primaryLabel}
          </Text>
          <View className="mt-1 flex-row items-center">
            <View
              className="h-[7px] w-[7px] rounded-full"
              style={{ backgroundColor: member.statusColor }}
            />
            <Text
              className="ml-1.5 text-[13px]"
              style={{
                color: member.statusColor,
                lineHeight: bodyLineHeightFor(13),
              }}
            >
              {member.statusLabel}
            </Text>
          </View>
        </View>

        <View className="ml-2 items-end">
          <Text
            className="text-right text-[13px]"
            style={{
              color: palette.secondaryText,
              lineHeight: bodyLineHeightFor(13),
            }}
          >
            {member.distanceLabel}
          </Text>
        </View>
      </View>
    </Pressable>
  );
}

function JourneyStopConfirmDialog({
  isSubmitting = false,
  onCancel,
  onConfirm,
  variant,
  visible,
}: {
  isSubmitting?: boolean;
  onCancel: () => void;
  onConfirm: () => void;
  variant: JourneyStopDialogVariant;
  visible: boolean;
}) {
  const config =
    variant === "stop-route"
      ? {
          confirmLabel: "Dừng hành trình",
          description:
            "Bạn có chắc chắn muốn dừng hành trình và ngừng chia sẻ vị trí với nhóm không?",
          detailItems: [
            {
              description: "Dữ liệu hành trình của bạn sẽ được lưu lại.",
              icon: {
                android: "route",
                ios: "point.topleft.down.curvedto.point.bottomright.up.fill",
                web: "route",
              } satisfies SymbolName,
              title: "Hành trình sẽ kết thúc",
            },
            {
              description:
                "Vị trí của bạn sẽ không còn hiển thị với các thành viên trong nhóm.",
              icon: {
                android: "location_on",
                ios: "location.fill",
                web: "location_on",
              } satisfies SymbolName,
              title: "Ngừng chia sẻ vị trí",
            },
            {
              description:
                "Bạn có thể bắt đầu một hành trình mới bất cứ lúc nào.",
              icon: {
                android: "flag",
                ios: "flag.fill",
                web: "flag",
              } satisfies SymbolName,
              title: "Bạn có thể bắt đầu lại",
            },
          ],
          heroImage: popupStopRouteImage,
          title: "Dừng tuyến hành trình",
        }
      : {
          confirmLabel: "Dừng chia sẻ",
          description:
            "Bạn có chắc chắn muốn dừng chia sẻ vị trí hiện tại với nhóm không?",
          detailItems: [
            {
              description:
                "Vị trí của bạn sẽ không còn được chia sẻ với các thành viên trong nhóm.",
              icon: {
                android: "location_off",
                ios: "location.slash.fill",
                web: "location_off",
              } satisfies SymbolName,
              title: "Ngừng cập nhật vị trí",
            },
            {
              description:
                "Hành trình hiện tại vẫn được giữ nguyên để bạn tiếp tục khi cần.",
              icon: {
                android: "pause_circle",
                ios: "pause.circle.fill",
                web: "pause_circle",
              } satisfies SymbolName,
              title: "Hành trình vẫn được giữ",
            },
            {
              description:
                "Bạn có thể bật lại chia sẻ bất cứ lúc nào từ màn hình này.",
              icon: {
                android: "play_circle",
                ios: "play.circle.fill",
                web: "play_circle",
              } satisfies SymbolName,
              title: "Có thể bật lại bất cứ lúc nào",
            },
          ],
          heroImage: popupStopShareImage,
          title: "Dừng chia sẻ vị trí",
        };

  return (
    <Modal
      animationType="fade"
      onRequestClose={isSubmitting ? undefined : onCancel}
      statusBarTranslucent
      transparent
      visible={visible}
    >
      <View
        className="flex-1 items-center justify-center px-5 py-6"
        style={{ backgroundColor: "rgba(21, 18, 24, 0.52)" }}
      >
        <Pressable
          className="absolute inset-0"
          disabled={isSubmitting}
          onPress={onCancel}
        />

        <View
          className="w-full max-w-[360px] overflow-hidden rounded-[26px] bg-white"
          style={{
            elevation: 16,
            shadowColor: "rgba(33, 21, 29, 0.32)",
            shadowOffset: { width: 0, height: 16 },
            shadowOpacity: 1,
            shadowRadius: 24,
          }}
        >
          <ImageBackground
            imageStyle={{ opacity: 0.2 }}
            resizeMode="cover"
            source={popupBackgroundImage}
            style={{ paddingHorizontal: 16, paddingVertical: 16 }}
          >
            <View className="items-center">
              <Image
                resizeMode="contain"
                source={config.heroImage}
                style={{ height: 132, width: 132 }}
              />

              <Text
                className="mt-3 text-center text-[16px] font-black"
                style={{
                  color: "#2A2A33",
                  lineHeight: lineHeightFor(16, 1.06),
                }}
              >
                {config.title}
              </Text>

              <Text
                className="mt-1.5 text-center text-[12.5px]"
                style={{
                  color: "#645E68",
                  lineHeight: bodyLineHeightFor(12.5),
                  maxWidth: 292,
                }}
              >
                {config.description}
              </Text>
            </View>

            <View
              className="mt-4 rounded-[18px] border px-3.5 py-3"
              style={{
                backgroundColor: "rgba(255, 245, 247, 0.78)",
                borderColor: "#F8D8E0",
              }}
            >
              {config.detailItems.map((item, index) => (
                <View key={item.title}>
                  <View className="flex-row">
                    <View
                      className="mr-2.5 mt-0.5 h-8 w-8 items-center justify-center rounded-full"
                      style={{ backgroundColor: "rgba(255, 115, 149, 0.12)" }}
                    >
                      <SymbolView
                        name={item.icon}
                        size={15}
                        tintColor="#F2557F"
                      />
                    </View>

                    <View className="flex-1">
                      <Text
                        className="text-[13px] font-black"
                        style={{
                          color: "#302B35",
                          lineHeight: lineHeightFor(13, 1.08),
                        }}
                      >
                        {item.title}
                      </Text>
                      <Text
                        className="mt-0.5 text-[12px]"
                        style={{
                          color: "#696270",
                          lineHeight: bodyLineHeightFor(12),
                        }}
                      >
                        {item.description}
                      </Text>
                    </View>
                  </View>

                  {index < config.detailItems.length - 1 ? (
                    <View
                      className="my-2.5 h-px"
                      style={{ backgroundColor: "#F2D7DE" }}
                    />
                  ) : null}
                </View>
              ))}
            </View>

            <View className="mt-6 flex-row" style={{ columnGap: 10 }}>
              <Pressable
                className="flex-1 items-center justify-center rounded-[16px] px-3 py-2"
                disabled={isSubmitting}
                onPress={onCancel}
                style={({ pressed }) => ({
                  backgroundColor: "#FFFFFF",
                  borderColor: "#C9CDD7",
                  borderWidth: 1.2,
                  minHeight: 40,
                  opacity: isSubmitting ? 0.58 : pressed ? 0.84 : 1,
                  shadowColor: "rgba(31, 26, 35, 0.08)",
                  shadowOffset: { width: 0, height: 8 },
                  shadowOpacity: 1,
                  shadowRadius: 14,
                  elevation: 2,
                })}
              >
                <Text
                  className="text-[14px] font-black"
                  style={{ color: "#77707D", lineHeight: lineHeightFor(14) }}
                >
                  Hủy
                </Text>
              </Pressable>

              <Pressable
                className="flex-1 overflow-hidden rounded-[16px]"
                disabled={isSubmitting}
                onPress={onConfirm}
                style={({ pressed }) => ({
                  opacity: isSubmitting ? 0.7 : pressed ? 0.88 : 1,
                  shadowColor: "rgba(242, 85, 127, 0.32)",
                  shadowOffset: { width: 0, height: 10 },
                  shadowOpacity: 1,
                  shadowRadius: 18,
                  elevation: 8,
                })}
              >
                <LinearGradient
                  colors={["#FF7F99", "#FF5E84", "#F24F77"]}
                  end={{ x: 1, y: 0.5 }}
                  start={{ x: 0, y: 0.5 }}
                  style={{
                    alignItems: "center",
                    flexDirection: "row",
                    justifyContent: "center",
                    minHeight: 40,
                    paddingHorizontal: 12,
                  }}
                >
                  {isSubmitting ? (
                    <ActivityIndicator color="#FFFFFF" size="small" />
                  ) : (
                    <>
                      <SymbolView
                        name={
                          variant === "stop-route"
                            ? {
                                android: "stop_circle",
                                ios: "stop.circle.fill",
                                web: "stop_circle",
                              }
                            : {
                                android: "pause_circle",
                                ios: "pause.circle.fill",
                                web: "pause_circle",
                              }
                        }
                        size={15}
                        tintColor="#FFFFFF"
                      />
                      <Text
                        className="ml-1.5 text-[13px] font-black text-white"
                        numberOfLines={1}
                        style={{ lineHeight: lineHeightFor(13, 1.05) }}
                      >
                        {config.confirmLabel}
                      </Text>
                    </>
                  )}
                </LinearGradient>
              </Pressable>
            </View>
          </ImageBackground>
        </View>
      </View>
    </Modal>
  );
}

export default function CommunityGroupJourneyScreen() {
  const authSession = useAuthSession();
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const { height: windowHeight } = useWindowDimensions();
  const isAuthenticated = authSession.isAuthenticated;
  const tokenType = authSession.tokenType ?? undefined;
  const params = useLocalSearchParams<{
    routeId?: string;
    routeName?: string;
    shareToken?: string;
  }>();
  const resolvedRouteKey =
    typeof params.shareToken === "string"
      ? normalizeValue(decodeURIComponent(params.shareToken))
      : null;
  const cachedGroupSession = getCachedCommunityGroupSession(resolvedRouteKey);
  const cachedJourneySession =
    getCachedCommunityGroupJourneySession(resolvedRouteKey);
  const resolvedGroupId =
    (/^\d+$/.test(resolvedRouteKey ?? "")
      ? resolvedRouteKey
      : normalizeValue(cachedGroupSession?.groupId)) ??
    normalizeValue(cachedJourneySession?.groupId);
  const resolvedRouteId =
    normalizeValue(
      typeof params.routeId === "string"
        ? decodeURIComponent(params.routeId)
        : null,
    ) ?? normalizeValue(cachedJourneySession?.routeId);
  const resolvedGroupIdKey = resolvedGroupId ?? "";
  const resolvedRouteIdKey = resolvedRouteId ?? "";
  const resolvedRouteKeyValue = resolvedRouteKey ?? "";
  const [currentUserId, setCurrentUserId] = useState<string | null>(null);
  const [currentUsername, setCurrentUsername] = useState<string | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [groupMembers, setGroupMembers] = useState<
    CommunityGroupMemberPayload[]
  >([]);
  const [isLeader, setIsLeader] = useState(false);
  const [isStoppingRoute, setIsStoppingRoute] = useState(false);
  const [mapFocusMemberId, setMapFocusMemberId] = useState<string | null>(null);
  const [mapType, setMapType] = useState<"hybrid" | "standard">("standard");
  const [routeDetail, setRouteDetail] = useState<RouteDto | null>(null);
  const [selectedMemberId, setSelectedMemberId] = useState<string | null>(null);
  const [stopDialogVariant, setStopDialogVariant] =
    useState<JourneyStopDialogVariant | null>(null);
  const [status, setStatus] = useState<JourneyScreenStatus>(
    resolvedRouteKey ? "loading" : "idle",
  );
  const [userProfiles, setUserProfiles] = useState<
    Record<string, UserProfileSummary>
  >({});

  /* eslint-disable react-hooks/preserve-manual-memoization */
  useFocusEffect(
    useCallback(() => {
      let isActive = true;

      async function loadJourneyContext() {
        if (!resolvedRouteKeyValue || !resolvedGroupIdKey) {
          setErrorMessage("Không xác định được hành trình nhóm để mở.");
          setStatus("error");
          return;
        }

        if (!isAuthenticated) {
          setErrorMessage("Bạn cần đăng nhập để xem hành trình nhóm.");
          setStatus("error");
          return;
        }

        setStatus("loading");
        setErrorMessage(null);

        try {
          const accessToken = await getValidAccessToken();

          if (!accessToken) {
            throw new Error(
              "Phiên đăng nhập đã hết hạn. Vui lòng đăng nhập lại.",
            );
          }

          const [profileResult, membersResult, routeResult] =
            await Promise.allSettled([
              getMyProfile({
                accessToken,
                tokenType,
              }),
              getCommunityGroupMembers({
                accessToken,
                groupId: resolvedGroupIdKey,
                tokenType,
              }),
              resolvedRouteIdKey
                ? getRouteById({
                    accessToken,
                    routeId: resolvedRouteIdKey,
                    tokenType,
                  })
                : Promise.resolve(null),
            ]);

          if (profileResult.status !== "fulfilled") {
            throw profileResult.reason;
          }

          if (membersResult.status !== "fulfilled") {
            throw membersResult.reason;
          }

          if (!isActive) {
            return;
          }

          const nextCurrentUserId = normalizeValue(profileResult.value.id);
          const nextCurrentUsername =
            normalizeValue(profileResult.value.name) ??
            normalizeValue(profileResult.value.username);
          const nextMembers = membersResult.value;
          const nextIsLeader = nextMembers.some(
            (member) =>
              normalizeValue(member.userId) === nextCurrentUserId &&
              normalizeValue(member.role)?.toUpperCase() === "LEADER",
          );
          const uniqueUserIds = Array.from(
            new Set(
              nextMembers
                .map((member) => normalizeValue(member.userId))
                .filter((value): value is string => Boolean(value)),
            ),
          );

          const profileEntries = await Promise.allSettled(
            uniqueUserIds.map(async (userId) => {
              const profile = await getUserProfileById({
                accessToken,
                tokenType,
                userId,
              });

              return [
                userId,
                {
                  avatarUri: resolveAvatarUri(profile.avatar),
                  displayName:
                    normalizeValue(profile.name) ??
                    normalizeValue(profile.username) ??
                    `Explorer #${userId}`,
                },
              ] as const;
            }),
          );

          if (!isActive) {
            return;
          }

          const nextProfiles = profileEntries.reduce<
            Record<string, UserProfileSummary>
          >((accumulator, entry) => {
            if (entry.status === "fulfilled") {
              accumulator[entry.value[0]] = entry.value[1];
            }

            return accumulator;
          }, {});

          if (nextCurrentUserId) {
            nextProfiles[nextCurrentUserId] = {
              avatarUri: resolveAvatarUri(profileResult.value.avatar),
              displayName:
                normalizeValue(profileResult.value.name) ??
                normalizeValue(profileResult.value.username) ??
                "Bạn",
            };
          }

          setCurrentUserId(nextCurrentUserId);
          setCurrentUsername(nextCurrentUsername);
          setGroupMembers(nextMembers);
          setIsLeader(nextIsLeader);
          setRouteDetail(
            routeResult.status === "fulfilled" ? routeResult.value : null,
          );
          setUserProfiles(nextProfiles);
          setSelectedMemberId((currentValue) =>
            currentValue && uniqueUserIds.includes(currentValue)
              ? currentValue
              : (nextCurrentUserId ?? uniqueUserIds[0] ?? currentValue),
          );
          setStatus("ready");
        } catch (error) {
          if (!isActive) {
            return;
          }

          setErrorMessage(
            error instanceof Error
              ? error.message
              : "Không tải được dữ liệu hành trình nhóm.",
          );
          setStatus("error");
        }
      }

      void loadJourneyContext();

      return () => {
        isActive = false;
      };
    }, [
      isAuthenticated,
      resolvedGroupIdKey,
      resolvedRouteIdKey,
      resolvedRouteKeyValue,
      tokenType,
    ]),
  );
  /* eslint-enable react-hooks/preserve-manual-memoization */

  const {
    connectionState,
    isPermissionGranted,
    lastError,
    locationsByUserId,
    pauseSharing,
    resumeSharing,
    shareMode,
    stopRouteSharing,
  } = useGroupLiveLocation({
    enabled: status === "ready",
    groupId: resolvedGroupId,
    isLeader,
    myUserId: currentUserId,
    username: currentUsername,
  });

  const routeCoordinates = useMemo(
    () => getRoutePolyline(routeDetail),
    [routeDetail],
  );
  const journeyMembers = useMemo(
    () =>
      buildJourneyMembers({
        connectionState,
        currentUserId,
        groupMembers,
        locationsByUserId,
        shareMode,
        userProfiles,
      }),
    [
      connectionState,
      currentUserId,
      groupMembers,
      locationsByUserId,
      shareMode,
      userProfiles,
    ],
  );
  const currentUserMember =
    journeyMembers.find((member) => member.isCurrentUser) ?? null;
  const decoratedJourneyMembers = useMemo(
    () =>
      journeyMembers.map((member, index) => {
        const statusLineMeta = getStatusLineMeta(member.status);
        const distanceInMeters = member.isCurrentUser
          ? 0
          : getDistanceBetweenCoordinates(
              currentUserMember?.coordinate ?? null,
              member.coordinate,
            );

        return {
          ...member,
          accentColor: getMemberAccentColor(member, index),
          distanceLabel: formatDistanceLabel(distanceInMeters),
          statusColor: statusLineMeta.color,
          statusLabel: statusLineMeta.label,
        } satisfies DecoratedJourneyMember;
      }),
    [currentUserMember?.coordinate, journeyMembers],
  );
  const selectedMember =
    decoratedJourneyMembers.find(
      (member) => member.userId === selectedMemberId,
    ) ??
    currentUserMember ??
    decoratedJourneyMembers[0] ??
    null;
  const groupDisplayName =
    normalizeValue(cachedGroupSession?.groupName) ??
    normalizeValue(cachedJourneySession?.groupName) ??
    "Nhóm cộng đồng";
  const membersSharingCount = decoratedJourneyMembers.filter(
    (member) => member.status === "sharing",
  ).length;
  const mapPoints: AppMapPoint[] = decoratedJourneyMembers
    .filter((member): member is DecoratedJourneyMemberWithCoordinate =>
      Boolean(member.coordinate),
    )
    .map((member) => ({
      accentColor: member.accentColor,
      avatarUri: member.avatarUri,
      description: member.statusLabel,
      id: member.userId,
      isCurrentUser: member.isCurrentUser,
      labelBackgroundColor:
        member.userId === selectedMemberId
          ? member.accentColor
          : palette.surface,
      labelTextColor:
        member.userId === selectedMemberId
          ? palette.surface
          : member.accentColor,
      latitude: member.coordinate.latitude,
      longitude: member.coordinate.longitude,
      title: member.isCurrentUser ? "Bạn" : member.displayName,
    }));
  const currentUserCoordinate = currentUserMember?.coordinate ?? null;
  const mapConnectionLines = currentUserCoordinate
    ? decoratedJourneyMembers
        .filter(
          (member): member is DecoratedJourneyMemberWithCoordinate =>
            !member.isCurrentUser && Boolean(member.coordinate),
        )
        .map((member) => ({
          color: member.accentColor,
          coordinates: [currentUserCoordinate, member.coordinate],
          id: `line-${member.userId}`,
          lineDashPattern: [5, 6] as number[],
          strokeWidth: 2.5,
        }))
    : [];
  const shareCardMeta = getShareCardMeta({
    connectionState,
    shareMode,
    updatedLabel:
      currentUserMember?.lastUpdatedLabel === "Vừa cập nhật"
        ? "Vừa cập nhật"
        : (currentUserMember?.lastUpdatedLabel ?? "Vừa cập nhật"),
  });
  const primaryShareAction = getPrimaryShareActionMeta(shareMode);
  const combinedErrorMessage = errorMessage ?? lastError;
  const shouldDisableShareToggle =
    shareMode === "group_forced_stop" || shareMode === "route_stopped";
  const headerHeight = insets.top + 70;
  const activeMembersSummary = `${membersSharingCount}/${journeyMembers.length} người online`;
  const groupSubtitle = `${groupDisplayName} ${activeMembersSummary}`;
  const mapHeight = Math.max(windowHeight - headerHeight, 320);
  const mapOverlayTop = 16;
  const bottomSheetHeight = Math.min(Math.max(windowHeight * 0.42, 314), 428);
  const floatingButtonsBottom = bottomSheetHeight + 22;
  const mapFitEdgePadding = useMemo(
    () => ({
      bottom: bottomSheetHeight + 36,
      left: 56,
      right: 56,
      top: 74,
    }),
    [bottomSheetHeight],
  );
  const isMapFocused = Boolean(mapFocusMemberId);
  const isStopDialogVisible = stopDialogVariant !== null;

  const handleLeaveJourneyScreen = useCallback(() => {
    if (router.canGoBack()) {
      router.back();
      return;
    }

    router.replace("/community/groups" as Href);
  }, [router]);

  const handleToggleShare = () => {
    if (shareMode === "sharing") {
      setStopDialogVariant("stop-sharing");
      return;
    }

    if (shareMode === "paused") {
      resumeSharing();
      appToast.success("Đã bật lại chia sẻ vị trí.");
      return;
    }

    appToast.info(
      "Phiên chia sẻ này đã kết thúc, không thể bật lại từ màn hình này.",
    );
  };

  const stopRoute = async () => {
    if (!resolvedRouteId || isStoppingRoute) {
      return;
    }

    if (!authSession.isAuthenticated) {
      appToast.error("Bạn cần đăng nhập để dừng tuyến đường.");
      return;
    }

    const accessToken = await getValidAccessToken();

    if (!accessToken) {
      appToast.error("Phiên đăng nhập đã hết hạn. Vui lòng đăng nhập lại.");
      return;
    }

    setIsStoppingRoute(true);

    try {
      await abandonRouteProgress({
        accessToken,
        routeId: resolvedRouteId,
        tokenType: authSession.tokenType ?? undefined,
      });
      stopRouteSharing();
      removeCachedCommunityGroupJourneySession(
        cachedJourneySession?.shareToken ?? resolvedRouteKey ?? resolvedGroupId,
      );
      appToast.success("Bạn đã dừng tuyến đường của mình.");
    } catch (error) {
      appToast.error(
        error instanceof Error
          ? error.message
          : "Không thể dừng tuyến đường lúc này.",
      );
    } finally {
      setIsStoppingRoute(false);
    }
  };

  const handleStopRoute = () => {
    if (
      !resolvedRouteId ||
      isStoppingRoute ||
      shareMode === "route_stopped" ||
      shareMode === "group_forced_stop"
    ) {
      return;
    }

    setStopDialogVariant("stop-route");
  };

  function handleCloseStopDialog() {
    if (isStoppingRoute) {
      return;
    }

    setStopDialogVariant(null);
  }

  function handleConfirmStopDialog() {
    if (stopDialogVariant === "stop-sharing") {
      pauseSharing();
      setStopDialogVariant(null);
      appToast.success("Đã dừng chia sẻ vị trí hiện tại.");
      return;
    }

    if (stopDialogVariant === "stop-route") {
      void (async () => {
        await stopRoute();
        setStopDialogVariant(null);
      })();
    }
  }

  function handleSelectMember(userId: string) {
    setSelectedMemberId(userId);
    setMapFocusMemberId((currentValue) =>
      currentValue ? userId : currentValue,
    );
  }

  function handleShowMemberList() {
    setMapFocusMemberId(null);
  }

  function handleFocusSelectedMember() {
    const fallbackMember =
      selectedMember ??
      currentUserMember ??
      decoratedJourneyMembers.find((member) => Boolean(member.coordinate)) ??
      null;

    if (!fallbackMember?.coordinate) {
      appToast.info("Chưa có vị trí để tập trung trên bản đồ.");
      return;
    }

    setSelectedMemberId(fallbackMember.userId);
    setMapFocusMemberId(fallbackMember.userId);
  }

  function handleFocusCurrentUser() {
    if (!currentUserMember?.coordinate) {
      appToast.info("Chưa có vị trí của bạn để định tâm.");
      return;
    }

    setSelectedMemberId(currentUserMember.userId);
    setMapFocusMemberId(currentUserMember.userId);
  }

  function handleToggleMapType() {
    setMapType((currentValue) =>
      currentValue === "standard" ? "hybrid" : "standard",
    );
  }

  if (!resolvedRouteKey || !resolvedGroupId) {
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
            title="Thiếu dữ liệu nhóm"
            variant="empty"
          />
        </View>
      </SafeAreaView>
    );
  }

  if (status === "loading" && !currentUserId) {
    return <AppLoadingScreen edges={["left", "right"]} />;
  }

  if (status === "error" && !currentUserId) {
    return (
      <SafeAreaView
        className="flex-1"
        edges={["left", "right"]}
        style={{ backgroundColor: palette.background }}
      >
        <StatusBar style="dark" />
        <View className="flex-1 px-4" style={{ paddingTop: insets.top + 24 }}>
          <CommunityGroupStateCard
            actionLabel="Quay lại"
            description={
              combinedErrorMessage ?? "Không thể mở giao diện hành trình nhóm."
            }
            icon="error"
            onPress={handleLeaveJourneyScreen}
            title="Không tải được hành trình nhóm"
            variant="error"
          />
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView
      className="flex-1"
      edges={["left", "right", "bottom"]}
      style={{ backgroundColor: palette.background }}
    >
      <StatusBar style="dark" />
      <View
        style={{
          backgroundColor: palette.surface,
          borderBottomColor: "#E9EEF5",
          borderBottomWidth: 1,
          paddingBottom: 12,
          paddingLeft: 16,
          paddingRight: 16,
          paddingTop: insets.top + 8,
        }}
      >
        <View className="flex-row items-center">
          <Pressable
            className="h-10 w-10 items-center justify-center rounded-full"
            onPress={handleLeaveJourneyScreen}
            style={({ pressed }) => ({
              backgroundColor: "#FFFFFF",
              borderColor: "#E8EEF6",
              borderWidth: 1,
              opacity: pressed ? 0.84 : 1,
            })}
          >
            <SymbolView
              name={{
                android: "arrow_back",
                ios: "chevron.left",
                web: "arrow_back",
              }}
              size={19}
              tintColor={palette.primaryText}
            />
          </Pressable>

          <View className="ml-3 min-w-0 flex-1">
            <Text
              className="text-[19px] font-semibold"
              numberOfLines={1}
              style={{
                color: palette.primaryText,
                lineHeight: lineHeightFor(19, 1.06),
              }}
            >
              Hành trình nhóm
            </Text>

            <Text
              className="mt-0.5 text-[12px]"
              numberOfLines={1}
              style={{
                color: palette.secondaryText,
                lineHeight: lineHeightFor(12, 1.12),
              }}
            >
              {groupSubtitle}
            </Text>
          </View>
        </View>
      </View>

      <View className="flex-1">
        <AppMap
          borderRadius={0}
          connectPointsWhenRouteMissing={false}
          connectionLines={mapConnectionLines}
          fitEdgePadding={mapFitEdgePadding}
          focusVerticalOffsetRatio={0.18}
          focusedPointId={mapFocusMemberId}
          height={mapHeight + insets.bottom}
          highlightedPointId={selectedMemberId}
          mapType={mapType}
          onPointPress={(point) => {
            handleSelectMember(`${point.id}`);
          }}
          points={mapPoints}
          routeCoordinates={mapType === "hybrid" ? routeCoordinates : undefined}
          showsMyLocationButton={false}
          showsUserLocation
        />

        <View className="absolute inset-0" pointerEvents="box-none">
          <View
            className="absolute left-4"
            pointerEvents="box-none"
            style={{ top: mapOverlayTop }}
          >
            <View
              className="rounded-[20px] px-4 py-3"
              style={{
                backgroundColor: "rgba(255, 255, 255, 0.96)",
                maxWidth: 220,
                shadowColor: "#162033",
                shadowOffset: { width: 0, height: 8 },
                shadowOpacity: 0.08,
                shadowRadius: 14,
              }}
            >
              <View className="flex-row items-center">
                <View
                  className="h-[8px] w-[8px] rounded-full"
                  style={{ backgroundColor: shareCardMeta.dotColor }}
                />
                <Text
                  className="ml-2 text-[14px] font-semibold"
                  style={{
                    color: palette.primaryText,
                    lineHeight: lineHeightFor(14),
                  }}
                >
                  {shareCardMeta.title}
                </Text>

                <View className="ml-3">
                  <SignalBars
                    activeBars={shareCardMeta.bars}
                    color={shareCardMeta.dotColor}
                  />
                </View>
              </View>

              <Text
                className="mt-1 text-[13px]"
                numberOfLines={1}
                style={{
                  color: palette.secondaryText,
                  lineHeight: bodyLineHeightFor(13),
                }}
              >
                {shareCardMeta.detail}
              </Text>
            </View>
          </View>

          <View
            className="absolute right-4 gap-3"
            pointerEvents="box-none"
            style={{ bottom: floatingButtonsBottom }}
          >
            <FloatingMapButton
              active={mapType === "hybrid"}
              icon="layers"
              onPress={handleToggleMapType}
            />
            <FloatingMapButton
              active={mapFocusMemberId === currentUserMember?.userId}
              icon="my-location"
              onPress={handleFocusCurrentUser}
            />
            <FloatingMapButton
              active={!isMapFocused}
              icon={{
                android: "near_me",
                ios: "location.north.line.fill",
                web: "near_me",
              }}
              onPress={handleShowMemberList}
            />
          </View>

          <View
            className="absolute bottom-0 left-0 right-0"
            pointerEvents="box-none"
          >
            <View
              className="rounded-t-[34px]"
              style={{
                backgroundColor: "rgba(255, 255, 255, 0.98)",
                height: bottomSheetHeight,
                paddingBottom: Math.max(insets.bottom, 16),
                shadowColor: "#162033",
                shadowOffset: { width: 0, height: -10 },
                shadowOpacity: 0.12,
                shadowRadius: 20,
              }}
            >
              <View className="items-center pb-2 pt-3">
                <View
                  className="h-[5px] w-[52px] rounded-full"
                  style={{ backgroundColor: "#D7E1EE" }}
                />
              </View>

              <ScrollView
                bounces={false}
                contentContainerStyle={{ paddingBottom: 24 }}
                showsVerticalScrollIndicator={false}
              >
                <View className="px-4">
                  <View className="flex-row gap-2">
                    <SheetActionButton
                      active={isMapFocused}
                      icon={{
                        android: "my_location",
                        ios: "location",
                        web: "my_location",
                      }}
                      label="Tập trung"
                      onPress={handleFocusSelectedMember}
                    />
                    {resolvedRouteId ? (
                      <SheetActionButton
                        disabled={
                          isStoppingRoute ||
                          shareMode === "route_stopped" ||
                          shareMode === "group_forced_stop"
                        }
                        icon={{
                          android: "stop_circle",
                          ios: "stop.circle.fill",
                          web: "stop_circle",
                        }}
                        isLoading={isStoppingRoute}
                        label="Dừng tuyến"
                        onPress={handleStopRoute}
                        tone="danger"
                      />
                    ) : null}
                    <SheetActionButton
                      disabled={shouldDisableShareToggle}
                      icon={primaryShareAction.icon}
                      label={primaryShareAction.label}
                      onPress={handleToggleShare}
                      tone="danger"
                    />
                  </View>

                  {combinedErrorMessage ? (
                    <View
                      className="mt-3 rounded-[18px] border px-3.5 py-3"
                      style={{
                        backgroundColor: "#FFF6EF",
                        borderColor: "#F7D9BF",
                      }}
                    >
                      <Text
                        className="text-[13px]"
                        style={{
                          color: "#BC6A2A",
                          lineHeight: bodyLineHeightFor(13),
                        }}
                      >
                        {combinedErrorMessage}
                      </Text>
                    </View>
                  ) : null}

                  {!isPermissionGranted ? (
                    <View
                      className="mt-3 flex-row rounded-[20px] border px-3.5 py-3"
                      style={{
                        backgroundColor: "#FFF7F0",
                        borderColor: "#F6DFC6",
                      }}
                    >
                      <View
                        className="mr-3 h-8 w-8 items-center justify-center rounded-full"
                        style={{
                          backgroundColor: "#FDEAD7",
                        }}
                      >
                        <SymbolView
                          name={{
                            android: "info",
                            ios: "info.circle",
                            web: "info",
                          }}
                          size={15}
                          tintColor="#CB8242"
                        />
                      </View>
                      <Text
                        className="flex-1 text-[13px]"
                        style={{
                          color: "#AA6D31",
                          lineHeight: bodyLineHeightFor(13),
                        }}
                      >
                        Ứng dụng cần quyền vị trí foreground để chia sẻ vị trí
                        live ổn định.
                      </Text>
                    </View>
                  ) : null}

                  <View className="mt-4">
                    {decoratedJourneyMembers.map((member, index) => (
                      <View key={member.userId}>
                        <MemberRow
                          isLeader={isLeader}
                          isSelected={member.userId === selectedMemberId}
                          member={member}
                          onPress={() => {
                            handleSelectMember(member.userId);
                          }}
                        />
                        {index < decoratedJourneyMembers.length - 1 ? (
                          <View
                            className="ml-[66px] mr-3 h-px"
                            style={{ backgroundColor: "#EDF2F7" }}
                          />
                        ) : null}
                      </View>
                    ))}
                  </View>
                </View>
              </ScrollView>
            </View>
          </View>
        </View>
      </View>

      {stopDialogVariant ? (
        <JourneyStopConfirmDialog
          isSubmitting={stopDialogVariant === "stop-route" && isStoppingRoute}
          onCancel={handleCloseStopDialog}
          onConfirm={handleConfirmStopDialog}
          variant={stopDialogVariant}
          visible={isStopDialogVisible}
        />
      ) : null}
    </SafeAreaView>
  );
}
