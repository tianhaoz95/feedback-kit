import FeedbackKit
import SwiftUI
import UIKit

struct SettingsView: View {
    @ObservedObject private var settings = DemoSettings.shared
    @AppStorage(DemoBranding.storageKey) private var brandingRawValue = DemoBranding.sunset.rawValue
    @State private var showingAdvancedEndpoint = false

    /// Wraps `brandingRawValue` so picking a row both persists the choice
    /// (via `@AppStorage`) and applies it immediately.
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
                headerSection

                portalSection

                advancedEndpointSection

                brandingSection

                triggersSection

                versionSection
            }
            .navigationTitle("Settings")
        }
        .navigationViewStyle(.stack)
        .onAppear { FeedbackKit.currentScreen = "Settings" }
    }

    // MARK: - Sections

    private var headerSection: some View {
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
    }

    private var portalSection: some View {
        Section {
            HStack(spacing: 8) {
                Circle()
                    .fill(settings.isConfigured ? Color.green : Color.orange)
                    .frame(width: 8, height: 8)
                Text(settings.isConfigured ? "Connected to Portal" : "Local Demo Mode")
                    .font(.subheadline.weight(.semibold))
                Spacer()
                Text(settings.isConfigured ? "Live Submission" : "Unconfigured")
                    .font(.caption)
                    .foregroundStyle(.secondary)
            }
            .padding(.vertical, 2)

            VStack(alignment: .leading, spacing: 6) {
                Text("Project API Key")
                    .font(.caption)
                    .foregroundStyle(.secondary)
                HStack {
                    Image(systemName: "key.fill")
                        .foregroundStyle(.secondary)
                        .imageScale(.small)
                    TextField("pk_live_... or project key", text: $settings.apiKey)
                        .font(.system(.body, design: .monospaced))
                        .autocapitalization(.none)
                        .disableAutocorrection(true)
                    if !settings.apiKey.isEmpty {
                        Button {
                            settings.clearApiKey()
                        } label: {
                            Image(systemName: "xmark.circle.fill")
                                .foregroundStyle(.secondary)
                        }
                        .buttonStyle(.plain)
                    }
                }
            }

            if settings.apiKey.isEmpty, let clipboardString = UIPasteboard.general.string, !clipboardString.isEmpty {
                Button {
                    settings.apiKey = clipboardString.trimmingCharacters(in: .whitespacesAndNewlines)
                } label: {
                    Label("Paste Key from Clipboard", systemImage: "doc.on.clipboard")
                        .font(.footnote)
                }
            }

            Button {
                testFeedbackFlow()
            } label: {
                Label("Test Feedback Flow", systemImage: "paperplane.fill")
                    .frame(maxWidth: .infinity, alignment: .center)
            }
            .buttonStyle(.borderedProminent)
            .padding(.vertical, 4)
        } header: {
            Text("Web Portal Connection")
        } footer: {
            Text("Paste your Project Key from your FeedbackKit web dashboard (Project Settings → SDK setup). When configured, all reports from shake, floating button, or Report Problem will be submitted straight to your project.")
                .font(.footnote)
        }
    }

    private var advancedEndpointSection: some View {
        Section {
            DisclosureGroup(isExpanded: $showingAdvancedEndpoint) {
                VStack(alignment: .leading, spacing: 8) {
                    Text("Ingestion Endpoint URL")
                        .font(.caption)
                        .foregroundStyle(.secondary)
                    TextField("https://...", text: $settings.endpointURL)
                        .font(.system(.footnote, design: .monospaced))
                        .autocapitalization(.none)
                        .disableAutocorrection(true)

                    if settings.isCustomEndpoint {
                        Button("Reset to Default Endpoint") {
                            settings.resetEndpointToDefault()
                        }
                        .font(.caption)
                        .foregroundStyle(.blue)
                    }
                }
                .padding(.vertical, 4)
            } label: {
                Label("Custom Ingestion Endpoint", systemImage: "server.rack")
                    .font(.subheadline)
            }
        } footer: {
            if showingAdvancedEndpoint {
                Text("Defaults to the official FeedbackKit hosted endpoint. Only change this if you are running your own local or self-hosted backend.")
                    .font(.footnote)
            }
        }
    }

    private var brandingSection: some View {
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
    }

    private var triggersSection: some View {
        Section("Triggers wired up in this demo") {
            Label("Shake the device / simulator", systemImage: "iphone.gen3")
            Label("Tap the floating blue button", systemImage: "hand.tap")
            Label("\"Report a Problem\" button on Home/Cart/Settings", systemImage: "hand.point.up.left")
        }
    }

    private var versionSection: some View {
        Section {
            HStack {
                Text("Version")
                Spacer()
                Text(Self.versionText).foregroundStyle(.secondary)
            }
        }
    }

    private func testFeedbackFlow() {
        guard let presenter = UIApplication.shared.topMostViewController else { return }
        FeedbackKit.presentAndSubmitIfConfigured(from: presenter) { result in
            guard let result else { return }
            switch result {
            case .success(let report):
                print("[FeedbackKit demo] captured report \(report.id) — \"\(report.text)\"")
            case .failure(let error):
                print("[FeedbackKit demo] report failed: \(error)")
            }
        }
    }

    private static var versionText: String {
        let version = Bundle.main.infoDictionary?["CFBundleShortVersionString"] as? String ?? "1.0"
        let build = Bundle.main.infoDictionary?["CFBundleVersion"] as? String ?? "1"
        return "\(version) (\(build))"
    }
}
