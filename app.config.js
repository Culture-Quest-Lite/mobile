function readConfigString(value) {
  return typeof value === "string" ? value.trim() : "";
}

function readFirstDefinedEnv(...keys) {
  for (const key of keys) {
    const value = readConfigString(process.env[key]);

    if (value) {
      return value;
    }
  }

  return "";
}

module.exports = ({ config }) => {
  const expoConfig = config ?? {};

  const googleMapsApiKey = readFirstDefinedEnv(
    "GOOGLE_MAPS_API_KEY",
    "EXPO_PUBLIC_GOOGLE_MAPS_API_KEY"
  );

  const existingPlugins = Array.isArray(expoConfig.plugins)
  ? expoConfig.plugins
  : [];

const filteredPlugins = existingPlugins.filter((plugin) => {
  const pluginName =
    typeof plugin === "string"
      ? plugin
      : Array.isArray(plugin)
        ? plugin[0]
        : "";

  return pluginName !== "react-native-maps" && pluginName !== "expo-image";
});

const plugins = [
  ...filteredPlugins,

  "expo-image",

  ...(googleMapsApiKey
    ? [
        [
          "react-native-maps",
          {
            androidGoogleMapsApiKey: googleMapsApiKey,
            iosGoogleMapsApiKey: googleMapsApiKey,
          },
        ],
      ]
    : []),
];
  return {
    ...expoConfig,

    owner: "culture-quest-lite",
    slug: "anhphan",

    extra: {
      ...(expoConfig.extra ?? {}),
      eas: {
        ...(expoConfig.extra?.eas ?? {}),
        projectId: "2d579612-86f3-4c94-9171-67e4dbeca3e3",
      },
    },

    android: {
      ...expoConfig.android,
      config: googleMapsApiKey
        ? {
            ...(expoConfig.android?.config ?? {}),
            googleMaps: {
              apiKey: googleMapsApiKey,
            },
          }
        : expoConfig.android?.config,
    },

    ios: {
      ...expoConfig.ios,
      config: googleMapsApiKey
        ? {
            ...(expoConfig.ios?.config ?? {}),
            googleMapsApiKey,
          }
        : expoConfig.ios?.config,
    },

    plugins,
  };
};