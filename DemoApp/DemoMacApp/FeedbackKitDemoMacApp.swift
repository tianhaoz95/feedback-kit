import AppKit
import FeedbackKit
import SwiftUI

@main
struct FeedbackKitDemoMacApp: App {
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

        // Showcases FeedbackKit.theme: restores whichever brand was last picked
        // in Settings (default: .sunset) so the feedback screen stays themed.
        FeedbackKit.theme = DemoBranding.current.theme
    }

    var body: some Scene {
        WindowGroup {
            MacContentView()
                .onAppear(perform: installTriggers)
        }
        .commands {
            // The macOS-native equivalent of the iOS demo's "Report a
            // Problem" buttons — a menu item plus a keyboard shortcut,
            // exactly the "menu item action" trigger the SDK's own docs
            // show (see the `macOSBasicUsage` snippet on /docs/ios-sdk).
            CommandGroup(after: .help) {
                Button("Report a Problem…") { reportProblem() }
                    .keyboardShortcut("r", modifiers: [.command, .shift])
            }
        }

        Settings {
            MacSettingsView()
        }
    }

    private func installTriggers() {
        // There's no enableShakeToReport on macOS (no motion sensor, no real
        // equivalent gesture) — the floating button is the recommended
        // default trigger here instead, same as the docs recommend.
        FeedbackKit.showFloatingTriggerButton {
            NSApplication.shared.keyWindow
        }
        // Asks "is it fixed?" once a fix for something reported from this
        // Mac ships in the build it's running (`feedbackkit release`).
        FeedbackKit.enableFixVerification {
            NSApplication.shared.keyWindow
        }
    }

    private func reportProblem() {
        FeedbackKit.presentAndSubmitIfConfigured(from: NSApplication.shared.keyWindow) { result in
            guard let result else { return }
            switch result {
            case .success(let report):
                print("[FeedbackKit demo] captured report \(report.id) — \"\(report.text)\"")
            case .failure(let error):
                print("[FeedbackKit demo] report failed: \(error)")
            }
        }
    }
}
