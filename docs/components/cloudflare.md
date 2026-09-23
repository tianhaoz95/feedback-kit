# Cloudflare Deployment

The FeedbackKit web dashboard is deployed globally using **Cloudflare Workers Static Assets**.

---

## Migration Architecture

Previously, the dashboard was deployed as a subpath on GitHub Pages (`https://tianhaoz95.github.io/feedback-kit/`). It has now been migrated to Cloudflare at:

```
https://feedback-kit.hejitech.workers.dev
```

### Why Cloudflare Workers Static Assets?
1. **Global Edge Caching**: Assets are served from Cloudflare's worldwide CDN with microsecond latencies.
2. **First-Class SPA Routing**: Built-in support for single-page application fallback without requiring custom 404 hacks.
3. **Automated Git CI/CD**: Pushes to `main` trigger automated builds on Cloudflare.

---

## Configuration: `wrangler.jsonc`

The repository root includes a `wrangler.jsonc` file configured for static asset hosting:

```jsonc
{
  "$schema": "node_modules/wrangler/config-schema.json",
  "name": "feedback-kit",
  "compatibility_date": "2024-09-23",
  "assets": {
    "directory": "./web/dist",
    "not_found_handling": "single-page-application"
  }
}
```

### Critical Settings
- **`directory`**: Points to `./web/dist`, where `vite build` places static artifacts.
- **`not_found_handling: "single-page-application"`**: Direct navigation or page refreshes on subroutes (e.g. `/projects`, `/login`) fall back to `index.html` rather than returning a 404 status.
- **`compatibility_date`**: Required by Cloudflare Wrangler to freeze runtime behavior.

---

## Cloudflare Build Settings

In the Cloudflare Dashboard under your connected project:

| Field | Value |
|---|---|
| **Build command** | `cd web && npm ci && npm run build` |
| **Deploy command** | `npx wrangler deploy` |
| **Preview command**| `npx wrangler preview` |

### Environment Variables
Configure under **Settings → Variables and Secrets**:

- `VITE_SUPABASE_URL`: Production Supabase URL (`https://gpucoladcyvijefdjudf.supabase.co`)
- `VITE_SUPABASE_ANON_KEY`: Production Supabase public publishable key

---

## Dynamic Vite Base Path

In `web/vite.config.ts`, the base path dynamically detects the deployment environment:

```typescript
base:
  process.env.VITE_BASE_PATH ??
  (command === "build" && process.env.GITHUB_ACTIONS ? "/feedback-kit/" : "/"),
```

- On **Cloudflare**, `GITHUB_ACTIONS` is not set, so `base` defaults to `"/"`.
- In **GitHub Actions** (when deploying docs to GitHub Pages), `base` defaults to `"/feedback-kit/"`.
