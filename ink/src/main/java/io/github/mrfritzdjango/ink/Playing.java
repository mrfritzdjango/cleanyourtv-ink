package io.github.mrfritzdjango.ink;

import android.database.Cursor;

/**
 * What a music app is playing on the TV, as Today's NowPlaying hands it to the e-ink Home (one row of Today's provider,
 * content://…agenda/now) and to the screensaver. A song paused for {@link #PAUSED_SHOWN_MS} is no longer shown.
 */
public final class Playing {
    public static final String[] COLUMNS = {"title", "artist", "album", "pkg", "playing", "position", "positionAt", "speed",
            "duration", "pausedAt", "cover", "skips", "playlist"};
    public static final long PAUSED_SHOWN_MS = 10 * 60_000L;
    /**
     * The cover's side in samples: one grey level per sample, 0 black to 255 white. A little over one a pixel on Home's
     * largest cover (the Spotify row's, 216 design pixels), so it is sharp there.
     */
    public static final int COVER = 256;
    /** The bits of {@link #skips}. */
    public static final int SKIP_PREVIOUS = 1;
    public static final int SKIP_NEXT = 2;

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
    /** What the app lets Home do now: SKIP_PREVIOUS, SKIP_NEXT, both, or neither (an ad). */
    public final int skips;
    /** The playlist it plays from (the session's queue title); "" when the app does not say. */
    public final String playlist;

    public Playing(String title, String artist, String album, String pkg, boolean playing, long position, long positionAt,
                   float speed, long duration, long pausedAt, byte[] cover, int skips, String playlist) {
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
        this.skips = skips;
        this.playlist = playlist == null ? "" : playlist.trim();
    }

    /** The provider's row, or null when nothing is playing. An older Today has no skips (it cannot skip) and no playlist. */
    public static Playing from(Cursor c) {
        if (c == null || !c.moveToFirst()) return null;
        return new Playing(c.getString(0), c.getString(1), c.getString(2), c.getString(3), c.getInt(4) != 0, c.getLong(5),
                c.getLong(6), c.getFloat(7), c.getLong(8), c.getLong(9), c.isNull(10) ? null : c.getBlob(10),
                c.getColumnCount() > 11 ? c.getInt(11) : 0, c.getColumnCount() > 12 ? c.getString(12) : null);
    }

    public Object[] row() {
        return new Object[] {title, artist, album, pkg, playing ? 1 : 0, position, positionAt, speed, duration, pausedAt, cover, skips, playlist};
    }

    /** Under the artist Home names the playlist; an album, or a queue named like the album, says the album instead. */
    public boolean fromPlaylist() {
        return !playlist.isEmpty() && !playlist.equalsIgnoreCase(album);
    }

    /** The app lets Home skip that way now: SKIP_PREVIOUS or SKIP_NEXT. */
    public boolean canSkip(int which) {
        return (skips & which) != 0;
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
