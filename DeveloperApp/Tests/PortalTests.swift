import XCTest
import SwiftUI
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

    func testPromptGeneratorProducts() {
        var item = DemoData.sampleFeedbackItems[0]
        item.products = [
            FeedbackProduct(key: "ios", name: "iOS App", description: "SwiftUI app", isDefault: true),
            FeedbackProduct(key: "backend", name: "Backend API", description: "Node endpoints")
        ]
        let template = "Issue on {{screen_name}}:\n{{products}}"
        let rendered = PromptGenerator.renderPrompt(
            template: template,
            feedback: item,
            screenshotUrl: nil,
            attachmentUrl: nil
        )

        XCTAssertTrue(rendered.contains("- **iOS App** (`ios`): SwiftUI app"))
        XCTAssertTrue(rendered.contains("- **Backend API** (`backend`): Node endpoints"))
    }

    func testPromptGeneratorWebReportAppendsWebContext() throws {
        let json = """
        {"id":"w1","project_id":"p1","text":"Save does nothing","annotations":[{"kind":"arrow","points":[[0.1,0.2],[0.3,0.4]],"colorHex":"#FF3B30","scale":1,"rotation":0}],
         "environment":{"osName":"macOS","osVersion":"15.2","deviceModel":"Chrome 141","appVersion":"2.3.0","appBuild":"45","bundleIdentifier":"app.example.com",
          "screenName":"Settings","locale":"en-US","screenWidthPoints":1280,"screenHeightPoints":800,"screenScale":2,"platform":"web",
          "pageUrl":"https://app.example.com/settings","browserName":"Chrome","browserVersion":"141.0.7390.54"},
         "status":"new","created_at":"2026-09-25T12:00:00Z",
         "logs":[{"level":"error","message":"TypeError: x is undefined","timestamp":"2026-09-25T12:00:01.000Z"}]}
        """
        let item = try JSONDecoder().decode(PortalFeedbackItem.self, from: Data(json.utf8))
        XCTAssertTrue(item.environment.isWeb)
        XCTAssertEqual(item.logs.count, 1)
        XCTAssertEqual(item.annotations.count, 1)

        let rendered = PromptGenerator.renderPrompt(template: "{{feedback_text}}", feedback: item, screenshotUrl: nil, attachmentUrl: nil)
        XCTAssertTrue(rendered.contains("## Web context"))
        XCTAssertTrue(rendered.contains("- Page URL: https://app.example.com/settings"))
        XCTAssertTrue(rendered.contains("- Viewport: 1280×800 @2x"))
        XCTAssertTrue(rendered.contains("12:00:01 [error] TypeError: x is undefined"))

        let explicit = PromptGenerator.renderPrompt(template: "{{platform}} {{page_url}}", feedback: item, screenshotUrl: nil, attachmentUrl: nil)
        XCTAssertEqual(explicit, "Web https://app.example.com/settings")

        let native = PromptGenerator.renderPrompt(template: "{{platform}}", feedback: DemoData.sampleFeedbackItems[0], screenshotUrl: nil, attachmentUrl: nil)
        XCTAssertFalse(native.contains("Web context"))
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

    @MainActor
    func testAppStateArchivedFeedbackFilteringAndCounts() async {
        let appState = AppState.shared
        SupabasePortalClient.shared.enableDemoMode()
        await appState.loadProjects()

        // proj-1 in DemoData has fb-101..fb-105 where fb-104 is isArchived: true
        XCTAssertGreaterThan(appState.feedbackItems.count, 0)
        XCTAssertEqual(appState.archivedCount, 1)
        XCTAssertEqual(appState.activeCount, appState.feedbackItems.count - 1)

        // When showArchived is false (default)
        appState.showArchived = false
        appState.statusFilter = nil
        XCTAssertEqual(appState.filteredFeedbackItems.count, appState.activeCount)
        XCTAssertTrue(appState.filteredFeedbackItems.allSatisfy { !$0.isArchived })

        // When showArchived is true
        appState.showArchived = true
        XCTAssertEqual(appState.filteredFeedbackItems.count, appState.archivedCount)
        XCTAssertTrue(appState.filteredFeedbackItems.allSatisfy { $0.isArchived })

        // Reset
        appState.showArchived = false
    }

    @MainActor
    func testPillFilterViewWithArchivedSupport() {
        var status: PortalFeedbackStatus? = nil
        var showArchived = false

        let statusBinding = Binding<PortalFeedbackStatus?>(
            get: { status },
            set: { status = $0 }
        )
        let archivedBinding = Binding<Bool>(
            get: { showArchived },
            set: { showArchived = $0 }
        )

        let pillView = PillFilterView(
            selectedStatus: statusBinding,
            showArchived: archivedBinding,
            counts: [.new: 3],
            archivedCount: 1
        )
        XCTAssertEqual(pillView.archivedCount, 1)
        XCTAssertEqual(pillView.counts[.new], 3)
    }

    @MainActor
    func testAppStateSelectedProjectPersistentAcrossSessions() async {
        let appState = AppState.shared
        SupabasePortalClient.shared.enableDemoMode()
        await appState.loadProjects()

        XCTAssertGreaterThanOrEqual(appState.projects.count, 2)
        let secondProject = appState.projects[1]

        // User switches project to the second project
        appState.selectedProject = secondProject
        XCTAssertEqual(appState.selectedProject?.id, secondProject.id)

        // Verify it was stored in local preferences
        let savedId = UserDefaults.standard.string(forKey: AppState.lastSelectedProjectIdKey)
        XCTAssertEqual(savedId, secondProject.id)

        // Simulate app reopening: calling loadProjects should restore secondProject, not reset to loaded.first
        await appState.loadProjects()
        XCTAssertEqual(appState.selectedProject?.id, secondProject.id)
        XCTAssertNotEqual(appState.selectedProject?.id, appState.projects.first?.id)

        // Cleanup: reset back to first project
        appState.selectedProject = appState.projects.first
    }

    @MainActor
    func testAppStateSelectedProjectPersistenceFallbackWhenSavedProjectNotFound() async {
        let appState = AppState.shared
        SupabasePortalClient.shared.enableDemoMode()

        // Set a non-existent saved project ID in local preferences
        UserDefaults.standard.set("non-existent-project-id", forKey: AppState.lastSelectedProjectIdKey)

        await appState.loadProjects()

        // Should gracefully fallback to loaded.first
        XCTAssertFalse(appState.projects.isEmpty)
        XCTAssertEqual(appState.selectedProject?.id, appState.projects.first?.id)
        XCTAssertEqual(UserDefaults.standard.string(forKey: AppState.lastSelectedProjectIdKey), appState.projects.first?.id)
    }

    @MainActor
    func testBackendConfigViewInitialization() {
        let view = BackendConfigView()
        let host = UIHostingController(rootView: view)
        XCTAssertNotNil(host.view)
    }

    @MainActor
    func testSettingsViewInitialization() {
        let view = SettingsView().environmentObject(AppState.shared)
        let host = UIHostingController(rootView: view)
        XCTAssertNotNil(host.view)
    }

    @MainActor
    func testProjectDetailViewInitialization() {
        let project = PortalProject(
            id: "test-proj",
            organizationId: "org-1",
            name: "Test Project",
            projectKey: "fk_live_test",
            createdAt: Date(),
            githubRepo: "octocat/Hello-World",
            feedbackCount: 5,
            unresolvedCount: 2
        )
        let view = ProjectDetailView(project: project).environmentObject(AppState.shared)
        let host = UIHostingController(rootView: view)
        XCTAssertNotNil(host.view)
    }

    // MARK: - Closed loop (0014_closed_loop.sql)

    func testDecodesFixLoopFieldsAndToleratesOldRows() throws {
        let json = """
        [{"id":"a","project_id":"p","text":"x","created_at":"2026-09-25T10:00:00.123456+00:00","status":"in_progress",
          "fix_stage":"reopened","fix_pr_url":"https://github.com/o/r/pull/7","fix_pr_number":7,"fixed_in_build":"101",
          "fix_summary":"Inset fixed","reopen_count":2,"reporter_id":"abcdefabcdefabcdef"},
         {"id":"b","project_id":"p","text":"old row","created_at":"2026-09-25T10:00:00+00:00","status":"new"},
         {"id":"c","project_id":"p","text":"future stage","created_at":"2026-09-25T10:00:00+00:00","status":"new","fix_stage":"some_new_stage"}]
        """
        let items = try JSONDecoder().decode([PortalFeedbackItem].self, from: Data(json.utf8))
        XCTAssertEqual(items[0].fixStage.flatMap(PortalFixStage.init(rawValue:)), .reopened)
        XCTAssertEqual(items[0].fixPrNumber, 7)
        XCTAssertEqual(items[0].fixedInBuild, "101")
        XCTAssertEqual(items[0].reopenCount, 2)
        XCTAssertEqual(items[0].reporterId, "abcdefabcdefabcdef")
        XCTAssertNil(items[1].fixStage)
        XCTAssertEqual(items[1].reopenCount, 0)
        // An unknown stage decodes fine and just doesn't render a badge.
        XCTAssertNil(items[2].fixStage.flatMap(PortalFixStage.init(rawValue:)))
    }

    func testDecodesFeedbackEvents() throws {
        let json = """
        [{"id":"e1","feedback_id":"a","project_id":"p","kind":"reopened","actor_type":"reporter","actor_label":"Reporter",
          "actor_user_id":null,"body":"Still broken","data":{"screenshot_annotated_path":"p/a/reopen/1-annotated.png","build":"101"},
          "visible_to_reporter":true,"created_at":"2026-09-25T10:00:00+00:00"},
         {"id":"e2","feedback_id":"a","project_id":"p","kind":"pr_opened","actor_type":"github","actor_label":"GitHub",
          "body":"PR #7 opened","data":{"pr_url":"https://github.com/o/r/pull/7","pr_number":7},"visible_to_reporter":false,
          "created_at":"2026-09-25T10:01:00+00:00"}]
        """
        let events = try JSONDecoder().decode([PortalFeedbackEvent].self, from: Data(json.utf8))
        XCTAssertEqual(events[0].title, "Reporter says it's still broken")
        XCTAssertEqual(events[0].screenshotPath, "p/a/reopen/1-annotated.png")
        XCTAssertTrue(events[0].visibleToReporter)
        XCTAssertEqual(events[1].prUrl, "https://github.com/o/r/pull/7")
        XCTAssertNil(events[1].screenshotPath)
    }

    func testFixLoopSectionRenders() {
        let item = PortalFeedbackItem(
            id: "a",
            projectId: "p",
            text: "x",
            environment: DemoData.sampleFeedbackItems[0].environment,
            fixStage: "shipped",
            fixedInBuild: "12",
            reporterId: "abcdefabcdefabcdef"
        )
        let host = UIHostingController(rootView: FixLoopSectionView(item: item))
        XCTAssertNotNil(host.view)
    }

    // MARK: - Teams & notifications (0016_teams.sql, 0017_notifications.sql)

    func testDecodesTeamRowsFromTheServer() throws {
        let members = try JSONDecoder().decode([PortalMember].self, from: Data("""
        [{"user_id":"u1","role":"owner","joined_at":"2026-09-26T10:00:00.123+00:00","email":"a@x.dev",
          "full_name":null,"user_name":"alice","avatar_url":null},
         {"user_id":"u2","role":"billing_admin","joined_at":"2026-09-26T10:00:00+00:00","email":null,
          "full_name":"Bob","user_name":null,"avatar_url":null}]
        """.utf8))
        XCTAssertEqual(members[0].displayName, "alice")
        XCTAssertEqual(members[0].role, .owner)
        // A role the app doesn't know yet decodes as the least-privileged one.
        XCTAssertEqual(members[1].role, .member)
        XCTAssertEqual(members[1].displayName, "Bob")

        let rows = try JSONDecoder().decode([PortalMembershipRow].self, from: Data("""
        [{"role":"member","organizations":{"id":"o1","name":"Acme"}},{"role":"owner","organizations":null}]
        """.utf8))
        XCTAssertEqual(rows.compactMap { $0.organizations?.name }, ["Acme"])

        let invite = try JSONDecoder().decode(PortalInvitation.self, from: Data("""
        {"id":"i1","organization_id":"o1","email":null,"role":"member","token":"fki_abc","created_by":"u1",
         "created_at":"2026-09-26T10:00:00+00:00","expires_at":"2026-10-03T10:00:00+00:00",
         "accepted_at":null,"accepted_by":null,"revoked_at":null}
        """.utf8))
        XCTAssertEqual(invite.url.absoluteString, "https://feedback-kit.hejitech.workers.dev/invite/fki_abc")
    }

    func testDecodesNotificationsAndToleratesNewKinds() throws {
        let list = try JSONDecoder().decode([PortalNotification].self, from: Data("""
        [{"id":"n1","user_id":"u","organization_id":"o","project_id":"p","feedback_id":"f","kind":"reopened",
          "title":"Reporter says it's still broken · Acme","body":"Pay button","data":{},
          "created_at":"2026-09-26T10:00:00+00:00","read_at":null},
         {"id":"n2","user_id":"u","organization_id":"o","project_id":null,"feedback_id":null,"kind":"something_new",
          "title":"Hello","body":null,"data":{},"created_at":"2026-09-26T09:00:00+00:00","read_at":"2026-09-26T09:30:00+00:00"}]
        """.utf8))
        XCTAssertFalse(list[0].isRead)
        XCTAssertEqual(list[0].iconName, "arrow.uturn.backward.circle.fill")
        XCTAssertTrue(list[1].isRead)
        XCTAssertEqual(list[1].iconName, "bell.fill")
    }

    func testAPIErrorCarriesTheServerMessage() {
        let error = PortalAPIError.from(
            data: Data(#"{"code":"22023","message":"an organization needs at least one owner"}"#.utf8),
            status: 400
        )
        XCTAssertEqual(error.localizedDescription, "an organization needs at least one owner")
    }

    @MainActor
    func testDemoTeamKeepsAnOwner() async throws {
        let client = SupabasePortalClient.shared
        client.enableDemoMode()
        let members = try await client.fetchMembers(organizationId: "org-1")
        let owner = try XCTUnwrap(members.first { $0.role == .owner })

        do {
            try await client.updateMemberRole(organizationId: "org-1", userId: owner.userId, role: .member)
            XCTFail("demoting the only owner should fail")
        } catch {
            XCTAssertTrue(error.localizedDescription.contains("at least one owner"))
        }

        let other = try XCTUnwrap(members.first { $0.role == .member })
        try await client.updateMemberRole(organizationId: "org-1", userId: other.userId, role: .owner)
        try await client.updateMemberRole(organizationId: "org-1", userId: owner.userId, role: .member)
        let after = try await client.fetchMembers(organizationId: "org-1")
        XCTAssertEqual(after.first { $0.userId == owner.userId }?.role, .member)

        let invite = try await client.createInvitation(organizationId: "org-1", email: "  ", role: .member)
        XCTAssertNil(invite.email, "a blank email means anyone with the link")
        try await client.revokeInvitation(id: invite.id)
        let pending = try await client.fetchInvitations(organizationId: "org-1")
        XCTAssertFalse(pending.contains { $0.id == invite.id })
        client.enableDemoMode()
    }

    @MainActor
    func testAppStateScopesProjectsToTheCurrentOrganization() async {
        let appState = AppState.shared
        SupabasePortalClient.shared.enableDemoMode()
        appState.resetForSignOut()
        await appState.loadProjects()

        XCTAssertEqual(appState.currentOrganization?.id, "org-1")
        XCTAssertFalse(appState.projects.isEmpty)
        XCTAssertTrue(appState.projects.allSatisfy { $0.organizationId == "org-1" })

        // The demo's second organization has no projects.
        let other = try? XCTUnwrap(appState.organizations.first { $0.id == "org-2" })
        if let other { await appState.switchOrganization(to: other) }
        XCTAssertEqual(appState.currentOrganization?.id, "org-2")
        XCTAssertTrue(appState.projects.isEmpty)
        XCTAssertNil(appState.selectedProject)

        if let first = appState.organizations.first { await appState.switchOrganization(to: first) }
        XCTAssertFalse(appState.projects.isEmpty)
    }

    @MainActor
    func testAppStateNotificationsReadState() async {
        let appState = AppState.shared
        SupabasePortalClient.shared.enableDemoMode()
        await appState.loadNotifications()
        XCTAssertEqual(appState.unreadNotificationCount, 2)

        let first = appState.notifications[0]
        await appState.markNotificationRead(first)
        XCTAssertEqual(appState.unreadNotificationCount, 1)
        XCTAssertTrue(appState.notifications[0].isRead)

        await appState.markAllNotificationsRead()
        XCTAssertEqual(appState.unreadNotificationCount, 0)
        await appState.loadNotifications()
        XCTAssertEqual(appState.unreadNotificationCount, 0, "read state reaches the (demo) server")
    }

    @MainActor
    func testTeamAndActivityViewsRender() {
        SupabasePortalClient.shared.enableDemoMode()
        let team = UIHostingController(rootView: NavigationStack { TeamView() }.environmentObject(AppState.shared))
        XCTAssertNotNil(team.view)
        let activity = UIHostingController(rootView: NotificationsListView().environmentObject(AppState.shared))
        XCTAssertNotNil(activity.view)
    }
}
