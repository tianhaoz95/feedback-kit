import FeedbackKit
import SwiftUI

/// The watchOS demo has no product catalog to mirror iOS/macOS's Home/Cart
/// — there's nothing to screenshot or annotate on this platform (see
/// `FeedbackQuickNoteView`'s doc comment), so the whole demo is just this
/// one screen exercising the stripped-down text-only flow.
struct ContentView: View {
    @State private var showingFeedback = false
    @State private var lastReportText: String?

    var body: some View {
        NavigationView {
            VStack(spacing: 12) {
                Text("FeedbackKit Demo")
                    .font(.headline)
                Text("watchOS gets a stripped-down flow: text + device/app context, no screenshot or annotation tools.")
                    .font(.footnote)
                    .multilineTextAlignment(.center)
                    .foregroundStyle(.secondary)

                Button("Report a Problem") { showingFeedback = true }

                if let lastReportText {
                    Text("Last report: \u{201C}\(lastReportText)\u{201D}")
                        .font(.caption2)
                        .foregroundStyle(.tertiary)
                        .multilineTextAlignment(.center)
                }
            }
            .padding()
        }
        .onAppear { FeedbackKit.currentScreen = "Home" }
        .sheet(isPresented: $showingFeedback) {
            FeedbackQuickNoteView { report in
                guard let report else { return }
                print("[FeedbackKit demo] captured report \(report.id) — \"\(report.text)\"")
                lastReportText = report.text
            }
        }
    }
}
