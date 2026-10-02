import SwiftUI

public struct StatusBadgeView: View {
    public let status: PortalFeedbackStatus
    public var compact: Bool = false
    public var showChevron: Bool = false

    public init(status: PortalFeedbackStatus, compact: Bool = false, showChevron: Bool = false) {
        self.status = status
        self.compact = compact
        self.showChevron = showChevron
    }

    public var body: some View {
        HStack(spacing: compact ? 4 : 6) {
            Image(systemName: status.iconName)
                .font(compact ? .system(size: 9, weight: .bold) : .system(size: 11, weight: .bold))

            if !compact {
                Text(status.displayName)
                    .font(.caption.weight(.semibold))
            }

            if showChevron {
                Image(systemName: "chevron.up.chevron.down")
                    .font(.system(size: 9, weight: .bold))
                    .foregroundColor(status.color.opacity(0.8))
            }
        }
        .padding(.horizontal, compact ? 6 : 10)
        .padding(.vertical, compact ? 2 : 5)
        .foregroundColor(status.color)
        .background(status.color.opacity(0.12))
        .clipShape(Capsule())
    }
}

extension PortalFeedbackStatus {
    public var color: Color {
        switch self {
        case .new:
            return .blue
        case .inProgress:
            return .orange
        case .backlog:
            return .purple
        case .resolved:
            return .green
        case .wontFix:
            return .secondary
        }
    }
}
