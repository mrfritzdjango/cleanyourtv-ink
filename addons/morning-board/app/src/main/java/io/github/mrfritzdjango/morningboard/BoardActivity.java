package io.github.mrfritzdjango.morningboard;

import android.app.Activity;
import android.content.Context;
import android.content.Intent;
import android.content.SharedPreferences;
import android.graphics.Paint;
import android.graphics.Typeface;
import android.graphics.drawable.Drawable;
import android.graphics.drawable.GradientDrawable;
import android.os.Build;
import android.os.Bundle;
import android.os.Handler;
import android.os.Looper;
import android.os.PowerManager;
import android.text.TextUtils;
import android.util.TypedValue;
import android.view.Gravity;
import android.view.KeyEvent;
import android.view.View;
import android.view.ViewGroup;
import android.view.WindowManager;
import android.widget.FrameLayout;
import android.widget.LinearLayout;
import android.widget.ScrollView;
import android.widget.TextView;

import org.json.JSONException;

import java.time.Instant;
import java.time.LocalTime;
import java.time.ZoneId;
import java.time.ZonedDateTime;
import java.time.format.DateTimeFormatter;
import java.util.List;
import java.util.Locale;
import java.util.concurrent.ExecutorService;
import java.util.concurrent.Executors;

/**
 * Today, in the Home's e-ink style: the morning board, the Calendar and the Tasks screens. Text on paper, the selected
 * row an inverted ink bar, and a changed screen simply swaps: no flash, nothing slides or fades. It reads the Apps Script only while it is on screen (every {@link Agenda#REFRESH_MS}) and keeps the last
 * answer, so a dropped connection still shows the day. Sizes are the 1920 × 1080 design's, scaled to the screen.
 */
public final class BoardActivity extends Activity {
    static final String EXTRA_SCREEN = "screen";
    static final String EXTRA_ALARM = "alarm";
    static final String SCREEN_BOARD = "board";
    static final String SCREEN_CALENDAR = "calendar";
    static final String SCREEN_TASKS = "tasks";

    private static final String PREFS = "board";
    private static final float DESIGN_WIDTH = 1920f;
    /** The morning board shows five of each; Calendar and Tasks show every row, scrolling to follow the bar. */
    private static final int BOARD_ROWS = 5;
    private static final DateTimeFormatter DAY_TIME = DateTimeFormatter.ofPattern("EEE d MMM H:mm", Locale.ENGLISH);
    private static final int DONE_ROWS = 2;

    private final ExecutorService io = Executors.newSingleThreadExecutor();
    private final Handler main = new Handler(Looper.getMainLooper());
    private final Runnable tick = this::refresh;
    private final Runnable minute = this::onMinute;
    private final Runnable closeBoard = this::closeBoard;
    private SharedPreferences prefs;
    private FrameLayout root;
    private LinearLayout page;
    private Typeface regular;
    private Typeface bold;
    private float scale;
    private Drawable dayPaper;
    private Drawable nightPaper;
    private PowerManager.WakeLock wake;

    private String screen = SCREEN_CALENDAR;
    private Agenda agenda;
    private String agendaBody;
    /** Why the last fetch failed (Agenda.NETWORK, KEY, SCRIPT), or Agenda.OK. */
    private int problem;
    private long updatedMs;
    private int selected;
    private int selectable;
    /** Calendar's or Tasks' list as it scrolls now, kept across the redraws, and the selected row in it. */
    private Rows scroll;
    private int scrollY;
    private View selectedRow;
    private int paper = Ink.PAPER;
    private int ink = Ink.INK;
    private int muted = Ink.MUTED;
    private int faded = Ink.FADED;

    /** The alarm's way in (an alias the manifest keeps private): only it may wake the screen. */
    private static final String ALARM_ALIAS = "io.github.mrfritzdjango.morningboard.MorningAlarm";

    private boolean resumed;

    /** The morning board as the alarm opens it, waking the screen. */
    static Intent alarmIntent(Context context) {
        return new Intent().setClassName(context, ALARM_ALIAS)
                .putExtra(EXTRA_SCREEN, SCREEN_BOARD)
                .putExtra(EXTRA_ALARM, true)
                .addFlags(Intent.FLAG_ACTIVITY_NEW_TASK);
    }

    @Override
    protected void onCreate(Bundle state) {
        super.onCreate(state);
        prefs = getSharedPreferences(PREFS, MODE_PRIVATE);
        regular = getResources().getFont(R.font.atkinson_regular);
        bold = getResources().getFont(R.font.atkinson_bold);
        scale = getResources().getDisplayMetrics().widthPixels / DESIGN_WIDTH;
        root = new FrameLayout(this);
        page = new LinearLayout(this);
        page.setOrientation(LinearLayout.VERTICAL);
        root.addView(page, new FrameLayout.LayoutParams(ViewGroup.LayoutParams.MATCH_PARENT, ViewGroup.LayoutParams.MATCH_PARENT));
        setContentView(root);
        agendaBody = prefs.getString("body", null);
        updatedMs = prefs.getLong("updated", 0);
        problem = prefs.getInt("problem", Agenda.OK);
        if (agendaBody != null) {
            try {
                agenda = Agenda.parse(agendaBody);
            } catch (JSONException e) {
                agendaBody = null;
            }
        }
        open(getIntent());
        Alarm.schedule(this);
    }

    @Override
    protected void onNewIntent(Intent intent) {
        super.onNewIntent(intent);
        setIntent(intent);
        open(intent);
    }

    @Override
    protected void onResume() {
        super.onResume();
        resumed = true;
        refresh();
        scheduleMinute();
    }

    @Override
    protected void onPause() {
        super.onPause();
        resumed = false;
        main.removeCallbacks(tick);   // nothing is fetched while the screen is not showing
        main.removeCallbacks(minute);
    }

    @Override
    protected void onDestroy() {
        super.onDestroy();
        main.removeCallbacksAndMessages(null);
        io.shutdownNow();
    }

    private void open(Intent intent) {
        String s = intent.getStringExtra(EXTRA_SCREEN);
        screen = s != null ? s : SCREEN_CALENDAR;
        selected = 0;
        scrollY = 0;
        // An exported activity can be started by any app: only the private alias wakes the screen.
        boolean alarm = intent.getComponent() != null && ALARM_ALIAS.equals(intent.getComponent().getClassName());
        if (alarm && intent.getBooleanExtra(EXTRA_ALARM, false)) wakeUp();
        render();
    }

    /**
     * The morning alarm: turn the screen on (a Chromecast then turns the TV on over HDMI-CEC, if the TV allows it)
     * and keep it on until board_until_hour, then go back to Home.
     */
    @SuppressWarnings("deprecation")   // ACQUIRE_CAUSES_WAKEUP with a full wake lock is still how a TV box is woken
    private void wakeUp() {
        screen = SCREEN_BOARD;
        if (Build.VERSION.SDK_INT >= 27) {
            setShowWhenLocked(true);
            setTurnScreenOn(true);
        }
        getWindow().addFlags(WindowManager.LayoutParams.FLAG_KEEP_SCREEN_ON);
        if (wake == null) {
            wake = getSystemService(PowerManager.class).newWakeLock(
                    PowerManager.FULL_WAKE_LOCK | PowerManager.ACQUIRE_CAUSES_WAKEUP, "morningboard:wake");
        }
        wake.acquire(10_000);
        long now = System.currentTimeMillis();
        long until = Times.nextAt(now, ZoneId.systemDefault(), getResources().getInteger(R.integer.board_until_hour), 0);
        main.removeCallbacks(closeBoard);
        main.postDelayed(closeBoard, until - now);
        Alarm.schedule(this);   // tomorrow's
    }

    private void closeBoard() {
        getWindow().clearFlags(WindowManager.LayoutParams.FLAG_KEEP_SCREEN_ON);
        if (SCREEN_BOARD.equals(screen) && !isFinishing()) finish();
    }

    private void scheduleMinute() {
        main.removeCallbacks(minute);
        main.postDelayed(minute, 60_000 - System.currentTimeMillis() % 60_000 + 50);
    }

    private void onMinute() {
        render();   // the clock, and the change to or from night ink
        scheduleMinute();
    }

    private static String address(String query) {
        return Store.address(query);
    }

    private void refresh() {
        main.removeCallbacks(tick);
        String address = address("");
        if (address == null) {
            render();
            return;
        }
        io.execute(() -> {
            String body;
            Agenda result;
            int failure = Agenda.OK;
            try {
                body = Agenda.get(address);
                result = Agenda.parse(body);
            } catch (Exception e) {
                body = null;
                result = null;
                failure = Agenda.problem(e);
            }
            String b = body;
            Agenda r = result;
            int f = failure;
            main.post(() -> {
                if (isDestroyed()) return;
                if (r != null) {
                    agenda = r;
                    agendaBody = b;
                    problem = Agenda.OK;
                    updatedMs = System.currentTimeMillis();
                    Store.save(BoardActivity.this, b);
                    render();
                } else {
                    Store.failed(BoardActivity.this, f);   // Home's previews say the same
                    if (problem != f) {
                        problem = f;
                        render();
                    }
                }
                if (resumed) main.postDelayed(tick, r != null ? Agenda.REFRESH_MS : Agenda.RETRY_MS);
            });
        });
    }

    private void markDone(Agenda.Task task) {
        agenda.markDone(task);
        selected = Math.max(0, Math.min(selected, agenda.tasks.size() - 1));   // the bar stays on the list
        render();
        String address = address("&action=done&list=" + Agenda.encode(task.list) + "&task=" + Agenda.encode(task.id));
        if (address == null) return;
        io.execute(() -> {
            try {
                Agenda.get(address);
            } catch (Exception ignored) {
                // the refresh below shows the script's own list: the task comes back if the mark did not go through
            }
            main.post(() -> {
                if (resumed) refresh();   // otherwise onResume fetches anyway
            });
        });
    }

    // ---- Keys: up and down move the ink bar, left and right swap Calendar and Tasks, OK acts, Back leaves.

    @Override
    public boolean onKeyDown(int keyCode, KeyEvent event) {
        switch (keyCode) {
            case KeyEvent.KEYCODE_DPAD_UP:
                return move(-1);
            case KeyEvent.KEYCODE_DPAD_DOWN:
                return move(1);
            case KeyEvent.KEYCODE_DPAD_LEFT:
            case KeyEvent.KEYCODE_DPAD_RIGHT:
                if (!SCREEN_BOARD.equals(screen)) {
                    screen = SCREEN_TASKS.equals(screen) ? SCREEN_CALENDAR : SCREEN_TASKS;
                    selected = 0;
                    scrollY = 0;
                    render();
                }
                return true;
            case KeyEvent.KEYCODE_DPAD_CENTER:
            case KeyEvent.KEYCODE_ENTER:
            case KeyEvent.KEYCODE_NUMPAD_ENTER:
                // Held OK repeats: each repeat would tick off the next task too.
                if (event.getRepeatCount() > 0) return true;
                if (SCREEN_BOARD.equals(screen)) {
                    closeBoard();
                    finish();
                } else if (SCREEN_TASKS.equals(screen) && agenda != null && selected < Math.min(agenda.tasks.size(), selectable)) {
                    markDone(agenda.tasks.get(selected));
                }
                return true;
            default:
                return super.onKeyDown(keyCode, event);
        }
    }

    private boolean move(int by) {
        if (selectable == 0) return true;
        int s = Math.max(0, Math.min(selectable - 1, selected + by));
        if (s != selected) {
            selected = s;
            render();   // the bar jumps
        }
        return true;
    }

    // ---- Drawing

    private void render() {
        boolean night = (!SCREEN_BOARD.equals(screen) || getResources().getBoolean(R.bool.night_always))
                && Ink.isNight(getResources());
        paper = night ? Ink.NIGHT_PAPER : Ink.PAPER;
        ink = night ? Ink.NIGHT_INK : Ink.INK;
        muted = night ? Ink.NIGHT_MUTED : Ink.MUTED;
        faded = night ? Ink.NIGHT_FADED : Ink.FADED;
        root.setBackground(paper(night));
        fill();
    }

    private void fill() {
        page.removeAllViews();
        page.setGravity(Gravity.NO_GRAVITY);
        selectable = 0;
        scroll = null;
        selectedRow = null;
        if (address("") == null) setup();
        else if (SCREEN_BOARD.equals(screen)) board();
        else if (SCREEN_TASKS.equals(screen)) tasks();
        else calendar();
        if (selected >= selectable) selected = Math.max(0, selectable - 1);
    }

    private Drawable paper(boolean night) {
        if (night) return nightPaper != null ? nightPaper : (nightPaper = Ink.paper(getResources(), true));
        return dayPaper != null ? dayPaper : (dayPaper = Ink.paper(getResources(), false));
    }

    private void board() {
        page.setPadding(px(240), px(120), px(240), px(100));
        LinearLayout top = row();
        top.addView(text(getString(R.string.good_morning), 56, false, ink), weight());
        top.addView(text(Times.clock(LocalTime.now()), 56, false, ink));
        page.addView(top);
        add(page, text(agenda != null ? agenda.todayLong : "", 30, false, muted), 24);

        LinearLayout cols = row();
        cols.setGravity(Gravity.TOP);
        LinearLayout left = column();
        LinearLayout right = column();
        left.addView(label(getString(R.string.today), ink));
        right.addView(label(getString(R.string.tasks_label), ink));
        if (agenda == null) {
            add(left, wrapped(text(statusText(), 42, false, muted)), 26);
        } else {
            int next = agenda.next(System.currentTimeMillis());
            List<Agenda.Event> events = agenda.events;
            if (events.isEmpty()) add(left, text(getString(R.string.nothing_today), 42, false, muted), 26);
            for (int i = 0; i < Math.min(events.size(), BOARD_ROWS); i++) {
                Agenda.Event e = events.get(i);
                LinearLayout r = row();
                TextView time = text(e.time, 42, i == next, ink);
                r.addView(time, new LinearLayout.LayoutParams(px(190), ViewGroup.LayoutParams.WRAP_CONTENT));
                r.addView(text(e.title, 42, i == next, ink), weight());
                add(left, r, 26);
            }
            if (events.isEmpty() && !agenda.nextDay.isEmpty()) {
                add(left, label(agenda.nextDayLabel, ink), 56);
                for (int i = 0; i < Math.min(agenda.nextDay.size(), BOARD_ROWS - 1); i++) {
                    Agenda.Event e = agenda.nextDay.get(i);
                    LinearLayout r = row();
                    r.addView(text(e.time, 42, false, ink), new LinearLayout.LayoutParams(px(190), ViewGroup.LayoutParams.WRAP_CONTENT));
                    r.addView(text(e.title, 42, false, ink), weight());
                    add(left, r, 26);
                }
            }
            if (agenda.tasks.isEmpty()) add(right, text(getString(agenda.tasksFailed ? R.string.tasks_failed : R.string.no_tasks), 42, false, muted), 26);
            for (int i = 0; i < Math.min(agenda.tasks.size(), BOARD_ROWS); i++) {
                LinearLayout r = row();
                r.addView(new Box(this, ink, 3 * scale, false), new LinearLayout.LayoutParams(px(30), px(30)));
                gap(r, 24);
                r.addView(text(agenda.tasks.get(i).title, 42, false, ink), weight());
                add(right, r, 26);
            }
        }
        cols.addView(left, weight());
        gap(cols, 120);
        cols.addView(right, weight());
        add(page, cols, 110);

        spacer(page);
        LinearLayout footer = row();
        key(footer, R.string.key_ok, R.string.hint_home);
        note(footer);
        page.addView(footer);
    }

    private void calendar() {
        page.setPadding(px(216), px(110), px(240), px(80));
        header(getString(R.string.calendar), Times.clock(LocalTime.now()));
        if (agenda == null) {
            status();
            return;
        }
        LinearLayout list = scrolling();
        String day = agenda.todayShort.toUpperCase(Locale.ROOT);
        // an answer from an earlier day (no network since) goes by its date, not as today's
        add(list, padded(label(fresh() ? getString(R.string.today_label, day) : day, ink)), 64);
        int next = agenda.next(System.currentTimeMillis());
        int shown = 0;
        if (agenda.events.isEmpty()) add(list, padded(text(getString(R.string.nothing_today), 44, false, muted)), 16);
        for (int i = 0; i < agenda.events.size(); i++, shown++) {
            add(list, eventRow(agenda.events.get(i), shown == selected, i == next, false), 0);
        }
        if (agenda.events.isEmpty() && !agenda.nextDay.isEmpty()) {
            // a day with nothing on: the next day that has something, in today's format, in place of tomorrow
            add(list, padded(label(agenda.nextDayLabel, ink)), 36);
            for (int i = 0; i < agenda.nextDay.size(); i++, shown++) {
                add(list, eventRow(agenda.nextDay.get(i), shown == selected, false, false), 0);
            }
        } else if (!agenda.tomorrow.isEmpty()) {
            add(list, padded(label(getString(R.string.tomorrow_label, agenda.tomorrowShort.toUpperCase(Locale.ROOT)), ink)), 36);
            for (int i = 0; i < agenda.tomorrow.size(); i++, shown++) {
                add(list, eventRow(agenda.tomorrow.get(i), shown == selected, false, true), 0);
            }
        }
        selectable = shown;
        keepInView();
        LinearLayout footer = padded(row());
        key(footer, R.string.key_back, R.string.hint_home);
        gap(footer, 40);
        key(footer, R.string.key_sides, R.string.hint_to_tasks);
        note(footer);
        page.addView(footer);
    }

    private void tasks() {
        page.setPadding(px(216), px(110), px(240), px(80));
        header(getString(R.string.tasks), getString(R.string.open_count, agenda == null ? 0 : agenda.tasks.size()));
        if (agenda == null) {
            status();
            return;
        }
        LinearLayout list = scrolling();
        add(list, padded(label(getString(R.string.my_tasks), ink)), 64);
        int done = Math.min(agenda.doneToday.size(), DONE_ROWS);
        int open = agenda.tasks.size();
        if (open == 0) add(list, padded(text(getString(agenda.tasksFailed ? R.string.tasks_failed : R.string.no_tasks), 44, false, muted)), 16);
        for (int i = 0; i < open; i++) add(list, taskRow(agenda.tasks.get(i), i == selected), 0);
        selectable = open;
        if (done > 0) {
            add(list, padded(label(getString(R.string.done_label), muted)), 36);
            for (int i = 0; i < done; i++) {
                LinearLayout r = padded(row());
                r.setPadding(px(24), px(18), px(24), px(18));
                r.addView(new Box(this, faded, 3 * scale, true), new LinearLayout.LayoutParams(px(32), px(32)));
                gap(r, 32);
                TextView t = text(agenda.doneToday.get(i), 44, false, faded);
                t.setPaintFlags(t.getPaintFlags() | Paint.STRIKE_THRU_TEXT_FLAG);
                r.addView(t, weight());
                list.addView(r);
            }
        }
        keepInView();
        LinearLayout footer = padded(row());
        if (open > 0) {
            key(footer, R.string.key_ok, R.string.hint_done);
            gap(footer, 40);
        }
        key(footer, R.string.key_back, R.string.hint_home);
        gap(footer, 40);
        key(footer, R.string.key_sides, R.string.hint_to_calendar);
        note(footer);
        page.addView(footer);
    }

    private void setup() {
        page.setPadding(px(240), 0, px(240), 0);
        page.setGravity(Gravity.CENTER_VERTICAL);
        page.addView(text(getString(R.string.setup_title), 56, false, ink));
        TextView body = text(getString(R.string.setup_body), 32, false, muted);
        body.setSingleLine(false);
        add(page, body, 28);
    }

    private void status() {
        add(page, padded(wrapped(text(statusText(), 44, false, muted))), 64);
    }

    /** What a screen with no agenda yet says: fetching, or why the fetch failed and what to do about it. */
    private String statusText() {
        switch (problem) {
            case Agenda.NETWORK:
                return getString(R.string.unreachable);
            case Agenda.KEY:
                return getString(R.string.key_refused);
            case Agenda.SCRIPT:
                return getString(R.string.script_error);
            default:
                return getString(R.string.loading);
        }
    }

    /** The answer on screen came today. */
    private boolean fresh() {
        return Times.sameDay(updatedMs, System.currentTimeMillis(), ZoneId.systemDefault());
    }

    /**
     * Calendar's or Tasks' rows, between the header and the keys: as many as there are, scrolled (at once, never
     * sliding) just far enough that the selected row shows whole, with half a row past it where there is more.
     */
    private LinearLayout scrolling() {
        Rows s = new Rows();
        LinearLayout list = column();
        s.addView(list, new ScrollView.LayoutParams(ViewGroup.LayoutParams.MATCH_PARENT, ViewGroup.LayoutParams.WRAP_CONTENT));
        page.addView(s, new LinearLayout.LayoutParams(ViewGroup.LayoutParams.MATCH_PARENT, 0, 1f));
        scroll = s;
        return list;
    }

    /** Once the rows are added: the selected one is the one to keep in view. */
    private void keepInView() {
        scroll.row = selectedRow;
    }

    /** Calendar's and Tasks' rows: after each layout, before they are drawn, scrolled to keep the selected row in view. */
    private final class Rows extends ScrollView {
        View row;

        Rows() {
            super(BoardActivity.this);
            setVerticalScrollBarEnabled(false);
            setOverScrollMode(View.OVER_SCROLL_NEVER);
            // the keys are the activity's: a focused ScrollView would take Up and Down for itself
            setFocusable(false);
            setDescendantFocusability(ViewGroup.FOCUS_BLOCK_DESCENDANTS);
        }

        @Override
        protected void onLayout(boolean changed, int l, int t, int r, int b) {
            super.onLayout(changed, l, t, r, b);
            int y = scrollY;
            if (row != null) {
                int more = row.getHeight() / 2;
                y = Math.min(y, row.getTop() - more);
                y = Math.max(y, row.getBottom() + more - getHeight());
            }
            scrollY = Math.max(0, Math.min(y, getChildAt(0).getHeight() - getHeight()));
            scrollTo(0, scrollY);
        }
    }

    private void header(String title, String right) {
        LinearLayout top = padded(row());
        top.setGravity(Gravity.BOTTOM);
        top.addView(text(title, 56, false, ink), weight());
        top.addView(text(right, 32, false, muted));
        page.addView(top);
    }

    private LinearLayout eventRow(Agenda.Event e, boolean isSelected, boolean isNext, boolean tomorrow) {
        int fg = isSelected ? paper : tomorrow ? muted : ink;
        LinearLayout r = row();
        r.setPadding(px(24), px(16), px(24), px(16));
        if (isSelected) {
            r.setBackgroundColor(ink);
            selectedRow = r;
        }
        r.addView(text(e.time, 44, isNext, fg), new LinearLayout.LayoutParams(px(200), ViewGroup.LayoutParams.WRAP_CONTENT));
        r.addView(text(e.title, 44, isNext, fg), weight());
        if (!e.where.isEmpty()) r.addView(text(e.where, 28, false, isSelected ? paper : muted));
        return r;
    }

    private LinearLayout taskRow(Agenda.Task t, boolean isSelected) {
        int fg = isSelected ? paper : ink;
        LinearLayout r = row();
        r.setPadding(px(24), px(18), px(24), px(18));
        if (isSelected) {
            r.setBackgroundColor(ink);
            selectedRow = r;
        }
        r.addView(new Box(this, fg, 3 * scale, false), new LinearLayout.LayoutParams(px(32), px(32)));
        gap(r, 32);
        r.addView(text(t.title, 44, false, fg), weight());
        if (!t.due.isEmpty()) {
            boolean late = "overdue".equals(t.due);
            r.addView(text(t.due, 28, late, isSelected ? paper : late ? ink : muted));
        }
        return r;
    }

    /**
     * Beside the keys, when the lists may be out of date: why (offline, the key refused, a script error, or only being
     * fetched again), and when they were last fetched, with the day when that was not today.
     */
    private void note(LinearLayout footer) {
        if (updatedMs == 0 || problem == Agenda.OK && fresh()) return;
        ZonedDateTime at = Instant.ofEpochMilli(updatedMs).atZone(ZoneId.systemDefault());
        String when = fresh() ? Times.clock(at.toLocalTime()) : DAY_TIME.format(at);
        int why = problem == Agenda.NETWORK ? R.string.why_offline : problem == Agenda.KEY ? R.string.why_key
                : problem == Agenda.SCRIPT ? R.string.why_script : R.string.why_updating;
        gap(footer, 40);
        footer.addView(text(getString(R.string.note, getString(why), when), 26, false, muted));
    }

    private void key(LinearLayout footer, int keyRes, int labelRes) {
        TextView chip = text(getString(keyRes), 24, true, muted);
        GradientDrawable box = new GradientDrawable();
        box.setStroke(Math.max(1, px(2)), muted);
        chip.setBackground(box);
        chip.setPadding(px(12), px(4), px(12), px(4));
        footer.addView(chip);
        gap(footer, 16);
        footer.addView(text(getString(labelRes), 26, false, muted));
    }

    // ---- Small view helpers, in design pixels

    private int px(float design) {
        return Math.round(design * scale);
    }

    private TextView text(CharSequence s, float size, boolean isBold, int color) {
        TextView t = new TextView(this);
        t.setText(s);
        t.setTypeface(isBold ? bold : regular);
        t.setTextSize(TypedValue.COMPLEX_UNIT_PX, size * scale);
        t.setTextColor(color);
        t.setIncludeFontPadding(false);
        t.setSingleLine(true);
        t.setEllipsize(TextUtils.TruncateAt.END);
        return t;
    }

    /** A message that may take more than one line. */
    private static TextView wrapped(TextView t) {
        t.setSingleLine(false);
        t.setMaxLines(4);
        return t;
    }

    private TextView label(String s, int color) {
        TextView t = text(s, 24, true, color);
        t.setLetterSpacing(0.12f);
        return t;
    }

    private LinearLayout row() {
        LinearLayout r = new LinearLayout(this);
        r.setOrientation(LinearLayout.HORIZONTAL);
        r.setGravity(Gravity.CENTER_VERTICAL);
        return r;
    }

    private LinearLayout column() {
        LinearLayout c = new LinearLayout(this);
        c.setOrientation(LinearLayout.VERTICAL);
        return c;
    }

    /** Lines the content up with the text inside the selection bars, which reach 24 px further left. */
    private <T extends View> T padded(T v) {
        v.setPadding(px(24), v.getPaddingTop(), v.getPaddingRight(), v.getPaddingBottom());
        return v;
    }

    private static LinearLayout.LayoutParams weight() {
        return new LinearLayout.LayoutParams(0, ViewGroup.LayoutParams.WRAP_CONTENT, 1f);
    }

    private void add(LinearLayout parent, View v, float topGap) {
        LinearLayout.LayoutParams p = new LinearLayout.LayoutParams(
                ViewGroup.LayoutParams.MATCH_PARENT, ViewGroup.LayoutParams.WRAP_CONTENT);
        p.topMargin = px(topGap);
        parent.addView(v, p);
    }

    private void gap(LinearLayout parent, float design) {
        parent.addView(new View(this), new LinearLayout.LayoutParams(px(design), px(design)));
    }

    private void spacer(LinearLayout parent) {
        parent.addView(new View(this), new LinearLayout.LayoutParams(1, 0, 1f));
    }
}
