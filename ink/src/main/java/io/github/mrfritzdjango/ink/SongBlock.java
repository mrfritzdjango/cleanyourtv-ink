package io.github.mrfritzdjango.ink;

import android.animation.Animator;
import android.animation.AnimatorListenerAdapter;
import android.animation.TimeInterpolator;
import android.animation.ValueAnimator;
import android.content.Context;
import android.graphics.Typeface;
import android.text.Layout;
import android.text.TextUtils;
import android.util.TypedValue;
import android.view.Gravity;
import android.view.ViewGroup;
import android.view.animation.DecelerateInterpolator;
import android.view.animation.LinearInterpolator;
import android.widget.FrameLayout;
import android.widget.LinearLayout;
import android.widget.TextView;

import java.util.Arrays;

/**
 * The now-playing block at the top right of the e-ink Home and the screensaver: the cover in shades of ink on the left, and
 * to its right NOW PLAYING (PAUSED once paused), the song and the artist; the menagerie's kingfisher perches on the cover and
 * sings while it plays. On Home, with a streaming app's row selected,
 * it shows that app's last show instead: a 16:9 frame, LAST WATCHED, the title and the episode with its app. No border; gone when nothing
 * is shown. The block stands {@link #overhang()} taller than the cover, above it, for the bird and its notes. It keeps to the
 * right-hand column ({@link #WIDTH_PX}): a song or artist too long for it rests at its start, glides slowly to its end, rests
 * there and slides back, {@link #GLIDES} times for each song, then rests at its start, rather than ending in … or pushing
 * the block to the left.
 */
public final class SongBlock extends LinearLayout {
    /** Design pixels (1920 wide): the cover's side, the text sizes. */
    private static final float COVER_PX = 88;
    /** The video frame: as tall as the cover, in its own 16:9. */
    private static final float FRAME_PX = COVER_PX * Watched.FRAME_W / Watched.FRAME_H;
    /** The block at its widest, cover and words: the right-hand of Home's three columns between the list and the clock. */
    private static final float WIDTH_PX = 480;
    /** Between the cover and the words. */
    private static final float GAP_PX = 20;
    /** A long line rests this long at its start, glides this many design pixels a second, rests at its end, slides back. */
    private static final long REST_MS = 4000;
    private static final float GLIDE_PX_S = 40;
    private static final long END_REST_MS = 2500;
    private static final long BACK_MS = 700;
    /** Glides for each new song or show: enough to read it, without moving all evening on the screensaver. */
    private static final int GLIDES = 3;

    private final float scale;
    /** The cover with the bird standing over it. */
    private final FrameLayout perch;
    private final CoverView cover;
    private final SongBird bird;
    private final TextView label;
    private final TextView song;
    private final TextView artist;
    private Playing shown;
    private Watched shownWatched;
    /** The cover is the video's 16:9 frame. */
    private boolean wide;
    private int shownInk;
    private final TextView[] lines;
    private ValueAnimator gliding;
    /** The glide's next step, waiting out a rest. */
    private Runnable pending;
    private int glides;

    public SongBlock(Context context, Typeface regular, Typeface bold, float scale) {
        super(context);
        this.scale = scale;
        setOrientation(HORIZONTAL);
        setGravity(Gravity.CENTER_VERTICAL);
        // the bird and its notes stand in the padding above the cover, the notes past its right edge
        setPadding(0, overhang(), 0, 0);
        setClipToPadding(false);
        setClipChildren(false);
        perch = new FrameLayout(context);
        perch.setClipChildren(false);
        cover = new CoverView(context);
        perch.addView(cover, new FrameLayout.LayoutParams(px(COVER_PX), px(COVER_PX)));
        bird = new SongBird(context, scale);
        perch.addView(bird, new FrameLayout.LayoutParams(px(COVER_PX), px(COVER_PX)));
        addView(perch, new LayoutParams(px(COVER_PX), px(COVER_PX)));
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
        wp.leftMargin = px(GAP_PX);
        addView(words, wp);
        lines = new TextView[] {label, song, artist};
        fit(COVER_PX);
        setVisibility(GONE);
    }

    /** Shows p, or hides the block when p is null; the cover is drawn again only when the song or the ink changes. */
    public void show(Playing p, int ink, int muted, int paper, boolean night) {
        if (p == null) {
            setVisibility(GONE);
            shown = null;
            shownWatched = null;
            stopGlide();
            return;
        }
        boolean moved = shape(false) | getVisibility() != VISIBLE;
        shownWatched = null;
        moved |= words(p.playing ? "NOW PLAYING" : "PAUSED", p.title, p.artist);
        label.setTextColor(muted);
        bird.set(p.playing, ink, paper);
        bird.setVisibility(VISIBLE);
        song.setTextColor(ink);
        artist.setTextColor(muted);
        // Home reads the song through Today's provider: each read is a new array, so the pictures are compared, not the arrays
        if (shown == null || !Arrays.equals(shown.cover, p.cover) || shownInk != ink) cover.set(p.cover, ink, paper, night);
        shown = p;
        shownInk = ink;
        setVisibility(VISIBLE);
        if (moved) startGlide();
    }

    /** Shows the last show watched, or hides the block when w is null. */
    public void show(Watched w, int ink, int muted, int paper, boolean night) {
        if (w == null) {
            show((Playing) null, ink, muted, paper, night);
            return;
        }
        boolean moved = shape(true) | getVisibility() != VISIBLE;
        moved |= words("LAST WATCHED", w.title, w.line());
        label.setTextColor(muted);
        bird.set(false, ink, paper);
        bird.setVisibility(GONE);
        song.setTextColor(ink);
        artist.setTextColor(muted);
        if (shownWatched == null || !Arrays.equals(shownWatched.frame, w.frame) || shownInk != ink) {
            cover.set(w.frame, Watched.FRAME_W, Watched.FRAME_H, ink, paper, night);
        }
        shownWatched = w;
        shown = null;
        shownInk = ink;
        setVisibility(VISIBLE);
        if (moved) startGlide();
    }

    /** The cover square or the video's frame; true when it changed. */
    private boolean shape(boolean frame) {
        if (frame == wide) return false;
        wide = frame;
        float side = frame ? FRAME_PX : COVER_PX;
        cover.setLayoutParams(new FrameLayout.LayoutParams(px(side), px(COVER_PX)));
        perch.setLayoutParams(new LayoutParams(px(side), px(COVER_PX)));
        fit(side);
        return true;
    }

    /** The words take what the cover leaves of the block's width. */
    private void fit(float side) {
        for (TextView t : lines) t.setMaxWidth(px(WIDTH_PX - side - GAP_PX));
    }

    /**
     * Sets the three lines, each only when it differs (setting a line again would put it back at its start); true when one
     * changed.
     */
    private boolean words(String head, String title, String by) {
        boolean changed = false;
        String[] now = {head, title, by};
        for (int i = 0; i < lines.length; i++) {
            if (TextUtils.equals(lines[i].getText(), now[i])) continue;
            lines[i].setText(now[i]);
            changed = true;
        }
        return changed;
    }

    // ---- The long lines' glide: one position for all three, each line stopping at its own end

    /** Every line back at its start, and the glide again after the rest; only while the block is on screen. */
    private void startGlide() {
        stopGlide();
        glides = 0;
        if (getVisibility() == VISIBLE && getWindowVisibility() == VISIBLE) later(this::glide, REST_MS);
    }

    private void stopGlide() {
        ValueAnimator a = gliding;
        gliding = null;   // first, so that its end, called by cancel, goes no further
        if (a != null) a.cancel();
        if (pending != null) removeCallbacks(pending);
        pending = null;
        for (TextView t : lines) t.setScrollX(0);
    }

    /** Out to the furthest end at an even pace, a rest there, back quickly, a rest at the start; nothing when all fit. */
    private void glide() {
        pending = null;
        if (glides++ >= GLIDES) return;   // read by now: it rests at its start
        int far = 0;
        for (TextView t : lines) far = Math.max(far, overflow(t));
        if (far == 0) return;
        int end = far;
        slide(0, end, Math.round(end * 1000 / (GLIDE_PX_S * scale)), new LinearInterpolator(),
                () -> later(() -> slide(end, 0, BACK_MS, new DecelerateInterpolator(),
                        () -> later(this::glide, REST_MS)), END_REST_MS));
    }

    private void later(Runnable r, long ms) {
        pending = r;
        postDelayed(r, ms);
    }

    private void slide(int from, int to, long ms, TimeInterpolator how, Runnable then) {
        pending = null;
        ValueAnimator a = ValueAnimator.ofInt(from, to);
        a.setDuration(ms);
        a.setInterpolator(how);
        a.addUpdateListener(v -> {
            int at = (int) v.getAnimatedValue();
            for (TextView t : lines) t.setScrollX(Math.min(at, overflow(t)));
        });
        a.addListener(new AnimatorListenerAdapter() {
            @Override
            public void onAnimationEnd(Animator animator) {
                if (gliding != a) return;   // stopped
                gliding = null;
                then.run();
            }
        });
        gliding = a;
        a.start();
    }

    /** How far a line runs past its width, in pixels; 0 when it fits. */
    private static int overflow(TextView t) {
        Layout l = t.getLayout();
        if (l == null) return 0;
        int room = t.getWidth() - t.getTotalPaddingLeft() - t.getTotalPaddingRight();
        return Math.max(0, (int) Math.ceil(l.getLineWidth(0)) - room);
    }

    /** Home under another app, or the screensaver gone: nothing glides where no one sees it. */
    @Override
    protected void onWindowVisibilityChanged(int visibility) {
        super.onWindowVisibilityChanged(visibility);
        startGlide();
    }

    @Override
    protected void onDetachedFromWindow() {
        stopGlide();
        super.onDetachedFromWindow();
    }

    /** The bird to perch on the cover (the kingfisher from {@link SongBird#find}); null leaves the cover bare. */
    public void perch(Animals.Animal kingfisher) {
        bird.setBird(kingfisher);
    }

    /** How far the block reaches above its cover: place it this much higher to keep the cover where it was. */
    public int overhang() {
        return px(COVER_PX * SongBird.OVER);
    }

    private int px(float design) {
        return Math.round(design * scale);
    }

    private TextView text(float size, Typeface face) {
        TextView t = new TextView(getContext());
        t.setTypeface(face);
        t.setTextSize(TypedValue.COMPLEX_UNIT_PX, size * scale);
        t.setIncludeFontPadding(false);
        // one line as long as it runs (fit() bounds the view, the glide shows the rest), no … at its end
        t.setSingleLine(true);
        t.setEllipsize(null);
        // laid out from the left even for a right-to-left title (Arabic, Jawi), so the glide from 0 shows its start
        t.setTextDirection(TEXT_DIRECTION_LTR);
        return t;
    }

    private LayoutParams below(float gap) {
        LayoutParams p = new LayoutParams(ViewGroup.LayoutParams.WRAP_CONTENT, ViewGroup.LayoutParams.WRAP_CONTENT);
        p.topMargin = px(gap);
        return p;
    }
}
