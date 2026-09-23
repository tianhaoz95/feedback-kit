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
}
