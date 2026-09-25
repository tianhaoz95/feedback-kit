import { Link } from "react-router-dom";
import { CodeBlock } from "@/components/docs/CodeBlock";
import { DocsCallout, DocsSection, DocsTable, DocsTitle, InlineCode } from "@/components/docs/DocsProse";

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
          toggled it off before submitting, see the SDK's docs — the user's description, environment
          details (OS, device, app version, locale, screen size), and any attachment. Set its status —{" "}
          <InlineCode>new</InlineCode>, <InlineCode>in_progress</InlineCode>, <InlineCode>resolved</InlineCode>, or{" "}
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
          An organization can have multiple members (owners and members) sharing its projects and
          feedback — row-level security is what actually enforces that one organization can never see
          another's data, not application-level checks. There's no organization switcher yet, so the
          dashboard assumes one membership per user for now.
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
