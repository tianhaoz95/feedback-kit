import Foundation
import SwiftUI
import FeedbackKit

@MainActor
public final class AppState: ObservableObject {
    public static let shared = AppState()

    public static let lastSelectedProjectIdKey = "portal_last_selected_project_id"
    public static let lastSelectedProjectDataKey = "portal_last_selected_project_data"
    public static let currentOrganizationIdKey = "portal_current_organization_id"

    /// The iOS tab bar's tabs (the Mac sidebar has its own sections).
    public enum Tab: Hashable {
        case feedback, activity, projects, settings
    }

    // MARK: - Organizations & notifications (0016_teams.sql, 0017_notifications.sql)

    /// Every organization the user belongs to; projects and feedback are scoped to `currentOrganization`.
    @Published public var organizations: [PortalOrganization] = []
    @Published public private(set) var currentOrganization: PortalOrganization?
    @Published public var notifications: [PortalNotification] = []
    @Published public var unreadNotificationCount: Int = 0
    @Published public var selectedTab: Tab = .feedback
    /// Set when a push notification is tapped; the Activity screen opens this report.
    @Published public var pendingNotificationFeedbackId: String?

    // MARK: - Published Properties

    @Published public var projects: [PortalProject] = []
    @Published public var selectedProject: PortalProject? {
        didSet {
            if let project = selectedProject {
                UserDefaults.standard.set(project.id, forKey: Self.lastSelectedProjectIdKey)
                if let data = try? JSONEncoder().encode(project) {
                    UserDefaults.standard.set(data, forKey: Self.lastSelectedProjectDataKey)
                }
            } else {
                UserDefaults.standard.removeObject(forKey: Self.lastSelectedProjectIdKey)
                UserDefaults.standard.removeObject(forKey: Self.lastSelectedProjectDataKey)
                UserDefaults.standard.removeObject(forKey: "last_selected_project_id")
            }
            guard oldValue?.id != selectedProject?.id else { return }
            inFlightFeedbackTask?.cancel()
            inFlightFeedbackTask = nil
            selectedFeedbackIds.removeAll()
            isMultiSelectActive = false
            if !isSyncingProjects {
                Task {
                    await loadFeedback()
                }
            }
        }
    }

    public init() {
        if let data = UserDefaults.standard.data(forKey: Self.lastSelectedProjectDataKey),
           let cached = try? JSONDecoder().decode(PortalProject.self, from: data) {
            self._selectedProject = Published(initialValue: cached)
        }
    }

    @Published public var feedbackItems: [PortalFeedbackItem] = []
    @Published public var promptTemplate: PortalPromptTemplate?

    @Published public var statusFilter: PortalFeedbackStatus? = nil
    @Published public var showArchived: Bool = false {
        didSet {
            guard oldValue != showArchived else { return }
            selectedFeedbackIds.removeAll()
            isMultiSelectActive = false
        }
    }
    @Published public var searchQuery: String = ""

    // Multi-select for batch triage & merged prompts
    @Published public var isMultiSelectActive: Bool = false
    @Published public var selectedFeedbackIds: Set<String> = []

    @Published public var isLoading: Bool = true
    @Published public var errorMessage: String? = nil

    private var isSyncingProjects: Bool = false
    private var inFlightFeedbackTask: Task<Void, Never>? = nil
    private let client = SupabasePortalClient.shared

    // MARK: - Computed Filtered Items

    public var filteredFeedbackItems: [PortalFeedbackItem] {
        feedbackItems.filter { item in
            // Status filter
            if let filter = statusFilter, item.status != filter {
                return false
            }
            // Archive filter
            if item.isArchived != showArchived {
                return false
            }
            // Search query
            if !searchQuery.isEmpty {
                let q = searchQuery.lowercased()
                let matchesText = item.text.lowercased().contains(q)
                let matchesScreen = item.environment.screenName?.lowercased().contains(q) ?? false
                let matchesDevice = item.environment.deviceModel.lowercased().contains(q)
                if !matchesText && !matchesScreen && !matchesDevice {
                    return false
                }
            }
            return true
        }
    }

    public var selectedFeedbackItems: [PortalFeedbackItem] {
        feedbackItems.filter { selectedFeedbackIds.contains($0.id) }
    }

    public var archivedCount: Int {
        feedbackItems.filter { $0.isArchived }.count
    }

    public var activeCount: Int {
        feedbackItems.filter { !$0.isArchived }.count
    }

    // MARK: - Actions

    public func loadProjects() async {
        isLoading = true
        isSyncingProjects = true
        errorMessage = nil
        await loadOrganizations()
        do {
            let loaded = try await client.fetchProjects(organizationId: currentOrganization?.id)
            self.projects = loaded
            let savedId = UserDefaults.standard.string(forKey: Self.lastSelectedProjectIdKey)
                ?? UserDefaults.standard.string(forKey: "last_selected_project_id")

            if let savedId = savedId, let matched = loaded.first(where: { $0.id == savedId }) {
                self.selectedProject = matched
            } else if selectedProject == nil || !loaded.contains(where: { $0.id == selectedProject?.id }) {
                self.selectedProject = loaded.first
            } else if let currentId = selectedProject?.id, let refreshed = loaded.first(where: { $0.id == currentId }) {
                self.selectedProject = refreshed
            }
            if selectedProject != nil {
                await loadFeedback()
            } else {
                self.feedbackItems = []
            }
        } catch {
            self.errorMessage = error.localizedDescription
        }
        isSyncingProjects = false
        isLoading = false
    }

    // MARK: - Organizations

    public func loadOrganizations() async {
        guard let loaded = try? await client.fetchOrganizations() else { return }
        organizations = loaded
        let savedId = UserDefaults.standard.string(forKey: Self.currentOrganizationIdKey)
        currentOrganization = loaded.first { $0.id == (currentOrganization?.id ?? savedId) } ?? loaded.first
    }

    /// Switches every list (projects, feedback) to another organization.
    public func switchOrganization(to organization: PortalOrganization) async {
        guard organization.id != currentOrganization?.id else { return }
        UserDefaults.standard.set(organization.id, forKey: Self.currentOrganizationIdKey)
        currentOrganization = organization
        isSyncingProjects = true
        selectedProject = nil
        feedbackItems = []
        isSyncingProjects = false
        await loadProjects()
    }

    public func createOrganization(name: String) async throws {
        let id = try await client.createOrganization(name: name)
        await loadOrganizations()
        if let created = organizations.first(where: { $0.id == id }) {
            await switchOrganization(to: created)
        }
    }

    /// After leaving (or losing access to) the current organization.
    public func organizationMembershipChanged() async {
        UserDefaults.standard.removeObject(forKey: Self.currentOrganizationIdKey)
        currentOrganization = nil
        selectedProject = nil
        await loadProjects()
    }

    // MARK: - Notifications

    public func loadNotifications() async {
        do {
            async let list = client.fetchNotifications()
            async let unread = client.fetchUnreadNotificationCount()
            let (items, count) = try await (list, unread)
            notifications = items
            unreadNotificationCount = count
            PortalBadge.set(count)
        } catch {
            // Keep what's on screen; the next refresh will try again.
        }
    }

    public func refreshUnreadNotificationCount() async {
        guard let count = try? await client.fetchUnreadNotificationCount() else { return }
        if count != unreadNotificationCount {
            unreadNotificationCount = count
            PortalBadge.set(count)
            // Something new arrived: refresh the list too.
            notifications = (try? await client.fetchNotifications()) ?? notifications
        }
    }

    public func markNotificationRead(_ notification: PortalNotification) async {
        guard !notification.isRead else { return }
        if let i = notifications.firstIndex(where: { $0.id == notification.id }) {
            notifications[i].readAt = Date()
        }
        unreadNotificationCount = max(0, unreadNotificationCount - 1)
        PortalBadge.set(unreadNotificationCount)
        try? await client.markNotificationRead(id: notification.id)
    }

    public func markAllNotificationsRead() async {
        for i in notifications.indices where notifications[i].readAt == nil {
            notifications[i].readAt = Date()
        }
        unreadNotificationCount = 0
        PortalBadge.set(0)
        try? await client.markAllNotificationsRead()
    }

    /// Makes a notification's organization and project current, so going
    /// back from the report lands in the right inbox.
    public func focus(on notification: PortalNotification) async {
        if notification.organizationId != currentOrganization?.id,
           let org = organizations.first(where: { $0.id == notification.organizationId }) {
            await switchOrganization(to: org)
        }
        if let projectId = notification.projectId, projectId != selectedProject?.id,
           let project = projects.first(where: { $0.id == projectId }) {
            selectedProject = project
        }
    }

    /// Called when a push notification is tapped.
    public func openFromPush(notificationId: String?, feedbackId: String?) async {
        selectedTab = .activity
        await loadNotifications()
        if let notificationId, let n = notifications.first(where: { $0.id == notificationId }) {
            await markNotificationRead(n)
            await focus(on: n)
        }
        pendingNotificationFeedbackId = feedbackId
    }

    /// Clears everything user-specific on sign-out.
    public func resetForSignOut() {
        projects = []
        selectedProject = nil
        feedbackItems = []
        organizations = []
        currentOrganization = nil
        notifications = []
        unreadNotificationCount = 0
        PortalBadge.set(0)
        UserDefaults.standard.removeObject(forKey: Self.currentOrganizationIdKey)
    }

    public func updateProjectGitHubRepo(projectId: String, githubRepo: String?) async throws {
        let updated = try await client.updateProjectGitHubRepo(id: projectId, githubRepo: githubRepo)
        if let idx = projects.firstIndex(where: { $0.id == projectId }) {
            projects[idx] = updated
        }
        if selectedProject?.id == projectId {
            selectedProject = updated
        }
    }

    public func loadFeedback() async {
        if let existing = inFlightFeedbackTask {
            await existing.value
            return
        }

        let task = Task { @MainActor in
            guard let proj = selectedProject else {
                self.feedbackItems = []
                self.isLoading = false
                return
            }

            // Only flip isLoading when items are empty (initial load).
            // Avoid mutating isLoading on pull-to-refresh or background refreshes
            // because mutating @Published properties observed by the list causes
            // SwiftUI to invalidate the view hierarchy mid-gesture, cancelling the
            // refreshable task and causing the loading spinner to get stuck.
            if self.feedbackItems.isEmpty {
                self.isLoading = true
            }

            defer {
                self.isLoading = false
            }

            do {
                async let itemsTask = client.fetchFeedbackItems(projectId: proj.id, includeArchived: true)
                async let templateTask = client.fetchPromptTemplate(projectId: proj.id)

                let (items, template) = try await (itemsTask, templateTask)
                self.feedbackItems = items
                self.promptTemplate = template
            } catch is CancellationError {
                // Task was cancelled, ignore
                return
            } catch {
                self.errorMessage = error.localizedDescription
            }
        }

        inFlightFeedbackTask = task
        await task.value
        inFlightFeedbackTask = nil
    }

    public func updateStatus(item: PortalFeedbackItem, to newStatus: PortalFeedbackStatus) async {
        // Optimistic UI update
        if let idx = feedbackItems.firstIndex(where: { $0.id == item.id }) {
            feedbackItems[idx].status = newStatus
        }
        UIImpactFeedbackGenerator(style: .medium).impactOccurred()

        do {
            try await client.updateFeedbackStatus(id: item.id, status: newStatus)
            // Reload project counts in background
            Task {
                self.projects = (try? await client.fetchProjects(organizationId: currentOrganization?.id)) ?? self.projects
            }
        } catch {
            // Revert on error
            if let idx = feedbackItems.firstIndex(where: { $0.id == item.id }) {
                feedbackItems[idx].status = item.status
            }
            self.errorMessage = "Failed to update status: \(error.localizedDescription)"
        }
    }

    public func toggleArchive(item: PortalFeedbackItem) async {
        let newArchived = !item.isArchived
        if let idx = feedbackItems.firstIndex(where: { $0.id == item.id }) {
            feedbackItems[idx].isArchived = newArchived
        }
        UIImpactFeedbackGenerator(style: .rigid).impactOccurred()

        do {
            try await client.updateFeedbackArchive(id: item.id, isArchived: newArchived)
            Task {
                self.projects = (try? await client.fetchProjects(organizationId: currentOrganization?.id)) ?? self.projects
            }
        } catch {
            if let idx = feedbackItems.firstIndex(where: { $0.id == item.id }) {
                feedbackItems[idx].isArchived = item.isArchived
            }
            self.errorMessage = "Failed to toggle archive: \(error.localizedDescription)"
        }
    }

    public func delete(item: PortalFeedbackItem) async {
        feedbackItems.removeAll { $0.id == item.id }
        selectedFeedbackIds.remove(item.id)
        UINotificationFeedbackGenerator().notificationOccurred(.warning)

        do {
            try await client.deleteFeedbackItem(id: item.id)
            Task {
                self.projects = (try? await client.fetchProjects(organizationId: currentOrganization?.id)) ?? self.projects
            }
        } catch {
            await loadFeedback()
            self.errorMessage = "Failed to delete: \(error.localizedDescription)"
        }
    }

    // MARK: - Batch Actions

    public func batchUpdateStatus(status: PortalFeedbackStatus) async {
        let ids = Array(selectedFeedbackIds)
        guard !ids.isEmpty else { return }

        for id in ids {
            if let idx = feedbackItems.firstIndex(where: { $0.id == id }) {
                feedbackItems[idx].status = status
            }
        }
        selectedFeedbackIds.removeAll()
        isMultiSelectActive = false
        UINotificationFeedbackGenerator().notificationOccurred(.success)

        do {
            try await client.batchUpdateStatus(ids: ids, status: status)
            Task {
                self.projects = (try? await client.fetchProjects(organizationId: currentOrganization?.id)) ?? self.projects
            }
        } catch {
            await loadFeedback()
            self.errorMessage = error.localizedDescription
        }
    }

    public func batchArchive(isArchived: Bool) async {
        let ids = Array(selectedFeedbackIds)
        guard !ids.isEmpty else { return }

        for id in ids {
            if let idx = feedbackItems.firstIndex(where: { $0.id == id }) {
                feedbackItems[idx].isArchived = isArchived
            }
        }
        selectedFeedbackIds.removeAll()
        isMultiSelectActive = false
        UINotificationFeedbackGenerator().notificationOccurred(.success)

        do {
            try await client.batchArchive(ids: ids, isArchived: isArchived)
            Task {
                self.projects = (try? await client.fetchProjects(organizationId: currentOrganization?.id)) ?? self.projects
            }
        } catch {
            await loadFeedback()
            self.errorMessage = error.localizedDescription
        }
    }

    public func batchDelete() async {
        let ids = Array(selectedFeedbackIds)
        guard !ids.isEmpty else { return }

        feedbackItems.removeAll { ids.contains($0.id) }
        selectedFeedbackIds.removeAll()
        isMultiSelectActive = false
        UINotificationFeedbackGenerator().notificationOccurred(.warning)

        do {
            try await client.batchDelete(ids: ids)
            Task {
                self.projects = (try? await client.fetchProjects(organizationId: currentOrganization?.id)) ?? self.projects
            }
        } catch {
            await loadFeedback()
            self.errorMessage = error.localizedDescription
        }
    }

    public func toggleSelect(id: String) {
        if selectedFeedbackIds.contains(id) {
            selectedFeedbackIds.remove(id)
        } else {
            selectedFeedbackIds.insert(id)
        }
        UIImpactFeedbackGenerator(style: .light).impactOccurred()
    }

    public func selectAll() {
        let allIds = filteredFeedbackItems.map { $0.id }
        selectedFeedbackIds = Set(allIds)
    }

    public func deselectAll() {
        selectedFeedbackIds.removeAll()
    }
}
