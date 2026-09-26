import SwiftUI

public struct MainTabView: View {
    @EnvironmentObject private var appState: AppState
    @Environment(\.scenePhase) private var scenePhase

    private var unresolvedCount: Int {
        appState.feedbackItems.filter { !$0.isArchived && ($0.status == .new || $0.status == .inProgress) }.count
    }

    public var body: some View {
        TabView(selection: $appState.selectedTab) {
            FeedbackInboxView()
                .tabItem {
                    Label("Feedback", systemImage: "tray.full.fill")
                }
                .badge(unresolvedCount > 0 ? "\(unresolvedCount)" : nil)
                .tag(AppState.Tab.feedback)

            NotificationsListView()
                .tabItem {
                    Label("Activity", systemImage: "bell.fill")
                }
                .badge(appState.unreadNotificationCount > 0 ? "\(appState.unreadNotificationCount)" : nil)
                .tag(AppState.Tab.activity)

            ProjectsListView()
                .tabItem {
                    Label("Projects", systemImage: "folder.fill")
                }
                .tag(AppState.Tab.projects)

            SettingsView()
                .tabItem {
                    Label("Settings", systemImage: "gearshape.fill")
                }
                .tag(AppState.Tab.settings)
        }
        .task {
            await appState.loadProjects()
            await appState.loadNotifications()
            #if os(iOS)
            await PortalPushNotifications.shared.registerIfAuthorized()
            #endif
        }
        .task {
            // Push covers the app while it's closed; while it's open, a light
            // poll keeps the Activity badge current.
            while !Task.isCancelled {
                try? await Task.sleep(for: .seconds(60))
                if scenePhase == .active {
                    await appState.refreshUnreadNotificationCount()
                }
            }
        }
        .onChange(of: scenePhase) {
            if scenePhase == .active {
                Task { await appState.refreshUnreadNotificationCount() }
            }
        }
    }
}
