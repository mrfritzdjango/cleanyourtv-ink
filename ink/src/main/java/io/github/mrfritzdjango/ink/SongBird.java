package io.github.mrfritzdjango.ink;

import android.content.Context;
import android.graphics.Canvas;
import android.graphics.Paint;
import android.graphics.Path;
import android.graphics.RectF;
import android.os.SystemClock;
import android.view.View;

import java.util.List;

/**
 * The collared kingfisher from the menagerie, perched on the cover's top edge without its branch, facing the song (A1 on
 * the canvas). While the song plays it bows in steps and three notes rise from its beak one by one, then clear; paused,
 * it sits still and quiet. The view lies over the cover, the same square; the bird stands above it and the notes reach up
 * to OVER covers above it and past its right edge, so its parents don't clip it.
 */
public final class SongBird extends View {
    public static final String ID = "collared-kingfisher";
    /** The kingfisher's branch: a prop layer, left out so the bird sits on the cover. */
    private static final int BRANCH = 4;
    /** How far above the cover the notes reach, in covers. */
    public static final float OVER = .82f;
    /** The bird's width and its left edge, in covers; its feet, in its own width and height once turned to face right. */
    private static final float BIRD_W = .87f, BIRD_LEFT = .03f, FEET_U = .47f, FEET_V = .71f;
    /** Each note's head, in covers from the cover's top left: rising up and to the right from the beak. */
    private static final float[][] NOTES = {{.947f, -.368f}, {1.13f, -.5f}, {1.316f, -.63f}};
    /** The bow, and how long each step lasts: the bird bows every other step, a note comes every other. */
    private static final float BOW_DEG = 9;
    static final long STEP_MS = 300;
    private static final int STEPS = 8;
    /** Design px between halftone dots: the screensaver's are 12 on an animal ten times this size. */
    private static final float DOT_PX = 3;
    /** Design px: its outline at this size would be a third of a pixel, so no line is drawn thinner than this. */
    private static final float LINE_PX = 1.2f;

    private final float scale;
    private final Paint smooth = new Paint(Paint.FILTER_BITMAP_FLAG | Paint.ANTI_ALIAS_FLAG);
    private final Paint note = new Paint(Paint.ANTI_ALIAS_FLAG);
    private final Path stem = new Path();
    private final RectF box = new RectF();
    private Animals.Animal bird;
    private ShowView.Drawing drawing;
    private int drawnSide;
    private boolean playing;
    private int ink;
    private int paper;

    public SongBird(Context context, float scale) {
        super(context);
        this.scale = scale;
    }

    /** The kingfisher among the animals, or null when it is not there (Today without it, or not read yet). */
    public static Animals.Animal find(List<Animals.Animal> animals) {
        if (animals == null) return null;
        for (Animals.Animal a : animals) if (ID.equals(a.id)) return a;
        return null;
    }

    /** The drawing to perch; null leaves the cover bare. */
    public void setBird(Animals.Animal a) {
        if (a == bird) return;
        bird = a;
        drawing = null;
        invalidate();
    }

    /** Singing while playing, still while paused; drawn again only when the ink changes. */
    public void set(boolean playing, int ink, int paper) {
        if (ink != this.ink || paper != this.paper) drawing = null;
        this.playing = playing;
        this.ink = ink;
        this.paper = paper;
        invalidate();
    }

    /** Bowing at t. */
    static boolean bowing(long t) {
        return t / STEP_MS % 2 == 1;
    }

    /** The notes out at t: none, then one, two and three, a step apart every other step, then none again. */
    static int notes(long t) {
        int step = (int) (t / STEP_MS % STEPS);
        return step == 0 || step == STEPS - 1 ? 0 : (step + 1) / 2;
    }

    @Override
    protected void onDraw(Canvas canvas) {
        int side = getWidth();
        if (bird == null || side == 0) return;
        float w = side * BIRD_W, unit = w / bird.width, h = bird.height * unit;
        if (drawing == null || drawnSide != side) {
            drawing = ShowView.draw(bird, new int[] {BRANCH}, unit, ink, paper, DOT_PX * scale, LINE_PX * scale);
            drawnSide = side;
        }
        float top = 0;   // the cover's top edge
        float left = side * BIRD_LEFT, birdTop = top - FEET_V * h;
        long t = SystemClock.uptimeMillis();
        boolean singing = playing && isShown();
        canvas.save();
        if (singing && bowing(t)) canvas.rotate(BOW_DEG, left + FEET_U * w, top);
        canvas.translate(left + w, birdTop);
        canvas.scale(-1, 1);   // the drawing faces left; the song is on the right
        box.set(0, 0, w, h);
        canvas.drawBitmap(drawing.body, null, box, smooth);
        canvas.restore();
        if (!singing) return;
        note.setColor(ink);
        for (int i = 0; i < notes(t); i++) drawNote(canvas, NOTES[i][0] * side, top + NOTES[i][1] * side, side);
        postInvalidateDelayed(STEP_MS - t % STEP_MS);
    }

    /** An eighth note: a tilted head, its stem and its flag. */
    private void drawNote(Canvas canvas, float x, float y, int side) {
        float rx = .039f * side, ry = .029f * side, stemH = .145f * side;
        canvas.save();
        canvas.rotate(-20, x, y);
        box.set(x - rx, y - ry, x + rx, y + ry);
        note.setStyle(Paint.Style.FILL);
        canvas.drawOval(box, note);
        canvas.restore();
        float sx = x + rx * .87f, sy = y - ry * .27f;
        stem.reset();
        stem.moveTo(sx, sy);
        stem.lineTo(sx, sy - stemH);
        stem.rQuadTo(.053f * side, .026f * side, .053f * side, .079f * side);
        note.setStyle(Paint.Style.STROKE);
        note.setStrokeWidth(.017f * side);
        note.setStrokeCap(Paint.Cap.ROUND);
        canvas.drawPath(stem, note);
    }
}
