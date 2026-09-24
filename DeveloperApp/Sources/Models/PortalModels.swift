import Foundation
import FeedbackKit

// MARK: - Feedback Status

public enum PortalFeedbackStatus: String, Codable, CaseIterable, Identifiable, Sendable {
    case new = "new"
    case inProgress = "in_progress"
    case resolved = "resolved"
    case wontFix = "wont_fix"

    public var id: String { rawValue }

    public var displayName: String {
        switch self {
        case .new: return "New"
        case .inProgress: return "In Progress"
        case .resolved: return "Resolved"
        case .wontFix: return "Won't Fix"
        }
    }

    public var iconName: String {
        switch self {
        case .new: return "sparkles"
        case .inProgress: return "arrow.triangle.2.circlepath"
        case .resolved: return "checkmark.circle.fill"
        case .wontFix: return "slash.circle"
        }
    }
}

// MARK: - Project

public struct PortalProject: Codable, Identifiable, Hashable, Sendable {
    public let id: String
    public let organizationId: String
    public var name: String
    public let projectKey: String
    public let createdAt: Date
    public var githubRepo: String?
    public var githubInstallationId: Int?

    // Local computed or aggregated stats
    public var feedbackCount: Int
    public var unresolvedCount: Int

    enum CodingKeys: String, CodingKey {
        case id
        case organizationId = "organization_id"
        case name
        case projectKey = "project_key"
        case createdAt = "created_at"
        case githubRepo = "github_repo"
        case githubInstallationId = "github_installation_id"
    }

    public init(
        id: String,
        organizationId: String,
        name: String,
        projectKey: String,
        createdAt: Date = Date(),
        githubRepo: String? = nil,
        githubInstallationId: Int? = nil,
        feedbackCount: Int = 0,
        unresolvedCount: Int = 0
    ) {
        self.id = id
        self.organizationId = organizationId
        self.name = name
        self.projectKey = projectKey
        self.createdAt = createdAt
        self.githubRepo = githubRepo
        self.githubInstallationId = githubInstallationId
        self.feedbackCount = feedbackCount
        self.unresolvedCount = unresolvedCount
    }

    public init(from decoder: Decoder) throws {
        let container = try decoder.container(keyedBy: CodingKeys.self)
        id = try container.decode(String.self, forKey: .id)
        organizationId = try container.decode(String.self, forKey: .organizationId)
        name = try container.decode(String.self, forKey: .name)
        projectKey = try container.decode(String.self, forKey: .projectKey)
        githubRepo = try container.decodeIfPresent(String.self, forKey: .githubRepo)
        githubInstallationId = try container.decodeIfPresent(Int.self, forKey: .githubInstallationId)
        
        let dateString = try container.decode(String.self, forKey: .createdAt)
        createdAt = PortalDateFormatter.parse(dateString) ?? Date()
        feedbackCount = 0
        unresolvedCount = 0
    }
}

// MARK: - Prompt Template

public struct PortalPromptTemplate: Codable, Identifiable, Sendable {
    public let id: String
    public let projectId: String
    public var templateText: String
    public var updatedAt: Date

    enum CodingKeys: String, CodingKey {
        case id
        case projectId = "project_id"
        case templateText = "template_text"
        case updatedAt = "updated_at"
    }

    public init(
        id: String,
        projectId: String,
        templateText: String,
        updatedAt: Date = Date()
    ) {
        self.id = id
        self.projectId = projectId
        self.templateText = templateText
        self.updatedAt = updatedAt
    }

    public init(from decoder: Decoder) throws {
        let container = try decoder.container(keyedBy: CodingKeys.self)
        id = try container.decode(String.self, forKey: .id)
        projectId = try container.decode(String.self, forKey: .projectId)
        templateText = try container.decode(String.self, forKey: .templateText)
        let dateString = try container.decode(String.self, forKey: .updatedAt)
        updatedAt = PortalDateFormatter.parse(dateString) ?? Date()
    }
}

// MARK: - Feedback Item

public struct PortalFeedbackItem: Codable, Identifiable, Hashable, Sendable {
    public let id: String
    public let projectId: String
    public var text: String
    public var screenshotRawPath: String?
    public var screenshotAnnotatedPath: String?
    public var annotations: [FeedbackAnnotation]
    public var environment: FeedbackEnvironment
    public var status: PortalFeedbackStatus
    public var isArchived: Bool
    public var editedPrompt: String?
    public let createdAt: Date
    public var attachmentPath: String?
    public var attachmentFilename: String?
    public var attachmentMimeType: String?
    public var githubIssueUrl: String?
    public var githubIssueNumber: Int?

    // Transient signed URLs resolved at runtime
    public var signedScreenshotUrl: String?
    public var signedRawScreenshotUrl: String?
    public var signedAttachmentUrl: String?

    enum CodingKeys: String, CodingKey {
        case id
        case projectId = "project_id"
        case text
        case screenshotRawPath = "screenshot_raw_path"
        case screenshotAnnotatedPath = "screenshot_annotated_path"
        case annotations
        case environment
        case status
        case isArchived = "is_archived"
        case editedPrompt = "edited_prompt"
        case createdAt = "created_at"
        case attachmentPath = "attachment_path"
        case attachmentFilename = "attachment_filename"
        case attachmentMimeType = "attachment_mime_type"
        case githubIssueUrl = "github_issue_url"
        case githubIssueNumber = "github_issue_number"
    }

    public init(
        id: String,
        projectId: String,
        text: String,
        screenshotRawPath: String? = nil,
        screenshotAnnotatedPath: String? = nil,
        annotations: [FeedbackAnnotation] = [],
        environment: FeedbackEnvironment,
        status: PortalFeedbackStatus = .new,
        isArchived: Bool = false,
        editedPrompt: String? = nil,
        createdAt: Date = Date(),
        attachmentPath: String? = nil,
        attachmentFilename: String? = nil,
        attachmentMimeType: String? = nil,
        githubIssueUrl: String? = nil,
        githubIssueNumber: Int? = nil,
        signedScreenshotUrl: String? = nil,
        signedRawScreenshotUrl: String? = nil,
        signedAttachmentUrl: String? = nil
    ) {
        self.id = id
        self.projectId = projectId
        self.text = text
        self.screenshotRawPath = screenshotRawPath
        self.screenshotAnnotatedPath = screenshotAnnotatedPath
        self.annotations = annotations
        self.environment = environment
        self.status = status
        self.isArchived = isArchived
        self.editedPrompt = editedPrompt
        self.createdAt = createdAt
        self.attachmentPath = attachmentPath
        self.attachmentFilename = attachmentFilename
        self.attachmentMimeType = attachmentMimeType
        self.githubIssueUrl = githubIssueUrl
        self.githubIssueNumber = githubIssueNumber
        self.signedScreenshotUrl = signedScreenshotUrl
        self.signedRawScreenshotUrl = signedRawScreenshotUrl
        self.signedAttachmentUrl = signedAttachmentUrl
    }

    public init(from decoder: Decoder) throws {
        let container = try decoder.container(keyedBy: CodingKeys.self)
        id = try container.decode(String.self, forKey: .id)
        projectId = try container.decode(String.self, forKey: .projectId)
        text = try container.decodeIfPresent(String.self, forKey: .text) ?? ""
        screenshotRawPath = try container.decodeIfPresent(String.self, forKey: .screenshotRawPath)
        screenshotAnnotatedPath = try container.decodeIfPresent(String.self, forKey: .screenshotAnnotatedPath)
        annotations = try container.decodeIfPresent([FeedbackAnnotation].self, forKey: .annotations) ?? []
        environment = try container.decodeIfPresent(FeedbackEnvironment.self, forKey: .environment) ?? FeedbackEnvironment(
            osName: "iOS",
            osVersion: "Unknown",
            deviceModel: "iPhone",
            appVersion: "1.0",
            appBuild: "1",
            bundleIdentifier: "com.example.app",
            screenName: nil,
            locale: "en_US",
            screenWidthPoints: 393,
            screenHeightPoints: 852,
            screenScale: 3.0
        )
        let statusRaw = try container.decodeIfPresent(String.self, forKey: .status) ?? "new"
        status = PortalFeedbackStatus(rawValue: statusRaw) ?? .new
        isArchived = try container.decodeIfPresent(Bool.self, forKey: .isArchived) ?? false
        editedPrompt = try container.decodeIfPresent(String.self, forKey: .editedPrompt)
        
        let dateString = try container.decode(String.self, forKey: .createdAt)
        createdAt = PortalDateFormatter.parse(dateString) ?? Date()
        
        attachmentPath = try container.decodeIfPresent(String.self, forKey: .attachmentPath)
        attachmentFilename = try container.decodeIfPresent(String.self, forKey: .attachmentFilename)
        attachmentMimeType = try container.decodeIfPresent(String.self, forKey: .attachmentMimeType)
        githubIssueUrl = try container.decodeIfPresent(String.self, forKey: .githubIssueUrl)
        githubIssueNumber = try container.decodeIfPresent(Int.self, forKey: .githubIssueNumber)
    }

    public func hash(into hasher: inout Hasher) {
        hasher.combine(id)
    }

    public static func == (lhs: PortalFeedbackItem, rhs: PortalFeedbackItem) -> Bool {
        lhs.id == rhs.id && lhs.status == rhs.status && lhs.isArchived == rhs.isArchived && lhs.editedPrompt == rhs.editedPrompt
    }
}

// MARK: - CLI Session

public struct PortalCliSession: Codable, Identifiable, Hashable, Sendable {
    public let id: String
    public let userId: String
    public let sessionId: String?
    public let label: String
    public let createdAt: Date
    public var revokedAt: Date?

    public var isActive: Bool {
        revokedAt == nil
    }

    enum CodingKeys: String, CodingKey {
        case id
        case userId = "user_id"
        case sessionId = "session_id"
        case label
        case createdAt = "created_at"
        case revokedAt = "revoked_at"
    }

    public init(
        id: String,
        userId: String,
        sessionId: String?,
        label: String,
        createdAt: Date = Date(),
        revokedAt: Date? = nil
    ) {
        self.id = id
        self.userId = userId
        self.sessionId = sessionId
        self.label = label
        self.createdAt = createdAt
        self.revokedAt = revokedAt
    }

    public init(from decoder: Decoder) throws {
        let container = try decoder.container(keyedBy: CodingKeys.self)
        id = try container.decode(String.self, forKey: .id)
        userId = try container.decode(String.self, forKey: .userId)
        sessionId = try container.decodeIfPresent(String.self, forKey: .sessionId)
        label = try container.decode(String.self, forKey: .label)
        
        let createdString = try container.decode(String.self, forKey: .createdAt)
        createdAt = PortalDateFormatter.parse(createdString) ?? Date()
        
        if let revokedString = try container.decodeIfPresent(String.self, forKey: .revokedAt) {
            revokedAt = PortalDateFormatter.parse(revokedString)
        } else {
            revokedAt = nil
        }
    }
}

// MARK: - User Session / Profile

public struct PortalUserSession: Codable, Sendable {
    public let accessToken: String
    public let refreshToken: String
    public let userId: String
    public let email: String
    public let avatarUrl: String?
    public let githubUsername: String?

    public init(
        accessToken: String,
        refreshToken: String,
        userId: String,
        email: String,
        avatarUrl: String? = nil,
        githubUsername: String? = nil
    ) {
        self.accessToken = accessToken
        self.refreshToken = refreshToken
        self.userId = userId
        self.email = email
        self.avatarUrl = avatarUrl
        self.githubUsername = githubUsername
    }

    public static func fromJWT(accessToken: String, refreshToken: String = "") -> PortalUserSession {
        let parts = accessToken.components(separatedBy: ".")
        guard parts.count >= 2 else {
            return PortalUserSession(
                accessToken: accessToken,
                refreshToken: refreshToken,
                userId: UUID().uuidString,
                email: "github-user@feedbackkit.dev"
            )
        }

        var base64 = parts[1]
            .replacingOccurrences(of: "-", with: "+")
            .replacingOccurrences(of: "_", with: "/")
        while base64.count % 4 != 0 {
            base64.append("=")
        }

        guard let data = Data(base64Encoded: base64),
              let json = try? JSONSerialization.jsonObject(with: data) as? [String: Any] else {
            return PortalUserSession(
                accessToken: accessToken,
                refreshToken: refreshToken,
                userId: UUID().uuidString,
                email: "github-user@feedbackkit.dev"
            )
        }

        let userId = (json["sub"] as? String) ?? UUID().uuidString
        let email = (json["email"] as? String) ?? "github-user@feedbackkit.dev"
        let userMetadata = json["user_metadata"] as? [String: Any]

        let avatarUrl = (userMetadata?["avatar_url"] as? String) ?? (userMetadata?["avatarUrl"] as? String)
        let username = (userMetadata?["user_name"] as? String)
            ?? (userMetadata?["preferred_username"] as? String)
            ?? (userMetadata?["name"] as? String)
            ?? email.components(separatedBy: "@").first

        return PortalUserSession(
            accessToken: accessToken,
            refreshToken: refreshToken,
            userId: userId,
            email: email,
            avatarUrl: avatarUrl,
            githubUsername: username
        )
    }
}

// MARK: - Date Formatter Helper

public enum PortalDateFormatter {
    private static let iso8601WithFractional: ISO8601DateFormatter = {
        let formatter = ISO8601DateFormatter()
        formatter.formatOptions = [.withInternetDateTime, .withFractionalSeconds]
        return formatter
    }()

    private static let iso8601Standard: ISO8601DateFormatter = {
        let formatter = ISO8601DateFormatter()
        formatter.formatOptions = [.withInternetDateTime]
        return formatter
    }()

    public static func parse(_ string: String) -> Date? {
        if let date = iso8601WithFractional.date(from: string) {
            return date
        }
        return iso8601Standard.date(from: string)
    }

    public static func formatRelative(_ date: Date) -> String {
        let formatter = RelativeDateTimeFormatter()
        formatter.unitsStyle = .abbreviated
        return formatter.localizedString(for: date, relativeTo: Date())
    }

    public static func formatShort(_ date: Date) -> String {
        let formatter = DateFormatter()
        formatter.dateStyle = .medium
        formatter.timeStyle = .short
        return formatter.string(from: date)
    }
}
