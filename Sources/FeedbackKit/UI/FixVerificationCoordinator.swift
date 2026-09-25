#if os(iOS)
import SwiftUI
import UIKit

/// Drives `FeedbackKit.enableFixVerification(presenter:)` on iOS: checks for
/// fix updates when the app becomes active and presents `FixVerificationView`
/// as a sheet. "Still broken" runs the normal capture → annotate flow (with
/// a "What's still wrong?" prompt) and sends the result as a reopen, so the
/// agent gets a fresh screenshot of exactly what's still wrong.
final class FixVerificationCoordinator: NSObject, UIAdaptivePresentationControllerDelegate {
    static let shared = FixVerificationCoordinator()

    private var presenter: (() -> UIViewController?)?
    private var activeObserver: NSObjectProtocol?
    private let state = FixVerificationState()
    private weak var hostedSheet: UIViewController?

    func enable(presenter: @escaping () -> UIViewController?) {
        self.presenter = presenter
        if activeObserver == nil {
            activeObserver = NotificationCenter.default.addObserver(
                forName: UIApplication.didBecomeActiveNotification,
                object: nil,
                queue: .main
            ) { [weak self] _ in self?.check() }
        }
        // Give the host app's first screen a moment to settle before a sheet appears.
        DispatchQueue.main.asyncAfter(deadline: .now() + 1.5) { [weak self] in self?.check() }
    }

    func disable() {
        if let activeObserver { NotificationCenter.default.removeObserver(activeObserver) }
        activeObserver = nil
        presenter = nil
    }

    func check(force: Bool = false) {
        guard presenter != nil, hostedSheet == nil else { return }
        state.fetchNext(force: force) { [weak self] update in
            guard let self, let update else { return }
            self.show(update)
        }
    }

    private func show(_ update: FixUpdate) {
        guard hostedSheet == nil, let base = presenter?(), !(base is FeedbackViewController) else { return }
        let host = UIHostingController(rootView: AnyView(EmptyView()))
        host.rootView = AnyView(FixVerificationView(update: update) { [weak self, weak host] outcome in
            guard let self, let host else { return }
            self.handle(outcome, for: update, host: host)
        })
        if let sheet = host.sheetPresentationController {
            sheet.detents = [.medium(), .large()]
            sheet.prefersGrabberVisible = true
        }
        host.presentationController?.delegate = self
        hostedSheet = host
        topMost(from: base).present(host, animated: true)
    }

    private func handle(_ outcome: FixVerificationView.Outcome, for update: FixUpdate, host: UIViewController) {
        state.markHandled(update)
        switch outcome {
        case .verified:
            state.send(.verify, for: update)
            dismiss(host) { [weak self] in self?.check(force: true) }
        case .replied(let text):
            state.send(.reply(text), for: update)
            dismiss(host) { [weak self] in self?.check(force: true) }
        case .later:
            dismiss(host, then: nil)
        case .stillBroken(let inlineText):
            dismiss(host) { [weak self] in
                guard let self else { return }
                if let inlineText {
                    self.state.send(.reopen(Self.textOnlyReport(inlineText)), for: update)
                    return
                }
                guard let base = self.presenter?() else { return }
                FeedbackKit.presentFlow(from: base, composerPlaceholder: "What's still wrong?") { report in
                    // Cancelling the capture flow still counts as "still broken" — the reporter said so.
                    self.state.send(.reopen(report), for: update)
                }
            }
        }
    }

    private func dismiss(_ host: UIViewController, then completion: (() -> Void)?) {
        host.dismiss(animated: true) { [weak self] in
            self?.hostedSheet = nil
            completion?()
        }
    }

    /// Swiped the sheet away — treat as "later" for this launch.
    func presentationControllerDidDismiss(_ presentationController: UIPresentationController) {
        hostedSheet = nil
    }

    private func topMost(from viewController: UIViewController) -> UIViewController {
        var top = viewController
        while let presented = top.presentedViewController, !presented.isBeingDismissed {
            top = presented
        }
        return top
    }

    static func textOnlyReport(_ text: String) -> FeedbackReport {
        FeedbackReport(
            text: text,
            screenshotRawPNG: nil,
            screenshotAnnotatedPNG: nil,
            annotations: [],
            environment: EnvironmentInfo.current(screenName: FeedbackKit.currentScreen)
        )
    }
}

#elseif os(macOS)
import AppKit
import SwiftUI

/// macOS counterpart: the card is a sheet on the presenter's window (or a
/// standalone window if there's none), and "Still broken" runs the capture
/// flow as a sheet. Checks when the app becomes active.
final class FixVerificationCoordinator: NSObject {
    static let shared = FixVerificationCoordinator()

    private var presenter: (() -> NSWindow?)?
    private var activeObserver: NSObjectProtocol?
    private let state = FixVerificationState()
    private var cardWindow: NSWindow?

    func enable(presenter: @escaping () -> NSWindow?) {
        self.presenter = presenter
        if activeObserver == nil {
            activeObserver = NotificationCenter.default.addObserver(
                forName: NSApplication.didBecomeActiveNotification,
                object: nil,
                queue: .main
            ) { [weak self] _ in self?.check() }
        }
        DispatchQueue.main.asyncAfter(deadline: .now() + 1.5) { [weak self] in self?.check() }
    }

    func disable() {
        if let activeObserver { NotificationCenter.default.removeObserver(activeObserver) }
        activeObserver = nil
        presenter = nil
    }

    func check(force: Bool = false) {
        guard presenter != nil, cardWindow == nil else { return }
        state.fetchNext(force: force) { [weak self] update in
            guard let self, let update else { return }
            self.show(update)
        }
    }

    private func show(_ update: FixUpdate) {
        guard cardWindow == nil else { return }
        let host = NSHostingController(rootView: AnyView(EmptyView()))
        let window = NSWindow(contentViewController: host)
        window.title = "Feedback"
        window.styleMask = [.titled, .closable]
        window.setContentSize(NSSize(width: 440, height: 560))
        host.rootView = AnyView(FixVerificationView(update: update) { [weak self] outcome in
            self?.handle(outcome, for: update)
        })
        cardWindow = window
        if let parent = presenter?() {
            parent.beginSheet(window)
        } else {
            window.center()
            window.makeKeyAndOrderFront(nil)
        }
    }

    private func closeCard() {
        guard let window = cardWindow else { return }
        if let parent = window.sheetParent {
            parent.endSheet(window)
        } else {
            window.close()
        }
        cardWindow = nil
    }

    private func handle(_ outcome: FixVerificationView.Outcome, for update: FixUpdate) {
        state.markHandled(update)
        closeCard()
        switch outcome {
        case .verified:
            state.send(.verify, for: update)
            check(force: true)
        case .replied(let text):
            state.send(.reply(text), for: update)
            check(force: true)
        case .later:
            break
        case .stillBroken(let inlineText):
            if let inlineText {
                state.send(.reopen(FeedbackReport(
                    text: inlineText,
                    screenshotRawPNG: nil,
                    screenshotAnnotatedPNG: nil,
                    annotations: [],
                    environment: EnvironmentInfo.current(screenName: FeedbackKit.currentScreen)
                )), for: update)
                return
            }
            // Let the card's sheet finish closing before the capture flow
            // screenshots the window, so the card isn't in the shot.
            DispatchQueue.main.asyncAfter(deadline: .now() + 0.35) { [weak self] in
                guard let self else { return }
                FeedbackKit.presentFlow(from: self.presenter?(), composerPlaceholder: "What's still wrong?") { report in
                    self.state.send(.reopen(report), for: update)
                }
            }
        }
    }
}
#endif

#if os(iOS) || os(macOS) || os(watchOS)
import Foundation

/// Platform-independent bookkeeping for the coordinators and the watchOS
/// modifier: throttled fetching, what's been handled this launch, sending.
final class FixVerificationState {
    /// Don't hit the network more than this often from app-activation checks.
    static let minimumCheckInterval: TimeInterval = 60

    private var handledThisLaunch = Set<String>()
    private var lastCheck: Date?
    private var inFlight = false

    /// The next update to show, or nil. Completion on the main queue.
    func fetchNext(force: Bool, completion: @escaping (FixUpdate?) -> Void) {
        guard let configuration = FeedbackKit.currentConfiguration, !inFlight else {
            completion(nil)
            return
        }
        if !force, let lastCheck, Date().timeIntervalSince(lastCheck) < Self.minimumCheckInterval {
            completion(nil)
            return
        }
        inFlight = true
        lastCheck = Date()
        FixUpdatesClient.fetch(configuration: configuration) { [weak self] result in
            guard let self else { return }
            self.inFlight = false
            guard case .success(let updates) = result else {
                completion(nil)
                return
            }
            completion(updates.first { !self.handledThisLaunch.contains($0.id) })
        }
    }

    func markHandled(_ update: FixUpdate) {
        handledThisLaunch.insert(update.id)
    }

    func send(_ action: FixUpdatesClient.Action, for update: FixUpdate) {
        guard let configuration = FeedbackKit.currentConfiguration else { return }
        FixUpdatesClient.send(action, for: update.feedbackID, configuration: configuration) { result in
            if case .failure(let error) = result {
                print("[FeedbackKit] Couldn't send fix verification: \(error.localizedDescription)")
            }
        }
    }
}
#endif
