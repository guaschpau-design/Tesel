package eu.tesel.app;

import android.content.Intent;
import android.net.Uri;

import com.getcapacitor.BridgeActivity;

/**
 * Tesel's one screen: the web app (apps/web), which Capacitor serves from the app's own files
 * (ADR-0124). An invitation link (protocol §6) that Android hands over, from a QR code or a
 * message, opens as the web app opens it in a browser: at its join path, with the token after the
 * "#" as it came.
 */
public class MainActivity extends BridgeActivity {

    /** Where invitations point: the web app on the internet (VITE_PUBLIC_APP_URL). */
    private static final String INVITATION_HOST = "tesel.eu";
    private static final String INVITATION_PATH = "/app/join";

    /** Also called with the intent that started the app, once the web view is there. */
    @Override
    protected void onNewIntent(Intent intent) {
        super.onNewIntent(intent);
        Uri link = intent == null ? null : intent.getData();
        if (bridge == null || !isInvitation(link)) return;
        Uri join = Uri.parse(bridge.getLocalUrl())
            .buildUpon()
            .path("/join")
            .encodedFragment(link.getEncodedFragment())
            .build();
        bridge.getWebView().loadUrl(join.toString());
    }

    /** An https link to the join path at tesel.eu, with or without a slash after it. */
    private static boolean isInvitation(Uri link) {
        if (link == null || !"https".equals(link.getScheme())) return false;
        if (!INVITATION_HOST.equals(link.getHost())) return false;
        String path = link.getPath();
        return INVITATION_PATH.equals(path) || (INVITATION_PATH + "/").equals(path);
    }
}
