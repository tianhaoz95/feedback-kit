import SwiftUI
import FeedbackKit

/// The Mac Portal's main window: a sidebar of sections, each hosting the same
/// view the iOS Portal shows in a tab. Settings live in the standard Settings
/// window (⌘,) instead of a sidebar section.
struct MacRootView: View {
    enum Section: String, Hashable, CaseIterable, Identifiable {
        case feedback, projects, cliAccess

        var id: String { rawValue }

        var title: String {
            switch self {
            case .feedback: return "Feedback"
            case .projects: return "Projects"
            case .cliAccess: return "CLI Access"
            }
        }

        var systemImage: String {
            switch self {
            case .feedback: return "tray.full"
            case .projects: return "folder"
            case .cliAccess: return "terminal"
            }
        }

        /// `FeedbackKit.currentScreen` for reports filed from this section.
        var screenName: String {
            switch self {
            case .feedback: return "Feedback Inbox"
            case .projects: return "Projects"
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
                        .badge(section == .feedback && unresolvedCount > 0 ? unresolvedCount : 0)
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
            case .projects:
                ProjectsListView()
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
        }
    }
}
