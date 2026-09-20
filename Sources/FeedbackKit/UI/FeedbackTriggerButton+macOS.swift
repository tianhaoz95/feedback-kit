#if os(macOS)
import AppKit

/// An optional floating, draggable trigger button FeedbackKit can install
/// into the key window (`FeedbackKit.showFloatingTriggerButton`). Mirrors
/// `FeedbackTriggerButton` (iOS) in spirit — a small round button pinned near
/// a corner of the window — but repositions itself by adjusting Auto Layout
/// constraint constants while dragging rather than mutating `frame`/`center`
/// directly, since (unlike a fresh `UIView`, always top-left-origin) an
/// arbitrary host app's content view may or may not be flipped, and constraint
/// constants stay "leading/top-positive" regardless either way.
final class FeedbackTriggerButton: NSButton {
    private var onTap: (() -> Void)?
    private var trailingConstraint: NSLayoutConstraint?
    private var bottomConstraint: NSLayoutConstraint?
    private var dragOrigin: (trailing: CGFloat, bottom: CGFloat) = (0, 0)
    private var dragStartMouseLocation: NSPoint = .zero

    static func install(onTap: @escaping () -> Void) -> FeedbackTriggerButton? {
        guard let window = NSApplication.shared.keyWindow, let contentView = window.contentView else {
            return nil
        }

        let button = FeedbackTriggerButton(frame: .zero)
        button.onTap = onTap
        button.configureAppearance()
        button.translatesAutoresizingMaskIntoConstraints = false
        contentView.addSubview(button)

        let trailing = contentView.trailingAnchor.constraint(equalTo: button.trailingAnchor, constant: 24)
        let bottom = contentView.bottomAnchor.constraint(equalTo: button.bottomAnchor, constant: 100)
        NSLayoutConstraint.activate([
            trailing,
            bottom,
            button.widthAnchor.constraint(equalToConstant: 48),
            button.heightAnchor.constraint(equalToConstant: 48)
        ])
        button.trailingConstraint = trailing
        button.bottomConstraint = bottom

        let pan = NSPanGestureRecognizer(target: button, action: #selector(handlePan(_:)))
        button.addGestureRecognizer(pan)
        return button
    }

    private func configureAppearance() {
        isBordered = false
        wantsLayer = true
        layer?.backgroundColor = NSColor.systemBlue.cgColor
        layer?.cornerRadius = 24
        layer?.shadowColor = NSColor.black.cgColor
        layer?.shadowOpacity = 0.3
        layer?.shadowRadius = 4
        layer?.shadowOffset = CGSize(width: 0, height: -2)
        image = NSImage(systemSymbolName: "exclamationmark.bubble.fill", accessibilityDescription: "Report Feedback")
        contentTintColor = .white
        imagePosition = .imageOnly
        target = self
        action = #selector(handleTap)
        setAccessibilityLabel("Report Feedback")
    }

    @objc private func handleTap() {
        onTap?()
    }

    @objc private func handlePan(_ gesture: NSPanGestureRecognizer) {
        guard let superview, let trailingConstraint, let bottomConstraint else { return }

        switch gesture.state {
        case .began:
            dragOrigin = (trailingConstraint.constant, bottomConstraint.constant)
            dragStartMouseLocation = NSEvent.mouseLocation
        case .changed:
            // Measured in screen coordinates (always bottom-left origin, Y
            // up) rather than `gesture.translation(in:)`, since that's
            // relative to the host app's own content view, whose `isFlipped`
            // we don't control or know — using it here would silently flip
            // the drag direction depending on how the integrating app built
            // its view hierarchy.
            let current = NSEvent.mouseLocation
            let dx = current.x - dragStartMouseLocation.x
            let dy = current.y - dragStartMouseLocation.y
            trailingConstraint.constant = dragOrigin.trailing - dx
            bottomConstraint.constant = dragOrigin.bottom - dy
        case .ended, .cancelled:
            let snappedTrailing: CGFloat = trailingConstraint.constant < superview.bounds.width / 2 ? 24 : superview.bounds.width - 24
            let clampedBottom = min(max(bottomConstraint.constant, 24), superview.bounds.height - 24)
            NSAnimationContext.runAnimationGroup { context in
                context.duration = 0.2
                trailingConstraint.animator().constant = snappedTrailing
                bottomConstraint.animator().constant = clampedBottom
            }
        default:
            break
        }
    }
}
#endif
