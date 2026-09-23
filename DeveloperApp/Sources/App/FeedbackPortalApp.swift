import SwiftUI

@main
struct FeedbackPortalApp: App {
    @StateObject private var client = SupabasePortalClient.shared
    @StateObject private var appState = AppState.shared

    var body: some Scene {
        WindowGroup {
            Group {
                if client.currentSession != nil || client.isDemoMode {
                    MainTabView()
                        .environmentObject(appState)
                } else {
                    LoginView()
                        .environmentObject(appState)
                }
            }
            .tint(.blue)
            .onOpenURL { url in
                handleIncomingURL(url)
            }
        }
    }

    private func handleIncomingURL(_ url: URL) {
        // Handle feedbackkit:// deep links e.g. feedbackkit://auth-callback
        if url.scheme == "feedbackkit" && url.host == "auth-callback" {
            var token: String?
            var refresh: String?

            if let fragment = url.fragment {
                let params = fragment.components(separatedBy: "&").reduce(into: [String: String]()) { dict, pair in
                    let parts = pair.components(separatedBy: "=")
                    if parts.count == 2 {
                        dict[parts[0]] = parts[1]
                    }
                }
                token = params["access_token"]
                refresh = params["refresh_token"]
            }

            if let token = token {
                let userSession = PortalUserSession(
                    accessToken: token,
                    refreshToken: refresh ?? "",
                    userId: UUID().uuidString,
                    email: "developer@feedbackkit.dev"
                )
                client.signIn(session: userSession)
                UINotificationFeedbackGenerator().notificationOccurred(.success)
            }
        }
    }
}
