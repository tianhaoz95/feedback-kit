package com.feedbackkit.demo

import android.util.Log
import android.view.HapticFeedbackConstants
import androidx.compose.foundation.background
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.layout.widthIn
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.foundation.verticalScroll
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.filled.Add
import androidx.compose.material.icons.filled.Check
import androidx.compose.material.icons.filled.Checkroom
import androidx.compose.material.icons.filled.Headphones
import androidx.compose.material.icons.filled.ShoppingBag
import androidx.compose.material.icons.outlined.Feedback
import androidx.compose.material3.Button
import androidx.compose.material3.ButtonDefaults
import androidx.compose.material3.Card
import androidx.compose.material3.CardDefaults
import androidx.compose.material3.Icon
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.OutlinedButton
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.setValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.graphics.vector.ImageVector
import androidx.compose.ui.platform.LocalView
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.dp
import com.feedbackkit.FeedbackKit
import com.feedbackkit.FeedbackSubmissionResult
import kotlinx.coroutines.delay
import java.text.NumberFormat
import java.util.Locale

private data class Product(val name: String, val price: Double, val icon: ImageVector, val tint: Color)

// What's available to browse. "Add" feeds CartStore, so it actually shows up on the Cart tab.
private val catalog = listOf(
    Product("Wireless Headphones", 59.99, Icons.Filled.Headphones, Color(0xFF8E44AD)),
    Product("Canvas Tote Bag", 24.99, Icons.Filled.ShoppingBag, Color(0xFF2E9E5B)),
    Product("Classic T-Shirt", 19.99, Icons.Filled.Checkroom, Color(0xFFF07A1A)),
)

internal fun formatPrice(value: Double): String = NumberFormat.getCurrencyInstance(Locale.US).format(value)

/** A Jetpack Compose screen — the counterpart of the iOS demo's SwiftUI `HomeView`. */
@Composable
fun HomeScreen(modifier: Modifier = Modifier) {
    Column(
        modifier = modifier.verticalScroll(rememberScrollState()).padding(16.dp),
        verticalArrangement = Arrangement.spacedBy(16.dp),
    ) {
        Text("FeedbackKit Demo", style = MaterialTheme.typography.labelLarge, color = MaterialTheme.colorScheme.primary)
        Column(verticalArrangement = Arrangement.spacedBy(4.dp)) {
            Text("Welcome back", style = MaterialTheme.typography.headlineLarge, fontWeight = FontWeight.Bold)
            Text(
                "Sample screen for exercising FeedbackKit. Shake the device (emulator: Extended controls → Virtual sensors → Move) or tap the floating button to report an issue with whatever's on screen.",
                style = MaterialTheme.typography.bodyMedium,
                color = MaterialTheme.colorScheme.onSurfaceVariant,
            )
        }
        catalog.forEach { ProductCard(it) }
        Button(onClick = ::reportProblem, modifier = Modifier.fillMaxWidth().padding(top = 8.dp)) {
            Icon(Icons.Outlined.Feedback, contentDescription = null)
            Spacer(Modifier.size(8.dp))
            Text("Report a Problem")
        }
    }
}

private fun reportProblem() {
    FeedbackKit.presentAndSubmitIfConfigured { result ->
        when (result) {
            null -> Unit
            is FeedbackSubmissionResult.Success -> Log.i("FeedbackKitDemo", "captured report ${result.report.id} — \"${result.report.text}\"")
            is FeedbackSubmissionResult.Failure -> Log.w("FeedbackKitDemo", "report failed: ${result.error.message}")
        }
    }
}

@Composable
private fun ProductCard(product: Product) {
    var justAdded by remember { mutableStateOf(false) }
    val view = LocalView.current
    LaunchedEffect(justAdded) {
        if (justAdded) {
            delay(1200)
            justAdded = false
        }
    }
    Card(
        shape = RoundedCornerShape(12.dp),
        colors = CardDefaults.cardColors(containerColor = MaterialTheme.colorScheme.surfaceVariant.copy(alpha = 0.5f)),
        elevation = CardDefaults.cardElevation(defaultElevation = 2.dp),
    ) {
        Row(Modifier.padding(16.dp), verticalAlignment = Alignment.CenterVertically) {
            Box(
                Modifier.size(56.dp).background(product.tint.copy(alpha = 0.15f), RoundedCornerShape(8.dp)),
                contentAlignment = Alignment.Center,
            ) {
                Icon(product.icon, contentDescription = null, tint = product.tint)
            }
            Column(Modifier.weight(1f).padding(horizontal = 12.dp)) {
                Text(product.name, style = MaterialTheme.typography.titleMedium)
                Text(formatPrice(product.price), color = MaterialTheme.colorScheme.onSurfaceVariant)
            }
            OutlinedButton(
                onClick = {
                    CartStore.add(product.name, product.price, product.tint)
                    view.performHapticFeedback(HapticFeedbackConstants.CONFIRM)
                    justAdded = true
                },
                enabled = !justAdded,
                colors = ButtonDefaults.outlinedButtonColors(contentColor = if (justAdded) Color(0xFF2E9E5B) else product.tint),
                modifier = Modifier.widthIn(min = 92.dp),
            ) {
                Icon(if (justAdded) Icons.Filled.Check else Icons.Filled.Add, contentDescription = null, modifier = Modifier.size(18.dp))
                Spacer(Modifier.size(4.dp))
                Text(if (justAdded) "Added" else "Add")
            }
        }
    }
}
