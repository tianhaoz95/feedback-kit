package com.feedbackkit.internal

import android.content.Context
import android.hardware.Sensor
import android.hardware.SensorEvent
import android.hardware.SensorEventListener
import android.hardware.SensorManager
import android.os.SystemClock
import kotlin.math.sqrt

/**
 * Detects a deliberate shake from the accelerometer — the Android analog of
 * the iOS SDK's `UIWindow.motionEnded` hook. Only listens while the app is in
 * the foreground (see `FeedbackKit.enableShakeToReport`), so it costs nothing
 * in the background.
 */
internal class ShakeDetector(context: Context, private val onShake: () -> Unit) : SensorEventListener {
    private val sensorManager = context.getSystemService(Context.SENSOR_SERVICE) as? SensorManager
    private val accelerometer = sensorManager?.getDefaultSensor(Sensor.TYPE_ACCELEROMETER)
    private var listening = false
    private val peaks = ArrayDeque<Long>()
    private var lastShake = 0L

    fun start() {
        if (listening || accelerometer == null) return
        listening = sensorManager?.registerListener(this, accelerometer, SensorManager.SENSOR_DELAY_UI) == true
    }

    fun stop() {
        if (!listening) return
        sensorManager?.unregisterListener(this)
        listening = false
        peaks.clear()
    }

    override fun onSensorChanged(event: SensorEvent) {
        val (x, y, z) = event.values
        val gForce = sqrt(x * x + y * y + z * z) / SensorManager.GRAVITY_EARTH
        if (gForce < THRESHOLD_G) return
        val now = SystemClock.elapsedRealtime()
        peaks.addLast(now)
        while (peaks.isNotEmpty() && now - peaks.first() > WINDOW_MS) peaks.removeFirst()
        // A couple of hard jolts within half a second is a shake, not a bump.
        if (peaks.size >= PEAKS_FOR_SHAKE && now - lastShake > COOLDOWN_MS) {
            lastShake = now
            peaks.clear()
            onShake()
        }
    }

    override fun onAccuracyChanged(sensor: Sensor?, accuracy: Int) {}

    private companion object {
        const val THRESHOLD_G = 2.3f
        const val WINDOW_MS = 500L
        const val PEAKS_FOR_SHAKE = 2
        const val COOLDOWN_MS = 1500L
    }
}
