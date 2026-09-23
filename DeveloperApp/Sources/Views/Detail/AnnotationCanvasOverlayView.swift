import SwiftUI
import FeedbackKit

public struct AnnotationCanvasOverlayView: View {
    public let annotations: [FeedbackAnnotation]

    public init(annotations: [FeedbackAnnotation]) {
        self.annotations = annotations
    }

    public var body: some View {
        Canvas { context, size in
            context.withCGContext { cgContext in
                AnnotationRenderer.draw(all: annotations, in: cgContext, targetSize: size)
            }
        }
        .allowsHitTesting(false)
    }
}
