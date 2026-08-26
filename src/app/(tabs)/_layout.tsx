import { Tabs, usePathname } from "expo-router";
import { Platform } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import {
  APP_TAB_CONFIG,
  getAppTabBarStyle,
  isAppTabName,
  renderAppTabIcon,
  renderAppTabLabel,
  TAB_ACTIVE_COLOR,
  TAB_INACTIVE_COLOR,
} from "@/components/navigation/app-tab-bar";
import { useAuthSession } from "@/features/auth/hooks/use-auth-session";

export default function TabsLayout() {
  const authSession = useAuthSession();
  const insets = useSafeAreaInsets();
  const pathname = usePathname();
  const bottomInset = insets.bottom;
  const shouldHideTabBarForGuestProfile =
    !authSession.isAuthenticated && pathname === "/profile";

  return (
    <Tabs
      screenOptions={({ route }) => {
        const tab = isAppTabName(route.name)
          ? APP_TAB_CONFIG[route.name]
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
            ? ({ color }) => renderAppTabIcon(tab, color)
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
            ? ({ color, focused }) =>
                renderAppTabLabel(tab.label, focused, color)
            : undefined,
          tabBarLabelPosition: "below-icon",
          tabBarStyle: shouldHideTabBarForGuestProfile
            ? {
                display: "none",
              }
              : getAppTabBarStyle(bottomInset),
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
