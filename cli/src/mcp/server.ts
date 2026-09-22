import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { z } from "zod";
import { getAuthenticatedClient } from "../supabaseClient.js";
import { renderPromptTemplate } from "../promptTemplate.js";
import { getDocTopic, listDocTopics } from "../docs.js";
import type { FeedbackItem, PromptTemplate } from "../types.js";

const STATUS_ENUM = z.enum(["new", "in_progress", "resolved", "wont_fix"]);

export interface McpServerOptions {
  projectId?: string;
}

/**
 * Read-mostly tools over the same tables/RLS the web dashboard uses — no
 * separate authorization logic here, see supabaseClient.ts. `list_feedback`
 * and `get_feedback` cover "what needs attention"; `get_prompt` is the
 * whole point (the thing a human used to copy/paste by hand);
 * `update_feedback_status` is the one write tool, scoped to a status flip
 * so an agent can close the loop after fixing something.
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
        ? `List feedback reports for project ${projectId} (server is scoped to this project), optionally filtered by status.`
        : "List feedback reports captured by the iOS app, optionally filtered by project and/or status.",
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
        limit: z.number().int().min(1).max(100).default(20),
      },
    },
    async ({ project_id, status, limit }) => {
      if (projectId && project_id && project_id !== projectId) {
        return errorResult(
          `Cannot query project "${project_id}": this MCP server is scoped to project "${projectId}".`,
        );
      }
      const effectiveProjectId = projectId || project_id;
      const client = await getAuthenticatedClient();
      let query = client
        .from("feedback_items")
        .select("id, project_id, text, status, environment, created_at")
        .order("created_at", { ascending: false })
        .limit(limit);
      if (effectiveProjectId) query = query.eq("project_id", effectiveProjectId);
      if (status) query = query.eq("status", status);

      const { data, error } = await query;
      if (error) return errorResult(error.message);
      return jsonResult(data ?? []);
    },
  );

  server.registerTool(
    "get_feedback",
    {
      description: projectId
        ? `Get full detail for one feedback report in project ${projectId}, including a time-limited screenshot URL.`
        : "Get full detail for one feedback report, including a time-limited screenshot URL.",
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

      const signed = feedback.screenshot_annotated_path
        ? await client.storage
            .from("feedback-screenshots")
            .createSignedUrl(feedback.screenshot_annotated_path, 3600)
        : null;

      return jsonResult({ ...feedback, screenshot_url: signed?.data?.signedUrl ?? null });
    },
  );

  server.registerTool(
    "get_prompt",
    {
      description:
        "Get the ready-to-use coding-agent prompt for one feedback report — the developer's edited " +
        "override if they set one, otherwise rendered live from the project's prompt template. This is " +
        "the thing a human would otherwise copy out of the dashboard and paste to you.",
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

      if (feedback.edited_prompt) return textResult(feedback.edited_prompt);

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
        ),
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
        ? `Mark a feedback report's status in project ${projectId} — e.g. to 'resolved' after fixing the bug it describes.`
        : "Mark a feedback report's status — e.g. to 'resolved' after fixing the bug it describes.",
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

  return server;
}

export async function runMcpServer(options: McpServerOptions = {}): Promise<void> {
  const server = createMcpServer(options);
  const transport = new StdioServerTransport();
  await server.connect(transport);
}

function jsonResult(data: unknown) {
  return { content: [{ type: "text" as const, text: JSON.stringify(data, null, 2) }] };
}

function textResult(text: string) {
  return { content: [{ type: "text" as const, text }] };
}

function errorResult(message: string) {
  return { content: [{ type: "text" as const, text: message }], isError: true };
}
