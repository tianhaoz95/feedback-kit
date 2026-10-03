package com.feedbackkit.demo

import android.annotation.SuppressLint
import android.app.AlertDialog
import android.content.Context
import android.content.res.Configuration
import android.graphics.Color
import android.graphics.Typeface
import android.graphics.drawable.GradientDrawable
import android.util.TypedValue
import android.view.Gravity
import android.view.View
import android.view.ViewGroup
import android.widget.BaseAdapter
import android.widget.Button
import android.widget.FrameLayout
import android.widget.ImageButton
import android.widget.LinearLayout
import android.widget.ListView
import android.widget.TextView
import androidx.compose.ui.graphics.toArgb
import com.feedbackkit.FeedbackKit

/**
 * A classic Android View screen (no Compose) — the counterpart of the iOS
 * demo's UIKit `CartViewController`. Reads and writes the same [CartStore]
 * as the Compose Home screen.
 */
@SuppressLint("ViewConstructor")
class CartView(context: Context) : LinearLayout(context) {
    private val dark = (resources.configuration.uiMode and Configuration.UI_MODE_NIGHT_MASK) == Configuration.UI_MODE_NIGHT_YES
    private val labelColor = if (dark) Color.WHITE else Color.BLACK
    private val secondaryColor = if (dark) Color.LTGRAY else Color.DKGRAY
    private val density = resources.displayMetrics.density
    private fun dp(v: Int) = (v * density).toInt()

    private val list = ListView(context)
    private val subtotal = TextView(context)
    private val empty = TextView(context)
    private val adapter = CartAdapter()
    private val listener: () -> Unit = { refresh() }

    init {
        orientation = VERTICAL
        setBackgroundColor(if (dark) Color.BLACK else Color.WHITE)

        val header = FrameLayout(context).apply { setPadding(dp(16), dp(12), dp(8), dp(4)) }
        header.addView(TextView(context).apply {
            text = "Cart"
            setTextSize(TypedValue.COMPLEX_UNIT_SP, 32f)
            typeface = Typeface.DEFAULT_BOLD
            setTextColor(labelColor)
        }, FrameLayout.LayoutParams(ViewGroup.LayoutParams.WRAP_CONTENT, ViewGroup.LayoutParams.WRAP_CONTENT, Gravity.START or Gravity.CENTER_VERTICAL))
        header.addView(ImageButton(context).apply {
            setImageResource(android.R.drawable.ic_menu_info_details)
            background = null
            contentDescription = "About this screen"
            setOnClickListener { showAbout() }
        }, FrameLayout.LayoutParams(dp(48), dp(48), Gravity.END or Gravity.CENTER_VERTICAL))
        addView(header)

        val body = FrameLayout(context)
        list.adapter = adapter
        list.divider = GradientDrawable().apply { setColor(if (dark) 0x33FFFFFF else 0x22000000) }
        list.dividerHeight = 1
        body.addView(list)
        empty.apply {
            text = "Your cart is empty.\nAdd something from Home to see it here."
            gravity = Gravity.CENTER
            setTextColor(secondaryColor)
            setTextSize(TypedValue.COMPLEX_UNIT_SP, 16f)
        }
        body.addView(empty, FrameLayout.LayoutParams(ViewGroup.LayoutParams.MATCH_PARENT, ViewGroup.LayoutParams.MATCH_PARENT))
        addView(body, LayoutParams(ViewGroup.LayoutParams.MATCH_PARENT, 0, 1f))

        val footer = LinearLayout(context).apply {
            orientation = VERTICAL
            setPadding(dp(16), dp(8), dp(16), dp(16))
        }
        subtotal.apply {
            setTextSize(TypedValue.COMPLEX_UNIT_SP, 18f)
            typeface = Typeface.DEFAULT_BOLD
            setTextColor(labelColor)
        }
        footer.addView(subtotal)
        footer.addView(Button(context).apply {
            text = "Report a Problem"
            isAllCaps = false
            setTextColor(Color.WHITE)
            background = GradientDrawable().apply {
                setColor(0xFF7C3AED.toInt())
                cornerRadius = dp(12).toFloat()
            }
            setOnClickListener { FeedbackKit.presentAndSubmitIfConfigured() }
        }, LayoutParams(ViewGroup.LayoutParams.MATCH_PARENT, dp(48)).apply { topMargin = dp(12) })
        addView(footer)
        refresh()
    }

    override fun onAttachedToWindow() {
        super.onAttachedToWindow()
        CartStore.addListener(listener)
        refresh()
    }

    override fun onDetachedFromWindow() {
        CartStore.removeListener(listener)
        super.onDetachedFromWindow()
    }

    private fun refresh() {
        adapter.notifyDataSetChanged()
        subtotal.text = "Subtotal: ${formatPrice(CartStore.subtotal)}"
        empty.visibility = if (CartStore.items.isEmpty()) View.VISIBLE else View.GONE
    }

    private fun showAbout() {
        AlertDialog.Builder(context)
            .setTitle("About this screen")
            .setMessage("This Cart screen is built with classic Android Views, while Home is Jetpack Compose. FeedbackKit captures the whole window either way, so reporting from here works exactly the same.")
            .setPositiveButton("Got it", null)
            .show()
    }

    private inner class CartAdapter : BaseAdapter() {
        override fun getCount() = CartStore.items.size
        override fun getItem(position: Int) = CartStore.items[position]
        override fun getItemId(position: Int) = position.toLong()

        override fun getView(position: Int, convertView: View?, parent: ViewGroup?): View {
            val item = getItem(position)
            return LinearLayout(context).apply {
                orientation = HORIZONTAL
                gravity = Gravity.CENTER_VERTICAL
                setPadding(dp(16), dp(12), dp(8), dp(12))
                addView(View(context).apply {
                    background = GradientDrawable().apply {
                        setColor(item.tint.toArgb())
                        cornerRadius = dp(8).toFloat()
                    }
                }, LayoutParams(dp(40), dp(40)))
                addView(LinearLayout(context).apply {
                    orientation = VERTICAL
                    setPadding(dp(12), 0, 0, 0)
                    addView(TextView(context).apply {
                        text = item.name
                        setTextSize(TypedValue.COMPLEX_UNIT_SP, 17f)
                        setTextColor(labelColor)
                    })
                    addView(TextView(context).apply {
                        text = "Qty ${item.quantity} × ${formatPrice(item.price)}"
                        setTextColor(secondaryColor)
                    })
                }, LayoutParams(0, ViewGroup.LayoutParams.WRAP_CONTENT, 1f))
                addView(ImageButton(context).apply {
                    setImageResource(android.R.drawable.ic_menu_delete)
                    background = null
                    contentDescription = "Remove ${item.name}"
                    setOnClickListener { CartStore.remove(position) }
                }, LayoutParams(dp(48), dp(48)))
            }
        }
    }
}
