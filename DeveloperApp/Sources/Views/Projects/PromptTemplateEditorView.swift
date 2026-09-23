import SwiftUI

public struct PromptTemplateEditorView: View {
    @Environment(\.dismiss) private var dismiss
    public let projectId: String
    @State private var templateText: String
    @State private var isSaving = false
    @State private var errorMessage: String? = nil

    public init(projectId: String, initialText: String) {
        self.projectId = projectId
        self._templateText = State(initialValue: initialText)
    }

    public var body: some View {
        NavigationStack {
            VStack(spacing: 12) {
                // Placeholder quick chips
                ScrollView(.horizontal, showsIndicators: false) {
                    HStack(spacing: 8) {
                        Text("Placeholders:")
                            .font(.caption2.weight(.medium))
                            .foregroundColor(.secondary)

                        ForEach(PromptGenerator.placeholders, id: \.self) { placeholder in
                            Button {
                                templateText += "{{\(placeholder)}}"
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

                TextEditor(text: $templateText)
                    .font(.system(.body, design: .monospaced))
                    .padding(.horizontal, 12)
                    .frame(maxWidth: .infinity, maxHeight: .infinity)

                if let err = errorMessage {
                    Text(err)
                        .font(.caption)
                        .foregroundColor(.red)
                        .padding(.horizontal, 16)
                }
            }
            .navigationTitle("Prompt Template")
            .navigationBarTitleDisplayMode(.inline)
            .toolbar {
                ToolbarItem(placement: .cancellationAction) {
                    Button("Cancel") {
                        dismiss()
                    }
                }

                ToolbarItem(placement: .confirmationAction) {
                    Button {
                        save()
                    } label: {
                        if isSaving {
                            ProgressView()
                        } else {
                            Text("Save")
                                .fontWeight(.semibold)
                        }
                    }
                    .disabled(isSaving)
                }
            }
        }
    }

    private func save() {
        isSaving = true
        errorMessage = nil

        Task {
            do {
                try await SupabasePortalClient.shared.updatePromptTemplate(
                    projectId: projectId,
                    templateText: templateText
                )
                UINotificationFeedbackGenerator().notificationOccurred(.success)
                dismiss()
            } catch {
                errorMessage = error.localizedDescription
                UINotificationFeedbackGenerator().notificationOccurred(.error)
            }
            isSaving = false
        }
    }
}
