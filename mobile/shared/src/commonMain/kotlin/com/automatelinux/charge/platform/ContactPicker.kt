package com.automatelinux.charge.platform

/** A person as their phone's address book has them: a display name that may be
 *  anything ("אמא", "יוסי אינסטלטור"), and a number in whatever format it was
 *  saved in. Both are treated as a starting point, never as the truth. */
data class PickedContact(val displayName: String, val phone: String)

/**
 * The system contact picker, or null on a platform that has none.
 *
 * Null is a real answer, not a failure to handle: the caller hides the button
 * rather than showing one that does nothing. (iOS will supply an actual when
 * this is built on a Mac.)
 *
 * The Android implementation goes through the OS picker, which hands back a
 * one-shot read grant for the row the user chose — so the app reads exactly the
 * contact he picked and never holds READ_CONTACTS. An app that asks for the
 * whole address book to save four seconds of typing has taken far more than it
 * needed.
 */
@androidx.compose.runtime.Composable
expect fun rememberContactPicker(onPicked: (PickedContact) -> Unit): (() -> Unit)?
