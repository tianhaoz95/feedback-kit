#if os(iOS)
import XCTest
@testable import FeedbackKit

/// The composer's attach menu (`FeedbackViewController.makeAttachMenu()`):
/// the report options live there as checkmarked toggles instead of switches
/// in the composer row, with "notify me" off by default.
final class FeedbackComposerOptionsTests: XCTestCase {
    private func makeViewController() -> FeedbackViewController {
        let image = UIGraphicsImageRenderer(size: CGSize(width: 100, height: 200)).image { _ in UIColor.white.setFill() }
        let viewController = FeedbackViewController(rawScreenshot: image, screenNameOverride: nil) { _ in }
        viewController.loadViewIfNeeded()
        return viewController
    }

    private func actions(_ menu: UIMenu) -> [UIAction] {
        menu.children.flatMap { ($0 as? UIMenu)?.children ?? [$0] }.compactMap { $0 as? UIAction }
    }

    func testDefaultsIncludeTheScreenshotAndDontNotify() {
        let viewController = makeViewController()
        XCTAssertTrue(viewController.includesScreenshot)
        XCTAssertFalse(viewController.notifyReporter)
        XCTAssertTrue(viewController.attachButton.showsMenuAsPrimaryAction)

        let byTitle = Dictionary(uniqueKeysWithValues: actions(viewController.makeAttachMenu()).map { ($0.title, $0) })
        XCTAssertEqual(byTitle["Include Screenshot"]?.state, .on)
        XCTAssertEqual(byTitle["Notify Me When It's Fixed"]?.state, .off)
        XCTAssertNotNil(byTitle["Attach File…"])
        XCTAssertNotNil(byTitle["Photo Library"])
        XCTAssertEqual(byTitle["Photo Library"]?.image, UIImage(systemName: "photo.on.rectangle"))
    }

    func testTogglingUpdatesTheMenuCheckmarks() {
        let viewController = makeViewController()
        viewController.setNotifyReporter(true)
        viewController.setIncludesScreenshot(false)

        let byTitle = Dictionary(uniqueKeysWithValues: actions(viewController.attachButton.menu!).map { ($0.title, $0) })
        XCTAssertEqual(byTitle["Include Screenshot"]?.state, .off)
        XCTAssertEqual(byTitle["Notify Me When It's Fixed"]?.state, .on)
    }
}
#endif
