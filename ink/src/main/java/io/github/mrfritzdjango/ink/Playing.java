package io.github.mrfritzdjango.ink;

import android.database.Cursor;

/**
 * What a music app is playing on the TV, as Today's NowPlaying hands it to the e-ink Home (one row of Today's provider,
 * content://…agenda/now) and to the screensaver. A song paused for {@link #PAUSED_SHOWN_MS} is no longer shown.
 */
public final class Playing {
    public static final String[] COLUMNS = {"title", "artist", "album", "pkg", "playing", "position", "positionAt", "speed",
            "duration", "pausedAt", "cover"};
    public static final long PAUSED_SHOWN_MS = 10 * 60_000L;
    /** The cover's side in samples: one grey level per sample, 0 black to 255 white. */
    public static final int COVER = 48;

    public final String title;
    public final String artist;
    public final String album;
    /** The app playing it, so Home knows which row is its. */
    public final String pkg;
    public final boolean playing;
    /** Milliseconds into the song, at positionAt (SystemClock.elapsedRealtime()). */
    public final long position;
    public final long positionAt;
    public final float speed;
    /** 0 when the app does not say. */
    public final long duration;
    /** When it was paused (wall clock); 0 while it plays. */
    public final long pausedAt;
    /** COVER × COVER grey levels, or null when the app gives no picture. */
    public final byte[] cover;

    public Playing(String title, String artist, String album, String pkg, boolean playing, long position, long positionAt,
                   float speed, long duration, long pausedAt, byte[] cover) {
        this.title = title == null ? "" : title;
        this.artist = artist == null ? "" : artist;
        this.album = album == null ? "" : album;
        this.pkg = pkg == null ? "" : pkg;
        this.playing = playing;
        this.position = position;
        this.positionAt = positionAt;
        this.speed = speed;
        this.duration = duration;
        this.pausedAt = pausedAt;
        this.cover = cover;
    }

    /** The provider's row, or null when nothing is playing. */
    public static Playing from(Cursor c) {
        if (c == null || !c.moveToFirst()) return null;
        return new Playing(c.getString(0), c.getString(1), c.getString(2), c.getString(3), c.getInt(4) != 0, c.getLong(5),
                c.getLong(6), c.getFloat(7), c.getLong(8), c.getLong(9), c.isNull(10) ? null : c.getBlob(10));
    }

    public Object[] row() {
        return new Object[] {title, artist, album, pkg, playing ? 1 : 0, position, positionAt, speed, duration, pausedAt, cover};
    }

    /** Still worth showing at now (wall clock): playing, or paused less than PAUSED_SHOWN_MS ago. */
    public boolean shownAt(long now) {
        return !title.isEmpty() && (playing || now - pausedAt < PAUSED_SHOWN_MS);
    }

    /** Where the song is at elapsed (SystemClock.elapsedRealtime()), within its length. */
    public long positionAt(long elapsed) {
        long p = playing ? position + (long) ((elapsed - positionAt) * speed) : position;
        if (duration > 0) p = Math.min(p, duration);
        return Math.max(0, p);
    }

    /** "2:14", or "1:02:03" past an hour. */
    public static String time(long ms) {
        long s = Math.max(0, ms) / 1000;
        long h = s / 3600, m = s / 60 % 60, sec = s % 60;
        String tail = (sec < 10 ? ":0" : ":") + sec;
        return h > 0 ? h + (m < 10 ? ":0" : ":") + m + tail : m + tail;
    }

    /** The grey level of an ARGB colour, 0 to 255. */
    public static int grey(int argb) {
        int r = argb >> 16 & 0xFF, g = argb >> 8 & 0xFF, b = argb & 0xFF;
        return (r * 299 + g * 587 + b * 114) / 1000;
    }
}
