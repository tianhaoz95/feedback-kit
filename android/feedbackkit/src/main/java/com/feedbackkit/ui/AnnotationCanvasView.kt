package com.feedbackkit.ui

import android.annotation.SuppressLint
import android.content.Context
import android.graphics.Bitmap
import android.graphics.Canvas
import android.graphics.Color
import android.graphics.Paint
import android.graphics.Path
import android.graphics.RectF
import android.view.MotionEvent
import android.view.View
import android.view.ViewConfiguration
import com.feedbackkit.AnnotationRenderer
import com.feedbackkit.AnnotationRenderer.Pt
import com.feedbackkit.FeedbackAnnotation
import com.feedbackkit.NormalizedPoint
import kotlin.math.atan2
import kotlin.math.hypot
import kotlin.math.max
import kotlin.math.min

/**
 * The screenshot inside a phone-shaped bezel, with the markup drawn over it.
 * Handles touch for all five tools and can flatten the screenshot plus every
 * annotation into one bitmap. The Android counterpart of the iOS SDK's
 * `AnnotationCanvasView` + the bezel `FeedbackViewController` lays out around it.
 */
@SuppressLint("ViewConstructor")
internal class AnnotationCanvasView(
    context: Context,
    private val screenshot: Bitmap,
) : View(context) {
    enum class Tool { PEN, RECTANGLE, ARROW, TEXT, MOVE }

    var tool = Tool.PEN
    var strokeColor: Int = Color.rgb(255, 59, 48)

    /** Called after a text-tool tap so the activity can show a text prompt. */
    var onRequestTextInput: ((completion: (String?) -> Unit) -> Unit)? = null

    var completedAnnotations: List<FeedbackAnnotation> = emptyList()
        private set(value) {
            field = value
            invalidate()
        }

    /** Pixels per point on screen (see [AnnotationRenderer]'s note on units). */
    private val unit = resources.displayMetrics.density
    private val touchSlop = ViewConfiguration.get(context).scaledTouchSlop

    /** Where the screenshot's screen area sits within this view; annotations are normalized to it. */
    private val screenRect = RectF()
    private val outerRect = RectF()
    private var bezelWidth = 0f

    // In-progress gestures, in view coordinates.
    private var touchDown: Pt? = null
    private var isPanning = false
    private var activeFreehand = mutableListOf<Pt>()
    private var dragStart: Pt? = null
    private var dragCurrent: Pt? = null
    private var draggedIndex: Int? = null
    private var draggedOriginalPoints: List<NormalizedPoint> = emptyList()

    // Two-finger resize/rotate with the Move tool.
    private var transformedIndex: Int? = null
    private var transformStartDistance = 0.0
    private var transformStartAngle = 0.0
    private var transformOriginalScale = 1.0
    private var transformOriginalRotation = 0.0

    private val bitmapPaint = Paint(Paint.FILTER_BITMAP_FLAG or Paint.ANTI_ALIAS_FLAG)
    private val bezelPaint = Paint(Paint.ANTI_ALIAS_FLAG).apply { color = Color.BLACK; style = Paint.Style.STROKE }
    private val cameraPaint = Paint(Paint.ANTI_ALIAS_FLAG).apply { color = Color.BLACK }
    private val clipPath = Path()

    init {
        contentDescription = "Screenshot. Draw on the screenshot to point out the problem."
    }

    override fun onSizeChanged(w: Int, h: Int, oldw: Int, oldh: Int) {
        super.onSizeChanged(w, h, oldw, oldh)
        layoutScreen()
    }

    /**
     * Same geometry as the iOS editor: the bezel sits *outside* the screen
     * area, and the screen area keeps the screenshot's exact aspect ratio, so
     * normalized annotation coordinates map 1:1 onto the screenshot itself.
     */
    private fun layoutScreen() {
        val fitted = aspectFit(screenshot.width.toFloat(), screenshot.height.toFloat(), RectF(0f, 0f, width.toFloat(), height.toFloat()))
        bezelWidth = fitted.width() * 0.045f
        val inset = RectF(fitted).apply { inset(bezelWidth, bezelWidth) }
        screenRect.set(aspectFit(screenshot.width.toFloat(), screenshot.height.toFloat(), inset))
        outerRect.set(screenRect)
        outerRect.inset(-bezelWidth, -bezelWidth)
        val outerRadius = outerRect.width() * 0.13f
        val innerRadius = max(outerRadius - bezelWidth, 0f)
        clipPath.reset()
        clipPath.addRoundRect(screenRect, innerRadius, innerRadius, Path.Direction.CW)
    }

    override fun onDraw(canvas: Canvas) {
        if (screenRect.isEmpty) return
        canvas.save()
        canvas.clipPath(clipPath)
        canvas.drawBitmap(screenshot, null, screenRect, bitmapPaint)
        canvas.translate(screenRect.left, screenRect.top)
        val w = screenRect.width()
        val h = screenRect.height()
        AnnotationRenderer.drawAll(completedAnnotations, canvas, w, h, unit)
        // In-progress shape preview.
        val toLocal = { p: Pt -> Pt(p.x - screenRect.left, p.y - screenRect.top) }
        if (tool == Tool.PEN && activeFreehand.size > 1) {
            AnnotationRenderer.drawFreehand(activeFreehand.map(toLocal), strokeColor, canvas, unit)
        } else {
            val start = dragStart
            val end = dragCurrent
            if (start != null && end != null) {
                if (tool == Tool.RECTANGLE) AnnotationRenderer.drawRectangle(toLocal(start), toLocal(end), strokeColor, canvas, unit)
                if (tool == Tool.ARROW) AnnotationRenderer.drawArrow(toLocal(start), toLocal(end), strokeColor, canvas, unit)
            }
        }
        canvas.restore()

        // The phone body, then a punch-hole camera where an Android phone's sits.
        val outerRadius = outerRect.width() * 0.13f
        bezelPaint.strokeWidth = bezelWidth
        val bezelRect = RectF(outerRect).apply { inset(bezelWidth / 2, bezelWidth / 2) }
        canvas.drawRoundRect(bezelRect, outerRadius - bezelWidth / 2, outerRadius - bezelWidth / 2, bezelPaint)
        val cameraRadius = screenRect.width() * 0.022f
        canvas.drawCircle(screenRect.centerX(), screenRect.top + cameraRadius * 2.4f, cameraRadius, cameraPaint)
    }

    // MARK: - Touch

    @SuppressLint("ClickableViewAccessibility")
    override fun onTouchEvent(event: MotionEvent): Boolean {
        if (!isEnabled) return false
        when (event.actionMasked) {
            MotionEvent.ACTION_DOWN -> {
                parent?.requestDisallowInterceptTouchEvent(true)
                touchDown = Pt(event.x.toDouble(), event.y.toDouble())
                isPanning = false
            }
            MotionEvent.ACTION_POINTER_DOWN -> {
                if (event.pointerCount == 2) beginTwoFingerGesture(event)
            }
            MotionEvent.ACTION_MOVE -> {
                if (transformedIndex != null && event.pointerCount >= 2) {
                    applyTwoFingerGesture(event)
                    return true
                }
                if (event.pointerCount > 1) return true
                val down = touchDown ?: return true
                val location = Pt(event.x.toDouble(), event.y.toDouble())
                if (!isPanning && hypot(location.x - down.x, location.y - down.y) > touchSlop) {
                    isPanning = true
                    panBegan(down, location)
                } else if (isPanning) {
                    panChanged(location)
                }
            }
            MotionEvent.ACTION_POINTER_UP -> {
                if (event.pointerCount <= 2) transformedIndex = null
            }
            MotionEvent.ACTION_UP -> {
                val down = touchDown
                if (isPanning) {
                    panEnded()
                } else if (down != null && transformedIndex == null && tool == Tool.TEXT) {
                    performClick()
                    requestText(down)
                }
                resetGesture()
            }
            MotionEvent.ACTION_CANCEL -> {
                if (isPanning) panEnded()
                resetGesture()
            }
        }
        return true
    }

    override fun performClick(): Boolean = super.performClick()

    private fun resetGesture() {
        touchDown = null
        isPanning = false
        transformedIndex = null
        draggedIndex = null
    }

    private fun panBegan(down: Pt, location: Pt) {
        when (tool) {
            Tool.MOVE -> {
                val index = draggableIndex(down) ?: return
                draggedIndex = index
                draggedOriginalPoints = completedAnnotations[index].points
                applyDrag(index, down, location)
            }
            // Shapes start from the touch-down point, not where the slop was crossed.
            Tool.PEN -> activeFreehand = mutableListOf(down, location)
            Tool.RECTANGLE, Tool.ARROW -> {
                dragStart = down
                dragCurrent = location
            }
            Tool.TEXT -> Unit
        }
        invalidate()
    }

    private fun panChanged(location: Pt) {
        when (tool) {
            Tool.MOVE -> {
                val index = draggedIndex ?: return
                val down = touchDown ?: return
                applyDrag(index, down, location)
            }
            Tool.PEN -> activeFreehand.add(location)
            Tool.RECTANGLE, Tool.ARROW -> dragCurrent = location
            Tool.TEXT -> Unit
        }
        invalidate()
    }

    private fun panEnded() {
        when (tool) {
            Tool.PEN -> {
                if (activeFreehand.size > 1) {
                    append(FeedbackAnnotation(FeedbackAnnotation.Kind.FREEHAND, activeFreehand.map(::normalize), hexString(strokeColor)))
                }
                activeFreehand = mutableListOf()
            }
            Tool.RECTANGLE, Tool.ARROW -> {
                val start = dragStart
                val end = dragCurrent
                if (start != null && end != null && hypot(end.x - start.x, end.y - start.y) > 4 * unit) {
                    val kind = if (tool == Tool.RECTANGLE) FeedbackAnnotation.Kind.RECTANGLE else FeedbackAnnotation.Kind.ARROW
                    append(FeedbackAnnotation(kind, listOf(normalize(start), normalize(end)), hexString(strokeColor)))
                }
                dragStart = null
                dragCurrent = null
            }
            Tool.MOVE -> {
                draggedIndex = null
                draggedOriginalPoints = emptyList()
            }
            Tool.TEXT -> Unit
        }
        invalidate()
    }

    private fun requestText(location: Pt) {
        if (!screenRect.contains(location.x.toFloat(), location.y.toFloat())) return
        val normalized = normalize(location)
        val color = hexString(strokeColor)
        onRequestTextInput?.invoke { text ->
            if (!text.isNullOrBlank()) {
                append(FeedbackAnnotation(FeedbackAnnotation.Kind.TEXT, listOf(normalized), color, label = text))
            }
        }
    }

    private fun beginTwoFingerGesture(event: MotionEvent) {
        if (tool != Tool.MOVE) return
        // A second finger ends any one-finger move first.
        if (isPanning) {
            panEnded()
            isPanning = false
        }
        val mid = Pt(((event.getX(0) + event.getX(1)) / 2).toDouble(), ((event.getY(0) + event.getY(1)) / 2).toDouble())
        val index = draggableIndex(mid) ?: return
        transformedIndex = index
        transformStartDistance = pointerDistance(event)
        transformStartAngle = pointerAngle(event)
        transformOriginalScale = completedAnnotations[index].scale
        transformOriginalRotation = completedAnnotations[index].rotation
    }

    private fun applyTwoFingerGesture(event: MotionEvent) {
        val index = transformedIndex ?: return
        if (index >= completedAnnotations.size || transformStartDistance <= 0) return
        val scale = max(0.2, transformOriginalScale * pointerDistance(event) / transformStartDistance)
        val rotation = transformOriginalRotation + (pointerAngle(event) - transformStartAngle)
        replace(index, completedAnnotations[index].copy(scale = scale, rotation = rotation))
    }

    private fun pointerDistance(e: MotionEvent) = hypot((e.getX(1) - e.getX(0)).toDouble(), (e.getY(1) - e.getY(0)).toDouble())
    private fun pointerAngle(e: MotionEvent) = atan2((e.getY(1) - e.getY(0)).toDouble(), (e.getX(1) - e.getX(0)).toDouble())

    /** Topmost rectangle/arrow/text under [location], if any. */
    private fun draggableIndex(location: Pt): Int? {
        val local = Pt(location.x - screenRect.left, location.y - screenRect.top)
        for (i in completedAnnotations.indices.reversed()) {
            if (AnnotationRenderer.hitTest(completedAnnotations[i], local, screenRect.width().toDouble(), screenRect.height().toDouble(), unit.toDouble())) {
                return i
            }
        }
        return null
    }

    private fun applyDrag(index: Int, start: Pt, current: Pt) {
        if (screenRect.isEmpty || index >= completedAnnotations.size) return
        val dx = (current.x - start.x) / screenRect.width()
        val dy = (current.y - start.y) / screenRect.height()
        replace(index, completedAnnotations[index].copy(points = draggedOriginalPoints.map { NormalizedPoint(it.x + dx, it.y + dy) }))
    }

    private fun append(annotation: FeedbackAnnotation) {
        completedAnnotations = completedAnnotations + annotation
    }

    private fun replace(index: Int, annotation: FeedbackAnnotation) {
        completedAnnotations = completedAnnotations.toMutableList().also { it[index] = annotation }
    }

    fun undoLast() {
        if (completedAnnotations.isNotEmpty()) completedAnnotations = completedAnnotations.dropLast(1)
    }

    private fun normalize(p: Pt): NormalizedPoint {
        if (screenRect.isEmpty) return NormalizedPoint(0.0, 0.0)
        return NormalizedPoint((p.x - screenRect.left) / screenRect.width(), (p.y - screenRect.top) / screenRect.height())
    }

    /**
     * The screenshot with every annotation burned in, at the screenshot's own
     * pixel size — `unit` there is the screenshot's pixels per point (the
     * display density it was captured at).
     */
    fun flattenedImage(): Bitmap {
        val out = screenshot.copy(Bitmap.Config.ARGB_8888, true)
        AnnotationRenderer.drawAll(completedAnnotations, Canvas(out), out.width.toFloat(), out.height.toFloat(), unit)
        return out
    }

    private fun aspectFit(w: Float, h: Float, bounds: RectF): RectF {
        if (w <= 0 || h <= 0 || bounds.isEmpty) return RectF()
        val scale = min(bounds.width() / w, bounds.height() / h)
        val fw = w * scale
        val fh = h * scale
        val left = bounds.left + (bounds.width() - fw) / 2
        val top = bounds.top + (bounds.height() - fh) / 2
        return RectF(left, top, left + fw, top + fh)
    }
}
