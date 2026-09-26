import SwiftUI
import FeedbackKit

@main
struct FeedbackPortalApp: App {
    @UIApplicationDelegateAdaptor(PortalAppDelegate.self) private var appDelegate
    @StateObject private var client = SupabasePortalClient.shared
    @StateObject private var appState = AppState.shared

    init() {
        // Reports about the Portal itself go to the FeedbackKit team's own project.
        PortalDogfood.configure()

        UserDefaults.standard.register(defaults: [
            "shake_to_feedback_enabled": true
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
            .onChange(of: client.currentSession?.userId, initial: true) {
                PortalDogfood.updateUser(client.currentSession)
            }
            .onOpenURL { url in
                handleIncomingURL(url)
            }
        }
    }

    private func installTriggers() {
        FeedbackKit.hideFloatingTriggerButton()

        if UserDefaults.standard.bool(forKey: "shake_to_feedback_enabled") {
            FeedbackKit.enableShakeToReport {
                UIApplication.shared.topMostViewController
            }
        } else {
            FeedbackKit.disableShakeToReport()
        }

        // Ask "is it fixed?" when a fix for something reported from this
        // device ships in the Portal build it's running.
        FeedbackKit.enableFixVerification {
            UIApplication.shared.topMostViewController
        }
    }

    private func handleIncomingURL(_ url: URL) {
        PortalDeepLinks.handle(url, client: client)
    }
}
