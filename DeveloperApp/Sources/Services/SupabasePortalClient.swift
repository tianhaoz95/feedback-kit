import Foundation
import FeedbackKit

@MainActor
public final class SupabasePortalClient: ObservableObject {
    public static let shared = SupabasePortalClient()

    public static let defaultProdUrl = "https://gpucoladcyvijefdjudf.supabase.co"
    public static let defaultProdAnonKey = "sb_publishable_crkqEdaacVS02etk6k16ag_ATIk-8Kn"
    public static let defaultLocalUrl = "http://127.0.0.1:54321"
    public static let defaultLocalAnonKey = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZS1kZW1vIiwicm9sZSI6ImFub24iLCJleHAiOjE5ODM4MTI5OTZ9.CRXP1A7WOeoJeXxjNni43kdQwgnWNReilDMblYTn_I0"

    // MARK: - Published State

    @Published public var supabaseUrl: String {
        didSet {
            UserDefaults.standard.set(supabaseUrl, forKey: "portal_supabase_url")
        }
    }

    @Published public var anonKey: String {
        didSet {
            UserDefaults.standard.set(anonKey, forKey: "portal_anon_key")
        }
    }

    @Published public var isDemoMode: Bool {
        didSet {
            UserDefaults.standard.set(isDemoMode, forKey: "portal_demo_mode")
        }
    }

    @Published public var currentSession: PortalUserSession?

    // In-memory demo state for interactive offline triage
    private var demoProjects: [PortalProject] = DemoData.sampleProjects
    private var demoFeedback: [PortalFeedbackItem] = DemoData.sampleFeedbackItems
    private var demoTemplates: [String: PortalPromptTemplate] = DemoData.samplePromptTemplates
    private var demoSessions: [PortalCliSession] = DemoData.sampleCliSessions

    // In-memory cache for resolved signed URLs to accelerate pull-to-refresh & list loading
    private var signedUrlCache: [String: (url: String, expiresAt: Date)] = [:]

    public func clearCache() {
        signedUrlCache.removeAll()
    }

    // MARK: - Init

    public init() {
        let storedUrl = UserDefaults.standard.string(forKey: "portal_supabase_url")
        let storedKey = UserDefaults.standard.string(forKey: "portal_anon_key")
        let storedDemo = UserDefaults.standard.object(forKey: "portal_demo_mode") as? Bool

        let resolvedUrl: String
        if let storedUrl = storedUrl,
           !storedUrl.isEmpty,
           storedUrl != Self.defaultLocalUrl,
           !storedUrl.contains("workers.dev") {
            resolvedUrl = storedUrl
        } else {
            resolvedUrl = Self.defaultProdUrl
        }

        let resolvedKey: String
        if let storedKey = storedKey,
           !storedKey.isEmpty,
           storedKey != Self.defaultLocalAnonKey {
            resolvedKey = storedKey
        } else {
            resolvedKey = (resolvedUrl == Self.defaultLocalUrl) ? Self.defaultLocalAnonKey : Self.defaultProdAnonKey
        }

        self.supabaseUrl = resolvedUrl
        self.anonKey = resolvedKey

        self.isDemoMode = storedDemo ?? false

        // Restore saved session token from Keychain if present
        if let token = KeychainHelper.loadString(key: "access_token"),
           let userId = KeychainHelper.loadString(key: "user_id"),
           let email = KeychainHelper.loadString(key: "email") {
            let refresh = KeychainHelper.loadString(key: "refresh_token") ?? ""
            let avatar = KeychainHelper.loadString(key: "avatar_url")
            let username = KeychainHelper.loadString(key: "github_username")
            self.currentSession = PortalUserSession(
                accessToken: token,
                refreshToken: refresh,
                userId: userId,
                email: email,
                avatarUrl: avatar,
                githubUsername: username
            )
        }
    }

    // MARK: - Auth

    public func signIn(session: PortalUserSession) {
        self.currentSession = session
        self.isDemoMode = false
        KeychainHelper.saveString(key: "access_token", value: session.accessToken)
        KeychainHelper.saveString(key: "refresh_token", value: session.refreshToken)
        KeychainHelper.saveString(key: "user_id", value: session.userId)
        KeychainHelper.saveString(key: "email", value: session.email)
        if let avatar = session.avatarUrl {
            KeychainHelper.saveString(key: "avatar_url", value: avatar)
        }
        if let username = session.githubUsername {
            KeychainHelper.saveString(key: "github_username", value: username)
        }

        // Asynchronously fetch and refresh latest profile details from Supabase auth
        Task {
            await fetchUserProfile()
        }
    }

    public func signInWithManualToken(token: String, email: String = "developer@example.com") {
        let session = PortalUserSession.fromJWT(accessToken: token)
        let resolved = PortalUserSession(
            accessToken: token,
            refreshToken: "",
            userId: session.userId,
            email: email,
            avatarUrl: session.avatarUrl,
            githubUsername: session.githubUsername ?? email.components(separatedBy: "@").first
        )
        signIn(session: resolved)
    }

    public func signOut() {
        self.currentSession = nil
        KeychainHelper.clearAll()
    }

    public func enableDemoMode() {
        self.isDemoMode = true
        self.demoProjects = DemoData.sampleProjects
        self.demoFeedback = DemoData.sampleFeedbackItems
        self.demoTemplates = DemoData.samplePromptTemplates
        self.demoSessions = DemoData.sampleCliSessions
        PortalDemoTeamStore.shared.reset()
        self.currentSession = PortalUserSession(
            accessToken: "demo_access_token",
            refreshToken: "demo_refresh_token",
            userId: "demo_user",
            email: "octocat@github.com",
            avatarUrl: "https://avatars.githubusercontent.com/u/583231?v=4",
            githubUsername: "octocat"
        )
    }

    public func fetchUserProfile() async {
        guard let token = currentSession?.accessToken, !isDemoMode else { return }
        do {
            let request = try makeRequest(path: "/auth/v1/user")
            let (data, response) = try await URLSession.shared.data(for: request)
            guard let httpResponse = response as? HTTPURLResponse, (200...299).contains(httpResponse.statusCode) else {
                return
            }
            if let json = try? JSONSerialization.jsonObject(with: data) as? [String: Any] {
                let email = (json["email"] as? String) ?? self.currentSession?.email ?? ""
                let userId = (json["id"] as? String) ?? self.currentSession?.userId ?? ""
                let userMeta = json["user_metadata"] as? [String: Any]
                let avatarUrl = (userMeta?["avatar_url"] as? String) ?? (userMeta?["avatarUrl"] as? String) ?? self.currentSession?.avatarUrl
                let username = (userMeta?["user_name"] as? String)
                    ?? (userMeta?["preferred_username"] as? String)
                    ?? (userMeta?["name"] as? String)
                    ?? self.currentSession?.githubUsername

                let updated = PortalUserSession(
                    accessToken: token,
                    refreshToken: self.currentSession?.refreshToken ?? "",
                    userId: userId,
                    email: email,
                    avatarUrl: avatarUrl,
                    githubUsername: username
                )
                self.currentSession = updated
                if let avatar = avatarUrl {
                    KeychainHelper.saveString(key: "avatar_url", value: avatar)
                }
                if let u = username {
                    KeychainHelper.saveString(key: "github_username", value: u)
                }
            }
        } catch {
            // Retain existing session on network failure
        }
    }

    // MARK: - HTTP Helpers

    func makeRequest(
        path: String,
        method: String = "GET",
        queryItems: [URLQueryItem]? = nil,
        body: Data? = nil,
        preferReturn: String? = nil
    ) throws -> URLRequest {
        guard var components = URLComponents(string: supabaseUrl) else {
            throw URLError(.badURL)
        }
        components.path = (components.path == "/" ? "" : components.path) + path
        if let queryItems = queryItems, !queryItems.isEmpty {
            components.queryItems = queryItems
        }
        guard let url = components.url else {
            throw URLError(.badURL)
        }

        var request = URLRequest(url: url)
        request.httpMethod = method
        request.setValue("application/json", forHTTPHeaderField: "Content-Type")
        request.setValue(anonKey, forHTTPHeaderField: "apikey")
        
        let token = currentSession?.accessToken ?? anonKey
        request.setValue("Bearer \(token)", forHTTPHeaderField: "Authorization")

        if let prefer = preferReturn {
            request.setValue(prefer, forHTTPHeaderField: "Prefer")
        }

        request.httpBody = body
        return request
    }

    public func refreshSession() async throws -> Bool {
        guard let refresh = currentSession?.refreshToken, !refresh.isEmpty, !isDemoMode else {
            return false
        }
        guard var components = URLComponents(string: supabaseUrl) else { return false }
        components.path = (components.path == "/" ? "" : components.path) + "/auth/v1/token"
        components.queryItems = [URLQueryItem(name: "grant_type", value: "refresh_token")]
        guard let url = components.url else { return false }

        var request = URLRequest(url: url)
        request.httpMethod = "POST"
        request.setValue("application/json", forHTTPHeaderField: "Content-Type")
        request.setValue(anonKey, forHTTPHeaderField: "apikey")
        let bodyData = try JSONSerialization.data(withJSONObject: ["refresh_token": refresh])
        request.httpBody = bodyData

        let (data, response) = try await URLSession.shared.data(for: request)
        guard let httpResponse = response as? HTTPURLResponse, (200...299).contains(httpResponse.statusCode) else {
            return false
        }

        if let json = try? JSONSerialization.jsonObject(with: data) as? [String: Any],
           let newAccessToken = json["access_token"] as? String {
            let newRefreshToken = (json["refresh_token"] as? String) ?? refresh
            let existing = self.currentSession
            let updated = PortalUserSession(
                accessToken: newAccessToken,
                refreshToken: newRefreshToken,
                userId: existing?.userId ?? "",
                email: existing?.email ?? "",
                avatarUrl: existing?.avatarUrl,
                githubUsername: existing?.githubUsername
            )
            self.signIn(session: updated)
            return true
        }
        return false
    }

    func executeRequest(_ request: URLRequest) async throws -> (Data, HTTPURLResponse) {
        let (data, response) = try await URLSession.shared.data(for: request)
        guard let httpResponse = response as? HTTPURLResponse else {
            throw URLError(.badServerResponse)
        }

        if httpResponse.statusCode == 401 && !isDemoMode && currentSession?.refreshToken.isEmpty == false {
            if let refreshed = try? await refreshSession(), refreshed {
                var retryRequest = request
                let newToken = currentSession?.accessToken ?? anonKey
                retryRequest.setValue("Bearer \(newToken)", forHTTPHeaderField: "Authorization")
                let (retryData, retryResponse) = try await URLSession.shared.data(for: retryRequest)
                if let retryHttp = retryResponse as? HTTPURLResponse {
                    return (retryData, retryHttp)
                }
            }
        }

        return (data, httpResponse)
    }

    // MARK: - Projects

    /// Projects the user can see, optionally only one organization's.
    public func fetchProjects(organizationId: String? = nil) async throws -> [PortalProject] {
        if isDemoMode {
            // Update stats
            return demoProjects.filter { organizationId == nil || $0.organizationId == organizationId }.map { project in
                var p = project
                let items = demoFeedback.filter { $0.projectId == project.id && !$0.isArchived }
                p.feedbackCount = items.count
                p.unresolvedCount = items.filter { $0.status == .new || $0.status == .inProgress }.count
                return p
            }
        }

        var projectQuery = [
            URLQueryItem(name: "select", value: "*"),
            URLQueryItem(name: "order", value: "created_at.desc")
        ]
        if let organizationId {
            projectQuery.append(URLQueryItem(name: "organization_id", value: "eq.\(organizationId)"))
        }
        let request = try makeRequest(path: "/rest/v1/projects", queryItems: projectQuery)

        let (data, httpResponse) = try await executeRequest(request)
        guard (200...299).contains(httpResponse.statusCode) else {
            throw URLError(.badServerResponse)
        }

        let decoder = JSONDecoder()
        var projects = try decoder.decode([PortalProject].self, from: data)

        // Query feedback counts per project concurrently without resolving signed URLs
        await withTaskGroup(of: (Int, Int, Int).self) { group in
            for i in 0..<projects.count {
                let pid = projects[i].id
                group.addTask {
                    if let items = try? await self.fetchFeedbackItems(projectId: pid, includeArchived: false, resolveSignedUrls: false) {
                        let total = items.count
                        let unresolved = items.filter { $0.status == .new || $0.status == .inProgress }.count
                        return (i, total, unresolved)
                    }
                    return (i, 0, 0)
                }
            }

            for await (idx, total, unresolved) in group {
                projects[idx].feedbackCount = total
                projects[idx].unresolvedCount = unresolved
            }
        }
        return projects
    }

    public func createProject(name: String, githubRepo: String? = nil, organizationId: String? = nil) async throws -> PortalProject {
        if isDemoMode {
            let newId = "proj-\(UUID().uuidString.prefix(6))"
            let newKey = "fk_live_\(UUID().uuidString.replacingOccurrences(of: "-", with: "").prefix(24))"
            let newProj = PortalProject(
                id: newId,
                organizationId: organizationId ?? "org-1",
                name: name,
                projectKey: newKey,
                createdAt: Date(),
                githubRepo: githubRepo,
                githubInstallationId: nil,
                feedbackCount: 0,
                unresolvedCount: 0
            )
            demoProjects.insert(newProj, at: 0)
            return newProj
        }

        // organization_id is required (projects belong to one organization);
        // fall back to the first one the user belongs to.
        var resolvedOrganizationId = organizationId
        if resolvedOrganizationId == nil {
            resolvedOrganizationId = try await fetchOrganizations().first?.id
        }
        guard let resolvedOrganizationId else {
            throw PortalAPIError(status: 400, message: "Join or create an organization first.")
        }
        let payload: [String: Any] = [
            "organization_id": resolvedOrganizationId,
            "name": name,
            "project_key": "fk_live_\(UUID().uuidString.replacingOccurrences(of: "-", with: ""))",
            "github_repo": githubRepo as Any
        ]
        let bodyData = try JSONSerialization.data(withJSONObject: payload.compactMapValues { $0 })

        let request = try makeRequest(
            path: "/rest/v1/projects",
            method: "POST",
            body: bodyData,
            preferReturn: "return=representation"
        )

        let (data, httpResponse) = try await executeRequest(request)
        guard (200...299).contains(httpResponse.statusCode) else {
            throw URLError(.badServerResponse)
        }

        let decoder = JSONDecoder()
        let created = try decoder.decode([PortalProject].self, from: data)
        guard let first = created.first else {
            throw URLError(.cannotParseResponse)
        }
        return first
    }

    public func deleteProject(id: String) async throws {
        if isDemoMode {
            demoProjects.removeAll { $0.id == id }
            demoFeedback.removeAll { $0.projectId == id }
            return
        }

        let request = try makeRequest(
            path: "/rest/v1/projects",
            method: "DELETE",
            queryItems: [URLQueryItem(name: "id", value: "eq.\(id)")]
        )
        let (_, httpResponse) = try await executeRequest(request)
        guard (200...299).contains(httpResponse.statusCode) else {
            throw URLError(.badServerResponse)
        }
    }

    public func updateProjectGitHubRepo(id: String, githubRepo: String?) async throws -> PortalProject {
        let repoToSave = githubRepo?.trimmingCharacters(in: .whitespaces)
        let cleanedRepo = (repoToSave?.isEmpty == false) ? repoToSave : nil

        if isDemoMode {
            if let idx = demoProjects.firstIndex(where: { $0.id == id }) {
                let existing = demoProjects[idx]
                let updated = PortalProject(
                    id: existing.id,
                    organizationId: existing.organizationId,
                    name: existing.name,
                    projectKey: existing.projectKey,
                    createdAt: existing.createdAt,
                    githubRepo: cleanedRepo,
                    githubInstallationId: cleanedRepo == nil ? nil : existing.githubInstallationId,
                    feedbackCount: existing.feedbackCount,
                    unresolvedCount: existing.unresolvedCount
                )
                demoProjects[idx] = updated
                return updated
            }
            throw URLError(.resourceUnavailable)
        }

        var payload: [String: Any] = [
            "github_repo": (cleanedRepo as Any)
        ]
        if cleanedRepo == nil {
            payload["github_installation_id"] = NSNull()
        }

        let bodyData = try JSONSerialization.data(withJSONObject: payload.mapValues { $0 is NSNull ? NSNull() : ($0 ?? NSNull()) })

        let request = try makeRequest(
            path: "/rest/v1/projects",
            method: "PATCH",
            queryItems: [URLQueryItem(name: "id", value: "eq.\(id)")],
            body: bodyData,
            preferReturn: "return=representation"
        )

        let (data, httpResponse) = try await executeRequest(request)
        guard (200...299).contains(httpResponse.statusCode) else {
            throw URLError(.badServerResponse)
        }

        let decoder = JSONDecoder()
        let updated = try decoder.decode([PortalProject].self, from: data)
        guard let first = updated.first else {
            throw URLError(.cannotParseResponse)
        }
        return first
    }

    // MARK: - Prompt Template

    public func fetchPromptTemplate(projectId: String) async throws -> PortalPromptTemplate {
        if isDemoMode {
            if let template = demoTemplates[projectId] {
                return template
            }
            let def = PortalPromptTemplate(
                id: "tpl-\(projectId)",
                projectId: projectId,
                templateText: PromptGenerator.defaultTemplate,
                updatedAt: Date()
            )
            demoTemplates[projectId] = def
            return def
        }

        let request = try makeRequest(
            path: "/rest/v1/prompt_templates",
            queryItems: [
                URLQueryItem(name: "project_id", value: "eq.\(projectId)"),
                URLQueryItem(name: "select", value: "*")
            ]
        )

        let (data, httpResponse) = try await executeRequest(request)
        guard (200...299).contains(httpResponse.statusCode) else {
            throw URLError(.badServerResponse)
        }

        let decoder = JSONDecoder()
        let templates = try decoder.decode([PortalPromptTemplate].self, from: data)
        guard let first = templates.first else {
            return PortalPromptTemplate(
                id: "default",
                projectId: projectId,
                templateText: PromptGenerator.defaultTemplate,
                updatedAt: Date()
            )
        }
        return first
    }

    public func updatePromptTemplate(projectId: String, templateText: String) async throws {
        if isDemoMode {
            demoTemplates[projectId] = PortalPromptTemplate(
                id: "tpl-\(projectId)",
                projectId: projectId,
                templateText: templateText,
                updatedAt: Date()
            )
            return
        }

        let payload: [String: Any] = [
            "template_text": templateText,
            "updated_at": ISO8601DateFormatter().string(from: Date())
        ]
        let bodyData = try JSONSerialization.data(withJSONObject: payload)

        let request = try makeRequest(
            path: "/rest/v1/prompt_templates",
            method: "PATCH",
            queryItems: [URLQueryItem(name: "project_id", value: "eq.\(projectId)")],
            body: bodyData
        )
        let (_, httpResponse) = try await executeRequest(request)
        guard (200...299).contains(httpResponse.statusCode) else {
            throw URLError(.badServerResponse)
        }
    }

    // MARK: - Feedback Items

    public func fetchFeedbackItems(
        projectId: String? = nil,
        includeArchived: Bool = false,
        resolveSignedUrls: Bool = true
    ) async throws -> [PortalFeedbackItem] {
        if isDemoMode {
            var items = demoFeedback
            if let pid = projectId {
                items = items.filter { $0.projectId == pid }
            }
            if !includeArchived {
                items = items.filter { !$0.isArchived }
            }
            if resolveSignedUrls {
                for i in 0..<items.count {
                    if items[i].signedScreenshotUrl == nil && (items[i].screenshotAnnotatedPath != nil || items[i].screenshotRawPath != nil) {
                        items[i].signedScreenshotUrl = try? await getSignedUrl(path: items[i].screenshotAnnotatedPath ?? items[i].screenshotRawPath!)
                    }
                    if items[i].signedRawScreenshotUrl == nil && items[i].screenshotRawPath != nil {
                        items[i].signedRawScreenshotUrl = try? await getSignedUrl(path: items[i].screenshotRawPath!)
                    }
                    if items[i].signedAttachmentUrl == nil && items[i].attachmentPath != nil {
                        items[i].signedAttachmentUrl = try? await getSignedUrl(path: items[i].attachmentPath!)
                    }
                }
            }
            return items.sorted(by: { $0.createdAt > $1.createdAt })
        }

        var queryItems: [URLQueryItem] = [
            URLQueryItem(name: "select", value: "*"),
            URLQueryItem(name: "order", value: "created_at.desc")
        ]
        if let pid = projectId {
            queryItems.append(URLQueryItem(name: "project_id", value: "eq.\(pid)"))
        }
        if !includeArchived {
            queryItems.append(URLQueryItem(name: "is_archived", value: "eq.false"))
        }

        let request = try makeRequest(path: "/rest/v1/feedback_items", queryItems: queryItems)
        let (data, httpResponse) = try await executeRequest(request)
        guard (200...299).contains(httpResponse.statusCode) else {
            throw URLError(.badServerResponse)
        }

        let decoder = JSONDecoder()
        var items = try decoder.decode([PortalFeedbackItem].self, from: data)

        if resolveSignedUrls {
            // Resolve signed URLs for items that have screenshots or attachments in parallel
            await withTaskGroup(of: (Int, String?, String?, String?).self) { group in
                for i in 0..<items.count {
                    let shotPath = items[i].screenshotAnnotatedPath ?? items[i].screenshotRawPath
                    let rawPath = items[i].screenshotRawPath
                    let attachPath = items[i].attachmentPath

                    if shotPath != nil || rawPath != nil || attachPath != nil {
                        group.addTask {
                            let shotUrl = if let sp = shotPath { try? await self.getSignedUrl(path: sp) } else { String?.none }
                            let rawUrl = if let rp = rawPath { try? await self.getSignedUrl(path: rp) } else { String?.none }
                            let attachUrl = if let ap = attachPath { try? await self.getSignedUrl(path: ap) } else { String?.none }
                            return (i, shotUrl, rawUrl, attachUrl)
                        }
                    }
                }

                for await (idx, shotUrl, rawUrl, attachUrl) in group {
                    items[idx].signedScreenshotUrl = shotUrl
                    items[idx].signedRawScreenshotUrl = rawUrl
                    items[idx].signedAttachmentUrl = attachUrl
                }
            }
        }
        return items
    }

    public func updateFeedbackStatus(id: String, status: PortalFeedbackStatus) async throws {
        if isDemoMode {
            if let idx = demoFeedback.firstIndex(where: { $0.id == id }) {
                demoFeedback[idx].status = status
            }
            return
        }

        let payload = ["status": status.rawValue]
        let bodyData = try JSONSerialization.data(withJSONObject: payload)

        let request = try makeRequest(
            path: "/rest/v1/feedback_items",
            method: "PATCH",
            queryItems: [URLQueryItem(name: "id", value: "eq.\(id)")],
            body: bodyData
        )
        let (_, httpResponse) = try await executeRequest(request)
        guard (200...299).contains(httpResponse.statusCode) else {
            throw URLError(.badServerResponse)
        }
    }

    public func updateFeedbackArchive(id: String, isArchived: Bool) async throws {
        if isDemoMode {
            if let idx = demoFeedback.firstIndex(where: { $0.id == id }) {
                demoFeedback[idx].isArchived = isArchived
            }
            return
        }

        let payload = ["is_archived": isArchived]
        let bodyData = try JSONSerialization.data(withJSONObject: payload)

        let request = try makeRequest(
            path: "/rest/v1/feedback_items",
            method: "PATCH",
            queryItems: [URLQueryItem(name: "id", value: "eq.\(id)")],
            body: bodyData
        )
        let (_, httpResponse) = try await executeRequest(request)
        guard (200...299).contains(httpResponse.statusCode) else {
            throw URLError(.badServerResponse)
        }
    }

    public func saveEditedPrompt(id: String, prompt: String) async throws {
        if isDemoMode {
            if let idx = demoFeedback.firstIndex(where: { $0.id == id }) {
                demoFeedback[idx].editedPrompt = prompt
            }
            return
        }

        let payload = ["edited_prompt": prompt]
        let bodyData = try JSONSerialization.data(withJSONObject: payload)

        let request = try makeRequest(
            path: "/rest/v1/feedback_items",
            method: "PATCH",
            queryItems: [URLQueryItem(name: "id", value: "eq.\(id)")],
            body: bodyData
        )
        let (_, httpResponse) = try await executeRequest(request)
        guard (200...299).contains(httpResponse.statusCode) else {
            throw URLError(.badServerResponse)
        }
    }

    public func deleteFeedbackItem(id: String) async throws {
        if isDemoMode {
            demoFeedback.removeAll { $0.id == id }
            return
        }

        let request = try makeRequest(
            path: "/rest/v1/feedback_items",
            method: "DELETE",
            queryItems: [URLQueryItem(name: "id", value: "eq.\(id)")]
        )
        let (_, httpResponse) = try await executeRequest(request)
        guard (200...299).contains(httpResponse.statusCode) else {
            throw URLError(.badServerResponse)
        }
    }

    public func batchUpdateStatus(ids: [String], status: PortalFeedbackStatus) async throws {
        for id in ids {
            try await updateFeedbackStatus(id: id, status: status)
        }
    }

    public func batchArchive(ids: [String], isArchived: Bool) async throws {
        for id in ids {
            try await updateFeedbackArchive(id: id, isArchived: isArchived)
        }
    }

    public func batchDelete(ids: [String]) async throws {
        for id in ids {
            try await deleteFeedbackItem(id: id)
        }
    }

    // MARK: - Storage

    public func getSignedUrl(path: String, expiresIn: Int = 3600) async throws -> String {
        if isDemoMode {
            return "https://images.unsplash.com/photo-1555774698-0b77e0d5fac6?w=800&auto=format&fit=crop"
        }

        var cleanPath = path.hasPrefix("/") ? String(path.dropFirst()) : path
        if cleanPath.hasPrefix("feedback-screenshots/") {
            cleanPath = String(cleanPath.dropFirst("feedback-screenshots/".count))
        }

        if let cached = signedUrlCache[cleanPath], cached.expiresAt > Date() {
            return cached.url
        }

        let payload = ["expiresIn": expiresIn]
        let bodyData = try JSONSerialization.data(withJSONObject: payload)

        let request = try makeRequest(
            path: "/storage/v1/object/sign/feedback-screenshots/\(cleanPath)",
            method: "POST",
            body: bodyData
        )

        let (data, httpResponse) = try await executeRequest(request)
        guard (200...299).contains(httpResponse.statusCode) else {
            throw URLError(.badServerResponse)
        }

        if let json = try? JSONSerialization.jsonObject(with: data) as? [String: Any],
           let signedUrl = json["signedURL"] as? String {
            let fullUrl: String
            if signedUrl.hasPrefix("http") {
                fullUrl = signedUrl
            } else if signedUrl.hasPrefix("/storage/v1") {
                fullUrl = "\(supabaseUrl)\(signedUrl)"
            } else {
                let normalized = signedUrl.hasPrefix("/") ? signedUrl : "/\(signedUrl)"
                fullUrl = "\(supabaseUrl)/storage/v1\(normalized)"
            }
            signedUrlCache[cleanPath] = (url: fullUrl, expiresAt: Date().addingTimeInterval(TimeInterval(max(60, expiresIn - 300))))
            return fullUrl
        }
        throw URLError(.cannotParseResponse)
    }

    // MARK: - GitHub Issue Creation

    public func createGitHubIssue(feedbackId: String, projectId: String) async throws -> (issueUrl: String, issueNumber: Int) {
        if isDemoMode {
            let fakeNumber = Int.random(in: 50...100)
            let fakeUrl = "https://github.com/tianhaoz95/feedback-kit/issues/\(fakeNumber)"
            if let idx = demoFeedback.firstIndex(where: { $0.id == feedbackId }) {
                demoFeedback[idx].githubIssueUrl = fakeUrl
                demoFeedback[idx].githubIssueNumber = fakeNumber
                demoFeedback[idx].status = .inProgress
            }
            return (fakeUrl, fakeNumber)
        }

        let payload: [String: Any] = [
            "feedback_id": feedbackId,
            "project_id": projectId
        ]
        let bodyData = try JSONSerialization.data(withJSONObject: payload)

        let request = try makeRequest(
            path: "/functions/v1/create-github-issue",
            method: "POST",
            body: bodyData
        )

        let (data, httpResponse) = try await executeRequest(request)
        guard (200...299).contains(httpResponse.statusCode) else {
            throw URLError(.badServerResponse)
        }

        if let json = try? JSONSerialization.jsonObject(with: data) as? [String: Any],
           let issueUrl = json["issue_url"] as? String,
           let issueNumber = json["issue_number"] as? Int {
            return (issueUrl, issueNumber)
        }
        throw URLError(.cannotParseResponse)
    }

    // MARK: - CLI Sessions

    public func fetchCliSessions() async throws -> [PortalCliSession] {
        if isDemoMode {
            return demoSessions.sorted(by: { $0.createdAt > $1.createdAt })
        }

        let request = try makeRequest(
            path: "/rest/v1/cli_sessions",
            queryItems: [
                URLQueryItem(name: "select", value: "*"),
                URLQueryItem(name: "order", value: "created_at.desc")
            ]
        )

        let (data, httpResponse) = try await executeRequest(request)
        guard (200...299).contains(httpResponse.statusCode) else {
            throw URLError(.badServerResponse)
        }

        let decoder = JSONDecoder()
        return try decoder.decode([PortalCliSession].self, from: data)
    }

    public func revokeCliSession(id: String) async throws {
        if isDemoMode {
            if let idx = demoSessions.firstIndex(where: { $0.id == id }) {
                demoSessions[idx].revokedAt = Date()
            }
            return
        }

        let payload = ["revoked_at": ISO8601DateFormatter().string(from: Date())]
        let bodyData = try JSONSerialization.data(withJSONObject: payload)

        let request = try makeRequest(
            path: "/rest/v1/cli_sessions",
            method: "PATCH",
            queryItems: [URLQueryItem(name: "id", value: "eq.\(id)")],
            body: bodyData
        )
        let (_, httpResponse) = try await executeRequest(request)
        guard (200...299).contains(httpResponse.statusCode) else {
            throw URLError(.badServerResponse)
        }
    }

    // MARK: - Fix loop timeline (0014_closed_loop.sql)

    public func fetchFeedbackEvents(feedbackId: String) async throws -> [PortalFeedbackEvent] {
        if isDemoMode { return [] }
        let request = try makeRequest(
            path: "/rest/v1/feedback_events",
            queryItems: [
                URLQueryItem(name: "select", value: "*"),
                URLQueryItem(name: "feedback_id", value: "eq.\(feedbackId)"),
                URLQueryItem(name: "order", value: "created_at.asc")
            ]
        )
        let (data, httpResponse) = try await executeRequest(request)
        guard (200...299).contains(httpResponse.statusCode) else {
            throw URLError(.badServerResponse)
        }
        return try JSONDecoder().decode([PortalFeedbackEvent].self, from: data)
    }

    /// Adds a note, a note to the reporter, or a question for the reporter
    /// (`kind` "comment"/"question"), as the signed-in user. RLS requires
    /// `actor_user_id` to be the caller.
    public func postFeedbackEvent(
        item: PortalFeedbackItem,
        kind: String,
        body: String,
        visibleToReporter: Bool
    ) async throws {
        if isDemoMode { return }
        guard let session = currentSession, !session.userId.isEmpty else {
            throw URLError(.userAuthenticationRequired)
        }
        let payload: [String: Any] = [
            "feedback_id": item.id,
            "project_id": item.projectId,
            "kind": kind,
            "actor_type": "user",
            "actor_user_id": session.userId,
            "actor_label": "Developer Portal",
            "body": body,
            "visible_to_reporter": visibleToReporter
        ]
        let request = try makeRequest(
            path: "/rest/v1/feedback_events",
            method: "POST",
            body: try JSONSerialization.data(withJSONObject: payload)
        )
        let (_, httpResponse) = try await executeRequest(request)
        guard (200...299).contains(httpResponse.statusCode) else {
            throw URLError(.badServerResponse)
        }
    }
}
