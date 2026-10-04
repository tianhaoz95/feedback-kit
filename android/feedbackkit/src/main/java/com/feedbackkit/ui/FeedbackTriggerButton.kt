package com.feedbackkit.ui

import android.annotation.SuppressLint
import android.app.Activity
import android.graphics.Color
import android.graphics.drawable.GradientDrawable
import android.view.MotionEvent
import android.view.ViewConfiguration
import android.view.ViewGroup
import android.widget.FrameLayout
import android.widget.ImageView
import com.feedbackkit.R
import kotlin.math.abs

/**
 * The optional floating, draggable "report feedback" button
 * (`FeedbackKit.showFloatingTriggerButton`). Added to each foreground
 * activity's decor view as the user moves between activities; it snaps to
 * the nearest side when released, like the iOS button.
 */
@SuppressLint("ViewConstructor")
internal class FeedbackTriggerButton(activity: Activity, private val onTap: () -> Unit) : ImageView(activity) {
    private val density = resources.displayMetrics.density
    private val size = (48 * density).toInt()
    private val touchSlop = ViewConfiguration.get(activity).scaledTouchSlop
    private var downRawX = 0f
    private var downRawY = 0f
    private var startX = 0f
    private var startY = 0f
    private var dragging = false

    init {
        tag = TAG
        setImageResource(R.drawable.fk_ic_feedback)
        setColorFilter(Color.WHITE)
        scaleType = ScaleType.CENTER
        background = GradientDrawable().apply {
            shape = GradientDrawable.OVAL
            setColor(Color.rgb(0, 122, 255))
        }
        elevation = 6 * density
        contentDescription = "Report Feedback"
        isClickable = true
    }

    fun attach(activity: Activity, savedPosition: Pair<Float, Float>?) {
        val decor = activity.window?.decorView as? ViewGroup ?: return
        decor.findViewWithTag<FeedbackTriggerButton>(TAG)?.let { decor.removeView(it) }
        decor.addView(this, FrameLayout.LayoutParams(size, size))
        decor.post {
            if (savedPosition != null) {
                x = savedPosition.first.coerceIn(0f, (decor.width - size).toFloat().coerceAtLeast(0f))
                y = savedPosition.second.coerceIn(0f, (decor.height - size).toFloat().coerceAtLeast(0f))
            } else {
                x = decor.width - 64 * density
                y = decor.height - 160 * density
            }
        }
    }

    fun detach() {
        (parent as? ViewGroup)?.removeView(this)
    }

    @SuppressLint("ClickableViewAccessibility")
    override fun onTouchEvent(event: MotionEvent): Boolean {
        val parentView = parent as? ViewGroup ?: return false
        when (event.actionMasked) {
            MotionEvent.ACTION_DOWN -> {
                downRawX = event.rawX
                downRawY = event.rawY
                startX = x
                startY = y
                dragging = false
            }
            MotionEvent.ACTION_MOVE -> {
                val dx = event.rawX - downRawX
                val dy = event.rawY - downRawY
                if (!dragging && (abs(dx) > touchSlop || abs(dy) > touchSlop)) dragging = true
                if (dragging) {
                    x = startX + dx
                    y = startY + dy
                }
            }
            MotionEvent.ACTION_UP -> {
                if (dragging) {
                    val margin = 16 * density
                    val snappedX = if (x + size / 2 < parentView.width / 2) margin else parentView.width - size - margin
                    val clampedY = y.coerceIn(80 * density, parentView.height - 80 * density - size)
                    animate().x(snappedX).y(clampedY).setDuration(200).start()
                } else {
                    performClick()
                }
            }
        }
        return true
    }

    override fun performClick(): Boolean {
        super.performClick()
        onTap()
        return true
    }

    companion object {
        const val TAG = "com.feedbackkit.trigger"
    }
}
