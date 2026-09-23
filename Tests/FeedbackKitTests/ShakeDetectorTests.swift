#if os(iOS)
import XCTest
import UIKit
@testable import FeedbackKit

final class ShakeDetectorTests: XCTestCase {
    func testShakeOnResponderDoesNotCrash() {
        ShakeDetector.install()

        let responder = UIResponder()
        responder.motionEnded(.motionShake, with: nil)
    }

    func testShakeOnViewDoesNotCrash() {
        ShakeDetector.install()

        let view = UIView()
        view.motionEnded(.motionShake, with: nil)
    }

    func testShakeOnWindowPostsNotification() {
        ShakeDetector.install()

        var receivedNotification = false
        let observer = NotificationCenter.default.addObserver(
            forName: ShakeDetector.shakeNotification,
            object: nil,
            queue: nil
        ) { _ in
            receivedNotification = true
        }
        defer { NotificationCenter.default.removeObserver(observer) }

        let window = UIWindow()
        window.motionEnded(.motionShake, with: nil)

        XCTAssertTrue(receivedNotification)
    }

    func testShakeOnViewInWindowPropagatesAndPostsNotification() {
        ShakeDetector.install()

        var receivedNotification = false
        let observer = NotificationCenter.default.addObserver(
            forName: ShakeDetector.shakeNotification,
            object: nil,
            queue: nil
        ) { _ in
            receivedNotification = true
        }
        defer { NotificationCenter.default.removeObserver(observer) }

        let window = UIWindow()
        let subview = UIView()
        window.addSubview(subview)
        subview.motionEnded(.motionShake, with: nil)

        XCTAssertTrue(receivedNotification)
    }

    func testNonShakeMotionDoesNotPostNotification() {
        ShakeDetector.install()

        var receivedNotification = false
        let observer = NotificationCenter.default.addObserver(
            forName: ShakeDetector.shakeNotification,
            object: nil,
            queue: nil
        ) { _ in
            receivedNotification = true
        }
        defer { NotificationCenter.default.removeObserver(observer) }

        let window = UIWindow()
        window.motionEnded(.none, with: nil)

        XCTAssertFalse(receivedNotification)
    }

    func testDisableShakeToReportStopsHandlingShakes() {
        var presenterCalled = false
        let dummyVC = UIViewController()
        FeedbackKit.enableShakeToReport {
            presenterCalled = true
            return dummyVC
        }
        FeedbackKit.disableShakeToReport()

        let window = UIWindow()
        window.motionEnded(.motionShake, with: nil)

        XCTAssertFalse(presenterCalled)
    }
}
#endif
