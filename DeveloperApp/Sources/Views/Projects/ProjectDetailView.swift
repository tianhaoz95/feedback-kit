import SwiftUI
import FeedbackKit

public struct ProjectDetailView: View {
    @EnvironmentObject private var appState: AppState
    @Environment(\.dismiss) private var dismiss

    public let project: PortalProject

    private var currentProject: PortalProject {
        appState.projects.first(where: { $0.id == project.id }) ?? project
    }

    @State private var isKeyRevealed = false
    @State private var didCopyKey = false
    @State private var isTemplateEditorPresented = false
    @State private var isConnectRepoSheetPresented = false
    @State private var showDisconnectConfirmation = false
    @State private var templateText: String = PromptGenerator.defaultTemplate
    @State private var showDeleteConfirmation = false
    @State private var isDeleting = false

    public init(project: PortalProject) {
        self.project = project
    }

    public var body: some View {
        ScrollView {
            VStack(alignment: .leading, spacing: 20) {
                // Project Stats
                projectStatsCard

                // Prompt Template Card
                promptTemplateCard

                // GitHub Integration Card
                gitHubCard

                // Project Key Card
                projectKeyCard

                // SDK Integration Guide Card
                sdkGuideCard

                // Danger Zone: Delete Project
                deleteProjectSection
            }
            .padding(16)
        }
        .navigationTitle(currentProject.name)
        .navigationBarTitleDisplayMode(.inline)
        .task {
            if let tpl = try? await SupabasePortalClient.shared.fetchPromptTemplate(projectId: currentProject.id) {
                templateText = tpl.templateText
            }
        }
        .sheet(isPresented: $isTemplateEditorPresented) {
            PromptTemplateEditorView(projectId: currentProject.id, initialText: templateText)
        }
        .sheet(isPresented: $isConnectRepoSheetPresented) {
            ConnectGitHubRepoSheet(projectId: currentProject.id, currentRepo: currentProject.githubRepo)
        }
        .confirmationDialog(
            "Disconnect \(currentProject.githubRepo ?? "Repository")?",
            isPresented: $showDisconnectConfirmation,
            titleVisibility: .visible
        ) {
            Button("Disconnect Repository", role: .destructive) {
                disconnectRepo()
            }
        } message: {
            Text("Auto-creating GitHub issues from bug reports will be disabled until a new repository is connected.")
        }
        .confirmationDialog(
            "Delete \(currentProject.name)?",
            isPresented: $showDeleteConfirmation,
            titleVisibility: .visible
        ) {
            Button("Delete Project", role: .destructive) {
                deleteProject()
            }
        } message: {
            Text("This will permanently delete the project and all of its feedback reports, screenshots, and prompt templates.")
        }
        .onAppear {
            FeedbackKit.currentScreen = "Project Detail"
        }
    }

    // MARK: - Subviews

    private var projectKeyCard: some View {
        VStack(alignment: .leading, spacing: 10) {
            HStack {
                Label("Project API Key", systemImage: "key.fill")
                    .font(.caption.weight(.semibold))
                    .foregroundColor(.accentColor)
                Spacer()
                Button {
                    isKeyRevealed.toggle()
                } label: {
                    Text(isKeyRevealed ? "Hide" : "Reveal")
                        .font(.caption2.weight(.medium))
                }
            }

            HStack {
                Text(isKeyRevealed ? currentProject.projectKey : String(repeating: "•", count: 24))
                    .font(.system(.subheadline, design: .monospaced))
                    .lineLimit(1)
                    .foregroundColor(.primary)

                Spacer()

                Button {
                    UIPasteboard.general.string = currentProject.projectKey
                    UIImpactFeedbackGenerator(style: .medium).impactOccurred()
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
                    .foregroundColor(didCopyKey ? .green : .accentColor)
                    .padding(.horizontal, 10)
                    .padding(.vertical, 6)
                    .background(Color(UIColor.secondarySystemBackground))
                    .clipShape(Capsule())
                }
            }
            .padding(12)
            .background(Color(UIColor.systemBackground))
            .clipShape(RoundedRectangle(cornerRadius: 8, style: .continuous))

            Text("Pass this key into `FeedbackKit.configure(projectKey:)` in your client iOS / macOS app.")
                .font(.caption2)
                .foregroundColor(.secondary)
        }
        .padding(14)
        .background(Color(UIColor.secondarySystemGroupedBackground))
        .clipShape(RoundedRectangle(cornerRadius: 12, style: .continuous))
    }

    private var sdkGuideCard: some View {
        NavigationLink(destination: SdkIntegrationGuideView(project: currentProject)) {
            HStack(spacing: 12) {
                Image(systemName: "cube.transparent.fill")
                    .font(.title2)
                    .foregroundColor(.accentColor)

                VStack(alignment: .leading, spacing: 2) {
                    Text("SDK Integration Guide")
                        .font(.subheadline.weight(.semibold))
                        .foregroundColor(.primary)

                    Text("Drop-in code snippets and AI agent setup prompt for \(currentProject.name)")
                        .font(.caption2)
                        .foregroundColor(.secondary)
                }

                Spacer()

                Image(systemName: "chevron.right")
                    .font(.caption2.weight(.semibold))
                    .foregroundColor(.secondary)
            }
            .padding(14)
            .background(Color(UIColor.secondarySystemGroupedBackground))
            .clipShape(RoundedRectangle(cornerRadius: 12, style: .continuous))
        }
    }

    private var projectStatsCard: some View {
        VStack(alignment: .leading, spacing: 10) {
            Text("Overview")
                .font(.headline)

            HStack(spacing: 12) {
                statTile(title: "Total Reports", value: "\(currentProject.feedbackCount)", color: .primary)
                statTile(title: "Unresolved", value: "\(currentProject.unresolvedCount)", color: .orange)
                statTile(title: "Resolved", value: "\(max(0, currentProject.feedbackCount - currentProject.unresolvedCount))", color: .green)
            }
        }
    }

    private func statTile(title: String, value: String, color: Color) -> some View {
        VStack(spacing: 4) {
            Text(value)
                .font(.title2.weight(.bold))
                .foregroundColor(color)
            Text(title)
                .font(.caption2)
                .foregroundColor(.secondary)
        }
        .frame(maxWidth: .infinity)
        .padding(.vertical, 12)
        .background(Color(UIColor.secondarySystemGroupedBackground))
        .clipShape(RoundedRectangle(cornerRadius: 10, style: .continuous))
    }

    private var promptTemplateCard: some View {
        VStack(alignment: .leading, spacing: 10) {
            HStack {
                Label("AI Prompt Template", systemImage: "sparkles")
                    .font(.headline)
                Spacer()

                Button {
                    isTemplateEditorPresented = true
                } label: {
                    Text("Edit Template")
                        .font(.caption.weight(.semibold))
                        .foregroundColor(.accentColor)
                }
            }

            Text("Customizes the generated instructions provided to coding agents when developers copy prompts.")
                .font(.caption)
                .foregroundColor(.secondary)

            Text(templateText)
                .font(.system(.caption2, design: .monospaced))
                .lineLimit(6)
                .padding(10)
                .frame(maxWidth: .infinity, alignment: .leading)
                .background(Color(UIColor.systemBackground))
                .clipShape(RoundedRectangle(cornerRadius: 8, style: .continuous))
        }
        .padding(14)
        .background(Color(UIColor.secondarySystemGroupedBackground))
        .clipShape(RoundedRectangle(cornerRadius: 12, style: .continuous))
    }

    private var gitHubCard: some View {
        VStack(alignment: .leading, spacing: 12) {
            HStack {
                Label("GitHub Repository", systemImage: "chevron.left.forwardslash.chevron.right")
                    .font(.headline)
                Spacer()

                if currentProject.githubRepo != nil {
                    Menu {
                        Button {
                            isConnectRepoSheetPresented = true
                        } label: {
                            Label("Change Repository", systemImage: "arrow.triangle.2.circlepath")
                        }

                        Button(role: .destructive) {
                            showDisconnectConfirmation = true
                        } label: {
                            Label("Disconnect", systemImage: "trash")
                        }
                    } label: {
                        Image(systemName: "ellipsis.circle")
                            .font(.subheadline)
                            .foregroundColor(.accentColor)
                    }
                }
            }

            if let repo = currentProject.githubRepo {
                HStack {
                    VStack(alignment: .leading, spacing: 2) {
                        Text(repo)
                            .font(.subheadline.weight(.semibold))
                        Text("Connected via FeedbackKit GitHub App")
                            .font(.caption2)
                            .foregroundColor(.secondary)
                    }
                    Spacer()
                    Image(systemName: "checkmark.seal.fill")
                        .foregroundColor(.green)
                }
                .padding(12)
                .background(Color(UIColor.systemBackground))
                .clipShape(RoundedRectangle(cornerRadius: 8, style: .continuous))

                HStack(spacing: 10) {
                    Button {
                        isConnectRepoSheetPresented = true
                    } label: {
                        HStack(spacing: 4) {
                            Image(systemName: "arrow.triangle.2.circlepath")
                            Text("Change")
                        }
                        .font(.caption.weight(.semibold))
                        .padding(.horizontal, 10)
                        .padding(.vertical, 6)
                        .background(Color(UIColor.tertiarySystemFill))
                        .foregroundColor(.primary)
                        .clipShape(Capsule())
                    }

                    Button(role: .destructive) {
                        showDisconnectConfirmation = true
                    } label: {
                        HStack(spacing: 4) {
                            Image(systemName: "link.badge.plus")
                            Text("Disconnect")
                        }
                        .font(.caption.weight(.semibold))
                        .padding(.horizontal, 10)
                        .padding(.vertical, 6)
                        .background(Color.red.opacity(0.1))
                        .foregroundColor(.red)
                        .clipShape(Capsule())
                    }
                }
            } else {
                Text("No repository connected. Connect a GitHub repository to auto-create GitHub issues from bug reports.")
                    .font(.caption)
                    .foregroundColor(.secondary)

                Button {
                    isConnectRepoSheetPresented = true
                } label: {
                    HStack(spacing: 6) {
                        Image(systemName: "link")
                        Text("Connect Repository")
                    }
                    .font(.caption.weight(.semibold))
                    .padding(.horizontal, 12)
                    .padding(.vertical, 7)
                    .background(Color.accentColor)
                    .foregroundColor(.white)
                    .clipShape(Capsule())
                }
            }
        }
        .padding(14)
        .background(Color(UIColor.secondarySystemGroupedBackground))
        .clipShape(RoundedRectangle(cornerRadius: 12, style: .continuous))
    }

    private var deleteProjectSection: some View {
        Button(role: .destructive) {
            showDeleteConfirmation = true
        } label: {
            HStack {
                Spacer()
                Image(systemName: "trash")
                Text("Delete Project")
                Spacer()
            }
            .font(.subheadline.weight(.semibold))
            .padding(.vertical, 12)
            .background(Color.red.opacity(0.1))
            .foregroundColor(.red)
            .clipShape(RoundedRectangle(cornerRadius: 10, style: .continuous))
        }
        .padding(.top, 10)
    }

    private func disconnectRepo() {
        Task {
            do {
                try await appState.updateProjectGitHubRepo(projectId: currentProject.id, githubRepo: nil)
                UINotificationFeedbackGenerator().notificationOccurred(.success)
            } catch {
                UINotificationFeedbackGenerator().notificationOccurred(.error)
            }
        }
    }

    private func deleteProject() {
        isDeleting = true
        Task {
            do {
                try await SupabasePortalClient.shared.deleteProject(id: currentProject.id)
                await appState.loadProjects()
                dismiss()
            } catch {
                isDeleting = false
            }
        }
    }
}
