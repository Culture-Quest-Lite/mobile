import { LinearGradient } from "expo-linear-gradient";
import { SymbolView } from "@/components/ui/symbol-view";
import type { CommunityGroupPayload } from "@/features/community/api/group-api";
import { lineHeightFor } from "@/lib/text-scale";
import { Image, Pressable, Text, View } from "react-native";

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
// Card cao cố định để tên nhóm dài không đẩy badge vai trò tràn ra ngoài viền.
const cardHeight = 232;
const cardImageHeight = 124;
// Bề rộng mặc định của card nhóm - gọn lại để lướt ngang thấy được nhiều nhóm.
const cardWidth = 180;
const cardMaxFontSizeMultiplier = 1.0;
// Toàn bộ chữ trong card đều 12px - lineHeight lấy từ thang chung.
const cardTextFontSize = 12;
const cardTextLineHeight = lineHeightFor(cardTextFontSize);
const groupNameLineHeight = lineHeightFor(15);
const groupNameMaxLines = 2;

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

export function CommunityCreateGroupCard({ onPress }: { onPress: () => void }) {
  return (
    <Pressable
      className="overflow-hidden rounded-[20px] bg-white"
      onPress={onPress}
      style={({ pressed }) => [
        cardShadowStyle,
        {
          minHeight: cardHeight,
          opacity: pressed ? 0.88 : 1,
          width: cardWidth,
        },
      ]}
    >
      <View
        className="flex-1 self-stretch items-center justify-center rounded-[20px] bg-[#FFFDFE] px-4 py-4"
        style={{
          borderColor: "#F7D4E3",
          borderStyle: "dashed",
          borderWidth: 1,
          borderRadius: 20,
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

export function CommunityGroupsLoginRequiredCard({
  actionLabel,
  description,
  onPress,
  title,
}: {
  actionLabel: string;
  description?: string;
  onPress: () => void;
  title: string;
}) {
  return (
    <Pressable
      onPress={onPress}
      style={({ pressed }) => ({
        opacity: pressed ? 0.94 : 1,
      })}
    >
      <LinearGradient
        className="overflow-hidden rounded-[22px]"
        colors={["#FFF7FA", "#FFFFFF"] as const}
        start={{ x: 0, y: 0.5 }}
        end={{ x: 1, y: 0.5 }}
        style={[
          cardShadowStyle,
          {
            borderColor: "#F8E0E9",
            borderWidth: 1,
            minHeight: 102,
            paddingHorizontal: 14,
            paddingVertical: 14,
          },
        ]}
      >
        <View className="flex-row items-center">
          <View
            className="h-[72px] w-[72px] items-center justify-center rounded-full bg-white"
            style={{
              borderColor: "#FCE0EB",
              borderWidth: 1,
              shadowColor: "rgba(244, 63, 126, 0.14)",
              shadowOffset: { width: 0, height: 10 },
              shadowOpacity: 1,
              shadowRadius: 18,
              elevation: 6,
            }}
          >
            <Image
              source={require("../../../../assets/images/okhoa.png")}
              resizeMode="contain"
              style={{ height: 58, width: 58 }}
            />
          </View>

          <View className="ml-4 flex-1">
            <Text
              className="text-[15px] font-medium text-[#8F8298]"
              style={{ includeFontPadding: false, lineHeight: lineHeightFor(16) }}
            >
              {title}
            </Text>
            {description ? (
              <Text
                className="mt-1 text-[12px] text-[#7D7287]"
                style={{ includeFontPadding: false, lineHeight: lineHeightFor(14) }}
              >
                {description}
              </Text>
            ) : null}
            <View className="mt-3 items-center">
              <LinearGradient
                colors={["#FF6B98", "#F43F7E"] as const}
                end={{ x: 1, y: 0.5 }}
                start={{ x: 0, y: 0.5 }}
                className="overflow-hidden rounded-full"
                style={{
                  alignItems: "center",
                  flexDirection: "row",
                  gap: 4,
                  paddingHorizontal: 12,
                  paddingVertical: 7,
                }}
              >
                <Text
                  className="text-[13px] font-semibold text-white"
                  style={{ includeFontPadding: false, lineHeight: lineHeightFor(14) }}
                >
                  {actionLabel}
                </Text>
                <SymbolView
                  name={{
                    ios: "chevron.right",
                    android: "chevron_right",
                    web: "chevron_right",
                  }}
                  size={14}
                  tintColor="#FFFFFF"
                />
              </LinearGradient>
            </View>
          </View>
        </View>
      </LinearGradient>
    </Pressable>
  );
}

export function CommunityGroupCompactStateCard({
  description,
  title,
  width = cardWidth,
}: {
  description: string;
  title: string;
  width?: number;
}) {
  return (
    <View
      className="rounded-[20px] border bg-white px-4 py-4"
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
  width = cardWidth,
}: {
  width?: number;
}) {
  return (
    <View
      className="items-center justify-center rounded-[20px] border bg-white px-4 py-4"
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
  width = cardWidth,
}: {
  group: CommunityGroupPayload;
  isLeader?: boolean;
  onPress: () => void;
  width?: number;
}) {
  const groupName = readMeaningfulText(group.groupName) ?? "Nhóm chưa đặt tên";
  const memberCount =
    typeof group.totalMembers === "number" &&
    Number.isFinite(group.totalMembers)
      ? Math.max(0, Math.round(group.totalMembers))
      : 0;
  const roleLabel = isLeader ? "Nhóm trưởng" : "Thành viên";

  return (
    <Pressable
      className="rounded-[20px] bg-white overflow-hidden"
      style={[
        cardShadowStyle,
        {
          borderColor: subtleBorderColor,
          borderWidth: subtleBorderWidth,
          height: cardHeight,
          width,
        },
      ]}
      onPress={onPress}
    >
      <View className="overflow-hidden rounded-[20px] bg-white">
        <View
          className="w-full overflow-hidden bg-[#F5F0F8]"
          style={{ height: cardImageHeight }}
        >
          {group.imageUrl ? (
            <Image
              source={{ uri: group.imageUrl }}
              resizeMode="cover"
              className="h-full w-full"
            />
          ) : (
            <Image
              source={require("../../../../assets/images/tachnen3.png")}
              resizeMode="cover"
              className="h-full w-full"
            />
          )}
        </View>

        <View className="px-3 pb-3 pt-3">
          <Text
            className="text-[15px] font-semibold text-[#2E2336]"
            maxFontSizeMultiplier={cardMaxFontSizeMultiplier}
            numberOfLines={groupNameMaxLines}
            style={{
              includeFontPadding: false,
              lineHeight: groupNameLineHeight,
            }}
          >
            {groupName}
          </Text>

          <View className="mt-1 space-y-1">
            <View
              className="flex-row items-center"
              style={{ paddingVertical: 1 }}
            >
              <SymbolView
                name={{
                  ios: "person.2.fill",
                  android: "groups",
                  web: "groups",
                }}
                size={11}
                tintColor="#6F657A"
              />
              <Text
                className="ml-1 text-[12px] font-normal text-[#6F657A]"
                style={{
                  includeFontPadding: false,
                  lineHeight: lineHeightFor(13),
                }}
              >
                {formatGroupMemberCountLabel(memberCount)}
              </Text>
            </View>

            <View
              className="flex-row items-center"
              style={{ paddingVertical: 1 }}
            >
              <SymbolView
                name={{ ios: "person.fill", android: "person", web: "person" }}
                size={11}
                tintColor="#6D4B9E"
              />
              <Text
                className="ml-1 text-[12px] font-normal text-[#6D4B9E]"
                style={{
                  includeFontPadding: false,
                  lineHeight: lineHeightFor(13),
                }}
              >
                {roleLabel}
              </Text>
            </View>
          </View>
        </View>
      </View>
    </Pressable>
  );
}
