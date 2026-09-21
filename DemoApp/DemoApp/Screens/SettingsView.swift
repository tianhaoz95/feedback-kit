import FeedbackKit
import SwiftUI

struct SettingsView: View {
    @AppStorage(DemoBranding.storageKey) private var brandingRawValue = DemoBranding.sunset.rawValue

    /// Wraps `brandingRawValue` so picking a row both persists the choice
    /// (via `@AppStorage`) and applies it immediately — rather than an
    /// `.onChange(of:)` doing the applying separately, which would apply
    /// the *previous* selection for one extra render pass.
    private var brandingSelection: Binding<String> {
        Binding(
            get: { brandingRawValue },
            set: { newValue in
                brandingRawValue = newValue
                FeedbackKit.theme = DemoBranding(rawValue: newValue)?.theme
            }
        )
    }

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
                Section {
                    Text("FeedbackKit.theme customizes the feedback screen's accent colors. Pick a brand below — the send button, selected annotation tool, and screenshot toggle switch to its primary color; Cancel and the attach button switch to its secondary color. Takes effect immediately, no restart needed.")
                        .font(.footnote)
                        .foregroundStyle(.secondary)
                    Picker("Brand", selection: brandingSelection) {
                        ForEach(DemoBranding.allCases) { branding in
                            Label {
                                Text(branding.displayName)
                            } icon: {
                                HStack(spacing: 4) {
                                    Circle().fill(branding.primarySwatch).frame(width: 12, height: 12)
                                    Circle().fill(branding.secondarySwatch).frame(width: 12, height: 12)
                                }
                            }
                            .tag(branding.rawValue)
                        }
                    }
                    .pickerStyle(.inline)
                    .labelsHidden()
                } header: {
                    Text("Branding")
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
