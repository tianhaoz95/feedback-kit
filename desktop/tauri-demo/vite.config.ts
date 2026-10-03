import { defineConfig } from "vite";
import { fileURLToPath } from "node:url";

const here = (path: string) => fileURLToPath(new URL(path, import.meta.url));

// The web SDK, feedbackkit-tauri and the shared demo UI come from source in
// this repo, so a change to any of them is testable here at once.
export default defineConfig({
  clearScreen: false,
  server: { port: 1420, strictPort: true },
  resolve: {
    alias: {
      "feedbackkit-web": here("../../web-sdk/src/index.ts"),
      "feedbackkit-tauri": here("../tauri/guest-js/src/index.ts"),
      "feedbackkit-desktop-demo-ui": here("../demo-ui/src/index.ts"),
    },
    dedupe: ["modern-screenshot", "@tauri-apps/api"],
  },
  build: { outDir: "dist", emptyOutDir: true, target: "es2022" },
});
