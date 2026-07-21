package com.digiringo.app;

import android.content.BroadcastReceiver;
import android.content.Context;
import android.content.Intent;

import androidx.core.app.NotificationManagerCompat;

/**
 * Handles the "Decline" action on the incoming-call notification: cancels the
 * ringing notification and — when the app process is alive — hangs up the ringing
 * WebRTC leg so the caller is actually rejected (not just the notification
 * dismissed). If the app is fully killed there's no WebRTC leg registered, so the
 * unanswered fork simply falls through to voicemail on its own timeout.
 */
public class CallActionReceiver extends BroadcastReceiver {
    @Override
    public void onReceive(Context context, Intent intent) {
        NotificationManagerCompat.from(context).cancel(CallMessagingService.CALL_NOTIF_ID);
        final MainActivity act = MainActivity.INSTANCE.get();
        if (act != null) act.runOnUiThread(() -> act.injectCallAction("decline", ""));
    }
}
