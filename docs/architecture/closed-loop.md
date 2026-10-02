# The Closed Loop

How a report travels from a user's device, through a coding agent, into a build — and back to the same user to confirm the fix. Design rationale lives in `DESIGN.md` §7; this page is the contributor's map.

---

## The flow

```
SDK report (+ reporter_id, notify_reporter)  →  dashboard / MCP  →  agent: claim · ask · fix · after-shot
        ↑                                                ↓   PR description "FeedbackKit: <id>"
reporter's device  ←  reporter-updates  ←  feedbackkit release  ←  merged (github-webhook)
  "is it fixed?"  →  verified   |   still broken (+ new screenshot) → reopened → re-dispatched
  (only if the reporter opted in; otherwise the team's "Mark verified")
```

## Starting the agent

Five routes, all ending in the same linking/shipping/verifying steps. User-facing walkthrough: the dashboard's docs page *Hand reports to an agent* (`web/src/pages/docs/DocsAgentsPage.tsx`, mirrored as the `agents` topic in `cli/src/docs.ts`).

| Route | Trigger | Code |
|---|---|---|
| MCP (you + your agent) | The agent calls `get_prompt` / `claim_feedback` | `cli/src/mcp/server.ts`, `loopInstructions` in `cli/src/loop.ts` |
| GitHub-hosted Actions | *Send to agent* → issue + `projects.dispatch_labels` / `dispatch_comment` | `create-github-issue`, `dispatchIssueToAgent` in `_shared/github.ts`; the repo's own workflow (claude-code-action needs `allowed_bots: feedbackkit-app`) |
| Self-hosted Mac runner | Same labels, `runs-on: [self-hosted, macOS, feedbackkit-agent]` | `skills/setup/setup-agent-runner/` (Claude Code and Antigravity templates) |
| GitHub Copilot | `projects.dispatch_copilot` → assign `copilot-swe-agent[bot]` with a member's user token | `0018_copilot_dispatch.sql`, `github-user-auth`, `assignIssueToCopilot` |
| `feedbackkit watch` | *Run on my machine* inserts a `dispatched` event with `data.target = "local"` | `cli/src/commands/watch.ts` (claims with `data.queue_event`) |

On a reopen, `reporter-updates` re-applies the labels and re-assigns Copilot as the last member who dispatched it.

**Two GitHub Apps on the Claude Code routes.** The FeedbackKit GitHub App (`feedbackkit-app`) starts the work: `create-github-issue` creates the issue and adds the label, and `github-webhook` follows the PR. The [Claude GitHub App](https://github.com/apps/claude) is what `anthropics/claude-code-action` writes back with: it exchanges the job's `id-token: write` OIDC token for that app's installation token, then comments, pushes the branch and opens the PR as `claude[bot]`. Users install both, on hosted and self-hosted runners alike; a `claude` login on a self-hosted Mac replaces neither the app nor the `CLAUDE_CODE_OAUTH_TOKEN` secret. The alternative is the action's `github_token:` input (`GITHUB_TOKEN`, which doesn't trigger CI on the PR, or a token from an app the team owns). FeedbackKit's own app key must never be handed to an agent job, since report text is untrusted input there. Documented for users in `DocsAgentsPage.tsx`, the setup card in `AgentDispatchCard.tsx`, the `agents` topic in `cli/src/docs.ts`, and `skills/setup/setup-agent-runner/SKILL.md` Step 3a.

## Delivery modes (`0024`)

`projects.delivery_mode`: **batch** (merge → a beta ships every merged fix → verified → promote) or **branch** (PR → a preview build ships the PR's fixes via `release --channel preview --pr <n>` → verified → the PR's "FeedbackKit" commit status passes → merge). The status is computed by `prVerification()` in `supabase/functions/_shared/prStatus.ts` (pending / success / failure from the linked reports' stages) and posted on the PR's current head by `syncPrStatus`, called from github-webhook, ci-release, reporter-updates and `pr-status`. Agent instructions switch on the mode in three places (see *Keep in sync*). User docs: `/docs/delivery`; setup: the `setup-release-loop` skill asks which mode first.

## Reporter opt-in (`0023`)

`feedback_items.notify_reporter` is the composer's "Notify Me When It's Fixed" (off by default; null = an SDK from before the option, treated as opted in). `reporter-updates` skips reports with `false`; `release_readiness` counts their shipped fixes as `unreachable` instead of `awaiting`, so they don't hold a build back; the dashboard and Portal offer *Mark verified* (a `verified` event with `actor_type = 'user'`, which `0022` keeps from being announced as the reporter's).

## Push-to-main and betas

Agents commit to main with a `FeedbackKit: <id>` trailer. `github-webhook`'s push handler moves the report to `merged`. `beta.yml` runs the tests, ships the iOS Portal to TestFlight and the macOS Portal as the `beta-portal-mac` prerelease, and `scripts/feedbackkit_announce.sh` records each build through `ci-release` with the project's release token. The owner promotes a verified beta (Releases tab, `feedbackkit promote`). See DESIGN.md §8.

| Piece | Path |
|---|---|
| Release tokens, channels, readiness view | `supabase/migrations/0015_push_to_main_releases.sql` |
| Access tokens (scopes, run tokens), after-fix previews, retention | `supabase/migrations/0025_access_tokens_and_previews.sql`, `attach-preview`, `cleanup-previews` |
| Token-authenticated release API | `supabase/functions/ci-release/` |
| Push trailer linking | `supabase/functions/github-webhook/` (`handlePush`) |
| Beta pipeline | `.github/workflows/beta.yml`, `scripts/feedbackkit_announce.sh`, `.github/actions/setup-feedbackkit-cli` |
| Readiness UI | `web/src/components/ReleasesPanel.tsx`, `ReleaseTokensCard.tsx` |

## Fix stages

`feedback_items.fix_stage` (checked text, `0014_closed_loop.sql`) — kept **separate from `status`** because shipped Portal builds decode `status` strictly.

| `fix_stage` | Set by | `status` becomes |
|---|---|---|
| `agent_working` | MCP `claim_feedback`, dispatch in `create-github-issue` | `in_progress` |
| `pr_open` | `github-webhook` (PR opened), MCP/CLI `link_fix` | `in_progress` |
| `merged` | `github-webhook` (PR merged, or a trailer on a push to main), `link_fix` with a commit | `in_progress` |
| `shipped` | `record_release` RPC via `feedbackkit release` | `in_progress` |
| `verified` | `reporter-updates` (reporter taps "Yes, it's fixed"), or *Mark verified* in `FixLoopPanel` | `resolved` |
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
| Dashboard | `web/src/components/FixLoopPanel.tsx`, `AgentDispatchCard.tsx`, `LoopChecklist.tsx`, `WatchButton.tsx`; checklist and stuck-report rules in `web/src/lib/loopHealth.ts` |
| Watchlist | `feedback_watchers` + `notify_watchers()` (`0023`); Portal toolbar in `FeedbackDetailView.swift` |
| Portal | `DeveloperApp/Sources/Views/Detail/FixLoopSectionView.swift` |
| Agent Skills | `skills/workflow/fix-feedback/`, `skills/setup/setup-release-loop/`, `skills/setup/setup-agent-runner/` |

## Keep in sync by hand

- **Build ordering** — `compare_builds` in SQL, `_shared/builds.ts`, `cli/src/loop.ts`, `FeedbackBuild.compare` (Swift), `compareBuilds` (web SDK).
- **reporter-updates wire format** — the Edge Function, `FixUpdatesClient.swift`, `web-sdk/src/fixes.ts`.
- **Event kinds** — the `feedback_events.kind` check constraint, `FeedbackEventKind` in `web/src/lib/types.ts` and `cli/src/types.ts`, labels in `FixLoopPanel.tsx` and `PortalFeedbackEvent.title`, and the watcher titles in `notify_watchers()`.
- **Notification kinds** — the `notifications.kind` check, `NotificationKind` and its label/hint/dot maps in `web/src/`, and `PortalNotification.iconName` / the Portal's row tint.
- **Reporter reachability** — `reporterReachable()` in `web/src/lib/loopHealth.ts`, `PortalFeedbackItem.canReachReporter`, `ask_reporter`'s message, and the `release_readiness` view.
- **The agents page** — `DocsAgentsPage.tsx` and the `agents` topic in `cli/src/docs.ts`.
- **Delivery-mode agent instructions** — `closingTheLoopSection` (web), `loopInstructions` (CLI/MCP), and the create-github-issue body; and the delivery docs page vs. the `delivery` topic in `cli/src/docs.ts`.

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
