import AppKit
import FeedbackKit
import SwiftUI

@main
struct FeedbackKitDemoMacApp: App {
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
        // being sent anywhere (see MacHomeView / MacCartView).
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
    }

    private func installTriggers() {
        // There's no enableShakeToReport on macOS (no motion sensor, no real
        // equivalent gesture) — the floating button is the recommended
        // default trigger here instead, same as the docs recommend.
        FeedbackKit.showFloatingTriggerButton {
            NSApplication.shared.keyWindow
        }
    }

    private func reportProblem() {
        FeedbackKit.present(from: NSApplication.shared.keyWindow) { report in
            guard let report else { return }
            print("[FeedbackKit demo] captured report \(report.id) — \"\(report.text)\"")
        }
    }
}
