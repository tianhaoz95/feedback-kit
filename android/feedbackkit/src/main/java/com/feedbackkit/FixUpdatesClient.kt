package com.feedbackkit

import android.net.Uri
import com.feedbackkit.internal.Base64Codec
import com.feedbackkit.internal.Http
import com.feedbackkit.internal.ReporterIdentity
import com.feedbackkit.internal.WireFormat
import org.json.JSONObject

/**
 * Talks to the `reporter-updates` Edge Function — the reporter's side of the
 * closed loop. Plain transport with no UI; [FeedbackKit.enableFixVerification]
 * sits on top of it. Wire format mirrors supabase/functions/reporter-updates,
 * `FixUpdatesClient.swift` and web-sdk/src/fixes.ts.
 */
object FixUpdatesClient {
    sealed class Action {
        /** The reporter confirmed the shipped fix works. */
        object Verify : Action()

        /** Still broken — optionally with a fresh report (text + annotated screenshot). */
        class Reopen(val report: FeedbackReport?) : Action()

        /** An answer to the developer's or agent's question. */
        class Reply(val text: String) : Action()
    }

    sealed class FetchResult {
        data class Success(val updates: List<FixUpdate>) : FetchResult()
        data class Failure(val error: FeedbackSubmissionError) : FetchResult()
    }

    /** Reports filed from this install that need the reporter's attention. Completion on the main thread. */
    @JvmStatic
    fun fetch(configuration: FeedbackKitConfiguration, completion: (FetchResult) -> Unit) {
        val context = FeedbackKit.appContext
        if (context == null) {
            Http.main { completion(FetchResult.Failure(FeedbackSubmissionError.NotConfigured)) }
            return
        }
        val builder = Uri.parse(configuration.resolvedReporterUpdatesUrl).buildUpon()
            .appendQueryParameter("project_key", configuration.projectKey)
            .appendQueryParameter("reporter_id", ReporterIdentity.current(context))
        ReporterIdentity.currentBuild(context)?.let { builder.appendQueryParameter("build", it) }

        Http.request("GET", builder.build().toString()) { response ->
            val result = when {
                response.error != null -> FetchResult.Failure(FeedbackSubmissionError.Network(response.error))
                response.status !in 200..299 -> FetchResult.Failure(FeedbackSubmissionError.Server(response.status))
                else -> try {
                    val array = JSONObject(response.body ?: "{}").optJSONArray("updates")
                    val updates = (0 until (array?.length() ?: 0)).mapNotNull { i ->
                        array?.optJSONObject(i)?.let { FixUpdate.fromJson(it) }
                    }
                    FetchResult.Success(updates)
                } catch (e: Exception) {
                    FetchResult.Failure(FeedbackSubmissionError.EncodingFailed)
                }
            }
            completion(result)
        }
    }

    /** Sends the reporter's answer for one report. Completion on the main thread. */
    @JvmStatic
    @JvmOverloads
    fun send(
        action: Action,
        feedbackId: String,
        configuration: FeedbackKitConfiguration,
        completion: ((FeedbackSubmissionError?) -> Unit)? = null,
    ) {
        val context = FeedbackKit.appContext
        if (context == null) {
            Http.main { completion?.invoke(FeedbackSubmissionError.NotConfigured) }
            return
        }
        val body = actionPayload(
            action,
            feedbackId,
            configuration.projectKey,
            ReporterIdentity.current(context),
            ReporterIdentity.currentBuild(context),
        )
        Http.request("POST", configuration.resolvedReporterUpdatesUrl, body.toString()) { response ->
            val error = when {
                response.error != null -> FeedbackSubmissionError.Network(response.error)
                response.status !in 200..299 -> FeedbackSubmissionError.Server(response.status)
                else -> null
            }
            completion?.invoke(error)
        }
    }

    internal fun actionPayload(
        action: Action,
        feedbackId: String,
        projectKey: String,
        reporterId: String,
        build: String?,
    ): JSONObject = JSONObject().apply {
        put("project_key", projectKey)
        put("reporter_id", reporterId)
        put("feedback_id", feedbackId)
        build?.let { put("build", it) }
        when (action) {
            is Action.Verify -> put("action", "verify")
            is Action.Reply -> {
                put("action", "reply")
                put("text", action.text)
            }
            is Action.Reopen -> {
                put("action", "reopen")
                action.report?.let { report ->
                    put("text", report.text)
                    report.screenshotRawPng?.let { put("screenshot_raw_png_base64", Base64Codec.encode(it)) }
                    report.screenshotAnnotatedPng?.let { put("screenshot_annotated_png_base64", Base64Codec.encode(it)) }
                    put("annotations", WireFormat.annotations(report.annotations))
                }
            }
        }
    }
}
