import XCTest
@testable import FeedbackKit

#if os(iOS)
/// Covers `AnnotationToolbar.accentColor` — the mechanism
/// `FeedbackViewController` uses to apply `FeedbackKit.theme`'s primary
/// color to the currently-selected annotation tool. `selectedToolButton` is
/// widened from `private` (see its declaration) specifically so this test
/// can read it directly.
final class AnnotationToolbarThemeTests: XCTestCase {
    func testDefaultAccentColorHighlightsTheInitiallySelectedTool() {
        let toolbar = AnnotationToolbar()
        XCTAssertEqual(toolbar.selectedToolButton?.tintColor, .systemBlue)
    }

    func testSettingAccentColorReHighlightsTheCurrentlySelectedTool() {
        let toolbar = AnnotationToolbar()
        toolbar.accentColor = .systemPurple
        XCTAssertEqual(toolbar.selectedToolButton?.tintColor, .systemPurple)
    }
}
#elseif os(macOS)
final class AnnotationToolbarThemeTests: XCTestCase {
    func testDefaultAccentColorHighlightsTheInitiallySelectedTool() {
        let toolbar = AnnotationToolbar()
        XCTAssertEqual(toolbar.selectedToolButton?.contentTintColor, .systemBlue)
    }

    func testSettingAccentColorReHighlightsTheCurrentlySelectedTool() {
        let toolbar = AnnotationToolbar()
        toolbar.accentColor = .systemPurple
        XCTAssertEqual(toolbar.selectedToolButton?.contentTintColor, .systemPurple)
    }
}
#endif
