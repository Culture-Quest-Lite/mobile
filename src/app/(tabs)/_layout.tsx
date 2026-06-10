import { Tabs } from "expo-router";
import { SymbolView } from "expo-symbols";
import { type ComponentProps } from "react";
import { type ColorValue, Image, Platform, Text, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

const PROFILE_LOGO = require("../../../assets/images/logo2.png");
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

const TAB_ICON_SLOT_SIZE = 32;

const TAB_CONFIG: Record<VisibleTabName, TabConfig> = {
  bookings: {
    icon: {
      ios: "doc.text",
      android: "description",
      web: "description",
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
      height: 32,
      overflow: "visible",
      width: 32,
    },
    imageResizeMode: "contain",
    imageSource: HOME_LOGO,
    imageStyle: {
      height: 44,
      width: 44,
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
      ios: "map",
      android: "map",
      web: "map",
    },
    label: "Hành trình",
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
              height: 22,
              justifyContent: "center",
              overflow: "hidden",
              width: 22,
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
        size={18}
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
      numberOfLines={2}
      style={{
        color: tintColor,
        fontSize: 10,
        fontWeight: focused ? "700" : "500",
        letterSpacing: -0.15,
        lineHeight: 11,
        textAlign: "center",
      }}
    >
      {label}
    </Text>
  );
}

export default function TabsLayout() {
  const insets = useSafeAreaInsets();
  const bottomInset = Platform.OS === "ios" ? insets.bottom : 0;
  const tabBarBottomPadding = Platform.OS === "ios" ? bottomInset + 23 : 23;
  const tabBarHeight = Platform.OS === "ios" ? 54 + tabBarBottomPadding : 77;

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
            borderRadius: 16,
            marginHorizontal: 4,
            overflow: "hidden",
            paddingVertical: 0,
          },
          tabBarLabel: tab
            ? ({ color, focused }) => renderTabLabel(tab.label, focused, color)
            : undefined,
          tabBarLabelPosition: "below-icon",
          tabBarStyle: {
            backgroundColor: "#FFFFFF",
            borderTopColor: "#E8EDF4",
            borderTopWidth: 1,
            elevation: 0,
            height: tabBarHeight,
            paddingBottom: tabBarBottomPadding,
            paddingHorizontal: 6,
            paddingTop: 6,
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
          title: "Đã lưu",
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
