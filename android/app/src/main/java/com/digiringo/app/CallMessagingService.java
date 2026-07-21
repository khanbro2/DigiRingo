package com.digiringo.app;

import android.app.Notification;
import android.app.NotificationChannel;
import android.app.NotificationManager;
import android.app.PendingIntent;
import android.content.Context;
import android.content.Intent;
import android.media.AudioAttributes;
import android.media.RingtoneManager;
import android.net.Uri;
import android.os.Build;

import androidx.annotation.NonNull;
import androidx.core.app.NotificationCompat;
import androidx.core.app.NotificationManagerCompat;
import androidx.core.app.Person;

import com.google.firebase.messaging.RemoteMessage;

import java.util.Map;

/**
 * Turns an incoming-call FCM into a WhatsApp-style, full-screen call notification
 * (caller number + Answer / Decline) that rings over the lock screen — even when
 * the app is fully closed.
 *
 * We extend Capacitor's MessagingService so ordinary pushes (e.g. SMS alerts) and
 * token registration keep working: only data messages with type=="call" are
 * intercepted; everything else is handed back to super. The server sends the call
 * push DATA-ONLY (no `notification` block) on high priority so THIS code builds
 * the notification in every app state, instead of the OS drawing a plain one.
 */
public class CallMessagingService extends com.capacitorjs.plugins.pushnotifications.MessagingService {

    static final String CHANNEL_ID = "incoming_calls";
    static final int CALL_NOTIF_ID = 42;
    // Set by MainActivity's lifecycle: when the app is on-screen the in-app
    // WebRTC UI already shows the call, so we skip the notification to avoid a
    // double ring.
    static volatile boolean appForeground = false;

    @Override
    public void onMessageReceived(@NonNull RemoteMessage remoteMessage) {
        Map<String, String> data = remoteMessage.getData();
        if (data != null && "call".equals(data.get("type"))) {
            if (!appForeground) showIncomingCall(data);
        } else {
            super.onMessageReceived(remoteMessage);
        }
    }

    private void showIncomingCall(Map<String, String> data) {
        String caller = data.get("caller");
        if (caller == null || caller.isEmpty()) caller = "Unknown caller";

        createChannel();

        // Answer / full-screen → open the app (the WebRTC leg rings it once up).
        PendingIntent answerPI = activityIntent("com.digiringo.app.ANSWER", caller, 1);
        PendingIntent fullScreenPI = activityIntent("com.digiringo.app.INCOMING", caller, 3);
        // Decline → dismiss the call notification.
        Intent decline = new Intent(this, CallActionReceiver.class).setAction("com.digiringo.app.DECLINE");
        PendingIntent declinePI = PendingIntent.getBroadcast(this, 2, decline,
                PendingIntent.FLAG_UPDATE_CURRENT | PendingIntent.FLAG_IMMUTABLE);

        Person caller_ = new Person.Builder().setName(caller).setImportant(true).build();

        NotificationCompat.Builder b = new NotificationCompat.Builder(this, CHANNEL_ID)
                .setSmallIcon(android.R.drawable.sym_call_incoming)
                .setContentTitle("Incoming call")
                .setContentText(caller)
                .setPriority(NotificationCompat.PRIORITY_MAX)
                .setCategory(NotificationCompat.CATEGORY_CALL)
                .setVisibility(NotificationCompat.VISIBILITY_PUBLIC)
                .setOngoing(true)
                .setAutoCancel(false)
                .setContentIntent(fullScreenPI)
                .setFullScreenIntent(fullScreenPI, true)
                .setStyle(NotificationCompat.CallStyle.forIncomingCall(caller_, declinePI, answerPI));

        Notification n = b.build();
        // Loop the ringtone until the call is answered/declined (a plain
        // notification would play the sound only once).
        n.flags |= Notification.FLAG_INSISTENT;
        try {
            NotificationManagerCompat.from(this).notify(CALL_NOTIF_ID, n);
        } catch (SecurityException e) {
            // POST_NOTIFICATIONS not granted — nothing to show.
        }
    }

    private PendingIntent activityIntent(String action, String caller, int req) {
        Intent i = new Intent(this, MainActivity.class)
                .setAction(action)
                .putExtra("caller", caller)
                .addFlags(Intent.FLAG_ACTIVITY_NEW_TASK | Intent.FLAG_ACTIVITY_SINGLE_TOP);
        return PendingIntent.getActivity(this, req, i,
                PendingIntent.FLAG_UPDATE_CURRENT | PendingIntent.FLAG_IMMUTABLE);
    }

    private void createChannel() {
        if (Build.VERSION.SDK_INT < Build.VERSION_CODES.O) return;
        NotificationManager nm = (NotificationManager) getSystemService(Context.NOTIFICATION_SERVICE);
        if (nm == null || nm.getNotificationChannel(CHANNEL_ID) != null) return;
        NotificationChannel ch = new NotificationChannel(CHANNEL_ID, "Incoming calls", NotificationManager.IMPORTANCE_HIGH);
        ch.setDescription("Ringing for incoming calls");
        ch.setLockscreenVisibility(Notification.VISIBILITY_PUBLIC);
        Uri ring = RingtoneManager.getDefaultUri(RingtoneManager.TYPE_RINGTONE);
        AudioAttributes attrs = new AudioAttributes.Builder()
                .setUsage(AudioAttributes.USAGE_NOTIFICATION_RINGTONE)
                .setContentType(AudioAttributes.CONTENT_TYPE_SONIFICATION).build();
        ch.setSound(ring, attrs);
        ch.enableVibration(true);
        ch.setVibrationPattern(new long[]{0, 1000, 1000});
        nm.createNotificationChannel(ch);
    }
}
