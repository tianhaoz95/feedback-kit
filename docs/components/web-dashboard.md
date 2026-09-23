# Web Dashboard (`web/`)

The FeedbackKit dashboard is a client-side Single Page Application (SPA) built with modern frontend tools.

---

## Tech Stack

- **Framework**: React 19 + TypeScript
- **Bundler**: Vite 7
- **Routing**: React Router v7 (`BrowserRouter`)
- **Styling**: Tailwind CSS v4 (`@tailwindcss/vite`)
- **Backend Client**: `@supabase/supabase-js`

---

## Key Routes & Pages

| Route | Component | Access | Description |
|---|---|---|---|
| `/` | `LandingPage.tsx` | Public | Marketing landing page and feature highlights |
| `/login` | `LoginPage.tsx` | Public | GitHub OAuth sign-in |
| `/docs/*` | `DocsLayout.tsx` | Public | In-dashboard integration documentation |
| `/cli-auth` | `CliAuthPage.tsx` | Authenticated | Token exchange handshake for `feedbackkit login` |
| `/projects` | `ProjectsPage.tsx` | Protected | Organization projects list |
| `/projects/:id` | `ProjectPage.tsx` | Protected | Feedback inbox & filter view |
| `/projects/:id/feedback/:feedbackId` | `FeedbackDetailPage.tsx` | Protected | Annotated screenshot viewer & prompt generator |
| `/cli-sessions` | `CliSessionsPage.tsx` | Protected | Active CLI tokens and revocations |
| `/billing` | `BillingPage.tsx` | Protected | Plan and subscription management |

---

## Local Development

```bash
cd web
npm install
npm run dev      # Runs Vite dev server at http://localhost:3000
npm run test     # Runs Node test runner on unit tests
npm run lint     # Runs ESLint
npm run build    # Checks TypeScript types and builds production bundle
```

### Environment Variables

Create `web/.env.local` based on `.env.local.example`:

```bash
VITE_SUPABASE_URL=http://127.0.0.1:54321
VITE_SUPABASE_ANON_KEY=eyJhbGciOiJIUzI1...
```

When running against the local Supabase stack, `./scripts/start-web.sh` automatically configures this file.
