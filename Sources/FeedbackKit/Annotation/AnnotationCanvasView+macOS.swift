#if os(macOS)
import AppKit

/// A transparent overlay that sits on top of the screenshot preview and lets
/// the user mark it up. Mirrors `AnnotationCanvasView` (iOS) closely — AppKit
/// has direct equivalents of every UIKit gesture recognizer this needs
/// (`NSPanGestureRecognizer`, `NSClickGestureRecognizer`,
/// `NSMagnificationGestureRecognizer`, `NSRotationGestureRecognizer`), which
/// is what makes the two-finger trackpad scale/rotate gesture translate
/// directly. There's no equivalent for a plain (non-trackpad) mouse, though —
/// scaling/rotating an existing shape is trackpad-only on macOS, same as it's
/// two-finger-only (not one-finger) on iOS.
final class AnnotationCanvasView: NSView {
    enum Tool {
        case pen
        case rectangle
        case arrow
        case text
        /// Rectangle/arrow/text annotations can only be grabbed and moved
        /// while this tool is active — otherwise a drag always draws with
        /// whichever other tool is selected.
        case drag
    }

    var tool: Tool = .pen
    var strokeColor: NSColor = .systemRed {
        didSet { needsDisplay = true }
    }

    /// AppKit has no `UIView.isUserInteractionEnabled` equivalent — disabling
    /// every attached gesture recognizer directly is the standard
    /// replacement, and correct here since this view has no mouseDown/etc.
    /// overrides of its own that could bypass them (see the gesture
    /// recognizers declared below).
    var isEnabled: Bool = true {
        didSet { gestureRecognizers.forEach { $0.isEnabled = isEnabled } }
    }

    /// Called after a text-tool click so the host window controller can
    /// present a text-entry prompt (keeps NSAlert presentation out of this view).
    var onRequestTextInput: ((_ locationInView: CGPoint, _ completion: @escaping (String?) -> Void) -> Void)?

    private(set) var completedAnnotations: [FeedbackAnnotation] = [] {
        didSet { needsDisplay = true }
    }

    /// In-progress freehand stroke, in view coordinates.
    private var activeFreehandPoints: [CGPoint] = []
    /// In-progress rectangle/arrow drag, in view coordinates.
    private var dragStart: CGPoint?
    private var dragCurrent: CGPoint?

    /// Index into `completedAnnotations` currently being repositioned, if any.
    /// Only set while `tool == .drag`; freehand strokes are never draggable.
    private var draggedAnnotationIndex: Int?
    private var draggedAnnotationOriginalPoints: [CGPoint] = []
    private var dragAnnotationStartLocation: CGPoint = .zero

    /// Index into `completedAnnotations` currently being resized/rotated by a
    /// two-finger trackpad gesture, if any. Shared between the magnification
    /// and rotation recognizers so a single two-finger touch can drive both.
    private var transformedAnnotationIndex: Int?
    private var transformedAnnotationOriginalScale: Double = 1
    private var transformedAnnotationOriginalRotation: Double = 0

    private let magnificationGesture = NSMagnificationGestureRecognizer()
    private let rotationGesture = NSRotationGestureRecognizer()

    /// UIKit's coordinate system has its origin top-left; AppKit's is
    /// bottom-left by default. Flipping keeps every bit of the normalized
    /// (0...1) coordinate math identical to the iOS implementation instead
    /// of needing a parallel, Y-inverted version of it.
    override var isFlipped: Bool { true }
    override var isOpaque: Bool { false }

    override init(frame frameRect: NSRect) {
        super.init(frame: frameRect)
        setUpGestures()
    }

    required init?(coder: NSCoder) {
        super.init(coder: coder)
        setUpGestures()
    }

    private func setUpGestures() {
        // Recognizes both a plain mouse click-drag (for users without a
        // trackpad) and a one-finger trackpad drag.
        let pan = NSPanGestureRecognizer(target: self, action: #selector(handlePan(_:)))
        addGestureRecognizer(pan)

        let click = NSClickGestureRecognizer(target: self, action: #selector(handleClick(_:)))
        addGestureRecognizer(click)

        // Resize/rotate an existing annotation with a two-finger trackpad
        // pinch/twist while the drag tool is active. Both need `delegate` set
        // so they can recognize simultaneously with each other and with the
        // pan recognizer above (AppKit's default, like UIKit's, is to let
        // only one gesture recognizer per view win).
        magnificationGesture.target = self
        magnificationGesture.action = #selector(handleMagnification(_:))
        rotationGesture.target = self
        rotationGesture.action = #selector(handleRotation(_:))
        magnificationGesture.delegate = self
        rotationGesture.delegate = self
        addGestureRecognizer(magnificationGesture)
        addGestureRecognizer(rotationGesture)
    }

    @objc private func handleClick(_ gesture: NSClickGestureRecognizer) {
        guard tool == .text else { return }
        let location = gesture.location(in: self)
        onRequestTextInput?(location) { [weak self] text in
            guard let self, let text, !text.trimmingCharacters(in: .whitespacesAndNewlines).isEmpty else { return }
            let annotation = FeedbackAnnotation(
                kind: .text,
                points: [self.normalize(location)],
                colorHex: self.strokeColor.hexString,
                label: text
            )
            self.completedAnnotations.append(annotation)
        }
    }

    @objc private func handlePan(_ gesture: NSPanGestureRecognizer) {
        let location = gesture.location(in: self)

        if tool == .drag {
            switch gesture.state {
            case .began:
                if let index = draggableAnnotationIndex(at: location) {
                    draggedAnnotationIndex = index
                    draggedAnnotationOriginalPoints = completedAnnotations[index].points
                    dragAnnotationStartLocation = location
                }
            case .changed:
                if let index = draggedAnnotationIndex {
                    applyDrag(to: index, currentLocation: location)
                }
            case .ended, .cancelled:
                draggedAnnotationIndex = nil
                draggedAnnotationOriginalPoints = []
            default:
                break
            }
            return
        }

        guard tool != .text else { return }

        switch gesture.state {
        case .began:
            switch tool {
            case .pen:
                activeFreehandPoints = [location]
            case .rectangle, .arrow:
                dragStart = location
                dragCurrent = location
            case .text, .drag:
                break
            }
        case .changed:
            switch tool {
            case .pen:
                activeFreehandPoints.append(location)
            case .rectangle, .arrow:
                dragCurrent = location
            case .text, .drag:
                break
            }
            needsDisplay = true
        case .ended, .cancelled:
            switch tool {
            case .pen:
                if activeFreehandPoints.count > 1 {
                    completedAnnotations.append(
                        FeedbackAnnotation(
                            kind: .freehand,
                            points: activeFreehandPoints.map(normalize),
                            colorHex: strokeColor.hexString
                        )
                    )
                }
                activeFreehandPoints = []
            case .rectangle, .arrow:
                if let start = dragStart, let end = dragCurrent, start.distance(to: end) > 4 {
                    completedAnnotations.append(
                        FeedbackAnnotation(
                            kind: tool == .rectangle ? .rectangle : .arrow,
                            points: [normalize(start), normalize(end)],
                            colorHex: strokeColor.hexString
                        )
                    )
                }
                dragStart = nil
                dragCurrent = nil
            case .text, .drag:
                break
            }
            needsDisplay = true
        default:
            break
        }
    }

    @objc private func handleMagnification(_ gesture: NSMagnificationGestureRecognizer) {
        guard tool == .drag else { return }
        switch gesture.state {
        case .began:
            beginTransformIfNeeded(at: gesture.location(in: self))
        case .changed:
            if let index = transformedAnnotationIndex {
                // Unlike UIPinchGestureRecognizer.scale (multiplicative,
                // starts at 1), NSMagnificationGestureRecognizer.magnification
                // is the *change* as a fraction and starts at 0 — a value of
                // 0.5 means "50% bigger." Adding 1 converts it to the same
                // multiplicative factor the shared `applyScale` expects.
                applyScale(to: index, gestureScale: 1 + gesture.magnification)
            }
        case .ended, .cancelled, .failed:
            endTransformIfFinished()
        default:
            break
        }
    }

    @objc private func handleRotation(_ gesture: NSRotationGestureRecognizer) {
        guard tool == .drag else { return }
        switch gesture.state {
        case .began:
            beginTransformIfNeeded(at: gesture.location(in: self))
        case .changed:
            if let index = transformedAnnotationIndex {
                applyRotation(to: index, gestureRotation: gesture.rotation)
            }
        case .ended, .cancelled, .failed:
            endTransformIfFinished()
        default:
            break
        }
    }

    /// Shared by both the magnification and rotation recognizers so
    /// whichever of the two crosses its own recognition threshold first
    /// picks the target annotation for both.
    private func beginTransformIfNeeded(at location: CGPoint) {
        guard transformedAnnotationIndex == nil, let index = draggableAnnotationIndex(at: location) else { return }
        transformedAnnotationIndex = index
        transformedAnnotationOriginalScale = completedAnnotations[index].scale
        transformedAnnotationOriginalRotation = completedAnnotations[index].rotation
    }

    /// Only clears the shared target once *both* two-finger gestures have
    /// actually finished, so lifting to a single finger mid-gesture (which
    /// can end one recognizer slightly before the other) doesn't drop
    /// tracking while the other is still live.
    private func endTransformIfFinished() {
        let stillActive = [magnificationGesture.state, rotationGesture.state].contains { $0 == .began || $0 == .changed }
        guard !stillActive else { return }
        transformedAnnotationIndex = nil
        transformedAnnotationOriginalScale = 1
        transformedAnnotationOriginalRotation = 0
    }

    private func applyScale(to index: Int, gestureScale: CGFloat) {
        guard index < completedAnnotations.count else { return }
        var annotation = completedAnnotations[index]
        annotation.scale = max(0.2, transformedAnnotationOriginalScale * Double(gestureScale))
        completedAnnotations[index] = annotation
    }

    private func applyRotation(to index: Int, gestureRotation: CGFloat) {
        guard index < completedAnnotations.count else { return }
        var annotation = completedAnnotations[index]
        annotation.rotation = transformedAnnotationOriginalRotation + Double(gestureRotation)
        completedAnnotations[index] = annotation
    }

    /// Topmost rectangle/arrow/text annotation hit by `location`, if any.
    private func draggableAnnotationIndex(at location: CGPoint) -> Int? {
        for index in completedAnnotations.indices.reversed() {
            if AnnotationRenderer.hitTest(completedAnnotations[index], at: location, targetSize: bounds.size) {
                return index
            }
        }
        return nil
    }

    private func applyDrag(to index: Int, currentLocation: CGPoint) {
        guard bounds.width > 0, bounds.height > 0, index < completedAnnotations.count else { return }
        let normalizedDelta = CGPoint(
            x: (currentLocation.x - dragAnnotationStartLocation.x) / bounds.width,
            y: (currentLocation.y - dragAnnotationStartLocation.y) / bounds.height
        )
        var annotation = completedAnnotations[index]
        annotation.points = draggedAnnotationOriginalPoints.map {
            CGPoint(x: $0.x + normalizedDelta.x, y: $0.y + normalizedDelta.y)
        }
        completedAnnotations[index] = annotation
    }

    func undoLast() {
        guard !completedAnnotations.isEmpty else { return }
        completedAnnotations.removeLast()
    }

    func clearAll() {
        completedAnnotations.removeAll()
    }

    private func normalize(_ point: CGPoint) -> CGPoint {
        guard bounds.width > 0, bounds.height > 0 else { return .zero }
        return CGPoint(x: point.x / bounds.width, y: point.y / bounds.height)
    }

    override func draw(_ dirtyRect: NSRect) {
        guard let ctx = NSGraphicsContext.current?.cgContext else { return }

        for annotation in completedAnnotations {
            AnnotationRenderer.draw(annotation, in: ctx, targetSize: bounds.size)
        }

        // In-progress shape preview.
        if tool == .pen, activeFreehandPoints.count > 1 {
            AnnotationRenderer.drawFreehand(activeFreehandPoints, color: strokeColor.cgColor, in: ctx)
        } else if let start = dragStart, let end = dragCurrent {
            if tool == .rectangle {
                AnnotationRenderer.drawRectangle(start: start, end: end, color: strokeColor.cgColor, in: ctx)
            } else if tool == .arrow {
                AnnotationRenderer.drawArrow(start: start, end: end, color: strokeColor.cgColor, in: ctx)
            }
        }
    }

    /// Renders the base screenshot with every annotation burned in, at the
    /// base image's native pixel size (independent of this view's on-screen
    /// size). `NSImage(size:flipped:drawingHandler:)` sets up `NSGraphicsContext.current`
    /// for the block automatically — the AppKit analog of `UIGraphicsImageRenderer`.
    func flattenedImage(baseImage: NSImage) -> NSImage {
        let size = baseImage.size
        return NSImage(size: size, flipped: true) { rect in
            baseImage.draw(in: rect)
            if let ctx = NSGraphicsContext.current?.cgContext {
                for annotation in self.completedAnnotations {
                    AnnotationRenderer.draw(annotation, in: ctx, targetSize: size)
                }
            }
            return true
        }
    }
}

extension AnnotationCanvasView: NSGestureRecognizerDelegate {
    func gestureRecognizer(
        _ gestureRecognizer: NSGestureRecognizer,
        shouldRecognizeSimultaneouslyWith otherGestureRecognizer: NSGestureRecognizer
    ) -> Bool {
        true
    }
}

private extension CGPoint {
    func distance(to other: CGPoint) -> CGFloat {
        hypot(x - other.x, y - other.y)
    }
}
#endif
