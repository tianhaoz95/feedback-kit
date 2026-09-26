#if os(iOS)
import UIKit

/// Renders the app's current key window to a bitmap.
///
/// Deliberately window-level rather than view-controller-level: this makes
/// capture work identically whether the screen in front of the user was built
/// with UIKit, SwiftUI (hosted in a `UIHostingController`), or a mix of both —
/// FeedbackKit never needs to know.
enum ScreenshotCapture {
    private static func findCaptureWindow() -> UIWindow? {
        let activeScenes = UIApplication.shared.connectedScenes
            .compactMap { $0 as? UIWindowScene }
            .filter { $0.activationState == .foregroundActive || $0.activationState == .foregroundInactive }
        let allWindows: [UIWindow] = activeScenes.flatMap { $0.windows }

        // 1. Key window with valid bounds and a root view controller
        if let keyWindow = allWindows.first(where: { $0.isKeyWindow && $0.bounds.width > 0 && $0.bounds.height > 0 && $0.rootViewController != nil }) {
            return keyWindow
        }
        // 2. Any key window with valid bounds
        if let keyWindow = allWindows.first(where: { $0.isKeyWindow && $0.bounds.width > 0 && $0.bounds.height > 0 }) {
            return keyWindow
        }
        // 3. Highest-level visible window with root view controller and valid bounds
        let validWindows = allWindows.filter { !$0.isHidden && $0.bounds.width > 0 && $0.bounds.height > 0 && $0.rootViewController != nil }
        if let highest = validWindows.sorted(by: { $0.windowLevel.rawValue > $1.windowLevel.rawValue }).first {
            return highest
        }
        // 4. Any window with valid bounds
        if let anyWindow = allWindows.first(where: { $0.bounds.width > 0 && $0.bounds.height > 0 }) {
            return anyWindow
        }
        // 5. Fallback across all scenes
        for scene in UIApplication.shared.connectedScenes {
            if let windowScene = scene as? UIWindowScene,
               let key = windowScene.windows.first(where: { $0.isKeyWindow }) {
                return key
            }
        }
        return nil
    }

    static func captureKeyWindow() -> UIImage? {
        guard let window = findCaptureWindow() else {
            return nil
        }

        let renderer = UIGraphicsImageRenderer(bounds: window.bounds)
        return renderer.image { _ in
            window.drawHierarchy(in: window.bounds, afterScreenUpdates: true)
        }
    }
}
#elseif os(macOS)
import AppKit

/// Renders the app's current key window to a bitmap.
///
/// Deliberately window-level rather than view-controller-level, mirroring
/// the iOS implementation — this is what lets capture work the same whether
/// the window's content was built with AppKit or SwiftUI (hosted in an
/// `NSHostingView`). `NSView.cacheDisplay(in:to:)` renders the view
/// hierarchy directly (like UIKit's `drawHierarchy(in:afterScreenUpdates:)`)
/// rather than compositing the real screen buffer, so this needs no Screen
/// Recording permission.
///
/// It renders the window's *frame* view (`contentView.superview`), not just
/// the content view: the toolbar, title and window controls live outside the
/// content view, and without them a report from a modern SwiftUI app (search
/// field, project pickers, toolbar buttons) loses exactly the controls users
/// point at. Found by dogfooding the SDK in the Mac Developer Portal.
///
/// Known gap: on macOS 26, a `NavigationSplitView` sidebar drawn inside
/// Liquid Glass (`NSGlassEffectView`) renders blank — its content isn't
/// reachable by `cacheDisplay`, and the only API that captures it
/// (ScreenCaptureKit) needs Screen Recording permission, which a feedback
/// SDK shouldn't ask for. The rest of the window is captured normally.
enum ScreenshotCapture {
    static func captureKeyWindow() -> NSImage? {
        guard let window = NSApplication.shared.keyWindow, let contentView = window.contentView else {
            return nil
        }

        let root = frameView(of: contentView)
        let bounds = root.bounds
        guard bounds.width > 0, bounds.height > 0 else { return nil }

        guard let rep = root.bitmapImageRepForCachingDisplay(in: bounds) else { return nil }
        rep.size = bounds.size
        root.cacheDisplay(in: bounds, to: rep)

        let image = NSImage(size: bounds.size)
        image.addRepresentation(rep)
        return image
    }

    /// The window's frame view (titlebar + toolbar + content) when it fully
    /// contains the content view, else the content view itself.
    static func frameView(of contentView: NSView) -> NSView {
        guard let frame = contentView.superview,
              frame.bounds.width >= contentView.bounds.width,
              frame.bounds.height >= contentView.bounds.height else {
            return contentView
        }
        return frame
    }
}
#elseif os(watchOS)
import UIKit

/// watchOS has no window-level (or any) API for capturing arbitrary
/// on-screen content the way UIKit/AppKit do — watch apps are SwiftUI-only,
/// with no `UIWindow` a third party can reach into. Rather than a real
/// screenshot, this renders a small, clearly-labeled placeholder card so
/// `FeedbackReport`'s (non-optional, cross-platform) screenshot fields still
/// get something meaningful instead of a mysterious blank image — the
/// actual substance of a watchOS report is its text and `FeedbackEnvironment`,
/// not a picture. See `FeedbackQuickNoteView`, the stripped-down watchOS
/// flow this feeds into (no screenshot, no annotation tools — the screen's
/// too small for freehand/rectangle/arrow drawing to be usable regardless).
enum ScreenshotCapture {
    /// Built from a raw `CGContext` bitmap rather than `UIGraphicsImageRenderer`
    /// (unavailable on watchOS, unlike the rest of UIKit's basic drawing
    /// types) — the same style of direct Core Graphics drawing
    /// `AnnotationRenderer` already uses everywhere else, so no text
    /// rendering (also uncertain territory on this platform's UIKit subset)
    /// is needed: a plain card with a colored border is enough to read as
    /// "intentional placeholder," not "broken image."
    static func captureKeyWindow() -> UIImage? {
        let size = CGSize(width: 300, height: 120)
        let colorSpace = CGColorSpaceCreateDeviceRGB()
        guard let ctx = CGContext(
            data: nil,
            width: Int(size.width),
            height: Int(size.height),
            bitsPerComponent: 8,
            bytesPerRow: 0,
            space: colorSpace,
            bitmapInfo: CGImageAlphaInfo.premultipliedLast.rawValue
        ) else {
            return nil
        }

        let bounds = CGRect(origin: .zero, size: size)
        ctx.setFillColor(CGColor(red: 0.95, green: 0.95, blue: 0.95, alpha: 1))
        ctx.fill(bounds)

        let borderRect = bounds.insetBy(dx: 6, dy: 6)
        ctx.setStrokeColor(CGColor(red: 1, green: 0.231, blue: 0.188, alpha: 1))
        ctx.setLineWidth(3)
        ctx.stroke(borderRect)

        guard let cgImage = ctx.makeImage() else { return nil }
        return UIImage(cgImage: cgImage)
    }
}
#endif
