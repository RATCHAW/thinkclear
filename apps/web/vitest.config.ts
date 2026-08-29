import { fileURLToPath, URL } from "node:url";
import tailwindcss from "@tailwindcss/vite";
import react from "@vitejs/plugin-react";
import { playwright } from "@vitest/browser-playwright";
import { defineConfig } from "vitest/config";

export default defineConfig({
  root: fileURLToPath(new URL(".", import.meta.url)),
  plugins: [react(), tailwindcss()],
  optimizeDeps: {
    include: [
      "react",
      "react-dom",
      "react-dom/client",
      "vitest-browser-react/pure",
    ],
  },
  resolve: {
    alias: {
      "@": fileURLToPath(new URL("./src", import.meta.url)),
      "@thinkclear/shared": fileURLToPath(
        new URL("../../packages/shared/src/index.ts", import.meta.url),
      ),
    },
  },
  test: {
    name: "web:e2e",
    include: ["test/**/*.e2e.test.tsx"],
    setupFiles: ["./test/setup.browser.ts"],
    browser: {
      enabled: true,
      headless: true,
      provider: playwright(),
      instances: [{ browser: "chromium" }],
      // Let the OS choose a free test-server port. Fixed ports collide when
      // several Conductor workspaces run their suites at the same time.
      api: { host: "127.0.0.1", port: 0 },
      viewport: { width: 1280, height: 800 },
    },
  },
});
