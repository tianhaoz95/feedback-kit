import XCTest
@testable import FeedbackKit

/// `FeedbackKitBridge` is the shape the Flutter plugin and React Native module
/// hand to Dart/JS, mirrored by `FeedbackKitBridge` in the Android SDK.
final class FeedbackKitBridgeTests: XCTestCase {
    private func makeReport() -> FeedbackReport {
        FeedbackReport(
            id: UUID(uuidString: "E6C0A31A-745B-4234-9A20-F037EAF8E5A0")!,
            createdAt: Date(timeIntervalSince1970: 1_790_000_000),
            text: "Broken",
            screenshotRawPNG: Data([1, 2, 3]),
            screenshotAnnotatedPNG: nil,
            annotations: [FeedbackAnnotation(kind: .arrow, points: [CGPoint(x: 0.1, y: 0.2), CGPoint(x: 0.5, y: 0.75)], colorHex: "#FF3B30")],
            environment: FeedbackEnvironment(
                osName: "iOS", osVersion: "18.0", deviceModel: "iPhone16,2", appVersion: "1.0", appBuild: "1",
                bundleIdentifier: "com.example", screenName: nil, locale: "en_US",
                screenWidthPoints: 393, screenHeightPoints: 852, screenScale: 3
            ),
            attachment: FeedbackAttachment(filename: "log.txt", mimeType: "text/plain", data: Data("hi".utf8)),
            products: [FeedbackProduct(key: "ios", name: "iOS App", isDefault: true)],
            notifyReporter: true
        )
    }

    func testReportDictionary() {
        let map = FeedbackKitBridge.dictionary(from: makeReport()) { $0.base64EncodedString() }
        XCTAssertEqual(map["id"] as? String, "E6C0A31A-745B-4234-9A20-F037EAF8E5A0")
        XCTAssertEqual(map["createdAt"] as? String, "2026-09-21T14:13:20Z")
        XCTAssertEqual(map["screenshotRawPng"] as? String, "AQID")
        XCTAssertNil(map["screenshotAnnotatedPng"])
        XCTAssertEqual(map["notifyReporter"] as? Bool, true)
        let annotation = (map["annotations"] as? [[String: Any]])?.first
        XCTAssertEqual(annotation?["kind"] as? String, "arrow")
        XCTAssertEqual((annotation?["points"] as? [[Double]])?.last, [0.5, 0.75])
        XCTAssertNil(annotation?["label"])
        let environment = map["environment"] as? [String: Any]
        XCTAssertEqual(environment?["osName"] as? String, "iOS")
        XCTAssertNil(environment?["screenName"])
        XCTAssertEqual((map["attachment"] as? [String: Any])?["data"] as? String, "aGk=")
        XCTAssertEqual((map["products"] as? [[String: Any]])?.first?["isDefault"] as? Bool, true)
    }

    func testSubmissionResultDictionary() {
        let failure = FeedbackKitBridge.dictionary(from: .failure(.server(statusCode: 402))) { $0 }
        XCTAssertEqual(failure["status"] as? String, "failure")
        XCTAssertNotNil(failure["error"] as? String)
        let success = FeedbackKitBridge.dictionary(from: .success(makeReport())) { $0 }
        XCTAssertEqual(success["status"] as? String, "success")
    }

    func testConfigurationThemeAndUserFromDictionaries() {
        let configuration = FeedbackKitBridge.configuration(from: [
            "endpointUrl": " https://x.supabase.co/functions/v1/ingest-feedback ",
            "projectKey": "pk_test",
            "products": [["key": "flutter", "name": "Flutter App", "isDefault": true]],
            "defaultProductKey": "flutter",
        ])
        XCTAssertEqual(configuration?.projectKey, "pk_test")
        XCTAssertEqual(configuration?.endpointURL.absoluteString, "https://x.supabase.co/functions/v1/ingest-feedback")
        XCTAssertEqual(configuration?.products.first?.isDefault, true)
        XCTAssertEqual(configuration?.defaultProductKey, "flutter")
        XCTAssertNil(FeedbackKitBridge.configuration(from: ["endpointUrl": "https://x", "projectKey": " "]))
        XCTAssertNil(FeedbackKitBridge.configuration(from: nil))

        XCTAssertEqual(
            FeedbackKitBridge.theme(from: ["primaryColorHex": "#7C3AED", "secondaryColorHex": "#F97316"]),
            FeedbackTheme(primaryColorHex: "#7C3AED", secondaryColorHex: "#F97316")
        )
        XCTAssertNil(FeedbackKitBridge.theme(from: ["primaryColorHex": "#7C3AED"]))
        XCTAssertEqual(FeedbackKitBridge.user(from: ["email": "a@b.c"]), FeedbackUser(email: "a@b.c"))
        XCTAssertNil(FeedbackKitBridge.user(from: [:]))
    }
}
