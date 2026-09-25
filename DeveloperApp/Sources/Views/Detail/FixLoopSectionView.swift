import SwiftUI

/// The closed loop for one report — the Portal's counterpart of the web
/// dashboard's `FixLoopPanel`: where the fix is, the timeline (agent
/// progress, PRs, releases, the reporter's own verdict and screenshots),
/// and a composer for a note or a question that shows up on the reporter's
/// device. See supabase/migrations/0014_closed_loop.sql.
public struct FixLoopSectionView: View {
    public let item: PortalFeedbackItem

    @State private var events: [PortalFeedbackEvent]?
    @State private var imageURLs: [String: URL] = [:]
    @State private var draft = ""
    @State private var mode: Mode = .note
    @State private var posting = false
    @State private var errorMessage: String?

    private enum Mode: String, CaseIterable, Identifiable {
        case note = "Internal note"
        case reporterNote = "To reporter"
        case question = "Ask reporter"
        var id: String { rawValue }
    }

    public init(item: PortalFeedbackItem) {
        self.item = item
    }

    private var stage: PortalFixStage? { item.fixStage.flatMap(PortalFixStage.init(rawValue:)) }
    private var canReachReporter: Bool { item.reporterId != nil }

    public var body: some View {
        VStack(alignment: .leading, spacing: 12) {
            HStack {
                Text("Fix Loop").font(.headline)
                Spacer()
                if let stage {
                    FixStageBadgeView(stage: stage)
                }
            }

            if stage == .reopened {
                Label(
                    "The reporter says the fix\(item.fixedInBuild.map { " in build \($0)" } ?? "") didn't work.",
                    systemImage: "exclamationmark.triangle.fill"
                )
                .font(.caption)
                .foregroundColor(.red)
                .padding(10)
                .frame(maxWidth: .infinity, alignment: .leading)
                .background(Color.red.opacity(0.08))
                .clipShape(RoundedRectangle(cornerRadius: 10, style: .continuous))
            }

            if let pr = item.fixPrUrl, let url = URL(string: pr) {
                Link(destination: url) {
                    Label(item.fixPrNumber.map { "PR #\($0)" } ?? pr, systemImage: "arrow.triangle.pull")
                        .font(.subheadline.weight(.medium))
                }
            }
            if let summary = item.fixSummary {
                Text("Fix: \(summary)").font(.caption).foregroundColor(.secondary)
            }
            if let build = item.fixedInBuild {
                Text("Shipped in build \(build)").font(.caption.monospaced()).foregroundColor(.secondary)
            }

            timeline

            composer
        }
        .padding()
        .background(Color(UIColor.secondarySystemGroupedBackground))
        .clipShape(RoundedRectangle(cornerRadius: 14, style: .continuous))
        .task(id: "\(item.id)-\(item.fixStage ?? "")") { await load() }
    }

    @ViewBuilder
    private var timeline: some View {
        if let events {
            if events.isEmpty {
                Text("No activity yet. Send it to a coding agent — progress, PRs and the reporter's verdict will show up here.")
                    .font(.caption)
                    .foregroundColor(.secondary)
            } else {
                VStack(alignment: .leading, spacing: 10) {
                    ForEach(events) { event in
                        VStack(alignment: .leading, spacing: 3) {
                            HStack(spacing: 6) {
                                Text(event.title).font(.caption.weight(.semibold))
                                Text(event.actorLabel ?? event.actorType)
                                    .font(.caption2)
                                    .padding(.horizontal, 5)
                                    .padding(.vertical, 1)
                                    .background(actorColor(event.actorType).opacity(0.15))
                                    .foregroundColor(actorColor(event.actorType))
                                    .clipShape(RoundedRectangle(cornerRadius: 4))
                                if event.visibleToReporter && event.actorType != "reporter" {
                                    Image(systemName: "eye").font(.caption2).foregroundColor(.orange)
                                        .accessibilityLabel("Visible to reporter")
                                }
                            }
                            if let body = event.body, !body.isEmpty {
                                Text(body).font(.caption).foregroundColor(.primary)
                            }
                            if let pr = event.prUrl, let url = URL(string: pr) {
                                Link(pr.replacingOccurrences(of: "https://github.com/", with: ""), destination: url)
                                    .font(.caption2)
                            }
                            if let path = event.screenshotPath, let url = imageURLs[path] {
                                AsyncImage(url: url) { image in
                                    image.resizable().scaledToFit()
                                } placeholder: {
                                    ProgressView()
                                }
                                .frame(maxWidth: 160, maxHeight: 220)
                                .clipShape(RoundedRectangle(cornerRadius: 8))
                            }
                        }
                        .padding(.leading, 10)
                        .overlay(alignment: .leading) {
                            Rectangle().fill(Color.secondary.opacity(0.3)).frame(width: 2)
                        }
                    }
                }
            }
        } else {
            ProgressView().frame(maxWidth: .infinity)
        }
    }

    private var composer: some View {
        VStack(alignment: .leading, spacing: 8) {
            Picker("Post as", selection: $mode) {
                ForEach(Mode.allCases) { m in
                    Text(m.rawValue).tag(m)
                }
            }
            .pickerStyle(.segmented)
            .disabled(!canReachReporter && mode != .note)

            if !canReachReporter && mode != .note {
                Text("This report came from an older SDK without a reporter id, so it can't reach their device.")
                    .font(.caption2)
                    .foregroundColor(.secondary)
            }

            TextField(
                mode == .question ? "Question for the reporter" : mode == .reporterNote ? "Shown to the reporter" : "Only your team sees this",
                text: $draft,
                axis: .vertical
            )
            .lineLimit(1...4)
            .textFieldStyle(.roundedBorder)

            if let errorMessage {
                Text(errorMessage).font(.caption).foregroundColor(.red)
            }

            HStack {
                Spacer()
                Button(mode == .question ? "Ask" : "Post") {
                    Task { await post() }
                }
                .buttonStyle(.borderedProminent)
                .disabled(posting || draft.trimmingCharacters(in: .whitespacesAndNewlines).isEmpty
                          || (mode != .note && !canReachReporter))
            }
        }
    }

    private func load() async {
        let client = SupabasePortalClient.shared
        do {
            let loaded = try await client.fetchFeedbackEvents(feedbackId: item.id)
            events = loaded
            var urls: [String: URL] = [:]
            for path in Set(loaded.compactMap(\.screenshotPath)) {
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
                item: item,
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

    private func actorColor(_ actorType: String) -> Color {
        switch actorType {
        case "reporter": return .orange
        case "agent": return .purple
        case "github": return .primary
        default: return .secondary
        }
    }
}

public struct FixStageBadgeView: View {
    public let stage: PortalFixStage

    public init(stage: PortalFixStage) {
        self.stage = stage
    }

    public var body: some View {
        Label(stage.label, systemImage: stage.systemImage)
            .font(.caption2.weight(.semibold))
            .padding(.horizontal, 6)
            .padding(.vertical, 2)
            .foregroundColor(color)
            .background(color.opacity(0.12))
            .clipShape(Capsule())
    }

    private var color: Color {
        switch stage {
        case .agentWorking: return .purple
        case .prOpen: return .blue
        case .merged: return .indigo
        case .shipped: return .orange
        case .verified: return .green
        case .reopened: return .red
        }
    }
}
