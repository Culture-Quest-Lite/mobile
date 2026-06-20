const { withAndroidManifest } = require("expo/config-plugins");

module.exports = function withAndroidCleartextTraffic(config) {
  return withAndroidManifest(config, (config) => {
    const mainApplication = config.modResults.manifest.application?.[0];

    if (!mainApplication) {
      throw new Error("AndroidManifest.xml is missing the main application entry.");
    }

    mainApplication.$["android:usesCleartextTraffic"] = "true";

    return config;
  });
};
