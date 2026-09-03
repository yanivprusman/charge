package com.automatelinux.charge

import android.os.Bundle
import androidx.activity.ComponentActivity
import androidx.activity.compose.setContent
import androidx.activity.enableEdgeToEdge

/**
 * Thin Android launcher — all UI lives in the shared commonMain App().
 *
 * The backend address and token are baked in at build time from mobile/.env and
 * handed to the shared code here, so commonMain never has to know that
 * BuildConfig (an Android-only class) exists.
 */
class MainActivity : ComponentActivity() {
    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        enableEdgeToEdge()
        setContent {
            App(baseUrl = BuildConfig.API_BASE_URL, token = BuildConfig.API_TOKEN)
        }
    }
}
