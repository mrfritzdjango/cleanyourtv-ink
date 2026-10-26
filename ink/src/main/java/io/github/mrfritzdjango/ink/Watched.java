package io.github.mrfritzdjango.ink;

import android.database.Cursor;

import java.util.ArrayList;
import java.util.List;

/**
 * The last show or video watched in one streaming app (YouTube, Netflix…), as Today's NowPlaying keeps it and hands it
 * to the e-ink Home (one row per app in Today's provider, content://…agenda/watched). Home shows it at the top right
 * while that app's row is selected, for {@link #SHOWN_MS} after it was last watched.
 */
public final class Watched {
    public static final String[] COLUMNS = {"title", "episode", "app", "pkg", "at", "frame"};
    public static final long SHOWN_MS = 7 * 24 * 3600_000L;
    /** The frame's size in samples, 16:9: one grey level per sample, 0 black to 255 white. */
    public static final int FRAME_W = 64;
    public static final int FRAME_H = 36;

    public final String title;
    /** The episode or channel when the app says, else "". */
    public final String episode;
    /** The app's name, as the TV shows it. */
    public final String app;
    public final String pkg;
    /** When it was last watched (wall clock). */
    public final long at;
    /** FRAME_W × FRAME_H grey levels, or null when the app gives no picture. */
    public final byte[] frame;

    public Watched(String title, String episode, String app, String pkg, long at, byte[] frame) {
        this.title = title == null ? "" : title;
        this.episode = episode == null ? "" : episode;
        this.app = app == null ? "" : app;
        this.pkg = pkg == null ? "" : pkg;
        this.at = at;
        this.frame = frame;
    }

    /** The provider's rows, one per app that has something watched. */
    public static List<Watched> all(Cursor c) {
        List<Watched> out = new ArrayList<>();
        if (c == null) return out;
        while (c.moveToNext()) {
            out.add(new Watched(c.getString(0), c.getString(1), c.getString(2), c.getString(3), c.getLong(4),
                    c.isNull(5) ? null : c.getBlob(5)));
        }
        return out;
    }

    public Object[] row() {
        return new Object[] {title, episode, app, pkg, at, frame};
    }

    /** Still worth showing at now (wall clock): watched less than SHOWN_MS ago. */
    public boolean shownAt(long now) {
        return !title.isEmpty() && now - at < SHOWN_MS;
    }

    /** The block's second line: "S2 E3 · Netflix", or the app alone. */
    public String line() {
        if (episode.isEmpty() || episode.equals(title)) return app;
        return app.isEmpty() ? episode : episode + " · " + app;
    }
}
