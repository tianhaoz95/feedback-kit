package com.feedbackkit.internal

import android.content.Context
import android.content.pm.PackageManager
import android.os.Build
import java.util.UUID

/**
 * The anonymous, random, per-install id attached to every report this install
 * submits (`reporter_id`, see 0014_closed_loop.sql). Possessing it is the
 * capability to read this device's fix updates, so it's random, not derived
 * from anything about the device or user. Same contract as
 * `FeedbackReporterIdentity` in the Swift SDK.
 */
internal object ReporterIdentity {
    private const val PREFS = "com.feedbackkit"
    private const val KEY = "reporterID"

    @Synchronized
    fun current(context: Context): String {
        val prefs = context.getSharedPreferences(PREFS, Context.MODE_PRIVATE)
        prefs.getString(KEY, null)?.takeIf(::isValid)?.let { return it }
        val fresh = UUID.randomUUID().toString().replace("-", "").lowercase()
        prefs.edit().putString(KEY, fresh).apply()
        return fresh
    }

    /** Same shape the server accepts (supabase/functions/_shared/reporter.ts). */
    fun isValid(id: String): Boolean =
        id.length in 16..128 && id.all { it.isLetterOrDigit() && it.code < 128 || it == '_' || it == '-' }

    /** The running app's build (versionCode), compared against the build a fix shipped in. */
    fun currentBuild(context: Context): String? = try {
        val info = context.packageManager.getPackageInfo(context.packageName, 0)
        if (Build.VERSION.SDK_INT >= 28) info.longVersionCode.toString() else @Suppress("DEPRECATION") info.versionCode.toString()
    } catch (e: PackageManager.NameNotFoundException) {
        null
    }
}
