import { defineConfig } from "vite";
import { fileURLToPath } from "node:url";

const here = (path: string) => fileURLToPath(new URL(path, import.meta.url));

// The web SDK and the shared demo UI come from source in this repo, like the
// dashboard's own dogfooding, so a change to either is testable here at once.
export default defineConfig({
  base: "./",
  resolve: {
    alias: {
      "feedbackkit-web": here("../../web-sdk/src/index.ts"),
      "feedbackkit-desktop-demo-ui": here("../demo-ui/src/index.ts"),
    },
    dedupe: ["modern-screenshot"],
  },
  build: { outDir: "dist", emptyOutDir: true },
});
