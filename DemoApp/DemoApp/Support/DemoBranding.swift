import FeedbackKit
import SwiftUI

/// The brand presets shown in Settings > Branding — showcases
/// `FeedbackKit.theme` by letting the user swap the feedback screen's accent
/// colors live. No restart needed: `FeedbackKit.present`/`presentAndSubmit`
/// read `FeedbackKit.theme` fresh every time they're called, so setting it
/// from a picker's selection works the same as setting it once at launch.
enum DemoBranding: String, CaseIterable, Identifiable {
    case system
    case sunset
    case ocean
    case forest

    /// `UserDefaults` key the picker's selection persists under (and
    /// `FeedbackKitDemoApp.init()` reads at launch) — shared here so both
    /// sides can't drift apart.
    static let storageKey = "com.feedbackkit.demo.branding"

    /// The branding selected on a previous launch (via Settings), or
    /// `.sunset` — this demo's own brand — the first time the app runs.
    static var current: DemoBranding {
        UserDefaults.standard.string(forKey: storageKey).flatMap(DemoBranding.init(rawValue:)) ?? .sunset
    }

    var id: String { rawValue }

    var displayName: String {
        switch self {
        case .system: "System Blue"
        case .sunset: "Sunset"
        case .ocean: "Ocean"
        case .forest: "Forest"
        }
    }

    /// `nil` for `.system` — that's FeedbackKit's own built-in default
    /// (`.systemBlue`/`.controlAccentColor`), not a color this demo picks.
    var theme: FeedbackTheme? {
        switch self {
        case .system: nil
        case .sunset: .init(primaryColorHex: "#7C3AED", secondaryColorHex: "#F97316")
        case .ocean: .init(primaryColorHex: "#0EA5E9", secondaryColorHex: "#14B8A6")
        case .forest: .init(primaryColorHex: "#16A34A", secondaryColorHex: "#CA8A04")
        }
    }

    var primarySwatch: Color { theme.map { Color(hex: $0.primaryColorHex) } ?? .blue }
    var secondarySwatch: Color { theme.map { Color(hex: $0.secondaryColorHex) } ?? .gray }
}

private extension Color {
    /// A tiny hex parser for the picker's own preview swatches only —
    /// FeedbackKit's hex-to-color conversion (`PlatformColor.init(hex:)`) is
    /// internal to the SDK module, so this demo (a separate module/app
    /// target) needs its own rather than reaching into FeedbackKit for it.
    init(hex: String) {
        let sanitized = hex.trimmingCharacters(in: .whitespacesAndNewlines).replacingOccurrences(of: "#", with: "")
        let rgb = UInt64(sanitized, radix: 16) ?? 0
        self.init(
            red: Double((rgb & 0xFF0000) >> 16) / 255,
            green: Double((rgb & 0x00FF00) >> 8) / 255,
            blue: Double(rgb & 0x0000FF) / 255
        )
    }
}
