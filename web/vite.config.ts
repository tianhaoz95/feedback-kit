import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import tailwindcss from "@tailwindcss/vite";
import path from "node:path";
import { execSync } from "node:child_process";
import { readFileSync } from "node:fs";

// Version/build stamped into the dashboard's own feedback reports (see
// src/lib/feedbackkit.ts). Cloudflare's Workers Builds exposes the commit as
// WORKERS_CI_COMMIT_SHA; locally fall back to git, then to nothing.
function commitSha(): string {
  const fromCi = process.env.WORKERS_CI_COMMIT_SHA ?? process.env.GITHUB_SHA;
  if (fromCi) return fromCi.slice(0, 7);
  try {
    return execSync("git rev-parse --short HEAD", { stdio: ["ignore", "pipe", "ignore"] }).toString().trim();
  } catch {
    return "";
  }
}
const pkg = JSON.parse(readFileSync(new URL("./package.json", import.meta.url), "utf8")) as { version: string };

// https://vite.dev/config/
export default defineConfig(({ command }) => ({
  // GitHub Pages serves a project repo at /<repo-name>/, so production builds
  // in GitHub Actions need that prefix unless overridden. On Cloudflare or
  // other root-domain hosts, base defaults to "/". Dev server stays at root "/".
  base:
    process.env.VITE_BASE_PATH ??
    (command === "build" && process.env.GITHUB_ACTIONS ? "/feedback-kit/" : "/"),
  plugins: [react(), tailwindcss()],
  define: {
    __APP_VERSION__: JSON.stringify(pkg.version),
    __APP_COMMIT__: JSON.stringify(commitSha()),
  },
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "./src"),
      // The dashboard dogfoods the web SDK straight from source (../web-sdk)
      // rather than from npm, so an SDK change is exercised here in the same
      // commit — see web-sdk/README.md. `dedupe` makes the SDK's own
      // `modern-screenshot` import resolve from web/node_modules, so a build
      // never needs web-sdk/node_modules installed.
      "feedbackkit-web": path.resolve(__dirname, "../web-sdk/src/index.ts"),
    },
    dedupe: ["modern-screenshot"],
  },
  server: {
    port: 3000,
    fs: {
      allow: [".", "../web-sdk"],
    },
  },
  preview: {
    port: 3000,
  },
}));
