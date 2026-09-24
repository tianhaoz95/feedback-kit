import SwiftUI
import FeedbackKit

public struct FeedbackInboxView: View {
    @EnvironmentObject private var appState: AppState
    @State private var selectedFeedback: PortalFeedbackItem? = nil
    @State private var isMergedPromptSheetPresented = false
    @State private var showBatchDeleteConfirmation = false

    private var statusCounts: [PortalFeedbackStatus: Int] {
        var dict: [PortalFeedbackStatus: Int] = [:]
        for item in appState.feedbackItems {
            if item.isArchived == appState.showArchived {
                dict[item.status, default: 0] += 1
            }
        }
        return dict
    }

    public var body: some View {
        NavigationStack {
            VStack(spacing: 0) {
                ScrollViewReader { proxy in
                    List {
                        Section {
                            Color.clear
                                .frame(height: 0.001)
                                .id("inbox_top")
                                .listRowInsets(EdgeInsets())
                                .listRowSeparator(.hidden)
                                .listRowBackground(Color.clear)
                        }

                        if appState.isLoading && appState.feedbackItems.isEmpty {
                            loadingView
                                .listRowSeparator(.hidden)
                                .listRowBackground(Color.clear)
                                .listRowInsets(EdgeInsets())
                        } else if appState.filteredFeedbackItems.isEmpty {
                            emptyView
                                .listRowSeparator(.hidden)
                                .listRowBackground(Color.clear)
                                .listRowInsets(EdgeInsets())
                        } else {
                            ForEach(appState.filteredFeedbackItems) { item in
                                FeedbackRowView(
                                    item: item,
                                    isSelected: appState.selectedFeedbackIds.contains(item.id),
                                    isSelectionMode: appState.isMultiSelectActive,
                                    onSelectToggle: {
                                        appState.toggleSelect(id: item.id)
                                    }
                                )
                                .listRowSeparator(.hidden)
                                .contentShape(Rectangle())
                                .onTapGesture {
                                    if appState.isMultiSelectActive {
                                        appState.toggleSelect(id: item.id)
                                    } else {
                                        selectedFeedback = item
                                    }
                                }
                                // Leading swipe: Mark Resolved
                                .swipeActions(edge: .leading) {
                                    if item.status != .resolved {
                                        Button {
                                            Task {
                                                await appState.updateStatus(item: item, to: .resolved)
                                            }
                                        } label: {
                                            Label("Resolve", systemImage: "checkmark.circle.fill")
                                        }
                                        .tint(.green)
                                    } else {
                                        Button {
                                            Task {
                                                await appState.updateStatus(item: item, to: .inProgress)
                                            }
                                        } label: {
                                            Label("In Progress", systemImage: "arrow.triangle.2.circlepath")
                                        }
                                        .tint(.orange)
                                    }
                                }
                                // Trailing swipe: Archive & Delete
                                .swipeActions(edge: .trailing, allowsFullSwipe: false) {
                                    Button(role: .destructive) {
                                        Task {
                                            await appState.delete(item: item)
                                        }
                                    } label: {
                                        Label("Delete", systemImage: "trash")
                                    }
                                    .tint(.red)

                                    Button {
                                        Task {
                                            await appState.toggleArchive(item: item)
                                        }
                                    } label: {
                                        Label(item.isArchived ? "Unarchive" : "Archive", systemImage: item.isArchived ? "tray.and.arrow.up" : "archivebox")
                                    }
                                    .tint(.purple)
                                }
                            }
                        }
                    }
                    .listStyle(.plain)
                    .safeAreaInset(edge: .top, spacing: 0) {
                        PillFilterView(
                            selectedStatus: $appState.statusFilter,
                            counts: statusCounts
                        )
                        .background(Color(UIColor.systemBackground))
                    }
                    .refreshable {
                        await Task {
                            async let loadWork: Void = appState.loadFeedback()
                            async let minDelay: Void = Task.sleep(nanoseconds: 300_000_000)
                            _ = await (loadWork, try? minDelay)
                        }.value
                        withAnimation(.easeInOut(duration: 0.2)) {
                            proxy.scrollTo("inbox_top", anchor: .top)
                        }
                    }
                }

                // Bottom Action Bar when Multi-Select is Active
                if appState.isMultiSelectActive {
                    bottomBatchBar
                }
            }
            .navigationTitle("Feedback")
            .searchable(text: $appState.searchQuery, prompt: "Search reports, screens, devices...")
            .toolbar {
                // Leading: Project Switcher Menu
                ToolbarItem(placement: .topBarLeading) {
                    Menu {
                        ForEach(appState.projects) { project in
                            Button {
                                appState.selectedProject = project
                            } label: {
                                HStack {
                                    Text(project.name)
                                    if project.id == appState.selectedProject?.id {
                                        Image(systemName: "checkmark")
                                    }
                                }
                            }
                        }
                    } label: {
                        HStack(spacing: 4) {
                            Image(systemName: "folder.fill")
                                .foregroundColor(.accentColor)
                            Text(appState.selectedProject?.name ?? (appState.isLoading ? "Loading…" : "Select Project"))
                                .font(.subheadline.weight(.semibold))
                                .foregroundColor(.primary)
                            Image(systemName: "chevron.down")
                                .font(.caption2.weight(.bold))
                                .foregroundColor(.secondary)
                        }
                    }
                }

                // Trailing: Active/Archived & Select toggle
                ToolbarItem(placement: .topBarTrailing) {
                    HStack(spacing: 12) {
                        Button {
                            withAnimation(.spring()) {
                                appState.isMultiSelectActive.toggle()
                                if !appState.isMultiSelectActive {
                                    appState.selectedFeedbackIds.removeAll()
                                }
                            }
                        } label: {
                            Text(appState.isMultiSelectActive ? "Done" : "Select")
                                .fontWeight(.semibold)
                        }

                        Menu {
                            Button {
                                appState.showArchived = false
                            } label: {
                                Label("Active Reports", systemImage: "tray.fill")
                            }

                            Button {
                                appState.showArchived = true
                            } label: {
                                Label("Archived Reports", systemImage: "archivebox.fill")
                            }
                        } label: {
                            Image(systemName: appState.showArchived ? "archivebox.fill" : "line.3.horizontal.decrease.circle")
                                .foregroundColor(appState.showArchived ? .purple : .accentColor)
                        }
                    }
                }
            }
            .navigationDestination(item: $selectedFeedback) { item in
                FeedbackDetailView(item: item)
            }
            .sheet(isPresented: $isMergedPromptSheetPresented) {
                MergedPromptSheet(
                    selectedItems: appState.selectedFeedbackItems,
                    templateText: appState.promptTemplate?.templateText
                )
            }
            .confirmationDialog(
                "Delete \(appState.selectedFeedbackIds.count) reports?",
                isPresented: $showBatchDeleteConfirmation,
                titleVisibility: .visible
            ) {
                Button("Delete Selected", role: .destructive) {
                    Task {
                        await appState.batchDelete()
                    }
                }
            } message: {
                Text("These items will be permanently removed.")
            }
            .onAppear {
                FeedbackKit.currentScreen = "Feedback Inbox"
            }
        }
    }

    // MARK: - Subviews

    private var loadingView: some View {
        VStack(spacing: 12) {
            ProgressView()
                .scaleEffect(1.2)
            Text("Loading feedback…")
                .font(.subheadline)
                .foregroundColor(.secondary)
        }
        .frame(maxWidth: .infinity)
        .padding(.vertical, 60)
    }

    private var emptyView: some View {
        EmptyStateCard(
            iconName: appState.showArchived ? "archivebox" : "tray",
            title: appState.showArchived ? "No Archived Reports" : "Inbox Zero",
            message: appState.showArchived
                ? "Items you archive will appear here."
                : "No feedback matching your current filters. Great job!",
            actionTitle: appState.statusFilter != nil ? "Clear Filter" : nil,
            action: {
                appState.statusFilter = nil
            }
        )
        .frame(maxWidth: .infinity)
        .padding(.vertical, 40)
    }

    private var bottomBatchBar: some View {
        VStack(spacing: 0) {
            Divider()

            HStack {
                Text("\(appState.selectedFeedbackIds.count) selected")
                    .font(.subheadline.weight(.semibold))

                Spacer()

                Button {
                    if appState.selectedFeedbackIds.count == appState.filteredFeedbackItems.count {
                        appState.deselectAll()
                    } else {
                        appState.selectAll()
                    }
                } label: {
                    Text(appState.selectedFeedbackIds.count == appState.filteredFeedbackItems.count ? "Deselect All" : "Select All")
                        .font(.caption.weight(.semibold))
                }
            }
            .padding(.horizontal, 16)
            .padding(.top, 10)
            .padding(.bottom, 6)

            HStack(spacing: 12) {
                // Batch Resolve
                Button {
                    Task {
                        await appState.batchUpdateStatus(status: .resolved)
                    }
                } label: {
                    Label("Resolve", systemImage: "checkmark.circle.fill")
                        .font(.caption.weight(.semibold))
                        .frame(maxWidth: .infinity)
                        .padding(.vertical, 8)
                        .background(Color.green.opacity(0.15))
                        .foregroundColor(.green)
                        .clipShape(RoundedRectangle(cornerRadius: 8, style: .continuous))
                }

                // Batch Archive
                Button {
                    Task {
                        await appState.batchArchive(isArchived: !appState.showArchived)
                    }
                } label: {
                    Label(appState.showArchived ? "Unarchive" : "Archive", systemImage: "archivebox")
                        .font(.caption.weight(.semibold))
                        .frame(maxWidth: .infinity)
                        .padding(.vertical, 8)
                        .background(Color.purple.opacity(0.15))
                        .foregroundColor(.purple)
                        .clipShape(RoundedRectangle(cornerRadius: 8, style: .continuous))
                }

                // Batch Delete
                Button {
                    showBatchDeleteConfirmation = true
                } label: {
                    Image(systemName: "trash")
                        .font(.caption.weight(.semibold))
                        .padding(.horizontal, 12)
                        .padding(.vertical, 8)
                        .background(Color.red.opacity(0.15))
                        .foregroundColor(.red)
                        .clipShape(RoundedRectangle(cornerRadius: 8, style: .continuous))
                }

                // Merged Prompt Button
                Button {
                    isMergedPromptSheetPresented = true
                } label: {
                    HStack(spacing: 4) {
                        Image(systemName: "sparkles")
                        Text("Prompt")
                    }
                    .font(.caption.weight(.semibold))
                    .padding(.horizontal, 14)
                    .padding(.vertical, 8)
                    .background(Color.accentColor)
                    .foregroundColor(.white)
                    .clipShape(RoundedRectangle(cornerRadius: 8, style: .continuous))
                }
            }
            .disabled(appState.selectedFeedbackIds.isEmpty)
            .padding(.horizontal, 16)
            .padding(.bottom, 12)
        }
        .background(Color(UIColor.secondarySystemGroupedBackground))
    }
}
