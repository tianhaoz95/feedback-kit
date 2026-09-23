# Security & Multi-Tenancy

FeedbackKit relies strictly on PostgreSQL **Row Level Security (RLS)** for data isolation and access control.

---

## Multi-Tenancy Model

FeedbackKit organizes data around **Organizations**, **Projects**, and **Feedback Items**:

```
 ┌────────────────┐
 │  auth.users    │ (Managed by Supabase Auth / GitHub OAuth)
 └───────┬────────┘
         │
         ▼
 ┌────────────────┐ 1:N ┌────────────────────────┐
 │ organizations  │─────│  organization_members  │ (user_id, org_id, role)
 └───────┬────────┘     └────────────────────────┘
         │ 1:N
         ▼
 ┌────────────────┐
 │    projects    │ (project_key, name, default_prompt_template)
 └───────┬────────┘
         │ 1:N
         ▼
 ┌────────────────┐
 │ feedback_items │ (text, screen_name, annotations, environment)
 └────────────────┘
```

### Tenancy Principles

1. **No Manual Client-Side Filtering**: Dashboard mutations and queries do not implement application-level tenancy checks. The Supabase client forwards the user's JWT, and PostgreSQL RLS filters all rows at the database engine level.
2. **Organization-Scoped Policies**: A user can only select, insert, update, or delete projects and feedback items if their `auth.uid()` appears in `organization_members` for that organization.
3. **Project API Keys**: Each project generates a public `project_key` (e.g. `fbk_live_...`). This key is baked into the client app bundle and is used solely to route incoming reports to the correct project.

---

## Authentication Boundaries

### 1. Ingestion Edge Function (`ingest-feedback`)
- **Anonymous Callers**: Incoming requests originate from mobile apps and desktop clients where embedding a secret database password or user token is unacceptable.
- **Service Role Bypass**: The Edge Function runs with `verify_jwt = false` in `supabase/config.toml`. It validates the `project_key`, resolves the matching project, uploads screenshots to the project storage bucket, and writes the `feedback_items` record using Supabase's `service_role` key.

### 2. Dashboard Access (`web/`)
- **GitHub OAuth Only**: User authentication is strictly GitHub OAuth (`supabase.auth.signInWithOAuth({ provider: "github" })`). Email/password registration is disabled.
- **Client-Side Auth**: The dashboard is a static SPA. Sessions are stored in `localStorage` and refreshed automatically by `@supabase/supabase-js`.

### 3. CLI & MCP Access (`cli/`)
- **Browser Handshake**: The CLI never asks users for passwords or master API keys. Instead, running `feedbackkit login` starts a temporary local HTTP server, opens the browser to `/cli-auth`, and receives the authenticated user's session JWT.
- **Auditable Sessions**: Every CLI authorization logs a record in `cli_sessions`, visible and revocable from the web dashboard.

---

## Storage Security Policies

Screenshots and diagnostics are stored in Supabase Storage under the `feedback-screenshots` bucket:

```
feedback-screenshots/
└── {project_id}/
    └── {feedback_id}/
        ├── raw.png
        ├── annotated.png
        └── attachment/
            └── diagnostic_log.txt
```

The storage RLS policy inspects the first path segment (`project_id`). Users can only generate signed URLs or read files if they belong to the organization owning that `project_id`.
