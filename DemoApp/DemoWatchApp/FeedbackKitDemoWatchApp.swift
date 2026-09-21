import FeedbackKit
import SwiftUI

@main
struct FeedbackKitDemoWatchApp: App {
    init() {
        // Point this at your own FeedbackKit dashboard deployment (see /web
        // and /supabase) to test the hosted-submission path end to end:
        //
        // FeedbackKit.configure(.init(
        //     endpointURL: URL(string: "https://YOUR_PROJECT.supabase.co/functions/v1/ingest-feedback")!,
        //     projectKey: "pk_live_..."
        // ))
        //
        // Left unconfigured, submitting in ContentView just prints the
        // resulting report instead of sending it anywhere.

        // Showcases FeedbackKit.theme: FeedbackQuickNoteView reads this
        // directly (see its doc comment) and tints itself with the
        // primary color instead of the system accent default.
        FeedbackKit.theme = .init(primaryColorHex: "#7C3AED", secondaryColorHex: "#F97316")
    }

    var body: some Scene {
        WindowGroup {
            ContentView()
        }
    }
}
