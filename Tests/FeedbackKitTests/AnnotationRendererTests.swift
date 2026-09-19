import UIKit
import XCTest
@testable import FeedbackKit

final class AnnotationRendererTests: XCTestCase {
    /// Regression test for a bug where an unrotated rectangle drawn far from
    /// the origin (e.g. a touch near screen-center) rendered near the
    /// top-left corner instead — `rotate(_:by:around:)` expects an absolute
    /// point and subtracts `center` itself, so passing bare offset vectors
    /// (rather than points built relative to `center`) double-subtracted it.
    func testUnrotatedRectangleCornersAreCenteredAtTouchLocation() {
        let center = CGPoint(x: 300, y: 500)
        let corners = AnnotationRenderer.rectangleCorners(
            center: center,
            halfWidth: 40,
            halfHeight: 20,
            rotation: 0
        )

        let expected: Set<CGPoint> = [
            CGPoint(x: 260, y: 480),
            CGPoint(x: 340, y: 480),
            CGPoint(x: 340, y: 520),
            CGPoint(x: 260, y: 520)
        ]
        XCTAssertEqual(Set(corners), expected)

        // The bug's signature: every corner ends up near the origin instead
        // of near `center`, so also assert corners are actually close to it.
        for corner in corners {
            XCTAssertLessThan(corner.distance(to: center), 60)
        }
    }

    func testRotatingRectangleNinetyDegreesSwapsWidthAndHeight() {
        let center = CGPoint(x: 100, y: 100)
        let corners = AnnotationRenderer.rectangleCorners(
            center: center,
            halfWidth: 40,
            halfHeight: 10,
            rotation: .pi / 2
        )

        // A wide, short rectangle rotated 90° becomes narrow and tall around
        // the same center: x extent shrinks to ~halfHeight, y extent grows to
        // ~halfWidth.
        let xs = corners.map(\.x)
        let ys = corners.map(\.y)
        XCTAssertEqual((xs.max()! - xs.min()!) / 2, 10, accuracy: 0.01)
        XCTAssertEqual((ys.max()! - ys.min()!) / 2, 40, accuracy: 0.01)
    }
}

private extension CGPoint {
    func distance(to other: CGPoint) -> CGFloat {
        hypot(x - other.x, y - other.y)
    }
}
