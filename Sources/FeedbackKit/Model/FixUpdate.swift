import Foundation

/// Optional identity for the person using the host app, attached to every
/// report they file (`FeedbackKit.user`). Entirely up to the app — nothing
/// here is required for the fix-verification loop, which works off an
/// anonymous per-install id (`FeedbackKit.reporterID`) instead.
public struct FeedbackUser: Codable, Equatable, Sendable {
    public var id: String?
    public var email: String?
    public var name: String?

    public init(id: String? = nil, email: String? = nil, name: String? = nil) {
        self.id = id
        self.email = email
        self.name = name
    }
}

/// Something that happened to a report this device filed, fetched by
/// `FeedbackKit.checkForFixUpdates`: a fix that shipped in a build this
/// device is already running ("is it fixed?"), and/or a question from the
/// developer or their coding agent.
///
/// Mirrors the `reporter-updates` Edge Function's response
/// (supabase/functions/reporter-updates/index.ts) and web-sdk/src/fixes.ts.
public struct FixUpdate: Decodable, Equatable, Sendable, Identifiable {
    public struct Question: Decodable, Equatable, Sendable {
        public let id: String
        public let body: String
        public let createdAt: String

        enum CodingKeys: String, CodingKey {
            case id, body
            case createdAt = "created_at"
        }
    }

    /// One timeline entry the developer chose to show the reporter.
    public struct Message: Decodable, Equatable, Sendable, Identifiable {
        public let id: String
        /// e.g. `"comment"`, `"question"`, `"shipped"`, `"reporter_reply"`.
        public let kind: String
        public let body: String
        /// `"you"` for the reporter's own messages, otherwise who sent it.
        public let author: String
        public let createdAt: String

        enum CodingKeys: String, CodingKey {
            case id, kind, body, author
            case createdAt = "created_at"
        }
    }

    /// The report's id — the same value as the original `FeedbackReport.id`.
    public let feedbackID: String
    /// What the reporter originally wrote.
    public let text: String
    public let createdAt: String
    public let screenName: String?
    public let fixStage: String?
    public let fixedInBuild: String?
    /// A one-line, plain-language description of the fix, if the developer or agent wrote one.
    public let fixSummary: String?
    /// True when a fix has shipped in a build this device is running and the reporter hasn't confirmed it yet.
    public let needsVerification: Bool
    public let openQuestion: Question?
    /// Short-lived signed URL of the original annotated screenshot.
    public let screenshotURL: URL?
    public let messages: [Message]

    public var id: String { feedbackID }

    enum CodingKeys: String, CodingKey {
        case text, messages
        case feedbackID = "feedback_id"
        case createdAt = "created_at"
        case screenName = "screen_name"
        case fixStage = "fix_stage"
        case fixedInBuild = "fixed_in_build"
        case fixSummary = "fix_summary"
        case needsVerification = "needs_verification"
        case openQuestion = "open_question"
        case screenshotURL = "screenshot_url"
    }

    public init(from decoder: Decoder) throws {
        let c = try decoder.container(keyedBy: CodingKeys.self)
        feedbackID = try c.decode(String.self, forKey: .feedbackID)
        text = try c.decodeIfPresent(String.self, forKey: .text) ?? ""
        createdAt = try c.decodeIfPresent(String.self, forKey: .createdAt) ?? ""
        screenName = try c.decodeIfPresent(String.self, forKey: .screenName)
        fixStage = try c.decodeIfPresent(String.self, forKey: .fixStage)
        fixedInBuild = try c.decodeIfPresent(String.self, forKey: .fixedInBuild)
        fixSummary = try c.decodeIfPresent(String.self, forKey: .fixSummary)
        needsVerification = try c.decodeIfPresent(Bool.self, forKey: .needsVerification) ?? false
        openQuestion = try c.decodeIfPresent(Question.self, forKey: .openQuestion)
        screenshotURL = try c.decodeIfPresent(String.self, forKey: .screenshotURL).flatMap(URL.init(string:))
        messages = (try? c.decodeIfPresent([Message].self, forKey: .messages)) ?? []
    }
}

/// Build ordering for "does the build I'm running contain the fix?".
///
/// Must stay in sync with supabase/migrations/0014_closed_loop.sql
/// `compare_builds`, supabase/functions/_shared/builds.ts, cli/src/loop.ts
/// and web-sdk/src/fixes.ts: dotted numeric builds ("42", "1.2.10", the
/// UTC-timestamp builds scripts/release_testflight.sh produces) compare
/// numerically segment by segment; anything else is only equal or
/// incomparable (`nil`).
public enum FeedbackBuild {
    public static func compare(_ a: String?, _ b: String?) -> ComparisonResult? {
        guard let a, let b, !a.isEmpty, !b.isEmpty else { return nil }
        if a == b { return .orderedSame }
        let pa = a.split(separator: ".", omittingEmptySubsequences: false)
        let pb = b.split(separator: ".", omittingEmptySubsequences: false)
        let isNumeric: (Substring) -> Bool = { !$0.isEmpty && $0.allSatisfy(\.isASCII) && $0.allSatisfy(\.isNumber) }
        guard pa.allSatisfy(isNumeric), pb.allSatisfy(isNumeric) else { return nil }
        for i in 0..<max(pa.count, pb.count) {
            // Compare as digit strings (leading zeros stripped) rather than
            // Int, so arbitrarily long timestamp builds can't overflow.
            let sa = normalized(i < pa.count ? pa[i] : "0")
            let sb = normalized(i < pb.count ? pb[i] : "0")
            if sa.count != sb.count { return sa.count < sb.count ? .orderedAscending : .orderedDescending }
            if sa != sb { return sa < sb ? .orderedAscending : .orderedDescending }
        }
        return .orderedSame
    }

    /// Whether `currentBuild` contains a fix that shipped in `fixedInBuild`.
    /// Unknown or incomparable counts as yes — the server only reports a fix
    /// as shipped once a release was announced.
    public static func includesFix(currentBuild: String?, fixedInBuild: String?) -> Bool {
        guard let result = compare(currentBuild, fixedInBuild) else { return true }
        return result != .orderedAscending
    }

    private static func normalized(_ segment: Substring) -> Substring {
        let trimmed = segment.drop(while: { $0 == "0" })
        return trimmed.isEmpty ? "0" : trimmed
    }
}
