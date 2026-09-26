import SwiftUI
import UserNotifications
#if os(macOS)
import AppKit
#endif

/// The unread-notification count on the app icon: the home-screen badge on
/// iOS, the Dock badge on macOS.
enum PortalBadge {
    @MainActor
    static func set(_ count: Int) {
        #if os(iOS)
        UNUserNotificationCenter.current().setBadgeCount(max(0, count)) { _ in }
        #elseif os(macOS)
        NSApplication.shared.dockTile.badgeLabel = count > 0 ? String(count) : nil
        #endif
    }
}

#if os(iOS)
import UIKit

/// Push notifications for the iOS Portal (0017_notifications.sql +
/// supabase/functions/send-push). The app registers its APNs device token
/// with `register_push_device` whenever it's signed in and allowed to notify;
/// the server sends one push per notification row once an APNs key is
/// configured, and nothing before that. Tapping a push opens the report.
@MainActor
final class PortalPushNotifications: NSObject, ObservableObject {
    static let shared = PortalPushNotifications()

    @Published private(set) var authorizationStatus: UNAuthorizationStatus = .notDetermined

    private static let tokenKey = "portal_push_device_token"

    /// Which APNs gateway issued this build's tokens: Xcode (Debug) builds are
    /// signed for development and get sandbox tokens; TestFlight and App Store
    /// builds get production ones.
    static var apnsEnvironment: String {
        #if DEBUG
        return "sandbox"
        #else
        return "production"
        #endif
    }

    func configure() {
        UNUserNotificationCenter.current().delegate = self
        Task { await registerIfAuthorized() }
    }

    func refreshAuthorizationStatus() async {
        authorizationStatus = await UNUserNotificationCenter.current().notificationSettings().authorizationStatus
    }

    /// Re-registers on every launch/sign-in (tokens can change) without prompting.
    func registerIfAuthorized() async {
        await refreshAuthorizationStatus()
        if authorizationStatus == .authorized || authorizationStatus == .provisional {
            UIApplication.shared.registerForRemoteNotifications()
        }
    }

    /// Shows the system permission prompt (from the Activity screen's card).
    @discardableResult
    func requestPermission() async -> Bool {
        let granted = (try? await UNUserNotificationCenter.current().requestAuthorization(options: [.alert, .badge, .sound])) ?? false
        await refreshAuthorizationStatus()
        if granted { UIApplication.shared.registerForRemoteNotifications() }
        return granted
    }

    func didRegister(deviceToken: Data) {
        let token = deviceToken.map { String(format: "%02x", $0) }.joined()
        UserDefaults.standard.set(token, forKey: Self.tokenKey)
        let client = SupabasePortalClient.shared
        guard client.currentSession != nil, !client.isDemoMode else { return }
        Task {
            try? await client.registerPushDevice(
                token: token,
                environment: Self.apnsEnvironment,
                bundleId: Bundle.main.bundleIdentifier
            )
        }
    }

    /// Stops pushes to this device for the account that's signing out.
    func signOut() async {
        guard let token = UserDefaults.standard.string(forKey: Self.tokenKey) else { return }
        await SupabasePortalClient.shared.unregisterPushDevice(token: token)
    }
}

extension PortalPushNotifications: UNUserNotificationCenterDelegate {
    nonisolated func userNotificationCenter(
        _ center: UNUserNotificationCenter,
        willPresent notification: UNNotification
    ) async -> UNNotificationPresentationOptions {
        await AppState.shared.loadNotifications()
        return [.banner, .list, .sound, .badge]
    }

    nonisolated func userNotificationCenter(
        _ center: UNUserNotificationCenter,
        didReceive response: UNNotificationResponse
    ) async {
        let info = response.notification.request.content.userInfo
        let notificationId = info["notification_id"] as? String
        let feedbackId = info["feedback_id"] as? String
        await AppState.shared.openFromPush(notificationId: notificationId, feedbackId: feedbackId)
    }
}

/// UIKit entry points SwiftUI doesn't expose: the APNs token callbacks.
@MainActor
final class PortalAppDelegate: NSObject, UIApplicationDelegate {
    func application(
        _ application: UIApplication,
        didFinishLaunchingWithOptions launchOptions: [UIApplication.LaunchOptionsKey: Any]? = nil
    ) -> Bool {
        PortalPushNotifications.shared.configure()
        return true
    }

    func application(_ application: UIApplication, didRegisterForRemoteNotificationsWithDeviceToken deviceToken: Data) {
        PortalPushNotifications.shared.didRegister(deviceToken: deviceToken)
    }

    func application(_ application: UIApplication, didFailToRegisterForRemoteNotificationsWithError error: Error) {
        // Simulators without push support and builds without the entitlement
        // end up here; the in-app Activity list still works.
        print("Push registration failed: \(error.localizedDescription)")
    }
}
#endif
