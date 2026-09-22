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
    typealias MotionEndedIMP = @convention(c) (AnyObject, Selector, UIEvent.EventSubtype, UIEvent?) -> Void
    static var originalMotionEndedIMP: MotionEndedIMP?

    static func install() {
        guard !isInstalled else { return }
        isInstalled = true

        let originalSelector = #selector(UIResponder.motionEnded(_:with:))
        let swizzledSelector = #selector(UIWindow.feedbackKit_motionEnded(_:with:))

        guard
            let originalMethod = class_getInstanceMethod(UIWindow.self, originalSelector),
            let swizzledMethod = class_getInstanceMethod(UIWindow.self, swizzledSelector)
        else { return }

        let originalImp = method_getImplementation(originalMethod)
        originalMotionEndedIMP = unsafeBitCast(originalImp, to: MotionEndedIMP.self)

        let swizzledImp = method_getImplementation(swizzledMethod)
        let swizzledTypes = method_getTypeEncoding(swizzledMethod)

        let didAddMethod = class_addMethod(
            UIWindow.self,
            originalSelector,
            swizzledImp,
            swizzledTypes
        )

        if !didAddMethod {
            method_setImplementation(originalMethod, swizzledImp)
        }
    }
}

extension UIWindow {
    @objc func feedbackKit_motionEnded(_ motion: UIEvent.EventSubtype, with event: UIEvent?) {
        if motion == .motionShake {
            NotificationCenter.default.post(name: ShakeDetector.shakeNotification, object: nil)
        }
        ShakeDetector.originalMotionEndedIMP?(self, #selector(UIResponder.motionEnded(_:with:)), motion, event)
    }
}
#endif
