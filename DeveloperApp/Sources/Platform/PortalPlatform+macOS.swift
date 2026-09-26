#if os(macOS)
import AppKit
import SwiftUI

// The Portal's views were written for iOS. Rather than fork ~20 views for the
// macOS app (FeedbackPortalMac), this file gives the handful of UIKit and
// iOS-only SwiftUI names they use an AppKit/macOS meaning, so the exact same
// view code compiles on both — the same idea as the SDK's PlatformTypes.swift.
// Everything here is macOS-only; on iOS the real UIKit/SwiftUI APIs are used.
//
// If you add a new iOS-only API to a shared view, either give it a macOS
// meaning here or wrap the call site in `#if os(iOS)`.

// MARK: - Colors

/// `Color(UIColor.secondarySystemBackground)` etc. resolve to the nearest
/// AppKit semantic color, so light/dark mode keeps working.
typealias UIColor = NSColor

extension NSColor {
    static var systemBackground: NSColor { .windowBackgroundColor }
    static var secondarySystemBackground: NSColor { .controlBackgroundColor }
    static var secondarySystemGroupedBackground: NSColor { .controlBackgroundColor }
    static var label: NSColor { .labelColor }
    static var secondaryLabel: NSColor { .secondaryLabelColor }
    static var separator: NSColor { .separatorColor }
    // secondarySystemFill / tertiarySystemFill exist natively on macOS 14+.
}

// MARK: - Haptics

/// Macs have no taptic feedback for UI confirmations like these (the trackpad's
/// is reserved for alignment/level changes), so these are deliberate no-ops.
final class UIImpactFeedbackGenerator {
    enum FeedbackStyle { case light, medium, heavy, soft, rigid }
    init(style: FeedbackStyle = .medium) {}
    func impactOccurred() {}
}

final class UINotificationFeedbackGenerator {
    enum FeedbackType { case success, warning, error }
    init() {}
    func notificationOccurred(_ type: FeedbackType) {}
}

// MARK: - Pasteboard

final class UIPasteboard {
    static let general = UIPasteboard()

    var string: String? {
        get { NSPasteboard.general.string(forType: .string) }
        set {
            NSPasteboard.general.clearContents()
            if let newValue { NSPasteboard.general.setString(newValue, forType: .string) }
        }
    }
}

// MARK: - Hosting

/// Lets the shared unit tests (Tests/PortalTests.swift) host views the same
/// way on both platforms.
typealias UIHostingController = NSHostingController

// MARK: - iOS-only SwiftUI modifiers and placements

enum PortalTitleDisplayMode { case automatic, inline, large }
enum PortalAutocapitalization { case none, words, sentences, allCharacters }

extension View {
    /// macOS windows have no large/inline navigation-bar title distinction.
    func navigationBarTitleDisplayMode(_ mode: PortalTitleDisplayMode) -> some View { self }

    /// macOS text fields never auto-capitalize.
    func autocapitalization(_ style: PortalAutocapitalization) -> some View { self }

    /// There's no full-screen cover on macOS; a sheet is the native equivalent.
    func fullScreenCover<Content: View>(
        isPresented: Binding<Bool>,
        onDismiss: (() -> Void)? = nil,
        @ViewBuilder content: @escaping () -> Content
    ) -> some View {
        sheet(isPresented: isPresented, onDismiss: onDismiss) {
            content().frame(minWidth: 720, minHeight: 560)
        }
    }
}

extension ToolbarItemPlacement {
    static var topBarTrailing: ToolbarItemPlacement { .primaryAction }
    static var topBarLeading: ToolbarItemPlacement { .navigation }
}

extension ListStyle where Self == InsetListStyle {
    static var insetGrouped: InsetListStyle { .inset }
}

enum PortalSearchDrawerDisplayMode { case always, automatic }

extension SearchFieldPlacement {
    static func navigationBarDrawer(displayMode: PortalSearchDrawerDisplayMode) -> SearchFieldPlacement { .automatic }
}
#endif
