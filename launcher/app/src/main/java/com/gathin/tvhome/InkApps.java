package com.gathin.tvhome;

import android.content.Context;
import android.content.SharedPreferences;

import java.util.ArrayList;
import java.util.Collections;
import java.util.List;

/**
 * ink_home: the apps on the Home list, as the owner chose them on the TV (Settings, Home apps). The choice is kept in
 * the "ink_home" preferences with the dock_apps it was made under: when dock_apps changes (a rebuild with another
 * config.xml), the saved choice is ignored and the new dock_apps takes effect, as with the stock Home's saved order
 * (Order). Saving the dock_apps themselves clears the choice.
 */
final class InkApps {
    private static final String PREFS = "ink_home";
    private static final String APPS = "apps";
    private static final String UNDER = "apps_under";

    private InkApps() {}

    /** The app rows' packages, in order: the saved choice when it was made under these dock_apps, else dock_apps. */
    static List<String> load(Context context, List<String> dockApps) {
        SharedPreferences p = context.getSharedPreferences(PREFS, Context.MODE_PRIVATE);
        return chosen(p.getString(APPS, null), p.getString(UNDER, null), dockApps);
    }

    static void save(Context context, List<String> apps, List<String> dockApps) {
        SharedPreferences.Editor e = context.getSharedPreferences(PREFS, Context.MODE_PRIVATE).edit();
        if (apps.equals(dockApps)) e.remove(APPS).remove(UNDER);
        else e.putString(APPS, encode(apps)).putString(UNDER, encode(dockApps));
        e.apply();
    }

    static List<String> chosen(String saved, String under, List<String> dockApps) {
        if (saved == null || !encode(dockApps).equals(under)) return dockApps;
        return decode(saved);
    }

    static String encode(List<String> apps) {
        return String.join(",", apps);
    }

    static List<String> decode(String text) {
        List<String> out = new ArrayList<>();
        if (text == null) return out;
        for (String pkg : text.split(",")) {
            String p = pkg.trim();
            if (!p.isEmpty() && LibraryApps.validPackage(p) && !out.contains(p)) out.add(p);
        }
        return out;
    }

    /** The list with the app at {@code from} moved one place up (-1) or down (+1); unchanged at either end. */
    static List<String> move(List<String> apps, int from, int by) {
        List<String> out = new ArrayList<>(apps);
        int to = from + by;
        if (from < 0 || from >= out.size() || to < 0 || to >= out.size()) return out;
        Collections.swap(out, from, to);
        return out;
    }

    /** At most this many app rows: the Home list holds eight rows above Screensaver, Calendar and Tasks among them. */
    static int room(boolean today) {
        return today ? 6 : 8;
    }
}
