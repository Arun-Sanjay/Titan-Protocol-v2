import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import path from "path";

export default defineConfig({
  plugins: [react()],
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "src"),
      "@titan/shared": path.resolve(__dirname, "../shared"),
    },
    // Resolve symlinked @titan/shared properly
    preserveSymlinks: false,
  },
  // sqlite-wasm ships its own Web Worker + .wasm binary; Vite's dep
  // pre-bundler breaks the worker's relative-path resolution, so exclude
  // it and let it load as an ESM module at runtime.
  optimizeDeps: {
    exclude: ["@sqlite.org/sqlite-wasm"],
  },
  build: {
    outDir: "out",
    emptyOutDir: true,
  },
  server: {
    port: 3000,
    strictPort: true,
  },
});
