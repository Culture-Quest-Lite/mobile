import { LinearGradient } from "expo-linear-gradient";
import { useRouter, type Href } from "expo-router";
import { StatusBar } from "expo-status-bar";
import { useEffect, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  Image,
  Pressable,
  ScrollView,
  Text,
  TextInput,
  View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

import { SymbolView } from "@/components/ui/symbol-view";
import {
  getValidAccessToken,
  useAuthSession,
} from "@/features/auth/hooks/use-auth-session";
import type { CommunityGroupPayload } from "@/features/community/api/group-api";
import {
  CommunityGroupStateCard,
  CommunityGroupTopBar,
} from "@/features/community/components/community-group-ui";
import { cacheCommunityGroupSession } from "@/features/community/data/community-group-session-store";
import { useCommunityGroups } from "@/features/community/hooks/use-community-groups";
import { getMyProfile } from "@/features/profile/api/get-me";
import { useScreenLayout } from "@/hooks/use-screen-layout";

const communityGroupsHeroImage = require("../../../../assets/images/tachnengroup.png");

function readMeaningfulText(value?: string | null) {
  if (typeof value !== "string") {
    return null;
  }

  const trimmedValue = value.trim();
  return trimmedValue ? trimmedValue : null;
}

function normalizeLookupText(value?: string | null) {
  return (value ?? "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase();
}

function formatCompactCount(value?: number | null) {
  const resolvedValue =
    typeof value === "number" && Number.isFinite(value)
      ? Math.max(0, Math.round(value))
      : 0;

  if (resolvedValue < 1000) {
    return `${resolvedValue}`;
  }

  const formattedValue = resolvedValue / 1000;
  return `${formattedValue >= 10 ? formattedValue.toFixed(0) : formattedValue.toFixed(1)}k`;
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

function formatGroupRowDate(group: CommunityGroupPayload) {
  const normalizedDateValue = normalizeDateValue(group.updatedAt ?? group.createdAt);

  if (!normalizedDateValue) {
    return "Mới";
  }

  const date = new Date(normalizedDateValue);

  if (Number.isNaN(date.getTime())) {
    return normalizedDateValue.slice(0, 10).replace(/-/g, "/");
  }

  const today = new Date();
  const isToday =
    date.getDate() === today.getDate() &&
    date.getMonth() === today.getMonth() &&
    date.getFullYear() === today.getFullYear();

  if (isToday) {
    return "Hôm nay";
  }

  return `${padDatePart(date.getDate())}/${padDatePart(date.getMonth() + 1)}`;
}

function getLocalizedGroupStatusLabel(status?: string | null) {
  switch ((status ?? "").trim().toUpperCase()) {
    case "ACTIVE":
      return "Đang hoạt động";
    case "PENDING":
      return "Đang chờ duyệt";
    case "INACTIVE":
      return "Tạm ngưng";
    default:
      return "Nhóm cộng đồng";
  }
}

function getGroupAccessLabel(requiredApproval?: boolean | null) {
  return requiredApproval === true ? "Cần leader duyệt" : "Tham gia tự do";
}

function getGroupAccessPalette(requiredApproval?: boolean | null) {
  if (requiredApproval === true) {
    return {
      backgroundColor: "#FFF4DE",
      iconColor: "#E39B1A",
      textColor: "#E39B1A",
    };
  }

  return {
    backgroundColor: "#EAF8ED",
    iconColor: "#4CAF6A",
    textColor: "#4CAF6A",
  };
}

function isCommunityGroupLeader(
  group: CommunityGroupPayload,
  currentProfileId?: string | null,
) {
  if (!currentProfileId) {
    return false;
  }

  return readMeaningfulText(group.leaderId) === currentProfileId;
}

function CommunityGroupsHeroArtwork() {
  return (
    <Image
      source={communityGroupsHeroImage}
      resizeMode="contain"
      style={{
        height: 118,
        width: 142,
      }}
    />
  );
}

function CommunityGroupAvatar() {
  return (
    <View
      className="h-14 w-14 items-center justify-center rounded-full bg-[#FFF8FB]"
      style={{
        borderColor: "#FFCFE0",
        borderWidth: 0.8,
        shadowColor: "rgba(255, 108, 156, 0.18)",
        shadowOpacity: 1,
        shadowRadius: 10,
        shadowOffset: {
          width: 0,
          height: 4,
        },
        elevation: 2,
      }}
    >
      <View className="h-11 w-11 items-center justify-center rounded-full bg-[#FFEAF3]">
        <SymbolView
          name={{ ios: "person.3.fill", android: "groups", web: "groups" }}
          size={22}
          tintColor="#FF5B92"
        />
      </View>
    </View>
  );
}

function CommunityGroupListRow({
  group,
  isLeader = false,
  onPress,
}: {
  group: CommunityGroupPayload;
  isLeader?: boolean;
  onPress: () => void;
}) {
  const groupName = readMeaningfulText(group.groupName) ?? "Nhóm chưa đặt tên";
  const accessPalette = getGroupAccessPalette(group.requiredApproval);

  return (
    <Pressable
      className="rounded-[22px] bg-white px-3.5 py-3"
      onPress={onPress}
      style={({ pressed }) => ({
        borderColor: "#EEE5F2",
        borderWidth: 1,
        opacity: pressed ? 0.9 : 1,
        shadowColor: "#2B1D3A",
        shadowOpacity: 0.08,
        shadowRadius: 16,
        shadowOffset: {
          width: 0,
          height: 7,
        },
        elevation: 3,
      })}
    >
      <View className="flex-row items-start">
        <CommunityGroupAvatar />

        <View className="ml-3 flex-1">
          <View className="flex-row items-start justify-between">
            <View className="mr-3 flex-1">
              <View
                className="flex-row items-center self-start"
                style={{ columnGap: 4, maxWidth: "100%" }}
              >
                <Text
                  className="text-[15px] font-normal text-[#2E2336]"
                  numberOfLines={2}
                  style={{
                    flexShrink: 1,
                    includeFontPadding: false,
                    lineHeight: 18,
                  }}
                >
                  {groupName}
                </Text>
                {isLeader ? (
                  <SymbolView
                    name={{
                      ios: "crown.fill",
                      android: "workspace-premium",
                      web: "workspace-premium",
                    }}
                    size={18}
                    tintColor="#E39B1A"
                  />
                ) : null}
              </View>
            </View>
            <Text
              className="text-[12px] font-medium text-[#A9A1B1]"
              style={{ includeFontPadding: false, lineHeight: 16 }}
            >
              {formatGroupRowDate(group)}
            </Text>
          </View>

          <View className="mt-1 flex-row items-center">
            <View className="h-2 w-2 rounded-full bg-[#4BB862]" />
            <Text
              className="ml-1.5 text-[12px] font-normal text-[#5A5563]"
              style={{ includeFontPadding: false, lineHeight: 14 }}
            >
              {getLocalizedGroupStatusLabel(group.status)}
            </Text>
          </View>

          <View
            className="mt-1.5 flex-row flex-wrap items-center"
            style={{ columnGap: 8, rowGap: 6 }}
          >
            <View className="flex-row items-center rounded-full bg-[#F4F2F7] px-2.5 py-1">
              <SymbolView
                name={{ ios: "person.2.fill", android: "groups", web: "groups" }}
                size={11}
                tintColor="#7D7488"
              />
              <Text
                className="ml-1 text-[12px] font-normal text-[#7D7488]"
                style={{ includeFontPadding: false, lineHeight: 12 }}
              >
                {formatCompactCount(group.totalMembers)} thành viên
              </Text>
            </View>

            <View
              className="flex-row items-center rounded-full px-2.5 py-1"
              style={{ backgroundColor: accessPalette.backgroundColor }}
            >
              <SymbolView
                name={group.requiredApproval === true ? "lock.fill" : "link"}
                size={11}
                tintColor={accessPalette.iconColor}
              />
              <Text
                className="ml-1 text-[12px] font-normal"
                style={{
                  color: accessPalette.textColor,
                  includeFontPadding: false,
                  lineHeight: 12,
                }}
              >
                {getGroupAccessLabel(group.requiredApproval)}
              </Text>
            </View>
          </View>
        </View>
      </View>
    </Pressable>
  );
}

function CommunityGroupsLoadingState() {
  return (
    <View className="flex-1 bg-white">
      <StatusBar style="dark" />
      <SafeAreaView className="flex-1" edges={["top", "left", "right", "bottom"]}>
        <View className="flex-1 items-center justify-center px-6">
          <ActivityIndicator color="#EB489B" size="large" />
        </View>
      </SafeAreaView>
    </View>
  );
}

export default function CommunityGroupsScreen() {
  const authSession = useAuthSession();
  const router = useRouter();
  const [currentProfileId, setCurrentProfileId] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState("");
  const { gutter, insets } = useScreenLayout({
    maxContentWidth: 640,
  });
  const { errorMessage, groups, reload, status } = useCommunityGroups();
  const normalizedSearchQuery = normalizeLookupText(searchQuery.trim());
  const filteredGroups =
    normalizedSearchQuery.length === 0
      ? groups
      : groups.filter((group) =>
          normalizeLookupText(group.groupName).includes(normalizedSearchQuery),
        );

  useEffect(() => {
    let isActive = true;

    async function loadCurrentProfile() {
      if (!authSession.isAuthenticated) {
        if (isActive) {
          setCurrentProfileId(null);
        }
        return;
      }

      try {
        const accessToken = await getValidAccessToken();

        if (!accessToken) {
          if (isActive) {
            setCurrentProfileId(null);
          }
          return;
        }

        const profile = await getMyProfile({
          accessToken,
          tokenType: authSession.tokenType,
        });

        if (!isActive) {
          return;
        }

        setCurrentProfileId(profile.id);
      } catch (error) {
        console.warn("[community] load groups screen profile failed", {
          error: error instanceof Error ? error.message : error,
        });

        if (!isActive) {
          return;
        }

        setCurrentProfileId(null);
      }
    }

    void loadCurrentProfile();

    return () => {
      isActive = false;
    };
  }, [authSession.isAuthenticated, authSession.tokenType]);

  const openCommunityGroupCreate = () => {
    router.push("/community/group-create" as Href);
  };

  const openCommunityGroupDetail = (group: CommunityGroupPayload) => {
    const cachedGroup = cacheCommunityGroupSession({
      ...group,
      source: "listed",
    });

    if (!cachedGroup) {
      Alert.alert("Không mở được nhóm", "Dữ liệu nhóm này chưa hợp lệ.");
      return;
    }

    const detailRouteKey = cachedGroup.groupId ?? cachedGroup.shareToken;

    router.push(
      `/community/group/${encodeURIComponent(detailRouteKey)}` as Href,
    );
  };

  if (status === "idle" || (status === "loading" && groups.length === 0)) {
    return <CommunityGroupsLoadingState />;
  }

  return (
    <SafeAreaView className="flex-1 bg-white" edges={["top", "left", "right"]}>
      <StatusBar style="dark" />

      <CommunityGroupTopBar
        backgroundColor="#FFFFFF"
        onBack={() => {
          router.back();
        }}
        title="Tất cả nhóm"
      />

      <ScrollView
        contentContainerStyle={{
          paddingBottom: Math.max(insets.bottom + 24, 32),
          paddingHorizontal: gutter,
          paddingTop: 12,
        }}
        showsVerticalScrollIndicator={false}
      >
        <LinearGradient
          className="overflow-hidden rounded-[28px] px-4 py-4"
          colors={["#FFF4F8", "#FFF0F6", "#FFEAF3"]}
          end={{ x: 1, y: 1 }}
          start={{ x: 0, y: 0 }}
          style={{
            shadowColor: "rgba(57, 39, 78, 0.08)",
            shadowOpacity: 1,
            shadowRadius: 18,
            shadowOffset: {
              width: 0,
              height: 8,
            },
            elevation: 4,
          }}
        >
          <View className="flex-row items-center justify-between">
            <View className="max-w-[56%]">
              <Text
                className="text-[15px] font-semibold text-[#2E2336]"
                style={{ includeFontPadding: false, lineHeight: 18 }}
              >
                Nhóm của bạn
              </Text>
              <Text
                className="mt-0.5 text-[12px] text-[#7F7488]"
                style={{ includeFontPadding: false, lineHeight: 14 }}
              >
                {status === "ready"
                  ? `${groups.length} nhóm đang có sẵn trong tài khoản của bạn`
                  : "Danh sách nhóm sẽ được làm mới khi bạn mở màn này"}
              </Text>

              <Pressable
                className="mt-3 self-start overflow-hidden rounded-full"
                onPress={openCommunityGroupCreate}
                style={({ pressed }) => ({
                  opacity: pressed ? 0.9 : 1,
                })}
              >
                <LinearGradient
                  className="flex-row items-center px-4 py-2"
                  colors={["#FF6A8E", "#FF4F84"]}
                  end={{ x: 1, y: 1 }}
                  start={{ x: 0, y: 0 }}
                >
                  <SymbolView
                    name={{ ios: "plus", android: "add", web: "add" }}
                    size={14}
                    tintColor="#FFFFFF"
                  />
                  <Text
                    className="ml-1.5 text-[13px] font-medium text-white"
                    style={{ includeFontPadding: false, lineHeight: 13 }}
                  >
                    Tạo nhóm mới
                  </Text>
                </LinearGradient>
              </Pressable>
            </View>

            <CommunityGroupsHeroArtwork />
          </View>
        </LinearGradient>

        <View className="mt-4 flex-row items-center" style={{ columnGap: 10 }}>
          <View
            className="h-12 flex-1 flex-row items-center rounded-[18px] border bg-white px-3"
            style={{ borderColor: "#EEE8F3", borderWidth: 1 }}
          >
            <SymbolView
              name={{ ios: "magnifyingglass", android: "search", web: "search" }}
              size={16}
              tintColor="#ACA3B5"
            />
            <TextInput
              className="ml-2 flex-1 text-[13px] text-[#2E2336]"
              onChangeText={setSearchQuery}
              placeholder="Tìm kiếm nhóm..."
              placeholderTextColor="#B1A8BA"
              style={{ includeFontPadding: false }}
              value={searchQuery}
            />
          </View>

          <View
            className="h-12 flex-row items-center rounded-[18px] border bg-white px-3.5"
            style={{ borderColor: "#EEE8F3", borderWidth: 1 }}
          >
            <SymbolView
              name={{
                ios: "slider.horizontal.3",
                android: "tune",
                web: "tune",
              }}
              size={15}
              tintColor="#756B80"
            />
            <Text
              className="ml-1.5 text-[13px] font-medium text-[#756B80]"
              style={{ includeFontPadding: false, lineHeight: 15 }}
            >
              Bộ lọc
            </Text>
          </View>
        </View>

        {status === "error" && groups.length === 0 ? (
          <View className="mt-4">
            <CommunityGroupStateCard
              actionLabel="Thử lại"
              description={
                errorMessage ?? "Không tải được danh sách nhóm cộng đồng."
              }
              icon="error"
              onPress={reload}
              title="Không tải được nhóm"
              variant="error"
            />
          </View>
        ) : null}

        {status === "ready" && groups.length === 0 ? (
          <View className="mt-4">
            <CommunityGroupStateCard
              actionLabel="Tạo nhóm"
              description="Bạn chưa có nhóm nào. Hãy tạo nhóm đầu tiên để bắt đầu."
              icon="groups"
              onPress={openCommunityGroupCreate}
              title="Chưa có nhóm"
              variant="empty"
            />
          </View>
        ) : null}

        {groups.length > 0 && filteredGroups.length === 0 ? (
          <View className="mt-4">
            <CommunityGroupStateCard
              description="Thử nhập tên nhóm khác để tìm lại danh sách phù hợp."
              icon="groups"
              title="Không tìm thấy nhóm"
              variant="empty"
            />
          </View>
        ) : null}

        {filteredGroups.length > 0 ? (
          <View className="mt-3.5" style={{ rowGap: 8 }}>
            {filteredGroups.map((group) => (
              <CommunityGroupListRow
                key={group.shareToken}
                group={group}
                isLeader={isCommunityGroupLeader(group, currentProfileId)}
                onPress={() => {
                  openCommunityGroupDetail(group);
                }}
              />
            ))}
          </View>
        ) : null}
      </ScrollView>
    </SafeAreaView>
  );
}
