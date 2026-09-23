# Swift SDK (`Sources/FeedbackKit`)

FeedbackKit is packaged as a single Swift Package supporting iOS, macOS, and watchOS.

---

## Package Structure

```
Sources/FeedbackKit/
├── FeedbackKit.swift              # Main entry point & configuration
├── Capture/
│   ├── ScreenshotCapture.swift    # iOS window-level capture
│   ├── ScreenshotCapture+macOS.swift
│   └── ScreenshotCapture+watchOS.swift
├── Drawing/
│   ├── AnnotationRenderer.swift   # Shared cross-platform CGContext drawing
│   ├── AnnotationCanvasView.swift # iOS UIKit drawing canvas
│   └── AnnotationCanvasView+macOS.swift
├── Model/
│   ├── FeedbackReport.swift       # Public report data model
│   ├── FeedbackAnnotation.swift   # Vector annotations & tool types
│   └── EnvironmentInfo.swift      # Device and OS diagnostics
├── UI/
│   ├── FeedbackViewController.swift # iOS full-screen composer
│   ├── FeedbackWindowController.swift # macOS modal sheet composer
│   └── FeedbackQuickNoteView.swift   # watchOS lightweight view
└── Support/
    ├── PlatformTypes.swift        # Cross-platform color and font aliases
    └── FeedbackTheme.swift        # Custom accent theming
```

---

## Platform Compilation Rules

Swift Package Manager compiles all files in a target for the active destination. To prevent compilation errors (e.g. `import AppKit` failing on iOS):

1. **iOS Files**: Wrapped in `#if os(iOS)` around their entire contents.
2. **macOS Files**: Suffix `+macOS.swift`, wrapped in `#if os(macOS)`.
3. **watchOS Files**: Suffix `+watchOS.swift`, wrapped in `#if os(watchOS)`.
4. **Shared Files**: `AnnotationRenderer.swift` and `PlatformTypes.swift` are strictly `#if os()`-agnostic (using `#if os(iOS) || os(watchOS)` only where UIKit data types overlap).

---

## Window-Level Screenshot Capture

FeedbackKit captures the host app's window rather than a specific `UIViewController` or SwiftUI `View`:

- **iOS**: Uses `UIWindowScene` and `drawHierarchy(in:afterScreenUpdates:)`. Works across pure UIKit, pure SwiftUI, or mixed hybrid screens.
- **macOS**: Uses `NSView.cacheDisplay(in:to:)` on the window's content view hierarchy.
- **No Screen Recording Permission**: Because both APIs render the in-process view hierarchy rather than compositing the desktop frame buffer, apps using FeedbackKit never trigger macOS Screen Recording or privacy permission prompts.

---

## watchOS Differences

watchOS is intentionally not a direct UI port:
- Screens are too small for interactive markup (pen, arrow, rectangle).
- There is no `UIWindow` to perform window-level screenshot capture from.
- `FeedbackQuickNoteView` is a pure SwiftUI view designed for quick text/dictation input.
- `ScreenshotCapture` on watchOS generates a clean placeholder graphic rather than capturing live pixels.

---

## Host App Branding (`FeedbackTheme`)

Host applications can brand the FeedbackKit UI using primary and secondary hex colors:

```swift
FeedbackKit.theme = FeedbackTheme(
    primaryColorHex: "#6366F1",
    secondaryColorHex: "#4F46E5"
)
```

- Primary color drives call-to-action buttons (Send, selected tool, screenshot switch tint).
- Secondary color drives secondary controls (Cancel, Attach file).
