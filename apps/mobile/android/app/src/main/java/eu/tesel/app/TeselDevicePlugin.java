package eu.tesel.app;

import android.Manifest;
import android.content.Intent;
import android.location.Location;
import android.os.Build;

import androidx.core.app.NotificationManagerCompat;

import com.getcapacitor.JSObject;
import com.getcapacitor.PermissionState;
import com.getcapacitor.Plugin;
import com.getcapacitor.PluginCall;
import com.getcapacitor.PluginMethod;
import com.getcapacitor.annotation.CapacitorPlugin;
import com.getcapacitor.annotation.Permission;
import com.getcapacitor.annotation.PermissionCallback;

import org.json.JSONObject;

/**
 * What the web app asks of Android (apps/web/src/lib/native/tesel-device.ts, ADR-0125): the
 * location, which goes on with the screen off; keeping the app running meanwhile; the
 * notifications of an alarm; and Android's share menu, for what goes to another app.
 */
@CapacitorPlugin(
    name = "TeselDevice",
    permissions = {
        @Permission(
            alias = "location",
            strings = { Manifest.permission.ACCESS_FINE_LOCATION, Manifest.permission.ACCESS_COARSE_LOCATION }
        ),
        @Permission(alias = "notifications", strings = { Manifest.permission.POST_NOTIFICATIONS })
    }
)
public class TeselDevicePlugin extends Plugin {

    private LocationWatch watch;

    @Override
    public void load() {
        Notices.createChannels(getContext());
        watch = new LocationWatch(getContext(), this::sendFix, this::sendProblem);
    }

    /** Starts the location, asking for it first if it is not allowed yet. */
    @PluginMethod
    public void watchLocation(PluginCall call) {
        if (getPermissionState("location") == PermissionState.GRANTED) {
            startWatch(call);
        } else {
            requestPermissionForAlias("location", call, "locationAnswered");
        }
    }

    @PermissionCallback
    private void locationAnswered(PluginCall call) {
        if (getPermissionState("location") == PermissionState.GRANTED) {
            startWatch(call);
        } else {
            sendProblem("denied");
            call.resolve();
        }
    }

    private void startWatch(PluginCall call) {
        if (!watch.start()) sendProblem("unavailable");
        call.resolve();
    }

    @PluginMethod
    public void clearLocation(PluginCall call) {
        watch.stop();
        call.resolve();
    }

    /** Keeps the app running with the screen off, or lets it stop as any app. */
    @PluginMethod
    public void keepRunning(PluginCall call) {
        if (Boolean.TRUE.equals(call.getBoolean("on", false))) {
            ActiveService.start(getContext(), call.getString("title", ""), call.getString("text", ""));
        } else {
            ActiveService.stop(getContext());
        }
        call.resolve();
    }

    @PluginMethod
    public void noticePermission(PluginCall call) {
        resolveNotices(call);
    }

    /** Asks to show notifications, which Android asks for from version 13. */
    @PluginMethod
    public void requestNotices(PluginCall call) {
        boolean asks = Build.VERSION.SDK_INT >= Build.VERSION_CODES.TIRAMISU;
        if (asks && getPermissionState("notifications") != PermissionState.GRANTED) {
            requestPermissionForAlias("notifications", call, "noticesAnswered");
        } else {
            resolveNotices(call);
        }
    }

    @PermissionCallback
    private void noticesAnswered(PluginCall call) {
        resolveNotices(call);
    }

    private void resolveNotices(PluginCall call) {
        JSObject result = new JSObject();
        result.put("state", noticeState());
        call.resolve(result);
    }

    /** As the browser says it: granted, denied for good, or not asked yet. */
    private String noticeState() {
        if (NotificationManagerCompat.from(getContext()).areNotificationsEnabled()) return "granted";
        if (Build.VERSION.SDK_INT < Build.VERSION_CODES.TIRAMISU) return "denied";
        return getPermissionState("notifications") == PermissionState.DENIED ? "denied" : "default";
    }

    /** An alarm's notification, unless the app is on screen, where the alarm shows already. */
    @PluginMethod
    public void alarm(PluginCall call) {
        if (!getBridge().getApp().isActive()) {
            Notices.alarm(getContext(), call.getString("title", ""), call.getString("body", ""), call.getString("tag", ""));
        }
        call.resolve();
    }

    /** Android's share menu with a text, to send by WhatsApp, SMS or any other app. */
    @PluginMethod
    public void share(PluginCall call) {
        Intent send = new Intent(Intent.ACTION_SEND)
            .setType("text/plain")
            .putExtra(Intent.EXTRA_TEXT, call.getString("text", ""));
        getActivity().startActivity(Intent.createChooser(send, null));
        call.resolve();
    }

    private void sendFix(Location location) {
        JSObject fix = new JSObject();
        fix.put("lat", location.getLatitude());
        fix.put("lon", location.getLongitude());
        fix.put("accuracy", location.hasAccuracy() ? (Object) location.getAccuracy() : JSONObject.NULL);
        fix.put("heading", location.hasBearing() ? (Object) location.getBearing() : JSONObject.NULL);
        fix.put("speed", location.hasSpeed() ? (Object) location.getSpeed() : JSONObject.NULL);
        fix.put("time", location.getTime());
        notifyListeners("fix", fix);
    }

    private void sendProblem(String problem) {
        JSObject data = new JSObject();
        data.put("problem", problem);
        notifyListeners("fixProblem", data);
    }

    @Override
    protected void handleOnDestroy() {
        watch.stop();
    }
}
