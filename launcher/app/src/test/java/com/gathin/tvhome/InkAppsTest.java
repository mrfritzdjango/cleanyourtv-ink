package com.gathin.tvhome;

import org.junit.Test;

import java.util.Arrays;
import java.util.List;

import static org.junit.Assert.assertEquals;

public class InkAppsTest {
    private static final List<String> DOCK = Arrays.asList("com.google.android.youtube.tv", "com.netflix.ninja");

    @Test public void nothingSavedKeepsDockApps() {
        assertEquals(DOCK, InkApps.chosen(null, null, DOCK));
    }

    @Test public void theChoiceMadeOnTheTvWins() {
        String saved = "com.wbd.stream,com.google.android.youtube.tv";
        assertEquals(Arrays.asList("com.wbd.stream", "com.google.android.youtube.tv"),
                InkApps.chosen(saved, InkApps.encode(DOCK), DOCK));
    }

    @Test public void aNewDockAppsListTakesOverFromTheChoice() {
        // rebuilt with another config.xml: the new dock_apps shows, as with the stock Home's saved order
        List<String> rebuilt = Arrays.asList("com.netflix.ninja");
        assertEquals(rebuilt, InkApps.chosen("com.wbd.stream", InkApps.encode(DOCK), rebuilt));
    }

    @Test public void decodeDropsBlanksDuplicatesAndNonsense() {
        assertEquals(Arrays.asList("com.wbd.stream", "com.netflix.ninja"),
                InkApps.decode("com.wbd.stream,, com.netflix.ninja,com.wbd.stream,not a package"));
    }

    @Test public void movesOnePlaceAndStopsAtTheEnds() {
        List<String> apps = Arrays.asList("a.a", "b.b", "c.c");
        assertEquals(Arrays.asList("b.b", "a.a", "c.c"), InkApps.move(apps, 0, 1));
        assertEquals(Arrays.asList("a.a", "c.c", "b.b"), InkApps.move(apps, 2, -1));
        assertEquals(apps, InkApps.move(apps, 0, -1));
        assertEquals(apps, InkApps.move(apps, 2, 1));
    }

    @Test public void roomLeavesEightRowsAboveScreensaver() {
        assertEquals(6, InkApps.room(true));   // Calendar and Tasks take two
        assertEquals(8, InkApps.room(false));
    }
}
