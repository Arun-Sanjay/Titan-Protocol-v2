/**
 * Phase 2.4F: Jest configuration.
 *
 * Uses jest-expo preset which handles React Native module mocking,
 * Reanimated, expo modules, and the rest of the native runtime
 * automatically.
 *
 * Test files live next to the code they cover under src/__tests__/
 * with `.test.ts` extension. Native-touching code (Reanimated worklets,
 * MMKV, Skia) is generally NOT unit-tested here — those need a real
 * device. We focus on pure-function logic: scoring, dates, streaks,
 * Zod schemas, the rank-up queue.
 */
module.exports = {
  preset: "jest-expo",
  testMatch: ["**/__tests__/**/*.test.ts", "**/__tests__/**/*.test.tsx"],
  // Phase 2.4F: legacy/ contains the frozen web app's old tests which
  // import from a different module graph (Dexie, Next.js, etc.) and
  // have nothing to do with mobile. Skip them.
  testPathIgnorePatterns: ["/node_modules/", "/legacy/", "/.expo/", "/android/"],
  transformIgnorePatterns: [
    "node_modules/(?!((jest-)?react-native|@react-native(-community)?|expo(nent)?|@expo(nent)?/.*|@expo-google-fonts/.*|react-navigation|@react-navigation/.*|@unimodules/.*|unimodules|sentry-expo|@sentry/.*|posthog-react-native|posthog-core|native-base|react-native-svg|@shopify/.*|react-native-mmkv|react-native-reanimated|@tanstack/.*))",
  ],
  moduleFileExtensions: ["ts", "tsx", "js", "jsx", "json"],
  setupFiles: [],
  // Phase 2.4F: only collect coverage from pure logic dirs. Stores and
  // components rely on RN runtime so they're excluded for now — they
  // get tested via on-device smoke testing instead.
  collectCoverageFrom: [
    "src/lib/**/*.ts",
    "!src/lib/**/*.d.ts",
  ],
};
