package io.github.mrfritzdjango.ink;

import static org.junit.Assert.assertEquals;
import static org.junit.Assert.assertFalse;
import static org.junit.Assert.assertTrue;

import org.junit.Test;

public class SongBirdTest {
    @Test
    public void theBirdBowsEveryOtherStep() {
        assertFalse(SongBird.bowing(0));
        assertTrue(SongBird.bowing(SongBird.STEP_MS));
        assertTrue(SongBird.bowing(2 * SongBird.STEP_MS - 1));
        assertFalse(SongBird.bowing(2 * SongBird.STEP_MS));
    }

    @Test
    public void threeNotesRiseOneByOneThenClear() {
        int[] want = {0, 1, 1, 2, 2, 3, 3, 0};
        for (int step = 0; step < 16; step++) {
            assertEquals("step " + step, want[step % 8], SongBird.notes(step * SongBird.STEP_MS));
            assertEquals("late in step " + step, want[step % 8], SongBird.notes((step + 1) * SongBird.STEP_MS - 1));
        }
    }
}
