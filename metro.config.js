/**
 * Metro bundler configuration for Titan Protocol.
 *
 * Uses the Expo default config via `expo/metro-config`, which handles
 * asset extensions, TypeScript, SVG, source maps, and environment
 * variable inlining (EXPO_PUBLIC_*) out of the box.
 *
 * This file exists so Metro has a project-local config instead of
 * inferring defaults. Keep the config minimal — only wrap it if you
 * need to add custom transformers or asset extensions.
 */
const { getDefaultConfig } = require("expo/metro-config");

const config = getDefaultConfig(__dirname);

module.exports = config;
