import { SymbolView } from "@/components/ui/symbol-view";
import { UserAvatar } from "@/components/ui/user-avatar";
import {
  getValidAccessToken,
  useAuthSession,
} from "@/features/auth/hooks/use-auth-session";
import {
  getMutualFollowUsers,
  type MutualFollowUser,
} from "@/features/community/api/get-mutual-follow-users";
import {
  createCommunityGroup,
  type CommunityGroupPayload,
} from "@/features/community/api/group-api";
import { LinearGradient } from "expo-linear-gradient";
import { useRouter, type Href } from "expo-router";
import { StatusBar } from "expo-status-bar";
import { useEffect, useMemo, useState } from "react";
import {
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  useWindowDimensions,
  View,
} from "react-native";
import {
  SafeAreaView,
  useSafeAreaInsets,
} from "react-native-safe-area-context";

import { cacheCommunityGroupSession } from "../data/community-group-session-store";

const screenPalette = {
  accent: "#FF5A87",
  accentSoft: "#FFD9E5",
  borderStrong: "#D7DCE4",
  icon: "#A2AAB5",
  muted: "#7B8591",
  surface: "#FFFFFF",
  text: "#18212F",
};

const inviteAvatarPalettes = [
  ["#D9F26A", "#5BD6B0"],
  ["#F472B6", "#FB7185"],
  ["#4ADE80", "#22C55E"],
  ["#C4B5FD", "#818CF8"],
  ["#FDBA74", "#FB923C"],
  ["#60A5FA", "#2563EB"],
] as const;

function buildCreatedGroupSession(
  groupName: string,
  payload: CommunityGroupPayload,
) {
  return cacheCommunityGroupSession({
    ...payload,
    groupName,
    source: "created",
  });
}

function normalizeLookupText(value: string) {
  return value
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase();
}

function normalizeUsername(value: string) {
  return value.trim().replace(/^@+/, "");
}

function getInviteAvatarColors(userId: number) {
  return inviteAvatarPalettes[
    Math.abs(userId) % inviteAvatarPalettes.length
  ] as readonly [string, string];
}

function buildInviteCandidateSubtitle(candidate: MutualFollowUser) {
  const username = normalizeUsername(candidate.username);

  if (username) {
    return `@${username}`;
  }

  return "Tài khoản người dùng";
}

function matchesInviteCandidate(candidate: MutualFollowUser, query: string) {
  const normalizedQuery = normalizeLookupText(query.trim());

  if (!normalizedQuery) {
    return true;
  }

  return normalizeLookupText(
    `${candidate.displayName} ${candidate.username} ${candidate.userId}`,
  ).includes(normalizedQuery);
}

function GroupAvatarPlaceholder({ compact }: { compact: boolean }) {
  const avatarSize = compact ? 58 : 62;
  const iconSize = compact ? 27 : 29;
  const sparkleSize = compact ? 10 : 11;

  return (
    <View
      style={[
        styles.groupAvatarOuter,
        {
          borderRadius: avatarSize / 2,
          height: avatarSize,
          width: avatarSize,
        },
      ]}
    >
      <LinearGradient
        colors={["#FFF7FA", "#FFFDFE"]}
        end={{ x: 1, y: 1 }}
        start={{ x: 0, y: 0 }}
        style={[
          styles.groupAvatarInner,
          {
            borderRadius: avatarSize / 2 - 1,
          },
        ]}
      >
        <SymbolView
          name={{
            ios: "person.3.fill",
            android: "groups",
            web: "groups",
          }}
          size={iconSize}
          tintColor="#FF7AA3"
        />

        <View
          style={[
            styles.groupAvatarSparkle,
            {
              right: compact ? 8 : 9,
              top: compact ? 8 : 9,
            },
          ]}
        >
          <SymbolView
            name={{
              ios: "sparkles",
              android: "auto_awesome",
              web: "auto_awesome",
            }}
            size={sparkleSize}
            tintColor="#FF9ABB"
          />
        </View>
      </LinearGradient>
    </View>
  );
}

function InviteSelectionCircle({
  compact,
  selected,
}: {
  compact: boolean;
  selected: boolean;
}) {
  const circleSize = compact ? 18 : 20;
  const innerSize = compact ? 8 : 9;

  return (
    <View
      style={[
        styles.selectionCircle,
        {
          borderRadius: circleSize / 2,
          height: circleSize,
          width: circleSize,
        },
        selected ? styles.selectionCircleActive : undefined,
      ]}
    >
      {selected ? (
        <View
          style={[
            styles.selectionCircleInner,
            {
              borderRadius: innerSize / 2,
              height: innerSize,
              width: innerSize,
            },
          ]}
        />
      ) : null}
    </View>
  );
}

function InviteCandidateRow({
  candidate,
  compact,
  selected,
  onPress,
}: {
  candidate: MutualFollowUser;
  compact: boolean;
  onPress: () => void;
  selected: boolean;
}) {
  const avatarSize = compact ? 36 : 38;

  return (
    <Pressable
      className="flex-row items-center"
      onPress={onPress}
      style={({ pressed }) => [
        styles.inviteRow,
        {
          backgroundColor: pressed ? "#FFF8FB" : screenPalette.surface,
          paddingVertical: compact ? 10 : 11,
        },
      ]}
    >
      <UserAvatar
        borderColor="#FFFFFF"
        borderWidth={2}
        colors={getInviteAvatarColors(candidate.userId)}
        containerStyle={styles.inviteAvatar}
        displayName={candidate.displayName}
        size={avatarSize}
        uri={candidate.avatarUrl}
      />

      <View
        className="flex-1"
        style={{ marginLeft: compact ? 10 : 12, minWidth: 0 }}
      >
        <Text
          numberOfLines={1}
          style={{
            color: screenPalette.text,
            fontSize: compact ? 13.5 : 14,
            fontWeight: "400",
            includeFontPadding: false,
            lineHeight: compact ? 13 : 14,
          }}
        >
          {candidate.displayName}
        </Text>
        <Text
          numberOfLines={1}
          style={{
            color: screenPalette.muted,
            fontSize: compact ? 11 : 11.5,
            fontWeight: "400",
            includeFontPadding: false,
            lineHeight: compact ? 11 : 12,
          }}
        >
          {buildInviteCandidateSubtitle(candidate)}
        </Text>
      </View>

      <InviteSelectionCircle compact={compact} selected={selected} />
    </Pressable>
  );
}

export default function CommunityGroupCreateScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { width } = useWindowDimensions();
  const authSession = useAuthSession();
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [groupName, setGroupName] = useState("");
  const [inviteCandidates, setInviteCandidates] = useState<MutualFollowUser[]>(
    [],
  );
  const [inviteCandidatesErrorMessage, setInviteCandidatesErrorMessage] =
    useState<string | null>(null);
  const [inviteRefreshNonce, setInviteRefreshNonce] = useState(0);
  const [isInviteCandidatesLoading, setIsInviteCandidatesLoading] =
    useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedInviteIds, setSelectedInviteIds] = useState<string[]>([]);

  const isCompactScreen = width < 380;
  const contentHorizontalPadding = isCompactScreen ? 14 : 16;
  const trimmedGroupName = groupName.trim();
  const isSubmitInactive = trimmedGroupName.length === 0;
  const isSubmitDisabled = isSubmitting || isSubmitInactive;
  const resolvedInviteCandidates = useMemo(
    () => (authSession.isAuthenticated ? inviteCandidates : []),
    [authSession.isAuthenticated, inviteCandidates],
  );
  const selectedUserIds = useMemo(() => {
    if (!authSession.isAuthenticated || selectedInviteIds.length === 0) {
      return [];
    }

    const selectedInviteIdSet = new Set(selectedInviteIds);

    return resolvedInviteCandidates.flatMap((candidate) =>
      selectedInviteIdSet.has(`${candidate.userId}`) ? [candidate.userId] : [],
    );
  }, [
    authSession.isAuthenticated,
    resolvedInviteCandidates,
    selectedInviteIds,
  ]);
  const resolvedInviteCandidatesErrorMessage = authSession.isAuthenticated
    ? inviteCandidatesErrorMessage
    : "Bạn cần đăng nhập để xem danh sách bạn bè.";
  const selectedInviteCount = selectedUserIds.length;

  const visibleInviteCandidates = useMemo(
    () =>
      resolvedInviteCandidates.filter((candidate) =>
        matchesInviteCandidate(candidate, searchQuery),
      ),
    [resolvedInviteCandidates, searchQuery],
  );

  const closeScreen = () => {
    router.back();
  };

  const openLogin = () => {
    router.push("/login?entry=home" as Href);
  };

  const toggleInviteCandidate = (candidateId: string) => {
    setSelectedInviteIds((currentValue) =>
      currentValue.includes(candidateId)
        ? currentValue.filter((id) => id !== candidateId)
        : [...currentValue, candidateId],
    );
  };

  useEffect(() => {
    let isCancelled = false;

    if (!authSession.isAuthenticated) {
      setInviteCandidates([]);
      setInviteCandidatesErrorMessage(null);
      return undefined;
    }

    const trimmedSearchQuery = searchQuery.trim();
    const shouldSearchByDisplayName = trimmedSearchQuery.length > 0;

    const loadInviteCandidates = async () => {
      setIsInviteCandidatesLoading(true);
      setInviteCandidatesErrorMessage(null);

      try {
        const accessToken = await getValidAccessToken();

        if (!accessToken) {
          throw new Error(
            "Phiên đăng nhập đã hết hạn. Vui lòng đăng nhập lại.",
          );
        }

        const response = await getMutualFollowUsers({
          accessToken,
          displayName: shouldSearchByDisplayName
            ? trimmedSearchQuery
            : undefined,
          tokenType: authSession.tokenType,
        });

        if (isCancelled) {
          return;
        }

        setInviteCandidates(response);
        setSelectedInviteIds((currentValue) =>
          currentValue.filter((value) =>
            response.some((candidate) => `${candidate.userId}` === value),
          ),
        );
      } catch (error) {
        if (isCancelled) {
          return;
        }

        setInviteCandidates([]);
        setInviteCandidatesErrorMessage(
          error instanceof Error
            ? error.message
            : "Không thể tải danh sách bạn bè lúc này.",
        );
      } finally {
        if (!isCancelled) {
          setIsInviteCandidatesLoading(false);
        }
      }
    };

    void loadInviteCandidates();

    return () => {
      isCancelled = true;
    };
  }, [
    authSession.isAuthenticated,
    authSession.tokenType,
    inviteRefreshNonce,
    searchQuery,
  ]);

  const handleSubmit = async () => {
    if (isSubmitDisabled) {
      return;
    }

    if (!authSession.isAuthenticated) {
      setErrorMessage("Ban can dang nhap de tao nhom moi.");
      return;
    }

    setErrorMessage(null);
    setIsSubmitting(true);

    try {
      const accessToken = await getValidAccessToken();

      if (!accessToken) {
        throw new Error("Phien dang nhap da het han. Vui long dang nhap lai.");
      }

      const createdGroup = await createCommunityGroup({
        accessToken,
        groupName: trimmedGroupName,
        tokenType: authSession.tokenType,
        userIds: selectedUserIds,
      });

      const cachedSession = buildCreatedGroupSession(
        trimmedGroupName,
        createdGroup,
      );

      if (!cachedSession) {
        throw new Error("Khong the luu du lieu nhom vua tao.");
      }

      router.replace(
        `/community/group-created/${encodeURIComponent(cachedSession.shareToken)}` as Href,
      );
    } catch (error) {
      setErrorMessage(
        error instanceof Error
          ? error.message
          : "Khong the tao nhom luc nay. Vui long thu lai.",
      );
    } finally {
      setIsSubmitting(false);
    }
  };

  const screenContent = (
    <>
      <View style={styles.topBar}>
        <Pressable
          className="items-center justify-center rounded-full"
          hitSlop={8}
          onPress={closeScreen}
          style={({ pressed }) => ({
            height: isCompactScreen ? 40 : 42,
            opacity: pressed ? 0.72 : 1,
            width: isCompactScreen ? 40 : 42,
          })}
        >
          <SymbolView
            name={{
              ios: "xmark",
              android: "close",
              web: "close",
            }}
            size={isCompactScreen ? 18 : 19}
            tintColor={screenPalette.text}
          />
        </Pressable>

        <Text
          style={{
            color: screenPalette.text,
            fontSize: isCompactScreen ? 16 : 17,
            fontWeight: "600",
            includeFontPadding: false,
            lineHeight: isCompactScreen ? 19 : 20,
          }}
        >
          Tạo nhóm tham gia
        </Text>

        <View
          style={{
            height: isCompactScreen ? 40 : 42,
            width: isCompactScreen ? 40 : 42,
          }}
        />
      </View>

      <View className="flex-1">
        <View
          className="flex-1"
          style={{
            paddingHorizontal: contentHorizontalPadding,
            paddingTop: isCompactScreen ? 10 : 12,
          }}
        >
          <View className="flex-row items-start">
            <GroupAvatarPlaceholder compact={isCompactScreen} />

            <View
              className="flex-1"
              style={{ marginLeft: isCompactScreen ? 12 : 14 }}
            >
              <Text
                style={{
                  color: screenPalette.text,
                  fontSize: isCompactScreen ? 12 : 12.5,
                  fontWeight: "400",
                  includeFontPadding: false,
                  lineHeight: isCompactScreen ? 14 : 15,
                }}
              >
                Tên nhóm
              </Text>

              <TextInput
                autoCapitalize="sentences"
                autoCorrect={false}
                editable={!isSubmitting}
                onChangeText={setGroupName}
                placeholder="Đặt tên nhóm"
                placeholderTextColor="#99A2AE"
                selectionColor={screenPalette.accent}
                style={[
                  styles.groupNameInput,
                  {
                    borderRadius: isCompactScreen ? 12 : 13,
                    fontSize: isCompactScreen ? 13.5 : 14,
                    height: isCompactScreen ? 40 : 42,
                    lineHeight: isCompactScreen ? 16 : 17,
                    marginTop: isCompactScreen ? 4 : 5,
                    paddingHorizontal: isCompactScreen ? 14 : 15,
                  },
                ]}
                value={groupName}
              />
            </View>
          </View>

          <View className="mt-4 flex-row items-center justify-between">
            <Text
              style={{
                color: screenPalette.text,
                fontSize: isCompactScreen ? 14 : 15,
                fontWeight: "400",
                includeFontPadding: false,
                lineHeight: isCompactScreen ? 18 : 19,
              }}
            >
              Mời bạn bè
            </Text>

            <Text
              style={{
                color: screenPalette.accent,
                fontSize: isCompactScreen ? 12 : 13,
                fontWeight: "400",
                includeFontPadding: false,
                lineHeight: isCompactScreen ? 16 : 17,
              }}
            >
              {`Đã chọn: ${selectedInviteCount}`}
            </Text>
          </View>

          <View
            className="mt-2.5 flex-row items-center"
            style={[
              styles.searchField,
              {
                borderRadius: isCompactScreen ? 13 : 14,
                gap: isCompactScreen ? 8 : 9,
                height: isCompactScreen ? 42 : 44,
                paddingHorizontal: isCompactScreen ? 12 : 13,
              },
            ]}
          >
            <SymbolView
              name={{
                ios: "magnifyingglass",
                android: "search",
                web: "search",
              }}
              size={isCompactScreen ? 16 : 17}
              tintColor={screenPalette.icon}
            />

            <TextInput
              autoCorrect={false}
              editable={!isSubmitting}
              onChangeText={setSearchQuery}
              placeholder="Tìm tên hoặc tài khoản"
              placeholderTextColor="#9CA5B0"
              returnKeyType="search"
              selectionColor={screenPalette.accent}
              style={[
                styles.searchInput,
                {
                  fontSize: isCompactScreen ? 13 : 14,
                  lineHeight: isCompactScreen ? 16 : 17,
                },
              ]}
              value={searchQuery}
            />
          </View>

          <ScrollView
            className="flex-1"
            contentContainerStyle={{
              paddingBottom: 16,
              paddingTop: 8,
            }}
            keyboardShouldPersistTaps="handled"
            showsVerticalScrollIndicator={false}
          >
            {isInviteCandidatesLoading ? (
              <View className="items-center px-4 py-8">
                <ActivityIndicator color={screenPalette.accent} size="small" />
                <Text
                  className="mt-2.5 text-center"
                  style={{
                    color: screenPalette.muted,
                    fontSize: isCompactScreen ? 12 : 13,
                    fontWeight: "400",
                    includeFontPadding: false,
                    lineHeight: isCompactScreen ? 16 : 17,
                  }}
                >
                  Đang tải danh sách bạn bè...
                </Text>
              </View>
            ) : resolvedInviteCandidatesErrorMessage ? (
              <View
                className="items-center border border-[#F7D8E1] bg-[#FFF8FB] px-4 py-6"
                style={{ borderRadius: isCompactScreen ? 18 : 20 }}
              >
                <SymbolView
                  name={{
                    ios: "person.2.fill",
                    android: "groups",
                    web: "groups",
                  }}
                  size={isCompactScreen ? 20 : 22}
                  tintColor="#E56B93"
                />
                <Text
                  className="mt-2.5 text-center"
                  style={{
                    color: screenPalette.text,
                    fontSize: isCompactScreen ? 13 : 14,
                    fontWeight: "400",
                    includeFontPadding: false,
                    lineHeight: isCompactScreen ? 17 : 18,
                  }}
                >
                  {resolvedInviteCandidatesErrorMessage}
                </Text>
                <Pressable
                  className="mt-4 rounded-full bg-white px-4 py-2"
                  onPress={() => {
                    if (!authSession.isAuthenticated) {
                      openLogin();
                      return;
                    }

                    setInviteRefreshNonce((currentValue) => currentValue + 1);
                  }}
                  style={({ pressed }) => ({
                    opacity: pressed ? 0.84 : 1,
                  })}
                >
                  <Text
                    style={{
                      color: screenPalette.accent,
                      fontSize: 13,
                      fontWeight: "400",
                      includeFontPadding: false,
                      lineHeight: 15,
                    }}
                  >
                    {authSession.isAuthenticated ? "Thử lại" : "Đăng nhập"}
                  </Text>
                </Pressable>
              </View>
            ) : visibleInviteCandidates.length > 0 ? (
              visibleInviteCandidates.map((candidate) => {
                const candidateId = `${candidate.userId}`;
                const isSelected = selectedInviteIds.includes(candidateId);

                return (
                  <InviteCandidateRow
                    candidate={candidate}
                    compact={isCompactScreen}
                    key={candidateId}
                    onPress={() => {
                      toggleInviteCandidate(candidateId);
                    }}
                    selected={isSelected}
                  />
                );
              })
            ) : (
              <View
                className="items-center border border-[#F1F3F6] bg-[#FAFBFD] px-4 py-6"
                style={{ borderRadius: isCompactScreen ? 18 : 20 }}
              >
                <SymbolView
                  name={{
                    ios: "magnifyingglass",
                    android: "search",
                    web: "search",
                  }}
                  size={isCompactScreen ? 20 : 22}
                  tintColor="#C1C8D1"
                />
                <Text
                  className="mt-2.5 text-center"
                  style={{
                    color: screenPalette.text,
                    fontSize: isCompactScreen ? 13 : 14,
                    fontWeight: "400",
                    includeFontPadding: false,
                    lineHeight: isCompactScreen ? 17 : 18,
                  }}
                >
                  Không tìm thấy bạn bè phù hợp
                </Text>
                <Text
                  className="mt-1 text-center"
                  style={{
                    color: screenPalette.muted,
                    fontSize: isCompactScreen ? 11.5 : 12.5,
                    fontWeight: "400",
                    includeFontPadding: false,
                    lineHeight: isCompactScreen ? 15 : 16,
                  }}
                >
                  Hãy thử tìm bằng tên khác hoặc tài khoản khác.
                </Text>
              </View>
            )}
          </ScrollView>
        </View>

        <View
          style={{
            backgroundColor: screenPalette.surface,
            paddingBottom: Math.max(
              insets.bottom + 6,
              isCompactScreen ? 14 : 16,
            ),
            paddingHorizontal: contentHorizontalPadding,
            paddingTop: isCompactScreen ? 8 : 9,
          }}
        >
          {errorMessage ? (
            <View style={styles.errorCard}>
              <Text
                style={{
                  color: "#B4234D",
                  fontSize: isCompactScreen ? 12.5 : 13.5,
                  fontWeight: "400",
                  includeFontPadding: false,
                  lineHeight: isCompactScreen ? 17 : 18,
                }}
              >
                {errorMessage}
              </Text>
              {!authSession.isAuthenticated ? (
                <Pressable
                  className="mt-2 self-start rounded-full bg-white px-4 py-2"
                  onPress={openLogin}
                  style={({ pressed }) => ({
                    opacity: pressed ? 0.84 : 1,
                  })}
                >
                  <Text
                    style={{
                      color: "#B4234D",
                      fontSize: 13,
                      fontWeight: "400",
                      includeFontPadding: false,
                      lineHeight: 15,
                    }}
                  >
                    Đăng nhập
                  </Text>
                </Pressable>
              ) : null}
            </View>
          ) : null}

          <Pressable
            disabled={isSubmitDisabled}
            onPress={() => {
              void handleSubmit();
            }}
            style={({ pressed }) => ({
              opacity: pressed && !isSubmitDisabled ? 0.92 : 1,
            })}
          >
            {isSubmitInactive ? (
              <View
                style={[
                  styles.submitButton,
                  styles.submitButtonDisabled,
                  {
                    borderRadius: isCompactScreen ? 12 : 13,
                    height: isCompactScreen ? 40 : 42,
                  },
                ]}
              >
                <Text
                  style={{
                    color: "#7C8693",
                    fontSize: isCompactScreen ? 15 : 16,
                    fontWeight: "400",
                    includeFontPadding: false,
                    lineHeight: isCompactScreen ? 17 : 18,
                  }}
                >
                  Tạo nhóm
                </Text>
              </View>
            ) : (
              <LinearGradient
                colors={["#FF698F", "#FF4F83", "#FF4B91"]}
                end={{ x: 1, y: 0.5 }}
                start={{ x: 0, y: 0.5 }}
                style={[
                  styles.submitButton,
                  {
                    borderRadius: isCompactScreen ? 12 : 13,
                    height: isCompactScreen ? 40 : 42,
                  },
                ]}
              >
                {isSubmitting ? (
                  <ActivityIndicator color="#FFFFFF" size="small" />
                ) : (
                  <Text
                    style={{
                      color: "#FFFFFF",
                      fontSize: isCompactScreen ? 15 : 16,
                      fontWeight: "400",
                      includeFontPadding: false,
                      lineHeight: isCompactScreen ? 17 : 18,
                    }}
                  >
                    Tạo nhóm
                  </Text>
                )}
              </LinearGradient>
            )}
          </Pressable>
        </View>
      </View>
    </>
  );

  return (
    <SafeAreaView className="flex-1 bg-white" edges={["top", "left", "right"]}>
      <StatusBar style="dark" />

      {Platform.OS === "ios" ? (
        <KeyboardAvoidingView
          behavior="padding"
          className="flex-1"
          keyboardVerticalOffset={0}
        >
          {screenContent}
        </KeyboardAvoidingView>
      ) : (
        <View className="flex-1">{screenContent}</View>
      )}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  errorCard: {
    backgroundColor: "#FFF6F8",
    borderColor: "#F3CDD6",
    borderRadius: 14,
    borderWidth: 1,
    marginBottom: 10,
    paddingHorizontal: 12,
    paddingVertical: 10,
  },
  groupAvatarInner: {
    alignItems: "center",
    flex: 1,
    justifyContent: "center",
    position: "relative",
  },
  groupAvatarOuter: {
    alignSelf: "flex-start",
    backgroundColor: screenPalette.surface,
    borderColor: screenPalette.accentSoft,
    borderWidth: 1.2,
    marginTop: 16,
    overflow: "hidden",
    padding: 1,
  },
  groupAvatarSparkle: {
    position: "absolute",
  },
  groupNameInput: {
    backgroundColor: screenPalette.surface,
    borderColor: screenPalette.borderStrong,
    borderWidth: 1,
    color: screenPalette.text,
    includeFontPadding: false,
    paddingVertical: 0,
  },
  inviteAvatar: {
    shadowColor: "#D8DDE6",
    shadowOffset: { width: 0, height: 5 },
    shadowOpacity: 0.12,
    shadowRadius: 10,
  },
  inviteRow: {
    borderBottomColor: "#EEF2F5",
    borderBottomWidth: 1,
  },
  searchField: {
    backgroundColor: screenPalette.surface,
    borderColor: screenPalette.borderStrong,
    borderWidth: 1,
  },
  searchInput: {
    color: screenPalette.text,
    flex: 1,
    height: "100%",
    includeFontPadding: false,
    paddingVertical: 0,
  },
  selectionCircle: {
    alignItems: "center",
    borderColor: "#C2C9D3",
    borderWidth: 1.6,
    justifyContent: "center",
  },
  selectionCircleActive: {
    borderColor: screenPalette.accent,
  },
  selectionCircleInner: {
    backgroundColor: screenPalette.accent,
  },
  submitButton: {
    alignItems: "center",
    justifyContent: "center",
    shadowColor: "#FF4F83",
    shadowOffset: { width: 0, height: 10 },
    shadowOpacity: 0.2,
    shadowRadius: 18,
  },
  submitButtonDisabled: {
    backgroundColor: "#E5E7EB",
    shadowOpacity: 0,
  },
  topBar: {
    alignItems: "center",
    backgroundColor: screenPalette.surface,
    borderBottomColor: "#EEF2F5",
    borderBottomWidth: 1,
    flexDirection: "row",
    justifyContent: "space-between",
    paddingHorizontal: 8,
    paddingVertical: 3,
  },
});
