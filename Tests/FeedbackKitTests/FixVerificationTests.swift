import XCTest
@testable import FeedbackKit

/// The SDK half of the closed loop: build ordering, the reporter-updates wire
/// format (both directions), and the reporter identity attached to reports.
/// Platform-agnostic — the UI (`FixVerificationView`/coordinators) has no
/// test harness here, same as the capture flow.
final class FixVerificationTests: XCTestCase {
    override func tearDown() {
        super.tearDown()
        FeedbackKit.user = nil
    }

    // MARK: - FeedbackBuild (mirrors compare_builds in 0014_closed_loop.sql)

    func testBuildComparison() {
        XCTAssertEqual(FeedbackBuild.compare("42", "42"), .orderedSame)
        XCTAssertEqual(FeedbackBuild.compare("41", "42"), .orderedAscending)
        XCTAssertEqual(FeedbackBuild.compare("1.2.10", "1.2.9"), .orderedDescending)
        XCTAssertEqual(FeedbackBuild.compare("1.2", "1.2.0"), .orderedSame)
        XCTAssertEqual(FeedbackBuild.compare("007", "7"), .orderedSame)
        // UTC-timestamp builds (scripts/release_testflight.sh) and beyond Int64.
        XCTAssertEqual(FeedbackBuild.compare("20260925101010", "20260925101011"), .orderedAscending)
        XCTAssertEqual(FeedbackBuild.compare("99999999999999999999999", "99999999999999999999998"), .orderedDescending)
        XCTAssertNil(FeedbackBuild.compare("abc", "abd"))
        XCTAssertNil(FeedbackBuild.compare("1..2", "1.2"))
        XCTAssertNil(FeedbackBuild.compare(nil, "1"))
        XCTAssertEqual(FeedbackBuild.compare("abc", "abc"), .orderedSame)
    }

    func testIncludesFix() {
        XCTAssertTrue(FeedbackBuild.includesFix(currentBuild: "101", fixedInBuild: "101"))
        XCTAssertTrue(FeedbackBuild.includesFix(currentBuild: "102", fixedInBuild: "101"))
        XCTAssertFalse(FeedbackBuild.includesFix(currentBuild: "100", fixedInBuild: "101"))
        XCTAssertTrue(FeedbackBuild.includesFix(currentBuild: nil, fixedInBuild: "101"))
        XCTAssertTrue(FeedbackBuild.includesFix(currentBuild: "abc", fixedInBuild: "101"))
    }

    // MARK: - reporter-updates wire format

    func testDecodesReporterUpdatesResponse() throws {
        let json = """
        {
          "feedback_id": "0B3C2D1E-0000-4000-8000-000000000001",
          "text": "Checkout button is cut off",
          "created_at": "2026-09-25T10:00:00.123456+00:00",
          "screen_name": "Checkout",
          "fix_stage": "shipped",
          "fixed_in_build": "101",
          "fix_summary": "Added the missing safe-area inset",
          "shipped_at": "2026-09-25T12:00:00+00:00",
          "needs_verification": true,
          "open_question": { "id": "q1", "body": "Landscape too?", "created_at": "2026-09-25T11:00:00+00:00" },
          "screenshot_url": "https://example.com/signed.png?token=abc",
          "messages": [
            { "id": "m1", "kind": "comment", "body": "Found it!", "author": "claude-code", "created_at": "2026-09-25T11:30:00+00:00" }
          ],
          "some_future_field": 1
        }
        """
        let update = try JSONDecoder().decode(FixUpdate.self, from: Data(json.utf8))
        XCTAssertEqual(update.id, "0B3C2D1E-0000-4000-8000-000000000001")
        XCTAssertEqual(update.fixedInBuild, "101")
        XCTAssertEqual(update.fixSummary, "Added the missing safe-area inset")
        XCTAssertTrue(update.needsVerification)
        XCTAssertEqual(update.openQuestion?.body, "Landscape too?")
        XCTAssertEqual(update.screenshotURL?.absoluteString, "https://example.com/signed.png?token=abc")
        XCTAssertEqual(update.messages.first?.author, "claude-code")
    }

    func testDecodesMinimalUpdate() throws {
        let update = try JSONDecoder().decode(FixUpdate.self, from: Data(#"{"feedback_id":"x"}"#.utf8))
        XCTAssertFalse(update.needsVerification)
        XCTAssertNil(update.openQuestion)
        XCTAssertEqual(update.messages, [])
    }

    func testActionPayloadEncoding() throws {
        func encode(_ action: FixUpdatesClient.Action) throws -> [String: Any] {
            let payload = FixUpdatesClient.ActionPayload(
                projectKey: "pk_1", reporterID: "r123", feedbackID: "f1", action: action, build: "101"
            )
            return try JSONSerialization.jsonObject(with: JSONEncoder().encode(payload)) as! [String: Any]
        }

        let verify = try encode(.verify)
        XCTAssertEqual(verify["action"] as? String, "verify")
        XCTAssertEqual(verify["project_key"] as? String, "pk_1")
        XCTAssertEqual(verify["reporter_id"] as? String, "r123")
        XCTAssertEqual(verify["feedback_id"] as? String, "f1")
        XCTAssertEqual(verify["build"] as? String, "101")
        XCTAssertNil(verify["text"])

        let reply = try encode(.reply("iPhone SE"))
        XCTAssertEqual(reply["action"] as? String, "reply")
        XCTAssertEqual(reply["text"] as? String, "iPhone SE")

        let png = Data([0x89, 0x50, 0x4E, 0x47])
        let report = FeedbackReport(
            text: "Still clipped",
            screenshotRawPNG: png,
            screenshotAnnotatedPNG: png,
            annotations: [],
            environment: .init(
                osName: "iOS", osVersion: "26", deviceModel: "iPhone", appVersion: "1", appBuild: "101",
                bundleIdentifier: "x", screenName: nil, locale: "en", screenWidthPoints: 1, screenHeightPoints: 1, screenScale: 1
            )
        )
        let reopen = try encode(.reopen(report))
        XCTAssertEqual(reopen["action"] as? String, "reopen")
        XCTAssertEqual(reopen["text"] as? String, "Still clipped")
        XCTAssertEqual(reopen["screenshot_annotated_png_base64"] as? String, png.base64EncodedString())
        XCTAssertNotNil(reopen["annotations"] as? [Any])

        // Cancelled capture flow: still a reopen, just without details.
        let bare = try encode(.reopen(nil))
        XCTAssertEqual(bare["action"] as? String, "reopen")
        XCTAssertNil(bare["screenshot_annotated_png_base64"])
    }

    func testReporterUpdatesURLDerivesFromIngestEndpoint() {
        let config = FeedbackKitConfiguration(
            endpointURL: URL(string: "https://abc.supabase.co/functions/v1/ingest-feedback")!,
            projectKey: "pk"
        )
        XCTAssertEqual(config.resolvedReporterUpdatesURL.absoluteString, "https://abc.supabase.co/functions/v1/reporter-updates")

        let custom = FeedbackKitConfiguration(
            endpointURL: URL(string: "https://example.com/ingest")!,
            projectKey: "pk",
            reporterUpdatesURL: URL(string: "https://example.com/updates")!
        )
        XCTAssertEqual(custom.resolvedReporterUpdatesURL.absoluteString, "https://example.com/updates")
    }

    // MARK: - Reporter identity on the ingest payload

    func testReporterIDIsStableAndServerValid() {
        let id = FeedbackKit.reporterID
        XCTAssertEqual(id, FeedbackKit.reporterID)
        XCTAssertTrue(FeedbackReporterIdentity.isValid(id))
        XCTAssertFalse(FeedbackReporterIdentity.isValid("short"))
        XCTAssertFalse(FeedbackReporterIdentity.isValid(String(repeating: "a", count: 20) + "/"))
    }

    func testIngestPayloadCarriesReporter() throws {
        let report = FeedbackReport(
            text: "x",
            screenshotRawPNG: nil,
            screenshotAnnotatedPNG: nil,
            annotations: [],
            environment: .init(
                osName: "iOS", osVersion: "26", deviceModel: "iPhone", appVersion: "1", appBuild: "1",
                bundleIdentifier: "x", screenName: nil, locale: "en", screenWidthPoints: 1, screenHeightPoints: 1, screenScale: 1
            )
        )
        let withUser = IngestPayload(
            report: report, projectKey: "pk", reporterID: "abcdefabcdefabcdef", reporter: FeedbackUser(email: "a@b.c")
        )
        let json = try JSONSerialization.jsonObject(with: IngestPayload.encoder.encode(withUser)) as! [String: Any]
        XCTAssertEqual(json["reporter_id"] as? String, "abcdefabcdefabcdef")
        XCTAssertEqual((json["reporter"] as? [String: Any])?["email"] as? String, "a@b.c")

        let anonymous = IngestPayload(report: report, projectKey: "pk", reporterID: nil, reporter: nil)
        let bare = try JSONSerialization.jsonObject(with: IngestPayload.encoder.encode(anonymous)) as! [String: Any]
        XCTAssertNil(bare["reporter_id"])
        XCTAssertNil(bare["reporter"])
    }
}
