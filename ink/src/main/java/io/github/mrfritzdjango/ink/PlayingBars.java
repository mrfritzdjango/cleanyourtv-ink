package io.github.mrfritzdjango.ink;

import android.content.Context;
import android.graphics.Canvas;
import android.graphics.Paint;
import android.os.SystemClock;
import android.view.View;

/**
 * Three ink bars before NOW PLAYING, rising and falling while the song plays (W1 on the canvas). They move in steps,
 * four heights a bar, each bar on its own beat, so the block redraws a few times a second and only while it is on
 * screen; paused, they lie flat and still.
 */
public final class PlayingBars extends View {
    /** Each bar's heights, as shares of the full height, and how long it takes to go through them once. */
    private static final float[][] LEVELS = {{.3f, 1f, .55f, .85f}, {.9f, .4f, 1f, .25f}, {.5f, .75f, .3f, 1f}};
    /** Whole multiples of the four steps, so a step is never asked for a moment before it comes. */
    private static final long[] CYCLE_MS = {900, 1100, 960};
    /** Paused: every bar this high. */
    private static final float FLAT = .2f;
    /** Design pixels: a bar's width and the gap between two. */
    public static final float BAR_PX = 4;
    public static final float GAP_PX = 3;

    private final Paint paint = new Paint(Paint.ANTI_ALIAS_FLAG);
    private boolean moving;

    public PlayingBars(Context context) {
        super(context);
    }

    /** Moving while playing, flat while paused. */
    public void set(boolean playing, int ink) {
        paint.setColor(ink);
        moving = playing;
        invalidate();
    }

    /** Bar's height at t, as a share of the full height. */
    static float level(int bar, long t) {
        float[] l = LEVELS[bar];
        return l[(int) (t % CYCLE_MS[bar] * l.length / CYCLE_MS[bar])];
    }

    /** How long after t the next bar changes height. */
    static long untilNext(long t) {
        long next = Long.MAX_VALUE;
        for (int bar = 0; bar < LEVELS.length; bar++) {
            long step = CYCLE_MS[bar] / LEVELS[bar].length;
            next = Math.min(next, step - t % CYCLE_MS[bar] % step);
        }
        return next;
    }

    @Override
    protected void onDraw(Canvas canvas) {
        float w = getWidth() / (LEVELS.length + (LEVELS.length - 1) * GAP_PX / BAR_PX);
        float gap = w * GAP_PX / BAR_PX;
        float h = getHeight();
        long t = SystemClock.uptimeMillis();
        for (int bar = 0; bar < LEVELS.length; bar++) {
            float x = bar * (w + gap);
            float top = h * (1 - (moving ? level(bar, t) : FLAT));
            canvas.drawRect(x, top, x + w, h, paint);
        }
        // the next step is asked for from here, so it stops by itself once Home or the screensaver is off screen
        if (moving && isShown()) postInvalidateDelayed(untilNext(t));
    }
}
