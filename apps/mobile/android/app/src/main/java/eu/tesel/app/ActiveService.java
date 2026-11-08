package eu.tesel.app;

import android.Manifest;
import android.app.Notification;
import android.app.Service;
import android.content.Context;
import android.content.Intent;
import android.content.pm.PackageManager;
import android.content.pm.ServiceInfo;
import android.os.Build;
import android.os.IBinder;
import android.util.Log;

import androidx.core.app.ServiceCompat;
import androidx.core.content.ContextCompat;

/**
 * Keeps the app, and the web app in it, running with the screen off, with Android's ongoing
 * notification saying why (ADR-0125): for the location while it is used, and for a radio linked
 * by Bluetooth. It is only as much as those two allow: without either permission it does not
 * start, and the app stops in the background as a web page does. Closing the app stops it.
 */
public class ActiveService extends Service {

    private static final String TAG = "TeselActive";
    private static final String EXTRA_TITLE = "title";
    private static final String EXTRA_TEXT = "text";
    private static final int NOTIFICATION_ID = 1;

    /** Starts it, or changes what its notification says. */
    static void start(Context context, String title, String text) {
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.Q && allowedTypes(context) == 0) return;
        Intent intent = new Intent(context, ActiveService.class).putExtra(EXTRA_TITLE, title).putExtra(EXTRA_TEXT, text);
        ContextCompat.startForegroundService(context, intent);
    }

    static void stop(Context context) {
        context.stopService(new Intent(context, ActiveService.class));
    }

    @Override
    public int onStartCommand(Intent intent, int flags, int startId) {
        String title = intent == null ? null : intent.getStringExtra(EXTRA_TITLE);
        String text = intent == null ? null : intent.getStringExtra(EXTRA_TEXT);
        Notification notification = Notices.running(this, title == null ? "" : title, text == null ? "" : text);
        try {
            int types = Build.VERSION.SDK_INT >= Build.VERSION_CODES.Q ? allowedTypes(this) : 0;
            ServiceCompat.startForeground(this, NOTIFICATION_ID, notification, types);
        } catch (RuntimeException refused) {
            // Android refuses a service it would not let run from where the app is now.
            Log.w(TAG, "The app could not keep running", refused);
            stopSelf();
        }
        return START_NOT_STICKY;
    }

    /** The kinds of work the app may keep running for: what its permissions allow. */
    private static int allowedTypes(Context context) {
        int types = 0;
        if (granted(context, Manifest.permission.ACCESS_FINE_LOCATION) || granted(context, Manifest.permission.ACCESS_COARSE_LOCATION)) {
            types |= ServiceInfo.FOREGROUND_SERVICE_TYPE_LOCATION;
        }
        if (Build.VERSION.SDK_INT < Build.VERSION_CODES.S || granted(context, Manifest.permission.BLUETOOTH_CONNECT)) {
            types |= ServiceInfo.FOREGROUND_SERVICE_TYPE_CONNECTED_DEVICE;
        }
        return types;
    }

    private static boolean granted(Context context, String permission) {
        return ContextCompat.checkSelfPermission(context, permission) == PackageManager.PERMISSION_GRANTED;
    }

    /** Closed from the recent apps, the app stops: nothing is left running for it. */
    @Override
    public void onTaskRemoved(Intent rootIntent) {
        stopSelf();
    }

    @Override
    public IBinder onBind(Intent intent) {
        return null;
    }
}
