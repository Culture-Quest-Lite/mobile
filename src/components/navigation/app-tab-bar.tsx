import { SymbolView } from "@/components/ui/symbol-view";
import { lineHeightFor } from "@/lib/text-scale";
import { type ComponentProps } from "react";
import { Image, Platform, Pressable, Text, View, type ColorValue } from "react-native";

const HOME_LOGO = require("../../../assets/images/logo3.png");

export type AppTabName = "bookings" | "explore" | "home" | "profile" | "saved";
type SymbolName = ComponentProps<typeof SymbolView>["name"];
type TabImageResizeMode = ComponentProps<typeof Image>["resizeMode"];
type TabImageSource = ComponentProps<typeof Image>["source"];
type TabImageStyle = ComponentProps<typeof Image>["style"];
type TabImageContainerStyle = ComponentProps<typeof View>["style"];

export type AppTabConfig = {
  icon?: SymbolName;
  imageContainerStyle?: TabImageContainerStyle;
  imageResizeMode?: TabImageResizeMode;
  imageSource?: TabImageSource;
  imageStyle?: TabImageStyle;
  label: string;
};

export const TAB_ACTIVE_COLOR = "#EC4899";
export const TAB_INACTIVE_COLOR = "#8E919A";
const TAB_ICON_SLOT_SIZE = 28;
const TAB_ICON_RENDER_SIZE = 18;
const TAB_LABEL_FONT_SIZE = 12;
const TAB_LABEL_LINE_HEIGHT = lineHeightFor(TAB_LABEL_FONT_SIZE);

export const APP_TAB_CONFIG: Record<AppTabName, AppTabConfig> = {
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
      ios: "map.fill",
      android: "map",
      web: "map",
    },
    label: "Hành trình",
  },
};

export const APP_TAB_ROUTES: Record<AppTabName, string> = {
  bookings: "/bookings",
  explore: "/explore",
  home: "/home",
  profile: "/profile",
  saved: "/saved",
};

export function isAppTabName(routeName: string): routeName is AppTabName {
  return routeName in APP_TAB_CONFIG;
}

export function renderAppTabIcon(
  tab: AppTabConfig,
  tintColor: ColorValue,
) {
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

export function renderAppTabLabel(
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

export function getAppTabBarStyle(bottomInset: number) {
  const tabBarBottomPadding =
    Platform.OS === "android" ? bottomInset : bottomInset + 12;
  const tabBarHeight =
    Platform.OS === "android" ? 56 + bottomInset : 56 + tabBarBottomPadding + 8;

  return {
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
  } as const;
}

export function AppTabBarPreview({
  activeTab,
  bottomInset,
  onPressTab,
}: {
  activeTab: AppTabName;
  bottomInset: number;
  onPressTab?: (tabName: AppTabName) => void;
}) {
  return (
    <View style={getAppTabBarStyle(bottomInset)}>
      <View className="flex-row">
        {(Object.keys(APP_TAB_CONFIG) as AppTabName[]).map((tabName) => {
          const tab = APP_TAB_CONFIG[tabName];
          const isActive = tabName === activeTab;
          const tintColor = isActive ? TAB_ACTIVE_COLOR : TAB_INACTIVE_COLOR;

          return (
            <Pressable
              key={tabName}
              className="flex-1 items-center justify-center"
              onPress={() => {
                onPressTab?.(tabName);
              }}
              style={{
                borderRadius: 18,
                marginHorizontal: 0,
                minWidth: 0,
                overflow: "hidden",
                paddingVertical: Platform.OS === "android" ? 0 : 4,
              }}
            >
              {renderAppTabIcon(tab, tintColor)}
              {renderAppTabLabel(tab.label, isActive, tintColor)}
            </Pressable>
          );
        })}
      </View>
    </View>
  );
}
