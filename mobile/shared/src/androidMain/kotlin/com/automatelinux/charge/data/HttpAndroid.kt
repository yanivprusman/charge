package com.automatelinux.charge.data

import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.withContext
import java.io.IOException
import java.net.HttpURLConnection
import java.net.URL

/**
 * The Android half of [httpRequest], on the JDK's own client.
 *
 * No HTTP library on purpose: this app makes exactly two request shapes to one
 * host on the WireGuard overlay, and a dependency would be more code to keep in
 * version-lockstep with Compose than it would replace.
 *
 * The timeouts are long because raising a charge is not a local call — the
 * daemon waits on Grow creating a payment page and then on the WhatsApp bridge,
 * and cutting that off at the usual few seconds would abandon a charge that is
 * about to succeed.
 */
actual suspend fun httpRequest(
    method: String,
    url: String,
    token: String,
    jsonBody: String?,
): HttpResult = withContext(Dispatchers.IO) {
    var conn: HttpURLConnection? = null
    try {
        conn = (URL(url).openConnection() as HttpURLConnection).apply {
            requestMethod = method
            connectTimeout = 10_000
            readTimeout = 60_000
            setRequestProperty("Authorization", "Bearer $token")
            setRequestProperty("Accept", "application/json")
            if (jsonBody != null) {
                doOutput = true
                setRequestProperty("Content-Type", "application/json; charset=utf-8")
                outputStream.use { it.write(jsonBody.toByteArray(Charsets.UTF_8)) }
            }
        }
        val code = conn.responseCode
        // A 4xx/5xx body carries the reason; errorStream is where it lives.
        val stream = if (code in 200..299) conn.inputStream else conn.errorStream
        val body = stream?.bufferedReader(Charsets.UTF_8)?.use { it.readText() } ?: ""
        HttpResult(code, body)
    } catch (e: IOException) {
        // Code 0 means the request never reached anyone — the VPN being down is
        // the everyday cause, and the UI says so rather than showing a number.
        HttpResult(0, "", e.message ?: "no connection")
    } finally {
        conn?.disconnect()
    }
}
