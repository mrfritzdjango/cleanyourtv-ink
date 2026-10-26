package io.github.mrfritzdjango.morningboard;

import io.github.mrfritzdjango.ink.Playing;

import static org.junit.Assert.assertEquals;
import static org.junit.Assert.assertFalse;
import static org.junit.Assert.assertTrue;

import org.junit.Test;

public class PlayingTest {
    private static Playing song(boolean playing, long position, long at, long duration, long pausedAt) {
        return new Playing("Holocene", "Bon Iver", "Bon Iver, Bon Iver", "com.spotify.tv.android", playing, position, at, 1f,
                duration, pausedAt, null);
    }

    @Test
    public void positionMovesOnOnlyWhilePlaying() {
        assertEquals(134_000, song(true, 124_000, 1_000, 336_000, 0).positionAt(11_000));
        assertEquals(124_000, song(false, 124_000, 1_000, 336_000, 5).positionAt(11_000));
    }

    @Test
    public void positionStaysWithinTheSong() {
        assertEquals(336_000, song(true, 330_000, 0, 336_000, 0).positionAt(60_000));
        assertEquals(0, song(true, 0, 10_000, 336_000, 0).positionAt(0));
        assertEquals(400_000, song(true, 340_000, 0, 0, 0).positionAt(60_000));   // no length known: no cap
    }

    @Test
    public void pausedSongGoesAfterTenMinutes() {
        long paused = 1_000_000;
        assertTrue(song(false, 0, 0, 0, paused).shownAt(paused + Playing.PAUSED_SHOWN_MS - 1));
        assertFalse(song(false, 0, 0, 0, paused).shownAt(paused + Playing.PAUSED_SHOWN_MS));
        assertTrue(song(true, 0, 0, 0, 0).shownAt(Long.MAX_VALUE));
        assertFalse(new Playing("", "", "", "", true, 0, 0, 1f, 0, 0, null).shownAt(0));
    }

    @Test
    public void timesReadLikeAClock() {
        assertEquals("0:00", Playing.time(0));
        assertEquals("2:14", Playing.time(134_999));
        assertEquals("5:36", Playing.time(336_000));
        assertEquals("1:02:03", Playing.time(3_723_000));
    }

    @Test
    public void greyWeighsGreenMost() {
        assertEquals(255, Playing.grey(0xFFFFFFFF));
        assertEquals(0, Playing.grey(0xFF000000));
        assertTrue(Playing.grey(0xFF00FF00) > Playing.grey(0xFFFF0000));
        assertTrue(Playing.grey(0xFFFF0000) > Playing.grey(0xFF0000FF));
    }
}
