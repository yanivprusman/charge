package com.automatelinux.charge.platform

import android.content.Intent
import android.provider.ContactsContract
import androidx.activity.compose.rememberLauncherForActivityResult
import androidx.activity.result.contract.ActivityResultContracts
import androidx.compose.runtime.Composable
import androidx.compose.runtime.remember
import androidx.compose.runtime.rememberUpdatedState
import androidx.compose.ui.platform.LocalContext

/**
 * Android's own contact picker.
 *
 * ACTION_PICK on the Phone table returns the URI of the ONE phone row the user
 * chose, carrying a temporary read grant with it. Querying that URI therefore
 * needs no READ_CONTACTS permission and shows no permission dialog — the user
 * already granted access by choosing the person, which is the only access the
 * app has any business having.
 *
 * Picking the Phone table rather than the contact means a person with three
 * numbers is disambiguated in the system UI, where the numbers are visible,
 * instead of by us guessing at "the first one".
 */
@Composable
actual fun rememberContactPicker(onPicked: (PickedContact) -> Unit): (() -> Unit)? {
    val context = LocalContext.current
    val callback = rememberUpdatedState(onPicked)

    val launcher = rememberLauncherForActivityResult(
        ActivityResultContracts.StartActivityForResult(),
    ) { result ->
        val uri = result.data?.data ?: return@rememberLauncherForActivityResult
        val projection = arrayOf(
            ContactsContract.CommonDataKinds.Phone.NUMBER,
            ContactsContract.CommonDataKinds.Phone.DISPLAY_NAME,
        )
        // A cancelled pick, a revoked grant or a contact deleted between the tap
        // and the read all land here as "no row", and the form is simply left as
        // the user had it.
        context.contentResolver.query(uri, projection, null, null, null)?.use { c ->
            if (c.moveToFirst()) {
                callback.value(
                    PickedContact(
                        displayName = c.getString(1) ?: "",
                        phone = c.getString(0) ?: "",
                    ),
                )
            }
        }
    }

    val intent = remember {
        Intent(Intent.ACTION_PICK).apply {
            type = ContactsContract.CommonDataKinds.Phone.CONTENT_TYPE
        }
    }
    return { launcher.launch(intent) }
}
