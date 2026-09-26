import SwiftUI

public struct NewProjectSheet: View {
    @Environment(\.dismiss) private var dismiss
    @EnvironmentObject private var appState: AppState

    @State private var name: String = ""
    @State private var githubRepo: String = ""
    @State private var isCreating = false
    @State private var errorMessage: String? = nil

    public var body: some View {
        NavigationStack {
            Form {
                Section(header: Text("Project Information")) {
                    TextField("Project Name (e.g. My App)", text: $name)

                    TextField("GitHub Repo (e.g. org/repo) (Optional)", text: $githubRepo)
                        .autocapitalization(.none)
                        .disableAutocorrection(true)
                }

                Section(footer: Text("FeedbackKit will automatically generate a secure Project Key and a default AI prompt template for this project.")) {
                    EmptyView()
                }

                if let err = errorMessage {
                    Section {
                        Text(err)
                            .foregroundColor(.red)
                            .font(.caption)
                    }
                }
            }
            .navigationTitle("New Project")
            .navigationBarTitleDisplayMode(.inline)
            .toolbar {
                ToolbarItem(placement: .cancellationAction) {
                    Button("Cancel") {
                        dismiss()
                    }
                }
                ToolbarItem(placement: .confirmationAction) {
                    Button("Create") {
                        createProject()
                    }
                    .disabled(name.trimmingCharacters(in: .whitespaces).isEmpty || isCreating)
                    .fontWeight(.semibold)
                }
            }
        }
    }

    private func createProject() {
        let trimmedName = name.trimmingCharacters(in: .whitespaces)
        guard !trimmedName.isEmpty else { return }

        isCreating = true
        errorMessage = nil

        let repo = githubRepo.trimmingCharacters(in: .whitespaces)
        let repoOpt = repo.isEmpty ? nil : repo

        Task {
            do {
                let created = try await SupabasePortalClient.shared.createProject(
                    name: trimmedName,
                    githubRepo: repoOpt,
                    organizationId: appState.currentOrganization?.id
                )
                await appState.loadProjects()
                appState.selectedProject = created
                UINotificationFeedbackGenerator().notificationOccurred(.success)
                dismiss()
            } catch {
                errorMessage = error.localizedDescription
                UINotificationFeedbackGenerator().notificationOccurred(.error)
            }
            isCreating = false
        }
    }
}
