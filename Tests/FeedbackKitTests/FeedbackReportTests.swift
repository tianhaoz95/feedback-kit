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

    /// The exact `environment`/`annotations` JSON the web SDK (web-sdk/src)
    /// produces — the Developer Portal decodes stored web reports with these
    /// Swift types, so this is the cross-platform contract.
    func testDecodesWebSDKEnvironmentAndAnnotations() throws {
        let environmentJSON = """
        {"osName":"macOS","osVersion":"15.2","deviceModel":"Chrome 141","appVersion":"2.3.0","appBuild":"45",
         "bundleIdentifier":"app.example.com","screenName":"Settings","locale":"en-US","screenWidthPoints":1280,
         "screenHeightPoints":800,"screenScale":2,"platform":"web","pageUrl":"https://app.example.com/settings",
         "userAgent":"Mozilla/5.0","browserName":"Chrome","browserVersion":"141.0.7390.54"}
        """
        let env = try JSONDecoder().decode(FeedbackEnvironment.self, from: Data(environmentJSON.utf8))
        XCTAssertTrue(env.isWeb)
        XCTAssertEqual(env.pageUrl, "https://app.example.com/settings")
        XCTAssertEqual(env.browserName, "Chrome")
        XCTAssertEqual(env.screenWidthPoints, 1280)

        let annotationsJSON = """
        [{"kind":"arrow","points":[[0.1,0.2],[0.3,0.4]],"colorHex":"#FF3B30","scale":1.2,"rotation":0.5},
         {"kind":"text","points":[[0.5,0.5]],"colorHex":"#34C759","label":"here","scale":1,"rotation":0}]
        """
        let annotations = try JSONDecoder().decode([FeedbackAnnotation].self, from: Data(annotationsJSON.utf8))
        XCTAssertEqual(annotations[0].points, [CGPoint(x: 0.1, y: 0.2), CGPoint(x: 0.3, y: 0.4)])
        XCTAssertEqual(annotations[0].scale, 1.2)
        XCTAssertEqual(annotations[1].label, "here")
    }

    /// Native reports never set the web-only fields, and must encode exactly
    /// as before (no `platform`/`pageUrl` keys at all).
    func testNativeEnvironmentOmitsWebFields() throws {
        let env = FeedbackEnvironment(
            osName: "iOS", osVersion: "18.0", deviceModel: "iPhone17,1", appVersion: "1.0", appBuild: "1",
            bundleIdentifier: "com.example", screenName: nil, locale: "en_US",
            screenWidthPoints: 393, screenHeightPoints: 852, screenScale: 3
        )
        let json = try XCTUnwrap(String(data: JSONEncoder().encode(env), encoding: .utf8))
        XCTAssertFalse(env.isWeb)
        XCTAssertFalse(json.contains("platform"))
        XCTAssertFalse(json.contains("pageUrl"))
    }
}
