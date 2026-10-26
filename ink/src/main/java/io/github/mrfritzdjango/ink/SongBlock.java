package io.github.mrfritzdjango.ink;

import android.content.Context;
import android.graphics.Typeface;
import android.text.TextUtils;
import android.util.TypedValue;
import android.view.Gravity;
import android.view.ViewGroup;
import android.widget.LinearLayout;
import android.widget.TextView;

/**
 * The now-playing block at the top right of the e-ink Home and the screensaver: the cover in shades of ink on the left, and
 * to its right NOW PLAYING (PAUSED once paused) after three bars that move while it plays, the song and the artist. On Home, with a streaming app's row selected,
 * it shows that app's last show instead: a 16:9 frame, LAST WATCHED, the title and the episode with its app. No border; gone when nothing
 * is shown.
 */
public final class SongBlock extends LinearLayout {
    /** Design pixels (1920 wide): the cover's side, the text sizes. */
    private static final float COVER_PX = 76;
    /** The video frame: as tall as the cover, in its own 16:9. */
    private static final float FRAME_PX = COVER_PX * Watched.FRAME_W / Watched.FRAME_H;

    private final float scale;
    private final CoverView cover;
    private final PlayingBars bars;
    private final TextView label;
    private final TextView song;
    private final TextView artist;
    private Playing shown;
    private Watched shownWatched;
    /** The cover is the video's 16:9 frame. */
    private boolean wide;
    private int shownInk;

    public SongBlock(Context context, Typeface regular, Typeface bold, float scale) {
        super(context);
        this.scale = scale;
        setOrientation(HORIZONTAL);
        setGravity(Gravity.CENTER_VERTICAL);
        cover = new CoverView(context);
        addView(cover, new LayoutParams(px(COVER_PX), px(COVER_PX)));
        LinearLayout words = new LinearLayout(context);
        words.setOrientation(VERTICAL);
        label = text(15, bold);
        label.setLetterSpacing(0.12f);
        // the bars stand on the label's line, as tall as its capitals and a bit, 10 px before it
        LinearLayout line = new LinearLayout(context);
        line.setOrientation(HORIZONTAL);
        line.setGravity(Gravity.CENTER_VERTICAL);
        bars = new PlayingBars(context);
        LayoutParams bp = new LayoutParams(px(3 * PlayingBars.BAR_PX + 2 * PlayingBars.GAP_PX), px(16));
        bp.rightMargin = px(10);
        line.addView(bars, bp);
        line.addView(label);
        song = text(26, bold);
        artist = text(21, regular);
        words.addView(line, below(0));
        words.addView(song, below(7));
        words.addView(artist, below(5));
        LayoutParams wp = new LayoutParams(ViewGroup.LayoutParams.WRAP_CONTENT, ViewGroup.LayoutParams.WRAP_CONTENT);
        wp.leftMargin = px(18);
        addView(words, wp);
        setVisibility(GONE);
    }

    /** Shows p, or hides the block when p is null; the cover is drawn again only when the song or the ink changes. */
    public void show(Playing p, int ink, int muted, int paper, boolean night) {
        if (p == null) {
            setVisibility(GONE);
            shown = null;
            shownWatched = null;
            return;
        }
        shape(false);
        shownWatched = null;
        label.setText(p.playing ? "NOW PLAYING" : "PAUSED");
        label.setTextColor(muted);
        bars.set(p.playing, ink);
        bars.setVisibility(VISIBLE);
        song.setText(p.title);
        song.setTextColor(ink);
        artist.setText(p.artist);
        artist.setTextColor(muted);
        if (shown == null || shown.cover != p.cover || shownInk != ink) cover.set(p.cover, ink, paper, night);
        shown = p;
        shownInk = ink;
        setVisibility(VISIBLE);
    }

    /** Shows the last show watched, or hides the block when w is null. */
    public void show(Watched w, int ink, int muted, int paper, boolean night) {
        if (w == null) {
            show((Playing) null, ink, muted, paper, night);
            return;
        }
        shape(true);
        label.setText("LAST WATCHED");
        label.setTextColor(muted);
        bars.set(false, ink);
        bars.setVisibility(GONE);
        song.setText(w.title);
        song.setTextColor(ink);
        artist.setText(w.line());
        artist.setTextColor(muted);
        if (shownWatched == null || shownWatched.frame != w.frame || shownInk != ink) {
            cover.set(w.frame, Watched.FRAME_W, Watched.FRAME_H, ink, paper, night);
        }
        shownWatched = w;
        shown = null;
        shownInk = ink;
        setVisibility(VISIBLE);
    }

    private void shape(boolean frame) {
        if (frame == wide) return;
        wide = frame;
        cover.setLayoutParams(new LayoutParams(px(frame ? FRAME_PX : COVER_PX), px(COVER_PX)));
    }

    private int px(float design) {
        return Math.round(design * scale);
    }

    private TextView text(float size, Typeface face) {
        TextView t = new TextView(getContext());
        t.setTypeface(face);
        t.setTextSize(TypedValue.COMPLEX_UNIT_PX, size * scale);
        t.setIncludeFontPadding(false);
        t.setSingleLine(true);
        t.setEllipsize(TextUtils.TruncateAt.END);
        t.setMaxWidth(px(520));   // a long title ends in … rather than running under the screen's edge
        return t;
    }

    private LayoutParams below(float gap) {
        LayoutParams p = new LayoutParams(ViewGroup.LayoutParams.WRAP_CONTENT, ViewGroup.LayoutParams.WRAP_CONTENT);
        p.topMargin = px(gap);
        return p;
    }
}
