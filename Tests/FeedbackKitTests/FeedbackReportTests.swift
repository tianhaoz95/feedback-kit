import CoreGraphics
import XCTest
@testable import FeedbackKit

final class FeedbackReportTests: XCTestCase {
    func testFeedbackReportRoundTripsThroughJSON() throws {
        let environment = FeedbackEnvironment(
            osName: "iOS",
            osVersion: "17.0",
            deviceModel: "iPhone16,2",
            appVersion: "1.0",
            appBuild: "42",
            bundleIdentifier: "com.example.app",
            screenName: "Checkout",
            locale: "en_US",
            screenWidthPoints: 390,
            screenHeightPoints: 844,
            screenScale: 3
        )
        let annotation = FeedbackAnnotation(
            kind: .rectangle,
            points: [CGPoint(x: 0.1, y: 0.2), CGPoint(x: 0.5, y: 0.6)],
            colorHex: "#FF0000",
            scale: 1.5,
            rotation: .pi / 4
        )
        let attachment = FeedbackAttachment(
            filename: "console.log",
            mimeType: "text/plain",
            data: Data([0x05, 0x06])
        )
        let report = FeedbackReport(
            text: "The submit button is unresponsive",
            screenshotRawPNG: Data([0x01, 0x02]),
            screenshotAnnotatedPNG: Data([0x03, 0x04]),
            annotations: [annotation],
            environment: environment,
            attachment: attachment
        )

        let encoded = try JSONEncoder().encode(report)
        let decoded = try JSONDecoder().decode(FeedbackReport.self, from: encoded)

        XCTAssertEqual(decoded, report)
    }

    func testFeedbackReportWithoutScreenshotRoundTripsThroughJSON() throws {
        let environment = FeedbackEnvironment(
            osName: "iOS",
            osVersion: "17.0",
            deviceModel: "iPhone16,2",
            appVersion: "1.0",
            appBuild: "42",
            bundleIdentifier: "com.example.app",
            screenName: "Checkout",
            locale: "en_US",
            screenWidthPoints: 390,
            screenHeightPoints: 844,
            screenScale: 3
        )
        let report = FeedbackReport(
            text: "Prices should support multiple currencies",
            screenshotRawPNG: nil,
            screenshotAnnotatedPNG: nil,
            annotations: [],
            environment: environment
        )

        let encoded = try JSONEncoder().encode(report)
        let decoded = try JSONDecoder().decode(FeedbackReport.self, from: encoded)

        XCTAssertEqual(decoded, report)
        XCTAssertNil(decoded.screenshotRawPNG)
        XCTAssertNil(decoded.screenshotAnnotatedPNG)
    }

    func testHexColorRoundTrip() {
        let color = PlatformColor(hex: "#1A2B3C")
        XCTAssertEqual(color?.hexString, "#1A2B3C")
    }

    func testFeedbackReportWithProductsRoundTripsThroughJSON() throws {
        let environment = FeedbackEnvironment(
            osName: "iOS",
            osVersion: "17.0",
            deviceModel: "iPhone16,2",
            appVersion: "1.0",
            appBuild: "42",
            bundleIdentifier: "com.example.app",
            screenName: "Checkout",
            locale: "en_US",
            screenWidthPoints: 390,
            screenHeightPoints: 844,
            screenScale: 3
        )
        let product1 = FeedbackProduct(key: "ios", name: "iOS App", description: "iOS client", isDefault: true)
        let product2 = FeedbackProduct(key: "backend", name: "Backend API", description: "Supabase edge functions")

        let report = FeedbackReport(
            text: "Cart sync issue",
            screenshotRawPNG: Data([0x01]),
            screenshotAnnotatedPNG: Data([0x02]),
            annotations: [],
            environment: environment,
            products: [product1, product2]
        )

        let encoded = try JSONEncoder().encode(report)
        let decoded = try JSONDecoder().decode(FeedbackReport.self, from: encoded)

        XCTAssertEqual(decoded, report)
        XCTAssertEqual(decoded.products.count, 2)
        XCTAssertEqual(decoded.products[0].key, "ios")
        XCTAssertEqual(decoded.products[0].isDefault, true)
        XCTAssertEqual(decoded.products[1].key, "backend")
    }
}
