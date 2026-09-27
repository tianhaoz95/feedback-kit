import XCTest

/// Captures the landing page's iOS image: the annotate screen with a
/// rectangle around the first "Add" button, a description, and "Notify me"
/// switched on from the composer's + menu. Run by scripts/landing-captures/capture.sh; not part of the regular test suites.
final class HeroCaptureTests: XCTestCase {
    func testCaptureHero() throws {
        let app = XCUIApplication()
        app.launch()

        let add = app.buttons.matching(NSPredicate(format: "label == 'Add'")).firstMatch
        XCTAssertTrue(add.waitForExistence(timeout: 10))
        let screen = app.windows.firstMatch.frame
        let target = add.frame

        app.buttons["Report a Problem"].tap()
        let canvas = app.otherElements["FeedbackKit.AnnotationCanvas"]
        XCTAssertTrue(canvas.waitForExistence(timeout: 10))

        // Describe it first, then dismiss the keyboard with a tap outside the composer.
        let text = app.textViews.firstMatch
        text.tap()
        text.typeText("The first Add button doesn't do anything.")
        app.staticTexts["Report Feedback"].tap()
        sleep(1)

        // Rectangle around the button's real frame, mapped into the canvas (same aspect ratio as the screen).
        app.buttons["Rectangle"].tap()
        let pad: CGFloat = 5
        func point(_ x: CGFloat, _ y: CGFloat) -> XCUICoordinate {
            canvas.coordinate(withNormalizedOffset: CGVector(dx: (x - screen.minX) / screen.width, dy: (y - screen.minY) / screen.height))
        }
        let start = point(target.minX - pad, target.minY - pad)
        let end = point(target.maxX + pad, target.maxY + pad)
        start.press(forDuration: 0.3, thenDragTo: end)

        app.buttons["Options and attachments"].tap()
        // Menu items with a subtitle expose "title, subtitle" as their label.
        let notify = app.descendants(matching: .any).matching(NSPredicate(format: "label BEGINSWITH %@", "Notify Me")).firstMatch
        if !notify.waitForExistence(timeout: 5) { print(app.debugDescription) }
        notify.tap()
        XCTAssertTrue(app.staticTexts["Notify me"].waitForExistence(timeout: 5))
        sleep(1)

        let path = ProcessInfo.processInfo.environment["CAPTURE_PATH"] ?? "/tmp/hero-ios.png"
        try XCUIScreen.main.screenshot().pngRepresentation.write(to: URL(fileURLWithPath: path))
    }
}
