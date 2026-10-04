package com.feedbackkit

import java.util.Date
import java.util.UUID

/**
 * A normalized (0..1) point on the screenshot, relative to its width/height.
 * Encodes as an `[x, y]` array on the wire — the same shape Swift's `CGPoint`
 * encodes to — so the dashboard and the Developer Portal read Android reports
 * with the exact code they use for iOS ones.
 */
data class NormalizedPoint(val x: Double, val y: Double)

/**
 * A single markup shape drawn by the user on top of the captured screenshot.
 * Mirrors `FeedbackAnnotation` in the Swift SDK field for field.
 */
data class FeedbackAnnotation(
    val kind: Kind,
    /**
     * Normalized (0..1) points. Freehand uses every point on the stroke;
     * rectangle/arrow use exactly two points (start, end); text uses one.
     */
    val points: List<NormalizedPoint>,
    val colorHex: String,
    /** Only populated for [Kind.TEXT] annotations. */
    val label: String? = null,
    /** Uniform scale around the shape's center (rectangle/arrow) or font size (text), set by pinching with the Move tool. */
    val scale: Double = 1.0,
    /** Rotation in radians around the shape's center (rectangle/arrow only), set by twisting with the Move tool. */
    val rotation: Double = 0.0,
) {
    enum class Kind(val wireName: String) {
        RECTANGLE("rectangle"),
        ARROW("arrow"),
        FREEHAND("freehand"),
        TEXT("text");

        companion object {
            fun fromWire(name: String): Kind? = entries.firstOrNull { it.wireName == name }
        }
    }
}

/** A file the user attached from the composer's attach menu, separate from the screenshot. */
class FeedbackAttachment(
    val filename: String,
    val mimeType: String,
    val data: ByteArray,
) {
    override fun equals(other: Any?): Boolean =
        other is FeedbackAttachment && other.filename == filename && other.mimeType == mimeType && other.data.contentEquals(data)

    override fun hashCode(): Int = (filename.hashCode() * 31 + mimeType.hashCode()) * 31 + data.contentHashCode()
}

/**
 * The device/app/screen a report was captured on. Same JSON shape as the
 * Swift `FeedbackEnvironment` (camelCase keys — it's stored as opaque JSONB),
 * with `osName = "Android"`.
 */
data class FeedbackEnvironment(
    val osName: String,
    val osVersion: String,
    val deviceModel: String,
    val appVersion: String,
    val appBuild: String,
    /** The application id (package name) — the Android analog of a bundle identifier. */
    val bundleIdentifier: String,
    /** [FeedbackKit.currentScreen], or the foreground activity's class name if that's unset. */
    val screenName: String?,
    val locale: String,
    /** Display size in dp — the Android analog of iOS points. */
    val screenWidthPoints: Double,
    val screenHeightPoints: Double,
    /** Pixels per dp (`DisplayMetrics.density`). */
    val screenScale: Double,
)

/**
 * The complete report FeedbackKit hands back on submit — the contract. What
 * the app does with it (log it, POST it to its own backend, or hand it to
 * [FeedbackSubmitter] for the hosted dashboard) is entirely up to the app.
 */
class FeedbackReport(
    val id: String = UUID.randomUUID().toString().uppercase(),
    val createdAt: Date = Date(),
    val text: String,
    /** Raw capture of the screen at trigger time, PNG. Null if the reporter turned "Include Screenshot" off. */
    val screenshotRawPng: ByteArray?,
    /** The same capture with annotations burned in, PNG. Null under the same conditions. */
    val screenshotAnnotatedPng: ByteArray?,
    /** Structured shapes kept alongside the flattened image. Empty when there's no screenshot. */
    val annotations: List<FeedbackAnnotation>,
    val environment: FeedbackEnvironment,
    val attachment: FeedbackAttachment? = null,
    val products: List<FeedbackProduct> = emptyList(),
    /** "Notify Me When It's Fixed" from the composer's menu; off by default. */
    val notifyReporter: Boolean = false,
) {
    override fun toString(): String =
        "FeedbackReport(id=$id, text=\"$text\", annotations=${annotations.size}, " +
            "screenshot=${screenshotRawPng?.size ?: 0}B, screen=${environment.screenName})"
}

/** A product or surface of a project (e.g. "Android App", "Backend API"). */
data class FeedbackProduct(
    val key: String,
    val name: String,
    val description: String = "",
    val isDefault: Boolean = false,
)

/**
 * Brands the feedback screen with the host app's own accent colors. Hex
 * strings (e.g. `"#7C3AED"`), the same as the Swift SDK's `FeedbackTheme`.
 * Primary drives the send button, the selected tool and product chips;
 * secondary drives Cancel and the attach button.
 */
data class FeedbackTheme(
    val primaryColorHex: String,
    val secondaryColorHex: String,
)

/** Optional identity of the person using the app, attached to every report they submit. */
data class FeedbackUser(
    val id: String? = null,
    val email: String? = null,
    val name: String? = null,
)

/** Configuration for the optional built-in submission path to the hosted dashboard. */
data class FeedbackKitConfiguration @JvmOverloads constructor(
    /** e.g. `https://<project>.supabase.co/functions/v1/ingest-feedback`. */
    val endpointUrl: String,
    /** The project key from the dashboard — a routing key, safe to ship in the app. */
    val projectKey: String,
    val products: List<FeedbackProduct> = emptyList(),
    /** The default product for this app target (e.g. "android"). */
    val defaultProductKey: String? = null,
    /** Where fix updates come from; null derives it from [endpointUrl]. */
    val reporterUpdatesUrl: String? = null,
) {
    /**
     * [reporterUpdatesUrl] if set, else the `reporter-updates` function next
     * to the ingestion endpoint (`…/functions/v1/ingest-feedback` → `…/functions/v1/reporter-updates`).
     */
    val resolvedReporterUpdatesUrl: String
        get() {
            reporterUpdatesUrl?.let { return it }
            val trimmed = endpointUrl.substringBefore('?').trimEnd('/')
            return trimmed.substringBeforeLast('/') + "/reporter-updates"
        }
}
