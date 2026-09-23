import SwiftUI
import FeedbackKit

public struct SdkIntegrationGuideView: View {
    public let project: PortalProject

    @State private var didCopyId = false
    @State private var didCopyKey = false
    @State private var didCopyAgentPrompt = false

    public init(project: PortalProject) {
        self.project = project
    }

    private var endpointUrl: String {
        "\(SupabasePortalClient.shared.supabaseUrl)/functions/v1/ingest-feedback"
    }

    private var agentPromptText: String {
        """
        Please integrate the FeedbackKit SDK for "\(project.name)" into this iOS app project.

        1. Add the Swift Package dependency:
           - Package URL: https://github.com/tianhaoz95/feedback-kit
           - Branch: main (or latest release)
           - Add product "FeedbackKit" to your app target.

        2. Configure FeedbackKit at app launch with this project's endpoint and key:
           ```swift
           import FeedbackKit

           FeedbackKit.configure(.init(
               endpointURL: URL(string: "\(endpointUrl)")!,
               projectKey: "\(project.projectKey)"
           ))
           ```
           - For SwiftUI apps: Place this inside your @main App struct's init() method.
           - For UIKit apps: Place this inside application(_:didFinishLaunchingWithOptions:) in AppDelegate.swift.

        3. Install a feedback trigger so users can submit feedback:
           - Option A: Shake to report (recommended for iOS):
             ```swift
             FeedbackKit.enableShakeToReport {
                 UIApplication.shared.connectedScenes
                     .compactMap { $0 as? UIWindowScene }
                     .flatMap { $0.windows }
                     .first { $0.isKeyWindow }?
                     .rootViewController
             }
             ```
           - Option B: Manual presentation from a button or settings action:
             ```swift
             FeedbackKit.presentAndSubmit(from: viewController)
             ```

        4. Screen tracking (optional but recommended): Set FeedbackKit.currentScreen = "ScreenName" when navigating so reports record which screen they originated from.

        Project Reference:
        - Project Name: \(project.name)
        - Project ID: \(project.id)
        - Project Key: \(project.projectKey)
        """
    }

    public var body: some View {
        ScrollView {
            VStack(alignment: .leading, spacing: 20) {
                // Project Identification Header Card
                projectHeaderCard

                // AI Coding Agent Setup Card
                agentPromptCard

                // Step 1: Add Swift Package
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

                // Step 2: Configure at Launch
                VStack(alignment: .leading, spacing: 8) {
                    stepBadge(number: "2", title: "Configure in App Startup")
                    Text("Add `import FeedbackKit` and configure with \(project.name)'s project key:")
                        .font(.caption)
                        .foregroundColor(.secondary)

                    let configSnippet = """
                    import SwiftUI
                    import FeedbackKit

                    @main
                    struct MyApp: App {
                        init() {
                            FeedbackKit.configure(.init(
                                endpointURL: URL(string: "\(endpointUrl)")!,
                                projectKey: "\(project.projectKey)"
                            ))
                        }

                        var body: some Scene {
                            WindowGroup {
                                ContentView()
                                    .onAppear {
                                        FeedbackKit.enableShakeToReport {
                                            UIApplication.shared.connectedScenes
                                                .compactMap { $0 as? UIWindowScene }
                                                .flatMap { $0.windows }
                                                .first { $0.isKeyWindow }?
                                                .rootViewController
                                        }
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
                    Text("Enable shake detection or present manually from any button or settings view:")
                        .font(.caption)
                        .foregroundColor(.secondary)

                    let triggerSnippet = """
                    // Option A: Shake to Report (app-wide)
                    FeedbackKit.enableShakeToReport {
                        UIApplication.shared.connectedScenes
                            .compactMap { $0 as? UIWindowScene }
                            .flatMap { $0.windows }
                            .first { $0.isKeyWindow }?
                            .rootViewController
                    }

                    // Option B: Manual Presentation
                    Button("Report a Bug") {
                        if let vc = UIApplication.shared.topMostViewController {
                            FeedbackKit.presentAndSubmit(from: vc)
                        }
                    }
                    """

                    CodeBlockView(
                        code: triggerSnippet,
                        title: "Trigger Options"
                    )
                }

                // Step 4: Screen Tracking
                VStack(alignment: .leading, spacing: 8) {
                    stepBadge(number: "4", title: "Screen Tracking")
                    Text("Record which screen user reports originate from when navigating:")
                        .font(.caption)
                        .foregroundColor(.secondary)

                    let screenSnippet = """
                    // In SwiftUI
                    .onAppear {
                        FeedbackKit.currentScreen = "Checkout"
                    }

                    // In UIKit
                    override func viewDidAppear(_ animated: Bool) {
                        super.viewDidAppear(animated)
                        FeedbackKit.currentScreen = "Checkout"
                    }
                    """

                    CodeBlockView(
                        code: screenSnippet,
                        title: "Navigation Tracking"
                    )
                }

                // Step 5: Theming
                VStack(alignment: .leading, spacing: 8) {
                    stepBadge(number: "5", title: "Branding & Theming (Optional)")
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
        .navigationTitle("SDK Integration Guide")
        .navigationBarTitleDisplayMode(.inline)
        .onAppear {
            FeedbackKit.currentScreen = "SDK Guide"
        }
    }

    // MARK: - Subviews

    private var projectHeaderCard: some View {
        VStack(alignment: .leading, spacing: 12) {
            HStack(spacing: 10) {
                Image(systemName: "folder.fill")
                    .foregroundColor(.accentColor)
                    .font(.title3)
                VStack(alignment: .leading, spacing: 2) {
                    Text(project.name)
                        .font(.headline)
                    Text("Drop-in SDK integration parameters for this project")
                        .font(.caption2)
                        .foregroundColor(.secondary)
                }
                Spacer()
            }

            Divider()

            // Project ID
            HStack {
                VStack(alignment: .leading, spacing: 2) {
                    Text("Project ID")
                        .font(.caption2.weight(.bold))
                        .foregroundColor(.secondary)
                        .textCase(.uppercase)
                    Text(project.id)
                        .font(.system(.caption, design: .monospaced))
                        .foregroundColor(.primary)
                        .lineLimit(1)
                }
                Spacer()
                Button {
                    UIPasteboard.general.string = project.id
                    UIImpactFeedbackGenerator(style: .light).impactOccurred()
                    didCopyId = true
                    DispatchQueue.main.asyncAfter(deadline: .now() + 2) {
                        didCopyId = false
                    }
                } label: {
                    HStack(spacing: 4) {
                        Image(systemName: didCopyId ? "checkmark" : "doc.on.doc")
                        Text(didCopyId ? "Copied" : "Copy")
                    }
                    .font(.caption2.weight(.semibold))
                    .foregroundColor(.accentColor)
                    .padding(.horizontal, 8)
                    .padding(.vertical, 4)
                    .background(Color.accentColor.opacity(0.1))
                    .clipShape(Capsule())
                }
            }

            // Project Key
            HStack {
                VStack(alignment: .leading, spacing: 2) {
                    Text("Project Key")
                        .font(.caption2.weight(.bold))
                        .foregroundColor(.secondary)
                        .textCase(.uppercase)
                    Text(project.projectKey)
                        .font(.system(.caption, design: .monospaced))
                        .foregroundColor(.primary)
                        .lineLimit(1)
                }
                Spacer()
                Button {
                    UIPasteboard.general.string = project.projectKey
                    UIImpactFeedbackGenerator(style: .light).impactOccurred()
                    didCopyKey = true
                    DispatchQueue.main.asyncAfter(deadline: .now() + 2) {
                        didCopyKey = false
                    }
                } label: {
                    HStack(spacing: 4) {
                        Image(systemName: didCopyKey ? "checkmark" : "doc.on.doc")
                        Text(didCopyKey ? "Copied" : "Copy")
                    }
                    .font(.caption2.weight(.semibold))
                    .foregroundColor(.accentColor)
                    .padding(.horizontal, 8)
                    .padding(.vertical, 4)
                    .background(Color.accentColor.opacity(0.1))
                    .clipShape(Capsule())
                }
            }
        }
        .padding(14)
        .background(Color(UIColor.secondarySystemGroupedBackground))
        .clipShape(RoundedRectangle(cornerRadius: 12, style: .continuous))
    }

    private var agentPromptCard: some View {
        VStack(alignment: .leading, spacing: 10) {
            HStack(spacing: 8) {
                Image(systemName: "sparkles")
                    .foregroundColor(.purple)
                Text("AI Coding Agent Setup Prompt")
                    .font(.subheadline.weight(.semibold))
                Spacer()
                Text("Recommended")
                    .font(.caption2.weight(.bold))
                    .foregroundColor(.purple)
                    .padding(.horizontal, 8)
                    .padding(.vertical, 2)
                    .background(Color.purple.opacity(0.12))
                    .clipShape(Capsule())
            }

            Text("Hand this tailored prompt to Claude Code, Cursor, or Antigravity to automate the FeedbackKit integration in your codebase:")
                .font(.caption)
                .foregroundColor(.secondary)

            Button {
                UIPasteboard.general.string = agentPromptText
                UIImpactFeedbackGenerator(style: .medium).impactOccurred()
                didCopyAgentPrompt = true
                DispatchQueue.main.asyncAfter(deadline: .now() + 2) {
                    didCopyAgentPrompt = false
                }
            } label: {
                HStack(spacing: 6) {
                    Image(systemName: didCopyAgentPrompt ? "checkmark" : "doc.on.doc.fill")
                    Text(didCopyAgentPrompt ? "Copied to Clipboard!" : "Copy Agent Setup Prompt")
                }
                .font(.caption.weight(.semibold))
                .frame(maxWidth: .infinity)
                .padding(.vertical, 10)
                .background(Color.purple)
                .foregroundColor(.white)
                .clipShape(RoundedRectangle(cornerRadius: 8, style: .continuous))
            }
        }
        .padding(14)
        .background(Color.purple.opacity(0.06))
        .overlay(
            RoundedRectangle(cornerRadius: 12, style: .continuous)
                .stroke(Color.purple.opacity(0.2), lineWidth: 1)
        )
        .clipShape(RoundedRectangle(cornerRadius: 12, style: .continuous))
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
