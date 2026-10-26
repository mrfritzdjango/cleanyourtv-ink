package io.github.mrfritzdjango.morningboard;

import io.github.mrfritzdjango.ink.SvgPath;

import static org.junit.Assert.assertEquals;

import org.junit.Test;

public class SvgPathTest {
    private static String record(String d) {
        StringBuilder out = new StringBuilder();
        SvgPath.parse(d, new SvgPath.Sink() {
            @Override public void moveTo(float x, float y) { out.append("M").append(x).append(",").append(y).append(" "); }
            @Override public void lineTo(float x, float y) { out.append("L").append(x).append(",").append(y).append(" "); }
            @Override public void cubicTo(float x1, float y1, float x2, float y2, float x3, float y3) { out.append("C").append(x3).append(",").append(y3).append(" "); }
            @Override public void quadTo(float x1, float y1, float x2, float y2) { out.append("Q").append(x2).append(",").append(y2).append(" "); }
            @Override public void close() { out.append("Z "); }
        });
        return out.toString().trim();
    }

    @Test
    public void readsTheCommandsTheDrawingsUse() {
        assertEquals("M1.0,2.0 L3.0,4.0 C9.0,10.0 Q13.0,14.0 Z",
                record("M1 2 L3 4 C5 6 7 8 9 10 Q11 12 13 14 Z"));
    }

    @Test
    public void commasLettersWithoutSpacesAndExtraPairs() {
        assertEquals("M1.0,2.0 L3.0,4.0 L5.5,-6.0 Z M7.0,8.0", record("M1,2 3,4L5.5 -6ZM7 8"));
    }

    @Test(expected = IllegalArgumentException.class)
    public void otherCommandsAreRefused() {
        record("M1 2 A5 5 0 0 1 10 10");
    }

    @Test(expected = IllegalArgumentException.class)
    public void aCutOffPathIsRefused() {
        record("M1 2 C3 4 5");
    }
}
