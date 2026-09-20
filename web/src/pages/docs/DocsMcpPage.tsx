import { Link } from "react-router-dom";
import { CodeBlock } from "@/components/docs/CodeBlock";
import { DocsCallout, DocsSection, DocsTable, DocsTitle, InlineCode } from "@/components/docs/DocsProse";

const claudeCodeAdd = `claude mcp add feedbackkit -- feedbackkit mcp`;

const claudeCodeScoped = `# Available to just this project, checked into .claude/.mcp.json
claude mcp add --scope project feedbackkit -- feedbackkit mcp

# Available to you across every project
claude mcp add --scope user feedbackkit -- feedbackkit mcp`;

const mcpJson = `{
  "mcpServers": {
    "feedbackkit": {
      "type": "stdio",
      "command": "feedbackkit",
      "args": ["mcp"]
    }
  }
}`;

export function DocsMcpPage() {
  return (
    <div>
      <DocsTitle
        eyebrow="MCP & coding agents"
        title="Connect a coding agent"
        description="feedbackkit mcp runs an MCP (Model Context Protocol) server over stdio, so a coding
          agent can fetch a bug report and its generated prompt directly — the copy/paste step
          removed entirely."
      />

      <DocsSection title="Prerequisites">
        <p>
          Install the CLI and log in first — see{" "}
          <Link to="/docs/cli" className="link-underline font-medium text-neutral-900">
            the CLI page
          </Link>
          . The MCP server uses the same stored credentials, so once <InlineCode>feedbackkit whoami</InlineCode> shows
          you're signed in, it's ready to connect.
        </p>
      </DocsSection>

      <DocsSection title="Claude Code">
        <p>Register it as a local stdio server:</p>
        <CodeBlock code={claudeCodeAdd} label="Terminal" />
        <p>Or scope it to just this project (checked into version control) or to yourself across all projects:</p>
        <CodeBlock code={claudeCodeScoped} label="Terminal" />
        <p>
          Manage registered servers anytime with <InlineCode>claude mcp list</InlineCode>,{" "}
          <InlineCode>claude mcp remove feedbackkit</InlineCode>, or the in-session <InlineCode>/mcp</InlineCode> command.
        </p>
      </DocsSection>

      <DocsSection title="Other agents">
        <p>
          Most MCP-compatible tools (Cursor, Windsurf, and others) accept a similar JSON config,
          typically in a <InlineCode>mcp.json</InlineCode>-style file:
        </p>
        <CodeBlock code={mcpJson} label="mcp.json" />
        <DocsCallout>
          The exact file location and surrounding config shape varies by tool and changes over time —
          check that tool's own MCP documentation for where this block goes.
        </DocsCallout>
      </DocsSection>

      <DocsSection title="Tools it exposes">
        <DocsTable
          columns={["Tool", "What it does"]}
          rows={[
            ["list_projects", "List projects the logged-in user is a member of."],
            ["list_feedback", "List feedback, optionally filtered by project_id/status."],
            ["get_feedback", "Full detail for one report, including a signed screenshot URL (null if the reporter left the screenshot out)."],
            ["get_prompt", "The generated (or developer-edited) coding-agent prompt for one report — the whole point."],
            ["get_docs", "FeedbackKit's own documentation — e.g. how to add the SDK to an iOS app. Doesn't require being logged in."],
            ["update_feedback_status", "Mark a report's status, e.g. resolved after fixing it."],
          ]}
        />
        <p>
          Everything except <InlineCode>update_feedback_status</InlineCode> is read-only by design: the goal is
          removing copy/paste, not letting an agent triage your feedback inbox unsupervised. A human
          still decides which report to hand the agent and reviews what it does with it.
        </p>
      </DocsSection>

      <DocsSection title="Example prompts">
        <p>
          Once connected, you can just ask your agent to use it:
        </p>
        <CodeBlock code={`Look at feedback report <id> in FeedbackKit and fix it.`} label="You, to your agent" />
        <p>
          The agent calls <InlineCode>get_prompt</InlineCode>, gets back the same rendered prompt you'd otherwise
          copy from the dashboard, and can call <InlineCode>update_feedback_status</InlineCode> once it's done.
        </p>
        <p>
          <InlineCode>get_docs</InlineCode> means the agent can also answer questions about FeedbackKit itself,
          from its real documentation rather than a guess:
        </p>
        <CodeBlock code={`How do I add FeedbackKit to my iOS app?`} label="You, to your agent" />
      </DocsSection>
    </div>
  );
}
