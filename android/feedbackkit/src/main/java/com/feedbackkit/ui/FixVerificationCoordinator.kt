package com.feedbackkit.ui

import android.app.Activity
import android.os.Handler
import android.os.Looper
import android.os.SystemClock
import android.util.Log
import com.feedbackkit.FeedbackKit
import com.feedbackkit.FeedbackReport
import com.feedbackkit.FixUpdate
import com.feedbackkit.FixUpdatesClient
import com.feedbackkit.internal.ActivityTracker
import com.feedbackkit.internal.EnvironmentInfo

/**
 * Drives `FeedbackKit.enableFixVerification()`: checks for fix updates when
 * the app comes to the foreground (at most once a minute) and shows
 * [FixVerificationDialog]. "Still broken" runs the normal capture flow with a
 * "What's still wrong?" prompt and sends the result as a reopen. Same
 * behavior as the iOS `FixVerificationCoordinator` + `FixVerificationState`.
 */
internal object FixVerificationCoordinator : ActivityTracker.Listener {
    private const val MINIMUM_CHECK_INTERVAL_MS = 60_000L

    private val handler = Handler(Looper.getMainLooper())
    private var enabled = false
    private var showing = false
    private var inFlight = false
    private var lastCheck = 0L
    private val handledThisLaunch = mutableSetOf<String>()

    fun enable() {
        enabled = true
        ActivityTracker.addListener(this)
        // Give the host app's first screen a moment to settle before a card appears.
        handler.postDelayed({ check(force = false) }, 1500)
    }

    fun disable() {
        enabled = false
        ActivityTracker.removeListener(this)
    }

    override fun onAppForegrounded() {
        handler.postDelayed({ check(force = false) }, 800)
    }

    fun check(force: Boolean) {
        if (!enabled || showing || inFlight) return
        val configuration = FeedbackKit.currentConfiguration ?: return
        val now = SystemClock.elapsedRealtime()
        if (!force && lastCheck != 0L && now - lastCheck < MINIMUM_CHECK_INTERVAL_MS) return
        inFlight = true
        lastCheck = now
        FixUpdatesClient.fetch(configuration) { result ->
            inFlight = false
            val updates = (result as? FixUpdatesClient.FetchResult.Success)?.updates ?: return@fetch
            updates.firstOrNull { it.feedbackId !in handledThisLaunch }?.let(::show)
        }
    }

    private fun show(update: FixUpdate) {
        val activity = ActivityTracker.currentActivity ?: return
        if (showing) return
        showing = true
        FixVerificationDialog(activity, update, Palette(activity, FeedbackKit.theme)) { outcome ->
            showing = false
            handle(outcome, update, activity)
        }.show()
    }

    private fun handle(outcome: FixVerificationDialog.Outcome, update: FixUpdate, activity: Activity) {
        handledThisLaunch += update.feedbackId
        when (outcome) {
            is FixVerificationDialog.Outcome.Verified -> {
                send(FixUpdatesClient.Action.Verify, update)
                check(force = true)
            }
            is FixVerificationDialog.Outcome.Replied -> {
                send(FixUpdatesClient.Action.Reply(outcome.text), update)
                check(force = true)
            }
            is FixVerificationDialog.Outcome.Later -> Unit
            is FixVerificationDialog.Outcome.StillBroken -> {
                val inline = outcome.inlineText
                if (inline != null) {
                    send(FixUpdatesClient.Action.Reopen(textOnlyReport(activity, inline)), update)
                    return
                }
                // Let the card finish closing so it isn't in the screenshot.
                handler.postDelayed({
                    FeedbackKit.presentFlow(ActivityTracker.currentActivity, "What's still wrong?") { report ->
                        // Cancelling still counts as "still broken" — the reporter said so.
                        send(FixUpdatesClient.Action.Reopen(report), update)
                    }
                }, 350)
            }
        }
    }

    private fun textOnlyReport(activity: Activity, text: String) = FeedbackReport(
        text = text,
        screenshotRawPng = null,
        screenshotAnnotatedPng = null,
        annotations = emptyList(),
        environment = EnvironmentInfo.current(activity.applicationContext, FeedbackKit.currentScreen),
    )

    private fun send(action: FixUpdatesClient.Action, update: FixUpdate) {
        val configuration = FeedbackKit.currentConfiguration ?: return
        FixUpdatesClient.send(action, update.feedbackId, configuration) { error ->
            if (error != null) Log.w("FeedbackKit", "Couldn't send fix verification: ${error.message}")
        }
    }
}
