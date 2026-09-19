import UIKit

/// Shared drawing logic used both for live on-screen preview
/// (`AnnotationCanvasView.draw`) and for flattening into the final PNG
/// (`AnnotationCanvasView.flattenedImage`), so the two always look identical.
enum AnnotationRenderer {
    static let strokeWidth: CGFloat = 4

    static func draw(_ annotation: FeedbackAnnotation, in ctx: CGContext, targetSize: CGSize) {
        let color = UIColor(hex: annotation.colorHex) ?? .systemRed
        let points = annotation.points.map { CGPoint(x: $0.x * targetSize.width, y: $0.y * targetSize.height) }
        let scale = CGFloat(annotation.scale)
        let rotation = CGFloat(annotation.rotation)

        switch annotation.kind {
        case .freehand:
            drawFreehand(points, color: color, in: ctx)
        case .rectangle:
            guard points.count == 2 else { return }
            drawRectangle(start: points[0], end: points[1], color: color, scale: scale, rotation: rotation, in: ctx)
        case .arrow:
            guard points.count == 2 else { return }
            drawArrow(start: points[0], end: points[1], color: color, scale: scale, rotation: rotation, in: ctx)
        case .text:
            guard let point = points.first, let label = annotation.label else { return }
            drawText(label, at: point, color: color, scale: scale, in: ctx)
        }
    }

    static func drawFreehand(_ points: [CGPoint], color: UIColor, in ctx: CGContext) {
        guard let first = points.first else { return }
        let path = UIBezierPath()
        path.move(to: first)
        for point in points.dropFirst() {
            path.addLine(to: point)
        }
        path.lineWidth = strokeWidth
        path.lineJoinStyle = .round
        path.lineCapStyle = .round
        ctx.saveGState()
        color.setStroke()
        path.stroke()
        ctx.restoreGState()
    }

    /// Drawn as an explicit (possibly rotated) quadrilateral rather than a
    /// `CGRect`, since a `CGRect` can only ever be axis-aligned — rotating
    /// the two corner points and re-deriving a `min`/`max` rect from them
    /// would just collapse back to the unrotated bounding box.
    static func drawRectangle(
        start: CGPoint,
        end: CGPoint,
        color: UIColor,
        scale: CGFloat = 1,
        rotation: CGFloat = 0,
        in ctx: CGContext
    ) {
        let center = CGPoint(x: (start.x + end.x) / 2, y: (start.y + end.y) / 2)
        let halfWidth = abs(end.x - start.x) / 2 * scale
        let halfHeight = abs(end.y - start.y) / 2 * scale

        let corners = [
            CGPoint(x: -halfWidth, y: -halfHeight),
            CGPoint(x: halfWidth, y: -halfHeight),
            CGPoint(x: halfWidth, y: halfHeight),
            CGPoint(x: -halfWidth, y: halfHeight)
        ].map { rotate($0, by: rotation, around: center) }

        let path = UIBezierPath()
        path.move(to: corners[0])
        for corner in corners.dropFirst() {
            path.addLine(to: corner)
        }
        path.close()
        path.lineWidth = strokeWidth
        ctx.saveGState()
        color.setStroke()
        path.stroke()
        ctx.restoreGState()
    }

    static func drawArrow(
        start rawStart: CGPoint,
        end rawEnd: CGPoint,
        color: UIColor,
        scale: CGFloat = 1,
        rotation: CGFloat = 0,
        in ctx: CGContext
    ) {
        let center = CGPoint(x: (rawStart.x + rawEnd.x) / 2, y: (rawStart.y + rawEnd.y) / 2)
        let start = rotate(scaled(rawStart, by: scale, around: center), by: rotation, around: center)
        let end = rotate(scaled(rawEnd, by: scale, around: center), by: rotation, around: center)

        let path = UIBezierPath()
        path.move(to: start)
        path.addLine(to: end)

        let angle = atan2(end.y - start.y, end.x - start.x)
        let headLength: CGFloat = 18
        let headAngle: CGFloat = .pi / 7

        let left = CGPoint(
            x: end.x - headLength * cos(angle - headAngle),
            y: end.y - headLength * sin(angle - headAngle)
        )
        let right = CGPoint(
            x: end.x - headLength * cos(angle + headAngle),
            y: end.y - headLength * sin(angle + headAngle)
        )
        path.addLine(to: left)
        path.move(to: end)
        path.addLine(to: right)

        path.lineWidth = strokeWidth
        path.lineJoinStyle = .round
        path.lineCapStyle = .round
        ctx.saveGState()
        color.setStroke()
        path.stroke()
        ctx.restoreGState()
    }

    static func drawText(_ text: String, at point: CGPoint, color: UIColor, scale: CGFloat = 1, in ctx: CGContext) {
        let attributes: [NSAttributedString.Key: Any] = [.font: textFont(scale: scale), .foregroundColor: UIColor.white]
        let bubbleRect = textBubbleRect(for: text, at: point, scale: scale)
        let bubblePath = UIBezierPath(roundedRect: bubbleRect, cornerRadius: 8)

        ctx.saveGState()
        color.setFill()
        bubblePath.fill()
        ctx.restoreGState()

        (text as NSString).draw(
            at: CGPoint(x: bubbleRect.minX + textPadding, y: bubbleRect.minY + textPadding),
            withAttributes: attributes
        )
    }

    private static let baseFontSize: CGFloat = 16
    private static let textPadding: CGFloat = 8

    private static func textFont(scale: CGFloat) -> UIFont {
        .boldSystemFont(ofSize: baseFontSize * scale)
    }

    /// The bubble rect a `.text` annotation occupies, shared by drawing and hit-testing
    /// so a tap/drag registers exactly where the visible bubble is.
    static func textBubbleRect(for text: String, at point: CGPoint, scale: CGFloat = 1) -> CGRect {
        let textSize = (text as NSString).size(withAttributes: [.font: textFont(scale: scale)])
        let padding = textPadding * scale
        return CGRect(
            x: point.x,
            y: point.y,
            width: textSize.width + padding * 2,
            height: textSize.height + padding * 2
        )
    }

    private static func rotate(_ point: CGPoint, by angle: CGFloat, around center: CGPoint) -> CGPoint {
        let dx = point.x - center.x
        let dy = point.y - center.y
        return CGPoint(
            x: center.x + dx * cos(angle) - dy * sin(angle),
            y: center.y + dx * sin(angle) + dy * cos(angle)
        )
    }

    private static func scaled(_ point: CGPoint, by scale: CGFloat, around center: CGPoint) -> CGPoint {
        CGPoint(x: center.x + (point.x - center.x) * scale, y: center.y + (point.y - center.y) * scale)
    }

    /// How close a touch needs to land to an existing rectangle/arrow/text
    /// annotation to count as grabbing it for a drag. Freehand strokes are
    /// intentionally not draggable.
    static let hitTestTolerance: CGFloat = 16

    static func hitTest(_ annotation: FeedbackAnnotation, at point: CGPoint, targetSize: CGSize) -> Bool {
        let points = annotation.points.map { CGPoint(x: $0.x * targetSize.width, y: $0.y * targetSize.height) }
        let scale = CGFloat(annotation.scale)

        switch annotation.kind {
        case .rectangle:
            guard points.count == 2 else { return false }
            // Approximated as the scaled-but-unrotated bounding box — close
            // enough given the existing tolerance padding, without needing a
            // point-in-rotated-polygon test.
            let center = CGPoint(x: (points[0].x + points[1].x) / 2, y: (points[0].y + points[1].y) / 2)
            let halfWidth = abs(points[1].x - points[0].x) / 2 * scale
            let halfHeight = abs(points[1].y - points[0].y) / 2 * scale
            let rect = CGRect(
                x: center.x - halfWidth,
                y: center.y - halfHeight,
                width: halfWidth * 2,
                height: halfHeight * 2
            )
            return rect.insetBy(dx: -hitTestTolerance, dy: -hitTestTolerance).contains(point)
        case .arrow:
            guard points.count == 2 else { return false }
            let center = CGPoint(x: (points[0].x + points[1].x) / 2, y: (points[0].y + points[1].y) / 2)
            let start = scaled(points[0], by: scale, around: center)
            let end = scaled(points[1], by: scale, around: center)
            return distance(from: point, toSegmentFrom: start, to: end) <= hitTestTolerance
        case .text:
            guard let origin = points.first, let label = annotation.label else { return false }
            return textBubbleRect(for: label, at: origin, scale: scale)
                .insetBy(dx: -hitTestTolerance / 2, dy: -hitTestTolerance / 2)
                .contains(point)
        case .freehand:
            return false
        }
    }

    private static func distance(from point: CGPoint, toSegmentFrom a: CGPoint, to b: CGPoint) -> CGFloat {
        let dx = b.x - a.x
        let dy = b.y - a.y
        let lengthSquared = dx * dx + dy * dy
        guard lengthSquared > 0 else {
            return hypot(point.x - a.x, point.y - a.y)
        }
        let t = max(0, min(1, ((point.x - a.x) * dx + (point.y - a.y) * dy) / lengthSquared))
        let projection = CGPoint(x: a.x + t * dx, y: a.y + t * dy)
        return hypot(point.x - projection.x, point.y - projection.y)
    }
}

extension UIColor {
    convenience init?(hex: String) {
        var hexSanitized = hex.trimmingCharacters(in: .whitespacesAndNewlines)
        hexSanitized = hexSanitized.replacingOccurrences(of: "#", with: "")
        guard hexSanitized.count == 6, let rgb = UInt32(hexSanitized, radix: 16) else { return nil }
        self.init(
            red: CGFloat((rgb & 0xFF0000) >> 16) / 255,
            green: CGFloat((rgb & 0x00FF00) >> 8) / 255,
            blue: CGFloat(rgb & 0x0000FF) / 255,
            alpha: 1
        )
    }

    var hexString: String {
        var red: CGFloat = 0, green: CGFloat = 0, blue: CGFloat = 0, alpha: CGFloat = 0
        getRed(&red, green: &green, blue: &blue, alpha: &alpha)
        return String(
            format: "#%02X%02X%02X",
            Int(red * 255),
            Int(green * 255),
            Int(blue * 255)
        )
    }
}
