import SwiftUI

/// The "we fixed what you reported — is it fixed?" card: the reporter's own
/// annotated screenshot and words, what changed, and one tap to confirm or
/// say it's still broken. Also answers developer/agent questions.
///
/// SwiftUI rather than a UIKit/AppKit pair on purpose: unlike the capture
/// flow (which needs window-level screenshotting and a drawing canvas), this
/// is a plain card, and one SwiftUI view runs unchanged on iOS, macOS and
/// watchOS — hosted by `FixVerificationCoordinator` (`UIHostingController` /
/// `NSHostingController`) or embedded directly on watchOS.
public struct FixVerificationView: View {
    public enum Outcome: Sendable {
        case verified
        /// iOS/macOS hand this to the full capture flow for a fresh
        /// screenshot; `inlineText` is set when the card collected the
        /// details itself (watchOS, which has no screenshot flow).
        case stillBroken(inlineText: String?)
        case replied(String)
        case later
    }

    private let update: FixUpdate
    private let collectsStillBrokenInline: Bool
    private let onOutcome: (Outcome) -> Void

    @State private var reply = ""
    @State private var describingStillBroken = false
    @State private var stillBrokenText = ""

    /// - Parameters:
    ///   - collectsStillBrokenInline: `true` asks "what's still wrong?" in the
    ///     card itself (watchOS default); `false` returns `.stillBroken(nil)`
    ///     immediately so the caller can run the screenshot flow.
    public init(
        update: FixUpdate,
        collectsStillBrokenInline: Bool = FixVerificationView.defaultInlineStillBroken,
        onOutcome: @escaping (Outcome) -> Void
    ) {
        self.update = update
        self.collectsStillBrokenInline = collectsStillBrokenInline
        self.onOutcome = onOutcome
    }

    public static var defaultInlineStillBroken: Bool {
        #if os(watchOS)
        return true
        #else
        return false
        #endif
    }

    public var body: some View {
        #if os(watchOS)
        // One scrolling column — there's no room to pin anything on a watch.
        ScrollView {
            VStack(alignment: .leading, spacing: 14) {
                context
                controls
            }
            .padding(padding)
        }
        .tint(themeColor(\.primaryColorHex))
        #else
        // The answer buttons stay pinned below the scrolling context, so
        // they're visible even at a medium sheet detent.
        VStack(spacing: 0) {
            ScrollView {
                context
                    .padding([.horizontal, .top], padding)
                    .padding(.bottom, 8)
                    .frame(maxWidth: .infinity, alignment: .leading)
            }
            Divider()
            controls
                .padding(padding)
        }
        .tint(themeColor(\.primaryColorHex))
        #endif
    }

    private var context: some View {
        VStack(alignment: .leading, spacing: 14) {
            header
            if let url = update.screenshotURL {
                screenshot(url)
            }
            quote
            ForEach(developerMessages) { message in
                messageRow(message)
            }
        }
    }

    @ViewBuilder
    private var controls: some View {
        if update.needsVerification {
            verificationControls
        } else if let question = update.openQuestion {
            questionControls(question)
        }
    }

    // MARK: - Pieces

    private var header: some View {
        VStack(alignment: .leading, spacing: 4) {
            Text(update.needsVerification ? "We fixed something you reported" : "A question about your report")
                .font(.headline)
            if update.needsVerification, let build = update.fixedInBuild {
                Text("Fixed in build \(build) — the one you're using now.")
                    .font(.subheadline)
                    .foregroundColor(.secondary)
            }
        }
    }

    private func screenshot(_ url: URL) -> some View {
        AsyncImage(url: url) { phase in
            switch phase {
            case .success(let image):
                image.resizable().scaledToFit()
            case .failure:
                EmptyView()
            default:
                ProgressView().frame(maxWidth: .infinity, minHeight: 80)
            }
        }
        .frame(maxWidth: .infinity, maxHeight: screenshotMaxHeight)
        .clipShape(RoundedRectangle(cornerRadius: 10))
        .accessibilityLabel("Your screenshot from the original report")
    }

    private var quote: some View {
        VStack(alignment: .leading, spacing: 4) {
            Text("You reported")
                .font(.caption)
                .foregroundColor(.secondary)
            Text(update.text.isEmpty ? "(no description)" : "“\(update.text)”")
                .font(.body)
            if let fix = update.fixSummary, update.needsVerification {
                Text("What changed: \(fix)")
                    .font(.callout)
                    .padding(.top, 4)
            }
        }
    }

    /// Notes the developer chose to share, minus the automatic "shipped" line
    /// (the header already says it) and the reporter's own replies.
    private var developerMessages: [FixUpdate.Message] {
        update.messages.filter { $0.kind == "comment" }
    }

    private func messageRow(_ message: FixUpdate.Message) -> some View {
        VStack(alignment: .leading, spacing: 2) {
            Text(message.author).font(.caption).foregroundColor(.secondary)
            Text(message.body).font(.callout)
        }
    }

    @ViewBuilder
    private var verificationControls: some View {
        if describingStillBroken {
            VStack(alignment: .leading, spacing: 8) {
                Text("What's still wrong?").font(.subheadline)
                TextField("Describe what you see", text: $stillBrokenText)
                primaryButton("Send", disabled: stillBrokenText.trimmingCharacters(in: .whitespacesAndNewlines).isEmpty) {
                    onOutcome(.stillBroken(inlineText: stillBrokenText))
                }
            }
        } else {
            VStack(spacing: 8) {
                primaryButton("Yes, it's fixed") { onOutcome(.verified) }
                Button {
                    if collectsStillBrokenInline {
                        describingStillBroken = true
                    } else {
                        onOutcome(.stillBroken(inlineText: nil))
                    }
                } label: {
                    Text("No, still broken").frame(maxWidth: .infinity)
                }
                .buttonStyle(.bordered)
                .tint(themeColor(\.secondaryColorHex))
                Button("Remind me later") { onOutcome(.later) }
                    .font(.footnote)
                    .foregroundColor(.secondary)
                    .buttonStyle(.plain)
                    .frame(maxWidth: .infinity)
                    .padding(.top, 2)
            }
        }
    }

    private func questionControls(_ question: FixUpdate.Question) -> some View {
        VStack(alignment: .leading, spacing: 8) {
            Text(question.body).font(.body.weight(.semibold))
            TextField("Your answer", text: $reply)
            primaryButton("Send", disabled: reply.trimmingCharacters(in: .whitespacesAndNewlines).isEmpty) {
                onOutcome(.replied(reply))
            }
            Button("Not now") { onOutcome(.later) }
                .font(.footnote)
                .foregroundColor(.secondary)
                .buttonStyle(.plain)
                .frame(maxWidth: .infinity)
        }
    }

    private func primaryButton(_ title: String, disabled: Bool = false, action: @escaping () -> Void) -> some View {
        Button(action: action) {
            Text(title).frame(maxWidth: .infinity)
        }
        .buttonStyle(.borderedProminent)
        .disabled(disabled)
    }

    // MARK: - Platform/theme

    private var padding: CGFloat {
        #if os(watchOS)
        return 4
        #else
        return 20
        #endif
    }

    private var screenshotMaxHeight: CGFloat {
        #if os(watchOS)
        return 120
        #else
        return 240
        #endif
    }

    /// `FeedbackKit.theme`, falling back to the system accent (nil) exactly
    /// like the capture flow does when no theme is set or it fails to parse.
    private func themeColor(_ keyPath: KeyPath<FeedbackTheme, String>) -> Color? {
        guard let hex = FeedbackKit.theme?[keyPath: keyPath], let color = PlatformColor(hex: hex) else { return nil }
        #if os(macOS)
        return Color(nsColor: color)
        #else
        return Color(uiColor: color)
        #endif
    }
}
