package com.digiringo.app;

import android.content.Intent;
import android.os.Build;
import android.os.Bundle;

import androidx.core.app.NotificationManagerCompat;

import com.getcapacitor.BridgeActivity;

public class MainActivity extends BridgeActivity {

    @Override
    public void onCreate(Bundle savedInstanceState) {
        super.onCreate(savedInstanceState);
        handleCallIntent(getIntent());
    }

    @Override
    public void onNewIntent(Intent intent) {
        super.onNewIntent(intent);
        setIntent(intent);
        handleCallIntent(intent);
    }

    // The in-app WebRTC UI shows the call while the app is on-screen, so tell the
    // messaging service to skip its notification then (avoids a double ring).
    @Override
    protected void onResume() {
        super.onResume();
        CallMessagingService.appForeground = true;
    }

    @Override
    protected void onPause() {
        super.onPause();
        CallMessagingService.appForeground = false;
    }

    /** When opened from an incoming-call notification, show over the lock screen
     *  and clear the ringing notification now that the app is up. */
    private void handleCallIntent(Intent intent) {
        if (intent == null) return;
        String action = intent.getAction();
        boolean isCall = "com.digiringo.app.INCOMING".equals(action) || "com.digiringo.app.ANSWER".equals(action);
        if (!isCall) return;
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O_MR1) {
            setShowWhenLocked(true);
            setTurnScreenOn(true);
        }
        NotificationManagerCompat.from(this).cancel(CallMessagingService.CALL_NOTIF_ID);
    }
}
