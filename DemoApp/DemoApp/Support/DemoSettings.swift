import FeedbackKit
import Foundation
import SwiftUI

/// Shared configuration store for FeedbackKit Demo apps on iOS and macOS.
///
/// Allows users to enter their Project API Key (e.g. `pk_...`) from their
/// web portal in Settings to test submitting real feedback reports directly
/// to their dashboard before integrating the SDK into their own application.
public final class DemoSettings: ObservableObject {
    public static let shared = DemoSettings()

    /// The default hosted ingestion endpoint for FeedbackKit.
    public static let defaultEndpoint = "https://gpucoladcyvijefdjudf.supabase.co/functions/v1/ingest-feedback"

    public static let apiKeyStorageKey = "com.feedbackkit.demo.apiKey"
    public static let endpointStorageKey = "com.feedbackkit.demo.endpointURL"

    @Published public var apiKey: String {
        didSet {
            UserDefaults.standard.set(apiKey, forKey: Self.apiKeyStorageKey)
            applyConfiguration()
        }
    }

    @Published public var endpointURL: String {
        didSet {
            UserDefaults.standard.set(endpointURL, forKey: Self.endpointStorageKey)
            applyConfiguration()
        }
    }

    /// Whether a non-empty API key is configured.
    public var isConfigured: Bool {
        !trimmedApiKey.isEmpty
    }

    public var trimmedApiKey: String {
        apiKey.trimmingCharacters(in: .whitespacesAndNewlines)
    }

    public var trimmedEndpointURL: String {
        endpointURL.trimmingCharacters(in: .whitespacesAndNewlines)
    }

    public var isCustomEndpoint: Bool {
        let trimmed = trimmedEndpointURL
        return !trimmed.isEmpty && trimmed != Self.defaultEndpoint
    }

    public var effectiveEndpointURL: URL? {
        let trimmed = trimmedEndpointURL
        let raw = trimmed.isEmpty ? Self.defaultEndpoint : trimmed
        return URL(string: raw)
    }

    private init() {
        let savedKey = UserDefaults.standard.string(forKey: Self.apiKeyStorageKey) ?? ""
        let savedEndpoint = UserDefaults.standard.string(forKey: Self.endpointStorageKey) ?? Self.defaultEndpoint
        self.apiKey = savedKey
        self.endpointURL = savedEndpoint
        applyConfiguration()
    }

    /// Syncs the current settings into `FeedbackKit.configure`.
    public func applyConfiguration() {
        let key = trimmedApiKey
        guard !key.isEmpty, let url = effectiveEndpointURL else {
            FeedbackKit.configure(nil)
            return
        }

        FeedbackKit.configure(FeedbackKitConfiguration(
            endpointURL: url,
            projectKey: key
        ))
    }

    /// Resets the endpoint URL to the hosted default.
    public func resetEndpointToDefault() {
        endpointURL = Self.defaultEndpoint
    }

    /// Clears the API key, returning the demo app to unconfigured local mode.
    public func clearApiKey() {
        apiKey = ""
    }
}
