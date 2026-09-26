import SwiftUI
import FeedbackKit

/// The Developer Portal as a native Mac app. It shares every model, service
/// and nearly every view with the iOS Portal (`Sources/`, made to compile on
/// macOS by Sources/Platform/PortalPlatform+macOS.swift) and adds only a
/// desktop shell: a sidebar window, menu commands, and a Settings window.
///
/// It also dogfoods FeedbackKit's macOS SDK on itself (see `PortalDogfood`):
/// Help › Report a Problem… (⇧⌘R) captures this window into the FeedbackKit
/// team's own project, and fix verification asks you to confirm fixes to
/// your reports once you're running the build that ships them — so the
/// Portal is used to triage, fix and verify problems in the Portal.
@main
struct FeedbackPortalMacApp: App {
    @StateObject private var client = SupabasePortalClient.shared
    @StateObject private var appState = AppState.shared

    init() {
        PortalDogfood.configure()
    }

    var body: some Scene {
        WindowGroup("FeedbackKit Portal", id: "main") {
            Group {
                if client.currentSession != nil || client.isDemoMode {
                    MacRootView()
                } else {
                    LoginView()
                        .frame(maxWidth: 520)
                        .frame(maxWidth: .infinity, maxHeight: .infinity)
                }
            }
            .environmentObject(appState)
            .frame(minWidth: 980, minHeight: 640)
            .tint(.blue)
            .onAppear(perform: installFeedbackKit)
            .onOpenURL { url in
                PortalDeepLinks.handle(url, client: client)
            }
            .onChange(of: client.currentSession?.userId, initial: true) {
                PortalDogfood.updateUser(client.currentSession)
            }
        }
        .defaultSize(width: 1280, height: 820)
        .commands { PortalCommands(appState: appState) }

        Settings {
            SettingsView()
                .environmentObject(appState)
                .frame(width: 560, height: 640)
        }
    }

    private func installFeedbackKit() {
        PortalDogfood.applyFloatingButtonPreference()
        // Ask "is it fixed?" when a fix for something reported from this Mac
        // ships in the Portal build it's running.
        FeedbackKit.enableFixVerification {
            NSApplication.shared.keyWindow ?? NSApplication.shared.mainWindow
        }
    }
}

/// Menu bar commands. "Report a Problem…" is the macOS-native trigger the SDK
/// docs recommend (there's no shake on a Mac).
struct PortalCommands: Commands {
    @ObservedObject var appState: AppState

    var body: some Commands {
        CommandGroup(after: .help) {
            Button("Report a Problem…") {
                PortalDogfood.reportProblem()
            }
            .keyboardShortcut("r", modifiers: [.command, .shift])

            Button("Check for Fix Updates") {
                FeedbackKit.presentFixUpdatesIfNeeded()
            }
        }

        CommandMenu("Feedback") {
            Button("Refresh") {
                Task { await appState.loadFeedback() }
            }
            .keyboardShortcut("r", modifiers: .command)

            Divider()

            Picker("Project", selection: Binding(
                get: { appState.selectedProject?.id ?? "" },
                set: { id in appState.selectedProject = appState.projects.first { $0.id == id } }
            )) {
                ForEach(appState.projects) { project in
                    Text(project.name).tag(project.id)
                }
            }

            Toggle("Show Archived", isOn: $appState.showArchived)
                .keyboardShortcut("a", modifiers: [.command, .option])
        }
    }
}
