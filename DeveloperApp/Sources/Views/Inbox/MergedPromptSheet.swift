import SwiftUI

public struct MergedPromptSheet: View {
    @Environment(\.dismiss) private var dismiss
    public let selectedItems: [PortalFeedbackItem]
    public let templateText: String?

    @State private var didCopy = false

    public init(selectedItems: [PortalFeedbackItem], templateText: String? = nil) {
        self.selectedItems = selectedItems
        self.templateText = templateText
    }

    private var mergedPrompt: String {
        PromptGenerator.renderMergedPrompt(items: selectedItems, templateText: templateText)
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
                            Text("Consolidates \(selectedItems.count) feedback items into a single instruction set for Cursor or Claude Code, resolving issues without merge conflicts.")
                                .font(.caption)
                                .foregroundColor(.secondary)
                        }
                    }
                    .padding(14)
                    .background(Color(UIColor.secondarySystemGroupedBackground))
                    .clipShape(RoundedRectangle(cornerRadius: 12, style: .continuous))

                    // Included Issues Pills
                    VStack(alignment: .leading, spacing: 8) {
                        Text("Included Issues (\(selectedItems.count))")
                            .font(.caption.weight(.semibold))
                            .foregroundColor(.secondary)

                        ForEach(Array(selectedItems.enumerated()), id: \.offset) { idx, item in
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
}
