package com.feedbackkit

import org.json.JSONObject

/**
 * Something that happened to a report this device filed: a fix that shipped
 * in a build this device is already running ("is it fixed?"), and/or a
 * question from the developer or their coding agent.
 *
 * Mirrors the `reporter-updates` Edge Function's response
 * (supabase/functions/reporter-updates/index.ts), `FixUpdate.swift` and
 * web-sdk/src/fixes.ts by hand.
 */
data class FixUpdate(
    /** The report's id — the same value as the original [FeedbackReport.id]. */
    val feedbackId: String,
    val text: String,
    val createdAt: String,
    val screenName: String?,
    val fixStage: String?,
    val fixedInBuild: String?,
    val fixSummary: String?,
    /** A fix shipped in a build this device runs and the reporter hasn't confirmed it yet. */
    val needsVerification: Boolean,
    val openQuestion: Question?,
    /** Short-lived signed URL of the original annotated screenshot. */
    val screenshotUrl: String?,
    val messages: List<Message>,
) {
    data class Question(val id: String, val body: String, val createdAt: String)

    data class Message(
        val id: String,
        /** e.g. "comment", "question", "shipped", "reporter_reply". */
        val kind: String,
        val body: String,
        /** "you" for the reporter's own messages, otherwise who sent it. */
        val author: String,
        val createdAt: String,
    )

    companion object {
        internal fun fromJson(json: JSONObject): FixUpdate {
            val question = json.optJSONObject("open_question")?.let {
                Question(it.optString("id"), it.optString("body"), it.optString("created_at"))
            }
            val messages = buildList {
                val array = json.optJSONArray("messages") ?: return@buildList
                for (i in 0 until array.length()) {
                    val m = array.optJSONObject(i) ?: continue
                    add(Message(m.optString("id"), m.optString("kind"), m.optString("body"), m.optString("author"), m.optString("created_at")))
                }
            }
            return FixUpdate(
                feedbackId = json.getString("feedback_id"),
                text = json.optString("text", ""),
                createdAt = json.optString("created_at", ""),
                screenName = json.optStringOrNull("screen_name"),
                fixStage = json.optStringOrNull("fix_stage"),
                fixedInBuild = json.optStringOrNull("fixed_in_build"),
                fixSummary = json.optStringOrNull("fix_summary"),
                needsVerification = json.optBoolean("needs_verification", false),
                openQuestion = question,
                screenshotUrl = json.optStringOrNull("screenshot_url"),
                messages = messages,
            )
        }
    }
}

internal fun JSONObject.optStringOrNull(key: String): String? =
    if (has(key) && !isNull(key)) optString(key) else null

/**
 * Build ordering for "does the build I'm running contain the fix?".
 *
 * Must stay in sync with supabase/migrations/0014_closed_loop.sql
 * `compare_builds`, supabase/functions/_shared/builds.ts, cli/src/loop.ts,
 * Sources/FeedbackKit/Model/FixUpdate.swift and web-sdk/src/fixes.ts: dotted
 * numeric builds compare numerically segment by segment; anything else is
 * only equal or incomparable (null).
 */
object FeedbackBuild {
    /** Negative, zero or positive like a comparator, or null when incomparable. */
    @JvmStatic
    fun compare(a: String?, b: String?): Int? {
        if (a.isNullOrEmpty() || b.isNullOrEmpty()) return null
        if (a == b) return 0
        val pa = a.split(".")
        val pb = b.split(".")
        val isNumeric = { s: String -> s.isNotEmpty() && s.all { it in '0'..'9' } }
        if (!pa.all(isNumeric) || !pb.all(isNumeric)) return null
        for (i in 0 until maxOf(pa.size, pb.size)) {
            // Digit strings with leading zeros stripped, so long timestamp builds can't overflow.
            val sa = normalized(pa.getOrElse(i) { "0" })
            val sb = normalized(pb.getOrElse(i) { "0" })
            if (sa.length != sb.length) return if (sa.length < sb.length) -1 else 1
            if (sa != sb) return if (sa < sb) -1 else 1
        }
        return 0
    }

    /** Unknown or incomparable counts as yes — the server only reports a fix once a release was announced. */
    @JvmStatic
    fun includesFix(currentBuild: String?, fixedInBuild: String?): Boolean {
        val result = compare(currentBuild, fixedInBuild) ?: return true
        return result >= 0
    }

    private fun normalized(segment: String): String = segment.trimStart('0').ifEmpty { "0" }
}
