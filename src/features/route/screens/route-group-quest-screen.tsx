import { Image } from "expo-image";
import { type Href, useFocusEffect, useLocalSearchParams, useRouter } from "expo-router";
import { useCallback, useMemo, useState } from "react";
import {
  ActivityIndicator,
  Modal,
  Pressable,
  ScrollView,
  Text,
  View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

import { SymbolView } from "@/components/ui/symbol-view";
import {
  getValidAccessToken,
  useAuthSession,
} from "@/features/auth/hooks/use-auth-session";
import {
  getCommunityGroups,
  type CommunityGroupPayload,
} from "@/features/community/api/group-api";
import { getMyProfile } from "@/features/profile/api/get-me";
import {
  getRouteById,
  getRouteCoverUrl,
  joinRouteGroupQuest,
  type RouteDto,
} from "@/features/route/api/route-api";
import { routeSystemAlert } from "@/features/route/components/route-system-alert";

const fallbackRouteImage =
  "https://i.pinimg.com/736x/f3/0f/e8/f30fe84218790e6ffd25f987d434eb13.jpg";

const cardShadow = {
  shadowColor: "rgba(28, 45, 80, 0.10)",
  shadowOpacity: 1,
  shadowRadius: 16,
  shadowOffset: { width: 0, height: 8 },
  elevation: 5,
} as const;

type GroupQuestSuccessState = {
  groupName: string;
  routeName: string;
  shareToken: string;
};

function readMeaningfulText(value: unknown) {
  if (typeof value !== "string") {
    return null;
  }

  const trimmedValue = value.trim();
  return trimmedValue ? trimmedValue : null;
}

function resolveRouteParam(value?: string | string[]) {
  const rawValue = Array.isArray(value) ? value[0] : value;
  const normalizedValue = rawValue?.trim() ?? "";

  if (!normalizedValue) {
    return "";
  }

  try {
    return decodeURIComponent(normalizedValue);
  } catch {
    return normalizedValue;
  }
}

function getCommunityGroupDisplayName(group: CommunityGroupPayload) {
  return (
    readMeaningfulText(group.groupName) ??
    (readMeaningfulText(group.groupId)
      ? `Group #${group.groupId}`
      : "Nhóm chưa đặt tên")
  );
}

function getCommunityGroupAccessLabel(requiredApproval: boolean | null) {
  return requiredApproval === true ? "Cần duyệt" : "Công khai";
}

function getCommunityGroupMemberLabel(group: CommunityGroupPayload) {
  return typeof group.totalMembers === "number" && Number.isFinite(group.totalMembers)
    ? `${Math.max(0, Math.round(group.totalMembers))} thành viên`
    : "Chưa có số liệu thành viên";
}

function getCommunityGroupUpdatedTimestamp(group: CommunityGroupPayload) {
  const dateValue =
    readMeaningfulText(group.updatedAt) ?? readMeaningfulText(group.createdAt);

  if (!dateValue) {
    return 0;
  }

  const parsedTimestamp = Date.parse(dateValue);
  return Number.isFinite(parsedTimestamp) ? parsedTimestamp : 0;
}

function isLeaderCommunityGroup(
  group: CommunityGroupPayload,
  currentProfileId: string,
) {
  return readMeaningfulText(group.leaderId) === currentProfileId;
}

function getRoutePrimaryMeta(route: RouteDto | null) {
  if (!route) {
    return "Đang tải thông tin lộ trình";
  }

  const pieces = [
    route.estimateTime > 0 ? `${route.estimateTime} phút` : null,
    route.hotspots.length > 0 ? `${route.hotspots.length} điểm dừng` : null,
  ].filter(Boolean);

  return pieces.join(" • ") || "Chưa có thông tin thời lượng";
}

function getRouteSecondaryMeta(route: RouteDto | null) {
  if (!route) {
    return "Thông tin tuyến sẽ hiển thị tại đây";
  }

  const startHotspot = readMeaningfulText(route.hotspots[0]?.hotspotName);
  const endHotspot = readMeaningfulText(
    route.hotspots[route.hotspots.length - 1]?.hotspotName,
  );

  if (startHotspot && endHotspot && startHotspot !== endHotspot) {
    return `${startHotspot} → ${endHotspot}`;
  }

  if (startHotspot) {
    return startHotspot;
  }

  return readMeaningfulText(route.description) ?? "Chưa có thông tin điểm đến";
}

function getRouteDisplayName(route: RouteDto | null, fallbackRouteName: string) {
  return (
    readMeaningfulText(route?.routeName) ??
    readMeaningfulText(fallbackRouteName) ??
    "tuyến này"
  );
}

function getGroupAvatarIcon(group: CommunityGroupPayload) {
  return {
    iconName: {
      android: group.requiredApproval ? "lock" : "groups",
      ios: group.requiredApproval ? "lock" : "person.2",
      web: group.requiredApproval ? "lock" : "groups",
    },
    iconTint: "#D95B8D",
  };
}

function GroupQuestSuccessModal({
  groupName,
  onClose,
  onViewGroup,
  routeName,
  visible,
}: GroupQuestSuccessState & {
  onClose: () => void;
  onViewGroup: () => void;
  visible: boolean;
}) {
  return (
    <Modal
      transparent
      visible={visible}
      animationType="fade"
      statusBarTranslucent
      onRequestClose={onClose}
    >
      <View className="flex-1 items-center justify-center bg-black/45 px-6">
        <Pressable className="absolute inset-0" onPress={onClose} />

        <View
          className="w-full max-w-[360px] rounded-[28px] bg-white px-5 pb-5 pt-6"
          style={{
            shadowColor: "#1F1630",
            shadowOpacity: 0.2,
            shadowRadius: 24,
            shadowOffset: { width: 0, height: 12 },
            elevation: 14,
          }}
        >
          <Pressable
            className="absolute right-3 top-3 h-8 w-8 items-center justify-center rounded-full bg-[#F7F2F5]"
            onPress={onClose}
          >
            <SymbolView
              name={{
                android: "close",
                ios: "xmark",
                web: "close",
              }}
              size={16}
              tintColor="#746D7C"
            />
          </Pressable>

          <View className="items-center">
            <View className="relative items-center justify-center">
              <View className="absolute left-2 top-3 h-2 w-2 rounded-full bg-[#FFD7A8]" />
              <View className="absolute -left-7 top-8 h-1.5 w-1.5 rounded-full bg-[#F7BDD7]" />
              <View className="absolute -right-8 top-5 h-2 w-2 rounded-full bg-[#FFE08A]" />
              <View className="absolute right-0 top-12 h-1.5 w-1.5 rounded-full bg-[#F7BDD7]" />

              <View className="h-20 w-20 items-center justify-center rounded-full bg-[#FFF1F7]">
                <View className="h-14 w-14 items-center justify-center rounded-full border-[3px] border-[#F7BDD7] bg-white">
                  <SymbolView
                    name={{
                      android: "check",
                      ios: "checkmark",
                      web: "check",
                    }}
                    size={28}
                    tintColor="#D95B8D"
                  />
                </View>
              </View>
            </View>

            <Text className="mt-4 text-center text-[22px] font-semibold text-[#D95B8D]">
              Tham gia nhóm thành công
            </Text>

            <Text className="mt-2 text-center text-[13px] leading-[18px] text-[#746D7C]">
              Bạn đã tham gia vào nhóm{" "}
              <Text className="font-semibold text-[#D95B8D]">{groupName}</Text>
              {"\n"}trong lộ trình{" "}
              <Text className="font-semibold text-[#D95B8D]">{routeName}</Text>.
            </Text>
          </View>

          <View className="mt-5 gap-2.5">
            <View className="flex-row items-center rounded-[18px] border border-[#F0DEE7] bg-[#FFF8FB] px-4 py-3">
              <View className="h-10 w-10 items-center justify-center rounded-full bg-[#F8EEF4]">
                <SymbolView
                  name={{
                    android: "route",
                    ios: "point.topleft.down.curvedto.point.bottomright.up",
                    web: "route",
                  }}
                  size={16}
                  tintColor="#D95B8D"
                />
              </View>
              <View className="ml-3 min-w-0 flex-1">
                <Text className="text-[11px] text-[#8E869A]">Lộ trình</Text>
                <Text className="mt-0.5 text-[13px] font-semibold text-[#2B2233]">
                  {routeName}
                </Text>
              </View>
              <SymbolView
                name={{
                  android: "chevron_right",
                  ios: "chevron.right",
                  web: "chevron_right",
                }}
                size={16}
                tintColor="#8E869A"
              />
            </View>

            <View className="flex-row items-center rounded-[18px] border border-[#F0DEE7] bg-[#FFF8FB] px-4 py-3">
              <View className="h-10 w-10 items-center justify-center rounded-full bg-[#F8EEF4]">
                <SymbolView
                  name={{
                    android: "groups",
                    ios: "person.2",
                    web: "groups",
                  }}
                  size={16}
                  tintColor="#D95B8D"
                />
              </View>
              <View className="ml-3 min-w-0 flex-1">
                <Text className="text-[11px] text-[#8E869A]">Nhóm</Text>
                <Text className="mt-0.5 text-[13px] font-semibold text-[#2B2233]">
                  {groupName}
                </Text>
              </View>
              <SymbolView
                name={{
                  android: "chevron_right",
                  ios: "chevron.right",
                  web: "chevron_right",
                }}
                size={16}
                tintColor="#8E869A"
              />
            </View>
          </View>

          <Pressable
            className="mt-5 rounded-[16px] bg-[#D95B8D] py-3.5"
            onPress={onViewGroup}
          >
            <Text className="text-center text-[15px] font-semibold text-white">
              Xem nhóm
            </Text>
          </Pressable>

          <Pressable
            className="mt-3 rounded-[16px] border border-[#F0DEE7] bg-white py-3.5"
            onPress={onClose}
          >
            <Text className="text-center text-[15px] font-semibold text-[#D95B8D]">
              Đóng
            </Text>
          </Pressable>
        </View>
      </View>
    </Modal>
  );
}

export default function RouteGroupQuestScreen() {
  const authSession = useAuthSession();
  const router = useRouter();
  const params = useLocalSearchParams<{
    id?: string | string[];
    routeName?: string | string[];
  }>();
  const resolvedRouteId = resolveRouteParam(params.id);
  const resolvedRouteName = resolveRouteParam(params.routeName) || "tuyến này";

  const [groups, setGroups] = useState<CommunityGroupPayload[]>([]);
  const [routeDetail, setRouteDetail] = useState<RouteDto | null>(null);
  const [selectedGroupId, setSelectedGroupId] = useState<string | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isGroupListExpanded, setIsGroupListExpanded] = useState(true);
  const [successState, setSuccessState] = useState<GroupQuestSuccessState | null>(
    null,
  );

  useFocusEffect(
    useCallback(() => {
      let isActive = true;

      async function loadScreenData() {
        if (!resolvedRouteId) {
          if (!isActive) {
            return;
          }

          setGroups([]);
          setRouteDetail(null);
          setSelectedGroupId(null);
          setErrorMessage("Thiếu mã tuyến.");
          setIsLoading(false);
          return;
        }

        if (!authSession.isAuthenticated) {
          if (!isActive) {
            return;
          }

          setGroups([]);
          setRouteDetail(null);
          setSelectedGroupId(null);
          setErrorMessage("Bạn cần đăng nhập để chọn group cho tuyến này.");
          setIsLoading(false);
          return;
        }

        setIsLoading(true);
        setErrorMessage(null);

        try {
          const accessToken = await getValidAccessToken();

          if (!accessToken) {
            throw new Error("Không lấy được access token hợp lệ.");
          }

          const [currentProfileResult, communityGroupsResult, routeDetailResult] =
            await Promise.allSettled([
              getMyProfile({
                accessToken,
                tokenType: authSession.tokenType,
              }),
              getCommunityGroups({
                accessToken,
                tokenType: authSession.tokenType,
              }),
              getRouteById({
                accessToken,
                routeId: resolvedRouteId,
                tokenType: authSession.tokenType,
              }),
            ]);

          if (!isActive) {
            return;
          }

          if (currentProfileResult.status === "rejected") {
            throw currentProfileResult.reason;
          }

          if (communityGroupsResult.status === "rejected") {
            throw communityGroupsResult.reason;
          }

          const nextGroups = [...communityGroupsResult.value]
            .filter((group) =>
              isLeaderCommunityGroup(group, currentProfileResult.value.id),
            )
            .sort(
              (left, right) =>
                getCommunityGroupUpdatedTimestamp(right) -
                getCommunityGroupUpdatedTimestamp(left),
            );

          setGroups(nextGroups);
          setRouteDetail(
            routeDetailResult.status === "fulfilled" ? routeDetailResult.value : null,
          );
          setSelectedGroupId((current) => {
            if (
              current &&
              nextGroups.some(
                (group) => readMeaningfulText(group.groupId) === current,
              )
            ) {
              return current;
            }

            return readMeaningfulText(nextGroups[0]?.groupId) ?? null;
          });
          setIsGroupListExpanded(nextGroups.length > 0);
        } catch (error) {
          console.warn("[route-group-quest] load screen data failed", {
            error: error instanceof Error ? error.message : error,
            routeId: resolvedRouteId,
          });

          if (!isActive) {
            return;
          }

          setGroups([]);
          setRouteDetail(null);
          setSelectedGroupId(null);
          setErrorMessage(
            error instanceof Error
              ? error.message
              : "Không tải được dữ liệu màn tham gia nhóm.",
          );
        } finally {
          if (isActive) {
            setIsLoading(false);
          }
        }
      }

      void loadScreenData();

      return () => {
        isActive = false;
      };
    }, [
      authSession.isAuthenticated,
      authSession.tokenType,
      resolvedRouteId,
      setErrorMessage,
      setGroups,
      setIsGroupListExpanded,
      setIsLoading,
      setRouteDetail,
      setSelectedGroupId,
    ]),
  );

  const selectedGroup = useMemo(() => {
    return (
      groups.find((group) => readMeaningfulText(group.groupId) === selectedGroupId) ??
      null
    );
  }, [groups, selectedGroupId]);

  const routeDisplayName = getRouteDisplayName(routeDetail, resolvedRouteName);
  const routeImageSource = getRouteCoverUrl(routeDetail ?? { hotspots: [], medias: [] });
  const routePrimaryMeta = getRoutePrimaryMeta(routeDetail);
  const routeSecondaryMeta = getRouteSecondaryMeta(routeDetail);
  const selectedGroupSummary = selectedGroup
    ? `${getCommunityGroupMemberLabel(selectedGroup)} • ${getCommunityGroupAccessLabel(selectedGroup.requiredApproval)}`
    : "Chọn group mà bạn đang làm leader";

  async function handleStartGroupJourney() {
    const normalizedGroupId = readMeaningfulText(selectedGroupId);

    if (!normalizedGroupId || isSubmitting) {
      return;
    }

    try {
      setIsSubmitting(true);
      const accessToken = await getValidAccessToken();

      if (!accessToken) {
        throw new Error("Bạn cần đăng nhập để tham gia nhóm hành trình.");
      }

      await joinRouteGroupQuest({
        accessToken,
        groupId: normalizedGroupId,
        routeId: resolvedRouteId,
        tokenType: authSession.tokenType,
      });

      setSuccessState({
        groupName: selectedGroup
          ? getCommunityGroupDisplayName(selectedGroup)
          : `Group #${normalizedGroupId}`,
        routeName: routeDisplayName,
        shareToken: selectedGroup?.shareToken ?? "",
      });
    } catch (error) {
      routeSystemAlert.alert(
        "Không thể tham gia nhóm",
        error instanceof Error ? error.message : "Vui lòng thử lại sau.",
      );
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <View className="flex-1 bg-[#FCF6F8]">
      <SafeAreaView edges={["top"]} className="bg-[#FCF6F8]">
        <View className="flex-row items-center px-5 pb-3 pt-2">
          <Pressable
            className="h-10 w-10 items-center justify-center rounded-full"
            onPress={() => router.back()}
          >
            <SymbolView
              name={{
                android: "arrow_back_ios_new",
                ios: "chevron.left",
                web: "arrow_back",
              }}
              size={18}
              tintColor="#D95B8D"
            />
          </Pressable>

          <View className="flex-1 items-center">
            <Text className="pr-10 text-[15px] font-semibold text-[#2B2233]">
              Tham gia nhóm hành trình
            </Text>
          </View>
        </View>
      </SafeAreaView>

      <ScrollView
        className="flex-1"
        contentContainerStyle={{ paddingBottom: 24, paddingHorizontal: 16 }}
        showsVerticalScrollIndicator={false}
      >
        <Text className="mb-3 mt-2 text-[15px] font-semibold text-[#2B2233]">
          1. Lộ trình
        </Text>
        <View
          className="rounded-[22px] border border-[#F0DEE7] bg-white p-3.5"
          style={cardShadow}
        >
          <View className="flex-row items-center gap-3">
            <Image
              source={routeImageSource || fallbackRouteImage}
              contentFit="cover"
              style={{ width: 104, height: 88, borderRadius: 16 }}
            />

            <View className="min-w-0 flex-1">
              <Text
                className="text-[15px] leading-[17px] text-[#2B2233]"
                numberOfLines={2}
              >
                {routeDisplayName}
              </Text>

              <View className="mt-1.5 flex-row items-center gap-2">
                <SymbolView
                  name={{
                    android: "calendar_today",
                    ios: "calendar",
                    web: "calendar",
                  }}
                  size={13}
                  tintColor="#8E869A"
                />
                <Text className="flex-1 text-[11px] leading-[12px] text-[#8E869A]">
                  {routePrimaryMeta}
                </Text>
              </View>

              <View className="mt-0.5 flex-row items-center gap-2">
                <SymbolView
                  name={{
                    android: "location_on",
                    ios: "mappin.and.ellipse",
                    web: "location_on",
                  }}
                  size={13}
                  tintColor="#8E869A"
                />
                <Text className="flex-1 text-[11px] leading-[12px] text-[#8E869A]">
                  {routeSecondaryMeta}
                </Text>
              </View>
            </View>
          </View>
        </View>

        <Text className="mb-3 mt-5 text-[15px] font-semibold text-[#2B2233]">
          2. Nhóm
        </Text>
        <Pressable
          className="flex-row items-center gap-3 rounded-[18px] border border-[#F0DEE7] bg-white px-4 py-4"
          style={cardShadow}
          onPress={() => setIsGroupListExpanded((current) => !current)}
        >
          <View className="min-w-0 flex-1">
            <Text
              className={`text-[14px] ${
                selectedGroup ? "text-[#2B2233]" : "text-[#8E869A]"
              }`}
              numberOfLines={1}
            >
              {selectedGroup
                ? getCommunityGroupDisplayName(selectedGroup)
                : "Chọn nhóm hành trình"}
            </Text>
            <Text
              className="mt-1 text-[11px] leading-[12px] text-[#8E869A]"
              numberOfLines={1}
            >
              {selectedGroupSummary}
            </Text>
          </View>

          <SymbolView
            name={{
              android: isGroupListExpanded ? "keyboard_arrow_up" : "keyboard_arrow_down",
              ios: isGroupListExpanded ? "chevron.up" : "chevron.down",
              web: isGroupListExpanded ? "expand_less" : "expand_more",
            }}
            size={20}
            tintColor="#8E869A"
          />
        </Pressable>

        {isLoading ? (
          <View
            className="mt-4 items-center rounded-[20px] bg-white px-4 py-8"
            style={cardShadow}
          >
            <ActivityIndicator color="#D95B8D" />
            <Text className="mt-3 text-[12px] text-[#8E869A]">
              Đang tải danh sách nhóm...
            </Text>
          </View>
        ) : errorMessage ? (
          <View
            className="mt-4 rounded-[20px] border border-[#F0DEE7] bg-white px-4 py-4"
            style={cardShadow}
          >
            <Text className="text-[14px] font-semibold text-[#2B2233]">
              Không tải được danh sách nhóm
            </Text>
            <Text className="mt-2 text-[12px] leading-[14px] text-[#8E869A]">
              {errorMessage}
            </Text>
          </View>
        ) : groups.length > 0 && isGroupListExpanded ? (
          <View
            className="mt-4 overflow-hidden rounded-[20px] bg-white px-4"
            style={cardShadow}
          >
            {groups.map((group, index) => {
              const groupId = readMeaningfulText(group.groupId);
              const isSelected = groupId === selectedGroupId;
              const avatarIcon = getGroupAvatarIcon(group);

              if (!groupId) {
                return null;
              }

              return (
                <Pressable
                  key={groupId}
                  className={`flex-row items-center gap-3 py-4 ${
                    index < groups.length - 1 ? "border-b border-[#F0DEE7]" : ""
                  }`}
                  onPress={() => setSelectedGroupId(groupId)}
                >
                  <View
                    className="h-11 w-11 items-center justify-center rounded-full"
                    style={{ backgroundColor: "#F8EEF4" }}
                  >
                    <SymbolView
                      name={avatarIcon.iconName}
                      size={18}
                      tintColor={avatarIcon.iconTint}
                    />
                  </View>

                  <View className="min-w-0 flex-1">
                    <Text
                      className="text-[14px] text-[#2B2233]"
                      numberOfLines={1}
                    >
                      {getCommunityGroupDisplayName(group)}
                    </Text>
                    <Text
                      className="mt-1 text-[12px] leading-[13px] text-[#8E869A]"
                      numberOfLines={1}
                    >
                      {getCommunityGroupMemberLabel(group)} •{" "}
                      {getCommunityGroupAccessLabel(group.requiredApproval)}
                    </Text>
                  </View>
                  {isSelected ? (
                    <View className="items-center justify-center pl-2">
                      <SymbolView
                        name={{
                          android: "check_circle",
                          ios: "checkmark.circle.fill",
                          web: "check_circle",
                        }}
                        size={18}
                        tintColor="#D95B8D"
                      />
                    </View>
                  ) : null}
                </Pressable>
              );
            })}
          </View>
        ) : groups.length === 0 ? (
          <View
            className="mt-4 rounded-[20px] border border-[#F0DEE7] bg-white px-4 py-4"
            style={cardShadow}
          >
            <Text className="text-[14px] font-semibold text-[#2B2233]">
              Bạn chưa có nhóm nào làm leader
            </Text>
            <Text className="mt-2 text-[12px] leading-[14px] text-[#8E869A]">
              Tạo một group cộng đồng trước rồi quay lại màn này để chọn nhóm.
            </Text>

            <Pressable
              className="mt-4 rounded-[14px] border border-[#F0DEE7] bg-[#FFF7FA] px-4 py-3"
              onPress={() => {
                router.push("/community/group-create" as Href);
              }}
            >
              <Text className="text-center text-[12px] font-semibold text-[#D95B8D]">
                Tạo group mới
              </Text>
            </Pressable>
          </View>
        ) : null}

        <View
          className="mt-5 rounded-[22px] border border-[#F0DEE7] bg-white px-4 py-4"
          style={cardShadow}
        >
          <View className="flex-row items-center gap-2">
            <SymbolView
              name={{
                android: "assignment",
                ios: "list.bullet.clipboard",
                web: "assignment",
              }}
              size={16}
              tintColor="#D95B8D"
            />
            <Text className="text-[14px] font-semibold text-[#D95B8D]">
              Tóm tắt lựa chọn
            </Text>
          </View>

          <View className="mt-4 flex-row items-start gap-3">
            <View className="h-9 w-9 items-center justify-center rounded-full bg-[#F8EEF4]">
              <SymbolView
                name={{
                  android: "route",
                  ios: "point.topleft.down.curvedto.point.bottomright.up",
                  web: "route",
                }}
                size={16}
                tintColor="#D95B8D"
              />
            </View>

            <View className="flex-1">
              <Text className="text-[12px] text-[#8E869A]">Lộ trình đã chọn</Text>
            </View>

            <View className="items-end">
              <Text className="text-right text-[13px] text-[#2B2233]">
                {routeDisplayName}
              </Text>
            </View>
          </View>

          <View className="mt-4 flex-row items-start gap-3">
            <View className="h-9 w-9 items-center justify-center rounded-full bg-[#F8EEF4]">
              <SymbolView
                name={{
                  android: "groups",
                  ios: "person.2",
                  web: "groups",
                }}
                size={16}
                tintColor="#D95B8D"
              />
            </View>

            <View className="flex-1">
              <Text className="text-[12px] text-[#8E869A]">Nhóm đã chọn</Text>
            </View>

            <View className="items-end">
              <Text className="text-right text-[13px] text-[#2B2233]">
                {selectedGroup
                  ? getCommunityGroupDisplayName(selectedGroup)
                  : "Chưa chọn nhóm"}
              </Text>
            </View>
          </View>
        </View>
      </ScrollView>

      <SafeAreaView edges={["bottom"]} className="bg-[#FCF6F8] px-4 pb-5 pt-2">
        <Pressable
          disabled={!selectedGroupId || isLoading || isSubmitting}
          className={`rounded-[16px] py-4 ${
            !selectedGroupId || isLoading || isSubmitting
              ? "bg-[#E5DFE8]"
              : "bg-[#D95B8D]"
          }`}
          style={cardShadow}
          onPress={() => {
            void handleStartGroupJourney();
          }}
        >
          <Text
            className={`text-center text-[15px] font-semibold ${
              !selectedGroupId || isLoading || isSubmitting
                ? "text-[#8E869A]"
                : "text-white"
            }`}
          >
            {isSubmitting ? "Đang tham gia..." : "Tham gia nhóm"}
          </Text>
        </Pressable>

        <Pressable
          className="mt-3 rounded-[16px] border border-[#F0DEE7] bg-white py-4"
          onPress={() => router.back()}
        >
          <Text className="text-center text-[15px] font-semibold text-[#D95B8D]">
            Hủy
          </Text>
        </Pressable>
      </SafeAreaView>

      {successState ? (
        <GroupQuestSuccessModal
          groupName={successState.groupName}
          routeName={successState.routeName}
          shareToken={successState.shareToken}
          visible
          onClose={() => {
            setSuccessState(null);
            router.back();
          }}
          onViewGroup={() => {
            const shareToken = readMeaningfulText(successState.shareToken);
            setSuccessState(null);

            if (!shareToken) {
              router.back();
              return;
            }

            router.push(
              `/community/group/${encodeURIComponent(shareToken)}` as Href,
            );
          }}
        />
      ) : null}
    </View>
  );
}
