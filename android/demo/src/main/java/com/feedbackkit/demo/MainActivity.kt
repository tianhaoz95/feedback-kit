package com.feedbackkit.demo

import android.app.Activity
import android.os.Bundle
import androidx.activity.ComponentActivity
import androidx.activity.compose.setContent
import androidx.activity.enableEdgeToEdge
import androidx.compose.foundation.isSystemInDarkTheme
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.padding
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.filled.Home
import androidx.compose.material.icons.filled.Settings
import androidx.compose.material.icons.filled.ShoppingCart
import androidx.compose.material3.Badge
import androidx.compose.material3.BadgedBox
import androidx.compose.material3.Icon
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.NavigationBar
import androidx.compose.material3.NavigationBarItem
import androidx.compose.material3.Scaffold
import androidx.compose.material3.Text
import androidx.compose.material3.darkColorScheme
import androidx.compose.material3.lightColorScheme
import androidx.compose.runtime.Composable
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableIntStateOf
import androidx.compose.runtime.saveable.rememberSaveable
import androidx.compose.runtime.setValue
import androidx.compose.ui.Modifier
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.viewinterop.AndroidView
import com.feedbackkit.FeedbackKit
import java.lang.ref.WeakReference

class MainActivity : ComponentActivity() {
    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        enableEdgeToEdge()
        setContent { DemoApp() }
    }

    override fun onResume() {
        super.onResume()
        currentRef = WeakReference(this)
    }

    companion object {
        private var currentRef: WeakReference<Activity>? = null
        val current: Activity? get() = currentRef?.get()?.takeUnless { it.isFinishing }
    }
}

private enum class Tab(val title: String) { HOME("Home"), CART("Cart"), SETTINGS("Settings") }

@Composable
private fun DemoApp() {
    val colors = if (isSystemInDarkTheme()) {
        darkColorScheme(primary = Color(0xFFA78BFA))
    } else {
        lightColorScheme(primary = Color(0xFF7C3AED))
    }
    MaterialTheme(colorScheme = colors) {
        var selected by rememberSaveable { mutableIntStateOf(0) }
        val tab = Tab.entries[selected]
        // Keep reports labelled with where they came from — one activity hosts
        // every screen here, so the activity name alone wouldn't say.
        LaunchedEffect(tab) { FeedbackKit.currentScreen = tab.title }

        Scaffold(
            bottomBar = {
                NavigationBar {
                    Tab.entries.forEachIndexed { index, item ->
                        NavigationBarItem(
                            selected = index == selected,
                            onClick = { selected = index },
                            label = { Text(item.title) },
                            icon = {
                                when (item) {
                                    Tab.HOME -> Icon(Icons.Filled.Home, null)
                                    Tab.CART -> BadgedBox(badge = {
                                        if (CartStore.items.isNotEmpty()) Badge { Text("${CartStore.items.size}") }
                                    }) { Icon(Icons.Filled.ShoppingCart, null) }
                                    Tab.SETTINGS -> Icon(Icons.Filled.Settings, null)
                                }
                            },
                        )
                    }
                }
            },
        ) { padding ->
            val modifier = Modifier.fillMaxSize().padding(padding)
            when (tab) {
                Tab.HOME -> HomeScreen(modifier)
                // A classic View screen inside the Compose app, to show capture is
                // window-level: FeedbackKit never needs to know which toolkit drew it.
                Tab.CART -> AndroidView(factory = { CartView(it) }, modifier = modifier)
                Tab.SETTINGS -> SettingsScreen(modifier)
            }
        }
    }
}
