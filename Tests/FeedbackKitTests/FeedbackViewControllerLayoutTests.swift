#if os(iOS)
import XCTest
@testable import FeedbackKit

/// Regression test: annotations are normalized to the canvas, and the
/// flattened PNG / dashboard draw them against the screenshot itself, so the
/// canvas must cover exactly the displayed screenshot. It used to be inset by
/// an even bezel, which made it narrower than the screenshot's aspect ratio;
/// the aspect-fit image then letterboxed inside it and saved annotations
/// drifted vertically from what the user drew on.
final class FeedbackViewControllerLayoutTests: XCTestCase {
    private var window: UIWindow?

    override func tearDown() {
        window?.isHidden = true
        window = nil
        super.tearDown()
    }

    func testCanvasMatchesTheScreenshotsAspectRatio() throws {
        // An iPhone-shaped screenshot (430×932 pt), shown in a phone-sized window.
        let renderer = UIGraphicsImageRenderer(size: CGSize(width: 430, height: 932))
        let screenshot = renderer.image { _ in UIColor.white.setFill() }
        let viewController = FeedbackViewController(rawScreenshot: screenshot, screenNameOverride: nil) { _ in }

        let window = UIWindow(frame: CGRect(x: 0, y: 0, width: 430, height: 932))
        window.rootViewController = viewController
        window.makeKeyAndVisible()
        self.window = window
        viewController.view.layoutIfNeeded()

        let canvas = try XCTUnwrap(
            findView(in: viewController.view) { $0.accessibilityIdentifier == "FeedbackKit.AnnotationCanvas" }
        )
        XCTAssertGreaterThan(canvas.bounds.width, 0)
        XCTAssertEqual(
            canvas.bounds.width / canvas.bounds.height,
            screenshot.size.width / screenshot.size.height,
            accuracy: 0.001,
            "the canvas must cover exactly the displayed screenshot, with no letterboxing"
        )
    }

    private func findView(in root: UIView, where match: (UIView) -> Bool) -> UIView? {
        if match(root) { return root }
        for sub in root.subviews {
            if let found = findView(in: sub, where: match) { return found }
        }
        return nil
    }
}
#endif
