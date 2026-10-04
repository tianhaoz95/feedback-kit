package com.feedbackkit.ui

import android.app.Activity
import android.app.Dialog
import android.graphics.BitmapFactory
import android.graphics.Typeface
import android.graphics.drawable.ColorDrawable
import android.graphics.drawable.GradientDrawable
import android.text.InputType
import android.util.TypedValue
import android.view.Gravity
import android.view.View
import android.view.ViewGroup
import android.view.Window
import android.widget.Button
import android.widget.EditText
import android.widget.ImageView
import android.widget.LinearLayout
import android.widget.ScrollView
import android.widget.TextView
import com.feedbackkit.FixUpdate
import com.feedbackkit.internal.Http

/**
 * The "is it fixed?" / "a question about your report" card — the Android
 * counterpart of the iOS `FixVerificationView` sheet: the original annotated
 * screenshot, what the reporter wrote, what changed, recent messages, then
 * Yes, it's fixed / No, still broken / Remind me later (or a reply box).
 */
internal class FixVerificationDialog(
    private val activity: Activity,
    private val update: FixUpdate,
    private val palette: Palette,
    private val onOutcome: (Outcome) -> Unit,
) {
    sealed class Outcome {
        object Verified : Outcome()
        /** Still broken; with text if typed inline, null to run the capture flow. */
        class StillBroken(val inlineText: String?) : Outcome()
        class Replied(val text: String) : Outcome()
        object Later : Outcome()
    }

    private val dialog = Dialog(activity)
    private var finished = false

    fun show() {
        dialog.requestWindowFeature(Window.FEATURE_NO_TITLE)
        dialog.setContentView(content())
        dialog.window?.setBackgroundDrawable(ColorDrawable(android.graphics.Color.TRANSPARENT))
        dialog.window?.setLayout(
            (activity.resources.displayMetrics.widthPixels * 0.92f).toInt(),
            ViewGroup.LayoutParams.WRAP_CONTENT,
        )
        dialog.setOnCancelListener { finish(Outcome.Later) }
        dialog.show()
    }

    private fun finish(outcome: Outcome) {
        if (finished) return
        finished = true
        dialog.setOnCancelListener(null)
        if (dialog.isShowing) dialog.dismiss()
        onOutcome(outcome)
    }

    private fun content(): View {
        val column = LinearLayout(activity).apply {
            orientation = LinearLayout.VERTICAL
            setPadding(palette.dp(20), palette.dp(20), palette.dp(20), palette.dp(16))
        }
        val title = if (update.needsVerification) "We fixed something you reported" else "A question about your report"
        column.addView(text(title, 19f, palette.label, bold = true))
        if (update.needsVerification) {
            update.fixedInBuild?.let { column.addView(text("Fixed in build $it — the one you're using now.", 14f, palette.secondaryLabel), spaced(4)) }
        }

        update.screenshotUrl?.let { url ->
            val image = ImageView(activity).apply {
                adjustViewBounds = true
                scaleType = ImageView.ScaleType.FIT_CENTER
                maxHeight = palette.dp(260)
                visibility = View.GONE
            }
            column.addView(image, spaced(12).apply { gravity = Gravity.CENTER_HORIZONTAL })
            Http.executor.execute {
                val bytes = Http.download(url)
                val bitmap = bytes?.let { BitmapFactory.decodeByteArray(it, 0, it.size) }
                activity.runOnUiThread {
                    if (bitmap != null) {
                        image.setImageBitmap(bitmap)
                        image.visibility = View.VISIBLE
                    }
                }
            }
        }

        column.addView(text("You reported", 13f, palette.secondaryLabel), spaced(12))
        column.addView(text(if (update.text.isEmpty()) "(no description)" else "“${update.text}”", 15f, palette.label), spaced(2))
        update.fixSummary?.let { column.addView(text("What changed: $it", 15f, palette.label), spaced(8)) }

        update.messages.takeLast(3).forEach { message ->
            val bubble = LinearLayout(activity).apply {
                orientation = LinearLayout.VERTICAL
                setPadding(palette.dp(10), palette.dp(8), palette.dp(10), palette.dp(8))
                background = GradientDrawable().apply {
                    setColor(palette.secondaryBackground)
                    cornerRadius = palette.dp(10f)
                }
                addView(text(message.author, 12f, palette.secondaryLabel))
                addView(text(message.body, 14f, palette.label))
            }
            column.addView(bubble, spaced(8))
        }

        val question = update.openQuestion
        if (update.needsVerification) {
            addVerificationButtons(column)
        } else if (question != null) {
            column.addView(text(question.body, 16f, palette.label, bold = true), spaced(14))
            val reply = input("Your answer")
            column.addView(reply, spaced(8))
            column.addView(primaryButton("Send") {
                val value = reply.text.toString().trim()
                if (value.isNotEmpty()) finish(Outcome.Replied(value))
            }, spaced(10))
            column.addView(plainButton("Not now") { finish(Outcome.Later) })
        }

        return ScrollView(activity).apply {
            background = GradientDrawable().apply {
                setColor(palette.background)
                cornerRadius = palette.dp(20f)
            }
            addView(column)
        }
    }

    private fun addVerificationButtons(column: LinearLayout) {
        val buttons = LinearLayout(activity).apply { orientation = LinearLayout.VERTICAL }
        buttons.addView(primaryButton("Yes, it's fixed") { finish(Outcome.Verified) })
        buttons.addView(plainButton("No, still broken") {
            // Show what's still wrong with a fresh screenshot (the default), or just say it.
            buttons.removeAllViews()
            buttons.addView(text("What's still wrong?", 14f, palette.label))
            val field = input("Describe what's still wrong")
            buttons.addView(field, spaced(6))
            buttons.addView(primaryButton("Send") {
                val value = field.text.toString().trim()
                if (value.isNotEmpty()) finish(Outcome.StillBroken(value))
            }, spaced(10))
            buttons.addView(plainButton("Show me with a screenshot instead") { finish(Outcome.StillBroken(null)) })
        }, spaced(6))
        buttons.addView(plainButton("Remind me later") { finish(Outcome.Later) })
        column.addView(buttons, spaced(16))
    }

    private fun text(value: String, sizeSp: Float, color: Int, bold: Boolean = false) = TextView(activity).apply {
        text = value
        setTextColor(color)
        setTextSize(TypedValue.COMPLEX_UNIT_SP, sizeSp)
        if (bold) typeface = Typeface.DEFAULT_BOLD
    }

    private fun input(hintText: String) = EditText(activity).apply {
        hint = hintText
        setTextColor(palette.label)
        setHintTextColor(palette.placeholder)
        inputType = InputType.TYPE_CLASS_TEXT or InputType.TYPE_TEXT_FLAG_MULTI_LINE or InputType.TYPE_TEXT_FLAG_CAP_SENTENCES
        maxLines = 4
    }

    private fun primaryButton(title: String, action: () -> Unit) = Button(activity).apply {
        text = title
        isAllCaps = false
        setTextColor(android.graphics.Color.WHITE)
        background = GradientDrawable().apply {
            setColor(palette.primary)
            cornerRadius = palette.dp(12f)
        }
        setOnClickListener { action() }
    }

    private fun plainButton(title: String, action: () -> Unit) = Button(activity).apply {
        text = title
        isAllCaps = false
        setTextColor(palette.primary)
        background = null
        setOnClickListener { action() }
    }

    private fun spaced(topDp: Int) = LinearLayout.LayoutParams(
        ViewGroup.LayoutParams.MATCH_PARENT,
        ViewGroup.LayoutParams.WRAP_CONTENT,
    ).apply { topMargin = palette.dp(topDp) }
}
