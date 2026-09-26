import Foundation
import FeedbackKit
#if os(macOS)
import AppKit
#endif

/// The Portal dogfoods FeedbackKit: problems with the Portal itself are
/// reported through the FeedbackKit SDK (iOS: shake; macOS: Help › Report a
/// Problem… and an optional floating button) into the FeedbackKit team's own
/// hosted project — the same project the web dashboard reports into, so the
/// team triages all three surfaces in one inbox, from the Portal itself.
/// Fixes come back through the closed loop: `enableFixVerification` asks
/// whoever reported a problem to confirm the fix once the build that
/// contains it is running (see DESIGN.md §7).
///
/// Each app reports under its own product key so the inbox can filter by
/// surface, and the signed-in developer is attached as `FeedbackKit.user`
/// so the team can follow up.
enum PortalDogfood {
    static let endpoint = URL(string: "https://gpucoladcyvijefdjudf.supabase.co/functions/v1/ingest-feedback")!
    static let projectKey = "pk_cde764e9b97ba261cdd084e7e3e4cf04ce31"

    #if os(macOS)
    static let product = FeedbackProduct(
        key: "developer-portal-macos",
        name: "Developer Portal (macOS)",
        description: "The FeedbackKit Developer Portal Mac app (DeveloperApp/, FeedbackPortalMac target — SwiftUI sharing the iOS Portal's views).",
        isDefault: true
    )
    static let floatingButtonDefaultsKey = "portal_floating_feedback_button_enabled"
    #else
    static let product = FeedbackProduct(
        key: "developer-portal-ios",
        name: "Developer Portal (iOS)",
        description: "The FeedbackKit Developer Portal iOS app (DeveloperApp/, FeedbackPortal target — SwiftUI).",
        isDefault: true
    )
    #endif

    static func configure() {
        FeedbackKit.configure(.init(
            endpointURL: endpoint,
            projectKey: projectKey,
            products: [product],
            defaultProductKey: product.key
        ))
        #if os(macOS)
        UserDefaults.standard.register(defaults: [floatingButtonDefaultsKey: false])
        #endif
    }

    /// Attach the signed-in developer to reports (nil when signed out / demo).
    static func updateUser(_ session: PortalUserSession?) {
        guard let session, !session.userId.isEmpty, session.userId != "demo_user" else {
            FeedbackKit.user = nil
            return
        }
        FeedbackKit.user = FeedbackUser(
            id: session.userId,
            email: session.email.isEmpty ? nil : session.email,
            name: session.githubUsername
        )
    }

    #if os(macOS)
    /// Presents the capture → annotate → send flow on the key window.
    static func reportProblem() {
        FeedbackKit.presentAndSubmitIfConfigured(from: NSApplication.shared.keyWindow ?? NSApplication.shared.mainWindow)
    }

    static func applyFloatingButtonPreference() {
        if UserDefaults.standard.bool(forKey: floatingButtonDefaultsKey) {
            FeedbackKit.showFloatingTriggerButton {
                NSApplication.shared.keyWindow ?? NSApplication.shared.mainWindow
            }
        } else {
            FeedbackKit.hideFloatingTriggerButton()
        }
    }
    #endif
}
