import SwiftUI

public struct PillFilterView: View {
    @Binding public var selectedStatus: PortalFeedbackStatus?
    @Binding public var showArchived: Bool
    public var counts: [PortalFeedbackStatus: Int] = [:]
    public var archivedCount: Int = 0

    public init(
        selectedStatus: Binding<PortalFeedbackStatus?>,
        showArchived: Binding<Bool> = .constant(false),
        counts: [PortalFeedbackStatus: Int] = [:],
        archivedCount: Int = 0
    ) {
        self._selectedStatus = selectedStatus
        self._showArchived = showArchived
        self.counts = counts
        self.archivedCount = archivedCount
    }

    public var body: some View {
        ScrollView(.horizontal, showsIndicators: false) {
            HStack(spacing: 8) {
                // "All" filter pill
                let isAllSelected = selectedStatus == nil && !showArchived
                Button {
                    selectedStatus = nil
                    showArchived = false
                    UIImpactFeedbackGenerator(style: .light).impactOccurred()
                } label: {
                    HStack(spacing: 6) {
                        Text("All")
                            .font(.caption.weight(isAllSelected ? .semibold : .regular))
                    }
                    .padding(.horizontal, 12)
                    .padding(.vertical, 6)
                    .background(isAllSelected ? Color.accentColor : Color(UIColor.secondarySystemFill))
                    .foregroundColor(isAllSelected ? .white : .primary)
                    .clipShape(Capsule())
                }

                // Status pills
                ForEach(PortalFeedbackStatus.allCases) { status in
                    let isSelected = selectedStatus == status && !showArchived
                    Button {
                        showArchived = false
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

                // Archived pill
                Button {
                    showArchived.toggle()
                    if showArchived {
                        selectedStatus = nil
                    }
                    UIImpactFeedbackGenerator(style: .light).impactOccurred()
                } label: {
                    HStack(spacing: 5) {
                        Image(systemName: showArchived ? "archivebox.fill" : "archivebox")
                            .font(.system(size: 10, weight: .bold))

                        Text("Archived")
                            .font(.caption.weight(showArchived ? .semibold : .regular))

                        if archivedCount > 0 {
                            Text("\(archivedCount)")
                                .font(.system(size: 10, weight: .bold))
                                .padding(.horizontal, 5)
                                .padding(.vertical, 1)
                                .background(showArchived ? Color.white.opacity(0.3) : Color.primary.opacity(0.1))
                                .clipShape(Capsule())
                        }
                    }
                    .padding(.horizontal, 12)
                    .padding(.vertical, 6)
                    .background(showArchived ? Color.purple : Color(UIColor.secondarySystemFill))
                    .foregroundColor(showArchived ? .white : .primary)
                    .clipShape(Capsule())
                }
            }
            .padding(.horizontal, 16)
            .padding(.vertical, 6)
        }
    }
}
