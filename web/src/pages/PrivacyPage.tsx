import { LegalPageLayout, LegalSection } from "@/components/LegalPageLayout";
import { COMPANY_NAME, SUPPORT_EMAIL } from "@/lib/company";

const LAST_UPDATED = "September 26, 2026";

export function PrivacyPage() {
  return (
    <LegalPageLayout title="Privacy notice" lastUpdated={LAST_UPDATED}>
      <LegalSection title="Who we are">
        <p>
          FeedbackKit is operated by <strong>{COMPANY_NAME}</strong> (&quot;we&quot;, &quot;us&quot;). This notice
          explains what personal data the hosted FeedbackKit service collects, why, and what you can do about it.
          The service includes the dashboard at this website, the FeedbackKit Portal apps for iOS and macOS, the
          ingestion and update endpoints the SDKs talk to, and the <code>feedbackkit</code> command-line tool and
          MCP server.
        </p>
        <p className="mt-2">
          The FeedbackKit SDKs (iOS, macOS, watchOS and web) never require the hosted service: a developer can
          send reports anywhere. This notice only covers data that is sent to our hosted service.
        </p>
      </LegalSection>

      <LegalSection title="Two kinds of people, two roles">
        <ul className="list-disc space-y-1 pl-5">
          <li>
            <strong>Customers</strong> are developers and their teams who sign in to FeedbackKit. For their account
            data, we are the controller.
          </li>
          <li>
            <strong>Reporters</strong> are people using a customer&apos;s app or website who send feedback through
            it. For report data, the customer who embedded FeedbackKit decides what is collected and why; we process
            it on their behalf. Reporters with questions about a report should contact that app&apos;s developer
            first; we will help where we can.
          </li>
        </ul>
      </LegalSection>

      <LegalSection title="What we collect from customers">
        <ul className="list-disc space-y-1 pl-5">
          <li>
            <strong>Your GitHub sign-in:</strong> your GitHub user id, username, display name, email address and
            avatar, as provided by GitHub when you sign in. We don&apos;t offer password accounts.
          </li>
          <li>
            <strong>Workspace data:</strong> your organizations, projects, members and roles, invitations,
            prompt templates, product settings, notification preferences, and the comments and status changes you
            make on reports.
          </li>
          <li>
            <strong>Connected tools:</strong> records of command-line sessions you authorize (so you can revoke
            them), project release tokens (stored only as hashes), and, if you connect your GitHub account for
            Copilot, a GitHub access token that only our servers can read. The Portal iOS app stores a device push
            token so we can send you notifications.
          </li>
          <li>
            <strong>Billing:</strong> if you subscribe, our payment processor (Stripe) handles your card; we store
            your plan, subscription status and Stripe customer id, never card numbers.
          </li>
          <li>
            <strong>Product analytics:</strong> which pages of the dashboard you open and which features you use
            (for example &quot;created a project&quot; or &quot;copied a prompt&quot;), linked to your account, plus
            page views by signed-out visitors without any account. We record these in our own database: no
            third-party trackers, no advertising, no cookies for analytics, and no IP addresses. We don&apos;t record
            anything when your browser sends Do Not Track or Global Privacy Control.
          </li>
        </ul>
      </LegalSection>

      <LegalSection title="What a report contains">
        <p>When a reporter sends feedback to a project on our service, the report can include:</p>
        <ul className="mt-2 list-disc space-y-1 pl-5">
          <li>A screenshot of the screen they were on (raw and annotated) and the shapes and notes they drew.</li>
          <li>Their written description and any file they chose to attach.</li>
          <li>
            Device and app context: OS and version, device model, app version and build, locale, screen size, and
            the screen name if the app provides it.
          </li>
          <li>
            For websites: the page URL (with sensitive query parameters removed), browser and user agent, and,
            unless turned off, recent console warnings and errors and the method, URL and status of failed network
            requests (never request or response bodies).
          </li>
          <li>
            A random identifier created on their device or browser, so the developer can ask them &quot;is it
            fixed?&quot; later, and, only if the app&apos;s developer provides them, a user id, name or email.
          </li>
          <li>
            Replies they send later from the app: answers to a developer&apos;s question, and whether a fix worked,
            with a new screenshot if they say it didn&apos;t.
          </li>
        </ul>
        <p className="mt-2">
          What appears in a screenshot depends entirely on the customer&apos;s app. Customers are responsible for
          telling their users about feedback collection and for not capturing sensitive information.
        </p>
      </LegalSection>

      <LegalSection title="How we use data">
        <ul className="list-disc space-y-1 pl-5">
          <li>To run the service: store reports, show them to the right organization, and send notifications.</li>
          <li>
            To carry out actions customers ask for, such as creating GitHub issues, handing a report to a coding
            agent, announcing releases, and asking reporters to confirm fixes.
          </li>
          <li>To bill paid plans, enforce plan limits and prevent abuse (for example rate limits on submissions).</li>
          <li>To understand how the product is used and improve it (the analytics above).</li>
          <li>To answer support requests and send essential service messages.</li>
        </ul>
        <p className="mt-2">
          We don&apos;t sell personal data, show ads, or use report content to train AI models. We don&apos;t read
          report content except when a customer asks us to help with a problem, or when the law requires it.
        </p>
      </LegalSection>

      <LegalSection title="Coding agents and GitHub">
        <p>
          FeedbackKit doesn&apos;t send reports to AI providers itself. When a customer hands a report to a coding
          agent (Claude Code, Codex, GitHub Copilot or another tool), that agent receives the report through the
          customer&apos;s own account with that provider, under that provider&apos;s terms. When a customer connects
          GitHub, FeedbackKit creates issues in the customer&apos;s repository containing the report, and may store
          the screenshot in that repository.
        </p>
      </LegalSection>

      <LegalSection title="Service providers">
        <p>We use these providers to run the service, each only for its part:</p>
        <ul className="mt-2 list-disc space-y-1 pl-5">
          <li>Supabase: database, file storage, authentication and server functions.</li>
          <li>Cloudflare: hosting and delivery of this website.</li>
          <li>GitHub: sign-in, and the repository integration customers choose to connect.</li>
          <li>Stripe: payments, for customers on paid plans.</li>
          <li>Apple Push Notification service: notifications to the Portal iOS app.</li>
        </ul>
        <p className="mt-2">
          Data may be processed in the United States and other countries where these providers operate.
        </p>
      </LegalSection>

      <LegalSection title="Who can see what">
        <p>
          Reports and workspace data are visible only to members of the organization that owns the project, enforced
          by row-level security in the database. Reporters see only their own reports&apos; updates, in the app they
          reported from. Data is encrypted in transit.
        </p>
      </LegalSection>

      <LegalSection title="Retention and deletion">
        <ul className="list-disc space-y-1 pl-5">
          <li>
            Reports stay until the customer deletes them, their project or their organization; deleting a project or
            organization deletes its reports and screenshots.
          </li>
          <li>
            You can delete your account at any time from Account settings in the dashboard or the Portal app. This
            removes your profile, memberships, connected tokens and analytics events, and any organization where you
            are the only member.
          </li>
          <li>Backups made by our infrastructure provider expire on their own schedule, typically within weeks.</li>
          <li>
            Reporters can ask the app&apos;s developer to delete a report, or write to us and we will pass the request
            on or handle it.
          </li>
        </ul>
      </LegalSection>

      <LegalSection title="Your rights">
        <p>
          Depending on where you live, you may have the right to access, correct, export or delete your personal data,
          and to object to or restrict some processing. Email us to exercise these rights; we will respond within 30
          days. You may also complain to your local data protection authority.
        </p>
      </LegalSection>

      <LegalSection title="Children">
        <p>The service is for developers and is not directed at children under 13.</p>
      </LegalSection>

      <LegalSection title="Changes">
        <p>
          We will update this notice when the service changes and change the date above. For significant changes we
          will also tell signed-in customers in the dashboard.
        </p>
      </LegalSection>

      <LegalSection title="Contact">
        <p>
          {COMPANY_NAME} — <a href={`mailto:${SUPPORT_EMAIL}`} className="underline">{SUPPORT_EMAIL}</a>
        </p>
      </LegalSection>
    </LegalPageLayout>
  );
}
