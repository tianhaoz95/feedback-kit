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
                Text(SwiftSyntaxHighlighter.highlight(code))
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

// MARK: - Swift Syntax Highlighter

public enum SwiftSyntaxHighlighter {
    public static func highlight(_ code: String) -> AttributedString {
        var attributed = AttributedString(code)

        let trimmed = code.trimmingCharacters(in: .whitespacesAndNewlines)
        if trimmed.hasPrefix("http://") || trimmed.hasPrefix("https://") {
            attributed.foregroundColor = Color.accentColor
            attributed.font = .system(.caption, design: .monospaced)
            return attributed
        }

        // Base styling
        attributed.font = .system(.caption, design: .monospaced)
        attributed.foregroundColor = Color(UIColor.label)

        let nsString = code as NSString
        let fullRange = NSRange(location: 0, length: nsString.length)

        // 1. Types: Capitalized words (e.g. FeedbackKit, String, View)
        applyRegex(
            pattern: "\\b[A-Z][A-Za-z0-9_]*\\b",
            in: nsString,
            range: fullRange,
            to: &attributed,
            color: Color(red: 0.15, green: 0.62, blue: 0.75)
        )

        // 2. Numbers: integer and floats
        applyRegex(
            pattern: "\\b[0-9]+(\\.[0-9]+)?\\b",
            in: nsString,
            range: fullRange,
            to: &attributed,
            color: Color(red: 0.55, green: 0.40, blue: 0.85)
        )

        // 3. Keywords
        let keywords = "\\b(import|struct|class|enum|protocol|extension|init|deinit|func|var|let|return|if|else|guard|switch|case|default|break|continue|for|in|while|repeat|do|catch|throw|throws|try|await|async|public|private|fileprivate|internal|open|static|mutating|override|super|self|Self|nil|true|false|as|is|where|some|any|typealias)\\b"
        applyRegex(
            pattern: keywords,
            in: nsString,
            range: fullRange,
            to: &attributed,
            color: Color(red: 0.85, green: 0.22, blue: 0.60),
            bold: true
        )

        // 4. Attributes / Property wrappers
        applyRegex(
            pattern: "@[A-Za-z_][A-Za-z0-9_]*",
            in: nsString,
            range: fullRange,
            to: &attributed,
            color: Color(red: 0.85, green: 0.50, blue: 0.12),
            bold: true
        )

        // 5. Strings: " ... "
        applyRegex(
            pattern: "\"(\\\\.|[^\"\\\\])*\"",
            in: nsString,
            range: fullRange,
            to: &attributed,
            color: Color(red: 0.88, green: 0.32, blue: 0.25)
        )

        // 6. Comments: // ... or /* ... */
        applyRegex(
            pattern: "(^|\\s)//.*$",
            in: nsString,
            range: fullRange,
            to: &attributed,
            color: Color(UIColor.secondaryLabel),
            italic: true,
            options: [.anchorsMatchLines]
        )
        applyRegex(
            pattern: "/\\*[\\s\\S]*?\\*/",
            in: nsString,
            range: fullRange,
            to: &attributed,
            color: Color(UIColor.secondaryLabel),
            italic: true
        )

        return attributed
    }

    private static func applyRegex(
        pattern: String,
        in string: NSString,
        range: NSRange,
        to attributed: inout AttributedString,
        color: Color,
        bold: Bool = false,
        italic: Bool = false,
        options: NSRegularExpression.Options = []
    ) {
        guard let regex = try? NSRegularExpression(pattern: pattern, options: options) else { return }
        let matches = regex.matches(in: string as String, options: [], range: range)
        for match in matches {
            guard let strRange = Range(match.range, in: string as String) else { continue }
            guard let lower = AttributedString.Index(strRange.lowerBound, within: attributed),
                  let upper = AttributedString.Index(strRange.upperBound, within: attributed) else {
                continue
            }
            let attrRange = lower..<upper
            attributed[attrRange].foregroundColor = color
            if bold {
                attributed[attrRange].font = .system(.caption, design: .monospaced).weight(.semibold)
            }
            if italic {
                attributed[attrRange].font = .system(.caption, design: .monospaced).italic()
            }
        }
    }
}
