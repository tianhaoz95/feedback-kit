#if os(iOS)
import XCTest
@testable import FeedbackKit

/// Covers `FeedbackTheme` reaching every themed control on
/// `FeedbackViewController`: the send button and toolbar accent (primary),
/// and Cancel/attach (secondary). `sendButton`/`cancelButton`/`attachButton`/
/// `toolbar`/`includeScreenshotToggle` are widened from `private` (see their
/// declarations) specifically so this test can read them directly.
final class FeedbackViewControllerThemeTests: XCTestCase {
    private func makeScreenshot() -> UIImage {
        let renderer = UIGraphicsImageRenderer(size: CGSize(width: 100, height: 200))
        return renderer.image { _ in UIColor.white.setFill() }
    }

    func testNoThemeKeepsExistingDefaultColors() {
        let viewController = FeedbackViewController(
            rawScreenshot: makeScreenshot(), screenNameOverride: nil, theme: nil
        ) { _ in }
        viewController.loadViewIfNeeded()

        XCTAssertEqual(viewController.sendButton.tintColor, .systemBlue)
        XCTAssertEqual(viewController.toolbar.accentColor, .systemBlue)
        XCTAssertNil(viewController.includeScreenshotToggle.onTintColor)
    }

    func testThemeAppliesPrimaryAndSecondaryColorsToComposerControls() {
        let theme = FeedbackTheme(primaryColorHex: "#7C3AED", secondaryColorHex: "#F97316")
        let viewController = FeedbackViewController(
            rawScreenshot: makeScreenshot(), screenNameOverride: nil, theme: theme
        ) { _ in }
        viewController.loadViewIfNeeded()

        let expectedPrimary = UIColor(hex: "#7C3AED")
        let expectedSecondary = UIColor(hex: "#F97316")

        XCTAssertEqual(viewController.sendButton.tintColor, expectedPrimary)
        XCTAssertEqual(viewController.toolbar.accentColor, expectedPrimary)
        XCTAssertEqual(viewController.includeScreenshotToggle.onTintColor, expectedPrimary)
        XCTAssertEqual(viewController.cancelButton.tintColor, expectedSecondary)
        XCTAssertEqual(viewController.attachButton.tintColor, expectedSecondary)
    }
}
#endif
