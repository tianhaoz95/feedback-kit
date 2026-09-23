import SwiftUI

public struct FeedbackKitLogoView: View {
    public var size: CGFloat = 88
    public var cornerRadius: CGFloat? = nil

    public init(size: CGFloat = 88, cornerRadius: CGFloat? = nil) {
        self.size = size
        self.cornerRadius = cornerRadius
    }

    public var body: some View {
        let cr = cornerRadius ?? (size * (112.0 / 512.0))
        let scale = size / 512.0

        Canvas { context, canvasSize in
            // Background rounded rect #171717
            let bgPath = Path(roundedRect: CGRect(origin: .zero, size: canvasSize), cornerRadius: cr)
            context.fill(bgPath, with: .color(Color(red: 23/255.0, green: 23/255.0, blue: 23/255.0)))

            // Speech bubble tail: (176, 325) -> (150, 392) -> (226, 325)
            var tailPath = Path()
            tailPath.move(to: CGPoint(x: 176 * scale, y: 325 * scale))
            tailPath.addLine(to: CGPoint(x: 150 * scale, y: 392 * scale))
            tailPath.addLine(to: CGPoint(x: 226 * scale, y: 325 * scale))
            tailPath.closeSubpath()
            context.fill(tailPath, with: .color(.white))

            // Speech bubble body: x: 116, y: 120, w: 280, h: 220, rx: 60
            let bubbleRect = CGRect(x: 116 * scale, y: 120 * scale, width: 280 * scale, height: 220 * scale)
            let bubblePath = Path(roundedRect: bubbleRect, cornerRadius: 60 * scale)
            context.fill(bubblePath, with: .color(.white))

            // Exclamation mark bar: x: 238, y: 160, w: 36, h: 92, rx: 18
            let barRect = CGRect(x: 238 * scale, y: 160 * scale, width: 36 * scale, height: 92 * scale)
            let barPath = Path(roundedRect: barRect, cornerRadius: 18 * scale)
            context.fill(barPath, with: .color(Color(red: 23/255.0, green: 23/255.0, blue: 23/255.0)))

            // Exclamation mark dot: cx: 256, cy: 282, r: 20
            let dotRect = CGRect(x: (256 - 20) * scale, y: (282 - 20) * scale, width: 40 * scale, height: 40 * scale)
            let dotPath = Path(ellipseIn: dotRect)
            context.fill(dotPath, with: .color(Color(red: 23/255.0, green: 23/255.0, blue: 23/255.0)))
        }
        .frame(width: size, height: size)
        .shadow(color: Color.black.opacity(0.18), radius: 10, x: 0, y: 5)
    }
}
