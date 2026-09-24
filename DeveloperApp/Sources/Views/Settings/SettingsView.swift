import SwiftUI
import FeedbackKit

public struct SettingsView: View {
    @ObservedObject private var client = SupabasePortalClient.shared
    @EnvironmentObject private var appState: AppState
    @State private var isServerConfigPresented = false
    @State private var showSignOutConfirmation = false

    private var environmentTitle: String {
        if client.isDemoMode {
            return "Demo Mode (Offline)"
        } else if client.supabaseUrl == SupabasePortalClient.defaultProdUrl {
            return "Production Hosted"
        } else if client.supabaseUrl == SupabasePortalClient.defaultLocalUrl {
            return "Local CLI Stack"
        } else {
            return "Custom Endpoint"
        }
    }

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

                // Backend Connection
                Section(
                    header: Text("Backend Configuration"),
                    footer: Text("Default is the hosted FeedbackKit production project (https://gpucoladcyvijefdjudf.supabase.co).")
                ) {
                    HStack {
                        Text("Environment")
                        Spacer()
                        Text(environmentTitle)
                            .foregroundColor(.secondary)
                    }

                    HStack {
                        Text("Server URL")
                        Spacer()
                        Text(client.supabaseUrl)
                            .lineLimit(1)
                            .font(.caption)
                            .foregroundColor(.secondary)
                    }

                    Button {
                        isServerConfigPresented = true
                    } label: {
                        HStack {
                            Text("Configure Endpoint & Keys")
                            Spacer()
                            Image(systemName: "chevron.right")
                                .font(.caption2)
                                .foregroundColor(.secondary)
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
            .sheet(isPresented: $isServerConfigPresented) {
                ServerConfigSheet()
            }
            .alert(
                client.isDemoMode ? "Exit Demo Mode?" : "Sign out of Developer Portal?",
                isPresented: $showSignOutConfirmation
            ) {
                Button("Cancel", role: .cancel) {}
                Button(client.isDemoMode ? "Exit Demo Mode" : "Sign Out", role: .destructive) {
                    client.signOut()
                    client.isDemoMode = false
                    appState.projects = []
                    appState.selectedProject = nil
                    appState.feedbackItems = []
                }
            } message: {
                Text(client.isDemoMode ? "You will return to the sign-in screen." : "Are you sure you want to sign out?")
            }
        }
    }
}
