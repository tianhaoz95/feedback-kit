package com.feedbackkit.flutter

import android.app.Activity
import com.feedbackkit.FeedbackKit
import com.feedbackkit.FeedbackKitBridge
import io.flutter.embedding.engine.plugins.FlutterPlugin
import io.flutter.embedding.engine.plugins.activity.ActivityAware
import io.flutter.embedding.engine.plugins.activity.ActivityPluginBinding
import io.flutter.plugin.common.MethodCall
import io.flutter.plugin.common.MethodChannel

/**
 * Bridges `package:feedbackkit_flutter` to the native FeedbackKit Android SDK.
 * Every call maps 1:1 onto `FeedbackKit`; reports cross the channel as plain
 * maps (see `FeedbackKitBridge`), with PNGs as raw bytes (Uint8List in Dart).
 */
class FeedbackKitFlutterPlugin : FlutterPlugin, MethodChannel.MethodCallHandler, ActivityAware {
    private var channel: MethodChannel? = null
    private var activity: Activity? = null

    override fun onAttachedToEngine(binding: FlutterPlugin.FlutterPluginBinding) {
        // The SDK's ContentProvider normally does this at startup; harmless to repeat.
        (binding.applicationContext as? android.app.Application)?.let(FeedbackKit::attach)
        channel = MethodChannel(binding.binaryMessenger, "feedbackkit").also { it.setMethodCallHandler(this) }
        // Submissions started natively (floating button, shake) reach Dart too.
        FeedbackKit.onSubmissionResult = { result ->
            channel?.invokeMethod("onSubmissionResult", FeedbackKitBridge.submissionResultToMap(result, ::bytes))
        }
    }

    override fun onDetachedFromEngine(binding: FlutterPlugin.FlutterPluginBinding) {
        channel?.setMethodCallHandler(null)
        channel = null
        FeedbackKit.onSubmissionResult = null
    }

    override fun onAttachedToActivity(binding: ActivityPluginBinding) {
        activity = binding.activity
    }

    override fun onDetachedFromActivityForConfigChanges() {
        activity = null
    }

    override fun onReattachedToActivityForConfigChanges(binding: ActivityPluginBinding) {
        activity = binding.activity
    }

    override fun onDetachedFromActivity() {
        activity = null
    }

    private fun bytes(data: ByteArray): Any = data

    override fun onMethodCall(call: MethodCall, result: MethodChannel.Result) {
        when (call.method) {
            "configure" -> {
                FeedbackKit.configure(FeedbackKitBridge.configurationFromMap(call.arguments as? Map<*, *>))
                result.success(null)
            }
            "isConfigured" -> result.success(FeedbackKit.isConfigured)
            "setCurrentScreen" -> {
                FeedbackKit.currentScreen = call.arguments as? String
                result.success(null)
            }
            "setTheme" -> {
                FeedbackKit.theme = FeedbackKitBridge.themeFromMap(call.arguments as? Map<*, *>)
                result.success(null)
            }
            "setUser" -> {
                FeedbackKit.user = FeedbackKitBridge.userFromMap(call.arguments as? Map<*, *>)
                result.success(null)
            }
            "setDefaultProductKey" -> {
                FeedbackKit.defaultProductKey = call.arguments as? String
                result.success(null)
            }
            "getReporterId" -> result.success(FeedbackKit.reporterId)
            "present" -> FeedbackKit.present(activity) { report ->
                result.success(report?.let { FeedbackKitBridge.reportToMap(it, ::bytes) })
            }
            // Not FeedbackKit.presentAndSubmit: that never calls back on cancel,
            // and the Dart future needs an answer either way.
            "presentAndSubmit" -> {
                FeedbackKit.present(activity) { report ->
                    if (report == null) {
                        result.success(null)
                        return@present
                    }
                    val configuration = FeedbackKit.currentConfiguration
                    if (configuration == null) {
                        result.success(mapOf("status" to "failure", "error" to "FeedbackKit is not configured with an API key and endpoint."))
                        return@present
                    }
                    com.feedbackkit.FeedbackSubmitter.submit(report, configuration) { submission ->
                        FeedbackKit.onSubmissionResult?.invoke(submission)
                        result.success(FeedbackKitBridge.submissionResultToMap(submission, ::bytes))
                    }
                }
            }
            "presentAndSubmitIfConfigured" -> FeedbackKit.presentAndSubmitIfConfigured(activity) { submission ->
                result.success(submission?.let { FeedbackKitBridge.submissionResultToMap(it, ::bytes) })
            }
            "showFloatingTriggerButton" -> {
                FeedbackKit.showFloatingTriggerButton()
                result.success(null)
            }
            "hideFloatingTriggerButton" -> {
                FeedbackKit.hideFloatingTriggerButton()
                result.success(null)
            }
            "enableShakeToReport" -> {
                FeedbackKit.enableShakeToReport()
                result.success(null)
            }
            "disableShakeToReport" -> {
                FeedbackKit.disableShakeToReport()
                result.success(null)
            }
            "enableFixVerification" -> {
                FeedbackKit.enableFixVerification()
                result.success(null)
            }
            "disableFixVerification" -> {
                FeedbackKit.disableFixVerification()
                result.success(null)
            }
            "presentFixUpdatesIfNeeded" -> {
                FeedbackKit.presentFixUpdatesIfNeeded()
                result.success(null)
            }
            else -> result.notImplemented()
        }
    }
}
