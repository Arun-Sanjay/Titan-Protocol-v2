/**
 * Babel configuration for Titan Protocol (mobile-saas).
 *
 * Expo SDK 55 + React Native 0.83 + Reanimated 4 / react-native-worklets.
 *
 * `babel-preset-expo` already auto-detects `react-native-worklets` and adds
 * `react-native-worklets/plugin` for us. Don't add the plugin explicitly —
 * doing so would double-apply the transform and can crash workers.
 */
module.exports = function (api) {
  api.cache(true);
  return {
    presets: ["babel-preset-expo"],
  };
};
