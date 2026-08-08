import { Tabs, usePathname } from "expo-router";
import { SymbolView } from "@/components/ui/symbol-view";
import { type ComponentProps } from "react";
import { type ColorValue, Image, Platform, Text, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { useAuthSession } from "@/features/auth/hooks/use-auth-session";
import { lineHeightFor } from "@/lib/text-scale";

const HOME_LOGO = require("../../../assets/images/logo3.png");
const TAB_ACTIVE_COLOR = "#EC4899";
const TAB_INACTIVE_COLOR = "#8E919A";

type SymbolName = ComponentProps<typeof SymbolView>["name"];
type VisibleTabName = "bookings" | "explore" | "home" | "profile" | "saved";
type TabImageResizeMode = ComponentProps<typeof Image>["resizeMode"];
type TabImageSource = ComponentProps<typeof Image>["source"];
type TabImageStyle = ComponentProps<typeof Image>["style"];
type TabImageContainerStyle = ComponentProps<typeof View>["style"];

type TabConfig = {
  icon?: SymbolName;
  imageContainerStyle?: TabImageContainerStyle;
  imageResizeMode?: TabImageResizeMode;
  imageSource?: TabImageSource;
  imageStyle?: TabImageStyle;
  label: string;
};

const TAB_ICON_SLOT_SIZE = 28;
const TAB_ICON_RENDER_SIZE = 18;
const TAB_LABEL_FONT_SIZE = 12;
const TAB_LABEL_LINE_HEIGHT = lineHeightFor(TAB_LABEL_FONT_SIZE);

const TAB_CONFIG: Record<VisibleTabName, TabConfig> = {
  bookings: {
    icon: {
      ios: "bubble.left.and.bubble.right",
      android: "forum",
      web: "forum",
    },
    label: "Cộng đồng",
  },
  explore: {
    icon: {
      ios: "safari",
      android: "explore",
      web: "explore",
    },
    label: "Khám phá",
  },
  home: {
    imageContainerStyle: {
      backgroundColor: "transparent",
      borderRadius: 0,
      borderWidth: 0,
      height: 28,
      overflow: "visible",
      width: 28,
    },
    imageResizeMode: "contain",
    imageSource: HOME_LOGO,
    imageStyle: {
      height: 28,
      width: 28,
    },
    label: "Trang chủ",
  },
  profile: {
    icon: {
      ios: "person",
      android: "person",
      web: "person",
    },
    label: "Tài khoản",
  },
  saved: {
    icon: {
      ios: 'map.fill',
      android: 'map',
      web: 'map',
    },
    label: 'Hành trình',
  },
};

function isVisibleTabName(routeName: string): routeName is VisibleTabName {
  return routeName in TAB_CONFIG;
}

function renderTabIcon(tab: TabConfig, tintColor: ColorValue) {
  if (tab.imageSource) {
    return (
      <View
        style={{
          alignItems: "center",
          height: TAB_ICON_SLOT_SIZE,
          justifyContent: "center",
          width: TAB_ICON_SLOT_SIZE,
        }}
      >
        <View
          style={[
            {
              alignItems: "center",
              backgroundColor: "#FFF8F1",
              borderColor: "#E9E9EC",
              borderRadius: 11,
              borderWidth: 1,
              height: 20,
              justifyContent: "center",
              overflow: "hidden",
              width: 20,
            },
            tab.imageContainerStyle,
          ]}
        >
          <Image
            resizeMode={tab.imageResizeMode ?? "cover"}
            source={tab.imageSource}
            style={[{ height: "100%", width: "100%" }, tab.imageStyle]}
          />
        </View>
      </View>
    );
  }

  return (
    <View
      style={{
        alignItems: "center",
        height: TAB_ICON_SLOT_SIZE,
        justifyContent: "center",
        width: TAB_ICON_SLOT_SIZE,
      }}
    >
      <SymbolView
        name={tab.icon ?? { ios: "circle", android: "circle", web: "circle" }}
        size={TAB_ICON_RENDER_SIZE}
        tintColor={tintColor}
      />
    </View>
  );
}

function renderTabLabel(
  label: string,
  focused: boolean,
  tintColor: ColorValue,
) {
  return (
    <Text
      adjustsFontSizeToFit
      allowFontScaling
      maxFontSizeMultiplier={1.1}
      minimumFontScale={0.7}
      numberOfLines={1}
      style={{
        color: tintColor,
        fontSize: TAB_LABEL_FONT_SIZE,
        fontWeight: focused ? "700" : "500",
        includeFontPadding: false,
        letterSpacing: -0.1,
        lineHeight: TAB_LABEL_LINE_HEIGHT,
        textAlign: "center",
        width: "100%",
      }}
    >
      {label}
    </Text>
  );
}

export default function TabsLayout() {
  const authSession = useAuthSession();
  const insets = useSafeAreaInsets();
  const pathname = usePathname();
  const bottomInset = insets.bottom;
  const tabBarBottomPadding =
    Platform.OS === "android" ? bottomInset : bottomInset + 12;
  const tabBarHeight =
    Platform.OS === "android" ? 56 + bottomInset : 56 + tabBarBottomPadding + 8;
  const shouldHideTabBarForGuestProfile =
    !authSession.isAuthenticated && pathname === "/profile";

  return (
    <Tabs
      screenOptions={({ route }) => {
        const tab = isVisibleTabName(route.name)
          ? TAB_CONFIG[route.name]
          : null;

        return {
          headerShown: false,
          sceneStyle: {
            backgroundColor: "#F7F8FC",
          },
          tabBarActiveBackgroundColor: "transparent",
          tabBarActiveTintColor: TAB_ACTIVE_COLOR,
          tabBarHideOnKeyboard: true,
          tabBarIcon: tab
            ? ({ color }) => renderTabIcon(tab, color)
            : undefined,
          tabBarInactiveBackgroundColor: "transparent",
          tabBarInactiveTintColor: TAB_INACTIVE_COLOR,
          tabBarItemStyle: {
            borderRadius: 18,
            marginHorizontal: 0,
            minWidth: 0,
            overflow: "hidden",
            paddingVertical: Platform.OS === "android" ? 0 : 4,
          },
          tabBarLabel: tab
            ? ({ color, focused }) => renderTabLabel(tab.label, focused, color)
            : undefined,
          tabBarLabelPosition: "below-icon",
          tabBarStyle: shouldHideTabBarForGuestProfile
            ? {
                display: "none",
              }
              : {
                  backgroundColor: "#FFFFFF",
                  borderTopColor: "#E8EDF4",
                  borderTopWidth: 1,
                  elevation: 0,
                  height: tabBarHeight,
                  paddingBottom: tabBarBottomPadding,
                  paddingHorizontal: 4,
                  paddingTop: Platform.OS === "android" ? 1 : 6,
                  shadowColor: "#1F2A37",
                  shadowOffset: {
                    width: 0,
                    height: -4,
                  },
                  shadowOpacity: 0.04,
                  shadowRadius: 10,
                },
        };
      }}
    >
      <Tabs.Screen
        name="home"
        options={{
          title: "Trang chủ",
        }}
      />
      <Tabs.Screen
        name="explore"
        options={{
          title: "Explore",
        }}
      />
      <Tabs.Screen
        name="bookings"
        options={{
          title: "Đặt chỗ của tôi",
        }}
      />
      <Tabs.Screen
        name="saved"
        options={{
          title: 'Hành trình',
        }}
      />
      <Tabs.Screen
        name="route"
        options={{
          href: null,
        }}
      />
      <Tabs.Screen
        name="profile"
        options={{
          title: "Tài khoản",
        }}
      />
      <Tabs.Screen
        name="quests"
        options={{
          href: null,
        }}
      />
    </Tabs>
  );
}
