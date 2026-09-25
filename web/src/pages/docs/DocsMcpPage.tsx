import { Link } from "react-router-dom";
import { CodeBlock } from "@/components/docs/CodeBlock";
import { DocsCallout, DocsSection, DocsTable, DocsTitle, InlineCode } from "@/components/docs/DocsProse";

const claudeCodeAdd = `claude mcp add feedbackkit -- feedbackkit mcp

# Or without a global install:
claude mcp add feedbackkit -- npx -y feedbackkit-cli mcp`;

const claudeCodeScoped = `# Available to just this project, checked into .claude/.mcp.json (scoped to project ID)
claude mcp add --scope project feedbackkit -- feedbackkit mcp --project <project-id>

# Or with npx:
claude mcp add --scope project feedbackkit -- npx -y feedbackkit-cli mcp --project <project-id>

# Available to you across every project
claude mcp add --scope user feedbackkit -- feedbackkit mcp`;

const codexCliAdd = `codex mcp add feedbackkit -- feedbackkit mcp

# Or scoped to a specific project:
codex mcp add feedbackkit -- feedbackkit mcp --project <project-id>

# Or without a global install:
codex mcp add feedbackkit -- npx -y feedbackkit-cli mcp --project <project-id>`;

const codexToml = `[mcp_servers.feedbackkit]
command = "feedbackkit"
args = ["mcp"]`;

const codexTomlScoped = `# In .codex/config.toml (scoped to this project):
[mcp_servers.feedbackkit]
command = "feedbackkit"
args = ["mcp", "--project", "<project-id>"]`;

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

const antigravityJsonScoped = `// In .agents/mcp_config.json (scoped to this project):
{
  "mcpServers": {
    "feedbackkit": {
      "command": "feedbackkit",
      "args": ["mcp", "--project", "<project-id>"]
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

const mcpJsonScoped = `// In mcp.json (scoped to this project):
{
  "mcpServers": {
    "feedbackkit": {
      "type": "stdio",
      "command": "feedbackkit",
      "args": ["mcp", "--project", "<project-id>"]
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
        <DocsCallout>
          Want an AI coding agent to configure MCP for you automatically? You can use the{" "}
          <Link to="/docs/skills" className="font-semibold underline">
            setup-mcp-server Agent Skill
          </Link>
          : <InlineCode>npx skills add feedback-kit-skills --skill setup-mcp-server --yes</InlineCode>.
        </DocsCallout>
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
        <p>To scope Codex to a specific project, pass <InlineCode>--project &lt;project-id&gt;</InlineCode>:</p>
        <CodeBlock code={codexTomlScoped} label=".codex/config.toml (project-scoped)" />
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
        <p>To scope Antigravity to a specific project, pass <InlineCode>--project &lt;project-id&gt;</InlineCode>:</p>
        <CodeBlock code={antigravityJsonScoped} label=".agents/mcp_config.json (project-scoped)" />
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
          Most other MCP-compatible tools (Cursor, Windsurf, Claude Desktop, and others) accept a similar JSON config,
          typically in a <InlineCode>mcp.json</InlineCode>-style file:
        </p>
        <CodeBlock code={mcpJson} label="mcp.json" />
        <p>To scope to a specific project, pass <InlineCode>--project &lt;project-id&gt;</InlineCode>:</p>
        <CodeBlock code={mcpJsonScoped} label="mcp.json (project-scoped)" />
        <p>Or with <InlineCode>npx</InlineCode> if not installed globally:</p>
        <CodeBlock code={mcpJsonNpx} label="mcp.json (npx)" />
        <DocsCallout>
          The exact file location and surrounding config shape varies by tool and changes over time —
          check that tool's own MCP documentation for where this block goes.
        </DocsCallout>
      </DocsSection>

      <DocsSection title="Scoping to a single project">
        <p>
          By default, the MCP server can access all projects your account has permissions for. When developing a specific repository or app, scoping the MCP server to that project ID prevents the agent from pulling from other projects or wasting context tokens on them.
        </p>
        <p>
          Pass <InlineCode>--project &lt;id&gt;</InlineCode> (or <InlineCode>--project-id &lt;id&gt;</InlineCode>) in the server arguments for your agent:
        </p>

        <div className="space-y-4 pt-2">
          <div>
            <h4 className="text-xs font-semibold uppercase tracking-wider text-neutral-500">Claude Code</h4>
            <div className="mt-1">
              <CodeBlock code={`claude mcp add --scope project feedbackkit -- feedbackkit mcp --project <project-id>`} label="Terminal" />
            </div>
          </div>

          <div>
            <h4 className="text-xs font-semibold uppercase tracking-wider text-neutral-500">Codex</h4>
            <div className="mt-1">
              <CodeBlock code={codexTomlScoped} label=".codex/config.toml" />
            </div>
          </div>

          <div>
            <h4 className="text-xs font-semibold uppercase tracking-wider text-neutral-500">Antigravity</h4>
            <div className="mt-1">
              <CodeBlock code={antigravityJsonScoped} label=".agents/mcp_config.json" />
            </div>
          </div>

          <div>
            <h4 className="text-xs font-semibold uppercase tracking-wider text-neutral-500">Cursor, Windsurf, Claude Desktop & Other Agents</h4>
            <div className="mt-1">
              <CodeBlock code={mcpJsonScoped} label="mcp.json" />
            </div>
          </div>

          <div>
            <h4 className="text-xs font-semibold uppercase tracking-wider text-neutral-500">Environment Variable Alternative</h4>
            <p className="mt-1 text-xs text-neutral-600">
              Any agent that supports environment variables can also pass the project ID via <InlineCode>FEEDBACKKIT_PROJECT_ID</InlineCode>:
            </p>
            <div className="mt-1">
              <CodeBlock code={projectScopedEnvJson} label="mcp.json (env)" />
            </div>
          </div>
        </div>

        <p className="pt-2">
          When scoped to a project:
        </p>
        <ul className="list-disc space-y-1 pl-5 text-sm text-neutral-600">
          <li><InlineCode>list_projects</InlineCode> only returns that specific project.</li>
          <li><InlineCode>list_feedback</InlineCode> automatically defaults to that project and rejects queries for other project IDs.</li>
          <li><InlineCode>get_feedback</InlineCode> and <InlineCode>get_prompt</InlineCode> only return reports belonging to that project.</li>
          <li><InlineCode>update_feedback_status</InlineCode> only allows modifying items belonging to that project.</li>
        </ul>
      </DocsSection>

      <DocsSection title="Tools it exposes">
        <DocsTable
          columns={["Tool", "What it does"]}
          rows={[
            ["list_projects", "List projects the logged-in user is a member of (or the scoped project)."],
            ["list_feedback", "List feedback, optionally filtered by project_id/status/fix_stage (scoped project enforced)."],
            ["get_feedback", "Full detail for one report plus its timeline, with the annotated screenshot — and the reporter's latest \"still broken\" screenshot — as images the agent can see."],
            ["get_prompt", "The generated (or developer-edited) coding-agent prompt for one report, plus how to report back so the fix reaches the reporter."],
            ["claim_feedback", "Tell the team the agent has started on a report."],
            ["post_update", "Add a progress note — optionally shown to the reporter on their device."],
            ["ask_reporter", "Ask the reporter a clarifying question; it appears in the app on their device and the answer lands in the timeline."],
            ["link_fix", "Record the PR/commit and a one-line summary the reporter sees. Automatic for PRs containing \"FeedbackKit: <id>\"."],
            ["attach_after_screenshot", "Attach a screenshot of the fixed screen (e.g. from a simulator) for before/after review."],
            ["get_docs", "FeedbackKit's own documentation — e.g. how to add the SDK to an iOS app. Doesn't require being logged in."],
            ["update_feedback_status", "Set triage status. For code fixes, prefer link_fix — the reporter's confirmation resolves it."],
          ]}
        />
        <p>
          The write tools are deliberately narrow: an agent can claim a report, post progress, ask the
          reporter a question and link its fix — but there's no tool to mark a fix verified. Only the person
          who reported the bug can, on their own device, once the fix ships in a build they're running (
          <InlineCode>feedbackkit release</InlineCode>). If they say it's still broken, the report comes back
          with their new screenshot.
        </p>
      </DocsSection>

      <DocsSection title="Example prompts">
        <p>
          Once connected, you can just ask your agent to use it:
        </p>
        <CodeBlock code={`Look at feedback report <id> in FeedbackKit and fix it.`} label="You, to your agent" />
        <p>
          The agent calls <InlineCode>get_prompt</InlineCode>, gets back the same rendered prompt you'd otherwise
          copy from the dashboard, claims the report, and puts <InlineCode>FeedbackKit: &lt;id&gt;</InlineCode> in
          its PR so the fix is tracked through to the reporter. To work the queue:
        </p>
        <CodeBlock code={`Fix the reopened FeedbackKit reports first, then the newest ones.`} label="You, to your agent" />
        <p>
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
