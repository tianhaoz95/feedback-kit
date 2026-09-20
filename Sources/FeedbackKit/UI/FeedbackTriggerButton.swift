#if os(iOS)
import UIKit

/// An optional floating, draggable trigger button FeedbackKit can install into
/// the key window (`FeedbackKit.showFloatingTriggerButton`). Purely a
/// convenience — developers who want a fully custom trigger (a menu item, a
/// debug gesture, whatever) just call `FeedbackKit.present` directly instead.
final class FeedbackTriggerButton: UIButton {
    private var onTap: (() -> Void)?

    static func install(onTap: @escaping () -> Void) -> FeedbackTriggerButton? {
        guard let window = UIApplication.shared.connectedScenes
            .compactMap({ $0 as? UIWindowScene })
            .flatMap({ $0.windows })
            .first(where: { $0.isKeyWindow })
        else {
            return nil
        }

        let button = FeedbackTriggerButton(type: .custom)
        button.onTap = onTap
        button.configureAppearance()
        window.addSubview(button)
        button.frame = CGRect(
            x: window.bounds.width - 64,
            y: window.bounds.height - 160,
            width: 48,
            height: 48
        )
        button.addTarget(button, action: #selector(handleTap), for: .touchUpInside)
        button.addGestureRecognizer(UIPanGestureRecognizer(target: button, action: #selector(handlePan(_:))))
        return button
    }

    private func configureAppearance() {
        backgroundColor = .systemBlue
        tintColor = .white
        layer.cornerRadius = 24
        layer.shadowColor = UIColor.black.cgColor
        layer.shadowOpacity = 0.3
        layer.shadowRadius = 4
        layer.shadowOffset = CGSize(width: 0, height: 2)
        setImage(UIImage(systemName: "exclamationmark.bubble.fill"), for: .normal)
        accessibilityLabel = "Report Feedback"
    }

    @objc private func handleTap() {
        onTap?()
    }

    @objc private func handlePan(_ gesture: UIPanGestureRecognizer) {
        guard let superview else { return }
        let translation = gesture.translation(in: superview)
        center = CGPoint(x: center.x + translation.x, y: center.y + translation.y)
        gesture.setTranslation(.zero, in: superview)

        if gesture.state == .ended {
            let snappedX: CGFloat = center.x < superview.bounds.width / 2 ? 40 : superview.bounds.width - 40
            let clampedY = min(max(center.y, 80), superview.bounds.height - 80)
            UIView.animate(withDuration: 0.2) {
                self.center = CGPoint(x: snappedX, y: clampedY)
            }
        }
    }
}
#endif
