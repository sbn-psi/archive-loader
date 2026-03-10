/// <reference types="vitest/config" />
import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import path from "path";
import { loadEnv } from "vite";

function normalizeBasePath(value?: string) {
  const normalized = String(value ?? "").replace(/^\/+|\/+$/g, "");
  return normalized ? `/${normalized}` : "";
}

export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), "");
  const appBasePath = normalizeBasePath(env.APP_BASE_PATH);
  const viteBase = appBasePath ? `${appBasePath}/` : "/";
  const apiProxyPath = `${appBasePath}/api`;

  return {
    root: "frontend",
    base: viteBase,
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
        [apiProxyPath]: "http://127.0.0.1:8989",
        ...(apiProxyPath !== "/api" ? { "/api": "http://127.0.0.1:8989" } : {}),
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
  };
});
