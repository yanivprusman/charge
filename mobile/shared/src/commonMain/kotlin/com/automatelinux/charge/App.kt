package com.automatelinux.charge

import androidx.compose.foundation.background
import androidx.compose.foundation.clickable
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
import androidx.compose.material3.AlertDialog
import androidx.compose.material3.Button
import androidx.compose.material3.Card
import androidx.compose.material3.CardDefaults
import androidx.compose.material3.Checkbox
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
import androidx.compose.material.icons.filled.Contacts
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
import androidx.compose.ui.text.style.TextDecoration
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import com.automatelinux.charge.data.Charge
import com.automatelinux.charge.data.ChargeApi
import com.automatelinux.charge.platform.rememberContactPicker
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

/** Words in a name, by the same rule the daemon applies before Grow sees it:
 *  Grow fails the whole payment page on a one-word customerName, in any
 *  language. Counted here only to WARN — the daemon stays the authority, and
 *  its refusal is still what gets shown if one slips through. */
private fun wordCount(s: String): Int = s.trim().split(" ", "\t").count { it.isNotBlank() }

private fun money(v: Double): String =
    if (kotlin.math.abs(v - v.toLong()) < 0.005) v.toLong().toString()
    else ((v * 100).toLong() / 100.0).toString()

@Composable
fun App(baseUrl: String, token: String) {
    val api = remember(baseUrl, token) { ChargeApi(baseUrl, token) }
    val scope = rememberCoroutineScope()

    var name by remember { mutableStateOf("") }
    var phone by remember { mutableStateOf("") }
    // The picker fills the NUMBER and nothing else.
    //
    // It used to fill the name too, from the contact's display name, and that
    // is how "ליאור עזימי מחסן עמק חפב" reached a customer's WhatsApp and his
    // payment page on 2026-09-04. The obvious repair — shorten the label to its
    // first two words — was tried and removed: it guesses which words are the
    // person and which are the filing note, and a wrong guess writes a wrong
    // name onto a real payment page. "דוד בן שמעון" is a name; "דוד קלין
    // ניקיון" is a name and a trade; nothing in the string says which.
    //
    // So the app does not guess. An address-book label is a private note about
    // how to FIND someone, and it never becomes the name a payer is shown —
    // because it never enters the field. The name is typed by the one person
    // who knows it. An existing entry is left alone, so picking a contact to
    // fetch a number cannot wipe a name already typed.
    val pickContact = rememberContactPicker { c ->
        phone = c.phone.filter { it.isDigit() || it == '+' }
    }
    var amount by remember { mutableStateOf("") }
    var what by remember { mutableStateOf("") }

    var busy by remember { mutableStateOf(false) }
    var loadingList by remember { mutableStateOf(true) }
    var banner by remember { mutableStateOf<Banner?>(null) }
    // A connection problem is a STATE, not an event: it must disappear by
    // itself the moment the connection comes back. Keeping it in `banner`
    // alongside one-off results left "check the VPN" on screen after a
    // successful refresh had already proved otherwise.
    var listError by remember { mutableStateOf("") }
    var charges by remember { mutableStateOf<List<Charge>>(emptyList()) }
    var outstanding by remember { mutableStateOf(0.0) }
    // Cancelling is behind a confirmation because it is not undoable from here:
    // there is no "un-cancel", and the payer may already have been told the
    // request is off. The charge being cancelled is held rather than a boolean,
    // so the dialog can name the person and the sum instead of asking "are you
    // sure?" about nothing in particular.
    var cancelTarget by remember { mutableStateOf<Charge?>(null) }
    var notifyPayer by remember { mutableStateOf(true) }
    var cancelling by remember { mutableStateOf(false) }

    suspend fun refresh() {
        loadingList = true
        val r = api.list()
        if (r.ok) {
            charges = r.charges
            outstanding = r.outstandingIls
            listError = ""
        } else if (r.error.isNotEmpty()) {
            listError = r.error
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
                        item { BannerCard(b) { banner = null } }
                    }

                    if (listError.isNotEmpty()) {
                        item {
                            // No dismiss: it is not news to be acknowledged, it
                            // is the current state of the connection, and the
                            // next successful load removes it.
                            BannerCard(Banner(listError, ok = false), onDismiss = null)
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
                                // The rule is Grow's, not ours, and it fails the
                                // whole payment page — so it is said before the
                                // field is filled, and said louder the moment a
                                // name arrives that will not pass. A contact
                                // called "אמא" is exactly that case.
                                val nameTooShort = name.isNotBlank() && wordCount(name) < 2
                                Field(
                                    value = name,
                                    onChange = { name = it },
                                    label = "שם מלא",
                                    supporting = if (nameTooShort)
                                        "\"$name\" הוא שם אחד — חברת הסליקה תדחה את זה. הוסף שם משפחה."
                                    else "שם ושם משפחה — חברת הסליקה דורשת שניהם",
                                    isWarning = nameTooShort,
                                    keyboard = KeyboardType.Text,
                                )
                                Field(
                                    value = phone,
                                    onChange = { phone = it },
                                    label = "טלפון",
                                    supporting = if (pickContact != null)
                                        "לשם יישלח הקישור בוואטסאפ — או בחר מאנשי הקשר"
                                    else "לשם יישלח הקישור בוואטסאפ",
                                    keyboard = KeyboardType.Phone,
                                    // Hidden rather than disabled where there is
                                    // no picker: a button that cannot do anything
                                    // is worse than no button.
                                    trailing = pickContact?.let { pick ->
                                        {
                                            IconButton(onClick = pick) {
                                                Icon(
                                                    Icons.Filled.Contacts,
                                                    contentDescription = "בחר מאנשי הקשר",
                                                )
                                            }
                                        }
                                    },
                                )
                                Field(
                                    value = amount,
                                    onChange = { amount = it },
                                    label = "סכום בשקלים",
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
                                                    extra = r.payUrl,
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
                        items(charges, key = { it.id }) { c ->
                            ChargeRow(c, onCancel = {
                                notifyPayer = c.sent
                                cancelTarget = c
                            })
                        }
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

            cancelTarget?.let { target ->
                CancelDialog(
                    charge = target,
                    notify = notifyPayer,
                    onNotifyChange = { notifyPayer = it },
                    busy = cancelling,
                    onDismiss = { if (!cancelling) cancelTarget = null },
                    onConfirm = {
                        scope.launch {
                            cancelling = true
                            banner = null
                            val r = api.cancel(target.id, notifyPayer)
                            val who = target.payerName.ifEmpty { target.payerPhone }
                            banner = when {
                                r.ok && r.notified ->
                                    Banner("הבקשה בוטלה ו$who עודכן בוואטסאפ", ok = true)
                                // Cancelled, and nobody needed telling: either
                                // the link never went out, or he said he would
                                // tell him himself.
                                r.ok ->
                                    Banner("הבקשה בוטלה — ${whyNobodyWasTold(target, notifyPayer)}", ok = true)
                                // The withdrawal stands; only the message
                                // failed. That is the half $who can see, so it
                                // is handed over to send by hand rather than
                                // reported as a failed cancellation.
                                r.sendError.isNotEmpty() -> Banner(
                                    "הבקשה בוטלה, אבל ההודעה ל$who לא נשלחה — הוא עדיין מחזיק קישור פעיל",
                                    ok = false,
                                    extra = r.message,
                                )
                                else -> Banner(r.error.ifEmpty { "לא הצלחנו לבטל את הבקשה" }, ok = false)
                            }
                            cancelling = false
                            cancelTarget = null
                            refresh()
                        }
                    },
                )
            }
        }
    }
    }
}

/** Why no WhatsApp went out — said plainly, because "cancelled" on its own
 *  leaves open whether the payer knows, and that is the difference between a
 *  live payment link and a dead one. */
private fun whyNobodyWasTold(c: Charge, notify: Boolean): String =
    if (!c.sent) "הקישור מעולם לא נשלח אליו"
    else if (!notify) "לא נשלחה הודעה, והקישור שבידיו עדיין עובד"
    else "לא נשלחה הודעה"

/** @param extra text worth copying out of the banner by hand — a payment link
 *  that was created but not delivered, or a cancellation the payer was not
 *  told about. Rendered selectable rather than tappable, because copying it
 *  into a chat IS the recovery in both cases. */
private data class Banner(val text: String, val ok: Boolean, val extra: String = "")

@Composable
private fun BannerCard(b: Banner, onDismiss: (() -> Unit)?) {
    val bg = if (b.ok) Color(0xFFE7F6EC) else Color(0xFFFDECEC)
    val fg = if (b.ok) Color(0xFF11603A) else Color(0xFF8A1C1C)
    Card(
        Modifier.fillMaxWidth(),
        shape = RoundedCornerShape(12.dp),
        colors = CardDefaults.cardColors(containerColor = bg),
    ) {
        Column(Modifier.padding(14.dp), verticalArrangement = Arrangement.spacedBy(6.dp)) {
            Text(b.text, color = fg, style = MaterialTheme.typography.bodyMedium)
            if (b.extra.isNotEmpty()) {
                // Selectable rather than tappable: the recovery is to copy this
                // into a chat by hand, which is what a long-press already does.
                Text(
                    b.extra,
                    color = fg,
                    style = MaterialTheme.typography.bodySmall,
                    fontWeight = FontWeight.Medium,
                )
            }
            if (onDismiss != null) {
                TextButton(onClick = onDismiss, modifier = Modifier.align(Alignment.End)) {
                    Text("סגור", color = fg)
                }
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
    isWarning: Boolean = false,
    trailing: (@Composable () -> Unit)? = null,
    imeAction: ImeAction = ImeAction.Next,
) {
    OutlinedTextField(
        value = value,
        onValueChange = onChange,
        label = { Text(label) },
        supportingText = supporting?.let {
            {
                Text(
                    it,
                    fontSize = 12.sp,
                    color = if (isWarning) MaterialTheme.colorScheme.error
                    else MaterialTheme.colorScheme.onSurfaceVariant,
                )
            }
        },
        trailingIcon = trailing,
        singleLine = true,
        keyboardOptions = KeyboardOptions(keyboardType = keyboard, imeAction = imeAction),
        modifier = Modifier.fillMaxWidth(),
        shape = RoundedCornerShape(10.dp),
    )
}

@Composable
private fun ChargeRow(c: Charge, onCancel: () -> Unit) {
    Card(
        // The whole row opens the way out, and it also carries a worded button:
        // an invisible tap target is not an affordance, and "בטל" is unambiguous
        // in a way a glyph on a money row is not. Low emphasis on purpose —
        // withdrawing a request is rare next to raising one, and it must never
        // compete with the button above it.
        Modifier.fillMaxWidth().let { if (c.canCancel) it.clickable(onClick = onCancel) else it },
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
                c.isCancelled -> Color(0xFF9AA0A6)
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
                        c.isCancelled -> "בוטלה"
                        c.sent -> "נשלח, ממתין לתשלום"
                        else -> "הקישור לא נשלח"
                    },
                    style = MaterialTheme.typography.labelSmall,
                    color = dot,
                )
            }
            Column(horizontalAlignment = Alignment.End) {
                Text(
                    "${money(c.amountIls)} $CURRENCY",
                    style = MaterialTheme.typography.titleMedium,
                    fontWeight = FontWeight.Bold,
                    // Struck through rather than dimmed: a cancelled charge is
                    // not a quieter debt, it is not a debt, and the total above
                    // has already stopped counting it.
                    textDecoration = if (c.isCancelled) TextDecoration.LineThrough else null,
                    color = if (c.isCancelled) MaterialTheme.colorScheme.onSurfaceVariant
                    else MaterialTheme.colorScheme.onSurface,
                )
                if (c.canCancel) {
                    TextButton(
                        onClick = onCancel,
                        contentPadding = PaddingValues(horizontal = 8.dp, vertical = 0.dp),
                    ) {
                        Text(
                            "בטל",
                            style = MaterialTheme.typography.labelMedium,
                            color = MaterialTheme.colorScheme.onSurfaceVariant,
                        )
                    }
                }
            }
        }
    }
}

/**
 * "Are you sure" is the wrong question, so this does not ask it.
 *
 * It names the person, the sum and what it was for, and then says the one thing
 * that is not obvious: cancelling does NOT switch off the payment page. The
 * payer keeps a link that still charges his card, and the WhatsApp message is
 * the only part of this he can see — so the checkbox is on by default, and
 * turning it off says so in plain words rather than leaving it as an unlabelled
 * preference.
 */
@Composable
private fun CancelDialog(
    charge: Charge,
    notify: Boolean,
    onNotifyChange: (Boolean) -> Unit,
    busy: Boolean,
    onDismiss: () -> Unit,
    onConfirm: () -> Unit,
) {
    val who = charge.payerName.ifEmpty { charge.payerPhone }
    AlertDialog(
        onDismissRequest = onDismiss,
        title = { Text("לבטל את הבקשה?") },
        text = {
            Column(verticalArrangement = Arrangement.spacedBy(10.dp)) {
                Text(
                    "$who — ${money(charge.amountIls)} $CURRENCY",
                    style = MaterialTheme.typography.bodyLarge,
                    fontWeight = FontWeight.SemiBold,
                )
                if (charge.description.isNotEmpty()) {
                    Text(
                        charge.description,
                        style = MaterialTheme.typography.bodyMedium,
                        color = MaterialTheme.colorScheme.onSurfaceVariant,
                    )
                }
                if (charge.sent) {
                    Text(
                        "הקישור כבר נשלח אליו והוא ימשיך לעבוד. ההודעה היא מה שמבטל אותו בפועל.",
                        style = MaterialTheme.typography.bodySmall,
                        color = MaterialTheme.colorScheme.onSurfaceVariant,
                    )
                    Row(
                        Modifier.fillMaxWidth().clickable(enabled = !busy) { onNotifyChange(!notify) },
                        verticalAlignment = Alignment.CenterVertically,
                        horizontalArrangement = Arrangement.spacedBy(4.dp),
                    ) {
                        Checkbox(checked = notify, onCheckedChange = { onNotifyChange(it) }, enabled = !busy)
                        Text(
                            "שלח לו הודעה שהבקשה בוטלה",
                            style = MaterialTheme.typography.bodyMedium,
                        )
                    }
                } else {
                    // Nobody holds the link, so there is nobody to un-tell —
                    // and no checkbox, because an option that cannot change the
                    // outcome is just something else to read.
                    Text(
                        "הקישור מעולם לא נשלח אליו — אין למי להודיע.",
                        style = MaterialTheme.typography.bodySmall,
                        color = MaterialTheme.colorScheme.onSurfaceVariant,
                    )
                }
            }
        },
        confirmButton = {
            TextButton(onClick = onConfirm, enabled = !busy) {
                if (busy) {
                    CircularProgressIndicator(Modifier.size(16.dp), strokeWidth = 2.dp)
                    Spacer(Modifier.width(8.dp))
                    Text("מבטל…")
                } else {
                    Text("בטל את הבקשה", color = MaterialTheme.colorScheme.error)
                }
            }
        },
        dismissButton = {
            // "השאר" and not "ביטול": in Hebrew the safe way out of a
            // cancellation dialog cannot be the word "cancel".
            TextButton(onClick = onDismiss, enabled = !busy) { Text("השאר") }
        },
    )
}
