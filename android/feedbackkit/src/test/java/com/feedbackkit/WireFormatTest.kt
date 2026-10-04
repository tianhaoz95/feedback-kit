package com.feedbackkit

import com.feedbackkit.internal.Base64Codec
import com.feedbackkit.internal.WireFormat
import org.json.JSONObject
import org.junit.Assert.assertEquals
import org.junit.Assert.assertFalse
import org.junit.Assert.assertTrue
import org.junit.Test
import java.util.Base64
import java.util.Date
import kotlin.random.Random

class WireFormatTest {
    private val environment = FeedbackEnvironment(
        osName = "Android",
        osVersion = "15",
        deviceModel = "Google Pixel 8",
        appVersion = "1.2.3",
        appBuild = "42",
        bundleIdentifier = "com.example.app",
        screenName = "Checkout",
        locale = "en_US",
        screenWidthPoints = 411.0,
        screenHeightPoints = 914.0,
        screenScale = 2.625,
    )

    private fun report(withScreenshot: Boolean = true) = FeedbackReport(
        id = "6F9619FF-8B86-D011-B42D-00C04FC964FF",
        createdAt = Date(1_790_000_000_000L),
        text = "Button is cut off",
        screenshotRawPng = if (withScreenshot) byteArrayOf(1, 2, 3) else null,
        screenshotAnnotatedPng = if (withScreenshot) byteArrayOf(4, 5) else null,
        annotations = if (withScreenshot) listOf(
            FeedbackAnnotation(FeedbackAnnotation.Kind.ARROW, listOf(NormalizedPoint(0.1, 0.2), NormalizedPoint(0.5, 0.75)), "#FF3B30", scale = 1.5, rotation = 0.25),
            FeedbackAnnotation(FeedbackAnnotation.Kind.TEXT, listOf(NormalizedPoint(0.3, 0.4)), "#007AFF", label = "here"),
        ) else emptyList(),
        environment = environment,
        attachment = FeedbackAttachment("log.txt", "text/plain", "hi".toByteArray()),
        products = listOf(FeedbackProduct("android", "Android App", "The app", isDefault = true)),
        notifyReporter = true,
    )

    @Test
    fun ingestPayloadMatchesTheSwiftWireFormat() {
        val json = WireFormat.ingestPayload(report(), "pk_test", "abcdef0123456789", FeedbackUser(id = "u1", email = "a@b.c"))
        assertEquals("pk_test", json.getString("project_key"))
        assertEquals("6F9619FF-8B86-D011-B42D-00C04FC964FF", json.getString("id"))
        assertEquals("2026-09-21T14:13:20Z", json.getString("created_at"))
        assertEquals("Button is cut off", json.getString("text"))
        assertEquals("AQID", json.getString("screenshot_raw_png_base64"))
        assertEquals("BAU=", json.getString("screenshot_annotated_png_base64"))
        assertEquals("log.txt", json.getString("attachment_filename"))
        assertEquals("text/plain", json.getString("attachment_mime_type"))
        assertEquals("aGk=", json.getString("attachment_data_base64"))
        assertEquals("android", json.getJSONArray("product_keys").getString(0))
        assertTrue(json.getJSONArray("products").getJSONObject(0).getBoolean("is_default"))
        assertEquals("abcdef0123456789", json.getString("reporter_id"))
        assertEquals("u1", json.getJSONObject("reporter").getString("id"))
        assertFalse(json.getJSONObject("reporter").has("name"))
        assertTrue(json.getBoolean("notify_reporter"))

        // environment/annotations stay camelCase (opaque JSONB read by the dashboard).
        val env = json.getJSONObject("environment")
        assertEquals("Android", env.getString("osName"))
        assertEquals("com.example.app", env.getString("bundleIdentifier"))
        assertEquals(2.625, env.getDouble("screenScale"), 0.0)
        assertFalse(env.has("platform"))

        val arrow = json.getJSONArray("annotations").getJSONObject(0)
        assertEquals("arrow", arrow.getString("kind"))
        assertEquals("#FF3B30", arrow.getString("colorHex"))
        // Points are [x, y] tuples — how CGPoint encodes.
        assertEquals(0.5, arrow.getJSONArray("points").getJSONArray(1).getDouble(0), 0.0)
        assertEquals(0.75, arrow.getJSONArray("points").getJSONArray(1).getDouble(1), 0.0)
        assertEquals(1.5, arrow.getDouble("scale"), 0.0)
        assertFalse(arrow.has("label"))
        assertEquals("here", json.getJSONArray("annotations").getJSONObject(1).getString("label"))
    }

    @Test
    fun screenshotFieldsAreOmittedWhenExcluded() {
        val json = WireFormat.ingestPayload(report(withScreenshot = false), "pk", null, null)
        assertFalse(json.has("screenshot_raw_png_base64"))
        assertFalse(json.has("screenshot_annotated_png_base64"))
        assertEquals(0, json.getJSONArray("annotations").length())
        assertFalse(json.has("reporter_id"))
        assertFalse(json.has("reporter"))
    }

    @Test
    fun base64MatchesTheJdkEncoder() {
        val random = Random(7)
        for (size in 0..40) {
            val bytes = random.nextBytes(size)
            assertEquals(Base64.getEncoder().encodeToString(bytes), Base64Codec.encode(bytes))
        }
    }

    @Test
    fun reopenActionPayload() {
        val json = FixUpdatesClient.actionPayload(FixUpdatesClient.Action.Reopen(report()), "fid", "pk", "rid0123456789abc", "7")
        assertEquals("reopen", json.getString("action"))
        assertEquals("Button is cut off", json.getString("text"))
        assertEquals("7", json.getString("build"))
        assertEquals("AQID", json.getString("screenshot_raw_png_base64"))
        assertEquals(2, json.getJSONArray("annotations").length())

        val verify = FixUpdatesClient.actionPayload(FixUpdatesClient.Action.Verify, "fid", "pk", "rid0123456789abc", null)
        assertEquals("verify", verify.getString("action"))
        assertFalse(verify.has("build"))
    }

    @Test
    fun parsesFixUpdates() {
        val update = FixUpdate.fromJson(
            JSONObject(
                """{"feedback_id":"abc","text":"broken","needs_verification":true,"fixed_in_build":"12",
                   "screen_name":null,"open_question":{"id":"q","body":"Which page?","created_at":"x"},
                   "messages":[{"id":"m","kind":"comment","body":"On it","author":"Dev","created_at":"y"}]}""",
            ),
        )
        assertEquals("abc", update.feedbackId)
        assertTrue(update.needsVerification)
        assertEquals("12", update.fixedInBuild)
        assertEquals(null, update.screenName)
        assertEquals("Which page?", update.openQuestion?.body)
        assertEquals("Dev", update.messages.single().author)
    }

    @Test
    fun reporterUpdatesUrlIsDerivedFromTheEndpoint() {
        val config = FeedbackKitConfiguration("https://x.supabase.co/functions/v1/ingest-feedback", "pk")
        assertEquals("https://x.supabase.co/functions/v1/reporter-updates", config.resolvedReporterUpdatesUrl)
        assertEquals("https://other/updates", config.copy(reporterUpdatesUrl = "https://other/updates").resolvedReporterUpdatesUrl)
    }
}
