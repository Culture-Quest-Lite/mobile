import { SymbolView } from "@/components/ui/symbol-view";
import { ScreenHorizontalPadding } from "@/constants/theme";
import * as Clipboard from "expo-clipboard";
import { LinearGradient } from "expo-linear-gradient";
import { useLocalSearchParams, useRouter, type Href } from "expo-router";
import { StatusBar } from "expo-status-bar";
import { useEffect, useState, type ComponentProps } from "react";
import { useTranslation } from "react-i18next";
import {
  Image,
  Pressable,
  StyleSheet,
  Text as RNText,
  useWindowDimensions,
  View,
  type TextProps,
} from "react-native";
import {
  SafeAreaView,
  useSafeAreaInsets,
} from "react-native-safe-area-context";

import { CommunityGroupStateCard } from "../components/community-group-ui";
import { getCachedCommunityGroupSession } from "../data/community-group-session-store";
import { lineHeightFor } from "@/lib/text-scale";

type SymbolName = ComponentProps<typeof SymbolView>["name"];

const successHeroImage = require("../../../../assets/images/post_group1.png");
const successBackgroundImage = require("../../../../assets/images/nenanpopup.png");
const detailTextMaxFontSizeMultiplier = 1.05;
/** Đoạn nội dung của màn này siết hơn mức 1.45 chung, vẫn đủ chỗ cho dấu tiếng Việt. */
const compactBodyLineHeightRatio = 1.32;
/** Chữ 1 dòng (tên nhóm, link, nhãn) siết sát hơn mức 1.15 chung. */
const compactLabelLineHeightRatio = 1.1;
const pagePalette = {
  accent: "#B16A19",
  accentStrong: "#8C5211",
  body: "#635B52",
  border: "#E6E8EC",
  buttonEnd: "#E786B1",
  buttonMid: "#F09EC3",
  buttonStart: "#F7BDD7",
  iconTint: "#8F857A",
  pageBase: "#FFF9FB",
  surface: "#FFFFFF",
  surfaceSoft: "#F3F4F6",
  title: "#2F261D",
};

const cardShadowStyle = {
  shadowColor: "#D7C19A",
  shadowOffset: { width: 0, height: 14 },
  shadowOpacity: 0.16,
  shadowRadius: 24,
  elevation: 8,
} as const;

function Text({
  maxFontSizeMultiplier = detailTextMaxFontSizeMultiplier,
  style,
  ...props
}: TextProps) {
  return (
    <RNText
      maxFontSizeMultiplier={maxFontSizeMultiplier}
      style={[{ includeFontPadding: false }, style]}
      {...props}
    />
  );
}

function SuccessHeroImage({
  frameHeight,
  imageHeight,
  imageWidth,
}: {
  frameHeight: number;
  imageHeight: number;
  imageWidth: number;
}) {
  return (
    <View className="items-center">
      <View style={[styles.heroImageFrame, { height: frameHeight, width: imageWidth + 20 }]}>
        <Image
          resizeMode="contain"
          source={successHeroImage}
          style={[styles.heroImage, { height: imageHeight, width: imageWidth }]}
        />
      </View>
    </View>
  );
}

function MetaItem({ icon, label }: { icon: SymbolName; label: string }) {
  return (
    <View className="flex-row items-center">
      <SymbolView name={icon} size={12} tintColor={pagePalette.iconTint} />
      <Text className="ml-1 text-[11.5px]" style={{ color: pagePalette.body, lineHeight: lineHeightFor(11.5, compactLabelLineHeightRatio) }}>
        {label}
      </Text>
    </View>
  );
}

function InviteCard({
  copied,
  groupName,
  inviteUrl,
  memberCount,
  onCopy,
}: {
  copied: boolean;
  groupName: string;
  inviteUrl: string;
  memberCount: number;
  onCopy: () => void;
}) {
  const { t } = useTranslation();

  return (
    <View className="w-full px-1">
      <View style={[styles.inviteCard, cardShadowStyle]}>
        <View className="flex-row items-center">
          <View style={styles.groupBadgeOuter}>
            <View style={styles.groupBadgeInner}>
              <SymbolView
                name={{
                  ios: "person.3.fill",
                  android: "groups",
                  web: "groups",
                }}
                size={19}
                tintColor="#9CA3AF"
              />
            </View>
          </View>

          <View className="ml-3 flex-1" style={{ minWidth: 0 }}>
            <Text
              className="text-[14px] font-black"
              numberOfLines={1}
              style={{ color: pagePalette.title, lineHeight: lineHeightFor(14, compactLabelLineHeightRatio) }}
            >
              {groupName}
            </Text>

            <View className="mt-1 flex-row flex-wrap items-center">
              <MetaItem
                icon={{
                  ios: "person",
                  android: "person",
                  web: "person",
                }}
                label={t("community.groupsScreen.memberCountLabel", {
                  count: memberCount,
                })}
              />
            </View>
          </View>
        </View>

        <Text
          className="mt-2.5 text-[10.5px] font-black uppercase tracking-[0.35px]"
          style={{ color: pagePalette.body, lineHeight: lineHeightFor(10.5, compactLabelLineHeightRatio) }}
        >
          {t("community.groupCreated.inviteLinkLabel")}
        </Text>

        <View
          className="mt-1.5 flex-row items-center rounded-[16px] px-2.5 py-1.5"
          style={{
            backgroundColor: pagePalette.surfaceSoft,
            borderColor: pagePalette.border,
            borderWidth: 0.85,
          }}
        >
          <View className="flex-1 pr-2" style={{ minWidth: 0 }}>
            <Text
              className="text-[11.5px]"
              numberOfLines={1}
              style={{ color: pagePalette.body, lineHeight: lineHeightFor(11.5, compactLabelLineHeightRatio) }}
            >
              {inviteUrl}
            </Text>
          </View>

          <Pressable
            className="rounded-[14px]"
            onPress={onCopy}
            style={({ pressed }) => ({
              opacity: pressed ? 0.84 : 1,
            })}
          >
            <View
              className="items-center justify-center rounded-[14px] bg-white"
              style={[
                styles.copyButtonShadow,
                copied ? styles.copyButtonActive : styles.copyButton,
              ]}
            >
              <SymbolView
                name={{
                  ios: "doc.on.doc",
                  android: "content_copy",
                  web: "content_copy",
                }}
                size={14}
                tintColor={copied ? pagePalette.buttonEnd : pagePalette.body}
              />
            </View>
          </Pressable>
        </View>
      </View>
    </View>
  );
}

export default function CommunityGroupCreatedScreen() {
  const router = useRouter();
  const { t } = useTranslation();
  const insets = useSafeAreaInsets();
  const { height, width } = useWindowDimensions();
  const { shareToken } = useLocalSearchParams<{ shareToken?: string }>();
  const resolvedShareToken =
    typeof shareToken === "string" ? decodeURIComponent(shareToken) : null;
  const groupSession = getCachedCommunityGroupSession(resolvedShareToken);
  const [copied, setCopied] = useState(false);
  const safeScreenWidth = Math.max(width - insets.left - insets.right, 320);
  const horizontalPadding = ScreenHorizontalPadding;
  const contentMaxWidth = Math.min(460, safeScreenWidth - horizontalPadding * 2);
  const heroImageWidth = Math.min(Math.max(contentMaxWidth - 8, 230), 272);
  // Màn cố định, không cuộn: ảnh linh vật phải nhường chỗ cho card + 2 nút,
  // nên chặn thêm theo chiều cao máy để máy thấp không bị tràn khỏi khung.
  const heroImageHeight = Math.round(
    Math.min(heroImageWidth * (202 / 304), height * 0.21),
  );
  const heroFrameHeight = heroImageHeight + 14;
  // Nút X nằm trong luồng bố cục bình thường (giống trang popup đăng bài thành công)
  // thay vì "float" tuyệt đối, để luôn cách mép an toàn insets.top thay vì dính sát mép máy.
  const closeButtonRowTopPadding = Math.max(insets.top, 16) + 14;
  const closeButtonRowHeight = closeButtonRowTopPadding + 40 + 4;
  const contentTopPadding = 56;
  const descriptionMaxWidth = Math.min(contentMaxWidth * 0.82, 278);
  // Nền chỉ phủ vùng header: từ đỉnh màn hình tới hết ảnh linh vật, rồi tan dần vào nền trang.
  const headerBackgroundHeight =
    closeButtonRowHeight + contentTopPadding + heroFrameHeight;
  // Neo thủ công thay vì để "cover" tự cắt giữa: dải cầu - lầu son nằm ở khoảng 34% chiều cao ảnh,
  // cần kéo về giữa header thì mới nhìn thấy, nếu không phần lọt vào khung chỉ là mặt nước trắng.
  const headerImageWidth = width;
  const headerImageHeight = Math.round(headerImageWidth * (1672 / 941));
  const headerImageTop = Math.round(
    headerBackgroundHeight * 0.58 - headerImageHeight * 0.34,
  );

  useEffect(() => {
    if (!copied) {
      return undefined;
    }

    const timeoutId = setTimeout(() => {
      setCopied(false);
    }, 1600);

    return () => {
      clearTimeout(timeoutId);
    };
  }, [copied]);

  const navigateToFeed = () => {
    router.replace("/bookings" as Href);
  };

  const handleCopy = async () => {
    if (!groupSession) {
      return;
    }

    await Clipboard.setStringAsync(groupSession.inviteWebUrl);
    setCopied(true);
  };

  const memberCount =
    typeof groupSession?.totalMembers === "number" &&
    groupSession.totalMembers > 0
      ? groupSession.totalMembers
      : 1;

  return (
    <View className="flex-1" style={{ backgroundColor: pagePalette.pageBase }}>
      <StatusBar style="dark" />

      <View
        pointerEvents="none"
        style={[styles.headerBackground, { height: headerBackgroundHeight }]}
      >
        <Image
          resizeMode="cover"
          source={successBackgroundImage}
          style={[
            styles.headerBackgroundImage,
            {
              height: headerImageHeight,
              top: headerImageTop,
              width: headerImageWidth,
            },
          ]}
        />
        <LinearGradient
          colors={[
            "rgba(255, 249, 251, 0)",
            "rgba(255, 249, 251, 0.35)",
            pagePalette.pageBase,
          ]}
          locations={[0, 0.78, 1]}
          style={styles.headerBackgroundFade}
        />
      </View>

      <SafeAreaView className="flex-1" edges={["left", "right", "bottom"]}>
        <View
          className="z-20 flex-row items-center justify-start"
          style={{
            paddingBottom: 4,
            paddingHorizontal: horizontalPadding,
            paddingTop: closeButtonRowTopPadding,
          }}
        >
          <Pressable
            hitSlop={12}
            onPress={navigateToFeed}
            style={({ pressed }) => [
              styles.closeButtonInline,
              { opacity: pressed ? 0.82 : 1 },
            ]}
          >
            <SymbolView
              name={{
                ios: "xmark",
                android: "close",
                web: "close",
              }}
              size={18}
              tintColor={pagePalette.body}
            />
          </Pressable>
        </View>

        {!resolvedShareToken ? (
          <View
            className="flex-1 justify-center pt-8"
            style={{ paddingHorizontal: horizontalPadding }}
          >
            <CommunityGroupStateCard
              actionLabel={t("community.groupCreated.backToFeed")}
              description={t("community.groupCreated.missingTokenDescription")}
              icon="link_off"
              onPress={navigateToFeed}
              title={t("community.groupCreated.missingTokenTitle")}
              variant="empty"
            />
          </View>
        ) : !groupSession ? (
          <View
            className="flex-1 justify-center pt-8"
            style={{ paddingHorizontal: horizontalPadding }}
          >
            <CommunityGroupStateCard
              actionLabel={t("community.groupCreated.backToFeed")}
              description={t("community.groupCreated.missingSessionDescription")}
              icon="groups"
              onPress={navigateToFeed}
              title={t("community.groupCreated.missingSessionTitle")}
              variant="empty"
            />
          </View>
        ) : (
          <View
            className="flex-1 items-center"
            style={{
              paddingBottom: Math.max(insets.bottom + 14, 20),
              paddingHorizontal: horizontalPadding,
              paddingTop: contentTopPadding,
            }}
          >
            <View className="w-full items-center" style={{ maxWidth: contentMaxWidth }}>
              <View className="items-center">
                <SuccessHeroImage
                  frameHeight={heroFrameHeight}
                  imageHeight={heroImageHeight}
                  imageWidth={heroImageWidth}
                />

                <Text
                  className="mt-6 text-center text-[19px] font-black"
                  style={{ color: pagePalette.title, lineHeight: lineHeightFor(19, compactLabelLineHeightRatio) }}
                >
                  {t("community.groupCreated.successTitle")}
                </Text>

                <Text
                  className="mt-1.5 text-center text-[12px]"
                  style={{
                    color: pagePalette.body,
                    // 1.32 thay cho 1.45 mặc định: gọn hơn nhưng vẫn đủ chỗ cho dấu tiếng Việt.
                    lineHeight: lineHeightFor(12, compactBodyLineHeightRatio),
                    maxWidth: descriptionMaxWidth,
                  }}
                >
                  {t("community.groupCreated.successSubtitle")}
                </Text>
              </View>

              <View className="mt-4 w-full">
                <InviteCard
                  copied={copied}
                  groupName={
                    groupSession.groupName ??
                    t("community.groupCreated.defaultGroupName")
                  }
                  inviteUrl={groupSession.inviteWebUrl}
                  memberCount={memberCount}
                  onCopy={() => {
                    void handleCopy();
                  }}
                />
              </View>

              <View className="mt-3 w-full">
                <Pressable
                  onPress={() => {
                    router.push(
                      `/community/group/${encodeURIComponent(groupSession.shareToken)}` as Href,
                    );
                  }}
                  style={({ pressed }) => ({
                    opacity: pressed ? 0.9 : 1,
                  })}
                >
                  <View
                    style={[
                      styles.primaryButton,
                      styles.primaryButtonShadow,
                      { backgroundColor: pagePalette.buttonMid },
                    ]}
                  >
                    <View className="flex-row items-center justify-center">
                      <SymbolView
                        name={{
                          ios: "paperplane.fill",
                          android: "send",
                          web: "send",
                        }}
                        size={14}
                        tintColor="#FFFFFF"
                      />
                      <Text
                        className="ml-2 text-[13px] font-black text-white"
                        style={{ lineHeight: lineHeightFor(13, compactLabelLineHeightRatio) }}
                      >
                        {t("community.groupCreated.viewDetails")}
                      </Text>
                    </View>

                    <View className="absolute bottom-0 right-4 top-0 justify-center">
                      <SymbolView
                        name={{
                          ios: "sparkles",
                          android: "auto_awesome",
                          web: "auto_awesome",
                        }}
                        size={14}
                        tintColor="#FFF4FB"
                      />
                    </View>
                  </View>
                </Pressable>

                <Pressable
                  className="mt-2.5"
                  onPress={navigateToFeed}
                  style={({ pressed }) => ({
                    opacity: pressed ? 0.86 : 1,
                  })}
                >
                  <View
                    className="flex-row items-center justify-center px-4"
                    style={[
                      styles.secondaryButton,
                      styles.whiteButtonShadow,
                      {
                        backgroundColor: pagePalette.surface,
                        borderColor: pagePalette.border,
                        borderWidth: 0.85,
                      },
                    ]}
                  >
                    <SymbolView
                      name={{
                        ios: "house.fill",
                        android: "home",
                        web: "home",
                      }}
                      size={14}
                      tintColor={pagePalette.body}
                    />
                    <Text
                      className="ml-2 text-[13px] font-black"
                      style={{ color: pagePalette.body, lineHeight: lineHeightFor(13, compactLabelLineHeightRatio) }}
                    >
                      {t("community.groupCreated.backToFeed")}
                    </Text>
                  </View>
                </Pressable>
              </View>
            </View>
          </View>
        )}
      </SafeAreaView>
    </View>
  );
}

const styles = StyleSheet.create({
  closeButtonInline: {
    alignItems: "center",
    backgroundColor: "#FFFFFF",
    borderColor: pagePalette.border,
    borderRadius: 999,
    borderWidth: 0.85,
    elevation: 4,
    height: 40,
    justifyContent: "center",
    width: 40,
    shadowColor: "#CDBA9A",
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.14,
    shadowRadius: 16,
  },
  copyButtonShadow: {
    shadowColor: "#D5C1A3",
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.14,
    shadowRadius: 12,
    elevation: 3,
  },
  copyButton: {
    borderColor: pagePalette.border,
    borderWidth: 0.85,
    height: 32,
    width: 32,
  },
  copyButtonActive: {
    borderColor: pagePalette.border,
    borderWidth: 0.85,
    height: 32,
    width: 32,
  },
  groupBadgeInner: {
    alignItems: "center",
    backgroundColor: "#F3F4F6",
    borderRadius: 999,
    height: 40,
    justifyContent: "center",
    width: 40,
  },
  groupBadgeOuter: {
    alignItems: "center",
    backgroundColor: "rgba(243,244,246,0.92)",
    borderRadius: 999,
    height: 50,
    justifyContent: "center",
    width: 50,
  },
  heroImage: {
    height: 202,
    width: 304,
  },
  heroImageFrame: {
    alignItems: "center",
    height: 252,
    justifyContent: "center",
    width: 324,
  },
  headerBackground: {
    left: 0,
    overflow: "hidden",
    position: "absolute",
    right: 0,
    top: 0,
  },
  headerBackgroundImage: {
    left: 0,
    position: "absolute",
  },
  headerBackgroundFade: {
    bottom: 0,
    left: 0,
    position: "absolute",
    right: 0,
    top: 0,
  },
  inviteCard: {
    backgroundColor: "rgba(255, 255, 255, 0.96)",
    borderColor: pagePalette.border,
    borderRadius: 24,
    borderWidth: 0.85,
    paddingHorizontal: 15,
    paddingVertical: 15,
  },
  primaryButton: {
    alignItems: "center",
    borderRadius: 15,
    height: 40,
    justifyContent: "center",
    overflow: "hidden",
  },
  primaryButtonShadow: {
    elevation: 7,
    shadowColor: "#E7A0C2",
    shadowOffset: { width: 0, height: 12 },
    shadowOpacity: 0.28,
    shadowRadius: 20,
  },
  secondaryButton: {
    alignItems: "center",
    borderRadius: 15,
    height: 38,
    justifyContent: "center",
  },
  whiteButtonShadow: {
    elevation: 4,
    shadowColor: "#D5C2A1",
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.12,
    shadowRadius: 18,
  },
});
