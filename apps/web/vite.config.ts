import { fileURLToPath, URL } from "node:url";
import tailwindcss from "@tailwindcss/vite";
import react from "@vitejs/plugin-react";
import { defineConfig } from "vite";

export default defineConfig({
  plugins: [react(), tailwindcss()],
  resolve: {
    alias: {
      "@": fileURLToPath(new URL("./src", import.meta.url)),
    },
  },
  server: {
    port: 5173,
    proxy: {
      "/api": {
        target: "http://localhost:3000",
      },
      // OAuth discovery is fixed at the origin root by RFC 9728 and RFC 8414,
      // so an MCP client looks for it here rather than under /api. The API
      // serves the documents; this origin is just where they have to appear.
      "/.well-known": {
        target: "http://localhost:3000",
      },
    },
  },
});
