import SwiftUI
import FeedbackKit

/// Dedicated screen for AI Coding Agent Prompt preview, copying, and editing.
public struct PromptDetailView: View {
    public let item: PortalFeedbackItem

    @EnvironmentObject private var appState: AppState
    @State private var selectedTab: Tab = .preview
    @State private var editText: String = ""
    @State private var isSaving = false
    @State private var didCopy = false
    @State private var saveMessage: String? = nil

    public enum Tab: String, CaseIterable, Identifiable {
        case preview = "Preview"
        case edit = "Edit"
        public var id: String { rawValue }
    }

    public init(item: PortalFeedbackItem) {
        self.item = item
    }

    private var currentItem: PortalFeedbackItem {
        appState.feedbackItems.first(where: { $0.id == item.id }) ?? item
    }

    private var defaultGeneratedPrompt: String {
        PromptGenerator.renderPrompt(
            template: appState.promptTemplate?.templateText ?? PromptGenerator.defaultTemplate,
            feedback: currentItem,
            screenshotUrl: currentItem.signedScreenshotUrl,
            attachmentUrl: currentItem.signedAttachmentUrl
        )
    }

    private var activePrompt: String {
        if let custom = currentItem.editedPrompt, !custom.isEmpty {
            return custom
        }
        return defaultGeneratedPrompt
    }

    public var body: some View {
        VStack(spacing: 0) {
            Picker("Mode", selection: $selectedTab) {
                ForEach(Tab.allCases) { tab in
                    Text(tab.rawValue).tag(tab)
                }
            }
            .pickerStyle(.segmented)
            .padding(.horizontal, 16)
            .padding(.vertical, 10)
            .background(Color(UIColor.systemBackground))

            Divider()

            switch selectedTab {
            case .preview:
                previewView
            case .edit:
                editorView
            }
        }
        .navigationTitle("AI Coding Agent Prompt")
        .navigationBarTitleDisplayMode(.inline)
        .toolbar {
            ToolbarItem(placement: .topBarTrailing) {
                Button {
                    copyToClipboard()
                } label: {
                    Image(systemName: didCopy ? "checkmark" : "doc.on.doc")
                }
                .help("Copy Prompt")
            }
            ToolbarItem(placement: .topBarTrailing) {
                ShareLink(item: activePrompt) {
                    Image(systemName: "square.and.arrow.up")
                }
                .help("Share Prompt")
            }
        }
        .onAppear {
            FeedbackKit.currentScreen = "Prompt Detail"
            editText = activePrompt
        }
    }

    // MARK: - Preview View

    private var previewView: some View {
        ScrollView {
            VStack(alignment: .leading, spacing: 14) {
                HStack(spacing: 8) {
                    Image(systemName: "info.circle")
                        .foregroundColor(.secondary)
                    Text("Feed this prompt directly to Cursor, Claude Code, or Antigravity to reproduce and fix this issue.")
                        .font(.caption)
                        .foregroundColor(.secondary)
                }
                .padding(.horizontal, 4)

                // Prompt content block
                VStack(alignment: .leading, spacing: 8) {
                    HStack {
                        if currentItem.editedPrompt != nil {
                            Label("Customized Prompt", systemImage: "pencil")
                                .font(.caption2.weight(.semibold))
                                .foregroundColor(.purple)
                        } else {
                            Label("Generated Prompt", systemImage: "sparkles")
                                .font(.caption2.weight(.semibold))
                                .foregroundColor(.secondary)
                        }
                        Spacer()
                    }

                    Text(activePrompt)
                        .font(.system(.caption, design: .monospaced))
                        .foregroundColor(.primary)
                        .textSelection(.enabled)
                        .frame(maxWidth: .infinity, alignment: .leading)
                        .padding(12)
                        .background(Color(UIColor.systemBackground))
                        .clipShape(RoundedRectangle(cornerRadius: 10, style: .continuous))
                }
                .padding(12)
                .background(Color(UIColor.secondarySystemGroupedBackground))
                .clipShape(RoundedRectangle(cornerRadius: 12, style: .continuous))

                // Actions
                HStack(spacing: 12) {
                    Button {
                        copyToClipboard()
                    } label: {
                        HStack(spacing: 6) {
                            Image(systemName: didCopy ? "checkmark" : "doc.on.doc.fill")
                            Text(didCopy ? "Copied!" : "Copy Prompt")
                        }
                        .font(.subheadline.weight(.semibold))
                        .frame(maxWidth: .infinity)
                        .padding(.vertical, 12)
                        .background(Color.accentColor)
                        .foregroundColor(.white)
                        .clipShape(RoundedRectangle(cornerRadius: 10, style: .continuous))
                    }

                    Button {
                        editText = activePrompt
                        withAnimation {
                            selectedTab = .edit
                        }
                    } label: {
                        HStack(spacing: 6) {
                            Image(systemName: "pencil")
                            Text("Edit")
                        }
                        .font(.subheadline.weight(.semibold))
                        .padding(.horizontal, 20)
                        .padding(.vertical, 12)
                        .background(Color(UIColor.secondarySystemBackground))
                        .foregroundColor(.primary)
                        .clipShape(RoundedRectangle(cornerRadius: 10, style: .continuous))
                    }
                }
            }
            .padding(16)
        }
    }

    // MARK: - Editor View

    private var editorView: some View {
        VStack(spacing: 0) {
            // Quick placeholder insertion chips
            ScrollView(.horizontal, showsIndicators: false) {
                HStack(spacing: 8) {
                    Text("Insert:")
                        .font(.caption2.weight(.medium))
                        .foregroundColor(.secondary)

                    ForEach(PromptGenerator.placeholders, id: \.self) { placeholder in
                        Button {
                            editText += "{{\(placeholder)}}"
                            UIImpactFeedbackGenerator(style: .light).impactOccurred()
                        } label: {
                            Text("{{\(placeholder)}}")
                                .font(.caption2.monospaced())
                                .padding(.horizontal, 8)
                                .padding(.vertical, 4)
                                .background(Color(UIColor.secondarySystemBackground))
                                .foregroundColor(.accentColor)
                                .clipShape(Capsule())
                        }
                    }
                }
                .padding(.horizontal, 16)
                .padding(.vertical, 8)
            }

            Divider()

            TextEditor(text: $editText)
                .font(.system(.body, design: .monospaced))
                .padding(.horizontal, 12)
                .padding(.vertical, 8)
                .frame(maxWidth: .infinity, maxHeight: .infinity)

            Divider()

            // Save & Revert bar
            HStack(spacing: 12) {
                if currentItem.editedPrompt != nil {
                    Button(role: .destructive) {
                        resetToDefault()
                    } label: {
                        Text("Reset to Default")
                            .font(.caption.weight(.medium))
                    }
                }

                Spacer()

                if let saveMessage {
                    Text(saveMessage)
                        .font(.caption)
                        .foregroundColor(.green)
                }

                Button {
                    Task { await savePrompt() }
                } label: {
                    if isSaving {
                        ProgressView()
                            .padding(.horizontal, 16)
                    } else {
                        Text("Save Changes")
                            .font(.subheadline.weight(.semibold))
                            .padding(.horizontal, 16)
                            .padding(.vertical, 8)
                            .background(Color.accentColor)
                            .foregroundColor(.white)
                            .clipShape(RoundedRectangle(cornerRadius: 8, style: .continuous))
                    }
                }
                .disabled(isSaving || editText == activePrompt)
            }
            .padding(.horizontal, 16)
            .padding(.vertical, 10)
            .background(Color(UIColor.secondarySystemGroupedBackground))
        }
    }

    // MARK: - Actions

    private func copyToClipboard() {
        UIPasteboard.general.string = activePrompt
        UIImpactFeedbackGenerator(style: .medium).impactOccurred()
        didCopy = true
        DispatchQueue.main.asyncAfter(deadline: .now() + 2) {
            didCopy = false
        }
    }

    private func savePrompt() async {
        isSaving = true
        saveMessage = nil
        defer { isSaving = false }

        do {
            try await SupabasePortalClient.shared.saveEditedPrompt(id: currentItem.id, prompt: editText)
            if let idx = appState.feedbackItems.firstIndex(where: { $0.id == currentItem.id }) {
                appState.feedbackItems[idx].editedPrompt = editText
            }
            UINotificationFeedbackGenerator().notificationOccurred(.success)
            saveMessage = "Saved!"
            DispatchQueue.main.asyncAfter(deadline: .now() + 1.5) {
                saveMessage = nil
                withAnimation {
                    selectedTab = .preview
                }
            }
        } catch {
            saveMessage = "Error: \(error.localizedDescription)"
        }
    }

    private func resetToDefault() {
        Task {
            isSaving = true
            defer { isSaving = false }
            try? await SupabasePortalClient.shared.saveEditedPrompt(id: currentItem.id, prompt: "")
            if let idx = appState.feedbackItems.firstIndex(where: { $0.id == currentItem.id }) {
                appState.feedbackItems[idx].editedPrompt = nil
            }
            editText = defaultGeneratedPrompt
            withAnimation {
                selectedTab = .preview
            }
        }
    }
}
