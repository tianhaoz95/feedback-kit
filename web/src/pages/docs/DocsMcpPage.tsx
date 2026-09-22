import { Link } from "react-router-dom";
import { CodeBlock } from "@/components/docs/CodeBlock";
import { DocsCallout, DocsSection, DocsTable, DocsTitle, InlineCode } from "@/components/docs/DocsProse";

const claudeCodeAdd = `claude mcp add feedbackkit -- feedbackkit mcp

# Or without a global install:
claude mcp add feedbackkit -- npx -y feedbackkit-cli mcp`;

const claudeCodeScoped = `# Available to just this project, checked into .claude/.mcp.json (scoped to project ID)
claude mcp add --scope project feedbackkit -- feedbackkit mcp --project <project-id>

# Available to you across every project
claude mcp add --scope user feedbackkit -- feedbackkit mcp`;

const codexCliAdd = `codex mcp add feedbackkit -- feedbackkit mcp

# Or without a global install:
codex mcp add feedbackkit -- npx -y feedbackkit-cli mcp`;

const codexToml = `[mcp_servers.feedbackkit]
command = "feedbackkit"
args = ["mcp"]`;

const codexTomlNpx = `[mcp_servers.feedbackkit]
command = "npx"
args = ["-y", "feedbackkit-cli", "mcp"]`;

const antigravityJson = `{
  "mcpServers": {
    "feedbackkit": {
      "command": "feedbackkit",
      "args": ["mcp"]
    }
  }
}`;

const antigravityJsonNpx = `{
  "mcpServers": {
    "feedbackkit": {
      "command": "npx",
      "args": ["-y", "feedbackkit-cli", "mcp"]
    }
  }
}`;

const mcpJson = `{
  "mcpServers": {
    "feedbackkit": {
      "type": "stdio",
      "command": "feedbackkit",
      "args": ["mcp"]
    }
  }
}`;

const mcpJsonNpx = `{
  "mcpServers": {
    "feedbackkit": {
      "type": "stdio",
      "command": "npx",
      "args": ["-y", "feedbackkit-cli", "mcp"]
    }
  }
}`;

const projectScopedJson = `{
  "mcpServers": {
    "feedbackkit": {
      "command": "feedbackkit",
      "args": ["mcp", "--project", "<project-id>"]
    }
  }
}`;

const projectScopedEnvJson = `{
  "mcpServers": {
    "feedbackkit": {
      "command": "feedbackkit",
      "args": ["mcp"],
      "env": {
        "FEEDBACKKIT_PROJECT_ID": "<project-id>"
      }
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

      <DocsSection title="Codex">
        <p>Register via the Codex CLI:</p>
        <CodeBlock code={codexCliAdd} label="Terminal" />
        <p>
          Or configure manually in <InlineCode>~/.codex/config.toml</InlineCode> (user-wide) or{" "}
          <InlineCode>.codex/config.toml</InlineCode> (project-specific):
        </p>
        <CodeBlock code={codexToml} label="config.toml" />
        <p>Or with <InlineCode>npx</InlineCode> if not installed globally:</p>
        <CodeBlock code={codexTomlNpx} label="config.toml (npx)" />
        <p>
          Manage registered servers anytime with <InlineCode>codex mcp list</InlineCode>,{" "}
          <InlineCode>codex mcp remove feedbackkit</InlineCode>, or via the Codex UI under{" "}
          <span className="font-medium text-neutral-900">Settings &gt; MCP Settings</span>.
        </p>
      </DocsSection>

      <DocsSection title="Antigravity">
        <p>
          Add FeedbackKit to your <InlineCode>mcp_config.json</InlineCode> — either globally in{" "}
          <InlineCode>~/.gemini/config/mcp_config.json</InlineCode> or project-scoped in{" "}
          <InlineCode>.agents/mcp_config.json</InlineCode>:
        </p>
        <CodeBlock code={antigravityJson} label="mcp_config.json" />
        <p>Or with <InlineCode>npx</InlineCode> if not installed globally:</p>
        <CodeBlock code={antigravityJsonNpx} label="mcp_config.json (npx)" />
        <p>
          In the Antigravity IDE, you can also open the agent panel, click the menu (
          <InlineCode>...</InlineCode>), and select{" "}
          <span className="font-medium text-neutral-900">MCP Servers &gt; Manage MCP Servers</span> to view raw config
          or verify connected tools.
        </p>
      </DocsSection>

      <DocsSection title="Other agents">
        <p>
          Most other MCP-compatible tools (Cursor, Windsurf, and others) accept a similar JSON config,
          typically in a <InlineCode>mcp.json</InlineCode>-style file:
        </p>
        <CodeBlock code={mcpJson} label="mcp.json" />
        <p>Or with <InlineCode>npx</InlineCode> if not installed globally:</p>
        <CodeBlock code={mcpJsonNpx} label="mcp.json (npx)" />
        <DocsCallout>
          The exact file location and surrounding config shape varies by tool and changes over time —
          check that tool's own MCP documentation for where this block goes.
        </DocsCallout>
      </DocsSection>

      <DocsSection title="Scoping to a single project">
        <p>
          By default, the MCP server can access all projects your account has permissions for. If you are developing a specific repository or app and want to prevent the agent from pulling from other projects or wasting tokens, you can scope the server to a specific project ID via <InlineCode>--project &lt;id&gt;</InlineCode> (or <InlineCode>--project-id &lt;id&gt;</InlineCode>):
        </p>
        <CodeBlock code={projectScopedJson} label="mcp_config.json" />
        <p>
          Alternatively, pass the project ID via the <InlineCode>FEEDBACKKIT_PROJECT_ID</InlineCode> environment variable:
        </p>
        <CodeBlock code={projectScopedEnvJson} label="mcp_config.json (env)" />
        <p>
          When scoped to a project, <InlineCode>list_feedback</InlineCode> automatically filters to that project, and queries for other projects or items outside that project are rejected.
        </p>
      </DocsSection>

      <DocsSection title="Tools it exposes">
        <DocsTable
          columns={["Tool", "What it does"]}
          rows={[
            ["list_projects", "List projects the logged-in user is a member of (or the scoped project)."],
            ["list_feedback", "List feedback, optionally filtered by project_id/status (scoped project enforced)."],
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
