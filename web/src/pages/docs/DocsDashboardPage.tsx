import { Link } from "react-router-dom";
import { CodeBlock } from "@/components/docs/CodeBlock";
import { DocsCallout, DocsList, DocsSection, DocsTable, DocsTitle, InlineCode } from "@/components/docs/DocsProse";

const template = `Fix the bug shown in the attached screenshot, on the {{screen_name}} screen.

User's report: {{feedback_text}}

Device: {{device_model}}, {{os_name}} {{os_version}}
App version: {{app_version}} ({{app_build}})
Screenshot: {{screenshot_url}}`;

export function DocsDashboardPage() {
  return (
    <div>
      <DocsTitle
        eyebrow="Web dashboard"
        title="Web dashboard"
        description="An optional hosted dashboard: receive feedback the SDK submits, organize it by
          project, and turn it into a ready-to-paste prompt for a coding agent."
      />

      <DocsSection title="Sign in">
        <p>
          Sign-in is GitHub OAuth only — there's no email/password. Signing in for the first time
          creates your account and an organization automatically, with nothing else to set up.
        </p>
      </DocsSection>

      <DocsSection title="Create a project">
        <p>
          From <InlineCode>Projects</InlineCode>, create a new one and open it. Every project gets a unique{" "}
          <InlineCode>project_key</InlineCode> and an ingestion endpoint URL, presented with both a ready-to-use
          prompt for your AI coding agent and a Swift snippet for manual setup — see{" "}
          <Link to="/docs/ios-sdk#basic-usage" className="link-underline font-medium text-neutral-900">
            the iOS SDK page
          </Link>{" "}
          for what to do with it. Every project also gets a default prompt template automatically, so
          it's useful immediately with zero required setup.
        </p>
      </DocsSection>

      <DocsSection title="Review feedback">
        <p>
          Each report shows the annotated screenshot — omitted if the reporter
          turned it off in the composer&apos;s + menu — the user&apos;s description, environment
          details (OS, device, app version, locale, screen size), and any attachment. Set its status —{" "}
          <InlineCode>new</InlineCode>, <InlineCode>in_progress</InlineCode>, <InlineCode>backlog</InlineCode>, <InlineCode>resolved</InlineCode>, or{" "}
          <InlineCode>wont_fix</InlineCode> — to track it through your workflow.
        </p>
        <p>
          A badge on each report shows where it came from — iOS, macOS, watchOS, or Web. Web reports
          also show the page URL, the browser, and the console errors and failed network requests
          captured before the report (see the <Link to="/docs/web-sdk" className="underline">Web SDK</Link>).
          Switch the screenshot to <strong>Original</strong> to see it without markup, or with the
          markup overlaid live from the stored shapes.
        </p>
        <p>
          Web SDK reports can come from any site that has your project key, since it&apos;s visible in page
          source. List your own sites under <strong>Settings → Allowed web origins</strong> to reject
          the rest; native apps are unaffected.
        </p>
      </DocsSection>

      <DocsSection title="Prompt templates">
        <p>
          This is the dashboard's actual differentiator: a plain-text, per-project template with{" "}
          <InlineCode>{"{{placeholder}}"}</InlineCode> substitution — not a templating language, just
          find-and-replace, so the template itself stays easy to read and hand-edit.
        </p>
        <CodeBlock code={template} label="Prompt template" />
        <DocsTable
          columns={["Placeholder", "Fills in with"]}
          rows={[
            [<InlineCode>{"{{feedback_text}}"}</InlineCode>, "The user's description."],
            [<InlineCode>{"{{screen_name}}"}</InlineCode>, "The screen the report was filed from."],
            [<InlineCode>{"{{os_name}} / {{os_version}}"}</InlineCode>, "e.g. iOS 18.2."],
            [<InlineCode>{"{{device_model}}"}</InlineCode>, "e.g. iPhone16,1."],
            [<InlineCode>{"{{app_version}} / {{app_build}}"}</InlineCode>, "Your app's version/build."],
            [<InlineCode>{"{{locale}}"}</InlineCode>, "The device's locale."],
            [<InlineCode>{"{{screenshot_url}}"}</InlineCode>, "A time-limited signed URL to the annotated screenshot, or \"(screenshot unavailable)\" if the reporter left it out."],
            [<InlineCode>{"{{attachment_url}}"}</InlineCode>, "A signed URL to the attachment, if one was included."],
            [<InlineCode>{"{{products}}"}</InlineCode>, "A formatted list of affected products and their descriptions."],
            [<InlineCode>{"{{platform}}"}</InlineCode>, "Web, iOS, macOS, or watchOS."],
            [<InlineCode>{"{{page_url}} / {{browser}}"}</InlineCode>, "Web reports only: the page the report was filed from, and the browser."],
            [<InlineCode>{"{{console_logs}}"}</InlineCode>, "Web reports only: recent console errors and failed requests, as a code block. If a template uses none of the web placeholders, a \"Web context\" section with all three is appended automatically."],
          ]}
        />
        <p>
          Edit the project's default template anytime in the project's Settings tab — it applies to every new report. A single
          report can also get its own edited override (e.g. to add "also check the caching layer")
          without touching the shared template; reset it to fall back to the live template again. A
          "Copy for coding agent" button copies the rendered result to your clipboard.
        </p>
      </DocsSection>

      <DocsSection title="Teams">
        <p>
          An organization holds projects, and everyone in it sees the same projects and reports. Signing in for
          the first time gives you your own organization; you can belong to as many as you like and switch between
          them from the organization menu next to the logo.
        </p>
        <p>
          To add someone, open <InlineCode>Team</InlineCode>, create an invite link and send it to them. Links work
          once and expire after 7 days. Add an email to make sure only that person can use it (they need to sign in
          to GitHub with that email). The person opens the link, signs in with GitHub, and joins.
        </p>
        <DocsTable
          columns={["", "Owner", "Member"]}
          rows={[
            ["See and triage projects and reports", "✓", "✓"],
            ["Invite people, change roles, remove members", "✓", ""],
            ["Rename or delete the organization, change the plan", "✓", ""],
            ["Leave the organization", "✓ (if another owner remains)", "✓"],
          ]}
        />
        <DocsCallout>
          Row-level security in Postgres is what keeps one organization's data away from another's, and the
          membership rules (for example, an organization always keeps at least one owner) are enforced in the
          database, not only in the UI.
        </DocsCallout>
      </DocsSection>

      <DocsSection title="The fix loop on a report">
        <p>
          Next to <strong>Status</strong>, a report shows its <strong>Fix</strong> stage (Agent working → PR open →
          Merged → Shipped → Verified, or Reopened), which moves on its own as agents, GitHub, releases and the
          reporter act. The report&apos;s <strong>Fix loop</strong> panel has the timeline, a box for notes or a question
          to the reporter, and:
        </p>
        <DocsList
          items={[
            <>
              <strong>Send to agent</strong> and <strong>Run on my machine</strong>, the hands-off ways to start a coding
              agent. <Link to="/docs/agents" className="underline">Hand reports to an agent</Link> explains each route.
            </>,
            <>
              A hint when a report sits too long at one stage: an agent claimed it a day ago with no pull request, it
              merged days ago but no build announced it, or it shipped a week ago and the reporter hasn&apos;t answered.
            </>,
            <>
              <strong>Mark verified</strong>, for a shipped fix whose reporter can&apos;t be asked (they didn&apos;t choose
              &ldquo;Notify me when it&apos;s fixed&rdquo;) or hasn&apos;t answered. The timeline and notifications say the
              team marked it, not the reporter.
            </>,
          ]}
        />
      </DocsSection>

      <DocsSection title="Closed loop setup">
        <p>
          Until every piece of the loop works, the Feedback tab starts with a <strong>Closed loop setup</strong>{" "}
          checklist, checked against what has actually happened in the project: reports arrive, reporters can be asked,
          GitHub is connected, an agent picks reports up, fixes get linked, builds are announced, and a reporter has
          confirmed a fix. Each open step says what to do and links to the right tab. A missing piece otherwise fails
          quietly: fixes just sit at <strong>Merged</strong>.
        </p>
      </DocsSection>

      <DocsSection title="Notifications">
        <p>
          The bell in the header shows what happened across all your organizations, live: new reports, replies from
          reporters, reports reopened as still broken, fixes the reporter confirmed, fixes merged, and people joining.
          You're never notified about something you did yourself.
        </p>
        <p>
          <strong>Watch</strong> a report (on its page here, or the eye in the Portal) to also hear about every other
          step of its fix: an agent picking it up, a pull request opening, the fix shipping, notes and questions.
          Watching is just for you; anyone in the organization can watch any report.
        </p>
        <p>
          On the <InlineCode>Notifications</InlineCode> page you can mute any of those, turn on desktop notifications
          for this browser (shown while a dashboard tab is open), and choose whether the Developer Portal app on your
          iPhone or iPad gets push notifications. The Portal's Activity tab shows the same list.
        </p>
      </DocsSection>

      <DocsSection title="Billing">
        <p>
          Billing is per organization, and every plan includes the whole fix loop. The Free plan is for one person:
          1 project, 1 member and 50 readable reports a month. Reports past that are kept but locked (the reporter
          never notices) until next month or an upgrade, and Free screenshots and attachments are deleted after 90
          days. Projects show a warning from 40 reports on, and Billing shows the usage. Indie is a flat $9 a month or
          $79 a year with unlimited projects and reports and up to 3 members; upgrading unlocks every locked report.
          New organizations start with a 14-day Indie trial. Larger teams are priced case by case: email us. Only
          owners can change the plan.
        </p>
      </DocsSection>

      <DocsSection title="CLI access">
        <p>
          The <InlineCode>CLI access</InlineCode> page (in the dashboard's header once signed in) lists any
          CLIs or MCP servers that have logged in as you, with a way to revoke one. See{" "}
          <Link to="/docs/cli" className="link-underline font-medium text-neutral-900">
            the CLI page
          </Link>{" "}
          for how that login works.
        </p>
        <DocsCallout>
          Revoking a CLI session there stops it the next time it checks in — see that page for the
          exact guarantee.
        </DocsCallout>
      </DocsSection>

      <DocsSection title="Your account">
        <p>
          <strong>Account</strong> (your name in the header) shows the GitHub account connected for Copilot and lets you
          delete your FeedbackKit account. Deleting it also deletes every organization where you&apos;re the only member,
          with its projects and reports; organizations you share keep their data. You can&apos;t delete it while you&apos;re
          the only owner of a shared organization, or while an organization that would be deleted has a paid plan.
          The Portal app has the same option in Settings.
        </p>
      </DocsSection>

      <DocsSection title="Self-hosting">
        <p>
          The dashboard is a static site (Vite + React) backed by Supabase (Postgres, Auth, Storage,
          one Edge Function) — clone the repo and point it at your own Supabase project if you'd
          rather run it yourself than use a shared instance. See{" "}
          <a
            href="https://github.com/tianhaoz95/feedback-kit/blob/main/README.md"
            target="_blank"
            rel="noreferrer"
            className="link-underline font-medium text-neutral-900"
          >
            the repo's README
          </a>{" "}
          for local setup and deployment.
        </p>
      </DocsSection>
    </div>
  );
}
