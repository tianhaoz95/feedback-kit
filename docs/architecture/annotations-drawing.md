# Annotation Geometry & Drawing

The drawing engine in FeedbackKit allows users to mark up screenshots with shapes, arrows, rectangles, and freehand pens.

---

## Normalized Coordinate System

To ensure annotations look identical on any screen size, device orientation, and export resolution, **all coordinates are stored as normalized floats from `0.0` to `1.0`**.

```
(0.0, 0.0) ───────────────────────── (1.0, 0.0)
    │                                     │
    │            FeedbackAnnotation       │
    │            points: [                │
    │              { x: 0.25, y: 0.50 },  │
    │              { x: 0.75, y: 0.50 }   │
    │            ]                        │
    │                                     │
(0.0, 1.0) ───────────────────────── (1.0, 1.0)
```

- When the user draws on an iPhone 16 Pro (`1179 × 2556` pixels), points are normalized against the screenshot's native dimensions.
- When rendered on a web dashboard running on a desktop 4K monitor, points are multiplied by the display canvas dimensions.
- When exported to the final PNG report, points are multiplied by native pixel dimensions so the output is razor-sharp.

---

## Cross-Platform `AnnotationRenderer`

`AnnotationRenderer.swift` and `PlatformTypes.swift` are the only drawing files without platform-specific `#if os(...)` wrappers.

### Why CGContext over UIBezierPath / NSBezierPath?
`UIBezierPath` (UIKit) and `NSBezierPath` (AppKit) have incompatible APIs:
- UIKit uses `addLine(to:)`, while AppKit uses `line(to:)`.
- UIKit uses `init(roundedRect:cornerRadius:)`, while AppKit uses `init(roundedRect:xRadius:yRadius:)`.

By drawing with raw **Core Graphics (`CGContext`)**, the exact same rendering file compiles and executes unmodified across iOS, macOS, and watchOS.

---

## Coordinate Flipping on macOS

- **UIKit (iOS)** has its origin at the **top-left**.
- **AppKit (macOS)** defaults to an origin at the **bottom-left**.

To prevent having two sets of Y-inverted geometry algorithms, macOS's `AnnotationCanvasView` sets:

```swift
override var isFlipped: Bool { true }
```

Flipping the AppKit view makes the coordinate system top-left-origin, allowing byte-for-byte identical drawing math between iOS and macOS.

---

## Letterboxing with `AVMakeRect`

When presenting the screenshot on devices with different aspect ratios, letterboxing or pillarboxing can occur.

FeedbackKit sizes the `AnnotationCanvasView` overlay using `AVMakeRect(aspectRatio:insideRect:)` to match the exact displayed image frame. This prevents coordinate misalignment caused by image view letterboxing.
