package com.feedbackkit.demo

import androidx.compose.runtime.mutableStateListOf
import androidx.compose.ui.graphics.Color

/**
 * Shared cart state, so "Add" on the Compose Home screen shows up on the
 * classic-View Cart screen (and removals go the other way) — one source of
 * truth both screens observe, like the iOS demo's `CartStore`. Compose reads
 * the snapshot list directly; the View screen registers a listener.
 */
object CartStore {
    data class Item(val name: String, val price: Double, val quantity: Int, val tint: Color)

    val items = mutableStateListOf(
        Item("Wireless Headphones", 59.99, 1, Color(0xFF8E44AD)),
        Item("Canvas Tote Bag", 24.99, 2, Color(0xFF2E9E5B)),
        Item("Classic T-Shirt", 19.99, 1, Color(0xFFF07A1A)),
    )

    private val listeners = mutableListOf<() -> Unit>()

    val subtotal: Double get() = items.sumOf { it.price * it.quantity }
    val count: Int get() = items.size

    /** Adds one of [name], bumping the quantity if it's already in the cart. */
    fun add(name: String, price: Double, tint: Color) {
        val index = items.indexOfFirst { it.name == name }
        if (index >= 0) items[index] = items[index].copy(quantity = items[index].quantity + 1)
        else items.add(Item(name, price, 1, tint))
        notifyListeners()
    }

    fun remove(index: Int) {
        if (index in items.indices) items.removeAt(index)
        notifyListeners()
    }

    fun addListener(listener: () -> Unit) { listeners += listener }
    fun removeListener(listener: () -> Unit) { listeners -= listener }
    private fun notifyListeners() = listeners.toList().forEach { it() }
}
