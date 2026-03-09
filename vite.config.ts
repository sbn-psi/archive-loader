/// <reference types="vitest/config" />
import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import path from "path";

export default defineConfig({
  root: "frontend",
  base: "/",
  plugins: [react()],
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "frontend/src"),
    },
  },
  build: {
    outDir: "dist",
    emptyOutDir: true,
  },
  server: {
    host: "127.0.0.1",
    port: 4173,
    proxy: {
      "/login": "http://127.0.0.1:8989",
      "/logout": "http://127.0.0.1:8989",
      "/user": "http://127.0.0.1:8989",
      "/status": "http://127.0.0.1:8989",
      "/tags": "http://127.0.0.1:8989",
      "/lookup": "http://127.0.0.1:8989",
      "/related": "http://127.0.0.1:8989",
      "/relationship-types": "http://127.0.0.1:8989",
      "/edit": "http://127.0.0.1:8989",
      "/save": "http://127.0.0.1:8989",
      "/delete": "http://127.0.0.1:8989",
      "/datasets": "http://127.0.0.1:8989",
      "/solr": "http://127.0.0.1:8989",
      "/image": "http://127.0.0.1:8989",
    },
  },
  test: {
    environment: "jsdom",
    setupFiles: ["./tests/setup.ts"],
    globals: true,
    include: ["tests/**/*.test.ts", "tests/**/*.test.tsx"],
    exclude: ["tests/e2e/**", "../node_modules/**", "../node_modules_bak/**"],
    coverage: {
      provider: "v8",
      reporter: ["text", "html"],
    },
  },
});
