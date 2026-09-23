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

    public var body: some View {
        NavigationStack {
            List {
                // Account Section
                Section(header: Text("Account & Session")) {
                    HStack(spacing: 12) {
                        Image(systemName: "person.crop.circle.fill")
                            .font(.system(size: 40))
                            .foregroundColor(.accentColor)

                        VStack(alignment: .leading, spacing: 2) {
                            Text(client.currentSession?.email ?? (client.isDemoMode ? "Demo Developer" : "Authenticated User"))
                                .font(.headline)

                            Text(client.isDemoMode ? "Offline Demo Environment" : "Connected to Supabase")
                                .font(.caption2)
                                .foregroundColor(.secondary)
                        }
                    }
                    .padding(.vertical, 4)

                    if client.currentSession != nil || client.isDemoMode {
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
                    Button("Reset Demo Data") {
                        client.enableDemoMode()
                        Task {
                            await appState.loadProjects()
                        }
                        UINotificationFeedbackGenerator().notificationOccurred(.success)
                    }

                    Button("Clear Image & Network Cache") {
                        URLCache.shared.removeAllCachedResponses()
                        UINotificationFeedbackGenerator().notificationOccurred(.success)
                    }
                }

                // Links & Documentation
                Section(header: Text("FeedbackKit Ecosystem")) {
                    Link(destination: URL(string: "https://feedback-kit.hejitech.workers.dev")!) {
                        HStack {
                            Label("Web Developer Portal", systemImage: "safari")
                            Spacer()
                            Image(systemName: "arrow.up.right")
                                .font(.caption2)
                                .foregroundColor(.secondary)
                        }
                    }

                    Link(destination: URL(string: "https://tianhaoz95.github.io/feedback-kit/")!) {
                        HStack {
                            Label("Documentation", systemImage: "book")
                            Spacer()
                            Image(systemName: "arrow.up.right")
                                .font(.caption2)
                                .foregroundColor(.secondary)
                        }
                    }

                    Link(destination: URL(string: "https://github.com/tianhaoz95/feedback-kit")!) {
                        HStack {
                            Label("GitHub Repository", systemImage: "chevron.left.forwardslash.chevron.right")
                            Spacer()
                            Image(systemName: "arrow.up.right")
                                .font(.caption2)
                                .foregroundColor(.secondary)
                        }
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

                    Button {
                        if let presenter = UIApplication.shared.topMostViewController {
                            FeedbackKit.presentAndSubmit(from: presenter)
                        }
                    } label: {
                        HStack(spacing: 10) {
                            Image(systemName: "bubble.left.and.exclamationmark.bubble.right.fill")
                                .foregroundColor(.accentColor)
                            Text("Send Feedback on Portal")
                        }
                    }
                }

                // App Info
                Section {
                    HStack(spacing: 12) {
                        FeedbackKitLogoView(size: 36)
                        VStack(alignment: .leading, spacing: 2) {
                            Text("FeedbackKit Developer Portal")
                                .font(.subheadline.weight(.semibold))
                            Text("Version 1.0.0 (Build 1)")
                                .font(.caption2)
                                .foregroundColor(.secondary)
                        }
                    }
                    .padding(.vertical, 2)
                }
            }
            .navigationTitle("Settings")
            .onAppear {
                FeedbackKit.currentScreen = "Settings"
            }
            .sheet(isPresented: $isServerConfigPresented) {
                ServerConfigSheet()
            }
            .confirmationDialog(
                "Sign out of Developer Portal?",
                isPresented: $showSignOutConfirmation,
                titleVisibility: .visible
            ) {
                Button("Sign Out", role: .destructive) {
                    client.signOut()
                    client.isDemoMode = false
                }
            }
        }
    }
}
