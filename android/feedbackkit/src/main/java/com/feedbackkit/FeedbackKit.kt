package com.feedbackkit

import android.app.Activity
import android.app.Application
import android.content.Context
import android.content.Intent
import android.net.Uri
import android.os.Handler
import android.os.Looper
import android.util.Log
import android.view.Choreographer
import android.view.View
import com.feedbackkit.internal.ActivityTracker
import com.feedbackkit.internal.Http
import com.feedbackkit.internal.ReporterIdentity
import com.feedbackkit.internal.ShakeDetector
import com.feedbackkit.internal.WireFormat
import com.feedbackkit.ui.CaptureIndicator
import com.feedbackkit.ui.FeedbackActivity
import com.feedbackkit.ui.FeedbackSession
import com.feedbackkit.ui.FeedbackTriggerButton
import com.feedbackkit.ui.FixVerificationCoordinator
import org.json.JSONObject

/**
 * FeedbackKit's public entry point on Android — the same shape as the Swift
 * SDK's `FeedbackKit`:
 *
 * ```kotlin
 * // Optional, for the hosted dashboard:
 * FeedbackKit.configure(FeedbackKitConfiguration(endpointUrl, "pk_live_..."))
 *
 * // Wire up a trigger however you like:
 * FeedbackKit.showFloatingTriggerButton()
 * FeedbackKit.enableShakeToReport()
 * // or call FeedbackKit.present(...) from a button/menu you already have.
 *
 * // As the user navigates, so reports say where they came from:
 * FeedbackKit.currentScreen = "Checkout"
 * ```
 *
 * No `Application` setup is needed: a manifest-merged ContentProvider hands
 * FeedbackKit the application context at startup and tracks the foreground
 * activity, so every call can default to "the activity in front". Everything
 * here must be called on the main thread; callbacks arrive on the main thread.
 */
object FeedbackKit {
    private const val TAG = "FeedbackKit"
    private const val DEFAULT_PLACEHOLDER = "What's the problem?"

    /**
     * Best-effort label for the screen currently visible, included in every
     * report. Set it as the user navigates — the fallback is the foreground
     * activity's class name, which says little in a single-activity app.
     */
    @JvmStatic
    var currentScreen: String? = null

    /** Brands the feedback screen; null keeps the default blue. Read fresh on every presentation. */
    @JvmStatic
    var theme: FeedbackTheme? = null

    /** Optional identity of the person using the app, attached to every report they submit. */
    @JvmStatic
    var user: FeedbackUser? = null

    /** Notified whenever a submission to the hosted dashboard finishes (via presentAndSubmit or the triggers). */
    @JvmStatic
    var onSubmissionResult: ((FeedbackSubmissionResult) -> Unit)? = null

    /** Products configured for this project — from configuration, or fetched from the backend. */
    @JvmStatic
    var products: List<FeedbackProduct> = emptyList()

    /** Default product key for this app target (e.g. "android"). */
    @JvmStatic
    var defaultProductKey: String? = null

    /** The active configuration, if [configure] was called with one. */
    @JvmStatic
    var currentConfiguration: FeedbackKitConfiguration? = null
        private set

    @JvmStatic
    val isConfigured: Boolean get() = currentConfiguration != null

    internal var appContext: Context? = null
        private set

    private val handler = Handler(Looper.getMainLooper())
    private var isCapturing = false
    private var triggerEnabled = false
    private var triggerButton: FeedbackTriggerButton? = null
    private var triggerPosition: Pair<Float, Float>? = null
    private var shakeDetector: ShakeDetector? = null

    /**
     * The anonymous, random, per-install id attached to reports from this
     * install — how a fix finds its way back to the device that reported it.
     */
    @JvmStatic
    val reporterId: String
        get() = appContext?.let { ReporterIdentity.current(it) } ?: ""

    /** Called by the manifest initializer. Safe to call again yourself (e.g. from a custom process). */
    @JvmStatic
    fun attach(application: Application) {
        appContext = application.applicationContext
        ActivityTracker.install(application)
        ActivityTracker.addListener(lifecycleListener)
    }

    /**
     * Configures the optional built-in submission path to the hosted
     * dashboard. Pass null to return to local-only delivery.
     */
    @JvmStatic
    fun configure(configuration: FeedbackKitConfiguration?) {
        currentConfiguration = configuration
        if (configuration == null) {
            products = emptyList()
            defaultProductKey = null
            return
        }
        if (configuration.products.isNotEmpty()) products = configuration.products
        configuration.defaultProductKey?.let { defaultProductKey = it }
        if (configuration.products.isEmpty()) fetchProducts(configuration)
    }

    /** Fetches the project's products from the configured endpoint. */
    @JvmStatic
    @JvmOverloads
    fun fetchProducts(
        configuration: FeedbackKitConfiguration? = currentConfiguration,
        completion: ((List<FeedbackProduct>?) -> Unit)? = null,
    ) {
        val config = configuration ?: return
        val url = Uri.parse(config.endpointUrl).buildUpon().appendQueryParameter("project_key", config.projectKey).build().toString()
        Http.request("GET", url, headers = mapOf("x-project-key" to config.projectKey)) { response ->
            val fetched = if (response.status in 200..299) {
                try {
                    val array = JSONObject(response.body ?: "{}").optJSONArray("products")
                    (0 until (array?.length() ?: 0)).mapNotNull { i -> array?.optJSONObject(i)?.let(WireFormat::productFromJson) }
                } catch (e: Exception) {
                    null
                }
            } else null
            if (fetched != null) {
                products = fetched
                if (defaultProductKey == null) defaultProductKey = fetched.firstOrNull { it.isDefault }?.key
            }
            completion?.invoke(fetched)
        }
    }

    // MARK: - Presenting

    /**
     * Captures the screen, then presents the annotate → describe → submit
     * flow. [completion] receives the finished report, or null if the user
     * cancelled. Delivery is entirely up to the caller.
     *
     * @param activity the activity to capture and present over; defaults to the one in front.
     */
    @JvmStatic
    @JvmOverloads
    fun present(activity: Activity? = null, completion: ((FeedbackReport?) -> Unit)? = null) {
        presentFlow(activity, DEFAULT_PLACEHOLDER, completion)
    }

    internal fun presentFlow(activity: Activity?, composerPlaceholder: String, completion: ((FeedbackReport?) -> Unit)?) {
        val host = activity ?: ActivityTracker.currentActivity
        // Completion still fires (with null) when nothing is presented, so a
        // bridge awaiting it (Flutter, React Native) never hangs.
        if (host == null || host is FeedbackActivity) {
            if (host == null) Log.w(TAG, "present(): no foreground activity to capture.")
            completion?.invoke(null)
            return
        }
        // A second trigger while one is capturing or open does nothing.
        if (isCapturing || FeedbackSession.pending != null) {
            completion?.invoke(null)
            return
        }
        isCapturing = true

        // Glow + "Capturing screenshot…" until the editor is up. The trigger
        // button hides so it isn't in the shot; capture waits two frames so
        // both changes have reached the window's surface first.
        val indicator = CaptureIndicator.show(host, theme)
        triggerButton?.visibility = View.INVISIBLE
        afterFrames(2) {
            com.feedbackkit.internal.ScreenshotCapture.capture(host) { bitmap ->
                isCapturing = false
                triggerButton?.visibility = View.VISIBLE
                if (bitmap == null || host.isFinishing) {
                    indicator?.dismiss()
                    completion?.invoke(null)
                    return@capture
                }
                FeedbackSession.pending = FeedbackSession.Request(
                    screenshot = bitmap,
                    screenName = currentScreen,
                    theme = theme,
                    composerPlaceholder = composerPlaceholder,
                    onComplete = { report -> completion?.invoke(report) },
                )
                host.startActivity(Intent(host, FeedbackActivity::class.java))
                @Suppress("DEPRECATION")
                host.overridePendingTransition(android.R.anim.fade_in, 0)
                handler.postDelayed({ indicator?.dismiss() }, 350)
            }
        }
    }

    /** Presents the flow and, if [configure] was called, submits the report to the hosted dashboard. */
    @JvmStatic
    @JvmOverloads
    fun presentAndSubmit(activity: Activity? = null, completion: ((FeedbackSubmissionResult) -> Unit)? = null) {
        present(activity) { report ->
            report ?: return@present
            val configuration = currentConfiguration
            if (configuration == null) {
                completion?.invoke(FeedbackSubmissionResult.Failure(FeedbackSubmissionError.NotConfigured))
                return@present
            }
            FeedbackSubmitter.submit(report, configuration) { result ->
                onSubmissionResult?.invoke(result)
                completion?.invoke(result)
            }
        }
    }

    /**
     * Presents the flow and submits the report if FeedbackKit is configured;
     * otherwise hands back the report locally without submitting. [completion]
     * gets null when the user cancelled.
     */
    @JvmStatic
    @JvmOverloads
    fun presentAndSubmitIfConfigured(activity: Activity? = null, completion: ((FeedbackSubmissionResult?) -> Unit)? = null) {
        if (currentConfiguration != null) {
            presentAndSubmit(activity) { completion?.invoke(it) }
        } else {
            present(activity) { report -> completion?.invoke(report?.let { FeedbackSubmissionResult.Success(it) }) }
        }
    }

    // MARK: - Triggers

    /**
     * Shows a small draggable floating button on every activity that presents
     * the feedback flow (and submits it, if configured) when tapped.
     */
    @JvmStatic
    fun showFloatingTriggerButton() {
        triggerEnabled = true
        ActivityTracker.currentActivity?.let(::installTrigger)
    }

    @JvmStatic
    fun hideFloatingTriggerButton() {
        triggerEnabled = false
        triggerButton?.detach()
        triggerButton = null
    }

    private fun installTrigger(activity: Activity) {
        if (activity is FeedbackActivity) return
        triggerButton?.let { old ->
            triggerPosition = old.x to old.y
            old.detach()
        }
        triggerButton = FeedbackTriggerButton(activity) { presentAndSubmitIfConfigured(activity) }.also {
            it.attach(activity, triggerPosition)
        }
    }

    /** Enables "shake to report" app-wide, listening only while the app is in the foreground. */
    @JvmStatic
    fun enableShakeToReport() {
        val context = appContext ?: return
        if (shakeDetector == null) {
            shakeDetector = ShakeDetector(context) { presentAndSubmitIfConfigured() }
        }
        if (ActivityTracker.isForeground) shakeDetector?.start()
    }

    @JvmStatic
    fun disableShakeToReport() {
        shakeDetector?.stop()
        shakeDetector = null
    }

    // MARK: - Closing the loop

    /**
     * Closes the loop with the person who reported a bug: when a fix for one
     * of their reports ships in the build they're running (announced with
     * `feedbackkit release`), shows their original annotated screenshot with
     * "Yes, it's fixed" / "No, still broken". Still broken re-runs the capture
     * flow. Also surfaces questions the developer or agent asked. Checks
     * shortly after this call and whenever the app comes to the foreground
     * (at most once a minute). Requires [configure].
     */
    @JvmStatic
    fun enableFixVerification() = FixVerificationCoordinator.enable()

    @JvmStatic
    fun disableFixVerification() = FixVerificationCoordinator.disable()

    /** Checks right now (ignoring the throttle) and shows the card if there's an update. */
    @JvmStatic
    fun presentFixUpdatesIfNeeded() = FixVerificationCoordinator.check(force = true)

    /** This install's reports that need the reporter's attention, for a custom UI. */
    @JvmStatic
    fun checkForFixUpdates(completion: (FixUpdatesClient.FetchResult) -> Unit) {
        val configuration = currentConfiguration
        if (configuration == null) {
            Http.main { completion(FixUpdatesClient.FetchResult.Failure(FeedbackSubmissionError.NotConfigured)) }
            return
        }
        FixUpdatesClient.fetch(configuration, completion)
    }

    // MARK: - Internals

    private val lifecycleListener = object : ActivityTracker.Listener {
        override fun onActivityResumed(activity: Activity) {
            if (triggerEnabled) installTrigger(activity)
        }

        override fun onAppForegrounded() {
            shakeDetector?.start()
        }

        override fun onAppBackgrounded() {
            shakeDetector?.stop()
        }
    }

    private fun afterFrames(count: Int, block: () -> Unit) {
        if (count <= 0) {
            block()
            return
        }
        Choreographer.getInstance().postFrameCallback { afterFrames(count - 1, block) }
    }
}
