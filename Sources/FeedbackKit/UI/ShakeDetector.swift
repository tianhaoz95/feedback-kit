#if os(iOS)
import UIKit

/// Detects device shake gestures app-wide by swizzling `UIWindow.motionEnded`.
///
/// This is the standard technique feedback/bug-report SDKs use for shake
/// triggers (Instabug, Bugsee, etc. all do the same) because it works without
/// requiring the host app to subclass `UIWindow` or forward events manually.
enum ShakeDetector {
    static let shakeNotification = Notification.Name("FeedbackKitDeviceShake")
    private static var isInstalled = false

    static func install() {
        guard !isInstalled else { return }
        isInstalled = true

        let originalSelector = #selector(UIWindow.motionEnded(_:with:))
        let swizzledSelector = #selector(UIWindow.feedbackKit_motionEnded(_:with:))

        guard
            let originalMethod = class_getInstanceMethod(UIWindow.self, originalSelector),
            let swizzledMethod = class_getInstanceMethod(UIWindow.self, swizzledSelector)
        else { return }

        method_exchangeImplementations(originalMethod, swizzledMethod)
    }
}

extension UIWindow {
    @objc func feedbackKit_motionEnded(_ motion: UIEvent.EventSubtype, with event: UIEvent?) {
        if motion == .motionShake {
            NotificationCenter.default.post(name: ShakeDetector.shakeNotification, object: nil)
        }
        // After swizzling, this call actually invokes the original motionEnded implementation.
        feedbackKit_motionEnded(motion, with: event)
    }
}
#endif
