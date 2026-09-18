import { LegalPageLayout, LegalSection } from "@/components/LegalPageLayout";

export function PrivacyPage() {
  return (
    <LegalPageLayout title="Privacy notice" lastUpdated="[fill in date]">
      <LegalSection title="Overview">
        <p>
          FeedbackKit is an iOS SDK that lets an app capture in-app feedback (a
          screenshot, the user&apos;s annotations on it, a text description, and
          basic device/app/screen info) and hand it to the integrating app. The SDK
          never requires this dashboard — delivery of that report is entirely up to
          the developer who embeds it. This notice covers what happens to feedback
          that <em>does</em> get sent here, to the optional hosted dashboard operated
          by <strong>[Your Company Name]</strong>.
        </p>
      </LegalSection>

      <LegalSection title="What gets collected">
        <ul className="list-disc space-y-1 pl-5">
          <li>A raw and an annotated screenshot of the screen the report was filed from.</li>
          <li>The structured shapes (rectangles, arrows, freehand marks, text notes) drawn on it.</li>
          <li>The free-text description the user typed.</li>
          <li>
            Device/app context: OS name and version, device model, app version/build,
            locale, screen size, and — if the developer set it — the current screen
            name.
          </li>
        </ul>
        <p className="mt-2">
          The SDK does not collect anything beyond what&apos;s visible on screen at
          capture time and the fields above. Whether that screen happens to contain
          personal data depends entirely on the integrating app.
        </p>
      </LegalSection>

      <LegalSection title="How it's stored and who can see it">
        <p>
          Reports are stored in a Postgres database and object storage bucket,
          scoped per organization/project with row-level security — an
          organization&apos;s members can only read feedback submitted to projects
          that organization owns. [Your Company Name] does not itself review
          feedback content; it flows directly to the project&apos;s dashboard
          organization.
        </p>
      </LegalSection>

      <LegalSection title="Third parties">
        <p>
          Hosting/storage/auth infrastructure is provided by Supabase. No feedback
          content is shared with any other third party.
        </p>
      </LegalSection>

      <LegalSection title="Retention and deletion">
        <p>
          [Describe how long feedback is retained and how an organization or an end
          user can request deletion.]
        </p>
      </LegalSection>

      <LegalSection title="Contact">
        <p>Questions about this notice: [contact email].</p>
      </LegalSection>
    </LegalPageLayout>
  );
}
