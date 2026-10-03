package com.feedbackkit.internal

import android.app.Activity
import android.app.Application
import android.content.ContentProvider
import android.content.ContentValues
import android.database.Cursor
import android.net.Uri
import android.os.Bundle
import com.feedbackkit.FeedbackKit
import com.feedbackkit.ui.FeedbackActivity
import java.lang.ref.WeakReference

/**
 * Knows which activity is in front, so `FeedbackKit.present()` and the
 * triggers don't need an Activity argument — the analog of the iOS SDK
 * walking `UIApplication`'s key window. Listeners let the floating button and
 * shake detector follow the app between activities and into the background.
 */
internal object ActivityTracker : Application.ActivityLifecycleCallbacks {
    interface Listener {
        fun onActivityResumed(activity: Activity) {}
        fun onActivityPaused(activity: Activity) {}
        fun onAppForegrounded() {}
        fun onAppBackgrounded() {}
    }

    private var installed = false
    private var resumed: WeakReference<Activity>? = null
    private var startedCount = 0
    private val listeners = mutableListOf<Listener>()

    /** The foreground host activity (never FeedbackKit's own editor). */
    val currentActivity: Activity?
        get() = resumed?.get()?.takeUnless { it.isFinishing || it.isDestroyed }

    val isForeground: Boolean get() = startedCount > 0

    fun install(application: Application) {
        if (installed) return
        installed = true
        application.registerActivityLifecycleCallbacks(this)
    }

    fun addListener(listener: Listener) {
        if (listener !in listeners) listeners += listener
    }

    fun removeListener(listener: Listener) {
        listeners -= listener
    }

    override fun onActivityStarted(activity: Activity) {
        startedCount++
        if (startedCount == 1) listeners.toList().forEach { it.onAppForegrounded() }
    }

    override fun onActivityResumed(activity: Activity) {
        if (activity is FeedbackActivity) return
        resumed = WeakReference(activity)
        listeners.toList().forEach { it.onActivityResumed(activity) }
    }

    override fun onActivityPaused(activity: Activity) {
        if (activity is FeedbackActivity) return
        listeners.toList().forEach { it.onActivityPaused(activity) }
    }

    override fun onActivityStopped(activity: Activity) {
        startedCount = maxOf(0, startedCount - 1)
        if (startedCount == 0) listeners.toList().forEach { it.onAppBackgrounded() }
    }

    override fun onActivityDestroyed(activity: Activity) {
        if (resumed?.get() === activity) resumed = null
    }

    override fun onActivityCreated(activity: Activity, savedInstanceState: Bundle?) {}
    override fun onActivitySaveInstanceState(activity: Activity, outState: Bundle) {}
}

/**
 * Runs at app start (before `Application.onCreate`) to hand FeedbackKit the
 * application context and start [ActivityTracker] — the usual zero-setup
 * pattern for Android SDKs, and what lets the Flutter and React Native
 * bridges call `FeedbackKit` without wiring anything up themselves.
 */
internal class FeedbackKitInitializer : ContentProvider() {
    override fun onCreate(): Boolean {
        val application = context?.applicationContext as? Application ?: return true
        FeedbackKit.attach(application)
        return true
    }

    override fun query(uri: Uri, projection: Array<out String>?, selection: String?, selectionArgs: Array<out String>?, sortOrder: String?): Cursor? = null
    override fun getType(uri: Uri): String? = null
    override fun insert(uri: Uri, values: ContentValues?): Uri? = null
    override fun delete(uri: Uri, selection: String?, selectionArgs: Array<out String>?): Int = 0
    override fun update(uri: Uri, values: ContentValues?, selection: String?, selectionArgs: Array<out String>?): Int = 0
}
