import { SymbolView } from "@/components/ui/symbol-view";
import type { CommunityGroupPayload } from "@/features/community/api/group-api";
import { Image, Pressable, Text, View } from "react-native";

const communityGroupPinImage = require("../../../../assets/images/pin_group.png");

const cardShadowStyle = {
  shadowColor: "rgba(235, 72, 155, 0.14)",
  shadowOpacity: 1,
  shadowRadius: 24,
  shadowOffset: {
    width: 0,
    height: 12,
  },
  elevation: 10,
} as const;

const subtleBorderColor = "#E5E7EB";
const subtleBorderWidth = 0.8;

function readMeaningfulText(value?: string | null) {
  if (typeof value !== "string") {
    return null;
  }

  const trimmedValue = value.trim();
  return trimmedValue ? trimmedValue : null;
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

function formatGroupMemberCountLabel(memberCount: number) {
  return `${formatCompactCount(memberCount)} thành viên`;
}

function getCommunityGroupAccessLabel(requiredApproval?: boolean | null) {
  return requiredApproval === true ? "Cần leader duyệt" : "Tham gia tự do";
}

function getCommunityGroupAccessPalette(requiredApproval?: boolean | null) {
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

export function CommunityCreateGroupCard({
  onPress,
}: {
  onPress: () => void;
}) {
  return (
    <Pressable
      className="overflow-hidden rounded-[26px] bg-white"
      onPress={onPress}
      style={({ pressed }) => [
        cardShadowStyle,
        {
          minHeight: 220,
          opacity: pressed ? 0.88 : 1,
          width: 160,
        },
      ]}
    >
      <View
        className="flex-1 self-stretch items-center justify-center rounded-[26px] bg-[#FFFDFE] px-4 py-4"
        style={{
          borderColor: "#F7D4E3",
          borderStyle: "dashed",
          borderWidth: 1,
          borderRadius: 26,
        }}
      >
        <View
          className="h-12 w-12 items-center justify-center rounded-full bg-[#FFF1F7]"
          style={{
            borderColor: "#FCE0EB",
            borderWidth: 1,
          }}
        >
          <SymbolView
            name={{
              ios: "plus",
              android: "add",
              web: "add",
            }}
            size={20}
            tintColor="#FF5C8A"
          />
        </View>
        <Text
          className="mt-3 text-center text-[13px] font-semibold text-[#F43F7E]"
          style={{ includeFontPadding: false, lineHeight: 16 }}
        >
          Nhóm mới
        </Text>
        <Text
          className="mt-1 text-center text-[10px] font-medium text-[#9F8E99]"
          style={{ includeFontPadding: false, lineHeight: 13 }}
        >
          Tạo nhóm của bạn
        </Text>
      </View>
    </Pressable>
  );
}

export function CommunityGroupCompactStateCard({
  description,
  title,
  width = 180,
}: {
  description: string;
  title: string;
  width?: number;
}) {
  return (
    <View
      className="rounded-[26px] border bg-white px-4 py-4"
      style={[
        cardShadowStyle,
        {
          borderColor: subtleBorderColor,
          borderWidth: subtleBorderWidth,
          minHeight: 220,
          width,
        },
      ]}
    >
      <View className="h-9 w-9 items-center justify-center rounded-full bg-[#FFF1F7]">
        <SymbolView
          name={{ ios: "person.3.fill", android: "groups", web: "groups" }}
          size={15}
          tintColor="#FF5C8A"
        />
      </View>
      <Text
        className="mt-3 text-[13px] font-semibold text-[#2E2336]"
        style={{ includeFontPadding: false, lineHeight: 16 }}
      >
        {title}
      </Text>
      <Text
        className="mt-2 text-[10px] text-[#8F8298]"
        style={{ includeFontPadding: false, lineHeight: 14 }}
      >
        {description}
      </Text>
    </View>
  );
}

export function CommunityGroupPlaceholderCard({
  width = 180,
}: {
  width?: number;
}) {
  return (
    <View
      className="items-center justify-center rounded-[26px] border bg-white px-4 py-4"
      style={[
        cardShadowStyle,
        {
          borderColor: subtleBorderColor,
          borderWidth: subtleBorderWidth,
          minHeight: 220,
          width,
        },
      ]}
    >
      <Text
        className="text-center text-[11px] font-medium text-[#8F8298]"
        style={{ includeFontPadding: false, lineHeight: 14 }}
      >
        Đang tải nhóm...
      </Text>
    </View>
  );
}

export function CommunityGroupListCard({
  group,
  isLeader = false,
  onPress,
  width = 180,
}: {
  group: CommunityGroupPayload;
  isLeader?: boolean;
  onPress: () => void;
  width?: number;
}) {
  const groupName = readMeaningfulText(group.groupName) ?? "Nhóm chưa đặt tên";
  const memberCount =
    typeof group.totalMembers === "number" && Number.isFinite(group.totalMembers)
      ? Math.max(0, Math.round(group.totalMembers))
      : 0;
  const accessPalette = getCommunityGroupAccessPalette(group.requiredApproval);

  return (
    <View
      className="rounded-[26px] bg-white"
      style={[
        cardShadowStyle,
        {
          borderColor: subtleBorderColor,
          borderWidth: subtleBorderWidth,
          minHeight: 220,
          width,
        },
      ]}
    >
      <Image
        source={communityGroupPinImage}
        resizeMode="contain"
        style={{
          height: 56,
          position: "absolute",
          right: 6,
          top: -12,
          width: 56,
          zIndex: 2,
        }}
      />

      <View className="flex-1 overflow-hidden rounded-[26px] px-3 pb-2.5 pt-2.5">
        <View className="flex-row items-start">
          <View
            className="items-center justify-center rounded-full bg-[#FFF1F7]"
            style={{ height: 36, width: 36 }}
          >
            <SymbolView
              name={{ ios: "person.3.fill", android: "groups", web: "groups" }}
              size={17}
              tintColor="#FF4F84"
            />
          </View>
        </View>

        <View className="mt-2 min-h-[30px]">
          <View
            className="flex-row items-center self-start"
            style={{ columnGap: 4, maxWidth: "100%" }}
          >
            <Text
              className="text-[13px] font-medium text-[#2E2336]"
              numberOfLines={2}
              style={{
                flexShrink: 1,
                includeFontPadding: false,
                lineHeight: 15,
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
                size={16}
                tintColor="#E39B1A"
              />
            ) : null}
          </View>
        </View>

        <View className="mt-2" style={{ rowGap: 6 }}>
          <View className="self-start flex-row items-center rounded-full bg-[#F4F2F7] px-2.5 py-1">
            <SymbolView
              name={{ ios: "person.2.fill", android: "groups", web: "groups" }}
              size={13}
              tintColor="#7D7488"
            />
            <Text
              className="ml-1 text-[11px] font-normal text-[#7D7488]"
              numberOfLines={1}
              style={{ includeFontPadding: false, lineHeight: 11 }}
            >
              {formatGroupMemberCountLabel(memberCount)}
            </Text>
          </View>

          <View
            className="self-start flex-row items-center rounded-full px-2.5 py-1"
            style={{ backgroundColor: accessPalette.backgroundColor }}
          >
            <SymbolView
              name={group.requiredApproval === true ? "lock.fill" : "link"}
              size={12}
              tintColor={accessPalette.iconColor}
            />
            <Text
              className="ml-1 text-[11px] font-normal"
              numberOfLines={1}
              style={{
                color: accessPalette.textColor,
                includeFontPadding: false,
                lineHeight: 11,
              }}
            >
              {getCommunityGroupAccessLabel(group.requiredApproval)}
            </Text>
          </View>
        </View>

        <View className="mt-auto pt-1.5">
          <Pressable
            className="self-stretch items-center justify-center rounded-[12px] bg-[#F3F4F6] px-4 py-2"
            onPress={onPress}
            style={({ pressed }) => ({
              opacity: pressed ? 0.86 : 1,
            })}
          >
            <Text
              className="text-[11px] font-semibold text-[#6B7280]"
              style={{ includeFontPadding: false, lineHeight: 12 }}
            >
              Mở nhóm
            </Text>
          </Pressable>
        </View>
      </View>
    </View>
  );
}
