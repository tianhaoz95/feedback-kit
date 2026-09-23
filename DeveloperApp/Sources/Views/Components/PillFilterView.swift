import SwiftUI

public struct PillFilterView: View {
    @Binding public var selectedStatus: PortalFeedbackStatus?
    public var counts: [PortalFeedbackStatus: Int] = [:]

    public init(selectedStatus: Binding<PortalFeedbackStatus?>, counts: [PortalFeedbackStatus: Int] = [:]) {
        self._selectedStatus = selectedStatus
        self.counts = counts
    }

    public var body: some View {
        ScrollView(.horizontal, showsIndicators: false) {
            HStack(spacing: 8) {
                // "All" filter pill
                Button {
                    selectedStatus = nil
                    UIImpactFeedbackGenerator(style: .light).impactOccurred()
                } label: {
                    HStack(spacing: 6) {
                        Text("All")
                            .font(.caption.weight(selectedStatus == nil ? .semibold : .regular))
                    }
                    .padding(.horizontal, 12)
                    .padding(.vertical, 6)
                    .background(selectedStatus == nil ? Color.accentColor : Color(UIColor.secondarySystemFill))
                    .foregroundColor(selectedStatus == nil ? .white : .primary)
                    .clipShape(Capsule())
                }

                // Status pills
                ForEach(PortalFeedbackStatus.allCases) { status in
                    let isSelected = selectedStatus == status
                    Button {
                        selectedStatus = isSelected ? nil : status
                        UIImpactFeedbackGenerator(style: .light).impactOccurred()
                    } label: {
                        HStack(spacing: 5) {
                            Image(systemName: status.iconName)
                                .font(.system(size: 10, weight: .bold))

                            Text(status.displayName)
                                .font(.caption.weight(isSelected ? .semibold : .regular))

                            if let count = counts[status], count > 0 {
                                Text("\(count)")
                                    .font(.system(size: 10, weight: .bold))
                                    .padding(.horizontal, 5)
                                    .padding(.vertical, 1)
                                    .background(isSelected ? Color.white.opacity(0.3) : Color.primary.opacity(0.1))
                                    .clipShape(Capsule())
                            }
                        }
                        .padding(.horizontal, 12)
                        .padding(.vertical, 6)
                        .background(isSelected ? Color.accentColor : Color(UIColor.secondarySystemFill))
                        .foregroundColor(isSelected ? .white : .primary)
                        .clipShape(Capsule())
                    }
                }
            }
            .padding(.horizontal, 16)
            .padding(.vertical, 6)
        }
    }
}
