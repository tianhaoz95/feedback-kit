import type { ReactNode } from "react";
import { Link } from "react-router-dom";
import { CodeBlock } from "@/components/docs/CodeBlock";
import { DocsCallout, DocsSection, DocsTable, DocsTitle, InlineCode } from "@/components/docs/DocsProse";
import { LIFECYCLE_STEPS, LifecycleLoop, LifecyclePlayer, LifecycleScene } from "@/components/docs/Lifecycle";

const docLink = "link-underline font-medium text-neutral-900";

const sdkSetup = `FeedbackKit.configure(.init(endpointURL: endpoint, projectKey: "pk_live_..."))
FeedbackKit.enableShakeToReport { UIApplication.shared.topMostViewController }
FeedbackKit.enableFixVerification { UIApplication.shared.topMostViewController }`;

const template = `Fix the bug on the {{screen_name}} screen.

User's report: {{feedback_text}}

Device: {{device_model}}, {{os_name}} {{os_version}}
App version: {{app_version}} ({{app_build}})
Screenshot: {{screenshot_url}}`;

const commit = `git commit -m "Keep Pay above the keyboard" \\
  -m "FeedbackKit: fb_8c2" \\
  -m "FeedbackKit-Summary: The Pay button now stays above the keyboard."`;

const tryIt = `# 1. Be the reporter: run your app in the Simulator, shake (⌃⌘Z), circle something, send.

# 2. Be the developer: connect your agent once, then hand it the report.
npm install -g feedbackkit-cli && feedbackkit login
claude mcp add --scope project feedbackkit -- feedbackkit mcp --project <project-id>
#    > Look at the newest FeedbackKit report and fix it.

# 3. Ship it: build and run the fixed app, then announce that build.
feedbackkit release --build <CFBundleVersion>
#    Bring the app to the foreground and the "is it fixed?" card appears.`;

function Step({ index, children }: { index: number; children: ReactNode }) {
  const step = LIFECYCLE_STEPS[index];
  return (
    <DocsSection title={`${index + 1}. ${step.title}`}>
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-[minmax(0,1fr)_minmax(0,1.15fr)] lg:items-center">
        <div className="min-w-0 space-y-4">
          <p className="text-xs font-semibold uppercase tracking-wide text-neutral-400">{step.where}</p>
          {children}
        </div>
        <div className="min-w-0">
          <LifecycleScene step={index} />
        </div>
      </div>
    </DocsSection>
  );
}

export function DocsHowItWorksPage() {
  return (
    <div>
      <DocsTitle
        eyebrow="Start here"
        title="How it works: one bug, start to finish"
        description={
          <>
            Follow a single bug report from the moment a user hits it to the moment the same user taps{" "}
            <em>Yes, it's fixed</em>. Nobody copies, pastes, or chases anyone along the way. The report carries
            what the agent needs, and the fix finds its own way back to the person who reported it.
          </>
        }
      />

      <DocsSection title="The whole loop in one picture">
        <LifecycleLoop />
        <p>
          Most feedback tools stop at the inbox. FeedbackKit keeps going: the dashboard turns the report into a
          prompt, your coding agent fixes it, and the release announces the fix to the reporter's device. The
          report isn't closed when a PR merges. It's closed when the person who hit the bug confirms the fix
          on their own device.
        </p>
      </DocsSection>

      <DocsSection title="Watch it happen">
        <p>
          The same journey, step by step. It plays by itself; click any step to jump to it.
        </p>
        <LifecyclePlayer />
      </DocsSection>

      <Step index={0}>
        <p>
          Someone using your checkout screen notices the Pay button is half under the keyboard. They shake the
          phone (or use the floating button, a menu item, or ⌘⇧F on the web). FeedbackKit captures the window.
          They draw a box around the problem, type one sentence, and tap send.
        </p>
        <p>They never write steps to reproduce, list their device and OS version, or look up the app build. The SDK fills all of that in.</p>
        <CodeBlock code={sdkSetup} label="AppDelegate.swift — everything this loop needs in your app" />
      </Step>

      <Step index={1}>
        <p>
          The report shows up in your project's <b>Feedback</b> tab with the annotated screenshot, the
          sentence they typed, and the context: screen name, device model, OS, app version and build, and locale.
          Web reports also carry the page URL, browser, and recent console errors and failed requests.
        </p>
        <p>
          You don't have to triage it before anything else can happen. Everything after this can run without you.
        </p>
      </Step>

      <Step index={2}>
        <p>
          Each project has a plain-text prompt template. Every <InlineCode>{"{{placeholder}}"}</InlineCode> is
          filled from the report, so the agent gets the whole bug in one message, screenshot link included.
        </p>
        <CodeBlock code={template} label="Default template (editable per project)" />
        <p>
          You can copy the merged prompt from the report page. You usually won't need to, because the agent
          can fetch it directly.
        </p>
      </Step>

      <Step index={3}>
        <p>
          With the <Link to="/docs/mcp" className={docLink}>MCP server</Link> connected, you give your agent one
          sentence. It calls <InlineCode>get_prompt</InlineCode> and sees the annotated screenshot. It calls{" "}
          <InlineCode>claim_feedback</InlineCode> so your team can see it's working on the report. If the report is
          unclear, <InlineCode>ask_reporter</InlineCode> sends a question to the reporter's device. It then makes
          the fix, attaches an after screenshot, and tags the commit with the report id:
        </p>
        <CodeBlock code={commit} label="The one line that links a fix to a report" />
        <p>
          The <Link to="/docs/skills" className={docLink}>fix-feedback skill</Link> packages this whole routine,
          so you don't have to explain it to the agent each time.
        </p>
      </Step>

      <Step index={4}>
        <p>
          With the FeedbackKit GitHub App connected, a PR whose description contains{" "}
          <InlineCode>FeedbackKit: fb_8c2</InlineCode> moves the report to <b>PR open</b>. Merging it moves the
          report to <b>Merged</b>. A trailer on a commit pushed straight to main works too. Without the GitHub
          App, the agent records the PR or commit with <InlineCode>link_fix</InlineCode>.
        </p>
        <p>
          Merged isn't done. The fix isn't in anyone's hands yet, so the loop waits for a release.
        </p>
      </Step>

      <Step index={5}>
        <p>
          After you upload build 42, one command, run by hand or in CI with a release token, checks which merged
          fixes are in that build's commit and marks them <b>Shipped</b>:
        </p>
        <CodeBlock code={`npx feedbackkit-cli release --build 42`} label="Terminal or CI" />
        <p>
          Add it to the end of your release script. The <InlineCode>setup-release-loop</InlineCode> skill can wire
          it in for you. See <Link to="/docs/cli" className={docLink}>CLI</Link> for release tokens and{" "}
          <InlineCode>--dry-run</InlineCode>.
        </p>
      </Step>

      <Step index={6}>
        <p>
          The next time the reporter opens the app on build 42 or newer, FeedbackKit shows them their own
          annotated screenshot, what they wrote, and a one-line summary of what changed. They tap one of two
          buttons:
        </p>
        <DocsTable
          columns={["They tap", "What happens"]}
          rows={[
            [<b>Yes, it's fixed</b>, <>Fix stage → <b>Verified</b>, status → <InlineCode>resolved</InlineCode>. The report is closed by the person who opened it.</>],
            [
              <b>No, still broken</b>,
              <>
                The capture flow opens again so they can show what's still wrong. The report goes to <b>Reopened</b> with
                the new screenshot and, if a GitHub issue is linked, goes back to your coding agent.
              </>,
            ],
          ]}
        />
        <p>
          No account or sign-up is needed. Each install gets an anonymous reporter id. A fix is never shown on a
          build older than the one it shipped in.
        </p>
      </Step>

      <Step index={7}>
        <p>
          The <b>Releases</b> tab shows every build's readiness. For each build it counts the fixes it contains,
          how many reporters have verified, and how many reopened. When every fix in a beta is verified, it's
          marked ready. Promote it from the dashboard or with <InlineCode>feedbackkit promote --build 42</InlineCode>.
        </p>
        <p>
          So you ship to production knowing that the people who reported these bugs have confirmed the fixes,
          not just that the tests pass.
        </p>
      </Step>

      <DocsSection title="What moves each stage">
        <p>You never set a fix stage by hand. Each one is moved by something that already happens in your workflow.</p>
        <DocsTable
          columns={["Stage", "Moved by", "Where you see it"]}
          rows={[
            ["Reported", "The SDK submitting a report", "Feedback tab"],
            ["Agent working", <>The agent calling <InlineCode>claim_feedback</InlineCode></>, "Report page · fix loop"],
            ["PR open → Merged", <>GitHub, from the <InlineCode>FeedbackKit: &lt;id&gt;</InlineCode> trailer (or <InlineCode>link_fix</InlineCode>)</>, "Report page · fix loop"],
            ["Shipped", <><InlineCode>feedbackkit release --build N</InlineCode></>, "Report page · Releases tab"],
            ["Verified / Reopened", "The reporter, on their device", "Everywhere, and the agent's queue"],
          ]}
        />
      </DocsSection>

      <DocsSection title="What you set up to get here">
        <p>Each of these is a one-time setup, and each piece is useful without the rest:</p>
        <DocsTable
          columns={["Piece", "Setup", "Guide"]}
          rows={[
            ["Your app", <>SDK + a trigger + <InlineCode>enableFixVerification</InlineCode></>, <Link to="/docs/ios-sdk" className={docLink}>SDK</Link>],
            ["Dashboard", "Sign in with GitHub, create a project", <Link to="/docs/dashboard" className={docLink}>Dashboard</Link>],
            ["Your agent", <>One <InlineCode>feedbackkit mcp</InlineCode> line in its config</>, <Link to="/docs/mcp" className={docLink}>MCP</Link>],
            ["GitHub (optional)", "Connect the GitHub App in project Settings", <Link to="/docs/dashboard" className={docLink}>Dashboard</Link>],
            ["Releases", <><InlineCode>feedbackkit release</InlineCode> after each upload</>, <Link to="/docs/cli" className={docLink}>CLI</Link>],
          ]}
        />
        <DocsCallout>
          Don't want to wire it up by hand? The <Link to="/docs/skills" className="font-medium underline">Agent Skills</Link>{" "}
          <InlineCode>setup-ios-sdk</InlineCode> and <InlineCode>setup-release-loop</InlineCode> ask your coding agent to
          set it up for you.
        </DocsCallout>
      </DocsSection>

      <DocsSection title="Try the loop yourself">
        <p>
          The quickest way to understand it is to play both roles: the reporter in a simulator and the developer
          in your terminal. The loop is finished when the simulator asks you whether your own bug is fixed.
        </p>
        <CodeBlock code={tryIt} label="Terminal" />
      </DocsSection>
    </div>
  );
}
