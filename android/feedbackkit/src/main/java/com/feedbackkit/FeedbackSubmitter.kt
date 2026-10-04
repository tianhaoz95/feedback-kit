package com.feedbackkit

import com.feedbackkit.internal.Http
import com.feedbackkit.internal.ReporterIdentity
import com.feedbackkit.internal.WireFormat

/** Why a submission to the hosted dashboard failed. Mirrors `FeedbackSubmissionError` in Swift. */
sealed class FeedbackSubmissionError(message: String, cause: Throwable? = null) : Exception(message, cause) {
    object NotConfigured : FeedbackSubmissionError("FeedbackKit is not configured with an API key and endpoint.") {
        private fun readResolve(): Any = NotConfigured
    }

    object EncodingFailed : FeedbackSubmissionError("Failed to encode feedback payload.") {
        private fun readResolve(): Any = EncodingFailed
    }

    class Network(cause: Throwable) : FeedbackSubmissionError("Network error: ${cause.message}", cause)

    class Server(val statusCode: Int) : FeedbackSubmissionError(describe(statusCode))

    private companion object {
        fun describe(statusCode: Int): String = when (statusCode) {
            401, 403 -> "Server rejected project key (HTTP $statusCode). Please verify your API key."
            // The project's plan reached its monthly report limit (0019_plan_limits.sql).
            402 -> "Feedback for this app is paused this month. Please try again later."
            else -> "Server returned error (HTTP $statusCode)."
        }
    }
}

/** The outcome of submitting a report to the hosted dashboard. */
sealed class FeedbackSubmissionResult {
    data class Success(val report: FeedbackReport) : FeedbackSubmissionResult()
    data class Failure(val error: FeedbackSubmissionError) : FeedbackSubmissionResult()
}

/**
 * Optional built-in transport that POSTs a [FeedbackReport] to the FeedbackKit
 * dashboard's ingestion endpoint. Just one way to consume a report — nothing
 * about capture or annotation depends on it.
 */
object FeedbackSubmitter {
    /** Sends [report]; [completion] is called on the main thread. */
    @JvmStatic
    @JvmOverloads
    fun submit(
        report: FeedbackReport,
        configuration: FeedbackKitConfiguration,
        completion: ((FeedbackSubmissionResult) -> Unit)? = null,
    ) {
        val reporterId = FeedbackKit.appContext?.let { ReporterIdentity.current(it) }
        val body = try {
            WireFormat.ingestPayload(report, configuration.projectKey, reporterId, FeedbackKit.user).toString()
        } catch (e: Exception) {
            Http.main { completion?.invoke(FeedbackSubmissionResult.Failure(FeedbackSubmissionError.EncodingFailed)) }
            return
        }
        Http.request("POST", configuration.endpointUrl, body) { response ->
            val result = when {
                response.error != null -> FeedbackSubmissionResult.Failure(FeedbackSubmissionError.Network(response.error))
                response.status !in 200..299 -> FeedbackSubmissionResult.Failure(FeedbackSubmissionError.Server(response.status))
                else -> FeedbackSubmissionResult.Success(report)
            }
            completion?.invoke(result)
        }
    }
}
