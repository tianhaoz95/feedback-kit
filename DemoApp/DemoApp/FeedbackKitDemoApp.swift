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

        // Showcases FeedbackKit.theme: restores whichever brand was last
        // picked in Settings > Branding (default: .sunset, this demo's own
        // brand), so the feedback screen stays themed across launches.
        // Settings itself re-applies FeedbackKit.theme immediately when the
        // picker's selection changes — this line only covers app startup.
        FeedbackKit.theme = DemoBranding.current.theme
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
