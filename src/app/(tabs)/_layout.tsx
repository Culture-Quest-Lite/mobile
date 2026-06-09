import { Tabs } from 'expo-router';
import { SymbolView } from 'expo-symbols';
import { type ComponentProps } from 'react';
import { Image, Platform, Pressable, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

const APP_LOGO = require('../../../assets/images/logo2.png');

type SymbolName = ComponentProps<typeof SymbolView>['name'];
type VisibleTabName = 'bookings' | 'explore' | 'home' | 'profile' | 'saved';

type TabConfig = {
  icon?: SymbolName;
  label: string;
  usesLogo?: boolean;
};

type TabBarButtonProps = {
  accessibilityState?: {
    selected?: boolean;
  };
  onLongPress?: ComponentProps<typeof Pressable>['onLongPress'];
  onPress?: ComponentProps<typeof Pressable>['onPress'];
};

const TAB_CONFIG: Record<VisibleTabName, TabConfig> = {
  bookings: {
    icon: {
      ios: 'doc.text',
      android: 'description',
      web: 'description',
    },
    label: 'Đặt chỗ của tôi',
  },
  explore: {
    icon: {
      ios: 'safari',
      android: 'explore',
      web: 'explore',
    },
    label: 'Explore',
  },
  home: {
    icon: {
      ios: 'house.fill',
      android: 'home',
      web: 'home',
    },
    label: 'Trang chủ',
  },
  profile: {
    label: 'Tài khoản',
    usesLogo: true,
  },
  saved: {
    icon: {
      ios: 'bookmark',
      android: 'bookmark',
      web: 'bookmark',
    },
    label: 'Đã lưu',
  },
};

function isVisibleTabName(routeName: string): routeName is VisibleTabName {
  return routeName in TAB_CONFIG;
}

function BottomTabButton({
  accessibilityState,
  icon,
  label,
  onLongPress,
  onPress,
  usesLogo,
}: TabConfig & TabBarButtonProps) {
  const focused = accessibilityState?.selected === true;
  const tintColor = focused ? '#1F8FFF' : '#8E919A';

  return (
    <Pressable
      accessibilityRole="button"
      accessibilityState={accessibilityState}
      className="flex-1 items-center justify-center"
      hitSlop={6}
      onLongPress={onLongPress}
      onPress={onPress}
    >
      <View
        className="items-center justify-center"
        style={{
          backgroundColor: focused ? '#E9F5FF' : 'transparent',
          borderRadius: 10,
          gap: 1,
          maxWidth: 76,
          minHeight: 36,
          paddingHorizontal: 8,
          paddingVertical: 2,
        }}
      >
        {usesLogo ? (
          <View
            style={{
              backgroundColor: '#FFF8F1',
              borderColor: focused ? '#A6D2FF' : '#E9E9EC',
              borderRadius: 11,
              borderWidth: focused ? 1.5 : 1,
              height: 22,
              overflow: 'hidden',
              width: 22,
            }}
          >
            <Image
              resizeMode="cover"
              source={APP_LOGO}
              style={{ height: '100%', width: '100%' }}
            />
          </View>
        ) : (
          <SymbolView
            name={icon ?? { ios: 'circle', android: 'circle', web: 'circle' }}
            size={18}
            tintColor={tintColor}
          />
        )}

        <Text
          numberOfLines={2}
          style={{
            color: tintColor,
            fontSize: 10,
            fontWeight: focused ? '700' : '500',
            letterSpacing: -0.15,
            lineHeight: 11,
            textAlign: 'center',
          }}
        >
          {label}
        </Text>
      </View>
    </Pressable>
  );
}

export default function TabsLayout() {
  const insets = useSafeAreaInsets();
  const bottomInset = Platform.OS === 'ios' ? insets.bottom : 0;

  return (
    <Tabs
      screenOptions={({ route }) => {
        const tab = isVisibleTabName(route.name) ? TAB_CONFIG[route.name] : null;

        return {
          headerShown: false,
          sceneStyle: {
            backgroundColor: '#F7F8FC',
          },
          tabBarButton: tab ? (props) => <BottomTabButton {...props} {...tab} /> : undefined,
          tabBarHideOnKeyboard: true,
          tabBarShowLabel: false,
          tabBarStyle: {
            backgroundColor: '#FFFFFF',
            borderTopColor: '#E8EDF4',
            borderTopWidth: 1,
            elevation: 0,
            height: 50 + bottomInset,
            paddingBottom: Math.max(bottomInset, 4),
            paddingHorizontal: 6,
            paddingTop: 0,
            shadowColor: '#1F2A37',
            shadowOffset: {
              width: 0,
              height: -4,
            },
            shadowOpacity: 0.04,
            shadowRadius: 10,
          },
          tabBarItemStyle: {
            marginHorizontal: 1,
            paddingVertical: 0,
          },
        };
      }}
    >
      <Tabs.Screen
        name="home"
        options={{
          title: 'Trang chủ',
        }}
      />
      <Tabs.Screen
        name="explore"
        options={{
          title: 'Explore',
        }}
      />
      <Tabs.Screen
        name="bookings"
        options={{
          title: 'Đặt chỗ của tôi',
        }}
      />
      <Tabs.Screen
        name="saved"
        options={{
          title: 'Đã lưu',
        }}
      />
      <Tabs.Screen
        name="profile"
        options={{
          title: 'Tài khoản',
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
