# Supabase & Backend Architecture

FeedbackKit uses Supabase for PostgreSQL, Storage, Authentication, and Edge Functions.

---

## Local Development Stack

Running Supabase locally requires Docker Desktop:

```bash
# Start local Supabase containers
supabase start

# Inspect credentials and service endpoints
supabase status -o env

# Reset database and re-apply all migrations from scratch
supabase db reset

# Stop local stack
supabase stop
```

Local Supabase Studio is accessible at: [http://127.0.0.1:54323](http://127.0.0.1:54323).

---

## Database Migrations

Migrations are stored in `supabase/migrations/` and executed sequentially:

1. `0001_init.sql`: Core schema (`organizations`, `projects`, `feedback_items`, RLS policies).
2. `0002_storage.sql`: Storage bucket policies for `feedback-screenshots`.
3. `0003_defaults.sql`: Default prompt templates per project.
4. `0004_fix_membership_recursion.sql`: Non-recursive RLS policy optimization.
5. `0005_project_key_salt.sql`: Cryptographic salting for project keys.
6. `0006_attachment.sql`: Diagnostic file attachments support.
7. `0007_cli_sessions.sql`: CLI token sessions tracking.
8. `0008_optional_screenshot.sql`: Nullable screenshots for pure-text bug reports.
9. `0009_billing.sql`: Stripe billing schema and customer metadata.

::: warning Migration Rule
Never edit an existing migration file in-place once it has been applied to the remote project. Always create a new sequentially numbered migration file (e.g. `0010_my_change.sql`).
:::

---

## Edge Functions

Edge Functions run on Deno and TypeScript:

### 1. `ingest-feedback`
- **Authentication**: `verify_jwt = false`. The caller is an anonymous iOS/macOS client identified by `project_key`.
- **Logic**: Resolves project, checks rate limits, writes raw/annotated screenshots to storage, and writes `feedback_items`.

### 2. `create-github-issue`
- **Authentication**: Caller's JWT required.
- **Logic**: Uses a GitHub App token or user token to create an issue on GitHub populated with formatted diagnostics, screenshot links, and coding agent prompts.

### 3. Billing Functions
- `create-checkout-session`: Generates Stripe Checkout session.
- `create-portal-session`: Generates Stripe Customer Portal session.
- `stripe-webhook`: Verifies `Stripe-Signature` and synchronizes customer plan status.
