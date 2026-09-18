import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import tailwindcss from "@tailwindcss/vite";
import path from "node:path";

// https://vite.dev/config/
export default defineConfig(({ command }) => ({
  // GitHub Pages serves a project repo (not a *.github.io user/org page) at
  // /<repo-name>/, so production asset URLs need that prefix. Dev server
  // stays at root so `npm run dev` keeps working from http://localhost:3000.
  base: command === "build" ? "/feedback-kit/" : "/",
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
