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
    /// nil while loading. Watching sends every step of this report's fix as a
    /// notification (0023_notify_and_watchlist.sql).
    @State private var isWatching: Bool?
    @State private var attachmentFullScreenContext: FullScreenImageContext?
    @State private var navigateToChat = false

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
        ScrollViewReader { proxy in
            ScrollView {
                VStack(alignment: .leading, spacing: 20) {
                    // Status & Quick Actions Bar
                    statusBar

                    // Send to Coding Agent Section (moved to the top)
                    sendToCodingAgentSection

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

                    // Fix Loop Chat navigation card (moved to separate chat screen)
                    fixLoopNavigationCard
                        .id("fix_loop_section")

                    // AI Prompt Generator Section
                    aiPromptSection

                    // Danger Zone / Delete
                    deleteSection
                }
                .padding(16)
            }
            .navigationTitle(currentItem.environment.screenName.map { "\($0)" } ?? "Feedback Details")
            .navigationBarTitleDisplayMode(.inline)
            .toolbar {
                ToolbarItem(placement: .topBarTrailing) {
                    NavigationLink {
                        FixLoopChatView(item: currentItem)
                    } label: {
                        Image(systemName: "bubble.left.and.bubble.right")
                    }
                    .help("Fix Loop Chat")
                }
                ToolbarItem(placement: .topBarTrailing) {
                    Button {
                        toggleWatching()
                    } label: {
                        Label(isWatching == true ? "Watching" : "Watch", systemImage: isWatching == true ? "eye.fill" : "eye")
                    }
                    .disabled(isWatching == nil)
                    .help(isWatching == true ? "Stop getting notified about this report" : "Get notified about every step of this report's fix")
                }
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
        .fullScreenCover(item: $attachmentFullScreenContext) { ctx in
            FullScreenImageViewer(url: ctx.url, title: ctx.title, caption: ctx.caption)
        }
        .navigationDestination(isPresented: $navigateToChat) {
            FixLoopChatView(item: currentItem)
        }
        .onAppear {
            FeedbackKit.currentScreen = "Feedback Detail"
            if UserDefaults.standard.bool(forKey: "portal_preview_chat") {
                DispatchQueue.main.asyncAfter(deadline: .now() + 0.3) {
                    navigateToChat = true
                }
            } else if UserDefaults.standard.bool(forKey: "portal_preview_scroll_fix_loop") {
                DispatchQueue.main.asyncAfter(deadline: .now() + 0.3) {
                    withAnimation {
                        proxy.scrollTo("fix_loop_section", anchor: .top)
                    }
                }
            }
        }
        .task(id: item.id) {
            isWatching = (try? await SupabasePortalClient.shared.isWatching(feedbackId: item.id)) ?? false
        }
        }
    }

    private func toggleWatching() {
        guard let current = isWatching else { return }
        isWatching = nil
        Task {
            do {
                try await SupabasePortalClient.shared.setWatching(feedbackId: item.id, !current)
                isWatching = !current
            } catch {
                isWatching = current
            }
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

            HStack(spacing: 6) {
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
                                .lineLimit(1)
                                .minimumScaleFactor(0.75)
                        }
                        .frame(maxWidth: .infinity)
                        .frame(height: 32)
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

            VStack(alignment: .leading, spacing: 10) {
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

                if currentItem.attachmentMimeType?.hasPrefix("image/") == true,
                   let urlStr = currentItem.signedAttachmentUrl,
                   let url = URL(string: urlStr) {
                    Button {
                        attachmentFullScreenContext = FullScreenImageContext(url: url, title: filename)
                    } label: {
                        ZStack(alignment: .bottomTrailing) {
                            AsyncImage(url: url) { phase in
                                switch phase {
                                case .success(let image):
                                    image.resizable().scaledToFit()
                                case .failure:
                                    EmptyView()
                                default:
                                    ProgressView()
                                }
                            }
                            .frame(maxHeight: 180)
                            .clipShape(RoundedRectangle(cornerRadius: 8))

                            Image(systemName: "arrow.up.left.and.arrow.down.right")
                                .font(.system(size: 10, weight: .semibold))
                                .foregroundColor(.white)
                                .padding(5)
                                .background(Color.black.opacity(0.6))
                                .clipShape(Circle())
                                .padding(6)
                        }
                    }
                    .buttonStyle(.plain)
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

    private var fixLoopNavigationCard: some View {
        NavigationLink {
            FixLoopChatView(item: currentItem)
        } label: {
            HStack(spacing: 12) {
                Image(systemName: "bubble.left.and.bubble.right.fill")
                    .font(.title3)
                    .foregroundColor(.accentColor)

                VStack(alignment: .leading, spacing: 2) {
                    Text("Fix Loop Chat")
                        .font(.subheadline.weight(.semibold))
                        .foregroundColor(.primary)
                    Text("Timeline, notes & reporter updates")
                        .font(.caption)
                        .foregroundColor(.secondary)
                }

                Spacer()

                if let stage = currentItem.fixStage.flatMap(PortalFixStage.init(rawValue:)) {
                    FixStageBadgeView(stage: stage)
                }

                Image(systemName: "chevron.right")
                    .font(.caption.weight(.semibold))
                    .foregroundColor(.secondary)
            }
            .padding(14)
            .background(Color(UIColor.secondarySystemGroupedBackground))
            .clipShape(RoundedRectangle(cornerRadius: 12, style: .continuous))
        }
        .buttonStyle(.plain)
    }

    private var sendToCodingAgentSection: some View {
        VStack(alignment: .leading, spacing: 10) {
            HStack {
                Label("Send to Coding Agent", systemImage: "sparkles")
                    .font(.headline)
                    .foregroundColor(.primary)
                Spacer()
                if let stage = currentItem.fixStage.flatMap(PortalFixStage.init(rawValue:)) {
                    FixStageBadgeView(stage: stage)
                }
            }

            if let issueUrl = currentItem.githubIssueUrl, let issueNum = currentItem.githubIssueNumber {
                VStack(spacing: 8) {
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

                    Menu {
                        Section("Send to Coding Agent") {
                            ForEach(availableAgentOptions) { option in
                                Button {
                                    createGitHubIssue(redispatch: true, agent: option.id)
                                } label: {
                                    Label(option.name, systemImage: option.systemImage)
                                }
                            }
                        }
                    } label: {
                        HStack(spacing: 6) {
                            if isCreatingIssue {
                                ProgressView()
                                    .tint(.primary)
                            } else {
                                Image(systemName: "sparkles")
                                Text("Send to Coding Agent Again")
                                Spacer()
                                Image(systemName: "chevron.down")
                                    .font(.caption.weight(.semibold))
                                    .foregroundColor(.secondary)
                            }
                        }
                        .font(.subheadline.weight(.semibold))
                        .frame(maxWidth: .infinity)
                        .padding(.vertical, 10)
                        .padding(.horizontal, 14)
                        .background(Color(UIColor.secondarySystemGroupedBackground))
                        .foregroundColor(.primary)
                        .clipShape(RoundedRectangle(cornerRadius: 10, style: .continuous))
                    }
                    .disabled(isCreatingIssue)
                }
            } else {
                Menu {
                    Section("Send to Coding Agent") {
                        ForEach(availableAgentOptions) { option in
                            Button {
                                createGitHubIssue(agent: option.id)
                            } label: {
                                Label("Send to \(option.name)", systemImage: option.systemImage)
                            }
                        }
                    }

                    Section {
                        Button {
                            createGitHubIssue(dispatch: false)
                        } label: {
                            Label("Open GitHub Issue Only", systemImage: "exclamationmark.circle")
                        }
                    }
                } label: {
                    HStack(spacing: 6) {
                        if isCreatingIssue {
                            ProgressView()
                                .tint(.white)
                        } else {
                            Image(systemName: "sparkles")
                            Text("Send to Coding Agent")
                            Spacer()
                            Image(systemName: "chevron.down")
                                .font(.caption.weight(.semibold))
                        }
                    }
                    .font(.subheadline.weight(.semibold))
                    .frame(maxWidth: .infinity)
                    .padding(.vertical, 10)
                    .padding(.horizontal, 14)
                    .background(Color.accentColor)
                    .foregroundColor(.white)
                    .clipShape(RoundedRectangle(cornerRadius: 10, style: .continuous))
                }
                .disabled(isCreatingIssue)
            }

            if let err = issueError {
                Text(err)
                    .font(.caption2)
                    .foregroundColor(.red)
            }
        }
    }

    private struct AgentOptionItem: Identifiable {
        let id: String
        let name: String
        let systemImage: String
    }

    private var availableAgentOptions: [AgentOptionItem] {
        let proj = appState.projects.first(where: { $0.id == currentItem.projectId }) ?? appState.selectedProject
        let labels = proj?.dispatchLabels ?? ["claude", "antigravity"]
        var items: [AgentOptionItem] = []
        for label in labels {
            if label == "claude" {
                items.append(AgentOptionItem(id: "claude", name: "Claude Code", systemImage: "sparkles"))
            } else if label == "antigravity" {
                items.append(AgentOptionItem(id: "antigravity", name: "Antigravity", systemImage: "sparkles"))
            } else {
                items.append(AgentOptionItem(id: label, name: label.capitalized, systemImage: "tag"))
            }
        }
        if proj?.dispatchCopilot == true {
            items.append(AgentOptionItem(id: "copilot", name: "GitHub Copilot", systemImage: "person.badge.shield.checkmark"))
        }
        if items.count > 1 {
            items.append(AgentOptionItem(id: "all", name: "All Configured Agents", systemImage: "square.stack.3d.up"))
        }
        return items
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

    private func createGitHubIssue(redispatch: Bool = false, dispatch: Bool? = nil, agent: String? = nil) {
        guard let proj = appState.projects.first(where: { $0.id == currentItem.projectId }) ?? appState.selectedProject else { return }
        isCreatingIssue = true
        issueError = nil

        Task {
            do {
                let (url, num) = try await SupabasePortalClient.shared.createGitHubIssue(
                    feedbackIds: [currentItem.id],
                    projectId: proj.id,
                    prompt: currentItem.editedPrompt,
                    redispatch: redispatch,
                    dispatch: dispatch,
                    agent: agent
                )
                if let idx = appState.feedbackItems.firstIndex(where: { $0.id == currentItem.id }) {
                    appState.feedbackItems[idx].githubIssueUrl = url
                    appState.feedbackItems[idx].githubIssueNumber = num
                    if dispatch != false {
                        appState.feedbackItems[idx].status = .inProgress
                        appState.feedbackItems[idx].fixStage = PortalFixStage.agentWorking.rawValue
                    }
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
