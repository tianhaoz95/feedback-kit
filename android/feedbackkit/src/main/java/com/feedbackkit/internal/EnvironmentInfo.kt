package com.feedbackkit.internal

import android.content.Context
import android.content.pm.PackageManager
import android.os.Build
import com.feedbackkit.FeedbackEnvironment
import java.util.Locale

internal object EnvironmentInfo {
    fun current(context: Context, screenName: String?): FeedbackEnvironment {
        val metrics = context.resources.displayMetrics
        val (version, build) = try {
            val info = context.packageManager.getPackageInfo(context.packageName, 0)
            val code = if (Build.VERSION.SDK_INT >= 28) info.longVersionCode.toString() else @Suppress("DEPRECATION") info.versionCode.toString()
            (info.versionName ?: "unknown") to code
        } catch (e: PackageManager.NameNotFoundException) {
            "unknown" to "unknown"
        }
        val (widthPx, heightPx) = screenSizePx(context)
        return FeedbackEnvironment(
            osName = "Android",
            osVersion = Build.VERSION.RELEASE ?: "unknown",
            deviceModel = deviceModel(),
            appVersion = version,
            appBuild = build,
            bundleIdentifier = context.packageName,
            // Unlike the iOS fallback (walking UIKit's view controller stack),
            // the activity's class name is all there is to fall back on — and
            // it's one name for a whole single-activity Compose, Flutter or
            // React Native app — so set FeedbackKit.currentScreen as the user navigates.
            screenName = screenName ?: ActivityTracker.currentActivity?.javaClass?.simpleName,
            // `en_US`, matching the Swift SDK's `Locale.current.identifier`.
            locale = Locale.getDefault().toString(),
            screenWidthPoints = (widthPx / metrics.density).toDouble(),
            screenHeightPoints = (heightPx / metrics.density).toDouble(),
            screenScale = metrics.density.toDouble(),
        )
    }

    /** e.g. "Google Pixel 8" — Build.MODEL alone is often just "SM-S918B". */
    private fun deviceModel(): String {
        val manufacturer = Build.MANUFACTURER.orEmpty().replaceFirstChar { it.titlecase(Locale.US) }
        val model = Build.MODEL.orEmpty()
        return when {
            model.isEmpty() -> manufacturer.ifEmpty { "unknown" }
            model.startsWith(manufacturer, ignoreCase = true) -> model
            else -> "$manufacturer $model".trim()
        }
    }

    /** The whole display, not just the app window (the iOS SDK reports `UIScreen.main.bounds`). */
    private fun screenSizePx(context: Context): Pair<Int, Int> {
        val activity = ActivityTracker.currentActivity
        if (Build.VERSION.SDK_INT >= 30 && activity != null) {
            val bounds = activity.windowManager.maximumWindowMetrics.bounds
            return bounds.width() to bounds.height()
        }
        val metrics = context.resources.displayMetrics
        return metrics.widthPixels to metrics.heightPixels
    }
}
