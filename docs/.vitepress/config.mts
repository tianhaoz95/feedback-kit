import { defineConfig } from "vitepress";

export default defineConfig({
  title: "FeedbackKit Contributor Docs",
  description: "Developer guide, architecture notes, and contributor documentation for FeedbackKit",
  base: "/feedback-kit/",
  lastUpdated: true,
  themeConfig: {
    siteTitle: "FeedbackKit Docs",
    nav: [
      { text: "Guide", link: "/getting-started" },
      { text: "Architecture", link: "/architecture/overview" },
      { text: "Components", link: "/components/sdk" },
      { text: "Workflows", link: "/workflows/testing" },
      { text: "Live Dashboard", link: "https://feedback-kit.hejitech.workers.dev" },
      { text: "GitHub", link: "https://github.com/tianhaoz95/feedback-kit" },
    ],
    sidebar: [
      {
        text: "Getting Started",
        items: [
          { text: "Introduction", link: "/" },
          { text: "Developer Quickstart", link: "/getting-started" },
          { text: "Contributing Guidelines", link: "/workflows/contributing" },
        ],
      },
      {
        text: "Architecture & Design",
        items: [
          { text: "System Architecture", link: "/architecture/overview" },
          { text: "Wire Format & JSON Contracts", link: "/architecture/wire-format" },
          { text: "Security & Tenancy (RLS)", link: "/architecture/security-tenancy" },
          { text: "Annotation Geometry & Drawing", link: "/architecture/annotations-drawing" },
        ],
      },
      {
        text: "Components",
        items: [
          { text: "Swift SDK (iOS, macOS, watchOS)", link: "/components/sdk" },
          { text: "Demo Applications", link: "/components/demo-apps" },
          { text: "Web Dashboard (React SPA)", link: "/components/web-dashboard" },
          { text: "Cloudflare Deployment", link: "/components/cloudflare" },
          { text: "Supabase & Edge Functions", link: "/components/supabase" },
          { text: "CLI & MCP Server", link: "/components/cli-mcp" },
          { text: "Agent Skills Catalog", link: "/components/agent-skills" },
        ],
      },
      {
        text: "Development & CI/CD",
        items: [
          { text: "Testing Matrix", link: "/workflows/testing" },
          { text: "CI/CD & Automation", link: "/workflows/ci-cd" },
        ],
      },
    ],
    socialLinks: [
      { icon: "github", link: "https://github.com/tianhaoz95/feedback-kit" },
    ],
    search: {
      provider: "local",
    },
    footer: {
      message: "FeedbackKit Contributor & Developer Documentation",
      copyright: "Copyright © 2026 FeedbackKit Contributors",
    },
    editLink: {
      pattern: "https://github.com/tianhaoz95/feedback-kit/edit/main/docs/:path",
      text: "Edit this page on GitHub",
    },
  },
});
