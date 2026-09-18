import CoreGraphics
import Foundation

/// A single markup shape drawn by the user on top of the captured screenshot.
///
/// Points are normalized to the 0...1 range relative to the screenshot's
/// width/height so annotations can be re-rendered at any resolution
/// (e.g. by the dashboard) independent of the capturing device's screen size.
public struct FeedbackAnnotation: Codable, Equatable, Sendable {
    public enum Kind: String, Codable, Sendable {
        case rectangle
        case arrow
        case freehand
        case text
    }

    public var kind: Kind
    /// Normalized (0...1) points. Freehand uses every point on the stroke;
    /// rectangle/arrow use exactly two points (start, end); text uses one.
    public var points: [CGPoint]
    public var colorHex: String
    /// Only populated for `.text` annotations.
    public var label: String?

    public init(kind: Kind, points: [CGPoint], colorHex: String, label: String? = nil) {
        self.kind = kind
        self.points = points
        self.colorHex = colorHex
        self.label = label
    }
}

/// An arbitrary file the user attached to the report from the composer's
/// attach button, separate from the screenshot itself (e.g. a log file, a
/// second screenshot, a video).
public struct FeedbackAttachment: Codable, Equatable, Sendable {
    public var filename: String
    public var mimeType: String
    public var data: Data

    public init(filename: String, mimeType: String, data: Data) {
        self.filename = filename
        self.mimeType = mimeType
        self.data = data
    }
}

/// Information about the device/app/screen the report was captured from.
/// This is what lets a developer reproduce the bug without asking "what device/OS/screen was this?".
public struct FeedbackEnvironment: Codable, Equatable, Sendable {
    public var osName: String
    public var osVersion: String
    public var deviceModel: String
    public var appVersion: String
    public var appBuild: String
    public var bundleIdentifier: String
    /// Developer-set (`FeedbackKit.currentScreen`) or best-effort auto-detected
    /// top view controller name. Nil if neither is available.
    public var screenName: String?
    public var locale: String
    public var screenWidthPoints: Double
    public var screenHeightPoints: Double
    public var screenScale: Double

    public init(
        osName: String,
        osVersion: String,
        deviceModel: String,
        appVersion: String,
        appBuild: String,
        bundleIdentifier: String,
        screenName: String?,
        locale: String,
        screenWidthPoints: Double,
        screenHeightPoints: Double,
        screenScale: Double
    ) {
        self.osName = osName
        self.osVersion = osVersion
        self.deviceModel = deviceModel
        self.appVersion = appVersion
        self.appBuild = appBuild
        self.bundleIdentifier = bundleIdentifier
        self.screenName = screenName
        self.locale = locale
        self.screenWidthPoints = screenWidthPoints
        self.screenHeightPoints = screenHeightPoints
        self.screenScale = screenScale
    }
}

/// The complete feedback report FeedbackKit hands back to the developer on submit.
///
/// This is the contract: FeedbackKit's job ends at producing this value. What the
/// developer does with it (print it, POST it to their own backend, or call
/// `FeedbackSubmitter` to send it to the optional hosted dashboard) is entirely
/// up to them.
public struct FeedbackReport: Codable, Equatable, Sendable {
    public var id: UUID
    public var createdAt: Date
    public var text: String
    /// Raw, unmodified capture of the screen at trigger time. PNG-encoded.
    public var screenshotRawPNG: Data
    /// Same capture with the user's annotations flattened/burned in. PNG-encoded.
    public var screenshotAnnotatedPNG: Data
    /// Structured annotation shapes, kept alongside the flattened image so a
    /// consumer (e.g. the dashboard) can re-render or edit them later.
    public var annotations: [FeedbackAnnotation]
    public var environment: FeedbackEnvironment
    /// Optional file attached from the composer, separate from the screenshot.
    public var attachment: FeedbackAttachment?

    public init(
        id: UUID = UUID(),
        createdAt: Date = Date(),
        text: String,
        screenshotRawPNG: Data,
        screenshotAnnotatedPNG: Data,
        annotations: [FeedbackAnnotation],
        environment: FeedbackEnvironment,
        attachment: FeedbackAttachment? = nil
    ) {
        self.id = id
        self.createdAt = createdAt
        self.text = text
        self.screenshotRawPNG = screenshotRawPNG
        self.screenshotAnnotatedPNG = screenshotAnnotatedPNG
        self.annotations = annotations
        self.environment = environment
        self.attachment = attachment
    }
}
