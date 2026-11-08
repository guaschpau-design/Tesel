package eu.tesel.app;

import android.annotation.SuppressLint;
import android.app.Notification;
import android.app.NotificationChannel;
import android.app.NotificationManager;
import android.app.PendingIntent;
import android.content.Context;
import android.content.Intent;
import android.media.AudioAttributes;
import android.media.RingtoneManager;
import android.os.Build;

import androidx.core.app.NotificationCompat;
import androidx.core.app.NotificationManagerCompat;

/**
 * The app's notifications (ADR-0125): the quiet, ongoing one while it keeps running with the
 * screen off, and an alarm's, which sounds as an alarm and vibrates. A tap on either opens the app.
 */
final class Notices {

    private static final String RUNNING = "running";
    private static final String ALARMS = "alarms";
    private static final int ALARM_ID = 2;
    private static final long[] VIBRATION_MS = { 0, 300, 150, 300, 150, 300 };

    private Notices() {}

    static void createChannels(Context context) {
        if (Build.VERSION.SDK_INT < Build.VERSION_CODES.O) return;
        NotificationManager manager = context.getSystemService(NotificationManager.class);
        NotificationChannel running = new NotificationChannel(
            RUNNING,
            context.getString(R.string.channel_running),
            NotificationManager.IMPORTANCE_LOW
        );
        running.setShowBadge(false);
        NotificationChannel alarms = new NotificationChannel(
            ALARMS,
            context.getString(R.string.channel_alarms),
            NotificationManager.IMPORTANCE_HIGH
        );
        alarms.enableVibration(true);
        alarms.setVibrationPattern(VIBRATION_MS);
        AudioAttributes alarm = new AudioAttributes.Builder()
            .setUsage(AudioAttributes.USAGE_ALARM)
            .setContentType(AudioAttributes.CONTENT_TYPE_SONIFICATION)
            .build();
        alarms.setSound(RingtoneManager.getDefaultUri(RingtoneManager.TYPE_ALARM), alarm);
        manager.createNotificationChannel(running);
        manager.createNotificationChannel(alarms);
    }

    static Notification running(Context context, String title, String text) {
        return new NotificationCompat.Builder(context, RUNNING)
            .setSmallIcon(R.drawable.ic_stat_tesel)
            .setContentTitle(title)
            .setContentText(text)
            .setOngoing(true)
            .setCategory(NotificationCompat.CATEGORY_SERVICE)
            .setPriority(NotificationCompat.PRIORITY_LOW)
            .setContentIntent(openApp(context))
            .build();
    }

    /** An alarm, one per tag: a newer one with the same tag replaces it. */
    @SuppressLint("MissingPermission")
    static void alarm(Context context, String title, String body, String tag) {
        NotificationManagerCompat manager = NotificationManagerCompat.from(context);
        if (!manager.areNotificationsEnabled()) return;
        Notification notification = new NotificationCompat.Builder(context, ALARMS)
            .setSmallIcon(R.drawable.ic_stat_tesel)
            .setContentTitle(title)
            .setContentText(body)
            .setStyle(new NotificationCompat.BigTextStyle().bigText(body))
            .setCategory(NotificationCompat.CATEGORY_ALARM)
            .setPriority(NotificationCompat.PRIORITY_MAX)
            .setVibrate(VIBRATION_MS)
            .setAutoCancel(true)
            .setContentIntent(openApp(context))
            .build();
        manager.notify(tag, ALARM_ID, notification);
    }

    /** Brings the app back as it was. */
    private static PendingIntent openApp(Context context) {
        Intent intent = new Intent(context, MainActivity.class).setFlags(Intent.FLAG_ACTIVITY_SINGLE_TOP);
        return PendingIntent.getActivity(context, 0, intent, PendingIntent.FLAG_IMMUTABLE | PendingIntent.FLAG_UPDATE_CURRENT);
    }
}
