package com.automatelinux.charge.data

import kotlinx.serialization.json.Json

/** One HTTP round trip. Android supplies it with the JDK client; iOS will
 *  supply NSURLSession. Kept this small so neither platform grows a second
 *  place where a request can be built differently. */
expect suspend fun httpRequest(
    method: String,
    url: String,
    token: String,
    jsonBody: String?,
): HttpResult

data class HttpResult(val code: Int, val body: String, val transportError: String? = null)

private val json = Json { ignoreUnknownKeys = true; isLenient = true }

/**
 * The app's whole conversation with the backend: raise a charge, list charges.
 *
 * Failures are values, never exceptions thrown at the UI: the screen this feeds
 * is used standing next to the person who owes the money, so "the VPN is not
 * up" has to render as a sentence rather than as a crash or a spinner that
 * never ends.
 */
class ChargeApi(baseUrl: String, private val token: String) {
    private val base = baseUrl.trimEnd('/')

    val configured: Boolean get() = token.isNotEmpty()

    suspend fun list(): ChargesResponse {
        if (!configured) return ChargesResponse(error = NO_TOKEN)
        val r = httpRequest("GET", "$base/api/charges?status=all", token, null)
        return runCatching { json.decodeFromString<ChargesResponse>(r.body) }
            .getOrElse { ChargesResponse(error = describe(r)) }
    }

    suspend fun charge(
        name: String,
        phone: String,
        amount: String,
        description: String,
    ): ChargeResponse {
        if (!configured) return ChargeResponse(error = NO_TOKEN)
        val body = json.encodeToString(
            ChargeRequest(to = phone, name = name, amount = amount, description = description),
        )
        val r = httpRequest("POST", "$base/api/charge", token, body)
        return runCatching { json.decodeFromString<ChargeResponse>(r.body) }
            .getOrElse { ChargeResponse(error = describe(r)) }
    }

    /** What to show when the reply was not the JSON we expected — the status
     *  code alone is useless to someone holding a phone. */
    private fun describe(r: HttpResult): String = when (r.code) {
        401 -> "המכשיר לא מורשה מול השרת (טוקן שגוי)"
        0 -> "אין חיבור לשרת — בדוק שה‑VPN פעיל"
        else -> "השרת החזיר תשובה לא צפויה (${r.code})"
    }

    private companion object {
        const val NO_TOKEN = "הגרסה הזו נבנתה בלי טוקן — בנה מחדש עם mobile/.env"
    }
}

@kotlinx.serialization.Serializable
private data class ChargeRequest(
    val to: String,
    val name: String,
    val amount: String,
    val description: String,
)
