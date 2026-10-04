package com.feedbackkit.internal

import android.os.Handler
import android.os.Looper
import java.io.IOException
import java.net.HttpURLConnection
import java.net.URL
import java.util.concurrent.ExecutorService
import java.util.concurrent.Executors

/** Minimal HttpURLConnection wrapper: requests run on a background thread, callbacks on the main thread. */
internal object Http {
    class Response(val status: Int, val body: String?, val error: Throwable?)

    val executor: ExecutorService = Executors.newCachedThreadPool { runnable ->
        Thread(runnable, "FeedbackKit").apply { isDaemon = true }
    }

    private val mainHandler by lazy { Handler(Looper.getMainLooper()) }

    fun main(block: () -> Unit) {
        if (Looper.myLooper() == Looper.getMainLooper()) block() else mainHandler.post(block)
    }

    fun request(
        method: String,
        url: String,
        jsonBody: String? = null,
        headers: Map<String, String> = emptyMap(),
        completion: (Response) -> Unit,
    ) {
        executor.execute {
            val response = perform(method, url, jsonBody, headers)
            main { completion(response) }
        }
    }

    fun perform(method: String, url: String, jsonBody: String?, headers: Map<String, String>): Response {
        var connection: HttpURLConnection? = null
        return try {
            connection = (URL(url).openConnection() as HttpURLConnection).apply {
                requestMethod = method
                connectTimeout = 30_000
                readTimeout = 60_000
                headers.forEach { (k, v) -> setRequestProperty(k, v) }
                if (jsonBody != null) {
                    doOutput = true
                    setRequestProperty("Content-Type", "application/json")
                }
            }
            if (jsonBody != null) {
                connection.outputStream.use { it.write(jsonBody.toByteArray(Charsets.UTF_8)) }
            }
            val status = connection.responseCode
            val stream = if (status in 200..299) connection.inputStream else connection.errorStream
            val body = stream?.bufferedReader()?.use { it.readText() }
            Response(status, body, null)
        } catch (e: IOException) {
            Response(-1, null, e)
        } catch (e: RuntimeException) {
            Response(-1, null, e)
        } finally {
            connection?.disconnect()
        }
    }

    fun download(url: String): ByteArray? = try {
        (URL(url).openConnection() as HttpURLConnection).run {
            connectTimeout = 30_000
            readTimeout = 60_000
            try {
                if (responseCode in 200..299) inputStream.use { it.readBytes() } else null
            } finally {
                disconnect()
            }
        }
    } catch (e: Exception) {
        null
    }
}
