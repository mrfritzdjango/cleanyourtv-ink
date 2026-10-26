package io.github.mrfritzdjango.morningboard;

import android.content.res.Resources;
import android.graphics.Bitmap;
import android.graphics.Color;
import android.graphics.Shader;
import android.graphics.drawable.BitmapDrawable;
import android.graphics.drawable.ColorDrawable;
import android.graphics.drawable.Drawable;
import android.graphics.drawable.LayerDrawable;

import java.time.LocalTime;
import java.util.Random;

/** The locked e-ink palette: day paper and ink, and the inverted night pair (night_start to night_end, options.xml). */
final class Ink {
    static final int PAPER = 0xFFE6E5DF;
    static final int INK = 0xFF1C1C1A;
    static final int MUTED = 0xFF4A4A46;
    static final int FADED = 0xFF6A6A64;
    static final int NIGHT_PAPER = 0xFF121211;
    static final int NIGHT_INK = 0xFFCFCEC8;
    static final int NIGHT_MUTED = 0xFFA3A29C;
    static final int NIGHT_FADED = 0xFF75746F;

    private Ink() {
    }

    static boolean isNight(Resources res) {
        if (res.getBoolean(R.bool.night_always)) return true;
        return Times.between(LocalTime.now(),
                Times.parse(res.getString(R.string.night_start), LocalTime.of(19, 30)),
                Times.parse(res.getString(R.string.night_end), LocalTime.of(7, 0)));
    }

    /** Paper with a faint fixed grain (a small noise tile, repeated), so the screen reads as paper, not a flat colour. */
    static Drawable paper(Resources res, boolean night) {
        int n = 128;
        int[] px = new int[n * n];
        Random random = new Random(7);
        for (int i = 0; i < px.length; i++) {
            int v = random.nextInt(256);
            px[i] = Color.argb(random.nextInt(night ? 10 : 18), v, v, v);
        }
        BitmapDrawable grain = new BitmapDrawable(res, Bitmap.createBitmap(px, n, n, Bitmap.Config.ARGB_8888));
        grain.setTileModeXY(Shader.TileMode.REPEAT, Shader.TileMode.REPEAT);
        return new LayerDrawable(new Drawable[] {new ColorDrawable(night ? NIGHT_PAPER : PAPER), grain});
    }
}
