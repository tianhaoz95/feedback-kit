package com.feedbackkit.demo

import android.app.AlertDialog
import android.app.Application
import com.feedbackkit.FeedbackKit
import com.feedbackkit.FeedbackSubmissionResult

class DemoApplication : Application() {
    override fun onCreate() {
        super.onCreate()
        // Restores whichever API key and endpoint were saved in Settings,
        // configuring FeedbackKit if a key is present.
        DemoSettings.init(this)

        // Showcases FeedbackKit.onSubmissionResult: tells the user when a
        // report reached their dashboard, or why it didn't.
        FeedbackKit.onSubmissionResult = { result ->
            when (result) {
                is FeedbackSubmissionResult.Success -> notify(
                    "Feedback Submitted",
                    "Your feedback was sent to your web dashboard project (ID: ${result.report.id.take(8)}).",
                )
                is FeedbackSubmissionResult.Failure -> notify(
                    "Submission Failed",
                    "${result.error.message}\n\nPlease verify your API key in Settings.",
                )
            }
        }

        // Showcases FeedbackKit.theme: restores the brand last picked in
        // Settings > Branding (default: Sunset, this demo's own brand).
        FeedbackKit.theme = DemoBranding.current(this).theme

        // Triggers — the same three the iOS demo wires up.
        FeedbackKit.showFloatingTriggerButton()
        FeedbackKit.enableShakeToReport()
        // Closes the loop: once a fix for something reported from this device
        // ships (`feedbackkit release --build <n>`) and this build is at least
        // <n>, the app shows the original screenshot and asks "is it fixed?".
        FeedbackKit.enableFixVerification()
    }

    private fun notify(title: String, message: String) {
        val activity = MainActivity.current ?: return
        AlertDialog.Builder(activity).setTitle(title).setMessage(message).setPositiveButton("OK", null).show()
    }
}
