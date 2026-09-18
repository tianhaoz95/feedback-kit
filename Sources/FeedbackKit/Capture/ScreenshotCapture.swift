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
