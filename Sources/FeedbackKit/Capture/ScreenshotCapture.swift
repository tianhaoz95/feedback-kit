#if os(iOS)
import UIKit

/// Renders the app's current key window to a bitmap.
///
/// Deliberately window-level rather than view-controller-level: this makes
/// capture work identically whether the screen in front of the user was built
/// with UIKit, SwiftUI (hosted in a `UIHostingController`), or a mix of both —
/// FeedbackKit never needs to know.
enum ScreenshotCapture {
    static func captureKeyWindow() -> UIImage? {
        guard let window = UIApplication.shared.connectedScenes
            .compactMap({ $0 as? UIWindowScene })
            .flatMap({ $0.windows })
            .first(where: { $0.isKeyWindow })
        else {
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
enum ScreenshotCapture {
    static func captureKeyWindow() -> NSImage? {
        guard let window = NSApplication.shared.keyWindow, let contentView = window.contentView else {
            return nil
        }

        let bounds = contentView.bounds
        guard bounds.width > 0, bounds.height > 0 else { return nil }

        guard let rep = contentView.bitmapImageRepForCachingDisplay(in: bounds) else { return nil }
        rep.size = bounds.size
        contentView.cacheDisplay(in: bounds, to: rep)

        let image = NSImage(size: bounds.size)
        image.addRepresentation(rep)
        return image
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
