import AppKit
import FeedbackKit
import SwiftUI

struct MacSettingsView: View {
    @ObservedObject private var settings = DemoSettings.shared
    @AppStorage(DemoBranding.storageKey) private var brandingRawValue = DemoBranding.sunset.rawValue
    @State private var showingAdvancedEndpoint = false

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
        ScrollView {
            VStack(alignment: .leading, spacing: 20) {
                headerCard

                portalCard

                advancedEndpointCard

                brandingCard

                triggersCard

                versionCard
            }
            .padding(24)
            .frame(maxWidth: 640)
        }
        .onAppear { FeedbackKit.currentScreen = "Settings" }
    }

    // MARK: - Cards

    private var headerCard: some View {
        HStack(spacing: 16) {
            RoundedRectangle(cornerRadius: 12)
                .fill(Color.primary.opacity(0.08))
                .frame(width: 50, height: 50)
                .overlay {
                    Image(systemName: "gearshape.fill")
                        .font(.title2)
                        .foregroundStyle(Color.accentColor)
                }
            VStack(alignment: .leading, spacing: 3) {
                Text("macOS Demo Settings")
                    .font(.title2.bold())
                Text("Configure your web portal API key to test live feedback submissions.")
                    .font(.callout)
                    .foregroundStyle(.secondary)
            }
        }
    }

    private var portalCard: some View {
        VStack(alignment: .leading, spacing: 14) {
            HStack(spacing: 8) {
                Circle()
                    .fill(settings.isConfigured ? Color.green : Color.orange)
                    .frame(width: 9, height: 9)
                Text(settings.isConfigured ? "Connected to Web Portal" : "Local Demo Mode")
                    .font(.headline)
                Spacer()
                Text(settings.isConfigured ? "Live Submission Active" : "Unconfigured")
                    .font(.caption)
                    .foregroundStyle(.secondary)
            }

            Divider()

            VStack(alignment: .leading, spacing: 6) {
                Text("Project API Key")
                    .font(.subheadline.weight(.medium))
                HStack {
                    Image(systemName: "key.fill")
                        .foregroundStyle(.secondary)
                    TextField("pk_live_... or project key", text: $settings.apiKey)
                        .textFieldStyle(.roundedBorder)
                        .font(.system(.body, design: .monospaced))
                    if !settings.apiKey.isEmpty {
                        Button("Clear") {
                            settings.clearApiKey()
                        }
                        .buttonStyle(.bordered)
                    }
                }

                if settings.apiKey.isEmpty, let clipboard = NSPasteboard.general.string(forType: .string), !clipboard.isEmpty {
                    Button {
                        settings.apiKey = clipboard.trimmingCharacters(in: .whitespacesAndNewlines)
                    } label: {
                        Label("Paste from Clipboard", systemImage: "doc.on.clipboard")
                            .font(.caption)
                    }
                    .buttonStyle(.link)
                }

                Text("Find your Project Key in the FeedbackKit web portal (Project Settings → SDK setup). When set, feedback reports will be submitted directly to your dashboard.")
                    .font(.caption)
                    .foregroundStyle(.secondary)
            }

            Button {
                testFeedbackFlow()
            } label: {
                Label("Test Feedback Flow", systemImage: "paperplane.fill")
            }
            .buttonStyle(.borderedProminent)
            .controlSize(.large)
        }
        .padding(16)
        .background(Color(NSColor.controlBackgroundColor))
        .clipShape(RoundedRectangle(cornerRadius: 12))
    }

    private var advancedEndpointCard: some View {
        DisclosureGroup(isExpanded: $showingAdvancedEndpoint) {
            VStack(alignment: .leading, spacing: 10) {
                Text("Ingestion Endpoint URL")
                    .font(.subheadline.weight(.medium))
                TextField("https://...", text: $settings.endpointURL)
                    .textFieldStyle(.roundedBorder)
                    .font(.system(.caption, design: .monospaced))

                if settings.isCustomEndpoint {
                    Button("Reset to Default Hosted Endpoint") {
                        settings.resetEndpointToDefault()
                    }
                    .buttonStyle(.link)
                    .font(.caption)
                }

                Text("Defaults to FeedbackKit's hosted ingestion function. Only change this if you are developing against a local or self-hosted backend.")
                    .font(.caption)
                    .foregroundStyle(.secondary)
            }
            .padding(.top, 8)
        } label: {
            Label("Custom Ingestion Endpoint", systemImage: "server.rack")
                .font(.headline)
        }
        .padding(16)
        .background(Color(NSColor.controlBackgroundColor))
        .clipShape(RoundedRectangle(cornerRadius: 12))
    }

    private var brandingCard: some View {
        VStack(alignment: .leading, spacing: 12) {
            Text("Branding & Accent Colors")
                .font(.headline)
            Text("Pick an accent theme for the feedback screen. The send button and selected annotation tool will use the primary color; Cancel and attach button use secondary.")
                .font(.caption)
                .foregroundStyle(.secondary)

            Picker("Theme", selection: brandingSelection) {
                ForEach(DemoBranding.allCases) { branding in
                    HStack {
                        Circle().fill(branding.primarySwatch).frame(width: 10, height: 10)
                        Circle().fill(branding.secondarySwatch).frame(width: 10, height: 10)
                        Text(branding.displayName)
                    }
                    .tag(branding.rawValue)
                }
            }
            .pickerStyle(.radioGroup)
        }
        .padding(16)
        .background(Color(NSColor.controlBackgroundColor))
        .clipShape(RoundedRectangle(cornerRadius: 12))
    }

    private var triggersCard: some View {
        VStack(alignment: .leading, spacing: 10) {
            Text("Triggers Active in macOS Demo")
                .font(.headline)
            Label("Floating trigger button (bottom-right of window)", systemImage: "hand.tap")
            Label("Menu Bar: Help → Report a Problem… (⇧⌘R)", systemImage: "menubar.rectangle")
            Label("\"Report a Problem\" button on Home, Cart & Settings", systemImage: "hand.point.up.left")
        }
        .font(.callout)
        .padding(16)
        .frame(maxWidth: .infinity, alignment: .leading)
        .background(Color(NSColor.controlBackgroundColor))
        .clipShape(RoundedRectangle(cornerRadius: 12))
    }

    private var versionCard: some View {
        HStack {
            Text("App Version")
            Spacer()
            Text(versionText)
                .foregroundStyle(.secondary)
        }
        .font(.callout)
        .padding(16)
        .background(Color(NSColor.controlBackgroundColor))
        .clipShape(RoundedRectangle(cornerRadius: 12))
    }

    private func testFeedbackFlow() {
        FeedbackKit.presentAndSubmitIfConfigured(from: NSApplication.shared.keyWindow) { result in
            guard let result else { return }
            switch result {
            case .success(let report):
                print("[FeedbackKit demo] captured report \(report.id) — \"\(report.text)\"")
            case .failure(let error):
                print("[FeedbackKit demo] report failed: \(error)")
            }
        }
    }

    private var versionText: String {
        let version = Bundle.main.infoDictionary?["CFBundleShortVersionString"] as? String ?? "1.0"
        let build = Bundle.main.infoDictionary?["CFBundleVersion"] as? String ?? "1"
        return "\(version) (\(build))"
    }
}
