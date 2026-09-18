import UIKit

/// Shared drawing logic used both for live on-screen preview
/// (`AnnotationCanvasView.draw`) and for flattening into the final PNG
/// (`AnnotationCanvasView.flattenedImage`), so the two always look identical.
enum AnnotationRenderer {
    static let strokeWidth: CGFloat = 4

    static func draw(_ annotation: FeedbackAnnotation, in ctx: CGContext, targetSize: CGSize) {
        let color = UIColor(hex: annotation.colorHex) ?? .systemRed
        let points = annotation.points.map { CGPoint(x: $0.x * targetSize.width, y: $0.y * targetSize.height) }

        switch annotation.kind {
        case .freehand:
            drawFreehand(points, color: color, in: ctx)
        case .rectangle:
            guard points.count == 2 else { return }
            drawRectangle(start: points[0], end: points[1], color: color, in: ctx)
        case .arrow:
            guard points.count == 2 else { return }
            drawArrow(start: points[0], end: points[1], color: color, in: ctx)
        case .text:
            guard let point = points.first, let label = annotation.label else { return }
            drawText(label, at: point, color: color, in: ctx)
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

    static func drawRectangle(start: CGPoint, end: CGPoint, color: UIColor, in ctx: CGContext) {
        let rect = CGRect(
            x: min(start.x, end.x),
            y: min(start.y, end.y),
            width: abs(end.x - start.x),
            height: abs(end.y - start.y)
        )
        let path = UIBezierPath(rect: rect)
        path.lineWidth = strokeWidth
        ctx.saveGState()
        color.setStroke()
        path.stroke()
        ctx.restoreGState()
    }

    static func drawArrow(start: CGPoint, end: CGPoint, color: UIColor, in ctx: CGContext) {
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

    static func drawText(_ text: String, at point: CGPoint, color: UIColor, in ctx: CGContext) {
        let font = UIFont.boldSystemFont(ofSize: 16)
        let attributes: [NSAttributedString.Key: Any] = [.font: font, .foregroundColor: UIColor.white]
        let textSize = (text as NSString).size(withAttributes: attributes)
        let padding: CGFloat = 8
        let bubbleRect = CGRect(
            x: point.x,
            y: point.y,
            width: textSize.width + padding * 2,
            height: textSize.height + padding * 2
        )
        let bubblePath = UIBezierPath(roundedRect: bubbleRect, cornerRadius: 8)

        ctx.saveGState()
        color.setFill()
        bubblePath.fill()
        ctx.restoreGState()

        (text as NSString).draw(
            at: CGPoint(x: bubbleRect.minX + padding, y: bubbleRect.minY + padding),
            withAttributes: attributes
        )
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
