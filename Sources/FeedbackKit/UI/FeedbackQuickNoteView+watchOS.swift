#if os(watchOS)
import SwiftUI

/// A minimal, text-only feedback flow for watchOS — no screenshot capture,
/// no annotation tools. The screen is too small for freehand/rectangle/arrow
/// drawing to be a usable interaction in the first place, and there's no
/// window-level API to capture a screenshot from even if it were (see
/// `ScreenshotCapture`'s watchOS branch). What a watchOS report actually
/// carries is the user's text description plus `FeedbackEnvironment` (device,
/// watchOS version, app version, locale) — the same context every other
/// platform's report includes.
///
/// Unlike `FeedbackKit.present(from:)` on iOS/macOS, there's no
/// `UIWindow`/`NSWindow` for FeedbackKit to present modally over — watch apps
/// are SwiftUI-only. So this is a plain SwiftUI view you embed in your own
/// presentation, matching how watchOS apps are actually built:
///
/// ```swift
/// .sheet(isPresented: $showingFeedback) {
///     FeedbackQuickNoteView { report in
///         guard let report else { return }
///         FeedbackSubmitter.submit(report, configuration: myConfiguration) { _ in }
///     }
/// }
/// ```
public struct FeedbackQuickNoteView: View {
    private let onComplete: (FeedbackReport?) -> Void

    @State private var text = ""
    @Environment(\.dismiss) private var dismiss

    public init(onComplete: @escaping (FeedbackReport?) -> Void) {
        self.onComplete = onComplete
    }

    public var body: some View {
        NavigationView {
            ScrollView {
                VStack(alignment: .leading, spacing: 8) {
                    Text("What's the problem?")
                        .font(.headline)
                    TextField("Describe the issue", text: $text)
                        .textFieldStyle(.plain)
                }
                .padding()
            }
            .navigationTitle("Report Feedback")
            .toolbar {
                ToolbarItem(placement: .cancellationAction) {
                    Button("Cancel") {
                        onComplete(nil)
                        dismiss()
                    }
                }
                ToolbarItem(placement: .confirmationAction) {
                    Button("Send") {
                        submit()
                    }
                    .disabled(text.trimmingCharacters(in: .whitespacesAndNewlines).isEmpty)
                }
            }
        }
        // `FeedbackKit.theme` is read directly here (same as
        // `FeedbackKit.currentScreen` in `submit()` below) since this view
        // has no `present(from:)` call site to thread it through — the
        // developer embeds it themselves. `nil` (unset theme, or an
        // unparseable hex string) falls back to `.tint(nil)`, i.e. the
        // system accent color, unchanged from before theming existed.
        .tint(themeColor)
    }

    private var themeColor: Color? {
        FeedbackKit.theme
            .flatMap { UIColor(hex: $0.primaryColorHex) }
            .map { Color(uiColor: $0) }
    }

    private func submit() {
        guard
            let placeholderImage = ScreenshotCapture.captureKeyWindow(),
            let pngData = placeholderImage.pngData()
        else {
            onComplete(nil)
            dismiss()
            return
        }

        let report = FeedbackReport(
            text: text,
            screenshotRawPNG: pngData,
            screenshotAnnotatedPNG: pngData,
            annotations: [],
            environment: EnvironmentInfo.current(screenName: FeedbackKit.currentScreen)
        )
        onComplete(report)
        dismiss()
    }
}
#endif
