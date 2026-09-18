import UIKit

extension UIApplication {
    /// FeedbackKit's trigger APIs (shake, floating button) need a view
    /// controller to present from; this is the standard "find whatever's on
    /// screen right now" helper apps typically already have one of.
    var topMostViewController: UIViewController? {
        connectedScenes
            .compactMap { $0 as? UIWindowScene }
            .flatMap { $0.windows }
            .first { $0.isKeyWindow }?
            .rootViewController?
            .topMost()
    }
}

private extension UIViewController {
    func topMost() -> UIViewController {
        if let presented = presentedViewController {
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
