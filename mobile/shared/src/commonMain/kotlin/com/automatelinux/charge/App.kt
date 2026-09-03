package com.automatelinux.charge

import androidx.compose.foundation.background
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.PaddingValues
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.imePadding
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.layout.width
import androidx.compose.foundation.lazy.LazyColumn
import androidx.compose.foundation.lazy.items
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.foundation.text.KeyboardOptions
import androidx.compose.material3.Button
import androidx.compose.material3.Card
import androidx.compose.material3.CardDefaults
import androidx.compose.material3.CircularProgressIndicator
import androidx.compose.material3.Icon
import androidx.compose.material3.IconButton
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.OutlinedTextField
import androidx.compose.material3.Scaffold
import androidx.compose.material3.Surface
import androidx.compose.material3.Text
import androidx.compose.material3.TextButton
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.filled.Refresh
import androidx.compose.runtime.Composable
import androidx.compose.runtime.CompositionLocalProvider
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.rememberCoroutineScope
import androidx.compose.runtime.setValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.platform.LocalLayoutDirection
import androidx.compose.ui.unit.LayoutDirection
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.input.ImeAction
import androidx.compose.ui.text.input.KeyboardType
import androidx.compose.ui.text.style.TextAlign
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import com.automatelinux.charge.data.Charge
import com.automatelinux.charge.data.ChargeApi
import com.automatelinux.charge.ui.theme.AppTheme
import kotlinx.coroutines.launch

/**
 * גבייה — one screen, because there is only one thing to do.
 *
 * You are standing next to the person who owes you money. Four fields, one
 * button, and underneath it the running list of who still owes what. Nothing is
 * behind a menu: a second screen is a second thing to find while somebody
 * waits.
 *
 * The form does NOT re-implement the rules. Whether a number is a real mobile,
 * whether the amount is positive, whether Grow will accept the name — all of
 * that is the daemon's, and its refusal is shown verbatim. The one thing
 * checked here is that a field isn't empty, which is not a rule so much as a
 * reason not to spend a round trip.
 */

private const val CURRENCY = "₪"

private fun money(v: Double): String =
    if (kotlin.math.abs(v - v.toLong()) < 0.005) v.toLong().toString()
    else ((v * 100).toLong() / 100.0).toString()

@Composable
fun App(baseUrl: String, token: String) {
    val api = remember(baseUrl, token) { ChargeApi(baseUrl, token) }
    val scope = rememberCoroutineScope()

    var name by remember { mutableStateOf("") }
    var phone by remember { mutableStateOf("") }
    var amount by remember { mutableStateOf("") }
    var what by remember { mutableStateOf("") }

    var busy by remember { mutableStateOf(false) }
    var loadingList by remember { mutableStateOf(true) }
    var banner by remember { mutableStateOf<Banner?>(null) }
    var charges by remember { mutableStateOf<List<Charge>>(emptyList()) }
    var outstanding by remember { mutableStateOf(0.0) }

    suspend fun refresh() {
        loadingList = true
        val r = api.list()
        if (r.ok) {
            charges = r.charges
            outstanding = r.outstandingIls
        } else if (r.error.isNotEmpty()) {
            banner = Banner(r.error, ok = false)
        }
        loadingList = false
    }

    LaunchedEffect(Unit) { refresh() }

    // The whole interface is Hebrew, so the direction is a property of the app
    // rather than of the phone's locale — a device set to English would
    // otherwise render this right-aligned text in a left-to-right frame.
    CompositionLocalProvider(LocalLayoutDirection provides LayoutDirection.Rtl) {
    AppTheme {
        Surface(Modifier.fillMaxSize(), color = MaterialTheme.colorScheme.background) {
            Scaffold(containerColor = Color.Transparent) { inner ->
                LazyColumn(
                    modifier = Modifier.fillMaxSize().imePadding(),
                    contentPadding = PaddingValues(
                        top = inner.calculateTopPadding() + 20.dp,
                        bottom = inner.calculateBottomPadding() + 32.dp,
                        start = 20.dp,
                        end = 20.dp,
                    ),
                    verticalArrangement = Arrangement.spacedBy(12.dp),
                ) {
                    item {
                        Row(
                            Modifier.fillMaxWidth(),
                            horizontalArrangement = Arrangement.SpaceBetween,
                            verticalAlignment = Alignment.CenterVertically,
                        ) {
                            Column {
                                Text(
                                    "גבייה",
                                    style = MaterialTheme.typography.headlineMedium,
                                    fontWeight = FontWeight.Bold,
                                )
                                Text(
                                    if (outstanding > 0)
                                        "חייבים לך ${money(outstanding)} $CURRENCY"
                                    else "אין חובות פתוחים",
                                    style = MaterialTheme.typography.bodyMedium,
                                    color = MaterialTheme.colorScheme.onSurfaceVariant,
                                )
                            }
                            IconButton(onClick = { scope.launch { refresh() } }) {
                                Icon(Icons.Filled.Refresh, contentDescription = "רענן")
                            }
                        }
                    }

                    banner?.let { b ->
                        item {
                            BannerCard(b) { banner = null }
                        }
                    }

                    item {
                        Card(
                            Modifier.fillMaxWidth(),
                            shape = RoundedCornerShape(16.dp),
                            colors = CardDefaults.cardColors(
                                containerColor = MaterialTheme.colorScheme.surfaceVariant,
                            ),
                        ) {
                            Column(
                                Modifier.padding(16.dp),
                                verticalArrangement = Arrangement.spacedBy(10.dp),
                            ) {
                                Field(
                                    value = name,
                                    onChange = { name = it },
                                    label = "שם מלא",
                                    // The rule is Grow's, not ours, and it fails
                                    // the whole payment page — so it is said
                                    // before the field is filled, not after.
                                    supporting = "שם ושם משפחה — חברת הסליקה דורשת שניהם",
                                    keyboard = KeyboardType.Text,
                                )
                                Field(
                                    value = phone,
                                    onChange = { phone = it },
                                    label = "טלפון",
                                    supporting = "לשם יישלח הקישור בוואטסאפ",
                                    keyboard = KeyboardType.Phone,
                                )
                                Field(
                                    value = amount,
                                    onChange = { amount = it },
                                    label = "סכום ב$CURRENCY",
                                    keyboard = KeyboardType.Decimal,
                                )
                                Field(
                                    value = what,
                                    onChange = { what = it },
                                    label = "עבור מה",
                                    supporting = "מופיע בדף התשלום ובחיוב בכרטיס",
                                    keyboard = KeyboardType.Text,
                                    imeAction = ImeAction.Done,
                                )

                                val ready = name.isNotBlank() && phone.isNotBlank() &&
                                    amount.isNotBlank() && what.isNotBlank()

                                Button(
                                    onClick = {
                                        scope.launch {
                                            busy = true
                                            banner = null
                                            val r = api.charge(name.trim(), phone.trim(), amount.trim(), what.trim())
                                            banner = when {
                                                r.ok && r.sent -> {
                                                    name = ""; phone = ""; amount = ""; what = ""
                                                    Banner("נשלח ל${r.payerName} — ${money(r.amountIls)} $CURRENCY", ok = true)
                                                }
                                                // The link exists; only delivery
                                                // failed. Hand it over rather
                                                // than hiding it behind an error.
                                                r.payUrl.isNotEmpty() -> Banner(
                                                    "הקישור נוצר אבל לא נשלח: ${r.sendError.ifEmpty { "שגיאת שליחה" }}",
                                                    ok = false,
                                                    link = r.payUrl,
                                                )
                                                else -> Banner(r.error.ifEmpty { "לא הצלחנו ליצור בקשת תשלום" }, ok = false)
                                            }
                                            busy = false
                                            refresh()
                                        }
                                    },
                                    enabled = ready && !busy,
                                    modifier = Modifier.fillMaxWidth().height(52.dp),
                                    shape = RoundedCornerShape(12.dp),
                                ) {
                                    if (busy) {
                                        CircularProgressIndicator(
                                            Modifier.size(20.dp),
                                            strokeWidth = 2.dp,
                                            color = MaterialTheme.colorScheme.onPrimary,
                                        )
                                        Spacer(Modifier.width(10.dp))
                                        Text("מייצר קישור…")
                                    } else {
                                        Text(
                                            if (amount.isNotBlank()) "בקש $amount $CURRENCY בוואטסאפ"
                                            else "בקש תשלום בוואטסאפ",
                                            fontSize = 16.sp,
                                        )
                                    }
                                }
                            }
                        }
                    }

                    if (charges.isNotEmpty()) {
                        item {
                            Text(
                                "היסטוריה",
                                style = MaterialTheme.typography.titleSmall,
                                color = MaterialTheme.colorScheme.onSurfaceVariant,
                                modifier = Modifier.padding(top = 8.dp),
                            )
                        }
                        items(charges, key = { it.id }) { ChargeRow(it) }
                    } else if (!loadingList) {
                        item {
                            Text(
                                "עוד לא ביקשת תשלום מאף אחד.",
                                style = MaterialTheme.typography.bodyMedium,
                                color = MaterialTheme.colorScheme.onSurfaceVariant,
                                textAlign = TextAlign.Center,
                                modifier = Modifier.fillMaxWidth().padding(top = 24.dp),
                            )
                        }
                    }
                }
            }
        }
    }
    }
}

private data class Banner(val text: String, val ok: Boolean, val link: String = "")

@Composable
private fun BannerCard(b: Banner, onDismiss: () -> Unit) {
    val bg = if (b.ok) Color(0xFFE7F6EC) else Color(0xFFFDECEC)
    val fg = if (b.ok) Color(0xFF11603A) else Color(0xFF8A1C1C)
    Card(
        Modifier.fillMaxWidth(),
        shape = RoundedCornerShape(12.dp),
        colors = CardDefaults.cardColors(containerColor = bg),
    ) {
        Column(Modifier.padding(14.dp), verticalArrangement = Arrangement.spacedBy(6.dp)) {
            Text(b.text, color = fg, style = MaterialTheme.typography.bodyMedium)
            if (b.link.isNotEmpty()) {
                // Selectable rather than tappable: the recovery is to copy this
                // into a chat by hand, which is what a long-press already does.
                Text(
                    b.link,
                    color = fg,
                    style = MaterialTheme.typography.bodySmall,
                    fontWeight = FontWeight.Medium,
                )
            }
            TextButton(onClick = onDismiss, modifier = Modifier.align(Alignment.End)) {
                Text("סגור", color = fg)
            }
        }
    }
}

@Composable
private fun Field(
    value: String,
    onChange: (String) -> Unit,
    label: String,
    keyboard: KeyboardType,
    supporting: String? = null,
    imeAction: ImeAction = ImeAction.Next,
) {
    OutlinedTextField(
        value = value,
        onValueChange = onChange,
        label = { Text(label) },
        supportingText = supporting?.let { { Text(it, fontSize = 12.sp) } },
        singleLine = true,
        keyboardOptions = KeyboardOptions(keyboardType = keyboard, imeAction = imeAction),
        modifier = Modifier.fillMaxWidth(),
        shape = RoundedCornerShape(10.dp),
    )
}

@Composable
private fun ChargeRow(c: Charge) {
    Card(
        Modifier.fillMaxWidth(),
        shape = RoundedCornerShape(12.dp),
        colors = CardDefaults.cardColors(containerColor = MaterialTheme.colorScheme.surface),
    ) {
        Row(
            Modifier.fillMaxWidth().padding(14.dp),
            horizontalArrangement = Arrangement.spacedBy(12.dp),
            verticalAlignment = Alignment.CenterVertically,
        ) {
            val dot = when {
                c.paidWrongAmount -> Color(0xFFB8860B)
                c.isPaid -> Color(0xFF1E9E54)
                else -> Color(0xFFD39E00)
            }
            Box(Modifier.size(10.dp).background(dot, RoundedCornerShape(5.dp)))
            Column(Modifier.weight(1f)) {
                Text(
                    c.payerName.ifEmpty { c.payerPhone },
                    style = MaterialTheme.typography.bodyLarge,
                    fontWeight = FontWeight.SemiBold,
                )
                Text(
                    c.description,
                    style = MaterialTheme.typography.bodySmall,
                    color = MaterialTheme.colorScheme.onSurfaceVariant,
                )
                Text(
                    when {
                        c.paidWrongAmount -> "שולם ${money(c.paidAmountIls)} $CURRENCY — לא הסכום שנדרש"
                        c.isPaid -> "שולם"
                        c.sent -> "נשלח, ממתין לתשלום"
                        else -> "הקישור לא נשלח"
                    },
                    style = MaterialTheme.typography.labelSmall,
                    color = dot,
                )
            }
            Text(
                "${money(c.amountIls)} $CURRENCY",
                style = MaterialTheme.typography.titleMedium,
                fontWeight = FontWeight.Bold,
            )
        }
    }
}
