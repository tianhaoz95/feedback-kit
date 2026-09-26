import SwiftUI

/// `feedbackkit://auth-callback#access_token=…&refresh_token=…` — the GitHub
/// OAuth redirect back into the Portal, shared by the iOS and macOS apps.
enum PortalDeepLinks {
    @MainActor
    static func handle(_ url: URL, client: SupabasePortalClient) {
        guard url.scheme == "feedbackkit", url.host == "auth-callback", let fragment = url.fragment else { return }
        let params = fragment.components(separatedBy: "&").reduce(into: [String: String]()) { dict, pair in
            let parts = pair.components(separatedBy: "=")
            if parts.count == 2 {
                dict[parts[0]] = parts[1]
            }
        }
        guard let token = params["access_token"] else { return }
        let userSession = PortalUserSession.fromJWT(
            accessToken: token,
            refreshToken: params["refresh_token"] ?? ""
        )
        client.signIn(session: userSession)
        UINotificationFeedbackGenerator().notificationOccurred(.success)
    }
}
