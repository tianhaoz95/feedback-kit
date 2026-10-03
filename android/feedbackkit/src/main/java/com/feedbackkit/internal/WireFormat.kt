package com.feedbackkit.internal

import com.feedbackkit.FeedbackAnnotation
import com.feedbackkit.FeedbackEnvironment
import com.feedbackkit.FeedbackProduct
import com.feedbackkit.FeedbackReport
import com.feedbackkit.FeedbackUser
import org.json.JSONArray
import org.json.JSONObject
import java.text.SimpleDateFormat
import java.util.Date
import java.util.Locale
import java.util.TimeZone

/**
 * The JSON the ingestion endpoint receives. Kept apart from the public model
 * (camelCase Kotlin) the same way `IngestPayload` is in the Swift SDK's
 * FeedbackSubmitter.swift: top-level keys are snake_case to match Postgres,
 * while `environment` and `annotations` stay camelCase because they're
 * stored as opaque JSONB and read directly by the dashboard's TypeScript types.
 *
 * Nothing enforces that this matches `IngestPayload` in Swift, the
 * `ingest-feedback` Edge Function and web/src/lib/types.ts — keep them in step by hand.
 */
internal object WireFormat {
    fun ingestPayload(
        report: FeedbackReport,
        projectKey: String,
        reporterId: String?,
        reporter: FeedbackUser?,
    ): JSONObject = JSONObject().apply {
        put("project_key", projectKey)
        put("id", report.id)
        put("created_at", iso8601(report.createdAt))
        put("text", report.text)
        report.screenshotRawPng?.let { put("screenshot_raw_png_base64", Base64Codec.encode(it)) }
        report.screenshotAnnotatedPng?.let { put("screenshot_annotated_png_base64", Base64Codec.encode(it)) }
        put("annotations", annotations(report.annotations))
        put("environment", environment(report.environment))
        report.attachment?.let {
            put("attachment_filename", it.filename)
            put("attachment_mime_type", it.mimeType)
            put("attachment_data_base64", Base64Codec.encode(it.data))
        }
        if (report.products.isNotEmpty()) {
            put("product_keys", JSONArray(report.products.map { it.key }))
            put("products", JSONArray(report.products.map(::product)))
        }
        reporterId?.let { put("reporter_id", it) }
        reporter?.let { put("reporter", user(it)) }
        put("notify_reporter", report.notifyReporter)
    }

    fun annotations(annotations: List<FeedbackAnnotation>): JSONArray =
        JSONArray(annotations.map(::annotation))

    fun annotation(annotation: FeedbackAnnotation): JSONObject = JSONObject().apply {
        put("kind", annotation.kind.wireName)
        put("points", JSONArray(annotation.points.map { JSONArray(listOf(it.x, it.y)) }))
        put("colorHex", annotation.colorHex)
        annotation.label?.let { put("label", it) }
        put("scale", annotation.scale)
        put("rotation", annotation.rotation)
    }

    fun environment(env: FeedbackEnvironment): JSONObject = JSONObject().apply {
        put("osName", env.osName)
        put("osVersion", env.osVersion)
        put("deviceModel", env.deviceModel)
        put("appVersion", env.appVersion)
        put("appBuild", env.appBuild)
        put("bundleIdentifier", env.bundleIdentifier)
        env.screenName?.let { put("screenName", it) }
        put("locale", env.locale)
        put("screenWidthPoints", env.screenWidthPoints)
        put("screenHeightPoints", env.screenHeightPoints)
        put("screenScale", env.screenScale)
    }

    fun product(product: FeedbackProduct): JSONObject = JSONObject().apply {
        put("key", product.key)
        put("name", product.name)
        put("description", product.description)
        put("is_default", product.isDefault)
    }

    fun productFromJson(json: JSONObject): FeedbackProduct = FeedbackProduct(
        key = json.getString("key"),
        name = json.optString("name", json.getString("key")),
        description = json.optString("description", ""),
        isDefault = json.optBoolean("is_default", false),
    )

    fun user(user: FeedbackUser): JSONObject = JSONObject().apply {
        user.id?.let { put("id", it) }
        user.email?.let { put("email", it) }
        user.name?.let { put("name", it) }
    }

    /** Same format as Swift's `JSONEncoder.DateEncodingStrategy.iso8601`: whole seconds, UTC, `Z`. */
    fun iso8601(date: Date): String =
        SimpleDateFormat("yyyy-MM-dd'T'HH:mm:ss'Z'", Locale.US).apply {
            timeZone = TimeZone.getTimeZone("UTC")
        }.format(date)
}

/**
 * Standard, padded, unwrapped base64 — what Swift's `JSONEncoder` produces for
 * `Data`. Hand-rolled because `android.util.Base64` is a stub in JVM unit
 * tests and `java.util.Base64` needs API 26.
 */
internal object Base64Codec {
    private const val ALPHABET = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/"

    fun encode(data: ByteArray): String {
        val out = StringBuilder((data.size + 2) / 3 * 4)
        var i = 0
        while (i + 2 < data.size) {
            val n = (data[i].toInt() and 0xFF shl 16) or (data[i + 1].toInt() and 0xFF shl 8) or (data[i + 2].toInt() and 0xFF)
            out.append(ALPHABET[n shr 18 and 63]).append(ALPHABET[n shr 12 and 63])
                .append(ALPHABET[n shr 6 and 63]).append(ALPHABET[n and 63])
            i += 3
        }
        when (data.size - i) {
            1 -> {
                val n = data[i].toInt() and 0xFF shl 16
                out.append(ALPHABET[n shr 18 and 63]).append(ALPHABET[n shr 12 and 63]).append("==")
            }
            2 -> {
                val n = (data[i].toInt() and 0xFF shl 16) or (data[i + 1].toInt() and 0xFF shl 8)
                out.append(ALPHABET[n shr 18 and 63]).append(ALPHABET[n shr 12 and 63])
                    .append(ALPHABET[n shr 6 and 63]).append('=')
            }
        }
        return out.toString()
    }
}
