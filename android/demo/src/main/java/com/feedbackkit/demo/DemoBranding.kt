package com.feedbackkit.demo

import android.content.Context
import androidx.compose.ui.graphics.Color
import com.feedbackkit.FeedbackTheme

/**
 * The brand presets in Settings > Branding — showcases `FeedbackKit.theme`.
 * Same presets and storage key as the iOS demo's `DemoBranding`.
 */
enum class DemoBranding(val displayName: String, val theme: FeedbackTheme?) {
    SYSTEM("System Blue", null),
    SUNSET("Sunset", FeedbackTheme("#7C3AED", "#F97316")),
    OCEAN("Ocean", FeedbackTheme("#0EA5E9", "#14B8A6")),
    FOREST("Forest", FeedbackTheme("#16A34A", "#CA8A04"));

    val primarySwatch: Color get() = theme?.let { hex(it.primaryColorHex) } ?: Color(0xFF007AFF)
    val secondarySwatch: Color get() = theme?.let { hex(it.secondaryColorHex) } ?: Color.Gray

    companion object {
        private const val STORAGE_KEY = "com.feedbackkit.demo.branding"

        fun current(context: Context): DemoBranding {
            val saved = context.getSharedPreferences("demo", Context.MODE_PRIVATE).getString(STORAGE_KEY, null)
            return entries.firstOrNull { it.name.equals(saved, ignoreCase = true) } ?: SUNSET
        }

        fun save(context: Context, branding: DemoBranding) {
            context.getSharedPreferences("demo", Context.MODE_PRIVATE).edit().putString(STORAGE_KEY, branding.name.lowercase()).apply()
        }

        private fun hex(value: String) = Color(android.graphics.Color.parseColor(value))
    }
}
