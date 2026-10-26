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
 * The now-playing block at the top right of the e-ink Home and the screensaver: the cover in ink dots on the left, and
 * to its right NOW PLAYING (PAUSED once paused), the song and the artist. No border; gone when nothing is shown.
 */
public final class SongBlock extends LinearLayout {
    /** Design pixels (1920 wide): the cover's side and its dots across, the text sizes. */
    private static final float COVER_PX = 88;
    private static final int COVER_CELLS = 22;

    private final float scale;
    private final CoverView cover;
    private final TextView label;
    private final TextView song;
    private final TextView artist;
    private Playing shown;
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
        label = text(16, bold);
        label.setLetterSpacing(0.12f);
        song = text(30, bold);
        artist = text(24, regular);
        words.addView(label, below(0));
        words.addView(song, below(8));
        words.addView(artist, below(6));
        LayoutParams wp = new LayoutParams(ViewGroup.LayoutParams.WRAP_CONTENT, ViewGroup.LayoutParams.WRAP_CONTENT);
        wp.leftMargin = px(20);
        addView(words, wp);
        setVisibility(GONE);
    }

    /** Shows p, or hides the block when p is null; the cover is drawn again only when the song or the ink changes. */
    public void show(Playing p, int ink, int muted, int paper, boolean night) {
        if (p == null) {
            setVisibility(GONE);
            shown = null;
            return;
        }
        label.setText(p.playing ? "NOW PLAYING" : "PAUSED");
        label.setTextColor(muted);
        song.setText(p.title);
        song.setTextColor(ink);
        artist.setText(p.artist);
        artist.setTextColor(muted);
        if (shown == null || shown.cover != p.cover || shownInk != ink) cover.set(p.cover, COVER_CELLS, ink, paper, night);
        shown = p;
        shownInk = ink;
        setVisibility(VISIBLE);
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
