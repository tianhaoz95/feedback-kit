import Foundation

/// Configuration for the optional built-in submission path (`FeedbackSubmitter`).
///
/// None of this is required to use FeedbackKit's capture/annotate/return flow —
/// only set it up if you want the SDK to also deliver reports to the companion
/// web dashboard for you, keyed by the project you created there.
public struct FeedbackKitConfiguration: Sendable {
    /// The ingestion endpoint of your FeedbackKit dashboard deployment,
    /// e.g. `https://<your-project>.supabase.co/functions/v1/ingest-feedback`.
    public var endpointURL: URL
    /// The project key from the dashboard's Project settings page. This identifies
    /// which project (and therefore which developer account) feedback is routed to.
    /// It is safe to embed in a shipped app binary — it is a routing key, not a secret.
    public var projectKey: String

    public init(endpointURL: URL, projectKey: String) {
        self.endpointURL = endpointURL
        self.projectKey = projectKey
    }
}
