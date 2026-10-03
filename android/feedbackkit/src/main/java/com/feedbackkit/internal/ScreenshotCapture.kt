package com.feedbackkit.internal

import android.app.Activity
import android.graphics.Bitmap
import android.graphics.Canvas
import android.os.Build
import android.os.Handler
import android.os.Looper
import android.view.PixelCopy

/**
 * Renders the foreground activity's window to a bitmap.
 *
 * Window-level, like the iOS SDK's `ScreenshotCapture.captureKeyWindow`, so it
 * works the same whether the screen is classic Views, Jetpack Compose, a
 * Flutter view or React Native — FeedbackKit never needs to know.
 * `PixelCopy` reads the window's own surface, which is what makes
 * SurfaceView/TextureView content (Flutter's renderer, video, maps) land in
 * the shot, where `View.draw` would leave it blank. It needs no
 * MediaProjection/screen-capture permission. Other windows — the capture
 * indicator's panel, dialogs, the keyboard — are separate surfaces and
 * aren't included.
 */
internal object ScreenshotCapture {
    fun capture(activity: Activity, completion: (Bitmap?) -> Unit) {
        val decor = activity.window?.decorView
        if (decor == null || decor.width <= 0 || decor.height <= 0) {
            completion(null)
            return
        }
        val bitmap = try {
            Bitmap.createBitmap(decor.width, decor.height, Bitmap.Config.ARGB_8888)
        } catch (e: OutOfMemoryError) {
            completion(null)
            return
        }

        if (Build.VERSION.SDK_INT >= 26) {
            try {
                PixelCopy.request(activity.window, bitmap, { result ->
                    if (result == PixelCopy.SUCCESS) completion(bitmap) else completion(drawHierarchy(activity, bitmap))
                }, Handler(Looper.getMainLooper()))
                return
            } catch (e: IllegalArgumentException) {
                // The window has no surface yet (or anymore) — fall through.
            }
        }
        completion(drawHierarchy(activity, bitmap))
    }

    /** Pre-26 (and PixelCopy failure) fallback: misses SurfaceView content, but works everywhere else. */
    private fun drawHierarchy(activity: Activity, bitmap: Bitmap): Bitmap? = try {
        activity.window.decorView.draw(Canvas(bitmap))
        bitmap
    } catch (e: Exception) {
        null
    }
}
