import XCTest
import FeedbackKit
@testable import FeedbackPortal

final class PortalTests: XCTestCase {
    func testPromptGeneratorSingleItem() {
        let item = DemoData.sampleFeedbackItems[0]
        let template = "Issue on {{screen_name}} ({{os_name}} {{os_version}}): {{feedback_text}}"
        let rendered = PromptGenerator.renderPrompt(
            template: template,
            feedback: item,
            screenshotUrl: "https://example.com/shot.png",
            attachmentUrl: nil
        )

        XCTAssertTrue(rendered.contains("CartView"))
        XCTAssertTrue(rendered.contains("iOS 18.3"))
        XCTAssertTrue(rendered.contains("Add to Cart"))
    }

    func testPromptGeneratorMergedItems() {
        let items = Array(DemoData.sampleFeedbackItems.prefix(2))
        let merged = PromptGenerator.renderMergedPrompt(items: items)

        XCTAssertTrue(merged.contains("Summary of Issues (2 total)"))
        XCTAssertTrue(merged.contains("Issue 1: [CartView]"))
        XCTAssertTrue(merged.contains("Issue 2: [SettingsView]"))
        XCTAssertTrue(merged.contains("Coordinated Implementation Guidelines"))
    }

    @MainActor
    func testDemoModeMutations() async throws {
        let client = SupabasePortalClient.shared
        client.enableDemoMode()

        let projects = try await client.fetchProjects()
        XCTAssertFalse(projects.isEmpty)

        // Test status update
        let firstItem = DemoData.sampleFeedbackItems[0]
        try await client.updateFeedbackStatus(id: firstItem.id, status: .resolved)

        let updatedItems = try await client.fetchFeedbackItems(projectId: firstItem.projectId, includeArchived: false)
        let resolvedItem = updatedItems.first(where: { $0.id == firstItem.id })
        XCTAssertEqual(resolvedItem?.status, .resolved)

        // Test archive toggle
        try await client.updateFeedbackArchive(id: firstItem.id, isArchived: true)
        let activeItems = try await client.fetchFeedbackItems(projectId: firstItem.projectId, includeArchived: false)
        XCTAssertFalse(activeItems.contains(where: { $0.id == firstItem.id }))

        let archivedItems = try await client.fetchFeedbackItems(projectId: firstItem.projectId, includeArchived: true)
        XCTAssertTrue(archivedItems.contains(where: { $0.id == firstItem.id }))

        // Test project creation
        let newProj = try await client.createProject(name: "Test iOS App", githubRepo: "test/app")
        XCTAssertEqual(newProj.name, "Test iOS App")
        XCTAssertTrue(newProj.projectKey.hasPrefix("fk_live_"))

        // Test CLI session revocation
        let sessions = try await client.fetchCliSessions()
        XCTAssertFalse(sessions.isEmpty)
        let firstSession = sessions[0]
        try await client.revokeCliSession(id: firstSession.id)

        let reloadedSessions = try await client.fetchCliSessions()
        let revoked = reloadedSessions.first(where: { $0.id == firstSession.id })
        XCTAssertNotNil(revoked?.revokedAt)
        XCTAssertFalse(revoked?.isActive ?? true)
    }

    func testStatusEnumMapping() {
        XCTAssertEqual(PortalFeedbackStatus.new.displayName, "New")
        XCTAssertEqual(PortalFeedbackStatus.inProgress.displayName, "In Progress")
        XCTAssertEqual(PortalFeedbackStatus.resolved.displayName, "Resolved")
        XCTAssertEqual(PortalFeedbackStatus.wontFix.displayName, "Won't Fix")
    }

    @MainActor
    func testDefaultSupabaseEndpointIsProduction() {
        XCTAssertEqual(SupabasePortalClient.defaultProdUrl, "https://gpucoladcyvijefdjudf.supabase.co")
        XCTAssertEqual(SupabasePortalClient.defaultProdAnonKey, "sb_publishable_crkqEdaacVS02etk6k16ag_ATIk-8Kn")
        XCTAssertEqual(SupabasePortalClient.shared.supabaseUrl, "https://gpucoladcyvijefdjudf.supabase.co")
    }

    @MainActor
    func testScreenshotUrlsInDemoMode() async throws {
        let client = SupabasePortalClient.shared
        client.enableDemoMode()

        let items = try await client.fetchFeedbackItems(projectId: "proj-1", includeArchived: false)
        XCTAssertFalse(items.isEmpty)

        let itemsWithScreenshots = items.filter { $0.screenshotAnnotatedPath != nil || $0.screenshotRawPath != nil }
        XCTAssertFalse(itemsWithScreenshots.isEmpty)

        for item in itemsWithScreenshots {
            XCTAssertNotNil(item.signedScreenshotUrl, "Item \(item.id) should have a signedScreenshotUrl")
            XCTAssertTrue(item.signedScreenshotUrl?.hasPrefix("http") ?? false)
        }
    }

    func testSwiftSyntaxHighlighter() {
        let snippet = """
        import SwiftUI
        import FeedbackKit

        @main
        struct MyApp: App {
            var body: some Scene {
                Text("Hello")
            }
        }
        """
        let highlighted = SwiftSyntaxHighlighter.highlight(snippet)
        XCTAssertEqual(String(highlighted.characters), snippet)
    }

    func testPortalUserSessionFromJWT() {
        // Construct a sample JWT payload
        let payload: [String: Any] = [
            "sub": "user-12345",
            "email": "developer@example.com",
            "user_metadata": [
                "avatar_url": "https://avatars.githubusercontent.com/u/12345?v=4",
                "user_name": "developer"
            ]
        ]
        let data = try! JSONSerialization.data(withJSONObject: payload)
        let base64 = data.base64EncodedString()
            .replacingOccurrences(of: "+", with: "-")
            .replacingOccurrences(of: "/", with: "_")
            .replacingOccurrences(of: "=", with: "")
        let fakeToken = "header.\(base64).signature"

        let session = PortalUserSession.fromJWT(accessToken: fakeToken, refreshToken: "refresh-123")
        XCTAssertEqual(session.userId, "user-12345")
        XCTAssertEqual(session.email, "developer@example.com")
        XCTAssertEqual(session.avatarUrl, "https://avatars.githubusercontent.com/u/12345?v=4")
        XCTAssertEqual(session.githubUsername, "developer")
    }

    @MainActor
    func testDemoModeSetsGitHubProfile() {
        let client = SupabasePortalClient.shared
        client.enableDemoMode()
        XCTAssertNotNil(client.currentSession)
        XCTAssertEqual(client.currentSession?.githubUsername, "octocat")
        XCTAssertEqual(client.currentSession?.avatarUrl, "https://avatars.githubusercontent.com/u/583231?v=4")
    }

    @MainActor
    func testClearCache() {
        let client = SupabasePortalClient.shared
        client.clearCache()
    }

    @MainActor
    func testAppStateLoadFeedbackPreservesIsLoadingWhenItemsExist() async {
        let appState = AppState.shared
        SupabasePortalClient.shared.enableDemoMode()
        await appState.loadProjects()

        XCTAssertFalse(appState.feedbackItems.isEmpty)
        XCTAssertFalse(appState.isLoading)

        // When loadFeedback is called with items already present (like pull-to-refresh),
        // isLoading must not be flipped to true to avoid cancelling the refresh gesture
        await appState.loadFeedback()
        XCTAssertFalse(appState.isLoading)
    }

    func testAppVersionFormatting() {
        let version = Bundle.main.infoDictionary?["CFBundleShortVersionString"] as? String ?? "1.0"
        let build = Bundle.main.infoDictionary?["CFBundleVersion"] as? String ?? "1"
        let formatted = "Version \(version) (Build \(build))"
        XCTAssertTrue(formatted.hasPrefix("Version "))
        XCTAssertTrue(formatted.contains("(Build "))
    }

    @MainActor
    func testUpdateProjectGitHubRepoConnectAndDisconnect() async throws {
        let client = SupabasePortalClient.shared
        client.enableDemoMode()

        let project = try await client.createProject(name: "Repo Test Project", githubRepo: nil)
        XCTAssertNil(project.githubRepo)

        // Connect
        let connected = try await client.updateProjectGitHubRepo(id: project.id, githubRepo: "octocat/Hello-World")
        XCTAssertEqual(connected.githubRepo, "octocat/Hello-World")

        // Disconnect
        let disconnected = try await client.updateProjectGitHubRepo(id: project.id, githubRepo: nil)
        XCTAssertNil(disconnected.githubRepo)
    }

    func testPromptGeneratorOmittedScreenshotWhenUnavailable() {
        let item = DemoData.sampleFeedbackItems[2] // Item with nil screenshot
        XCTAssertNil(item.screenshotRawPath)
        XCTAssertNil(item.screenshotAnnotatedPath)

        let rendered = PromptGenerator.renderPrompt(
            template: PromptGenerator.defaultTemplate,
            feedback: item,
            screenshotUrl: nil,
            attachmentUrl: nil
        )

        XCTAssertFalse(rendered.contains("## Screenshot"))
        XCTAssertFalse(rendered.contains("(screenshot unavailable)"))
        XCTAssertTrue(rendered.contains("## User's report"))
        XCTAssertTrue(rendered.contains("## Environment"))
        XCTAssertTrue(rendered.contains("## Task"))
    }

    func testPromptGeneratorMergedOmittedScreenshot() {
        let items = [DemoData.sampleFeedbackItems[2], DemoData.sampleFeedbackItems[3]] // Items with nil screenshot
        let merged = PromptGenerator.renderMergedPrompt(items: items)

        XCTAssertFalse(merged.contains("Screenshot URL"))
        XCTAssertTrue(merged.contains("Report ID"))
    }

    @MainActor
    func testFetchFeedbackItemsResolveSignedUrls() async throws {
        let client = SupabasePortalClient.shared
        client.enableDemoMode()

        let withoutUrls = try await client.fetchFeedbackItems(projectId: "proj-1", includeArchived: false, resolveSignedUrls: false)
        XCTAssertFalse(withoutUrls.isEmpty)

        let withUrls = try await client.fetchFeedbackItems(projectId: "proj-1", includeArchived: false, resolveSignedUrls: true)
        XCTAssertFalse(withUrls.isEmpty)
        let itemWithScreenshot = withUrls.first(where: { $0.screenshotAnnotatedPath != nil || $0.screenshotRawPath != nil })
        XCTAssertNotNil(itemWithScreenshot?.signedScreenshotUrl)
    }

    @MainActor
    func testAppStateLoadProjectsPopulatesSelectedProject() async {
        let appState = AppState.shared
        SupabasePortalClient.shared.enableDemoMode()
        appState.projects = []
        appState.selectedProject = nil

        await appState.loadProjects()

        XCTAssertFalse(appState.projects.isEmpty)
        XCTAssertNotNil(appState.selectedProject)
        XCTAssertEqual(appState.selectedProject?.id, appState.projects.first?.id)
        XCTAssertFalse(appState.feedbackItems.isEmpty)
        XCTAssertNil(appState.errorMessage)
    }
}
