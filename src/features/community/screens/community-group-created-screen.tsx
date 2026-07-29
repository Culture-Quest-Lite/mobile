import { SymbolView } from "@/components/ui/symbol-view";
import * as Clipboard from "expo-clipboard";
import { LinearGradient } from "expo-linear-gradient";
import { useLocalSearchParams, useRouter, type Href } from "expo-router";
import { StatusBar } from "expo-status-bar";
import { useEffect, useState, type ComponentProps } from "react";
import {
  Image,
  Pressable,
  ScrollView,
  StyleSheet,
  Text as RNText,
  useWindowDimensions,
  View,
  type TextProps,
} from "react-native";
import Animated, {
  Easing,
  ReduceMotion,
  cancelAnimation,
  useAnimatedStyle,
  useSharedValue,
  withRepeat,
  withTiming,
} from "react-native-reanimated";
import {
  SafeAreaView,
  useSafeAreaInsets,
} from "react-native-safe-area-context";

import { CommunityGroupStateCard } from "../components/community-group-ui";
import { getCachedCommunityGroupSession } from "../data/community-group-session-store";

type SymbolName = ComponentProps<typeof SymbolView>["name"];

const successHeroImage = require("../../../../assets/images/post_group1.png");
const detailTextMaxFontSizeMultiplier = 1.05;
const pagePalette = {
  accent: "#B16A19",
  accentStrong: "#8C5211",
  body: "#635B52",
  border: "#E6E8EC",
  buttonEnd: "#E786B1",
  buttonMid: "#F09EC3",
  buttonStart: "#F7BDD7",
  iconTint: "#8F857A",
  surface: "#FFFFFF",
  surfaceSoft: "#FFF8ED",
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
  glowHeight,
  glowTop,
  glowWidth,
  imageHeight,
  imageWidth,
}: {
  frameHeight: number;
  glowHeight: number;
  glowTop: number;
  glowWidth: number;
  imageHeight: number;
  imageWidth: number;
}) {
  const heroFloat = useSharedValue(0);
  const heroRotate = useSharedValue(0);
  const heroScale = useSharedValue(1);

  useEffect(() => {
    heroFloat.set(
      withRepeat(
        withTiming(-14, {
          duration: 1850,
          easing: Easing.inOut(Easing.quad),
          reduceMotion: ReduceMotion.System,
        }),
        -1,
        true,
        undefined,
        ReduceMotion.System,
      ),
    );

    heroRotate.set(
      withRepeat(
        withTiming(3.6, {
          duration: 1850,
          easing: Easing.inOut(Easing.quad),
          reduceMotion: ReduceMotion.System,
        }),
        -1,
        true,
        undefined,
        ReduceMotion.System,
      ),
    );

    heroScale.set(
      withRepeat(
        withTiming(1.06, {
          duration: 1850,
          easing: Easing.inOut(Easing.quad),
          reduceMotion: ReduceMotion.System,
        }),
        -1,
        true,
        undefined,
        ReduceMotion.System,
      ),
    );

    return () => {
      cancelAnimation(heroFloat);
      cancelAnimation(heroRotate);
      cancelAnimation(heroScale);
      heroFloat.set(0);
      heroRotate.set(0);
      heroScale.set(1);
    };
  }, [heroFloat, heroRotate, heroScale]);

  const animatedHeroStyle = useAnimatedStyle(() => {
    return {
      transform: [
        { translateY: heroFloat.get() },
        { rotate: `${heroRotate.get()}deg` },
        { scale: heroScale.get() },
      ],
    };
  });

  const animatedGlowStyle = useAnimatedStyle(() => {
    const scaleOffset = heroScale.get() - 1;

    return {
      opacity: 0.54 + scaleOffset * 7,
      transform: [
        { translateY: heroFloat.get() * 0.58 },
        { scale: 0.92 + scaleOffset * 6 },
      ],
    };
  });

  return (
    <View className="items-center">
      <View style={[styles.heroImageFrame, { height: frameHeight, width: imageWidth + 20 }]}>
        <Animated.View
          pointerEvents="none"
          style={[
            styles.heroGlow,
            animatedGlowStyle,
            { height: glowHeight, top: glowTop, width: glowWidth },
          ]}
        >
          <LinearGradient
            colors={[
              "rgba(247,189,215,0.48)",
              "rgba(240,158,195,0.24)",
              "rgba(255,255,255,0)",
            ]}
            end={{ x: 1, y: 0.5 }}
            start={{ x: 0, y: 0.5 }}
            style={styles.heroGlowFill}
          />
        </Animated.View>

        <Animated.View style={[styles.heroImageShell, animatedHeroStyle]}>
          <Image
            resizeMode="contain"
            source={successHeroImage}
            style={[styles.heroImage, { height: imageHeight, width: imageWidth }]}
          />
        </Animated.View>
      </View>
    </View>
  );
}

function MetaItem({ icon, label }: { icon: SymbolName; label: string }) {
  return (
    <View className="flex-row items-center">
      <SymbolView name={icon} size={12} tintColor={pagePalette.iconTint} />
      <Text className="ml-1 text-[12px]" style={{ color: pagePalette.body, lineHeight: 12 }}>
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
                size={22}
                tintColor="#34B362"
              />
            </View>
          </View>

          <View className="ml-4 flex-1" style={{ minWidth: 0 }}>
            <Text
              className="text-[15px] font-black"
              numberOfLines={1}
              style={{ color: pagePalette.title, lineHeight: 17 }}
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
                label={`${memberCount} thành viên`}
              />
            </View>
          </View>
        </View>

        <Text
          className="mt-3 text-[11px] font-black uppercase tracking-[0.35px]"
          style={{ color: pagePalette.body, lineHeight: 11 }}
        >
          Link mời
        </Text>

        <View
          className="mt-1.5 flex-row items-center rounded-[18px] px-3 py-2"
          style={{
            backgroundColor: pagePalette.surfaceSoft,
            borderColor: pagePalette.border,
            borderWidth: 0.85,
          }}
        >
          <View className="flex-1 pr-2" style={{ minWidth: 0 }}>
            <Text
              className="text-[12px]"
              numberOfLines={1}
              style={{ color: pagePalette.body, lineHeight: 13 }}
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
                size={15}
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
  const insets = useSafeAreaInsets();
  const { width } = useWindowDimensions();
  const { shareToken } = useLocalSearchParams<{ shareToken?: string }>();
  const resolvedShareToken =
    typeof shareToken === "string" ? decodeURIComponent(shareToken) : null;
  const groupSession = getCachedCommunityGroupSession(resolvedShareToken);
  const [copied, setCopied] = useState(false);
  const safeScreenWidth = Math.max(width - insets.left - insets.right, 320);
  const horizontalPadding = safeScreenWidth < 360 ? 14 : safeScreenWidth < 430 ? 18 : 22;
  const contentMaxWidth = Math.min(460, safeScreenWidth - horizontalPadding * 2);
  const heroImageWidth = Math.min(Math.max(contentMaxWidth - 8, 250), 304);
  const heroImageHeight = Math.round(heroImageWidth * (202 / 304));
  const heroFrameHeight = heroImageHeight + 26;
  const heroGlowWidth = Math.round(heroImageWidth * 0.9);
  const heroGlowHeight = Math.round(heroImageHeight * 0.68);
  const heroGlowTop = Math.max(Math.round(heroImageHeight * 0.08), 14);
  const closeButtonTop = insets.top + (safeScreenWidth < 360 ? 22 : 26);
  const scrollTopPadding = closeButtonTop + 28;
  const descriptionMaxWidth = Math.min(contentMaxWidth * 0.82, 278);

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
    <View className="flex-1 bg-white">
      <StatusBar style="dark" />

      <SafeAreaView className="flex-1 bg-white" edges={["left", "right", "bottom"]}>
        <Pressable
          className="absolute z-20 h-11 w-11 items-center justify-center rounded-full"
          onPress={navigateToFeed}
          style={({ pressed }) => [
            styles.closeButtonFloating,
            {
              left: horizontalPadding,
              opacity: pressed ? 0.82 : 1,
              top: closeButtonTop,
            },
          ]}
        >
          <SymbolView
            name={{
              ios: "xmark",
              android: "close",
              web: "close",
            }}
            size={20}
            tintColor={pagePalette.body}
          />
        </Pressable>

        {!resolvedShareToken ? (
          <View
            className="flex-1 justify-center pt-8"
            style={{ paddingHorizontal: horizontalPadding }}
          >
            <CommunityGroupStateCard
              actionLabel="Về bảng tin"
              description="Khong doc duoc shareToken tu route hien tai."
              icon="link_off"
              onPress={navigateToFeed}
              title="Thieu du lieu link moi"
              variant="empty"
            />
          </View>
        ) : !groupSession ? (
          <View
            className="flex-1 justify-center pt-8"
            style={{ paddingHorizontal: horizontalPadding }}
          >
            <CommunityGroupStateCard
              actionLabel="Về bảng tin"
              description="Phien tao nhom da khong con trong bo nho. Hay tao lai nhom de lay link moi moi nhat."
              icon="groups"
              onPress={navigateToFeed}
              title="Khong tim thay du lieu nhom"
              variant="empty"
            />
          </View>
        ) : (
          <ScrollView
            bounces={false}
            contentContainerStyle={{
              alignItems: "center",
              paddingBottom: Math.max(insets.bottom + 14, 20),
              paddingHorizontal: horizontalPadding,
              paddingTop: scrollTopPadding,
            }}
            showsVerticalScrollIndicator={false}
          >
            <View className="w-full items-center" style={{ maxWidth: contentMaxWidth }}>
              <View className="items-center">
                <SuccessHeroImage
                  frameHeight={heroFrameHeight}
                  glowHeight={heroGlowHeight}
                  glowTop={heroGlowTop}
                  glowWidth={heroGlowWidth}
                  imageHeight={heroImageHeight}
                  imageWidth={heroImageWidth}
                />

                <Text
                  className="mt-1 text-center text-[22px] font-black"
                  style={{ color: pagePalette.title, lineHeight: 22 }}
                >
                  Tạo nhóm thành công!
                </Text>

                <LinearGradient
                  colors={["#F7BDD7", "#EA8FB9"]}
                  end={{ x: 1, y: 0.5 }}
                  start={{ x: 0, y: 0.5 }}
                  style={styles.titleUnderline}
                />

                <Text
                  className="mt-1.5 text-center text-[13px]"
                  style={{ color: pagePalette.body, lineHeight: 15, maxWidth: descriptionMaxWidth }}
                >
                  Cộng đồng của bạn đã sẵn sàng. Hãy mời những người cùng sở
                  thích tham gia nhé.
                </Text>
              </View>

              <View className="mt-5 w-full">
                <InviteCard
                  copied={copied}
                  groupName={groupSession.groupName ?? "Nhóm mới"}
                  inviteUrl={groupSession.inviteWebUrl}
                  memberCount={memberCount}
                  onCopy={() => {
                    void handleCopy();
                  }}
                />
              </View>

              <View className="mt-4 w-full">
                <Pressable
                  onPress={() => {
                    router.push(
                      `/community/group/${encodeURIComponent(groupSession.shareToken)}/invite` as Href,
                    );
                  }}
                  style={({ pressed }) => ({
                    opacity: pressed ? 0.9 : 1,
                  })}
                >
                  <LinearGradient
                    colors={[
                      pagePalette.buttonStart,
                      pagePalette.buttonMid,
                      pagePalette.buttonEnd,
                    ]}
                    end={{ x: 1, y: 0.5 }}
                    start={{ x: 0, y: 0.5 }}
                    style={[styles.primaryButton, styles.primaryButtonShadow]}
                  >
                    <View className="flex-row items-center justify-center">
                      <SymbolView
                        name={{
                          ios: "paperplane.fill",
                          android: "send",
                          web: "send",
                        }}
                        size={17}
                        tintColor="#FFFFFF"
                      />
                      <Text
                        className="ml-2 text-[15px] font-black text-white"
                        style={{ lineHeight: 15 }}
                      >
                        Xem chi tiết
                      </Text>
                    </View>

                    <View className="absolute bottom-0 right-4 top-0 justify-center">
                      <SymbolView
                        name={{
                          ios: "sparkles",
                          android: "auto_awesome",
                          web: "auto_awesome",
                        }}
                        size={16}
                        tintColor="#FFF4FB"
                      />
                    </View>
                  </LinearGradient>
                </Pressable>

                <Pressable
                  className="mt-2.5"
                  onPress={navigateToFeed}
                  style={({ pressed }) => ({
                    opacity: pressed ? 0.86 : 1,
                  })}
                >
                  <View
                    className="flex-row items-center justify-center rounded-[20px] px-4"
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
                      size={17}
                      tintColor={pagePalette.body}
                    />
                    <Text
                      className="ml-2 text-[15px] font-black"
                      style={{ color: pagePalette.body, lineHeight: 15 }}
                    >
                      Về bảng tin
                    </Text>
                  </View>
                </Pressable>
              </View>
            </View>
          </ScrollView>
        )}
      </SafeAreaView>
    </View>
  );
}

const styles = StyleSheet.create({
  closeButtonFloating: {
    backgroundColor: "#FFFFFF",
    borderColor: pagePalette.border,
    borderWidth: 0.85,
    elevation: 4,
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
    height: 36,
    width: 36,
  },
  copyButtonActive: {
    borderColor: pagePalette.border,
    borderWidth: 0.85,
    height: 36,
    width: 36,
  },
  groupBadgeInner: {
    alignItems: "center",
    backgroundColor: "#EAF7EF",
    borderRadius: 999,
    height: 46,
    justifyContent: "center",
    width: 46,
  },
  groupBadgeOuter: {
    alignItems: "center",
    backgroundColor: "rgba(243,252,247,0.92)",
    borderRadius: 999,
    height: 58,
    justifyContent: "center",
    width: 58,
  },
  heroGlow: {
    alignItems: "center",
    height: 188,
    justifyContent: "center",
    position: "absolute",
    top: 24,
    width: 316,
  },
  heroGlowFill: {
    borderRadius: 999,
    height: "100%",
    width: "100%",
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
  heroImageShell: {
    elevation: 9,
    shadowColor: "#EE97BC",
    shadowOffset: { width: 0, height: 22 },
    shadowOpacity: 0.24,
    shadowRadius: 28,
  },
  inviteCard: {
    backgroundColor: "#FFFFFF",
    borderColor: pagePalette.border,
    borderRadius: 28,
    borderWidth: 0.85,
    paddingHorizontal: 18,
    paddingVertical: 18,
  },
  primaryButton: {
    alignItems: "center",
    borderRadius: 20,
    height: 52,
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
    borderRadius: 20,
    height: 50,
    justifyContent: "center",
  },
  titleUnderline: {
    borderRadius: 999,
    height: 3,
    marginTop: 6,
    width: 38,
  },
  whiteButtonShadow: {
    elevation: 4,
    shadowColor: "#D5C2A1",
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.12,
    shadowRadius: 18,
  },
});
