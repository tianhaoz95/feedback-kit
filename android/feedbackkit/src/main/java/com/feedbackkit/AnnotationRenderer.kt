package com.feedbackkit

import android.graphics.Canvas
import android.graphics.Paint
import android.graphics.Path
import android.graphics.RectF
import android.graphics.Typeface
import com.feedbackkit.ui.parseHexColor
import kotlin.math.abs
import kotlin.math.atan2
import kotlin.math.cos
import kotlin.math.hypot
import kotlin.math.max
import kotlin.math.min
import kotlin.math.sin

/**
 * Draws annotations — shared by the live editor canvas and the flattened PNG,
 * so the two always look identical. A port of the Swift SDK's
 * `AnnotationRenderer` (and web-sdk/src/renderer.ts); change them together.
 *
 * Every length here (stroke width, arrowhead, font size, padding) is in
 * "points" and multiplied by [unit] — pixels per point — so a 4pt stroke is
 * 4dp on screen and 4 × density pixels in a full-resolution screenshot,
 * matching how the iOS SDK draws at the screenshot's point size.
 */
object AnnotationRenderer {
    const val STROKE_WIDTH = 4.0
    private const val ARROW_HEAD_LENGTH = 18.0
    private const val ARROW_HEAD_ANGLE = Math.PI / 7
    private const val BASE_FONT_SIZE = 16.0
    private const val TEXT_PADDING = 8.0
    private const val BUBBLE_CORNER = 8.0

    /** Longest edge, in pixels, of the screenshots a report carries (same as iOS). */
    const val MAX_SCREENSHOT_PIXEL_DIMENSION = 1600

    /** Longest edge, in pixels, of a photo the reporter attaches (same as iOS). */
    const val MAX_PHOTO_PIXEL_DIMENSION = 2048

    /** How close a touch needs to land to a rectangle/arrow/text to grab it, in points. */
    const val HIT_TEST_TOLERANCE = 16.0

    /** A plain point, so the geometry below runs (and is unit-tested) without android.graphics. */
    data class Pt(val x: Double, val y: Double)

    @JvmStatic
    fun drawAll(annotations: List<FeedbackAnnotation>, canvas: Canvas, width: Float, height: Float, unit: Float) {
        annotations.forEach { draw(it, canvas, width, height, unit) }
    }

    @JvmStatic
    fun draw(annotation: FeedbackAnnotation, canvas: Canvas, width: Float, height: Float, unit: Float) {
        val color = parseHexColor(annotation.colorHex) ?: 0xFFFF0000.toInt()
        val points = annotation.points.map { Pt(it.x * width, it.y * height) }
        val scale = annotation.scale
        val rotation = annotation.rotation
        when (annotation.kind) {
            FeedbackAnnotation.Kind.FREEHAND -> drawFreehand(points, color, canvas, unit)
            FeedbackAnnotation.Kind.RECTANGLE -> if (points.size == 2) drawRectangle(points[0], points[1], color, canvas, unit, scale, rotation)
            FeedbackAnnotation.Kind.ARROW -> if (points.size == 2) drawArrow(points[0], points[1], color, canvas, unit, scale, rotation)
            FeedbackAnnotation.Kind.TEXT -> {
                val point = points.firstOrNull() ?: return
                val label = annotation.label ?: return
                drawText(label, point, color, canvas, unit, scale)
            }
        }
    }

    private fun strokePaint(color: Int, unit: Float) = Paint(Paint.ANTI_ALIAS_FLAG).apply {
        this.color = color
        style = Paint.Style.STROKE
        strokeWidth = (STROKE_WIDTH * unit).toFloat()
        strokeJoin = Paint.Join.ROUND
        strokeCap = Paint.Cap.ROUND
    }

    internal fun drawFreehand(points: List<Pt>, color: Int, canvas: Canvas, unit: Float) {
        val first = points.firstOrNull() ?: return
        val path = Path().apply {
            moveTo(first.x.toFloat(), first.y.toFloat())
            points.drop(1).forEach { lineTo(it.x.toFloat(), it.y.toFloat()) }
        }
        canvas.drawPath(path, strokePaint(color, unit))
    }

    /** An explicit (possibly rotated) quadrilateral, since a RectF can only be axis-aligned. */
    internal fun drawRectangle(start: Pt, end: Pt, color: Int, canvas: Canvas, unit: Float, scale: Double = 1.0, rotation: Double = 0.0) {
        val center = Pt((start.x + end.x) / 2, (start.y + end.y) / 2)
        val corners = rectangleCorners(center, abs(end.x - start.x) / 2 * scale, abs(end.y - start.y) / 2 * scale, rotation)
        val path = Path().apply {
            moveTo(corners[0].x.toFloat(), corners[0].y.toFloat())
            corners.drop(1).forEach { lineTo(it.x.toFloat(), it.y.toFloat()) }
            close()
        }
        canvas.drawPath(path, strokePaint(color, unit).apply { strokeJoin = Paint.Join.MITER; strokeCap = Paint.Cap.BUTT })
    }

    internal fun drawArrow(rawStart: Pt, rawEnd: Pt, color: Int, canvas: Canvas, unit: Float, scale: Double = 1.0, rotation: Double = 0.0) {
        val (start, end, left, right) = arrowGeometry(rawStart, rawEnd, unit.toDouble(), scale, rotation)
        val path = Path().apply {
            moveTo(start.x.toFloat(), start.y.toFloat())
            lineTo(end.x.toFloat(), end.y.toFloat())
            lineTo(left.x.toFloat(), left.y.toFloat())
            moveTo(end.x.toFloat(), end.y.toFloat())
            lineTo(right.x.toFloat(), right.y.toFloat())
        }
        canvas.drawPath(path, strokePaint(color, unit))
    }

    /** Start, end and the two arrowhead tips, after scale/rotation around the arrow's center. */
    internal fun arrowGeometry(rawStart: Pt, rawEnd: Pt, unit: Double, scale: Double, rotation: Double): List<Pt> {
        val center = Pt((rawStart.x + rawEnd.x) / 2, (rawStart.y + rawEnd.y) / 2)
        val start = rotate(scaled(rawStart, scale, center), rotation, center)
        val end = rotate(scaled(rawEnd, scale, center), rotation, center)
        val angle = atan2(end.y - start.y, end.x - start.x)
        val head = ARROW_HEAD_LENGTH * unit
        val left = Pt(end.x - head * cos(angle - ARROW_HEAD_ANGLE), end.y - head * sin(angle - ARROW_HEAD_ANGLE))
        val right = Pt(end.x - head * cos(angle + ARROW_HEAD_ANGLE), end.y - head * sin(angle + ARROW_HEAD_ANGLE))
        return listOf(start, end, left, right)
    }

    internal fun drawText(text: String, point: Pt, color: Int, canvas: Canvas, unit: Float, scale: Double = 1.0) {
        val paint = textPaint(unit, scale)
        val bubble = textBubbleRect(text, point, unit, scale)
        val corner = (BUBBLE_CORNER * unit).toFloat()
        canvas.drawRoundRect(bubble, corner, corner, Paint(Paint.ANTI_ALIAS_FLAG).apply { this.color = color })
        val padding = (TEXT_PADDING * unit * scale).toFloat()
        canvas.drawText(text, bubble.left + padding, bubble.top + padding - paint.fontMetrics.ascent, paint)
    }

    private fun textPaint(unit: Float, scale: Double) = Paint(Paint.ANTI_ALIAS_FLAG).apply {
        color = 0xFFFFFFFF.toInt()
        typeface = Typeface.DEFAULT_BOLD
        textSize = (BASE_FONT_SIZE * scale * unit).toFloat()
    }

    /** The bubble a text annotation occupies — shared by drawing and hit-testing. Top-left anchored at [point]. */
    internal fun textBubbleRect(text: String, point: Pt, unit: Float, scale: Double = 1.0): RectF {
        val paint = textPaint(unit, scale)
        val padding = (TEXT_PADDING * unit * scale).toFloat()
        val textWidth = paint.measureText(text)
        val textHeight = paint.fontMetrics.let { it.descent - it.ascent }
        val left = point.x.toFloat()
        val top = point.y.toFloat()
        return RectF(left, top, left + textWidth + padding * 2, top + textHeight + padding * 2)
    }

    internal fun rectangleCorners(center: Pt, halfWidth: Double, halfHeight: Double, rotation: Double): List<Pt> = listOf(
        Pt(center.x - halfWidth, center.y - halfHeight),
        Pt(center.x + halfWidth, center.y - halfHeight),
        Pt(center.x + halfWidth, center.y + halfHeight),
        Pt(center.x - halfWidth, center.y + halfHeight),
    ).map { rotate(it, rotation, center) }

    private fun rotate(p: Pt, angle: Double, center: Pt): Pt {
        val dx = p.x - center.x
        val dy = p.y - center.y
        return Pt(center.x + dx * cos(angle) - dy * sin(angle), center.y + dx * sin(angle) + dy * cos(angle))
    }

    private fun scaled(p: Pt, scale: Double, center: Pt) = Pt(center.x + (p.x - center.x) * scale, center.y + (p.y - center.y) * scale)

    /** Whether [point] (in the same pixel space as width/height) grabs [annotation]. Freehand strokes never do. */
    internal fun hitTest(annotation: FeedbackAnnotation, point: Pt, width: Double, height: Double, unit: Double): Boolean {
        val points = annotation.points.map { Pt(it.x * width, it.y * height) }
        val scale = annotation.scale
        val tolerance = HIT_TEST_TOLERANCE * unit
        return when (annotation.kind) {
            FeedbackAnnotation.Kind.RECTANGLE -> {
                if (points.size != 2) return false
                // The scaled-but-unrotated bounding box, padded — as on iOS.
                val cx = (points[0].x + points[1].x) / 2
                val cy = (points[0].y + points[1].y) / 2
                val hw = abs(points[1].x - points[0].x) / 2 * scale + tolerance
                val hh = abs(points[1].y - points[0].y) / 2 * scale + tolerance
                point.x in (cx - hw)..(cx + hw) && point.y in (cy - hh)..(cy + hh)
            }
            FeedbackAnnotation.Kind.ARROW -> {
                if (points.size != 2) return false
                val center = Pt((points[0].x + points[1].x) / 2, (points[0].y + points[1].y) / 2)
                distanceToSegment(point, scaled(points[0], scale, center), scaled(points[1], scale, center)) <= tolerance
            }
            FeedbackAnnotation.Kind.TEXT -> {
                val origin = points.firstOrNull() ?: return false
                val label = annotation.label ?: return false
                val rect = textBubbleRect(label, origin, unit.toFloat(), scale)
                val pad = tolerance / 2
                point.x >= rect.left - pad && point.x <= rect.right + pad && point.y >= rect.top - pad && point.y <= rect.bottom + pad
            }
            FeedbackAnnotation.Kind.FREEHAND -> false
        }
    }

    internal fun distanceToSegment(p: Pt, a: Pt, b: Pt): Double {
        val dx = b.x - a.x
        val dy = b.y - a.y
        val lengthSquared = dx * dx + dy * dy
        if (lengthSquared <= 0) return hypot(p.x - a.x, p.y - a.y)
        val t = max(0.0, min(1.0, ((p.x - a.x) * dx + (p.y - a.y) * dy) / lengthSquared))
        return hypot(p.x - (a.x + t * dx), p.y - (a.y + t * dy))
    }

    /**
     * The scale to encode a screenshot of [widthPx]×[heightPx] at so its
     * longest edge fits [maxPixelDimension] (never upscaling). Same rule as
     * the Swift SDK's `encodingScale`, expressed in pixels.
     */
    @JvmStatic
    fun encodingScale(widthPx: Int, heightPx: Int, maxPixelDimension: Int = MAX_SCREENSHOT_PIXEL_DIMENSION): Double {
        val longest = max(widthPx, heightPx)
        if (longest <= 0) return 1.0
        return min(1.0, maxPixelDimension.toDouble() / longest)
    }
}
