import { SymbolView } from "@/components/ui/symbol-view";
import type { CommunityGroupPayload } from "@/features/community/api/group-api";
import { Image, Pressable, StyleSheet, Text, View } from "react-native";
import { lineHeightFor } from "@/lib/text-scale";

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
// Card cao cố định để tên nhóm dài không đẩy nút "Mở nhóm" tràn ra ngoài viền.
const cardHeight = 220;
const cardMaxFontSizeMultiplier = 1.1;
// Toàn bộ chữ trong card đều 13px - lineHeight lấy từ thang chung.
const cardTextFontSize = 13;
const cardTextLineHeight = lineHeightFor(cardTextFontSize);
const groupNameLineHeight = cardTextLineHeight;
const groupNameMaxLines = 2;
const groupNameBlockHeight = groupNameLineHeight * groupNameMaxLines;

// Đường kẻ mảnh ngăn giữa các row trong card nhóm.
const rowDividerColor = "#F1EDF1";

function CommunityGroupRowDivider() {
  return (
    <View
      className="self-stretch"
      style={{
        backgroundColor: rowDividerColor,
        height: StyleSheet.hairlineWidth,
        marginVertical: 5,
      }}
    />
  );
}

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
          minHeight: cardHeight,
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
          className="mt-3 text-center text-[13px] font-normal text-[#F43F7E]"
          style={{ includeFontPadding: false, lineHeight: cardTextLineHeight }}
        >
          Nhóm mới
        </Text>
        <Text
          className="mt-1 text-center text-[13px] font-normal text-[#9F8E99]"
          style={{ includeFontPadding: false, lineHeight: cardTextLineHeight }}
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
          minHeight: cardHeight,
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
        className="mt-3 text-[13px] font-normal text-[#2E2336]"
        style={{ includeFontPadding: false, lineHeight: cardTextLineHeight }}
      >
        {title}
      </Text>
      <Text
        className="mt-1.5 text-[13px] text-[#8F8298]"
        style={{ includeFontPadding: false, lineHeight: cardTextLineHeight }}
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
          minHeight: cardHeight,
          width,
        },
      ]}
    >
      <Text
        className="text-center text-[13px] font-normal text-[#8F8298]"
        style={{ includeFontPadding: false, lineHeight: cardTextLineHeight }}
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
          height: cardHeight,
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

        <CommunityGroupRowDivider />

        <View
          className="flex-row items-start self-stretch"
          style={{ columnGap: 4, height: groupNameBlockHeight }}
        >
          <Text
            className="text-[13px] font-normal text-[#2E2336]"
            maxFontSizeMultiplier={cardMaxFontSizeMultiplier}
            numberOfLines={groupNameMaxLines}
            style={{
              flex: 1,
              includeFontPadding: false,
              lineHeight: groupNameLineHeight,
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
              size={14}
              tintColor="#E39B1A"
            />
          ) : null}
        </View>

        <CommunityGroupRowDivider />

        <View className="self-stretch">
          <View className="self-start flex-row items-center">
            <SymbolView
              name={{ ios: "person.2.fill", android: "groups", web: "groups" }}
              size={12}
              tintColor="#7D7488"
            />
            <Text
              className="ml-1 text-[13px] font-normal text-[#7D7488]"
              maxFontSizeMultiplier={cardMaxFontSizeMultiplier}
              numberOfLines={1}
              style={{
                includeFontPadding: false,
                lineHeight: cardTextLineHeight,
              }}
            >
              {formatGroupMemberCountLabel(memberCount)}
            </Text>
          </View>

          <View
            className="self-start flex-row items-center rounded-full px-2 py-0.5"
            style={{ backgroundColor: accessPalette.backgroundColor }}
          >
            <SymbolView
              name={group.requiredApproval === true ? "lock.fill" : "link"}
              size={11}
              tintColor={accessPalette.iconColor}
            />
            <Text
              className="ml-1 text-[13px] font-normal"
              maxFontSizeMultiplier={cardMaxFontSizeMultiplier}
              numberOfLines={1}
              style={{
                color: accessPalette.textColor,
                includeFontPadding: false,
                lineHeight: cardTextLineHeight,
              }}
            >
              {getCommunityGroupAccessLabel(group.requiredApproval)}
            </Text>
          </View>
        </View>

        <View className="mt-auto pt-1.5">
          <Pressable
            className="self-stretch items-center justify-center rounded-[10px] bg-[#F3F4F6] px-3 py-1"
            onPress={onPress}
            style={({ pressed }) => ({
              opacity: pressed ? 0.86 : 1,
            })}
          >
            <Text
              className="text-[12px] font-normal text-[#6B7280]"
              maxFontSizeMultiplier={cardMaxFontSizeMultiplier}
              style={{
                includeFontPadding: false,
                lineHeight: lineHeightFor(12),
              }}
            >
              Mở nhóm
            </Text>
          </Pressable>
        </View>
      </View>
    </View>
  );
}
