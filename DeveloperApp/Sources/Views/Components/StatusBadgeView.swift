import SwiftUI

public struct StatusBadgeView: View {
    public let status: PortalFeedbackStatus
    public var compact: Bool = false

    public init(status: PortalFeedbackStatus, compact: Bool = false) {
        self.status = status
        self.compact = compact
    }

    public var body: some View {
        HStack(spacing: 4) {
            Image(systemName: status.iconName)
                .font(compact ? .system(size: 9, weight: .bold) : .system(size: 11, weight: .bold))

            if !compact {
                Text(status.displayName)
                    .font(.caption2.weight(.semibold))
            }
        }
        .padding(.horizontal, compact ? 6 : 8)
        .padding(.vertical, compact ? 2 : 4)
        .foregroundColor(foregroundColor)
        .background(backgroundColor)
        .clipShape(Capsule())
    }

    private var foregroundColor: Color {
        switch status {
        case .new:
            return .blue
        case .inProgress:
            return .orange
        case .resolved:
            return .green
        case .wontFix:
            return .secondary
        }
    }

    private var backgroundColor: Color {
        switch status {
        case .new:
            return Color.blue.opacity(0.12)
        case .inProgress:
            return Color.orange.opacity(0.12)
        case .resolved:
            return Color.green.opacity(0.12)
        case .wontFix:
            return Color.secondary.opacity(0.12)
        }
    }
}
