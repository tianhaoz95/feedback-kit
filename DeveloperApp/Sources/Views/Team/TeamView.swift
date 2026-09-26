import SwiftUI
import FeedbackKit

/// Team & organization: switch between organizations, see who's in the
/// current one, and (as an owner) invite people, change roles and remove
/// members. Invites are links: the Portal creates one and hands it to the
/// share sheet; the invitee opens it in the web dashboard, which handles
/// GitHub sign-in (0016_teams.sql).
public struct TeamView: View {
    @EnvironmentObject private var appState: AppState
    @ObservedObject private var client = SupabasePortalClient.shared

    @State private var members: [PortalMember] = []
    @State private var invitations: [PortalInvitation] = []
    @State private var isLoading = false
    @State private var errorMessage: String?

    @State private var inviteEmail = ""
    @State private var inviteRole: PortalMembershipRole = .member
    @State private var newInvite: PortalInvitation?
    @State private var isCreatingInvite = false

    @State private var isRenaming = false
    @State private var renameText = ""
    @State private var isCreatingOrganization = false
    @State private var newOrganizationName = ""
    @State private var memberPendingRemoval: PortalMember?
    @State private var isConfirmingLeave = false

    /// Mirrors web/src/lib/pricing.ts; placeholder until Stripe is live.
    static let teamPricePerSeat = 15

    public init() {}

    private var organization: PortalOrganization? { appState.currentOrganization }
    private var isOwner: Bool { organization?.isOwner ?? false }
    private var ownerCount: Int { members.filter { $0.role == .owner }.count }
    private var myUserId: String? { client.currentSession?.userId }

    public var body: some View {
        List {
            organizationSection
            membersSection
            if isOwner { inviteSection }
            leaveSection
        }
        .listStyle(.insetGrouped)
        .navigationTitle("Team")
        .refreshable { await load() }
        .task(id: organization?.id) { await load() }
        .onAppear { FeedbackKit.currentScreen = "Team" }
        .alert("Something went wrong", isPresented: Binding(
            get: { errorMessage != nil },
            set: { if !$0 { errorMessage = nil } }
        )) {
            Button("OK", role: .cancel) {}
        } message: {
            Text(errorMessage ?? "")
        }
        .alert("Rename Organization", isPresented: $isRenaming) {
            TextField("Name", text: $renameText)
            Button("Cancel", role: .cancel) {}
            Button("Save") { rename() }
        }
        .alert("New Organization", isPresented: $isCreatingOrganization) {
            TextField("Name", text: $newOrganizationName)
            Button("Cancel", role: .cancel) {}
            Button("Create") { createOrganization() }
        } message: {
            Text("You'll be its owner. Projects you create while it's selected belong to it.")
        }
        .confirmationDialog(
            "Remove \(memberPendingRemoval?.displayName ?? "member")?",
            isPresented: Binding(get: { memberPendingRemoval != nil }, set: { if !$0 { memberPendingRemoval = nil } }),
            titleVisibility: .visible
        ) {
            Button("Remove", role: .destructive) {
                if let member = memberPendingRemoval { remove(member) }
            }
        } message: {
            Text("They'll lose access to \(organization?.name ?? "this organization")'s projects.")
        }
        .confirmationDialog(
            "Leave \(organization?.name ?? "this organization")?",
            isPresented: $isConfirmingLeave,
            titleVisibility: .visible
        ) {
            Button("Leave", role: .destructive) { leave() }
        } message: {
            Text("You'll lose access to its projects until someone invites you again.")
        }
    }

    // MARK: - Sections

    private var organizationSection: some View {
        Section {
            ForEach(appState.organizations) { org in
                Button {
                    Task { await appState.switchOrganization(to: org) }
                } label: {
                    HStack(spacing: 12) {
                        Text(String(org.name.prefix(1)).uppercased())
                            .font(.system(size: 13, weight: .bold))
                            .foregroundColor(.white)
                            .frame(width: 28, height: 28)
                            .background(Color.accentColor)
                            .clipShape(RoundedRectangle(cornerRadius: 7))
                        VStack(alignment: .leading, spacing: 1) {
                            Text(org.name).foregroundColor(.primary)
                            Text(org.role.displayName).font(.caption2).foregroundColor(.secondary)
                        }
                        Spacer()
                        if org.id == organization?.id {
                            Image(systemName: "checkmark").foregroundColor(.accentColor).fontWeight(.semibold)
                        }
                    }
                }
                .buttonStyle(.plain)
            }
            Button {
                newOrganizationName = ""
                isCreatingOrganization = true
            } label: {
                Label("New Organization", systemImage: "plus")
            }
            if isOwner {
                Button {
                    renameText = organization?.name ?? ""
                    isRenaming = true
                } label: {
                    Label("Rename \(organization?.name ?? "")", systemImage: "pencil")
                }
            }
        } header: {
            Text("Organizations")
        } footer: {
            Text("Projects and feedback shown in the Portal belong to the selected organization.")
        }
    }

    private var membersSection: some View {
        Section {
            if isLoading && members.isEmpty {
                ProgressView().frame(maxWidth: .infinity)
            }
            ForEach(members) { member in
                memberRow(member)
                    .swipeActions {
                        if isOwner && member.userId != myUserId {
                            Button(role: .destructive) {
                                memberPendingRemoval = member
                            } label: {
                                Label("Remove", systemImage: "person.badge.minus")
                            }
                        }
                    }
            }
        } header: {
            Text("Members (\(members.count))")
        } footer: {
            if !members.isEmpty {
                Text("On the Team plan: \(members.count) × $\(Self.teamPricePerSeat) = $\(members.count * Self.teamPricePerSeat)/month. Billing is managed in the web dashboard.")
            }
        }
    }

    private func memberRow(_ member: PortalMember) -> some View {
        HStack(spacing: 12) {
            avatar(for: member)
            VStack(alignment: .leading, spacing: 2) {
                HStack(spacing: 4) {
                    Text(member.displayName).font(.body)
                    if member.userId == myUserId {
                        Text("(you)").font(.caption).foregroundColor(.secondary)
                    }
                }
                Text([member.userName.map { "@\($0)" }, member.email].compactMap { $0 }.joined(separator: " · "))
                    .font(.caption2)
                    .foregroundColor(.secondary)
                    .lineLimit(1)
            }
            Spacer()
            if isOwner {
                Menu {
                    Picker("Role", selection: Binding(
                        get: { member.role },
                        set: { setRole($0, for: member) }
                    )) {
                        ForEach(PortalMembershipRole.allCases) { role in
                            Text(role.displayName).tag(role)
                        }
                    }
                    if member.userId != myUserId {
                        Button("Remove from Organization", role: .destructive) {
                            memberPendingRemoval = member
                        }
                    }
                } label: {
                    roleBadge(member.role, showsChevron: true)
                }
                .disabled(member.role == .owner && ownerCount <= 1 && member.userId == myUserId)
            } else {
                roleBadge(member.role, showsChevron: false)
            }
        }
        .padding(.vertical, 2)
    }

    private func roleBadge(_ role: PortalMembershipRole, showsChevron: Bool) -> some View {
        HStack(spacing: 3) {
            Text(role.displayName)
            if showsChevron {
                Image(systemName: "chevron.up.chevron.down").font(.system(size: 8, weight: .semibold))
            }
        }
        .font(.caption.weight(.medium))
        .foregroundColor(role == .owner ? .accentColor : .secondary)
        .padding(.horizontal, 8)
        .padding(.vertical, 4)
        .background((role == .owner ? Color.accentColor : Color.secondary).opacity(0.12))
        .clipShape(Capsule())
    }

    @ViewBuilder
    private func avatar(for member: PortalMember) -> some View {
        let initial = Text(String(member.displayName.prefix(1)).uppercased())
            .font(.system(size: 13, weight: .semibold))
            .foregroundColor(.secondary)
            .frame(width: 32, height: 32)
            .background(Color.secondary.opacity(0.15))
            .clipShape(Circle())
        if let urlString = member.avatarUrl, let url = URL(string: urlString) {
            AsyncImage(url: url) { phase in
                if let image = phase.image {
                    image.resizable().scaledToFill().frame(width: 32, height: 32).clipShape(Circle())
                } else {
                    initial
                }
            }
        } else {
            initial
        }
    }

    private var inviteSection: some View {
        Section {
            TextField("Email (optional)", text: $inviteEmail)
                .autocapitalization(.none)
                .disableAutocorrection(true)
            Picker("Role", selection: $inviteRole) {
                ForEach(PortalMembershipRole.allCases) { role in
                    Text(role.displayName).tag(role)
                }
            }
            Button {
                createInvite()
            } label: {
                HStack {
                    Label("Create Invite Link", systemImage: "link.badge.plus")
                    if isCreatingInvite { Spacer(); ProgressView() }
                }
            }
            .disabled(isCreatingInvite)

            if let invite = newInvite {
                VStack(alignment: .leading, spacing: 8) {
                    Text(invite.email.map { "Link for \($0) is ready:" } ?? "Link is ready. Anyone with it can join once:")
                        .font(.caption)
                        .foregroundColor(.secondary)
                    Text(invite.url.absoluteString)
                        .font(.system(.caption2, design: .monospaced))
                        .lineLimit(1)
                        .truncationMode(.middle)
                    HStack {
                        ShareLink(item: invite.url, subject: Text("Join \(organization?.name ?? "my team") on FeedbackKit")) {
                            Label("Share", systemImage: "square.and.arrow.up")
                        }
                        .buttonStyle(.borderedProminent)
                        Button {
                            UIPasteboard.general.string = invite.url.absoluteString
                            UINotificationFeedbackGenerator().notificationOccurred(.success)
                        } label: {
                            Label("Copy", systemImage: "doc.on.doc")
                        }
                        .buttonStyle(.bordered)
                    }
                }
                .padding(.vertical, 4)
            }

            ForEach(invitations.filter { $0.id != newInvite?.id }) { invite in
                HStack {
                    VStack(alignment: .leading, spacing: 2) {
                        Text(invite.email ?? "Anyone with the link").font(.subheadline)
                        Text("\(invite.role.displayName) · expires \(PortalDateFormatter.formatRelative(invite.expiresAt))")
                            .font(.caption2)
                            .foregroundColor(.secondary)
                    }
                    Spacer()
                    ShareLink(item: invite.url) {
                        Image(systemName: "square.and.arrow.up")
                    }
                    .buttonStyle(.borderless)
                }
                .swipeActions {
                    Button(role: .destructive) {
                        revoke(invite)
                    } label: {
                        Label("Revoke", systemImage: "xmark.circle")
                    }
                }
            }
        } header: {
            Text("Invite People")
        } footer: {
            Text("Links work once and expire in 7 days. With an email, only someone signed in to GitHub with that email can use it. Swipe a pending invite to revoke it.")
        }
    }

    private var leaveSection: some View {
        Section {
            Button("Leave \(organization?.name ?? "Organization")", role: .destructive) {
                isConfirmingLeave = true
            }
            .disabled(isOwner && ownerCount <= 1)
        } footer: {
            if isOwner && ownerCount <= 1 {
                Text("You're the only owner. Make someone else an owner before leaving. Deleting an organization is done in the web dashboard.")
            }
        }
    }

    // MARK: - Actions

    private func load() async {
        guard let orgId = organization?.id else { return }
        isLoading = true
        defer { isLoading = false }
        do {
            async let fetchedMembers = client.fetchMembers(organizationId: orgId)
            async let fetchedInvites: [PortalInvitation] = isOwner ? client.fetchInvitations(organizationId: orgId) : []
            let (m, i) = try await (fetchedMembers, fetchedInvites)
            members = m
            invitations = i
        } catch {
            errorMessage = error.localizedDescription
        }
    }

    private func run(_ action: @escaping () async throws -> Void) {
        Task {
            do {
                try await action()
            } catch {
                errorMessage = error.localizedDescription
                UINotificationFeedbackGenerator().notificationOccurred(.error)
            }
        }
    }

    private func setRole(_ role: PortalMembershipRole, for member: PortalMember) {
        guard let orgId = organization?.id, role != member.role else { return }
        run {
            try await client.updateMemberRole(organizationId: orgId, userId: member.userId, role: role)
            await load()
            if member.userId == myUserId { await appState.loadOrganizations() }
        }
    }

    private func remove(_ member: PortalMember) {
        guard let orgId = organization?.id else { return }
        run {
            try await client.removeMember(organizationId: orgId, userId: member.userId)
            UINotificationFeedbackGenerator().notificationOccurred(.success)
            await load()
        }
    }

    private func leave() {
        guard let orgId = organization?.id, let me = myUserId else { return }
        run {
            try await client.removeMember(organizationId: orgId, userId: me)
            await appState.organizationMembershipChanged()
        }
    }

    private func createInvite() {
        guard let orgId = organization?.id else { return }
        isCreatingInvite = true
        run {
            defer { isCreatingInvite = false }
            newInvite = try await client.createInvitation(organizationId: orgId, email: inviteEmail, role: inviteRole)
            inviteEmail = ""
            invitations = (try? await client.fetchInvitations(organizationId: orgId)) ?? invitations
        }
    }

    private func revoke(_ invite: PortalInvitation) {
        run {
            try await client.revokeInvitation(id: invite.id)
            if newInvite?.id == invite.id { newInvite = nil }
            invitations.removeAll { $0.id == invite.id }
        }
    }

    private func rename() {
        guard let org = organization else { return }
        let name = renameText.trimmingCharacters(in: .whitespacesAndNewlines)
        guard !name.isEmpty, name != org.name else { return }
        run {
            try await client.renameOrganization(id: org.id, name: name)
            await appState.loadOrganizations()
        }
    }

    private func createOrganization() {
        let name = newOrganizationName.trimmingCharacters(in: .whitespacesAndNewlines)
        guard !name.isEmpty else { return }
        run { try await appState.createOrganization(name: name) }
    }
}
