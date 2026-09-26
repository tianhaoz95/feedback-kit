import Foundation

// Teams, invitations and notifications — mirrors
// supabase/migrations/0016_teams.sql and 0017_notifications.sql, the same
// tables the web dashboard uses (web/src/lib/types.ts).

// MARK: - Roles & organizations

public enum PortalMembershipRole: String, Codable, CaseIterable, Identifiable, Sendable {
    case owner
    case member

    public var id: String { rawValue }
    public var displayName: String { rawValue.capitalized }

    /// A role added server-side later decodes as the least-privileged one
    /// instead of failing the whole list.
    public init(from decoder: Decoder) throws {
        let raw = try decoder.singleValueContainer().decode(String.self)
        self = PortalMembershipRole(rawValue: raw) ?? .member
    }
}

/// An organization the signed-in user belongs to, with their role in it.
public struct PortalOrganization: Codable, Identifiable, Hashable, Sendable {
    public let id: String
    public var name: String
    public var role: PortalMembershipRole

    public var isOwner: Bool { role == .owner }

    public init(id: String, name: String, role: PortalMembershipRole) {
        self.id = id
        self.name = name
        self.role = role
    }
}

/// Row shape of `memberships?select=role,organizations(id,name)`.
struct PortalMembershipRow: Decodable {
    struct Org: Decodable {
        let id: String
        let name: String
    }
    let role: PortalMembershipRole
    let organizations: Org?
}

// MARK: - Members

public struct PortalMember: Codable, Identifiable, Hashable, Sendable {
    public let userId: String
    public var role: PortalMembershipRole
    public let joinedAt: Date
    public let email: String?
    public let fullName: String?
    public let userName: String?
    public let avatarUrl: String?

    public var id: String { userId }

    public var displayName: String {
        fullName ?? userName ?? email ?? "Unknown user"
    }

    enum CodingKeys: String, CodingKey {
        case userId = "user_id"
        case role
        case joinedAt = "joined_at"
        case email
        case fullName = "full_name"
        case userName = "user_name"
        case avatarUrl = "avatar_url"
    }

    public init(
        userId: String,
        role: PortalMembershipRole,
        joinedAt: Date = Date(),
        email: String? = nil,
        fullName: String? = nil,
        userName: String? = nil,
        avatarUrl: String? = nil
    ) {
        self.userId = userId
        self.role = role
        self.joinedAt = joinedAt
        self.email = email
        self.fullName = fullName
        self.userName = userName
        self.avatarUrl = avatarUrl
    }

    public init(from decoder: Decoder) throws {
        let c = try decoder.container(keyedBy: CodingKeys.self)
        userId = try c.decode(String.self, forKey: .userId)
        role = try c.decode(PortalMembershipRole.self, forKey: .role)
        joinedAt = PortalDateFormatter.parse(try c.decodeIfPresent(String.self, forKey: .joinedAt) ?? "") ?? Date()
        email = try c.decodeIfPresent(String.self, forKey: .email)
        fullName = try c.decodeIfPresent(String.self, forKey: .fullName)
        userName = try c.decodeIfPresent(String.self, forKey: .userName)
        avatarUrl = try c.decodeIfPresent(String.self, forKey: .avatarUrl)
    }
}

// MARK: - Invitations

public struct PortalInvitation: Codable, Identifiable, Hashable, Sendable {
    public let id: String
    public let organizationId: String
    public let email: String?
    public let role: PortalMembershipRole
    public let token: String
    public let createdAt: Date
    public let expiresAt: Date

    /// Invitations are accepted in the web dashboard (`/invite/<token>`),
    /// which handles GitHub sign-in for people who don't have an account yet.
    public static var dashboardBaseURL = "https://feedback-kit.hejitech.workers.dev"

    public var url: URL {
        URL(string: "\(Self.dashboardBaseURL)/invite/\(token)")!
    }

    enum CodingKeys: String, CodingKey {
        case id
        case organizationId = "organization_id"
        case email
        case role
        case token
        case createdAt = "created_at"
        case expiresAt = "expires_at"
    }

    public init(
        id: String,
        organizationId: String,
        email: String?,
        role: PortalMembershipRole,
        token: String,
        createdAt: Date = Date(),
        expiresAt: Date = Date().addingTimeInterval(7 * 24 * 3600)
    ) {
        self.id = id
        self.organizationId = organizationId
        self.email = email
        self.role = role
        self.token = token
        self.createdAt = createdAt
        self.expiresAt = expiresAt
    }

    public init(from decoder: Decoder) throws {
        let c = try decoder.container(keyedBy: CodingKeys.self)
        id = try c.decode(String.self, forKey: .id)
        organizationId = try c.decode(String.self, forKey: .organizationId)
        email = try c.decodeIfPresent(String.self, forKey: .email)
        role = try c.decode(PortalMembershipRole.self, forKey: .role)
        token = try c.decode(String.self, forKey: .token)
        createdAt = PortalDateFormatter.parse(try c.decode(String.self, forKey: .createdAt)) ?? Date()
        expiresAt = PortalDateFormatter.parse(try c.decode(String.self, forKey: .expiresAt)) ?? Date()
    }
}

// MARK: - Notifications

public struct PortalNotification: Codable, Identifiable, Hashable, Sendable {
    public let id: String
    public let organizationId: String
    public let projectId: String?
    public let feedbackId: String?
    /// Plain string, not an enum, so a kind added later still shows up.
    public let kind: String
    public let title: String
    public let body: String?
    public let createdAt: Date
    public var readAt: Date?

    public var isRead: Bool { readAt != nil }

    public var iconName: String {
        switch kind {
        case "new_feedback": return "tray.and.arrow.down.fill"
        case "reporter_reply": return "bubble.left.fill"
        case "reopened": return "arrow.uturn.backward.circle.fill"
        case "verified": return "checkmark.seal.fill"
        case "fix_merged": return "arrow.triangle.merge"
        case "member_joined": return "person.badge.plus"
        default: return "bell.fill"
        }
    }

    enum CodingKeys: String, CodingKey {
        case id
        case organizationId = "organization_id"
        case projectId = "project_id"
        case feedbackId = "feedback_id"
        case kind
        case title
        case body
        case createdAt = "created_at"
        case readAt = "read_at"
    }

    public init(
        id: String,
        organizationId: String,
        projectId: String?,
        feedbackId: String?,
        kind: String,
        title: String,
        body: String?,
        createdAt: Date = Date(),
        readAt: Date? = nil
    ) {
        self.id = id
        self.organizationId = organizationId
        self.projectId = projectId
        self.feedbackId = feedbackId
        self.kind = kind
        self.title = title
        self.body = body
        self.createdAt = createdAt
        self.readAt = readAt
    }

    public init(from decoder: Decoder) throws {
        let c = try decoder.container(keyedBy: CodingKeys.self)
        id = try c.decode(String.self, forKey: .id)
        organizationId = try c.decode(String.self, forKey: .organizationId)
        projectId = try c.decodeIfPresent(String.self, forKey: .projectId)
        feedbackId = try c.decodeIfPresent(String.self, forKey: .feedbackId)
        kind = try c.decode(String.self, forKey: .kind)
        title = try c.decode(String.self, forKey: .title)
        body = try c.decodeIfPresent(String.self, forKey: .body)
        createdAt = PortalDateFormatter.parse(try c.decode(String.self, forKey: .createdAt)) ?? Date()
        readAt = try c.decodeIfPresent(String.self, forKey: .readAt).flatMap { PortalDateFormatter.parse($0) }
    }
}

// MARK: - Errors

/// A PostgREST/RPC failure carrying the server's own message, e.g. "an
/// organization needs at least one owner", so the UI can show it as-is.
public struct PortalAPIError: LocalizedError, Sendable {
    public let status: Int
    public let message: String

    public var errorDescription: String? { message }

    static func from(data: Data, status: Int) -> PortalAPIError {
        let json = try? JSONSerialization.jsonObject(with: data) as? [String: Any]
        let message = (json?["message"] as? String) ?? (json?["error"] as? String) ?? "Request failed (\(status))."
        return PortalAPIError(status: status, message: message)
    }
}
