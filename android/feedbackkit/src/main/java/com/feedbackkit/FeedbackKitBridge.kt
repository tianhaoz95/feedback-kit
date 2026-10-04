package com.feedbackkit

import com.feedbackkit.internal.WireFormat

/**
 * Plain-map conversions for cross-platform wrappers — the Flutter plugin
 * (flutter/) and the React Native module (react-native/) — so both bridge the
 * same shapes without each re-implementing them. Keys are camelCase, matching
 * the Dart/TypeScript models and `FeedbackKitBridge` in the Swift SDK; binary
 * fields go through [encodeBytes] (raw bytes for Flutter, base64 for React Native).
 */
object FeedbackKitBridge {
    @JvmStatic
    fun reportToMap(report: FeedbackReport, encodeBytes: (ByteArray) -> Any): Map<String, Any?> = mapOf(
        "id" to report.id,
        "createdAt" to WireFormat.iso8601(report.createdAt),
        "text" to report.text,
        "screenshotRawPng" to report.screenshotRawPng?.let(encodeBytes),
        "screenshotAnnotatedPng" to report.screenshotAnnotatedPng?.let(encodeBytes),
        "annotations" to report.annotations.map { a ->
            mapOf(
                "kind" to a.kind.wireName,
                "points" to a.points.map { listOf(it.x, it.y) },
                "colorHex" to a.colorHex,
                "label" to a.label,
                "scale" to a.scale,
                "rotation" to a.rotation,
            )
        },
        "environment" to report.environment.let { e ->
            mapOf(
                "osName" to e.osName,
                "osVersion" to e.osVersion,
                "deviceModel" to e.deviceModel,
                "appVersion" to e.appVersion,
                "appBuild" to e.appBuild,
                "bundleIdentifier" to e.bundleIdentifier,
                "screenName" to e.screenName,
                "locale" to e.locale,
                "screenWidthPoints" to e.screenWidthPoints,
                "screenHeightPoints" to e.screenHeightPoints,
                "screenScale" to e.screenScale,
            )
        },
        "attachment" to report.attachment?.let {
            mapOf("filename" to it.filename, "mimeType" to it.mimeType, "data" to encodeBytes(it.data))
        },
        "products" to report.products.map(::productToMap),
        "notifyReporter" to report.notifyReporter,
    )

    /** `{status: "success", report}` or `{status: "failure", error}`. */
    @JvmStatic
    fun submissionResultToMap(result: FeedbackSubmissionResult, encodeBytes: (ByteArray) -> Any): Map<String, Any?> = when (result) {
        is FeedbackSubmissionResult.Success -> mapOf("status" to "success", "report" to reportToMap(result.report, encodeBytes))
        is FeedbackSubmissionResult.Failure -> mapOf("status" to "failure", "error" to result.error.message)
    }

    @JvmStatic
    fun productToMap(product: FeedbackProduct): Map<String, Any?> = mapOf(
        "key" to product.key,
        "name" to product.name,
        "description" to product.description,
        "isDefault" to product.isDefault,
    )

    @JvmStatic
    fun productFromMap(map: Map<*, *>): FeedbackProduct? {
        val key = map["key"] as? String ?: return null
        return FeedbackProduct(
            key = key,
            name = map["name"] as? String ?: key,
            description = map["description"] as? String ?: "",
            isDefault = map["isDefault"] as? Boolean ?: false,
        )
    }

    @JvmStatic
    fun configurationFromMap(map: Map<*, *>?): FeedbackKitConfiguration? {
        if (map == null) return null
        val endpoint = (map["endpointUrl"] as? String)?.trim().orEmpty()
        val key = (map["projectKey"] as? String)?.trim().orEmpty()
        if (endpoint.isEmpty() || key.isEmpty()) return null
        return FeedbackKitConfiguration(
            endpointUrl = endpoint,
            projectKey = key,
            products = (map["products"] as? List<*>).orEmpty().mapNotNull { (it as? Map<*, *>)?.let(::productFromMap) },
            defaultProductKey = map["defaultProductKey"] as? String,
            reporterUpdatesUrl = map["reporterUpdatesUrl"] as? String,
        )
    }

    @JvmStatic
    fun themeFromMap(map: Map<*, *>?): FeedbackTheme? {
        val primary = map?.get("primaryColorHex") as? String ?: return null
        val secondary = map["secondaryColorHex"] as? String ?: return null
        return FeedbackTheme(primary, secondary)
    }

    @JvmStatic
    fun userFromMap(map: Map<*, *>?): FeedbackUser? {
        if (map == null) return null
        val user = FeedbackUser(map["id"] as? String, map["email"] as? String, map["name"] as? String)
        return if (user.id == null && user.email == null && user.name == null) null else user
    }
}
