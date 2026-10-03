import SwiftUI
import FeedbackKit

public struct ProjectsListView: View {
    @EnvironmentObject private var appState: AppState
    @State private var isNewProjectSheetPresented = false
    @State private var isShowingTeam = false
    @State private var searchText = ""

    public static func sortAndFilterProjects(
        _ projects: [PortalProject],
        pinnedIds: Set<String>,
        searchText: String = ""
    ) -> [PortalProject] {
        let base: [PortalProject]
        if searchText.isEmpty {
            base = projects
        } else {
            base = projects.filter {
                $0.name.localizedCaseInsensitiveContains(searchText) ||
                ($0.githubRepo?.localizedCaseInsensitiveContains(searchText) ?? false)
            }
        }
        let pinned = base.filter { pinnedIds.contains($0.id) }
        let unpinned = base.filter { !pinnedIds.contains($0.id) }
        return pinned + unpinned
    }

    private var filteredProjects: [PortalProject] {
        Self.sortAndFilterProjects(
            appState.projects,
            pinnedIds: appState.pinnedProjectIds,
            searchText: searchText
        )
    }

    public var body: some View {
        NavigationStack {
            List {
                if appState.isLoading && appState.projects.isEmpty {
                    VStack(spacing: 12) {
                        ProgressView()
                            .scaleEffect(1.2)
                        Text("Loading projects…")
                            .font(.subheadline)
                            .foregroundColor(.secondary)
                    }
                    .frame(maxWidth: .infinity)
                    .padding(.vertical, 60)
                    .listRowSeparator(.hidden)
                    .listRowBackground(Color.clear)
                } else if filteredProjects.isEmpty {
                    if let error = appState.errorMessage, appState.projects.isEmpty {
                        EmptyStateCard(
                            iconName: "exclamationmark.triangle",
                            title: "Failed to Load Projects",
                            message: error,
                            actionTitle: "Retry",
                            action: {
                                Task {
                                    await appState.loadProjects()
                                }
                            }
                        )
                        .listRowSeparator(.hidden)
                        .listRowBackground(Color.clear)
                        .padding(.vertical, 40)
                    } else if !searchText.isEmpty {
                        EmptyStateCard(
                            iconName: "magnifyingglass",
                            title: "No Matching Projects",
                            message: "No projects match '\(searchText)'.",
                            actionTitle: "Clear Search",
                            action: {
                                searchText = ""
                            }
                        )
                        .listRowSeparator(.hidden)
                        .listRowBackground(Color.clear)
                        .padding(.vertical, 40)
                    } else {
                        EmptyStateCard(
                            iconName: "folder.badge.plus",
                            title: "No Projects",
                            message: "Create your first project to start receiving bug reports and annotations from your apps.",
                            actionTitle: "New Project",
                            action: {
                                isNewProjectSheetPresented = true
                            }
                        )
                        .listRowSeparator(.hidden)
                        .listRowBackground(Color.clear)
                        .padding(.vertical, 40)
                    }
                } else {
                    ForEach(filteredProjects) { project in
                        NavigationLink(destination: ProjectDetailView(project: project)) {
                            projectRow(project: project)
                        }
                        .swipeActions(edge: .leading) {
                            Button {
                                withAnimation {
                                    appState.togglePin(for: project)
                                }
                                UIImpactFeedbackGenerator(style: .medium).impactOccurred()
                            } label: {
                                Label(
                                    appState.isProjectPinned(project) ? "Unpin" : "Pin",
                                    systemImage: appState.isProjectPinned(project) ? "pin.slash.fill" : "pin.fill"
                                )
                            }
                            .tint(.orange)

                            if project.id != appState.selectedProject?.id {
                                Button {
                                    appState.selectedProject = project
                                    UIImpactFeedbackGenerator(style: .medium).impactOccurred()
                                } label: {
                                    Label("Set Active", systemImage: "checkmark.circle")
                                }
                                .tint(.accentColor)
                            }
                        }
                        .swipeActions(edge: .trailing) {
                            Button {
                                withAnimation {
                                    appState.togglePin(for: project)
                                }
                                UIImpactFeedbackGenerator(style: .medium).impactOccurred()
                            } label: {
                                Label(
                                    appState.isProjectPinned(project) ? "Unpin" : "Pin",
                                    systemImage: appState.isProjectPinned(project) ? "pin.slash.fill" : "pin.fill"
                                )
                            }
                            .tint(.orange)
                        }
                        .contextMenu {
                            Button {
                                withAnimation {
                                    appState.togglePin(for: project)
                                }
                            } label: {
                                Label(
                                    appState.isProjectPinned(project) ? "Unpin Project" : "Pin Project to Top",
                                    systemImage: appState.isProjectPinned(project) ? "pin.slash" : "pin"
                                )
                            }

                            if project.id != appState.selectedProject?.id {
                                Button {
                                    appState.selectedProject = project
                                } label: {
                                    Label("Set as Active Project", systemImage: "checkmark.circle")
                                }
                            }
                        }
                    }
                }
            }
            .listStyle(.insetGrouped)
            .refreshable {
                await appState.loadProjects()
            }
            .navigationTitle("Projects")
            .searchable(text: $searchText, prompt: "Search projects...")
            .toolbar {
                if appState.organizations.count > 0 {
                    ToolbarItem(placement: .topBarLeading) {
                        organizationMenu
                    }
                }
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
            .navigationDestination(isPresented: $isShowingTeam) {
                TeamView()
            }
            .onAppear {
                FeedbackKit.currentScreen = "Projects"
            }
        }
    }

    /// Switches which organization's projects (and feedback) the Portal shows.
    private var organizationMenu: some View {
        Menu {
            Picker("Organization", selection: Binding(
                get: { appState.currentOrganization?.id ?? "" },
                set: { id in
                    if let org = appState.organizations.first(where: { $0.id == id }) {
                        Task { await appState.switchOrganization(to: org) }
                    }
                }
            )) {
                ForEach(appState.organizations) { org in
                    Text(org.name).tag(org.id)
                }
            }
            Divider()
            Button {
                isShowingTeam = true
            } label: {
                Label("Team & Invitations", systemImage: "person.2")
            }
        } label: {
            HStack(spacing: 4) {
                Image(systemName: "building.2")
                Text(appState.currentOrganization?.name ?? "Organization")
                    .lineLimit(1)
                Image(systemName: "chevron.down")
                    .font(.system(size: 9, weight: .semibold))
            }
            .font(.subheadline.weight(.medium))
        }
        .accessibilityLabel("Organization: \(appState.currentOrganization?.name ?? "none")")
    }

    private func projectRow(project: PortalProject) -> some View {
        HStack(spacing: 14) {
            VStack(alignment: .leading, spacing: 5) {
                HStack(spacing: 8) {
                    Text(project.name)
                        .font(.headline)

                    if appState.isProjectPinned(project) {
                        HStack(spacing: 3) {
                            Image(systemName: "pin.fill")
                                .font(.system(size: 8))
                            Text("Pinned")
                                .font(.system(size: 9, weight: .bold))
                        }
                        .padding(.horizontal, 6)
                        .padding(.vertical, 2)
                        .background(Color.orange.opacity(0.15))
                        .foregroundColor(.orange)
                        .clipShape(Capsule())
                    }

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
