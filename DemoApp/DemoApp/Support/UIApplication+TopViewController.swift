import UIKit

extension UIApplication {
    /// FeedbackKit's trigger APIs (shake, floating button) need a view
    /// controller to present from; this is the standard "find whatever's on
    /// screen right now" helper apps typically already have one of.
    var topMostViewController: UIViewController? {
        let activeScenes = connectedScenes
            .compactMap { $0 as? UIWindowScene }
            .filter { $0.activationState == .foregroundActive || $0.activationState == .foregroundInactive }
        let allWindows = activeScenes.flatMap { $0.windows }

        let targetWindow: UIWindow?
        if let key = allWindows.first(where: { $0.isKeyWindow && $0.rootViewController != nil }) {
            targetWindow = key
        } else if let highest = allWindows
            .filter({ $0.rootViewController != nil && !$0.isHidden && $0.alpha > 0 })
            .sorted(by: { $0.windowLevel.rawValue > $1.windowLevel.rawValue })
            .first {
            targetWindow = highest
        } else if let anyWithRoot = allWindows.first(where: { $0.rootViewController != nil }) {
            targetWindow = anyWithRoot
        } else {
            targetWindow = connectedScenes
                .compactMap { $0 as? UIWindowScene }
                .flatMap { $0.windows }
                .first { $0.rootViewController != nil }
        }

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
