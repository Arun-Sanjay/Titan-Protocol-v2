/**
 * Babel configuration for Titan Protocol.
 *
 * Expo SDK 55 + React Native 0.83 + Reanimated 4 / react-native-worklets.
 *
 * `babel-preset-expo` already auto-detects `react-native-worklets` and adds
 * `react-native-worklets/plugin` for us (verified in
 * node_modules/expo/node_modules/babel-preset-expo/build/index.js:313-320).
 * So we don't add the plugin explicitly here — doing so would double-apply
 * the transform and can crash workers.
 *
 * This file exists primarily so Metro and Jest see a project-local config
 * instead of falling back to preset defaults by coincidence. The Expo
 * auto-detection only fires when babel-preset-expo is actually applied, so
 * we need a config that applies it at the project root.
 */
module.exports = function (api) {
  api.cache(true);
  return {
    presets: ["babel-preset-expo"],
  };
};
