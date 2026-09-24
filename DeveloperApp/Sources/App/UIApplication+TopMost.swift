import UIKit

extension UIApplication {
    /// FeedbackKit's trigger APIs (shake, floating button) need a view
    /// controller to present from; this resolves the active top-most view controller.
    var topMostViewController: UIViewController? {
        let activeScenes = connectedScenes
            .compactMap { $0 as? UIWindowScene }
            .filter { $0.activationState == .foregroundActive || $0.activationState == .foregroundInactive }
        let allWindows = activeScenes.flatMap { $0.windows }

        let targetWindow = allWindows.first { $0.isKeyWindow && $0.rootViewController != nil }
            ?? allWindows
                .filter { $0.rootViewController != nil && !$0.isHidden && $0.alpha > 0 }
                .sorted(by: { $0.windowLevel.rawValue > $1.windowLevel.rawValue })
                .first
            ?? allWindows.first { $0.rootViewController != nil }
            ?? connectedScenes
                .compactMap { $0 as? UIWindowScene }
                .flatMap { $0.windows }
                .first { $0.rootViewController != nil }

        let root = targetWindow?.rootViewController
        return root?.topMost() ?? root
    }
}

private extension UIViewController {
    func topMost() -> UIViewController {
        if let presented = presentedViewController, !presented.isBeingDismissed {
            return presented.topMost()
        }
        if let nav = self as? UINavigationController, let visible = nav.visibleViewController {
            return visible.topMost()
        }
        if let tab = self as? UITabBarController, let selected = tab.selectedViewController {
            return selected.topMost()
        }
        return self
    }
}
