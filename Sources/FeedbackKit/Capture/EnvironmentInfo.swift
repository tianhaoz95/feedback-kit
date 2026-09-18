import UIKit

enum EnvironmentInfo {
    static func current(screenName: String?) -> FeedbackEnvironment {
        let device = UIDevice.current
        let bundle = Bundle.main
        let screen = UIScreen.main

        return FeedbackEnvironment(
            osName: device.systemName,
            osVersion: device.systemVersion,
            deviceModel: deviceModelIdentifier(),
            appVersion: bundle.infoDictionary?["CFBundleShortVersionString"] as? String ?? "unknown",
            appBuild: bundle.infoDictionary?["CFBundleVersion"] as? String ?? "unknown",
            bundleIdentifier: bundle.bundleIdentifier ?? "unknown",
            screenName: screenName ?? TopViewControllerResolver.bestEffortScreenName(),
            locale: Locale.current.identifier,
            screenWidthPoints: screen.bounds.width,
            screenHeightPoints: screen.bounds.height,
            screenScale: screen.scale
        )
    }

    /// Returns the raw hardware identifier (e.g. "iPhone16,2"), which is more
    /// precise than `UIDevice.current.model` (which just returns "iPhone").
    private static func deviceModelIdentifier() -> String {
        var systemInfo = utsname()
        uname(&systemInfo)
        let machineMirror = Mirror(reflecting: systemInfo.machine)
        return machineMirror.children.reduce(into: "") { identifier, element in
            guard let value = element.value as? Int8, value != 0 else { return }
            identifier += String(UnicodeScalar(UInt8(value)))
        }
    }
}

/// Best-effort automatic screen-name detection for apps that don't explicitly
/// set `FeedbackKit.currentScreen`. Walks the key window's presented/visible
/// view controller stack. This only sees UIKit view controllers — a screen
/// built entirely in SwiftUI will just show its hosting controller's class
/// name (typically unhelpful), which is why explicitly setting
/// `FeedbackKit.currentScreen` as you navigate is the recommended approach.
enum TopViewControllerResolver {
    static func bestEffortScreenName() -> String? {
        guard let root = UIApplication.shared.connectedScenes
            .compactMap({ $0 as? UIWindowScene })
            .flatMap({ $0.windows })
            .first(where: { $0.isKeyWindow })?
            .rootViewController
        else {
            return nil
        }
        return String(describing: type(of: topMost(from: root)))
    }

    private static func topMost(from viewController: UIViewController) -> UIViewController {
        if let presented = viewController.presentedViewController {
            return topMost(from: presented)
        }
        if let nav = viewController as? UINavigationController, let visible = nav.visibleViewController {
            return topMost(from: visible)
        }
        if let tab = viewController as? UITabBarController, let selected = tab.selectedViewController {
            return topMost(from: selected)
        }
        if let children = viewController.children.last, viewController.children.count == 1 {
            return topMost(from: children)
        }
        return viewController
    }
}
