import SwiftUI
import FeedbackKit

public struct ProjectDetailView: View {
    @EnvironmentObject private var appState: AppState
    @Environment(\.dismiss) private var dismiss

    public let project: PortalProject

    @State private var isKeyRevealed = false
    @State private var didCopyKey = false
    @State private var isTemplateEditorPresented = false
    @State private var templateText: String = PromptGenerator.defaultTemplate
    @State private var showDeleteConfirmation = false
    @State private var isDeleting = false

    public init(project: PortalProject) {
        self.project = project
    }

    public var body: some View {
        ScrollView {
            VStack(alignment: .leading, spacing: 20) {
                // Project Key Card
                projectKeyCard

                // Project Stats
                projectStatsCard

                // Prompt Template Card
                promptTemplateCard

                // GitHub Integration Card
                gitHubCard

                // Danger Zone: Delete Project
                deleteProjectSection
            }
            .padding(16)
        }
        .navigationTitle(project.name)
        .navigationBarTitleDisplayMode(.inline)
        .task {
            if let tpl = try? await SupabasePortalClient.shared.fetchPromptTemplate(projectId: project.id) {
                templateText = tpl.templateText
            }
        }
        .sheet(isPresented: $isTemplateEditorPresented) {
            PromptTemplateEditorView(projectId: project.id, initialText: templateText)
        }
        .confirmationDialog(
            "Delete \(project.name)?",
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
                Text(isKeyRevealed ? project.projectKey : String(repeating: "•", count: 24))
                    .font(.system(.subheadline, design: .monospaced))
                    .lineLimit(1)
                    .foregroundColor(.primary)

                Spacer()

                Button {
                    UIPasteboard.general.string = project.projectKey
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

    private var projectStatsCard: some View {
        VStack(alignment: .leading, spacing: 10) {
            Text("Overview")
                .font(.headline)

            HStack(spacing: 12) {
                statTile(title: "Total Reports", value: "\(project.feedbackCount)", color: .primary)
                statTile(title: "Unresolved", value: "\(project.unresolvedCount)", color: .orange)
                statTile(title: "Resolved", value: "\(max(0, project.feedbackCount - project.unresolvedCount))", color: .green)
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
        VStack(alignment: .leading, spacing: 10) {
            HStack {
                Label("GitHub Repository", systemImage: "chevron.left.forwardslash.chevron.right")
                    .font(.headline)
                Spacer()
            }

            if let repo = project.githubRepo {
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
            } else {
                Text("No repository connected. You can link a repository via the FeedbackKit web portal to auto-create GitHub issues from bug reports.")
                    .font(.caption)
                    .foregroundColor(.secondary)
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

    private func deleteProject() {
        isDeleting = true
        Task {
            do {
                try await SupabasePortalClient.shared.deleteProject(id: project.id)
                await appState.loadProjects()
                dismiss()
            } catch {
                isDeleting = false
            }
        }
    }
}
