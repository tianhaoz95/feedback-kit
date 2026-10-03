package com.feedbackkit.internal

import android.app.Activity
import android.graphics.Bitmap
import android.graphics.Canvas
import android.os.Build
import android.os.Handler
import android.os.Looper
import android.view.PixelCopy
import android.view.SurfaceView
import android.view.View
import android.view.ViewGroup

/**
 * Renders the foreground activity's window to a bitmap.
 *
 * Window-level, like the iOS SDK's `ScreenshotCapture.captureKeyWindow`, so it
 * works the same whether the screen is classic Views, Jetpack Compose, a
 * Flutter view or React Native — FeedbackKit never needs to know. It needs no
 * MediaProjection/screen-capture permission.
 *
 * `PixelCopy` of the window reads the window's own surface. A SurfaceView
 * (Flutter's renderer, video, maps, camera previews) is a *separate* surface
 * behind a transparent hole in the window, so each visible one is copied too
 * and composited underneath, at its position. Other windows — the capture
 * indicator's panel, dialogs, the keyboard — aren't included.
 */
internal object ScreenshotCapture {
    private val mainHandler by lazy { Handler(Looper.getMainLooper()) }

    fun capture(activity: Activity, completion: (Bitmap?) -> Unit) {
        val decor = activity.window?.decorView
        if (decor == null || decor.width <= 0 || decor.height <= 0) {
            completion(null)
            return
        }
        val window = try {
            Bitmap.createBitmap(decor.width, decor.height, Bitmap.Config.ARGB_8888)
        } catch (e: OutOfMemoryError) {
            completion(null)
            return
        }

        if (Build.VERSION.SDK_INT < 26) {
            completion(drawHierarchy(activity, window))
            return
        }
        try {
            PixelCopy.request(activity.window, window, { result ->
                if (result != PixelCopy.SUCCESS) {
                    completion(drawHierarchy(activity, window))
                    return@request
                }
                compositeSurfaces(decor, window, completion)
            }, mainHandler)
        } catch (e: IllegalArgumentException) {
            // The window has no surface yet (or anymore).
            completion(drawHierarchy(activity, window))
        }
    }

    /** Copies every visible SurfaceView, draws them, then the window (with its holes) on top. */
    private fun compositeSurfaces(decor: View, window: Bitmap, completion: (Bitmap?) -> Unit) {
        val surfaces = mutableListOf<SurfaceView>()
        collectSurfaceViews(decor, surfaces)
        if (surfaces.isEmpty()) {
            completion(window)
            return
        }
        val copies = mutableListOf<Pair<SurfaceView, Bitmap>>()
        fun next(index: Int) {
            if (index == surfaces.size) {
                completion(composite(decor, window, copies))
                return
            }
            val view = surfaces[index]
            val bitmap = try {
                Bitmap.createBitmap(view.width, view.height, Bitmap.Config.ARGB_8888)
            } catch (e: OutOfMemoryError) {
                return next(index + 1)
            }
            try {
                PixelCopy.request(view, bitmap, { result ->
                    if (result == PixelCopy.SUCCESS) copies += view to bitmap
                    next(index + 1)
                }, mainHandler)
            } catch (e: IllegalArgumentException) {
                next(index + 1)
            }
        }
        next(0)
    }

    private fun composite(decor: View, window: Bitmap, copies: List<Pair<SurfaceView, Bitmap>>): Bitmap {
        if (copies.isEmpty()) return window
        val out = Bitmap.createBitmap(window.width, window.height, Bitmap.Config.ARGB_8888)
        val canvas = Canvas(out)
        val decorLocation = IntArray(2).also(decor::getLocationInWindow)
        val location = IntArray(2)
        copies.forEach { (view, bitmap) ->
            view.getLocationInWindow(location)
            canvas.drawBitmap(bitmap, (location[0] - decorLocation[0]).toFloat(), (location[1] - decorLocation[1]).toFloat(), null)
        }
        canvas.drawBitmap(window, 0f, 0f, null)
        return out
    }

    private fun collectSurfaceViews(view: View, into: MutableList<SurfaceView>) {
        if (view.visibility != View.VISIBLE) return
        if (view is SurfaceView && view.width > 0 && view.height > 0 && view.holder.surface?.isValid == true) {
            into += view
        }
        if (view is ViewGroup) {
            for (i in 0 until view.childCount) collectSurfaceViews(view.getChildAt(i), into)
        }
    }

    /** Pre-26 (and PixelCopy failure) fallback: misses SurfaceView content, but works everywhere else. */
    private fun drawHierarchy(activity: Activity, bitmap: Bitmap): Bitmap? = try {
        activity.window.decorView.draw(Canvas(bitmap))
        bitmap
    } catch (e: Exception) {
        null
    }
}
