import SwiftUI
import FeedbackKit

public struct FeedbackRowView: View {
    public let item: PortalFeedbackItem
    public let isSelected: Bool
    public let isSelectionMode: Bool
    public let onSelectToggle: () -> Void

    public init(
        item: PortalFeedbackItem,
        isSelected: Bool = false,
        isSelectionMode: Bool = false,
        onSelectToggle: @escaping () -> Void = {}
    ) {
        self.item = item
        self.isSelected = isSelected
        self.isSelectionMode = isSelectionMode
        self.onSelectToggle = onSelectToggle
    }

    public var body: some View {
        HStack(alignment: .top, spacing: 12) {
            // Selection checkbox (when in multi-select mode)
            if isSelectionMode {
                Button(action: onSelectToggle) {
                    Image(systemName: isSelected ? "checkmark.circle.fill" : "circle")
                        .font(.title3)
                        .foregroundColor(isSelected ? .accentColor : .secondary)
                }
                .buttonStyle(.plain)
                .padding(.top, 2)
            }

            // Main Content
            VStack(alignment: .leading, spacing: 6) {
                // Top row: Status, Screen Name, Timestamp
                HStack(spacing: 6) {
                    StatusBadgeView(status: item.status, compact: true)

                    if let screen = item.environment.screenName {
                        Text(screen)
                            .font(.caption.weight(.semibold))
                            .foregroundColor(.secondary)
                            .padding(.horizontal, 6)
                            .padding(.vertical, 2)
                            .background(Color(UIColor.secondarySystemFill))
                            .clipShape(RoundedRectangle(cornerRadius: 4, style: .continuous))
                    }

                    Spacer()

                    Text(PortalDateFormatter.formatRelative(item.createdAt))
                        .font(.caption2)
                        .foregroundColor(.secondary)
                }

                // Description text
                Text(item.text.isEmpty ? "(No description provided)" : item.text)
                    .font(.subheadline)
                    .foregroundColor(item.text.isEmpty ? .secondary : .primary)
                    .lineLimit(2)
                    .multilineTextAlignment(.leading)

                // Bottom row: Metadata badges (device, annotations, attachment, GitHub)
                HStack(spacing: 8) {
                    Label(
                        item.environment.deviceModel,
                        systemImage: item.environment.isWeb ? "globe" : "iphone"
                    )
                        .font(.caption2)
                        .foregroundColor(.secondary)

                    if !item.annotations.isEmpty {
                        Label("\(item.annotations.count) markup", systemImage: "pencil.tip.crop.circle")
                            .font(.caption2)
                            .foregroundColor(.orange)
                    }

                    if item.attachmentFilename != nil {
                        Image(systemName: "paperclip")
                            .font(.caption2)
                            .foregroundColor(.secondary)
                    }

                    if item.githubIssueNumber != nil {
                        HStack(spacing: 2) {
                            Image(systemName: "exclamationmark.circle.fill")
                            Text("#\(item.githubIssueNumber!)")
                        }
                        .font(.caption2.weight(.medium))
                        .foregroundColor(.green)
                    }

                    Spacer()
                }
            }

            // Optional Screenshot Thumbnail
            if item.screenshotAnnotatedPath != nil || item.screenshotRawPath != nil {
                thumbnailView
            }
        }
        .padding(.vertical, 4)
    }

    @ViewBuilder
    private var thumbnailView: some View {
        if let urlString = item.signedScreenshotUrl, let url = URL(string: urlString) {
            AsyncImage(url: url) { phase in
                switch phase {
                case .empty:
                    thumbnailPlaceholder(isLoading: true)
                case .success(let image):
                    image
                        .resizable()
                        .scaledToFill()
                        .frame(width: 52, height: 70)
                        .clipShape(RoundedRectangle(cornerRadius: 6, style: .continuous))
                case .failure:
                    thumbnailPlaceholder(isLoading: false)
                @unknown default:
                    thumbnailPlaceholder(isLoading: false)
                }
            }
            .frame(width: 52, height: 70)
        } else {
            thumbnailPlaceholder(isLoading: true)
        }
    }

    private func thumbnailPlaceholder(isLoading: Bool) -> some View {
        RoundedRectangle(cornerRadius: 6, style: .continuous)
            .fill(Color(UIColor.secondarySystemFill))
            .frame(width: 52, height: 70)
            .overlay(
                Group {
                    if isLoading {
                        ProgressView()
                            .scaleEffect(0.7)
                    } else {
                        Image(systemName: "photo")
                            .font(.caption)
                            .foregroundColor(.secondary)
                    }
                }
            )
    }
}
