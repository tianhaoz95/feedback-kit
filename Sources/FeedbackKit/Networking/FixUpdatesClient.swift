import Foundation

/// Talks to the `reporter-updates` Edge Function — the reporter's side of the
/// closed loop: fetch what happened to this device's reports, and answer
/// back (it's fixed / still broken / a reply to a question).
///
/// Like `FeedbackSubmitter`, this is plain transport with no UI; the built-in
/// prompt (`FeedbackKit.enableFixVerification`) sits on top of it, and apps
/// that want their own UI can call it directly. Wire format mirrors
/// supabase/functions/reporter-updates/index.ts and web-sdk/src/fixes.ts.
public enum FixUpdatesClient {
    public enum Action: Sendable {
        /// The reporter confirmed the shipped fix works.
        case verify
        /// Still broken — optionally with a fresh report (text + annotated screenshot).
        case reopen(FeedbackReport?)
        /// An answer to the developer's/agent's question, or extra detail.
        case reply(String)
    }

    /// Reports filed from this install that need the reporter's attention on
    /// the build it's running. Completion is called on the main queue.
    public static func fetch(
        configuration: FeedbackKitConfiguration,
        completion: @escaping @Sendable (Result<[FixUpdate], FeedbackSubmissionError>) -> Void
    ) {
        let reporterID = FeedbackReporterIdentity.current
        let build = FeedbackReporterIdentity.currentBuild
        guard var components = URLComponents(url: configuration.resolvedReporterUpdatesURL, resolvingAgainstBaseURL: true) else {
            DispatchQueue.main.async { completion(.failure(.encodingFailed)) }
            return
        }
        var items = components.queryItems ?? []
        items.append(URLQueryItem(name: "project_key", value: configuration.projectKey))
        items.append(URLQueryItem(name: "reporter_id", value: reporterID))
        if let build { items.append(URLQueryItem(name: "build", value: build)) }
        components.queryItems = items
        guard let url = components.url else {
            DispatchQueue.main.async { completion(.failure(.encodingFailed)) }
            return
        }

        URLSession.shared.dataTask(with: url) { data, response, error in
            let result: Result<[FixUpdate], FeedbackSubmissionError>
            if let error {
                result = .failure(.network(error))
            } else if let http = response as? HTTPURLResponse, !(200..<300).contains(http.statusCode) {
                result = .failure(.server(statusCode: http.statusCode))
            } else if let data, let decoded = try? JSONDecoder().decode(UpdatesResponse.self, from: data) {
                result = .success(decoded.updates)
            } else {
                result = .failure(.encodingFailed)
            }
            DispatchQueue.main.async { completion(result) }
        }.resume()
    }

    /// Sends the reporter's answer for one report. Completion is called on the main queue.
    public static func send(
        _ action: Action,
        for feedbackID: String,
        configuration: FeedbackKitConfiguration,
        completion: (@Sendable (Result<Void, FeedbackSubmissionError>) -> Void)? = nil
    ) {
        let reporterID = FeedbackReporterIdentity.current
        let build = FeedbackReporterIdentity.currentBuild
        var request = URLRequest(url: configuration.resolvedReporterUpdatesURL)
        request.httpMethod = "POST"
        request.setValue("application/json", forHTTPHeaderField: "Content-Type")
        let body = ActionPayload(
            projectKey: configuration.projectKey,
            reporterID: reporterID,
            feedbackID: feedbackID,
            action: action,
            build: build
        )
        guard let encoded = try? JSONEncoder().encode(body) else {
            DispatchQueue.main.async { completion?(.failure(.encodingFailed)) }
            return
        }
        request.httpBody = encoded

        URLSession.shared.dataTask(with: request) { _, response, error in
            let result: Result<Void, FeedbackSubmissionError>
            if let error {
                result = .failure(.network(error))
            } else if let http = response as? HTTPURLResponse, (200..<300).contains(http.statusCode) {
                result = .success(())
            } else {
                result = .failure(.server(statusCode: (response as? HTTPURLResponse)?.statusCode ?? -1))
            }
            DispatchQueue.main.async { completion?(result) }
        }.resume()
    }

    private struct UpdatesResponse: Decodable {
        let updates: [FixUpdate]
    }

    /// snake_case wire shape, kept out of the public API like `IngestPayload`.
    struct ActionPayload: Encodable {
        let projectKey: String
        let reporterID: String
        let feedbackID: String
        let action: Action
        let build: String?

        enum CodingKeys: String, CodingKey {
            case projectKey = "project_key"
            case reporterID = "reporter_id"
            case feedbackID = "feedback_id"
            case action, text, build, annotations
            case screenshotRawPNG = "screenshot_raw_png_base64"
            case screenshotAnnotatedPNG = "screenshot_annotated_png_base64"
        }

        func encode(to encoder: Encoder) throws {
            var c = encoder.container(keyedBy: CodingKeys.self)
            try c.encode(projectKey, forKey: .projectKey)
            try c.encode(reporterID, forKey: .reporterID)
            try c.encode(feedbackID, forKey: .feedbackID)
            try c.encodeIfPresent(build, forKey: .build)
            switch action {
            case .verify:
                try c.encode("verify", forKey: .action)
            case .reply(let text):
                try c.encode("reply", forKey: .action)
                try c.encode(text, forKey: .text)
            case .reopen(let report):
                try c.encode("reopen", forKey: .action)
                if let report {
                    try c.encode(report.text, forKey: .text)
                    // `Data` encodes as base64 by default, same as IngestPayload.
                    try c.encodeIfPresent(report.screenshotRawPNG, forKey: .screenshotRawPNG)
                    try c.encodeIfPresent(report.screenshotAnnotatedPNG, forKey: .screenshotAnnotatedPNG)
                    try c.encode(report.annotations, forKey: .annotations)
                }
            }
        }
    }
}

extension FeedbackKitConfiguration {
    /// `reporterUpdatesURL` if set, else the `reporter-updates` function next
    /// to the ingestion endpoint (`…/functions/v1/ingest-feedback` →
    /// `…/functions/v1/reporter-updates`).
    public var resolvedReporterUpdatesURL: URL {
        if let reporterUpdatesURL { return reporterUpdatesURL }
        return endpointURL.deletingLastPathComponent().appendingPathComponent("reporter-updates")
    }
}
