import SwiftUI

/// Console output, uncaught errors and failed network requests the web SDK
/// captured before a report — the Portal's counterpart of the dashboard's
/// `ConsoleLogsPanel`. Only web reports have any.
public struct ConsoleLogsSectionView: View {
    public let logs: [PortalLogEntry]
    @State private var expanded = false

    private static let collapsedCount = 6

    public init(logs: [PortalLogEntry]) {
        self.logs = logs
    }

    public var body: some View {
        VStack(alignment: .leading, spacing: 10) {
            HStack {
                Text("Console & Network")
                    .font(.headline)
                Spacer()
                Button {
                    UIPasteboard.general.string = logs
                        .map { "\($0.timestamp) [\($0.level)] \($0.message)" }
                        .joined(separator: "\n")
                } label: {
                    Label("Copy", systemImage: "doc.on.doc")
                        .font(.caption)
                }
            }

            let visible = expanded ? logs : Array(logs.suffix(Self.collapsedCount))
            VStack(alignment: .leading, spacing: 8) {
                ForEach(Array(visible.enumerated()), id: \.offset) { _, log in
                    HStack(alignment: .firstTextBaseline, spacing: 6) {
                        Text(log.level.uppercased())
                            .font(.system(size: 9, weight: .bold, design: .monospaced))
                            .padding(.horizontal, 4)
                            .padding(.vertical, 2)
                            .background(color(for: log.level).opacity(0.15))
                            .foregroundColor(color(for: log.level))
                            .clipShape(RoundedRectangle(cornerRadius: 4))
                        Text(log.message)
                            .font(.caption2.monospaced())
                            .foregroundColor(.primary)
                            .textSelection(.enabled)
                    }
                }
            }
            .padding(10)
            .frame(maxWidth: .infinity, alignment: .leading)
            .background(Color(UIColor.secondarySystemBackground))
            .clipShape(RoundedRectangle(cornerRadius: 10, style: .continuous))

            if logs.count > Self.collapsedCount {
                Button(expanded ? "Show fewer" : "Show all \(logs.count)") {
                    expanded.toggle()
                }
                .font(.caption)
            }
        }
    }

    private func color(for level: String) -> Color {
        switch level {
        case "error": return .red
        case "warn": return .orange
        case "network": return .purple
        default: return .secondary
        }
    }
}
