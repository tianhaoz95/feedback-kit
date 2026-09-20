#if os(iOS)
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
#elseif os(macOS)
import AppKit

enum EnvironmentInfo {
    static func current(screenName: String?) -> FeedbackEnvironment {
        let bundle = Bundle.main
        let screen = NSScreen.main
        let osVersion = ProcessInfo.processInfo.operatingSystemVersion

        return FeedbackEnvironment(
            osName: "macOS",
            osVersion: "\(osVersion.majorVersion).\(osVersion.minorVersion).\(osVersion.patchVersion)",
            deviceModel: hardwareModelIdentifier(),
            appVersion: bundle.infoDictionary?["CFBundleShortVersionString"] as? String ?? "unknown",
            appBuild: bundle.infoDictionary?["CFBundleVersion"] as? String ?? "unknown",
            bundleIdentifier: bundle.bundleIdentifier ?? "unknown",
            // No UIKit-style view-controller stack to walk on macOS, so
            // there's no auto-detection fallback here — the key window's
            // title is the closest analog, but titles are often generic
            // ("Untitled") or blank for utility windows, so it's not worth
            // pretending it's reliable the way the iOS fallback at least
            // tries to be. Set `FeedbackKit.currentScreen` explicitly.
            screenName: screenName,
            locale: Locale.current.identifier,
            screenWidthPoints: Double(screen?.frame.width ?? 0),
            screenHeightPoints: Double(screen?.frame.height ?? 0),
            screenScale: Double(screen?.backingScaleFactor ?? 1)
        )
    }

    /// Returns the raw hardware identifier (e.g. "MacBookPro18,1" / "Mac14,2"),
    /// mirroring the iOS side's `deviceModelIdentifier()`.
    private static func hardwareModelIdentifier() -> String {
        var size = 0
        sysctlbyname("hw.model", nil, &size, nil, 0)
        guard size > 0 else { return "unknown" }
        var machine = [CChar](repeating: 0, count: size)
        sysctlbyname("hw.model", &machine, &size, nil, 0)
        return String(cString: machine)
    }
}
#elseif os(watchOS)
import WatchKit

enum EnvironmentInfo {
    static func current(screenName: String?) -> FeedbackEnvironment {
        let device = WKInterfaceDevice.current()
        let bundle = Bundle.main

        return FeedbackEnvironment(
            osName: device.systemName,
            osVersion: device.systemVersion,
            deviceModel: deviceModelIdentifier(),
            appVersion: bundle.infoDictionary?["CFBundleShortVersionString"] as? String ?? "unknown",
            appBuild: bundle.infoDictionary?["CFBundleVersion"] as? String ?? "unknown",
            bundleIdentifier: bundle.bundleIdentifier ?? "unknown",
            // No window/view-controller-stack concept to fall back on here
            // either (same as macOS) — set `FeedbackKit.currentScreen`
            // explicitly as the user navigates.
            screenName: screenName,
            locale: Locale.current.identifier,
            screenWidthPoints: Double(device.screenBounds.width),
            screenHeightPoints: Double(device.screenBounds.height),
            screenScale: Double(device.screenScale)
        )
    }

    /// Returns the raw hardware identifier (e.g. "Watch7,1"), mirroring the
    /// iOS/macOS sides.
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
#endif
