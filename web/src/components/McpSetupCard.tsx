import { useState } from "react";
import { Link } from "react-router-dom";
import { CopyButton } from "@/components/CopyButton";
import { SparkleIcon } from "@/components/icons";

export function McpSetupCard({
  projectId,
  projectName,
}: {
  projectId: string;
  projectName?: string;
}) {
  const [format, setFormat] = useState<"json" | "claude" | "npx">("json");

  const jsonSnippet = JSON.stringify(
    {
      mcpServers: {
        feedbackkit: {
          command: "feedbackkit",
          args: ["mcp", "--project", projectId],
        },
      },
    },
    null,
    2,
  );

  const npxSnippet = JSON.stringify(
    {
      mcpServers: {
        feedbackkit: {
          command: "npx",
          args: ["-y", "feedbackkit-cli", "mcp", "--project", projectId],
        },
      },
    },
    null,
    2,
  );

  const claudeSnippet = `claude mcp add feedbackkit -- feedbackkit mcp --project ${projectId}`;

  const currentSnippet =
    format === "json" ? jsonSnippet : format === "npx" ? npxSnippet : claudeSnippet;

  return (
    <section className="rounded-xl border border-neutral-200 bg-white p-5 shadow-sm">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <div className="flex items-center gap-2">
            <SparkleIcon className="h-4 w-4 text-neutral-500" />
            <h2 className="text-sm font-medium text-neutral-900">Connect AI coding agent (MCP)</h2>
          </div>
          <p className="mt-1 text-xs text-neutral-500">
            Let Claude Code, Cursor, Antigravity, or Codex pull feedback and prompts scoped directly to{" "}
            {projectName ? `"${projectName}"` : "this project"}.
          </p>
        </div>

        {/* Format tabs */}
        <div className="inline-flex shrink-0 self-start sm:self-auto rounded-lg border border-neutral-200 bg-neutral-100/70 p-0.5 text-xs font-medium">
          <button
            type="button"
            onClick={() => setFormat("json")}
            className={`rounded-md px-2.5 py-1 transition-colors ${
              format === "json"
                ? "bg-white text-neutral-900 shadow-xs font-semibold"
                : "text-neutral-500 hover:text-neutral-900"
            }`}
          >
            mcp_config.json
          </button>
          <button
            type="button"
            onClick={() => setFormat("npx")}
            className={`rounded-md px-2.5 py-1 transition-colors ${
              format === "npx"
                ? "bg-white text-neutral-900 shadow-xs font-semibold"
                : "text-neutral-500 hover:text-neutral-900"
            }`}
          >
            npx JSON
          </button>
          <button
            type="button"
            onClick={() => setFormat("claude")}
            className={`rounded-md px-2.5 py-1 transition-colors ${
              format === "claude"
                ? "bg-white text-neutral-900 shadow-xs font-semibold"
                : "text-neutral-500 hover:text-neutral-900"
            }`}
          >
            Claude Code CLI
          </button>
        </div>
      </div>

      <div className="mt-4 space-y-3">
        <div className="overflow-hidden rounded-lg border border-neutral-800 bg-neutral-900 shadow-xs">
          <div className="flex items-center justify-between border-b border-neutral-800 px-4 py-2">
            <span className="text-[11px] font-medium text-neutral-400">
              {format === "claude" ? "Terminal command" : "Configuration snippet (scoped to this project)"}
            </span>
            <CopyButton text={currentSnippet} label="Copy" variant="dark" />
          </div>
          <pre className="overflow-x-auto p-4 font-mono text-xs leading-relaxed text-neutral-100 whitespace-pre-wrap select-all">
            {currentSnippet}
          </pre>
        </div>

        <div className="flex flex-wrap items-center justify-between gap-3 pt-1">
          <CopyButton text={currentSnippet} label="Copy configuration" variant="primary" size="md" />
          <Link
            to="/docs/mcp"
            className="inline-flex items-center gap-1 text-xs text-neutral-500 hover:text-neutral-900 hover:underline"
          >
            View full MCP documentation →
          </Link>
        </div>
      </div>
    </section>
  );
}
