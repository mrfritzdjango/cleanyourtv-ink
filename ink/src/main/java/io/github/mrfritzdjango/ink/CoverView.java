package io.github.mrfritzdjango.ink;

import android.content.Context;
import android.graphics.Bitmap;
import android.graphics.Canvas;
import android.graphics.Paint;
import android.graphics.Rect;
import android.view.View;

/**
 * An album cover (or a video's 16:9 frame) as a greyscale picture in sixteen shades of ink, like a cover on a Kindle, on
 * a tile a shade off the page (so it reads as a square without a border). The picture stays the right way round: in night
 * ink, where the ink is light, a lighter part of it gets more ink; on paper a darker one.
 */
public final class CoverView extends View {
    /** The shades between the tile and full ink. */
    private static final int SHADES = 16;

    private final Paint smooth = new Paint(Paint.FILTER_BITMAP_FLAG);
    private final Paint tilePaint = new Paint();
    private final Rect frame = new Rect();
    private int tile;
    /** The picture at the size it came in, one pixel per grey level, or null for an empty square. */
    private Bitmap picture;

    public CoverView(Context context) {
        super(context);
    }

    /** The page's square: paper with a twentieth of ink in it. */
    public static int tile(int paper, int ink) {
        return mix(paper, ink, 1 / 20f);
    }

    /** a moved a share t of the way to b, channel by channel. */
    private static int mix(int a, int b, float t) {
        int r = Math.round((a >> 16 & 0xFF) + ((b >> 16 & 0xFF) - (a >> 16 & 0xFF)) * t);
        int g = Math.round((a >> 8 & 0xFF) + ((b >> 8 & 0xFF) - (a >> 8 & 0xFF)) * t);
        int bl = Math.round((a & 0xFF) + ((b & 0xFF) - (a & 0xFF)) * t);
        return 0xFF000000 | r << 16 | g << 8 | bl;
    }

    /** grey: Playing.COVER × Playing.COVER levels, or null. */
    public void set(byte[] grey, int ink, int paper, boolean night) {
        set(grey, Playing.COVER, Playing.COVER, ink, paper, night);
    }

    /** grey: w × h levels, or null, in the same shape as the view. */
    public void set(byte[] grey, int w, int h, int ink, int paper, boolean night) {
        tile = tile(paper, ink);
        picture = null;
        if (grey != null && grey.length == w * h) {
            int[] shade = new int[SHADES];
            for (int s = 0; s < SHADES; s++) shade[s] = mix(tile, ink, s / (SHADES - 1f));
            int[] pixels = new int[w * h];
            for (int i = 0; i < pixels.length; i++) {
                int v = grey[i] & 0xFF;
                int s = Math.round((night ? v : 255 - v) * (SHADES - 1) / 255f);
                pixels[i] = shade[s];
            }
            picture = Bitmap.createBitmap(pixels, w, h, Bitmap.Config.ARGB_8888);
            picture.setHasMipMap(true);   // drawn a third of its size in the small block: smooth, not grainy
        }
        invalidate();
    }

    @Override
    protected void onDraw(Canvas canvas) {
        // its own square only: the song's block doesn't clip it (the kingfisher's notes reach past the cover)
        frame.set(0, 0, getWidth(), getHeight());
        tilePaint.setColor(tile);
        canvas.drawRect(frame, tilePaint);
        if (picture == null) return;
        canvas.drawBitmap(picture, null, frame, smooth);
    }
}
