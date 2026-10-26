package io.github.mrfritzdjango.morningboard;

import android.content.Context;
import android.graphics.Canvas;
import android.graphics.Paint;
import android.graphics.Path;
import android.view.View;

/** A task's square: an ink outline, with a tick once the task is done. */
final class Box extends View {
    private final Paint paint = new Paint(Paint.ANTI_ALIAS_FLAG);
    private final Path tick = new Path();
    private final boolean checked;

    Box(Context context, int color, float stroke, boolean checked) {
        super(context);
        this.checked = checked;
        paint.setColor(color);
        paint.setStyle(Paint.Style.STROKE);
        paint.setStrokeWidth(stroke);
        paint.setStrokeCap(Paint.Cap.SQUARE);
    }

    @Override
    protected void onDraw(Canvas canvas) {
        float s = paint.getStrokeWidth() / 2, w = getWidth(), h = getHeight();
        canvas.drawRect(s, s, w - s, h - s, paint);
        if (!checked) return;
        tick.reset();
        tick.moveTo(w * 0.22f, h * 0.52f);
        tick.lineTo(w * 0.42f, h * 0.72f);
        tick.lineTo(w * 0.78f, h * 0.30f);
        canvas.drawPath(tick, paint);
    }
}
