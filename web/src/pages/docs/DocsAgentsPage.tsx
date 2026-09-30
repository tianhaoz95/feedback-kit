import type { ReactNode } from "react";
import { Link } from "react-router-dom";
import { CodeBlock } from "@/components/docs/CodeBlock";
import { DocsCallout, DocsList, DocsSection, DocsTable, DocsTitle, InlineCode } from "@/components/docs/DocsProse";

const docLink = "font-medium text-neutral-900 underline decoration-neutral-300 underline-offset-2 hover:decoration-neutral-900";

const trailer = `Fix the checkout total overlapping the Pay button

FeedbackKit: 366544e1-b123-4878-9c16-e8cdc643370f
FeedbackKit-Summary: The total no longer sits under the Pay button.`;

const hostedWorkflow = `on:
  issues:
    types: [labeled]
jobs:
  agent:
    if: github.event.label.name == 'claude'
    runs-on: ubuntu-latest            # GitHub's hosted Linux runner
    permissions: { contents: write, issues: write, pull-requests: write, id-token: write }
    steps:
      - uses: actions/checkout@v4
      - uses: anthropics/claude-code-action@v1
        with:
          claude_code_oauth_token: \${{ secrets.CLAUDE_CODE_OAUTH_TOKEN }}
          label_trigger: claude
          allowed_bots: feedbackkit-app   # FeedbackKit's GitHub App adds the label`;

const watchCommand = `cd path/to/your/repo
npx feedbackkit-cli watch --project <project-id>              # Claude Code
npx feedbackkit-cli watch --project <project-id> --agent codex`;

/** One route's journey through the loop, as a two-column table. */
function RouteSteps({ rows }: { rows: [string, ReactNode][] }) {
  return <DocsTable columns={["Step", "What happens"]} rows={rows.map(([step, what]) => [<b key={step}>{step}</b>, what])} />;
}

export function DocsAgentsPage() {
  return (
    <div>
      <DocsTitle
        eyebrow="Closed loop"
        title="Hand reports to an agent"
        description={
          <>
            There are five ways to get a coding agent working on a report. They differ only in how the agent is started
            and where it runs; every one of them ends in the same loop: the fix is linked to the report, ships in a
            build, and the reporter confirms it.
          </>
        }
      />

      <DocsSection title="Pick a route">
        <DocsTable
          columns={["Route", "Starts when", "Agent runs on", "Can build iOS/macOS apps", "You set up"]}
          rows={[
            [
              <a href="#you-and-your-agent-mcp" className={docLink}>You and your agent (MCP)</a>,
              "You ask your agent to fix a report",
              "Your machine",
              "Yes",
              <Link to="/docs/mcp" className={docLink}>The MCP server</Link>,
            ],
            [
              <a href="#github-hosted-actions" className={docLink}>GitHub-hosted Actions</a>,
              <><b>Send to agent</b> adds a label to the report's GitHub issue</>,
              "GitHub's runners (Linux, or macOS for Antigravity)",
              "Only Antigravity on a macOS runner",
              <>A workflow with an agent&apos;s GitHub Action, or the <InlineCode>setup-agent-runner</InlineCode> skill for Antigravity</>,
            ],
            [
              <a href="#self-hosted-mac-runner" className={docLink}>Self-hosted Mac runner</a>,
              <><b>Send to agent</b> adds a label</>,
              "A Mac you control",
              "Yes, and it can run the Simulator",
              <>The <InlineCode>setup-agent-runner</InlineCode> skill (Claude Code or Antigravity)</>,
            ],
            [
              <a href="#github-copilot" className={docLink}>GitHub Copilot</a>,
              <><b>Send to agent</b> assigns the issue to Copilot</>,
              "GitHub's Linux runners (or your own Linux runners)",
              "No",
              "A Copilot seat and your connected GitHub account",
            ],
            [
              <a href="#your-machine-feedbackkit-watch" className={docLink}>Your machine (feedbackkit watch)</a>,
              <><b>Run on my machine</b> on the report</>,
              "Your laptop or Mac",
              "Yes",
              <>
                <InlineCode>feedbackkit watch</InlineCode> running in the repo
              </>,
            ],
          ]}
        />
        <p>
          Not sure? Web apps and backends work well on GitHub-hosted runners. For an iOS or macOS app, use the
          self-hosted Mac runner (a team), Antigravity on a GitHub-hosted macOS runner (no Mac to spare), or{" "}
          <InlineCode>feedbackkit watch</InlineCode> (one developer), because only a Mac can build the app and run it
          to check the fix.
        </p>
      </DocsSection>

      <DocsSection title="What every route shares">
        <p>Whatever starts the agent, the rest of the loop is the same:</p>
        <ol className="list-decimal space-y-2 pl-5">
          <li>
            <b>The fix is linked to the report.</b> The fix commit or pull request carries the report's id, which the
            prompt, the GitHub issue and every template ask the agent to add:
            <CodeBlock code={trailer} label="Commit message (or PR description)" />
            With the FeedbackKit GitHub App connected, a PR containing that line moves the report to <b>PR open</b>,
            and merging it to <b>Merged</b>. A PR that closes the report&apos;s GitHub issue (<InlineCode>Fixes #12</InlineCode>)
            is linked too. Without the GitHub App, <InlineCode>feedbackkit link</InlineCode> or the agent&apos;s{" "}
            <InlineCode>link_fix</InlineCode> tool records it.
          </li>
          <li>
            <b>A build ships it.</b> Your release pipeline runs <InlineCode>feedbackkit release --build N</InlineCode>{" "}
            (the <InlineCode>setup-release-loop</InlineCode> skill wires it in), and every merged fix in that build
            moves to <b>Shipped</b>. With <Link to="/docs/delivery?delivery=branch" className={docLink}>branch previews</Link>,
            a preview build of the PR does this before it merges.
          </li>
          <li>
            <b>The reporter confirms it</b>, if they chose <b>Notify me when it&apos;s fixed</b> in the composer&apos;s
            + menu (off by default). They see &ldquo;is it fixed?&rdquo; next time they open a build with the fix:{" "}
            <b>Yes</b> moves it to <b>Verified</b>, <b>No</b> to <b>Reopened</b> with a new screenshot. For a reporter
            who didn&apos;t opt in, the report page offers <b>Mark verified</b> once you&apos;ve checked it yourself.
          </li>
        </ol>
        <DocsCallout>
          The project page&apos;s <b>Closed loop setup</b> checklist shows which of these pieces is missing, and a
          report that sits too long at one stage (claimed with no PR, merged but never shipped) says so on its page.
        </DocsCallout>
      </DocsSection>

      <DocsSection title="You and your agent (MCP)">
        <p>
          The simplest route: with the <Link to="/docs/mcp" className={docLink}>MCP server</Link> connected, tell
          your agent &ldquo;Look at FeedbackKit report &lt;id&gt; and fix it&rdquo;. The{" "}
          <InlineCode>fix-feedback</InlineCode> skill packages the steps.
        </p>
        <RouteSteps
          rows={[
            ["Start", <>You, in Claude Code, Codex, Cursor or Antigravity. Or paste the prompt copied from the report page, which includes the report id and these steps.</>],
            ["Claimed", <>The agent calls <InlineCode>claim_feedback</InlineCode>: <b>Agent working</b>.</>],
            ["While fixing", <><InlineCode>ask_reporter</InlineCode> for something only the reporter knows, <InlineCode>attach_preview</InlineCode> (a screenshot or short video of the fixed app) when it can run it.</>],
            ["Linked", <>The <InlineCode>FeedbackKit:</InlineCode> line on the commit or PR, or <InlineCode>link_fix</InlineCode>.</>],
          ]}
        />
      </DocsSection>

      <DocsSection title="GitHub-hosted Actions">
        <p>
          Hands-off, on GitHub&apos;s own runners. <b>Send to agent</b> creates a GitHub issue for the report (screenshot,
          environment, the prompt and the <InlineCode>FeedbackKit:</InlineCode> line) and adds the dispatch labels from
          project Settings → <b>Coding agent loop</b>. A workflow in your repo listens for that label:
        </p>
        <CodeBlock code={hostedWorkflow} label=".github/workflows/claude.yml" />
        <RouteSteps
          rows={[
            ["Start", <><b>Send to agent</b> on the report (or a reporter&apos;s &ldquo;still broken&rdquo;, which re-adds the label).</>],
            ["Runs", <>Claude&apos;s GitHub Action on <InlineCode>ubuntu-latest</InlineCode>, with the issue as its task. Any agent with a GitHub Action works the same way.</>],
            ["Claimed", <>The report moves to <b>Agent working</b> when it&apos;s sent. The FeedbackKit MCP tools aren&apos;t available: hosted runners have no FeedbackKit login.</>],
            ["Linked", <>The agent&apos;s pull request carries the <InlineCode>FeedbackKit:</InlineCode> line or closes the issue.</>],
          ]}
        />
        <DocsCallout tone="warning">
          <InlineCode>allowed_bots: feedbackkit-app</InlineCode> is required: FeedbackKit&apos;s GitHub App adds the
          label, and Claude&apos;s action refuses runs started by a bot that isn&apos;t listed. Linux runners can&apos;t build
          iOS or macOS apps, so for those the agent edits code without running it.
        </DocsCallout>
        <h3 className="mt-8 text-base font-semibold text-neutral-900">Google Antigravity on GitHub&apos;s runners</h3>
        <p>
          The <Link to="/docs/skills" className={docLink}><InlineCode>setup-agent-runner</InlineCode> skill</Link> has a
          template that installs Antigravity&apos;s CLI on a fresh GitHub-hosted runner for each report: a macOS runner
          to build an iOS or macOS app, or Linux for a web app. Nothing to register or keep running, and it&apos;s fine on
          a public repository.
        </p>
        <DocsList
          items={[
            <>
              <b>Signs in with a Gemini API key</b> (a <InlineCode>GEMINI_API_KEY</InlineCode> secret), billed per token
              to that key&apos;s Google project. A Google AI Pro or Ultra subscription only covers Antigravity&apos;s
              interactive sign-in, so to use one, run Antigravity on a self-hosted Mac instead.
            </>,
            <>
              <b>What it may do</b> is an allow list the workflow writes before each run, so it&apos;s reviewed in your
              repository. As on a Mac, a command that isn&apos;t allowed ends the run, and the workflow says which.
            </>,
            <>
              <b>Git:</b> the agent only edits files; the workflow commits with the <InlineCode>FeedbackKit:</InlineCode>{" "}
              line and <InlineCode>Fixes #n</InlineCode>, pushes and opens the PR. No FeedbackKit MCP tools (they need a
              login).
            </>,
          ]}
        />
        <DocsCallout tone="warning">
          The agent can read its own environment, API key included, and report text is written by your users. Use a
          key from a Google project that exists only for this, with a spending cap.
        </DocsCallout>
      </DocsSection>

      <DocsSection title="Self-hosted Mac runner">
        <p>
          The same label, but the job runs on a Mac you register as a GitHub Actions runner, so the agent can build the
          app, run it in the Simulator and attach a screenshot of the fix, using your own agent subscription. The{" "}
          <Link to="/docs/skills" className={docLink}><InlineCode>setup-agent-runner</InlineCode> skill</Link> sets it
          up and has a workflow template for each agent:
        </p>
        <DocsTable
          columns={["", "Claude Code", "Google Antigravity"]}
          rows={[
            ["Signs in with", <>A <InlineCode>CLAUDE_CODE_OAUTH_TOKEN</InlineCode> or API key secret</>, <>A one-time interactive <InlineCode>agy</InlineCode> login as the runner&apos;s user</>],
            ["What it may do", <><InlineCode>--allowedTools</InlineCode> in the workflow</>, <>Allow rules in the runner user&apos;s Antigravity settings; a command that isn&apos;t allowed ends the run</>],
            ["Git", "The action commits and pushes its branch", "The agent only edits files; the workflow commits, pushes and opens the PR"],
            ["FeedbackKit MCP tools", "Yes, with a feedbackkit login on the runner", <>Yes, with a login plus <InlineCode>mcp(feedbackkit/&lt;tool&gt;)</InlineCode> allow rules</>],
          ]}
        />
        <RouteSteps
          rows={[
            ["Start", <><b>Send to agent</b> (or a reopen). Use a different label per agent if both workflows are installed.</>],
            ["Claimed", <>With the MCP tools, the agent calls <InlineCode>claim_feedback</InlineCode> and reports progress; otherwise the report is at <b>Agent working</b> from the hand-off.</>],
            ["Linked", <>The PR carries the <InlineCode>FeedbackKit:</InlineCode> line and <InlineCode>Fixes #n</InlineCode>.</>],
          ]}
        />
        <DocsCallout tone="warning">
          Use it only on private repositories: GitHub warns that anyone who can open a pull request on a public repo
          could run code on a self-hosted runner.
        </DocsCallout>
      </DocsSection>

      <DocsSection title="GitHub Copilot">
        <p>
          Tick <b>Assign to GitHub Copilot</b> in Settings → <b>Coding agent loop</b>. GitHub only accepts the
          assignment from a person with a Copilot seat, so each teammate connects their GitHub account once (the same
          settings card, or Account), and Copilot runs as whoever pressed <b>Send to agent</b>, on their Copilot plan.
        </p>
        <RouteSteps
          rows={[
            ["Start", <><b>Send to agent</b> creates the issue and assigns it to Copilot. On a reopen, it&apos;s re-assigned as the teammate who sent it last.</>],
            ["Runs", "Copilot's coding agent on GitHub's Linux runners (or your own Linux runners), which opens a pull request."],
            ["Claimed", <><b>Agent working</b> from the hand-off. Copilot doesn&apos;t use the FeedbackKit MCP tools.</>],
            ["Linked", <>Copilot&apos;s PR closes the issue and is asked to include the <InlineCode>FeedbackKit:</InlineCode> line.</>],
          ]}
        />
        <DocsCallout>
          Copilot runs only on Linux, so it can&apos;t build iOS or macOS apps. Hosted FeedbackKit needs the GitHub App&apos;s
          OAuth credentials set before the Connect button works (see the README).
        </DocsCallout>
      </DocsSection>

      <DocsSection title="Your machine (feedbackkit watch)">
        <p>
          For one developer, no CI: keep <InlineCode>feedbackkit watch</InlineCode> running in the repo and press{" "}
          <b>Run on my machine</b> on a report.
        </p>
        <CodeBlock code={watchCommand} label="Terminal" />
        <RouteSteps
          rows={[
            ["Start", <><b>Run on my machine</b> queues the report; the watcher picks it up within about 30 seconds. <InlineCode>--auto</InlineCode> also takes every new report without a click.</>],
            ["Runs", "Your Claude Code or Codex (or any command, with --agent-cmd) in a new git worktree and branch, with the FeedbackKit MCP tools for Claude Code."],
            ["Claimed", <>The watcher claims it: <b>Agent working</b>, with the machine&apos;s name on the timeline.</>],
            ["Linked", <>The watcher pushes the branch, opens a PR with the <InlineCode>FeedbackKit:</InlineCode> line and links it: <b>PR open</b>.</>],
          ]}
        />
        <p>
          The watcher runs at most 10 agent runs a day (<InlineCode>--max-runs</InlineCode>) and stops a run after an
          hour (<InlineCode>--timeout</InlineCode>). <InlineCode>--no-pr</InlineCode> leaves the fix on a local
          branch.
        </p>
      </DocsSection>

      <DocsSection title="Choosing an agent, progress and follow-ups">
        <DocsList
          items={[
            <>
              <b>Pick the agent per report.</b> The report&apos;s send button remembers the agent you used last; its menu
              lists each configured label, the trigger comment, Copilot and <b>Your machine</b> on their own (plus
              <b> All configured agents</b> when there&apos;s more than one), and the supported agents you haven&apos;t
              set up yet, which open their setup steps in Settings → <b>Coding agent loop</b>.
            </>,
            <>
              <b>Screenshots while it works.</b> Agents with the FeedbackKit MCP tools call{" "}
              <InlineCode>attach_preview</InlineCode> with a caption for progress and for the finished fix; the report&apos;s
              timeline refreshes while an agent is at work. In this repository,{" "}
              <InlineCode>node scripts/agent-preview/capture-web.mjs --feedback &lt;id&gt;</InlineCode> captures the
              dashboard at a report&apos;s page and <InlineCode>capture-portal.mjs</InlineCode> the iOS Portal (in the
              Simulator, in demo mode); the Antigravity workflow runs them when a fix arrives without a preview.
            </>,
            <>
              <b>Another pass on the same PR.</b> While a report is at <b>PR open</b>, its Fix loop panel has{" "}
              <b>Keep working on PR #n</b>: your note is posted on the PR and the agent is started on the PR&apos;s
              branch, committing onto the same PR. The Antigravity templates handle this with a{" "}
              <InlineCode>pull_request_target: labeled</InlineCode> trigger; claude-code-action picks up the{" "}
              <InlineCode>@claude</InlineCode> comment; Copilot gets an <InlineCode>@copilot</InlineCode> comment from you.
            </>,
          ]}
        />
      </DocsSection>

      <DocsSection title="When a reporter says it's still broken">
        <DocsList
          items={[
            <>The report goes to <b>Reopened</b> with their new screenshot, and a linked GitHub issue is reopened with it.</>,
            <>Label routes (hosted and self-hosted runners) get the label again, which starts a new run.</>,
            <>Copilot is assigned again, as the teammate who sent it last.</>,
            <>MCP and <InlineCode>feedbackkit watch</InlineCode>: send it again yourself. Agents can find reopened reports with <InlineCode>list_feedback</InlineCode> and <InlineCode>fix_stage: &quot;reopened&quot;</InlineCode>.</>,
          ]}
        />
      </DocsSection>

      <DocsSection title="Keeping unattended agents safe">
        <p>
          Report text is written by your app&apos;s users, so it&apos;s untrusted input to the agent. Every route treats it
          that way:
        </p>
        <DocsList
          items={[
            "The prompt marks the report as a description of a bug, not instructions.",
            <>Unattended agents get a short list of allowed commands (build, test, and for some, <InlineCode>git</InlineCode>), never blanket permission.</>,
            "Agents open pull requests; nothing merges without a person.",
            <><InlineCode>feedbackkit watch</InlineCode> needs a click per report unless you pass <InlineCode>--auto</InlineCode>, which is only for trusted reporters.</>,
          ]}
        />
      </DocsSection>
    </div>
  );
}
