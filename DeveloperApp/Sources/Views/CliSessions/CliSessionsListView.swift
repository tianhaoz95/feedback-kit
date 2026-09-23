import SwiftUI

public struct CliSessionsListView: View {
    @State private var sessions: [PortalCliSession] = []
    @State private var isLoading = false
    @State private var errorMessage: String? = nil
    @State private var sessionToRevoke: PortalCliSession? = nil

    public var body: some View {
        NavigationStack {
            Group {
                if sessions.isEmpty && !isLoading {
                    EmptyStateCard(
                        iconName: "terminal",
                        title: "No CLI Sessions",
                        message: "Sessions authorized via `feedbackkit login` on your local machines or coding agent terminals will appear here."
                    )
                } else {
                    List {
                        Section {
                            VStack(alignment: .leading, spacing: 6) {
                                HStack(spacing: 8) {
                                    Image(systemName: "terminal.fill")
                                        .foregroundColor(.accentColor)
                                    Text("FeedbackKit CLI & MCP Server")
                                        .font(.subheadline.weight(.semibold))
                                }
                                Text("Manage active machine tokens used by AI coding agents (`feedbackkit mcp`) to pull bug reports and context directly into their context window.")
                                    .font(.caption)
                                    .foregroundColor(.secondary)
                            }
                            .padding(.vertical, 4)
                        }

                        Section(header: Text("Authorized Machines")) {
                            ForEach(sessions) { session in
                                sessionRow(session: session)
                            }
                        }
                    }
                    .listStyle(.insetGrouped)
                    .refreshable {
                        await loadSessions()
                    }
                }
            }
            .navigationTitle("CLI Sessions")
            .task {
                await loadSessions()
            }
            .confirmationDialog(
                "Revoke session for \(sessionToRevoke?.label ?? "this machine")?",
                isPresented: Binding(
                    get: { sessionToRevoke != nil },
                    set: { if !$0 { sessionToRevoke = nil } }
                ),
                titleVisibility: .visible
            ) {
                Button("Revoke Token", role: .destructive) {
                    if let s = sessionToRevoke {
                        revoke(session: s)
                    }
                }
            } message: {
                Text("The terminal or MCP server will immediately lose access until re-authenticated.")
            }
        }
    }

    private func sessionRow(session: PortalCliSession) -> some View {
        HStack(alignment: .top, spacing: 12) {
            Image(systemName: session.isActive ? "display" : "display.trianglebadge.exclamationmark")
                .font(.title3)
                .foregroundColor(session.isActive ? .accentColor : .secondary)
                .frame(width: 28)
                .padding(.top, 2)

            VStack(alignment: .leading, spacing: 4) {
                HStack {
                    Text(session.label)
                        .font(.subheadline.weight(.semibold))
                        .foregroundColor(session.isActive ? .primary : .secondary)

                    Spacer()

                    if session.isActive {
                        Text("Active")
                            .font(.system(size: 9, weight: .bold))
                            .padding(.horizontal, 6)
                            .padding(.vertical, 2)
                            .background(Color.green.opacity(0.15))
                            .foregroundColor(.green)
                            .clipShape(Capsule())
                    } else {
                        Text("Revoked")
                            .font(.system(size: 9, weight: .bold))
                            .padding(.horizontal, 6)
                            .padding(.vertical, 2)
                            .background(Color.secondary.opacity(0.15))
                            .foregroundColor(.secondary)
                            .clipShape(Capsule())
                    }
                }

                if let sessId = session.sessionId {
                    Text("ID: \(sessId)")
                        .font(.system(.caption2, design: .monospaced))
                        .foregroundColor(.secondary)
                }

                Text("Authorized \(PortalDateFormatter.formatRelative(session.createdAt))")
                    .font(.caption2)
                    .foregroundColor(.secondary)
            }

            if session.isActive {
                Button {
                    sessionToRevoke = session
                } label: {
                    Text("Revoke")
                        .font(.caption2.weight(.semibold))
                        .foregroundColor(.red)
                        .padding(.horizontal, 8)
                        .padding(.vertical, 4)
                        .background(Color.red.opacity(0.1))
                        .clipShape(Capsule())
                }
                .buttonStyle(.plain)
                .padding(.top, 2)
            }
        }
        .padding(.vertical, 4)
    }

    private func loadSessions() async {
        isLoading = true
        do {
            sessions = try await SupabasePortalClient.shared.fetchCliSessions()
        } catch {
            errorMessage = error.localizedDescription
        }
        isLoading = false
    }

    private func revoke(session: PortalCliSession) {
        Task {
            do {
                try await SupabasePortalClient.shared.revokeCliSession(id: session.id)
                await loadSessions()
                UINotificationFeedbackGenerator().notificationOccurred(.success)
            } catch {
                errorMessage = error.localizedDescription
            }
        }
    }
}
