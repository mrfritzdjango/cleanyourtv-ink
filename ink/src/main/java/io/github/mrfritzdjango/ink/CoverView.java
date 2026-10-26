package io.github.mrfritzdjango.ink;

import android.content.Context;
import android.graphics.Canvas;
import android.graphics.Paint;
import android.view.View;

/**
 * An album cover redrawn as ink dots, one per cell, on a square a shade off the page (so it reads as a square without a
 * border). In night ink, where the ink is light, a lighter part of the cover gets a bigger dot; on paper a darker one.
 */
public final class CoverView extends View {
    private final Paint dot = new Paint(Paint.ANTI_ALIAS_FLAG);
    private int cells = 22;
    private int tile;
    /** Each cell's dot as a share of half a cell, or null for an empty square. */
    private float[] dots;

    public CoverView(Context context) {
        super(context);
    }

    /** The page's square: paper with a twentieth of ink in it. */
    public static int tile(int paper, int ink) {
        int r = mix(paper >> 16 & 0xFF, ink >> 16 & 0xFF), g = mix(paper >> 8 & 0xFF, ink >> 8 & 0xFF), b = mix(paper & 0xFF, ink & 0xFF);
        return 0xFF000000 | r << 16 | g << 8 | b;
    }

    private static int mix(int a, int b) {
        return a + (b - a) / 20;
    }

    /** grey: Playing.COVER × Playing.COVER levels, or null; cells: dots across. */
    public void set(byte[] grey, int cells, int ink, int paper, boolean night) {
        this.cells = cells;
        tile = tile(paper, ink);
        dot.setColor(ink);
        dots = null;
        if (grey != null && grey.length == Playing.COVER * Playing.COVER) {
            dots = new float[cells * cells];
            for (int j = 0; j < cells; j++) {
                for (int i = 0; i < cells; i++) {
                    int x0 = i * Playing.COVER / cells, x1 = Math.max(x0 + 1, (i + 1) * Playing.COVER / cells);
                    int y0 = j * Playing.COVER / cells, y1 = Math.max(y0 + 1, (j + 1) * Playing.COVER / cells);
                    int sum = 0;
                    for (int y = y0; y < y1; y++) for (int x = x0; x < x1; x++) sum += grey[y * Playing.COVER + x] & 0xFF;
                    float v = sum / (255f * (x1 - x0) * (y1 - y0));
                    dots[j * cells + i] = 1.08f * (float) Math.sqrt(night ? v : 1 - v);
                }
            }
        }
        invalidate();
    }

    @Override
    protected void onDraw(Canvas canvas) {
        canvas.drawColor(tile);
        if (dots == null) return;
        float cell = getWidth() / (float) cells;
        for (int j = 0; j < cells; j++) {
            for (int i = 0; i < cells; i++) {
                float r = dots[j * cells + i] * cell / 2;
                if (r >= 0.5f) canvas.drawCircle((i + 0.5f) * cell, (j + 0.5f) * cell, r, dot);
            }
        }
    }
}
