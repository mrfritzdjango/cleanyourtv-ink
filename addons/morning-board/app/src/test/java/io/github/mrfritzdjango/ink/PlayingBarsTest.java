package io.github.mrfritzdjango.ink;

import static org.junit.Assert.assertEquals;
import static org.junit.Assert.assertNotEquals;
import static org.junit.Assert.assertTrue;

import org.junit.Test;

public class PlayingBarsTest {
    @Test
    public void eachBarStepsThroughItsFourHeights() {
        assertEquals(.3f, PlayingBars.level(0, 0), 0f);
        assertEquals(1f, PlayingBars.level(0, 225), 0f);
        assertEquals(.85f, PlayingBars.level(0, 899), 0f);
        assertEquals(.3f, PlayingBars.level(0, 900), 0f);   // and round again
        assertEquals(.25f, PlayingBars.level(1, 1099), 0f);
        assertEquals(1f, PlayingBars.level(2, 959), 0f);
    }

    @Test
    public void theNextRedrawLandsOnABarsStep() {
        assertEquals(225, PlayingBars.untilNext(0));
        assertEquals(15, PlayingBars.untilNext(225));   // the third bar steps at 240
        for (long t = 0; t < 10_000; t++) {
            long next = PlayingBars.untilNext(t);
            assertTrue(next > 0 && next <= 240);
            boolean changes = false;
            for (int bar = 0; bar < 3; bar++) changes |= PlayingBars.level(bar, t + next) != PlayingBars.level(bar, t + next - 1);
            assertTrue("a redraw at " + (t + next) + " changes a bar", changes);
        }
        assertNotEquals(PlayingBars.level(1, 274), PlayingBars.level(1, 275));
    }
}
