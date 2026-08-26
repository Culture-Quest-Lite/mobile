import { LinearGradient } from "expo-linear-gradient";
import { useRouter, type Href } from "expo-router";
import { StatusBar } from "expo-status-bar";
import { Fragment, useEffect, useState } from "react";
import {
  Image,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";
import { useTranslation } from "react-i18next";
import { SafeAreaView } from "react-native-safe-area-context";

import { appAlert } from "@/components/ui/app-dialog";
import { AppLoadingScreen } from "@/components/ui/app-loading-screen";
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
import { lineHeightFor } from "@/lib/text-scale";

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

function formatGroupRowDate(
  group: CommunityGroupPayload,
  t: (key: string, options?: Record<string, unknown>) => string,
) {
  const normalizedDateValue = normalizeDateValue(group.updatedAt ?? group.createdAt);

  if (!normalizedDateValue) {
    return t("community.groupsScreen.dateNew");
  }

  const date = new Date(normalizedDateValue);

  if (Number.isNaN(date.getTime())) {
    return normalizedDateValue.slice(0, 10).replace(/-/g, "/");
  }

  return `${padDatePart(date.getDate())}/${padDatePart(
    date.getMonth() + 1,
  )}/${date.getFullYear()}`;
}

function getGroupAccessLabel(
  requiredApproval: boolean | null | undefined,
  t: (key: string, options?: Record<string, unknown>) => string,
) {
  return requiredApproval === true
    ? t("community.groupsScreen.access.approvalRequired")
    : t("community.groupsScreen.access.openJoin");
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

function CommunityGroupAvatar({ imageUrl }: { imageUrl?: string | null }) {
  const meaningfulImageUrl = readMeaningfulText(imageUrl);

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
      <View className="h-11 w-11 items-center justify-center rounded-full bg-[#FFEAF3] overflow-hidden">
        {meaningfulImageUrl ? (
          <Image
            source={{ uri: meaningfulImageUrl }}
            resizeMode="cover"
            style={{ height: 44, width: 44, borderRadius: 999 }}
          />
        ) : (
          <View className="h-11 w-11 items-center justify-center rounded-full bg-[#FFEAF3]">
            <SymbolView
              name={{ ios: "person.3.fill", android: "groups", web: "groups" }}
              size={22}
              tintColor="#FF5B92"
            />
          </View>
        )}
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
  const { t } = useTranslation();
  const groupName =
    readMeaningfulText(group.groupName) ?? t("community.groupsScreen.unnamedGroup");
  const accessPalette = getGroupAccessPalette(group.requiredApproval);

  return (
    <Pressable
      className="rounded-[18px] px-1 py-3"
      onPress={onPress}
      style={({ pressed }) => ({
        backgroundColor: pressed ? "#FBF8FC" : "transparent",
      })}
    >
      <View className="flex-row items-start">
        <CommunityGroupAvatar imageUrl={group.imageUrl} />

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
                    lineHeight: lineHeightFor(15),
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
              className="text-[11px] font-normal text-[#A9A1B1]"
              style={{
                includeFontPadding: false,
                lineHeight: lineHeightFor(11),
              }}
            >
              {formatGroupRowDate(group, t)}
            </Text>
          </View>

          <View
            className="mt-1.5 flex-row flex-wrap items-center"
            style={{ columnGap: 8, rowGap: 4 }}
          >
            <View className="flex-row items-center px-2 py-[5px]">
              <SymbolView
                name={{
                  ios: "person.2.fill",
                  android: "groups",
                  web: "groups",
                }}
                size={12}
                tintColor="#6F657A"
              />
              <Text
                className="ml-1 text-[12px] font-normal text-[#6F657A]"
                style={{
                  includeFontPadding: false,
                  lineHeight: lineHeightFor(12),
                }}
              >
                {t("community.groupsScreen.memberCountLabel", {
                  count: formatCompactCount(group.totalMembers),
                })}
              </Text>
            </View>

            <View
              className="flex-row items-center rounded-full px-2 py-[5px]"
              style={{ backgroundColor: accessPalette.backgroundColor }}
            >
              <SymbolView
                name={group.requiredApproval === true ? "lock.fill" : "link"}
                size={12}
                tintColor={accessPalette.iconColor}
              />
              <Text
                className="ml-1 text-[12px] font-normal"
                style={{
                  color: accessPalette.textColor,
                  includeFontPadding: false,
                  lineHeight: lineHeightFor(12),
                }}
              >
                {getGroupAccessLabel(group.requiredApproval, t)}
              </Text>
            </View>
          </View>
        </View>
      </View>
    </Pressable>
  );
}

function CommunityGroupListDivider() {
  return (
    <View
      style={{
        backgroundColor: "#F0EBF4",
        height: StyleSheet.hairlineWidth,
        width: "100%",
      }}
    />
  );
}

function CommunityGroupsLoadingState() {
  return <AppLoadingScreen />;
}

export default function CommunityGroupsScreen() {
  const { t } = useTranslation();
  const authSession = useAuthSession();
  const router = useRouter();
  const [currentProfileId, setCurrentProfileId] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState("");
  const { gutter, insets } = useScreenLayout({
    maxContentWidth: 640,
  });
  const { errorMessage, groups, reload, status } = useCommunityGroups();
  const normalizedSearchQuery = normalizeLookupText(searchQuery.trim());
  const hasActiveSearch = normalizedSearchQuery.length > 0;
  const filteredGroups =
    !hasActiveSearch
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
      appAlert.alert(
        t("community.groupsCommon.openErrorTitle"),
        t("community.groupsCommon.openErrorMessage"),
      );
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
        title={t("community.groupsScreen.headerTitle")}
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
          className="overflow-hidden rounded-[14px] px-4 py-4"
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
                className="text-[16px] font-semibold text-[#2E2336]"
                style={{
                  includeFontPadding: false,
                  lineHeight: lineHeightFor(16),
                }}
              >
                {t("community.groupsScreen.heroTitle")}
              </Text>
              <Text
                className="mt-0.5 text-[13px] font-normal text-[#7A6F67]"
                style={{
                  includeFontPadding: false,
                  lineHeight: lineHeightFor(13),
                }}
              >
                {status === "ready"
                  ? t("community.groupsScreen.heroSubtitleReady", {
                      count: groups.length,
                    })
                  : t("community.groupsScreen.heroSubtitlePending")}
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
                    className="ml-1.5 text-[13px] font-normal text-white"
                    style={{
                      includeFontPadding: false,
                      lineHeight: lineHeightFor(13),
                    }}
                  >
                    {t("community.groupsScreen.createButton")}
                  </Text>
                </LinearGradient>
              </Pressable>
            </View>

            <CommunityGroupsHeroArtwork />
          </View>
        </LinearGradient>

        <View className="mt-4">
          <View
            className="h-12 flex-row items-center rounded-[18px] border bg-white px-3"
            style={{ borderColor: "#EEE8F3", borderWidth: 1 }}
          >
            <SymbolView
              name={{
                ios: "magnifyingglass",
                android: "search",
                web: "search",
              }}
              size={16}
              tintColor="#ACA3B5"
            />
            <TextInput
              className="ml-2 flex-1 text-[14px] text-[#2E2336]"
              onChangeText={setSearchQuery}
              placeholder={t("community.groupsScreen.searchPlaceholder")}
              placeholderTextColor="#B1A8BA"
              style={{ includeFontPadding: false }}
              value={searchQuery}
            />
          </View>
        </View>

        {status === "error" && groups.length === 0 ? (
          <View className="mt-4">
            <CommunityGroupStateCard
              actionLabel={t("common.retry")}
              description={
                errorMessage ?? t("community.groupsCommon.loadError")
              }
              icon="error"
              onPress={reload}
              title={t("community.groupsCommon.loadErrorTitle")}
              variant="error"
            />
          </View>
        ) : null}

        {status === "ready" && groups.length === 0 ? (
          <View className="mt-4">
            <CommunityGroupStateCard
              actionLabel={t("community.groups.create")}
              description={t("community.groupsScreen.emptyDescription")}
              icon="groups"
              onPress={openCommunityGroupCreate}
              title={t("community.groupsCommon.emptyTitle")}
              variant="empty"
            />
          </View>
        ) : null}

        {groups.length > 0 && hasActiveSearch && filteredGroups.length === 0 ? (
          <View className="mt-4">
            <Text
              className="text-center text-[14px] font-normal text-[#7A6F67]"
              style={{
                includeFontPadding: false,
                lineHeight: lineHeightFor(14),
              }}
            >
              {t("community.groupsScreen.searchEmptyTitle")}
            </Text>
          </View>
        ) : null}

        {filteredGroups.length > 0 ? (
          <View className="mt-2">
            {filteredGroups.map((group, groupIndex) => (
              <Fragment key={group.shareToken}>
                {groupIndex > 0 ? <CommunityGroupListDivider /> : null}
                <CommunityGroupListRow
                  group={group}
                  isLeader={isCommunityGroupLeader(group, currentProfileId)}
                  onPress={() => {
                    openCommunityGroupDetail(group);
                  }}
                />
              </Fragment>
            ))}
          </View>
        ) : null}
      </ScrollView>
    </SafeAreaView>
  );
}
