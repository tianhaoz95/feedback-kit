import SwiftUI

public struct MainTabView: View {
    @EnvironmentObject private var appState: AppState

    private var unresolvedCount: Int {
        appState.feedbackItems.filter { !$0.isArchived && ($0.status == .new || $0.status == .inProgress) }.count
    }

    public var body: some View {
        TabView {
            FeedbackInboxView()
                .tabItem {
                    Label("Feedback", systemImage: "tray.full.fill")
                }
                .badge(unresolvedCount > 0 ? "\(unresolvedCount)" : nil)

            ProjectsListView()
                .tabItem {
                    Label("Projects", systemImage: "folder.fill")
                }

            SettingsView()
                .tabItem {
                    Label("Settings", systemImage: "gearshape.fill")
                }
        }
        .task {
            await appState.loadProjects()
        }
    }
}
