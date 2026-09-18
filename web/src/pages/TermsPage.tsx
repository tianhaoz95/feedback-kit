import { LegalPageLayout, LegalSection } from "@/components/LegalPageLayout";

export function TermsPage() {
  return (
    <LegalPageLayout title="User agreement" lastUpdated="[fill in date]">
      <LegalSection title="Acceptance of terms">
        <p>
          By creating an account or using the FeedbackKit dashboard operated by{" "}
          <strong>[Your Company Name]</strong> (&quot;the Service&quot;), you agree to
          these terms. If you don&apos;t agree, don&apos;t use the Service.
        </p>
      </LegalSection>

      <LegalSection title="What the Service is">
        <p>
          FeedbackKit is two things: an open-source iOS SDK that developers embed in
          their own apps to capture in-app feedback, and this optional hosted
          dashboard for collecting that feedback and turning it into prompts for a
          coding agent. The SDK never requires the dashboard.
        </p>
      </LegalSection>

      <LegalSection title="Accounts and organizations">
        <p>
          You&apos;re responsible for the activity that happens under your account and
          for keeping your credentials secure. Each project has a key embedded in the
          integrating iOS app — treat it like a secret; anyone with it can submit
          feedback to that project.
        </p>
      </LegalSection>

      <LegalSection title="Acceptable use">
        <p>
          Don&apos;t use the Service to store or transmit content you don&apos;t have the
          right to share, to abuse or overload the ingestion endpoint, or to attempt
          to access another organization&apos;s data.
        </p>
      </LegalSection>

      <LegalSection title="Open source SDK">
        <p>
          The iOS SDK is open source — see its repository for the applicable license.
          These terms govern use of the hosted dashboard, not the SDK itself.
        </p>
      </LegalSection>

      <LegalSection title="Disclaimers">
        <p>
          The Service is provided &quot;as is&quot; without warranties of any kind.
          [Add any additional disclaimers your legal counsel recommends.]
        </p>
      </LegalSection>

      <LegalSection title="Limitation of liability">
        <p>
          [Your Company Name]&apos;s liability arising from use of the Service is
          limited to the maximum extent permitted by law. [Fill in specifics with
          legal review.]
        </p>
      </LegalSection>

      <LegalSection title="Changes to these terms">
        <p>
          These terms may be updated from time to time; continued use of the Service
          after a change constitutes acceptance of the new terms.
        </p>
      </LegalSection>

      <LegalSection title="Contact">
        <p>Questions about these terms: [contact email].</p>
      </LegalSection>
    </LegalPageLayout>
  );
}
