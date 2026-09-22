import { Link } from "react-router-dom";
import { CodeBlock } from "@/components/docs/CodeBlock";
import { DocsSection, DocsTable, DocsTitle, InlineCode } from "@/components/docs/DocsProse";

const installGlobal = `npm install -g feedbackkit-cli`;

const runNpx = `npx feedbackkit-cli login`;

const installSource = `git clone https://github.com/tianhaoz95/feedback-kit
cd feedback-kit/cli
npm install
npm run build
npm link   # puts \`feedbackkit\` on your PATH`;

const login = `feedbackkit login`;

const localDev = `feedbackkit login --dashboard-url http://localhost:3000`;

export function DocsCliPage() {
  return (
    <div>
      <DocsTitle
        eyebrow="CLI"
        title="CLI"
        description="A command-line client for the dashboard — read feedback and generated prompts from a
          terminal, authenticated as your own account."
      />

      <DocsSection title="Install">
        <p>
          Install <InlineCode>feedbackkit-cli</InlineCode> globally via npm to get the{" "}
          <InlineCode>feedbackkit</InlineCode> and <InlineCode>feedbackkit-cli</InlineCode> commands on
          your <InlineCode>PATH</InlineCode>:
        </p>
        <CodeBlock code={installGlobal} label="Terminal" />
        <p>
          Or run commands directly without installing via <InlineCode>npx</InlineCode>:
        </p>
        <CodeBlock code={runNpx} label="Terminal" />
        <p>You can also build and link from source if you're developing on the CLI locally:</p>
        <CodeBlock code={installSource} label="Terminal" />
      </DocsSection>

      <DocsSection title="Log in">
        <p>
          Opens your browser to authorize the CLI, signing in with GitHub first if you aren't
          already. It hands the CLI your real dashboard session — not a separate token you have to
          generate and paste — so it can only see what your account can see.
        </p>
        <CodeBlock code={login} label="Terminal" />
        <p>Point it at a local dashboard instead of the hosted one during development:</p>
        <CodeBlock code={localDev} label="Terminal" />
      </DocsSection>

      <DocsSection title="Commands">
        <DocsTable
          columns={["Command", "What it does"]}
          rows={[
            [<InlineCode>feedbackkit login [--dashboard-url &lt;url&gt;]</InlineCode>, "Sign in via your browser."],
            [<InlineCode>feedbackkit logout</InlineCode>, "Remove locally stored credentials."],
            [<InlineCode>feedbackkit whoami</InlineCode>, "Show the signed-in user."],
            [<InlineCode>feedbackkit projects</InlineCode>, "List projects you're a member of."],
            [
              <InlineCode>feedbackkit list [--project &lt;id&gt;] [--status &lt;status&gt;]</InlineCode>,
              "List feedback reports, optionally filtered.",
            ],
            [<InlineCode>feedbackkit prompt &lt;feedbackId&gt;</InlineCode>, "Print the generated coding-agent prompt for one report."],
            [
              <InlineCode>feedbackkit docs [topic]</InlineCode>,
              "Print this documentation — no topic lists topics. Doesn't require being logged in.",
            ],
            [<InlineCode>feedbackkit mcp [--project &lt;id&gt;]</InlineCode>, "Run an MCP server over stdio, optionally scoped to one project — see the next page."],
          ]}
        />
        <p className="text-neutral-600">
          <InlineCode>--status</InlineCode> accepts <InlineCode>new</InlineCode>, <InlineCode>in_progress</InlineCode>,{" "}
          <InlineCode>resolved</InlineCode>, or <InlineCode>wont_fix</InlineCode>.
        </p>
      </DocsSection>

      <DocsSection title="Asking it how to use FeedbackKit itself">
        <p>
          <InlineCode>feedbackkit docs</InlineCode> prints this same documentation — the SDK (including
          how to add it to an iOS/macOS/watchOS app), the dashboard, the CLI, and MCP itself — as
          plain text, without leaving the terminal:
        </p>
        <CodeBlock code="feedbackkit docs sdk" label="Terminal" />
        <p>
          The same content is exposed as an MCP tool (<InlineCode>get_docs</InlineCode>, see the next page),
          so a connected coding agent can answer "how do I add FeedbackKit to my iOS app?" from real,
          current documentation instead of guessing.
        </p>
      </DocsSection>

      <DocsSection title="Managing access">
        <p>
          Credentials live at <InlineCode>~/.feedbackkit/credentials.json</InlineCode> (owner-only permissions).
          See which CLIs are connected, and revoke one, from the dashboard's{" "}
          <Link to="/docs/dashboard" className="link-underline font-medium text-neutral-900">
            CLI access page
          </Link>
          . Revoking there is cooperative — the CLI checks its own status before doing work and clears
          its local credentials if revoked, rather than an instant kill of the underlying session.
        </p>
      </DocsSection>
    </div>
  );
}
