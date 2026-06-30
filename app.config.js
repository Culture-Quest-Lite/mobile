const appJson = require("./app.json");

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

const expoConfig = appJson.expo ?? {};
// Expo SDK 56 only inlines EXPO_PUBLIC_* into app code. Native config can still
// read regular .env keys here, so keep the non-public key name as the primary source.
const googleMapsApiKey = readFirstDefinedEnv(
  "GOOGLE_MAPS_API_KEY",
  "EXPO_PUBLIC_GOOGLE_MAPS_API_KEY",
);
const existingPlugins = Array.isArray(expoConfig.plugins) ? expoConfig.plugins : [];
const filteredPlugins = existingPlugins.filter((plugin) => {
  if (typeof plugin === "string") {
    return plugin !== "react-native-maps";
  }

  return !Array.isArray(plugin) || plugin[0] !== "react-native-maps";
});

const plugins = googleMapsApiKey
  ? [
      ...filteredPlugins,
      [
        "react-native-maps",
        {
          androidGoogleMapsApiKey: googleMapsApiKey,
          iosGoogleMapsApiKey: googleMapsApiKey,
        },
      ],
    ]
  : filteredPlugins;

module.exports = {
  ...appJson,
  expo: {
    ...expoConfig,
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
  },
};
