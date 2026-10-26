package io.github.mrfritzdjango.morningboard;

import android.content.Context;
import android.content.SharedPreferences;

/** The script's address and the last answer kept on the TV, shared by the screens, the provider and the refresh. */
final class Store {
    static final String PREFS = "board";

    private Store() {
    }

    /** The Apps Script address with the key and the query, from board.properties at build time; null until both are set. */
    static String address(String query) {
        if (BuildConfig.BOARD_URL.isEmpty() || BuildConfig.BOARD_KEY.isEmpty()) return null;
        return Agenda.url(BuildConfig.BOARD_URL, BuildConfig.BOARD_KEY, query);
    }

    static SharedPreferences prefs(Context context) {
        return context.getSharedPreferences(PREFS, Context.MODE_PRIVATE);
    }

    /** Keeps an answer and tells the launcher's Home it changed. */
    static void save(Context context, String body) {
        prefs(context).edit().putString("body", body).putLong("updated", System.currentTimeMillis()).apply();
        context.getContentResolver().notifyChange(AgendaProvider.URI, null);
    }

    /** Fetches and keeps the agenda (on a background thread); false when it failed. */
    static boolean fetch(Context context) {
        String address = address("");
        if (address == null) return false;
        try {
            String body = Agenda.get(address);
            Agenda.parse(body);
            save(context, body);
            return true;
        } catch (Exception e) {
            return false;
        }
    }
}
