import SwiftUI
import FeedbackKit

/// The Mac Portal's main window: a sidebar of sections, each hosting the same
/// view the iOS Portal shows in a tab. Settings live in the standard Settings
/// window (⌘,) instead of a sidebar section.
struct MacRootView: View {
    enum Section: String, Hashable, CaseIterable, Identifiable {
        case feedback, activity, projects, team, cliAccess

        var id: String { rawValue }

        var title: String {
            switch self {
            case .feedback: return "Feedback"
            case .activity: return "Activity"
            case .projects: return "Projects"
            case .team: return "Team"
            case .cliAccess: return "CLI Access"
            }
        }

        var systemImage: String {
            switch self {
            case .feedback: return "tray.full"
            case .activity: return "bell"
            case .projects: return "folder"
            case .team: return "person.2"
            case .cliAccess: return "terminal"
            }
        }

        /// `FeedbackKit.currentScreen` for reports filed from this section.
        var screenName: String {
            switch self {
            case .feedback: return "Feedback Inbox"
            case .activity: return "Activity"
            case .projects: return "Projects"
            case .team: return "Team"
            case .cliAccess: return "CLI Access"
            }
        }
    }

    @EnvironmentObject private var appState: AppState
    @SceneStorage("portal.sidebarSection") private var storedSection: Section = .feedback

    private var unresolvedCount: Int {
        appState.feedbackItems.filter { !$0.isArchived && ($0.status == .new || $0.status == .inProgress) }.count
    }

    var body: some View {
        NavigationSplitView {
            List(selection: Binding<Section?>(
                get: { storedSection },
                set: { if let new = $0 { storedSection = new } }
            )) {
                ForEach(Section.allCases) { section in
                    Label(section.title, systemImage: section.systemImage)
                        .badge(badge(for: section))
                        .tag(section)
                }
            }
            .navigationSplitViewColumnWidth(min: 180, ideal: 210, max: 280)
            .safeAreaInset(edge: .bottom) {
                Button {
                    PortalDogfood.reportProblem()
                } label: {
                    Label("Report a Problem…", systemImage: "exclamationmark.bubble")
                        .frame(maxWidth: .infinity, alignment: .leading)
                }
                .buttonStyle(.borderless)
                .help("Report a problem with the Portal itself (⇧⌘R)")
                .padding(12)
            }
        } detail: {
            switch storedSection {
            case .feedback:
                FeedbackInboxView()
            case .activity:
                NotificationsListView()
            case .projects:
                ProjectsListView()
            case .team:
                NavigationStack {
                    TeamView()
                }
            case .cliAccess:
                NavigationStack {
                    CliSessionsListView()
                }
            }
        }
        .onChange(of: storedSection, initial: true) {
            FeedbackKit.currentScreen = storedSection.screenName
        }
        .task {
            await appState.loadProjects()
            await appState.loadNotifications()
        }
        .task {
            // No push on the Mac: poll so the Activity and Dock badges stay current.
            while !Task.isCancelled {
                try? await Task.sleep(for: .seconds(60))
                await appState.refreshUnreadNotificationCount()
            }
        }
    }

    private func badge(for section: Section) -> Int {
        switch section {
        case .feedback: return unresolvedCount
        case .activity: return appState.unreadNotificationCount
        default: return 0
        }
    }
}
