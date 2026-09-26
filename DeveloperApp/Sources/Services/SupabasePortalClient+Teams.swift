import Foundation

// Organizations, members, invitations, notifications and push devices —
// the Portal side of supabase/migrations/0016_teams.sql and
// 0017_notifications.sql. Membership changes go through the same SECURITY
// DEFINER functions the web dashboard calls, so the rules (owners manage
// people, an organization always keeps an owner) live in one place and
// their error messages are shown to the user as-is.

extension SupabasePortalClient {
    // MARK: - Plumbing

    /// Runs a request and turns a non-2xx response into the server's own message.
    private func send(_ request: URLRequest) async throws -> (Data, HTTPURLResponse) {
        let (data, response) = try await executeRequest(request)
        guard (200...299).contains(response.statusCode) else {
            throw PortalAPIError.from(data: data, status: response.statusCode)
        }
        return (data, response)
    }

    @discardableResult
    private func rpc(_ name: String, _ params: [String: Any?] = [:]) async throws -> Data {
        let body = try JSONSerialization.data(withJSONObject: params.mapValues { $0 ?? NSNull() })
        let request = try makeRequest(path: "/rest/v1/rpc/\(name)", method: "POST", body: body)
        return try await send(request).0
    }

    private static let isoFormatter = ISO8601DateFormatter()

    // MARK: - Organizations

    public func fetchOrganizations() async throws -> [PortalOrganization] {
        if isDemoMode { return PortalDemoTeamStore.shared.organizations }
        guard let userId = currentSession?.userId, !userId.isEmpty else { return [] }
        let request = try makeRequest(path: "/rest/v1/memberships", queryItems: [
            URLQueryItem(name: "select", value: "role,organizations(id,name)"),
            URLQueryItem(name: "user_id", value: "eq.\(userId)"),
            URLQueryItem(name: "order", value: "created_at.asc")
        ])
        let (data, _) = try await send(request)
        return try JSONDecoder().decode([PortalMembershipRow].self, from: data).compactMap { row in
            row.organizations.map { PortalOrganization(id: $0.id, name: $0.name, role: row.role) }
        }
    }

    public func createOrganization(name: String) async throws -> String {
        if isDemoMode { return PortalDemoTeamStore.shared.createOrganization(name: name) }
        let data = try await rpc("create_organization", ["p_name": name])
        return try JSONDecoder().decode(String.self, from: data)
    }

    public func renameOrganization(id: String, name: String) async throws {
        if isDemoMode { PortalDemoTeamStore.shared.rename(id: id, name: name); return }
        let request = try makeRequest(
            path: "/rest/v1/organizations",
            method: "PATCH",
            queryItems: [URLQueryItem(name: "id", value: "eq.\(id)")],
            body: try JSONSerialization.data(withJSONObject: ["name": name])
        )
        try await send(request)
    }

    // MARK: - Members

    public func fetchMembers(organizationId: String) async throws -> [PortalMember] {
        if isDemoMode { return PortalDemoTeamStore.shared.members }
        let data = try await rpc("organization_members", ["p_org_id": organizationId])
        return try JSONDecoder().decode([PortalMember].self, from: data)
    }

    public func updateMemberRole(organizationId: String, userId: String, role: PortalMembershipRole) async throws {
        if isDemoMode { try PortalDemoTeamStore.shared.setRole(userId: userId, role: role); return }
        try await rpc("update_member_role", ["p_org_id": organizationId, "p_user_id": userId, "p_role": role.rawValue])
    }

    /// Removes a member, or — with the caller's own id — leaves the organization.
    public func removeMember(organizationId: String, userId: String) async throws {
        if isDemoMode { try PortalDemoTeamStore.shared.remove(userId: userId); return }
        try await rpc("remove_member", ["p_org_id": organizationId, "p_user_id": userId])
        syncBillingSeats(organizationId: organizationId)
    }

    /// Keeps a Team subscription's seat count in step. Best effort: a no-op
    /// (501) until Stripe is set up — see supabase/functions/sync-billing-seats.
    public func syncBillingSeats(organizationId: String) {
        guard !isDemoMode,
              let body = try? JSONSerialization.data(withJSONObject: ["organization_id": organizationId]),
              let request = try? makeRequest(path: "/functions/v1/sync-billing-seats", method: "POST", body: body)
        else { return }
        Task { _ = try? await executeRequest(request) }
    }

    // MARK: - Invitations

    public func fetchInvitations(organizationId: String) async throws -> [PortalInvitation] {
        if isDemoMode { return PortalDemoTeamStore.shared.invitations }
        let request = try makeRequest(path: "/rest/v1/organization_invitations", queryItems: [
            URLQueryItem(name: "select", value: "*"),
            URLQueryItem(name: "organization_id", value: "eq.\(organizationId)"),
            URLQueryItem(name: "accepted_at", value: "is.null"),
            URLQueryItem(name: "revoked_at", value: "is.null"),
            URLQueryItem(name: "expires_at", value: "gt.\(Self.isoFormatter.string(from: Date()))"),
            URLQueryItem(name: "order", value: "created_at.desc")
        ])
        let (data, _) = try await send(request)
        return try JSONDecoder().decode([PortalInvitation].self, from: data)
    }

    public func createInvitation(organizationId: String, email: String?, role: PortalMembershipRole) async throws -> PortalInvitation {
        let trimmed = email?.trimmingCharacters(in: .whitespacesAndNewlines)
        let cleanEmail = (trimmed?.isEmpty == false) ? trimmed : nil
        if isDemoMode {
            return PortalDemoTeamStore.shared.invite(organizationId: organizationId, email: cleanEmail, role: role)
        }
        let data = try await rpc("create_invitation", [
            "p_org_id": organizationId,
            "p_email": cleanEmail,
            "p_role": role.rawValue
        ])
        // A function returning one row comes back as an object; accept an array too.
        if let invite = try? JSONDecoder().decode(PortalInvitation.self, from: data) { return invite }
        guard let first = try JSONDecoder().decode([PortalInvitation].self, from: data).first else {
            throw PortalAPIError(status: 500, message: "The server didn't return the new invitation.")
        }
        return first
    }

    public func revokeInvitation(id: String) async throws {
        if isDemoMode { PortalDemoTeamStore.shared.revoke(id: id); return }
        try await rpc("revoke_invitation", ["p_invitation_id": id])
    }

    // MARK: - Notifications

    public func fetchNotifications(limit: Int = 50) async throws -> [PortalNotification] {
        if isDemoMode { return PortalDemoTeamStore.shared.notifications }
        let request = try makeRequest(path: "/rest/v1/notifications", queryItems: [
            URLQueryItem(name: "select", value: "*"),
            URLQueryItem(name: "order", value: "created_at.desc"),
            URLQueryItem(name: "limit", value: String(limit))
        ])
        let (data, _) = try await send(request)
        return try JSONDecoder().decode([PortalNotification].self, from: data)
    }

    /// Exact unread count (not just within the fetched page), from PostgREST's Content-Range.
    public func fetchUnreadNotificationCount() async throws -> Int {
        if isDemoMode { return PortalDemoTeamStore.shared.notifications.filter { !$0.isRead }.count }
        var request = try makeRequest(path: "/rest/v1/notifications", queryItems: [
            URLQueryItem(name: "select", value: "id"),
            URLQueryItem(name: "read_at", value: "is.null"),
            URLQueryItem(name: "limit", value: "1")
        ])
        request.setValue("count=exact", forHTTPHeaderField: "Prefer")
        let (_, response) = try await send(request)
        let range = response.value(forHTTPHeaderField: "Content-Range") ?? ""
        return Int(range.split(separator: "/").last ?? "") ?? 0
    }

    public func markNotificationRead(id: String) async throws {
        if isDemoMode { PortalDemoTeamStore.shared.markRead(id: id); return }
        let request = try makeRequest(
            path: "/rest/v1/notifications",
            method: "PATCH",
            queryItems: [URLQueryItem(name: "id", value: "eq.\(id)")],
            body: try JSONSerialization.data(withJSONObject: ["read_at": Self.isoFormatter.string(from: Date())])
        )
        try await send(request)
    }

    public func markAllNotificationsRead() async throws {
        if isDemoMode { PortalDemoTeamStore.shared.markAllRead(); return }
        let request = try makeRequest(
            path: "/rest/v1/notifications",
            method: "PATCH",
            queryItems: [URLQueryItem(name: "read_at", value: "is.null")],
            body: try JSONSerialization.data(withJSONObject: ["read_at": Self.isoFormatter.string(from: Date())])
        )
        try await send(request)
    }

    /// A single report by id, for opening one from a notification.
    public func fetchFeedbackItem(id: String) async throws -> PortalFeedbackItem? {
        if isDemoMode {
            return try await fetchFeedbackItems(includeArchived: true).first { $0.id == id }
        }
        let request = try makeRequest(path: "/rest/v1/feedback_items", queryItems: [
            URLQueryItem(name: "select", value: "*"),
            URLQueryItem(name: "id", value: "eq.\(id)")
        ])
        let (data, _) = try await send(request)
        guard var item = try JSONDecoder().decode([PortalFeedbackItem].self, from: data).first else { return nil }
        if let path = item.screenshotAnnotatedPath ?? item.screenshotRawPath {
            item.signedScreenshotUrl = try? await getSignedUrl(path: path)
        }
        if let raw = item.screenshotRawPath {
            item.signedRawScreenshotUrl = try? await getSignedUrl(path: raw)
        }
        if let attachment = item.attachmentPath {
            item.signedAttachmentUrl = try? await getSignedUrl(path: attachment)
        }
        return item
    }

    // MARK: - Push devices

    /// `environment` is "sandbox" for development builds, "production" for TestFlight/App Store.
    public func registerPushDevice(token: String, environment: String, bundleId: String?) async throws {
        if isDemoMode { return }
        try await rpc("register_push_device", [
            "p_token": token,
            "p_environment": environment,
            "p_bundle_id": bundleId
        ])
    }

    public func unregisterPushDevice(token: String) async {
        guard !isDemoMode else { return }
        _ = try? await rpc("unregister_push_device", ["p_token": token])
    }
}

// MARK: - Demo mode

/// In-memory team data for the Portal's offline demo mode (and the unit
/// tests), mirroring the server's rules closely enough to exercise the UI.
@MainActor
final class PortalDemoTeamStore {
    static let shared = PortalDemoTeamStore()

    var organizations: [PortalOrganization] = []
    var members: [PortalMember] = []
    var invitations: [PortalInvitation] = []
    var notifications: [PortalNotification] = []

    private init() { reset() }

    func reset() {
        organizations = [
            PortalOrganization(id: "org-1", name: "Octocat's Team", role: .owner),
            PortalOrganization(id: "org-2", name: "Acme Mobile", role: .member)
        ]
        members = [
            PortalMember(userId: "demo_user", role: .owner, email: "octocat@github.com", fullName: "The Octocat", userName: "octocat",
                         avatarUrl: "https://avatars.githubusercontent.com/u/583231?v=4"),
            PortalMember(userId: "demo_user_2", role: .member, email: "mona@example.com", fullName: "Mona Lisa", userName: "monalisa"),
            PortalMember(userId: "demo_user_3", role: .member, email: "hubot@example.com", fullName: nil, userName: "hubot")
        ]
        invitations = [
            PortalInvitation(id: "inv-1", organizationId: "org-1", email: "new.dev@example.com", role: .member, token: "fki_demo0001")
        ]
        let now = Date()
        notifications = [
            PortalNotification(id: "n-1", organizationId: "org-1", projectId: "proj-1", feedbackId: "fb-101", kind: "new_feedback",
                               title: "New feedback in Consumer App", body: "The checkout button overlaps the keyboard",
                               createdAt: now.addingTimeInterval(-300)),
            PortalNotification(id: "n-2", organizationId: "org-1", projectId: "proj-1", feedbackId: "fb-102", kind: "reopened",
                               title: "Reporter says it's still broken · Consumer App", body: "Dark mode colors are unreadable",
                               createdAt: now.addingTimeInterval(-3_600)),
            PortalNotification(id: "n-3", organizationId: "org-1", projectId: nil, feedbackId: nil, kind: "member_joined",
                               title: "Mona Lisa joined Octocat's Team", body: nil,
                               createdAt: now.addingTimeInterval(-86_400), readAt: now.addingTimeInterval(-80_000))
        ]
    }

    func createOrganization(name: String) -> String {
        let id = "org-\(UUID().uuidString.prefix(6))"
        organizations.append(PortalOrganization(id: id, name: name, role: .owner))
        return id
    }

    func rename(id: String, name: String) {
        if let i = organizations.firstIndex(where: { $0.id == id }) { organizations[i].name = name }
    }

    func setRole(userId: String, role: PortalMembershipRole) throws {
        guard let i = members.firstIndex(where: { $0.userId == userId }) else { return }
        if members[i].role == .owner, role != .owner, members.filter({ $0.role == .owner }).count <= 1 {
            throw PortalAPIError(status: 400, message: "an organization needs at least one owner")
        }
        members[i].role = role
    }

    func remove(userId: String) throws {
        guard let member = members.first(where: { $0.userId == userId }) else { return }
        if member.role == .owner, members.filter({ $0.role == .owner }).count <= 1 {
            throw PortalAPIError(status: 400, message: "an organization needs at least one owner — make someone else an owner first")
        }
        members.removeAll { $0.userId == userId }
    }

    func invite(organizationId: String, email: String?, role: PortalMembershipRole) -> PortalInvitation {
        let invite = PortalInvitation(
            id: "inv-\(UUID().uuidString.prefix(6))",
            organizationId: organizationId,
            email: email,
            role: role,
            token: "fki_demo\(UUID().uuidString.prefix(8).lowercased())"
        )
        invitations.insert(invite, at: 0)
        return invite
    }

    func revoke(id: String) {
        invitations.removeAll { $0.id == id }
    }

    func markRead(id: String) {
        if let i = notifications.firstIndex(where: { $0.id == id }), notifications[i].readAt == nil {
            notifications[i].readAt = Date()
        }
    }

    func markAllRead() {
        for i in notifications.indices where notifications[i].readAt == nil {
            notifications[i].readAt = Date()
        }
    }
}
