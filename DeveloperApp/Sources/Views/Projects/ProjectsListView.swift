import SwiftUI
import FeedbackKit

public struct ProjectsListView: View {
    @EnvironmentObject private var appState: AppState
    @State private var isNewProjectSheetPresented = false
    @State private var searchText = ""

    private var filteredProjects: [PortalProject] {
        if searchText.isEmpty {
            return appState.projects
        }
        return appState.projects.filter {
            $0.name.localizedCaseInsensitiveContains(searchText) ||
            ($0.githubRepo?.localizedCaseInsensitiveContains(searchText) ?? false)
        }
    }

    public var body: some View {
        NavigationStack {
            Group {
                if filteredProjects.isEmpty && !appState.isLoading {
                    EmptyStateCard(
                        iconName: "folder.badge.plus",
                        title: "No Projects",
                        message: "Create your first project to start receiving bug reports and annotations from your apps.",
                        actionTitle: "New Project",
                        action: {
                            isNewProjectSheetPresented = true
                        }
                    )
                } else {
                    List {
                        ForEach(filteredProjects) { project in
                            NavigationLink(destination: ProjectDetailView(project: project)) {
                                projectRow(project: project)
                            }
                        }
                    }
                    .listStyle(.insetGrouped)
                    .refreshable {
                        await appState.loadProjects()
                    }
                }
            }
            .navigationTitle("Projects")
            .searchable(text: $searchText, prompt: "Search projects...")
            .toolbar {
                ToolbarItem(placement: .topBarTrailing) {
                    Button {
                        isNewProjectSheetPresented = true
                    } label: {
                        Image(systemName: "plus")
                            .fontWeight(.semibold)
                    }
                }
            }
            .sheet(isPresented: $isNewProjectSheetPresented) {
                NewProjectSheet()
            }
            .onAppear {
                FeedbackKit.currentScreen = "Projects"
            }
        }
    }

    private func projectRow(project: PortalProject) -> some View {
        HStack(spacing: 14) {
            VStack(alignment: .leading, spacing: 5) {
                HStack(spacing: 8) {
                    Text(project.name)
                        .font(.headline)

                    if project.id == appState.selectedProject?.id {
                        Text("Active")
                            .font(.system(size: 9, weight: .bold))
                            .padding(.horizontal, 6)
                            .padding(.vertical, 2)
                            .background(Color.accentColor.opacity(0.15))
                            .foregroundColor(.accentColor)
                            .clipShape(Capsule())
                    }
                }

                if let repo = project.githubRepo {
                    HStack(spacing: 4) {
                        Image(systemName: "chevron.left.forwardslash.chevron.right")
                            .font(.caption2)
                        Text(repo)
                            .font(.caption)
                    }
                    .foregroundColor(.secondary)
                }

                HStack(spacing: 4) {
                    Image(systemName: "key")
                        .font(.caption2)
                    Text(String(project.projectKey.prefix(16)) + "…")
                        .font(.system(.caption2, design: .monospaced))
                }
                .foregroundColor(.secondary)
            }

            Spacer()

            VStack(alignment: .trailing, spacing: 4) {
                if project.unresolvedCount > 0 {
                    Text("\(project.unresolvedCount) new")
                        .font(.caption2.weight(.bold))
                        .padding(.horizontal, 8)
                        .padding(.vertical, 3)
                        .background(Color.orange.opacity(0.15))
                        .foregroundColor(.orange)
                        .clipShape(Capsule())
                }

                Text("\(project.feedbackCount) total")
                    .font(.caption2)
                    .foregroundColor(.secondary)
            }
        }
        .padding(.vertical, 4)
    }
}
