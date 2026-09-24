import SwiftUI

public struct ConnectGitHubRepoSheet: View {
    @Environment(\.dismiss) private var dismiss
    @EnvironmentObject private var appState: AppState

    public let projectId: String
    public let currentRepo: String?

    @State private var repoInput: String = ""
    @State private var isSaving = false
    @State private var errorMessage: String? = nil

    public init(projectId: String, currentRepo: String?) {
        self.projectId = projectId
        self.currentRepo = currentRepo
        self._repoInput = State(initialValue: currentRepo ?? "")
    }

    public var body: some View {
        NavigationStack {
            Form {
                Section(header: Text("Repository")) {
                    TextField("e.g. owner/repo or GitHub URL", text: $repoInput)
                        .autocapitalization(.none)
                        .disableAutocorrection(true)
                }

                Section(footer: Text("Enter the repository in owner/repo format (e.g. octocat/Hello-World) or paste the full GitHub repository URL.")) {
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
            .navigationTitle(currentRepo == nil ? "Connect Repository" : "Change Repository")
            .navigationBarTitleDisplayMode(.inline)
            .toolbar {
                ToolbarItem(placement: .cancellationAction) {
                    Button("Cancel") {
                        dismiss()
                    }
                }
                ToolbarItem(placement: .confirmationAction) {
                    Button("Save") {
                        saveRepo()
                    }
                    .disabled(repoInput.trimmingCharacters(in: .whitespaces).isEmpty || isSaving)
                    .fontWeight(.semibold)
                }
            }
        }
    }

    private func saveRepo() {
        var cleaned = repoInput.trimmingCharacters(in: .whitespacesAndNewlines)
        if cleaned.hasPrefix("https://github.com/") {
            cleaned = String(cleaned.dropFirst("https://github.com/".count))
        } else if cleaned.hasPrefix("http://github.com/") {
            cleaned = String(cleaned.dropFirst("http://github.com/".count))
        }
        if cleaned.hasSuffix(".git") {
            cleaned = String(cleaned.dropLast(".git".count))
        }
        cleaned = cleaned.trimmingCharacters(in: CharacterSet(charactersIn: "/"))

        let parts = cleaned.split(separator: "/")
        guard parts.count == 2, !parts[0].isEmpty, !parts[1].isEmpty else {
            errorMessage = "Please enter a valid repository in owner/repo format (e.g. octocat/Hello-World)."
            return
        }

        let canonical = "\(parts[0])/\(parts[1])"
        isSaving = true
        errorMessage = nil

        Task {
            do {
                try await appState.updateProjectGitHubRepo(projectId: projectId, githubRepo: canonical)
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
