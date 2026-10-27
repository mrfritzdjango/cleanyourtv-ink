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

    @Test public void swapKeepsTheAppsNotShownWhereTheyAre() {
        // x.x is chosen but not on the TV now: moving c.c up past b.b on Home leaves it in place
        List<String> apps = Arrays.asList("a.a", "b.b", "x.x", "c.c");
        assertEquals(Arrays.asList("a.a", "c.c", "x.x", "b.b"), InkApps.swap(apps, "c.c", "b.b"));
        assertEquals(apps, InkApps.swap(apps, "a.a", "gone.app"));
    }

    @Test public void roomLeavesEightRowsAboveScreensaver() {
        assertEquals(6, InkApps.room(true));   // Calendar and Tasks take two
        assertEquals(8, InkApps.room(false));
    }
}
