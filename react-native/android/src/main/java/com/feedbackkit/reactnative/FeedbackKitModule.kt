package com.feedbackkit.reactnative

import android.util.Base64
import com.facebook.react.bridge.Arguments
import com.facebook.react.bridge.Promise
import com.facebook.react.bridge.ReactApplicationContext
import com.facebook.react.bridge.ReadableMap
import com.facebook.react.bridge.UiThreadUtil
import com.facebook.react.bridge.WritableArray
import com.facebook.react.bridge.WritableMap
import com.facebook.react.module.annotations.ReactModule
import com.feedbackkit.FeedbackKit
import com.feedbackkit.FeedbackKitBridge
import com.feedbackkit.FeedbackSubmitter

/**
 * Bridges `feedbackkit-react-native` to the native FeedbackKit Android SDK.
 * Every call maps 1:1 onto `FeedbackKit`; reports cross as maps (see
 * `FeedbackKitBridge`) with binary fields as base64 strings.
 */
@ReactModule(name = FeedbackKitModule.NAME)
class FeedbackKitModule(reactContext: ReactApplicationContext) : NativeFeedbackKitSpec(reactContext) {
    init {
        // Submissions started natively (floating button, shake) reach JS too.
        FeedbackKit.onSubmissionResult = { result ->
            emitOnSubmissionResult(toWritableMap(FeedbackKitBridge.submissionResultToMap(result, ::base64)))
        }
    }

    override fun getName() = NAME

    override fun invalidate() {
        FeedbackKit.onSubmissionResult = null
        super.invalidate()
    }

    private fun base64(data: ByteArray): Any = Base64.encodeToString(data, Base64.NO_WRAP)

    private fun onMain(block: () -> Unit) {
        UiThreadUtil.runOnUiThread(block)
    }

    override fun configure(configuration: ReadableMap?) = onMain {
        FeedbackKit.configure(FeedbackKitBridge.configurationFromMap(configuration?.toHashMap()))
    }

    override fun isConfigured(): Boolean = FeedbackKit.isConfigured

    override fun setCurrentScreen(name: String?) = onMain { FeedbackKit.currentScreen = name }

    override fun setTheme(theme: ReadableMap?) = onMain {
        FeedbackKit.theme = FeedbackKitBridge.themeFromMap(theme?.toHashMap())
    }

    override fun setUser(user: ReadableMap?) = onMain {
        FeedbackKit.user = FeedbackKitBridge.userFromMap(user?.toHashMap())
    }

    override fun setDefaultProductKey(key: String?) = onMain { FeedbackKit.defaultProductKey = key }

    override fun getReporterId(): String = FeedbackKit.reporterId

    override fun present(promise: Promise) = onMain {
        FeedbackKit.present(currentActivity) { report ->
            promise.resolve(report?.let { toWritableMap(FeedbackKitBridge.reportToMap(it, ::base64)) })
        }
    }

    // Not FeedbackKit.presentAndSubmit: that never calls back on cancel, and
    // the JS promise needs an answer either way.
    override fun presentAndSubmit(promise: Promise) = onMain {
        FeedbackKit.present(currentActivity) { report ->
            if (report == null) {
                promise.resolve(null)
                return@present
            }
            val configuration = FeedbackKit.currentConfiguration
            if (configuration == null) {
                promise.resolve(toWritableMap(mapOf("status" to "failure", "error" to "FeedbackKit is not configured with an API key and endpoint.")))
                return@present
            }
            FeedbackSubmitter.submit(report, configuration) { submission ->
                FeedbackKit.onSubmissionResult?.invoke(submission)
                promise.resolve(toWritableMap(FeedbackKitBridge.submissionResultToMap(submission, ::base64)))
            }
        }
    }

    override fun presentAndSubmitIfConfigured(promise: Promise) = onMain {
        FeedbackKit.presentAndSubmitIfConfigured(currentActivity) { submission ->
            promise.resolve(submission?.let { toWritableMap(FeedbackKitBridge.submissionResultToMap(it, ::base64)) })
        }
    }

    override fun showFloatingTriggerButton() = onMain { FeedbackKit.showFloatingTriggerButton() }
    override fun hideFloatingTriggerButton() = onMain { FeedbackKit.hideFloatingTriggerButton() }
    override fun enableShakeToReport() = onMain { FeedbackKit.enableShakeToReport() }
    override fun disableShakeToReport() = onMain { FeedbackKit.disableShakeToReport() }
    override fun enableFixVerification() = onMain { FeedbackKit.enableFixVerification() }
    override fun disableFixVerification() = onMain { FeedbackKit.disableFixVerification() }
    override fun presentFixUpdatesIfNeeded() = onMain { FeedbackKit.presentFixUpdatesIfNeeded() }

    private fun toWritableMap(map: Map<String, Any?>): WritableMap = Arguments.createMap().apply {
        map.forEach { (key, value) -> putValue(key, value) }
    }

    private fun toWritableArray(list: List<*>): WritableArray = Arguments.createArray().apply {
        list.forEach { value ->
            when (value) {
                null -> pushNull()
                is Boolean -> pushBoolean(value)
                is Number -> pushDouble(value.toDouble())
                is String -> pushString(value)
                is Map<*, *> -> @Suppress("UNCHECKED_CAST") pushMap(toWritableMap(value as Map<String, Any?>))
                is List<*> -> pushArray(toWritableArray(value))
                else -> pushString(value.toString())
            }
        }
    }

    private fun WritableMap.putValue(key: String, value: Any?) {
        when (value) {
            null -> putNull(key)
            is Boolean -> putBoolean(key, value)
            is Number -> putDouble(key, value.toDouble())
            is String -> putString(key, value)
            is Map<*, *> -> @Suppress("UNCHECKED_CAST") putMap(key, toWritableMap(value as Map<String, Any?>))
            is List<*> -> putArray(key, toWritableArray(value))
            else -> putString(key, value.toString())
        }
    }

    companion object {
        const val NAME = "FeedbackKit"
    }
}
