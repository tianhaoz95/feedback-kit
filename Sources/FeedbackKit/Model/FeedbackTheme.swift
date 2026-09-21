import Foundation

/// Customizes the feedback capture screen's accent colors to match the host
/// app's branding. Set `FeedbackKit.theme` any time before
/// `present(from:)`/`presentAndSubmit(from:)` (or before presenting
/// `FeedbackQuickNoteView` on watchOS); leaving it `nil` (the default) keeps
/// the system accent color (`.systemBlue` on iOS/watchOS, `.controlAccentColor`
/// on macOS) exactly as before.
///
/// Colors are hex strings rather than `UIColor`/`NSColor` so this one struct
/// is `Sendable` and works unmodified across all three platforms — see
/// `PlatformColor.init(hex:)` in `PlatformTypes.swift` for the shared
/// conversion the UI layer uses to apply it.
public struct FeedbackTheme: Sendable, Equatable {
    /// The flow's main call-to-action color: the send button, the selected
    /// annotation tool, and the screenshot toggle's "on" tint. Hex string,
    /// e.g. `"#7C3AED"`.
    public var primaryColorHex: String
    /// A secondary accent for less prominent controls: Cancel and the
    /// attach button. Hex string.
    public var secondaryColorHex: String

    public init(primaryColorHex: String, secondaryColorHex: String) {
        self.primaryColorHex = primaryColorHex
        self.secondaryColorHex = secondaryColorHex
    }
}
