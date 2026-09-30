import SwiftUI
import AVKit
import FeedbackKit

/// Dedicated chat UI for a report's fix loop — displays conversation,
/// progress events, agent previews, PR links, and allows posting notes
/// and reporter questions.
public struct FixLoopChatView: View {
    public let item: PortalFeedbackItem

    @EnvironmentObject private var appState: AppState
    @State private var events: [PortalFeedbackEvent]?
    @State private var imageURLs: [String: URL] = [:]
    @State private var draft = ""
    @State private var mode: ChatMode = .note
    @State private var posting = false
    @State private var errorMessage: String?
    @State private var fullScreenImageContext: FullScreenImageContext?

    public enum ChatMode: String, CaseIterable, Identifiable {
        case note = "Internal note"
        case reporterNote = "To reporter"
        case question = "Ask reporter"
        public var id: String { rawValue }
    }

    public init(item: PortalFeedbackItem) {
        self.item = item
    }

    private var currentItem: PortalFeedbackItem {
        appState.feedbackItems.first(where: { $0.id == item.id }) ?? item
    }

    private var stage: PortalFixStage? { currentItem.fixStage.flatMap(PortalFixStage.init(rawValue:)) }
    private var canReachReporter: Bool { currentItem.canReachReporter }

    public var body: some View {
        VStack(spacing: 0) {
            headerBanner

            Divider()

            ScrollViewReader { proxy in
                ScrollView {
                    VStack(alignment: .leading, spacing: 16) {
                        if let stage = stage {
                            stageSummaryCard(stage: stage)
                        }

                        if let events = events {
                            if events.isEmpty {
                                emptyEventsView
                            } else {
                                ForEach(events) { event in
                                    chatMessageRow(for: event)
                                        .id(event.id)
                                }
                            }
                        } else {
                            ProgressView()
                                .frame(maxWidth: .infinity)
                                .padding(.vertical, 40)
                        }

                        Color.clear
                            .frame(height: 1)
                            .id("bottom_anchor")
                    }
                    .padding(16)
                }
                .onChange(of: events?.count) {
                    withAnimation(.easeOut(duration: 0.2)) {
                        proxy.scrollTo("bottom_anchor", anchor: .bottom)
                    }
                }
                .onAppear {
                    DispatchQueue.main.asyncAfter(deadline: .now() + 0.3) {
                        proxy.scrollTo("bottom_anchor", anchor: .bottom)
                    }
                }
            }

            Divider()

            composerBar
        }
        .navigationTitle("Fix Loop")
        .navigationBarTitleDisplayMode(.inline)
        .toolbar {
            if let stage = stage {
                ToolbarItem(placement: .topBarTrailing) {
                    FixStageBadgeView(stage: stage)
                }
            }
        }
        .task(id: "\(currentItem.id)-\(currentItem.fixStage ?? "")") {
            await load()
        }
        .fullScreenCover(item: $fullScreenImageContext) { ctx in
            FullScreenImageViewer(url: ctx.url, title: ctx.title, caption: ctx.caption)
        }
        .onChange(of: imageURLs) {
            if UserDefaults.standard.bool(forKey: "portal_preview_fullscreen") {
                if let event = events?.first(where: { ($0.mediaPath ?? $0.screenshotPath) != nil }),
                   let path = event.mediaPath ?? event.screenshotPath,
                   let url = imageURLs[path] {
                    fullScreenImageContext = FullScreenImageContext(
                        url: url,
                        title: event.title,
                        caption: event.body
                    )
                }
            }
        }
    }

    // MARK: - Subviews

    @ViewBuilder
    private var headerBanner: some View {
        if stage == .reopened {
            HStack(spacing: 8) {
                Image(systemName: "exclamationmark.triangle.fill")
                    .foregroundColor(.red)
                Text("The reporter says the fix\(currentItem.fixedInBuild.map { " in build \($0)" } ?? "") didn't work.")
                    .font(.caption.weight(.medium))
                    .foregroundColor(.red)
                Spacer()
            }
            .padding(.horizontal, 16)
            .padding(.vertical, 10)
            .background(Color.red.opacity(0.1))
        }
    }

    @ViewBuilder
    private func stageSummaryCard(stage: PortalFixStage) -> some View {
        VStack(alignment: .leading, spacing: 6) {
            HStack {
                FixStageBadgeView(stage: stage)
                Spacer()
                if let build = currentItem.fixedInBuild {
                    Text("Shipped in build \(build)")
                        .font(.caption2.monospaced())
                        .foregroundColor(.secondary)
                }
            }

            if let pr = currentItem.fixPrUrl, let url = URL(string: pr) {
                Link(destination: url) {
                    Label(currentItem.fixPrNumber.map { "PR #\($0)" } ?? pr, systemImage: "arrow.triangle.pull")
                        .font(.caption.weight(.medium))
                }
            }

            if let summary = currentItem.fixSummary {
                Text("Fix: \(summary)")
                    .font(.caption)
                    .foregroundColor(.secondary)
            }
        }
        .padding(12)
        .background(Color(UIColor.secondarySystemGroupedBackground))
        .clipShape(RoundedRectangle(cornerRadius: 10, style: .continuous))
    }

    private var emptyEventsView: some View {
        VStack(spacing: 8) {
            Image(systemName: "bubble.left.and.bubble.right")
                .font(.system(size: 32))
                .foregroundColor(.secondary.opacity(0.6))
            Text("No activity yet")
                .font(.subheadline.weight(.semibold))
                .foregroundColor(.secondary)
            Text("Send this report to a coding agent — progress, PRs and the reporter's verdict will show up here.")
                .font(.caption)
                .foregroundColor(.secondary)
                .multilineTextAlignment(.center)
        }
        .frame(maxWidth: .infinity)
        .padding(.vertical, 40)
    }

    @ViewBuilder
    private func chatMessageRow(for event: PortalFeedbackEvent) -> some View {
        let isUser = event.actorType == "user"
        let isAgent = event.actorType == "agent"
        let isReporter = event.actorType == "reporter"

        HStack(alignment: .top, spacing: 10) {
            if isUser {
                Spacer(minLength: 40)
            }

            if !isUser {
                avatarView(for: event)
            }

            VStack(alignment: isUser ? .trailing : .leading, spacing: 4) {
                // Header: Name / Role + Timestamp
                HStack(spacing: 6) {
                    if !isUser {
                        Text(event.actorLabel ?? event.actorType.capitalized)
                            .font(.caption.weight(.semibold))
                            .foregroundColor(.primary)

                        Text(event.title)
                            .font(.caption2)
                            .foregroundColor(.secondary)
                    } else {
                        Text(event.title)
                            .font(.caption2)
                            .foregroundColor(.secondary)

                        Text(event.actorLabel ?? "Team")
                            .font(.caption.weight(.semibold))
                            .foregroundColor(.primary)
                    }

                    if event.visibleToReporter && event.actorType != "reporter" {
                        Image(systemName: "eye")
                            .font(.caption2)
                            .foregroundColor(.orange)
                            .accessibilityLabel("Visible to reporter")
                    }
                }

                // Bubble Content
                VStack(alignment: .leading, spacing: 6) {
                    if let body = event.body, !body.isEmpty {
                        Text(body)
                            .font(.subheadline)
                            .foregroundColor(isUser ? .white : .primary)
                    }

                    if let pr = event.prUrl, let url = URL(string: pr) {
                        Link(destination: url) {
                            HStack(spacing: 4) {
                                Image(systemName: "arrow.triangle.pull")
                                Text(pr.replacingOccurrences(of: "https://github.com/", with: ""))
                            }
                            .font(.caption.weight(.medium))
                            .foregroundColor(isUser ? .white.opacity(0.9) : .accentColor)
                        }
                    }

                    if event.kind == "after_screenshot", event.expiredAt != nil {
                        Text("Preview expired (deleted \(AfterPreviewRetention.days) days after the report was resolved).")
                            .font(.caption2).italic()
                            .foregroundColor(isUser ? .white.opacity(0.8) : .secondary)
                    }

                    if event.isVideo, let path = event.mediaPath, let url = imageURLs[path] {
                        VideoPlayer(player: AVPlayer(url: url))
                            .frame(width: 200, height: 260)
                            .clipShape(RoundedRectangle(cornerRadius: 8))
                    } else if let path = event.mediaPath ?? event.screenshotPath, let url = imageURLs[path] {
                        Button {
                            fullScreenImageContext = FullScreenImageContext(
                                url: url,
                                title: event.title,
                                caption: event.body
                            )
                        } label: {
                            ZStack(alignment: .bottomTrailing) {
                                AsyncImage(url: url) { image in
                                    image.resizable().scaledToFit()
                                } placeholder: {
                                    ProgressView()
                                }
                                .frame(maxWidth: 180, maxHeight: 240)
                                .clipShape(RoundedRectangle(cornerRadius: 8))

                                Image(systemName: "arrow.up.left.and.arrow.down.right")
                                    .font(.system(size: 10, weight: .semibold))
                                    .foregroundColor(.white)
                                    .padding(5)
                                    .background(Color.black.opacity(0.6))
                                    .clipShape(Circle())
                                    .padding(6)
                            }
                        }
                        .buttonStyle(.plain)
                        .accessibilityLabel("View full screen image")
                    }
                }
                .padding(.horizontal, 12)
                .padding(.vertical, 8)
                .background(bubbleBackgroundColor(isUser: isUser, isAgent: isAgent, isReporter: isReporter))
                .clipShape(RoundedRectangle(cornerRadius: 14, style: .continuous))
            }

            if isUser {
                avatarView(for: event)
            } else {
                Spacer(minLength: 40)
            }
        }
    }

    private func avatarView(for event: PortalFeedbackEvent) -> some View {
        Circle()
            .fill(actorBackgroundColor(event.actorType))
            .frame(width: 30, height: 30)
            .overlay(
                Image(systemName: actorIcon(event.actorType))
                    .font(.system(size: 13, weight: .semibold))
                    .foregroundColor(actorForegroundColor(event.actorType))
            )
    }

    private func bubbleBackgroundColor(isUser: Bool, isAgent: Bool, isReporter: Bool) -> Color {
        if isUser {
            return Color.accentColor
        } else if isAgent {
            return Color.purple.opacity(0.12)
        } else if isReporter {
            return Color.orange.opacity(0.12)
        } else {
            return Color(UIColor.secondarySystemBackground)
        }
    }

    private func actorIcon(_ actorType: String) -> String {
        switch actorType {
        case "agent": return "sparkles"
        case "reporter": return "person.fill"
        case "github": return "arrow.triangle.pull"
        default: return "person.2.fill"
        }
    }

    private func actorForegroundColor(_ actorType: String) -> Color {
        switch actorType {
        case "agent": return .purple
        case "reporter": return .orange
        case "github": return .primary
        default: return .accentColor
        }
    }

    private func actorBackgroundColor(_ actorType: String) -> Color {
        actorForegroundColor(actorType).opacity(0.15)
    }

    // MARK: - Composer

    private var composerBar: some View {
        VStack(spacing: 8) {
            Picker("Mode", selection: $mode) {
                ForEach(ChatMode.allCases) { m in
                    Text(m.rawValue).tag(m)
                }
            }
            .pickerStyle(.segmented)
            .disabled(!canReachReporter && mode != .note)

            if !canReachReporter && mode != .note {
                Text(currentItem.reporterId == nil
                     ? "This report came from an older SDK without a reporter id, so it can't reach their device."
                     : "The reporter chose not to hear back, so questions and fix updates won't reach them.")
                    .font(.caption2)
                    .foregroundColor(.secondary)
                    .frame(maxWidth: .infinity, alignment: .leading)
            }

            if let errorMessage {
                Text(errorMessage)
                    .font(.caption)
                    .foregroundColor(.red)
                    .frame(maxWidth: .infinity, alignment: .leading)
            }

            HStack(alignment: .bottom, spacing: 8) {
                TextField(
                    mode == .question ? "Question for the reporter..." : mode == .reporterNote ? "Message for the reporter..." : "Team internal note...",
                    text: $draft,
                    axis: .vertical
                )
                .lineLimit(1...5)
                .padding(.horizontal, 12)
                .padding(.vertical, 8)
                .background(Color(UIColor.secondarySystemBackground))
                .clipShape(RoundedRectangle(cornerRadius: 16, style: .continuous))

                Button {
                    Task { await post() }
                } label: {
                    if posting {
                        ProgressView()
                            .frame(width: 32, height: 32)
                    } else {
                        Image(systemName: "arrow.up.circle.fill")
                            .font(.system(size: 32))
                            .foregroundColor(canPost ? .accentColor : .secondary.opacity(0.4))
                    }
                }
                .disabled(!canPost)
            }
        }
        .padding(.horizontal, 16)
        .padding(.vertical, 10)
        .background(Color(UIColor.systemBackground))
    }

    private var canPost: Bool {
        !posting &&
        !draft.trimmingCharacters(in: .whitespacesAndNewlines).isEmpty &&
        (mode == .note || canReachReporter)
    }

    // MARK: - Networking

    private func load() async {
        let client = SupabasePortalClient.shared
        do {
            let loaded = try await client.fetchFeedbackEvents(feedbackId: currentItem.id)
            events = loaded
            var urls: [String: URL] = [:]
            for path in Set(loaded.compactMap { $0.mediaPath ?? $0.screenshotPath }) {
                if let signed = try? await client.getSignedUrl(path: path), let url = URL(string: signed) {
                    urls[path] = url
                }
            }
            imageURLs = urls
        } catch {
            events = []
            errorMessage = "Couldn't load activity."
        }
    }

    private func post() async {
        let body = draft.trimmingCharacters(in: .whitespacesAndNewlines)
        guard !body.isEmpty else { return }
        posting = true
        errorMessage = nil
        defer { posting = false }
        do {
            try await SupabasePortalClient.shared.postFeedbackEvent(
                item: currentItem,
                kind: mode == .question ? "question" : "comment",
                body: body,
                visibleToReporter: mode != .note
            )
            draft = ""
            await load()
        } catch {
            errorMessage = "Couldn't post: \(error.localizedDescription)"
        }
    }
}
