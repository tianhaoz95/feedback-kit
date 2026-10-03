#if os(iOS)
import UIKit

/// Shown from the moment the flow is triggered until the feedback screen is
/// up, so the wait (rendering the screenshot, building and presenting the
/// editor) reads as "working" rather than "stuck": a gradient glow flowing
/// around the edges of the screen, and a small "Capturing screenshot…" card
/// with a progress track in the middle.
///
/// It lives in its own window above the app's, so the window-level capture
/// (`ScreenshotCapture`, which skips `CaptureIndicatorWindow`) never includes
/// it. The drawing is `CaptureIndicatorLayers.swift`, shared with macOS.
final class CaptureIndicator {
    private let window: CaptureIndicatorWindow
    private let contentView: CaptureIndicatorView

    private init(window: CaptureIndicatorWindow, contentView: CaptureIndicatorView) {
        self.window = window
        self.contentView = contentView
    }

    /// Puts the indicator on screen over `presenter`'s window scene, and
    /// commits it to the render server so it's visible (and animating) before
    /// the caller blocks the main thread capturing. `nil` when there's no
    /// scene to show it in.
    static func show(over presenter: UIViewController, theme: FeedbackTheme?) -> CaptureIndicator? {
        let scene = presenter.view.window?.windowScene
            ?? UIApplication.shared.connectedScenes
                .compactMap { $0 as? UIWindowScene }
                .first { $0.activationState == .foregroundActive }
        guard let scene else { return nil }

        let primary = theme.flatMap { UIColor(hex: $0.primaryColorHex) } ?? .systemBlue
        let contentView = CaptureIndicatorView(primary: primary)
        let root = CaptureIndicatorViewController(scene: scene)
        root.view = contentView

        let window = CaptureIndicatorWindow(windowScene: scene)
        window.windowLevel = .alert + 1
        window.backgroundColor = .clear
        window.rootViewController = root
        // Shown but never made key: capture and the presented editor both
        // belong to the app's own key window.
        window.isHidden = false
        window.layoutIfNeeded()

        contentView.startAnimating()
        CATransaction.flush()
        UIAccessibility.post(notification: .announcement, argument: CaptureIndicatorView.message)
        return CaptureIndicator(window: window, contentView: contentView)
    }

    /// Fades the indicator out and removes its window.
    func dismiss() {
        fadeCaptureIndicator(contentView.layer, in: false, duration: 0.25) { [window] in
            window.isHidden = true
        }
    }
}

/// The indicator's window; `ScreenshotCapture` never captures it.
final class CaptureIndicatorWindow: UIWindow {}

/// Keeps the status bar as the app had it while the indicator's window is on top.
private final class CaptureIndicatorViewController: UIViewController {
    private let statusBarHidden: Bool
    private let statusBarStyle: UIStatusBarStyle

    init(scene: UIWindowScene) {
        statusBarHidden = scene.statusBarManager?.isStatusBarHidden ?? false
        statusBarStyle = scene.statusBarManager?.statusBarStyle ?? .default
        super.init(nibName: nil, bundle: nil)
    }

    required init?(coder: NSCoder) {
        fatalError("init(coder:) has not been implemented")
    }

    override var prefersStatusBarHidden: Bool { statusBarHidden }
    override var preferredStatusBarStyle: UIStatusBarStyle { statusBarStyle }
}

private final class CaptureIndicatorView: UIView {
    static let message = "Capturing screenshot…"

    private let glow: CaptureGlowLayer
    private let card = UIVisualEffectView(effect: UIBlurEffect(style: .systemThickMaterial))
    private let progressHost: CaptureProgressView

    init(primary: UIColor) {
        glow = CaptureGlowLayer(colors: captureGlowColors(primary: primary.cgColor))
        progressHost = CaptureProgressView(color: primary.cgColor)
        super.init(frame: .zero)
        backgroundColor = .clear
        layer.addSublayer(glow)

        card.layer.cornerRadius = 18
        card.layer.cornerCurve = .continuous
        card.clipsToBounds = true
        card.layer.borderWidth = 1 / UIScreen.main.scale
        card.layer.borderColor = UIColor.separator.cgColor
        card.translatesAutoresizingMaskIntoConstraints = false
        addSubview(card)

        let label = UILabel()
        label.text = Self.message
        label.font = .preferredFont(forTextStyle: .subheadline).withWeight(.semibold)
        label.textColor = .label
        label.adjustsFontForContentSizeCategory = true

        progressHost.translatesAutoresizingMaskIntoConstraints = false

        let stack = UIStackView(arrangedSubviews: [label, progressHost])
        stack.axis = .vertical
        stack.alignment = .center
        stack.spacing = 10
        stack.translatesAutoresizingMaskIntoConstraints = false
        card.contentView.addSubview(stack)

        NSLayoutConstraint.activate([
            card.centerXAnchor.constraint(equalTo: centerXAnchor),
            card.centerYAnchor.constraint(equalTo: centerYAnchor),
            stack.topAnchor.constraint(equalTo: card.contentView.topAnchor, constant: 14),
            stack.bottomAnchor.constraint(equalTo: card.contentView.bottomAnchor, constant: -14),
            stack.leadingAnchor.constraint(equalTo: card.contentView.leadingAnchor, constant: 22),
            stack.trailingAnchor.constraint(equalTo: card.contentView.trailingAnchor, constant: -22),
            progressHost.widthAnchor.constraint(equalToConstant: 120),
            progressHost.heightAnchor.constraint(equalToConstant: 3),
        ])

        isAccessibilityElement = true
        accessibilityLabel = Self.message
        accessibilityTraits = .updatesFrequently
    }

    required init?(coder: NSCoder) {
        fatalError("init(coder:) has not been implemented")
    }

    override func layoutSubviews() {
        super.layoutSubviews()
        glow.frame = bounds
    }

    func startAnimating() {
        layoutIfNeeded()
        let reduceMotion = UIAccessibility.isReduceMotionEnabled
        glow.startAnimating(reduceMotion: reduceMotion)
        progressHost.progress.startAnimating(reduceMotion: reduceMotion)
        fadeCaptureIndicator(layer, in: true, duration: 0.18)
    }
}

/// Hosts the progress track, sized in its own layout pass (after the stack
/// view has given it a frame).
private final class CaptureProgressView: UIView {
    let progress: CaptureProgressLayer

    init(color: CGColor) {
        progress = CaptureProgressLayer(color: color)
        super.init(frame: .zero)
        layer.addSublayer(progress)
    }

    required init?(coder: NSCoder) {
        fatalError("init(coder:) has not been implemented")
    }

    override func layoutSubviews() {
        super.layoutSubviews()
        progress.frame = bounds
    }
}

private extension UIFont {
    func withWeight(_ weight: UIFont.Weight) -> UIFont {
        let descriptor = fontDescriptor.addingAttributes([.traits: [UIFontDescriptor.TraitKey.weight: weight]])
        return UIFont(descriptor: descriptor, size: 0)
    }
}
#endif
