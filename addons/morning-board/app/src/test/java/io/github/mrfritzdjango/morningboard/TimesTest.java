package io.github.mrfritzdjango.morningboard;

import static org.junit.Assert.assertEquals;
import static org.junit.Assert.assertFalse;
import static org.junit.Assert.assertTrue;

import java.time.LocalTime;
import java.time.ZoneId;
import java.time.ZonedDateTime;

import org.junit.Test;

public class TimesTest {
    private static final ZoneId KL = ZoneId.of("Asia/Kuala_Lumpur");

    private static long at(int y, int mo, int d, int h, int mi) {
        return ZonedDateTime.of(y, mo, d, h, mi, 0, 0, KL).toInstant().toEpochMilli();
    }

    @Test
    public void nextSevenIsTodayBeforeSevenAndTomorrowAfter() {
        assertEquals(at(2026, 10, 25, 7, 0), Times.nextAt(at(2026, 10, 25, 6, 59), KL, 7, 0));
        assertEquals(at(2026, 10, 26, 7, 0), Times.nextAt(at(2026, 10, 25, 7, 0), KL, 7, 0));
        assertEquals(at(2026, 10, 26, 7, 0), Times.nextAt(at(2026, 10, 25, 23, 30), KL, 7, 0));
        assertEquals(at(2027, 1, 1, 7, 0), Times.nextAt(at(2026, 12, 31, 8, 0), KL, 7, 0));
    }

    @Test
    public void nightWrapsPastMidnight() {
        LocalTime start = LocalTime.of(19, 30), end = LocalTime.of(7, 0);
        assertTrue(Times.between(LocalTime.of(22, 0), start, end));
        assertTrue(Times.between(LocalTime.of(3, 0), start, end));
        assertFalse(Times.between(LocalTime.of(7, 0), start, end));
        assertFalse(Times.between(LocalTime.of(12, 0), start, end));
        assertTrue(Times.between(LocalTime.of(19, 30), start, end));
    }

    @Test
    public void clockHasNoLeadingZero() {
        assertEquals("7:00", Times.clock(LocalTime.of(7, 0)));
        assertEquals("19:05", Times.clock(LocalTime.of(19, 5)));
        assertEquals(LocalTime.of(7, 0), Times.parse("7:00", LocalTime.MIDNIGHT));
        assertEquals(LocalTime.MIDNIGHT, Times.parse("late", LocalTime.MIDNIGHT));
    }
}
