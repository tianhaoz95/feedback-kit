import SwiftUI
import FeedbackKit

public struct SdkIntegrationGuideView: View {
    @EnvironmentObject private var appState: AppState

    private var activeProjectKey: String {
        appState.selectedProject?.projectKey ?? "YOUR_PROJECT_KEY"
    }

    public var body: some View {
        NavigationStack {
            ScrollView {
                VStack(alignment: .leading, spacing: 20) {
                    // Header card
                    VStack(alignment: .leading, spacing: 6) {
                        HStack(spacing: 8) {
                            Image(systemName: "cube.transparent.fill")
                                .foregroundColor(.accentColor)
                                .font(.title3)
                            Text("Integrate FeedbackKit SDK")
                                .font(.headline)
                        }
                        Text("Drop the FeedbackKit Swift Package into your client iOS, macOS, or watchOS app to start capturing annotated bug reports.")
                            .font(.subheadline)
                            .foregroundColor(.secondary)
                    }
                    .padding(14)
                    .background(Color(UIColor.secondarySystemGroupedBackground))
                    .clipShape(RoundedRectangle(cornerRadius: 12, style: .continuous))

                    // Step 1: SPM
                    VStack(alignment: .leading, spacing: 8) {
                        stepBadge(number: "1", title: "Add Swift Package")
                        Text("In Xcode, select **File > Add Package Dependencies...** and enter:")
                            .font(.caption)
                            .foregroundColor(.secondary)

                        CodeBlockView(
                            code: "https://github.com/tianhaoz95/feedback-kit",
                            title: "Repository URL"
                        )
                    }

                    // Step 2: Configure
                    VStack(alignment: .leading, spacing: 8) {
                        stepBadge(number: "2", title: "Configure in App Startup")
                        Text("Add `import FeedbackKit` and configure with your active project's key:")
                            .font(.caption)
                            .foregroundColor(.secondary)

                        let configSnippet = """
                        import SwiftUI
                        import FeedbackKit

                        @main
                        struct MyApp: App {
                            init() {
                                FeedbackKit.configure(
                                    projectKey: "\(activeProjectKey)"
                                )
                                // Optional: Enable shake-to-report
                                FeedbackKit.enableShakeToReport = true
                            }

                            var body: some Scene {
                                WindowGroup {
                                    ContentView()
                                        .onAppear {
                                            // Optional: Display floating trigger button
                                            FeedbackKit.showFloatingTriggerButton()
                                        }
                                }
                            }
                        }
                        """

                        CodeBlockView(
                            code: configSnippet,
                            title: "SwiftUI App Setup"
                        )
                    }

                    // Step 3: Triggering
                    VStack(alignment: .leading, spacing: 8) {
                        stepBadge(number: "3", title: "Presentation Triggers")
                        Text("You can present the report composer anywhere via SwiftUI or UIKit:")
                            .font(.caption)
                            .foregroundColor(.secondary)

                        let triggerSnippet = """
                        // SwiftUI button
                        Button("Report a Bug") {
                            FeedbackKit.present()
                        }

                        // UIKit action
                        @objc func reportTapped() {
                            FeedbackKit.present(from: self)
                        }
                        """

                        CodeBlockView(
                            code: triggerSnippet,
                            title: "Manual Presentation"
                        )
                    }

                    // Step 4: Theming
                    VStack(alignment: .leading, spacing: 8) {
                        stepBadge(number: "4", title: "Branding & Theming (Optional)")
                        Text("Match the feedback composer's accent colors with your app's brand:")
                            .font(.caption)
                            .foregroundColor(.secondary)

                        let themeSnippet = """
                        FeedbackKit.theme = FeedbackTheme(
                            primaryColorHex: "#007AFF",
                            secondaryColorHex: "#5856D6"
                        )
                        """

                        CodeBlockView(
                            code: themeSnippet,
                            title: "Custom Brand Theme"
                        )
                    }
                }
                .padding(16)
            }
            .navigationTitle("SDK Setup Guide")
            .onAppear {
                FeedbackKit.currentScreen = "SDK Guide"
            }
        }
    }

    private func stepBadge(number: String, title: String) -> some View {
        HStack(spacing: 8) {
            Text(number)
                .font(.caption.bold())
                .frame(width: 22, height: 22)
                .background(Color.accentColor)
                .foregroundColor(.white)
                .clipShape(Circle())

            Text(title)
                .font(.headline)
        }
    }
}
