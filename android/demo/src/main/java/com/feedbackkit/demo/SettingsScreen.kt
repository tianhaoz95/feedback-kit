package com.feedbackkit.demo

import android.content.ClipboardManager
import android.content.Context
import androidx.compose.foundation.background
import androidx.compose.foundation.clickable
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.shape.CircleShape
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.foundation.verticalScroll
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.filled.ContentPaste
import androidx.compose.material.icons.filled.Send
import androidx.compose.material3.Card
import androidx.compose.material3.FilledTonalButton
import androidx.compose.material3.Icon
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.OutlinedTextField
import androidx.compose.material3.RadioButton
import androidx.compose.material3.Text
import androidx.compose.material3.TextButton
import androidx.compose.runtime.Composable
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.setValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.platform.LocalContext
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.dp
import com.feedbackkit.FeedbackKit

/** Same sections as the iOS demo's `SettingsView`. */
@Composable
fun SettingsScreen(modifier: Modifier = Modifier) {
    val context = LocalContext.current
    var branding by remember { mutableStateOf(DemoBranding.current(context)) }

    Column(
        modifier = modifier.verticalScroll(rememberScrollState()).padding(16.dp),
        verticalArrangement = Arrangement.spacedBy(20.dp),
    ) {
        Text("Settings", style = MaterialTheme.typography.headlineLarge, fontWeight = FontWeight.Bold)

        Section("Web Portal Connection", footer = "Paste your Project Key from your FeedbackKit web dashboard (Project Settings → SDK setup). When configured, all reports from shake, floating button, or Report a Problem will be submitted straight to your project.") {
            Row(verticalAlignment = Alignment.CenterVertically) {
                Box(Modifier.size(10.dp).background(if (DemoSettings.isConfigured) Color(0xFF34C759) else Color(0xFFFF9500), CircleShape))
                Spacer(Modifier.size(8.dp))
                Text(if (DemoSettings.isConfigured) "Connected to Portal" else "Local Demo Mode", fontWeight = FontWeight.SemiBold)
                Spacer(Modifier.weight(1f))
                Text(if (DemoSettings.isConfigured) "Live Submission" else "Unconfigured", color = MaterialTheme.colorScheme.onSurfaceVariant)
            }
            OutlinedTextField(
                value = DemoSettings.apiKey,
                onValueChange = DemoSettings::updateApiKey,
                label = { Text("Project API Key") },
                placeholder = { Text("pk_…") },
                singleLine = true,
                modifier = Modifier.fillMaxWidth(),
            )
            Row(horizontalArrangement = Arrangement.spacedBy(8.dp)) {
                FilledTonalButton(onClick = {
                    val clipboard = context.getSystemService(Context.CLIPBOARD_SERVICE) as ClipboardManager
                    clipboard.primaryClip?.getItemAt(0)?.text?.toString()?.trim()?.let(DemoSettings::updateApiKey)
                }) {
                    Icon(Icons.Filled.ContentPaste, null, Modifier.size(18.dp))
                    Spacer(Modifier.size(6.dp))
                    Text("Paste Key")
                }
                FilledTonalButton(onClick = { FeedbackKit.presentAndSubmitIfConfigured() }) {
                    Icon(Icons.Filled.Send, null, Modifier.size(18.dp))
                    Spacer(Modifier.size(6.dp))
                    Text("Test Feedback Flow")
                }
            }
            if (DemoSettings.isConfigured) {
                TextButton(onClick = { DemoSettings.updateApiKey("") }) { Text("Clear Key") }
            }
        }

        Section("Custom Ingestion Endpoint", footer = "Defaults to the official FeedbackKit hosted endpoint. Only change this if you are running your own local or self-hosted backend (from the emulator, a local Supabase is http://10.0.2.2:54321/functions/v1/ingest-feedback).") {
            OutlinedTextField(
                value = DemoSettings.endpointUrl,
                onValueChange = DemoSettings::updateEndpoint,
                label = { Text("Ingestion Endpoint URL") },
                modifier = Modifier.fillMaxWidth(),
            )
            if (DemoSettings.endpointUrl.trim() != DemoSettings.DEFAULT_ENDPOINT) {
                TextButton(onClick = { DemoSettings.updateEndpoint(DemoSettings.DEFAULT_ENDPOINT) }) { Text("Reset to Default Endpoint") }
            }
        }

        Section("Branding", footer = null) {
            Text(
                "FeedbackKit.theme customizes the feedback screen's accent colors. The send button, selected annotation tool and product chips switch to the primary color; Cancel and the attach button switch to the secondary color. Takes effect immediately.",
                style = MaterialTheme.typography.bodySmall,
                color = MaterialTheme.colorScheme.onSurfaceVariant,
            )
            DemoBranding.entries.forEach { option ->
                Row(
                    Modifier.fillMaxWidth().clickable {
                        branding = option
                        DemoBranding.save(context, option)
                        FeedbackKit.theme = option.theme
                    },
                    verticalAlignment = Alignment.CenterVertically,
                ) {
                    RadioButton(selected = branding == option, onClick = null)
                    Spacer(Modifier.size(8.dp))
                    Text(option.displayName, Modifier.weight(1f))
                    Box(Modifier.size(18.dp).background(option.primarySwatch, CircleShape))
                    Spacer(Modifier.size(4.dp))
                    Box(Modifier.size(18.dp).background(option.secondarySwatch, CircleShape))
                }
            }
        }

        Section("Triggers wired up in this demo", footer = null) {
            Text("• Shake the device (emulator: Virtual sensors → Move)")
            Text("• Tap the floating blue button")
            Text("• \"Report a Problem\" on Home and Cart, or Test Feedback Flow above")
        }

        Section("Version", footer = null) {
            val info = context.packageManager.getPackageInfo(context.packageName, 0)
            Text("${info.versionName} (${info.longVersionCodeCompat()})", color = MaterialTheme.colorScheme.onSurfaceVariant)
        }
    }
}

@Suppress("DEPRECATION")
private fun android.content.pm.PackageInfo.longVersionCodeCompat(): Long =
    if (android.os.Build.VERSION.SDK_INT >= 28) longVersionCode else versionCode.toLong()

@Composable
private fun Section(title: String, footer: String?, content: @Composable () -> Unit) {
    Column(verticalArrangement = Arrangement.spacedBy(6.dp)) {
        Text(title.uppercase(), style = MaterialTheme.typography.labelMedium, color = MaterialTheme.colorScheme.onSurfaceVariant)
        Card(shape = RoundedCornerShape(12.dp)) {
            Column(Modifier.padding(14.dp), verticalArrangement = Arrangement.spacedBy(10.dp)) { content() }
        }
        if (footer != null) {
            Text(footer, style = MaterialTheme.typography.bodySmall, color = MaterialTheme.colorScheme.onSurfaceVariant)
        }
    }
}
