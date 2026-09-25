import { readFile } from "node:fs/promises";
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { z } from "zod";
import { getAuthenticatedClient } from "../supabaseClient.js";
import { renderPromptTemplate } from "../promptTemplate.js";
import { getDocTopic, listDocTopics } from "../docs.js";
import {
  attachAfterScreenshot,
  claimFeedback,
  downloadBase64,
  fetchFeedback,
  fetchTimeline,
  linkFix,
  loopInstructions,
  recordEvent,
} from "../loop.js";
import type { FeedbackItem, PromptTemplate } from "../types.js";

const STATUS_ENUM = z.enum(["new", "in_progress", "resolved", "wont_fix"]);
const FIX_STAGE_ENUM = z.enum(["agent_working", "pr_open", "merged", "shipped", "verified", "reopened"]);

/** Screenshots larger than this are returned as a signed URL only, not inline image content. */
const MAX_INLINE_IMAGE_BYTES = 3_500_000;

export interface McpServerOptions {
  projectId?: string;
}

/**
 * Tools over the same tables/RLS the web dashboard uses — no separate
 * authorization logic here, see supabaseClient.ts. `list_feedback` and
 * `get_feedback` cover "what needs attention" (with the screenshots as real
 * image content, so a vision-capable agent actually sees them);
 * `get_prompt` is the thing a human used to copy/paste by hand.
 *
 * The write tools close the loop (see ../loop.ts and 0014_closed_loop.sql)
 * and are deliberately narrow: an agent can claim a report, post progress,
 * ask the reporter a question, link its fix and attach an "after"
 * screenshot — but never mark a fix verified. Only the reporter can, from
 * their own device, once the fix ships.
 *
 * When `projectId` is provided, all project queries and feedback queries
 * are scoped strictly to that project so an agent only pulls data for the
 * project it is working on.
 */
export function createMcpServer(options: McpServerOptions = {}): McpServer {
  const { projectId } = options;
  const server = new McpServer({ name: "feedbackkit", version: "0.1.0" });

  server.registerTool(
    "list_projects",
    {
      description: projectId
        ? `List the FeedbackKit projects you're a member of (filtered to scoped project ${projectId}).`
        : "List the FeedbackKit projects you're a member of.",
    },
    async () => {
      const client = await getAuthenticatedClient();
      let query = client
        .from("projects")
        .select("id, name, created_at")
        .order("created_at", { ascending: false });
      if (projectId) query = query.eq("id", projectId);
      const { data, error } = await query;
      if (error) return errorResult(error.message);
      return jsonResult(data ?? []);
    },
  );

  server.registerTool(
    "list_feedback",
    {
      description: projectId
        ? `List feedback reports for project ${projectId} (server is scoped to this project), optionally filtered by status and/or fix stage.`
        : "List feedback reports captured by the iOS app, optionally filtered by project, status and/or fix stage.",
      inputSchema: {
        project_id: z
          .string()
          .describe(
            projectId
              ? `Project id to filter by (server is scoped to "${projectId}").`
              : "Only feedback for this project id.",
          )
          .optional(),
        status: STATUS_ENUM.optional(),
        fix_stage: FIX_STAGE_ENUM.describe(
          "Only reports at this stage of the fix loop — e.g. 'reopened' for fixes the reporter says didn't work.",
        ).optional(),
        limit: z.number().int().min(1).max(100).default(20),
      },
    },
    async ({ project_id, status, fix_stage, limit }) => {
      if (projectId && project_id && project_id !== projectId) {
        return errorResult(
          `Cannot query project "${project_id}": this MCP server is scoped to project "${projectId}".`,
        );
      }
      const effectiveProjectId = projectId || project_id;
      const client = await getAuthenticatedClient();
      let query = client
        .from("feedback_items")
        .select("id, project_id, text, status, fix_stage, fixed_in_build, reopen_count, fix_pr_url, environment, created_at")
        .order("created_at", { ascending: false })
        .limit(limit);
      if (effectiveProjectId) query = query.eq("project_id", effectiveProjectId);
      if (status) query = query.eq("status", status);
      if (fix_stage) query = query.eq("fix_stage", fix_stage);

      const { data, error } = await query;
      if (error) return errorResult(error.message);
      return jsonResult(data ?? []);
    },
  );

  server.registerTool(
    "get_feedback",
    {
      description:
        (projectId
          ? `Get full detail for one feedback report in project ${projectId}`
          : "Get full detail for one feedback report") +
        " — the report, its activity timeline (agent progress, PRs, releases, and the reporter's own replies or " +
        "\"still broken\" reopen notes), and its annotated screenshot as an image. If the reporter reopened it, " +
        "their latest screenshot is included too.",
      inputSchema: {
        feedback_id: z.string(),
        include_images: z.boolean().describe("Return screenshots as image content (default true).").default(true),
      },
    },
    async ({ feedback_id, include_images }) => {
      const client = await getAuthenticatedClient();
      let feedback: FeedbackItem;
      try {
        feedback = await fetchFeedback(client, feedback_id, projectId);
      } catch (err) {
        return errorResult((err as Error).message);
      }
      const timeline = await fetchTimeline(client, feedback.id).catch(() => []);

      const signed = feedback.screenshot_annotated_path
        ? await client.storage
            .from("feedback-screenshots")
            .createSignedUrl(feedback.screenshot_annotated_path, 3600)
        : null;

      const content: ToolContent[] = [
        {
          type: "text",
          text: JSON.stringify({ ...feedback, screenshot_url: signed?.data?.signedUrl ?? null, timeline }, null, 2),
        },
      ];

      if (include_images !== false) {
        if (feedback.screenshot_annotated_path) {
          const data = await downloadBase64(client, feedback.screenshot_annotated_path, MAX_INLINE_IMAGE_BYTES);
          if (data) {
            content.push({ type: "text", text: "Reporter's annotated screenshot (their drawings mark the problem):" });
            content.push({ type: "image", data, mimeType: "image/png" });
          }
        }
        const lastReopen = [...timeline].reverse().find((e) => e.kind === "reopened" && e.data?.screenshot_annotated_path);
        if (lastReopen) {
          const data = await downloadBase64(client, String(lastReopen.data.screenshot_annotated_path), MAX_INLINE_IMAGE_BYTES);
          if (data) {
            content.push({
              type: "text",
              text: `Screenshot from the reporter's reopen on ${lastReopen.created_at} (build ${String(lastReopen.data.build ?? "?")}) — the bug as it still looks after the previous fix:`,
            });
            content.push({ type: "image", data, mimeType: "image/png" });
          }
        }
      }

      return { content };
    },
  );

  server.registerTool(
    "get_prompt",
    {
      description:
        "Get the ready-to-use coding-agent prompt for one feedback report — the developer's edited " +
        "override if they set one, otherwise rendered live from the project's prompt template. This is " +
        "the thing a human would otherwise copy out of the dashboard and paste to you — followed by how to " +
        "report progress back so the fix reaches the person who reported it.",
      inputSchema: { feedback_id: z.string() },
    },
    async ({ feedback_id }) => {
      const client = await getAuthenticatedClient();
      let query = client
        .from("feedback_items")
        .select("*")
        .eq("id", feedback_id);
      if (projectId) query = query.eq("project_id", projectId);
      const { data: feedback, error } = await query.maybeSingle<FeedbackItem>();
      if (error || !feedback) {
        return errorResult(
          projectId
            ? `Feedback ${feedback_id} not found in project ${projectId}, or you don't have access to it.`
            : `Feedback ${feedback_id} not found, or you don't have access to it.`,
        );
      }

      if (feedback.edited_prompt) return textResult(feedback.edited_prompt + loopInstructions(feedback));

      const { data: template } = await client
        .from("prompt_templates")
        .select("*")
        .eq("project_id", feedback.project_id)
        .single<PromptTemplate>();

      const [screenshotSigned, attachmentSigned] = await Promise.all([
        feedback.screenshot_annotated_path
          ? client.storage.from("feedback-screenshots").createSignedUrl(feedback.screenshot_annotated_path, 3600)
          : Promise.resolve(null),
        feedback.attachment_path
          ? client.storage.from("feedback-screenshots").createSignedUrl(feedback.attachment_path, 3600)
          : Promise.resolve(null),
      ]);

      return textResult(
        renderPromptTemplate(
          template?.template_text ?? "",
          feedback,
          screenshotSigned?.data?.signedUrl ?? null,
          attachmentSigned?.data?.signedUrl ?? null,
        ) + loopInstructions(feedback),
      );
    },
  );

  server.registerTool(
    "get_docs",
    {
      description:
        "Get FeedbackKit's own documentation — e.g. how to add the SDK to an iOS/macOS/watchOS app, " +
        "set up the dashboard, or use this CLI/MCP server. Call with no arguments to list topics, or " +
        "with `topic` for that topic's full content. Doesn't require being logged in.",
      inputSchema: {
        topic: z
          .string()
          .describe("A topic slug from the no-argument call's list, e.g. 'sdk' or 'dashboard'.")
          .optional(),
      },
    },
    async ({ topic }) => {
      if (!topic) return jsonResult(listDocTopics());
      const doc = getDocTopic(topic);
      if (!doc) {
        return errorResult(
          `Unknown doc topic "${topic}". Call get_docs with no arguments to see available topics.`,
        );
      }
      return textResult(doc.content);
    },
  );

  server.registerTool(
    "update_feedback_status",
    {
      description: projectId
        ? `Set a feedback report's triage status in project ${projectId}. For code fixes, prefer link_fix — ` +
          "the reporter confirms the fix on their device once it ships, which resolves it."
        : "Set a feedback report's triage status. For code fixes, prefer link_fix — the reporter confirms " +
          "the fix on their device once it ships, which resolves it.",
      inputSchema: { feedback_id: z.string(), status: STATUS_ENUM },
    },
    async ({ feedback_id, status }) => {
      const client = await getAuthenticatedClient();
      let query = client.from("feedback_items").update({ status }).eq("id", feedback_id);
      if (projectId) query = query.eq("project_id", projectId);
      const { data, error } = await query.select("id");
      if (error) return errorResult(error.message);
      if (projectId && (!data || data.length === 0)) {
        return errorResult(
          `Feedback ${feedback_id} not found in project ${projectId}, or you don't have access to update it.`,
        );
      }
      return textResult(`Marked ${feedback_id} as ${status}.`);
    },
  );

  // ---- Closing the loop -----------------------------------------------------

  /** Who the timeline says did it: the MCP client's own name (e.g. "claude-code"). */
  const agentActor = () => ({
    actorType: "agent" as const,
    actorLabel: server.server.getClientVersion()?.name ?? "Coding agent",
  });

  const withItem = async <T>(
    feedbackId: string,
    fn: (client: Awaited<ReturnType<typeof getAuthenticatedClient>>, item: FeedbackItem) => Promise<T>,
  ) => {
    const client = await getAuthenticatedClient();
    const item = await fetchFeedback(client, feedbackId, projectId);
    return fn(client, item);
  };

  server.registerTool(
    "claim_feedback",
    {
      description:
        "Tell the team you've started working on a feedback report. Moves it to 'agent_working' and adds a " +
        "timeline entry. Call this before you start changing code for a report.",
      inputSchema: {
        feedback_id: z.string(),
        note: z.string().describe("Optional one-line plan, e.g. 'Likely a missing safe-area inset on CheckoutView'.").optional(),
      },
    },
    async ({ feedback_id, note }) => {
      try {
        await withItem(feedback_id, (client, item) => claimFeedback(client, item, { ...agentActor(), body: note }));
        return textResult(`Claimed ${feedback_id}.`);
      } catch (err) {
        return errorResult((err as Error).message);
      }
    },
  );

  server.registerTool(
    "post_update",
    {
      description:
        "Add a progress note to a feedback report's timeline (e.g. root cause found, what changed). Set " +
        "notify_reporter only for a short, plain-language note meant for the person who reported it — it " +
        "appears on their device alongside the fix.",
      inputSchema: {
        feedback_id: z.string(),
        message: z.string().min(1),
        notify_reporter: z.boolean().default(false),
      },
    },
    async ({ feedback_id, message, notify_reporter }) => {
      try {
        await withItem(feedback_id, (client, item) =>
          recordEvent(client, item, { ...agentActor(), kind: "comment", body: message, visibleToReporter: notify_reporter }),
        );
        return textResult(notify_reporter ? "Posted (visible to the reporter)." : "Posted.");
      } catch (err) {
        return errorResult((err as Error).message);
      }
    },
  );

  server.registerTool(
    "ask_reporter",
    {
      description:
        "Ask the person who filed a feedback report a clarifying question. It shows up in the app on their " +
        "device the next time they open it; their reply appears in this report's timeline (get_feedback). " +
        "Use sparingly — only for things you can't determine from the code, screenshot or logs.",
      inputSchema: {
        feedback_id: z.string(),
        question: z.string().min(1).describe("Short, plain-language question, e.g. 'Does this happen in landscape too?'"),
      },
    },
    async ({ feedback_id, question }) => {
      try {
        const reporterId = await withItem(feedback_id, async (client, item) => {
          await recordEvent(client, item, { ...agentActor(), kind: "question", body: question, visibleToReporter: true });
          return item.reporter_id;
        });
        return textResult(
          reporterId
            ? "Question sent. The reporter will see it next time they open the app."
            : "Question recorded, but this report has no reporter id (it was filed by an older SDK), so it can't reach their device — the team will see it in the dashboard.",
        );
      } catch (err) {
        return errorResult((err as Error).message);
      }
    },
  );

  server.registerTool(
    "link_fix",
    {
      description:
        "Record the fix for a feedback report. Not needed for a PR whose description contains " +
        "'FeedbackKit: <feedback_id>' when the project's GitHub App is connected — that's tracked automatically. " +
        "Use it when you commit directly (pass commit_sha; treated as merged), when there's no GitHub App, or " +
        "to add a one-line summary the reporter will see when the fix ships.",
      inputSchema: {
        feedback_id: z.string(),
        pr_url: z.string().url().optional(),
        commit_sha: z.string().regex(/^[0-9a-f]{7,40}$/i).optional(),
        merged: z.boolean().describe("True if the PR is already merged.").default(false),
        summary: z.string().describe("One plain-language sentence on what was fixed, shown to the reporter.").optional(),
      },
    },
    async ({ feedback_id, pr_url, commit_sha, merged, summary }) => {
      if (!pr_url && !commit_sha) return errorResult("Pass pr_url and/or commit_sha.");
      try {
        const stage = await withItem(feedback_id, (client, item) =>
          linkFix(client, item, { prUrl: pr_url, commitSha: commit_sha, merged, summary }, agentActor()),
        );
        return textResult(
          stage === "merged"
            ? "Linked. It will ship to the reporter with the next `feedbackkit release`."
            : "Linked. When the PR merges (tracked via GitHub, or call link_fix again with merged=true), it ships with the next release.",
        );
      } catch (err) {
        return errorResult((err as Error).message);
      }
    },
  );

  server.registerTool(
    "attach_after_screenshot",
    {
      description:
        "Attach a screenshot showing the fixed screen (e.g. taken from the iOS simulator or a browser after " +
        "your change) to a feedback report, so reviewers see before/after side by side. Pass a local PNG path.",
      inputSchema: {
        feedback_id: z.string(),
        png_path: z.string().describe("Absolute path to a PNG file on this machine."),
        caption: z.string().optional(),
      },
    },
    async ({ feedback_id, png_path, caption }) => {
      let png: Buffer;
      try {
        png = await readFile(png_path);
      } catch (err) {
        return errorResult(`Couldn't read ${png_path}: ${(err as Error).message}`);
      }
      if (png.subarray(0, 8).toString("hex") !== "89504e470d0a1a0a") return errorResult(`${png_path} isn't a PNG file.`);
      try {
        await withItem(feedback_id, (client, item) => attachAfterScreenshot(client, item, png, caption, agentActor()));
        return textResult("Attached.");
      } catch (err) {
        return errorResult((err as Error).message);
      }
    },
  );

  return server;
}

export async function runMcpServer(options: McpServerOptions = {}): Promise<void> {
  const server = createMcpServer(options);
  const transport = new StdioServerTransport();
  await server.connect(transport);
}

type ToolContent =
  | { type: "text"; text: string }
  | { type: "image"; data: string; mimeType: string };

function jsonResult(data: unknown) {
  return { content: [{ type: "text" as const, text: JSON.stringify(data, null, 2) }] };
}

function textResult(text: string) {
  return { content: [{ type: "text" as const, text }] };
}

function errorResult(message: string) {
  return { content: [{ type: "text" as const, text: message }], isError: true };
}
