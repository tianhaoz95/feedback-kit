import SwiftUI
import FeedbackKit

public struct FeedbackDetailView: View {
    @EnvironmentObject private var appState: AppState
    @Environment(\.dismiss) private var dismiss

    public let item: PortalFeedbackItem

    @State private var isCreatingIssue = false
    @State private var issueError: String? = nil
    @State private var isPromptEditorPresented = false
    @State private var didCopyPrompt = false
    @State private var showDeleteConfirmation = false

    public init(item: PortalFeedbackItem) {
        self.item = item
    }

    private var currentItem: PortalFeedbackItem {
        appState.feedbackItems.first(where: { $0.id == item.id }) ?? item
    }

    private var promptText: String {
        if let custom = currentItem.editedPrompt, !custom.isEmpty {
            return custom
        }
        return PromptGenerator.renderPrompt(
            template: appState.promptTemplate?.templateText ?? PromptGenerator.defaultTemplate,
            feedback: currentItem,
            screenshotUrl: currentItem.signedScreenshotUrl,
            attachmentUrl: currentItem.signedAttachmentUrl
        )
    }

    public var body: some View {
        ScrollView {
            VStack(alignment: .leading, spacing: 20) {
                // Status & Quick Actions Bar
                statusBar

                // User Feedback Text Quote Card
                feedbackTextCard

                // Screenshot & Annotations (if screenshot exists)
                if currentItem.screenshotAnnotatedPath != nil || currentItem.screenshotRawPath != nil {
                    ZoomableScreenshotView(item: currentItem)
                }

                // Attachment Section (if attached)
                if let filename = currentItem.attachmentFilename {
                    attachmentSection(filename: filename)
                }

                // Environment & Diagnostics
                EnvironmentSectionView(env: currentItem.environment)

                // Console & network logs (web SDK reports only)
                if !currentItem.logs.isEmpty {
                    ConsoleLogsSectionView(logs: currentItem.logs)
                }

                // Closed loop: agent → PR → release → reporter verifies
                FixLoopSectionView(item: currentItem)

                // AI Prompt Generator Section
                aiPromptSection

                // GitHub Issue Section
                gitHubIssueSection

                // Danger Zone / Delete
                deleteSection
            }
            .padding(16)
        }
        .navigationTitle(currentItem.environment.screenName.map { "\($0)" } ?? "Feedback Details")
        .navigationBarTitleDisplayMode(.inline)
        .toolbar {
            ToolbarItem(placement: .topBarTrailing) {
                Menu {
                    Button {
                        Task {
                            await appState.toggleArchive(item: currentItem)
                        }
                    } label: {
                        Label(
                            currentItem.isArchived ? "Unarchive" : "Archive",
                            systemImage: currentItem.isArchived ? "tray.and.arrow.up" : "archivebox"
                        )
                    }

                    Button(role: .destructive) {
                        showDeleteConfirmation = true
                    } label: {
                        Label("Delete Report", systemImage: "trash")
                    }
                } label: {
                    Image(systemName: "ellipsis.circle")
                }
            }
        }
        .alert(
            "Delete this feedback report?",
            isPresented: $showDeleteConfirmation
        ) {
            Button("Cancel", role: .cancel) {}
            Button("Delete", role: .destructive) {
                Task {
                    await appState.delete(item: currentItem)
                    dismiss()
                }
            }
        } message: {
            Text("This action cannot be undone.")
        }
        .sheet(isPresented: $isPromptEditorPresented) {
            PromptEditorSheet(item: currentItem, initialPrompt: promptText) { edited in
                Task {
                    try? await SupabasePortalClient.shared.saveEditedPrompt(id: currentItem.id, prompt: edited)
                    if let idx = appState.feedbackItems.firstIndex(where: { $0.id == currentItem.id }) {
                        appState.feedbackItems[idx].editedPrompt = edited
                    }
                }
            }
        }
        .onAppear {
            FeedbackKit.currentScreen = "Feedback Detail"
        }
    }

    // MARK: - Subviews

    private var statusBar: some View {
        VStack(alignment: .leading, spacing: 10) {
            HStack {
                Text("Status")
                    .font(.caption.weight(.semibold))
                    .foregroundColor(.secondary)
                Spacer()
                Text(PortalDateFormatter.formatShort(currentItem.createdAt))
                    .font(.caption2)
                    .foregroundColor(.secondary)
            }

            HStack(spacing: 8) {
                ForEach(PortalFeedbackStatus.allCases) { status in
                    let isSelected = currentItem.status == status
                    Button {
                        Task {
                            await appState.updateStatus(item: currentItem, to: status)
                        }
                    } label: {
                        HStack(spacing: 4) {
                            Image(systemName: status.iconName)
                                .font(.system(size: 11, weight: .bold))
                            Text(status.displayName)
                                .font(.caption2.weight(isSelected ? .bold : .medium))
                        }
                        .frame(maxWidth: .infinity)
                        .padding(.vertical, 8)
                        .background(isSelected ? Color.accentColor : Color(UIColor.secondarySystemBackground))
                        .foregroundColor(isSelected ? .white : .primary)
                        .clipShape(RoundedRectangle(cornerRadius: 8, style: .continuous))
                    }
                }
            }
        }
        .padding(12)
        .background(Color(UIColor.secondarySystemGroupedBackground))
        .clipShape(RoundedRectangle(cornerRadius: 12, style: .continuous))
    }

    private var feedbackTextCard: some View {
        VStack(alignment: .leading, spacing: 8) {
            HStack {
                Label("User Report", systemImage: "bubble.left.and.bubble.right.fill")
                    .font(.caption.weight(.semibold))
                    .foregroundColor(.accentColor)
                Spacer()
                if currentItem.isArchived {
                    Text("ARCHIVED")
                        .font(.system(size: 9, weight: .bold))
                        .padding(.horizontal, 6)
                        .padding(.vertical, 2)
                        .background(Color.secondary.opacity(0.2))
                        .foregroundColor(.secondary)
                        .clipShape(Capsule())
                }
            }

            Text(currentItem.text.isEmpty ? "(No text description provided)" : currentItem.text)
                .font(.body)
                .foregroundColor(currentItem.text.isEmpty ? .secondary : .primary)
                .fixedSize(horizontal: false, vertical: true)
        }
        .padding(14)
        .frame(maxWidth: .infinity, alignment: .leading)
        .background(Color(UIColor.secondarySystemGroupedBackground))
        .clipShape(RoundedRectangle(cornerRadius: 12, style: .continuous))
    }

    private func attachmentSection(filename: String) -> some View {
        VStack(alignment: .leading, spacing: 8) {
            Text("Attachment")
                .font(.headline)

            HStack {
                Image(systemName: "paperclip")
                    .font(.subheadline)
                    .foregroundColor(.accentColor)
                VStack(alignment: .leading, spacing: 2) {
                    Text(filename)
                        .font(.subheadline.weight(.semibold))
                    if let mime = currentItem.attachmentMimeType {
                        Text(mime)
                            .font(.caption2)
                            .foregroundColor(.secondary)
                    }
                }
                Spacer()

                if let urlStr = currentItem.signedAttachmentUrl, let url = URL(string: urlStr) {
                    ShareLink(item: url) {
                        Image(systemName: "square.and.arrow.up")
                            .font(.subheadline)
                            .padding(8)
                            .background(Color(UIColor.secondarySystemBackground))
                            .clipShape(Circle())
                    }
                }
            }
            .padding(12)
            .background(Color(UIColor.secondarySystemGroupedBackground))
            .clipShape(RoundedRectangle(cornerRadius: 10, style: .continuous))
        }
    }

    private var aiPromptSection: some View {
        VStack(alignment: .leading, spacing: 10) {
            HStack {
                Label("AI Coding Agent Prompt", systemImage: "sparkles")
                    .font(.headline)
                    .foregroundColor(.primary)
                Spacer()

                Button {
                    isPromptEditorPresented = true
                } label: {
                    HStack(spacing: 3) {
                        Image(systemName: "pencil")
                        Text("Customize")
                    }
                    .font(.caption.weight(.semibold))
                    .foregroundColor(.accentColor)
                }
            }

            Text("Feed this prompt directly to Cursor, Claude Code, or Antigravity to reproduce and fix this issue.")
                .font(.caption)
                .foregroundColor(.secondary)

            // Monospaced prompt card
            VStack(alignment: .leading, spacing: 10) {
                Text(promptText)
                    .font(.system(.caption, design: .monospaced))
                    .foregroundColor(.primary)
                    .lineLimit(8)
                    .padding(10)
                    .frame(maxWidth: .infinity, alignment: .leading)
                    .background(Color(UIColor.systemBackground))
                    .clipShape(RoundedRectangle(cornerRadius: 8, style: .continuous))

                // Actions: Copy & Share
                HStack(spacing: 12) {
                    Button {
                        UIPasteboard.general.string = promptText
                        UIImpactFeedbackGenerator(style: .medium).impactOccurred()
                        didCopyPrompt = true
                        DispatchQueue.main.asyncAfter(deadline: .now() + 2) {
                            didCopyPrompt = false
                        }
                    } label: {
                        HStack(spacing: 6) {
                            Image(systemName: didCopyPrompt ? "checkmark" : "doc.on.doc.fill")
                            Text(didCopyPrompt ? "Copied!" : "Copy Prompt")
                        }
                        .font(.subheadline.weight(.semibold))
                        .frame(maxWidth: .infinity)
                        .padding(.vertical, 10)
                        .background(Color.accentColor)
                        .foregroundColor(.white)
                        .clipShape(RoundedRectangle(cornerRadius: 8, style: .continuous))
                    }

                    ShareLink(item: promptText) {
                        HStack(spacing: 6) {
                            Image(systemName: "square.and.arrow.up")
                            Text("Share")
                        }
                        .font(.subheadline.weight(.semibold))
                        .padding(.horizontal, 16)
                        .padding(.vertical, 10)
                        .background(Color(UIColor.secondarySystemBackground))
                        .foregroundColor(.primary)
                        .clipShape(RoundedRectangle(cornerRadius: 8, style: .continuous))
                    }
                }
            }
            .padding(12)
            .background(Color(UIColor.secondarySystemGroupedBackground))
            .clipShape(RoundedRectangle(cornerRadius: 12, style: .continuous))
        }
    }

    private var gitHubIssueSection: some View {
        VStack(alignment: .leading, spacing: 8) {
            Text("GitHub Issue")
                .font(.headline)

            if let issueUrl = currentItem.githubIssueUrl, let issueNum = currentItem.githubIssueNumber {
                HStack {
                    HStack(spacing: 6) {
                        Image(systemName: "exclamationmark.circle.fill")
                            .foregroundColor(.green)
                        Text("Issue #\(issueNum)")
                            .font(.subheadline.weight(.semibold))
                    }
                    Spacer()

                    Link(destination: URL(string: issueUrl)!) {
                        HStack(spacing: 4) {
                            Text("View on GitHub")
                            Image(systemName: "arrow.up.right")
                        }
                        .font(.caption.weight(.semibold))
                        .foregroundColor(.accentColor)
                    }
                }
                .padding(12)
                .background(Color(UIColor.secondarySystemGroupedBackground))
                .clipShape(RoundedRectangle(cornerRadius: 10, style: .continuous))
            } else {
                Button {
                    createGitHubIssue()
                } label: {
                    HStack {
                        if isCreatingIssue {
                            ProgressView()
                                .tint(.primary)
                        } else {
                            Image(systemName: "plus.circle")
                            Text("Create GitHub Issue")
                        }
                    }
                    .font(.subheadline.weight(.semibold))
                    .frame(maxWidth: .infinity)
                    .padding(.vertical, 10)
                    .background(Color(UIColor.secondarySystemGroupedBackground))
                    .foregroundColor(.primary)
                    .clipShape(RoundedRectangle(cornerRadius: 10, style: .continuous))
                }
                .disabled(isCreatingIssue)

                if let err = issueError {
                    Text(err)
                        .font(.caption2)
                        .foregroundColor(.red)
                }
            }
        }
    }

    private var deleteSection: some View {
        Button(role: .destructive) {
            showDeleteConfirmation = true
        } label: {
            HStack {
                Spacer()
                Image(systemName: "trash")
                Text("Delete Feedback Report")
                Spacer()
            }
            .font(.subheadline.weight(.medium))
            .padding(.vertical, 12)
            .background(Color.red.opacity(0.1))
            .foregroundColor(.red)
            .clipShape(RoundedRectangle(cornerRadius: 10, style: .continuous))
        }
        .padding(.top, 10)
    }

    private func createGitHubIssue() {
        guard let proj = appState.selectedProject else { return }
        isCreatingIssue = true
        issueError = nil

        Task {
            do {
                let (url, num) = try await SupabasePortalClient.shared.createGitHubIssue(
                    feedbackId: currentItem.id,
                    projectId: proj.id
                )
                if let idx = appState.feedbackItems.firstIndex(where: { $0.id == currentItem.id }) {
                    appState.feedbackItems[idx].githubIssueUrl = url
                    appState.feedbackItems[idx].githubIssueNumber = num
                    appState.feedbackItems[idx].status = .inProgress
                }
                UINotificationFeedbackGenerator().notificationOccurred(.success)
            } catch {
                issueError = error.localizedDescription
                UINotificationFeedbackGenerator().notificationOccurred(.error)
            }
            isCreatingIssue = false
        }
    }
}
