import Foundation

public enum FeedbackSubmissionError: Error, Sendable {
    case notConfigured
    case encodingFailed
    case network(Error)
    case server(statusCode: Int)
}

/// Optional built-in transport that POSTs a `FeedbackReport` to the FeedbackKit
/// dashboard's ingestion endpoint (a Supabase Edge Function). Entirely
/// optional — this is just one way to consume a `FeedbackReport`; nothing
/// about capture/annotation depends on it.
public enum FeedbackSubmitter {
    public static func submit(
        _ report: FeedbackReport,
        configuration: FeedbackKitConfiguration,
        completion: @escaping @Sendable (Result<Void, FeedbackSubmissionError>) -> Void
    ) {
        var request = URLRequest(url: configuration.endpointURL)
        request.httpMethod = "POST"
        request.setValue("application/json", forHTTPHeaderField: "Content-Type")

        guard let body = try? IngestPayload.encoder.encode(IngestPayload(report: report, projectKey: configuration.projectKey)) else {
            completion(.failure(.encodingFailed))
            return
        }
        request.httpBody = body

        URLSession.shared.dataTask(with: request) { _, response, error in
            if let error {
                completion(.failure(.network(error)))
                return
            }
            guard let http = response as? HTTPURLResponse, (200..<300).contains(http.statusCode) else {
                let status = (response as? HTTPURLResponse)?.statusCode ?? -1
                completion(.failure(.server(statusCode: status)))
                return
            }
            completion(.success(()))
        }.resume()
    }
}

/// Wire format sent to the ingestion endpoint. Kept separate from the public
/// `FeedbackReport` model (which uses idiomatic Swift camelCase) so the JSON
/// contract can use conventional snake_case matching the Postgres schema,
/// without leaking wire-format concerns into the SDK's public API.
private struct IngestPayload: Encodable {
    let report: FeedbackReport
    let projectKey: String

    static let encoder: JSONEncoder = {
        let encoder = JSONEncoder()
        encoder.dateEncodingStrategy = .iso8601
        return encoder
    }()

    enum CodingKeys: String, CodingKey {
        case projectKey = "project_key"
        case id, text, annotations, environment
        case createdAt = "created_at"
        case screenshotRawPNG = "screenshot_raw_png_base64"
        case screenshotAnnotatedPNG = "screenshot_annotated_png_base64"
    }

    func encode(to encoder: Encoder) throws {
        var container = encoder.container(keyedBy: CodingKeys.self)
        try container.encode(projectKey, forKey: .projectKey)
        try container.encode(report.id, forKey: .id)
        try container.encode(report.createdAt, forKey: .createdAt)
        try container.encode(report.text, forKey: .text)
        try container.encode(report.screenshotRawPNG, forKey: .screenshotRawPNG)
        try container.encode(report.screenshotAnnotatedPNG, forKey: .screenshotAnnotatedPNG)
        try container.encode(report.annotations, forKey: .annotations)
        try container.encode(report.environment, forKey: .environment)
    }
}
