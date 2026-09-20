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
#endif
