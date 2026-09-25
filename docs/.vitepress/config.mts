import { defineConfig } from "vitepress";

export default defineConfig({
  title: "FeedbackKit",
  description: "Developer guide, architecture notes, and contributor documentation for FeedbackKit",
  base: "/feedback-kit/",
  lastUpdated: true,
  head: [
    ["link", { rel: "icon", type: "image/svg+xml", href: "/feedback-kit/logo.svg" }],
    ["link", { rel: "icon", type: "image/png", href: "/feedback-kit/logo.png" }],
    ["meta", { name: "theme-color", content: "#171717" }],
    ["meta", { property: "og:type", content: "website" }],
    ["meta", { property: "og:title", content: "FeedbackKit — Contributor Docs" }],
    ["meta", { property: "og:description", content: "Architecture, component guides, and development workflows for contributing to FeedbackKit" }],
  ],
  themeConfig: {
    siteTitle: "FeedbackKit",
    logo: "/logo.svg",
    nav: [
      { text: "Guide", link: "/getting-started" },
      { text: "Architecture", link: "/architecture/overview" },
      { text: "Components", link: "/components/sdk" },
      { text: "Workflows", link: "/workflows/testing" },
      { text: "Live Dashboard", link: "https://feedback-kit.hejitech.workers.dev/" },
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
          { text: "Web SDK", link: "/components/web-sdk" },
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
      message: "Built with VitePress · FeedbackKit is open source",
      copyright: "Copyright © 2026 FeedbackKit Contributors",
    },
    editLink: {
      pattern: "https://github.com/tianhaoz95/feedback-kit/edit/main/docs/:path",
      text: "Edit this page on GitHub",
    },
  },
});
