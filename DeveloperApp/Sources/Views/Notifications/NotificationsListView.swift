import SwiftUI
import FeedbackKit

/// Activity: the signed-in user's notifications across every organization
/// (0017_notifications.sql) — new reports, reporter replies, reopened and
/// verified fixes, merged fixes, and people joining. Tapping one opens the
/// report. The same list the web dashboard's bell shows.
public struct NotificationsListView: View {
    @EnvironmentObject private var appState: AppState
    @State private var openedItem: PortalFeedbackItem?
    @State private var isShowingTeam = false
    @State private var loadError: String?
    #if os(iOS)
    @ObservedObject private var push = PortalPushNotifications.shared
    #endif

    public init() {}

    public var body: some View {
        NavigationStack {
            List {
                #if os(iOS)
                pushPermissionSection
                #endif

                if let loadError {
                    Section {
                        Label(loadError, systemImage: "exclamationmark.triangle")
                            .font(.caption)
                            .foregroundColor(.red)
                    }
                }

                if appState.notifications.isEmpty {
                    Section {
                        EmptyStateCard(
                            iconName: "bell",
                            title: "No activity yet",
                            message: "New reports, replies from reporters and fixes they confirm show up here."
                        )
                        .listRowBackground(Color.clear)
                    }
                } else {
                    Section {
                        ForEach(appState.notifications) { notification in
                            Button {
                                open(notification)
                            } label: {
                                NotificationRowView(notification: notification)
                            }
                            .buttonStyle(.plain)
                            .swipeActions(edge: .leading) {
                                if !notification.isRead {
                                    Button {
                                        Task { await appState.markNotificationRead(notification) }
                                    } label: {
                                        Label("Mark Read", systemImage: "envelope.open")
                                    }
                                    .tint(.blue)
                                }
                            }
                        }
                    }
                }
            }
            .listStyle(.insetGrouped)
            .navigationTitle("Activity")
            .toolbar {
                ToolbarItem(placement: .topBarTrailing) {
                    Button("Mark All Read") {
                        Task { await appState.markAllNotificationsRead() }
                    }
                    .disabled(appState.unreadNotificationCount == 0)
                }
            }
            .refreshable {
                await appState.loadNotifications()
            }
            .task {
                await appState.loadNotifications()
                #if os(iOS)
                await push.refreshAuthorizationStatus()
                #endif
            }
            .onChange(of: appState.pendingNotificationFeedbackId, initial: true) {
                guard let id = appState.pendingNotificationFeedbackId else { return }
                appState.pendingNotificationFeedbackId = nil
                Task { await openFeedback(id: id) }
            }
            .navigationDestination(item: $openedItem) { item in
                FeedbackDetailView(item: item)
            }
            .navigationDestination(isPresented: $isShowingTeam) {
                TeamView()
            }
            .onAppear {
                FeedbackKit.currentScreen = "Activity"
            }
        }
    }

    #if os(iOS)
    @ViewBuilder
    private var pushPermissionSection: some View {
        switch push.authorizationStatus {
        case .notDetermined:
            Section {
                VStack(alignment: .leading, spacing: 8) {
                    Label("Get notified on this iPhone", systemImage: "bell.badge.fill")
                        .font(.headline)
                    Text("See new reports and replies from reporters as they happen, even when the Portal is closed.")
                        .font(.caption)
                        .foregroundColor(.secondary)
                    Button("Turn On Notifications") {
                        Task { await push.requestPermission() }
                    }
                    .buttonStyle(.borderedProminent)
                    .padding(.top, 2)
                }
                .padding(.vertical, 4)
            }
        case .denied:
            Section {
                Button {
                    if let url = URL(string: UIApplication.openSettingsURLString) {
                        UIApplication.shared.open(url)
                    }
                } label: {
                    Label("Notifications are off for the Portal. Turn them on in Settings.", systemImage: "bell.slash")
                        .font(.caption)
                }
            }
        default:
            EmptyView()
        }
    }
    #endif

    private func open(_ notification: PortalNotification) {
        Task {
            await appState.markNotificationRead(notification)
            await appState.focus(on: notification)
            if let feedbackId = notification.feedbackId {
                await openFeedback(id: feedbackId)
            } else if notification.kind == "member_joined" {
                isShowingTeam = true
            }
        }
    }

    private func openFeedback(id: String) async {
        do {
            if let item = try await SupabasePortalClient.shared.fetchFeedbackItem(id: id) {
                loadError = nil
                openedItem = item
            } else {
                loadError = "That report was deleted, or you no longer have access to it."
            }
        } catch {
            loadError = error.localizedDescription
        }
    }
}

struct NotificationRowView: View {
    let notification: PortalNotification

    private var tint: Color {
        switch notification.kind {
        case "new_feedback": return .blue
        case "reporter_reply": return .purple
        case "reopened": return .red
        case "verified": return .green
        case "fix_merged": return .indigo
        case "member_joined": return .orange
        default: return .gray
        }
    }

    var body: some View {
        HStack(alignment: .top, spacing: 12) {
            Image(systemName: notification.iconName)
                .font(.system(size: 15, weight: .semibold))
                .foregroundColor(notification.isRead ? .secondary : tint)
                .frame(width: 30, height: 30)
                .background((notification.isRead ? Color.secondary : tint).opacity(0.12))
                .clipShape(RoundedRectangle(cornerRadius: 8))

            VStack(alignment: .leading, spacing: 3) {
                Text(notification.title)
                    .font(.subheadline.weight(notification.isRead ? .regular : .semibold))
                    .foregroundColor(notification.isRead ? .secondary : .primary)
                    .lineLimit(2)
                if let body = notification.body, !body.isEmpty {
                    Text(body)
                        .font(.caption)
                        .foregroundColor(.secondary)
                        .lineLimit(2)
                }
                Text(PortalDateFormatter.formatRelative(notification.createdAt))
                    .font(.caption2)
                    .foregroundColor(.secondary)
            }

            Spacer(minLength: 0)

            if !notification.isRead {
                Circle()
                    .fill(Color.blue)
                    .frame(width: 8, height: 8)
                    .padding(.top, 6)
                    .accessibilityLabel("Unread")
            }
        }
        .padding(.vertical, 4)
        .contentShape(Rectangle())
    }
}
