package eu.tesel.app;

import android.annotation.SuppressLint;
import android.content.Context;
import android.location.Location;
import android.location.LocationListener;
import android.location.LocationManager;
import android.location.LocationRequest;
import android.os.Build;
import android.os.Looper;
import android.os.PowerManager;

import androidx.annotation.NonNull;
import androidx.core.content.ContextCompat;

import java.util.function.Consumer;

/**
 * Android's location, as precise as it gets, a fix a second at most (ADR-0125). From Android 12,
 * its fused provider, which mixes the GPS with Wi-Fi and the network without Google's services;
 * before, the GPS and the network both. Each fix keeps the processor awake a moment, so that the
 * web app takes it in and sends it with the screen off.
 */
final class LocationWatch implements LocationListener {

    private static final long INTERVAL_MS = 1000;
    /** How long a fix keeps the processor awake for the web app to handle it. */
    private static final long HANDLE_MS = 5000;

    private final Context context;
    private final LocationManager manager;
    private final Consumer<Location> onFix;
    private final Consumer<String> onProblem;
    private final PowerManager.WakeLock awake;
    private boolean running = false;

    LocationWatch(Context context, Consumer<Location> onFix, Consumer<String> onProblem) {
        this.context = context;
        this.manager = (LocationManager) context.getSystemService(Context.LOCATION_SERVICE);
        this.onFix = onFix;
        this.onProblem = onProblem;
        PowerManager power = (PowerManager) context.getSystemService(Context.POWER_SERVICE);
        this.awake = power.newWakeLock(PowerManager.PARTIAL_WAKE_LOCK, "tesel:fix");
        this.awake.setReferenceCounted(false);
    }

    /** Starts the location; false if Android has it off. Call only with the permission granted. */
    @SuppressLint("MissingPermission")
    boolean start() {
        if (running) return true;
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.S && manager.isProviderEnabled(LocationManager.FUSED_PROVIDER)) {
            LocationRequest request = new LocationRequest.Builder(INTERVAL_MS).setQuality(LocationRequest.QUALITY_HIGH_ACCURACY).build();
            manager.requestLocationUpdates(LocationManager.FUSED_PROVIDER, request, ContextCompat.getMainExecutor(context), this);
            running = true;
            return true;
        }
        for (String provider : new String[] { LocationManager.GPS_PROVIDER, LocationManager.NETWORK_PROVIDER }) {
            if (manager.isProviderEnabled(provider)) {
                manager.requestLocationUpdates(provider, INTERVAL_MS, 0f, this, Looper.getMainLooper());
                running = true;
            }
        }
        return running;
    }

    void stop() {
        if (!running) return;
        manager.removeUpdates(this);
        running = false;
        if (awake.isHeld()) awake.release();
    }

    @Override
    public void onLocationChanged(@NonNull Location location) {
        awake.acquire(HANDLE_MS);
        onFix.accept(location);
    }

    @Override
    public void onProviderDisabled(@NonNull String provider) {
        onProblem.accept("unavailable");
    }
}
