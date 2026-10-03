#if os(iOS) || os(macOS)
import QuartzCore

// The capture indicator's drawing (`CaptureIndicator` on iOS,
// `CaptureIndicator+macOS.swift`), written once as plain Core Animation
// layers so both platforms share it, the same way `AnnotationRenderer` shares
// its drawing. These are explicit `CAAnimation`s on purpose: they run in the
// render server, so they keep moving while the main thread is blocked
// rendering the screenshot, which is exactly the moment they're for.

/// The colors the glow flows through: the theme's primary color (or the
/// platform accent) first, then a fixed spectrum, ending where it started so
/// the conic gradient has no seam.
func captureGlowColors(primary: CGColor) -> [CGColor] {
    let spectrum: [(CGFloat, CGFloat, CGFloat)] = [
        (0.545, 0.361, 0.965), // violet
        (0.925, 0.282, 0.600), // pink
        (0.976, 0.451, 0.086), // orange
        (0.133, 0.827, 0.933), // cyan
    ]
    let middle = spectrum.map { CGColor(red: $0.0, green: $0.1, blue: $0.2, alpha: 1) }
    return [primary] + middle + [primary]
}

/// A gradient glow around the edges of its bounds that flows around the
/// screen: a rotating conic gradient, masked to a band along each edge that
/// is brightest at the edge and fades inward.
final class CaptureGlowLayer: CALayer {
    /// How far the glow reaches in from each edge.
    var glowWidth: CGFloat = 26 { didSet { setNeedsLayout() } }

    private let gradient = CAGradientLayer()
    private let edgeMask = CALayer()
    private let edges = (0..<4).map { _ in CAGradientLayer() }

    init(colors: [CGColor]) {
        super.init()
        masksToBounds = true
        gradient.type = .conic
        gradient.startPoint = CGPoint(x: 0.5, y: 0.5)
        gradient.endPoint = CGPoint(x: 0.5, y: 0)
        gradient.colors = colors
        addSublayer(gradient)

        let opaque = CGColor(gray: 0, alpha: 1)
        let fadeColors = [opaque, CGColor(gray: 0, alpha: 0.45), CGColor(gray: 0, alpha: 0)]
        for edge in edges {
            edge.colors = fadeColors
            edge.locations = [0, 0.18, 1]
            edgeMask.addSublayer(edge)
        }
        mask = edgeMask
    }

    override init(layer: Any) {
        super.init(layer: layer)
    }

    required init?(coder: NSCoder) {
        fatalError("init(coder:) has not been implemented")
    }

    override func layoutSublayers() {
        super.layoutSublayers()
        CATransaction.begin()
        CATransaction.setDisableActions(true)
        // A square covering the bounds' diagonal, so the rotating gradient
        // never shows a corner.
        let side = (bounds.width * bounds.width + bounds.height * bounds.height).squareRoot()
        gradient.bounds = CGRect(x: 0, y: 0, width: side, height: side)
        gradient.position = CGPoint(x: bounds.midX, y: bounds.midY)

        edgeMask.frame = bounds
        let w = min(glowWidth, bounds.width / 2, bounds.height / 2)
        // Each band runs from its edge (start point) inward (end point).
        let bands: [(CGRect, CGPoint, CGPoint)] = [
            (CGRect(x: 0, y: 0, width: bounds.width, height: w), CGPoint(x: 0.5, y: 0), CGPoint(x: 0.5, y: 1)),
            (CGRect(x: 0, y: bounds.height - w, width: bounds.width, height: w), CGPoint(x: 0.5, y: 1), CGPoint(x: 0.5, y: 0)),
            (CGRect(x: 0, y: 0, width: w, height: bounds.height), CGPoint(x: 0, y: 0.5), CGPoint(x: 1, y: 0.5)),
            (CGRect(x: bounds.width - w, y: 0, width: w, height: bounds.height), CGPoint(x: 1, y: 0.5), CGPoint(x: 0, y: 0.5)),
        ]
        for (edge, band) in zip(edges, bands) {
            edge.frame = band.0
            edge.startPoint = band.1
            edge.endPoint = band.2
        }
        CATransaction.commit()
    }

    /// Starts the flow (and a slow breathing). With Reduce Motion the glow
    /// stays still.
    func startAnimating(reduceMotion: Bool) {
        guard !reduceMotion else { return }
        let spin = CABasicAnimation(keyPath: "transform.rotation.z")
        spin.fromValue = 0
        spin.toValue = 2 * Double.pi
        spin.duration = 2.4
        spin.repeatCount = .infinity
        spin.isRemovedOnCompletion = false
        gradient.add(spin, forKey: "flow")

        let breathe = CABasicAnimation(keyPath: "opacity")
        breathe.fromValue = 1
        breathe.toValue = 0.7
        breathe.duration = 0.9
        breathe.autoreverses = true
        breathe.repeatCount = .infinity
        breathe.timingFunction = CAMediaTimingFunction(name: .easeInEaseOut)
        breathe.isRemovedOnCompletion = false
        gradient.add(breathe, forKey: "breathe")
    }
}

/// A thin indeterminate progress track: a short segment sliding across it.
final class CaptureProgressLayer: CALayer {
    private let segment = CALayer()

    init(color: CGColor) {
        super.init()
        masksToBounds = true
        backgroundColor = color.copy(alpha: 0.2)
        segment.backgroundColor = color
        addSublayer(segment)
    }

    override init(layer: Any) {
        super.init(layer: layer)
    }

    required init?(coder: NSCoder) {
        fatalError("init(coder:) has not been implemented")
    }

    override func layoutSublayers() {
        super.layoutSublayers()
        CATransaction.begin()
        CATransaction.setDisableActions(true)
        cornerRadius = bounds.height / 2
        segment.cornerRadius = bounds.height / 2
        segment.bounds = CGRect(x: 0, y: 0, width: bounds.width * 0.35, height: bounds.height)
        segment.position = CGPoint(x: bounds.midX, y: bounds.midY)
        CATransaction.commit()
    }

    /// Slides the segment end to end; with Reduce Motion it pulses in place.
    func startAnimating(reduceMotion: Bool) {
        layoutIfNeeded()
        let animation: CABasicAnimation
        if reduceMotion {
            animation = CABasicAnimation(keyPath: "opacity")
            animation.fromValue = 1
            animation.toValue = 0.35
            animation.autoreverses = true
            animation.duration = 0.8
        } else {
            let half = segment.bounds.width / 2
            animation = CABasicAnimation(keyPath: "position.x")
            animation.fromValue = -half
            animation.toValue = bounds.width + half
            animation.duration = 1.1
        }
        animation.timingFunction = CAMediaTimingFunction(name: .easeInEaseOut)
        animation.repeatCount = .infinity
        animation.isRemovedOnCompletion = false
        segment.add(animation, forKey: "progress")
    }
}

/// Fades a layer in (`show`) or out, keeping the final opacity.
func fadeCaptureIndicator(_ layer: CALayer, in show: Bool, duration: CFTimeInterval, completion: (() -> Void)? = nil) {
    CATransaction.begin()
    CATransaction.setCompletionBlock(completion)
    let fade = CABasicAnimation(keyPath: "opacity")
    fade.fromValue = show ? 0 : layer.presentation()?.opacity ?? layer.opacity
    fade.toValue = show ? 1 : 0
    fade.duration = duration
    fade.timingFunction = CAMediaTimingFunction(name: show ? .easeOut : .easeIn)
    layer.opacity = show ? 1 : 0
    layer.add(fade, forKey: "fade")
    CATransaction.commit()
}
#endif
