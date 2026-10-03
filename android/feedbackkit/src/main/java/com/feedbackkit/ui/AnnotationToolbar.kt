package com.feedbackkit.ui

import android.annotation.SuppressLint
import android.content.Context
import android.graphics.Color
import android.graphics.drawable.GradientDrawable
import android.view.Gravity
import android.view.View
import android.widget.ImageButton
import android.widget.LinearLayout
import com.feedbackkit.R

/**
 * The tool/color/undo rail beside the screenshot — a narrow vertical column,
 * like the iOS editor's, so a portrait screenshot keeps the full height.
 */
@SuppressLint("ViewConstructor")
internal class AnnotationToolbar(context: Context, private val palette: Palette) : LinearLayout(context) {
    var onToolSelected: ((AnnotationCanvasView.Tool) -> Unit)? = null
    var onColorSelected: ((Int) -> Unit)? = null
    var onUndo: (() -> Unit)? = null

    private val tools = listOf(
        Triple(AnnotationCanvasView.Tool.PEN, R.drawable.fk_ic_pen, "Pen"),
        Triple(AnnotationCanvasView.Tool.RECTANGLE, R.drawable.fk_ic_rectangle, "Rectangle"),
        Triple(AnnotationCanvasView.Tool.ARROW, R.drawable.fk_ic_arrow, "Arrow"),
        Triple(AnnotationCanvasView.Tool.TEXT, R.drawable.fk_ic_text, "Text"),
        Triple(AnnotationCanvasView.Tool.MOVE, R.drawable.fk_ic_move, "Move"),
    )

    /** The iOS system palette the Swift toolbar offers, plus "label" (black, or white in dark mode). */
    private val colors = listOf(
        Color.rgb(255, 59, 48) to "Red",
        Color.rgb(255, 204, 0) to "Yellow",
        Color.rgb(52, 199, 89) to "Green",
        Color.rgb(0, 122, 255) to "Blue",
        palette.label to "Black",
    )

    private val toolButtons = mutableListOf<ImageButton>()
    var selectedTool = AnnotationCanvasView.Tool.PEN
        private set

    init {
        orientation = VERTICAL
        gravity = Gravity.CENTER_HORIZONTAL
        background = GradientDrawable().apply {
            setColor(palette.secondaryBackground)
            cornerRadius = palette.dp(12f)
        }
        setPadding(0, palette.dp(10), 0, palette.dp(10))

        tools.forEach { (tool, icon, name) ->
            val button = iconButton(icon, name)
            button.setOnClickListener {
                selectedTool = tool
                highlight()
                onToolSelected?.invoke(tool)
            }
            toolButtons += button
            addView(button, LayoutParams(palette.dp(44), palette.dp(40)))
        }
        highlight()

        addView(spacer(), LayoutParams(1, 0, 1f))

        colors.forEach { (color, name) ->
            val swatch = View(context).apply {
                contentDescription = "$name color"
                background = GradientDrawable().apply {
                    shape = GradientDrawable.OVAL
                    setColor(color)
                    setStroke(palette.dp(1), palette.separator)
                }
                setOnClickListener { onColorSelected?.invoke(color) }
            }
            addView(swatch, LayoutParams(palette.dp(24), palette.dp(24)).apply { topMargin = palette.dp(8) })
        }

        addView(spacer(), LayoutParams(1, 0, 1f))

        val undo = iconButton(R.drawable.fk_ic_undo, "Undo").apply {
            setColorFilter(palette.label)
            setOnClickListener { onUndo?.invoke() }
        }
        addView(undo, LayoutParams(palette.dp(44), palette.dp(40)))
    }

    private fun iconButton(icon: Int, name: String) = ImageButton(context).apply {
        setImageResource(icon)
        contentDescription = name
        background = null
        scaleType = android.widget.ImageView.ScaleType.CENTER
    }

    private fun spacer() = View(context).apply { minimumHeight = palette.dp(8) }

    private fun highlight() {
        toolButtons.forEachIndexed { i, button ->
            val selected = tools[i].first == selectedTool
            button.setColorFilter(if (selected) palette.primary else palette.label)
            button.isSelected = selected
        }
    }
}
