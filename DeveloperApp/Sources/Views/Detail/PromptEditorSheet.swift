import SwiftUI

public struct PromptEditorSheet: View {
    @Environment(\.dismiss) private var dismiss
    public let item: PortalFeedbackItem
    public let initialPrompt: String
    public let onSave: (String) -> Void

    @State private var text: String
    @State private var isSaving = false

    public init(item: PortalFeedbackItem, initialPrompt: String, onSave: @escaping (String) -> Void) {
        self.item = item
        self.initialPrompt = initialPrompt
        self.onSave = onSave
        self._text = State(initialValue: initialPrompt)
    }

    public var body: some View {
        NavigationStack {
            VStack(spacing: 12) {
                // Quick placeholder insertion chips
                ScrollView(.horizontal, showsIndicators: false) {
                    HStack(spacing: 8) {
                        Text("Insert:")
                            .font(.caption2.weight(.medium))
                            .foregroundColor(.secondary)

                        ForEach(PromptGenerator.placeholders, id: \.self) { placeholder in
                            Button {
                                text += "{{\(placeholder)}}"
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
                    .padding(.vertical, 6)
                }

                Divider()

                TextEditor(text: $text)
                    .font(.system(.body, design: .monospaced))
                    .padding(.horizontal, 12)
                    .frame(maxWidth: .infinity, maxHeight: .infinity)
            }
            .navigationTitle("Edit AI Prompt")
            .navigationBarTitleDisplayMode(.inline)
            .toolbar {
                ToolbarItem(placement: .cancellationAction) {
                    Button("Cancel") {
                        dismiss()
                    }
                }
                ToolbarItem(placement: .confirmationAction) {
                    Button("Save") {
                        onSave(text)
                        dismiss()
                    }
                    .fontWeight(.semibold)
                }
            }
        }
    }
}
