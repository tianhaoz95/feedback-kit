#if os(macOS)
import AppKit

/// Shown from the moment the flow is triggered until the feedback sheet is
/// up, so the wait reads as "working" rather than "stuck": a gradient glow
/// flowing around the edges of the window, and a small "Capturing
/// screenshot…" card with a progress track in the middle.
///
/// It's a borderless child panel over the window rather than a view inside
/// it, so `ScreenshotCapture` (which renders the key window's own view
/// hierarchy) never includes it, and it can't become key. The drawing is
/// `CaptureIndicatorLayers.swift`, shared with iOS.
final class CaptureIndicator {
    private let panel: NSPanel
    private let contentView: CaptureIndicatorView

    private init(panel: NSPanel, contentView: CaptureIndicatorView) {
        self.panel = panel
        self.contentView = contentView
    }

    /// Puts the indicator over `window` (or the key window) and commits it,
    /// so it's visible (and animating) before the caller blocks the main
    /// thread capturing. `nil` when there's no window to show it over.
    static func show(over window: NSWindow?, theme: FeedbackTheme?) -> CaptureIndicator? {
        guard let parent = window ?? NSApplication.shared.keyWindow, parent.isVisible else { return nil }

        let primary = theme.flatMap { NSColor(hex: $0.primaryColorHex) } ?? .controlAccentColor
        let contentView = CaptureIndicatorView(primary: primary)

        let panel = NSPanel(
            contentRect: parent.frame,
            styleMask: [.borderless, .nonactivatingPanel],
            backing: .buffered,
            defer: false
        )
        panel.isOpaque = false
        panel.backgroundColor = .clear
        panel.hasShadow = false
        panel.isReleasedWhenClosed = false
        panel.contentView = contentView
        parent.addChildWindow(panel, ordered: .above)
        contentView.layoutSubtreeIfNeeded()

        contentView.startAnimating()
        CATransaction.flush()
        NSAccessibility.post(
            element: parent,
            notification: .announcementRequested,
            userInfo: [.announcement: CaptureIndicatorView.message, .priority: NSAccessibilityPriorityLevel.high.rawValue]
        )
        return CaptureIndicator(panel: panel, contentView: contentView)
    }

    /// Fades the indicator out and removes its panel.
    func dismiss() {
        guard let layer = contentView.layer else { return close() }
        fadeCaptureIndicator(layer, in: false, duration: 0.25) { [self] in close() }
    }

    private func close() {
        panel.parent?.removeChildWindow(panel)
        panel.orderOut(nil)
    }
}

private final class CaptureIndicatorView: NSView {
    static let message = "Capturing screenshot…"

    private let glow: CaptureGlowLayer
    private let progressHost: CaptureProgressView

    init(primary: NSColor) {
        let primaryCG = (primary.usingColorSpace(.deviceRGB) ?? primary).cgColor
        glow = CaptureGlowLayer(colors: captureGlowColors(primary: primaryCG))
        glow.glowWidth = 18
        progressHost = CaptureProgressView(color: primaryCG)
        super.init(frame: .zero)
        wantsLayer = true
        // Roughly the window's own rounded corners, so the glow follows them.
        layer?.cornerRadius = 10
        layer?.masksToBounds = true
        layer?.addSublayer(glow)

        let card = NSVisualEffectView()
        card.material = .hudWindow
        card.blendingMode = .withinWindow
        card.state = .active
        card.wantsLayer = true
        card.layer?.cornerRadius = 14
        card.layer?.masksToBounds = true
        card.translatesAutoresizingMaskIntoConstraints = false
        addSubview(card)

        let label = NSTextField(labelWithString: Self.message)
        label.font = .systemFont(ofSize: NSFont.systemFontSize, weight: .semibold)
        label.textColor = .labelColor

        progressHost.translatesAutoresizingMaskIntoConstraints = false

        let stack = NSStackView(views: [label, progressHost])
        stack.orientation = .vertical
        stack.alignment = .centerX
        stack.spacing = 10
        stack.translatesAutoresizingMaskIntoConstraints = false
        card.addSubview(stack)

        NSLayoutConstraint.activate([
            card.centerXAnchor.constraint(equalTo: centerXAnchor),
            card.centerYAnchor.constraint(equalTo: centerYAnchor),
            stack.topAnchor.constraint(equalTo: card.topAnchor, constant: 14),
            stack.bottomAnchor.constraint(equalTo: card.bottomAnchor, constant: -14),
            stack.leadingAnchor.constraint(equalTo: card.leadingAnchor, constant: 22),
            stack.trailingAnchor.constraint(equalTo: card.trailingAnchor, constant: -22),
            progressHost.widthAnchor.constraint(equalToConstant: 120),
            progressHost.heightAnchor.constraint(equalToConstant: 3),
        ])

        setAccessibilityElement(true)
        setAccessibilityRole(.progressIndicator)
        setAccessibilityLabel(Self.message)
    }

    required init?(coder: NSCoder) {
        fatalError("init(coder:) has not been implemented")
    }

    // Swallow clicks while capturing, like the iOS overlay window does.
    override func hitTest(_ point: NSPoint) -> NSView? { self }

    override func layout() {
        super.layout()
        glow.frame = bounds
    }

    func startAnimating() {
        layoutSubtreeIfNeeded()
        let reduceMotion = NSWorkspace.shared.accessibilityDisplayShouldReduceMotion
        glow.startAnimating(reduceMotion: reduceMotion)
        progressHost.progress.startAnimating(reduceMotion: reduceMotion)
        if let layer { fadeCaptureIndicator(layer, in: true, duration: 0.18) }
    }
}

/// Hosts the progress track, sized in its own layout pass (after the stack
/// view has given it a frame).
private final class CaptureProgressView: NSView {
    let progress: CaptureProgressLayer

    init(color: CGColor) {
        progress = CaptureProgressLayer(color: color)
        super.init(frame: .zero)
        wantsLayer = true
        layer?.addSublayer(progress)
    }

    required init?(coder: NSCoder) {
        fatalError("init(coder:) has not been implemented")
    }

    override func layout() {
        super.layout()
        progress.frame = bounds
    }
}
#endif
