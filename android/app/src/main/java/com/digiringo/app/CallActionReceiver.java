package com.digiringo.app;

import android.content.BroadcastReceiver;
import android.content.Context;
import android.content.Intent;

import androidx.core.app.NotificationManagerCompat;

/**
 * Handles the "Decline" action on the incoming-call notification. The call itself
 * rings via Telnyx/WebRTC and falls through to voicemail on its own timeout, so
 * declining just clears the notification (we don't need to signal the server).
 */
public class CallActionReceiver extends BroadcastReceiver {
    @Override
    public void onReceive(Context context, Intent intent) {
        NotificationManagerCompat.from(context).cancel(CallMessagingService.CALL_NOTIF_ID);
    }
}
