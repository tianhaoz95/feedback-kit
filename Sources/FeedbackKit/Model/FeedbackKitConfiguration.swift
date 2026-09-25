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
    /// Configured products for this project. If empty, FeedbackKit can fetch them
    /// from the backend dynamically using `projectKey`.
    public var products: [FeedbackProduct]
    /// The default product identifier for this app target (e.g. "ios", "macos").
    public var defaultProductKey: String?
    /// Where fix updates for this device's reports come from (the
    /// `reporter-updates` Edge Function). `nil` (the default) derives it from
    /// `endpointURL` — see `resolvedReporterUpdatesURL` — which is right for
    /// the hosted dashboard and any standard self-hosted deployment.
    public var reporterUpdatesURL: URL?

    public init(
        endpointURL: URL,
        projectKey: String,
        products: [FeedbackProduct] = [],
        defaultProductKey: String? = nil,
        reporterUpdatesURL: URL? = nil
    ) {
        self.endpointURL = endpointURL
        self.projectKey = projectKey
        self.products = products
        self.defaultProductKey = defaultProductKey
        self.reporterUpdatesURL = reporterUpdatesURL
    }
}
