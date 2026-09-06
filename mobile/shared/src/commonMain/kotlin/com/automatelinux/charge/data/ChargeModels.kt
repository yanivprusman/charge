package com.automatelinux.charge.data

import kotlinx.serialization.SerialName
import kotlinx.serialization.Serializable

/**
 * The wire shapes of `d charge` / `d charges`, as the daemon emits them with
 * `--json 1`.
 *
 * Every field the daemon sends is optional here except the ones a charge cannot
 * exist without. A phone that refuses to parse a reply because the daemon
 * gained a field is a phone that stops working on the next deploy, and the
 * person holding it is standing in front of someone who owes them money.
 */
@Serializable
data class Charge(
    val id: String = "",
    @SerialName("createdAt") val createdAt: String = "",
    @SerialName("payerName") val payerName: String = "",
    @SerialName("payerPhone") val payerPhone: String = "",
    @SerialName("amountIls") val amountIls: Double = 0.0,
    val description: String = "",
    @SerialName("payUrl") val payUrl: String = "",
    /** "pending" | "paid" | "cancelled" */
    val status: String = "pending",
    val sent: Boolean = false,
    @SerialName("paidAmountIls") val paidAmountIls: Double = 0.0,
) {
    val isPaid: Boolean get() = status == "paid"

    /** Withdrawn before it was paid. Not a failure and not a debt — it is a
     *  request that was taken back, and it stops counting as money owed. */
    val isCancelled: Boolean get() = status == "cancelled"

    /** The only rows offering a way out. A paid charge is refunded rather than
     *  cancelled, and a cancelled one has nowhere left to go. */
    val canCancel: Boolean get() = !isPaid && !isCancelled

    /** Paid, but not the amount that was asked for — the daemon records both. */
    val paidWrongAmount: Boolean
        get() = isPaid && kotlin.math.abs(paidAmountIls - amountIls) > 0.5
}

@Serializable
data class ChargesResponse(
    val ok: Boolean = false,
    val error: String = "",
    val charges: List<Charge> = emptyList(),
    @SerialName("outstandingIls") val outstandingIls: Double = 0.0,
    @SerialName("collectedIls") val collectedIls: Double = 0.0,
)

/**
 * The answer to raising one charge. `ok` and `payUrl` are separate facts on
 * purpose: a link that was created but not delivered is a real charge with a
 * delivery problem, and the screen has to be able to hand over the link rather
 * than showing a dead end.
 */
@Serializable
data class ChargeResponse(
    val ok: Boolean = false,
    val error: String = "",
    val id: String = "",
    @SerialName("payUrl") val payUrl: String = "",
    @SerialName("payerName") val payerName: String = "",
    @SerialName("payerPhone") val payerPhone: String = "",
    @SerialName("amountIls") val amountIls: Double = 0.0,
    val description: String = "",
    val sent: Boolean = false,
    @SerialName("sendError") val sendError: String = "",
)

/**
 * The answer to withdrawing one charge.
 *
 * `notified` is deliberately its own fact rather than folded into `ok`:
 * cancelling always stops the charge counting as owed, but the Grow page stays
 * payable, so whether the payer was actually TOLD is the part that decides
 * whether he might still pay. A cancel that could not reach him is a success
 * with a message the owner now has to deliver by hand.
 */
@Serializable
data class CancelResponse(
    val ok: Boolean = false,
    val error: String = "",
    val id: String = "",
    val notified: Boolean = false,
    @SerialName("notifySkipped") val notifySkipped: String = "",
    @SerialName("alreadyCancelled") val alreadyCancelled: Boolean = false,
    @SerialName("sendError") val sendError: String = "",
    val message: String = "",
)
