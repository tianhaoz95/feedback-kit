#if os(watchOS)
import SwiftUI

extension View {
    /// Asks the reporter "is it fixed?" when a fix for something they
    /// reported ships in the build they're running — watchOS's counterpart to
    /// `FeedbackKit.enableFixVerification(presenter:)` on iOS/macOS, as a
    /// modifier since watch apps have no window to present over. Attach it
    /// once, near the root:
    ///
    /// ```swift
    /// ContentView().feedbackFixVerification()
    /// ```
    ///
    /// "Still broken" asks for a short description in the card itself
    /// (there's no screenshot flow on watchOS).
    public func feedbackFixVerification() -> some View {
        modifier(FixVerificationModifier())
    }
}

private struct FixVerificationModifier: ViewModifier {
    @Environment(\.scenePhase) private var scenePhase
    @State private var update: FixUpdate?
    @State private var state = FixVerificationState()

    func body(content: Content) -> some View {
        content
            .onAppear { check() }
            .onChange(of: scenePhase) { phase in
                if phase == .active { check() }
            }
            .sheet(item: $update) { update in
                FixVerificationView(update: update, collectsStillBrokenInline: true) { outcome in
                    handle(outcome, for: update)
                }
            }
    }

    private func check(force: Bool = false) {
        guard update == nil else { return }
        state.fetchNext(force: force) { next in update = next }
    }

    private func handle(_ outcome: FixVerificationView.Outcome, for current: FixUpdate) {
        state.markHandled(current)
        update = nil
        switch outcome {
        case .verified:
            state.send(.verify, for: current)
        case .replied(let text):
            state.send(.reply(text), for: current)
        case .stillBroken(let text):
            state.send(.reopen(FeedbackReport(
                text: text ?? "",
                screenshotRawPNG: nil,
                screenshotAnnotatedPNG: nil,
                annotations: [],
                environment: EnvironmentInfo.current(screenName: FeedbackKit.currentScreen)
            )), for: current)
        case .later:
            break
        }
    }
}
#endif
