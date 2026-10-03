package com.feedbackkit.ui

import android.animation.ValueAnimator
import android.annotation.SuppressLint
import android.app.Activity
import android.content.Context
import android.graphics.Canvas
import android.graphics.Color
import android.graphics.LinearGradient
import android.graphics.Matrix
import android.graphics.Paint
import android.graphics.PixelFormat
import android.graphics.PorterDuff
import android.graphics.PorterDuffXfermode
import android.graphics.Shader
import android.graphics.SweepGradient
import android.graphics.drawable.GradientDrawable
import android.util.TypedValue
import android.view.Gravity
import android.view.View
import android.view.WindowManager
import android.view.animation.LinearInterpolator
import android.widget.FrameLayout
import android.widget.LinearLayout
import android.widget.ProgressBar
import android.widget.TextView
import com.feedbackkit.FeedbackTheme

/**
 * The edge glow + "Capturing screenshot…" card shown between the trigger and
 * the editor — the Android twin of the iOS `CaptureIndicator` and the web
 * SDK's `.fk-capture-*`. It lives in its *own* panel window attached to the
 * activity, so `PixelCopy` of the activity window never includes it.
 */
internal class CaptureIndicator private constructor(
    private val windowManager: WindowManager,
    private val root: View,
    private val animator: ValueAnimator,
) {
    private var dismissed = false

    fun dismiss() {
        if (dismissed) return
        dismissed = true
        root.animate().alpha(0f).setDuration(180).withEndAction {
            animator.cancel()
            try {
                windowManager.removeViewImmediate(root)
            } catch (e: IllegalArgumentException) {
                // Already gone with its activity.
            }
        }.start()
    }

    companion object {
        fun show(activity: Activity, theme: FeedbackTheme?): CaptureIndicator? {
            val token = activity.window?.decorView?.windowToken ?: return null
            val palette = Palette(activity, theme)
            val glow = GlowView(activity, palette.primary, palette.dp(26f))
            val root = FrameLayout(activity).apply {
                addView(glow, FrameLayout.LayoutParams(FrameLayout.LayoutParams.MATCH_PARENT, FrameLayout.LayoutParams.MATCH_PARENT))
                addView(card(activity, palette), FrameLayout.LayoutParams(
                    FrameLayout.LayoutParams.WRAP_CONTENT,
                    FrameLayout.LayoutParams.WRAP_CONTENT,
                    Gravity.CENTER,
                ))
                alpha = 0f
            }
            val params = WindowManager.LayoutParams(
                WindowManager.LayoutParams.MATCH_PARENT,
                WindowManager.LayoutParams.MATCH_PARENT,
                WindowManager.LayoutParams.TYPE_APPLICATION_PANEL,
                WindowManager.LayoutParams.FLAG_NOT_FOCUSABLE or
                    WindowManager.LayoutParams.FLAG_NOT_TOUCHABLE or
                    WindowManager.LayoutParams.FLAG_LAYOUT_IN_SCREEN or
                    WindowManager.LayoutParams.FLAG_LAYOUT_NO_LIMITS,
                PixelFormat.TRANSLUCENT,
            ).apply {
                this.token = token
                title = "FeedbackKit.CaptureIndicator"
                if (android.os.Build.VERSION.SDK_INT >= 28) {
                    layoutInDisplayCutoutMode = WindowManager.LayoutParams.LAYOUT_IN_DISPLAY_CUTOUT_MODE_SHORT_EDGES
                }
            }
            val windowManager = activity.windowManager
            try {
                windowManager.addView(root, params)
            } catch (e: Exception) {
                return null
            }
            val animator = ValueAnimator.ofFloat(0f, 360f).apply {
                duration = 2400
                repeatCount = ValueAnimator.INFINITE
                interpolator = LinearInterpolator()
                addUpdateListener { glow.setAngle(it.animatedValue as Float) }
                start()
            }
            root.animate().alpha(1f).setDuration(150).start()
            return CaptureIndicator(windowManager, root, animator)
        }

        private fun card(context: Context, palette: Palette) = LinearLayout(context).apply {
            orientation = LinearLayout.HORIZONTAL
            gravity = Gravity.CENTER_VERTICAL
            setPadding(palette.dp(18), palette.dp(12), palette.dp(18), palette.dp(12))
            background = GradientDrawable().apply {
                setColor(if (palette.isDark) Color.argb(235, 44, 44, 46) else Color.argb(240, 255, 255, 255))
                cornerRadius = palette.dp(16f)
            }
            elevation = palette.dp(8f)
            addView(ProgressBar(context).apply { isIndeterminate = true }, LinearLayout.LayoutParams(palette.dp(20), palette.dp(20)))
            addView(TextView(context).apply {
                text = "Capturing screenshot…"
                setTextColor(palette.label)
                setTextSize(TypedValue.COMPLEX_UNIT_SP, 15f)
                setPadding(palette.dp(10), 0, 0, 0)
            })
        }
    }

    /**
     * A rotating sweep gradient masked to a band along each edge that's
     * brightest at the edge and fades inward — the same look as
     * `CaptureGlowLayer` on iOS (primary color, then violet/pink/orange/cyan).
     */
    @SuppressLint("ViewConstructor")
    private class GlowView(context: Context, primary: Int, private val glowWidth: Float) : View(context) {
        private val colors = intArrayOf(
            primary,
            Color.rgb(139, 92, 246),
            Color.rgb(236, 72, 153),
            Color.rgb(249, 115, 22),
            Color.rgb(34, 211, 238),
            primary,
        )
        private val maskPaint = Paint(Paint.ANTI_ALIAS_FLAG)
        private val colorPaint = Paint(Paint.ANTI_ALIAS_FLAG).apply { xfermode = PorterDuffXfermode(PorterDuff.Mode.SRC_IN) }
        private val shaderMatrix = Matrix()
        private var sweep: SweepGradient? = null

        /** Rotates the gradient (not the view) so the colors flow around the edges. */
        fun setAngle(degrees: Float) {
            shaderMatrix.setRotate(degrees, width / 2f, height / 2f)
            sweep?.setLocalMatrix(shaderMatrix)
            invalidate()
        }

        override fun onSizeChanged(w: Int, h: Int, oldw: Int, oldh: Int) {
            sweep = SweepGradient(w / 2f, h / 2f, colors, null)
            colorPaint.shader = sweep
        }

        override fun onDraw(canvas: Canvas) {
            val w = width.toFloat()
            val h = height.toFloat()
            val layer = canvas.saveLayer(0f, 0f, w, h, null)
            val fade = intArrayOf(Color.BLACK, Color.argb(115, 0, 0, 0), Color.TRANSPARENT)
            val stops = floatArrayOf(0f, 0.18f, 1f)
            maskPaint.shader = LinearGradient(0f, 0f, 0f, glowWidth, fade, stops, Shader.TileMode.CLAMP)
            canvas.drawRect(0f, 0f, w, glowWidth, maskPaint)
            maskPaint.shader = LinearGradient(0f, h, 0f, h - glowWidth, fade, stops, Shader.TileMode.CLAMP)
            canvas.drawRect(0f, h - glowWidth, w, h, maskPaint)
            maskPaint.shader = LinearGradient(0f, 0f, glowWidth, 0f, fade, stops, Shader.TileMode.CLAMP)
            canvas.drawRect(0f, 0f, glowWidth, h, maskPaint)
            maskPaint.shader = LinearGradient(w, 0f, w - glowWidth, 0f, fade, stops, Shader.TileMode.CLAMP)
            canvas.drawRect(w - glowWidth, 0f, w, h, maskPaint)
            canvas.drawRect(0f, 0f, w, h, colorPaint)
            canvas.restoreToCount(layer)
        }
    }
}
