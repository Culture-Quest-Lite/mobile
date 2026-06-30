import 'dotenv/config';

export default {
  expo: {
    name: "Trải nghiệm cùng chúng tôi",
    slug: "Culture_quest_lite_mobile",
    version: "1.0.0",
    orientation: "portrait",
    icon: "./assets/images/logo2-app-icon-v2.png",
    scheme: "culturequestlitemobile",
    userInterfaceStyle: "automatic",

    ios: {
      icon: "./assets/images/logo2-app-icon-v2.png",
    },

    android: {
      package: "com.anonymous.Culture_quest_lite_mobile",
      icon: "./assets/images/logo2-app-icon-v2.png",
      adaptiveIcon: {
        backgroundColor: "#FFFFFF",
        foregroundImage: "./assets/images/logo2-adaptive-foreground.png",
      },
      predictiveBackGestureEnabled: false,
      config: {
        googleMaps: {
          apiKey: process.env.EXPO_PUBLIC_GOOGLE_MAPS_API_KEY,
        },
      },
    },

    web: {
      bundler: "metro",
      output: "static",
      favicon: "./assets/images/favicon.png",
    },

    plugins: [
      "expo-router",
      "./plugins/with-android-cleartext-traffic",
      [
        "expo-splash-screen",
        {
          backgroundColor: "#FFFFFF",
          image: "./assets/images/logo2-cropped.png",
          imageWidth: 320,
          resizeMode: "contain",
        },
      ],
      [
        "expo-location",
        {
          locationWhenInUsePermission:
            "Cho phép Culture Quest truy cập vị trí của bạn để xác minh check-in gần hotspot.",
        },
      ],
    ],

    experiments: {
      typedRoutes: true,
      reactCompiler: true,
    },

    extra: {
      goongApiKey: process.env.EXPO_PUBLIC_GOONG_API_KEY,
    },
  },
};