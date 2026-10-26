package io.github.mrfritzdjango.morningboard;

import java.time.Instant;
import java.time.LocalTime;
import java.time.ZoneId;
import java.time.ZonedDateTime;

/** Clock arithmetic for the alarm and the night ink, free of Android so it runs in plain JVM tests. */
final class Times {
    private Times() {
    }

    /** The next hour:minute strictly after nowMs, in zone. */
    static long nextAt(long nowMs, ZoneId zone, int hour, int minute) {
        ZonedDateTime now = Instant.ofEpochMilli(nowMs).atZone(zone);
        ZonedDateTime at = now.toLocalDate().atTime(hour, minute).atZone(zone);
        if (!at.isAfter(now)) at = now.toLocalDate().plusDays(1).atTime(hour, minute).atZone(zone);
        return at.toInstant().toEpochMilli();
    }

    /** Whether now is in [start, end), wrapping past midnight when start is later than end. */
    static boolean between(LocalTime now, LocalTime start, LocalTime end) {
        if (start.equals(end)) return false;
        if (start.isBefore(end)) return !now.isBefore(start) && now.isBefore(end);
        return !now.isBefore(start) || now.isBefore(end);
    }

    /** "19:30" or "7:00" as a time; anything else gives the fallback. */
    static LocalTime parse(String hhmm, LocalTime fallback) {
        try {
            return LocalTime.parse(hhmm.length() == 4 ? "0" + hhmm : hhmm);
        } catch (RuntimeException e) {
            return fallback;
        }
    }

    /** "7:00", the hour without a leading zero, as every clock in the design. */
    static String clock(LocalTime t) {
        return t.getHour() + (t.getMinute() < 10 ? ":0" : ":") + t.getMinute();
    }
}
