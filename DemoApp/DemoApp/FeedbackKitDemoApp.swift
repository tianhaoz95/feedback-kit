import FeedbackKit
import SwiftUI

@main
struct FeedbackKitDemoApp: App {
    init() {
        // Restores whichever API key and endpoint were saved in Settings,
        // configuring FeedbackKit if a key is present:
        DemoSettings.shared.applyConfiguration()

        // Showcases FeedbackKit.onSubmissionResult: alerts the user when a report
        // has been delivered to their dashboard or if an error occurred.
        FeedbackKit.onSubmissionResult = { result in
            switch result {
            case .success(let report):
                DemoNotifier.notify(
                    title: "Feedback Submitted",
                    message: "Your feedback was sent to your web dashboard project (ID: \(report.id.uuidString.prefix(8)))."
                )
            case .failure(let error):
                DemoNotifier.notify(
                    title: "Submission Failed",
                    message: "\(error.localizedDescription)\n\nPlease verify your API key in Settings."
                )
            }
        }

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
