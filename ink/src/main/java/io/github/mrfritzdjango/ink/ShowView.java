package io.github.mrfritzdjango.ink;

import android.content.Context;
import android.graphics.Bitmap;
import android.graphics.BitmapShader;
import android.graphics.Canvas;
import android.graphics.Color;
import android.graphics.ColorMatrix;
import android.graphics.ColorMatrixColorFilter;
import android.graphics.Matrix;
import android.graphics.Paint;
import android.graphics.Path;
import android.graphics.PorterDuff;
import android.graphics.PorterDuffXfermode;
import android.graphics.RectF;
import android.graphics.Shader;
import android.graphics.Typeface;
import android.os.SystemClock;
import android.util.SparseArray;
import android.view.View;

/**
 * Plays an animal's show (Shows) over the whole screen: the drawing as one bitmap bent through the show's grid
 * (drawBitmapMesh), its prop (a branch, a bar) as a second bitmap, and the ink marks around it, blended between the
 * keyframes on every frame of the display so the motion is smooth. Between outings it can hold the animal still at
 * home (the screensaver). TITANE's show also turns the screen to ink, inverts, bursts and stamps "TITANE!".
 * Everything is placed on a 1920 x 1080 design screen and scaled to the view.
 */
public final class ShowView extends View {
    public static final float DESIGN_WIDTH = 1920f;
    public static final float DESIGN_HEIGHT = 1080f;
    private static final String SHOUT = "TITANE!";

    private final Typeface bold;
    private final Paint bitmapPaint = new Paint(Paint.FILTER_BITMAP_FLAG | Paint.ANTI_ALIAS_FLAG);
    private final Paint negativePaint = new Paint(Paint.FILTER_BITMAP_FLAG | Paint.ANTI_ALIAS_FLAG);
    private final Paint stroke = new Paint(Paint.ANTI_ALIAS_FLAG);
    private final Paint fill = new Paint(Paint.ANTI_ALIAS_FLAG);
    private final Paint dotted = new Paint(Paint.ANTI_ALIAS_FLAG);
    private final Paint text = new Paint(Paint.ANTI_ALIAS_FLAG);
    private final Paint erase = new Paint(Paint.ANTI_ALIAS_FLAG);
    private final Matrix matrix = new Matrix();
    private final Path path = new Path();
    private final RectF oval = new RectF();
    private final SparseArray<BitmapShader> dotShaders = new SparseArray<>();
    private final float[] pose = new float[8];
    private final float[] propPose = new float[6];
    private float[] bend = new float[0];
    private float[] verts = new float[0];
    private int ink = Color.BLACK;   // colours() sets the page's ink and paper
    private int paper = Color.WHITE;
    private View shakeTarget;

    private Shows.Show show;
    private Drawing sprites;
    private boolean pass;
    private boolean flip;
    private long start;
    private boolean playing;
    private Runnable done;
    /** The screensaver's animal between outings: its outing show (for home) and its drawing. */
    private Shows.Show still;
    private Drawing stillSprites;

    public ShowView(Context context, Typeface bold) {
        super(context);
        this.bold = bold;
        stroke.setStyle(Paint.Style.STROKE);
        stroke.setStrokeCap(Paint.Cap.ROUND);
        stroke.setStrokeJoin(Paint.Join.ROUND);
        text.setTypeface(bold);
        text.setTextAlign(Paint.Align.CENTER);
        erase.setXfermode(new PorterDuffXfermode(PorterDuff.Mode.DST_OUT));
    }

    /** The view that shakes when TITANE lands (the whole page); null shakes only this view's drawing. */
    public void setShakeTarget(View target) {
        shakeTarget = target;
    }

    public void colours(int inkColour, int paperColour) {
        ink = inkColour;
        paper = paperColour;
        dotShaders.clear();
        float r = Color.red(ink) + Color.red(paper), g = Color.green(ink) + Color.green(paper), b = Color.blue(ink) + Color.blue(paper);
        negativePaint.setColorFilter(new ColorMatrixColorFilter(new ColorMatrix(new float[] {
                -1, 0, 0, 0, r, 0, -1, 0, 0, g, 0, 0, -1, 0, b, 0, 0, 0, 1, 0})));
        invalidate();
    }

    /** Hold this animal still at its home on the screensaver, from its outing show; null shows nothing. */
    public void still(Shows.Show outing, Drawing drawing) {
        still = outing;
        stillSprites = drawing;
        invalidate();
    }

    /** Plays a show once; a pass with dir -1 runs right to left. done runs at the end (not after stop()). */
    public void play(Shows.Show s, Drawing drawing, boolean isPass, int dir, Runnable whenDone) {
        show = s;
        sprites = drawing;
        pass = isPass;
        flip = isPass && dir < 0;
        done = whenDone;
        start = SystemClock.uptimeMillis();
        playing = true;
        int points = s.frames.length > 0 ? s.frames[0].bend.length : 0;
        if (bend.length != points) {
            bend = new float[points];
            verts = new float[points];
        }
        invalidate();
    }

    public boolean playing() {
        return playing;
    }

    public void stop() {
        if (!playing) return;
        playing = false;
        show = null;
        sprites = null;
        done = null;
        unshake();
        invalidate();
    }

    @Override
    protected void onDetachedFromWindow() {
        super.onDetachedFromWindow();
        stop();
    }

    // ---- The drawing, as bitmaps: the animal, and its prop when it has one. Safe off the main thread.

    /**
     * The widest bitmap made: a TV's GPU draws up to 4096, but at 4096 an animal is some 30 MB on a box with 1 GB.
     * A bigger drawing is made smaller and scaled up on screen (only on a 4K interface, a little softer).
     */
    private static final int MAX_BITMAP = 2048;

    /** An animal drawn at one size: the animal, and its prop (a branch, a bar) cut down to the prop's own corner. */
    public static final class Drawing {
        final Bitmap body;
        /** null without a prop; its top left sits propX, propY bitmap px into the animal's frame. */
        final Bitmap prop;
        final float propX;
        final float propY;
        /** Bitmap px per wanted px: below 1 when the drawing was too big for one bitmap. */
        final float density;

        Drawing(Bitmap body, Bitmap prop, float propX, float propY, float density) {
            this.body = body;
            this.prop = prop;
            this.propX = propX;
            this.propY = propY;
            this.density = density;
        }
    }

    /**
     * The animal's drawing (and its prop layers, if any, as a second bitmap) at unitPx screen pixels per drawing unit:
     * a paper silhouette under the ink so it covers what it passes over, halftone dots dotCell pixels apart, and a
     * cut layer (a frame with the animal cut out of it) erasing what falls outside the animal.
     */
    public static Drawing draw(Animals.Animal a, int[] props, float unitPx, int ink, int paper, float dotCell) {
        return draw(a, props, unitPx, ink, paper, dotCell, 0);
    }

    /** The same, no line thinner than minLinePx screen pixels: a small animal (the song's kingfisher) keeps its outline. */
    public static Drawing draw(Animals.Animal a, int[] props, float unitPx, int ink, int paper, float dotCell, float minLinePx) {
        float density = Math.min(1, MAX_BITMAP / (Math.max(a.width, a.height) * unitPx));
        float unit = unitPx * density;
        int w = Math.max(1, Math.round(a.width * unit)), h = Math.max(1, Math.round(a.height * unit));
        Bitmap body = Bitmap.createBitmap(w, h, Bitmap.Config.ARGB_8888);
        layers(new Canvas(body), a, props, false, unit, ink, paper, dotCell * density, minLinePx / unitPx);
        RectF box = props.length > 0 ? propBounds(a, props) : null;
        if (box == null) return new Drawing(body, null, 0, 0, density);
        // Only the prop's own corner of the frame: a branch is small, the frame is most of the screen.
        int left = Math.max(0, (int) Math.floor(box.left * unit)), top = Math.max(0, (int) Math.floor(box.top * unit));
        int right = Math.min(w, (int) Math.ceil(box.right * unit)), bottom = Math.min(h, (int) Math.ceil(box.bottom * unit));
        if (right <= left || bottom <= top) return new Drawing(body, null, 0, 0, density);
        Bitmap prop = Bitmap.createBitmap(right - left, bottom - top, Bitmap.Config.ARGB_8888);
        Canvas c = new Canvas(prop);
        c.translate(-left, -top);
        layers(c, a, props, true, unit, ink, paper, dotCell * density, minLinePx / unitPx);
        return new Drawing(body, prop, left, top, density);
    }

    /** The prop layers' bounds in drawing units, with room for their strokes; null when none of them is drawn. */
    private static RectF propBounds(Animals.Animal a, int[] props) {
        RectF all = null, one = new RectF();
        for (int i = 0; i < a.layers.size(); i++) {
            if (!isProp(props, i)) continue;
            Animals.Layer l = a.layers.get(i);
            l.path.computeBounds(one, true);
            float pad = (l.stroke ? l.width : 0) + 2;
            one.inset(-pad, -pad);
            if (all == null) all = new RectF(one);
            else all.union(one);
        }
        return all;
    }

    private static void layers(Canvas c, Animals.Animal a, int[] props, boolean wantProps, float unitPx, int ink, int paper, float dotCell, float minLine) {
        Paint under = new Paint(Paint.ANTI_ALIAS_FLAG);
        under.setColor(paper);
        Paint solid = new Paint(Paint.ANTI_ALIAS_FLAG);
        solid.setColor(ink);
        Paint paperFill = new Paint(Paint.ANTI_ALIAS_FLAG);
        paperFill.setColor(paper);
        Paint cut = new Paint(Paint.ANTI_ALIAS_FLAG);
        cut.setXfermode(new PorterDuffXfermode(PorterDuff.Mode.CLEAR));
        Paint line = new Paint(Paint.ANTI_ALIAS_FLAG);
        line.setColor(ink);
        line.setStyle(Paint.Style.STROKE);
        line.setStrokeCap(Paint.Cap.ROUND);
        line.setStrokeJoin(Paint.Join.ROUND);
        int cell = Math.max(3, Math.round(dotCell));
        Bitmap tile = Bitmap.createBitmap(cell, cell, Bitmap.Config.ARGB_8888);
        new Canvas(tile).drawCircle(cell / 2f, cell / 2f, cell * 0.34f, solid);
        BitmapShader shader = new BitmapShader(tile, Shader.TileMode.REPEAT, Shader.TileMode.REPEAT);
        Matrix local = new Matrix();
        local.setScale(1 / unitPx, 1 / unitPx);
        shader.setLocalMatrix(local);
        Paint dots = new Paint(Paint.ANTI_ALIAS_FLAG);
        dots.setShader(shader);
        c.scale(unitPx, unitPx);
        for (int i = 0; i < a.layers.size(); i++) {
            Animals.Layer l = a.layers.get(i);
            if (isProp(props, i) == wantProps && (l.fill == Animals.INK || l.fill == Animals.DOTS)) c.drawPath(l.path, under);
        }
        for (int i = 0; i < a.layers.size(); i++) {
            if (isProp(props, i) != wantProps) continue;
            Animals.Layer l = a.layers.get(i);
            if (l.cut) c.drawPath(l.path, cut);
            else if (l.fill == Animals.DOTS) c.drawPath(l.path, dots);
            else if (l.fill == Animals.INK) c.drawPath(l.path, solid);
            else if (l.fill == Animals.PAPER) c.drawPath(l.path, paperFill);
            if (l.stroke) {
                line.setStrokeWidth(Math.max(l.width, minLine));
                c.drawPath(l.path, line);
            }
        }
    }

    /** A show of one still frame: the animal at (x, y) design px, fit design px per drawing unit. For an animal with no baked show. */
    public static Shows.Show home(Animals.Animal a, float x, float y, float fit) {
        Shows.Show s = new Shows.Show();
        s.fps = 12;
        s.cols = 24;
        s.rows = 12;
        s.fit = fit;
        s.homeScale = 1;
        Shows.Frame f = new Shows.Frame();
        f.x = x;
        f.y = y;
        f.scale = 1;
        f.sx = 1;
        f.sy = 1;
        f.bend = new float[(s.cols + 1) * (s.rows + 1) * 2];
        f.marks = new Shows.Mark[0];
        s.frames = new Shows.Frame[] {f};
        return s;
    }

    private static boolean isProp(int[] props, int layer) {
        for (int p : props) if (p == layer) return true;
        return false;
    }

    // ---- Drawing a frame

    @Override
    protected void onDraw(Canvas canvas) {
        float k = getWidth() / DESIGN_WIDTH;
        if (!playing) {
            if (still != null && stillSprites != null && still.frames.length > 0) {
                Shows.Frame f = still.frames[0];   // an outing starts at home
                setPose(f, f, 0);
                animal(canvas, k, still, stillSprites, null, false);
            }
            return;
        }
        float t = (SystemClock.uptimeMillis() - start) / 1000f;
        if (t > show.seconds) {
            Runnable then = done;
            stop();
            if (then != null) then.run();
            return;
        }
        int i = Math.min(show.frames.length - 1, (int) (t * show.fps));
        Shows.Frame a = show.frames[i];
        Shows.Frame b = i + 1 < show.frames.length && (a.flags & Shows.CUT) == 0 ? show.frames[i + 1] : a;
        float f = 0;
        if (b != a) {   // keyframes are 1/fps apart, except the last, which is the show's very end
            float t0 = i / (float) show.fps, t1 = Math.min(show.seconds, (i + 1) / (float) show.fps);
            f = Math.min(1, (t - t0) / Math.max(0.001f, t1 - t0));
        }
        setPose(a, b, f);
        for (int j = 0; j < bend.length; j++) bend[j] = a.bend[j] + (b.bend[j] - a.bend[j]) * f;

        int screen = a.screen();
        float shakeX = pose[6] * k * (flip ? -1 : 1), shakeY = pose[7] * k;
        if (shakeTarget != null) {
            shakeTarget.setTranslationX(shakeX);
            shakeTarget.setTranslationY(shakeY);
            shakeX = 0;
            shakeY = 0;
        }
        canvas.save();
        canvas.translate(shakeX, shakeY);
        if (screen != 0) canvas.drawColor(ink);
        if (screen != 1) {
            canvas.save();
            if (flip) canvas.scale(-1, 1, getWidth() / 2f, 0);
            if ((a.flags & Shows.BURST) != 0) burst(canvas, k);
            marks(canvas, k, a, b, f, true);
            animal(canvas, k, show, sprites, a, screen == 2);
            marks(canvas, k, a, b, f, false);
            canvas.restore();
            if ((a.flags & Shows.SHOUT) != 0) shout(canvas, k, a.shout + (b.shout - a.shout) * f, a.shoutScale);
        }
        canvas.restore();
        postInvalidateOnAnimation();
    }

    private void setPose(Shows.Frame a, Shows.Frame b, float f) {
        pose[0] = a.x + (b.x - a.x) * f;
        pose[1] = a.y + (b.y - a.y) * f;
        pose[2] = a.scale + (b.scale - a.scale) * f;
        pose[3] = a.sx + (b.sx - a.sx) * f;
        pose[4] = a.sy + (b.sy - a.sy) * f;
        pose[5] = a.angle + (b.angle - a.angle) * f;
        pose[6] = a.shakeX + (b.shakeX - a.shakeX) * f;
        pose[7] = a.shakeY + (b.shakeY - a.shakeY) * f;
        if (a.prop != null) {
            float[] bp = b.prop != null ? b.prop : a.prop;
            for (int j = 0; j < 6; j++) propPose[j] = a.prop[j] + (bp[j] - a.prop[j]) * f;
        }
    }

    /** The prop, then the animal bent through the grid. frame null: the still animal at home, unbent. */
    private void animal(Canvas canvas, float k, Shows.Show s, Drawing drawing, Shows.Frame frame, boolean negative) {
        Paint paint = negative ? negativePaint : bitmapPaint;
        Bitmap body = drawing.body, prop = drawing.prop;
        int flags = frame == null ? 0 : frame.flags;
        if (prop != null && (flags & Shows.PROP_HIDDEN) == 0) {
            if ((flags & Shows.OWN_PROP) != 0 && frame.prop != null) {
                place(drawing, drawing.propX, drawing.propY, k, propPose[0], propPose[1], propPose[2], propPose[3], propPose[4], propPose[5], (flags & Shows.PROP_MIRROR) != 0);
            } else {
                place(drawing, drawing.propX, drawing.propY, k, pose[0], pose[1], pose[2], pose[3], pose[4], pose[5], (flags & Shows.MIRROR) != 0);
            }
            canvas.drawBitmap(prop, matrix, paint);
        }
        if ((flags & Shows.HIDDEN) != 0) return;
        place(drawing, 0, 0, k, pose[0], pose[1], pose[2], pose[3], pose[4], pose[5], (flags & Shows.MIRROR) != 0);
        if (frame == null) {
            canvas.drawBitmap(body, matrix, paint);
            return;
        }
        int cols = s.cols, rows = s.rows;
        float w = body.getWidth(), h = body.getHeight();
        int p = 0;
        for (int r = 0; r <= rows; r++) {
            for (int c = 0; c <= cols; c++) {
                verts[p] = (c / (float) cols + bend[p]) * w;
                verts[p + 1] = (r / (float) rows + bend[p + 1]) * h;
                p += 2;
            }
        }
        matrix.mapPoints(verts);
        canvas.drawBitmapMesh(body, cols, rows, verts, 0, null, 0, paint);
    }

    /**
     * The matrix that puts a drawing at design (x, y), scaled and turned about its centre, for a bitmap whose top left
     * is (ox, oy) bitmap px into the animal's frame (the prop's corner; 0, 0 for the animal).
     */
    private void place(Drawing d, float ox, float oy, float k, float x, float y, float scale, float sx, float sy, float angle, boolean mirror) {
        matrix.setTranslate(ox - d.body.getWidth() / 2f, oy - d.body.getHeight() / 2f);
        float up = scale / d.density;
        matrix.postScale(up * sx * (mirror ? -1 : 1), up * sy);
        matrix.postRotate(angle);
        matrix.postTranslate(x * k, y * k);
    }

    // ---- Ink marks (design pixels), blended between two frames when they hold the same marks

    private void marks(Canvas canvas, float k, Shows.Frame a, Shows.Frame b, float f, boolean behind) {
        boolean blend = f > 0 && b.marks.length == a.marks.length;
        canvas.save();
        canvas.scale(k, k);
        for (int i = 0; i < a.marks.length; i++) {
            Shows.Mark m = a.marks[i];
            if (m.behind != behind) continue;
            Shows.Mark n = blend && b.marks[i].kind == m.kind && b.marks[i].v.length == m.v.length ? b.marks[i] : m;
            mark(canvas, m, n, n == m ? 0 : f);
        }
        canvas.restore();
    }

    private void mark(Canvas canvas, Shows.Mark m, Shows.Mark n, float f) {
        float[] v = m.v;
        stroke.setColor(ink);
        stroke.setStrokeWidth(m.width + (n.width - m.width) * f);
        fill.setColor(ink);
        Paint paint = m.width > 0 ? stroke : fill;
        switch (m.kind) {
            case Shows.CIRCLE:
                canvas.drawCircle(lerp(v, n.v, 0, f), lerp(v, n.v, 1, f), Math.max(0.5f, lerp(v, n.v, 2, f)), paint);
                break;
            case Shows.LINE:
                canvas.drawLine(lerp(v, n.v, 0, f), lerp(v, n.v, 1, f), lerp(v, n.v, 2, f), lerp(v, n.v, 3, f), stroke);
                break;
            case Shows.ELLIPSE: {
                float rx = Math.max(0.5f, lerp(v, n.v, 2, f)), ry = Math.max(0.5f, lerp(v, n.v, 3, f));
                canvas.save();
                canvas.translate(lerp(v, n.v, 0, f), lerp(v, n.v, 1, f));
                canvas.rotate(lerp(v, n.v, 4, f));
                oval.set(-rx, -ry, rx, ry);
                canvas.drawOval(oval, paint);
                canvas.restore();
                break;
            }
            case Shows.ARC: {
                float r = lerp(v, n.v, 2, f), x = lerp(v, n.v, 0, f), y = lerp(v, n.v, 1, f);
                oval.set(x - r, y - r, x + r, y + r);
                canvas.drawArc(oval, lerp(v, n.v, 3, f), lerp(v, n.v, 4, f), false, stroke);
                break;
            }
            case Shows.DOTS: {
                float level = m.level + (n.level - m.level) * f;
                if (level <= 0.02f) break;
                dotted.setShader(dots(level, 10, 0.5f * Math.min(0.75f, level)));
                canvas.drawCircle(lerp(v, n.v, 0, f), lerp(v, n.v, 1, f), lerp(v, n.v, 2, f), dotted);
                break;
            }
            default: {
                path.rewind();
                for (int i = 0; i + 1 < v.length; i += 2) {
                    if (i == 0) path.moveTo(lerp(v, n.v, i, f), lerp(v, n.v, i + 1, f));
                    else path.lineTo(lerp(v, n.v, i, f), lerp(v, n.v, i + 1, f));
                }
                if (m.closed) path.close();
                if (m.fill == 1) {
                    canvas.drawPath(path, fill);
                } else if (m.fill == 2) {
                    fill.setColor(paper);
                    canvas.drawPath(path, fill);
                    fill.setColor(ink);
                } else if (m.fill == 3) {
                    dotted.setShader(dots(m.level, 10, 0.5f * Math.min(0.75f, m.level)));
                    canvas.drawPath(path, dotted);
                }
                if (m.width > 0) canvas.drawPath(path, stroke);
            }
        }
    }

    private static float lerp(float[] a, float[] b, int i, float f) {
        return a[i] + (b[i] - a[i]) * f;
    }

    /** A tile of one halftone dot, cell design px wide, the dot radius a fraction of the cell; cached by size. */
    private BitmapShader dots(float level, float cell, float radius) {
        int key = Math.round(radius * 100) * 1000 + Math.round(cell);
        BitmapShader s = dotShaders.get(key);
        if (s == null) {
            int size = Math.max(4, Math.round(cell * getWidth() / DESIGN_WIDTH));
            Bitmap tile = Bitmap.createBitmap(size, size, Bitmap.Config.ARGB_8888);
            Paint dot = new Paint(Paint.ANTI_ALIAS_FLAG);
            dot.setColor(ink);
            new Canvas(tile).drawCircle(size / 2f, size / 2f, radius * size, dot);
            s = new BitmapShader(tile, Shader.TileMode.REPEAT, Shader.TileMode.REPEAT);
            Matrix local = new Matrix();
            local.setScale(cell / size, cell / size);   // drawn in design px, the tile is in screen px
            s.setLocalMatrix(local);
            dotShaders.put(key, s);
        }
        return s;
    }

    // ---- TITANE!

    private void burst(Canvas canvas, float k) {
        canvas.save();
        canvas.scale(k, k);
        float cx = DESIGN_WIDTH / 2, cy = DESIGN_HEIGHT / 2, r = (float) Math.hypot(DESIGN_WIDTH, DESIGN_HEIGHT);
        path.rewind();
        for (int i = 0; i < 18; i++) {
            double a0 = i * Math.PI * 2 / 18, a1 = a0 + Math.PI / 18;
            path.moveTo(cx, cy);
            path.lineTo(cx + r * (float) Math.cos(a0), cy + r * (float) Math.sin(a0));
            path.lineTo(cx + r * (float) Math.cos(a1), cy + r * (float) Math.sin(a1));
            path.close();
        }
        dotted.setShader(dots(1, 14, 0.3f));
        canvas.drawPath(path, dotted);
        canvas.restore();
    }

    /** The word stamped across the screen; level 0 solid, growing paper dots eat it away up to 1. */
    private void shout(Canvas canvas, float k, float level, float scale) {
        if (level >= 1) return;
        int saved = canvas.saveLayer(null, null);
        canvas.scale(k, k);
        canvas.translate(DESIGN_WIDTH / 2, DESIGN_HEIGHT * 0.72f);
        canvas.rotate(-6);
        float size = DESIGN_WIDTH * 0.17f * scale;
        text.setTextSize(size);
        text.setStyle(Paint.Style.FILL);
        text.setShader(dots(1, 10, 0.4f));
        canvas.drawText(SHOUT, size * 0.06f, size * 0.06f, text);
        text.setShader(null);
        text.setStyle(Paint.Style.STROKE);
        text.setStrokeJoin(Paint.Join.ROUND);
        text.setStrokeWidth(size * 0.09f);
        text.setColor(paper);
        canvas.drawText(SHOUT, 0, 0, text);
        text.setStyle(Paint.Style.FILL);
        text.setColor(ink);
        canvas.drawText(SHOUT, 0, 0, text);
        if (level > 0) {
            erase.setShader(dots(1, 12, 0.75f * level));
            canvas.drawPaint(erase);
        }
        canvas.restoreToCount(saved);
    }

    private void unshake() {
        if (shakeTarget != null) {
            shakeTarget.setTranslationX(0);
            shakeTarget.setTranslationY(0);
        }
    }
}
