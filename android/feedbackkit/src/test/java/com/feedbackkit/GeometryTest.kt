package com.feedbackkit

import com.feedbackkit.AnnotationRenderer.Pt
import org.junit.Assert.assertEquals
import org.junit.Assert.assertFalse
import org.junit.Assert.assertNull
import org.junit.Assert.assertTrue
import org.junit.Test

class GeometryTest {
    @Test
    fun buildOrderingMatchesTheOtherImplementations() {
        assertEquals(0, FeedbackBuild.compare("42", "42"))
        assertEquals(-1, FeedbackBuild.compare("9", "10"))
        assertEquals(1, FeedbackBuild.compare("1.2.10", "1.2.9"))
        assertEquals(0, FeedbackBuild.compare("1.2", "1.2.0"))
        assertEquals(0, FeedbackBuild.compare("007", "7"))
        assertEquals(1, FeedbackBuild.compare("20261002123045", "20261002123044"))
        assertNull(FeedbackBuild.compare("1.0-beta", "1.0"))
        assertNull(FeedbackBuild.compare(null, "1"))
        assertTrue(FeedbackBuild.includesFix("11", "10"))
        assertFalse(FeedbackBuild.includesFix("9", "10"))
        assertTrue(FeedbackBuild.includesFix("abc", "10"))
    }

    @Test
    fun unrotatedRectangleCorners() {
        val corners = AnnotationRenderer.rectangleCorners(Pt(50.0, 50.0), 10.0, 20.0, 0.0)
        assertEquals(listOf(Pt(40.0, 30.0), Pt(60.0, 30.0), Pt(60.0, 70.0), Pt(40.0, 70.0)), corners)
    }

    @Test
    fun rotatedRectangleCornersTurnAroundTheCenter() {
        val corners = AnnotationRenderer.rectangleCorners(Pt(0.0, 0.0), 10.0, 0.0, Math.PI / 2)
        assertEquals(0.0, corners[0].x, 1e-9)
        assertEquals(-10.0, corners[0].y, 1e-9)
    }

    @Test
    fun arrowheadScalesWithTheUnit() {
        val (start, end, left, right) = AnnotationRenderer.arrowGeometry(Pt(0.0, 0.0), Pt(100.0, 0.0), 2.0, 1.0, 0.0)
        assertEquals(Pt(0.0, 0.0), start)
        assertEquals(Pt(100.0, 0.0), end)
        // 18pt head at 2px/pt, angled back from the tip.
        assertEquals(36.0, kotlin.math.hypot(end.x - left.x, end.y - left.y), 1e-9)
        assertEquals(-left.y, right.y, 1e-9)
    }

    @Test
    fun hitTestingRectanglesAndArrows() {
        val rect = FeedbackAnnotation(FeedbackAnnotation.Kind.RECTANGLE, listOf(NormalizedPoint(0.2, 0.2), NormalizedPoint(0.4, 0.4)), "#FF0000")
        assertTrue(AnnotationRenderer.hitTest(rect, Pt(30.0, 30.0), 100.0, 100.0, 1.0))
        assertTrue(AnnotationRenderer.hitTest(rect, Pt(52.0, 30.0), 100.0, 100.0, 1.0)) // within tolerance
        assertFalse(AnnotationRenderer.hitTest(rect, Pt(80.0, 80.0), 100.0, 100.0, 1.0))

        val arrow = FeedbackAnnotation(FeedbackAnnotation.Kind.ARROW, listOf(NormalizedPoint(0.0, 0.5), NormalizedPoint(1.0, 0.5)), "#FF0000")
        assertTrue(AnnotationRenderer.hitTest(arrow, Pt(50.0, 60.0), 100.0, 100.0, 1.0))
        assertFalse(AnnotationRenderer.hitTest(arrow, Pt(50.0, 90.0), 100.0, 100.0, 1.0))

        val freehand = FeedbackAnnotation(FeedbackAnnotation.Kind.FREEHAND, listOf(NormalizedPoint(0.5, 0.5), NormalizedPoint(0.6, 0.6)), "#FF0000")
        assertFalse(AnnotationRenderer.hitTest(freehand, Pt(50.0, 50.0), 100.0, 100.0, 1.0))
    }

    @Test
    fun encodingScaleCapsTheLongestEdge() {
        assertEquals(1600.0 / 2400.0, AnnotationRenderer.encodingScale(1080, 2400), 1e-9)
        assertEquals(1.0, AnnotationRenderer.encodingScale(800, 1200), 0.0)
        assertEquals(1.0, AnnotationRenderer.encodingScale(0, 0), 0.0)
    }
}
