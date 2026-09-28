import type { ReactNode } from "react";
import { Link } from "react-router-dom";
import { CodeBlock } from "@/components/docs/CodeBlock";
import { DocsCallout, DocsList, DocsSection, DocsTable, DocsTitle, InlineCode } from "@/components/docs/DocsProse";
import { DocsTabs } from "@/components/docs/DocsTabs";

const docLink = "font-medium text-neutral-900 underline decoration-neutral-300 underline-offset-2 hover:decoration-neutral-900";

const batchWorkflow = `name: Beta
on:
  push:
    branches: [main]            # a beta for every push…
  schedule:
    - cron: "0 */4 * * *"       # …or drop "push" and batch: one beta every 4 hours
jobs:
  beta:
    runs-on: macos-15
    steps:
      - uses: actions/checkout@v4
        with:
          fetch-depth: 0        # the release step checks which fixes are in this build
      # … build and upload the beta (TestFlight, a prerelease, a staging deploy) …
      - run: npx feedbackkit-cli release --build "$BUILD_NUMBER" --channel beta
        env:
          FEEDBACKKIT_RELEASE_TOKEN: \${{ secrets.FEEDBACKKIT_RELEASE_TOKEN }}`;

const batchPromote = `npx feedbackkit-cli releases                 # which beta is ready: verified / waiting / reopened
npx feedbackkit-cli promote --build 202609271200`;

const branchWorkflow = `name: Preview
on:
  pull_request:
    types: [opened, synchronize, reopened]
jobs:
  preview:
    runs-on: macos-15
    steps:
      - uses: actions/checkout@v4
      # … build and upload a preview of this PR: a TestFlight build for your
      #   internal testers, or a preview deploy of your site …
      - run: >-
          npx feedbackkit-cli release --build "$BUILD_NUMBER"
          --channel preview --pr \${{ github.event.pull_request.number }}
        env:
          FEEDBACKKIT_RELEASE_TOKEN: \${{ secrets.FEEDBACKKIT_RELEASE_TOKEN }}`;

function Steps({ rows }: { rows: [string, ReactNode][] }) {
  return (
    <ol className="space-y-3">
      {rows.map(([title, body], i) => (
        <li key={title} className="flex gap-3">
          <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-neutral-900 text-xs font-semibold text-white">
            {i + 1}
          </span>
          <div>
            <p className="font-medium text-neutral-900">{title}</p>
            <div className="mt-0.5 text-neutral-600">{body}</div>
          </div>
        </li>
      ))}
    </ol>
  );
}

function Sub({ title, children }: { title: string; children: ReactNode }) {
  return (
    <div className="mt-8 first:mt-0">
      <h3 className="text-base font-semibold text-neutral-900">{title}</h3>
      <div className="mt-3 space-y-4">{children}</div>
    </div>
  );
}

const batch = (
  <div className="text-sm leading-relaxed text-neutral-700">
    <p>
      Fixes land on your main branch as they&apos;re made and ship together in the next beta. Reporters confirm on the
      beta, and you promote a beta to production once its fixes are verified. It suits small teams: nobody has to
      review a branch build for each fix.
    </p>
    <Sub title="How a fix travels">
      <Steps
        rows={[
          ["The agent commits the fix", <>To main, with <InlineCode>FeedbackKit: &lt;report id&gt;</InlineCode> in the message (or in a PR you merge). The report moves to <b>Merged</b>.</>],
          ["A beta ships it", <>Your beta pipeline (on every push, or every few hours) runs <InlineCode>feedbackkit release --channel beta</InlineCode>; every merged fix in that build moves to <b>Shipped</b>.</>],
          ["The reporter confirms", <>If they chose &ldquo;Notify me when it&apos;s fixed&rdquo;, they&apos;re asked on the beta: <b>Verified</b> or <b>Reopened</b>. Otherwise your team uses <b>Mark verified</b>.</>],
          ["You promote the beta", <>The Releases tab shows each beta&apos;s verified / waiting / reopened counts. Ship the ready one to production, then record it.</>],
        ]}
      />
    </Sub>
    <Sub title="Set it up">
      <DocsList
        items={[
          <>Project <b>Settings → Delivery</b>: <b>Batch</b> (the default).</>,
          <>
            An access token for CI (project Settings → Access tokens → CI release, or <InlineCode>npx feedbackkit-cli token create github-actions --preset ci | gh secret set FEEDBACKKIT_RELEASE_TOKEN</InlineCode>).
          </>,
          <>A beta workflow that announces each build:</>,
        ]}
      />
      <CodeBlock code={batchWorkflow} label=".github/workflows/beta.yml" />
      <p>Promote a verified beta once it&apos;s live in production (App Store Connect, a deploy, …):</p>
      <CodeBlock code={batchPromote} label="Terminal" />
      <DocsCallout>
        The <InlineCode>setup-release-loop</InlineCode> skill does all of this for you: tell your agent &ldquo;set up the
        FeedbackKit release loop&rdquo; and choose <b>Batch</b> when it asks.
      </DocsCallout>
    </Sub>
    <Sub title="Good to know">
      <DocsList
        items={[
          <>Build numbers must increase (UTC timestamps work well) and be the ones in the app binary; that&apos;s how a reporter&apos;s device knows its build has the fix.</>,
          <>A fix is only <b>Shipped</b> in a build whose commit contains it, so a beta from an older commit never claims a fix it doesn&apos;t have.</>,
        ]}
      />
    </Sub>
  </div>
);

const branch = (
  <div className="text-sm leading-relaxed text-neutral-700">
    <p>
      Each fix is checked on a preview build of its pull request before it merges, and GitHub can block the merge until
      it is. It suits larger teams with testers or QA, and repositories where main must stay releasable.
    </p>
    <Sub title="How a fix travels">
      <Steps
        rows={[
          ["The agent opens a pull request", <>Never a direct push to main. The PR description carries <InlineCode>FeedbackKit: &lt;report id&gt;</InlineCode>: <b>PR open</b>. Every agent prompt in this mode says so.</>],
          ["CI builds a preview of the PR", <>A TestFlight build for your internal testers, or a preview deploy of your site, then <InlineCode>feedbackkit release --channel preview --pr &lt;n&gt;</InlineCode>: <b>Shipped</b> in that preview.</>],
          ["Someone checks the preview", <>A tester, QA, or the reporter if they can install the preview, confirms it: <b>Verified</b>. Your team can use <b>Mark verified</b>.</>],
          ["The PR's check turns green", <>A <b>FeedbackKit</b> status on the PR reads &ldquo;1/2 reports verified&rdquo; until all are, then passes; a report reopened as still broken fails it. Merge.</>],
          ["You release main as usual", <>Production builds come from main. The report is already verified, so nothing waits on it.</>],
        ]}
      />
    </Sub>
    <Sub title="Set it up">
      <DocsList
        items={[
          <>Project <b>Settings → Delivery</b>: <b>Branch previews</b>.</>,
          <>
            GitHub → Settings → Developer settings → the FeedbackKit GitHub App → <b>Permissions</b>: <b>Commit statuses: Read and write</b> (the App posts the check).
          </>,
          <>
            Your repository → <b>Settings → Branches</b> → the rule for main → <b>Require status checks</b> → add{" "}
            <b>FeedbackKit</b>. Now a PR can&apos;t merge until its reports are verified.
          </>,
          <>A CI release access token, and a workflow that builds a preview of every PR and announces it:</>,
        ]}
      />
      <CodeBlock code={branchWorkflow} label=".github/workflows/preview.yml" />
      <DocsCallout>
        The <InlineCode>setup-release-loop</InlineCode> skill sets this up too: choose <b>Branch previews</b> when it asks,
        and it explains each step, installs the preview workflow and walks you through the permission and the required
        check.
      </DocsCallout>
    </Sub>
    <Sub title="Good to know">
      <DocsList
        items={[
          <>
            Your app&apos;s public users usually can&apos;t install a preview (a TestFlight branch build reaches only testers;
            a preview deploy has its own URL), so the check before merging is typically done by testers, QA, or the team.
          </>,
          <>Once a report is verified on the preview, it&apos;s done: its reporter isn&apos;t asked again when the fix reaches production.</>,
          <>New commits pushed to the PR after verification keep the check green; reopen the report if a later push breaks it.</>,
          <>Pull requests from forks don&apos;t get your repository&apos;s secrets, so their previews can&apos;t be announced with the access token.</>,
        ]}
      />
    </Sub>
  </div>
);

export function DocsDeliveryPage() {
  return (
    <div>
      <DocsTitle
        eyebrow="Closed loop"
        title="Deliver fixes: batch or branch previews"
        description={
          <>
            Two ways to get a fix from your coding agent to your users. Pick the one that matches how your team ships;
            this page shows only that one.
          </>
        }
      />

      <DocsSection title="Choose how you deliver fixes">
        <DocsTabs
          group="delivery"
          tabs={[
            { id: "batch", label: "Batch", hint: "Fixes ship together in the next beta. Small teams.", content: batch },
            { id: "branch", label: "Branch previews", hint: "Each fix is checked on its PR's preview before merging. Larger teams.", content: branch },
          ]}
        />
      </DocsSection>

      <DocsSection title="What stays the same">
        <DocsTable
          columns={["", "Both modes"]}
          rows={[
            ["Handing reports to an agent", <>Every route on <Link to="/docs/agents" className={docLink}>Hand reports to an agent</Link>; the mode only changes what the agent is told to do with its fix.</>],
            ["Linking the fix", <>The <InlineCode>FeedbackKit: &lt;report id&gt;</InlineCode> line, through the GitHub App.</>],
            ["Who confirms", "The reporter if they chose “Notify me when it's fixed”; otherwise your team with Mark verified."],
          ]}
        />
      </DocsSection>

      <DocsSection title="Switching modes">
        <p>
          Change it any time in <b>Settings → Delivery</b>. Agents get the new instructions with the next prompt, and PRs
          get (or stop getting) the FeedbackKit check with their next update. Reports already in flight keep their stage.
        </p>
      </DocsSection>
    </div>
  );
}
