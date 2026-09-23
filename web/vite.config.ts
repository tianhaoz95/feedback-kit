import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import tailwindcss from "@tailwindcss/vite";
import path from "node:path";

// https://vite.dev/config/
export default defineConfig(({ command }) => ({
  // GitHub Pages serves a project repo at /<repo-name>/, so production builds
  // in GitHub Actions need that prefix unless overridden. On Cloudflare or
  // other root-domain hosts, base defaults to "/". Dev server stays at root "/".
  base:
    process.env.VITE_BASE_PATH ??
    (command === "build" && process.env.GITHUB_ACTIONS ? "/feedback-kit/" : "/"),
  plugins: [react(), tailwindcss()],
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "./src"),
    },
  },
  server: {
    port: 3000,
  },
  preview: {
    port: 3000,
  },
}));
