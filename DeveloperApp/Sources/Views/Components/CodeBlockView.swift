import SwiftUI

public struct CodeBlockView: View {
    public let code: String
    public var title: String? = nil
    @State private var didCopy = false

    public init(code: String, title: String? = nil) {
        self.code = code
        self.title = title
    }

    public var body: some View {
        VStack(alignment: .leading, spacing: 0) {
            HStack {
                if let title = title {
                    Text(title)
                        .font(.caption.weight(.semibold))
                        .foregroundColor(.secondary)
                }
                Spacer()
                Button {
                    UIPasteboard.general.string = code
                    UIImpactFeedbackGenerator(style: .medium).impactOccurred()
                    didCopy = true
                    DispatchQueue.main.asyncAfter(deadline: .now() + 2) {
                        didCopy = false
                    }
                } label: {
                    HStack(spacing: 4) {
                        Image(systemName: didCopy ? "checkmark" : "doc.on.doc")
                            .font(.caption2)
                        Text(didCopy ? "Copied" : "Copy")
                            .font(.caption2.weight(.medium))
                    }
                    .foregroundColor(didCopy ? .green : .accentColor)
                    .padding(.horizontal, 8)
                    .padding(.vertical, 4)
                    .background(Color(UIColor.tertiarySystemFill))
                    .clipShape(Capsule())
                }
            }
            .padding(.horizontal, 12)
            .padding(.vertical, 8)
            .background(Color(UIColor.secondarySystemBackground))

            Divider()

            ScrollView(.horizontal, showsIndicators: true) {
                Text(code)
                    .font(.system(.caption, design: .monospaced))
                    .foregroundColor(.primary)
                    .padding(12)
            }
            .background(Color(UIColor.systemBackground))
        }
        .clipShape(RoundedRectangle(cornerRadius: 10, style: .continuous))
        .overlay(
            RoundedRectangle(cornerRadius: 10, style: .continuous)
                .stroke(Color(UIColor.separator).opacity(0.6), lineWidth: 0.5)
        )
    }
}
