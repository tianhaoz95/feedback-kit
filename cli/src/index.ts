#!/usr/bin/env node
import { Command } from "commander";
import { login } from "./commands/login.js";
import { logout } from "./commands/logout.js";
import { whoami } from "./commands/whoami.js";
import { listProjects } from "./commands/projects.js";
import { listFeedback } from "./commands/list.js";
import { printPrompt } from "./commands/prompt.js";
import { printDocs } from "./commands/docs.js";
import { release } from "./commands/release.js";
import { promote } from "./commands/promote.js";
import { listReleases } from "./commands/releases.js";
import { createToken, listTokens, revokeToken } from "./commands/token.js";
import { link } from "./commands/link.js";
import { timeline } from "./commands/timeline.js";
import { runMcpServer } from "./mcp/server.js";

function handleError(err: unknown): void {
  console.error(err instanceof Error ? err.message : String(err));
  process.exitCode = 1;
}

const program = new Command();
program
  .name("feedbackkit")
  .description("CLI + MCP server for reading FeedbackKit dashboard feedback from a coding agent.")
  .version("0.1.0");

program
  .command("login")
  .description("Log in via your browser (opens the dashboard to authorize this CLI).")
  .option("--dashboard-url <url>", "Dashboard URL to authenticate against.")
  .action(async (opts: { dashboardUrl?: string }) => {
    try {
      await login(opts);
    } catch (err) {
      handleError(err);
    }
  });

program
  .command("logout")
  .description("Remove locally stored credentials.")
  .action(async () => {
    try {
      await logout();
    } catch (err) {
      handleError(err);
    }
  });

program
  .command("whoami")
  .description("Show the currently logged-in user.")
  .action(async () => {
    try {
      await whoami();
    } catch (err) {
      handleError(err);
    }
  });

program
  .command("projects")
  .description("List projects you're a member of.")
  .action(async () => {
    try {
      await listProjects();
    } catch (err) {
      handleError(err);
    }
  });

program
  .command("list")
  .description("List feedback reports.")
  .option("--project <id>", "Only feedback for this project id.")
  .option("--status <status>", "Only feedback with this status (new, in_progress, resolved, wont_fix).")
  .option("--stage <stage>", "Only feedback at this fix stage (agent_working, pr_open, merged, shipped, verified, reopened).")
  .action(async (opts: { project?: string; status?: string; stage?: string }) => {
    try {
      await listFeedback(opts);
    } catch (err) {
      handleError(err);
    }
  });

program
  .command("prompt")
  .argument("<feedbackId>", "Feedback id to generate a coding-agent prompt for.")
  .description("Print the generated coding-agent prompt for one feedback report.")
  .action(async (feedbackId: string) => {
    try {
      await printPrompt(feedbackId);
    } catch (err) {
      handleError(err);
    }
  });

program
  .command("timeline")
  .argument("<feedbackId>", "Feedback id.")
  .description("Show a report's fix-loop activity: agent progress, PRs, releases, and the reporter's replies.")
  .action(async (feedbackId: string) => {
    try {
      await timeline(feedbackId);
    } catch (err) {
      handleError(err);
    }
  });

program
  .command("link")
  .argument("<feedbackId>", "Feedback id the fix is for.")
  .description("Record the fix for a report by hand (automatic for commits/PRs with a `FeedbackKit: <id>` trailer when the GitHub App is connected).")
  .option("--pr <url>", "Pull request URL.")
  .option("--commit <sha>", "Fix commit (without --pr, treated as already merged).")
  .option("--merged", "The PR is merged.")
  .option("--summary <text>", "One sentence on what was fixed, shown to the reporter.")
  .action(async (feedbackId: string, opts: { pr?: string; commit?: string; merged?: boolean; summary?: string }) => {
    try {
      await link(feedbackId, opts);
    } catch (err) {
      handleError(err);
    }
  });

program
  .command("release")
  .description(
    "Announce a build: marks merged fixes it contains as shipped, so their reporters get asked \"is it fixed?\" in the app.",
  )
  .requiredOption("--build <build>", "The build number reporters will run (CFBundleVersion / your web build id).")
  // Not `--version`: the root command's `-V, --version` would swallow it.
  .option("--app-version <version>", "Marketing version, e.g. 1.4.0 (shown with the release).")
  .option("--commit <rev>", "Commit the build was made from (default HEAD). Fixes must be ancestors of it.")
  .option("--product <key>", "Only ship fixes for this product (e.g. ios); reports with no product always ship.")
  .option("--project <id>", "Project id (default: FEEDBACKKIT_PROJECT_ID, or your only project). Ignored with --token.")
  .option("--channel <channel>", "beta (default) or production.")
  .option("--token <token>", "Project release token for CI (default: FEEDBACKKIT_RELEASE_TOKEN). No login needed.")
  .option("--api-url <url>", "FeedbackKit backend for --token (default: FEEDBACKKIT_API_URL, or the hosted one).")
  .option("--include <ids...>", "Also ship these feedback ids, skipping the git check.")
  .option("--dry-run", "Show what would ship without recording anything.")
  .action(async (opts: { build: string; appVersion?: string; commit?: string; product?: string; project?: string; channel?: string; token?: string; apiUrl?: string; include?: string[]; dryRun?: boolean }) => {
    try {
      await release({ ...opts, version: opts.appVersion });
    } catch (err) {
      handleError(err);
    }
  });

program
  .command("releases")
  .description("Release readiness: each build's fixes — verified, waiting on reporters, or reopened — and whether it's ready to promote.")
  .option("--project <id>", "Project id (default: FEEDBACKKIT_PROJECT_ID, or your only project).")
  .option("--limit <n>", "How many releases (default 20).")
  .option("--json", "Machine-readable output.")
  .action(async (opts: { project?: string; limit?: string; json?: boolean }) => {
    try {
      await listReleases(opts);
    } catch (err) {
      handleError(err);
    }
  });

program
  .command("promote")
  .description("Mark a beta build as released to production (e.g. after promoting it in App Store Connect).")
  .requiredOption("--build <build>", "The build that went to production.")
  .option("--product <key>", "Only this product's release of the build.")
  .option("--project <id>", "Project id (default: FEEDBACKKIT_PROJECT_ID, or your only project). Ignored with --token.")
  .option("--token <token>", "Project release token (default: FEEDBACKKIT_RELEASE_TOKEN).")
  .option("--api-url <url>", "FeedbackKit backend for --token.")
  .action(async (opts: { build: string; product?: string; project?: string; token?: string; apiUrl?: string }) => {
    try {
      await promote(opts);
    } catch (err) {
      handleError(err);
    }
  });

const tokenCommand = program
  .command("token")
  .description("Project release tokens — how CI runs `release` without a login.");

tokenCommand
  .command("create")
  .argument("<name>", "What it's for, e.g. github-actions.")
  .option("--project <id>", "Project id (default: FEEDBACKKIT_PROJECT_ID, or your only project).")
  .description("Create a token (printed once). Pipe it into your CI secrets, e.g. `| gh secret set FEEDBACKKIT_RELEASE_TOKEN`.")
  .action(async (name: string, opts: { project?: string }) => {
    try {
      await createToken(name, opts);
    } catch (err) {
      handleError(err);
    }
  });

tokenCommand
  .command("list")
  .option("--project <id>", "Project id.")
  .description("List a project's release tokens.")
  .action(async (opts: { project?: string }) => {
    try {
      await listTokens(opts);
    } catch (err) {
      handleError(err);
    }
  });

tokenCommand
  .command("revoke")
  .argument("<id>", "Token id (from `token list`).")
  .description("Revoke a release token.")
  .action(async (id: string) => {
    try {
      await revokeToken(id);
    } catch (err) {
      handleError(err);
    }
  });

program
  .command("docs")
  .argument("[topic]", "Doc topic to print (omit to list available topics).")
  .description("Print FeedbackKit's own documentation — e.g. how to add the SDK to an iOS app.")
  .action(async (topic: string | undefined) => {
    try {
      await printDocs(topic);
    } catch (err) {
      handleError(err);
    }
  });

program
  .command("mcp")
  .description("Run an MCP server over stdio, exposing your feedback to a coding agent.")
  .option("--project <id>", "Only allow access to this project id.")
  .option("--project-id <id>", "Alias for --project.")
  .action(async (opts: { project?: string; projectId?: string }) => {
    try {
      const projectId = opts.project || opts.projectId || process.env.FEEDBACKKIT_PROJECT_ID;
      await runMcpServer({ projectId });
    } catch (err) {
      handleError(err);
    }
  });

program.parseAsync(process.argv);
