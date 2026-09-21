import FeedbackKit
import SwiftUI

@main
struct FeedbackKitDemoApp: App {
    init() {
        // Point this at your own FeedbackKit dashboard deployment (see /web and
        // /supabase) to test the hosted-submission path end to end:
        //
        // FeedbackKit.configure(.init(
        //     endpointURL: URL(string: "https://YOUR_PROJECT.supabase.co/functions/v1/ingest-feedback")!,
        //     projectKey: "pk_live_..."
        // ))
        //
        // Left unconfigured, `FeedbackKit.present` still works fully — reports
        // are just handed back to this app's completion handler instead of
        // being sent anywhere (see HomeView / CartViewController).

        // Showcases FeedbackKit.theme: brand this demo's feedback screen
        // with its own accent colors instead of the system blue default —
        // the send button, the selected annotation tool, and the
        // screenshot toggle all pick up the primary color; Cancel and the
        // attach button pick up the secondary one.
        FeedbackKit.theme = .init(primaryColorHex: "#7C3AED", secondaryColorHex: "#F97316")
    }

    var body: some Scene {
        WindowGroup {
            RootTabView()
                .onAppear(perform: installTriggers)
        }
    }

    private func installTriggers() {
        FeedbackKit.showFloatingTriggerButton {
            UIApplication.shared.topMostViewController
        }
        FeedbackKit.enableShakeToReport {
            UIApplication.shared.topMostViewController
        }
    }
}
