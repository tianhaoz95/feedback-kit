import SwiftUI

public struct MergedPromptSheet: View {
    @EnvironmentObject private var appState: AppState
    @Environment(\.dismiss) private var dismiss
    public let selectedItems: [PortalFeedbackItem]
    public let templateText: String?

    @State private var didCopy = false
    @State private var isTriggeringAgent = false
    @State private var triggerError: String? = nil

    public init(selectedItems: [PortalFeedbackItem], templateText: String? = nil) {
        self.selectedItems = selectedItems
        self.templateText = templateText
    }

    private var currentSelectedItems: [PortalFeedbackItem] {
        let ids = Set(selectedItems.map(\.id))
        let items = appState.feedbackItems.filter { ids.contains($0.id) }
        return items.isEmpty ? selectedItems : items
    }

    private var mergedPrompt: String {
        PromptGenerator.renderMergedPrompt(items: currentSelectedItems, templateText: templateText)
    }

    private var linkedItems: [PortalFeedbackItem] {
        currentSelectedItems.filter { $0.githubIssueUrl != nil }
    }

    private var sharedIssue: PortalFeedbackItem? {
        if linkedItems.count == currentSelectedItems.count,
           !currentSelectedItems.isEmpty,
           Set(linkedItems.compactMap(\.githubIssueNumber)).count == 1 {
            return currentSelectedItems.first
        }
        return nil
    }

    private var blockedByLinked: Bool {
        sharedIssue == nil && !linkedItems.isEmpty
    }

    public var body: some View {
        NavigationStack {
            ScrollView {
                VStack(alignment: .leading, spacing: 16) {
                    // Explanatory Banner
                    HStack(alignment: .top, spacing: 12) {
                        Image(systemName: "sparkles")
                            .font(.title2)
                            .foregroundColor(.accentColor)

                        VStack(alignment: .leading, spacing: 4) {
                            Text("Coordinated Multi-Issue Prompt")
                                .font(.headline)
                            Text("Consolidates \(currentSelectedItems.count) feedback items into a single instruction set for Cursor or Claude Code, resolving issues without merge conflicts.")
                                .font(.caption)
                                .foregroundColor(.secondary)
                        }
                    }
                    .padding(14)
                    .background(Color(UIColor.secondarySystemGroupedBackground))
                    .clipShape(RoundedRectangle(cornerRadius: 12, style: .continuous))

                    // Coding Agent Build Card
                    codingAgentSection

                    // Included Issues Pills
                    VStack(alignment: .leading, spacing: 8) {
                        Text("Included Issues (\(currentSelectedItems.count))")
                            .font(.caption.weight(.semibold))
                            .foregroundColor(.secondary)

                        ForEach(Array(currentSelectedItems.enumerated()), id: \.offset) { idx, item in
                            HStack(spacing: 8) {
                                Text("\(idx + 1)")
                                    .font(.caption2.bold())
                                    .frame(width: 18, height: 18)
                                    .background(Color.accentColor.opacity(0.15))
                                    .foregroundColor(.accentColor)
                                    .clipShape(Circle())

                                Text(item.text.isEmpty ? "(No description)" : item.text)
                                    .font(.caption)
                                    .lineLimit(1)

                                Spacer()

                                if let num = item.githubIssueNumber {
                                    Text("#\(num)")
                                        .font(.caption2.weight(.medium))
                                        .padding(.horizontal, 5)
                                        .padding(.vertical, 1)
                                        .background(Color.green.opacity(0.15))
                                        .foregroundColor(.green)
                                        .clipShape(RoundedRectangle(cornerRadius: 4, style: .continuous))
                                }

                                if let screen = item.environment.screenName {
                                    Text(screen)
                                        .font(.caption2)
                                        .foregroundColor(.secondary)
                                }
                            }
                            .padding(.horizontal, 10)
                            .padding(.vertical, 6)
                            .background(Color(UIColor.secondarySystemBackground))
                            .clipShape(RoundedRectangle(cornerRadius: 6, style: .continuous))
                        }
                    }

                    // Prompt Preview
                    VStack(alignment: .leading, spacing: 8) {
                        Text("Generated Prompt Preview")
                            .font(.caption.weight(.semibold))
                            .foregroundColor(.secondary)

                        Text(mergedPrompt)
                            .font(.system(.caption, design: .monospaced))
                            .padding(12)
                            .frame(maxWidth: .infinity, alignment: .leading)
                            .background(Color(UIColor.systemBackground))
                            .clipShape(RoundedRectangle(cornerRadius: 10, style: .continuous))
                            .overlay(
                                RoundedRectangle(cornerRadius: 10, style: .continuous)
                                    .stroke(Color(UIColor.separator).opacity(0.5), lineWidth: 0.5)
                            )
                    }

                    // Bottom Copy / Share Bar
                    HStack(spacing: 12) {
                        Button {
                            UIPasteboard.general.string = mergedPrompt
                            UIImpactFeedbackGenerator(style: .medium).impactOccurred()
                            didCopy = true
                            DispatchQueue.main.asyncAfter(deadline: .now() + 2) {
                                didCopy = false
                            }
                        } label: {
                            HStack(spacing: 6) {
                                Image(systemName: didCopy ? "checkmark" : "doc.on.doc.fill")
                                Text(didCopy ? "Copied!" : "Copy Merged Prompt")
                            }
                            .font(.subheadline.weight(.semibold))
                            .frame(maxWidth: .infinity)
                            .padding(.vertical, 12)
                            .background(Color.accentColor)
                            .foregroundColor(.white)
                            .clipShape(RoundedRectangle(cornerRadius: 10, style: .continuous))
                        }

                        ShareLink(item: mergedPrompt) {
                            HStack(spacing: 6) {
                                Image(systemName: "square.and.arrow.up")
                                Text("Share")
                            }
                            .font(.subheadline.weight(.semibold))
                            .padding(.horizontal, 20)
                            .padding(.vertical, 12)
                            .background(Color(UIColor.secondarySystemBackground))
                            .foregroundColor(.primary)
                            .clipShape(RoundedRectangle(cornerRadius: 10, style: .continuous))
                        }
                    }
                    .padding(.top, 4)
                }
                .padding(16)
            }
            .navigationTitle("Merged AI Prompt")
            .navigationBarTitleDisplayMode(.inline)
            .toolbar {
                ToolbarItem(placement: .cancellationAction) {
                    Button("Done") {
                        dismiss()
                    }
                }
            }
        }
    }

    private var codingAgentSection: some View {
        VStack(alignment: .leading, spacing: 10) {
            HStack {
                Label("Coding Agent Build", systemImage: "sparkles")
                    .font(.headline)
                    .foregroundColor(.primary)
                Spacer()
            }

            Text("Creates a coordinated GitHub issue and triggers your configured coding agent to resolve all \(currentSelectedItems.count) reports together.")
                .font(.caption)
                .foregroundColor(.secondary)

            if let shared = sharedIssue, let issueUrl = shared.githubIssueUrl, let issueNum = shared.githubIssueNumber {
                VStack(spacing: 8) {
                    HStack {
                        HStack(spacing: 6) {
                            Image(systemName: "exclamationmark.circle.fill")
                                .foregroundColor(.green)
                            Text("Issue #\(issueNum)")
                                .font(.subheadline.weight(.semibold))
                        }
                        Spacer()
                        if let url = URL(string: issueUrl) {
                            Link(destination: url) {
                                HStack(spacing: 4) {
                                    Text("View on GitHub")
                                    Image(systemName: "arrow.up.right")
                                }
                                .font(.caption.weight(.semibold))
                                .foregroundColor(.accentColor)
                            }
                        }
                    }
                    .padding(10)
                    .background(Color(UIColor.systemBackground))
                    .clipShape(RoundedRectangle(cornerRadius: 8, style: .continuous))

                    Button {
                        triggerAgentBuild(redispatch: true)
                    } label: {
                        HStack(spacing: 6) {
                            if isTriggeringAgent {
                                ProgressView()
                                    .tint(.white)
                            } else {
                                Image(systemName: "sparkles")
                                Text("Trigger Agent Build Again")
                            }
                        }
                        .font(.subheadline.weight(.semibold))
                        .frame(maxWidth: .infinity)
                        .padding(.vertical, 11)
                        .background(Color.purple)
                        .foregroundColor(.white)
                        .clipShape(RoundedRectangle(cornerRadius: 10, style: .continuous))
                    }
                    .disabled(isTriggeringAgent)
                }
            } else if blockedByLinked {
                HStack(alignment: .top, spacing: 8) {
                    Image(systemName: "exclamationmark.triangle.fill")
                        .foregroundColor(.orange)
                        .font(.subheadline)
                    Text("\(linkedItems.count) of these reports already \(linkedItems.count == 1 ? "has its own GitHub issue" : "have their own GitHub issues"). Remove \(linkedItems.count == 1 ? "it" : "them") from the batch to open one issue and trigger the agent for the rest.")
                        .font(.caption)
                        .foregroundColor(.secondary)
                }
                .padding(10)
                .frame(maxWidth: .infinity, alignment: .leading)
                .background(Color.orange.opacity(0.1))
                .clipShape(RoundedRectangle(cornerRadius: 8, style: .continuous))
            } else {
                Button {
                    triggerAgentBuild(redispatch: false)
                } label: {
                    HStack(spacing: 6) {
                        if isTriggeringAgent {
                            ProgressView()
                                .tint(.white)
                        } else {
                            Image(systemName: "sparkles")
                            Text("Trigger Agent Build (\(currentSelectedItems.count))")
                        }
                    }
                    .font(.subheadline.weight(.semibold))
                    .frame(maxWidth: .infinity)
                    .padding(.vertical, 11)
                    .background(appState.selectedProject?.githubRepo != nil ? Color.purple : Color.secondary.opacity(0.3))
                    .foregroundColor(.white)
                    .clipShape(RoundedRectangle(cornerRadius: 10, style: .continuous))
                }
                .disabled(isTriggeringAgent || appState.selectedProject?.githubRepo == nil)

                if appState.selectedProject?.githubRepo == nil {
                    Text("No GitHub repository connected. Connect one in Project Settings to trigger agent builds.")
                        .font(.caption2)
                        .foregroundColor(.secondary)
                }
            }

            if let err = triggerError {
                Text(err)
                    .font(.caption2)
                    .foregroundColor(.red)
            }
        }
        .padding(14)
        .background(Color(UIColor.secondarySystemGroupedBackground))
        .clipShape(RoundedRectangle(cornerRadius: 12, style: .continuous))
    }

    private func triggerAgentBuild(redispatch: Bool) {
        isTriggeringAgent = true
        triggerError = nil

        Task {
            do {
                _ = try await appState.triggerMergedAgentBuild(
                    items: currentSelectedItems,
                    prompt: mergedPrompt,
                    redispatch: redispatch
                )
                UINotificationFeedbackGenerator().notificationOccurred(.success)
            } catch {
                triggerError = error.localizedDescription
                UINotificationFeedbackGenerator().notificationOccurred(.error)
            }
            isTriggeringAgent = false
        }
    }
}
