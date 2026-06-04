// Minimal ESLint flat config. The old config depended on `eslint-config-next`
// which was removed (Next.js is no longer in the project). Replace with a
// richer config (typescript-eslint, react plugin, etc.) if/when lint becomes
// part of CI. TypeScript type-checking via `npx tsc --noEmit` is the active
// quality gate.

export default [
  {
    ignores: [
      "out/**",
      "dist/**",
      "node_modules/**",
      "public/sw.js",
      "public/workbox-*.js",
      "src-tauri/target/**",
      "src-tauri/gen/**",
    ],
  },
];
