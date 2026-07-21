package com.digiringo.app;

import android.app.KeyguardManager;
import android.content.Context;
import android.content.Intent;
import android.os.Build;
import android.os.Bundle;
import android.webkit.JavascriptInterface;
import android.webkit.WebView;

import androidx.core.app.NotificationManagerCompat;

import com.getcapacitor.BridgeActivity;

import java.lang.ref.WeakReference;

public class MainActivity extends BridgeActivity {

    // Weak handle to the live activity so CallActionReceiver (notification Decline)
    // can reach the WebView and hang up the WebRTC leg when the process is alive.
    static WeakReference<MainActivity> INSTANCE = new WeakReference<>(null);

    @Override
    public void onCreate(Bundle savedInstanceState) {
        super.onCreate(savedInstanceState);
        INSTANCE = new WeakReference<>(this);
        // Let the web app cancel the ringing full-screen notification once it takes
        // over the call (answered in-app / call became active).
        try {
            getBridge().getWebView().addJavascriptInterface(new NativeBridge(), "DigiNative");
        } catch (Exception ignored) { }
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
    public void onResume() {
        super.onResume();
        INSTANCE = new WeakReference<>(this);
        CallMessagingService.appForeground = true;
    }

    @Override
    public void onPause() {
        super.onPause();
        CallMessagingService.appForeground = false;
    }

    @Override
    public void onDestroy() {
        super.onDestroy();
        if (INSTANCE.get() == this) INSTANCE = new WeakReference<>(null);
    }

    /** Opened from an incoming-call notification: wake + show over the lock screen
     *  and tell the web app to display the call. ANSWER auto-accepts; the
     *  full-screen (INCOMING) launch just surfaces the ringing call screen. */
    private void handleCallIntent(Intent intent) {
        if (intent == null) return;
        String action = intent.getAction();
        boolean answer = "com.digiringo.app.ANSWER".equals(action);
        boolean incoming = "com.digiringo.app.INCOMING".equals(action);
        if (!answer && !incoming) return;

        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O_MR1) {
            setShowWhenLocked(true);
            setTurnScreenOn(true);
            // Dismiss the keyguard so the call UI is interactive over the lock screen.
            KeyguardManager km = (KeyguardManager) getSystemService(Context.KEYGUARD_SERVICE);
            if (km != null) km.requestDismissKeyguard(this, null);
        }

        String caller = intent.getStringExtra("caller");
        injectCallAction(answer ? "answer" : "show", caller == null ? "" : caller);
    }

    /** Deliver a call action to the web layer, retrying until the JS bridge
     *  (window.__dgCallAction) exists — the WebView may still be booting on a cold
     *  start / lock-screen launch. */
    void injectCallAction(final String action, final String caller) {
        final WebView wv;
        try { wv = getBridge().getWebView(); } catch (Exception e) { return; }
        if (wv == null) return;
        deliver(wv, action, caller, 0);
    }

    private void deliver(final WebView wv, final String action, final String caller, final int attempt) {
        if (attempt > 40) return; // ~20s of retries while the app boots
        wv.evaluateJavascript("!!(window.__dgCallAction)", value -> {
            if ("true".equals(value)) {
                String safe = caller.replace("\\", "\\\\").replace("'", "\\'");
                wv.evaluateJavascript("window.__dgCallAction('" + action + "','" + safe + "')", null);
            } else {
                wv.postDelayed(() -> deliver(wv, action, caller, attempt + 1), 500);
            }
        });
    }

    /** Exposed to the web app as `window.DigiNative`. */
    public class NativeBridge {
        @JavascriptInterface
        public void clearCallNotification() {
            NotificationManagerCompat.from(MainActivity.this).cancel(CallMessagingService.CALL_NOTIF_ID);
        }
    }
}
