#if os(watchOS)
import SwiftUI
import XCTest
@testable import FeedbackKit

/// Unlike `AnnotationRendererTests`/`FeedbackReportTests` (shared, run on
/// every platform), this exercises the watchOS-specific implementations of
/// `EnvironmentInfo`/`ScreenshotCapture` directly — there's no UI layer to
/// test on watchOS the way there is on iOS/macOS (see DESIGN.md's note on
/// that gap), but this pure capture-layer logic is cheap to cover for real.
final class WatchOSCaptureTests: XCTestCase {
    func testEnvironmentInfoPopulatesRealDeviceValues() {
        let environment = EnvironmentInfo.current(screenName: "TestScreen")

        XCTAssertFalse(environment.osName.isEmpty)
        XCTAssertFalse(environment.osVersion.isEmpty)
        XCTAssertFalse(environment.deviceModel.isEmpty)
        XCTAssertEqual(environment.screenName, "TestScreen")
        XCTAssertGreaterThan(environment.screenWidthPoints, 0)
        XCTAssertGreaterThan(environment.screenHeightPoints, 0)
        XCTAssertGreaterThan(environment.screenScale, 0)
    }

    func testEnvironmentInfoScreenNameIsNilWhenNotSet() {
        // No auto-detection fallback on watchOS, unlike iOS — nil in means
        // nil out.
        XCTAssertNil(EnvironmentInfo.current(screenName: nil).screenName)
    }

    func testScreenshotCapturePlaceholderCardIsWellFormed() {
        let image = ScreenshotCapture.captureKeyWindow()
        XCTAssertNotNil(image)
        XCTAssertEqual(image?.size, CGSize(width: 300, height: 120))
        XCTAssertNotNil(image?.pngData())
    }

    /// Not a real UI test (no host for rendering/interaction on watchOS in
    /// this repo — see DESIGN.md), but evaluating `.body` still exercises
    /// the view's property wrappers and layout construction, which is
    /// enough to catch a force-unwrap or missing-environment-value crash.
    func testQuickNoteViewBodyEvaluatesWithoutCrashing() {
        var completionCalled = false
        let view = FeedbackQuickNoteView { _ in completionCalled = true }
        _ = view.body
        XCTAssertFalse(completionCalled)
    }
}
#endif
