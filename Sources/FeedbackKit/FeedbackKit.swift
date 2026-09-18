import UIKit

/// FeedbackKit's public entry point.
///
/// Typical usage:
/// ```swift
/// // Somewhere in app startup, if you want the hosted dashboard:
/// FeedbackKit.configure(.init(endpointURL: myEndpoint, projectKey: "pk_live_..."))
///
/// // Wire up a trigger however you like:
/// FeedbackKit.showFloatingTriggerButton { UIApplication.shared.topMostViewController }
/// // or: FeedbackKit.enableShakeToReport { UIApplication.shared.topMostViewController }
/// // or call FeedbackKit.present(from:) directly from a button/menu action you already have.
///
/// // As the user navigates, keep this updated so reports say where they came from:
/// FeedbackKit.currentScreen = "Checkout"
/// ```
public enum FeedbackKit {
    /// Best-effort label for the screen currently visible, included in every
    /// report's environment info. Set this as the user navigates (e.g. in
    /// `viewDidAppear`); FeedbackKit falls back to auto-detection if left nil.
    public static var currentScreen: String?

    private static var configuration: FeedbackKitConfiguration?
    private static var triggerButton: FeedbackTriggerButton?
    private static var shakeObserver: NSObjectProtocol?

    /// Configures the optional built-in submission path to the hosted dashboard.
    /// Skip this entirely if you're handling delivery yourself via the
    /// `present(from:completion:)` callback.
    public static func configure(_ configuration: FeedbackKitConfiguration) {
        self.configuration = configuration
    }

    /// Presents the capture → annotate → describe → submit flow modally.
    /// `completion` receives the finished report, or `nil` if the user cancelled.
    /// Delivery is entirely up to the caller — print it, POST it to your own
    /// backend, or pass it to `FeedbackSubmitter` yourself.
    public static func present(
        from viewController: UIViewController,
        completion: ((FeedbackReport?) -> Void)? = nil
    ) {
        guard let screenshot = ScreenshotCapture.captureKeyWindow() else {
            completion?(nil)
            return
        }
        let feedbackViewController = FeedbackViewController(
            rawScreenshot: screenshot,
            screenNameOverride: currentScreen,
            onComplete: { report in completion?(report) }
        )
        viewController.present(feedbackViewController, animated: true)
    }

    /// Convenience that presents the flow and, if `configure(_:)` was called,
    /// also submits the resulting report to the hosted dashboard.
    public static func presentAndSubmit(
        from viewController: UIViewController,
        completion: ((Result<FeedbackReport, FeedbackSubmissionError>) -> Void)? = nil
    ) {
        present(from: viewController) { report in
            guard let report else { return }
            guard let configuration else {
                completion?(.failure(.notConfigured))
                return
            }
            FeedbackSubmitter.submit(report, configuration: configuration) { result in
                switch result {
                case .success:
                    completion?(.success(report))
                case .failure(let error):
                    completion?(.failure(error))
                }
            }
        }
    }

    /// Installs a small draggable floating button in the key window that
    /// presents the feedback flow when tapped. `presenter` should return the
    /// view controller to present from (typically the current top-most one).
    public static func showFloatingTriggerButton(presenter: @escaping () -> UIViewController?) {
        triggerButton?.removeFromSuperview()
        triggerButton = FeedbackTriggerButton.install {
            guard let vc = presenter() else { return }
            presentAndSubmitIfConfigured(from: vc)
        }
    }

    public static func hideFloatingTriggerButton() {
        triggerButton?.removeFromSuperview()
        triggerButton = nil
    }

    /// Enables the classic "shake to report a bug" trigger app-wide.
    public static func enableShakeToReport(presenter: @escaping () -> UIViewController?) {
        ShakeDetector.install()
        if let shakeObserver {
            NotificationCenter.default.removeObserver(shakeObserver)
        }
        shakeObserver = NotificationCenter.default.addObserver(
            forName: ShakeDetector.shakeNotification,
            object: nil,
            queue: .main
        ) { _ in
            guard let vc = presenter() else { return }
            presentAndSubmitIfConfigured(from: vc)
        }
    }

    private static func presentAndSubmitIfConfigured(from viewController: UIViewController) {
        if configuration != nil {
            presentAndSubmit(from: viewController)
        } else {
            present(from: viewController)
        }
    }
}
