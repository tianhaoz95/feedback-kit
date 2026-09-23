import XCTest
@testable import FeedbackKit

final class FeedbackKitConfigurationTests: XCTestCase {
    override func tearDown() {
        super.tearDown()
        FeedbackKit.configure(nil)
    }

    func testConfigurationLifecycle() {
        FeedbackKit.configure(nil)
        XCTAssertFalse(FeedbackKit.isConfigured)
        XCTAssertNil(FeedbackKit.currentConfiguration)

        let endpoint = URL(string: "https://example.com/functions/v1/ingest-feedback")!
        let config = FeedbackKitConfiguration(endpointURL: endpoint, projectKey: "pk_test_123")
        FeedbackKit.configure(config)

        XCTAssertTrue(FeedbackKit.isConfigured)
        XCTAssertEqual(FeedbackKit.currentConfiguration?.endpointURL, endpoint)
        XCTAssertEqual(FeedbackKit.currentConfiguration?.projectKey, "pk_test_123")

        FeedbackKit.configure(nil)
        XCTAssertFalse(FeedbackKit.isConfigured)
        XCTAssertNil(FeedbackKit.currentConfiguration)
    }

    func testSubmissionErrorDescriptions() {
        let notConfigured = FeedbackSubmissionError.notConfigured
        XCTAssertTrue(notConfigured.localizedDescription.contains("not configured"))

        let server401 = FeedbackSubmissionError.server(statusCode: 401)
        XCTAssertTrue(server401.localizedDescription.contains("401"))
        XCTAssertTrue(server401.localizedDescription.contains("API key"))

        let server500 = FeedbackSubmissionError.server(statusCode: 500)
        XCTAssertTrue(server500.localizedDescription.contains("500"))
    }
}
