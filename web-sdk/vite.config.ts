import { defineConfig } from "vite";

// Two builds of the same entry:
//  - `feedbackkit.js` (ESM) for bundlers — `modern-screenshot` stays an
//    external dependency so the host app's bundler dedupes/tree-shakes it.
//  - `feedbackkit.iife.js` for a plain `<script>` tag from a CDN — fully
//    self-contained, exposing `window.FeedbackKit`.
// Vite library mode can't mix "external" and "bundled" across formats in one
// pass, so the IIFE build runs as a second config via `vite build --mode iife`
// (a mode rather than an env var so the build script works in Windows' cmd too).

export default defineConfig(({ mode }) => {
  const iife = mode === "iife";
  return {
    build: {
      target: "es2020",
      outDir: "dist",
      emptyOutDir: !iife,
      sourcemap: true,
      minify: iife ? "esbuild" : false,
      lib: {
        entry: iife ? "src/global.ts" : "src/index.ts",
        name: "FeedbackKit",
        formats: iife ? ["iife"] : ["es"],
        fileName: () => (iife ? "feedbackkit.iife.js" : "feedbackkit.js"),
      },
      rollupOptions: iife
        ? { output: { inlineDynamicImports: true } }
        : { external: ["modern-screenshot"] },
    },
  };
});
