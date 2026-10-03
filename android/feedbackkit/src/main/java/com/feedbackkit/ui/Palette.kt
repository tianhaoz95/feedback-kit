package com.feedbackkit.ui

import android.content.Context
import android.content.res.Configuration
import android.graphics.Color
import android.util.TypedValue
import com.feedbackkit.FeedbackTheme

/**
 * The editor's colors, resolved for light or dark mode — the Android stand-in
 * for UIKit's semantic colors (`.systemBackground`, `.secondaryLabel`, …).
 */
internal class Palette(context: Context, theme: FeedbackTheme?) {
    val isDark = (context.resources.configuration.uiMode and Configuration.UI_MODE_NIGHT_MASK) == Configuration.UI_MODE_NIGHT_YES

    val background = if (isDark) Color.BLACK else Color.WHITE
    val secondaryBackground = if (isDark) Color.rgb(28, 28, 30) else Color.rgb(242, 242, 247)
    val label = if (isDark) Color.WHITE else Color.BLACK
    val secondaryLabel = if (isDark) Color.argb(153, 235, 235, 245) else Color.argb(153, 60, 60, 67)
    val placeholder = if (isDark) Color.argb(76, 235, 235, 245) else Color.argb(76, 60, 60, 67)
    val separator = if (isDark) Color.argb(153, 84, 84, 88) else Color.argb(73, 60, 60, 67)

    /** iOS's `.systemBlue` — the default when no theme is set, same as the Swift SDK. */
    private val systemBlue = if (isDark) Color.rgb(10, 132, 255) else Color.rgb(0, 122, 255)

    /** Send button, selected tool, selected product chips. */
    val primary = theme?.primaryColorHex?.let(::parseHexColor) ?: systemBlue

    /** Cancel. Falls back to the system blue, like UIKit's default button tint. */
    val secondary = theme?.secondaryColorHex?.let(::parseHexColor) ?: systemBlue

    /** The attach button, which defaults to a quieter gray when unthemed (as on iOS). */
    val attach = theme?.secondaryColorHex?.let(::parseHexColor) ?: secondaryLabel

    private val density = context.resources.displayMetrics.density
    fun dp(value: Float): Float = value * density
    fun dp(value: Int): Int = (value * density + 0.5f).toInt()
    fun sp(value: Float, context: Context): Float =
        TypedValue.applyDimension(TypedValue.COMPLEX_UNIT_SP, value, context.resources.displayMetrics)
}

/** `#RRGGBB` / `RRGGBB` → opaque ARGB int, or null. Same accepted forms as the Swift SDK's `PlatformColor(hex:)`. */
internal fun parseHexColor(hex: String): Int? {
    val s = hex.trim().replace("#", "")
    if (s.length != 6) return null
    val value = s.toLongOrNull(16) ?: return null
    return (0xFF000000 or value).toInt()
}

/** ARGB → `#RRGGBB`, the format annotations carry on the wire. */
internal fun hexString(color: Int): String =
    String.format(java.util.Locale.US, "#%02X%02X%02X", Color.red(color), Color.green(color), Color.blue(color))

internal fun withAlpha(color: Int, alpha: Float): Int =
    Color.argb((alpha * 255).toInt().coerceIn(0, 255), Color.red(color), Color.green(color), Color.blue(color))
