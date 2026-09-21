import FeedbackKit
import SwiftUI

struct SettingsView: View {
    var body: some View {
        NavigationView {
            Form {
                Section {
                    HStack(spacing: 14) {
                        RoundedRectangle(cornerRadius: 14)
                            .fill(Color.black)
                            .frame(width: 56, height: 56)
                            .overlay {
                                Image(systemName: "exclamationmark.bubble.fill")
                                    .font(.title2)
                                    .foregroundStyle(.white)
                            }
                        VStack(alignment: .leading, spacing: 2) {
                            Text("FeedbackKit Demo").font(.headline)
                            Text("Exercises the SDK end to end").font(.footnote).foregroundStyle(.secondary)
                        }
                    }
                    .padding(.vertical, 4)
                }

                Section("Hosted dashboard") {
                    Text("Configure FeedbackKit.configure(...) in FeedbackKitDemoApp.swift with your project's ingestion endpoint and project key to have feedback submitted straight to the developer dashboard (see /web and /supabase).")
                        .font(.footnote)
                        .foregroundStyle(.secondary)
                }
                Section("Custom branding") {
                    Text("This demo sets FeedbackKit.theme in FeedbackKitDemoApp.swift, so the feedback screen's send button, selected annotation tool, and screenshot toggle use a custom purple instead of the system blue default, with Cancel/attach in a custom orange.")
                        .font(.footnote)
                        .foregroundStyle(.secondary)
                }
                Section("Triggers wired up in this demo") {
                    Label("Shake the device / simulator", systemImage: "iphone.gen3")
                    Label("Tap the floating blue button", systemImage: "hand.tap")
                    Label("\"Report a Problem\" button on Home/Cart", systemImage: "hand.point.up.left")
                }

                Section {
                    HStack {
                        Text("Version")
                        Spacer()
                        Text(Self.versionText).foregroundStyle(.secondary)
                    }
                }
            }
            .navigationTitle("Settings")
        }
        .onAppear { FeedbackKit.currentScreen = "Settings" }
    }

    private static var versionText: String {
        let version = Bundle.main.infoDictionary?["CFBundleShortVersionString"] as? String ?? "1.0"
        let build = Bundle.main.infoDictionary?["CFBundleVersion"] as? String ?? "1"
        return "\(version) (\(build))"
    }
}
