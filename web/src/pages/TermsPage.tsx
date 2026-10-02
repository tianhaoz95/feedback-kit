import { Link } from "react-router-dom";
import { LegalPageLayout, LegalSection } from "@/components/LegalPageLayout";
import { COMPANY_NAME, SUPPORT_EMAIL } from "@/lib/company";
import { FREE_LIMITS, INDIE_LIMITS, TRIAL_DAYS } from "@/lib/pricing";

const LAST_UPDATED = "October 2, 2026";

export function TermsPage() {
  return (
    <LegalPageLayout title="User agreement" lastUpdated={LAST_UPDATED}>
      <LegalSection title="Agreement">
        <p>
          These terms are an agreement between you and <strong>{COMPANY_NAME}</strong> (&quot;we&quot;,
          &quot;us&quot;) for the hosted FeedbackKit service: the dashboard at this website, the FeedbackKit Portal
          apps, the endpoints the SDKs send reports to, and the <code>feedbackkit</code> command-line tool and MCP
          server (together, &quot;the Service&quot;). If you use the Service for a company, you accept these terms on
          its behalf and confirm you are allowed to. If you don&apos;t agree, don&apos;t use the Service.
        </p>
      </LegalSection>

      <LegalSection title="The Service">
        <p>
          FeedbackKit lets people report problems from inside your app or website with an annotated screenshot, turns
          each report into a task for a coding agent, tracks the fix through to a released build, and asks the
          person who reported it to confirm the fix. The SDKs work without the Service; these terms cover the hosted
          Service only. How we handle personal data is described in the{" "}
          <Link to="/privacy" className="underline">
            privacy notice
          </Link>
          .
        </p>
      </LegalSection>

      <LegalSection title="Accounts and organizations">
        <p>
          You sign in with GitHub and are responsible for activity under your account. Work is organized into
          organizations; owners control membership and billing, and are responsible for who they invite. A
          project&apos;s key is embedded in your app and is not a secret: anyone who has it can submit reports to that
          project. Use allowed origins, plan limits and archiving to manage unwanted submissions, and tell us if a key
          is being abused.
        </p>
      </LegalSection>

      <LegalSection title="Your data and your users">
        <p>
          You own the content you and your users submit (&quot;Customer Data&quot;). You give us permission to host,
          process and display it only to provide and improve the Service and as you direct (for example, creating
          GitHub issues or handing reports to a coding agent). You are responsible for having the right to collect
          Customer Data, for telling your users about feedback collection as required by law, and for configuring the
          SDK so it doesn&apos;t capture information you shouldn&apos;t send to us, such as passwords, payment card
          numbers or health data.
        </p>
      </LegalSection>

      <LegalSection title="Coding agents and connected services">
        <p>
          The Service can hand reports to coding agents and connect to GitHub and other tools you choose. Those tools
          are provided by third parties under their own terms, and you are responsible for your accounts with them
          and their costs. Agents can change code: review every change before you merge or release it. Report text
          comes from your users and may contain instructions aimed at an agent; configure the permissions of any
          agent you run automatically accordingly. We are not responsible for changes an agent makes.
        </p>
      </LegalSection>

      <LegalSection title="Acceptable use">
        <p>Don&apos;t use the Service to:</p>
        <ul className="mt-2 list-disc space-y-1 pl-5">
          <li>break the law or infringe anyone&apos;s rights, or store content you don&apos;t have the right to share;</li>
          <li>send malware, spam, or content designed to attack coding agents or other users;</li>
          <li>probe, overload or get around the Service&apos;s limits and security, or access another organization&apos;s data;</li>
          <li>resell the Service or build a competing hosted service from it.</li>
        </ul>
        <p className="mt-2">We may suspend accounts or projects that do, and will tell you why unless the law prevents it.</p>
      </LegalSection>

      <LegalSection title="Plans, fees and limits">
        <p>
          The Free plan includes {FREE_LIMITS.projects} project, {FREE_LIMITS.members} member and{" "}
          {FREE_LIMITS.reportsPerMonth} readable reports per month. Reports past that limit are still stored but stay
          locked until the next month&apos;s limit or an upgrade, and on the Free plan screenshots and attachments are
          deleted {FREE_LIMITS.retentionDays} days after a report arrives (the report&apos;s text is kept). New
          organizations start with a {TRIAL_DAYS}-day Indie trial and move to Free when it ends unless they subscribe.
          The Indie plan is billed in advance, monthly or yearly, at a flat price through Stripe, and renews until
          cancelled. It includes up to {INDIE_LIMITS.members} members and {INDIE_LIMITS.storageGb} GB of stored
          screenshots and attachments as fair use; past that, new reports keep their text but not their media. Larger
          teams are priced by agreement. You can cancel at any time; the plan stays active until the end of the paid
          period. Fees are non-refundable except where the law requires otherwise. Prices exclude taxes. We will give
          at least 30 days&apos; notice of a price increase for an existing subscription.
        </p>
      </LegalSection>

      <LegalSection title="Software licenses">
        <p>
          The FeedbackKit SDKs, command-line tool and source code are source-available under the PolyForm Perimeter
          License 1.0.1, as stated in the repository. These terms govern the hosted Service, not your use of that
          code.
        </p>
      </LegalSection>

      <LegalSection title="Suggestions">
        <p>If you send us ideas or feedback about FeedbackKit, we may use them without obligation to you.</p>
      </LegalSection>

      <LegalSection title="Ending the agreement">
        <p>
          You can stop using the Service and delete your account at any time. We may end or suspend the Service for
          you if you materially breach these terms, or end the Service for everyone with at least 30 days&apos; notice,
          in which case you can export your data before it is deleted and we will refund any prepaid, unused fees.
        </p>
      </LegalSection>

      <LegalSection title="Disclaimers">
        <p>
          The Service is provided &quot;as is&quot; and &quot;as available&quot;. To the extent the law allows, we
          disclaim all warranties, express or implied, including merchantability, fitness for a particular purpose
          and non-infringement, and we don&apos;t promise that the Service will be uninterrupted or error-free, or
          that any fix suggested or made by a coding agent will be correct.
        </p>
      </LegalSection>

      <LegalSection title="Limitation of liability">
        <p>
          To the extent the law allows, neither party is liable for indirect, incidental, special, consequential or
          punitive damages, or for lost profits, revenue or data, and our total liability for any claim relating to
          the Service is limited to the greater of the amount you paid us in the 12 months before the claim and
          US$100. Nothing here limits liability that cannot be limited by law.
        </p>
      </LegalSection>

      <LegalSection title="Indemnity">
        <p>
          You will defend and indemnify us against third-party claims arising from Customer Data or from your use of
          the Service in breach of these terms.
        </p>
      </LegalSection>

      <LegalSection title="Changes to these terms">
        <p>
          We may update these terms. We will change the date above and, for material changes, tell signed-in customers
          at least 30 days in advance. Continuing to use the Service after a change takes effect means you accept it.
        </p>
      </LegalSection>

      <LegalSection title="General">
        <p>
          These terms, the privacy notice and any order form are the whole agreement between us about the Service. If
          a provision is unenforceable, the rest still applies. Neither party may transfer this agreement without the
          other&apos;s consent, except to a successor of its business.
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
