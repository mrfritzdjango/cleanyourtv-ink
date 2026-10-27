package io.github.mrfritzdjango.morningboard;

import io.github.mrfritzdjango.ink.Playing;
import io.github.mrfritzdjango.ink.Watched;

import android.content.ComponentName;
import android.content.Context;
import android.content.SharedPreferences;
import android.content.pm.PackageManager;
import android.graphics.Bitmap;
import android.media.MediaMetadata;
import android.media.session.MediaController;
import android.media.session.MediaSessionManager;
import android.media.session.PlaybackState;
import android.net.Uri;
import android.os.Handler;
import android.os.Looper;
import android.os.SystemClock;
import android.service.notification.NotificationListenerService;
import android.util.Base64;

import java.util.ArrayList;
import java.util.Arrays;
import java.util.Collections;
import java.util.List;

/**
 * What Spotify (or another app in now_playing_apps) is playing on the TV, for the e-ink Home's block and the
 * screensaver's, and the last show watched in each app in watch_apps (YouTube, Netflix…), kept for Home's LAST WATCHED.
 * Android lets only a notification listener follow other apps' media sessions, so this is one; it never
 * reads a notification. Turned on once over ADB (the README): cmd notification allow_listener
 * io.github.mrfritzdjango.morningboard/.NowPlaying. Android calls it when a song or its state changes; nothing polls.
 */
public final class NowPlaying extends NotificationListenerService {
    static final Uri URI = Uri.parse("content://" + AgendaProvider.AUTHORITY + "/now");
    static final Uri WATCHED_URI = Uri.parse("content://" + AgendaProvider.AUTHORITY + "/watched");
    /** A show counts as watched this far in, so a trailer an app plays by itself on its front page does not. */
    private static final long WATCHED_AFTER_MS = 60_000;

    /** The last song, null when nothing is playing; read by the provider (a binder thread) and the screensaver. */
    private static volatile Playing current;
    private static volatile MediaController followed;

    private final Handler main = new Handler(Looper.getMainLooper());
    private final MediaSessionManager.OnActiveSessionsChangedListener changed = this::follow;
    private final MediaController.Callback callback = new MediaController.Callback() {
        @Override
        public void onPlaybackStateChanged(PlaybackState state) {
            publish();
        }

        @Override
        public void onMetadataChanged(MediaMetadata metadata) {
            publish();
        }

        @Override
        public void onSessionDestroyed() {
            follow(active());
        }
    };
    private final MediaController.Callback watchCallback = new MediaController.Callback() {
        @Override
        public void onPlaybackStateChanged(PlaybackState state) {
            remember();
        }

        @Override
        public void onMetadataChanged(MediaMetadata metadata) {
            remember();
        }

        @Override
        public void onSessionDestroyed() {
            remember();
            follow(active());
        }
    };
    private MediaSessionManager sessions;
    private MediaController controller;
    /** The streaming app's session followed for LAST WATCHED, with its last metadata and state (kept for when it goes). */
    private MediaController watching;
    private MediaMetadata watchMeta;
    private PlaybackState watchState;
    private Bitmap frameOf;
    private byte[] frame;
    private Bitmap coverOf;
    private byte[] cover;
    private long pausedAt;

    static Playing current() {
        return current;
    }

    /** Home's hold-OK on the Spotify row (TransportReceiver): pause what plays, or play what is paused. */
    static void toggle() {
        MediaController c = followed;
        if (c == null) return;
        if (playing(c)) c.getTransportControls().pause();
        else c.getTransportControls().play();
    }

    /**
     * Home's Left and Right on the Spotify row: the song before, or the next one. Spotify's own rule: Left three seconds
     * or more into a song goes back to its start.
     */
    static void skip(boolean next) {
        MediaController c = followed;
        if (c == null) return;
        if (next) c.getTransportControls().skipToNext();
        else c.getTransportControls().skipToPrevious();
    }

    @Override
    public void onListenerConnected() {
        sessions = getSystemService(MediaSessionManager.class);
        try {
            sessions.addOnActiveSessionsChangedListener(changed, me(), main);
        } catch (SecurityException e) {
            return;   // not allowed after all: no block
        }
        follow(active());
    }

    @Override
    public void onListenerDisconnected() {
        if (sessions != null) sessions.removeOnActiveSessionsChangedListener(changed);
        follow(Collections.emptyList());
    }

    private ComponentName me() {
        return new ComponentName(this, NowPlaying.class);
    }

    private List<MediaController> active() {
        try {
            return sessions == null ? Collections.emptyList() : sessions.getActiveSessions(me());
        } catch (SecurityException e) {
            return Collections.emptyList();
        }
    }

    /** Follows the session of an app in now_playing_apps, a playing one before a paused one. */
    private void follow(List<MediaController> list) {
        List<String> apps = Arrays.asList(getResources().getStringArray(R.array.now_playing_apps));
        MediaController pick = null;
        for (MediaController c : list) {
            if (!apps.contains(c.getPackageName())) continue;
            if (pick == null || playing(c) && !playing(pick)) pick = c;
        }
        boolean same = pick != null && controller != null && pick.getSessionToken().equals(controller.getSessionToken());
        if (!same) {
            if (controller != null) controller.unregisterCallback(callback);
            controller = pick;
            followed = pick;
            pausedAt = 0;
            if (pick != null) pick.registerCallback(callback, main);
        }
        publish();
        List<String> shows = Arrays.asList(getResources().getStringArray(R.array.watch_apps));
        MediaController show = null;
        for (MediaController c : list) {
            if (!shows.contains(c.getPackageName())) continue;
            if (show == null || playing(c) && !playing(show)) show = c;
        }
        if (show != null && watching != null && show.getSessionToken().equals(watching.getSessionToken())) return;
        if (watching != null) {
            remember();   // where the old one got to, before letting it go
            watching.unregisterCallback(watchCallback);
        }
        watching = show;
        watchMeta = null;
        watchState = null;
        if (show != null) {
            show.registerCallback(watchCallback, main);
            remember();
        }
    }

    private static boolean playing(MediaController c) {
        PlaybackState s = c.getPlaybackState();
        int state = s == null ? PlaybackState.STATE_NONE : s.getState();
        // between two songs the state is buffering or skipping for a moment: still playing, so the block stays
        return state == PlaybackState.STATE_PLAYING || state == PlaybackState.STATE_BUFFERING
                || state == PlaybackState.STATE_SKIPPING_TO_NEXT || state == PlaybackState.STATE_SKIPPING_TO_PREVIOUS;
    }

    /** Keeps the followed song as a Playing and tells Home it changed. */
    private void publish() {
        MediaController c = controller;
        MediaMetadata m = c == null ? null : c.getMetadata();
        String title = m == null ? null : first(m, MediaMetadata.METADATA_KEY_TITLE, MediaMetadata.METADATA_KEY_DISPLAY_TITLE);
        Playing p = null;
        PlaybackState s = c == null ? null : c.getPlaybackState();
        boolean on = c != null && playing(c);
        // stopped, idle (NONE: Spotify keeps its last song after it stops) or an error: nothing to show
        if (title != null && (on || s != null && s.getState() == PlaybackState.STATE_PAUSED)) {
            if (on) pausedAt = 0;
            else if (pausedAt == 0) pausedAt = System.currentTimeMillis();
            Bitmap art = art(m);
            if (art != coverOf) {   // a new picture: often a moment after the song's title
                coverOf = art;
                cover = grey(art, Playing.COVER, Playing.COVER);
            }
            p = new Playing(title,
                    first(m, MediaMetadata.METADATA_KEY_ARTIST, MediaMetadata.METADATA_KEY_ALBUM_ARTIST, MediaMetadata.METADATA_KEY_DISPLAY_SUBTITLE),
                    first(m, MediaMetadata.METADATA_KEY_ALBUM),
                    c.getPackageName(), on,
                    s == null ? 0 : s.getPosition(),
                    s == null ? SystemClock.elapsedRealtime() : s.getLastPositionUpdateTime(),
                    s == null ? 1f : s.getPlaybackSpeed(),
                    Math.max(0, m.getLong(MediaMetadata.METADATA_KEY_DURATION)),
                    pausedAt, cover, skips(s));
        }
        current = p;
        getContentResolver().notifyChange(URI, null);
    }

    /** What the app lets Home skip to now, as Playing's bits; an ad takes both away. */
    private static int skips(PlaybackState s) {
        long actions = s == null ? 0 : s.getActions();
        return ((actions & PlaybackState.ACTION_SKIP_TO_PREVIOUS) != 0 ? Playing.SKIP_PREVIOUS : 0)
                | ((actions & PlaybackState.ACTION_SKIP_TO_NEXT) != 0 ? Playing.SKIP_NEXT : 0);
    }

    /** The last show or video watched in each app in watch_apps, kept in Today's prefs under "watched.<package>.". */
    static List<Watched> watched(Context context) {
        SharedPreferences p = Store.prefs(context);
        List<Watched> out = new ArrayList<>();
        for (String pkg : context.getResources().getStringArray(R.array.watch_apps)) {
            String k = "watched." + pkg + ".";
            String title = p.getString(k + "title", null);
            if (title == null) continue;
            String f = p.getString(k + "frame", null);
            out.add(new Watched(title, p.getString(k + "episode", ""), p.getString(k + "app", ""), pkg,
                    p.getLong(k + "at", 0), f == null ? null : Base64.decode(f, Base64.NO_WRAP)));
        }
        return out;
    }

    /** Keeps the followed streaming app's show as that app's last watched, once it is WATCHED_AFTER_MS in, and tells Home. */
    private void remember() {
        MediaController c = watching;
        if (c == null) return;
        MediaMetadata m = c.getMetadata();
        if (m != null) watchMeta = m;
        else m = watchMeta;
        PlaybackState s = c.getPlaybackState();
        if (s != null) watchState = s;
        else s = watchState;
        String title = m == null ? null : first(m, MediaMetadata.METADATA_KEY_TITLE, MediaMetadata.METADATA_KEY_DISPLAY_TITLE);
        if (title == null || s == null) return;
        int state = s.getState();
        if (state != PlaybackState.STATE_PLAYING && state != PlaybackState.STATE_PAUSED && state != PlaybackState.STATE_BUFFERING) return;
        long at = s.getPosition();
        if (state == PlaybackState.STATE_PLAYING) at += (long) ((SystemClock.elapsedRealtime() - s.getLastPositionUpdateTime()) * s.getPlaybackSpeed());
        if (at < WATCHED_AFTER_MS) return;
        Bitmap art = art(m);
        if (art != frameOf) {
            frameOf = art;
            frame = grey(art, Watched.FRAME_W, Watched.FRAME_H);
        }
        String pkg = c.getPackageName();
        String k = "watched." + pkg + ".";
        Store.prefs(this).edit()
                .putString(k + "title", title)
                .putString(k + "episode", first(m, MediaMetadata.METADATA_KEY_DISPLAY_SUBTITLE, MediaMetadata.METADATA_KEY_ARTIST,
                        MediaMetadata.METADATA_KEY_ALBUM))
                .putString(k + "app", label(pkg))
                .putLong(k + "at", System.currentTimeMillis())
                .putString(k + "frame", frame == null ? null : Base64.encodeToString(frame, Base64.NO_WRAP))
                .apply();
        getContentResolver().notifyChange(WATCHED_URI, null);
    }

    private String label(String pkg) {
        PackageManager pm = getPackageManager();
        try {
            return pm.getApplicationLabel(pm.getApplicationInfo(pkg, 0)).toString();
        } catch (PackageManager.NameNotFoundException e) {
            return "";
        }
    }

    private static String first(MediaMetadata m, String... keys) {
        for (String k : keys) {
            CharSequence v = m.getText(k);
            if (v != null && v.length() > 0) return v.toString();
        }
        return null;
    }

    private static Bitmap art(MediaMetadata m) {
        Bitmap b = m.getBitmap(MediaMetadata.METADATA_KEY_ALBUM_ART);
        if (b == null) b = m.getBitmap(MediaMetadata.METADATA_KEY_ART);
        if (b == null) b = m.getBitmap(MediaMetadata.METADATA_KEY_DISPLAY_ICON);
        return b;
    }

    /** The picture as w × h grey levels, its middle cut to that shape; null without a picture. */
    private static byte[] grey(Bitmap b, int w, int h) {
        if (b == null) return null;
        try {
            Bitmap soft = b.getConfig() == Bitmap.Config.HARDWARE ? b.copy(Bitmap.Config.ARGB_8888, false) : b;
            int cw = Math.min(soft.getWidth(), soft.getHeight() * w / h), ch = Math.min(soft.getHeight(), soft.getWidth() * h / w);
            Bitmap cut = Bitmap.createBitmap(soft, (soft.getWidth() - cw) / 2, (soft.getHeight() - ch) / 2, Math.max(1, cw), Math.max(1, ch));
            Bitmap small = Bitmap.createScaledBitmap(cut, w, h, true);
            int[] px = new int[w * h];
            small.getPixels(px, 0, w, 0, 0, w, h);
            byte[] out = new byte[px.length];
            for (int i = 0; i < px.length; i++) out[i] = (byte) Playing.grey(px[i]);
            return out;
        } catch (RuntimeException e) {
            return null;   // a picture Android cannot read back: an empty square
        }
    }
}
