import Foundation

/// The anonymous, random, per-install id the SDK attaches to every report it
/// submits (`reporter_id` on the wire, see 0014_closed_loop.sql). It's what
/// lets `FeedbackKit.checkForFixUpdates` find *this device's* reports later
/// — possessing it is the capability, the same way the project key is the
/// capability to create reports — so it's random (not derived from anything
/// about the device or user) and never leaves the app except to FeedbackKit's
/// own endpoints.
///
/// Stored in `UserDefaults`, so it lasts as long as the install: deleting and
/// reinstalling the app starts a fresh identity, which just means reports
/// filed before that won't prompt for verification afterwards.
enum FeedbackReporterIdentity {
    private static let defaultsKey = "com.feedbackkit.reporterID"
    private static let lock = NSLock()

    static var current: String {
        lock.lock()
        defer { lock.unlock() }
        let defaults = UserDefaults.standard
        if let existing = defaults.string(forKey: defaultsKey), isValid(existing) {
            return existing
        }
        let fresh = UUID().uuidString.replacingOccurrences(of: "-", with: "").lowercased()
        defaults.set(fresh, forKey: defaultsKey)
        return fresh
    }

    /// Same shape the server accepts (supabase/functions/_shared/reporter.ts).
    static func isValid(_ id: String) -> Bool {
        (16...128).contains(id.count) && id.allSatisfy { $0.isASCII && ($0.isLetter || $0.isNumber || $0 == "_" || $0 == "-") }
    }

    /// The running app's build (`CFBundleVersion`), compared against the
    /// build a fix shipped in.
    static var currentBuild: String? {
        Bundle.main.infoDictionary?["CFBundleVersion"] as? String
    }
}
