package com.feedbackkit.demo

import android.content.Context
import android.content.SharedPreferences
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.setValue
import com.feedbackkit.FeedbackKit
import com.feedbackkit.FeedbackKitConfiguration

/**
 * The project key + endpoint entered in Settings, so you can send real
 * reports to your dashboard before integrating the SDK into your own app.
 * Same storage and defaults as the iOS demo's `DemoSettings`.
 */
object DemoSettings {
    const val DEFAULT_ENDPOINT = "https://gpucoladcyvijefdjudf.supabase.co/functions/v1/ingest-feedback"
    private const val KEY_API = "com.feedbackkit.demo.apiKey"
    private const val KEY_ENDPOINT = "com.feedbackkit.demo.endpointURL"

    private lateinit var prefs: SharedPreferences

    var apiKey by mutableStateOf("")
        private set
    var endpointUrl by mutableStateOf(DEFAULT_ENDPOINT)
        private set

    val isConfigured: Boolean get() = apiKey.isNotBlank()

    fun init(context: Context) {
        prefs = context.getSharedPreferences("demo", Context.MODE_PRIVATE)
        apiKey = prefs.getString(KEY_API, "") ?: ""
        endpointUrl = prefs.getString(KEY_ENDPOINT, DEFAULT_ENDPOINT) ?: DEFAULT_ENDPOINT
        applyConfiguration()
    }

    fun updateApiKey(value: String) {
        apiKey = value
        prefs.edit().putString(KEY_API, value).apply()
        applyConfiguration()
    }

    fun updateEndpoint(value: String) {
        endpointUrl = value
        prefs.edit().putString(KEY_ENDPOINT, value).apply()
        applyConfiguration()
    }

    /** Syncs the current settings into `FeedbackKit.configure`. */
    private fun applyConfiguration() {
        val key = apiKey.trim()
        if (key.isEmpty()) {
            FeedbackKit.configure(null)
            return
        }
        val endpoint = endpointUrl.trim().ifEmpty { DEFAULT_ENDPOINT }
        FeedbackKit.configure(FeedbackKitConfiguration(endpointUrl = endpoint, projectKey = key))
    }
}
