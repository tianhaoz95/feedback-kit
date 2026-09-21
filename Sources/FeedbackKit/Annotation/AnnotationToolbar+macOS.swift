#if os(macOS)
import AppKit

/// The tool/color/undo rail shown beside the screenshot in
/// `FeedbackWindowController` — mirrors `AnnotationToolbar` (iOS). NSStackView
/// and Auto Layout constraints are close enough to UIStackView/UIKit's that
/// this is nearly a direct port; the button styling is the only real
/// AppKit-specific part.
final class AnnotationToolbar: NSView {
    var onToolSelected: ((AnnotationCanvasView.Tool) -> Void)?
    var onColorSelected: ((NSColor) -> Void)?
    var onUndo: (() -> Void)?

    /// Mirrors UIKit's `isUserInteractionEnabled` (see the same property on
    /// `AnnotationCanvasView`) — a `hitTest` override blocks clicks to every
    /// button/swatch here in one place, rather than tracking each control
    /// individually (color swatches and the undo button aren't stored as
    /// properties the way `toolButtons` is).
    var isEnabled: Bool = true

    override func hitTest(_ point: NSPoint) -> NSView? {
        isEnabled ? super.hitTest(point) : nil
    }

    private static let colors: [NSColor] = [.systemRed, .systemYellow, .systemGreen, .systemBlue, .labelColor]
    private static let tools: [(AnnotationCanvasView.Tool, String)] = [
        (.pen, "pencil.tip"),
        (.rectangle, "rectangle"),
        (.arrow, "arrow.up.right"),
        (.text, "textformat"),
        (.drag, "arrow.up.and.down.and.arrow.left.and.right")
    ]

    private var toolButtons: [NSButton] = []

    override init(frame frameRect: NSRect) {
        super.init(frame: frameRect)
        setUp()
    }

    required init?(coder: NSCoder) {
        super.init(coder: coder)
        setUp()
    }

    private func setUp() {
        wantsLayer = true
        layer?.backgroundColor = NSColor.windowBackgroundColor.cgColor

        let toolStack = NSStackView()
        toolStack.orientation = .vertical
        toolStack.alignment = .centerX
        toolStack.spacing = 10
        toolStack.translatesAutoresizingMaskIntoConstraints = false

        for (index, entry) in Self.tools.enumerated() {
            let button = iconButton(symbolName: entry.1)
            button.tag = index
            button.target = self
            button.action = #selector(toolTapped(_:))
            toolButtons.append(button)
            toolStack.addArrangedSubview(button)
        }
        highlight(toolButton: toolButtons.first)

        let colorStack = NSStackView()
        colorStack.orientation = .vertical
        colorStack.alignment = .centerX
        colorStack.spacing = 6
        colorStack.translatesAutoresizingMaskIntoConstraints = false

        for color in Self.colors {
            let swatch = NSButton(title: "", target: self, action: #selector(colorTapped(_:)))
            swatch.isBordered = false
            swatch.wantsLayer = true
            swatch.layer?.backgroundColor = color.cgColor
            swatch.layer?.cornerRadius = 11
            swatch.layer?.borderWidth = 1
            swatch.layer?.borderColor = NSColor.separatorColor.cgColor
            swatch.identifier = NSUserInterfaceItemIdentifier(color.hexString)
            swatch.widthAnchor.constraint(equalToConstant: 22).isActive = true
            swatch.heightAnchor.constraint(equalToConstant: 22).isActive = true
            colorStack.addArrangedSubview(swatch)
        }

        let undoButton = iconButton(symbolName: "arrow.uturn.backward")
        undoButton.target = self
        undoButton.action = #selector(undoTapped)

        let mainStack = NSStackView(views: [toolStack, colorStack, undoButton])
        mainStack.orientation = .vertical
        mainStack.alignment = .centerX
        mainStack.distribution = .equalSpacing
        mainStack.translatesAutoresizingMaskIntoConstraints = false
        addSubview(mainStack)

        NSLayoutConstraint.activate([
            mainStack.leadingAnchor.constraint(greaterThanOrEqualTo: leadingAnchor, constant: 8),
            mainStack.trailingAnchor.constraint(lessThanOrEqualTo: trailingAnchor, constant: -8),
            mainStack.centerXAnchor.constraint(equalTo: centerXAnchor),
            mainStack.topAnchor.constraint(equalTo: topAnchor, constant: 12),
            mainStack.bottomAnchor.constraint(equalTo: bottomAnchor, constant: -12)
        ])
    }

    private func iconButton(symbolName: String) -> NSButton {
        let button = NSButton(
            image: NSImage(systemSymbolName: symbolName, accessibilityDescription: nil) ?? NSImage(),
            target: nil,
            action: nil
        )
        button.isBordered = false
        button.imagePosition = .imageOnly
        button.contentTintColor = .labelColor
        return button
    }

    @objc private func toolTapped(_ sender: NSButton) {
        highlight(toolButton: sender)
        onToolSelected?(Self.tools[sender.tag].0)
    }

    @objc private func colorTapped(_ sender: NSButton) {
        guard let hex = sender.identifier?.rawValue, let color = NSColor(hex: hex) else { return }
        onColorSelected?(color)
    }

    @objc private func undoTapped() {
        onUndo?()
    }

    private func highlight(toolButton: NSButton?) {
        for button in toolButtons {
            button.contentTintColor = button === toolButton ? .systemBlue : .labelColor
        }
    }
}
#endif
