import SwiftUI
import FeedbackKit

public struct SettingsView: View {
    @ObservedObject private var client = SupabasePortalClient.shared
    @EnvironmentObject private var appState: AppState
    @State private var showSignOutConfirmation = false

    private var appVersionText: String {
        let version = Bundle.main.infoDictionary?["CFBundleShortVersionString"] as? String ?? "1.0"
        let build = Bundle.main.infoDictionary?["CFBundleVersion"] as? String ?? "1"
        return "Version \(version) (Build \(build))"
    }

    public var body: some View {
        NavigationStack {
            List {
                // Account Section
                Section(header: Text("Account & Session")) {
                    HStack(spacing: 12) {
                        if let avatarUrl = client.currentSession?.avatarUrl, let url = URL(string: avatarUrl) {
                            AsyncImage(url: url) { phase in
                                switch phase {
                                case .success(let image):
                                    image
                                        .resizable()
                                        .scaledToFill()
                                case .empty:
                                    ProgressView()
                                        .scaleEffect(0.8)
                                case .failure:
                                    Image(systemName: "person.crop.circle.fill")
                                        .resizable()
                                        .foregroundColor(.accentColor)
                                @unknown default:
                                    Image(systemName: "person.crop.circle.fill")
                                        .resizable()
                                        .foregroundColor(.accentColor)
                                }
                            }
                            .frame(width: 44, height: 44)
                            .clipShape(Circle())
                            .overlay(Circle().stroke(Color(UIColor.separator), lineWidth: 0.5))
                        } else {
                            Image(systemName: "person.crop.circle.fill")
                                .font(.system(size: 44))
                                .foregroundColor(.accentColor)
                        }

                        VStack(alignment: .leading, spacing: 3) {
                            if let username = client.currentSession?.githubUsername, !username.isEmpty {
                                Text(username)
                                    .font(.headline)
                                Text(client.currentSession?.email ?? (client.isDemoMode ? "demo@feedbackkit.dev" : "Connected via GitHub"))
                                    .font(.caption2)
                                    .foregroundColor(.secondary)
                            } else {
                                Text(client.currentSession?.email ?? (client.isDemoMode ? "Demo Developer" : "Authenticated User"))
                                    .font(.headline)
                                Text(client.isDemoMode ? "Offline Demo Environment" : "Connected to Supabase")
                                    .font(.caption2)
                                    .foregroundColor(.secondary)
                            }
                        }
                    }
                    .padding(.vertical, 4)
                }

                // Team
                Section(header: Text("Team")) {
                    NavigationLink(destination: TeamView()) {
                        HStack(spacing: 12) {
                            Image(systemName: "person.2.fill")
                                .foregroundColor(.accentColor)
                            VStack(alignment: .leading, spacing: 2) {
                                Text(appState.currentOrganization?.name ?? "Team & Organizations")
                                    .font(.body)
                                Text("Members, invitations and switching organizations")
                                    .font(.caption2)
                                    .foregroundColor(.secondary)
                            }
                        }
                    }
                }

                #if os(iOS)
                Section(
                    header: Text("Notifications"),
                    footer: Text("Which events notify you is set per account in the web dashboard (Notifications), and applies to push, the Activity tab and the browser alike.")
                ) {
                    Button {
                        if let url = URL(string: UIApplication.openSettingsURLString) {
                            UIApplication.shared.open(url)
                        }
                    } label: {
                        HStack(spacing: 12) {
                            Image(systemName: "bell.badge.fill")
                                .foregroundColor(.accentColor)
                            Text("Notification Settings")
                                .foregroundColor(.primary)
                        }
                    }
                }
                #endif

                // Backend Configuration
                Section(header: Text("Backend")) {
                    NavigationLink(destination: BackendConfigView()) {
                        HStack(spacing: 12) {
                            Image(systemName: "server.rack")
                                .foregroundColor(.accentColor)
                            VStack(alignment: .leading, spacing: 2) {
                                Text("Backend Configuration")
                                    .font(.body)
                                Text("Server URL, environment, and API keys")
                                    .font(.caption2)
                                    .foregroundColor(.secondary)
                            }
                        }
                    }
                }

                // CLI & AI Coding Agents
                Section(header: Text("CLI & Coding Agents")) {
                    NavigationLink(destination: CliSessionsListView()) {
                        HStack(spacing: 12) {
                            Image(systemName: "terminal.fill")
                                .foregroundColor(.accentColor)
                            VStack(alignment: .leading, spacing: 2) {
                                Text("CLI Sessions")
                                    .font(.body)
                                Text("Authorized machine tokens for feedbackkit mcp")
                                    .font(.caption2)
                                    .foregroundColor(.secondary)
                            }
                        }
                    }
                }

                // Cache & Diagnostics
                Section(header: Text("Data & Cache")) {
                    if client.isDemoMode {
                        Button("Reset Demo Data") {
                            client.enableDemoMode()
                            Task {
                                await appState.loadProjects()
                            }
                            UINotificationFeedbackGenerator().notificationOccurred(.success)
                        }
                    }

                    Button("Clear Image & Network Cache") {
                        client.clearCache()
                        URLCache.shared.removeAllCachedResponses()
                        UINotificationFeedbackGenerator().notificationOccurred(.success)
                    }
                }

                // Portal App Feedback
                #if os(macOS)
                // The Mac Portal reports problems about itself through
                // FeedbackKit's own macOS SDK (see FeedbackPortalMacApp).
                Section(
                    header: Text("Feedback"),
                    footer: Text("Use Help › Report a Problem… (⇧⌘R) anywhere in the Portal to capture this window, annotate it, and send it to the FeedbackKit team. When a fix ships, the Portal asks you to confirm it.")
                ) {
                    Toggle("Show Floating Feedback Button", isOn: Binding(
                        get: { UserDefaults.standard.bool(forKey: PortalDogfood.floatingButtonDefaultsKey) },
                        set: { isEnabled in
                            UserDefaults.standard.set(isEnabled, forKey: PortalDogfood.floatingButtonDefaultsKey)
                            PortalDogfood.applyFloatingButtonPreference()
                        }
                    ))
                    Button("Report a Problem…") {
                        PortalDogfood.reportProblem()
                    }
                }
                #else
                Section(
                    header: Text("Feedback"),
                    footer: Text("Shake your device anywhere in the app to capture a screenshot, annotate it, and share feedback.")
                ) {
                    Toggle("Shake to Share Feedback", isOn: Binding(
                        get: { UserDefaults.standard.bool(forKey: "shake_to_feedback_enabled") },
                        set: { isEnabled in
                            UserDefaults.standard.set(isEnabled, forKey: "shake_to_feedback_enabled")
                            if isEnabled {
                                FeedbackKit.enableShakeToReport {
                                    UIApplication.shared.topMostViewController
                                }
                            } else {
                                FeedbackKit.disableShakeToReport()
                            }
                        }
                    ))
                }
                #endif

                // App Info
                Section {
                    HStack(spacing: 12) {
                        FeedbackKitLogoView(size: 36)
                        VStack(alignment: .leading, spacing: 2) {
                            Text("FeedbackKit Developer Portal")
                                .font(.subheadline.weight(.semibold))
                            Text(appVersionText)
                                .font(.caption2)
                                .foregroundColor(.secondary)
                        }
                    }
                    .padding(.vertical, 2)
                }

                // Danger Zone
                if client.currentSession != nil || client.isDemoMode {
                    Section(header: Text("Danger Zone")) {
                        Button(role: .destructive) {
                            showSignOutConfirmation = true
                        } label: {
                            HStack {
                                Image(systemName: "arrow.right.square")
                                Text(client.isDemoMode ? "Exit Demo Mode / Sign In" : "Sign Out")
                            }
                        }
                    }
                }
            }
            .navigationTitle("Settings")
            .onAppear {
                FeedbackKit.currentScreen = "Settings"
            }
            .alert(
                client.isDemoMode ? "Exit Demo Mode?" : "Sign out of Developer Portal?",
                isPresented: $showSignOutConfirmation
            ) {
                Button("Cancel", role: .cancel) {}
                Button(client.isDemoMode ? "Exit Demo Mode" : "Sign Out", role: .destructive) {
                    Task {
                        #if os(iOS)
                        // While the session still exists, so the server accepts it.
                        await PortalPushNotifications.shared.signOut()
                        #endif
                        client.signOut()
                        client.isDemoMode = false
                        appState.resetForSignOut()
                    }
                }
            } message: {
                Text(client.isDemoMode ? "You will return to the sign-in screen." : "Are you sure you want to sign out?")
            }
        }
    }
}
