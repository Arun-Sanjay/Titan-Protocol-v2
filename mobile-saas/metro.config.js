/**
 * Metro bundler configuration for Titan Protocol (mobile-saas).
 *
 * Starts from the Expo default and layers on the bits expo-sqlite needs
 * for the web bundle to load. On native (Android/iOS), expo-sqlite uses
 * a JSI/C++ binding and these tweaks are no-ops; the .wasm asset
 * extension and cross-origin headers only matter when Metro is bundling
 * for `web`. Mobile-saas is mobile-only today, but the bits below stay
 * here in case web ever lights up.
 */
const { getDefaultConfig } = require("expo/metro-config");

const config = getDefaultConfig(__dirname);

config.resolver.assetExts = [
  ...(config.resolver.assetExts ?? []),
  "wasm",
];

const previousEnhance = config.server?.enhanceMiddleware;
config.server = {
  ...config.server,
  enhanceMiddleware: (middleware, server) => {
    const upstream = previousEnhance ? previousEnhance(middleware, server) : middleware;
    return (req, res, next) => {
      res.setHeader("Cross-Origin-Opener-Policy", "same-origin");
      res.setHeader("Cross-Origin-Embedder-Policy", "require-corp");
      upstream(req, res, next);
    };
  },
};

module.exports = config;
