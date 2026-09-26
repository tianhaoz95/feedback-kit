import SwiftUI
import AuthenticationServices
import FeedbackKit

public struct LoginView: View {
    @ObservedObject private var client = SupabasePortalClient.shared
    @State private var isTokenSheetPresented = false
    @State private var isSetupHelpPresented = false
    @State private var manualToken = ""
    @State private var manualEmail = ""
    @State private var isAuthenticating = false
    @State private var errorMessage: String? = nil

    // Retain strong reference to prevent premature deallocation by ARC
    @State private var authSession: ASWebAuthenticationSession?

    public var body: some View {
        NavigationStack {
            ScrollView {
                VStack(spacing: 28) {
                    Spacer(minLength: 20)

                    // Authentic FeedbackKit Brand Header
                    VStack(spacing: 16) {
                        FeedbackKitLogoView(size: 92)

                        VStack(spacing: 6) {
                            Text("FeedbackKit")
                                .font(.system(size: 32, weight: .bold, design: .rounded))

                            Text("Developer Portal")
                                .font(.caption.weight(.bold))
                                .foregroundColor(.secondary)
                                .textCase(.uppercase)
                                .tracking(3)
                        }

                        Text("Triage real-time feedback, inspect screenshot annotations, and copy coordinated AI coding prompts on the go.")
                            .font(.subheadline)
                            .foregroundColor(.secondary)
                            .multilineTextAlignment(.center)
                            .padding(.horizontal, 32)
                            .padding(.top, 2)
                    }

                    // Action Buttons
                    VStack(spacing: 12) {
                        // GitHub Sign In
                        Button {
                            signInWithGitHub()
                        } label: {
                            HStack(spacing: 10) {
                                if isAuthenticating {
                                    ProgressView()
                                        .tint(.white)
                                } else {
                                    Image(systemName: "person.badge.key.fill")
                                        .font(.headline)
                                    Text("Continue with GitHub")
                                        .font(.headline)
                                }
                            }
                            .frame(maxWidth: .infinity)
                            .padding(.vertical, 14)
                            .background(Color(red: 23/255.0, green: 23/255.0, blue: 23/255.0))
                            .foregroundColor(.white)
                            .clipShape(RoundedRectangle(cornerRadius: 14, style: .continuous))
                            .shadow(color: Color.black.opacity(0.12), radius: 8, x: 0, y: 4)
                        }
                        .disabled(isAuthenticating)

                        // Demo Mode
                        Button {
                            client.enableDemoMode()
                            UIImpactFeedbackGenerator(style: .medium).impactOccurred()
                        } label: {
                            HStack(spacing: 8) {
                                Image(systemName: "play.circle.fill")
                                    .foregroundColor(.accentColor)
                                Text("Explore in Demo Mode")
                                    .fontWeight(.semibold)
                            }
                            .frame(maxWidth: .infinity)
                            .padding(.vertical, 14)
                            .background(Color(UIColor.secondarySystemBackground))
                            .foregroundColor(.primary)
                            .clipShape(RoundedRectangle(cornerRadius: 14, style: .continuous))
                        }

                        // Manual Token Sign In
                        Button {
                            isTokenSheetPresented = true
                        } label: {
                            Text("Sign In with Access Token")
                                .font(.caption.weight(.semibold))
                                .foregroundColor(.accentColor)
                        }
                        .padding(.top, 4)
                    }
                    .padding(.horizontal, 24)

                    if let err = errorMessage {
                        HStack(spacing: 6) {
                            Image(systemName: "xmark.circle.fill")
                                .foregroundColor(.red)
                            Text(err)
                                .font(.caption)
                                .foregroundColor(.red)
                        }
                        .padding(.horizontal, 24)
                    }

                    Spacer(minLength: 20)

                    // Footer with Supabase Setup Guide
                    VStack(spacing: 8) {
                        Button {
                            isSetupHelpPresented = true
                        } label: {
                            HStack(spacing: 4) {
                                Image(systemName: "questionmark.circle")
                                Text("Supabase & GitHub Setup Guide")
                            }
                            .font(.caption2.weight(.medium))
                            .foregroundColor(.secondary)
                        }
                    }
                    .padding(.bottom, 16)
                }
            }
            .onAppear {
                FeedbackKit.currentScreen = "Login"
            }
            .sheet(isPresented: $isSetupHelpPresented) {
                SupabaseSetupHelpSheet()
            }
            .sheet(isPresented: $isTokenSheetPresented) {
                NavigationStack {
                    Form {
                        Section(header: Text("Manual Token Sign-In"), footer: Text("Paste your Supabase access token (JWT) to authenticate directly without opening a browser window.")) {
                            TextField("Email", text: $manualEmail)
                                .textContentType(.emailAddress)
                                .autocapitalization(.none)

                            SecureField("Supabase Access Token (JWT)", text: $manualToken)
                                .autocapitalization(.none)
                                .disableAutocorrection(true)
                        }
                    }
                    .navigationTitle("Access Token")
                    .navigationBarTitleDisplayMode(.inline)
                    .toolbar {
                        ToolbarItem(placement: .cancellationAction) {
                            Button("Cancel") {
                                isTokenSheetPresented = false
                            }
                        }
                        ToolbarItem(placement: .confirmationAction) {
                            Button("Sign In") {
                                let email = manualEmail.isEmpty ? "developer@example.com" : manualEmail
                                client.signInWithManualToken(token: manualToken, email: email)
                                isTokenSheetPresented = false
                            }
                            .disabled(manualToken.trimmingCharacters(in: .whitespaces).isEmpty)
                            .fontWeight(.semibold)
                        }
                    }
                }
            }
        }
    }

    private func signInWithGitHub() {
        let redirectUrl = "feedbackkit://auth-callback"
        let endpointString = "\(client.supabaseUrl)/auth/v1/authorize?provider=github&redirect_to=\(redirectUrl)"
        guard let authUrl = URL(string: endpointString) else {
            errorMessage = "Invalid auth endpoint: \(endpointString)"
            return
        }

        isAuthenticating = true
        errorMessage = nil

        let session = ASWebAuthenticationSession(
            url: authUrl,
            callbackURLScheme: "feedbackkit"
        ) { callbackURL, error in
            Task { @MainActor in
                self.isAuthenticating = false
                self.authSession = nil

                if let error = error {
                    if (error as? ASWebAuthenticationSessionError)?.code != .canceledLogin {
                        self.errorMessage = error.localizedDescription
                    }
                    return
                }

                guard let callbackURL = callbackURL else { return }
                self.handleAuthCallback(url: callbackURL)
            }
        }

        session.presentationContextProvider = AuthPresentationContextProvider.shared
        session.prefersEphemeralWebBrowserSession = false

        // Store strong reference before calling start()
        self.authSession = session
        let started = session.start()
        if !started {
            isAuthenticating = false
            self.authSession = nil
            errorMessage = "Could not start authentication session. Please check your Supabase URL."
        }
    }

    private func handleAuthCallback(url: URL) {
        var token: String?
        var refresh: String?

        if let fragment = url.fragment {
            let params = fragment.components(separatedBy: "&").reduce(into: [String: String]()) { dict, pair in
                let parts = pair.components(separatedBy: "=")
                if parts.count == 2 {
                    dict[parts[0]] = parts[1]
                }
            }
            token = params["access_token"]
            refresh = params["refresh_token"]
        }

        // Also check query parameters if returned in query
        if token == nil, let components = URLComponents(url: url, resolvingAgainstBaseURL: false) {
            token = components.queryItems?.first(where: { $0.name == "access_token" })?.value
            refresh = components.queryItems?.first(where: { $0.name == "refresh_token" })?.value
        }

        if let token = token {
            let userSession = PortalUserSession.fromJWT(
                accessToken: token,
                refreshToken: refresh ?? ""
            )
            client.signIn(session: userSession)
            UINotificationFeedbackGenerator().notificationOccurred(.success)
        } else {
            errorMessage = "Failed to parse authentication tokens from callback URL: \(url.absoluteString)"
        }
    }
}

// MARK: - Supabase Setup Help Sheet

private struct SupabaseSetupHelpSheet: View {
    @Environment(\.dismiss) private var dismiss

    var body: some View {
        NavigationStack {
            ScrollView {
                VStack(alignment: .leading, spacing: 18) {
                    VStack(alignment: .leading, spacing: 6) {
                        Text("Configuring GitHub OAuth for iOS")
                            .font(.headline)
                        Text("Supabase requires two configuration settings to permit mobile OAuth authentication:")
                            .font(.subheadline)
                            .foregroundColor(.secondary)
                    }

                    // Step 1: Redirect URLs
                    VStack(alignment: .leading, spacing: 8) {
                        HStack(spacing: 8) {
                            Text("1")
                                .font(.caption.bold())
                                .frame(width: 22, height: 22)
                                .background(Color.accentColor)
                                .foregroundColor(.white)
                                .clipShape(Circle())
                            Text("Add Redirect URL in Supabase")
                                .font(.subheadline.weight(.semibold))
                        }

                        Text("In the Supabase Dashboard, navigate to **Authentication > URL Configuration > Redirect URLs** and add:")
                            .font(.caption)
                            .foregroundColor(.secondary)

                        CodeBlockView(code: "feedbackkit://auth-callback", title: "Redirect URL")
                    }

                    // Step 2: GitHub OAuth App
                    VStack(alignment: .leading, spacing: 8) {
                        HStack(spacing: 8) {
                            Text("2")
                                .font(.caption.bold())
                                .frame(width: 22, height: 22)
                                .background(Color.accentColor)
                                .foregroundColor(.white)
                                .clipShape(Circle())
                            Text("Verify GitHub OAuth App Callback")
                                .font(.subheadline.weight(.semibold))
                        }

                        Text("In GitHub (Settings > Developer Settings > OAuth Apps > your app), ensure the **Authorization callback URL** is your Supabase callback:")
                            .font(.caption)
                            .foregroundColor(.secondary)

                        CodeBlockView(code: "https://<your-project-ref>.supabase.co/auth/v1/callback", title: "GitHub Callback")
                    }

                    // Step 3: Server URL
                    VStack(alignment: .leading, spacing: 8) {
                        HStack(spacing: 8) {
                            Text("3")
                                .font(.caption.bold())
                                .frame(width: 22, height: 22)
                                .background(Color.accentColor)
                                .foregroundColor(.white)
                                .clipShape(Circle())
                            Text("Set Supabase API URL in App")
                                .font(.subheadline.weight(.semibold))
                        }

                        Text("In this app's Server Settings, enter your Supabase Project URL (`https://<project-ref>.supabase.co` or `http://127.0.0.1:54321`), NOT the Cloudflare static site URL.")
                            .font(.caption)
                            .foregroundColor(.secondary)
                    }
                }
                .padding(16)
            }
            .navigationTitle("Supabase Setup Guide")
            .navigationBarTitleDisplayMode(.inline)
            .toolbar {
                ToolbarItem(placement: .confirmationAction) {
                    Button("Done") {
                        dismiss()
                    }
                }
            }
        }
    }
}

// MARK: - Presentation Context Provider

private class AuthPresentationContextProvider: NSObject, ASWebAuthenticationPresentationContextProviding {
    static let shared = AuthPresentationContextProvider()

    func presentationAnchor(for session: ASWebAuthenticationSession) -> ASPresentationAnchor {
        #if os(macOS)
        return NSApplication.shared.keyWindow ?? NSApplication.shared.windows.first ?? ASPresentationAnchor()
        #else
        for scene in UIApplication.shared.connectedScenes {
            if let windowScene = scene as? UIWindowScene {
                if let keyWindow = windowScene.windows.first(where: { $0.isKeyWindow }) {
                    return keyWindow
                }
                if let firstWindow = windowScene.windows.first {
                    return firstWindow
                }
            }
        }
        return ASPresentationAnchor()
        #endif
    }
}
