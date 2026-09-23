import SwiftUI
import FeedbackKit

@main
struct FeedbackPortalApp: App {
    @StateObject private var client = SupabasePortalClient.shared
    @StateObject private var appState = AppState.shared

    init() {
        FeedbackKit.configure(.init(
            endpointURL: URL(string: "https://gpucoladcyvijefdjudf.supabase.co/functions/v1/ingest-feedback")!,
            projectKey: "pk_cde764e9b97ba261cdd084e7e3e4cf04ce31"
        ))

        UserDefaults.standard.register(defaults: [
            "show_floating_trigger": true
        ])
    }

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
            .onAppear(perform: installTriggers)
            .onOpenURL { url in
                handleIncomingURL(url)
            }
        }
    }

    private func installTriggers() {
        FeedbackKit.enableShakeToReport {
            UIApplication.shared.topMostViewController
        }

        if UserDefaults.standard.bool(forKey: "show_floating_trigger") {
            FeedbackKit.showFloatingTriggerButton {
                UIApplication.shared.topMostViewController
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
