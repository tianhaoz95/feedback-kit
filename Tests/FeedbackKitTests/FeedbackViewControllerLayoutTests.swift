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

    func testTextViewScrollingWhenContentExceedsMaxHeight() throws {
        let renderer = UIGraphicsImageRenderer(size: CGSize(width: 430, height: 932))
        let screenshot = renderer.image { _ in UIColor.white.setFill() }
        let viewController = FeedbackViewController(rawScreenshot: screenshot, screenNameOverride: nil) { _ in }

        let window = UIWindow(frame: CGRect(x: 0, y: 0, width: 430, height: 932))
        window.rootViewController = viewController
        window.makeKeyAndVisible()
        self.window = window
        viewController.view.layoutIfNeeded()

        let longText = (1...20).map { "Line \($0): A long description of the issue being reported." }.joined(separator: "\n")
        viewController.textView.text = longText
        viewController.textViewDidChange(viewController.textView)
        viewController.view.layoutIfNeeded()

        XCTAssertTrue(viewController.textView.isScrollEnabled)
        XCTAssertEqual(viewController.textView.bounds.height, 120, accuracy: 1.0)
        XCTAssertGreaterThan(viewController.textView.contentSize.height, viewController.textView.bounds.height)
    }

    func testMultilineInputDoesNotSqueezeBottomUIAndEnablesScrolling() throws {
        FeedbackKit.products = [
            FeedbackProduct(key: "portal", name: "Developer Portal (iOS)")
        ]
        defer { FeedbackKit.products = [] }

        let renderer = UIGraphicsImageRenderer(size: CGSize(width: 402, height: 874))
        let screenshot = renderer.image { _ in UIColor.white.setFill() }
        let viewController = FeedbackViewController(rawScreenshot: screenshot, screenNameOverride: nil) { _ in }

        let window = UIWindow(frame: CGRect(x: 0, y: 0, width: 402, height: 874))
        window.rootViewController = viewController
        window.makeKeyAndVisible()
        self.window = window
        viewController.view.layoutIfNeeded()

        // 1. Initial single-line state: buttons are 32x32 circles, scroll is disabled
        XCTAssertEqual(viewController.attachButton.bounds.width, 32, accuracy: 0.5)
        XCTAssertEqual(viewController.attachButton.bounds.height, 32, accuracy: 0.5)
        XCTAssertEqual(viewController.sendButton.bounds.width, 32, accuracy: 0.5)
        XCTAssertEqual(viewController.sendButton.bounds.height, 32, accuracy: 0.5)
        XCTAssertFalse(viewController.textView.isScrollEnabled)

        // 2. Simulate keyboard appearance pushing composer up
        let keyboardHeight: CGFloat = 336
        NotificationCenter.default.post(
            name: UIResponder.keyboardWillChangeFrameNotification,
            object: nil,
            userInfo: [
                UIResponder.keyboardFrameEndUserInfoKey: NSValue(cgRect: CGRect(x: 0, y: 874 - keyboardHeight, width: 402, height: keyboardHeight)),
                UIResponder.keyboardAnimationDurationUserInfoKey: 0.0,
            ]
        )
        viewController.view.layoutIfNeeded()

        // 3. Multi-line input (4 lines, like reported in the issue)
        let text = "https://github.com/tianhaoz95/feedback-kit/actions/runs/36955593153/job/110677735189 looks like when I trigger Claude agent, it does nothing, investigate"
        viewController.setIncludesScreenshot(false)
        viewController.textView.text = text
        viewController.textViewDidChange(viewController.textView)
        viewController.view.layoutIfNeeded()

        // Verify bottom UI is NOT squeezed vertically into ovals
        let buttonRow = try XCTUnwrap(viewController.attachButton.superview)
        XCTAssertGreaterThanOrEqual(buttonRow.bounds.height, 32.0 - 0.5)
        XCTAssertEqual(viewController.attachButton.bounds.width, 32, accuracy: 0.5)
        XCTAssertEqual(viewController.attachButton.bounds.height, 32, accuracy: 0.5)
        XCTAssertEqual(viewController.sendButton.bounds.width, 32, accuracy: 0.5)
        XCTAssertEqual(viewController.sendButton.bounds.height, 32, accuracy: 0.5)

        // Verify scrolling is enabled on multi-line input
        XCTAssertTrue(viewController.textView.isScrollEnabled)
        XCTAssertGreaterThanOrEqual(viewController.textView.contentSize.height, viewController.textView.bounds.height)

        // Verify ability to scroll through the multi-line input
        let maxOffsetY = max(0, viewController.textView.contentSize.height - viewController.textView.bounds.height)
        viewController.textView.setContentOffset(CGPoint(x: 0, y: maxOffsetY), animated: false)
        XCTAssertEqual(viewController.textView.contentOffset.y, maxOffsetY, accuracy: 1.0)
        viewController.textView.setContentOffset(.zero, animated: false)
        XCTAssertEqual(viewController.textView.contentOffset.y, 0, accuracy: 1.0)

        // Save a preview snapshot for verification
        let snapshotRenderer = UIGraphicsImageRenderer(bounds: window.bounds)
        let snapshotImage = snapshotRenderer.image { ctx in
            window.layer.render(in: ctx.cgContext)
        }
        if let png = snapshotImage.pngData() {
            let repoRoot = URL(fileURLWithPath: #filePath)
                .deletingLastPathComponent() // Tests/FeedbackKitTests
                .deletingLastPathComponent() // Tests
                .deletingLastPathComponent() // repo root
            let previewDir = repoRoot.appendingPathComponent(".agent-preview")
            try? FileManager.default.createDirectory(at: previewDir, withIntermediateDirectories: true)
            try? png.write(to: previewDir.appendingPathComponent("after.png"))
        }
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
