# The Closed Loop

How a report travels from a user's device, through a coding agent, into a build — and back to the same user to confirm the fix. Design rationale lives in `DESIGN.md` §7; this page is the contributor's map.

---

## The flow

```
SDK report (+ reporter_id)  →  dashboard / MCP  →  agent: claim · ask · fix · after-shot
        ↑                                                ↓   PR description "FeedbackKit: <id>"
reporter's device  ←  reporter-updates  ←  feedbackkit release  ←  merged (github-webhook)
  "is it fixed?"  →  verified   |   still broken (+ new screenshot) → reopened → re-dispatched
```

## Fix stages

`feedback_items.fix_stage` (checked text, `0014_closed_loop.sql`) — kept **separate from `status`** because shipped Portal builds decode `status` strictly.

| `fix_stage` | Set by | `status` becomes |
|---|---|---|
| `agent_working` | MCP `claim_feedback`, dispatch in `create-github-issue` | `in_progress` |
| `pr_open` | `github-webhook` (PR opened), MCP/CLI `link_fix` | `in_progress` |
| `merged` | `github-webhook` (PR merged), `link_fix` with a commit | `in_progress` |
| `shipped` | `record_release` RPC via `feedbackkit release` | `in_progress` |
| `verified` | `reporter-updates` (reporter taps "Yes, it's fixed") | `resolved` |
| `reopened` | `reporter-updates` (reporter taps "Still broken") | `in_progress` |

`wont_fix` is never overridden.

## Where each piece lives

| Piece | Path |
|---|---|
| Schema, RLS, `compare_builds`, `record_release` | `supabase/migrations/0014_closed_loop.sql` |
| Reporter-facing API (anonymous, `project_key` + `reporter_id`) | `supabase/functions/reporter-updates/` |
| PR tracking, signature verification | `supabase/functions/github-webhook/` |
| Agent dispatch (labels / trigger comment) | `supabase/functions/_shared/github.ts` `dispatchIssueToAgent` |
| Agent MCP tools, `release`/`link`/`timeline` | `cli/src/loop.ts`, `cli/src/mcp/server.ts`, `cli/src/commands/` |
| Swift SDK: identity, transport, card | `Model/FeedbackReporterIdentity.swift`, `Networking/FixUpdatesClient.swift`, `UI/FixVerification*.swift` |
| Web SDK: identity, transport, card | `web-sdk/src/fixes.ts`, `web-sdk/src/ui/fixCard.ts` |
| Dashboard | `web/src/components/FixLoopPanel.tsx`, `AgentDispatchCard.tsx` |
| Portal | `DeveloperApp/Sources/Views/Detail/FixLoopSectionView.swift` |
| Agent Skill | `skills/workflow/fix-feedback/SKILL.md` |

## Keep in sync by hand

- **Build ordering** — `compare_builds` in SQL, `_shared/builds.ts`, `cli/src/loop.ts`, `FeedbackBuild.compare` (Swift), `compareBuilds` (web SDK).
- **reporter-updates wire format** — the Edge Function, `FixUpdatesClient.swift`, `web-sdk/src/fixes.ts`.
- **Event kinds** — the `feedback_events.kind` check constraint, `FeedbackEventKind` in `web/src/lib/types.ts` and `cli/src/types.ts`, labels in `FixLoopPanel.tsx` and `PortalFeedbackEvent.title`.

## Security notes

- `feedback_events` insert policy: members only, `actor_type ∈ {user, agent}`, `actor_user_id = auth.uid()`. Reporter/GitHub/system events are written only by Edge Functions with the service role. No update/delete policy — it's an audit trail.
- `reporter-updates` only ever touches rows matching **both** the project key and the reporter id, rate-limits reporter writes per project, and honours `allowed_origins`.
- `github-webhook` rejects every delivery unless `GITHUB_WEBHOOK_SECRET` is set and the HMAC matches, and scopes matches to the delivery's `repository.full_name`.

## Testing

```bash
supabase start && supabase db reset
echo GITHUB_WEBHOOK_SECRET=testsecret > /tmp/fk.env
supabase functions serve --env-file /tmp/fk.env     # another terminal
cd cli && npm run build && node --test test/closed-loop.integration.mjs
```

Plus unit tests in each package (`swift test --filter FixVerificationTests`, `web-sdk` `npm test` + `npm run test:e2e`, `cli` `npm test`, Portal `PortalTests`).
