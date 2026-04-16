/**
 * Metro bundler configuration for Titan Protocol.
 *
 * Extends Expo's default config to resolve the @titan/shared package
 * from the parent directory. This lets Metro follow the `file:../shared`
 * symlink and bundle shared TypeScript files alongside the mobile app.
 */
const { getDefaultConfig } = require("expo/metro-config");
const path = require("path");

const config = getDefaultConfig(__dirname);

// Tell Metro where to find @titan/shared (symlinked via file: dependency)
const sharedRoot = path.resolve(__dirname, "../shared");

// Watch the shared package for changes during development
config.watchFolders = [sharedRoot];

// Resolve modules from both mobile's node_modules and shared's node_modules
config.resolver.nodeModulesPaths = [
  path.resolve(__dirname, "node_modules"),
  path.resolve(sharedRoot, "node_modules"),
];

module.exports = config;
