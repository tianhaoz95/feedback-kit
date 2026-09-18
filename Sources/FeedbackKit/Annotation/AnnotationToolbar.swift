import UIKit

/// The tool/color/undo rail shown beside the screenshot in `FeedbackViewController`.
/// Arranged as a narrow vertical column (rather than a horizontal bar under the
/// screenshot) so it uses the leftover horizontal margin beside a portrait
/// screenshot instead of spending vertical space the screenshot could use.
final class AnnotationToolbar: UIView {
    var onToolSelected: ((AnnotationCanvasView.Tool) -> Void)?
    var onColorSelected: ((UIColor) -> Void)?
    var onUndo: (() -> Void)?

    private static let colors: [UIColor] = [.systemRed, .systemYellow, .systemGreen, .systemBlue, .label]
    private static let tools: [(AnnotationCanvasView.Tool, String)] = [
        (.pen, "pencil.tip"),
        (.rectangle, "rectangle"),
        (.arrow, "arrow.up.right"),
        (.text, "textformat"),
        (.drag, "arrow.up.and.down.and.arrow.left.and.right")
    ]

    private var toolButtons: [UIButton] = []

    override init(frame: CGRect) {
        super.init(frame: frame)
        setUp()
    }

    required init?(coder: NSCoder) {
        super.init(coder: coder)
        setUp()
    }

    private func setUp() {
        backgroundColor = .secondarySystemBackground

        let toolStack = UIStackView()
        toolStack.axis = .vertical
        toolStack.alignment = .center
        toolStack.spacing = 14
        toolStack.translatesAutoresizingMaskIntoConstraints = false

        for (index, entry) in Self.tools.enumerated() {
            let button = UIButton(type: .system)
            button.setImage(UIImage(systemName: entry.1), for: .normal)
            button.tag = index
            button.addTarget(self, action: #selector(toolTapped(_:)), for: .touchUpInside)
            toolButtons.append(button)
            toolStack.addArrangedSubview(button)
        }
        highlight(toolButton: toolButtons.first)

        let colorStack = UIStackView()
        colorStack.axis = .vertical
        colorStack.alignment = .center
        colorStack.spacing = 8
        colorStack.translatesAutoresizingMaskIntoConstraints = false

        for color in Self.colors {
            let swatch = UIButton(type: .system)
            swatch.backgroundColor = color
            swatch.layer.cornerRadius = 12
            swatch.layer.borderWidth = 1
            swatch.layer.borderColor = UIColor.separator.cgColor
            swatch.widthAnchor.constraint(equalToConstant: 24).isActive = true
            swatch.heightAnchor.constraint(equalToConstant: 24).isActive = true
            swatch.addAction(UIAction { [weak self] _ in self?.onColorSelected?(color) }, for: .touchUpInside)
            colorStack.addArrangedSubview(swatch)
        }

        let undoButton = UIButton(type: .system)
        undoButton.setImage(UIImage(systemName: "arrow.uturn.backward"), for: .normal)
        undoButton.addAction(UIAction { [weak self] _ in self?.onUndo?() }, for: .touchUpInside)

        let mainStack = UIStackView(arrangedSubviews: [toolStack, colorStack, undoButton])
        mainStack.axis = .vertical
        mainStack.alignment = .center
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

    @objc private func toolTapped(_ sender: UIButton) {
        highlight(toolButton: sender)
        onToolSelected?(Self.tools[sender.tag].0)
    }

    private func highlight(toolButton: UIButton?) {
        for button in toolButtons {
            button.tintColor = button === toolButton ? .systemBlue : .label
        }
    }
}
