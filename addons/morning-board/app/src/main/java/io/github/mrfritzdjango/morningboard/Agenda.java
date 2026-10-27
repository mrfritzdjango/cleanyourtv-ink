package io.github.mrfritzdjango.morningboard;

import org.json.JSONArray;
import org.json.JSONException;
import org.json.JSONObject;

import java.io.ByteArrayOutputStream;
import java.io.IOException;
import java.io.InputStream;
import java.io.UnsupportedEncodingException;
import java.net.HttpURLConnection;
import java.net.URL;
import java.net.URLEncoder;
import java.nio.charset.StandardCharsets;
import java.util.ArrayList;
import java.util.List;

/** Today's events and open tasks as the Apps Script returns them (apps-script/Code.gs), and the request for them. */
final class Agenda {
    static final long REFRESH_MS = 15 * 60_000L;
    static final long RETRY_MS = 2 * 60_000L;
    /** A fetch that has not finished in this long, redirect and slow network included, has failed. */
    private static final long DEADLINE_MS = 45_000L;
    /** The script's answer is a few kilobytes: past this it is not the agenda. */
    private static final int MAX_BYTES = 2 << 20;

    /** Why a fetch failed, kept for the screens and Home's previews (the launcher reads the same numbers). */
    static final int OK = 0;
    /** No answer: no network, Google not reached, too slow. */
    static final int NETWORK = 1;
    /** The script refused the key built into Today. */
    static final int KEY = 2;
    /** The script, or Google in front of it, answered with an error: authorisation, deployment, quota. */
    static final int SCRIPT = 3;

    /** The script answered, but with ok false. */
    static final class Refused extends JSONException {
        final int problem;

        Refused(String error) {
            super("refused: " + error);
            problem = "key".equals(error) ? KEY : SCRIPT;
        }
    }

    /** An answer other than 200 OK: the address is wrong, or the deployment is not open to Anyone. */
    static final class HttpError extends IOException {
        HttpError(int code) {
            super("HTTP " + code);
        }
    }

    /** What went wrong with a fetch that threw e. */
    static int problem(Exception e) {
        if (e instanceof Refused) return ((Refused) e).problem;
        // not JSON at all (an error or sign-in page), or an HTTP error: the script's side
        if (e instanceof JSONException || e instanceof HttpError) return SCRIPT;
        return NETWORK;
    }

    static final class Event {
        final String time;
        final String title;
        final String where;
        final boolean allDay;
        /** Began on an earlier day: its time is when it ends ("–17:00"), and it is never the next event. */
        final boolean carried;
        final long startMs;
        final long endMs;

        Event(JSONObject o) {
            time = o.optString("time");
            title = o.optString("title");
            where = o.optString("where");
            allDay = o.optBoolean("allDay");
            carried = o.optBoolean("carried");
            startMs = o.optLong("startMs");
            endMs = o.optLong("endMs");
        }
    }

    static final class Task {
        final String id;
        final String list;
        final String title;
        /** "overdue", "today", "tomorrow", a short date, or empty. */
        final String due;

        Task(JSONObject o) {
            id = o.optString("id");
            list = o.optString("list");
            title = o.optString("title");
            due = o.optString("due");
        }
    }

    final String todayLong;
    final String todayShort;
    final String tomorrowShort;
    final List<Event> events = new ArrayList<>();
    final List<Event> tomorrow = new ArrayList<>();
    /** On a day with nothing on: the first day after it that has something, as "17th Dec 2026", and its events. */
    final String nextDayLabel;
    final List<Event> nextDay = new ArrayList<>();
    final List<Task> tasks = new ArrayList<>();
    final List<String> doneToday = new ArrayList<>();
    /** The script could not read Google Tasks this time: the tasks are unknown, not none. */
    final boolean tasksFailed;

    private Agenda(JSONObject o) {
        todayLong = o.optString("todayLong");
        todayShort = o.optString("todayShort");
        tomorrowShort = o.optString("tomorrowShort");
        JSONArray a = o.optJSONArray("events");
        for (int i = 0; a != null && i < a.length(); i++) events.add(new Event(a.optJSONObject(i)));
        a = o.optJSONArray("tomorrow");
        for (int i = 0; a != null && i < a.length(); i++) tomorrow.add(new Event(a.optJSONObject(i)));
        JSONObject n = o.optJSONObject("nextDay");
        nextDayLabel = n == null ? "" : n.optString("label");
        a = n == null ? null : n.optJSONArray("events");
        for (int i = 0; a != null && i < a.length(); i++) nextDay.add(new Event(a.optJSONObject(i)));
        a = o.optJSONArray("tasks");
        for (int i = 0; a != null && i < a.length(); i++) tasks.add(new Task(a.optJSONObject(i)));
        a = o.optJSONArray("doneToday");
        for (int i = 0; a != null && i < a.length(); i++) doneToday.add(a.optJSONObject(i).optString("title"));
        tasksFailed = o.optBoolean("tasksFailed");
    }

    static Agenda parse(String body) throws JSONException {
        JSONObject o = new JSONObject(body);
        if (!o.optBoolean("ok")) throw new Refused(o.optString("error"));
        return new Agenda(o);
    }

    /**
     * The timed event under way or next at nowMs, or -1 once the day's events are over. One carried over from an earlier
     * day is left out: a three-day conference would otherwise be "next" all day long.
     */
    int next(long nowMs) {
        for (int i = 0; i < events.size(); i++) {
            Event e = events.get(i);
            if (!e.allDay && !e.carried && e.endMs > nowMs) return i;
        }
        return -1;
    }

    /** Moves a task to done at once, while the script marks it. */
    void markDone(Task task) {
        if (tasks.remove(task)) doneToday.add(0, task.title);
    }

    static String url(String base, String key, String query) {
        return base + (base.contains("?") ? "&" : "?") + "key=" + encode(key) + query;
    }

    static String encode(String s) {
        try {
            return URLEncoder.encode(s, "UTF-8");
        } catch (UnsupportedEncodingException e) {
            throw new AssertionError(e);
        }
    }

    /** A GET that follows the script's redirect to its answer, given up after DEADLINE_MS in all. */
    static String get(String address) throws IOException {
        long start = System.nanoTime();
        HttpURLConnection c = (HttpURLConnection) new URL(address).openConnection();
        c.setConnectTimeout(15_000);
        c.setReadTimeout(20_000);
        c.setInstanceFollowRedirects(true);
        try {
            int code = c.getResponseCode();
            if (code != HttpURLConnection.HTTP_OK) throw new HttpError(code);
            try (InputStream in = c.getInputStream()) {
                ByteArrayOutputStream out = new ByteArrayOutputStream();
                byte[] buf = new byte[8192];
                for (int n; (n = in.read(buf)) > 0; ) {
                    // each read has its own timeout: a trickle could otherwise hold the fetch for minutes
                    if (System.nanoTime() - start > DEADLINE_MS * 1_000_000L) throw new IOException("too slow");
                    if (out.size() > MAX_BYTES) throw new HttpError(code);
                    out.write(buf, 0, n);
                }
                return out.toString(StandardCharsets.UTF_8.name());
            }
        } finally {
            c.disconnect();
        }
    }
}
