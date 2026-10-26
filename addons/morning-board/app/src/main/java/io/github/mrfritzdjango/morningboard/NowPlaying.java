package io.github.mrfritzdjango.morningboard;

import io.github.mrfritzdjango.ink.Playing;

import android.content.ComponentName;
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

import java.util.Arrays;
import java.util.Collections;
import java.util.List;

/**
 * What Spotify (or another app in now_playing_apps) is playing on the TV, for the e-ink Home's block and the
 * screensaver's. Android lets only a notification listener follow other apps' media sessions, so this is one; it never
 * reads a notification. Turned on once over ADB (the README): cmd notification allow_listener
 * io.github.mrfritzdjango.morningboard/.NowPlaying. Android calls it when a song or its state changes; nothing polls.
 */
public final class NowPlaying extends NotificationListenerService {
    static final Uri URI = Uri.parse("content://" + AgendaProvider.AUTHORITY + "/now");

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
    private MediaSessionManager sessions;
    private MediaController controller;
    private Bitmap coverOf;
    private byte[] cover;
    private long pausedAt;

    static Playing current() {
        return current;
    }

    /** Home's hold-OK on the Spotify row (PlayPauseReceiver): pause what plays, or play what is paused. */
    static void toggle() {
        MediaController c = followed;
        if (c == null) return;
        if (playing(c)) c.getTransportControls().pause();
        else c.getTransportControls().play();
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
                cover = grey(art);
            }
            p = new Playing(title,
                    first(m, MediaMetadata.METADATA_KEY_ARTIST, MediaMetadata.METADATA_KEY_ALBUM_ARTIST, MediaMetadata.METADATA_KEY_DISPLAY_SUBTITLE),
                    first(m, MediaMetadata.METADATA_KEY_ALBUM),
                    c.getPackageName(), on,
                    s == null ? 0 : s.getPosition(),
                    s == null ? SystemClock.elapsedRealtime() : s.getLastPositionUpdateTime(),
                    s == null ? 1f : s.getPlaybackSpeed(),
                    Math.max(0, m.getLong(MediaMetadata.METADATA_KEY_DURATION)),
                    pausedAt, cover);
        }
        current = p;
        getContentResolver().notifyChange(URI, null);
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

    /** The cover as Playing.COVER × Playing.COVER grey levels; null without a picture. */
    private static byte[] grey(Bitmap b) {
        if (b == null) return null;
        try {
            Bitmap soft = b.getConfig() == Bitmap.Config.HARDWARE ? b.copy(Bitmap.Config.ARGB_8888, false) : b;
            Bitmap small = Bitmap.createScaledBitmap(soft, Playing.COVER, Playing.COVER, true);
            int[] px = new int[Playing.COVER * Playing.COVER];
            small.getPixels(px, 0, Playing.COVER, 0, 0, Playing.COVER, Playing.COVER);
            byte[] out = new byte[px.length];
            for (int i = 0; i < px.length; i++) out[i] = (byte) Playing.grey(px[i]);
            return out;
        } catch (RuntimeException e) {
            return null;   // a picture Android cannot read back: an empty square
        }
    }
}
