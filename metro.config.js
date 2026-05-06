/**
 * Metro bundler configuration for Titan Protocol.
 *
 * Starts from the Expo default and layers on the bits expo-sqlite needs
 * for the web bundle to load. On native (Android/iOS), expo-sqlite uses
 * a JSI/C++ binding and these tweaks are no-ops; everything below only
 * matters when Metro is bundling for `web`.
 *
 * Without these, `expo start --web` failed at first import of
 * `src/db/sqlite/client.ts` because:
 *
 *   1. Metro's default `assetExts` doesn't include `wasm`, so the
 *      `wa-sqlite.wasm` artifact that expo-sqlite/web ships couldn't
 *      be bundled — every database call exploded on resolve.
 *
 *   2. expo-sqlite's web build runs in a Web Worker that uses
 *      `SharedArrayBuffer`. Browsers only expose SharedArrayBuffer to
 *      cross-origin-isolated documents, which requires the page to be
 *      served with `Cross-Origin-Opener-Policy: same-origin` and
 *      `Cross-Origin-Embedder-Policy: require-corp`. The dev server
 *      doesn't set those by default; we set them here so `npm run web`
 *      works locally. Production hosts (Vercel/Netlify/static CDN)
 *      must set the same headers in their own config — they are NOT
 *      baked into the bundle.
 */
const { getDefaultConfig } = require("expo/metro-config");

const config = getDefaultConfig(__dirname);

// (1) Bundle .wasm as an asset. Metro otherwise tries to parse it as
// JavaScript and fails. Native builds never reach a .wasm import so
// this is web-only in practice.
config.resolver.assetExts = [
  ...(config.resolver.assetExts ?? []),
  "wasm",
];

// (2) Cross-origin isolation for the dev server. Required for the
// SharedArrayBuffer used by expo-sqlite's wa-sqlite worker. Wrap (not
// replace) any existing middleware so future additions chain cleanly.
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
