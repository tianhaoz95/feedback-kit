#!/usr/bin/env node
import { Command } from "commander";
import { login } from "./commands/login.js";
import { logout } from "./commands/logout.js";
import { whoami } from "./commands/whoami.js";
import { listProjects } from "./commands/projects.js";
import { listFeedback } from "./commands/list.js";
import { printPrompt } from "./commands/prompt.js";
import { printDocs } from "./commands/docs.js";
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
  .action(async (opts: { project?: string; status?: string }) => {
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
  .action(async () => {
    try {
      await runMcpServer();
    } catch (err) {
      handleError(err);
    }
  });

program.parseAsync(process.argv);
