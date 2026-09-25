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
  .description("Record the fix for a report (automatic for PRs mentioning `FeedbackKit: <id>` when the GitHub App is connected).")
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
  .option("--project <id>", "Project id (default: FEEDBACKKIT_PROJECT_ID, or your only project).")
  .option("--include <ids...>", "Also ship these feedback ids, skipping the git check.")
  .option("--dry-run", "Show what would ship without recording anything.")
  .action(async (opts: { build: string; appVersion?: string; commit?: string; product?: string; project?: string; include?: string[]; dryRun?: boolean }) => {
    try {
      await release({ ...opts, version: opts.appVersion });
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
