#if os(iOS)
import XCTest
@testable import FeedbackKit

/// Covers the composer's keyboard-avoidance (`keyboardWillChangeFrame(_:)`
/// in FeedbackViewController) — real `UIResponder` keyboard notifications,
/// not a mock, posted at a real `UIWindow` so `view.convert(_:from: nil)`
/// resolves against real screen coordinates the same way it would at runtime.
final class FeedbackViewControllerKeyboardTests: XCTestCase {
    private var window: UIWindow?

    override func tearDown() {
        window?.isHidden = true
        window = nil
        super.tearDown()
    }

    func testComposerRisesAboveKeyboardAndSettlesBackDown() {
        let renderer = UIGraphicsImageRenderer(size: CGSize(width: 100, height: 200))
        let screenshot = renderer.image { _ in UIColor.white.setFill() }

        let viewController = FeedbackViewController(rawScreenshot: screenshot, screenNameOverride: nil) { _ in }

        let window = UIWindow(frame: CGRect(x: 0, y: 0, width: 390, height: 844))
        window.rootViewController = viewController
        window.makeKeyAndVisible()
        self.window = window
        viewController.view.layoutIfNeeded()

        XCTAssertEqual(viewController.composerBottomConstraint.constant, -12, accuracy: 0.001)

        let keyboardHeight: CGFloat = 300
        let safeAreaBottom = viewController.view.safeAreaInsets.bottom
        let expectedOverlap = max(0, keyboardHeight - safeAreaBottom)

        postKeyboardFrame(
            CGRect(x: 0, y: 844 - keyboardHeight, width: 390, height: keyboardHeight)
        )
        XCTAssertEqual(
            viewController.composerBottomConstraint.constant, -12 - expectedOverlap, accuracy: 0.001,
            "the composer should rise by exactly the keyboard's overlap past the safe area"
        )

        // Keyboard dismissed (end frame slides back below the screen) — the
        // composer should settle back to its original, non-raised position.
        postKeyboardFrame(CGRect(x: 0, y: 844, width: 390, height: keyboardHeight))
        XCTAssertEqual(viewController.composerBottomConstraint.constant, -12, accuracy: 0.001)
    }

    private func postKeyboardFrame(_ endFrame: CGRect) {
        NotificationCenter.default.post(
            name: UIResponder.keyboardWillChangeFrameNotification,
            object: nil,
            userInfo: [
                UIResponder.keyboardFrameEndUserInfoKey: NSValue(cgRect: endFrame),
                UIResponder.keyboardAnimationDurationUserInfoKey: 0.25,
            ]
        )
    }
}
#endif
