import UIKit

/// A transparent overlay that sits on top of the screenshot preview and lets
/// the user mark it up. Handles its own touch tracking for all five tool
/// kinds and can flatten itself plus the base screenshot into a single image.
final class AnnotationCanvasView: UIView {
    enum Tool {
        case pen
        case rectangle
        case arrow
        case text
        /// Rectangle/arrow/text annotations can only be grabbed and moved
        /// while this tool is active — otherwise a pan always draws with
        /// whichever other tool is selected.
        case drag
    }

    var tool: Tool = .pen
    var strokeColor: UIColor = .systemRed {
        didSet { setNeedsDisplay() }
    }

    /// Called after a text-tool tap so the host view controller can present a
    /// text-entry prompt (keeps UIAlertController presentation out of this view).
    var onRequestTextInput: ((_ locationInView: CGPoint, _ completion: @escaping (String?) -> Void) -> Void)?

    private(set) var completedAnnotations: [FeedbackAnnotation] = [] {
        didSet { setNeedsDisplay() }
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

    override init(frame: CGRect) {
        super.init(frame: frame)
        backgroundColor = .clear
        isOpaque = false
        setUpGestures()
    }

    required init?(coder: NSCoder) {
        super.init(coder: coder)
        backgroundColor = .clear
        isOpaque = false
        setUpGestures()
    }

    private func setUpGestures() {
        let pan = UIPanGestureRecognizer(target: self, action: #selector(handlePan(_:)))
        pan.maximumNumberOfTouches = 1
        addGestureRecognizer(pan)

        let tap = UITapGestureRecognizer(target: self, action: #selector(handleTap(_:)))
        addGestureRecognizer(tap)
    }

    @objc private func handleTap(_ gesture: UITapGestureRecognizer) {
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

    @objc private func handlePan(_ gesture: UIPanGestureRecognizer) {
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
            setNeedsDisplay()
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
            setNeedsDisplay()
        default:
            break
        }
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

    override func draw(_ rect: CGRect) {
        guard let ctx = UIGraphicsGetCurrentContext() else { return }

        for annotation in completedAnnotations {
            AnnotationRenderer.draw(annotation, in: ctx, targetSize: bounds.size)
        }

        // In-progress shape preview.
        if tool == .pen, activeFreehandPoints.count > 1 {
            AnnotationRenderer.drawFreehand(activeFreehandPoints, color: strokeColor, in: ctx)
        } else if let start = dragStart, let end = dragCurrent {
            if tool == .rectangle {
                AnnotationRenderer.drawRectangle(start: start, end: end, color: strokeColor, in: ctx)
            } else if tool == .arrow {
                AnnotationRenderer.drawArrow(start: start, end: end, color: strokeColor, in: ctx)
            }
        }
    }

    /// Renders the base screenshot with every annotation burned in, at the
    /// base image's native pixel size (independent of this view's on-screen size).
    func flattenedImage(baseImage: UIImage) -> UIImage {
        let renderer = UIGraphicsImageRenderer(size: baseImage.size)
        return renderer.image { context in
            baseImage.draw(at: .zero)
            for annotation in completedAnnotations {
                AnnotationRenderer.draw(annotation, in: context.cgContext, targetSize: baseImage.size)
            }
        }
    }
}

private extension CGPoint {
    func distance(to other: CGPoint) -> CGFloat {
        hypot(x - other.x, y - other.y)
    }
}
